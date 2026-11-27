/**
 * Font engine. Fonts ship inside the repo (assets/fonts, DejaVu - free licence) so output is
 * IDENTICAL on every server - no dependency on system fonts. Text is converted to vector OUTLINES,
 * which is also what print shops prefer (no missing-font surprises).
 */
const path = require('path');
const fontkit = require('fontkit');

const DIR = path.join(__dirname, '../../../assets/fonts');
const FILES = {
  Sans: { normal: 'DejaVuSans', bold: 'DejaVuSans-Bold', italic: 'DejaVuSans-Oblique', bolditalic: 'DejaVuSans-BoldOblique' },
  Condensed: { normal: 'DejaVuSansCondensed', bold: 'DejaVuSansCondensed-Bold', italic: 'DejaVuSansCondensed-Oblique', bolditalic: 'DejaVuSansCondensed-BoldOblique' },
  Serif: { normal: 'DejaVuSerif', bold: 'DejaVuSerif-Bold', italic: 'DejaVuSerif-Italic', bolditalic: 'DejaVuSerif-BoldItalic' },
  Mono: { normal: 'DejaVuSansMono', bold: 'DejaVuSansMono-Bold', italic: 'DejaVuSansMono-Oblique', bolditalic: 'DejaVuSansMono-BoldOblique' },
};
const FAMILIES = Object.keys(FILES);
const cache = new Map();

function getFont(family = 'Sans', weight = 'normal', style = 'normal') {
  if (!FILES[family]) family = 'Sans';
  const variant = `${weight === 'bold' ? 'bold' : ''}${style === 'italic' ? 'italic' : ''}` || 'normal';
  const file = FILES[family][variant];
  if (!cache.has(file)) cache.set(file, fontkit.openSync(path.join(DIR, `${file}.ttf`)));
  return cache.get(file);
}

const PT_TO_MM = 25.4 / 72;

/** Lay out one line. Sizes: fontSizeMm, trackingMm. Returns advance width + glyph runs. */
function layoutLine(font, text, fontSizeMm, trackingMm = 0) {
  const run = font.layout(String(text));
  const s = fontSizeMm / font.unitsPerEm;
  const n = run.glyphs.length;
  const width = run.advanceWidth * s + trackingMm * Math.max(0, n - 1);
  return { run, scale: s, width, count: n };
}

/** Vertical metrics in mm for a given size. */
function metrics(font, fontSizeMm) {
  const s = fontSizeMm / font.unitsPerEm;
  const cap = (font['OS/2'] && font['OS/2'].capHeight) || font.unitsPerEm * 0.73;
  return { ascent: font.ascent * s, descent: -font.descent * s, lineHeight: (font.ascent - font.descent) * s, capHeight: cap * s };
}

const f2 = (n) => Math.round(n * 1000) / 1000;

/**
 * Convert a laid-out line into an SVG path string (y-down), in mm, with the pen starting at (x, baselineY).
 */
function lineToPath(layout, x, baselineY, trackingMm = 0) {
  const { run, scale } = layout;
  let pen = 0;
  const parts = [];
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    const ox = x + pen + pos.xOffset * scale;
    const oy = baselineY - pos.yOffset * scale;
    for (const c of g.path.commands) {
      const a = c.args;
      const X = (k) => f2(ox + a[k] * scale);
      const Y = (k) => f2(oy - a[k] * scale);
      if (c.command === 'moveTo') parts.push(`M${X(0)} ${Y(1)}`);
      else if (c.command === 'lineTo') parts.push(`L${X(0)} ${Y(1)}`);
      else if (c.command === 'quadraticCurveTo') parts.push(`Q${X(0)} ${Y(1)} ${X(2)} ${Y(3)}`);
      else if (c.command === 'bezierCurveTo') parts.push(`C${X(0)} ${Y(1)} ${X(2)} ${Y(3)} ${X(4)} ${Y(5)}`);
      else if (c.command === 'closePath') parts.push('Z');
    }
    pen += pos.xAdvance * scale + trackingMm;
  });
  return parts.join('');
}

module.exports = { FAMILIES, getFont, layoutLine, metrics, lineToPath, PT_TO_MM };
