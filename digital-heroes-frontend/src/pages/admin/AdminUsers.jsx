import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { api, errorText } from '../../lib/api';
import { Badge, Button, ErrorBox, Field, Input, Modal, PageHeader, Pagination, Select } from '../../components/ui';
import { ResponsiveTable } from '../../components/AdminParts';
import { dateFmt } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDebounced, usePageTitle } from '../../lib/hooks';

export default function AdminUsers() {
  usePageTitle('Users');
  const { user: me } = useAuth(); const toast = useToast(); const qc = useQueryClient();
  const [q, setQ] = useState(''); const [role, setRole] = useState(''); const [page, setPage] = useState(1);
  const dq = useDebounced(q, 350);
  const [open, setOpen] = useState(false); const [f, setF] = useState({ name: '', email: '', password: '', role: 'customer' }); const [fe, setFe] = useState({});
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['a-users', dq, role, page], queryFn: () => api.getFull('/api/admin/users', { q: dq, role, page, limit: 15 }), placeholderData: (p) => p });
  const upd = useMutation({ mutationFn: ({ id, ...b }) => api.patch(`/api/admin/users/${id}`, b), onSuccess: () => { toast.success('User updated.'); qc.invalidateQueries({ queryKey: ['a-users'] }); }, onError: (e) => toast.error(errorText(e)) });
  const create = useMutation({ mutationFn: () => api.post('/api/admin/users', f), onSuccess: () => { toast.success('User created.'); setOpen(false); setF({ name: '', email: '', password: '', role: 'customer' }); qc.invalidateQueries({ queryKey: ['a-users'] }); }, onError: (e) => { const m = {}; (e.details || []).forEach?.((d) => { m[d.path] = d.message; }); setFe({ ...m, _: e.message }); } });

  return (
    <>
      <PageHeader kicker="People" title="Users &" accent="roles." actions={<Button onClick={() => { setFe({}); setOpen(true); }}><Plus size={16} />New user</Button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_200px]"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" /><Input className="pl-9" placeholder="Search name, email, company…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search users" /></div>
        <Select value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role"><option value="">All roles</option><option value="customer">Customers</option><option value="admin">Admins</option></Select></div>
      {error && <ErrorBox error={error} retry={refetch} />}
      <ResponsiveTable loading={isLoading} rows={data?.data} columns={[
        { key: 'n', label: 'User', render: (u) => <div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-900 font-display text-sm font-bold text-copper-400">{u.name?.[0]?.toUpperCase()}</span><div className="min-w-0"><div className="truncate text-sm font-semibold">{u.name}{u._id === me?._id && <span className="ml-2 font-mono text-[10px] text-copper-600">(you)</span>}</div><div className="truncate text-xs text-ink-500">{u.email}</div></div></div> },
        { key: 'c', label: 'Company', render: (u) => <span className="text-xs">{u.company || '-'}</span> },
        { key: 'j', label: 'Joined', render: (u) => <span className="text-xs">{dateFmt(u.createdAt)}</span> },
        { key: 'r', label: 'Role', render: (u) => <Select value={u.role} onChange={(e) => upd.mutate({ id: u._id, role: e.target.value })} className="!w-32 !py-1.5 !text-xs" aria-label={`Role for ${u.name}`}><option value="customer">customer</option><option value="admin">admin</option></Select> },
        { key: 's', label: 'Status', render: (u) => <Badge tone={u.isActive ? 'bg-sage-100 text-sage-700 border-sage-300' : 'bg-signal-red/10 text-signal-red border-signal-red/30'}>{u.isActive ? 'active' : 'disabled'}</Badge> },
        { key: 'actions', label: 'Actions', render: (u) => <Button size="sm" variant="light" disabled={u._id === me?._id} onClick={() => upd.mutate({ id: u._id, isActive: !u.isActive })}>{u.isActive ? 'Disable' : 'Enable'}</Button> },
      ]} />
      <Pagination meta={data?.meta} onPage={setPage} />

      <Modal open={open} onClose={() => setOpen(false)} title="Create user" footer={<><Button variant="light" onClick={() => setOpen(false)}>Cancel</Button><Button loading={create.isPending} onClick={() => create.mutate()}>Create</Button></>}>
        <div className="space-y-4"><Field label="Name" error={fe.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="Email" error={fe.email}><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Temporary password" error={fe.password} hint="8+ characters, letter and number"><Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Role"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="customer">Customer</option><option value="admin">Admin</option></Select></Field>
          {fe._ && !fe.name && !fe.email && !fe.password && <p className="text-sm text-signal-red">{fe._}</p>}</div>
      </Modal>
    </>
  );
}
