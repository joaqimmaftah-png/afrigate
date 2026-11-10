import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, LogIn } from 'lucide-react';
import PageHero from '../../components/PageHero';
import { api } from '../../lib/api';
import { Alert, Field, Spinner, StatusBadge, StatusTimeline } from '../../components/ui';
import { STATUS_META, fmtDate, fmtDateTime } from '../../lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Track() {
  const [ref, setRef] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^AFG-\d{4}-\d{6}$/i.test(ref.trim())) errs.ref = 'Use the format AFG-2026-000123.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setErr(null); setResult(null);
    try { setResult(await api('/api/public?action=track', { method: 'POST', body: { reference: ref.trim(), email: email.trim() } })); }
    catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHero eyebrow="Track Your Request" title="Check the progress of your consultation" text="Enter the reference number you received when you submitted your request, together with the email address on your account." />
      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="card h-fit space-y-4 p-6" noValidate>
          <Field label="Reference number" error={errors.ref} htmlFor="t-ref"><input id="t-ref" className="input font-mono uppercase" placeholder="AFG-2026-000123" value={ref} onChange={(e) => setRef(e.target.value)} aria-invalid={!!errors.ref} /></Field>
          <Field label="Email address" error={errors.email} htmlFor="t-em"><input id="t-em" type="email" className="input" placeholder="you@company.co.tz" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} /></Field>
          <button className="btn btn-navy w-full" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}Track request</button>
          <p className="text-center text-xs text-muted">For messages, documents and full history, <Link to="/login" className="font-semibold text-navy underline">sign in to the Client Portal</Link>.</p>
        </form>
        <div>
          {err && <Alert>{err}</Alert>}
          {!result && !err && (
            <div className="card p-6">
              <h3 className="font-display font-bold text-navy">What the statuses mean</h3>
              <ul className="mt-4 space-y-3">
                {Object.entries(STATUS_META).map(([s, m]) => <li key={s} className="flex flex-wrap items-center gap-3 text-sm"><StatusBadge status={s} /><span className="text-muted">{m.help}</span></li>)}
              </ul>
            </div>
          )}
          {result && (
            <div className="card rise p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-semibold text-gold-deep">{result.reference}</div>
                  <h3 className="mt-1 font-display text-lg font-bold text-navy">{result.subject}</h3>
                  <p className="text-sm text-muted">{result.service} · Submitted {fmtDate(result.created_at)}</p>
                </div>
                <StatusBadge status={result.status} size="md" />
              </div>
              <p className="mt-4 rounded-xl bg-canvas p-3 text-sm">{STATUS_META[result.status]?.help} <span className="text-muted">Last updated {fmtDateTime(result.updated_at)}.</span></p>
              <div className="mt-6"><StatusTimeline history={result.history} current={result.status} /></div>
              <Link to="/login" className="btn btn-gold mt-6"><LogIn className="h-4 w-4" />Open in Client Portal</Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
