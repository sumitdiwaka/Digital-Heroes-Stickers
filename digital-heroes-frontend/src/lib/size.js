/**
 * Client-side mirror of the backend rules (for instant UI feedback; the server stays the authority).
 * Units: millimetres. Origin = top-left of the TRIM box.
 */
export const PT_TO_MM = 25.4 / 72;

/** product + {sizeKey | widthMm,heightMm} + orientation -> final trim dimensions */
export function resolveSize(product, cfg) {
  const s = product.sizing;
  let w, h, sizeKey = null;
  if (cfg.sizeKey) {
    const p = (s.presets || []).find((x) => x.key === cfg.sizeKey);
    if (!p) return null;
    w = p.widthMm; h = p.heightMm; sizeKey = p.key;
  } else if (cfg.widthMm && cfg.heightMm) { w = Number(cfg.widthMm); h = Number(cfg.heightMm); }
  else return null;
  const long = Math.max(w, h), short = Math.min(w, h);
  const orientation = cfg.orientation || product.orientations[0] || 'landscape';
  if (long !== short) { if (orientation === 'landscape') { w = long; h = short; } else { w = short; h = long; } }
  return { widthMm: w, heightMm: h, sizeKey, orientation };
}

/** Config object the API expects */
export const toApiConfig = (cfg) => {
  const c = { material: cfg.material };
  if (cfg.sizeKey) c.sizeKey = cfg.sizeKey; else { c.widthMm = Number(cfg.widthMm); c.heightMm = Number(cfg.heightMm); }
  if (cfg.orientation) c.orientation = cfg.orientation;
  return c;
};

/** Config -> URL query (used to hand the configurator state to the designer) */
export const cfgToQuery = (cfg, qty) => {
  const q = new URLSearchParams();
  if (cfg.sizeKey) q.set('size', cfg.sizeKey); else { q.set('w', cfg.widthMm); q.set('h', cfg.heightMm); }
  q.set('material', cfg.material);
  if (cfg.orientation) q.set('orientation', cfg.orientation);
  if (qty) q.set('qty', qty);
  return q.toString();
};
export const queryToCfg = (sp) => ({
  sizeKey: sp.get('size') || undefined, widthMm: sp.get('w') || undefined, heightMm: sp.get('h') || undefined,
  material: sp.get('material') || undefined, orientation: sp.get('orientation') || undefined,
});

/** Same three areas as the server: trim / safe / bleed */
export function printAreas(w, h, spec) {
  const b = spec.bleedMm, m = spec.safeMarginMm;
  return {
    trim: { minX: 0, minY: 0, maxX: w, maxY: h },
    safe: { minX: m, minY: m, maxX: w - m, maxY: h - m },
    bleed: { minX: -b, minY: -b, maxX: w + b, maxY: h + b },
  };
}

/** AABB of a rotated rectangle element */
export function rotatedBounds(el) {
  const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
  const a = ((el.rotation || 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const bw = el.width * c + el.height * s, bh = el.width * s + el.height * c;
  return { minX: cx - bw / 2, minY: cy - bh / 2, maxX: cx + bw / 2, maxY: cy + bh / 2 };
}
export const limitFor = (el, areas) => (el.type === 'rect' ? areas.bleed : areas.safe);
export const EPS = 0.01;
export function inside(el, areas) {
  const b = rotatedBounds(el), l = limitFor(el, areas);
  return b.minX >= l.minX - EPS && b.minY >= l.minY - EPS && b.maxX <= l.maxX + EPS && b.maxY <= l.maxY + EPS;
}
/** Shift (not resize) an element so it sits inside its allowed area; returns null if it is simply too big. */
export function pushInside(el, areas) {
  const b = rotatedBounds(el), l = limitFor(el, areas);
  if (b.maxX - b.minX > l.maxX - l.minX + EPS || b.maxY - b.minY > l.maxY - l.minY + EPS) return null;
  let dx = 0, dy = 0;
  if (b.minX < l.minX) dx = l.minX - b.minX; else if (b.maxX > l.maxX) dx = l.maxX - b.maxX;
  if (b.minY < l.minY) dy = l.minY - b.minY; else if (b.maxY > l.maxY) dy = l.maxY - b.maxY;
  return { ...el, x: el.x + dx, y: el.y + dy };
}

export const FONT_STACK = {
  Sans: '"DH Sans", "DejaVu Sans", Verdana, sans-serif',
  Condensed: '"DH Condensed", "DejaVu Sans Condensed", "Arial Narrow", sans-serif',
  Serif: '"DH Serif", "DejaVu Serif", Georgia, serif',
  Mono: '"DH Mono", "DejaVu Sans Mono", Consolas, monospace',
};

let ctx;
/** Width of `text` at 100 units of font size, using the same fonts as the print engine. */
export function textWidth100(text, family, weight) {
  if (typeof document === 'undefined') return text.length * 60;
  ctx = ctx || document.createElement('canvas').getContext('2d');
  if (!ctx) return String(text).length * 60; // no canvas (SSR / tests): rough estimate
  ctx.font = `${weight === 'bold' ? '700' : '400'} 100px ${FONT_STACK[family] || FONT_STACK.Sans}`;
  return ctx.measureText(text).width;
}

/** Shrink-to-fit exactly like the server: start at min(fontSize,max), shrink to min. Returns size in mm. */
export function fitFontMm(el, text) {
  const maxPt = el.maxFontSize || Math.max(el.fontSize || 12, el.minFontSize || 6);
  const minPt = el.minFontSize || 6;
  const startPt = Math.min(el.fontSize || maxPt, maxPt);
  const track = (el.tracking || 0) * PT_TO_MM;
  const w100 = textWidth100(text || ' ', el.fontFamily, el.fontWeight) / 100; // width per 1mm of font size
  const n = Math.max(0, (text || '').length - 1);
  const fits = (mm) => w100 * mm + track * n <= el.width + 1e-6 && mm * 1.164 <= el.height + 1e-6;
  let mm = startPt * PT_TO_MM;
  if (!fits(mm) && el.shrinkToFit !== false) {
    let lo = minPt * PT_TO_MM, hi = mm;
    if (fits(lo)) { for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; } mm = lo; }
    else mm = lo;
  }
  return { mm, widthMm: w100 * mm + track * n, overflow: !fits(mm) };
}

export const uid = (p = 'el') => `${p}-${Math.random().toString(36).slice(2, 8)}`;

const MIN_SIZE = 3; // minimum element size (mm)

/** Resize from a corner handle in the element's own (rotated) frame, keeping the opposite corner fixed. */
export function resizeFrom(start, handle, p, lockAspect) {
  const sx = handle.includes('e') ? 1 : -1, sy = handle.includes('s') ? 1 : -1;
  const th = ((start.rotation || 0) * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
  const cx = start.x + start.width / 2, cy = start.y + start.height / 2;
  const ox = -sx * start.width / 2, oy = -sy * start.height / 2;
  const opp = { x: cx + ox * c - oy * s, y: cy + ox * s + oy * c };
  const dx = p.x - opp.x, dy = p.y - opp.y;
  let w = Math.max(MIN_SIZE, sx * (dx * c + dy * s)), h = Math.max(MIN_SIZE, sy * (-dx * s + dy * c));
  if (lockAspect) { const k = Math.max(w / start.width, h / start.height); w = start.width * k; h = start.height * k; }
  const ncx = opp.x + (sx * w / 2) * c - (sy * h / 2) * s, ncy = opp.y + (sx * w / 2) * s + (sy * h / 2) * c;
  return { x: ncx - w / 2, y: ncy - h / 2, width: w, height: h };
}

