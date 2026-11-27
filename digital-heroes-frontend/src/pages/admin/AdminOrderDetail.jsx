import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Archive, ArrowLeft, ArrowRight, Download, FileArchive, Lock, RefreshCw, Unlock, Upload, XCircle, FilePlus2 } from 'lucide-react';
import { api, downloadFile, errorText } from '../../lib/api';
import { Badge, Button, ErrorBox, Modal, PageHeader, Progress, Skeleton, Textarea } from '../../components/ui';
import { AuthedImage, LockNote, OrderStepper, PriceBreakdown, ProofBadge, StatusBadge } from '../../components/Shared';
import { Panel } from '../../components/AdminParts';
import { bytes, dateTime, money, nextStage, STATUS } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../lib/hooks';

const Row = ({ k, v }) => <div className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-ink-500">{k}</span><span className="text-right font-medium">{v}</span></div>;

export default function AdminOrderDetail() {
  const { id } = useParams(); const toast = useToast(); const qc = useQueryClient(); const upRef = useRef(null);
  const [advOpen, setAdvOpen] = useState(false); const [note, setNote] = useState(''); const [cancelOpen, setCancelOpen] = useState(false); const [png, setPng] = useState(true); const [ver, setVer] = useState(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['a-order', id], queryFn: () => api.get(`/api/admin/orders/${id}`),
    refetchInterval: (q) => (['queued', 'running'].includes(q.state.data?.order.printJob?.status) ? 1500 : false),
  });
  const o = data?.order; usePageTitle(o?.orderNumber);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['a-order', id] }); qc.invalidateQueries({ queryKey: ['a-orders'] }); qc.invalidateQueries({ queryKey: ['a-dash'] }); };
  const fail = (e) => toast.error(errorText(e));

  const advance = useMutation({ mutationFn: (toStatus) => api.post(`/api/admin/orders/${id}/advance`, { ...(toStatus ? { toStatus } : {}), note: note || undefined }), onSuccess: () => { toast.success('Job updated - customer notified.'); setAdvOpen(false); setCancelOpen(false); setNote(''); refresh(); }, onError: fail });
  const regen = useMutation({ mutationFn: () => api.post(`/api/admin/orders/${id}/regenerate-files?png=${png}`), onSuccess: () => { toast.success('Print job queued.'); refresh(); }, onError: fail });
  const arch = useMutation({ mutationFn: (a) => api.post(`/api/admin/orders/${id}/${a}`), onSuccess: () => { toast.success('Done.'); refresh(); }, onError: fail });
  const newProof = useMutation({ mutationFn: async (file) => { if (file) return api.upload(`/api/admin/orders/${id}/proofs`, file); return api.post(`/api/admin/orders/${id}/proofs`, {}); }, onSuccess: () => { toast.success('New proof version created.'); refresh(); }, onError: fail, onSettled: () => { if (upRef.current) upRef.current.value = ''; } });

  if (error) return <ErrorBox error={error} retry={refetch} />;
  if (isLoading || !o) return <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;
  const next = nextStage(o.status); const pj = o.printJob || {}; const cust = o.user;
  const canProof = o.payment.status === 'paid' && !o.filesUnlocked && ['artwork', 'proof'].includes(o.status);
  const cancellable = ['quote', 'order', 'artwork', 'proof'].includes(o.status);
  const shown = ver || o.latestProofVersion;
  const advLabel = { order: 'Mark placed', artwork: 'Start artwork', proof: 'Generate proof', production: 'Send to production', completed: 'Mark completed' }[next];
  const blocked = next === 'production' && !o.filesUnlocked ? 'Locked: customer has not approved a proof' : o.payment.status !== 'paid' && next ? 'Locked: order is unpaid' : null;

  return (
    <>
      <Link to="/admin/orders" className="mb-5 inline-flex items-center gap-2 text-sm text-ink-500 hover:text-copper-600"><ArrowLeft size={15} />Job pipeline</Link>
      <PageHeader kicker={o.orderNumber} title={o.productName} actions={<>
        {next && <Button disabled={!!blocked} onClick={() => setAdvOpen(true)}>{advLabel}<ArrowRight size={16} /></Button>}
        {cancellable && <Button variant="light" onClick={() => setCancelOpen(true)}><XCircle size={16} />Cancel</Button>}
        {['completed', 'cancelled'].includes(o.status) && <Button variant="light" loading={arch.isPending} onClick={() => arch.mutate(o.archived ? 'unarchive' : 'archive')}><Archive size={16} />{o.archived ? 'Unarchive' : 'Archive'}</Button>}
      </>}><div className="mt-3 flex flex-wrap items-center gap-3"><StatusBadge status={o.status} />{o.archived && <Badge>archived</Badge>}<span className="font-mono text-xs text-ink-500">{dateTime(o.createdAt)}</span>{blocked && <span className="flex items-center gap-1.5 text-xs text-copper-600"><Lock size={13} />{blocked}</span>}</div></PageHeader>

      <div className="card mb-6 p-5 sm:p-7"><OrderStepper status={o.status} /></div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Panel title="Production files" right={o.filesUnlocked ? <Badge tone="bg-sage-100 text-sage-700 border-sage-300"><Unlock size={11} />Unlocked · proof v{o.approvedProofVersion}</Badge> : <Badge tone="bg-paper-200 text-ink-500 border-paper-300"><Lock size={11} />Locked</Badge>}>
            {!o.filesUnlocked ? <LockNote>{data.filesLockedReason || 'Locked until the customer approves a proof.'} Print-ready PDFs and CSV artwork are generated only after approval.</LockNote> : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={pj.status === 'done' ? 'bg-sage-100 text-sage-700 border-sage-300' : pj.status === 'failed' ? 'bg-signal-red/10 text-signal-red border-signal-red/30' : 'bg-copper-100 text-copper-700 border-copper-300'}>job: {pj.status}</Badge>
                  {['queued', 'running'].includes(pj.status) && <div className="min-w-[160px] flex-1"><Progress value={pj.total ? (pj.progress / pj.total) * 100 : 8} /><span className="mt-1 block font-mono text-[10px] text-ink-500">{pj.progress}/{pj.total} files</span></div>}
                  {pj.error && <span className="text-xs text-signal-red">{pj.error}</span>}
                </div>
                {pj.warnings?.length > 0 && <div className="space-y-1.5 rounded-xl border border-copper-300 bg-copper-50 p-3 text-xs text-copper-700">{pj.warnings.slice(0, 6).map((w, i) => <div key={i} className="flex gap-2"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{w}</div>)}{pj.warnings.length > 6 && <div>…and {pj.warnings.length - 6} more</div>}</div>}
                <div className="flex flex-wrap gap-3">
                  <Button disabled={pj.status !== 'done'} onClick={() => downloadFile(`/api/admin/orders/${id}/files.zip`, `${o.orderNumber}_${o.productType}_files.zip`).catch(fail)}><FileArchive size={16} />Download all (.zip)</Button>
                  <Button variant="light" loading={regen.isPending} disabled={['queued', 'running'].includes(pj.status)} onClick={() => regen.mutate()}><RefreshCw size={16} />Regenerate</Button>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-500"><input type="checkbox" className="h-4 w-4 accent-copper-500" checked={png} onChange={(e) => setPng(e.target.checked)} />include PNGs</label>
                </div>
                {data.files.length > 0 && <div className="overflow-hidden rounded-xl border border-paper-300"><div className="max-h-80 overflow-y-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-paper-200"><tr><th className="px-3 py-2 font-mono">File</th><th className="px-3 py-2 font-mono">Size</th><th className="w-12" /></tr></thead><tbody>
                  {data.files.map((f) => <tr key={f.name} className="border-t border-paper-300"><td className="max-w-[260px] truncate px-3 py-2 font-mono" title={f.name}>{f.name}</td><td className="whitespace-nowrap px-3 py-2 text-ink-500">{bytes(f.size)}</td><td className="px-2"><button aria-label={`Download ${f.name}`} className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-copper-100 hover:text-copper-600" onClick={() => downloadFile(f.downloadUrl, f.name).catch(fail)}><Download size={14} /></button></td></tr>)}</tbody></table></div></div>}
              </div>
            )}
          </Panel>

          <Panel title="Proofs" right={canProof && <div className="flex gap-2"><Button size="sm" variant="light" loading={newProof.isPending && !newProof.variables} onClick={() => newProof.mutate(undefined)}><FilePlus2 size={14} />Regenerate</Button><Button size="sm" variant="light" onClick={() => upRef.current?.click()}><Upload size={14} />Manual proof</Button></div>}>
            <input ref={upRef} type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && newProof.mutate(e.target.files[0])} />
            {data.proofs.length === 0 ? <p className="text-sm text-ink-500">No proofs yet.</p> : (
              <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr]">
                <div className="dh-checker overflow-hidden rounded-xl border border-paper-300"><AuthedImage path={`/api/orders/${id}/proofs/${shown}/preview.png`} alt={`Proof v${shown}`} ratio={`${o.config.widthMm + 2 * o.printSpec.bleedMm}/${o.config.heightMm + 2 * o.printSpec.bleedMm}`} /></div>
                <ul className="space-y-2">{[...data.proofs].reverse().map((p) => <li key={p._id}><button onClick={() => setVer(p.version)} className={`w-full rounded-xl border p-3 text-left transition ${shown === p.version ? 'border-copper-500 bg-copper-50' : 'border-paper-300 hover:border-copper-300'}`}><div className="flex items-center justify-between"><b className="font-mono text-sm">v{p.version}</b><ProofBadge status={p.status} /></div><div className="mt-1 text-[11px] text-ink-500">{p.origin.replace('_', ' ')} · {dateTime(p.createdAt)}</div>{p.changeRequestNote && <div className="mt-2 rounded-lg bg-signal-red/5 p-2 text-xs text-signal-red">“{p.changeRequestNote}”</div>}</button></li>)}</ul>
              </div>)}
          </Panel>

          <Panel title="Approval log">
            {data.approvalLog.length === 0 ? <p className="text-sm text-ink-500">No activity yet.</p> : <ol className="relative space-y-4 border-l-2 border-paper-300 pl-5">{data.approvalLog.map((l) => <li key={l._id} className="relative"><span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-paper-100 ${['approved', 'carried_over'].includes(l.action) ? 'bg-sage-500' : l.action === 'changes_requested' ? 'bg-signal-red' : 'bg-copper-500'}`} /><div className="text-sm"><b>v{l.version}</b> {l.action.replace('_', ' ')}{l.byName && <span className="text-ink-500"> · {l.byName} ({l.byRole})</span>}</div><div className="font-mono text-[11px] text-ink-500">{dateTime(l.at)}{l.ip ? ` · ${l.ip}` : ''}</div>{l.note && l.action !== 'created' && <div className="text-xs text-ink-500">“{l.note}”</div>}</li>)}</ol>}
          </Panel>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6">
          <Panel title="Customer"><div className="font-display text-base font-bold">{cust.name}</div><a className="text-sm text-copper-600 hover:underline" href={`mailto:${cust.email}`}>{cust.email}</a>
            <div className="mt-3 divide-y divide-paper-300 border-t border-paper-300 pt-2">{cust.company && <Row k="Company" v={cust.company} />}{cust.phone && <Row k="Phone" v={cust.phone} />}{cust.gstin && <Row k="Tax ID" v={cust.gstin} />}</div></Panel>
          <Panel title="Job spec"><div className="divide-y divide-paper-300"><Row k="Division" v={o.divisionSlug} /><Row k="Size" v={`${o.config.widthMm} × ${o.config.heightMm} mm`} /><Row k="Material" v={o.config.material} /><Row k="Orientation" v={o.config.orientation} /><Row k="Quantity" v={o.quantity} /><Row k="Bleed / safe" v={`${o.printSpec.bleedMm} / ${o.printSpec.safeMarginMm} mm`} /><Row k="Resolution" v={`${o.printSpec.dpi} DPI`} />
            {o.variableData?.rowCount && <Row k="CSV" v={`${o.variableData.rowCount} rows`} />}<Row k="Artwork" v={o.designSnapshot?.source === 'upload' ? `upload (${o.designSnapshot.upload?.ext})` : 'editor design'} />{o.reorderOf && <Row k="Reorder" v="yes" />}</div>{o.notes && <p className="mt-3 rounded-lg bg-paper-200/70 p-3 text-xs">Customer note: {o.notes}</p>}</Panel>
          <Panel title="Payment"><PriceBreakdown pricing={o.pricing} quantity={o.quantity} /><div className="mt-4 divide-y divide-paper-300 border-t border-paper-300 pt-2"><Row k="Status" v={o.payment.status} /><Row k="Provider" v={o.payment.provider || '-'} />{o.payment.invoiceNumber && <Row k="Invoice" v={<span className="font-mono">{o.payment.invoiceNumber}</span>} />}{o.payment.paidAt && <Row k="Paid" v={dateTime(o.payment.paidAt)} />}</div></Panel>
        </aside>
      </div>

      <Modal open={advOpen} onClose={() => setAdvOpen(false)} title={`${advLabel}?`} footer={<><Button variant="light" onClick={() => setAdvOpen(false)}>Cancel</Button><Button loading={advance.isPending} onClick={() => advance.mutate()}>{advLabel}</Button></>}>
        <p className="mb-3 text-sm text-ink-600">Moves <b>{o.orderNumber}</b> from <b>{STATUS[o.status].label}</b> to <b>{STATUS[next]?.label}</b>. The customer receives an email.</p>
        <Textarea placeholder="Optional internal note…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Modal>
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this job?" footer={<><Button variant="light" onClick={() => setCancelOpen(false)}>Keep</Button><Button variant="dark" loading={advance.isPending} onClick={() => advance.mutate('cancelled')}>Cancel job</Button></>}>
        <p className="text-sm text-ink-600">The order is marked cancelled. This cannot be undone. Refunds are handled in your payment provider.</p>
      </Modal>
    </>
  );
}
