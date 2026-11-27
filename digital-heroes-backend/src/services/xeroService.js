/** Xero-ready CSV (matches Xero's "Import sales invoices" template headers). Full API integration can be switched on later. */
const { Order } = require('../models');
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const major = (m) => (m / 100).toFixed(2);

async function invoicesCsv({ from, to } = {}) {
  const q = { 'payment.status': 'paid' };
  if (from || to) { q['payment.paidAt'] = {}; if (from) q['payment.paidAt'].$gte = new Date(from); if (to) q['payment.paidAt'].$lte = new Date(to); }
  const orders = await Order.find(q).populate('user', 'name email company').sort({ 'payment.paidAt': 1 });
  const head = ['*ContactName', 'EmailAddress', '*InvoiceNumber', 'Reference', '*InvoiceDate', '*DueDate', 'InventoryItemCode', '*Description', '*Quantity', '*UnitAmount', '*AccountCode', '*TaxType', 'TaxAmount', 'TrackingName1', 'TrackingOption1', 'Currency'];
  const lines = [head.join(',')];
  for (const o of orders) {
    const d = (o.payment.paidAt || o.createdAt).toISOString().slice(0, 10);
    lines.push([
      o.user.company || o.user.name, o.user.email, o.payment.invoiceNumber, o.orderNumber, d, d, o.productType,
      `${o.productName} ${o.config.widthMm}x${o.config.heightMm}mm ${o.config.material}`, o.quantity, major(o.pricing.unitPriceMinor),
      '200', `${o.pricing.taxName} on Income`, major(o.pricing.taxMinor), 'Division', o.divisionSlug, o.pricing.currency,
    ].map(esc).join(','));
    if (o.pricing.setupFeeMinor) lines.push([o.user.company || o.user.name, o.user.email, o.payment.invoiceNumber, o.orderNumber, d, d, 'SETUP', 'Setup fee', 1, major(o.pricing.setupFeeMinor), '200', `${o.pricing.taxName} on Income`, '', 'Division', o.divisionSlug, o.pricing.currency].map(esc).join(','));
  }
  return lines.join('\n');
}
module.exports = { invoicesCsv };
