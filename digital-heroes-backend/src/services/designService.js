/**
 * Design helpers: template instantiation + PRINT-AREA ENFORCEMENT.
 *
 * Print-area rules (decision documented in docs/DECISIONS.md):
 *  - text / image elements must sit fully inside the SAFE area  (trim inset by safeMarginMm)
 *  - rect (background/colour blocks) may extend into the BLEED but never beyond it
 * The check uses the rotated bounding box, so rotating an element can't sneak it out of the area.
 */
const crypto = require('crypto');
const { rotatedBounds, round2 } = require('../utils/geometry');
const { Asset } = require('../models');

const EPS = 0.01;

function printAreas(trimW, trimH, spec) {
  const b = spec.bleedMm, m = spec.safeMarginMm;
  return {
    trim: { x: 0, y: 0, width: trimW, height: trimH },
    safe: { minX: m, minY: m, maxX: trimW - m, maxY: trimH - m },
    bleed: { minX: -b, minY: -b, maxX: trimW + b, maxY: trimH + b },
  };
}

/**
 * Fractions -> millimetres for the requested size.
 * Text/image placeholders are CLAMPED into the safe area, so a template can never
 * produce an unprintable layout at any size (tiny stamp or huge board).
 */
function instantiateTemplate(template, trimW, trimH, spec) {
  const m = spec ? spec.safeMarginMm : 0;
  const clamp = (type, b) => {
    if (type === 'shape' || !spec) return b;
    const x = Math.max(b.x, m), y = Math.max(b.y, m);
    return { x, y, width: Math.max(1, Math.min(b.x + b.width, trimW - m) - x), height: Math.max(1, Math.min(b.y + b.height, trimH - m) - y) };
  };
  return template.placeholders.map((p, i) => {
    const box = clamp(p.type, { x: round2(p.x * trimW), y: round2(p.y * trimH), width: round2(p.w * trimW), height: round2(p.h * trimH) });
    const base = { id: `${p.key}-${i + 1}`, x: round2(box.x), y: round2(box.y), width: round2(box.width), height: round2(box.height), rotation: 0 };
    if (p.type === 'shape' && spec) {
      // colour blocks that touch a trim edge are extended into the BLEED so no white sliver appears after cutting
      const b = spec.bleedMm, tol = 0.01;
      if (base.x <= tol) { base.x -= b; base.width += b; }
      if (base.y <= tol) { base.y -= b; base.height += b; }
      if (base.x + base.width >= trimW - tol) base.width += b;
      if (base.y + base.height >= trimH - tol) base.height += b;
    }
    if (p.type === 'shape') return { ...base, type: 'rect', fill: p.fill || '#EEEEEE' };
    if (p.type === 'image') return { ...base, type: 'image', variableKey: p.key };
    return {
      ...base, type: 'text', variableKey: p.key, text: p.defaultText || '', fontFamily: p.fontFamily,
      fontWeight: p.fontWeight, align: p.align, color: p.color, shrinkToFit: p.shrinkToFit,
      minFontSize: p.minFontSize, maxFontSize: p.maxFontSize, fontSize: p.maxFontSize, tracking: p.tracking, minTracking: p.minTracking,
    };
  });
}

/**
 * Validate a list of elements against the print area.
 * @returns {{valid:boolean, errors:Array, warnings:Array, areas}}
 */
async function validateElements(elements, { trimW, trimH, spec, userId }) {
  const areas = printAreas(trimW, trimH, spec);
  const errors = [], warnings = [];
  const ids = new Set();

  for (const el of elements) {
    if (ids.has(el.id)) errors.push({ elementId: el.id, code: 'DUPLICATE_ID', message: `Duplicate element id "${el.id}"` });
    ids.add(el.id);
    const b = rotatedBounds(el);
    const limit = el.type === 'rect' ? areas.bleed : areas.safe;
    const where = el.type === 'rect' ? 'bleed area' : 'safe print area';
    if (b.minX < limit.minX - EPS || b.minY < limit.minY - EPS || b.maxX > limit.maxX + EPS || b.maxY > limit.maxY + EPS) {
      errors.push({
        elementId: el.id, code: 'OUTSIDE_PRINT_AREA',
        message: `Element "${el.id}" is outside the ${where}`,
        bounds: { minX: round2(b.minX), minY: round2(b.minY), maxX: round2(b.maxX), maxY: round2(b.maxY) },
        allowed: { minX: limit.minX, minY: limit.minY, maxX: limit.maxX, maxY: limit.maxY },
      });
    }
    if (el.type === 'text' && !el.variableKey && !String(el.text || '').trim()) warnings.push({ elementId: el.id, message: 'Empty text element will not print' });
    if (el.type === 'image') {
      if (!el.assetId) errors.push({ elementId: el.id, code: 'MISSING_ASSET', message: 'Image element needs an assetId (upload via POST /api/uploads/asset)' });
      else if (userId) {
        const a = await Asset.findOne({ _id: el.assetId, user: userId }).select('_id');
        if (!a) errors.push({ elementId: el.id, code: 'ASSET_NOT_FOUND', message: `Asset ${el.assetId} not found for this account` });
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings, areas: { trim: areas.trim, safe: areas.safe, bleed: areas.bleed } };
}

/** Stable hash of the artwork - tells us if a design changed between proof versions. */
const hashDesign = (snap) => crypto.createHash('sha1').update(JSON.stringify({ b: snap.background, e: snap.elements, u: snap.upload && snap.upload.fileKey })).digest('hex');

/** Plain-object copy of a design that is safe to freeze onto an order. */
const snapshotOf = (design) => ({
  source: design.source,
  background: design.background,
  elements: (design.elements || []).map((e) => (e.toObject ? e.toObject() : { ...e })),
  upload: design.upload ? { fileKey: design.upload.fileKey, originalName: design.upload.originalName, mime: design.upload.mime, ext: design.upload.ext } : undefined,
});

module.exports = { printAreas, instantiateTemplate, validateElements, hashDesign, snapshotOf };
