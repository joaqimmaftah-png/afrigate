import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, FileUp, MessagesSquare, CalendarDays } from 'lucide-react';
import PageHero from '../../components/PageHero';
import { api } from '../../lib/api';
import type { Service } from '../../contexts/ServicesContext';
import { useServices } from '../../contexts/ServicesContext';
import { PageLoader, Alert, ServiceIcon } from '../../components/ui';
import { WhatsAppIcon } from '../../components/PublicLayout';
import { waLink } from '../../lib/constants';

export default function ServiceDetail() {
  const { slug } = useParams();
  const { services } = useServices();
  const [s, setS] = useState<Service | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setS(null); api<Service>(`/api/public?action=service&slug=${slug}`).then(setS).catch((e) => setErr(e.message)); }, [slug]);
  if (err) return <div className="mx-auto max-w-3xl p-8"><Alert>{err}</Alert></div>;
  if (!s) return <PageLoader />;
  return (
    <>
      <PageHero eyebrow="Our Services" title={s.title} text={s.short_description}>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={`/portal/new?service=${s.slug}`} className="btn btn-gold">Request a Consultation <ArrowRight className="h-4 w-4" /></Link>
          <a href={waLink(`Hello Afrigate, I need advice on ${s.title}.`)} target="_blank" rel="noreferrer" className="btn btn-outline-light"><WhatsAppIcon className="h-4 w-4" />Ask on WhatsApp</a>
        </div>
      </PageHero>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="card p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold text-navy">About this service</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-ink">{s.description}</p>
            {s.highlights?.length > 0 && (
              <>
                <h3 className="mt-8 font-display font-bold text-navy">How we can help</h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {s.highlights.map((h) => <li key={h} className="flex gap-3 rounded-xl bg-canvas p-3 text-sm"><Check className="h-5 w-5 shrink-0 text-gold-deep" />{h}</li>)}
                </ul>
              </>
            )}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { i: FileUp, t: 'Submit & attach', d: 'Describe your matter and upload supporting documents securely.' },
              { i: MessagesSquare, t: 'Work with a consultant', d: 'Message your assigned consultant in a private workspace.' },
              { i: CalendarDays, t: 'Meet when needed', d: 'Book an in-person, phone, WhatsApp or video meeting.' },
            ].map((x) => (
              <div key={x.t} className="card p-5"><x.i className="h-6 w-6 text-gold-deep" /><h4 className="mt-3 font-display text-sm font-bold text-navy">{x.t}</h4><p className="mt-1 text-sm text-muted">{x.d}</p></div>
            ))}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl bg-navy p-6 text-white">
            <h3 className="font-display font-bold">Ready to get started?</h3>
            <p className="mt-2 text-sm text-white/80">Create a free client account to submit your request and track it from start to finish.</p>
            <Link to={`/portal/new?service=${s.slug}`} className="btn btn-gold mt-4 w-full">Request a Consultation</Link>
          </div>
          <div className="card p-5">
            <h3 className="mb-3 font-display text-sm font-bold text-navy">Other services</h3>
            <ul className="space-y-1">
              {services.filter((x) => x.slug !== s.slug).map((x) => (
                <li key={x.id}><Link to={`/services/${x.slug}`} className="flex items-center gap-3 rounded-lg p-2 text-sm font-medium text-ink hover:bg-canvas"><span className="text-navy"><ServiceIcon icon={x.icon} className="h-5 w-5" /></span>{x.title}</Link></li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </>
  );
}
