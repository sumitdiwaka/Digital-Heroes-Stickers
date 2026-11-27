/**
 * PRINT-FILE ENGINE (server side). Turns an approved order into production files:
 *   - per-order high-res PDF + PNG (bleed + DPI come from the product's printSpec)
 *   - CSV variable-data merge: ONE artwork file per CSV row (+ manifest.csv)
 *   - naming:  OrderID_ProductType_Date_Output.ext   inside  orders/<OrderID>/
 * Heavy work runs as a background job; progress is tracked on order.printJob.
 */
const sharp = require('sharp');
const { parse } = require('csv-parse/sync');
const storage = require('./storage');
const { buildPlan, renderPDF, renderPNG } = require('./print/render');
const { Order, Asset } = require('../models');

const yyyymmdd = (d = new Date()) => d.toISOString().slice(0, 10).replace(/-/g, '');
const fileName = (order, output, ext, date) => `${order.orderNumber}_${order.productType}_${date}_${output}.${ext}`;
const dirFor = (order) => `orders/${order.orderNumber}`;

const dimsOf = (order) => ({ trimW: order.config.widthMm, trimH: order.config.heightMm, bleed: order.printSpec.bleedMm });

/** Load logo assets as PNG buffers (svg/jpg converted) keyed by assetId. Only the order owner's assets. */
async function loadAssets(order) {
  const ids = (order.designSnapshot.elements || []).filter((e) => e.type === 'image' && e.assetId).map((e) => e.assetId);
  const out = {};
  for (const id of new Set(ids)) {
    const a = await Asset.findOne({ _id: id, user: order.user });
    if (!a) continue;
    out[id] = await sharp(await storage.read(a.fileKey), { density: 300 }).png().toBuffer();
  }
  return out;
}

/** Plan for artwork the customer uploaded (png/jpg/svg). PDF/AI are passed through, not planned. */
async function uploadPlan(order) {
  const up = order.designSnapshot.upload;
  const raw = await storage.read(up.fileKey);
  const meta = await sharp(raw, { density: 300 }).metadata();
  const png = await sharp(raw, { density: 300 }).png().toBuffer();
  const d = dimsOf(order);
  const plan = buildPlan({ background: '#FFFFFF', elements: [] }, d);
  plan.ops.push({ kind: 'image', x: d.bleed, y: d.bleed, w: d.trimW, h: d.trimH, buf: png, rot: 0, cx: 0, cy: 0 });
  // quality warnings
  const imgRatio = meta.width / meta.height, areaRatio = d.trimW / d.trimH;
  if (Math.abs(imgRatio - areaRatio) / areaRatio > 0.02) plan.warnings.push('Uploaded artwork aspect ratio differs from the product size - fitted inside the trim area (not cropped).');
  if (up.ext !== 'svg') {
    const effDpi = meta.width / (d.trimW / 25.4);
    if (effDpi < order.printSpec.dpi * 0.5) plan.warnings.push(`Low resolution upload: ~${Math.round(effDpi)} DPI at print size (target ${order.printSpec.dpi}).`);
  }
  return plan;
}

const isPassThrough = (order) => order.designSnapshot.source === 'upload' && ['pdf', 'ai'].includes(order.designSnapshot.upload.ext);

/** Placeholder preview used for PDF/AI uploads (cannot be rasterised without Ghostscript/Poppler). */
async function placeholderPreview(order, label) {
  const w = 900, h = Math.round((900 * order.config.heightMm) / order.config.widthMm);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#f4f1ea"/><rect x="10" y="10" width="${w - 20}" height="${h - 20}" fill="none" stroke="#6b9e78" stroke-width="3" stroke-dasharray="14 10"/><text x="50%" y="46%" font-family="sans-serif" font-size="34" text-anchor="middle" fill="#1b2a22">Uploaded ${label} artwork</text><text x="50%" y="56%" font-family="sans-serif" font-size="24" text-anchor="middle" fill="#555">${order.designSnapshot.upload.originalName.replace(/[<&>]/g, '')}</text><text x="50%" y="64%" font-family="sans-serif" font-size="20" text-anchor="middle" fill="#888">Vector preview not available - approved as supplied</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** PROOF preview PNG (low-res, dashed trim line + watermark). Also reused for admin/customer "live preview". */
async function renderProofPreview(order, version, vars = {}, label) {
  if (isPassThrough(order)) return placeholderPreview(order, order.designSnapshot.upload.ext.toUpperCase());
  const plan = order.designSnapshot.source === 'upload' ? await uploadPlan(order)
    : buildPlan(order.designSnapshot, dimsOf(order), vars, await loadAssets(order));
  return renderPNG(plan, { maxWidthPx: 1100, watermark: label || `PROOF v${version}` });
}

/** Read the order's CSV into rows. */
async function readRows(order) {
  const csv = await storage.read(order.variableData.fileKey);
  return parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true });
}

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * Generate ALL production files for an order. Safe to re-run (files overwritten, list rebuilt).
 */
async function generateAll(orderId, { includePng } = {}) {
  const order = await Order.findById(orderId);
  if (!order) return;
  const date = yyyymmdd();
  const dir = dirFor(order);
  const files = [];
  const warnings = [];

  try {
    const rows = order.variableData && order.variableData.fileKey ? await readRows(order) : null;
    const wantPng = includePng !== undefined ? includePng : !rows || rows.length <= 200;
    order.printJob = { status: 'running', progress: 0, total: rows ? rows.length : 1, startedAt: new Date(), warnings: [] };
    await order.save();
    await storage.remove(dir); // clean slate

    const add = async (name, buf, type, row) => { const r = await storage.put(`${dir}/${name}`, buf); files.push({ name, key: r.key, type, size: r.size, row }); };

    if (isPassThrough(order)) {
      // Customer supplied a finished PDF/AI: pass it through untouched.
      const raw = await storage.read(order.designSnapshot.upload.fileKey);
      await add(fileName(order, 'print', 'pdf', date), raw, 'pdf');
      warnings.push('PDF/AI upload passed through unchanged - bleed and colour profile are NOT verified by the system.');
    } else {
      const assets = await loadAssets(order);
      const base = order.designSnapshot.source === 'upload' ? await uploadPlan(order) : null;
      const meta = { title: `${order.orderNumber} ${order.productName}` };

      if (!rows) {
        const plan = base || buildPlan(order.designSnapshot, dimsOf(order), {}, assets);
        warnings.push(...plan.warnings);
        await add(fileName(order, 'print', 'pdf', date), await renderPDF(plan, meta), 'pdf');
        if (wantPng) await add(fileName(order, 'print', 'png', date), await renderPNG(plan, { dpi: order.printSpec.dpi }), 'png');
        order.printJob.progress = 1;
      } else {
        // CSV variable-data merge: one artwork per row
        const manifest = [['row', 'file', ...order.variableData.columns].map(csvEscape).join(',')];
        const pad = String(rows.length).length < 4 ? 4 : String(rows.length).length;
        for (let i = 0; i < rows.length; i++) {
          const rowNo = String(i + 1).padStart(pad, '0');
          const plan = buildPlan(order.designSnapshot, dimsOf(order), rows[i], assets);
          plan.warnings.forEach((w) => warnings.push(`Row ${i + 1}: ${w}`));
          const name = fileName(order, `row-${rowNo}`, 'pdf', date);
          await add(name, await renderPDF(plan, { title: `${order.orderNumber} row ${rowNo}` }), 'pdf', i + 1);
          if (wantPng) await add(fileName(order, `row-${rowNo}`, 'png', date), await renderPNG(plan, { dpi: order.printSpec.dpi }), 'png', i + 1);
          manifest.push([rowNo, name, ...order.variableData.columns.map((c) => rows[i][c])].map(csvEscape).join(','));
          if ((i + 1) % 25 === 0) { await Order.updateOne({ _id: order._id }, { 'printJob.progress': i + 1 }); }
        }
        await add(fileName(order, 'manifest', 'csv', date), Buffer.from(manifest.join('\n')), 'csv');
        order.printJob.progress = rows.length;
      }
    }
    order.printFiles = files;
    order.printJob.status = 'done';
    order.printJob.finishedAt = new Date();
    order.printJob.warnings = [...new Set(warnings)].slice(0, 50);
    await order.save();
  } catch (e) {
    console.error('[print] job failed', order.orderNumber, e);
    await Order.updateOne({ _id: order._id }, { 'printJob.status': 'failed', 'printJob.error': e.message, 'printJob.finishedAt': new Date() });
  }
}

/** Kick off generation in the background (does not block the HTTP request). */
function queueGeneration(orderId, opts) {
  Order.updateOne({ _id: orderId }, { 'printJob.status': 'queued', 'printJob.progress': 0 }).then(() => setImmediate(() => generateAll(orderId, opts)));
}

/** Validate CSV against the design's variable keys. */
function analyseCsv(buffer, designElements, maxRows) {
  let rows;
  try { rows = parse(buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true }); }
  catch (e) { return { error: `CSV could not be parsed: ${e.message}` }; }
  if (!rows.length) return { error: 'CSV has no data rows' };
  if (rows.length > maxRows) return { error: `CSV has ${rows.length} rows; maximum is ${maxRows}` };
  const columns = Object.keys(rows[0]);
  const keys = [...new Set(designElements.filter((e) => e.variableKey).map((e) => e.variableKey))];
  const hasDefault = (k) => designElements.some((e) => e.variableKey === k && String(e.text || '').trim());
  const matched = keys.filter((k) => columns.includes(k));
  const absent = keys.filter((k) => !columns.includes(k));
  // A field with default text (e.g. a fixed event title) may be omitted from the CSV; it then prints its default.
  const missing = matched.length === 0 ? keys : absent.filter((k) => !hasDefault(k));
  const usingDefaults = matched.length === 0 ? [] : absent.filter(hasDefault);
  const unused = columns.filter((c) => !keys.includes(c));
  return { rows, columns, keys, missing, usingDefaults, unused };
}

module.exports = { generateAll, queueGeneration, renderProofPreview, analyseCsv, readRows, isPassThrough, fileName, dirFor };
