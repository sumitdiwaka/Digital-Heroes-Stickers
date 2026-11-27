import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, MessageSquare, Palette, Printer, Repeat, Upload, XCircle } from 'lucide-react';
import { api, downloadFile, errorText } from '../../lib/api';
import { Badge, Button, ErrorBox, Modal, Skeleton, Textarea, Tilt, cx } from '../../components/ui';
import { AuthedImage, LockNote, OrderStepper, PriceBreakdown, ProofBadge, StatusBadge } from '../../components/Shared';
import { dateFmt, dateTime, money, STATUS } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../lib/hooks';

const Card = ({ title, icon: Icon, children, className, right }) => (
  <section className={cx('card p-5 sm:p-6', className)}><header className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2.5 font-display text-lg font-bold">{Icon && <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-900 text-copper-400"><Icon size={16} /></span>}{title}</h2>{right}</header>{children}</section>
);

/* ------------------------------------------------------------ CSV variable data */
function CsvPanel({ order, onDone }) {
  const toast = useToast(); const ref = useRef(null);
  const [result, setResult] = useState(null); const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  const has = order.variableData?.rowCount;
  const send = async (file) => {
    if (!file) return; setBusy(true); setErr(null);
    try { const r = await api.upload(`/api/orders/${order._id}/csv`, file); setResult(r); toast.success(`${r.rowCount} rows merged - price updated.`); onDone(); }
    catch (e) { setErr(e); toast.error(e.message); } finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  };
  return (
    <Card title="Bulk data (CSV)" icon={FileSpreadsheet} right={has ? <Badge tone="bg-sage-100 text-sage-700 border-sage-300">{has} rows</Badge> : null}>
      <p className="text-sm text-ink-500">Upload a CSV and we create one artwork per row. Quantity becomes the number of rows. Long text shrinks to fit automatically.</p>
      {has && !result && <p className="mt-3 rounded-xl bg-sage-50 px-3 py-2 text-sm text-sage-700">Using <b>{order.variableData.originalName}</b> · columns: {order.variableData.columns.join(', ')}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="light" size="sm" onClick={() => downloadFile(`/api/orders/${order._id}/csv-template`, `${order.orderNumber}_template.csv`).catch((e) => toast.error(errorText(e)))}><Download size={15} />CSV template</Button>
        <Button size="sm" loading={busy} onClick={() => ref.current?.click()}><Upload size={15} />{has ? 'Replace CSV' : 'Upload CSV'}</Button>
        <input ref={ref} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => send(e.target.files?.[0])} />
      </div>
      {err && <div className="mt-4 rounded-xl border border-signal-red/30 bg-signal-red/5 p-3 text-sm text-signal-red"><b>{err.message}</b>{err.details?.required && <div className="mt-1 text-xs">Required columns: {err.details.required.join(', ')} · found: {err.details.found.join(', ')}</div>}</div>}
      {result && (<div className="mt-4 space-y-2 text-sm"><p className="flex items-center gap-2 font-semibold text-sage-700"><CheckCircle2 size={16} />{result.rowCount} rows accepted</p>
        {result.fieldsUsingDefaultText?.length > 0 && <p className="text-xs text-ink-500">Fields not in your CSV use their default text: {result.fieldsUsingDefaultText.join(', ')}</p>}
        {result.unusedColumns?.length > 0 && <p className="text-xs text-ink-500">Ignored columns: {result.unusedColumns.join(', ')}</p>}
        <div className="overflow-x-auto rounded-xl border border-paper-300"><table className="w-full text-left text-xs"><thead className="bg-paper-200"><tr>{result.columns.map((c) => <th key={c} className="px-3 py-2 font-mono">{c}</th>)}</tr></thead><tbody>{result.sampleRows.map((r, i) => <tr key={i} className="border-t border-paper-300">{result.columns.map((c) => <td key={c} className="px-3 py-1.5">{r[c]}</td>)}</tr>)}</tbody></table></div></div>)}
    </Card>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const nav = useNavigate(); const toast = useToast(); const qc = useQueryClient();
  const upRef = useRef(null);
  const [ver, setVer] = useState(null);
  const [approveOpen, setApproveOpen] = useState(false); const [changesOpen, setChangesOpen] = useState(false); const [note, setNote] = useState(''); const [cancelOpen, setCancelOpen] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['order', id], queryFn: () => api.get(`/api/orders/${id}`),
    refetchInterval: (q) => (['order', 'artwork'].includes(q.state.data?.order.status) ? 2500 : false),
  });
  const order = data?.order; const proofs = data?.proofs || [];
  usePageTitle(order?.orderNumber);
  const { data: pdata } = useQuery({ queryKey: ['product', order?.product], enabled: !!order, queryFn: () => api.get(`/api/products/${order.product}`) });
  const { data: log } = useQuery({ queryKey: ['approval-log', id, order?.latestProofVersion, order?.approvedProofVersion], enabled: !!order && order.latestProofVersion > 0, queryFn: () => api.get(`/api/orders/${id}/approval-log`) });

  const refresh = () => { qc.invalidateQueries({ queryKey: ['order', id] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['orders'] }); };
  const approve = useMutation({ mutationFn: (v) => api.post(`/api/orders/${id}/proofs/${v}/approve`), onSuccess: () => { toast.success('Proof approved - production files are being prepared.'); setApproveOpen(false); refresh(); }, onError: (e) => { toast.error(errorText(e)); setApproveOpen(false); } });
  const changes = useMutation({ mutationFn: ({ v, n }) => api.post(`/api/orders/${id}/proofs/${v}/request-changes`, { note: n }), onSuccess: () => { toast.success('Change request sent.'); setChangesOpen(false); setNote(''); refresh(); }, onError: (e) => toast.error(errorText(e)) });
  const cancel = useMutation({ mutationFn: () => api.del(`/api/orders/${id}`), onSuccess: () => { toast.success('Quote cancelled.'); setCancelOpen(false); refresh(); }, onError: (e) => toast.error(errorText(e)) });
  const reorder = useMutation({ mutationFn: () => api.post(`/api/orders/${id}/reorder`, { checkout: false }), onSuccess: (d) => { toast.success(d.artworkCarriedOver ? 'Reorder ready - approved artwork carried over.' : 'Reorder ready.'); nav(`/checkout/${d.order._id}`); }, onError: (e) => toast.error(errorText(e)) });

  const replaceArtwork = async (file) => {
    if (!file) return;
    try {
      const c = order.config; const config = { material: c.material, orientation: c.orientation, ...(c.sizeKey ? { sizeKey: c.sizeKey } : { widthMm: c.widthMm, heightMm: c.heightMm }) };
      const { design } = await api.post('/api/designs', { name: file.name.replace(/\.[^.]+$/, '').slice(0, 100) || 'Artwork', product: order.product, config, elements: [] });
      await api.upload(`/api/designs/${design._id}/artwork`, file);
      await api.put(`/api/orders/${id}/artwork`, { design: design._id });
      toast.success('New artwork uploaded - a new proof is being created.'); refresh();
    } catch (e) { toast.error(errorText(e)); } finally { if (upRef.current) upRef.current.value = ''; }
  };

  if (error) return <ErrorBox error={error} retry={refetch} />;
  if (isLoading || !order) return <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;

  const snap = order.designSnapshot || {};
  const hasArt = !!(snap.elements?.length || snap.upload?.fileKey);
  const isEditor = snap.source !== 'upload';
  const latest = order.latestProofVersion; const shown = ver || latest;
  const current = proofs.find((p) => p.version === shown);
  const reviewable = order.status === 'proof' && !order.filesUnlocked && current && current.version === latest && current.status === 'pending';
  const changesPending = order.status === 'proof' && !order.filesUnlocked && proofs.find((p) => p.version === latest)?.status === 'changes_requested';
  const csv = pdata?.product?.supportsVariableData;
  const designerUrl = `/designer/${pdata?.product?.slug || ''}?order=${order._id}`;

  return (
    <>
      <Link to="/orders" className="mb-5 inline-flex items-center gap-2 text-sm text-ink-500 hover:text-copper-600"><ArrowLeft size={15} />All orders</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold sm:text-4xl">{order.productName}</h1><StatusBadge status={order.status} /></div>
          <p className="mt-2 font-mono text-xs text-ink-500">{order.orderNumber} · placed {dateTime(order.createdAt)} · {STATUS[order.status]?.hint}</p></div>
        <div className="flex flex-wrap gap-2">
          {order.status === 'quote' && <><Button as={Link} to={`/checkout/${order._id}`} disabled={!hasArt}>Pay {money(order.pricing.totalMinor, order.pricing.currency)}</Button><Button variant="light" onClick={() => setCancelOpen(true)}>Cancel quote</Button></>}
          {order.payment.status === 'paid' && <Button variant="light" onClick={() => downloadFile(`/api/orders/${order._id}/invoice`, `${order.payment.invoiceNumber}.pdf`).catch((e) => toast.error(errorText(e)))}><Download size={16} />Invoice</Button>}
          {['production', 'completed'].includes(order.status) || order.approvedProofVersion != null ? <Button variant="dark" loading={reorder.isPending} onClick={() => reorder.mutate()}><Repeat size={16} />Reorder</Button> : null}
        </div>
      </div>

      <div className="card mb-6 p-5 sm:p-7"><OrderStepper status={order.status} /></div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {order.status === 'quote' && !hasArt && (
            <div className="flex items-start gap-3 rounded-2xl border border-copper-300 bg-copper-50 p-4 text-sm"><AlertTriangle className="mt-0.5 shrink-0 text-copper-600" size={18} /><div><b>Add artwork to continue.</b> Design it in the editor or upload finished files, then pay to receive your proof.<div className="mt-3 flex flex-wrap gap-2"><Button size="sm" as={Link} to={designerUrl}><Palette size={15} />Open designer</Button><Button size="sm" variant="light" onClick={() => upRef.current?.click()}><Upload size={15} />Upload artwork</Button></div></div></div>
          )}

          {order.status === 'quote' && csv && <CsvPanel order={order} onDone={refresh} />}

          {/* ------------------------------------------------ proofs */}
          {latest > 0 && (
            <Card title={order.filesUnlocked ? `Approved proof v${order.approvedProofVersion}` : 'Proof review'} icon={CheckCircle2}
              right={<div className="flex flex-wrap gap-1.5">{proofs.map((p) => <button key={p.version} onClick={() => setVer(p.version)} className={cx('rounded-lg border px-2.5 py-1 font-mono text-xs font-bold transition', shown === p.version ? 'border-ink-900 bg-ink-900 text-paper' : 'border-paper-300 hover:border-copper-500')}>v{p.version}</button>)}</div>}>
              <motion.div key={shown} initial={{ opacity: 0, rotateX: 8, scale: .98 }} animate={{ opacity: 1, rotateX: 0, scale: 1 }} style={{ transformPerspective: 1000 }}>
                <Tilt max={3} glare={false} className="rounded-2xl"><div className="dh-checker overflow-hidden rounded-2xl border border-paper-300 shadow-lift"><AuthedImage path={`/api/orders/${order._id}/proofs/${shown}/preview.png`} alt={`Proof version ${shown}`} className="max-h-[560px] min-h-[220px]" ratio={`${order.config.widthMm + 2 * order.printSpec.bleedMm}/${order.config.heightMm + 2 * order.printSpec.bleedMm}`} /></div></Tilt>
              </motion.div>
              {current && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-500"><ProofBadge status={current.status} /><span>created {dateTime(current.createdAt)}</span>{current.origin === 'carried_over' && <Badge tone="bg-sage-100 text-sage-700 border-sage-300">carried over</Badge>}{current.changeRequestNote && <span className="basis-full rounded-lg bg-signal-red/5 px-3 py-2 text-signal-red">Your note: “{current.changeRequestNote}”</span>}</div>}
              <p className="mt-3 text-xs text-ink-500">Dashed red line = trim. Everything outside it is bleed and will be cut off.</p>

              {reviewable && (<div className="mt-5 flex flex-wrap gap-3"><Button onClick={() => setApproveOpen(true)}><CheckCircle2 size={17} />Approve proof v{shown}</Button><Button variant="light" onClick={() => setChangesOpen(true)}><MessageSquare size={17} />Request changes</Button></div>)}
              {changesPending && (<div className="mt-5 rounded-xl border border-copper-300 bg-copper-50 p-4 text-sm"><b>Changes requested.</b> Update your artwork to get the next proof version.<div className="mt-3 flex flex-wrap gap-2">{isEditor && <Button size="sm" as={Link} to={designerUrl}><Palette size={15} />Edit in designer</Button>}<Button size="sm" variant="light" onClick={() => upRef.current?.click()}><Upload size={15} />Upload new artwork</Button></div></div>)}
              {order.filesUnlocked && <div className="mt-5"><LockNote>Approved - production files are generated from this exact version. Artwork can no longer be changed.</LockNote></div>}
            </Card>
          )}
          <input ref={upRef} type="file" accept=".pdf,.svg,.ai,.png,.jpg,.jpeg" className="hidden" onChange={(e) => replaceArtwork(e.target.files?.[0])} />

          {['order', 'artwork'].includes(order.status) && <div className="card flex items-center gap-4 p-6"><div className="cube-scene !h-12 !w-12 scale-75"><div className="cube">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="cube-face" />)}</div></div><div><div className="font-display text-lg font-bold">Preparing your proof…</div><p className="text-sm text-ink-500">This page updates automatically.</p></div></div>}

          {log?.length > 0 && (
            <Card title="Approval log" icon={MessageSquare}>
              <ol className="relative space-y-4 border-l-2 border-paper-300 pl-5">{log.map((l) => (
                <li key={l._id} className="relative"><span className={cx('absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-paper-100', l.action === 'approved' || l.action === 'carried_over' ? 'bg-sage-500' : l.action === 'changes_requested' ? 'bg-signal-red' : 'bg-copper-500')} />
                  <div className="text-sm"><b className="font-display">v{l.version}</b> · {{ created: 'proof created', approved: 'approved', changes_requested: 'changes requested', carried_over: 'approval carried over' }[l.action]}{l.byName && <span className="text-ink-500"> by {l.byName}</span>}</div>
                  <div className="font-mono text-[11px] text-ink-500">{dateTime(l.at)}</div>{l.note && l.action !== 'created' && <div className="mt-1 text-xs text-ink-500">“{l.note}”</div>}</li>))}</ol>
            </Card>
          )}
        </div>

        {/* ------------------------------------------------ summary */}
        <aside className="space-y-6 lg:sticky lg:top-24">
          <Card title="Order summary" icon={Printer}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[['Size', `${order.config.widthMm} × ${order.config.heightMm} mm`], ['Orientation', order.config.orientation], ['Material', order.config.material], ['Quantity', order.quantity], ['Bleed', `${order.printSpec.bleedMm} mm`], ['Resolution', `${order.printSpec.dpi} DPI`]].map(([k, v]) => <div key={k}><dt className="label !mb-0.5">{k}</dt><dd className="font-semibold capitalize">{v}</dd></div>)}
            </dl>
            <div className="my-5 border-t border-paper-300" />
            <PriceBreakdown pricing={order.pricing} quantity={order.quantity} />
            <div className="mt-4 flex items-center justify-between text-xs text-ink-500"><span>Payment</span><Badge tone={order.payment.status === 'paid' ? 'bg-sage-100 text-sage-700 border-sage-300' : 'bg-paper-200 text-ink-600 border-paper-300'}>{order.payment.status}</Badge></div>
            {order.payment.invoiceNumber && <div className="mt-2 flex items-center justify-between text-xs text-ink-500"><span>Invoice</span><span className="font-mono">{order.payment.invoiceNumber}</span></div>}
            {order.notes && <p className="mt-4 rounded-lg bg-paper-200/70 p-3 text-xs text-ink-600">Note: {order.notes}</p>}
          </Card>
          {hasArt && order.status === 'quote' && <Card title="Artwork" icon={Palette}><p className="text-sm text-ink-500">{snap.source === 'upload' ? <>Uploaded file: <b>{snap.upload?.originalName}</b></> : `Designed in the editor · ${snap.elements.length} elements`}</p><div className="mt-3 flex flex-wrap gap-2">{isEditor && <Button as={Link} to={designerUrl} size="sm" variant="light"><Palette size={14} />Edit design</Button>}<Button size="sm" variant="light" onClick={() => upRef.current?.click()}><Upload size={14} />Replace file</Button></div></Card>}
        </aside>
      </div>

      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title={`Approve proof v${shown}?`} footer={<><Button variant="light" onClick={() => setApproveOpen(false)}>Not yet</Button><Button loading={approve.isPending} onClick={() => approve.mutate(shown)}><CheckCircle2 size={16} />Yes, approve</Button></>}>
        <p className="text-sm text-ink-600">You are confirming that spelling, sizes, colours and layout are correct. Production files will be generated from <b>this exact version</b> and the artwork can no longer be changed.</p>
      </Modal>
      <Modal open={changesOpen} onClose={() => setChangesOpen(false)} title="Request changes" footer={<><Button variant="light" onClick={() => setChangesOpen(false)}>Cancel</Button><Button loading={changes.isPending} disabled={note.trim().length < 3} onClick={() => changes.mutate({ v: shown, n: note.trim() })}>Send request</Button></>}>
        <p className="mb-3 text-sm text-ink-500">Tell us what to change on v{shown}. You can then update the artwork to create the next version.</p>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please make the logo bigger and move the date up." maxLength={1000} />
      </Modal>
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this quote?" footer={<><Button variant="light" onClick={() => setCancelOpen(false)}>Keep it</Button><Button variant="dark" loading={cancel.isPending} onClick={() => cancel.mutate()}><XCircle size={16} />Cancel quote</Button></>}>
        <p className="text-sm text-ink-600">The quote will be cancelled. You can always create a new one - your saved designs are kept.</p>
      </Modal>
    </>
  );
}
