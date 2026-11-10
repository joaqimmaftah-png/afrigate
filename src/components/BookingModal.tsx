import { useState } from 'react';
import { CalendarCheck2 } from 'lucide-react';
import { Modal, Field, Alert, Spinner } from './ui';
import { api } from '../lib/api';
import { MEETING_METHODS } from '../lib/constants';
import { useServices } from '../contexts/ServicesContext';

const pad = (n: number) => String(n).padStart(2, '0');
function defaultSlot() {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: '10:00' };
}

export default function BookingModal({
  open, onClose, onDone, consultationId, staff = false, consultantName,
}: { open: boolean; onClose: () => void; onDone: () => void; consultationId?: number; staff?: boolean; consultantName?: string | null }) {
  const { services } = useServices();
  const slot = defaultSlot();
  const [f, setF] = useState({ service_id: '', date: slot.date, time: slot.time, duration_minutes: '60', method: 'Video meeting', notes: '', meeting_link: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!consultationId && !f.service_id) errs.service_id = 'Choose the service this appointment relates to.';
    if (!f.date) errs.date = 'Choose a date.';
    if (!f.time) errs.time = 'Choose a time.';
    const when = new Date(`${f.date}T${f.time}`);
    if (f.date && f.time && when.getTime() < Date.now() + 30 * 60000) errs.date = 'Please pick a time at least 30 minutes from now.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true); setErr(null);
    try {
      await api('/api/appointments', {
        method: 'POST',
        body: {
          consultation_id: consultationId, service_id: f.service_id ? Number(f.service_id) : undefined,
          scheduled_at: when.toISOString(), duration_minutes: Number(f.duration_minutes), method: f.method, notes: f.notes, meeting_link: f.meeting_link,
        },
      });
      onDone();
      onClose();
    } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={staff ? 'Schedule appointment' : 'Book a consultation appointment'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Alert>{err}</Alert>}
        {!staff && consultantName && <p className="rounded-xl bg-canvas px-3 py-2 text-sm text-muted">Your consultant: <span className="font-semibold text-ink">{consultantName}</span></p>}
        {!consultationId && (
          <Field label="Service" error={errors.service_id} htmlFor="bk-svc">
            <select id="bk-svc" className="input" value={f.service_id} onChange={(e) => set('service_id', e.target.value)} aria-invalid={!!errors.service_id}>
              <option value="">Select a service…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" error={errors.date} htmlFor="bk-date"><input id="bk-date" type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} aria-invalid={!!errors.date} /></Field>
          <Field label="Time (EAT)" error={errors.time} htmlFor="bk-time"><input id="bk-time" type="time" step={900} className="input" value={f.time} onChange={(e) => set('time', e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meeting method" htmlFor="bk-m">
            <select id="bk-m" className="input" value={f.method} onChange={(e) => set('method', e.target.value)}>
              {MEETING_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Duration" htmlFor="bk-d">
            <select id="bk-d" className="input" value={f.duration_minutes} onChange={(e) => set('duration_minutes', e.target.value)}>
              {['30', '45', '60', '90'].map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </Field>
        </div>
        {staff && f.method === 'Video meeting' && (
          <Field label="Online meeting link (optional)" hint="Google Meet, Zoom or Teams link" htmlFor="bk-l"><input id="bk-l" className="input" placeholder="https://…" value={f.meeting_link} onChange={(e) => set('meeting_link', e.target.value)} /></Field>
        )}
        <Field label="Notes (optional)" htmlFor="bk-n"><textarea id="bk-n" rows={3} className="input" placeholder="Topics you'd like to cover…" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        {!staff && <p className="text-xs text-muted">Your request will be confirmed by Afrigate. Office hours are Monday–Friday.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-navy" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : <CalendarCheck2 className="h-4 w-4" />}{staff ? 'Schedule' : 'Request appointment'}</button>
        </div>
      </form>
    </Modal>
  );
}
