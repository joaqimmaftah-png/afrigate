import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilePlus2, FolderKanban, AlertTriangle, CheckCircle2, CalendarDays, ArrowRight, MessageSquare, Video } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useServices } from '../../contexts/ServicesContext';
import { StatCard, StatusBadge, ServiceIcon, Skeleton, Alert, EmptyState } from '../../components/ui';
import { APPT_TONE, fmtDateTime, timeAgo } from '../../lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Dashboard() {
  const { profile } = useAuth();
  const { services } = useServices();
  const [reqs, setReqs] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api('/api/consultations?action=list'), api('/api/appointments')])
      .then(([r, a]) => { setReqs(r); setAppts(a); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const open = reqs.filter((r) => !['Completed', 'Closed'].includes(r.status));
  const awaiting = reqs.filter((r) => r.status === 'Awaiting Customer Information');
  const done = reqs.filter((r) => ['Completed', 'Closed'].includes(r.status));
  const upcoming = appts.filter((a) => ['Requested', 'Confirmed'].includes(a.status) && new Date(a.scheduled_at) > new Date());
  const unread = reqs.reduce((s, r) => s + (r.unread || 0), 0);
  const profileIncomplete = profile && (!profile.phone || !profile.company_name);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-navy p-6 text-white sm:p-8">
        <img src="/images/hero-port.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-deep via-navy/90 to-transparent" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Client Portal</div>
            <h1 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">Hello, {profile?.full_name?.split(' ')[0]}</h1>
            <p className="mt-1 text-white/75">{unread > 0 ? `You have ${unread} unread message${unread > 1 ? 's' : ''} from Afrigate.` : 'Here is an overview of your consultations with Afrigate.'}</p>
          </div>
          <Link to="/portal/new" className="btn btn-gold w-fit px-6 py-3"><FilePlus2 className="h-4 w-4" />Request a Consultation</Link>
        </div>
      </div>

      {err && <Alert>{err}</Alert>}
      {profileIncomplete && <Alert kind="info">Complete your <Link to="/portal/profile" className="font-semibold underline">company profile</Link> so your consultant has the details they need.</Alert>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[78px]" />) : <>
          <StatCard label="Open requests" value={open.length} icon={<FolderKanban className="h-5 w-5" />} to="/portal/requests" />
          <StatCard label="Need your input" value={awaiting.length} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" to="/portal/requests?status=Awaiting%20Customer%20Information" />
          <StatCard label="Upcoming appointments" value={upcoming.length} icon={<CalendarDays className="h-5 w-5" />} tone="gold" to="/portal/appointments" />
          <StatCard label="Completed" value={done.length} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" to="/portal/requests?status=Completed" />
        </>}
      </div>

      {awaiting.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="flex items-center gap-2 font-display font-bold text-amber-900"><AlertTriangle className="h-5 w-5" />Action required</h2>
          <ul className="mt-3 space-y-2">
            {awaiting.map((r) => (
              <li key={r.id}><Link to={`/portal/requests/${r.id}`} className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm hover:shadow"><span><span className="font-mono text-xs text-gold-deep">{r.reference}</span> · <b>{r.subject}</b></span><ArrowRight className="h-4 w-4 text-amber-700" /></Link></li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-bold text-navy">Recent requests</h2>
            <Link to="/portal/requests" className="text-sm font-semibold text-gold-deep hover:underline">View all</Link>
          </div>
          {loading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div> : reqs.length === 0 ? (
            <EmptyState icon={<FolderKanban className="h-5 w-5" />} title="No requests yet" text="Start your first consultation — choose a service and tell us what you need." action={<Link to="/portal/new" className="btn btn-navy">Start a consultation</Link>} />
          ) : (
            <ul className="divide-y divide-line">
              {reqs.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link to={`/portal/requests/${r.id}`} className="flex items-center gap-4 py-3 hover:bg-canvas/60 sm:px-2">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy/5 text-navy"><ServiceIcon icon={r.service?.icon} className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{r.subject}</span>
                      <span className="block truncate text-xs text-muted"><span className="font-mono">{r.reference}</span> · {r.service?.title} · updated {timeAgo(r.updated_at)}</span>
                    </span>
                    {r.unread > 0 && <span className="flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-navy-deep"><MessageSquare className="h-3 w-3" />{r.unread}</span>}
                    <span className="hidden sm:block"><StatusBadge status={r.status} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-display font-bold text-navy">Upcoming appointments</h2><Link to="/portal/appointments" className="text-sm font-semibold text-gold-deep hover:underline">All</Link></div>
            {loading ? <Skeleton className="h-20" /> : upcoming.length === 0 ? <p className="text-sm text-muted">No upcoming appointments.</p> : (
              <ul className="space-y-2">
                {upcoming.slice(0, 3).map((a) => (
                  <li key={a.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between"><span className="text-sm font-semibold">{a.method}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${APPT_TONE[a.status]}`}>{a.status}</span></div>
                    <div className="text-xs text-muted">{fmtDateTime(a.scheduled_at)} · {a.service?.title}</div>
                    {a.meeting_link && a.status === 'Confirmed' && <a href={a.meeting_link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-navy underline"><Video className="h-3 w-3" />Join</a>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-display font-bold text-navy">Start a new consultation</h2>
            <div className="space-y-1">
              {services.map((s) => (
                <Link key={s.id} to={`/portal/new?service=${s.slug}`} className="flex items-center gap-3 rounded-xl p-2.5 text-sm font-medium text-ink hover:bg-canvas">
                  <span className="text-navy"><ServiceIcon icon={s.icon} className="h-5 w-5" /></span><span className="flex-1">{s.title}</span><ArrowRight className="h-4 w-4 text-muted" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
