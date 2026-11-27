// Geometry helpers used by design validation. All units are millimetres.

/** Axis-aligned bounding box of a (possibly rotated) rectangle element. */
function rotatedBounds(el) {
  const w = el.width, h = el.height;
  const cx = el.x + w / 2, cy = el.y + h / 2;
  const a = ((el.rotation || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a));
  const bw = w * cos + h * sin;
  const bh = w * sin + h * cos;
  return { minX: cx - bw / 2, minY: cy - bh / 2, maxX: cx + bw / 2, maxY: cy + bh / 2 };
}

const mmToPt = (mm) => (mm * 72) / 25.4;
const mmToPx = (mm, dpi) => Math.round((mm / 25.4) * dpi);
const round2 = (n) => Math.round(n * 100) / 100;

module.exports = { rotatedBounds, mmToPt, mmToPx, round2 };
