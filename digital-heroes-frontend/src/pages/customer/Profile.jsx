import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Save } from 'lucide-react';
import { api, errorText } from '../../lib/api';
import { Button, Field, Input, PageHeader, Reveal } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePageTitle } from '../../lib/hooks';

export default function Profile() {
  usePageTitle('Profile');
  const { user, refresh } = useAuth(); const toast = useToast();
  const [f, setF] = useState({});
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  useEffect(() => { if (user) setF({ name: user.name || '', phone: user.phone || '', company: user.company || '', gstin: user.gstin || '', line1: user.address?.line1 || '', line2: user.address?.line2 || '', city: user.address?.city || '', state: user.address?.state || '', postalCode: user.address?.postalCode || '' }); }, [user]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: () => api.patch('/api/auth/me', { name: f.name, phone: f.phone || undefined, company: f.company || undefined, gstin: f.gstin || undefined, address: { line1: f.line1 || undefined, line2: f.line2 || undefined, city: f.city || undefined, state: f.state || undefined, postalCode: f.postalCode || undefined, country: 'IN' } }),
    onSuccess: async () => { await refresh(); toast.success('Profile saved.'); }, onError: (e) => toast.error(errorText(e)),
  });
  const change = useMutation({ mutationFn: () => api.post('/api/auth/change-password', pw), onSuccess: () => { toast.success('Password updated.'); setPw({ currentPassword: '', newPassword: '' }); }, onError: (e) => toast.error(errorText(e)) });

  return (
    <>
      <PageHeader kicker="Settings" title="Your" accent="profile." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Reveal><form className="card space-y-5 p-5 sm:p-7" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <h2 className="font-display text-lg font-bold">Details &amp; billing</h2>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><Input value={f.name || ''} onChange={set('name')} required minLength={2} /></Field><Field label="Email"><Input value={user?.email || ''} disabled /></Field>
            <Field label="Phone"><Input type="tel" value={f.phone || ''} onChange={set('phone')} /></Field><Field label="Company"><Input value={f.company || ''} onChange={set('company')} /></Field>
            <Field label="GSTIN / Tax ID" hint="Printed on your invoices" className="sm:col-span-2"><Input value={f.gstin || ''} onChange={set('gstin')} /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Address line 1" className="sm:col-span-2"><Input value={f.line1 || ''} onChange={set('line1')} /></Field><Field label="Address line 2" className="sm:col-span-2"><Input value={f.line2 || ''} onChange={set('line2')} /></Field>
            <Field label="City"><Input value={f.city || ''} onChange={set('city')} /></Field><Field label="State"><Input value={f.state || ''} onChange={set('state')} /></Field><Field label="Postal code"><Input value={f.postalCode || ''} onChange={set('postalCode')} /></Field></div>
          <Button type="submit" loading={save.isPending}><Save size={16} />Save changes</Button>
        </form></Reveal>
        <Reveal delay={.08}><form className="card space-y-4 p-5 sm:p-7 lg:sticky lg:top-24" onSubmit={(e) => { e.preventDefault(); change.mutate(); }}>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><KeyRound size={18} className="text-copper-500" />Change password</h2>
          <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required /></Field>
          <Field label="New password" hint="8+ characters, with a letter and a number"><Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={8} /></Field>
          <Button type="submit" variant="dark" loading={change.isPending}>Update password</Button>
        </form></Reveal>
      </div>
    </>
  );
}
