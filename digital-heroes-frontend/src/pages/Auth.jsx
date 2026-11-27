import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button, Field, Input, Tilt } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api, errorText } from '../lib/api';
import { usePageTitle } from '../lib/hooks';
import { useToast } from '../context/ToastContext';

const COPY = {
  login: { t: 'Welcome back', a: 'to the press.', s: 'Log in to track proofs, reorder and manage your designs.' },
  register: { t: 'Create your', a: 'account.', s: 'Save designs, approve proofs and reorder in one click.' },
  'forgot-password': { t: 'Forgot your', a: 'password?', s: 'Enter your email and we will send a reset link.' },
  'reset-password': { t: 'Choose a', a: 'new password.', s: 'At least 8 characters, with a letter and a number.' },
};

function fieldErrors(e) { const m = {}; (e?.details || []).forEach?.((d) => { if (d.path) m[d.path] = d.message; }); return m; }

export default function Auth({ mode }) {
  usePageTitle(COPY[mode].t + ' ' + COPY[mode].a);
  const { login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ name: '', email: '', password: '', company: '', phone: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState({});
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const from = loc.state?.from;

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErrs({});
    try {
      if (mode === 'login') { const u = await login(f.email, f.password); nav(from || (u.role === 'admin' ? '/admin' : '/dashboard'), { replace: true }); }
      else if (mode === 'register') { await register({ name: f.name, email: f.email, password: f.password, company: f.company || undefined, phone: f.phone || undefined }); toast.success('Account created - welcome!'); nav(from || '/dashboard', { replace: true }); }
      else if (mode === 'forgot-password') { const d = await api.post('/api/auth/forgot-password', { email: f.email }); setDone(d); }
      else { await api.post('/api/auth/reset-password', { token: sp.get('token') || '', newPassword: f.password }); toast.success('Password updated. Please log in.'); nav('/login', { replace: true }); }
    } catch (er) { setErrs({ ...fieldErrors(er), _: errorText(er) }); } finally { setBusy(false); }
  };

  const c = COPY[mode];
  return (
    <div className="on-dark -mt-[var(--nav-h)] min-h-screen bg-ink-900 text-paper md:grid md:grid-cols-2">
      <div className="relative hidden overflow-hidden md:block">
        <div className="grid-lines absolute inset-0" aria-hidden /><div className="absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-copper-500/20 blur-[110px]" aria-hidden />
        <div className="relative flex h-full flex-col justify-center px-12 pt-[var(--nav-h)] lg:px-20">
          <Tilt max={10} className="mx-auto w-full max-w-sm rounded-3xl">
            <div className="rounded-3xl border border-white/10 bg-ink-800 p-6 shadow-2xl">
              <div className="z-pop-sm flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-widest text-paper/50">Proof v2</span><span className="flex items-center gap-1.5 rounded-full bg-sage-500/20 px-2.5 py-1 font-mono text-[10px] uppercase text-sage-300"><CheckCircle2 size={12} />Approved</span></div>
              <div className="z-pop mt-4 aspect-[4/3] rounded-xl bg-[#F5C400] p-4 text-ink-900"><div className="rounded bg-ink-900 px-3 py-1.5 font-display text-xs font-bold tracking-widest text-white">CITY 10K 2026</div><div className="mt-2 text-center font-display text-6xl font-bold leading-none">4821</div><div className="mt-2 text-center font-display text-xs font-bold tracking-widest">A. SHARMA</div></div>
              <div className="z-pop-sm mt-4 flex items-center gap-2 text-xs text-paper/60"><ShieldCheck size={14} className="text-copper-400" />Print files unlocked after approval</div>
            </div>
          </Tilt>
          <h2 className="mx-auto mt-10 max-w-sm text-center font-display text-2xl font-bold">Every proof versioned. <span className="serif-i">Every approval logged.</span></h2>
        </div>
      </div>

      <div className="flex min-h-screen items-center justify-center bg-paper px-5 pb-12 pt-[calc(var(--nav-h)+1rem)] text-ink-900 md:min-h-0">
        <motion.form onSubmit={submit} style={{ transformPerspective: 1000 }} initial={{ opacity: 0, y: 30, rotateX: 10 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: .6 }} className="w-full max-w-md" noValidate>
          <span className="kicker">{mode === 'register' ? 'Join Digital Heroes' : 'Account'}</span>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{c.t} <span className="serif-i">{c.a}</span></h1>
          <p className="mt-3 text-ink-500">{c.s}</p>

          {done ? (
            <div className="mt-8 space-y-4 rounded-2xl border border-sage-300 bg-sage-50 p-5 text-sm text-sage-700"><p className="font-semibold">{done.message}</p>
              {done.devToken && <p className="rounded-lg bg-white/70 p-3 text-xs text-ink-600">Dev mode: <Link className="font-semibold text-copper-600 underline" to={`/reset-password?token=${done.devToken}`}>open reset link</Link></p>}</div>
          ) : (
            <div className="mt-8 space-y-4">
              {mode === 'register' && <Field label="Full name" error={errs.name}><Input autoComplete="name" value={f.name} onChange={set('name')} required placeholder="Aarav Sharma" /></Field>}
              {mode !== 'reset-password' && <Field label="Email" error={errs.email}><Input type="email" autoComplete="email" value={f.email} onChange={set('email')} required placeholder="you@company.com" /></Field>}
              {mode !== 'forgot-password' && (
                <Field label={mode === 'reset-password' ? 'New password' : 'Password'} error={errs.password || errs.newPassword}>
                  <div className="relative"><Input type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} required className="pr-11" placeholder="••••••••" />
                    <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500" aria-label="Toggle password visibility">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                </Field>
              )}
              {mode === 'register' && <div className="grid grid-cols-2 gap-3"><Field label="Company (optional)"><Input value={f.company} onChange={set('company')} /></Field><Field label="Phone (optional)"><Input type="tel" value={f.phone} onChange={set('phone')} /></Field></div>}
              {errs._ && !Object.keys(errs).some((k) => k !== '_') && <p className="rounded-xl border border-signal-red/30 bg-signal-red/5 px-3.5 py-2.5 text-sm text-signal-red" role="alert">{errs._}</p>}
              {mode === 'login' && <div className="text-right text-sm"><Link to="/forgot-password" className="font-medium text-copper-600 hover:underline">Forgot password?</Link></div>}
              <Button type="submit" size="lg" loading={busy} className="w-full">{{ login: 'Log in', register: 'Create account', 'forgot-password': 'Send reset link', 'reset-password': 'Update password' }[mode]}<ArrowRight size={18} /></Button>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-ink-500">
            {mode === 'login' && <>New here? <Link to="/register" state={loc.state} className="font-semibold text-copper-600 hover:underline">Create an account</Link></>}
            {mode === 'register' && <>Already registered? <Link to="/login" state={loc.state} className="font-semibold text-copper-600 hover:underline">Log in</Link></>}
            {(mode === 'forgot-password' || mode === 'reset-password') && <Link to="/login" className="font-semibold text-copper-600 hover:underline">Back to log in</Link>}
          </p>

          {import.meta.env.DEV && mode === 'login' && (
            <div className="mt-8 rounded-2xl border border-dashed border-paper-400 p-4 text-xs text-ink-500"><div className="label">Dev shortcuts (seeded accounts)</div>
              <div className="flex flex-wrap gap-2"><button type="button" className="chip" onClick={() => setF((s) => ({ ...s, email: 'customer@digitalheroes.test', password: 'Customer@12345' }))}>Customer</button><button type="button" className="chip" onClick={() => setF((s) => ({ ...s, email: 'admin@digitalheroes.test', password: 'Admin@12345' }))}>Admin</button></div></div>
          )}
        </motion.form>
      </div>
    </div>
  );
}
