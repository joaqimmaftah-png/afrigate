import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Paperclip, Send, FileText, Download, CalendarPlus, Info, UserCheck, CheckCircle2, AlertTriangle,
  Upload, X, Video, Phone, MapPin, MessageCircle, ClipboardCheck, Lock, Circle,
} from 'lucide-react';
import supabase from '../lib/supabase';
import { api, uploadDocument, downloadDocument, validateFile, ACCEPT_ATTR } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge, StatusTimeline, ServiceIcon, PageLoader, Alert, Spinner, Modal } from './ui';
import BookingModal from './BookingModal';
import { STATUSES, DOC_CATEGORIES, APPT_TONE, fmtDate, fmtDateTime, fmtTime, fmtSize } from '../lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Detail = {
  consultation: any; service: any; customer: any; consultant: any;
  history: any[]; messages: any[]; documents: any[]; appointments: any[];
};

const methodIcon = (m: string) => (m.startsWith('Video') ? Video : m.startsWith('Phone') ? Phone : m.startsWith('WhatsApp') ? MessageCircle : MapPin);

export default function ConsultationWorkspace({ id, mode }: { id: number; mode: 'customer' | 'staff' }) {
  const { profile } = useAuth();
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [text, setText] = useState('');
  const [infoReq, setInfoReq] = useState(false);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<{ file: File; category: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<'chat' | 'details'>('chat');
  const [booking, setBooking] = useState(false);
  const [online, setOnline] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastCount = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api<Detail>(`/api/consultations?action=detail&id=${id}`);
      setD(res);
      setError(null);
    } catch (e) {
      if (!silent) setError((e as Error).message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Realtime: broadcast pings + presence; polling fallback
  useEffect(() => {
    if (!profile) return;
    const ch = supabase.channel(`afg-consult-${id}`, { config: { presence: { key: profile.id }, broadcast: { self: false } } });
    ch.on('broadcast', { event: 'refresh' }, () => load(true));
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, { role: string; name: string }[]>;
      setOnline(Object.entries(state).filter(([k]) => k !== profile.id).map(([, v]) => v[0]?.role || ''));
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ role: profile.role, name: profile.full_name });
    });
    channelRef.current = ch;
    const poll = setInterval(() => load(true), 15000);
    return () => { clearInterval(poll); supabase.removeChannel(ch); channelRef.current = null; };
  }, [id, profile, load]);

  const ping = () => channelRef.current?.send({ type: 'broadcast', event: 'refresh', payload: {} });

  useEffect(() => {
    const n = d?.messages.length || 0;
    if (n !== lastCount.current) {
      lastCount.current = n;
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [d?.messages.length, tab]);

  const afterMutation = async (msg?: string) => {
    await load(true);
    ping();
    if (msg) setNotice({ kind: 'success', text: msg });
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() && pending.length === 0) return;
    setSending(true); setNotice(null);
    try {
      if (pending.length) await doUpload();
      if (text.trim()) {
        await api('/api/consultations?action=message', { method: 'POST', body: { id, body: text.trim(), kind: infoReq ? 'info_request' : 'message' } });
        setText(''); setInfoReq(false);
      }
      await afterMutation();
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message });
    } finally { setSending(false); }
  };

  const pickFiles = (files: FileList | null) => {
    if (!files) return;
    const errs: string[] = [];
    const ok: { file: File; category: string }[] = [];
    Array.from(files).slice(0, 5).forEach((f) => {
      const v = validateFile(f);
      if (v) errs.push(v); else ok.push({ file: f, category: defaultCategory });
    });
    if (errs.length) setNotice({ kind: 'error', text: errs.join(' ') });
    setPending((p) => [...p, ...ok].slice(0, 5));
    if (fileRef.current) fileRef.current.value = '';
  };

  const doUpload = async () => {
    setUploading(true);
    try {
      for (const p of pending) await uploadDocument(id, p.file, p.category);
      setPending([]);
    } finally { setUploading(false); }
  };

  const defaultCategory = useMemo(() => {
    const slug = d?.service?.slug || '';
    if (slug.includes('import')) return 'Import / Export';
    if (slug.includes('tax')) return 'Tax / VAT';
    if (slug.includes('registration')) return 'Business Registration';
    if (slug.includes('trade')) return 'Shipping / Logistics';
    return 'Other';
  }, [d?.service?.slug]);

  if (loading) return <PageLoader label="Loading consultation…" />;
  if (error || !d) return <div className="space-y-4"><Alert>{error || 'Not found'}</Alert><Link className="btn btn-ghost" to={mode === 'customer' ? '/portal/requests' : '/staff/consultations'}><ArrowLeft className="h-4 w-4" />Back</Link></div>;

  const c = d.consultation;
  const closed = c.status === 'Closed';
  const isAssignedConsultant = profile?.id === c.consultant_id;
  const counterpartOnline = mode === 'customer' ? online.some((r) => r === 'consultant' || r === 'admin') : online.includes('customer');
  const reports = d.documents.filter((x) => x.is_report);

  const Composer = (
    <form onSubmit={send} className="border-t border-line bg-white p-3 sm:p-4">
      {closed ? (
        <div className="flex items-center gap-2 rounded-xl bg-canvas px-4 py-3 text-sm text-muted"><Lock className="h-4 w-4" />This consultation is closed. Its full history is retained for your records.</div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-3 space-y-2">
              {pending.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-navy" />
                  <span className="min-w-0 flex-1 truncate font-medium">{p.file.name}</span>
                  <span className="text-xs text-muted">{fmtSize(p.file.size)}</span>
                  <select aria-label="Document category" className="rounded-lg border border-line bg-white px-2 py-1 text-xs" value={p.category} onChange={(e) => setPending((arr) => arr.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}>
                    {DOC_CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
                  </select>
                  <button type="button" onClick={() => setPending((arr) => arr.filter((_, j) => j !== i))} aria-label="Remove file" className="text-muted hover:text-danger"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
          {mode === 'staff' && (
            <label className="mb-2 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-amber-800">
              <input type="checkbox" checked={infoReq} onChange={(e) => setInfoReq(e.target.checked)} className="accent-amber-600" />
              Send as “Request for information” (sets status to Awaiting Customer Information)
            </label>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileRef} type="file" multiple accept={ACCEPT_ATTR} className="hidden" onChange={(e) => pickFiles(e.target.files)} />
            <button type="button" onClick={() => fileRef.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line text-navy hover:bg-canvas" aria-label="Attach documents" title="Attach documents (PDF, images, Word, Excel — max 10 MB)"><Paperclip className="h-5 w-5" /></button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              placeholder={mode === 'customer' ? 'Write a message to your consultant…' : infoReq ? 'Describe the information or documents you need…' : 'Reply to the customer…'}
              className="input max-h-40 min-h-[44px] flex-1 resize-y"
              aria-label="Message"
            />
            <button className="btn btn-navy h-11 shrink-0 px-4" disabled={sending || (!text.trim() && !pending.length)} aria-label="Send">
              {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}<span className="hidden sm:inline">{uploading ? 'Uploading…' : 'Send'}</span>
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">Enter to send · Shift+Enter for a new line · Files are stored privately and only visible to you and Afrigate staff on this case.</p>
        </>
      )}
    </form>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link to={mode === 'customer' ? '/portal/requests' : '/staff/consultations'} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy"><ArrowLeft className="h-4 w-4" />{mode === 'customer' ? 'My requests' : 'All consultations'}</Link>
        <div className="card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-navy text-gold"><ServiceIcon icon={d.service?.icon} /></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold tracking-wide text-gold-deep">{c.reference}</span>
                <StatusBadge status={c.status} />
                {c.urgency !== 'Standard' && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{c.urgency}</span>}
              </div>
              <h1 className="mt-1 font-display text-xl font-bold text-navy">{c.subject}</h1>
              <p className="text-sm text-muted">{d.service?.title} · Opened {fmtDate(c.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-canvas px-4 py-3">
            <div className="relative grid h-10 w-10 place-items-center rounded-full bg-navy text-sm font-bold text-white">
              {(mode === 'customer' ? d.consultant?.full_name : d.customer?.full_name)?.split(' ').map((s: string) => s[0]).slice(0, 2).join('') || '—'}
              {counterpartOnline && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />}
            </div>
            <div className="text-sm">
              <div className="text-xs text-muted">{mode === 'customer' ? 'Your consultant' : 'Customer'}</div>
              <div className="font-semibold text-ink">{mode === 'customer' ? d.consultant?.full_name || 'Being assigned…' : d.customer?.full_name}</div>
              <div className="text-xs text-muted">{counterpartOnline ? <span className="text-emerald-700">Online now</span> : mode === 'staff' ? d.customer?.company_name || d.customer?.email : d.consultant ? 'Afrigate Consultant' : 'Afrigate team'}</div>
            </div>
          </div>
        </div>
      </div>

      {notice && <Alert kind={notice.kind} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      {mode === 'customer' && c.status === 'Awaiting Customer Information' && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><b>Your consultant needs more information.</b> Please read their latest request below and reply or attach the required documents.</div>
        </div>
      )}

      {/* Mobile tabs */}
      <div className="flex rounded-xl bg-white p-1 lg:hidden">
        {(['chat', 'details'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${tab === t ? 'bg-navy text-white' : 'text-muted'}`}>{t === 'chat' ? 'Conversation' : 'Details, documents & status'}</button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Conversation */}
        <section className={`card flex h-[70vh] min-h-[520px] flex-col overflow-hidden ${tab === 'chat' ? '' : 'hidden lg:flex'}`}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="font-display text-sm font-bold text-navy">Consultation workspace</div>
            <div className="flex items-center gap-1.5 text-xs text-muted"><Circle className={`h-2 w-2 ${channelRef.current ? 'fill-emerald-500 text-emerald-500' : 'fill-slate-300 text-slate-300'}`} />Live</div>
          </div>
          <div className="scroll-thin flex-1 space-y-4 overflow-y-auto bg-canvas/60 px-4 py-5 sm:px-6">
            {/* Original request */}
            <div className="rounded-2xl border border-line bg-white p-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gold-deep">Original request · {fmtDateTime(c.created_at)}</div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{c.description}</p>
              <div className="mt-2 text-xs text-muted">Preferred contact: {c.preferred_contact}</div>
            </div>
            {d.messages.map((m, i) => {
              const prev = d.messages[i - 1];
              const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
              const day = showDay ? <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted">{fmtDate(m.created_at)}</div> : null;
              if (m.sender_role === 'system') {
                return (
                  <div key={m.id}>{day}
                    <div className="mx-auto flex max-w-md items-center justify-center gap-2 rounded-full bg-white px-3 py-1.5 text-center text-xs text-muted shadow-sm">
                      {m.kind === 'document' ? <FileText className="h-3.5 w-3.5 shrink-0" /> : <Info className="h-3.5 w-3.5 shrink-0" />}<span>{m.body}</span><span className="shrink-0 text-muted/70">{fmtTime(m.created_at)}</span>
                    </div>
                  </div>
                );
              }
              const mine = m.sender_id === profile?.id;
              const fromStaff = m.sender_role !== 'customer';
              return (
                <div key={m.id}>{day}
                  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-[75%]`}>
                      <div className={`mb-1 text-[11px] text-muted ${mine ? 'text-right' : ''}`}>{mine ? 'You' : m.sender?.full_name || 'Afrigate'}{fromStaff && !mine ? ' · Afrigate' : ''} · {fmtTime(m.created_at)}</div>
                      {m.kind === 'info_request' ? (
                        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800"><ClipboardCheck className="h-3.5 w-3.5" />Information requested</div>
                          <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                        </div>
                      ) : (
                        <div className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${mine ? 'rounded-br-md bg-navy text-white' : 'rounded-bl-md border border-line bg-white text-ink'}`}>{m.body}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {d.messages.filter((m) => m.sender_role !== 'system').length === 0 && (
              <p className="py-6 text-center text-sm text-muted">{mode === 'customer' ? 'No messages yet. You can add more detail or attach documents below at any time.' : 'No messages yet. Introduce yourself and outline the next steps.'}</p>
            )}
            <div ref={endRef} />
          </div>
          {Composer}
        </section>

        {/* Side panels */}
        <aside className={`space-y-5 ${tab === 'details' ? '' : 'hidden lg:block'}`}>
          {mode === 'staff' && <StaffControls d={d} isAssigned={isAssignedConsultant} onChanged={afterMutation} onError={(t) => setNotice({ kind: 'error', text: t })} />}

          {(c.outcome || c.status === 'Completed') && (
            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 bg-emerald-700 px-5 py-3 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" />Consultation outcome</div>
              <div className="p-5">
                {c.outcome ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{c.outcome}</p> : <p className="text-sm text-muted">No written outcome yet.</p>}
                {reports.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {reports.map((r) => <button key={r.id} onClick={() => downloadDocument(r.id).catch((e) => setNotice({ kind: 'error', text: e.message }))} className="flex w-full items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-left text-sm font-medium text-emerald-900 hover:bg-emerald-100"><Download className="h-4 w-4" />{r.file_name}</button>)}
                  </div>
                )}
                {mode === 'customer' && c.status === 'Completed' && (
                  <CloseButton id={id} onDone={() => afterMutation('Request closed. It remains available in your records.')} onError={(t) => setNotice({ kind: 'error', text: t })} />
                )}
              </div>
            </div>
          )}

          <div className="card p-5">
            <h3 className="mb-4 font-display text-sm font-bold text-navy">Request progress</h3>
            <StatusTimeline history={d.history} current={c.status} />
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-navy">Documents ({d.documents.length})</h3>
              {!closed && <button onClick={() => { setTab('chat'); fileRef.current?.click(); }} className="flex items-center gap-1 text-xs font-semibold text-gold-deep hover:underline"><Upload className="h-3.5 w-3.5" />Upload</button>}
            </div>
            {d.documents.length === 0 ? <p className="text-sm text-muted">No documents shared yet.</p> : (
              <ul className="scroll-thin max-h-72 space-y-2 overflow-y-auto pr-1">
                {d.documents.map((doc) => (
                  <li key={doc.id}>
                    <button onClick={() => downloadDocument(doc.id).catch((e) => setNotice({ kind: 'error', text: e.message }))} className="group flex w-full items-start gap-3 rounded-xl border border-line p-3 text-left hover:border-navy/40">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${doc.is_report ? 'bg-emerald-50 text-emerald-700' : 'bg-navy/5 text-navy'}`}><FileText className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{doc.file_name}</span>
                        <span className="block text-[11px] text-muted">{doc.category} · {fmtSize(doc.size_bytes)}</span>
                        <span className="block text-[11px] text-muted">{doc.uploader} · {fmtDateTime(doc.created_at)}</span>
                      </span>
                      <Download className="mt-1 h-4 w-4 text-muted group-hover:text-navy" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-navy">Appointments</h3>
              {!closed && <button onClick={() => setBooking(true)} className="flex items-center gap-1 text-xs font-semibold text-gold-deep hover:underline"><CalendarPlus className="h-3.5 w-3.5" />{mode === 'staff' ? 'Schedule' : 'Book'}</button>}
            </div>
            {d.appointments.length === 0 ? <p className="text-sm text-muted">No appointments yet.</p> : (
              <ul className="space-y-2">
                {d.appointments.map((a) => {
                  const I = methodIcon(a.method);
                  return (
                    <li key={a.id} className="rounded-xl border border-line p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink"><I className="h-4 w-4 text-navy" />{a.method}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${APPT_TONE[a.status]}`}>{a.status}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted">{fmtDateTime(a.scheduled_at)} · {a.duration_minutes} min</div>
                      {a.meeting_link && a.status === 'Confirmed' && <a href={a.meeting_link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-navy underline"><Video className="h-3.5 w-3.5" />Join online meeting</a>}
                    </li>
                  );
                })}
              </ul>
            )}
            <Link to={mode === 'customer' ? '/portal/appointments' : '/staff/appointments'} className="mt-3 inline-block text-xs font-semibold text-navy hover:underline">Manage all appointments →</Link>
          </div>

          {mode === 'staff' && d.customer && (
            <div className="card p-5 text-sm">
              <h3 className="mb-3 font-display text-sm font-bold text-navy">Customer details</h3>
              <dl className="space-y-1.5">
                <div className="flex justify-between gap-3"><dt className="text-muted">Name</dt><dd className="text-right font-medium">{d.customer.full_name}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Company</dt><dd className="text-right font-medium">{d.customer.company_name || '—'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Email</dt><dd className="truncate text-right font-medium"><a className="hover:underline" href={`mailto:${d.customer.email}`}>{d.customer.email}</a></dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Phone</dt><dd className="text-right font-medium">{d.customer.phone ? <a className="hover:underline" href={`tel:${d.customer.phone}`}>{d.customer.phone}</a> : '—'}</dd></div>
              </dl>
            </div>
          )}
        </aside>
      </div>

      <BookingModal open={booking} onClose={() => setBooking(false)} onDone={() => afterMutation(mode === 'staff' ? 'Appointment scheduled.' : 'Appointment requested. We will confirm shortly.')} consultationId={id} staff={mode === 'staff'} consultantName={d.consultant?.full_name} />
    </div>
  );
}

function CloseButton({ id, onDone, onError }: { id: number; onDone: () => void; onError: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} onClick={async () => {
      setBusy(true);
      try { await api('/api/consultations?action=status', { method: 'PUT', body: { id, status: 'Closed' } }); onDone(); } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
    }} className="btn btn-ghost btn-sm mt-4 w-full">{busy ? <Spinner className="h-4 w-4" /> : <Lock className="h-4 w-4" />}Confirm & close request</button>
  );
}

function StaffControls({ d, isAssigned, onChanged, onError }: { d: Detail; isAssigned: boolean; onChanged: (m?: string) => Promise<void>; onError: (t: string) => void }) {
  const { profile } = useAuth();
  const c = d.consultation;
  const isAdmin = profile?.role === 'admin';
  const [status, setStatus] = useState(c.status);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [consultants, setConsultants] = useState<any[]>([]);
  const [assignee, setAssignee] = useState(c.consultant_id || '');
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [outcome, setOutcome] = useState(c.outcome || '');
  const [complete, setComplete] = useState(true);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [outErr, setOutErr] = useState<string | null>(null);

  useEffect(() => { setStatus(c.status); setAssignee(c.consultant_id || ''); setOutcome(c.outcome || ''); }, [c.status, c.consultant_id, c.outcome]);
  useEffect(() => { if (isAdmin) api('/api/admin?action=consultants').then(setConsultants).catch(() => {}); }, [isAdmin]);

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try { await fn(); await onChanged(msg); } catch (e) { onError((e as Error).message); } finally { setBusy(null); }
  };

  const canWork = isAdmin || isAssigned;

  const saveOutcome = async () => {
    if (outcome.trim().length < 10) { setOutErr('Please write the guidance / outcome (at least 10 characters).'); return; }
    if (reportFile) { const v = validateFile(reportFile); if (v) { setOutErr(v); return; } }
    setOutErr(null);
    await run('outcome', async () => {
      if (reportFile) await uploadDocument(c.id, reportFile, 'Consultation Report', true);
      await api('/api/consultations?action=outcome', { method: 'PUT', body: { id: c.id, outcome, complete } });
      setOutcomeOpen(false); setReportFile(null);
    }, complete ? 'Consultation marked as completed.' : 'Outcome saved.');
  };

  return (
    <div className="card overflow-hidden">
      <div className="bg-navy px-5 py-3 font-display text-sm font-bold text-white">Case management</div>
      <div className="space-y-4 p-5">
        {isAssigned && c.status === 'Assigned to Consultant' && (
          <button disabled={!!busy} onClick={() => run('accept', () => api('/api/consultations?action=accept', { method: 'PUT', body: { id: c.id } }), 'Request accepted — status is now In Progress.')} className="btn btn-gold w-full">
            {busy === 'accept' ? <Spinner className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}Accept & start work
          </button>
        )}

        {isAdmin && (
          <div>
            <label className="label" htmlFor="assignee">Assigned consultant</label>
            <div className="flex gap-2">
              <select id="assignee" className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Unassigned</option>
                {consultants.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.active} active)</option>)}
              </select>
              <button disabled={!assignee || assignee === c.consultant_id || !!busy} onClick={() => run('assign', () => api('/api/consultations?action=assign', { method: 'PUT', body: { id: c.id, consultant_id: assignee } }), 'Consultant assigned and notified.')} className="btn btn-navy btn-sm">
                {busy === 'assign' ? <Spinner className="h-4 w-4" /> : 'Assign'}
              </button>
            </div>
          </div>
        )}

        {canWork && (
          <div>
            <label className="label" htmlFor="st">Update status</label>
            <select id="st" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} disabled={s === 'Assigned to Consultant' && !c.consultant_id}>{s}</option>)}
            </select>
            <input className="input mt-2" placeholder="Note for the customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button disabled={status === c.status || !!busy} onClick={() => run('status', async () => { await api('/api/consultations?action=status', { method: 'PUT', body: { id: c.id, status, note } }); setNote(''); }, `Status updated to ${status}.`)} className="btn btn-navy btn-sm mt-2 w-full">
              {busy === 'status' ? <Spinner className="h-4 w-4" /> : 'Save status'}
            </button>
          </div>
        )}

        {canWork && c.status !== 'Closed' && (
          <button onClick={() => setOutcomeOpen(true)} className="btn btn-ghost btn-sm w-full"><ClipboardCheck className="h-4 w-4" />{c.outcome ? 'Edit outcome / upload report' : 'Deliver outcome & report'}</button>
        )}
        {!canWork && <p className="text-xs text-muted">This case is assigned to another consultant. You have read-only access.</p>}
      </div>

      <Modal open={outcomeOpen} onClose={() => setOutcomeOpen(false)} title="Consultation outcome" wide>
        <div className="space-y-4">
          {outErr && <Alert>{outErr}</Alert>}
          <div>
            <label className="label" htmlFor="oc">Professional guidance & outcome</label>
            <textarea id="oc" rows={8} className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Summarise your advice, the steps taken, and any next actions for the customer…" />
          </div>
          <div>
            <label className="label" htmlFor="rp">Consultation report (optional)</label>
            <input id="rp" type="file" accept={ACCEPT_ATTR} onChange={(e) => setReportFile(e.target.files?.[0] || null)} className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} className="accent-[#0b2a5b]" />Mark consultation as <b>Completed</b></label>
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setOutcomeOpen(false)}>Cancel</button>
            <button className="btn btn-navy" disabled={busy === 'outcome'} onClick={saveOutcome}>{busy === 'outcome' ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}Save outcome</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
