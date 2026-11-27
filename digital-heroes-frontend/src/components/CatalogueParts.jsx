import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Minus, Plus, Ruler, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { metaFor, materialTint } from '../lib/meta';
import { Badge, Button, ErrorBox, Reveal, Select, Skeleton, Tilt, cx } from './ui';
import { money, num } from '../lib/format';
import { useTween } from '../lib/hooks';
import { useQuote } from '../lib/useQuote';

/* ---------------------------------------------------------------- division hub: six equal-weight 3D tiles */
export function DivisionHub() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['divisions'], queryFn: () => api.get('/api/divisions') });
  if (error) return <ErrorBox error={error} retry={refetch} />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
      {data?.map((d, i) => {
        const m = metaFor(d.slug, i); const Icon = m.icon;
        return (
          <Reveal key={d._id} delay={(i % 3) * .08}>
            <Tilt className="h-full rounded-2xl" max={9}>
              <Link to={`/division/${d.slug}`} className="card group crop relative flex h-full min-h-[210px] flex-col overflow-hidden p-6 text-ink-900">
                <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: m.color }} />
                <span className="absolute -right-3 -top-4 font-display text-[110px] font-bold leading-none text-ink-900/[.04]" aria-hidden>{m.no}</span>
                <div className="z-pop-sm grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-6deg]" style={{ background: m.color, boxShadow: `0 14px 24px -10px ${m.color}` }}><Icon size={26} /></div>
                <h3 className="mt-5 text-xl font-bold">{d.name}</h3>
                <p className="mt-1.5 text-sm text-ink-500">{d.tagline || d.description}</p>
                <div className="mt-auto flex items-center justify-between pt-5">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-ink-500">{d.productCount} {d.productCount === 1 ? 'product' : 'products'}</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-paper-400 transition group-hover:border-copper-500 group-hover:bg-copper-500 group-hover:text-white"><ArrowUpRight size={16} /></span>
                </div>
              </Link>
            </Tilt>
          </Reveal>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- product card */
export function ProductCard({ p }) {
  const m = metaFor(p.division?.slug);
  const Icon = m.icon;
  return (
    <Tilt className="h-full rounded-2xl" max={7}>
      <Link to={`/products/${p.slug}`} className="card group flex h-full flex-col p-5">
        <div className="flex items-center justify-between">
          <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: m.color }}><Icon size={20} /></span>
          {p.supportsVariableData && <Badge tone="bg-sage-100 text-sage-700 border-sage-300">CSV bulk</Badge>}
        </div>
        <h3 className="mt-4 text-lg font-bold">{p.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-ink-500">{p.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-paper-300 pt-4 text-xs">
          <div><dt className="label !mb-0.5">Materials</dt><dd className="font-semibold">{p.materials?.length}</dd></div>
          <div><dt className="label !mb-0.5">From qty</dt><dd className="font-semibold">{num(p.quantity?.min)}</dd></div>
        </dl>
        <span className="mt-4 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-copper-600">Configure <ArrowRight size={15} className="transition group-hover:translate-x-1" /></span>
      </Link>
    </Tilt>
  );
}

/* ---------------------------------------------------------------- compact quantity stepper */
export function QtyStepper({ value, onChange, min = 1, max = 100000, step = 1 }) {
  const clamp = (v) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-paper-300 bg-white/80 shadow-inner focus-within:border-copper-500 focus-within:ring-4 focus-within:ring-copper-500/15">
      <button type="button" className="px-3.5 text-ink-500 transition hover:bg-paper-200 hover:text-copper-600" onClick={() => onChange(clamp((Number(value) || min) - Math.max(step, value >= 500 ? 100 : value >= 100 ? 25 : step)))} aria-label="Decrease"><Minus size={16} /></button>
      <input inputMode="numeric" className="w-full min-w-0 bg-transparent py-2.5 text-center font-mono text-base font-semibold outline-none" value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))} onBlur={() => onChange(clamp(Number(value) || min))} aria-label="Quantity" />
      <button type="button" className="px-3.5 text-ink-500 transition hover:bg-paper-200 hover:text-copper-600" onClick={() => onChange(clamp((Number(value) || 0) + Math.max(step, value >= 500 ? 100 : value >= 100 ? 25 : step)))} aria-label="Increase"><Plus size={16} /></button>
    </div>
  );
}

/* ---------------------------------------------------------------- big animated price */
export function PriceNumber({ minor, currency, className }) {
  const v = useTween(minor || 0);
  return <span className={cx('tabular-nums', className)}>{money(Math.round(v), currency)}</span>;
}

/* ---------------------------------------------------------------- homepage instant price calculator */
export function PriceCalculator() {
  const nav = useNavigate();
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => api.get('/api/products') });
  const [slug, setSlug] = useState('');
  const [cfg, setCfg] = useState(null);
  const [qty, setQty] = useState('100');
  const product = useMemo(() => products?.find((p) => p.slug === slug), [products, slug]);

  useEffect(() => { if (products?.length && !slug) setSlug((products.find((p) => p.slug === 'custom-stickers') || products[0]).slug); }, [products, slug]);
  useEffect(() => {
    if (!product) return;
    const s = product.sizing; const p0 = s.presets?.[0];
    setCfg(p0 && s.mode !== 'custom' ? { sizeKey: p0.key, material: product.materials[0].key, orientation: product.orientations[0] } : { widthMm: 100, heightMm: 60, material: product.materials[0].key, orientation: product.orientations[0] });
    setQty(String(Math.max(product.quantity.min, 100)));
  }, [product]);

  const { data: q, error, isFetching } = useQuote(slug, cfg, qty, !!product);
  const pr = q?.pricing;
  const tint = cfg ? materialTint(cfg.material) : ['#fff', '#eee'];

  return (
    <div className="on-dark relative overflow-hidden rounded-[28px] border border-ink-600 bg-ink-800 p-5 text-paper shadow-2xl sm:p-8">
      <div className="halftone pointer-events-none absolute -right-10 -top-10 h-64 w-64 text-copper-500/10" aria-hidden />
      <div className="relative grid gap-8 lg:grid-cols-[1fr_1.05fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-2"><span className="kicker-dark kicker">Instant price</span><Badge tone="border-sage-400/40 bg-sage-500/15 text-sage-300">Live</Badge></div>
          <div>
            <label className="label !text-paper/50">Product</label>
            <Select value={slug} onChange={(e) => setSlug(e.target.value)} className="!border-ink-600 !bg-ink-700 !text-paper">{products?.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</Select>
          </div>
          {product && cfg && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label !text-paper/50">Size</label>
                  {product.sizing.mode !== 'custom' && product.sizing.presets?.length
                    ? <Select value={cfg.sizeKey || ''} onChange={(e) => setCfg({ ...cfg, sizeKey: e.target.value, widthMm: undefined, heightMm: undefined })} className="!border-ink-600 !bg-ink-700 !text-paper">{product.sizing.presets.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select>
                    : <div className="flex items-center gap-1.5"><input className="input !border-ink-600 !bg-ink-700 !px-2 text-center !text-paper" inputMode="numeric" value={cfg.widthMm || ''} onChange={(e) => setCfg({ ...cfg, widthMm: e.target.value.replace(/\D/g, '') })} aria-label="Width mm" /><span className="text-paper/40">×</span><input className="input !border-ink-600 !bg-ink-700 !px-2 text-center !text-paper" inputMode="numeric" value={cfg.heightMm || ''} onChange={(e) => setCfg({ ...cfg, heightMm: e.target.value.replace(/\D/g, '') })} aria-label="Height mm" /></div>}
                </div>
                <div>
                  <label className="label !text-paper/50">Material</label>
                  <Select value={cfg.material} onChange={(e) => setCfg({ ...cfg, material: e.target.value })} className="!border-ink-600 !bg-ink-700 !text-paper">{product.materials.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</Select>
                </div>
              </div>
              <div>
                <label className="label !text-paper/50">Quantity</label>
                <QtyStepper value={qty} onChange={setQty} min={product.quantity.min} max={product.quantity.max} step={product.quantity.step || 1} />
                <input type="range" className="mt-3 w-full accent-copper-500" min={product.quantity.min} max={Math.min(product.quantity.max, 2000)} step={Math.max(1, product.quantity.step || 1)} value={Math.min(Number(qty) || product.quantity.min, 2000)} onChange={(e) => setQty(e.target.value)} aria-label="Quantity slider" />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-paper/40"><span>{product.quantity.min}</span><span>volume discounts from {product.pricing.volumeTiers?.[0]?.minQty ?? 100}</span><span>2000</span></div>
              </div>
            </>
          )}
        </div>

        <Tilt max={6} className="rounded-2xl">
          <div className="relative flex h-full min-h-[300px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 p-6" style={{ background: `linear-gradient(145deg, ${tint[1]}22, transparent 60%), #0B0C14` }}>
            <div className="z-pop-sm flex items-center justify-between"><span className="label !mb-0 !text-paper/50">Your price</span>{pr?.discountPct > 0 && <motion.span initial={{ scale: .6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} key={pr.discountPct} className="rounded-full bg-copper-500 px-3 py-1 font-mono text-xs font-bold text-white">-{pr.discountPct}% volume</motion.span>}</div>
            <div className="z-pop py-4">
              {error ? <p className="text-sm text-copper-300">{error.message}</p> : (
                <>
                  <div className={cx('font-display text-5xl font-bold tracking-tight transition-opacity sm:text-6xl', isFetching && 'opacity-60')}><PriceNumber minor={pr?.totalMinor} currency={pr?.currency} /></div>
                  <p className="mt-2 font-mono text-xs text-paper/50">{pr ? `incl. ${pr.taxName} ${(pr.taxRate * 100).toFixed(0)}%  ·  ${money(pr.unitPriceMinor, pr.currency)} / unit` : 'Calculating…'}</p>
                </>
              )}
              {q?.nextTier && <p className="mt-4 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-paper/80"><Sparkles size={14} className="shrink-0 text-copper-400" />Add {num(q.nextTier.unitsToUnlock)} more to unlock {q.nextTier.discountPct}% off</p>}
            </div>
            <Button className="z-pop-sm w-full" onClick={() => nav(`/products/${slug}`)}>Configure &amp; order <ArrowRight size={16} /></Button>
          </div>
        </Tilt>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- visual: the chosen size as a physical sheet */
export function SizePreview({ w, h, bleed = 3, material, label }) {
  const [c1, c2] = materialTint(material);
  const max = 260; const k = max / Math.max(w || 1, h || 1);
  const pw = Math.max(40, (w || 1) * k), ph = Math.max(28, (h || 1) * k);
  return (
    <div className="grid place-items-center py-6" style={{ perspective: 900 }}>
      <motion.div key={material} initial={{ rotateY: 90, opacity: 0 }} animate={{ rotateY: -14, rotateX: 10, opacity: 1 }} transition={{ type: 'spring', damping: 14 }} style={{ transformStyle: 'preserve-3d' }}>
        <div className="relative" style={{ width: pw, height: ph, background: `linear-gradient(135deg, ${c1}, ${c2})`, boxShadow: '12px 12px 0 -2px rgba(11,12,20,.12), 22px 24px 40px -10px rgba(11,12,20,.45), inset 0 0 0 1px rgba(11,12,20,.1)', borderRadius: 6, transition: 'width .4s, height .4s' }}>
          <div className="absolute inset-[6%] rounded-sm border border-dashed border-sage-500/70" />
          <div className="absolute inset-0 grid place-items-center font-display text-sm font-bold text-ink-900/60">{label}</div>
          <span className="absolute -top-6 left-0 right-0 text-center font-mono text-[11px] text-ink-500">{w} mm</span>
          <span className="absolute -right-12 top-1/2 -translate-y-1/2 -rotate-90 font-mono text-[11px] text-ink-500">{h} mm</span>
        </div>
      </motion.div>
    </div>
  );
}
