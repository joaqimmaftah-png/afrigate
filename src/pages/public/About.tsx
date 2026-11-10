import { Link } from 'react-router-dom';
import { ShieldCheck, Scale, Globe2, Users, ArrowRight, Target, Eye } from 'lucide-react';
import PageHero from '../../components/PageHero';
import { useServices } from '../../contexts/ServicesContext';
import { ServiceIcon } from '../../components/ui';

export default function About() {
  const { services } = useServices();
  return (
    <>
      <PageHero eyebrow="About Us" title="Your Trusted Business Solutions Partner" text="Afrigate Corporate Services Limited is a Dar es Salaam–based consultancy helping businesses trade, comply and grow in Tanzania." />
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="font-display text-2xl font-bold text-navy">Who we are</h2>
          <div className="prose-afg mt-4">
            <p>Afrigate Corporate Services Limited provides professional consultation in Import & Export, Tax Compliance and Business Advisory in Tanzania. We work with entrepreneurs, companies and international partners who need clear, reliable guidance on the procedures and regulations that affect their business.</p>
            <p>Our approach is simple: understand your situation, explain your options clearly, and support you through each step — so you can focus on running and growing your business.</p>
            <p>Through our client portal, every engagement is documented, transparent and easy to follow: you can submit requests, share documents, speak with your consultant and track progress at any time.</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl">
          <img src="/images/handshake.jpg" alt="Business partners shaking hands" className="h-80 w-full object-cover sm:h-96" />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-navy-deep/90 to-transparent p-6">
            <p className="font-display text-xl font-bold text-white">Trade • Comply • Grow <span className="italic text-gold">Together</span></p>
          </div>
        </div>
      </section>
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-2">
          <div className="card p-7"><Target className="h-7 w-7 text-gold-deep" /><h3 className="mt-3 font-display text-lg font-bold text-navy">Our mission</h3><p className="mt-2 text-muted">To give businesses dependable, practical advice on trade, tax and corporate matters in Tanzania, delivered with professionalism and care.</p></div>
          <div className="card p-7"><Eye className="h-7 w-7 text-gold-deep" /><h3 className="mt-3 font-display text-lg font-bold text-navy">Our commitment</h3><p className="mt-2 text-muted">Clear communication, confidentiality of your information and documents, and a transparent process you can follow from request to outcome.</p></div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-center font-display text-2xl font-bold text-navy">What we do</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <Link key={s.id} to={`/services/${s.slug}`} className="card p-6 transition hover:shadow-lg">
              <span className="text-navy"><ServiceIcon icon={s.icon} className="h-8 w-8" /></span>
              <h3 className="mt-3 font-display font-bold text-navy">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.short_description}</p>
            </Link>
          ))}
        </div>
        <h2 className="mt-16 text-center font-display text-2xl font-bold text-navy">Why Choose Afrigate</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { i: ShieldCheck, t: 'Professional & Reliable Services', d: 'Structured engagements with clear status updates and documented outcomes.' },
            { i: Scale, t: 'In-Depth Knowledge of Tanzanian Regulations', d: 'Guidance grounded in local customs, tax and business registration procedures.' },
            { i: Globe2, t: 'International Business Support', d: 'Support for importers, exporters and foreign partners doing business in Tanzania.' },
            { i: Users, t: 'Client-Focused Approach', d: 'A dedicated consultant and a private workspace for every request.' },
          ].map((w) => (
            <div key={w.t} className="rounded-2xl bg-navy p-6 text-white"><w.i className="h-7 w-7 text-gold" /><h3 className="mt-3 font-display font-bold">{w.t}</h3><p className="mt-2 text-sm text-white/75">{w.d}</p></div>
          ))}
        </div>
        <div className="mt-12 text-center"><Link to="/portal/new" className="btn btn-gold px-6 py-3">Request a Consultation <ArrowRight className="h-4 w-4" /></Link></div>
      </section>
    </>
  );
}
