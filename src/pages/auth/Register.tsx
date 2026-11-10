import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, MailCheck } from 'lucide-react';
import AuthShell, { GoogleButton } from './AuthShell';
import supabase from '../../lib/supabase';
import { signInWithGoogle } from '../../lib/googleAuth';
import { useAuth, homeFor } from '../../contexts/AuthContext';
import { Alert, Field, Spinner } from '../../components/ui';

export default function Register() {
  const [params] = useSearchParams();
  const next = params.get('next');
  const nav = useNavigate();
  const { user, profile, loading } = useAuth();
  const [f, setF] = useState({ full_name: '', company_name: '', phone: '', email: '', password: '', confirm: '', agree: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!loading && user && profile) nav(next && next.startsWith('/portal') ? next : homeFor(profile), { replace: true });
  }, [user, profile, loading, next, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.full_name.trim().length < 2) errs.full_name = 'Please enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs.email = 'Enter a valid email address.';
    if (f.phone && !/^[+\d\s()-]{7,20}$/.test(f.phone)) errs.phone = 'Enter a valid phone number.';
    if (f.password.length < 8) errs.password = 'Use at least 8 characters.';
    else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) errs.password = 'Include both letters and numbers.';
    if (f.confirm !== f.password) errs.confirm = 'Passwords do not match.';
    if (!f.agree) errs.agree = 'Please confirm to continue.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: { data: { full_name: f.full_name.trim(), company_name: f.company_name.trim(), phone: f.phone.trim() }, emailRedirectTo: `${window.location.origin}/login` },
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (!data.session) setCheckEmail(true);
  };

  if (checkEmail) {
    return (
      <AuthShell title="Check your email">
        <div className="card p-6 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-gold-deep" />
          <p className="mt-3 text-sm text-muted">We sent a confirmation link to <b className="text-ink">{f.email}</b>. Click it to activate your account, then sign in.</p>
          <Link to="/login" className="btn btn-navy mt-5">Go to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your client account" subtitle="Free and secure. Submit requests, share documents and track progress.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <Alert>{err}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name *" error={errors.full_name} htmlFor="r-n"><input id="r-n" className="input" autoComplete="name" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} aria-invalid={!!errors.full_name} /></Field>
          <Field label="Company / business" htmlFor="r-c"><input id="r-c" className="input" autoComplete="organization" value={f.company_name} onChange={(e) => set('company_name', e.target.value)} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email *" error={errors.email} htmlFor="r-e"><input id="r-e" type="email" autoComplete="email" className="input" value={f.email} onChange={(e) => set('email', e.target.value)} aria-invalid={!!errors.email} /></Field>
          <Field label="Phone" error={errors.phone} htmlFor="r-p"><input id="r-p" className="input" autoComplete="tel" placeholder="+255…" value={f.phone} onChange={(e) => set('phone', e.target.value)} aria-invalid={!!errors.phone} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password *" error={errors.password} hint="8+ characters, letters & numbers" htmlFor="r-pw"><input id="r-pw" type="password" autoComplete="new-password" className="input" value={f.password} onChange={(e) => set('password', e.target.value)} aria-invalid={!!errors.password} /></Field>
          <Field label="Confirm password *" error={errors.confirm} htmlFor="r-c2"><input id="r-c2" type="password" autoComplete="new-password" className="input" value={f.confirm} onChange={(e) => set('confirm', e.target.value)} aria-invalid={!!errors.confirm} /></Field>
        </div>
        <div>
          <label className="flex items-start gap-2 text-sm text-muted"><input type="checkbox" checked={f.agree} onChange={(e) => set('agree', e.target.checked)} className="mt-1 accent-[#0b2a5b]" />I agree that Afrigate may store my information and documents to provide consultation services.</label>
          {errors.agree && <p className="mt-1 text-xs font-medium text-danger">{errors.agree}</p>}
        </div>
        <button className="btn btn-navy w-full rounded-xl py-3" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}Create account</button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <GoogleButton onClick={() => signInWithGoogle('Afrigate Client Portal')} label="Sign up with Google" />
      <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-navy hover:underline">Sign in</Link></p>
    </AuthShell>
  );
}
