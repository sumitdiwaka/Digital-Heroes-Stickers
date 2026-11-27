import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Boxes, CheckCircle2, Clock, Download, FileText, Palette, Receipt, Repeat, User } from 'lucide-react';
import { api, downloadFile, errorText } from '../../lib/api';
import { Button, EmptyState, ErrorBox, PageHeader, Progress, Reveal, Skeleton, Stat, Tilt, Badge } from '../../components/ui';
import { AuthedImage, ProofBadge, StatusBadge } from '../../components/Shared';
import { dateFmt, money } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePageTitle, useInView } from '../../lib/hooks';

const Module = ({ icon: Icon, title, action, children, delay = 0 }) => (
  <Reveal delay={delay} className="h-full">
    <section className="card flex h-full flex-col p-5 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2.5 font-display text-lg font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-900 text-copper-400"><Icon size={17} /></span>{title}</h2>{action}</header>
      <div className="flex-1">{children}</div>
    </section>
  </Reveal>
);
const More = ({ to, children }) => <Link to={to} className="inline-flex items-center gap-1 font-display text-xs font-semibold text-copper-600 hover:underline">{children}<ArrowRight size={13} /></Link>;

function DesignThumb({ d }) {
  const [ref, seen] = useInView();
  return <Link to="/designs" ref={ref} className="group block"><div className="dh-checker overflow-hidden rounded-xl border border-paper-300 transition group-hover:-translate-y-1 group-hover:shadow-lift">{seen ? <AuthedImage path={d.previewUrl} ratio={`${d.config?.widthMm || 4}/${d.config?.heightMm || 3}`} alt={d.name} /> : <div style={{ aspectRatio: '4/3' }} />}</div><div className="mt-1.5 truncate text-xs font-semibold">{d.name}</div></Link>;
}

export default function Dashboard() {
  usePageTitle('Dashboard');
  const { user } = useAuth();
  const nav = useNavigate(); const toast = useToast(); const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/api/dashboard/customer') });
  const reorder = useMutation({ mutationFn: (id) => api.post(`/api/orders/${id}/reorder`, { checkout: false }), onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success(d.artworkCarriedOver ? 'Reorder ready - your approved artwork carries over.' : 'Reorder ready.'); nav(`/checkout/${d.order._id}`); }, onError: (e) => toast.error(errorText(e)) });

  if (error) return <ErrorBox error={error} retry={refetch} />;
  const c = data?.orders.counts;
  const active = c ? c.quote + c.order + c.artwork + c.proof + c.production : 0;
  const pending = data?.activeProofs.filter((p) => p.status === 'pending' && !p.approved).length || 0;

  return (
    <>
      <PageHeader kicker="Overview" title={`Hello, ${user?.name?.split(' ')[0] || 'there'}.`} accent="Here's your print desk." actions={<Button as={Link} to="/products">New order <ArrowRight size={16} /></Button>} />
      {isLoading ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Active orders" value={active} icon={Clock} sub="in the pipeline" />
            <Stat label="Proofs to review" value={pending} icon={CheckCircle2} tone="text-sage-500" sub={pending ? 'waiting on you' : 'all clear'} />
            <Stat label="Completed" value={c.completed} icon={Boxes} sub="orders delivered" />
            <Stat label="Saved designs" value={data.savedDesigns.length} icon={Palette} sub="ready to reuse" />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <Module icon={User} title="Account status" action={<More to="/profile">Edit</More>}>
              <div className="flex items-baseline justify-between"><span className="font-display text-4xl font-bold">{data.profile.completenessPct}%</span><span className="text-xs text-ink-500">profile complete</span></div>
              <Progress value={data.profile.completenessPct} className="mt-3" />
              {data.profile.missing.length ? <p className="mt-4 text-xs text-ink-500">Add your <b>{data.profile.missing.join(', ')}</b> for faster checkout and invoices.</p> : <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-sage-600"><CheckCircle2 size={14} />Everything filled in.</p>}
              <div className="mt-4 text-xs text-ink-500">{user?.email}</div>
            </Module>

            <div className="lg:col-span-2"><Module icon={FileText} title="Active proofs" delay={.05} action={<More to="/orders?status=proof">All proofs</More>}>
              {data.activeProofs.length === 0 ? <p className="py-6 text-center text-sm text-ink-500">No proofs waiting. They appear here as soon as an order is paid.</p> : (
                <div className="grid gap-4 sm:grid-cols-2">{data.activeProofs.slice(0, 4).map((p) => (
                  <Link key={p.orderId} to={`/orders/${p.orderId}`} className="group flex gap-3 rounded-xl border border-paper-300 p-3 transition hover:-translate-y-0.5 hover:border-copper-500 hover:shadow-lift">
                    <div className="dh-checker w-24 shrink-0 overflow-hidden rounded-lg border border-paper-300"><AuthedImage path={p.previewUrl} ratio="4/3" alt="" /></div>
                    <div className="min-w-0"><div className="truncate font-display text-sm font-bold">{p.productName}</div><div className="font-mono text-[11px] text-ink-500">{p.orderNumber}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5"><Badge tone="bg-ink-900 text-paper border-ink-900">v{p.version}</Badge><ProofBadge status={p.approved ? 'approved' : p.status} /></div></div></Link>))}</div>)}
            </Module></div>

            <div className="lg:col-span-2"><Module icon={Clock} title="Order history" delay={.05} action={<More to="/orders">View all</More>}>
              {data.orders.recent.length === 0 ? <EmptyState icon={Boxes} title="No orders yet" text="Configure a product and get an instant price." action={<Button as={Link} to="/products" size="sm">Browse products</Button>} /> : (
                <ul className="divide-y divide-paper-300">{data.orders.recent.map((o) => (
                  <li key={o._id}><Link to={`/orders/${o._id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 transition hover:bg-paper-200/50 sm:px-2">
                    <div className="min-w-0 flex-1"><div className="truncate font-display text-sm font-bold">{o.productName}</div><div className="font-mono text-[11px] text-ink-500">{o.orderNumber} · {dateFmt(o.createdAt)}</div></div>
                    <span className="font-mono text-sm font-semibold">{money(o.pricing.totalMinor, o.pricing.currency)}</span><StatusBadge status={o.status} /></Link></li>))}</ul>)}
            </Module></div>

            <Module icon={Receipt} title="Invoices" delay={.1}>
              {data.invoices.length === 0 ? <p className="py-6 text-center text-sm text-ink-500">Invoices appear after your first payment.</p> : (
                <ul className="space-y-2">{data.invoices.slice(0, 5).map((i) => (
                  <li key={i.orderId} className="flex items-center gap-3 rounded-xl border border-paper-300 px-3 py-2.5"><div className="min-w-0 flex-1"><div className="truncate font-mono text-xs font-semibold">{i.invoiceNumber}</div><div className="text-[11px] text-ink-500">{dateFmt(i.date)} · {money(i.totalMinor, i.currency)}</div></div>
                    <button className="grid h-8 w-8 place-items-center rounded-lg border border-paper-300 transition hover:border-copper-500 hover:text-copper-600" aria-label={`Download ${i.invoiceNumber}`} onClick={() => downloadFile(i.downloadUrl, `${i.invoiceNumber}.pdf`).catch((e) => toast.error(errorText(e)))}><Download size={15} /></button></li>))}</ul>)}
            </Module>

            <div className="lg:col-span-2"><Module icon={Palette} title="Saved designs" delay={.05} action={<More to="/designs">Manage</More>}>
              {data.savedDesigns.length === 0 ? <p className="py-6 text-center text-sm text-ink-500">Designs you save in the editor are kept here.</p> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{data.savedDesigns.slice(0, 4).map((d) => <DesignThumb key={d.id} d={d} />)}</div>}
            </Module></div>

            <Module icon={Repeat} title="One-click reorder" delay={.1}>
              {data.reorderable.length === 0 ? <p className="py-6 text-center text-sm text-ink-500">Once an order is approved you can repeat it here without redesigning.</p> : (
                <ul className="space-y-2">{data.reorderable.slice(0, 4).map((r) => (
                  <li key={r.orderId} className="flex items-center gap-3 rounded-xl border border-paper-300 px-3 py-2.5"><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{r.productName}</div><div className="font-mono text-[11px] text-ink-500">{r.quantity} pcs · {money(r.totalMinor)}</div></div>
                    <Button size="sm" variant="dark" loading={reorder.isPending && reorder.variables === r.orderId} onClick={() => reorder.mutate(r.orderId)}>Reorder</Button></li>))}</ul>)}
            </Module>
          </div>
        </>
      )}
    </>
  );
}
