import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet } from 'lucide-react';
import { api, downloadFile, errorText } from '../../lib/api';
import { Button, ErrorBox, Field, Input, PageHeader, Reveal, Skeleton, Stat, cx } from '../../components/ui';
import { BarChart, HBars, Panel, ResponsiveTable } from '../../components/AdminParts';
import { PIPELINE, STATUS, money, moneyShort, num } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../lib/hooks';
import { CircleDollarSign, Package, TrendingUp, Boxes } from 'lucide-react';

export default function AdminReports() {
  usePageTitle('Reports');
  const toast = useToast();
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const params = { from: from || undefined, to: to ? `${to}T23:59:59` : undefined };
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['a-rep-full', from, to], queryFn: () => api.get('/api/admin/reports/summary', params), placeholderData: (p) => p });
  const t = data?.totals;
  return (
    <>
      <PageHeader kicker="Analytics" title="Reports &" accent="export." actions={<Button variant="light" onClick={() => downloadFile(`/api/admin/export/xero-invoices.csv${from || to ? `?${new URLSearchParams({ ...(from && { from }), ...(to && { to: `${to}T23:59:59` }) })}` : ''}`, 'xero-invoices.csv').catch((e) => toast.error(errorText(e)))}><FileSpreadsheet size={16} />Xero invoices CSV</Button>} />
      <div className="card mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>{(from || to) && <Button variant="light" onClick={() => { setFrom(''); setTo(''); }}>Reset</Button>}</div>
      {error && <ErrorBox error={error} retry={refetch} />}
      {isLoading ? <Skeleton className="h-28" /> : data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Revenue (incl. tax)" value={moneyShort(t.revenueMinor)} icon={CircleDollarSign} sub={`net ${moneyShort(t.netRevenueMinor)} · tax ${moneyShort(t.taxMinor)}`} />
            <Stat label="Paid orders" value={num(t.paidOrders)} icon={Package} />
            <Stat label="Average order" value={moneyShort(t.averageOrderMinor)} icon={TrendingUp} tone="text-sage-500" />
            <Stat label="Units produced" value={num(t.unitsPrinted)} icon={Boxes} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Reveal><Panel title="Daily revenue"><BarChart data={data.daily.map((d) => ({ label: d.date, value: d.revenueMinor }))} format={(v) => money(v)} /></Panel></Reveal>
            <Reveal delay={.05}><Panel title="Orders by status"><HBars rows={[...PIPELINE, 'cancelled'].map((s) => ({ label: STATUS[s].label, value: data.byStatus[s] || 0, color: s === 'cancelled' ? '#C8432F' : s === 'completed' ? '#4F8A62' : '#C77D2E' }))} /></Panel></Reveal>
          </div>
          <Reveal className="mt-6"><Panel title="Product-family throughput">
            <ResponsiveTable rows={data.productFamilyThroughput.map((d) => ({ ...d, id: d.division }))} columns={[
              { key: 'd', label: 'Division', render: (r) => <span className="font-semibold">{r.division}</span> }, { key: 'o', label: 'Orders', render: (r) => r.orders }, { key: 'u', label: 'Units', render: (r) => num(r.units) },
              { key: 'c', label: 'Completed', render: (r) => r.completed }, { key: 'r', label: 'Revenue', render: (r) => <span className="font-mono">{money(r.revenueMinor)}</span> }]} /></Panel></Reveal>
          <Reveal className="mt-6"><Panel title="Top customers"><HBars color="#3A6EA5" rows={data.topCustomers.map((c) => ({ label: c.name || c.email, value: c.revenueMinor, sub: `${c.orders} orders` }))} format={(v) => moneyShort(v)} /></Panel></Reveal>
        </>
      )}
    </>
  );
}
