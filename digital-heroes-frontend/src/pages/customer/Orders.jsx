import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Boxes, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';
import { EmptyState, ErrorBox, PageHeader, Pagination, Reveal, Skeleton, Tilt, cx, Button } from '../../components/ui';
import { StatusBadge } from '../../components/Shared';
import { dateFmt, money } from '../../lib/format';
import { usePageTitle } from '../../lib/hooks';

const FILTERS = [['', 'All'], ['quote', 'Quotes'], ['proof', 'Proofs'], ['production', 'In production'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];

export default function Orders() {
  usePageTitle('My orders');
  const [sp, setSp] = useSearchParams();
  const status = sp.get('status') || ''; const page = Number(sp.get('page') || 1);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['orders', status, page], queryFn: () => api.getFull('/api/orders', { status, page, limit: 10 }), placeholderData: (p) => p });
  const set = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setSp(n); };
  const orders = data?.data;
  return (
    <>
      <PageHeader kicker="History" title="Your" accent="orders." actions={<Button as={Link} to="/products">New order</Button>} />
      <div className="no-scrollbar -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">{FILTERS.map(([v, l]) => <button key={v} onClick={() => set('status', v)} className={cx('chip whitespace-nowrap', status === v && 'chip-on')}>{l}</button>)}</div>
      {error && <ErrorBox error={error} retry={refetch} />}
      {isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>}
      {orders && !orders.length && <EmptyState icon={Boxes} title="No orders here" text={status ? 'Nothing matches this filter.' : 'Your orders will show up here.'} action={<Button as={Link} to="/products" size="sm">Browse products</Button>} />}
      <div className="space-y-3">
        {orders?.map((o, i) => (
          <Reveal key={o._id} delay={Math.min(i, 5) * .04} y={18}>
            <Tilt max={2.5} className="rounded-2xl" glare={false}>
              <Link to={`/orders/${o._id}`} className="card group grid items-center gap-x-6 gap-y-2 p-4 sm:grid-cols-[1.4fr_1fr_auto_auto_auto] sm:p-5">
                <div className="min-w-0"><div className="truncate font-display text-base font-bold">{o.productName}</div><div className="font-mono text-[11px] text-ink-500">{o.orderNumber}</div></div>
                <div className="text-xs text-ink-500">{o.config.widthMm} × {o.config.heightMm} mm · {o.config.material}<br />{o.quantity} pcs · {dateFmt(o.createdAt)}</div>
                <span className="font-mono text-sm font-semibold">{money(o.pricing.totalMinor, o.pricing.currency)}</span><StatusBadge status={o.status} />
                <ChevronRight size={18} className="hidden text-ink-500 transition group-hover:translate-x-1 group-hover:text-copper-500 sm:block" />
              </Link>
            </Tilt>
          </Reveal>
        ))}
      </div>
      <Pagination meta={data?.meta} onPage={(p) => set('page', String(p))} />
    </>
  );
}
