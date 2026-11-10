import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Activity, Users, MessageSquareWarning, CalendarDays, CheckCircle2, UserX, AlertTriangle, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard, StatusBadge, Skeleton, Alert, ServiceIcon } from '../../components/ui';
import { STATUS_META, fmtDateTime, timeAgo } from '../../lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Overview() {
  const { profile } = useAuth();
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api('/api/admin?action=overview').then(setD).catch((e) => setErr(e.message)); }, []);
  const isAdmin = profile?.role === 'admin';
  const t = d?.totals;
  const maxStatus = Math.max(1, ...(d?.byStatus || []).map((x: any) => x.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-navy">{isAdmin ? 'Operations Overview' : 'My Workspace'}</h1>
        <p className="text-sm text-muted">{isAdmin ? 'Service delivery across all consultations, consultants and appointments.' : 'Your assigned consultations, messages awaiting reply and upcoming meetings.'}</p>
      </div>
      {err && <Alert>{err}</Alert>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {!d ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-[78px]" />) : <>
          <StatCard label={isAdmin ? 'All consultations' : 'Assigned to me'} value={t.all} icon={<Inbox className="h-5 w-5" />} to="/staff/consultations" />
          <StatCard label="New / pending review" value={t.pending} icon={<AlertTriangle className="h-5 w-5" />} tone="gold" to="/staff/consultations?status=Submitted" />
          <StatCard label="Active consultations" value={t.active} icon={<Activity className="h-5 w-5" />} to="/staff/consultations?status=In%20Progress" />
          <StatCard label="Unanswered messages" value={t.unanswered} icon={<MessageSquareWarning className="h-5 w-5" />} tone="red" />
          <StatCard label="Awaiting customer info" value={t.awaiting_customer} icon={<CalendarDays className="h-5 w-5" />} tone="amber" to="/staff/consultations?status=Awaiting%20Customer%20Information" />
          <StatCard label={isAdmin ? 'Unassigned (open)' : 'Customers served'} value={isAdmin ? t.unassigned : t.customers} icon={isAdmin ? <UserX className="h-5 w-5" /> : <Users className="h-5 w-5" />} tone={isAdmin ? 'red' : 'navy'} to={isAdmin ? '/staff/consultations?consultant_id=none' : undefined} />
          <StatCard label="Upcoming appointments" value={d.upcoming.length} icon={<CalendarDays className="h-5 w-5" />} tone="gold" to="/staff/appointments" />
          <StatCard label="Completed / closed" value={t.completed} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" to="/staff/consultations?status=Completed" />
        </>}
      </div>

      {d && (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <div className="card p-5">
              <h2 className="mb-4 font-display font-bold text-navy">Messages awaiting reply</h2>
              {d.unanswered.length === 0 ? <p className="text-sm text-muted">No unanswered customer messages. 🎉</p> : (
                <ul className="divide-y divide-line">
                  {d.unanswered.map((c: any) => (
                    <li key={c.id}><Link to={`/staff/consultations/${c.id}`} className="flex items-center gap-3 py-3 hover:bg-canvas/50">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{c.subject}</span><span className="block text-xs text-muted"><span className="font-mono">{c.reference}</span> · {c.customer?.full_name}</span></span>
                      <ArrowRight className="h-4 w-4 text-muted" />
                    </Link></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between"><h2 className="font-display font-bold text-navy">Recently updated</h2><Link to="/staff/consultations" className="text-sm font-semibold text-gold-deep hover:underline">View all</Link></div>
              <ul className="divide-y divide-line">
                {d.recent.map((c: any) => (
                  <li key={c.id}><Link to={`/staff/consultations/${c.id}`} className="flex items-center gap-3 py-3 hover:bg-canvas/50">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy/5 text-navy"><ServiceIcon icon={c.service?.icon} className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{c.subject}</span><span className="block truncate text-xs text-muted"><span className="font-mono">{c.reference}</span> · {c.customer?.full_name}{isAdmin && ` · ${c.consultant || 'Unassigned'}`} · {timeAgo(c.updated_at)}</span></span>
                    <span className="hidden sm:block"><StatusBadge status={c.status} /></span>
                  </Link></li>
                ))}
                {d.recent.length === 0 && <li className="py-4 text-sm text-muted">No consultations yet.</li>}
              </ul>
            </div>
            <div className="card p-5">
              <h2 className="mb-4 font-display font-bold text-navy">Pipeline by status</h2>
              <div className="space-y-2.5">
                {d.byStatus.map((s: any) => (
                  <Link to={`/staff/consultations?status=${encodeURIComponent(s.status)}`} key={s.status} className="grid grid-cols-[170px_1fr_32px] items-center gap-3 text-sm">
                    <span className="truncate text-muted">{s.status}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-canvas"><span className={`block h-full rounded-full ${STATUS_META[s.status].dot}`} style={{ width: `${(s.count / maxStatus) * 100}%` }} /></span>
                    <span className="text-right font-semibold">{s.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="card p-5">
              <h2 className="mb-3 font-display font-bold text-navy">Upcoming appointments</h2>
              {d.upcoming.length === 0 ? <p className="text-sm text-muted">None scheduled.</p> : (
                <ul className="space-y-2">
                  {d.upcoming.map((a: any) => (
                    <li key={a.id} className="rounded-xl border border-line p-3 text-sm">
                      <div className="flex justify-between"><b>{a.customer}</b><span className={`text-xs font-semibold ${a.status === 'Requested' ? 'text-amber-700' : 'text-emerald-700'}`}>{a.status}</span></div>
                      <div className="text-xs text-muted">{fmtDateTime(a.scheduled_at)} · {a.method}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {isAdmin && (
              <div className="card p-5">
                <h2 className="mb-3 font-display font-bold text-navy">Consultant workload</h2>
                <ul className="space-y-3">
                  {d.workload.map((w: any) => (
                    <li key={w.id}>
                      <div className="flex justify-between text-sm"><span className="font-medium">{w.full_name}</span><span className="text-muted">{w.active} active · {w.completed} done</span></div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, w.active * 20)}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="card p-5">
              <h2 className="mb-3 font-display font-bold text-navy">By service</h2>
              <ul className="space-y-2 text-sm">{d.byService.map((s: any) => <li key={s.id} className="flex justify-between gap-3"><span className="text-muted">{s.title}</span><b>{s.count}</b></li>)}</ul>
            </div>
            {isAdmin && (
              <div className="card p-5">
                <div className="mb-3 flex items-center justify-between"><h2 className="font-display font-bold text-navy">Recent activity</h2><Link to="/staff/audit" className="text-xs font-semibold text-gold-deep hover:underline">Full log</Link></div>
                <ul className="space-y-2.5 text-xs">
                  {d.activity.map((a: any) => <li key={a.id} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" /><span><b className="text-ink">{a.actor_email}</b> <span className="text-muted">{a.action.replace('.', ' → ')}</span> <span className="text-muted/70">· {timeAgo(a.created_at)}</span></span></li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
