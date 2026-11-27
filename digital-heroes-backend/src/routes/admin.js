/** ADMIN console API. Every route requires role=admin. */
const router = require('express').Router();
const archiver = require('archiver');
const { User, Division, Product, Template, Gallery, Order, Proof, ApprovalLog } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const { admin: v, auth: av, objectId, z } = require('../validators');
const orderService = require('../services/orderService');
const printService = require('../services/printService');
const reportService = require('../services/reportService');
const xeroService = require('../services/xeroService');
const storage = require('../services/storage');
const email = require('../services/email');
const { parsePage, pageMeta } = require('../utils/paginate');
const { notFound, bad, conflict } = require('../utils/AppError');

//Thats it
router.use(requireAuth, requireRole('admin'));
const idParam = z.object({ id: objectId });
const rx = (s) => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

// ================================================================= USERS
// GET /api/admin/users?q=&role=&page=
router.get('/users', asyncHandler(async (req, res) => {
  const p = parsePage(req.query);
  const f = {};
  if (req.query.role) f.role = req.query.role;
  if (req.query.q) f.$or = [{ name: rx(req.query.q) }, { email: rx(req.query.q) }, { company: rx(req.query.q) }];
  const [items, total] = await Promise.all([User.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit), User.countDocuments(f)]);
  res.json({ success: true, data: items.map((u) => u.toSafeJSON()), meta: pageMeta(p, total) });
}));

// POST /api/admin/users   (create staff/customer accounts)
router.post('/users', validate({ body: av.register.extend({ role: z.enum(['customer', 'admin']).default('customer') }) }), asyncHandler(async (req, res) => {
  if (await User.exists({ email: req.body.email })) throw conflict('Email already in use');
  const u = new User({ name: req.body.name, email: req.body.email, role: req.body.role, phone: req.body.phone, company: req.body.company });
  await u.setPassword(req.body.password); await u.save();
  res.status(201).json({ success: true, data: u.toSafeJSON() });
}));

router.get('/users/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw notFound('User not found');
  const stats = await Order.aggregate([{ $match: { user: u._id, 'payment.status': 'paid' } }, { $group: { _id: null, orders: { $sum: 1 }, spentMinor: { $sum: '$pricing.totalMinor' } } }]);
  res.json({ success: true, data: { user: u.toSafeJSON(), stats: stats[0] || { orders: 0, spentMinor: 0 } } });
}));

// PATCH /api/admin/users/:id   {role?, isActive?, name?}
router.patch('/users/:id', validate({ params: idParam, body: v.userUpdate }), asyncHandler(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw notFound('User not found');
  if (String(u._id) === String(req.user._id) && (req.body.role === 'customer' || req.body.isActive === false)) throw conflict('You cannot demote or disable your own account');
  Object.assign(u, req.body); await u.save();
  res.json({ success: true, data: u.toSafeJSON() });
}));

// ================================================================= CATALOGUE MANAGEMENT
const crud = (path, Model, schema, { populate } = {}) => {
  router.get(path, asyncHandler(async (req, res) => {
    const f = {}; if (req.query.product) f.product = req.query.product; if (req.query.division) f.division = req.query.division;
    let q = Model.find(f).sort({ sortOrder: 1, createdAt: -1 }); if (populate) q = q.populate(populate);
    res.json({ success: true, data: await q });
  }));
  router.post(path, validate({ body: schema }), asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await Model.create(req.body) })));
  router.put(`${path}/:id`, validate({ params: idParam, body: schema.partial ? schema.partial() : schema }), asyncHandler(async (req, res) => {
    const d = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!d) throw notFound('Not found'); res.json({ success: true, data: d });
  }));
  router.delete(`${path}/:id`, validate({ params: idParam }), asyncHandler(async (req, res) => {
    const d = await Model.findById(req.params.id); if (!d) throw notFound('Not found');
    if ('active' in d.schema.paths) { d.active = false; await d.save(); return res.json({ success: true, data: { deactivated: true } }); } // soft delete keeps order history intact
    await d.deleteOne(); res.json({ success: true, data: { deleted: true } });
  }));
};
crud('/divisions', Division, v.division);
crud('/products', Product, v.product, { populate: 'division' });
crud('/templates', Template, v.template);
crud('/gallery', Gallery, v.gallery, { populate: 'division' });

// ================================================================= ORDERS (production pipeline)
const adminOrderRow = (o) => ({
  id: o._id, orderNumber: o.orderNumber, status: o.status, createdAt: o.createdAt,
  customer: o.user && o.user.name ? { id: o.user._id, name: o.user.name, email: o.user.email, company: o.user.company } : o.user,
  productName: o.productName, productType: o.productType, division: o.divisionSlug, quantity: o.quantity, config: o.config,
  totalMinor: o.pricing.totalMinor, currency: o.pricing.currency, paymentStatus: o.payment.status,
  proof: { latest: o.latestProofVersion, approved: o.approvedProofVersion },
  filesUnlocked: o.filesUnlocked,
  readyForProduction: o.filesUnlocked && ['artwork', 'proof', 'production'].includes(o.status),
  printJob: o.printJob && { status: o.printJob.status, progress: o.printJob.progress, total: o.printJob.total },
  archived: o.archived,
});

// GET /api/admin/orders?status=&customer=&q=&product=&division=&from=&to=&ready=true&archived=&page=
router.get('/orders', asyncHandler(async (req, res) => {
  const p = parsePage(req.query);
  const f = { archived: req.query.archived === 'true' };
  if (req.query.status) f.status = { $in: String(req.query.status).split(',') };
  if (req.query.product) f.productType = req.query.product;
  if (req.query.division) f.divisionSlug = req.query.division;
  if (req.query.ready === 'true') { f.filesUnlocked = true; f.status = { $in: ['proof', 'artwork', 'production'] }; }
  if (req.query.paid === 'true') f['payment.status'] = 'paid';
  if (req.query.from || req.query.to) { f.createdAt = {}; if (req.query.from) f.createdAt.$gte = new Date(req.query.from); if (req.query.to) f.createdAt.$lte = new Date(req.query.to); }
  if (req.query.customer) {
    const ids = /^[a-f\d]{24}$/i.test(req.query.customer) ? [req.query.customer] : (await User.find({ $or: [{ name: rx(req.query.customer) }, { email: rx(req.query.customer) }, { company: rx(req.query.customer) }] }).select('_id')).map((u) => u._id);
    f.user = { $in: ids };
  }
  if (req.query.q) f.orderNumber = rx(req.query.q);
  const [items, total] = await Promise.all([
    Order.find(f).populate('user', 'name email company').sort({ createdAt: -1 }).skip(p.skip).limit(p.limit), Order.countDocuments(f),
  ]);
  res.json({ success: true, data: items.map(adminOrderRow), meta: pageMeta(p, total) });
}));

// GET /api/admin/orders/:id   (full job ticket)
router.get('/orders/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await Order.findById(req.params.id).populate('user', '-passwordReset');
  if (!o) throw notFound('Order not found');
  const [proofs, log] = await Promise.all([Proof.find({ order: o._id }).sort({ version: 1 }), ApprovalLog.find({ order: o._id }).sort({ at: 1 })]);
  const obj = o.toObject();
  res.json({ success: true, data: { order: obj, summary: adminOrderRow(o), proofs, approvalLog: log, files: o.filesUnlocked ? o.printFiles.map((f) => ({ ...f.toObject(), downloadUrl: `/api/admin/orders/${o._id}/files/${encodeURIComponent(f.name)}` })) : [], filesLockedReason: o.filesUnlocked ? null : 'Locked until the customer approves a proof' } });
}));

// POST /api/admin/orders/:id/advance   {toStatus?, note?}   (default = next stage)
router.post('/orders/:id/advance', validate({ params: idParam, body: v.advance }), asyncHandler(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw notFound('Order not found');
  const to = req.body.toStatus || (orderService.FORWARD[o.status] || [])[0];
  if (!to) throw conflict(`No further stage after "${o.status}"`);
  if (to === 'proof' && o.status === 'artwork') {
    if (o.payment.status !== 'paid') throw conflict('Order is not paid');
    await orderService.createProof(o, { by: req.user._id, note: req.body.note });
  } else {
    await orderService.transition(o, to, { by: req.user._id, note: req.body.note });
  }
  const customer = await User.findById(o.user);
  if (o.status === 'completed') email.completed(customer, o); else email.statusChanged(customer, o);
  res.json({ success: true, data: adminOrderRow(o) });
}));

// POST /api/admin/orders/:id/proofs   (optional multipart file=png|jpg manual proof; otherwise regenerates from artwork)
router.post('/orders/:id/proofs', validate({ params: idParam }), upload.single('file'), asyncHandler(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw notFound('Order not found');
  if (o.payment.status !== 'paid') throw conflict('Order is not paid');
  if (o.filesUnlocked) throw conflict('A proof is already approved for this order');
  if (!['artwork', 'proof'].includes(o.status)) throw conflict(`Cannot add proofs in status "${o.status}"`);
  let buffer;
  if (req.file) {
    const t = upload.sniff(req.file.buffer, req.file.originalname);
    if (!t || !['png', 'jpg'].includes(t.ext)) throw bad('Manual proofs must be PNG or JPG');
    buffer = req.file.buffer;
  }
  if (o.status === 'proof') { o.status = 'artwork'; o.statusHistory.push({ status: 'artwork', by: req.user._id, note: 'new proof requested' }); await o.save(); }
  const proof = await orderService.createProof(o, { by: req.user._id, origin: buffer ? 'admin_upload' : 'generated', buffer, note: req.body.note });
  res.status(201).json({ success: true, data: proof });
}));

// ---------------- production files (APPROVAL GATE enforced)
async function unlockedOrder(req) {
  const o = await Order.findById(req.params.id);
  if (!o) throw notFound('Order not found');
  if (!o.filesUnlocked) throw new (require('../utils/AppError').AppError)(423, 'Print files are locked until the customer approves a proof', 'FILES_LOCKED');
  return o;
}

// GET /api/admin/orders/:id/files
router.get('/orders/:id/files', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await unlockedOrder(req);
  res.json({ success: true, data: { directory: printService.dirFor(o), printJob: o.printJob, files: o.printFiles.map((f) => ({ ...f.toObject(), downloadUrl: `/api/admin/orders/${o._id}/files/${encodeURIComponent(f.name)}` })), zipUrl: `/api/admin/orders/${o._id}/files.zip` } });
}));

// GET /api/admin/orders/:id/files.zip   (declared before :name so "files.zip" is not treated as a file name)
router.get('/orders/:id/files.zip', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await unlockedOrder(req);
  if (o.printJob.status !== 'done' || !o.printFiles.length) throw conflict(`Files are not ready yet (job status: ${o.printJob.status})`);
  res.attachment(`${o.orderNumber}_${o.productType}_files.zip`);
  const zip = archiver('zip', { zlib: { level: 6 } });
  zip.on('error', (e) => res.destroy(e));
  zip.pipe(res);
  for (const f of o.printFiles) zip.file(storage.absolutePath(f.key), { name: `${o.orderNumber}/${f.name}` });
  await zip.finalize();
}));

// GET /api/admin/orders/:id/files/:name
router.get('/orders/:id/files/:name', validate({ params: z.object({ id: objectId, name: z.string().max(200) }) }), asyncHandler(async (req, res) => {
  const o = await unlockedOrder(req);
  const f = o.printFiles.find((x) => x.name === req.params.name); // whitelist lookup - no user-controlled paths
  if (!f) throw notFound('File not found');
  res.attachment(f.name); storage.stream(f.key).pipe(res);
}));

// POST /api/admin/orders/:id/regenerate-files   ?png=true|false
router.post('/orders/:id/regenerate-files', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await unlockedOrder(req);
  if (['queued', 'running'].includes(o.printJob.status)) throw conflict('A print job is already running');
  printService.queueGeneration(o._id, { includePng: req.query.png === undefined ? undefined : req.query.png === 'true' });
  res.status(202).json({ success: true, data: { message: 'Print job queued', statusUrl: `/api/admin/orders/${o._id}/files` } });
}));

// POST /api/admin/orders/:id/archive | /unarchive
router.post('/orders/:id/archive', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await Order.findById(req.params.id); if (!o) throw notFound('Order not found');
  if (!['completed', 'cancelled'].includes(o.status)) throw conflict('Only completed or cancelled orders can be archived');
  o.archived = true; await o.save(); res.json({ success: true, data: adminOrderRow(o) });
}));
router.post('/orders/:id/unarchive', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await Order.findById(req.params.id); if (!o) throw notFound('Order not found');
  o.archived = false; await o.save(); res.json({ success: true, data: adminOrderRow(o) });
}));

// ================================================================= DASHBOARD / REPORTS / EXPORT
// GET /api/admin/dashboard  - queue overview
router.get('/dashboard', asyncHandler(async (_req, res) => {
  const [byStatus, ready, awaitingApproval, running] = await Promise.all([
    Order.aggregate([{ $match: { archived: false } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Order.countDocuments({ filesUnlocked: true, status: { $in: ['proof', 'artwork'] } }),
    Order.countDocuments({ status: 'proof', filesUnlocked: false }),
    Order.countDocuments({ 'printJob.status': { $in: ['queued', 'running'] } }),
  ]);
  res.json({ success: true, data: { pipeline: Object.fromEntries(byStatus.map((s) => [s._id, s.n])), readyForProduction: ready, awaitingCustomerApproval: awaitingApproval, printJobsRunning: running } });
}));

// GET /api/admin/reports/summary?from=&to=
router.get('/reports/summary', asyncHandler(async (req, res) => res.json({ success: true, data: await reportService.summary(req.query) })));

// GET /api/admin/export/xero-invoices.csv?from=&to=
router.get('/export/xero-invoices.csv', asyncHandler(async (req, res) => {
  res.type('text/csv').attachment('xero-invoices.csv').send(await xeroService.invoicesCsv(req.query));
}));

// GET /api/admin/notifications/outbox  (dev aid: last emails the system sent)
router.get('/notifications/outbox', (_req, res) => res.json({ success: true, data: email.outbox }));

module.exports = router;
