import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import AuthShell, { GoogleButton } from './AuthShell';
import supabase from '../../lib/supabase';
import { signInWithGoogle } from '../../lib/googleAuth';
import { useAuth, homeFor } from '../../contexts/AuthContext';
import { Alert, Field, Spinner } from '../../components/ui';

export default function Login() {
  const [params] = useSearchParams();
  const next = params.get('next');
  const nav = useNavigate();
  const { user, profile, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && profile) {
      const staff = profile.role !== 'customer';
      const target = next && (staff ? next.startsWith('/staff') : next.startsWith('/portal')) ? next : homeFor(profile);
      nav(target, { replace: true });
    }
  }, [user, profile, loading, next, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Enter your password.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message);
  };

  return (
    <AuthShell title="Sign in to your portal" subtitle="Access your consultations, messages, documents and appointments.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {next?.startsWith('/portal/new') && <Alert kind="info">Please sign in or create a free account to request a consultation.</Alert>}
        {err && <Alert>{err}</Alert>}
        <Field label="Email address" error={errors.email} htmlFor="l-e"><input id="l-e" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} /></Field>
        <Field label="Password" error={errors.password} htmlFor="l-p">
          <div className="relative">
            <input id="l-p" type={show ? 'text' : 'password'} autoComplete="current-password" className="input pr-10" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        </Field>
        <div className="flex justify-end"><Link to="/forgot-password" className="text-sm font-semibold text-navy hover:underline">Forgot password?</Link></div>
        <button className="btn btn-navy w-full rounded-xl py-3" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}Sign in</button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <GoogleButton onClick={() => { void signInWithGoogle().catch((error: Error) => setErr(error.message)); }} />
      <p className="mt-6 text-center text-sm text-muted">New to Afrigate? <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-navy hover:underline">Create a client account</Link></p>
    </AuthShell>
  );
}
