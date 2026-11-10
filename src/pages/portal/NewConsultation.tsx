import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, Paperclip, Send, X, Copy } from 'lucide-react';
import { useServices } from '../../contexts/ServicesContext';
import { api, uploadDocument, validateFile, ACCEPT_ATTR } from '../../lib/api';
import { ServiceIcon, Alert, Field, Spinner, PageLoader } from '../../components/ui';
import { URGENCY, CONTACT_PREFS, DOC_CATEGORIES, fmtSize } from '../../lib/constants';

const STEPS = ['Service', 'Details', 'Documents', 'Review'];

export default function NewConsultation() {
  const { services, loading } = useServices();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [f, setF] = useState({ subject: '', description: '', urgency: 'Standard', preferred_contact: 'Portal messages' });
  const [files, setFiles] = useState<{ file: File; category: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [created, setCreated] = useState<{ id: number; reference: string; failed: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const slug = params.get('service');
    if (slug && services.length && !serviceId) {
      const s = services.find((x) => x.slug === slug);
      if (s) { setServiceId(s.id); setStep(1); }
    }
  }, [params, services, serviceId]);

  const service = services.find((s) => s.id === serviceId);
  const defaultCat = service?.slug.includes('import') ? 'Import / Export' : service?.slug.includes('tax') ? 'Tax / VAT' : service?.slug.includes('registration') ? 'Business Registration' : service?.slug.includes('trade') ? 'Shipping / Logistics' : 'Other';

  const validateStep = (s: number) => {
    const errs: Record<string, string> = {};
    if (s === 0 && !serviceId) errs.service = 'Please choose a service to continue.';
    if (s === 1) {
      if (f.subject.trim().length < 5) errs.subject = 'Please add a short subject (at least 5 characters).';
      if (f.description.trim().length < 20) errs.description = 'Please describe your issue in more detail (at least 20 characters).';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };
  const next = () => { if (validateStep(step)) setStep(step + 1); };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const bad: string[] = [];
    const ok = Array.from(list).filter((file) => { const v = validateFile(file); if (v) bad.push(v); return !v; });
    setErrors(bad.length ? { files: bad.join(' ') } : {});
    setFiles((p) => [...p, ...ok.map((file) => ({ file, category: defaultCat }))].slice(0, 10));
  };

  const submit = async () => {
    if (!validateStep(0) || !validateStep(1)) return;
    setBusy(true); setErr(null);
    try {
      setProgress('Submitting your request…');
      const c = await api<{ id: number; reference: string }>('/api/consultations?action=create', { method: 'POST', body: { service_id: serviceId, ...f } });
      const failed: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(`Uploading document ${i + 1} of ${files.length}…`);
        try { await uploadDocument(c.id, files[i].file, files[i].category); } catch { failed.push(files[i].file.name); }
      }
      setCreated({ id: c.id, reference: c.reference, failed });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); setProgress(''); }
  };

  if (loading) return <PageLoader />;

  if (created) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="card rise p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-9 w-9" /></div>
          <h1 className="mt-4 font-display text-2xl font-extrabold text-navy">Request submitted</h1>
          <p className="mt-2 text-muted">Your unique reference number is:</p>
          <button onClick={() => { navigator.clipboard?.writeText(created.reference); setCopied(true); }} className="mx-auto mt-3 flex items-center gap-2 rounded-xl bg-gold-soft px-5 py-3 font-mono text-xl font-bold tracking-wide text-navy">
            {created.reference}<Copy className="h-4 w-4 text-gold-deep" />
          </button>
          {copied && <p className="mt-1 text-xs text-emerald-700">Copied</p>}
          {created.failed.length > 0 && <div className="mt-4 text-left"><Alert>Some files could not be uploaded: {created.failed.join(', ')}. You can attach them in the consultation workspace.</Alert></div>}
          <p className="mt-5 text-sm text-muted">Our team will review your request and assign a consultant. You’ll be notified at each step and can message us any time.</p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <button onClick={() => nav(`/portal/requests/${created.id}`)} className="btn btn-navy">Open consultation workspace</button>
            <Link to="/portal" className="btn btn-ghost">Back to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-extrabold text-navy">Request a Consultation</h1>
      <p className="mt-1 text-muted">Tell us what you need. It takes about two minutes.</p>

      <ol className="mt-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${i < step ? 'bg-gold text-navy-deep' : i === step ? 'bg-navy text-white' : 'bg-white text-muted ring-1 ring-line'}`}>{i < step ? <Check className="h-4 w-4" /> : i + 1}</span>
            <span className={`hidden text-sm font-semibold sm:block ${i === step ? 'text-navy' : 'text-muted'}`}>{s}</span>
            {i < STEPS.length - 1 && <span className={`h-0.5 flex-1 ${i < step ? 'bg-gold' : 'bg-line'}`} />}
          </li>
        ))}
      </ol>

      <div className="card mt-6 p-5 sm:p-7">
        {err && <div className="mb-4"><Alert>{err}</Alert></div>}

        {step === 0 && (
          <div>
            <h2 className="font-display text-lg font-bold text-navy">Which service do you need?</h2>
            {errors.service && <p className="mt-1 text-sm font-medium text-danger">{errors.service}</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {services.map((s) => (
                <button key={s.id} onClick={() => { setServiceId(s.id); setErrors({}); }} className={`relative flex gap-4 rounded-2xl border-2 p-4 text-left transition ${serviceId === s.id ? 'border-gold bg-gold-soft/40' : 'border-line hover:border-navy/30'}`} aria-pressed={serviceId === s.id}>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${serviceId === s.id ? 'bg-navy text-gold' : 'bg-canvas text-navy'}`}><ServiceIcon icon={s.icon} /></span>
                  <span><span className="block font-display text-sm font-bold text-navy">{s.title}</span><span className="mt-0.5 block text-xs text-muted">{s.short_description}</span></span>
                  {serviceId === s.id && <Check className="absolute right-3 top-3 h-5 w-5 text-gold-deep" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted"><span className="text-navy"><ServiceIcon icon={service?.icon} className="h-4 w-4" /></span>{service?.title}</div>
            <Field label="Subject *" error={errors.subject} htmlFor="nc-s"><input id="nc-s" className="input" maxLength={160} placeholder="e.g. HS code classification for solar panel imports" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} aria-invalid={!!errors.subject} /></Field>
            <Field label="Describe the business issue or advice required *" error={errors.description} hint={`${f.description.length}/6000 — include relevant dates, amounts, goods, or authorities involved.`} htmlFor="nc-d">
              <textarea id="nc-d" rows={7} maxLength={6000} className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} aria-invalid={!!errors.description} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Urgency" htmlFor="nc-u"><select id="nc-u" className="input" value={f.urgency} onChange={(e) => setF({ ...f, urgency: e.target.value })}>{URGENCY.map((u) => <option key={u}>{u}</option>)}</select></Field>
              <Field label="Preferred communication" htmlFor="nc-c"><select id="nc-c" className="input" value={f.preferred_contact} onChange={(e) => setF({ ...f, preferred_contact: e.target.value })}>{CONTACT_PREFS.map((u) => <option key={u}>{u}</option>)}</select></Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-display text-lg font-bold text-navy">Supporting documents <span className="text-sm font-normal text-muted">(optional)</span></h2>
            <p className="mt-1 text-sm text-muted">Invoices, packing lists, TRA notices, registration certificates, licences, bills of lading, etc. PDF, images, Word, Excel or CSV — up to 10 MB each.</p>
            <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }} className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-canvas/60 px-6 py-10 text-center hover:border-navy/40">
              <Paperclip className="h-8 w-8 text-navy" />
              <span className="mt-2 font-semibold text-navy">Click to choose files or drag them here</span>
              <span className="text-xs text-muted">Up to 10 files</span>
              <input type="file" multiple accept={ACCEPT_ATTR} className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>
            {errors.files && <p className="mt-2 text-sm font-medium text-danger">{errors.files}</p>}
            {files.length > 0 && (
              <ul className="mt-4 space-y-2">
                {files.map((x, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-line p-3 text-sm">
                    <FileText className="h-5 w-5 text-navy" />
                    <span className="min-w-0 flex-1 truncate font-medium">{x.file.name}</span>
                    <span className="text-xs text-muted">{fmtSize(x.file.size)}</span>
                    <select aria-label="Document category" className="rounded-lg border border-line px-2 py-1 text-xs" value={x.category} onChange={(e) => setFiles((arr) => arr.map((y, j) => (j === i ? { ...y, category: e.target.value } : y)))}>{DOC_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
                    <button onClick={() => setFiles((arr) => arr.filter((_, j) => j !== i))} aria-label="Remove" className="text-muted hover:text-danger"><X className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-display text-lg font-bold text-navy">Review & submit</h2>
            <dl className="mt-4 divide-y divide-line rounded-2xl border border-line text-sm">
              {[
                ['Service', service?.title],
                ['Subject', f.subject],
                ['Urgency', f.urgency],
                ['Preferred communication', f.preferred_contact],
                ['Documents', files.length ? files.map((x) => x.file.name).join(', ') : 'None'],
              ].map(([k, v]) => <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr]"><dt className="text-muted">{k}</dt><dd className="font-medium text-ink">{v}</dd></div>)}
              <div className="px-4 py-3"><dt className="text-muted">Description</dt><dd className="mt-1 whitespace-pre-wrap text-ink">{f.description}</dd></div>
            </dl>
            <p className="mt-4 text-xs text-muted">By submitting, you agree that Afrigate may review your information and documents to provide consultation on this matter.</p>
          </div>
        )}

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
          {step > 0 ? <button onClick={() => setStep(step - 1)} className="btn btn-ghost" disabled={busy}><ArrowLeft className="h-4 w-4" />Back</button> : <Link to="/portal" className="btn btn-ghost">Cancel</Link>}
          {step < 3 ? (
            <button onClick={next} className="btn btn-navy">Continue<ArrowRight className="h-4 w-4" /></button>
          ) : (
            <button onClick={submit} className="btn btn-gold" disabled={busy}>{busy ? <><Spinner className="h-4 w-4" />{progress}</> : <><Send className="h-4 w-4" />Submit request</>}</button>
          )}
        </div>
      </div>
    </div>
  );
}
