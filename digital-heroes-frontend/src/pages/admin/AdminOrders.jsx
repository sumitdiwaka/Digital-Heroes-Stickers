import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, Lock, Search, Unlock } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Input, PageHeader, Pagination, Select, cx, ErrorBox } from '../../components/ui';
import { ResponsiveTable } from '../../components/AdminParts';
import { StatusBadge } from '../../components/Shared';
import { dateFmt, money, PIPELINE } from '../../lib/format';
import { useDebounced, usePageTitle } from '../../lib/hooks';

export default function AdminOrders() {
  usePageTitle('Job pipeline');
  const [sp, setSp] = useSearchParams();
  const g = (k) => sp.get(k) || '';
  const [q, setQ] = useState(g('q')); const [cust, setCust] = useState(g('customer'));
  const dq = useDebounced(q, 350), dc = useDebounced(cust, 350);
  const set = (k, v) => setSp((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); return n; }, { replace: true });
  useEffect(() => { if (dq !== g('q')) set('q', dq); }, [dq]); // eslint-disable-line
  useEffect(() => { if (dc !== g('customer')) set('customer', dc); }, [dc]); // eslint-disable-line

  const params = { status: g('status'), q: g('q'), customer: g('customer'), division: g('division'), from: g('from'), to: g('to'), ready: g('ready'), paid: g('paid'), archived: g('archived'), page: g('page') || 1, limit: 15 };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['a-orders', params], queryFn: () => api.getFull('/api/admin/orders', params), placeholderData: (p) => p, refetchInterval: 20000 });
  const { data: divs } = useQuery({ queryKey: ['divisions'], queryFn: () => api.get('/api/divisions') });
  const status = g('status');

  return (
    <>
      <PageHeader kicker="Production" title="Job" accent="pipeline." />
      <div className="card mb-5 space-y-4 p-4 sm:p-5">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">{[['', 'All'], ...PIPELINE.map((s) => [s, s[0].toUpperCase() + s.slice(1)]), ['cancelled', 'Cancelled']].map(([v, l]) => <button key={v} onClick={() => set('status', v)} className={cx('chip whitespace-nowrap', status === v && 'chip-on')}>{l}</button>)}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" /><Input placeholder="Order number…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search order number" /></div>
          <Input placeholder="Customer name / email / company" value={cust} onChange={(e) => setCust(e.target.value)} aria-label="Customer" />
          <Select value={g('division')} onChange={(e) => set('division', e.target.value)} aria-label="Division"><option value="">All divisions</option>{divs?.map((d) => <option key={d.slug} value={d.slug}>{d.name}</option>)}</Select>
          <div className="grid grid-cols-2 gap-2"><Input type="date" value={g('from')} onChange={(e) => set('from', e.target.value)} aria-label="From date" /><Input type="date" value={g('to')} onChange={(e) => set('to', e.target.value)} aria-label="To date" /></div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[['ready', 'Ready for production', Unlock], ['paid', 'Paid only', null], ['archived', 'Archive', Archive]].map(([k, l, I]) => <label key={k} className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-copper-500" checked={g(k) === 'true'} onChange={(e) => set(k, e.target.checked ? 'true' : '')} />{I && <I size={14} className="text-ink-500" />}{l}</label>)}
          {Object.values(params).some((v) => v && v !== 1 && v !== 15) && <button className="ml-auto font-display text-xs font-semibold text-copper-600 hover:underline" onClick={() => { setQ(''); setCust(''); setSp({}, { replace: true }); }}>Clear filters</button>}
        </div>
      </div>

      {error && <ErrorBox error={error} retry={refetch} />}
      <ResponsiveTable loading={isLoading} rows={data?.data} getHref={(r) => `/admin/orders/${r.id}`} columns={[
        { key: 'o', label: 'Order', render: (r) => <><div className="font-mono text-xs font-bold">{r.orderNumber}</div><div className="text-xs text-ink-500">{dateFmt(r.createdAt)}</div></> },
        { key: 'c', label: 'Customer', render: (r) => <><div className="text-sm font-semibold">{r.customer?.name}</div><div className="text-xs text-ink-500">{r.customer?.company || r.customer?.email}</div></> },
        { key: 'p', label: 'Product', render: (r) => <><div className="text-sm">{r.productName}</div><div className="text-xs text-ink-500">{r.config.widthMm}×{r.config.heightMm} mm · {r.quantity} pcs</div></> },
        { key: 't', label: 'Total', render: (r) => <span className="font-mono text-sm font-semibold">{money(r.totalMinor, r.currency)}</span> },
        { key: 's', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        { key: 'pr', label: 'Proof', render: (r) => <span className="font-mono text-xs">{r.proof.latest ? `v${r.proof.latest}${r.proof.approved ? ' ✓' : ''}` : '-'}</span> },
        { key: 'f', label: 'Files', render: (r) => r.filesUnlocked ? <Badge tone="bg-sage-100 text-sage-700 border-sage-300"><Unlock size={11} />{r.printJob?.status === 'done' ? 'ready' : r.printJob?.status || 'open'}</Badge> : <Badge tone="bg-paper-200 text-ink-500 border-paper-300"><Lock size={11} />locked</Badge> },
      ]} />
      <Pagination meta={data?.meta} onPage={(p) => set('page', String(p))} />
    </>
  );
}
