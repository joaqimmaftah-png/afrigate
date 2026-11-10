import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Handshake, ShieldCheck, Scale, Globe2, Users, FileSignature, Search, MessagesSquare, BadgeCheck, Mail, Phone, MapPin, Quote, TrendingUp } from 'lucide-react';
import { useServices } from '../../contexts/ServicesContext';
import { ServiceIcon, Skeleton } from '../../components/ui';
import { WhatsAppIcon } from '../../components/PublicLayout';
import { CONTACT, waLink } from '../../lib/constants';
import { api } from '../../lib/api';

const WHY = [
  { icon: ShieldCheck, title: 'Professional & Reliable Services' },
  { icon: Scale, title: 'In-Depth Knowledge of Tanzanian Regulations' },
  { icon: Globe2, title: 'International Business Support' },
  { icon: Users, title: 'Client-Focused Approach' },
];

const STEPS = [
  { icon: FileSignature, title: 'Submit your request', text: 'Choose one of our services, describe what you need and attach any supporting documents. You receive a unique reference number.' },
  { icon: Search, title: 'We review & assign', text: 'Our team reviews your request and assigns a consultant with the right expertise for your matter.' },
  { icon: MessagesSquare, title: 'Consult securely', text: 'Communicate with your consultant, exchange documents and book meetings — all in your private client workspace.' },
  { icon: BadgeCheck, title: 'Receive guidance', text: 'Get professional advice and the consultation outcome, with a complete record retained in your account.' },
];

export default function Home() {
  const { services, loading } = useServices();
  const [testimonials, setTestimonials] = useState<{ id: number; name: string; company: string | null; quote: string }[]>([]);
  useEffect(() => { api('/api/public?action=testimonials').then(setTestimonials).catch(() => setTestimonials([])); }, []);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-navy-deep">
        <img src="/images/hero-port.jpg" alt="Container ship and cranes at a Tanzanian port" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" />
        <div className="hero-overlay absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
          <div className="max-w-2xl">
            <h1 className="rise font-display text-4xl font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-[56px]">
              Afrigate Corporate<br /><span className="text-gold">Services Limited</span>
            </h1>
            <p className="rise mt-4 font-display text-xl font-semibold italic text-white sm:text-2xl" style={{ animationDelay: '.1s' }}>Your Trusted Business Solutions Partner</p>
            <p className="rise mt-4 max-w-xl text-lg leading-relaxed text-white/85" style={{ animationDelay: '.2s' }}>Professional consultation in Import & Export, Tax Compliance and Business Advisory in Tanzania.</p>
            <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: '.3s' }}>
              <Link to="/portal/new" className="btn btn-gold px-6 py-3">Get Consultation <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/services" className="btn btn-outline-light px-6 py-3">Explore Services</Link>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 hidden md:block">
          <div className="relative bg-navy-deep/90 py-4 pl-16 pr-8 text-right" style={{ clipPath: 'polygon(14% 0, 100% 0, 100% 100%, 0 100%)' }}>
            <div className="absolute left-0 top-0 h-full w-2 bg-gold" style={{ transform: 'skewX(-18deg)', left: '6%' }} />
            <div className="text-xs font-semibold tracking-wider text-white/85">Trade • Comply • Grow</div>
            <div className="font-display text-xl font-bold italic text-gold">Together</div>
          </div>
        </div>
      </section>

      {/* SERVICES + CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="mb-8 text-center"><h2 className="gold-rule font-display text-2xl font-bold text-navy sm:text-3xl">Our Professional Services</h2></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}
              {services.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                  <Link to={`/services/${s.slug}`} className="card group flex h-full flex-col items-center p-6 text-center transition hover:-translate-y-1 hover:shadow-xl">
                    <div className="text-navy transition group-hover:text-gold-deep"><ServiceIcon icon={s.icon} className="h-11 w-11" /></div>
                    <h3 className="mt-4 font-display text-[17px] font-bold leading-snug text-navy">{s.title}</h3>
                    <p className="mt-2 flex-1 text-sm text-muted">{s.short_description}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold-deep">Learn More <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
          <aside className="flex flex-col justify-center rounded-2xl bg-navy p-6 text-center text-white shadow-xl lg:mt-[72px]">
            <div className="flex items-center justify-center gap-3"><Handshake className="h-8 w-8 text-gold" /><h3 className="font-display text-lg font-bold">Request a Consultation</h3></div>
            <p className="mt-3 text-sm text-white/80">Let us help you with your business needs. Our experts are ready to assist.</p>
            <Link to="/portal/new" className="btn btn-gold mt-5 w-full">Submit Your Request <ArrowRight className="h-4 w-4" /></Link>
            <div className="my-5 flex items-center gap-3 text-xs text-white/60"><span className="h-px flex-1 bg-white/20" />or contact us directly<span className="h-px flex-1 bg-white/20" /></div>
            <a href={waLink()} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 rounded-xl p-2 hover:bg-white/5">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#25D366]"><WhatsAppIcon className="h-6 w-6" /></span>
              <span className="text-left"><span className="block text-sm font-semibold">Chat on WhatsApp</span><span className="block text-sm text-white/80">{CONTACT.phone}</span></span>
            </a>
          </aside>
        </div>
      </section>

      {/* WHY */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl items-stretch gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px]">
          <div>
            <h2 className="mb-6 font-display text-sm font-bold uppercase tracking-[0.18em] text-gold-deep">Why Choose Afrigate</h2>
            <div className="grid grid-cols-2 gap-y-6 md:grid-cols-4 md:divide-x md:divide-line">
              {WHY.map((w) => (
                <div key={w.title} className="flex flex-col items-center px-4 text-center">
                  <w.icon className="h-9 w-9 text-navy" strokeWidth={1.6} />
                  <p className="mt-3 text-sm font-semibold italic leading-snug text-navy">{w.title}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative flex min-h-[150px] items-center overflow-hidden rounded-2xl bg-navy">
            <img src="/images/handshake.jpg" alt="" className="absolute right-0 top-0 h-full w-1/2 object-cover" style={{ clipPath: 'polygon(22% 0, 100% 0, 100% 100%, 0 100%)' }} />
            <div className="relative flex items-center gap-4 p-6">
              <TrendingUp className="h-10 w-10 shrink-0 text-gold" />
              <p className="max-w-[180px] font-display text-lg font-bold leading-snug text-white">Let's Grow Your Business with Afrigate</p>
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="gold-rule font-display text-2xl font-bold text-navy sm:text-3xl">How the Consultation Process Works</h2>
          <p className="mt-4 text-muted">A transparent, simple process — from your first request to the final guidance, all tracked in one place.</p>
        </div>
        <div className="relative grid gap-6 md:grid-cols-4">
          <div className="absolute left-[12%] right-[12%] top-8 hidden h-0.5 bg-gradient-to-r from-gold/0 via-gold to-gold/0 md:block" />
          {STEPS.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="relative text-center">
              <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-navy text-gold shadow-lg">
                <s.icon className="h-7 w-7" />
                <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-gold text-xs font-bold text-navy-deep">{i + 1}</span>
              </div>
              <h3 className="mt-5 font-display font-bold text-navy">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <Link to="/portal/new" className="btn btn-navy px-6 py-3">Start a consultation <ArrowRight className="h-4 w-4" /></Link>
          <Link to="/track" className="btn btn-ghost px-6 py-3">Track an existing request</Link>
        </div>
      </section>

      {/* TESTIMONIALS — only rendered when genuine, approved testimonials exist */}
      {testimonials.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="mb-10 text-center"><h2 className="gold-rule font-display text-2xl font-bold text-navy">What Our Clients Say</h2></div>
            <div className="grid gap-5 md:grid-cols-3">
              {testimonials.slice(0, 6).map((t) => (
                <figure key={t.id} className="card p-6">
                  <Quote className="h-6 w-6 text-gold" />
                  <blockquote className="mt-3 text-sm leading-relaxed text-ink">{t.quote}</blockquote>
                  <figcaption className="mt-4 text-sm"><span className="font-semibold text-navy">{t.name}</span>{t.company && <span className="text-muted"> · {t.company}</span>}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT STRIP */}
      <section className="bg-navy">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Need advice? Talk to Afrigate today.</h2>
            <p className="mt-2 text-white/75">Reach us by phone, WhatsApp or email — or open your secure client portal to start a consultation.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <a href={waLink()} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-white/5 p-4 text-white hover:bg-white/10"><WhatsAppIcon className="h-6 w-6 text-[#25D366]" /><span className="text-sm"><b className="block">WhatsApp</b>{CONTACT.phone}</span></a>
            <a href={`tel:${CONTACT.tel}`} className="flex items-center gap-3 rounded-xl bg-white/5 p-4 text-white hover:bg-white/10"><Phone className="h-6 w-6 text-gold" /><span className="text-sm"><b className="block">Call us</b>{CONTACT.phone}</span></a>
            <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-3 rounded-xl bg-white/5 p-4 text-white hover:bg-white/10"><Mail className="h-6 w-6 text-gold" /><span className="text-sm"><b className="block">Email</b>{CONTACT.email}</span></a>
            <Link to="/contact" className="flex items-center gap-3 rounded-xl bg-white/5 p-4 text-white hover:bg-white/10"><MapPin className="h-6 w-6 text-gold" /><span className="text-sm"><b className="block">Visit</b>{CONTACT.location}</span></Link>
          </div>
        </div>
      </section>
    </>
  );
}
