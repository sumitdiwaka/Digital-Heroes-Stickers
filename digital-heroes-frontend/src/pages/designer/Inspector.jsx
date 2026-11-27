import { useEffect, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, BringToFront, Copy, Italic, SendToBack, Trash2 } from 'lucide-react';
import { Field, Input, Select, cx } from '../../components/ui';

export const FAMILIES = ['Sans', 'Condensed', 'Serif', 'Mono'];

/** Number input that lets you type freely and commits on blur / Enter */
function Num({ label, value, onChange, step = 0.5, min, max, suffix }) {
  const [d, setD] = useState(String(Math.round((value ?? 0) * 100) / 100));
  useEffect(() => setD(String(Math.round((value ?? 0) * 100) / 100)), [value]);
  const commit = () => { const n = parseFloat(d); if (Number.isFinite(n)) { let v = n; if (min !== undefined) v = Math.max(min, v); if (max !== undefined) v = Math.min(max, v); onChange(v); } else setD(String(value)); };
  return (
    <Field label={label}><div className="relative"><Input inputMode="decimal" value={d} step={step} onChange={(e) => setD(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className="!py-2 pr-8 font-mono !text-xs" />{suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-ink-500">{suffix}</span>}</div></Field>
  );
}
const Color = ({ label, value, onChange }) => (
  <Field label={label}><div className="flex items-center gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(value || '') ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 cursor-pointer rounded-lg border border-paper-300 bg-white p-0.5" /><Input value={value || ''} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(e.target.value)} className="!py-2 font-mono !text-xs" /></div></Field>
);
const Tog = ({ on, onClick, children, label }) => <button type="button" aria-pressed={on} aria-label={label} onClick={onClick} className={cx('grid h-9 min-w-9 place-items-center rounded-lg border px-2 transition', on ? 'border-ink-900 bg-ink-900 text-paper' : 'border-paper-300 hover:border-copper-500')}>{children}</button>;

export default function Inspector({ el, onPatch, onGeom, onDelete, onDuplicate, onZ, background, onBackground }) {
  if (!el) {
    return (
      <div className="space-y-4"><p className="text-sm text-ink-500">Select an element on the canvas to edit it - or change the page background:</p><Color label="Background colour" value={background} onChange={(v) => /^#[0-9a-fA-F]{6}$/.test(v) && onBackground(v)} />
        <p className="rounded-xl bg-paper-200/70 p-3 text-xs text-ink-500">Tip: arrow keys nudge the selected element (Shift = 5 mm). Ctrl/Cmd+Z undoes, Delete removes.</p></div>
    );
  }
  const p = (patch) => onPatch(el.id, patch);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><span className="kicker">{el.type}</span>
        <div className="flex gap-1.5"><Tog label="Bring forward" onClick={() => onZ(el.id, 1)}><BringToFront size={15} /></Tog><Tog label="Send backward" onClick={() => onZ(el.id, -1)}><SendToBack size={15} /></Tog><Tog label="Duplicate" onClick={() => onDuplicate(el.id)}><Copy size={15} /></Tog><button type="button" aria-label="Delete" onClick={() => onDelete(el.id)} className="grid h-9 w-9 place-items-center rounded-lg border border-paper-300 text-signal-red transition hover:bg-signal-red hover:text-white"><Trash2 size={15} /></button></div></div>

      {el.type === 'text' && (
        <>
          <Field label="Text"><Input value={el.text || ''} onChange={(e) => p({ text: e.target.value.slice(0, 500) })} placeholder={el.variableKey ? `(CSV: ${el.variableKey})` : 'Type here'} /></Field>
          <Field label="Merge field (CSV column)" hint="Optional. Fills this box from a CSV, one artwork per row."><Input value={el.variableKey || ''} onChange={(e) => /^[A-Za-z0-9_]{0,40}$/.test(e.target.value) && p({ variableKey: e.target.value || undefined })} placeholder="e.g. name" className="font-mono !text-xs" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Font"><Select value={el.fontFamily || 'Sans'} onChange={(e) => p({ fontFamily: e.target.value })} className="!py-2 !text-xs">{FAMILIES.map((f) => <option key={f}>{f}</option>)}</Select></Field>
            <Field label="Style"><div className="flex gap-1.5"><Tog on={el.fontWeight === 'bold'} label="Bold" onClick={() => p({ fontWeight: el.fontWeight === 'bold' ? 'normal' : 'bold' })}><Bold size={15} /></Tog><Tog on={el.fontStyle === 'italic'} label="Italic" onClick={() => p({ fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' })}><Italic size={15} /></Tog></div></Field></div>
          <Field label="Align"><div className="flex gap-1.5">{[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([a, I]) => <Tog key={a} on={(el.align || 'left') === a} label={`Align ${a}`} onClick={() => p({ align: a })}><I size={15} /></Tog>)}</div></Field>
          <Color label="Colour" value={el.color} onChange={(v) => /^#[0-9a-fA-F]{6}$/.test(v) && p({ color: v })} />
          <div className="rounded-xl border border-paper-300 bg-paper-200/40 p-3"><div className="label">Fitting rules</div>
            <div className="grid grid-cols-3 gap-2"><Num label="Max pt" value={el.maxFontSize || el.fontSize || 24} min={1} max={1500} step={1} onChange={(v) => p({ maxFontSize: v, fontSize: v, minFontSize: Math.min(el.minFontSize || 6, v) })} /><Num label="Min pt" value={el.minFontSize || 6} min={1} max={el.maxFontSize || 1500} step={1} onChange={(v) => p({ minFontSize: v })} /><Num label="Track" value={el.tracking || 0} min={-20} max={100} step={0.5} onChange={(v) => p({ tracking: v })} /></div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4 accent-copper-500" checked={el.shrinkToFit !== false} onChange={(e) => p({ shrinkToFit: e.target.checked })} />Shrink to fit the box</label></div>
        </>
      )}
      {el.type === 'rect' && <div className="grid gap-3"><Color label="Fill" value={el.fill} onChange={(v) => /^#[0-9a-fA-F]{6}$/.test(v) && p({ fill: v })} /><Color label="Outline" value={el.stroke} onChange={(v) => /^#[0-9a-fA-F]{6}$/.test(v) ? p({ stroke: v }) : v === '' && p({ stroke: undefined })} /></div>}

      <div><div className="label">Position &amp; size (mm)</div>
        <div className="grid grid-cols-2 gap-2.5"><Num label="X" value={el.x} onChange={(v) => onGeom(el.id, { x: v })} /><Num label="Y" value={el.y} onChange={(v) => onGeom(el.id, { y: v })} /><Num label="Width" value={el.width} min={3} onChange={(v) => onGeom(el.id, { width: v })} /><Num label="Height" value={el.height} min={3} onChange={(v) => onGeom(el.id, { height: v })} /><Num label="Rotation" value={el.rotation || 0} min={-360} max={360} step={1} suffix="°" onChange={(v) => onGeom(el.id, { rotation: v })} /></div></div>
    </div>
  );
}
