import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CircleDollarSign, ClipboardList, Hammer, Package, ShieldCheck, TrendingUp, Unlock } from 'lucide-react';
import { api } from '../../lib/api';
import { Badge, Button, ErrorBox, PageHeader, Reveal, Skeleton, Stat, Tilt, cx } from '../../components/ui';
import { BarChart, HBars, Panel, ResponsiveTable } from '../../components/AdminParts';
import { StatusBadge } from '../../components/Shared';
import { PIPELINE, STATUS, dateFmt, money, moneyShort, num } from '../../lib/format';
import { usePageTitle } from '../../lib/hooks';

export default function AdminDashboard() {
  usePageTitle('Admin overview');
  const dash = useQuery({ queryKey: ['a-dash'], queryFn: () => api.get('/api/admin/dashboard'), refetchInterval: 15000 });
  const rep = useQuery({ queryKey: ['a-rep'], queryFn: () => api.get('/api/admin/reports/summary') });
  const ready = useQuery({ queryKey: ['a-ready'], queryFn: () => api.getFull('/api/admin/orders', { ready: 'true', limit: 6 }), refetchInterval: 15000 });
  if (dash.error) return <ErrorBox error={dash.error} retry={dash.refetch} />;
  const p = dash.data?.pipeline || {}; const t = rep.data?.totals;

  return (
    <>
      <PageHeader kicker="Production console" title="Shop floor" accent="overview." actions={<Button as={Link} to="/admin/orders">Open job pipeline <ArrowRight size={16} /></Button>} />
      {dash.isLoading ? <Skeleton className="h-28" /> : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Ready for production" value={dash.data.readyForProduction} icon={Unlock} tone="text-sage-500" sub="proofs approved, files unlocked" />
          <Stat label="Awaiting approval" value={dash.data.awaitingCustomerApproval} icon={ShieldCheck} sub="customer must review proof" />
          <Stat label="Print jobs running" value={dash.data.printJobsRunning} icon={Hammer} sub="files being generated" />
          <Stat label="Paid orders" value={num(t?.paidOrders)} icon={Package} sub={`${num(t?.unitsPrinted)} units`} />
        </div>
      )}

      <Reveal className="mt-6"><Panel title="Pipeline" right={<span className="font-mono text-[11px] text-ink-500">active jobs per stage</span>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PIPELINE.map((s, i) => (
            <Tilt key={s} max={8} className="rounded-2xl"><Link to={`/admin/orders?status=${s}`} className={cx('relative block overflow-hidden rounded-2xl border p-4 transition', (p[s] || 0) > 0 ? 'border-copper-300 bg-copper-50' : 'border-paper-300 bg-paper-100')}>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-500">0{i + 1}</span><div className="font-display text-4xl font-bold">{p[s] || 0}</div><div className="mt-1 flex items-center gap-1.5 text-xs font-semibold"><i className={cx('h-2 w-2 rounded-full', STATUS[s].dot)} />{STATUS[s].label}</div>
            </Link></Tilt>
          ))}
        </div>
      </Panel></Reveal>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Reveal><Panel title="Revenue (last 30 days)" right={<Badge tone="bg-sage-100 text-sage-700 border-sage-300">{moneyShort(t?.revenueMinor)}</Badge>}>
          {rep.isLoading ? <Skeleton className="h-44" /> : <BarChart data={(rep.data?.daily || []).slice(-30).map((d) => ({ label: d.date, value: d.revenueMinor }))} format={(v) => money(v)} />}
        </Panel></Reveal>
        <Reveal delay={.06}><Panel title="Throughput by division">
          {rep.isLoading ? <Skeleton className="h-44" /> : <HBars rows={(rep.data?.productFamilyThroughput || []).map((d) => ({ label: d.division, value: d.orders, sub: `${d.units} units`, color: '#C77D2E' }))} />}
        </Panel></Reveal>
      </div>

      <Reveal className="mt-6"><Panel title="Ready for production" right={<Link to="/admin/orders?ready=true" className="font-display text-xs font-semibold text-copper-600 hover:underline">View all</Link>}>
        <ResponsiveTable loading={ready.isLoading} rows={ready.data?.data} getHref={(r) => `/admin/orders/${r.id}`} empty={<p className="py-8 text-center text-sm text-ink-500">Nothing waiting - approved jobs land here.</p>}
          columns={[
            { key: 'o', label: 'Order', render: (r) => <><div className="font-mono text-xs font-bold">{r.orderNumber}</div><div className="text-xs text-ink-500">{dateFmt(r.createdAt)}</div></> },
            { key: 'c', label: 'Customer', render: (r) => <span className="text-xs">{r.customer?.name}</span> },
            { key: 'p', label: 'Product', render: (r) => <span className="text-xs">{r.productName} · {r.quantity} pcs</span> },
            { key: 's', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
            { key: 'f', label: 'Files', render: (r) => <Badge tone="bg-sage-100 text-sage-700 border-sage-300">{r.printJob?.status === 'done' ? 'ready' : r.printJob?.status || 'unlocked'}</Badge> },
          ]} />
      </Panel></Reveal>
    </>
  );
}
