import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errorText } from '../../lib/api';
import { Badge, Button, ErrorBox, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, cx } from '../../components/ui';
import { ResponsiveTable } from '../../components/AdminParts';
import { money } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../lib/hooks';

const rs = (minor) => (minor ?? 0) / 100; // minor units -> rupees for editing
const mn = (v) => Math.round((Number(v) || 0) * 100);

function ProductEditor({ product, onClose }) {
  const toast = useToast(); const qc = useQueryClient();
  const [f, setF] = useState(null); const [err, setErr] = useState('');
  useEffect(() => {
    if (!product) return;
    setErr(''); setF({
      name: product.name, description: product.description || '', active: product.active,
      base: rs(product.pricing.basePerUnitMinor), cm2: rs(product.pricing.pricePerCm2Minor), minUnit: rs(product.pricing.minUnitPriceMinor), setup: rs(product.pricing.setupFeeMinor),
      tiers: product.pricing.volumeTiers.map((t) => ({ ...t })), qmin: product.quantity.min, qmax: product.quantity.max,
      bleed: product.printSpec.bleedMm, safe: product.printSpec.safeMarginMm, dpi: product.printSpec.dpi,
      materials: product.materials.map((m) => ({ key: m.key, label: m.label, multiplier: m.multiplier, surcharge: rs(m.surchargeMinor), active: m.active !== false })),
    });
  }, [product]);
  const save = useMutation({
    mutationFn: () => api.put(`/api/admin/products/${product._id}`, {
      name: f.name, description: f.description, active: f.active,
      pricing: { basePerUnitMinor: mn(f.base), pricePerCm2Minor: Math.round(Number(f.cm2) * 100 * 1000) / 1000, minUnitPriceMinor: mn(f.minUnit), setupFeeMinor: mn(f.setup), volumeTiers: f.tiers.map((t) => ({ minQty: Number(t.minQty), discountPct: Number(t.discountPct) })) },
      quantity: { min: Number(f.qmin), max: Number(f.qmax), step: product.quantity.step || 1 },
      printSpec: { bleedMm: Number(f.bleed), safeMarginMm: Number(f.safe), dpi: Number(f.dpi) },
      materials: f.materials.map((m) => ({ key: m.key, label: m.label, multiplier: Number(m.multiplier), surchargeMinor: mn(m.surcharge), active: m.active })),
    }),
    onSuccess: () => { toast.success('Product updated - prices are live immediately.'); qc.invalidateQueries({ queryKey: ['a-products'] }); qc.invalidateQueries({ queryKey: ['products'] }); onClose(); },
    onError: (e) => setErr(errorText(e)),
  });
  if (!f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const num = (k, label, hint) => <Field label={label} hint={hint}><Input inputMode="decimal" value={f[k]} onChange={set(k)} /></Field>;
  return (
    <Modal open={!!product} onClose={onClose} wide title={`Edit: ${product.name}`} footer={<><Button variant="light" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button></>}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Name"><Input value={f.name} onChange={set('name')} /></Field><label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" className="h-4 w-4 accent-copper-500" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Visible in the shop</label><Field label="Description" className="sm:col-span-2"><Textarea value={f.description} onChange={set('description')} /></Field></div>
        <section><h4 className="label">Pricing (rupees, tax-exclusive)</h4><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{num('base', 'Base / unit')}{num('cm2', 'Per cm²')}{num('minUnit', 'Min unit price')}{num('setup', 'Setup fee')}</div>
          <p className="mt-2 text-xs text-ink-500">Unit = max(min, base + area × per-cm² × material multiplier + surcharge)</p></section>
        <section><div className="mb-2 flex items-center justify-between"><h4 className="label !mb-0">Volume discounts</h4><button className="font-display text-xs font-semibold text-copper-600" onClick={() => setF({ ...f, tiers: [...f.tiers, { minQty: 100, discountPct: 5 }] })}>+ tier</button></div>
          <div className="space-y-2">{f.tiers.map((t, i) => <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"><Field label={i === 0 ? 'From qty' : ''}><Input inputMode="numeric" value={t.minQty} onChange={(e) => setF({ ...f, tiers: f.tiers.map((x, j) => (j === i ? { ...x, minQty: e.target.value } : x)) })} /></Field><Field label={i === 0 ? 'Discount %' : ''}><Input inputMode="decimal" value={t.discountPct} onChange={(e) => setF({ ...f, tiers: f.tiers.map((x, j) => (j === i ? { ...x, discountPct: e.target.value } : x)) })} /></Field><button className="mb-2 grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-signal-red/10 hover:text-signal-red" aria-label="Remove tier" onClick={() => setF({ ...f, tiers: f.tiers.filter((_, j) => j !== i) })}><Trash2 size={15} /></button></div>)}</div></section>
        <section><h4 className="label">Quantity &amp; print spec</h4><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{num('qmin', 'Min qty')}{num('qmax', 'Max qty')}{num('bleed', 'Bleed mm')}{num('safe', 'Safe mm')}{num('dpi', 'DPI')}</div></section>
        <section><h4 className="label">Materials</h4><div className="space-y-2">{f.materials.map((m, i) => { const up = (patch) => setF({ ...f, materials: f.materials.map((x, j) => (j === i ? { ...x, ...patch } : x)) }); return (
          <div key={m.key} className="grid grid-cols-2 items-end gap-2 rounded-xl border border-paper-300 p-3 sm:grid-cols-[1.2fr_1fr_1fr_auto]"><Field label="Label"><Input value={m.label} onChange={(e) => up({ label: e.target.value })} /></Field><Field label="Multiplier"><Input inputMode="decimal" value={m.multiplier} onChange={(e) => up({ multiplier: e.target.value })} /></Field><Field label="Surcharge ₹"><Input inputMode="decimal" value={m.surcharge} onChange={(e) => up({ surcharge: e.target.value })} /></Field><label className="mb-2.5 flex items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4 accent-copper-500" checked={m.active} onChange={(e) => up({ active: e.target.checked })} />active</label></div>); })}</div></section>
        {err && <p className="rounded-xl border border-signal-red/30 bg-signal-red/5 p-3 text-sm text-signal-red">{err}</p>}
      </div>
    </Modal>
  );
}

const TEMPLATE_JSON = (divId) => JSON.stringify({
  division: divId, slug: 'new-product', name: 'New Product', productType: 'new-product', description: 'Describe the product',
  sizing: { mode: 'both', presets: [{ key: 'm50', label: '50 x 50 mm', widthMm: 50, heightMm: 50 }], minMm: 20, maxWidthMm: 300, maxHeightMm: 300 },
  materials: [{ key: 'standard', label: 'Standard', multiplier: 1, surchargeMinor: 0 }], orientations: ['landscape', 'portrait'],
  quantity: { min: 1, max: 1000 }, supportsVariableData: false,
  pricing: { basePerUnitMinor: 1000, pricePerCm2Minor: 10, minUnitPriceMinor: 1000, setupFeeMinor: 0, volumeTiers: [{ minQty: 100, discountPct: 5 }] },
  printSpec: { bleedMm: 3, safeMarginMm: 3, dpi: 300 },
}, null, 2);

export default function AdminCatalogue() {
  usePageTitle('Catalogue');
  const toast = useToast(); const qc = useQueryClient();
  const [tab, setTab] = useState('products');
  const [edit, setEdit] = useState(null); const [newOpen, setNewOpen] = useState(false); const [json, setJson] = useState(''); const [jerr, setJerr] = useState('');
  const [divOpen, setDivOpen] = useState(false); const [df, setDf] = useState({ slug: '', name: '', tagline: '', description: '' }); const [derr, setDerr] = useState('');
  const [gOpen, setGOpen] = useState(false); const [gf, setGf] = useState({ division: '', title: '', caption: '', imageUrl: '' }); const [gerr, setGerr] = useState('');

  const prods = useQuery({ queryKey: ['a-products'], queryFn: () => api.get('/api/admin/products') });
  const divs = useQuery({ queryKey: ['a-divisions'], queryFn: () => api.get('/api/admin/divisions') });
  const gal = useQuery({ queryKey: ['a-gallery'], queryFn: () => api.get('/api/admin/gallery'), enabled: tab === 'gallery' });
  const inval = (k) => { qc.invalidateQueries({ queryKey: [k] }); qc.invalidateQueries({ queryKey: ['divisions'] }); qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['gallery'] }); };
  const toggle = useMutation({ mutationFn: ({ path, id, active }) => api.put(`/api/admin/${path}/${id}`, { active }), onSuccess: (_, v) => { inval(v.key); }, onError: (e) => toast.error(errorText(e)) });
  const del = useMutation({ mutationFn: ({ path, id }) => api.del(`/api/admin/${path}/${id}`), onSuccess: (_, v) => { toast.success('Removed.'); inval(v.key); }, onError: (e) => toast.error(errorText(e)) });

  const createProduct = async () => { setJerr(''); try { await api.post('/api/admin/products', JSON.parse(json)); toast.success('Product created.'); setNewOpen(false); inval('a-products'); } catch (e) { setJerr(e instanceof SyntaxError ? `Invalid JSON: ${e.message}` : `${errorText(e)}${e.details ? ' - ' + e.details.map((d) => `${d.path}: ${d.message}`).slice(0, 4).join('; ') : ''}`); } };
  const createDiv = async () => { setDerr(''); try { await api.post('/api/admin/divisions', { slug: df.slug, name: df.name, tagline: df.tagline || undefined, description: df.description || undefined, sortOrder: (divs.data?.length || 0) + 1 }); toast.success('Division created.'); setDivOpen(false); setDf({ slug: '', name: '', tagline: '', description: '' }); inval('a-divisions'); } catch (e) { setDerr(errorText(e)); } };
  const createG = async () => { setGerr(''); try { await api.post('/api/admin/gallery', gf); toast.success('Gallery item added.'); setGOpen(false); setGf({ division: '', title: '', caption: '', imageUrl: '' }); inval('a-gallery'); } catch (e) { setGerr(errorText(e)); } };

  return (
    <>
      <PageHeader kicker="Catalogue" title="Products &" accent="divisions." actions={
        tab === 'products' ? <Button onClick={() => { setJson(TEMPLATE_JSON(divs.data?.[0]?._id || '')); setJerr(''); setNewOpen(true); }}><Plus size={16} />New product</Button>
          : tab === 'divisions' ? <Button onClick={() => setDivOpen(true)}><Plus size={16} />New division</Button> : <Button onClick={() => { setGf({ ...gf, division: divs.data?.[0]?._id || '' }); setGOpen(true); }}><Plus size={16} />Add item</Button>} />
      <Tabs className="mb-6 max-w-md" value={tab} onChange={setTab} tabs={[{ value: 'products', label: 'Products', count: prods.data?.length }, { value: 'divisions', label: 'Divisions', count: divs.data?.length }, { value: 'gallery', label: 'Gallery' }]} />
      {(prods.error || divs.error) && <ErrorBox error={prods.error || divs.error} />}

      {tab === 'products' && <ResponsiveTable loading={prods.isLoading} rows={prods.data} columns={[
        { key: 'n', label: 'Product', render: (p) => <><div className="text-sm font-semibold">{p.name}</div><div className="font-mono text-[11px] text-ink-500">{p.slug}</div></> },
        { key: 'd', label: 'Division', render: (p) => <span className="text-xs">{p.division?.name}</span> },
        { key: 'p', label: 'Base / cm²', render: (p) => <span className="font-mono text-xs">{money(p.pricing.basePerUnitMinor)} / {(p.pricing.pricePerCm2Minor / 100).toFixed(2)}</span> },
        { key: 'm', label: 'Materials', render: (p) => p.materials.length },
        { key: 't', label: 'Tiers', render: (p) => p.pricing.volumeTiers.map((t) => `${t.minQty}+:${t.discountPct}%`).join('  ') || '-' },
        { key: 'a', label: 'Shop', render: (p) => <button onClick={() => toggle.mutate({ path: 'products', id: p._id, active: !p.active, key: 'a-products' })}><Badge tone={p.active ? 'bg-sage-100 text-sage-700 border-sage-300' : 'bg-paper-200 text-ink-500 border-paper-300'}>{p.active ? 'live' : 'hidden'}</Badge></button> },
        { key: 'actions', label: 'Actions', render: (p) => <Button size="sm" variant="light" onClick={() => setEdit(p)}><Pencil size={13} />Edit</Button> },
      ]} />}
      {tab === 'divisions' && <ResponsiveTable loading={divs.isLoading} rows={divs.data} columns={[
        { key: 'n', label: 'Division', render: (d) => <><div className="text-sm font-semibold">{d.name}</div><div className="font-mono text-[11px] text-ink-500">{d.slug}</div></> },
        { key: 't', label: 'Tagline', render: (d) => <span className="text-xs">{d.tagline || '-'}</span> }, { key: 'o', label: 'Order', render: (d) => d.sortOrder },
        { key: 'a', label: 'Visible', render: (d) => <button onClick={() => toggle.mutate({ path: 'divisions', id: d._id, active: !d.active, key: 'a-divisions' })}><Badge tone={d.active ? 'bg-sage-100 text-sage-700 border-sage-300' : 'bg-paper-200 text-ink-500 border-paper-300'}>{d.active ? 'live' : 'hidden'}</Badge></button> },
      ]} />}
      {tab === 'gallery' && <ResponsiveTable loading={gal.isLoading} rows={gal.data?.filter((g) => g.active)} columns={[
        { key: 'i', label: 'Item', render: (g) => <div className="flex items-center gap-3"><img src={g.imageUrl} alt="" className="h-12 w-16 rounded-lg object-cover" onError={(e) => { e.currentTarget.style.opacity = 0; }} /><div><div className="text-sm font-semibold">{g.title}</div><div className="text-xs text-ink-500">{g.caption}</div></div></div> },
        { key: 'd', label: 'Division', render: (g) => <span className="text-xs">{g.division?.name}</span> },
        { key: 'actions', label: 'Actions', render: (g) => <Button size="sm" variant="light" onClick={() => del.mutate({ path: 'gallery', id: g._id, key: 'a-gallery' })}><Trash2 size={13} />Remove</Button> },
      ]} />}

      <ProductEditor product={edit} onClose={() => setEdit(null)} />
      <Modal open={newOpen} onClose={() => setNewOpen(false)} wide title="New product (JSON)" footer={<><Button variant="light" onClick={() => setNewOpen(false)}>Cancel</Button><Button onClick={createProduct}>Create product</Button></>}>
        <p className="mb-3 text-sm text-ink-500">Prices are in <b>minor units</b> (paise: 100 = ₹1). The first division id is pre-filled - change it if needed. Sizes and materials are parameters, never one product per size.</p>
        <Textarea value={json} onChange={(e) => setJson(e.target.value)} className="min-h-[320px] font-mono !text-xs" spellCheck={false} aria-label="Product JSON" />
        {divs.data && <p className="mt-2 font-mono text-[10px] text-ink-500">Division ids: {divs.data.map((d) => `${d.slug}=${d._id}`).join(' · ')}</p>}
        {jerr && <p className="mt-3 rounded-xl border border-signal-red/30 bg-signal-red/5 p-3 text-sm text-signal-red">{jerr}</p>}
      </Modal>
      <Modal open={divOpen} onClose={() => setDivOpen(false)} title="New division" footer={<><Button variant="light" onClick={() => setDivOpen(false)}>Cancel</Button><Button onClick={createDiv}>Create</Button></>}>
        <div className="space-y-4"><Field label="Name"><Input value={df.name} onChange={(e) => setDf({ ...df, name: e.target.value, slug: df.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} /></Field><Field label="Slug" hint="lowercase-with-dashes"><Input value={df.slug} onChange={(e) => setDf({ ...df, slug: e.target.value })} /></Field><Field label="Tagline"><Input value={df.tagline} onChange={(e) => setDf({ ...df, tagline: e.target.value })} /></Field><Field label="Description"><Textarea value={df.description} onChange={(e) => setDf({ ...df, description: e.target.value })} /></Field>{derr && <p className="text-sm text-signal-red">{derr}</p>}</div>
      </Modal>
      <Modal open={gOpen} onClose={() => setGOpen(false)} title="Add gallery item" footer={<><Button variant="light" onClick={() => setGOpen(false)}>Cancel</Button><Button onClick={createG}>Add</Button></>}>
        <div className="space-y-4"><Field label="Division"><Select value={gf.division} onChange={(e) => setGf({ ...gf, division: e.target.value })}>{divs.data?.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</Select></Field><Field label="Title"><Input value={gf.title} onChange={(e) => setGf({ ...gf, title: e.target.value })} /></Field><Field label="Caption"><Input value={gf.caption} onChange={(e) => setGf({ ...gf, caption: e.target.value })} /></Field><Field label="Image URL"><Input value={gf.imageUrl} onChange={(e) => setGf({ ...gf, imageUrl: e.target.value })} placeholder="https://…" /></Field>{gerr && <p className="text-sm text-signal-red">{gerr}</p>}</div>
      </Modal>
    </>
  );
}
