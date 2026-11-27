import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FONT_STACK, PT_TO_MM, fitFontMm, inside, limitFor, resizeFrom, rotatedBounds } from '../../lib/size';

const TextEl = memo(function TextEl({ el, invalid }) {
  const text = el.text || '';
  const label = text || (el.variableKey ? `{${el.variableKey}}` : '');
  const f = useMemo(() => fitFontMm(el, label), [el, label]);
  const ax = el.align === 'center' ? el.x + el.width / 2 : el.align === 'right' ? el.x + el.width : el.x;
  const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
  const base = el.y + el.height / 2 + f.mm * 0.73 / 2;
  return (
    <g>
      <rect x={el.x} y={el.y} width={el.width} height={el.height} fill="transparent" stroke={f.overflow || invalid ? '#C8432F' : 'none'} strokeWidth=".5" strokeDasharray="2 1.5" />
      <text x={ax} y={base} textAnchor={anchor} fontSize={f.mm} fill={el.color || '#000'} fontFamily={FONT_STACK[el.fontFamily] || FONT_STACK.Sans} fontWeight={el.fontWeight === 'bold' ? 700 : 400} fontStyle={el.fontStyle === 'italic' ? 'italic' : 'normal'}
        letterSpacing={(el.tracking || 0) * PT_TO_MM} opacity={text ? 1 : 0.5} style={{ pointerEvents: 'none' }}>{label}</text>
    </g>
  );
});

export default function EditorCanvas({ dims, spec, areas, elements, background, selectedId, invalidIds, assetUrls, onSelect, onGestureStart, onPatch }) {
  const { w, h } = dims, b = spec.bleedMm;
  const pad = Math.max(8, Math.max(w, h) * 0.05);
  const vb = { x: -b - pad, y: -b - pad, w: w + 2 * b + 2 * pad, h: h + 2 * b + 2 * pad };
  const svgRef = useRef(null);
  const gesture = useRef(null);
  const [scale, setScale] = useState(0.2);
  const [guides, setGuides] = useState({ v: false, h: false });
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  useEffect(() => {
    const el = svgRef.current; if (!el) return undefined;
    const upd = () => setScale(vb.w / (el.clientWidth || 1));
    upd(); const ro = new ResizeObserver(upd); ro.observe(el); return () => ro.disconnect();
  }, [vb.w]);

  const toMM = (e) => {
    const svg = svgRef.current; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM(); return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };
  const byId = (id) => elements.find((x) => x.id === id);

  const down = (e) => {
    if (e.button !== undefined && e.button > 0) return;
    const hEl = e.target.closest?.('[data-handle]'); const eEl = e.target.closest?.('[data-el]');
    if (hEl && selectedId) {
      const el = byId(selectedId); if (!el) return;
      gesture.current = { type: hEl.dataset.handle === 'rot' ? 'rotate' : 'resize', handle: hEl.dataset.handle, start: el, startP: toMM(e), id: el.id, pushed: false };
    } else if (eEl) {
      const el = byId(eEl.dataset.el); if (!el) return;
      onSelect(el.id);
      gesture.current = { type: 'move', start: el, startP: toMM(e), id: el.id, pushed: false };
    } else { onSelect(null); return; }
    svgRef.current.setPointerCapture?.(e.pointerId); e.preventDefault();
  };

  const move = (e) => {
    const g = gesture.current; if (!g) return;
    const p = toMM(e); let cand = null; let patch = null;
    if (g.type === 'move') {
      cand = { ...g.start, x: g.start.x + p.x - g.startP.x, y: g.start.y + p.y - g.startP.y };
      // snap element centre to the trim centre lines
      const SN = 1.6 * (scale / 0.2 > 1 ? 1 : 1);
      let gv = false, gh = false;
      if (Math.abs(cand.x + cand.width / 2 - w / 2) < SN) { cand.x = w / 2 - cand.width / 2; gv = true; }
      if (Math.abs(cand.y + cand.height / 2 - h / 2) < SN) { cand.y = h / 2 - cand.height / 2; gh = true; }
      setGuides({ v: gv, h: gh });
      // clamp the translation so the element stays inside its allowed area
      const bb = rotatedBounds(cand), L = limitFor(cand, areas);
      if (bb.minX < L.minX) cand.x += L.minX - bb.minX; else if (bb.maxX > L.maxX) cand.x -= bb.maxX - L.maxX;
      if (bb.minY < L.minY) cand.y += L.minY - bb.minY; else if (bb.maxY > L.maxY) cand.y -= bb.maxY - L.maxY;
      patch = { x: cand.x, y: cand.y };
    } else if (g.type === 'resize') {
      const r = resizeFrom(g.start, g.handle, p, g.start.type === 'image');
      cand = { ...g.start, ...r }; patch = r;
    } else {
      const cx = g.start.x + g.start.width / 2, cy = g.start.y + g.start.height / 2;
      let a = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90;
      a = ((a + 540) % 360) - 180;
      const snap = Math.round(a / 15) * 15; if (Math.abs(a - snap) < 4) a = snap;
      cand = { ...g.start, rotation: Math.round(a * 10) / 10 }; patch = { rotation: cand.rotation };
    }
    if (!inside(cand, areas)) return; // locked to the printable area
    if (!g.pushed) { onGestureStart(); g.pushed = true; }
    onPatch(g.id, patch);
  };
  const up = (e) => { gesture.current = null; setGuides({ v: false, h: false }); svgRef.current?.releasePointerCapture?.(e.pointerId); };

  const sel = selectedId ? byId(selectedId) : null;
  const hr = (coarse ? 11 : 6.5) * scale;
  const corners = sel ? [['nw', sel.x, sel.y, 'nwse-resize'], ['ne', sel.x + sel.width, sel.y, 'nesw-resize'], ['sw', sel.x, sel.y + sel.height, 'nesw-resize'], ['se', sel.x + sel.width, sel.y + sel.height, 'nwse-resize']] : [];
  const bleedPath = `M${-b} ${-b}H${w + b}V${h + b}H${-b}Z M0 0V${h}H${w}V0Z`;

  return (
    <svg ref={svgRef} className="editor-canvas block h-full w-full" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="application" aria-label="Design canvas">
      <defs><pattern id="hatch" width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2.4" stroke="#C8432F" strokeWidth=".45" opacity=".5" /></pattern></defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#E9E3D4" />
      <rect x={-b} y={-b} width={w + 2 * b} height={h + 2 * b} fill={background || '#FFFFFF'} filter="drop-shadow(0 1.2px 2px rgba(0,0,0,.25))" />

      {elements.map((el) => {
        const rot = el.rotation ? `rotate(${el.rotation} ${el.x + el.width / 2} ${el.y + el.height / 2})` : undefined;
        return (
          <g key={el.id} data-el={el.id} transform={rot} style={{ cursor: 'move' }}>
            {el.type === 'rect' && <rect x={el.x} y={el.y} width={el.width} height={el.height} fill={el.fill || 'none'} stroke={el.stroke || 'none'} strokeWidth={el.strokeWidth || 0.3} />}
            {el.type === 'image' && (assetUrls[el.assetId] ? <image href={assetUrls[el.assetId]} x={el.x} y={el.y} width={el.width} height={el.height} preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: 'none' }} /> : <rect x={el.x} y={el.y} width={el.width} height={el.height} fill="#ddd" />)}
            {el.type === 'text' && <TextEl el={el} invalid={invalidIds.has(el.id)} />}
            <rect x={el.x} y={el.y} width={el.width} height={el.height} fill="transparent" />
          </g>
        );
      })}

      {/* print-area overlays (on top, never intercept the pointer) */}
      <g style={{ pointerEvents: 'none' }}>
        {b > 0 && <path d={bleedPath} fill="url(#hatch)" fillRule="evenodd" />}
        <rect x={0} y={0} width={w} height={h} fill="none" stroke="#C8432F" strokeWidth=".45" strokeDasharray="2.2 1.4" />
        <rect x={areas.safe.minX} y={areas.safe.minY} width={areas.safe.maxX - areas.safe.minX} height={areas.safe.maxY - areas.safe.minY} fill="none" stroke="#2F8F5B" strokeWidth=".35" strokeDasharray="1.2 1.2" />
        {guides.v && <line x1={w / 2} y1={-b} x2={w / 2} y2={h + b} stroke="#C77D2E" strokeWidth=".3" />}
        {guides.h && <line x1={-b} y1={h / 2} x2={w + b} y2={h / 2} stroke="#C77D2E" strokeWidth=".3" />}
      </g>

      {sel && (
        <g transform={sel.rotation ? `rotate(${sel.rotation} ${sel.x + sel.width / 2} ${sel.y + sel.height / 2})` : undefined}>
          <rect x={sel.x} y={sel.y} width={sel.width} height={sel.height} fill="none" stroke="#C77D2E" strokeWidth={1.6 * scale} style={{ pointerEvents: 'none' }} />
          <line x1={sel.x + sel.width / 2} y1={sel.y} x2={sel.x + sel.width / 2} y2={sel.y - 26 * scale} stroke="#C77D2E" strokeWidth={1.2 * scale} style={{ pointerEvents: 'none' }} />
          <circle data-handle="rot" cx={sel.x + sel.width / 2} cy={sel.y - 26 * scale} r={hr * 1.15} fill="#fff" stroke="#C77D2E" strokeWidth={1.8 * scale} style={{ cursor: 'grab' }} />
          {corners.map(([k, x, y, cur]) => <rect key={k} data-handle={k} x={x - hr} y={y - hr} width={hr * 2} height={hr * 2} rx={hr * .3} fill="#fff" stroke="#C77D2E" strokeWidth={1.8 * scale} style={{ cursor: cur }} />)}
        </g>
      )}
    </svg>
  );
}
