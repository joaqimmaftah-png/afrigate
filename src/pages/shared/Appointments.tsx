import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarPlus, Video, Phone, MapPin, MessageCircle, Check, X, CheckCheck } from 'lucide-react';
import { api } from '../../lib/api';
import BookingModal from '../../components/BookingModal';
import { Skeleton, Alert, EmptyState, Spinner, Modal } from '../../components/ui';
import { APPT_TONE, fmtDateTime } from '../../lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
const icon = (m: string) => (m.startsWith('Video') ? Video : m.startsWith('Phone') ? Phone : m.startsWith('WhatsApp') ? MessageCircle : MapPin);

export default function Appointments({ mode }: { mode: 'customer' | 'staff' }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [booking, setBooking] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [confirmFor, setConfirmFor] = useState<any>(null);
  const [link, setLink] = useState('');

  const load = () => api('/api/appointments').then(setItems).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const update = async (id: number, status: string, extra: Record<string, unknown> = {}) => {
    setBusy(id); setErr(null);
    try { await api('/api/appointments', { method: 'PUT', body: { id, status, ...extra } }); setOk(`Appointment ${status.toLowerCase()}.`); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  const now = Date.now();
  const upcoming = items.filter((a) => new Date(a.scheduled_at).getTime() >= now - 3600000 && ['Requested', 'Confirmed'].includes(a.status));
  const past = items.filter((a) => !upcoming.includes(a)).reverse();
  const shown = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-navy">Appointments</h1>
          <p className="text-sm text-muted">{mode === 'customer' ? 'Request and manage consultation meetings with Afrigate.' : 'Confirm, reschedule and complete client meetings.'}</p>
        </div>
        {mode === 'customer' && <button onClick={() => setBooking(true)} className="btn btn-gold w-fit"><CalendarPlus className="h-4 w-4" />Book appointment</button>}
      </div>
      {err && <Alert onClose={() => setErr(null)}>{err}</Alert>}
      {ok && <Alert kind="success" onClose={() => setOk(null)}>{ok}</Alert>}
      <div className="inline-flex rounded-xl bg-white p-1">
        {(['upcoming', 'past'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${tab === t ? 'bg-navy text-white' : 'text-muted'}`}>{t} ({t === 'upcoming' ? upcoming.length : past.length})</button>)}
      </div>
      {loading ? <div className="grid gap-3 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-36" />)}</div> : shown.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title={tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'} text={mode === 'customer' ? 'Book a meeting with an Afrigate consultant in person, by phone, WhatsApp or video.' : undefined} action={mode === 'customer' && tab === 'upcoming' ? <button onClick={() => setBooking(true)} className="btn btn-navy">Book appointment</button> : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((a) => {
            const I = icon(a.method);
            const d = new Date(a.scheduled_at);
            return (
              <div key={a.id} className="card flex gap-4 p-5">
                <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-navy py-2 text-white">
                  <span className="text-[11px] font-semibold uppercase text-gold">{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
                  <span className="font-display text-2xl font-extrabold leading-none">{d.getDate()}</span>
                  <span className="text-[11px] text-white/70">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold text-ink"><I className="h-4 w-4 text-navy" />{a.method}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${APPT_TONE[a.status]}`}>{a.status}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted">{fmtDateTime(a.scheduled_at)} · {a.duration_minutes} min</div>
                  <div className="mt-1 text-sm text-ink">{a.service?.title}</div>
                  <div className="mt-1 text-xs text-muted">
                    {mode === 'customer' ? <>Consultant: {a.consultant?.full_name || 'To be assigned'}</> : <>Client: <b className="text-ink">{a.customer?.full_name}</b>{a.customer?.company_name && ` · ${a.customer.company_name}`}{a.customer?.phone && ` · ${a.customer.phone}`}</>}
                  </div>
                  {a.consultation && <Link to={`${mode === 'customer' ? '/portal/requests' : '/staff/consultations'}/${a.consultation_id}`} className="mt-1 inline-block font-mono text-xs text-gold-deep hover:underline">{a.consultation.reference}</Link>}
                  {a.notes && <p className="mt-2 rounded-lg bg-canvas p-2 text-xs text-muted">{a.notes}</p>}
                  {a.meeting_link && a.status === 'Confirmed' && <a href={a.meeting_link} target="_blank" rel="noreferrer" className="btn btn-navy btn-sm mt-3"><Video className="h-4 w-4" />Join online meeting</a>}
                  {['Requested', 'Confirmed'].includes(a.status) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mode === 'staff' && a.status === 'Requested' && <button disabled={busy === a.id} onClick={() => { setConfirmFor(a); setLink(a.meeting_link || ''); }} className="btn btn-gold btn-sm"><Check className="h-4 w-4" />Confirm</button>}
                      {mode === 'staff' && a.status === 'Confirmed' && <button disabled={busy === a.id} onClick={() => update(a.id, 'Completed')} className="btn btn-navy btn-sm"><CheckCheck className="h-4 w-4" />Mark completed</button>}
                      <button disabled={busy === a.id} onClick={() => { if (confirm('Cancel this appointment?')) update(a.id, 'Cancelled'); }} className="btn btn-ghost btn-sm">{busy === a.id ? <Spinner className="h-4 w-4" /> : <X className="h-4 w-4" />}Cancel</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {mode === 'customer' && <BookingModal open={booking} onClose={() => setBooking(false)} onDone={() => { setOk('Appointment requested. You will be notified once it is confirmed.'); load(); }} />}
      <Modal open={!!confirmFor} onClose={() => setConfirmFor(null)} title="Confirm appointment">
        {confirmFor && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{confirmFor.method} with <b className="text-ink">{confirmFor.customer?.full_name}</b> on {fmtDateTime(confirmFor.scheduled_at)}.</p>
            {confirmFor.method === 'Video meeting' && (
              <div><label className="label" htmlFor="ml">Online meeting link</label><input id="ml" className="input" placeholder="https://meet.google.com/…" value={link} onChange={(e) => setLink(e.target.value)} /></div>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setConfirmFor(null)}>Back</button>
              <button className="btn btn-navy" onClick={async () => { const id = confirmFor.id; setConfirmFor(null); await update(id, 'Confirmed', { meeting_link: link }); }}>Confirm appointment</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
