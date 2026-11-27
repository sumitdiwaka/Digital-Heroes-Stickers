/** Customer dashboard - the six required modules in ONE call (+ separate invoices list). */
const router = require('express').Router();
const { Order, Design, Proof } = require('../models');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const orderService = require('../services/orderService');

router.use(['/dashboard', '/invoices'], requireAuth); // scoped so it never gates other /api routes

const invoiceRow = (o) => ({ orderId: o._id, orderNumber: o.orderNumber, invoiceNumber: o.payment.invoiceNumber, date: o.payment.paidAt, totalMinor: o.pricing.totalMinor, currency: o.pricing.currency, downloadUrl: `/api/orders/${o._id}/invoice` });

// GET /api/dashboard/customer
router.get('/dashboard/customer', asyncHandler(async (req, res) => {
  const u = req.user;
  const checks = { name: !!u.name, phone: !!u.phone, company: !!u.company, address: !!(u.address && u.address.line1 && u.address.city && u.address.postalCode) };
  const done = Object.values(checks).filter(Boolean).length;

  const [orders, designs] = await Promise.all([
    Order.find({ user: u._id }).sort({ createdAt: -1 }),
    Design.find({ user: u._id }).populate('product', 'name slug').sort({ updatedAt: -1 }).limit(50),
  ]);
  const counts = Object.fromEntries(Order.STATUSES.map((s) => [s, 0]));
  orders.forEach((o) => { counts[o.status] += 1; });

  // active proofs = latest proof of every order currently in the "proof" stage
  const proofOrders = orders.filter((o) => o.status === 'proof');
  const proofs = await Proof.find({ order: { $in: proofOrders.map((o) => o._id) } }).sort({ version: -1 });
  const activeProofs = proofOrders.map((o) => {
    const p = proofs.find((x) => String(x.order) === String(o._id) && x.version === o.latestProofVersion);
    return p && { orderId: o._id, orderNumber: o.orderNumber, productName: o.productName, version: p.version, versionsTotal: o.latestProofVersion, status: p.status, approved: o.approvedProofVersion === p.version, changeRequestNote: p.changeRequestNote, previewUrl: `/api/orders/${o._id}/proofs/${p.version}/preview.png` };
  }).filter(Boolean);

  res.json({
    success: true,
    data: {
      profile: { user: u.toSafeJSON(), completenessPct: Math.round((done / 4) * 100), missing: Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k) },
      orders: { counts, recent: orders.slice(0, 5).map((o) => orderService.customerView(o)) },
      savedDesigns: designs.map((d) => ({ id: d._id, name: d.name, product: d.product, config: d.config, source: d.source, approved: d.approved, approvedAt: d.approvedAt, updatedAt: d.updatedAt, previewUrl: `/api/designs/${d._id}/preview.png` })),
      activeProofs,
      reorderable: orders.filter((o) => ['production', 'completed'].includes(o.status) || o.approvedProofVersion != null).slice(0, 10).map((o) => ({ orderId: o._id, orderNumber: o.orderNumber, productName: o.productName, quantity: o.quantity, config: o.config, totalMinor: o.pricing.totalMinor, reorderUrl: `/api/orders/${o._id}/reorder` })),
      invoices: orders.filter((o) => o.payment.status === 'paid').map(invoiceRow),
    },
  });
}));

// GET /api/invoices
router.get('/invoices', asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id, 'payment.status': 'paid' }).sort({ 'payment.paidAt': -1 });
  res.json({ success: true, data: orders.map(invoiceRow) });
}));

module.exports = router;
