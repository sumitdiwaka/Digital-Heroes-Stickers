const PDFDocument = require('pdfkit');
const path = require('path');
const env = require('../config/env');

const FONT = path.join(__dirname, '../../assets/fonts/DejaVuSans.ttf');
const FONT_B = path.join(__dirname, '../../assets/fonts/DejaVuSans-Bold.ttf');
const money = (minor, cur) => `${cur} ${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Invoice / receipt PDF for a paid order. */
function invoicePDF(order, user) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    doc.registerFont('R', FONT); doc.registerFont('B', FONT_B);
    const p = order.pricing, cur = p.currency;

    doc.font('B').fontSize(22).text('Digital Heroes', { continued: false });
    doc.font('R').fontSize(9).fillColor('#666').text('digitalheroes.co.in').moveDown(1.2);
    doc.fillColor('#000').font('B').fontSize(16).text(`TAX INVOICE / RECEIPT`).moveDown(0.4);
    doc.font('R').fontSize(10)
      .text(`Invoice no: ${order.payment.invoiceNumber || '-'}`)
      .text(`Order no:   ${order.orderNumber}`)
      .text(`Date:       ${(order.payment.paidAt || order.createdAt).toISOString().slice(0, 10)}`)
      .text(`Payment:    ${order.payment.status.toUpperCase()} (${order.payment.provider || '-'})`).moveDown();
    doc.font('B').text('Billed to').font('R').text(user.name).text(user.email);
    if (user.company) doc.text(user.company);
    if (user.gstin) doc.text(`Tax ID: ${user.gstin}`);
    doc.moveDown();

    doc.font('B').text('Item', 50, doc.y, { continued: false });
    doc.font('R').text(`${order.productName} - ${order.config.widthMm} x ${order.config.heightMm} mm, ${order.config.material}, ${order.config.orientation}`).moveDown();
    const row = (l, v, bold) => { const y = doc.y; doc.font(bold ? 'B' : 'R').text(l, 50, y); doc.text(v, 300, y, { width: 245, align: 'right' }); doc.moveDown(0.3); };
    row('Quantity', String(order.quantity));
    row('List unit price', money(p.listUnitPriceMinor, cur));
    if (p.discountPct) row(`Volume discount (${p.discountPct}%)`, `- ${money(p.listUnitPriceMinor - p.unitPriceMinor, cur)} / unit`);
    row('Unit price', money(p.unitPriceMinor, cur));
    if (p.setupFeeMinor) row('Setup fee', money(p.setupFeeMinor, cur));
    row('Subtotal (net)', money(p.subtotalMinor, cur));
    row(`${p.taxName} @ ${(p.taxRate * 100).toFixed(1)}%`, money(p.taxMinor, cur));
    row('TOTAL (tax inclusive)', money(p.totalMinor, cur), true);
    doc.moveDown(2).fontSize(8).fillColor('#888').text('Thank you for your order. This is a computer generated document.');
    doc.end();
  });
}
module.exports = { invoicePDF };
