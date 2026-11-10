import { useEffect, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Skeleton, Alert } from '../../components/ui';
import { fmtDate } from '../../lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Users() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    const qs = new URLSearchParams({ action: 'users' });
    if (role) qs.set('role', role);
    if (q) qs.set('q', q);
    return api(`/api/admin?${qs}`).then(setRows).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLoading(true); load(); }, [role]);

  const update = async (id: string, patch: Record<string, unknown>, label: string) => {
    setBusy(id); setErr(null);
    try { await api('/api/admin?action=users', { method: 'PUT', body: { id, ...patch } }); setOk(label); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-navy">Users & Roles</h1>
        <p className="text-sm text-muted">Manage customer accounts, consultants and administrators. Role changes take effect immediately.</p>
      </div>
      <div className="card flex flex-col gap-3 p-3 sm:flex-row">
        <form onSubmit={(e) => { e.preventDefault(); setLoading(true); load(); }} className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search name, email or company and press Enter…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" /></form>
        <select className="input sm:w-48" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role filter"><option value="">All roles</option><option value="customer">Customers</option><option value="consultant">Consultants</option><option value="admin">Administrators</option></select>
      </div>
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      {ok && <Alert kind="success" onClose={() => setOk(null)}>{ok}</Alert>}
      {loading ? <Skeleton className="h-72" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line bg-canvas/70 text-left text-xs uppercase tracking-wider text-muted">
              <tr><th className="px-5 py-3">User</th><th className="px-3 py-3">Company</th><th className="px-3 py-3">Activity</th><th className="px-3 py-3">Joined</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => {
                const self = u.id === profile?.id;
                return (
                  <tr key={u.id} className={u.is_active ? '' : 'bg-red-50/40'}>
                    <td className="px-5 py-3"><div className="font-semibold text-ink">{u.full_name}{self && <span className="ml-2 text-xs text-gold-deep">(you)</span>}</div><div className="text-xs text-muted">{u.email}{u.phone && ` · ${u.phone}`}</div></td>
                    <td className="px-3 py-3 text-muted">{u.company_name || '—'}</td>
                    <td className="px-3 py-3 text-xs text-muted">{u.role === 'customer' ? `${u.requests} request(s)` : `${u.assigned} active case(s)`}</td>
                    <td className="px-3 py-3 text-xs text-muted">{fmtDate(u.created_at)}</td>
                    <td className="px-3 py-3">
                      <select disabled={self || busy === u.id} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm capitalize" value={u.role} onChange={(e) => update(u.id, { role: e.target.value }, `${u.full_name} is now ${e.target.value}.`)} aria-label={`Role for ${u.full_name}`}>
                        <option value="customer">customer</option><option value="consultant">consultant</option><option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <button disabled={self || busy === u.id} onClick={() => update(u.id, { is_active: !u.is_active }, `${u.full_name} ${u.is_active ? 'deactivated' : 'reactivated'}.`)} className={`rounded-full px-3 py-1 text-xs font-semibold ${u.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-100 text-red-700 hover:bg-red-200'} disabled:opacity-50`}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted"><ShieldCheck className="h-4 w-4" />Customers can only see their own requests. Consultants see cases assigned to them. Administrators see everything. All role changes are recorded in the activity log.</p>
    </div>
  );
}
