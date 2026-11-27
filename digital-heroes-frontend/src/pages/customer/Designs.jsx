import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Palette, Pencil, ShoppingBag, Trash2 } from 'lucide-react';
import { api, errorText } from '../../lib/api';
import { Badge, Button, EmptyState, ErrorBox, Field, Input, Modal, PageHeader, Reveal, Skeleton, Tilt } from '../../components/ui';
import { AuthedImage } from '../../components/Shared';
import { dateFmt } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { useInView, usePageTitle } from '../../lib/hooks';

function Card({ d, onOrder, onDelete }) {
  const [ref, seen] = useInView();
  return (
    <Tilt max={6} className="h-full rounded-2xl">
      <div ref={ref} className="card flex h-full flex-col overflow-hidden">
        <div className="dh-checker border-b border-paper-300">{seen ? <AuthedImage path={`/api/designs/${d._id}/preview.png`} ratio={`${d.config?.widthMm || 4}/${d.config?.heightMm || 3}`} alt={d.name} className="max-h-60" /> : <div style={{ aspectRatio: '4/3' }} />}</div>
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2"><h3 className="truncate font-display text-base font-bold">{d.name}</h3>{d.approved && <Badge tone="bg-sage-100 text-sage-700 border-sage-300"><CheckCircle2 size={11} />Approved</Badge>}</div>
          <p className="mt-1 text-xs text-ink-500">{d.product?.name} · {d.config?.widthMm}×{d.config?.heightMm} mm · {d.config?.material}</p>
          <p className="font-mono text-[11px] text-ink-500">{d.source === 'upload' ? 'uploaded file' : 'editor design'} · {dateFmt(d.updatedAt)}</p>
          <div className="mt-4 flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => onOrder(d)}><ShoppingBag size={14} />Order</Button>
            {d.source !== 'upload' && <Button size="sm" variant="light" as={Link} to={`/designer/${d.product?.slug}?design=${d._id}`}><Pencil size={14} />Edit</Button>}
            <button className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-ink-500 transition hover:bg-signal-red/10 hover:text-signal-red" onClick={() => onDelete(d)} aria-label={`Delete ${d.name}`}><Trash2 size={16} /></button>
          </div>
        </div>
      </div>
    </Tilt>
  );
}

export default function Designs() {
  usePageTitle('Saved designs');
  const nav = useNavigate(); const toast = useToast(); const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['designs'], queryFn: () => api.get('/api/designs') });
  const [ordering, setOrdering] = useState(null); const [qty, setQty] = useState('100'); const [busy, setBusy] = useState(false); const [del, setDel] = useState(null);

  const order = async () => {
    setBusy(true);
    try {
      const c = ordering.config; const config = { material: c.material, orientation: c.orientation, ...(c.sizeKey ? { sizeKey: c.sizeKey } : { widthMm: c.widthMm, heightMm: c.heightMm }) };
      const { order: o } = await api.post('/api/orders', { product: ordering.product.slug, config, quantity: Number(qty), design: ordering._id });
      toast.success('Quote created.'); nav(`/orders/${o._id}`);
    } catch (e) { toast.error(errorText(e)); setBusy(false); }
  };
  const remove = useMutation({ mutationFn: (id) => api.del(`/api/designs/${id}`), onSuccess: () => { toast.success('Design deleted.'); setDel(null); qc.invalidateQueries({ queryKey: ['designs'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); }, onError: (e) => toast.error(errorText(e)) });

  return (
    <>
      <PageHeader kicker="Artwork library" title="Saved" accent="designs." actions={<Button as={Link} to="/products"><Palette size={16} />New design</Button>} />
      {error && <ErrorBox error={error} retry={refetch} />}
      {isLoading && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}</div>}
      {data && !data.length && <EmptyState icon={Palette} title="No saved designs yet" text="Pick a product, design it in the editor and save it - it will live here for quick reordering." action={<Button as={Link} to="/products" size="sm">Start designing</Button>} />}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data?.map((d, i) => <Reveal key={d._id} delay={Math.min(i, 5) * .05}><Card d={d} onOrder={(x) => { setOrdering(x); setQty('100'); }} onDelete={setDel} /></Reveal>)}</div>

      <Modal open={!!ordering} onClose={() => setOrdering(null)} title="Order this design" footer={<><Button variant="light" onClick={() => setOrdering(null)}>Cancel</Button><Button loading={busy} onClick={order}>Create quote</Button></>}>
        <p className="mb-4 text-sm text-ink-500"><b>{ordering?.name}</b> · {ordering?.config?.widthMm}×{ordering?.config?.heightMm} mm · {ordering?.config?.material}</p>
        <Field label="Quantity" hint="Volume discounts apply automatically."><Input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} /></Field>
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete design?" footer={<><Button variant="light" onClick={() => setDel(null)}>Keep</Button><Button variant="dark" loading={remove.isPending} onClick={() => remove.mutate(del._id)}>Delete</Button></>}>
        <p className="text-sm text-ink-600">“{del?.name}” will be removed from your library. Existing orders keep their own copy of the artwork.</p>
      </Modal>
    </>
  );
}
