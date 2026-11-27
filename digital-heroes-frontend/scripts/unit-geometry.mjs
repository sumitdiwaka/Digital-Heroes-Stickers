// Numerical check of the designer maths: rotated resize anchoring, bounds, print-area locking.
import { resizeFrom, rotatedBounds, inside, pushInside, printAreas } from '../src/lib/size.js';
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('FAIL', n, d || ''); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const rot = (px, py, cx, cy, deg) => { const t = deg * Math.PI / 180; return { x: cx + (px - cx) * Math.cos(t) - (py - cy) * Math.sin(t), y: cy + (px - cx) * Math.sin(t) + (py - cy) * Math.cos(t) }; };
const corner = (el, h) => { const cx = el.x + el.width / 2, cy = el.y + el.height / 2; const x = h.includes('e') ? el.x + el.width : el.x, y = h.includes('s') ? el.y + el.height : el.y; return rot(x, y, cx, cy, el.rotation || 0); };
const opposite = { nw: 'se', se: 'nw', ne: 'sw', sw: 'ne' };

let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 400; i++) {
  const el = { x: rnd() * 80, y: rnd() * 60, width: 10 + rnd() * 60, height: 8 + rnd() * 40, rotation: Math.round((rnd() * 360 - 180) * 10) / 10 };
  for (const h of ['nw', 'ne', 'sw', 'se']) {
    // 1) dragging a handle to where it already is changes nothing
    const same = resizeFrom(el, h, corner(el, h), false);
    ok('identity', near(same.x, el.x) && near(same.y, el.y) && near(same.width, el.width) && near(same.height, el.height), JSON.stringify({ el, h, same }));
    // 2) opposite corner stays fixed, dragged corner lands on the pointer
    const target = { x: corner(el, h).x + (rnd() * 20 - 8), y: corner(el, h).y + (rnd() * 20 - 8) };
    const r = { ...el, ...resizeFrom(el, h, target, false) };
    if (r.width > 3.01 && r.height > 3.01) {
      const o0 = corner(el, opposite[h]), o1 = corner(r, opposite[h]), d1 = corner(r, h);
      ok('opposite corner fixed', near(o0.x, o1.x, 1e-5) && near(o0.y, o1.y, 1e-5), JSON.stringify({ el, h, r }));
      ok('dragged corner follows pointer', near(d1.x, target.x, 1e-5) && near(d1.y, target.y, 1e-5), JSON.stringify({ el, h, target, d1 }));
    }
    // 3) aspect lock keeps the ratio
    const a = resizeFrom(el, h, target, true);
    ok('aspect locked', near(a.width / a.height, el.width / el.height, 1e-6));
  }
}
// minimum size is respected
const tiny = resizeFrom({ x: 10, y: 10, width: 20, height: 20, rotation: 0 }, 'se', { x: 10.2, y: 10.2 }, false);
ok('min size 3mm', tiny.width >= 3 && tiny.height >= 3);

// bounds + print-area rules (must mirror the server)
const areas = printAreas(190, 140, { bleedMm: 3, safeMarginMm: 5 });
ok('rotated 90deg bounds swap w/h', (() => { const b = rotatedBounds({ x: 50, y: 50, width: 40, height: 10, rotation: 90 }); return near(b.maxX - b.minX, 10) && near(b.maxY - b.minY, 40); })());
ok('text inside safe area passes', inside({ type: 'text', x: 5, y: 5, width: 100, height: 20, rotation: 0 }, areas));
ok('text in the margin is rejected', !inside({ type: 'text', x: 2, y: 10, width: 50, height: 20, rotation: 0 }, areas));
ok('rect may extend into bleed', inside({ type: 'rect', x: -3, y: -3, width: 196, height: 146, rotation: 0 }, areas));
ok('rect beyond bleed is rejected', !inside({ type: 'rect', x: -4, y: 0, width: 50, height: 50, rotation: 0 }, areas));
ok('rotation that pokes out is rejected (server parity case)', !inside({ type: 'text', x: 80, y: 60, width: 180, height: 10, rotation: 90 }, areas));
const pushed = pushInside({ type: 'text', x: 1, y: 1, width: 40, height: 10, rotation: 0 }, areas);
ok('pushInside slides an element into the safe area', pushed && inside(pushed, areas) && near(pushed.x, 5) && near(pushed.y, 5));
ok('pushInside gives up when the element is too big', pushInside({ type: 'text', x: 0, y: 0, width: 300, height: 10, rotation: 0 }, areas) === null);

// parity with the backend geometry helper (if the backend is next to us)
try {
  const be = (await import('../../digital-heroes-backend/src/utils/geometry.js')).default || (await import('../../digital-heroes-backend/src/utils/geometry.js'));
  const rb = be.rotatedBounds || be.default?.rotatedBounds;
  for (let i = 0; i < 200; i++) { const e = { x: rnd() * 100, y: rnd() * 100, width: 5 + rnd() * 60, height: 5 + rnd() * 40, rotation: rnd() * 360 - 180 }; const a = rotatedBounds(e), b = rb(e); ok('bounds parity with backend', near(a.minX, b.minX) && near(a.maxY, b.maxY)); }
} catch (e) { console.log('(backend parity skipped:', e.message.slice(0, 60) + ')'); }

console.log(fail ? `FAILED: ${fail} (passed ${pass})` : `geometry: all ${pass} checks passed`);
process.exit(fail ? 1 : 0);
