import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import AuthShell from './AuthShell';
import supabase from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Alert, Field, Spinner } from '../../components/ui';

export default function ResetPassword() {
  const { session, loading } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) errs.pw = 'Use 8+ characters with letters and numbers.';
    if (pw !== pw2) errs.pw2 = 'Passwords do not match.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setErr(error.message); else { setDone(true); setTimeout(() => nav('/login'), 1800); }
  };

  return (
    <AuthShell title="Choose a new password">
      {!loading && !session && !done && <Alert>This reset link is invalid or has expired. Please request a new one from the “Forgot password” page.</Alert>}
      {done ? <Alert kind="success">Password updated. Redirecting…</Alert> : session && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <Alert>{err}</Alert>}
          <Field label="New password" error={errors.pw} htmlFor="rp1"><input id="rp1" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!errors.pw} /></Field>
          <Field label="Confirm new password" error={errors.pw2} htmlFor="rp2"><input id="rp2" type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-invalid={!!errors.pw2} /></Field>
          <button className="btn btn-navy w-full rounded-xl py-3" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}Update password</button>
        </form>
      )}
    </AuthShell>
  );
}
