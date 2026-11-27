import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cx, EmptyState, Skeleton } from './ui';

/** Table on desktop, stacked cards on phones. columns: [{ key, label, render(row), primary, className }] */
export function ResponsiveTable({ columns, rows, getHref, loading, empty }) {
  if (loading) return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>;
  if (!rows?.length) return empty || <EmptyState title="Nothing to show" />;
  const wrap = (row, children, cls, key) => (getHref ? <Link key={key} to={getHref(row)} className={cls}>{children}</Link> : <div key={key} className={cls}>{children}</div>);
  return (
    <>
      <div className="card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-200/70"><tr>{columns.map((c) => <th key={c.key} className={cx('whitespace-nowrap px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-500', c.className)}>{c.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <motion.tr key={r.id || r._id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * .025 }} className="group border-t border-paper-300 transition hover:bg-copper-50/60">
                  {columns.map((c, ci) => <td key={c.key} className={cx('px-4 py-3 align-middle', c.className)}>{getHref && ci === 0 ? <Link to={getHref(r)} className="block">{c.render(r)}</Link> : c.render(r)}</td>)}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((r, i) => wrap(r, (
          <>
            <div className="mb-2">{columns[0].render(r)}</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">{columns.slice(1).map((c) => <div key={c.key} className={c.key === 'actions' ? 'col-span-2' : ''}><dt className="label !mb-0.5">{c.label}</dt><dd>{c.render(r)}</dd></div>)}</dl>
          </>
        ), 'card block p-4', r.id || r._id || i))}
      </div>
    </>
  );
}

/** Dependency-free SVG bar chart */
export function BarChart({ data, height = 180, format = (v) => v, color = '#C77D2E' }) {
  if (!data?.length) return <div className="grid h-32 place-items-center text-sm text-ink-500">No data in this period</div>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="no-scrollbar overflow-x-auto"><div className="flex items-end gap-1.5 pb-1" style={{ height, minWidth: Math.max(data.length * 22, 100) }} role="img" aria-label="Bar chart">
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${format(d.value)}`}>
          <motion.div className="w-full rounded-t-md" style={{ background: color, transformOrigin: 'bottom' }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * .02, type: 'spring', damping: 18 }}><div style={{ height: Math.max(3, (d.value / max) * (height - 28)) }} /></motion.div>
          <span className="mt-1 truncate text-center font-mono text-[9px] text-ink-500">{d.label.slice(5)}</span>
          <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 font-mono text-[10px] text-paper group-hover:block">{format(d.value)}</span>
        </div>
      ))}
    </div></div>
  );
}

export function HBars({ rows, format = (v) => v, color = '#4F8A62' }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.length) return <div className="py-6 text-center text-sm text-ink-500">No data yet</div>;
  return <ul className="space-y-3">{rows.map((r, i) => (
    <li key={`${r.label}-${i}`}><div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{r.label}</span><span className="font-mono text-ink-500">{format(r.value)}{r.sub && <span className="ml-2 opacity-70">{r.sub}</span>}</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-paper-300"><motion.div className="h-full rounded-full" style={{ background: r.color || color }} initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ duration: .8, delay: i * .06 }} /></div></li>))}</ul>;
}

export const Panel = ({ title, right, children, className }) => (
  <section className={cx('card p-5 sm:p-6', className)}><header className="mb-4 flex items-center justify-between gap-3"><h2 className="font-display text-lg font-bold">{title}</h2>{right}</header>{children}</section>
);
