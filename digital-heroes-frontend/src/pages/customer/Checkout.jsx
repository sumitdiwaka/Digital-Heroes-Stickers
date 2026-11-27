import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, CreditCard, FlaskConical, Lock } from 'lucide-react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { api, errorText } from '../../lib/api';
import { Button, ErrorBox, Skeleton } from '../../components/ui';
import { PriceBreakdown } from '../../components/Shared';
import { money } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../lib/hooks';

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

function StripeForm({ order, onPaid }) {
  const stripe = useStripe(); const elements = useElements(); const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pay = async (e) => {
    e.preventDefault(); if (!stripe || !elements) return; setBusy(true);
    const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/orders/${order._id}` }, redirect: 'if_required' });
    if (error) { toast.error(error.message); setBusy(false); } else onPaid();
  };
  return <form onSubmit={pay} className="space-y-5"><PaymentElement /><Button type="submit" size="lg" className="w-full" loading={busy} disabled={!stripe}><Lock size={17} />Pay {money(order.pricing.totalMinor, order.pricing.currency)}</Button></form>;
}

export default function Checkout() {
  const { id } = useParams();
  usePageTitle('Checkout');
  const nav = useNavigate(); const toast = useToast(); const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['order', id], queryFn: () => api.get(`/api/orders/${id}`) });
  const order = data?.order;
  const [intent, setIntent] = useState(null); const [intentErr, setIntentErr] = useState(null);
  const [paid, setPaid] = useState(false); const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!order || order.status !== 'quote' || started.current) return;
    started.current = true;
    api.post('/api/payments/checkout', { orderId: order._id }).then(setIntent).catch((e) => setIntentErr(e));
  }, [order]);

  const done = () => { setPaid(true); qc.invalidateQueries(); setTimeout(() => nav(`/orders/${id}`, { replace: true }), 2200); };
  const mockPay = async () => { setBusy(true); try { await api.post('/api/payments/mock/confirm', { orderId: id }); done(); } catch (e) { toast.error(errorText(e)); setBusy(false); } };
  // Stripe confirms asynchronously through the webhook -> wait for the order to leave "quote"
  const stripePaid = async () => { setPaid(true); for (let i = 0; i < 15; i++) { await new Promise((r) => setTimeout(r, 1200)); const d = await api.get(`/api/orders/${id}`).catch(() => null); if (d && d.order.status !== 'quote') break; } qc.invalidateQueries(); nav(`/orders/${id}`, { replace: true }); };

  if (error) return <ErrorBox error={error} retry={refetch} />;
  if (isLoading || !order) return <Skeleton className="h-96" />;
  if (order.status !== 'quote' && !paid) return <Navigate to={`/orders/${id}`} replace />;

  return (
    <div className="mx-auto max-w-5xl">
      <Link to={`/orders/${id}`} className="mb-5 inline-flex items-center gap-2 text-sm text-ink-500 hover:text-copper-600"><ArrowLeft size={15} />Back to order</Link>
      <h1 className="mb-8 text-3xl font-bold sm:text-5xl">Secure <span className="serif-i">checkout</span></h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="card p-6"><h2 className="font-display text-lg font-bold">{order.productName}</h2><p className="font-mono text-xs text-ink-500">{order.orderNumber} · {order.config.widthMm}×{order.config.heightMm} mm · {order.config.material} · {order.quantity} pcs</p><div className="my-5 border-t border-paper-300" /><PriceBreakdown pricing={order.pricing} quantity={order.quantity} /></div>

        <div className="card relative overflow-hidden p-6 sm:p-8" style={{ perspective: 1000 }}>
          {paid ? (
            <motion.div initial={{ opacity: 0, rotateY: -90, scale: .8 }} animate={{ opacity: 1, rotateY: 0, scale: 1 }} transition={{ type: 'spring', damping: 14 }} className="grid place-items-center py-10 text-center">
              <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: .25, type: 'spring' }} className="grid h-24 w-24 place-items-center rounded-full bg-sage-500 text-white shadow-[0_20px_50px_-12px_rgba(79,138,98,.8)]"><CheckCircle2 size={48} /></motion.div>
              <h2 className="mt-6 text-3xl font-bold">Payment received</h2><p className="mt-2 text-ink-500">We are preparing your proof…</p>
            </motion.div>
          ) : intentErr ? <ErrorBox error={intentErr} /> : !intent ? <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-40" /></div> : intent.provider === 'stripe' ? (
            stripePromise ? <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#C77D2E', borderRadius: '12px' } } }}><StripeForm order={order} onPaid={stripePaid} /></Elements>
              : <ErrorBox error={{ message: 'The backend is in Stripe mode, but VITE_STRIPE_PUBLISHABLE_KEY is not set in the frontend .env.' }} />
          ) : (
            <div className="space-y-6">
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-copper-400 bg-copper-50 p-4 text-sm"><FlaskConical className="mt-0.5 shrink-0 text-copper-600" size={18} /><div><b>Test payment mode.</b> The backend has no Stripe key, so no real card is charged. Press pay to simulate a successful payment.</div></div>
              <div className="rounded-2xl bg-ink-900 p-5 text-paper"><div className="flex items-center justify-between"><CreditCard className="text-copper-400" /><span className="font-mono text-xs text-paper/50">MOCK</span></div><div className="mt-6 font-mono text-lg tracking-[.25em]">4242 4242 4242 4242</div><div className="mt-3 flex justify-between font-mono text-xs text-paper/60"><span>TEST CUSTOMER</span><span>12/34</span></div></div>
              <Button size="lg" className="w-full" loading={busy} onClick={mockPay}><Lock size={17} />Pay {money(order.pricing.totalMinor, order.pricing.currency)}</Button>
              <p className="text-center text-[11px] text-ink-500">Card details never touch our servers when Stripe is enabled.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
