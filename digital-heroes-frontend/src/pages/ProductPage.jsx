import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ArrowRight, FileSpreadsheet, Palette, Sparkles, Upload } from 'lucide-react';
import { PageBand } from '../components/layout/Layouts';
import { PriceBreakdown } from '../components/Shared';
import { PriceNumber, QtyStepper, SizePreview } from '../components/CatalogueParts';
import { Badge, Button, ErrorBox, Field, Input, Reveal, Skeleton, Tilt, cx } from '../components/ui';
import { api, errorText } from '../lib/api';
import { cfgToQuery, resolveSize, toApiConfig } from '../lib/size';
import { useQuote } from '../lib/useQuote';
import { usePageTitle } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { materialTint, metaFor } from '../lib/meta';
import { num } from '../lib/format';

export default function ProductPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['product', slug], queryFn: () => api.get(`/api/products/${slug}`) });
  const product = data?.product;
  usePageTitle(product?.name);

  const [cfg, setCfg] = useState(null);
  const [qty, setQty] = useState('100');
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!product) return;
    const s = product.sizing; const p0 = s.presets?.[0];
    const base = { material: product.materials.find((m) => m.active !== false)?.key, orientation: product.orientations[0] };
    if (p0 && s.mode !== 'custom') { setCustom(false); setCfg({ ...base, sizeKey: p0.key }); }
    else { setCustom(true); setCfg({ ...base, widthMm: Math.min(s.maxWidthMm, Math.max(s.minMm, 100)), heightMm: Math.min(s.maxHeightMm, Math.max(s.minMm, 60)) }); }
    setQty(String(Math.min(product.quantity.max, Math.max(product.quantity.min, 100))));
  }, [product]);

  const { data: q, error: qErr, isFetching } = useQuote(slug, cfg, qty, !!product && !!cfg);
  const pr = q?.pricing;
  const size = useMemo(() => (product && cfg ? resolveSize(product, cfg) : null), [product, cfg]);
  const m = metaFor(product?.division?.slug);

  const setSize = (key) => { setCustom(false); setCfg((c) => ({ ...c, sizeKey: key, widthMm: undefined, heightMm: undefined })); };
  const goCustom = () => { const s = product.sizing; setCustom(true); setCfg((c) => ({ ...c, sizeKey: undefined, widthMm: size?.widthMm || 100, heightMm: size?.heightMm || Math.min(60, s.maxHeightMm) })); };
  const canOrder = !!pr && !qErr;

  const designUrl = `/designer/${slug}?${cfg ? cfgToQuery(cfg, qty) : ''}`;
  const goDesign = () => { if (!canOrder) return; if (!user) { toast.info('Log in to start designing - your options are kept.'); nav('/login', { state: { from: designUrl } }); return; } nav(designUrl); };
  const pickFile = () => { if (!canOrder) return; if (!user) { toast.info('Log in to upload your artwork.'); nav('/login', { state: { from: loc.pathname } }); return; } fileRef.current?.click(); };

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const apiCfg = toApiConfig(cfg);
      const { design } = await api.post('/api/designs', { name: (file.name.replace(/\.[^.]+$/, '') || 'Uploaded artwork').slice(0, 100), product: product._id, config: apiCfg, elements: [] });
      await api.upload(`/api/designs/${design._id}/artwork`, file);
      const { order } = await api.post('/api/orders', { product: product.slug, config: apiCfg, quantity: Number(qty), design: design._id });
      toast.success('Artwork uploaded - review your quote.');
      nav(`/orders/${order._id}`);
    } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  if (error) return <div className="container-x py-24"><ErrorBox error={error} retry={refetch} /></div>;
  const tiers = product ? [{ minQty: 1, discountPct: 0 }, ...product.pricing.volumeTiers] : [];
  const curDisc = pr?.discountPct ?? 0;

  return (
    <>
      <PageBand>
        <Link to={product ? `/division/${product.division.slug}` : '/products'} className="inline-flex items-center gap-2 text-sm text-paper/60 hover:text-copper-300"><ArrowLeft size={15} />{product?.division?.name || 'Products'}</Link>
        <div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold sm:text-5xl">{product?.name || <span className="skeleton inline-block h-10 w-72 !bg-white/10" />}</h1>{product?.supportsVariableData && <Badge tone="border-sage-400/40 bg-sage-500/15 text-sage-300">CSV bulk merge</Badge>}</div>
        {product?.description && <p className="mt-3 max-w-2xl text-paper/65">{product.description}</p>}
      </PageBand>

      <div className="container-x grid gap-8 py-10 pb-32 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:pb-16">
        {/* ------------------------------------------------ left: sheet preview, tiers, spec */}
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Tilt max={4} className="rounded-3xl"><div className="card crop grid-lines-light relative overflow-hidden rounded-3xl p-4 sm:p-8">
            <div className="absolute left-4 top-4 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} /><span className="label !mb-0">Live size preview</span></div>
            <div className="min-h-[300px] pt-6">{isLoading || !size ? <Skeleton className="mx-auto mt-10 h-48 w-72" /> : <SizePreview w={size.widthMm} h={size.heightMm} material={cfg.material} label={product.productType} />}</div>
            {product && <div className="mt-2 grid grid-cols-3 gap-2 border-t border-paper-300 pt-4 text-center">
              {[['Bleed', `${product.printSpec.bleedMm} mm`], ['Safe margin', `${product.printSpec.safeMarginMm} mm`], ['Resolution', `${product.printSpec.dpi} DPI`]].map(([k, v]) => <div key={k}><div className="label !mb-0.5">{k}</div><div className="font-mono text-sm font-semibold">{v}</div></div>)}
            </div>}
          </div></Tilt>

          {product && (
            <Reveal><div className="card p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-lg font-bold">Volume discounts</h3><Badge tone="bg-sage-100 text-sage-700 border-sage-300">Automatic</Badge></div>
              <ul className="space-y-2.5">{tiers.map((t, i) => {
                const nxt = tiers[i + 1]; const on = curDisc === t.discountPct;
                return (<li key={t.minQty} className={cx('flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition', on ? 'border-copper-500 bg-copper-50' : 'border-paper-300')}>
                  <span className="w-28 font-mono text-xs text-ink-500">{nxt ? `${num(t.minQty)} – ${num(nxt.minQty - 1)}` : `${num(t.minQty)}+`}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-300"><span className="block h-full rounded-full bg-copper-500 transition-all duration-700" style={{ width: `${Math.min(100, t.discountPct * 4)}%` }} /></span>
                  <span className={cx('w-14 text-right font-mono font-semibold', on && 'text-copper-600')}>{t.discountPct ? `-${t.discountPct}%` : 'list'}</span></li>);
              })}</ul>
            </div></Reveal>
          )}
        </div>

        {/* ------------------------------------------------ right: configurator */}
        <div className="space-y-5">
          {(isLoading || !cfg) ? <Skeleton className="h-[520px]" /> : (
            <div className="card space-y-7 p-5 sm:p-7">
              <section aria-labelledby="size-h">
                <div className="mb-3 flex items-center justify-between"><h2 id="size-h" className="font-display text-lg font-bold">1. Size</h2>{size && <span className="font-mono text-xs text-ink-500">{size.widthMm} × {size.heightMm} mm</span>}</div>
                <div className="flex flex-wrap gap-2">
                  {product.sizing.mode !== 'custom' && product.sizing.presets.map((s) => <button key={s.key} onClick={() => setSize(s.key)} className={cx('chip', !custom && cfg.sizeKey === s.key && 'chip-on')} aria-pressed={!custom && cfg.sizeKey === s.key}>{s.label}</button>)}
                  {product.sizing.mode !== 'fixed' && <button onClick={goCustom} className={cx('chip', custom && 'chip-on')} aria-pressed={custom}>Custom size</button>}
                </div>
                {custom && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Field label="Width (mm)"><Input inputMode="numeric" value={cfg.widthMm ?? ''} onChange={(e) => setCfg({ ...cfg, widthMm: e.target.value.replace(/\D/g, '') })} /></Field>
                    <Field label="Height (mm)"><Input inputMode="numeric" value={cfg.heightMm ?? ''} onChange={(e) => setCfg({ ...cfg, heightMm: e.target.value.replace(/\D/g, '') })} /></Field>
                    <p className="col-span-2 -mt-1 text-xs text-ink-500">Min {product.sizing.minMm} mm · max {product.sizing.maxWidthMm} × {product.sizing.maxHeightMm} mm</p>
                  </div>
                )}
              </section>

              {product.orientations.length > 1 && (
                <section><h2 className="mb-3 font-display text-lg font-bold">2. Orientation</h2>
                  <div className="inline-flex rounded-xl border border-paper-300 bg-paper-200/60 p-1">{product.orientations.map((o) => <button key={o} onClick={() => setCfg({ ...cfg, orientation: o })} className={cx('rounded-lg px-5 py-2 font-display text-sm font-semibold capitalize transition', cfg.orientation === o ? 'bg-ink-900 text-paper shadow' : 'text-ink-500')} aria-pressed={cfg.orientation === o}>{o}</button>)}</div></section>
              )}

              <section><h2 className="mb-3 font-display text-lg font-bold">{product.orientations.length > 1 ? '3' : '2'}. Material</h2>
                <div className="grid gap-2.5 sm:grid-cols-2">{product.materials.filter((x) => x.active !== false).map((mt) => { const [a, b] = materialTint(mt.key); const on = cfg.material === mt.key; return (
                  <button key={mt.key} onClick={() => setCfg({ ...cfg, material: mt.key })} aria-pressed={on} className={cx('group flex items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5', on ? 'border-copper-500 bg-copper-50 shadow-glow' : 'border-paper-300 bg-white/50 hover:border-copper-300')}>
                    <span className="h-10 w-10 shrink-0 rounded-lg border border-black/10 shadow-inner transition-transform group-hover:rotate-6" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} /><span className="min-w-0 flex-1 truncate font-display text-sm font-semibold">{mt.label}</span></button>); })}</div></section>

              <section><h2 className="mb-3 font-display text-lg font-bold">{product.orientations.length > 1 ? '4' : '3'}. Quantity</h2>
                {product.supportsVariableData && <p className="mb-3 flex items-start gap-2 rounded-xl bg-sage-50 px-3 py-2 text-xs text-sage-700"><FileSpreadsheet size={14} className="mt-0.5 shrink-0" />With a CSV, quantity becomes the number of rows - you upload it after creating your quote.</p>}
                <QtyStepper value={qty} onChange={setQty} min={product.quantity.min} max={product.quantity.max} step={product.quantity.step || 1} />
                <div className="mt-3 flex flex-wrap gap-2">{[product.quantity.min, ...(product.pricing.volumeTiers || []).map((t) => t.minQty)].filter((v, i, a) => v <= product.quantity.max && a.indexOf(v) === i).map((v) => <button key={v} className={cx('chip font-mono', Number(qty) === v && 'chip-on')} onClick={() => setQty(String(v))}>{num(v)}</button>)}</div>
                <p className="mt-2 text-xs text-ink-500">Min {num(product.quantity.min)} · max {num(product.quantity.max)}</p>
              </section>
            </div>
          )}

          {/* price card */}
          <Tilt max={4} className="rounded-3xl"><div className="on-dark relative overflow-hidden rounded-3xl border border-ink-600 bg-ink-800 p-6 text-paper sm:p-7">
            <div className="halftone pointer-events-none absolute -right-8 -top-8 h-48 w-48 text-copper-500/10" aria-hidden />
            <div className="relative">
              <div className="flex items-center justify-between"><span className="label !mb-0 !text-paper/50">Total {pr && `· incl. ${pr.taxName}`}</span>{curDisc > 0 && <span className="rounded-full bg-copper-500 px-3 py-1 font-mono text-xs font-bold text-white">-{curDisc}%</span>}</div>
              {qErr ? <p className="mt-3 flex items-start gap-2 text-sm text-copper-300"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{qErr.message}</p> : (
                <><div className={cx('mt-2 font-display text-5xl font-bold tracking-tight transition-opacity sm:text-6xl', isFetching && 'opacity-60')}><PriceNumber minor={pr?.totalMinor} currency={pr?.currency} /></div>
                  {q?.nextTier && <p className="mt-3 flex items-center gap-2 text-xs text-paper/75"><Sparkles size={14} className="shrink-0 text-copper-400" />Add {num(q.nextTier.unitsToUnlock)} more units to save {q.nextTier.discountPct}%</p>}
                  <details className="group mt-5 border-t border-white/10 pt-4"><summary className="cursor-pointer list-none font-mono text-xs uppercase tracking-widest text-paper/60 hover:text-paper">Price breakdown <span className="inline-block transition group-open:rotate-180">⌄</span></summary><div className="mt-4 text-paper [&_.text-ink-500]:text-paper/60 [&_.border-paper-300]:border-white/10"><PriceBreakdown pricing={pr} quantity={Number(qty)} /></div></details></>
              )}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Button onClick={goDesign} disabled={!canOrder} className="w-full"><Palette size={17} />Design online</Button>
                <Button variant="light" onClick={pickFile} disabled={!canOrder} loading={busy} className="w-full"><Upload size={17} />Upload artwork</Button>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.svg,.ai,.png,.jpg,.jpeg" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
              <p className="mt-3 text-center text-[11px] text-paper/45">PDF, SVG, AI or PNG up to 25 MB · you approve a proof before anything is printed</p>
            </div>
          </div></Tilt>
        </div>
      </div>

      {/* mobile sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-600 bg-ink-900/95 px-4 py-3 backdrop-blur-xl lg:hidden safe-b on-dark">
        <div className="mx-auto flex max-w-lg items-center gap-4">
          <div className="min-w-0 flex-1"><div className="font-mono text-[10px] uppercase tracking-widest text-paper/50">Total incl. tax</div><div className="truncate font-display text-xl font-bold text-paper">{pr ? <PriceNumber minor={pr.totalMinor} currency={pr.currency} /> : '—'}</div></div>
          <Button onClick={goDesign} disabled={!canOrder}>Design <ArrowRight size={16} /></Button>
        </div>
      </div>
    </>
  );
}
