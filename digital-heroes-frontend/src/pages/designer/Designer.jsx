/**
 * Web-to-print designer. Everything is edited in millimetres inside the product's TRIM box.
 *  - text / images are locked to the SAFE area, colour blocks may reach into the BLEED (same rules as the server)
 *  - drag / resize / rotate with pointer events (mouse + touch), centre snapping, undo / redo, keyboard nudging
 *  - live server validation + a true server-rendered proof preview (same engine as the print files)
 * Modes: new design (?size=..&material=..), edit saved design (?design=ID), edit order artwork (?order=ID)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Eye, Image as ImageIcon, Layers, LayoutTemplate, Plus, Redo2, Save, Shapes, Type, Undo2, Wand2, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import '../../designer-fonts.css';
import EditorCanvas from './EditorCanvas';
import Inspector, { FAMILIES } from './Inspector';
import { api, errorText, fetchBlob } from '../../lib/api';
import { AuthedImage } from '../../components/Shared';
import { Button, ErrorBox, Input, Modal, Skeleton, Spinner, cx } from '../../components/ui';
import { printAreas, pushInside, inside, queryToCfg, resolveSize, toApiConfig, uid, fitFontMm } from '../../lib/size';
import { useDebounced, usePageTitle } from '../../lib/hooks';
import { useToast } from '../../context/ToastContext';

const ALLOWED = ['id', 'type', 'x', 'y', 'width', 'height', 'rotation', 'text', 'variableKey', 'fontFamily', 'fontWeight', 'fontStyle', 'fontSize', 'minFontSize', 'maxFontSize', 'tracking', 'minTracking', 'shrinkToFit', 'align', 'color', 'assetId', 'fill', 'stroke', 'strokeWidth'];
const TEXT_ONLY = ['text', 'variableKey', 'fontFamily', 'fontWeight', 'fontStyle', 'fontSize', 'minFontSize', 'maxFontSize', 'tracking', 'minTracking', 'shrinkToFit', 'align', 'color'];

/** Elements as the API accepts them (strict schema): known keys only, no empties, 2-decimals. */
const clean = (el) => {
  const o = {};
  ALLOWED.forEach((k) => { if (el[k] !== undefined && el[k] !== null && el[k] !== '') o[k] = typeof el[k] === 'number' ? Math.round(el[k] * 100) / 100 : el[k]; });
  if (el.type !== 'text') TEXT_ONLY.forEach((k) => delete o[k]);
  if (el.type !== 'rect') { delete o.fill; delete o.stroke; delete o.strokeWidth; }
  if (el.type !== 'image') delete o.assetId;
  return o;
};
/** Server-loaded elements -> editor elements (drops Mongo defaults that are meaningless for the type; legacy font names -> Sans) */
const normalize = (el) => {
  const o = { ...el }; delete o._id;
  if (o.type === 'text') { if (!FAMILIES.includes(o.fontFamily)) o.fontFamily = 'Sans'; o.fontWeight = o.fontWeight || 'normal'; o.align = o.align || 'left'; o.color = o.color || '#000000'; }
  return o;
};

export default function Designer() {
  const { slug } = useParams();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate(); const toast = useToast(); const qc = useQueryClient();
  const designParam = sp.get('design'), orderParam = sp.get('order');
  usePageTitle('Designer');

  const productQ = useQuery({ queryKey: ['product', slug], queryFn: () => api.get(`/api/products/${slug}`) });
  const designQ = useQuery({ queryKey: ['design', designParam], enabled: !!designParam, queryFn: () => api.get(`/api/designs/${designParam}`), staleTime: 0, refetchOnMount: 'always' });
  const orderQ = useQuery({ queryKey: ['order', orderParam], enabled: !!orderParam, queryFn: () => api.get(`/api/orders/${orderParam}`), staleTime: 0, refetchOnMount: 'always' });
  const product = productQ.data?.product; const templates = productQ.data?.templates || [];

  const [ready, setReady] = useState(false);
  const [cfg, setCfg] = useState(null);
  const [els, setEls] = useState([]); const [background, setBackground] = useState('#FFFFFF');
  const [name, setName] = useState('Untitled design');
  const [selected, setSelected] = useState(null);
  const [designId, setDesignId] = useState(designParam || null); const [templateId, setTemplateId] = useState(null);
  const [dirty, setDirty] = useState(false); const [saving, setSaving] = useState(false);
  const [check, setCheck] = useState(null); const [assetUrls, setAssetUrls] = useState({});
  const [tab, setTab] = useState('edit'); const [pickOpen, setPickOpen] = useState(false); const [previewVer, setPreviewVer] = useState(0); const [vars, setVars] = useState({});
  const fileRef = useRef(null);

  // refs mirror state so gesture callbacks never see stale values
  const elsRef = useRef(els); elsRef.current = els; const bgRef = useRef(background); bgRef.current = background;
  const hist = useRef({ past: [], future: [] }); const [, bump] = useState(0);

  /* ------------------------------------------------------------ init */
  useEffect(() => {
    if (ready || !product) return;
    if (designParam) {
      const d = designQ.data; if (!d) return;
      setCfg({ ...d.config }); setEls((d.elements || []).map(normalize)); setBackground(d.background || '#FFFFFF'); setName(d.name); setTemplateId(d.template || null); setReady(true);
    } else if (orderParam) {
      const o = orderQ.data?.order; if (!o) return;
      setCfg({ ...o.config }); setEls((o.designSnapshot?.elements || []).map(normalize)); setBackground(o.designSnapshot?.background || '#FFFFFF'); setName(o.orderNumber); setReady(true);
    } else {
      const q = queryToCfg(sp); const r = resolveSize(product, q);
      if (!r) { setCfg(false); setReady(true); return; }
      setCfg({ ...r, material: q.material || product.materials[0].key }); setPickOpen(true); setReady(true);
    }
  }, [ready, product, designParam, orderParam, designQ.data, orderQ.data, sp]);

  const dims = useMemo(() => (cfg ? { w: cfg.widthMm, h: cfg.heightMm } : null), [cfg]);
  const spec = product?.printSpec;
  const areas = useMemo(() => (dims && spec ? printAreas(dims.w, dims.h, spec) : null), [dims, spec]);

  /* ------------------------------------------------------------ history */
  const pushHistory = useCallback(() => {
    hist.current.past.push(JSON.stringify({ e: elsRef.current, b: bgRef.current })); if (hist.current.past.length > 80) hist.current.past.shift();
    hist.current.future = []; setDirty(true); bump((n) => n + 1);
  }, []);
  const undo = useCallback(() => { const h = hist.current; if (!h.past.length) return; h.future.push(JSON.stringify({ e: elsRef.current, b: bgRef.current })); const s = JSON.parse(h.past.pop()); setEls(s.e); setBackground(s.b); setDirty(true); bump((n) => n + 1); }, []);
  const redo = useCallback(() => { const h = hist.current; if (!h.future.length) return; h.past.push(JSON.stringify({ e: elsRef.current, b: bgRef.current })); const s = JSON.parse(h.future.pop()); setEls(s.e); setBackground(s.b); setDirty(true); bump((n) => n + 1); }, []);

  const patchRaw = useCallback((id, patch) => { setEls((l) => l.map((e) => (e.id === id ? { ...e, ...patch } : e))); setDirty(true); }, []);
  const patchCommit = useCallback((id, patch) => { pushHistory(); patchRaw(id, patch); }, [pushHistory, patchRaw]);
  const geom = useCallback((id, patch) => {
    const el = elsRef.current.find((e) => e.id === id); if (!el || !areas) return;
    let cand = { ...el, ...patch };
    if (!inside(cand, areas)) { cand = pushInside(cand, areas); if (!cand) { toast.error('That would leave the printable area.'); return; } }
    pushHistory(); patchRaw(id, { x: cand.x, y: cand.y, width: cand.width, height: cand.height, rotation: cand.rotation });
  }, [areas, pushHistory, patchRaw, toast]);

  /* ------------------------------------------------------------ adding things */
  const place = (el) => {
    const c = { ...el, x: areas.safe.minX + ((areas.safe.maxX - areas.safe.minX) - el.width) / 2, y: areas.safe.minY + ((areas.safe.maxY - areas.safe.minY) - el.height) / 2, rotation: 0, id: uid(el.type) };
    const fixed = inside(c, areas) ? c : pushInside(c, areas);
    if (!fixed) { toast.error('The product is too small for that element.'); return; }
    pushHistory(); setEls((l) => [...l, fixed]); setSelected(fixed.id); setTab('edit');
  };
  const safeW = areas ? areas.safe.maxX - areas.safe.minX : 0, safeH = areas ? areas.safe.maxY - areas.safe.minY : 0;
  const addText = () => place({ type: 'text', text: 'Your text', width: Math.min(safeW * 0.8, 90), height: Math.min(safeH * 0.35, 16), fontFamily: 'Sans', fontWeight: 'bold', fontSize: 40, maxFontSize: 40, minFontSize: 5, tracking: 0, shrinkToFit: true, align: 'center', color: '#111111' });
  const addRect = () => place({ type: 'rect', width: Math.min(safeW * 0.5, 40), height: Math.min(safeH * 0.3, 20), fill: '#C77D2E' });
  const addImage = async (file) => {
    if (!file) return;
    try {
      const a = await api.upload('/api/uploads/asset', file);
      const ratio = a.widthPx && a.heightPx ? a.widthPx / a.heightPx : 1.5; const wmm = Math.min(safeW * 0.4, 40);
      place({ type: 'image', assetId: a.id, width: wmm, height: Math.min(wmm / ratio, safeH * 0.5) });
    } catch (e) { toast.error(errorText(e)); } finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  const applyTemplate = async (t) => {
    if (els.length && !window.confirm('Replace the current layout with this template?')) return;
    try {
      const r = await api.get(`/api/templates/${t._id}/instantiate`, { sizeKey: cfg.sizeKey || undefined, width: cfg.sizeKey ? undefined : cfg.widthMm, height: cfg.sizeKey ? undefined : cfg.heightMm, material: cfg.material, orientation: cfg.orientation });
      pushHistory(); setEls(r.elements.map(normalize)); setBackground(r.background || '#FFFFFF'); setTemplateId(t._id); setSelected(null); setPickOpen(false); toast.success(`Template “${t.name}” applied.`);
    } catch (e) { toast.error(errorText(e)); }
  };
  const remove = (id) => { pushHistory(); setEls((l) => l.filter((e) => e.id !== id)); setSelected(null); };
  const duplicate = (id) => { const el = els.find((e) => e.id === id); if (!el) return; const c = { ...el, id: uid(el.type), x: el.x + 4, y: el.y + 4 }; const fixed = inside(c, areas) ? c : pushInside(c, areas) || { ...el, id: c.id }; pushHistory(); setEls((l) => [...l, fixed]); setSelected(fixed.id); };
  const zorder = (id, dir) => { pushHistory(); setEls((l) => { const i = l.findIndex((e) => e.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n; }); };

  /* ------------------------------------------------------------ keyboard */
  useEffect(() => {
    const h = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === 'd' && selected) { e.preventDefault(); duplicate(selected); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); remove(selected); }
      else if (e.key.startsWith('Arrow') && selected) {
        e.preventDefault(); const s = e.shiftKey ? 5 : 0.5;
        geom(selected, { x: elsRef.current.find((x) => x.id === selected).x + (e.key === 'ArrowRight' ? s : e.key === 'ArrowLeft' ? -s : 0), y: elsRef.current.find((x) => x.id === selected).y + (e.key === 'ArrowDown' ? s : e.key === 'ArrowUp' ? -s : 0) });
      } else if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  useEffect(() => { const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);

  /* ------------------------------------------------------------ logo blobs + live server validation */
  useEffect(() => {
    els.filter((e) => e.type === 'image' && e.assetId && !assetUrls[e.assetId]).forEach((e) => {
      fetchBlob(`/api/uploads/asset/${e.assetId}`).then((b) => setAssetUrls((m) => (m[e.assetId] ? m : { ...m, [e.assetId]: URL.createObjectURL(b) }))).catch(() => {});
    });
  }, [els, assetUrls]);
  useEffect(() => () => { Object.values(assetUrls).forEach((u) => URL.revokeObjectURL(u)); }, []); // eslint-disable-line

  const dEls = useDebounced(els, 700);
  useEffect(() => {
    if (!ready || !product || !cfg) return undefined;
    let alive = true;
    api.post('/api/designs/validate', { product: product._id, config: toApiConfig(cfg), elements: dEls.map(clean) }).then((r) => alive && setCheck(r)).catch((e) => alive && setCheck({ valid: false, errors: [{ message: errorText(e) }], warnings: [] }));
    return () => { alive = false; };
  }, [dEls, ready, product, cfg]);

  /* ------------------------------------------------------------ saving */
  const save = async () => {
    setSaving(true);
    try {
      const elements = els.map(clean);
      if (orderParam) {
        const r = await api.put(`/api/orders/${orderParam}/artwork`, { elements, background });
        qc.invalidateQueries({ queryKey: ['order', orderParam] }); qc.invalidateQueries({ queryKey: ['dashboard'] });
        toast.success(r.newProofVersion ? `Saved - proof v${r.newProofVersion} is being created.` : 'Artwork saved.'); setDirty(false); return { order: true };
      }
      let id = designId;
      if (id) await api.patch(`/api/designs/${id}`, { name, background, elements, config: toApiConfig(cfg) });
      else {
        const r = await api.post('/api/designs', { name, product: product._id, template: templateId || undefined, config: toApiConfig(cfg), background, elements });
        id = r.design._id; setDesignId(id); setSp((p) => { const n = new URLSearchParams(p); n.set('design', id); return n; }, { replace: true });
      }
      qc.invalidateQueries({ queryKey: ['designs'] }); qc.invalidateQueries({ queryKey: ['dashboard'] });
      setDirty(false); setPreviewVer((v) => v + 1); toast.success('Design saved.'); return { id };
    } catch (e) { toast.error(e.code === 'OUTSIDE_PRINT_AREA' ? 'Some elements are outside the printable area.' : errorText(e)); return null; } finally { setSaving(false); }
  };
  const proceed = async () => {
    const r = await save(); if (!r) return;
    if (r.order) { nav(`/orders/${orderParam}`); return; }
    setSaving(true);
    try {
      const { order } = await api.post('/api/orders', { product: product.slug, config: toApiConfig(cfg), quantity: Number(sp.get('qty')) || product.quantity.min, design: r.id });
      nav(`/orders/${order._id}`);
    } catch (e) { toast.error(errorText(e)); setSaving(false); }
  };

  /* ------------------------------------------------------------ derived */
  const sel = els.find((e) => e.id === selected) || null;
  const invalidIds = useMemo(() => new Set((check?.errors || []).map((e) => e.elementId).filter(Boolean)), [check]);
  const overflow = useMemo(() => els.filter((e) => e.type === 'text' && fitFontMm(e, e.text || (e.variableKey ? `{${e.variableKey}}` : '')).overflow), [els]);
  const varKeys = useMemo(() => [...new Set(els.filter((e) => e.variableKey).map((e) => e.variableKey))], [els]);
  const backTo = orderParam ? `/orders/${orderParam}` : `/products/${slug}`;
  const latestProof = orderQ.data?.order?.latestProofVersion;

  if (productQ.error) return <div className="p-8"><ErrorBox error={productQ.error} retry={productQ.refetch} /></div>;
  if (!ready || !product) return <div className="grid h-screen place-items-center bg-paper"><div className="text-center"><Spinner size={30} /><p className="mt-3 font-mono text-xs uppercase tracking-widest text-ink-500">Opening designer</p></div></div>;
  if (cfg === false) return <div className="grid h-screen place-items-center bg-paper p-8"><div className="max-w-md text-center"><AlertTriangle className="mx-auto text-copper-500" size={36} /><h1 className="mt-4 text-2xl font-bold">Choose a size first</h1><p className="mt-2 text-ink-500">Open the designer from a product page so we know the size, material and quantity.</p><Button as={Link} to={backTo} className="mt-6">Back to product</Button></div></div>;

  const ToolsPanel = (
    <div className="space-y-6">
      <section><h3 className="label">Add to canvas</h3>
        <div className="grid grid-cols-3 gap-2">
          {[[Type, 'Text', addText], [ImageIcon, 'Logo', () => fileRef.current?.click()], [Shapes, 'Shape', addRect]].map(([I, l, fn]) => <button key={l} onClick={fn} className="group flex flex-col items-center gap-1.5 rounded-xl border border-paper-300 bg-white/60 py-3 text-xs font-semibold transition hover:-translate-y-0.5 hover:border-copper-500 hover:shadow-lift"><I size={20} className="text-copper-500 transition group-hover:scale-110" />{l}</button>)}
        </div>
        <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.svg" className="hidden" onChange={(e) => addImage(e.target.files?.[0])} /></section>
      {templates.length > 0 && <section><h3 className="label">Templates</h3><div className="flex flex-wrap gap-2">{templates.map((t) => <button key={t._id} onClick={() => applyTemplate(t)} className="chip"><LayoutTemplate size={13} />{t.name}</button>)}</div></section>}
      <section><h3 className="label flex items-center gap-1.5"><Layers size={12} />Layers ({els.length})</h3>
        {els.length === 0 ? <p className="rounded-xl border border-dashed border-paper-400 p-4 text-center text-xs text-ink-500">Empty canvas. Add text, a logo or start from a template.</p> : (
          <ul className="space-y-1.5">{[...els].reverse().map((e) => (
            <li key={e.id} className={cx('group flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition', selected === e.id ? 'border-copper-500 bg-copper-50' : 'border-paper-300 hover:border-copper-300', invalidIds.has(e.id) && 'border-signal-red')}>
              <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => { setSelected(e.id); setTab('edit'); }}>{e.type === 'text' ? <Type size={13} /> : e.type === 'image' ? <ImageIcon size={13} /> : <Shapes size={13} />}<span className="truncate font-medium">{e.type === 'text' ? (e.text || `{${e.variableKey}}`) : e.type === 'image' ? 'Logo' : 'Shape'}</span>{e.variableKey && <span className="rounded bg-sage-100 px-1 font-mono text-[9px] text-sage-700">CSV</span>}</button>
              <button aria-label="Move up" onClick={() => zorder(e.id, 1)} className="text-ink-500 hover:text-ink-900"><ChevronUp size={14} /></button><button aria-label="Move down" onClick={() => zorder(e.id, -1)} className="text-ink-500 hover:text-ink-900"><ChevronDown size={14} /></button>
              <button aria-label="Delete" onClick={() => remove(e.id)} className="text-ink-500 hover:text-signal-red"><Trash2 size={14} /></button></li>))}</ul>)}</section>
    </div>
  );

  const CheckPanel = (
    <div className="space-y-4">
      {!check ? <p className="flex items-center gap-2 text-sm text-ink-500"><Spinner size={14} />Checking print area…</p> : check.valid && !overflow.length ? <div className="flex items-start gap-3 rounded-xl border border-sage-300 bg-sage-50 p-4 text-sm text-sage-700"><CheckCircle2 className="mt-0.5 shrink-0" size={18} /><div><b>Print-ready.</b> Everything sits inside the printable area.</div></div> : null}
      {check?.errors?.map((er, i) => <button key={i} onClick={() => er.elementId && setSelected(er.elementId)} className="flex w-full items-start gap-2.5 rounded-xl border border-signal-red/30 bg-signal-red/5 p-3 text-left text-xs text-signal-red"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{er.message}</span></button>)}
      {overflow.map((e) => <button key={e.id} onClick={() => setSelected(e.id)} className="flex w-full items-start gap-2.5 rounded-xl border border-copper-300 bg-copper-50 p-3 text-left text-xs text-copper-700"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>“{(e.text || e.variableKey || '').slice(0, 24)}” does not fit its box even at the minimum size. Make the box bigger or lower Min pt.</span></button>)}
      {check?.warnings?.map((w, i) => <p key={i} className="rounded-xl bg-paper-200 p-3 text-xs text-ink-600">{w.message}</p>)}
      <div className="rounded-xl border border-paper-300 p-3 text-xs text-ink-500"><div className="label">Legend</div><ul className="space-y-1.5"><li className="flex items-center gap-2"><i className="h-0 w-6 border-t-2 border-dashed border-signal-red" />Trim line - where it is cut</li><li className="flex items-center gap-2"><i className="h-0 w-6 border-t-2 border-dashed" style={{ borderColor: '#2F8F5B' }} />Safe area - keep text &amp; logos inside</li><li className="flex items-center gap-2"><i className="h-3 w-6 rounded-sm opacity-60" style={{ background: 'repeating-linear-gradient(45deg,#C8432F 0 1px,transparent 1px 4px)' }} />Bleed - backgrounds extend here</li></ul></div>
    </div>
  );

  const PreviewPanel = (
    <div className="space-y-4">
      {orderParam ? (latestProof > 0 ? <><p className="text-xs text-ink-500">Latest proof (v{latestProof}). Save to generate the next version.</p><div className="dh-checker overflow-hidden rounded-xl border border-paper-300"><AuthedImage path={`/api/orders/${orderParam}/proofs/${latestProof}/preview.png`} alt="Latest proof" ratio={`${dims.w + 2 * spec.bleedMm}/${dims.h + 2 * spec.bleedMm}`} /></div></> : <p className="text-sm text-ink-500">No proof yet.</p>) : (
        <>
          <p className="text-xs text-ink-500">This is rendered by the same engine that creates your print files - exact fonts, fitting and bleed.</p>
          {varKeys.length > 0 && <div className="space-y-2"><div className="label">Try merge values</div>{varKeys.map((k) => <Input key={k} placeholder={k} value={vars[k] || ''} onChange={(e) => setVars((v) => ({ ...v, [k]: e.target.value }))} className="!py-2 !text-xs" />)}</div>}
          {designId && !dirty ? <div className="dh-checker overflow-hidden rounded-xl border border-paper-300"><AuthedImage path={`/api/designs/${designId}/preview.png${varKeys.length ? '?' + varKeys.filter((k) => vars[k]).map((k) => `var_${k}=${encodeURIComponent(vars[k])}`).join('&') : ''}`} version={previewVer} alt="Proof preview" ratio={`${dims.w + 2 * spec.bleedMm}/${dims.h + 2 * spec.bleedMm}`} /></div>
            : <div className="rounded-xl border border-dashed border-paper-400 p-5 text-center text-sm text-ink-500">{dirty ? 'You have unsaved changes.' : 'Save your design to see the true proof.'}<div className="mt-3"><Button size="sm" onClick={save} loading={saving}><Eye size={14} />Save &amp; preview</Button></div></div>}
        </>
      )}
    </div>
  );

  const TABS = [['tools', 'Tools', 'lg:hidden'], ['edit', 'Edit', ''], ['check', check && (!check.valid || overflow.length) ? 'Check •' : 'Check', ''], ['preview', 'Preview', '']];
  return (
    <div className="flex h-[100dvh] flex-col bg-paper text-ink-900">
      <header className="on-dark flex flex-wrap items-center gap-2 border-b border-ink-600 bg-ink-900 px-3 py-2.5 text-paper sm:gap-3 sm:px-4">
        <Link to={backTo} onClick={(e) => dirty && !window.confirm('Leave without saving?') && e.preventDefault()} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 hover:border-copper-400" aria-label="Back"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1 basis-40 sm:flex-none sm:basis-64"><input value={name} onChange={(e) => { setName(e.target.value.slice(0, 120)); setDirty(true); }} disabled={!!orderParam} aria-label="Design name" className="w-full rounded-lg border border-transparent bg-white/5 px-3 py-2 font-display text-sm font-semibold outline-none transition hover:border-white/20 focus:border-copper-400" /></div>
        <span className="hidden font-mono text-[11px] text-paper/50 md:block">{product.name} · {dims.w}×{dims.h} mm · {cfg.material}</span>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button onClick={undo} disabled={!hist.current.past.length} aria-label="Undo" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 transition hover:border-copper-400 disabled:opacity-30"><Undo2 size={17} /></button>
          <button onClick={redo} disabled={!hist.current.future.length} aria-label="Redo" className="grid h-10 w-10 place-items-center rounded-xl border border-white/15 transition hover:border-copper-400 disabled:opacity-30"><Redo2 size={17} /></button>
          <Button variant="light" size="sm" onClick={save} loading={saving} className="!py-2.5"><Save size={15} /><span className="hidden sm:inline">{dirty ? 'Save' : 'Saved'}</span></Button>
          <Button size="sm" onClick={proceed} loading={saving} disabled={check && !check.valid} className="!py-2.5">{orderParam ? 'Save & back' : 'Continue'}<ArrowRight size={15} /></Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[272px_minmax(0,1fr)_340px] lg:overflow-hidden">
        <aside className="hidden overflow-y-auto border-r border-paper-300 bg-paper-100 p-4 lg:block">{ToolsPanel}</aside>

        <main className="relative h-[54dvh] shrink-0 bg-paper-200 p-2 sm:p-4 lg:h-auto">
          <div className="grid-lines-light absolute inset-0" aria-hidden />
          <div className="relative h-full" style={{ perspective: 1400 }}>
            <div className="h-full" style={{ transform: 'rotateX(2deg)', transformOrigin: 'center bottom' }}>
              <EditorCanvas dims={dims} spec={spec} areas={areas} elements={els} background={background} selectedId={selected} invalidIds={invalidIds} assetUrls={assetUrls}
                onSelect={(id) => { setSelected(id); if (id) setTab('edit'); }} onGestureStart={pushHistory} onPatch={patchRaw} />
            </div>
          </div>
          <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-ink-900/80 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-paper backdrop-blur sm:left-5 sm:top-5">{dims.w} × {dims.h} mm · bleed {spec.bleedMm}</div>
          {check && <div className={cx('pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest backdrop-blur sm:right-5 sm:top-5', check.valid && !overflow.length ? 'bg-sage-600/90 text-white' : 'bg-signal-red/90 text-white')}>{check.valid && !overflow.length ? <><CheckCircle2 size={12} />Print-ready</> : <><AlertTriangle size={12} />Needs attention</>}</div>}
        </main>

        <aside className="flex min-h-[40dvh] flex-col border-t border-paper-300 bg-paper-100 lg:min-h-0 lg:border-l lg:border-t-0">
          <div className="no-scrollbar sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-paper-300 bg-paper-100 p-2">
            {TABS.map(([v, l, cls]) => <button key={v} onClick={() => setTab(v)} className={cx('flex-1 whitespace-nowrap rounded-lg px-3 py-2 font-display text-sm font-semibold transition', cls, tab === v ? 'bg-ink-900 text-paper' : 'text-ink-500 hover:bg-paper-200')}>{l}</button>)}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-24 lg:pb-6">
            {tab === 'tools' && <div className="lg:hidden">{ToolsPanel}</div>}
            {tab === 'edit' && <Inspector el={sel} onPatch={patchCommit} onGeom={geom} onDelete={remove} onDuplicate={duplicate} onZ={zorder} background={background} onBackground={(v) => { pushHistory(); setBackground(v); }} />}
            {tab === 'check' && CheckPanel}
            {tab === 'preview' && PreviewPanel}
          </div>
        </aside>
      </div>

      <Modal open={pickOpen} onClose={() => setPickOpen(false)} title="How do you want to start?" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={() => { setPickOpen(false); }} className="group rounded-2xl border border-paper-300 p-5 text-left transition hover:-translate-y-1 hover:border-copper-500 hover:shadow-lift"><Plus className="text-copper-500" /><div className="mt-3 font-display text-lg font-bold">Blank canvas</div><p className="text-sm text-ink-500">Start from scratch at {dims.w}×{dims.h} mm.</p></button>
          {templates.map((t) => <button key={t._id} onClick={() => applyTemplate(t)} className="group rounded-2xl border border-paper-300 p-5 text-left transition hover:-translate-y-1 hover:border-copper-500 hover:shadow-lift"><Wand2 className="text-sage-500" /><div className="mt-3 font-display text-lg font-bold">{t.name}</div><p className="text-sm text-ink-500">Template · {t.group}</p></button>)}
        </div>
      </Modal>
    </div>
  );
}
