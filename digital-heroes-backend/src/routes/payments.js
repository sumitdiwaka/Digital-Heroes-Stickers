const router = require('express').Router();
const { Order } = require('../models');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { objectId, z } = require('../validators');
const paymentService = require('../services/paymentService');
const orderService = require('../services/orderService');
const { notFound } = require('../utils/AppError');

const body = z.object({ orderId: objectId });
const mine = async (req) => {
  const o = await Order.findOne({ _id: req.body.orderId, user: req.user._id });
  if (!o) throw notFound('Order not found');
  return o;
};

// GET /api/payments/config
router.get('/config', (_req, res) => res.json({ success: true, data: { provider: paymentService.mode() } }));

// POST /api/payments/checkout  {orderId}  -> Stripe client secret (or mock intent)
router.post('/checkout', requireAuth, validate({ body }), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await paymentService.initiate(await mine(req), req.user) });
}));

// POST /api/payments/mock/confirm  {orderId}  -> simulates a successful payment (disabled when Stripe is live)
router.post('/mock/confirm', requireAuth, validate({ body }), asyncHandler(async (req, res) => {
  const o = await paymentService.mockConfirm(await mine(req));
  res.json({ success: true, data: { order: orderService.customerView(o), message: 'Payment confirmed (mock). Proof v1 generated.' } });
}));

// POST /api/payments/webhook  (Stripe; raw body mounted in app.js BEFORE express.json)
router.post('/webhook', asyncHandler(async (req, res) => {
  const type = await paymentService.handleWebhook(req.body, req.headers['stripe-signature']);
  res.json({ received: true, type });
}));

module.exports = router;
