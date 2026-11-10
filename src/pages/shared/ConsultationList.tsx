import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FolderKanban, Search, MessageSquare, FilePlus2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useServices } from '../../contexts/ServicesContext';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge, ServiceIcon, Skeleton, Alert, EmptyState } from '../../components/ui';
import { STATUSES, fmtDate, timeAgo } from '../../lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ConsultationList({ mode }: { mode: 'customer' | 'staff' }) {
  const { services } = useServices();
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState(params.get('q') || '');
  const [consultants, setConsultants] = useState<any[]>([]);
  const status = params.get('status') || '';
  const service = params.get('service_id') || '';
  const consultant = params.get('consultant_id') || '';
  const isAdmin = profile?.role === 'admin';

  useEffect(() => { if (isAdmin && mode === 'staff') api('/api/admin?action=consultants').then(setConsultants).catch(() => {}); }, [isAdmin, mode]);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ action: 'list' });
    if (status) qs.set('status', status);
    if (service) qs.set('service_id', service);
    if (consultant) qs.set('consultant_id', consultant);
    if (params.get('q')) qs.set('q', params.get('q')!);
    api(`/api/consultations?${qs}`).then(setRows).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [status, service, consultant, params]);

  const setParam = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p); };
  const base = mode === 'customer' ? '/portal/requests' : '/staff/consultations';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-navy">{mode === 'customer' ? 'My Requests' : isAdmin ? 'All Consultations' : 'My Assigned Consultations'}</h1>
          <p className="text-sm text-muted">{mode === 'customer' ? 'Track progress, read consultant replies and access completed records.' : 'Manage requests, respond to customers and update statuses.'}</p>
        </div>
        {mode === 'customer' && <Link to="/portal/new" className="btn btn-gold w-fit"><FilePlus2 className="h-4 w-4" />New request</Link>}
      </div>

      <div className="card flex flex-col gap-3 p-3 md:flex-row md:items-center">
        <form onSubmit={(e) => { e.preventDefault(); setParam('q', q.trim()); }} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder={mode === 'customer' ? 'Search by reference or subject…' : 'Search reference, subject, customer, company…'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        </form>
        <select className="input md:w-56" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="input md:w-56" value={service} onChange={(e) => setParam('service_id', e.target.value)} aria-label="Filter by service">
          <option value="">All services</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        {isAdmin && mode === 'staff' && (
          <select className="input md:w-48" value={consultant} onChange={(e) => setParam('consultant_id', e.target.value)} aria-label="Filter by consultant">
            <option value="">All consultants</option>
            <option value="none">Unassigned</option>
            {consultants.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        )}
      </div>

      {err && <Alert>{err}</Alert>}
      {loading ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div> : rows.length === 0 ? (
        <EmptyState icon={<FolderKanban className="h-5 w-5" />} title="No consultations found" text={status || service || params.get('q') ? 'Try clearing the filters.' : mode === 'customer' ? 'Start your first consultation request.' : 'Nothing assigned yet.'} action={mode === 'customer' ? <Link to="/portal/new" className="btn btn-navy">Request a Consultation</Link> : undefined} />
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[1.6fr_1fr_1fr_170px] gap-4 border-b border-line bg-canvas/70 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted lg:grid">
            <span>Request</span><span>{mode === 'customer' ? 'Consultant' : 'Customer'}</span><span>Last activity</span><span>Status</span>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id}>
                <Link to={`${base}/${r.id}`} className="grid gap-2 px-5 py-4 transition hover:bg-canvas/60 lg:grid-cols-[1.6fr_1fr_1fr_170px] lg:items-center lg:gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy/5 text-navy"><ServiceIcon icon={r.service?.icon} className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-ink">{r.subject}</span>
                        {r.unread > 0 && <span className="flex shrink-0 items-center gap-1 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-navy-deep"><MessageSquare className="h-3 w-3" />{r.unread}</span>}
                        {r.urgency !== 'Standard' && <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{r.urgency}</span>}
                      </div>
                      <div className="truncate text-xs text-muted"><span className="font-mono text-gold-deep">{r.reference}</span> · {r.service?.title} · opened {fmtDate(r.created_at)}</div>
                    </div>
                  </div>
                  <div className="text-sm text-ink lg:block">
                    <span className="text-xs text-muted lg:hidden">{mode === 'customer' ? 'Consultant: ' : 'Customer: '}</span>
                    {mode === 'customer' ? r.consultant?.full_name || <span className="text-muted">Being assigned</span> : <>{r.customer?.full_name}<span className="block text-xs text-muted">{r.customer?.company_name}{isAdmin && ` · ${r.consultant?.full_name || 'Unassigned'}`}</span></>}
                  </div>
                  <div className="text-xs text-muted">{timeAgo(r.last_message_at || r.updated_at)}{mode === 'staff' && r.awaiting_reply && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">Awaiting reply</span>}</div>
                  <div><StatusBadge status={r.status} /></div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
