/**
 * PRICING ENGINE (pure functions, no DB). All money in integer minor units.
 *
 *   area(cm2)   = width * height / 100
 *   list unit   = max(minUnit, base + area * perCm2 * material.multiplier + material.surcharge)
 *   discount    = highest volume tier whose minQty <= quantity
 *   unit        = round(list unit * (1 - discount%))
 *   subtotal    = unit * quantity + setupFee                (net)
 *   tax         = round(subtotal * TAX_RATE)
 *   total       = subtotal + tax                            (VAT/GST inclusive, headline price)
 */
const env = require('../config/env');
const { bad } = require('../utils/AppError');

/** Resolve the requested size (preset key OR custom width/height) + orientation into final mm dimensions. */
function resolveConfig(product, cfg = {}) {
  const s = product.sizing;
  let w, h, sizeKey = null;

  if (cfg.sizeKey) {
    const preset = (s.presets || []).find((p) => p.key === cfg.sizeKey);
    if (!preset) throw bad(`Unknown size "${cfg.sizeKey}"`, { allowed: s.presets.map((p) => p.key) });
    w = preset.widthMm; h = preset.heightMm; sizeKey = preset.key;
  } else if (cfg.widthMm && cfg.heightMm) {
    if (s.mode === 'fixed') throw bad('This product only supports preset sizes', { allowed: s.presets.map((p) => p.key) });
    w = Number(cfg.widthMm); h = Number(cfg.heightMm);
    if (!(w >= s.minMm && h >= s.minMm)) throw bad(`Minimum size is ${s.minMm}mm`);
    if (w > s.maxWidthMm || h > s.maxHeightMm) throw bad(`Maximum size is ${s.maxWidthMm} x ${s.maxHeightMm}mm`);
  } else {
    throw bad('Provide sizeKey or widthMm + heightMm');
  }

  const orientation = cfg.orientation || product.orientations[0] || 'landscape';
  if (!product.orientations.includes(orientation)) throw bad(`Orientation must be one of: ${product.orientations.join(', ')}`);
  // Orientation decides which side is the long one.
  const long = Math.max(w, h), short = Math.min(w, h);
  if (long !== short) { if (orientation === 'landscape') { w = long; h = short; } else { w = short; h = long; } }

  const material = (product.materials || []).find((m) => m.key === cfg.material && m.active !== false);
  if (!material) throw bad(`Unknown or unavailable material "${cfg.material}"`, { allowed: product.materials.filter((m) => m.active !== false).map((m) => m.key) });

  return { widthMm: w, heightMm: h, sizeKey, orientation, material: material.key, _material: material };
}

function validateQuantity(product, qty) {
  const q = product.quantity;
  if (!Number.isInteger(qty)) throw bad('Quantity must be a whole number');
  if (qty < q.min) throw bad(`Minimum quantity is ${q.min}`);
  if (qty > q.max) throw bad(`Maximum quantity is ${q.max}`);
  if (q.step > 1 && qty % q.step !== 0) throw bad(`Quantity must be a multiple of ${q.step}`);
}

function discountFor(product, qty) {
  const tiers = [...(product.pricing.volumeTiers || [])].sort((a, b) => a.minQty - b.minQty);
  let pct = 0;
  for (const t of tiers) if (qty >= t.minQty) pct = t.discountPct;
  return pct;
}

/** @returns {{config, pricing, tiers}} */
function calculate(product, cfg, quantity) {
  const config = resolveConfig(product, cfg);
  validateQuantity(product, quantity);
  const p = product.pricing;
  const m = config._material;

  const areaCm2 = (config.widthMm * config.heightMm) / 100;
  const raw = p.basePerUnitMinor + areaCm2 * p.pricePerCm2Minor * m.multiplier + (m.surchargeMinor || 0);
  const listUnit = Math.round(Math.max(p.minUnitPriceMinor || 0, raw));
  const discountPct = discountFor(product, quantity);
  const unit = Math.round(listUnit * (1 - discountPct / 100));
  const subtotal = unit * quantity + (p.setupFeeMinor || 0);
  const tax = Math.round(subtotal * env.taxRate);

  const { _material, ...publicConfig } = config;
  return {
    config: publicConfig,
    pricing: {
      currency: env.currency,
      areaCm2: Math.round(areaCm2 * 100) / 100,
      listUnitPriceMinor: listUnit,
      discountPct,
      unitPriceMinor: unit,
      quantity,
      setupFeeMinor: p.setupFeeMinor || 0,
      subtotalMinor: subtotal,
      taxName: env.taxName,
      taxRate: env.taxRate,
      taxMinor: tax,
      totalMinor: subtotal + tax,
    },
    nextTier: nextTier(product, quantity),
  };
}

/** Handy for the UI: "buy 40 more to unlock 10% off". */
function nextTier(product, qty) {
  const t = [...(product.pricing.volumeTiers || [])].sort((a, b) => a.minQty - b.minQty).find((x) => x.minQty > qty);
  return t ? { minQty: t.minQty, discountPct: t.discountPct, unitsToUnlock: t.minQty - qty } : null;
}

module.exports = { calculate, resolveConfig, validateQuantity, discountFor };
