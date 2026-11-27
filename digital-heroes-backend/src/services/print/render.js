/**
 * Renderer. A design (elements + variables) is first turned into a neutral "plan" (list of drawing ops in mm),
 * then drawn by BOTH the PDF writer and the SVG/PNG writer. One plan -> identical PDF and PNG.
 *
 * Page box = trim + bleed on every side. Element coordinates are relative to the TRIM box top-left,
 * so we shift everything by `bleed` when drawing.
 */
const PDFDocument = require('pdfkit');
const sharp = require('sharp');
const { fitText } = require('./fit');
const { lineToPath } = require('./fonts');
const { mmToPt, mmToPx } = require('../../utils/geometry');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hex = (c, d = '#000000') => (/^#[0-9a-fA-F]{3,8}$/.test(c || '') ? c : d);

/**
 * @param design {background, elements[]}
 * @param dims   {trimW, trimH, bleed}
 * @param vars   {key: value} for variable-data merge (CSV row)
 * @param assets {assetId: PNG/JPEG Buffer}
 */
function buildPlan(design, dims, vars = {}, assets = {}) {
  const { trimW, trimH, bleed } = dims;
  const plan = { pageW: trimW + 2 * bleed, pageH: trimH + 2 * bleed, bleed, trimW, trimH, background: hex(design.background, '#FFFFFF'), ops: [], warnings: [] };

  for (const el of design.elements || []) {
    const ox = el.x + bleed, oy = el.y + bleed;
    const rot = el.rotation || 0;
    const cx = ox + el.width / 2, cy = oy + el.height / 2;

    if (el.type === 'rect') {
      plan.ops.push({ kind: 'rect', x: ox, y: oy, w: el.width, h: el.height, fill: el.fill ? hex(el.fill) : null, stroke: el.stroke ? hex(el.stroke) : null, strokeW: el.strokeWidth || 0.3, rot, cx, cy });
    } else if (el.type === 'image') {
      const buf = assets[el.assetId];
      if (!buf) { plan.warnings.push(`Image element ${el.id}: asset missing`); continue; }
      plan.ops.push({ kind: 'image', x: ox, y: oy, w: el.width, h: el.height, buf, rot, cx, cy });
    } else if (el.type === 'text') {
      let text = el.variableKey && vars[el.variableKey] !== undefined && vars[el.variableKey] !== null ? vars[el.variableKey] : el.text || '';
      text = String(text).replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const fit = fitText(el, text, el.width, el.height);
      if (fit.overflow) plan.warnings.push(`Text "${text.slice(0, 30)}" overflows its box (element ${el.id}) even at min size/tracking`);
      const align = el.align || 'left';
      let x = ox;
      if (align === 'center') x = ox + (el.width - fit.layout.width) / 2;
      else if (align === 'right') x = ox + el.width - fit.layout.width;
      // centre cap-height vertically inside the box
      const baseline = oy + el.height / 2 + fit.metrics.capHeight / 2;
      plan.ops.push({ kind: 'path', d: lineToPath(fit.layout, x, baseline, fit.trackMm), fill: hex(el.color), rot, cx, cy });
    }
  }
  return plan;
}

/** Draw a plan to PDF (vector). Page size = trim + bleed. Returns Buffer. */
function renderPDF(plan, meta = {}) {
  return new Promise((resolve, reject) => {
    const k = mmToPt(1);
    const doc = new PDFDocument({
      size: [plan.pageW * k, plan.pageH * k], margin: 0, autoFirstPage: true, compress: true,
      info: { Title: meta.title || 'Print file', Producer: 'Digital Heroes Print Engine', Keywords: `bleed=${plan.bleed}mm; trim=${plan.trimW}x${plan.trimH}mm` },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.save(); doc.scale(k);
    doc.rect(0, 0, plan.pageW, plan.pageH).fill(plan.background);
    doc.restore();

    for (const op of plan.ops) {
      doc.save(); doc.scale(k);
      if (op.rot) doc.rotate(op.rot, { origin: [op.cx, op.cy] });
      if (op.kind === 'rect') {
        if (op.fill && op.stroke) doc.lineWidth(op.strokeW).rect(op.x, op.y, op.w, op.h).fillAndStroke(op.fill, op.stroke);
        else if (op.fill) doc.rect(op.x, op.y, op.w, op.h).fill(op.fill);
        else if (op.stroke) doc.lineWidth(op.strokeW).rect(op.x, op.y, op.w, op.h).stroke(op.stroke);
      } else if (op.kind === 'path') {
        doc.path(op.d).fill(op.fill);
      } else if (op.kind === 'image') {
        doc.image(op.buf, op.x, op.y, { fit: [op.w, op.h], align: 'center', valign: 'center' });
      }
      doc.restore();
    }
    // Trim marks guide (tiny corner ticks outside trim, inside bleed would be hidden) are omitted on purpose;
    // bleed size is recorded in PDF metadata and in the file naming/manifest.
    doc.end();
  });
}

/** Build an SVG string (units = mm via viewBox). */
function planToSVG(plan, pxW, pxH, { watermark } = {}) {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${pxW}" height="${pxH}" viewBox="0 0 ${plan.pageW} ${plan.pageH}">`];
  parts.push(`<rect width="${plan.pageW}" height="${plan.pageH}" fill="${plan.background}"/>`);
  for (const op of plan.ops) {
    const t = op.rot ? ` transform="rotate(${op.rot} ${op.cx} ${op.cy})"` : '';
    if (op.kind === 'rect') {
      parts.push(`<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="${op.fill || 'none'}" ${op.stroke ? `stroke="${op.stroke}" stroke-width="${op.strokeW}"` : ''}${t}/>`);
    } else if (op.kind === 'path') {
      parts.push(`<path d="${op.d}" fill="${op.fill}"${t}/>`);
    } else if (op.kind === 'image') {
      parts.push(`<image x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${op.buf.toString('base64')}"${t}/>`);
    }
  }
  if (watermark) {
    // Dashed trim line + bleed hint on PROOFS only (never on print files)
    parts.push(`<rect x="${plan.bleed}" y="${plan.bleed}" width="${plan.trimW}" height="${plan.trimH}" fill="none" stroke="#e11d48" stroke-width="${plan.pageW / 400}" stroke-dasharray="${plan.pageW / 80} ${plan.pageW / 120}"/>`);
    const fs = plan.pageW / 14;
    parts.push(`<text x="${plan.pageW / 2}" y="${plan.pageH / 2}" font-size="${fs}" fill="rgba(225,29,72,0.16)" font-family="sans-serif" font-weight="bold" text-anchor="middle" transform="rotate(-20 ${plan.pageW / 2} ${plan.pageH / 2})">${esc(watermark)}</text>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

/** Rasterise a plan to PNG at a given DPI (print) or max pixel width (proof preview). */
async function renderPNG(plan, { dpi, maxWidthPx, watermark } = {}) {
  let pxW = dpi ? mmToPx(plan.pageW, dpi) : maxWidthPx;
  let pxH = Math.round((pxW * plan.pageH) / plan.pageW);
  const MAX = 12000; // safety against absurd sizes
  if (pxW > MAX || pxH > MAX) { const f = MAX / Math.max(pxW, pxH); pxW = Math.round(pxW * f); pxH = Math.round(pxH * f); }
  const svg = planToSVG(plan, pxW, pxH, { watermark });
  const density = dpi ? Math.round((72 * pxW) / (plan.pageW / 25.4) / 72) : 72; // keep librsvg from re-scaling
  return sharp(Buffer.from(svg), { density: Math.max(density, 72) }).resize(pxW, pxH, { fit: 'fill' })
    .png({ compressionLevel: 9 }).withMetadata({ density: dpi || 96 }).toBuffer();
}

module.exports = { buildPlan, renderPDF, renderPNG, planToSVG };
