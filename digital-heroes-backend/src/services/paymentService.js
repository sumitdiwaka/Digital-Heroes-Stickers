/**
 * Payments. Real Stripe when STRIPE_SECRET_KEY is set (PaymentIntent + webhook),
 * otherwise a MOCK provider so the whole flow can be tested without a gateway.
 * Card data never touches this server (PCI scope stays with Stripe).
 */
const crypto = require('crypto');
const env = require('../config/env');
const { Order } = require('../models');
const { bad, conflict } = require('../utils/AppError');
const orderService = require('./orderService');

let stripe = null;
if (env.stripeSecretKey) stripe = require('stripe')(env.stripeSecretKey);
const mode = () => (stripe ? 'stripe' : 'mock');

async function initiate(order, user) {
  if (order.status !== 'quote') throw conflict(`Order is already "${order.status}"`);
  if (order.payment.status === 'paid') throw conflict('Order already paid');
  const snap = order.designSnapshot || {};
  const hasUpload = !!(snap.upload && snap.upload.fileKey); // nested paths are never undefined in Mongoose
  if (!hasUpload && !(snap.elements || []).length) {
    throw bad('Add artwork (design or upload) before checkout');
  }
  if (stripe) {
    const intent = await stripe.paymentIntents.create({
      amount: order.pricing.totalMinor, currency: env.currency.toLowerCase(),
      metadata: { orderId: String(order._id), orderNumber: order.orderNumber }, receipt_email: user.email,
      automatic_payment_methods: { enabled: true },
    });
    order.payment = { ...order.payment.toObject(), provider: 'stripe', intentId: intent.id, status: 'pending' };
    await order.save();
    return { provider: 'stripe', clientSecret: intent.client_secret, amountMinor: order.pricing.totalMinor, currency: env.currency };
  }
  const intentId = `mock_pi_${crypto.randomBytes(8).toString('hex')}`;
  order.payment = { ...order.payment.toObject(), provider: 'mock', intentId, status: 'pending' };
  await order.save();
  return { provider: 'mock', intentId, amountMinor: order.pricing.totalMinor, currency: env.currency, note: 'MOCK mode: call POST /api/payments/mock/confirm with this orderId to simulate a successful payment.' };
}

async function mockConfirm(order) {
  if (stripe) throw bad('Mock confirmation is disabled when Stripe is configured');
  if (order.payment.provider !== 'mock' || order.payment.status !== 'pending') throw conflict('Start checkout first (POST /api/payments/checkout)');
  return orderService.afterPayment(order._id);
}

async function handleWebhook(rawBody, signature) {
  if (!stripe) throw bad('Stripe not configured');
  const event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);
  if (event.type === 'payment_intent.succeeded') {
    const orderId = event.data.object.metadata.orderId;
    const order = await Order.findById(orderId);
    if (order && order.payment.intentId === event.data.object.id) await orderService.afterPayment(orderId);
  } else if (event.type === 'payment_intent.payment_failed') {
    await Order.updateOne({ _id: event.data.object.metadata.orderId }, { 'payment.status': 'failed' });
  }
  return event.type;
}

module.exports = { initiate, mockConfirm, handleWebhook, mode };
