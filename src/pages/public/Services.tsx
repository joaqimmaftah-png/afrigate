import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import PageHero from '../../components/PageHero';
import { useServices } from '../../contexts/ServicesContext';
import { ServiceIcon, Skeleton, Alert } from '../../components/ui';

export default function Services() {
  const { services, loading, error, reload } = useServices();
  return (
    <>
      <PageHero eyebrow="Our Services" title="Our Professional Services" text="Four focused areas of expertise supporting businesses that trade, comply and grow in Tanzania." />
      <section className="mx-auto max-w-7xl space-y-6 px-4 py-14 sm:px-6">
        {error && <div><Alert>{error}</Alert><button type="button" onClick={reload} className="btn btn-ghost mt-2">Try again</button></div>}
        {!loading && !error && services.length === 0 && <p className="text-muted">Our service catalog is being updated. Please contact us for assistance.</p>}
        {loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        {services.map((s, i) => (
          <article key={s.id} className="card grid gap-6 overflow-hidden p-6 sm:p-8 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-navy text-gold"><ServiceIcon icon={s.icon} className="h-8 w-8" /></div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gold-deep">Service {String(i + 1).padStart(2, '0')}</div>
              <h2 className="mt-1 font-display text-xl font-bold text-navy">{s.title}</h2>
              <p className="mt-1 font-medium text-ink">{s.short_description}</p>
              {s.highlights?.length > 0 && (
                <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-muted sm:grid-cols-2">
                  {s.highlights.slice(0, 4).map((h) => <li key={h} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" />{h}</li>)}
                </ul>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
              <Link to={`/portal/new?service=${s.slug}`} className="btn btn-gold">Request a Consultation</Link>
              <Link to={`/services/${s.slug}`} className="btn btn-ghost">Learn more <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
