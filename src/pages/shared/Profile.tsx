import { useEffect, useState } from 'react';
import { Save, KeyRound } from 'lucide-react';
import { api } from '../../lib/api';
import supabase from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Alert, Field, Spinner } from '../../components/ui';
import { fmtDate } from '../../lib/constants';

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const [f, setF] = useState({ full_name: '', phone: '', position: '', company_name: '', company_tin: '', company_address: '', business_type: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ a: '', b: '' });
  const [pwMsg, setPwMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (profile) setF({
      full_name: profile.full_name || '', phone: profile.phone || '', position: profile.position || '', company_name: profile.company_name || '',
      company_tin: profile.company_tin || '', company_address: profile.company_address || '', business_type: profile.business_type || '',
    });
  }, [profile]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.full_name.trim().length < 2) errs.full_name = 'Full name is required.';
    if (f.phone && !/^[+\d\s()-]{7,20}$/.test(f.phone)) errs.phone = 'Enter a valid phone number.';
    if (f.company_tin && !/^[\d-]{6,20}$/.test(f.company_tin)) errs.company_tin = 'TIN should contain digits (and dashes) only.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setMsg(null);
    try { await api('/api/account?action=me', { method: 'PUT', body: f }); await refreshProfile(); setMsg({ kind: 'success', text: 'Profile saved.' }); }
    catch (e2) { setMsg({ kind: 'error', text: (e2 as Error).message }); } finally { setBusy(false); }
  };

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.a.length < 8 || !/[A-Za-z]/.test(pw.a) || !/\d/.test(pw.a)) { setPwMsg({ kind: 'error', text: 'Use 8+ characters with letters and numbers.' }); return; }
    if (pw.a !== pw.b) { setPwMsg({ kind: 'error', text: 'Passwords do not match.' }); return; }
    setPwBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw.a });
    setPwBusy(false);
    setPwMsg(error ? { kind: 'error', text: error.message } : { kind: 'success', text: 'Password updated.' });
    if (!error) setPw({ a: '', b: '' });
  };

  const isCustomer = profile?.role === 'customer';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-navy">{isCustomer ? 'Profile & Company' : 'My Profile'}</h1>
        <p className="text-sm text-muted">{profile?.email} · <span className="capitalize">{profile?.role}</span> · member since {fmtDate(profile?.created_at)}</p>
      </div>
      <form onSubmit={save} className="card space-y-6 p-6" noValidate>
        {msg && <Alert kind={msg.kind} onClose={() => setMsg(null)}>{msg.text}</Alert>}
        <div>
          <h2 className="mb-3 font-display font-bold text-navy">Contact details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name *" error={errors.full_name} htmlFor="p-n"><input id="p-n" className="input" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} aria-invalid={!!errors.full_name} /></Field>
            <Field label="Phone" error={errors.phone} htmlFor="p-p"><input id="p-p" className="input" placeholder="+255…" value={f.phone} onChange={(e) => set('phone', e.target.value)} aria-invalid={!!errors.phone} /></Field>
            <Field label="Position / title" htmlFor="p-t"><input id="p-t" className="input" value={f.position} onChange={(e) => set('position', e.target.value)} /></Field>
            <Field label="Email" hint="Contact Afrigate to change your login email." htmlFor="p-e"><input id="p-e" className="input bg-canvas" value={profile?.email || ''} disabled /></Field>
          </div>
        </div>
        {isCustomer && (
          <div>
            <h2 className="mb-3 font-display font-bold text-navy">Business / company information</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name" htmlFor="p-c"><input id="p-c" className="input" value={f.company_name} onChange={(e) => set('company_name', e.target.value)} /></Field>
              <Field label="TIN (Taxpayer Identification Number)" error={errors.company_tin} htmlFor="p-tin"><input id="p-tin" className="input" value={f.company_tin} onChange={(e) => set('company_tin', e.target.value)} aria-invalid={!!errors.company_tin} /></Field>
              <Field label="Business type / sector" htmlFor="p-bt"><input id="p-bt" className="input" placeholder="e.g. Import & distribution" value={f.business_type} onChange={(e) => set('business_type', e.target.value)} /></Field>
              <Field label="Business address" htmlFor="p-a"><input id="p-a" className="input" value={f.company_address} onChange={(e) => set('company_address', e.target.value)} /></Field>
            </div>
          </div>
        )}
        <div className="flex justify-end"><button className="btn btn-navy" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}Save changes</button></div>
      </form>
      <form onSubmit={changePw} className="card space-y-4 p-6" noValidate>
        <h2 className="font-display font-bold text-navy">Change password</h2>
        {pwMsg && <Alert kind={pwMsg.kind} onClose={() => setPwMsg(null)}>{pwMsg.text}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" htmlFor="pw1"><input id="pw1" type="password" autoComplete="new-password" className="input" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></Field>
          <Field label="Confirm new password" htmlFor="pw2"><input id="pw2" type="password" autoComplete="new-password" className="input" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end"><button className="btn btn-ghost" disabled={pwBusy}>{pwBusy ? <Spinner className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}Update password</button></div>
      </form>
    </div>
  );
}
