import { forwardRef, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X, Inbox } from 'lucide-react';
import { useReducedMotionPref } from '../../lib/hooks';
import { createPortal } from 'react-dom';

export const cx = (...a) => a.filter(Boolean).join(' ');

/* ------------------------------------------------------------ Button (physical, pressable) */
const VARIANT = { primary: 'btn-primary', dark: 'btn-dark', light: 'btn-light', ghost: 'btn-ghost' };
export const Button = forwardRef(function Button({ variant = 'primary', size, loading, as: Tag = 'button', className, children, disabled, ...rest }, ref) {
  const props = Tag === 'button' ? { type: rest.type || 'button', disabled: disabled || loading } : { 'aria-disabled': disabled || loading || undefined };
  return (
    <Tag ref={ref} className={cx('btn', VARIANT[variant], size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', className)} {...props} {...rest}>
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </Tag>
  );
});

/* ------------------------------------------------------------ Tilt: 3D hover card (mouse only, respects reduced motion) */
export function Tilt({ children, className = '', max = 7, glare = true, ...rest }) {
  const ref = useRef(null);
  const reduce = useReducedMotionPref();
  const move = useCallback((e) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${((0.5 - py) * max * 2).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${((px - 0.5) * max * 2).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
    el.classList.add('is-active');
  }, [max, reduce]);
  const leave = useCallback(() => {
    const el = ref.current; if (!el) return;
    el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.classList.remove('is-active');
  }, []);
  return (
    <div ref={ref} className={cx('tilt', className)} onPointerMove={move} onPointerLeave={leave} {...rest}>
      <div className="tilt-inner relative h-full rounded-[inherit]">{children}{glare && <span className="tilt-glare" />}</div>
    </div>
  );
}

/* ------------------------------------------------------------ Reveal: 3D scroll-in */
export function Reveal({ children, delay = 0, y = 34, className = '', as = 'div', once = true }) {
  const reduce = useReducedMotionPref();
  const Comp = motion[as] || motion.div;
  if (reduce) return <Comp className={className}>{children}</Comp>;
  return (
    <Comp className={className} style={{ transformPerspective: 900 }}
      initial={{ opacity: 0, y, rotateX: 14 }} whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once, margin: '0px 0px -60px 0px' }} transition={{ duration: .7, delay, ease: [.2, .7, .2, 1] }}>
      {children}
    </Comp>
  );
}

/* ------------------------------------------------------------ small pieces */
export const Spinner = ({ size = 18, className }) => <Loader2 size={size} className={cx('animate-spin', className)} />;

export function Badge({ tone = 'bg-paper-200 text-ink-600 border-paper-300', dot, children, className }) {
  return <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide', tone, className)}>{dot && <i className={cx('h-1.5 w-1.5 rounded-full', dot)} />}{children}</span>;
}

export const Skeleton = ({ className }) => <div className={cx('skeleton', className)} aria-hidden />;

export function Loader3D({ label = 'Loading', className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-6', className)} role="status" aria-label={label}>
      <div className="cube-scene"><div className="cube">{['D', 'H', 'D', 'H', '', ''].map((t, i) => <div key={i} className="cube-face">{t}</div>)}</div></div>
      <span className="font-mono text-[11px] uppercase tracking-[.25em] text-ink-500">{label}</span>
    </div>
  );
}
export function SheetLoader({ label = 'Loading', className }) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-10', className)} role="status" aria-label={label}>
      <div style={{ perspective: 700 }} className="flex h-44 items-center justify-center"><div className="sheet-stack">{[0, 1, 2, 3, 4].map((i) => <i key={i} />)}</div></div>
      <span className="font-mono text-[11px] uppercase tracking-[.25em] text-paper/70">{label}</span>
    </div>
  );
}
export const PageLoader = () => <div className="grid min-h-[60vh] place-items-center"><Loader3D /></div>;

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="card-flat flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-paper-200 text-ink-500"><Icon size={26} /></div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="max-w-sm text-sm text-ink-500">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ error, retry }) {
  if (!error) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-signal-red/30 bg-signal-red/5 px-4 py-3 text-sm text-signal-red">
      <span className="flex-1">{error.message || String(error)}</span>
      {retry && <button className="font-semibold underline" onClick={retry}>Retry</button>}
    </div>
  );
}

export function SectionTitle({ kicker, title, accent, text, align = 'left', className }) {
  return (
    <div className={cx('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {kicker && <span className="kicker">{kicker}</span>}
      <h2 className="mt-3 text-3xl font-bold leading-[1.05] sm:text-5xl">{title} {accent && <span className="serif-i">{accent}</span>}</h2>
      {text && <p className="mt-4 text-base text-ink-500 sm:text-lg">{text}</p>}
    </div>
  );
}

export function PageHeader({ kicker, title, accent, actions, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker && <span className="kicker">{kicker}</span>}
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{title} {accent && <span className="serif-i">{accent}</span>}</h1>
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-signal-red">{error}</span>}
    </label>
  );
}
export const Input = forwardRef(function Input({ className, ...p }, ref) { return <input ref={ref} className={cx('input', className)} {...p} />; });
export const Textarea = forwardRef(function Textarea({ className, ...p }, ref) { return <textarea ref={ref} className={cx('input min-h-[96px]', className)} {...p} />; });
export const Select = forwardRef(function Select({ className, children, ...p }, ref) { return <select ref={ref} className={cx('input appearance-none bg-[length:16px] bg-[right_.75rem_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23454A60' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>{children}</select>; });

/* ------------------------------------------------------------ Modal with a 3D entrance */
export function Modal({ open, onClose, title, children, wide, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', esc);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;
  // Portal to <body>: a transformed ancestor (page transition) would otherwise trap this fixed overlay
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] grid place-items-end bg-ink-950/70 backdrop-blur-sm sm:place-items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
          <motion.div role="dialog" aria-modal="true" aria-label={title}
            style={{ transformPerspective: 1000 }}
            initial={{ opacity: 0, y: 60, rotateX: 14, scale: .97 }} animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }} exit={{ opacity: 0, y: 40, rotateX: 8 }} transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className={cx('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-paper-300 bg-paper-100 shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
            <div className="flex items-center justify-between gap-4 border-b border-paper-300 px-5 py-4 sm:px-6">
              <h3 className="text-lg font-bold">{title}</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 text-ink-500 hover:bg-paper-200" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-paper-300 bg-paper-200/50 px-5 py-4 sm:px-6">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function Stat({ label, value, sub, icon: Icon, tone = 'text-copper-500' }) {
  return (
    <Tilt max={5} className="h-full rounded-2xl">
      <div className="card h-full p-5">
        <div className="flex items-start justify-between"><span className="label !mb-0">{label}</span>{Icon && <Icon size={18} className={tone} />}</div>
        <div className="mt-3 font-display text-3xl font-bold tracking-tight">{value}</div>
        {sub && <div className="mt-1 text-xs text-ink-500">{sub}</div>}
      </div>
    </Tilt>
  );
}

export function Progress({ value, className }) {
  return <div className={cx('h-2 overflow-hidden rounded-full bg-paper-300', className)}><motion.div className="h-full rounded-full bg-gradient-to-r from-sage-400 to-sage-600" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: .8 }} /></div>;
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-paper-300 bg-paper-200/60 p-1', className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cx('relative whitespace-nowrap rounded-lg px-4 py-2 font-display text-sm font-semibold transition', value === t.value ? 'bg-ink-900 text-paper shadow' : 'text-ink-500 hover:text-ink-900')}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 font-mono text-[11px] opacity-70">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-between gap-3 text-sm">
      <span className="font-mono text-xs text-ink-500">Page {meta.page} / {meta.pages} - {meta.total} total</span>
      <div className="flex gap-2">
        <Button variant="light" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Previous</Button>
        <Button variant="light" size="sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}>Next</Button>
      </div>
    </div>
  );
}
