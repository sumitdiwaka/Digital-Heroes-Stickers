/**
 * ORDER WORKFLOW - the heart of the platform.
 *
 *   quote -> order -> artwork -> proof -> production -> completed        (+ cancelled)
 *
 *  quote      priced + saved, not paid          (customer can edit/cancel)
 *  order      paid                              (automatic)
 *  artwork    system prepares proof             (automatic)
 *  proof      proof vN waiting for the customer; APPROVAL GATE: print files stay locked until approved
 *  production admin moves it here once files are unlocked
 *  completed  done -> can be archived; reorder in one click
 */
const crypto = require('crypto');
const { Order, Proof, ApprovalLog, Counter, Design, User, Product } = require('../models');
const pricing = require('./pricing');
const storage = require('./storage');
const email = require('./email');
const printService = require('./printService');
const designService = require('./designService');
const { bad, conflict, forbidden, notFound } = require('../utils/AppError');

const FORWARD = { quote: ['order'], order: ['artwork'], artwork: ['proof'], proof: ['production', 'artwork'], production: ['completed'], completed: [], cancelled: [] };
const CANCELLABLE = ['quote', 'order', 'artwork', 'proof'];

async function nextOrderNumber() {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const n = await Counter.next(`order-${ymd}`);
  return `DH-${ymd}-${String(n).padStart(4, '0')}`;
}

/** Move an order to a new status, enforcing the pipeline rules. */
async function transition(order, to, { by, note, force } = {}) {
  if (to === 'cancelled') {
    if (!CANCELLABLE.includes(order.status)) throw conflict(`Cannot cancel an order that is "${order.status}"`);
  } else if (!force && !(FORWARD[order.status] || []).includes(to)) {
    throw conflict(`Invalid transition ${order.status} -> ${to}`, { allowed: FORWARD[order.status] });
  }
  if (to === 'production' && !order.filesUnlocked) throw conflict('Approval gate: the customer has not approved a proof yet');
  if (['order', 'artwork', 'proof', 'production', 'completed'].includes(to) && order.payment.status !== 'paid') throw conflict('Order is not paid');
  order.status = to;
  order.statusHistory.push({ status: to, by, note });
  if (to === 'completed') order.completedAt = new Date();
  await order.save();
  return order;
}

/** Create a priced QUOTE. Price is ALWAYS recalculated server-side - never trusted from the client. */
async function createQuote({ user, product, config, quantity, design, snapshot, reorderOf, carryOverApproval, notes }) {
  const priced = pricing.calculate(product, config, quantity);
  const order = await Order.create({
    orderNumber: await nextOrderNumber(),
    user: user._id, product: product._id, division: product.division,
    productName: product.name, productType: product.productType, divisionSlug: product.divisionSlug,
    config: priced.config, quantity, printSpec: { bleedMm: product.printSpec.bleedMm, safeMarginMm: product.printSpec.safeMarginMm, dpi: product.printSpec.dpi },
    pricing: priced.pricing,
    design: design ? design._id : undefined,
    designSnapshot: snapshot,
    status: 'quote', statusHistory: [{ status: 'quote', by: user._id }],
    reorderOf, carryOverApproval: !!carryOverApproval, notes,
  });
  return order;
}

/** Recalculate and store pricing (used when quantity changes, e.g. after CSV upload). */
async function reprice(order, quantity) {
  const product = await Product.findById(order.product);
  const priced = pricing.calculate(product, order.config, quantity ?? order.quantity);
  order.quantity = quantity ?? order.quantity;
  order.pricing = priced.pricing;
  return order;
}

// ---------------------------------------------------------------- proofs
async function createProof(order, { by, origin = 'generated', buffer, note } = {}) {
  const { latestProofVersion: version } = await Order.findByIdAndUpdate(order._id, { $inc: { latestProofVersion: 1 } }, { new: true }).select('latestProofVersion');
  const preview = buffer || (await printService.renderProofPreview(order, version));
  const key = `proofs/${order._id}/v${version}.png`;
  await storage.put(key, preview);

  await Proof.updateMany({ order: order._id, status: 'pending' }, { status: 'superseded' });
  const proof = await Proof.create({
    order: order._id, version, previewKey: key, origin, createdBy: by, note,
    designHash: designService.hashDesign(order.designSnapshot), status: 'pending',
  });
  await ApprovalLog.create({ order: order._id, version, action: 'created', by, note: origin });
  order.latestProofVersion = version;
  order.approvedProofVersion = null;
  order.filesUnlocked = false;
  if (order.status === 'artwork' || order.status === 'order') { order.status = 'proof'; order.statusHistory.push({ status: 'proof', by, note: `proof v${version}` }); }
  await order.save();

  const customer = await User.findById(order.user);
  email.proofReady(customer, order, version);
  return proof;
}

async function approveProof(order, version, actor, ip) {
  if (order.payment.status !== 'paid') throw conflict('Order must be paid before a proof can be approved');
  if (order.status !== 'proof') throw conflict(`Proofs can only be approved while the order is in "proof" (currently "${order.status}")`);
  const proof = await Proof.findOne({ order: order._id, version });
  if (!proof) throw notFound(`Proof v${version} not found`);
  if (version !== order.latestProofVersion) throw conflict(`Only the latest proof (v${order.latestProofVersion}) can be approved`);
  if (proof.status === 'approved') throw conflict('Proof already approved');
  if (proof.status !== 'pending') throw conflict(`Proof is "${proof.status}" and cannot be approved`);

  proof.status = 'approved'; proof.decidedBy = actor._id; proof.decidedAt = new Date();
  await proof.save();
  await ApprovalLog.create({ order: order._id, version, action: 'approved', by: actor._id, byName: actor.name, byRole: actor.role, ip });

  order.approvedProofVersion = version;
  order.filesUnlocked = true;           // <<< APPROVAL GATE OPENS
  await order.save();

  // saved artwork on the account (for one-click reorder)
  if (order.design) await Design.updateOne({ _id: order.design }, { approved: true, approvedAt: new Date(), approvedOrder: order._id });

  printService.queueGeneration(order._id);
  const customer = await User.findById(order.user);
  email.proofApproved(customer, order, version);
  return proof;
}

async function requestChanges(order, version, actor, note, ip) {
  if (order.status !== 'proof') throw conflict('Changes can only be requested while the order is in "proof"');
  if (order.filesUnlocked) throw conflict('Proof already approved - contact support to change an approved job');
  const proof = await Proof.findOne({ order: order._id, version });
  if (!proof) throw notFound(`Proof v${version} not found`);
  if (version !== order.latestProofVersion) throw conflict(`Only the latest proof (v${order.latestProofVersion}) can be reviewed`);
  if (proof.status !== 'pending') throw conflict(`Proof is already "${proof.status}"`);
  proof.status = 'changes_requested'; proof.changeRequestNote = note; proof.decidedBy = actor._id; proof.decidedAt = new Date();
  await proof.save();
  await ApprovalLog.create({ order: order._id, version, action: 'changes_requested', by: actor._id, byName: actor.name, byRole: actor.role, note, ip });
  const admins = await User.find({ role: 'admin', isActive: true });
  email.changesRequested(admins, order, version, note);
  return proof;
}

/** Customer/admin edits the artwork before approval -> new frozen snapshot -> automatic new proof version. */
async function replaceArtwork(order, snapshot, actor) {
  if (order.filesUnlocked) throw conflict('Artwork is locked: a proof has already been approved');
  if (['production', 'completed', 'cancelled'].includes(order.status)) throw conflict(`Cannot change artwork in status "${order.status}"`);
  order.designSnapshot = snapshot;
  await order.save();
  if (['artwork', 'proof'].includes(order.status) && order.payment.status === 'paid') {
    if (order.status === 'proof') { order.status = 'artwork'; order.statusHistory.push({ status: 'artwork', by: actor._id, note: 'artwork changed' }); await order.save(); }
    return createProof(order, { by: actor._id, note: 'artwork updated' });
  }
  return null;
}

// ---------------------------------------------------------------- payment hook
async function afterPayment(orderId) {
  const order = await Order.findById(orderId);
  if (!order || order.status !== 'quote') return order;
  order.payment.status = 'paid'; order.payment.paidAt = new Date();
  order.payment.invoiceNumber = `INV-${new Date().getFullYear()}-${String(await Counter.next('invoice')).padStart(5, '0')}`;
  order.status = 'order'; order.statusHistory.push({ status: 'order', by: order.user, note: 'payment received' });
  await order.save();
  const customer = await User.findById(order.user);
  email.orderPaid(customer, order);

  await transition(order, 'artwork', { by: order.user, note: 'auto' });
  if (order.carryOverApproval && order.reorderOf) return carryOver(order, customer);
  await createProof(order, { by: order.user, note: 'auto-generated from design' });
  return order;
}

/** Reorder with identical artwork: the earlier approval carries over (logged as such). */
async function carryOver(order, customer) {
  const src = await Order.findById(order.reorderOf);
  const proof = await createProof(order, { by: order.user, origin: 'carried_over', note: `carried over from ${src.orderNumber} v${src.approvedProofVersion}` });
  proof.status = 'approved'; proof.decidedBy = customer._id; proof.decidedAt = new Date(); await proof.save();
  await ApprovalLog.create({ order: order._id, version: proof.version, action: 'carried_over', by: customer._id, byName: customer.name, byRole: customer.role, note: `Identical artwork approved on ${src.orderNumber} v${src.approvedProofVersion}` });
  order.approvedProofVersion = proof.version; order.filesUnlocked = true; await order.save();
  printService.queueGeneration(order._id);
  return order;
}

/** ONE-CLICK REORDER: clone config + artwork (+CSV) into a fresh quote at today's prices. */
async function reorder(prev, user, { quantity } = {}) {
  if (['quote', 'cancelled'].includes(prev.status)) throw conflict('Only paid orders can be reordered');
  const product = await Product.findById(prev.product).populate('division');
  if (!product || !product.active) throw conflict('This product is no longer available');
  product.divisionSlug = product.division.slug;
  const qty = prev.variableData && prev.variableData.fileKey ? prev.quantity : quantity || prev.quantity;

  const order = await createQuote({
    user, product, config: { sizeKey: prev.config.sizeKey, widthMm: prev.config.widthMm, heightMm: prev.config.heightMm, material: prev.config.material, orientation: prev.config.orientation },
    quantity: qty, design: prev.design ? { _id: prev.design } : undefined,
    snapshot: JSON.parse(JSON.stringify(prev.designSnapshot)), reorderOf: prev._id,
    carryOverApproval: prev.approvedProofVersion != null,
  });
  if (prev.variableData && prev.variableData.fileKey) {
    const key = `csv/${order._id}.csv`;
    await storage.put(key, await storage.read(prev.variableData.fileKey));
    order.variableData = { ...prev.variableData.toObject(), fileKey: key };
    await order.save();
  }
  return { order, priceChanged: order.pricing.totalMinor !== prev.pricing.totalMinor, previousTotalMinor: prev.pricing.totalMinor };
}

/** What a CUSTOMER may see: never production files, print job internals or payment intent ids. */
function customerView(order, { detail = false } = {}) {
  const o = order.toObject ? order.toObject() : { ...order };
  delete o.printFiles; delete o.printJob; delete o.__v;
  if (!detail) delete o.designSnapshot;      // list views stay light
  if (o.payment) delete o.payment.intentId;
  return o;
}

module.exports = { transition, createQuote, reprice, createProof, approveProof, requestChanges, replaceArtwork, afterPayment, reorder, customerView, FORWARD, nextOrderNumber };
