/**
 * Per-placeholder FITTING RULES - guarantees variable content (e.g. a long name from a CSV) fits its box.
 *   1. shrink-to-fit : reduce font size (binary search) down to minFontSize
 *   2. tracking      : if still too wide at min size, tighten letter-spacing down to minTracking
 *   3. otherwise     : flag overflow (warning goes to the admin / job log)
 */
const { getFont, layoutLine, metrics, PT_TO_MM } = require('./fonts');

function fitText(el, text, boxWmm, boxHmm) {
  const font = getFont(el.fontFamily, el.fontWeight, el.fontStyle);
  const minPt = el.minFontSize || 6;
  const maxPt = el.maxFontSize || Math.max(el.fontSize || 12, minPt);
  const startPt = Math.min(el.fontSize || maxPt, maxPt);
  const baseTrackMm = (el.tracking || 0) * PT_TO_MM;
  const minTrackMm = (el.minTracking === undefined || el.minTracking === null ? -1 : el.minTracking) * PT_TO_MM;

  const fits = (pt, trackMm) => {
    const sizeMm = pt * PT_TO_MM;
    const l = layoutLine(font, text, sizeMm, trackMm);
    return l.width <= boxWmm + 1e-6 && metrics(font, sizeMm).lineHeight <= boxHmm + 1e-6;
  };

  let pt = startPt;
  let track = baseTrackMm;
  let overflow = false;

  if (!fits(pt, track)) {
    if (el.shrinkToFit === false) {
      overflow = true;
    } else {
      // binary search for the biggest size in [minPt, startPt] that fits
      if (fits(minPt, track)) {
        let lo = minPt, hi = startPt;
        for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid, track)) lo = mid; else hi = mid; }
        pt = lo;
      } else {
        pt = minPt;
        // tighten tracking in 0.05mm steps
        let t = track;
        while (t > minTrackMm && !fits(pt, t)) t -= 0.05;
        track = Math.max(t, minTrackMm);
        if (!fits(pt, track)) overflow = true;
      }
    }
  }

  const sizeMm = pt * PT_TO_MM;
  const layout = layoutLine(font, text, sizeMm, track);
  return { font, layout, sizeMm, sizePt: Math.round(pt * 100) / 100, trackMm: track, metrics: metrics(font, sizeMm), overflow };
}

module.exports = { fitText };
