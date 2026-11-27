export const money = (minor, currency = 'INR') => {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format((minor || 0) / 100); }
  catch { return `${currency} ${((minor || 0) / 100).toFixed(2)}`; }
};
export const moneyShort = (minor, currency = 'INR') => {
  const v = (minor || 0) / 100;
  const sym = currency === 'INR' ? '₹' : '';
  if (v >= 1e7) return `${sym}${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${sym}${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${sym}${(v / 1e3).toFixed(1)}k`;
  return `${sym}${v.toFixed(0)}`;
};
export const dateFmt = (d, opts = { day: '2-digit', month: 'short', year: 'numeric' }) => (d ? new Date(d).toLocaleDateString('en-IN', opts) : '-');
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
export const num = (n) => new Intl.NumberFormat('en-IN').format(n || 0);
export const bytes = (n) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round((n || 0) / 1024))} KB`);

/** Pipeline: quote > order > artwork > proof > production > completed */
export const PIPELINE = ['quote', 'order', 'artwork', 'proof', 'production', 'completed'];
export const STATUS = {
  quote: { label: 'Quote', tone: 'bg-paper-200 text-ink-600 border-paper-300', dot: 'bg-ink-500', hint: 'Priced and saved. Pay to start production.' },
  order: { label: 'Order placed', tone: 'bg-signal-blue/10 text-signal-blue border-signal-blue/30', dot: 'bg-signal-blue', hint: 'Payment received.' },
  artwork: { label: 'Artwork', tone: 'bg-copper-100 text-copper-700 border-copper-300', dot: 'bg-copper-500', hint: 'We are preparing your proof.' },
  proof: { label: 'Proof', tone: 'bg-copper-100 text-copper-700 border-copper-300', dot: 'bg-copper-500', hint: 'Your proof is ready for review.' },
  production: { label: 'In production', tone: 'bg-sage-100 text-sage-700 border-sage-300', dot: 'bg-sage-500', hint: 'Being printed right now.' },
  completed: { label: 'Completed', tone: 'bg-sage-600 text-white border-sage-600', dot: 'bg-white', hint: 'Done. Reorder in one click.' },
  cancelled: { label: 'Cancelled', tone: 'bg-signal-red/10 text-signal-red border-signal-red/30', dot: 'bg-signal-red', hint: 'This order was cancelled.' },
};
export const PROOF_STATUS = {
  pending: { label: 'Awaiting review', tone: 'bg-copper-100 text-copper-700 border-copper-300' },
  approved: { label: 'Approved', tone: 'bg-sage-100 text-sage-700 border-sage-300' },
  changes_requested: { label: 'Changes requested', tone: 'bg-signal-red/10 text-signal-red border-signal-red/30' },
  superseded: { label: 'Superseded', tone: 'bg-paper-200 text-ink-500 border-paper-300' },
};
export const nextStage = (s) => ({ quote: 'order', order: 'artwork', artwork: 'proof', proof: 'production', production: 'completed' }[s]);
