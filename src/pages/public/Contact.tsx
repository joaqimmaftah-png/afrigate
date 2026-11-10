import { useState } from 'react';
import { Mail, MapPin, Phone, Send, Clock } from 'lucide-react';
import PageHero from '../../components/PageHero';
import { WhatsAppIcon } from '../../components/PublicLayout';
import { api } from '../../lib/api';
import { useServices } from '../../contexts/ServicesContext';
import { Alert, Field, Spinner } from '../../components/ui';
import { CONTACT, waLink } from '../../lib/constants';

export default function Contact() {
  const { services } = useServices();
  const [f, setF] = useState({ name: '', email: '', phone: '', company: '', service_id: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.name.trim().length < 2) errs.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs.email = 'Enter a valid email address.';
    if (f.message.trim().length < 10) errs.message = 'Please write at least 10 characters.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setErr(null);
    try { await api('/api/public?action=enquiry', { method: 'POST', body: f }); setDone(true); setF({ name: '', email: '', phone: '', company: '', service_id: '', message: '' }); }
    catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHero eyebrow="Contact Us" title="Talk to Afrigate" text="Send a general enquiry, call or WhatsApp us. For a full consultation with document exchange and tracking, use the Client Portal." />
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px]">
        <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8" noValidate>
          <h2 className="font-display text-xl font-bold text-navy">Send us an enquiry</h2>
          {done && <Alert kind="success" onClose={() => setDone(false)}>Thank you — your enquiry has been received. Our team will get back to you shortly.</Alert>}
          {err && <Alert>{err}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name *" error={errors.name} htmlFor="c-n"><input id="c-n" className="input" value={f.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} /></Field>
            <Field label="Email *" error={errors.email} htmlFor="c-e"><input id="c-e" type="email" className="input" value={f.email} onChange={(e) => set('email', e.target.value)} aria-invalid={!!errors.email} /></Field>
            <Field label="Phone" htmlFor="c-p"><input id="c-p" className="input" placeholder="+255…" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Company" htmlFor="c-c"><input id="c-c" className="input" value={f.company} onChange={(e) => set('company', e.target.value)} /></Field>
          </div>
          <Field label="Service of interest" htmlFor="c-s">
            <select id="c-s" className="input" value={f.service_id} onChange={(e) => set('service_id', e.target.value)}>
              <option value="">General enquiry</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </Field>
          <Field label="Message *" error={errors.message} htmlFor="c-m"><textarea id="c-m" rows={5} className="input" value={f.message} onChange={(e) => set('message', e.target.value)} aria-invalid={!!errors.message} /></Field>
          <button className="btn btn-navy" disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}Send enquiry</button>
        </form>
        <aside className="space-y-4">
          <a href={waLink()} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-2xl bg-[#25D366] p-5 text-white shadow-lg transition hover:brightness-105">
            <WhatsAppIcon className="h-10 w-10" />
            <div><div className="font-display font-bold">Chat on WhatsApp</div><div className="text-sm">{CONTACT.phone}</div></div>
          </a>
          <div className="card space-y-4 p-6 text-sm">
            <a href={`tel:${CONTACT.tel}`} className="flex gap-3 hover:text-navy"><Phone className="h-5 w-5 text-gold-deep" /><span><b className="block text-navy">Phone</b>{CONTACT.phone}</span></a>
            <a href={`mailto:${CONTACT.email}`} className="flex gap-3 hover:text-navy"><Mail className="h-5 w-5 text-gold-deep" /><span><b className="block text-navy">Email</b>{CONTACT.email}</span></a>
            <div className="flex gap-3"><MapPin className="h-5 w-5 text-gold-deep" /><span><b className="block text-navy">Location</b>{CONTACT.location}</span></div>
            <div className="flex gap-3"><Clock className="h-5 w-5 text-gold-deep" /><span><b className="block text-navy">Client Portal</b>Submit requests and messages any time — our team responds during business hours.</span></div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line">
            <iframe title="Map of Dar es Salaam" src="https://www.openstreetmap.org/export/embed.html?bbox=39.22%2C-6.86%2C39.32%2C-6.77&layer=mapnik" className="h-56 w-full" loading="lazy" />
          </div>
        </aside>
      </section>
    </>
  );
}
