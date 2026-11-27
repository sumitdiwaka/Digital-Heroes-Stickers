import { motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { useAuthedImage } from '../lib/hooks';
import { Badge, Skeleton, cx } from './ui';
import { PIPELINE, PROOF_STATUS, STATUS, money } from '../lib/format';

export const StatusBadge = ({ status }) => { const s = STATUS[status] || STATUS.quote; return <Badge tone={s.tone} dot={s.dot}>{s.label}</Badge>; };
export const ProofBadge = ({ status }) => { const s = PROOF_STATUS[status] || PROOF_STATUS.pending; return <Badge tone={s.tone}>{s.label}</Badge>; };

/** Image from a protected endpoint (proofs, previews, assets). */
export function AuthedImage({ path, version, alt, className, imgClassName, ratio }) {
  const { url, loading, error } = useAuthedImage(path, version);
  return (
    <div className={cx('relative overflow-hidden', className)} style={ratio ? { aspectRatio: ratio } : undefined}>
      {loading && <Skeleton className="absolute inset-0 !rounded-none" />}
      {url && <motion.img initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .5 }} src={url} alt={alt} className={cx('h-full w-full object-contain', imgClassName)} draggable={false} />}
      {error && !loading && <div className="grid h-full place-items-center p-4 text-center text-xs text-ink-500">Preview unavailable</div>}
    </div>
  );
}

/** quote > order > artwork > proof > production > completed */
export function OrderStepper({ status }) {
  if (status === 'cancelled') return <div className="rounded-xl border border-signal-red/30 bg-signal-red/5 px-4 py-3 text-sm font-medium text-signal-red">This order was cancelled.</div>;
  const idx = PIPELINE.indexOf(status);
  return (
    <ol className="no-scrollbar flex items-start overflow-x-auto pb-2" aria-label="Order progress">
      {PIPELINE.map((s, i) => {
        const done = i < idx || status === 'completed', cur = i === idx && status !== 'completed';
        return (
          <li key={s} className="relative flex min-w-[88px] flex-1 flex-col items-center text-center">
            {i > 0 && <span className="absolute left-0 right-1/2 top-[17px] -z-0 h-0.5 bg-paper-300"><motion.span className="block h-full bg-sage-500" initial={{ width: 0 }} animate={{ width: i <= idx ? '100%' : 0 }} transition={{ duration: .6, delay: i * .08 }} /></span>}
            {i < PIPELINE.length - 1 && <span className="absolute left-1/2 right-0 top-[17px] -z-0 h-0.5 bg-paper-300"><motion.span className="block h-full bg-sage-500" initial={{ width: 0 }} animate={{ width: i < idx ? '100%' : 0 }} transition={{ duration: .6, delay: i * .08 }} /></span>}
            <motion.span initial={{ rotateY: -90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ delay: i * .07, type: 'spring' }} style={{ transformPerspective: 400 }}
              className={cx('relative z-10 grid h-9 w-9 place-items-center rounded-full border-2 font-mono text-xs font-bold', done ? 'border-sage-600 bg-sage-600 text-white' : cur ? 'border-copper-500 bg-copper-500 text-white shadow-glow' : 'border-paper-300 bg-paper-100 text-ink-500')}>
              {done ? <Check size={16} /> : i + 1}
              {cur && <span className="absolute inset-0 animate-ping rounded-full border-2 border-copper-400 opacity-60" />}
            </motion.span>
            <span className={cx('mt-2 font-display text-[12px] font-semibold', cur ? 'text-copper-600' : done ? 'text-sage-700' : 'text-ink-500')}>{STATUS[s].label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function PriceBreakdown({ pricing, compact, quantity }) {
  const qty = quantity ?? pricing?.quantity ?? 1;
  if (!pricing) return null;
  const row = (k, v, strong) => <div className={cx('flex items-baseline justify-between gap-4', strong ? 'border-t border-paper-300 pt-3 font-display text-lg font-bold' : 'text-sm')}><span className={strong ? '' : 'text-ink-500'}>{k}</span><span className="font-mono">{v}</span></div>;
  return (
    <div className="space-y-2">
      {!compact && row('Unit price', money(pricing.listUnitPriceMinor, pricing.currency))}
      {pricing.discountPct > 0 && row(`Volume discount ${pricing.discountPct}%`, `- ${money(pricing.listUnitPriceMinor - pricing.unitPriceMinor, pricing.currency)} / unit`)}
      {row(`${qty} x ${money(pricing.unitPriceMinor, pricing.currency)}`, money(pricing.unitPriceMinor * qty, pricing.currency))}
      {pricing.setupFeeMinor > 0 && row('Setup fee', money(pricing.setupFeeMinor, pricing.currency))}
      {row('Subtotal', money(pricing.subtotalMinor, pricing.currency))}
      {row(`${pricing.taxName} ${(pricing.taxRate * 100).toFixed(0)}%`, money(pricing.taxMinor, pricing.currency))}
      {row('Total (tax incl.)', money(pricing.totalMinor, pricing.currency), true)}
    </div>
  );
}

export const LockNote = ({ children }) => <div className="flex items-center gap-2 rounded-xl border border-paper-300 bg-paper-200/60 px-3 py-2.5 text-xs text-ink-600"><Lock size={14} className="shrink-0 text-copper-500" />{children}</div>;
