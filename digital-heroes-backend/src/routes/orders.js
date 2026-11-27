/** CUSTOMER order lifecycle: quote -> artwork -> CSV -> proofs -> approval -> reorder -> invoice. */
const router = require('express').Router();
const crypto = require('crypto');
const { Order, Proof, ApprovalLog, Design, Product } = require('../models');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const { order: v, objectId, z } = require('../validators');
const orderService = require('../services/orderService');
const designService = require('../services/designService');
const printService = require('../services/printService');
const paymentService = require('../services/paymentService');
const invoiceService = require('../services/invoiceService');
const storage = require('../services/storage');
const env = require('../config/env');
const { parsePage, pageMeta } = require('../utils/paginate');
const { notFound, bad, conflict, forbidden } = require('../utils/AppError');
const { findProduct } = require('./catalogue');

router.use(requireAuth);
const idParam = z.object({ id: objectId });

/** Owner or admin may READ; everyone else gets a 404 (do not leak existence of other customers' orders). */
async function loadOrder(req, { ownerOnly = false } = {}) {
  const o = await Order.findById(req.params.id);
  const isOwner = o && String(o.user) === String(req.user._id);
  if (!o || (!isOwner && (ownerOnly || req.user.role !== 'admin'))) throw notFound('Order not found');
  return o;
}

// ---------------------------------------------------------------- create / list / read
// POST /api/orders   -> creates a priced QUOTE (price recalculated on the server)
router.post('/', validate({ body: v.create }), asyncHandler(async (req, res) => {
  const product = await findProduct(req.body.product);
  let design = null, snapshot = { source: 'editor', background: '#FFFFFF', elements: [] };
  if (req.body.design) {
    design = await Design.findOne({ _id: req.body.design, user: req.user._id });
    if (!design) throw notFound('Design not found');
    if (String(design.product) !== String(product._id)) throw bad('Design belongs to a different product');
    snapshot = designService.snapshotOf(design);
  }
  const order = await orderService.createQuote({ user: req.user, product, config: req.body.config, quantity: req.body.quantity, design, snapshot, notes: req.body.notes });
  // artwork must fit the print area of THIS order's size
  if (snapshot.elements.length) {
    const chk = await designService.validateElements(snapshot.elements, { trimW: order.config.widthMm, trimH: order.config.heightMm, spec: order.printSpec, userId: req.user._id });
    if (!chk.valid) { await order.deleteOne(); return res.status(422).json({ success: false, error: { code: 'OUTSIDE_PRINT_AREA', message: 'Design does not fit the selected size', details: chk.errors } }); }
  }
  res.status(201).json({ success: true, data: { order: orderService.customerView(order, { detail: true }) } });
}));

// GET /api/orders?status=&page=&limit=    (order history)
router.get('/', asyncHandler(async (req, res) => {
  const p = parsePage(req.query);
  const f = { user: req.user._id };
  if (req.query.status) f.status = req.query.status;
  const [items, total] = await Promise.all([Order.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit), Order.countDocuments(f)]);
  res.json({ success: true, data: items.map((o) => orderService.customerView(o)), meta: pageMeta(p, total) });
}));

// GET /api/orders/:id
router.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await loadOrder(req);
  const proofs = await Proof.find({ order: o._id }).sort({ version: 1 }).select('-previewKey');
  res.json({ success: true, data: { order: orderService.customerView(o, { detail: true }), proofs } });
}));

// DELETE /api/orders/:id  -> cancel an unpaid quote
router.delete('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await loadOrder(req, { ownerOnly: true });
  if (o.status !== 'quote') throw conflict('Only unpaid quotes can be cancelled by the customer');
  await orderService.transition(o, 'cancelled', { by: req.user._id, note: 'cancelled by customer' });
  res.json({ success: true, data: { order: orderService.customerView(o) } });
}));

// ---------------------------------------------------------------- artwork
// PUT /api/orders/:id/artwork   body: {design:"<id>"}  or  {elements:[...], background}
router.put('/:id/artwork', validate({ params: idParam, body: v.artwork }), asyncHandler(async (req, res) => {
  const o = await loadOrder(req, { ownerOnly: true });
  let snapshot;
  if (req.body.design) {
    const d = await Design.findOne({ _id: req.body.design, user: req.user._id });
    if (!d) throw notFound('Design not found');
    if (String(d.product) !== String(o.product)) throw bad('Design belongs to a different product');
    snapshot = designService.snapshotOf(d);
    o.design = d._id;
  } else {
    snapshot = { source: 'editor', background: req.body.background || o.designSnapshot.background || '#FFFFFF', elements: req.body.elements };
  }
  if (snapshot.elements.length) {
    const chk = await designService.validateElements(snapshot.elements, { trimW: o.config.widthMm, trimH: o.config.heightMm, spec: o.printSpec, userId: req.user._id });
    if (!chk.valid) return res.status(422).json({ success: false, error: { code: 'OUTSIDE_PRINT_AREA', message: 'Artwork is outside the printable area', details: chk.errors } });
  }
  if (o.variableData && o.variableData.fileKey && o.status === 'quote') { o.variableData = undefined; } // CSV must be re-checked against new keys
  const proof = await orderService.replaceArtwork(o, snapshot, req.user);
  res.json({ success: true, data: { order: orderService.customerView(o, { detail: true }), newProofVersion: proof ? proof.version : null } });
}));

// ---------------------------------------------------------------- CSV variable data
// GET /api/orders/:id/csv-template  -> header row the customer should fill in
router.get('/:id/csv-template', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await loadOrder(req, { ownerOnly: true });
  const keys = [...new Set((o.designSnapshot.elements || []).filter((e) => e.variableKey).map((e) => e.variableKey))];
  if (!keys.length) throw bad('This artwork has no variable (merge) fields');
  res.type('text/csv').attachment(`${o.orderNumber}_template.csv`).send(`${keys.join(',')}\n`);
}));

// POST /api/orders/:id/csv   (multipart: file=.csv)  -> one artwork per row; quantity becomes the row count
router.post('/:id/csv', validate({ params: idParam }), upload.single('file'), asyncHandler(async (req, res) => {
  const o = await loadOrder(req, { ownerOnly: true });
  if (o.status !== 'quote') throw conflict('CSV data must be attached before checkout');
  const product = await Product.findById(o.product);
  if (!product.supportsVariableData) throw bad('This product does not support CSV variable data');
  if (!req.file) throw bad('Attach a .csv in the "file" field');
  if (!/\.csv$/i.test(req.file.originalname) && !/csv|text\/plain/.test(req.file.mimetype)) throw bad('File must be a .csv');

  const a = printService.analyseCsv(req.file.buffer, o.designSnapshot.elements || [], env.limits.csvMaxRows);
  if (a.error) throw bad(a.error);
  if (!a.keys.length) throw bad('Your artwork has no variable fields (set "variableKey" on text elements first)');
  if (a.missing.length) return res.status(422).json({ success: false, error: { code: 'CSV_COLUMNS_MISSING', message: `CSV is missing columns: ${a.missing.join(', ')}`, details: { required: a.keys, found: a.columns } } });

  const key = `csv/${o._id}.csv`;
  await storage.put(key, req.file.buffer);
  o.variableData = { fileKey: key, originalName: req.file.originalname, rowCount: a.rows.length, columns: a.columns };
  try { await orderService.reprice(o, a.rows.length); }
  catch (e) { if (e.status === 400) throw bad(`Your CSV has ${a.rows.length} rows. ${e.message} (quantity = number of CSV rows).`); throw e; }
  await o.save();
  res.json({ success: true, data: { rowCount: a.rows.length, columns: a.columns, unusedColumns: a.unused, fieldsUsingDefaultText: a.usingDefaults, sampleRows: a.rows.slice(0, 3), pricing: o.pricing } });
}));

// ---------------------------------------------------------------- checkout shortcut (also at /api/payments/checkout)
router.post('/:id/checkout', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await loadOrder(req, { ownerOnly: true });
  res.json({ success: true, data: await paymentService.initiate(o, req.user) });
}));

// ---------------------------------------------------------------- proofs & approval gate
// GET /api/orders/:id/proofs
router.get('/:id/proofs', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await loadOrder(req);
  const proofs = await Proof.find({ order: o._id }).sort({ version: 1 }).select('-previewKey');
  res.json({ success: true, data: { latestVersion: o.latestProofVersion, approvedVersion: o.approvedProofVersion, proofs } });
}));

// GET /api/orders/:id/proofs/:version/preview.png   (token may be passed as ?token= for <img> tags)
router.get('/:id/proofs/:version/preview.png', validate({ params: v.version }), asyncHandler(async (req, res) => {
  const o = await loadOrder(req);
  const p = await Proof.findOne({ order: o._id, version: req.params.version });
  if (!p) throw notFound('Proof not found');
  res.type('png'); storage.storage.sendTo(res, p.previewKey);;
}));

// POST /api/orders/:id/proofs/:version/approve
router.post('/:id/proofs/:version/approve', validate({ params: v.version }), asyncHandler(async (req, res) => {
  const o = await loadOrder(req, { ownerOnly: true });
  const proof = await orderService.approveProof(o, Number(req.params.version), req.user, req.ip);
  res.json({ success: true, data: { proof, order: orderService.customerView(o), message: 'Proof approved - print files are now being generated.' } });
}));

// POST /api/orders/:id/proofs/:version/request-changes   body: {note}
router.post('/:id/proofs/:version/request-changes', validate({ params: v.version, body: v.requestChanges }), asyncHandler(async (req, res) => {
  const o = await loadOrder(req, { ownerOnly: true });
  const proof = await orderService.requestChanges(o, Number(req.params.version), req.user, req.body.note, req.ip);
  res.json({ success: true, data: { proof, next: 'Update the artwork with PUT /api/orders/:id/artwork to generate the next proof version.' } });
}));

// GET /api/orders/:id/approval-log
router.get('/:id/approval-log', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await loadOrder(req);
  res.json({ success: true, data: await ApprovalLog.find({ order: o._id }).sort({ at: 1 }) });
}));

// ---------------------------------------------------------------- reorder
// POST /api/orders/:id/reorder   body: {quantity?, checkout?: true}  -> new quote (+ checkout intent when checkout=true)
router.post('/:id/reorder', validate({ params: idParam, body: v.reorder }), asyncHandler(async (req, res) => {
  const prev = await loadOrder(req, { ownerOnly: true });
  const r = await orderService.reorder(prev, req.user, { quantity: req.body.quantity });
  const out = { order: orderService.customerView(r.order, { detail: true }), priceChanged: r.priceChanged, previousTotalMinor: r.previousTotalMinor, artworkCarriedOver: r.order.carryOverApproval };
  if (req.body.checkout !== false) out.payment = await paymentService.initiate(r.order, req.user); // one click: quote + payment intent
  res.status(201).json({ success: true, data: out });
}));

// ---------------------------------------------------------------- invoice
// GET /api/orders/:id/invoice   -> PDF (paid orders)
router.get('/:id/invoice', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const o = await loadOrder(req);
  if (o.payment.status !== 'paid') throw conflict('Invoice is available after payment');
  const User = require('../models').User;
  const owner = String(o.user) === String(req.user._id) ? req.user : await User.findById(o.user);
  const pdf = await invoiceService.invoicePDF(o, owner);
  res.type('pdf').attachment(`${o.payment.invoiceNumber}.pdf`).send(pdf);
}));

module.exports = router;
