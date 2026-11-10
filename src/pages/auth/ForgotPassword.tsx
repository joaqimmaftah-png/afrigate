import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import AuthShell from './AuthShell';
import supabase from '../../lib/supabase';
import { Alert, Field, Spinner } from '../../components/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldErr('Enter a valid email address.'); return; }
    setFieldErr(''); setBusy(true); setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  };
  return (
    <AuthShell title="Reset your password" subtitle="Enter the email address on your account and we'll send you a secure reset link.">
      {sent ? (
        <Alert kind="success">If an account exists for <b>{email}</b>, a password reset link is on its way. Check your inbox (and spam folder).</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <Field label="Email address" error={fieldErr} htmlFor="f-e"><input id="f-e" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!fieldErr} /></Field>
          <button className="btn btn-navy w-full rounded-xl py-3" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}Send reset link</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="font-semibold text-navy hover:underline">Back to sign in</Link></p>
    </AuthShell>
  );
}
