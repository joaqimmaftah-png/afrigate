import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ChevronDown, Home, Mail, MapPin, Menu, Phone, User, X, MessageCircle } from 'lucide-react';
import { Logo, ServiceIcon } from './ui';
import { useServices } from '../contexts/ServicesContext';
import { useAuth, homeFor } from '../contexts/AuthContext';
import { CONTACT, waLink } from '../lib/constants';

export function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path fill="currentColor" d="M16.04 3C9.4 3 4 8.36 4 14.97c0 2.11.56 4.17 1.62 5.99L4 29l8.26-1.6a12.1 12.1 0 0 0 3.78.6C22.67 28 28 22.64 28 16.03 28 9.39 22.67 3 16.04 3Zm0 22.9c-1.24 0-2.45-.22-3.6-.65l-.26-.1-4.9.95.97-4.75-.17-.28a9.86 9.86 0 0 1-1.52-5.1c0-5.45 4.47-9.9 9.48-9.9 5.47 0 9.92 4.5 9.92 10 0 5.43-4.45 9.83-9.92 9.83Zm5.44-7.36c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.57-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.63.71.23 1.36.2 1.88.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Our Services', dropdown: true },
  { to: '/about', label: 'About Us' },
  { to: '/tax-information', label: 'Tax Information' },
  { to: '/news', label: 'News & Updates' },
  { to: '/track', label: 'Track Your Request' },
  { to: '/contact', label: 'Contact Us' },
];

export default function PublicLayout() {
  const { services } = useServices();
  const { user, profile } = useAuth();
  const [mobile, setMobile] = useState(false);
  const [dd, setDd] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMobile(false); setDd(false); window.scrollTo(0, 0); }, [loc.pathname]);
  const portalHref = user ? homeFor(profile) : '/login';

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Brand bar */}
      <div className="bg-[#f3f4f9]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <Link to="/" aria-label="Afrigate home"><Logo /></Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <a href={waLink()} target="_blank" rel="noreferrer" className="hidden items-center gap-2 md:flex">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#25D366] text-white"><WhatsAppIcon /></span>
              <span className="font-display text-lg font-semibold text-navy">{CONTACT.phone}</span>
            </a>
            <Link to={portalHref} className="btn btn-gold hidden sm:inline-flex"><User className="h-4 w-4" />{user ? 'My Portal' : 'Client Portal'}</Link>
            <button onClick={() => setMobile(true)} className="grid h-10 w-10 place-items-center rounded-lg bg-navy text-white lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-40 hidden bg-navy shadow-lg lg:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-6">
          {NAV.map((n) =>
            n.dropdown ? (
              <div key={n.to} className="relative" onMouseEnter={() => setDd(true)} onMouseLeave={() => setDd(false)}>
                <NavLink to={n.to} className={({ isActive }) => `my-2 flex items-center gap-1 rounded-md px-4 py-2 text-[15px] font-medium transition ${isActive ? 'bg-gold text-navy-deep' : 'text-white/90 hover:text-gold'}`}>
                  {n.label}<ChevronDown className="h-4 w-4" />
                </NavLink>
                {dd && (
                  <div className="absolute left-0 top-full z-50 w-80 rounded-xl border border-line bg-white p-2 shadow-2xl">
                    {services.map((s) => (
                      <Link key={s.id} to={`/services/${s.slug}`} className="flex gap-3 rounded-lg p-3 hover:bg-canvas">
                        <span className="text-navy"><ServiceIcon icon={s.icon} className="h-5 w-5" /></span>
                        <span><span className="block text-sm font-semibold text-navy">{s.title}</span><span className="block text-xs text-muted">{s.short_description}</span></span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `my-2 flex items-center gap-2 rounded-md px-4 py-2 text-[15px] font-medium transition ${isActive ? 'bg-gold text-navy-deep' : 'text-white/90 hover:text-gold'}`}>
                {n.end && <Home className="h-4 w-4" />}{n.label}
              </NavLink>
            )
          )}
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobile && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-navy-deep/60" onClick={() => setMobile(false)} />
          <div className="rise absolute right-0 top-0 h-full w-[86%] max-w-sm overflow-y-auto bg-navy p-5">
            <div className="mb-6 flex items-center justify-between">
              <Logo variant="light" compact />
              <button onClick={() => setMobile(false)} className="text-white" aria-label="Close menu"><X className="h-6 w-6" /></button>
            </div>
            <div className="space-y-1">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `block rounded-lg px-4 py-3 font-medium ${isActive ? 'bg-gold text-navy-deep' : 'text-white hover:bg-white/10'}`}>{n.label}</NavLink>
              ))}
              <div className="pl-4">
                {services.map((s) => (
                  <Link key={s.id} to={`/services/${s.slug}`} className="block px-4 py-2 text-sm text-white/70 hover:text-gold">{s.title}</Link>
                ))}
              </div>
            </div>
            <Link to={portalHref} className="btn btn-gold mt-6 w-full"><User className="h-4 w-4" />{user ? 'My Portal' : 'Client Portal'}</Link>
            <a href={waLink()} target="_blank" rel="noreferrer" className="btn btn-outline-light mt-3 w-full"><WhatsAppIcon className="h-4 w-4" />{CONTACT.phone}</a>
          </div>
        </div>
      )}

      <main className="flex-1"><Outlet /></main>

      {/* Footer */}
      <footer className="bg-navy-deep text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo variant="light" />
            <p className="mt-4 text-sm leading-relaxed text-white/70">Your Trusted Business Solutions Partner — professional consultation in Import & Export, Tax Compliance and Business Advisory in Tanzania.</p>
            <p className="mt-4 font-display text-sm font-semibold tracking-wide text-gold">Trade • Comply • Grow Together</p>
          </div>
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-wider text-gold">Our Services</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {services.map((s) => <li key={s.id}><Link to={`/services/${s.slug}`} className="text-white/75 hover:text-white">{s.title}</Link></li>)}
            </ul>
          </div>
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-wider text-gold">Quick Links</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[['About Us', '/about'], ['Tax Information', '/tax-information'], ['News & Updates', '/news'], ['Track Your Request', '/track'], ['Client Portal', portalHref], ['Contact Us', '/contact']].map(([l, h]) => (
                <li key={l}><Link to={h} className="text-white/75 hover:text-white">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-display text-sm font-bold uppercase tracking-wider text-gold">Contact</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              <li className="flex gap-3"><MapPin className="h-4 w-4 shrink-0 text-gold" />{CONTACT.location}</li>
              <li><a href={`tel:${CONTACT.tel}`} className="flex gap-3 hover:text-white"><Phone className="h-4 w-4 shrink-0 text-gold" />{CONTACT.phone}</a></li>
              <li><a href={waLink()} target="_blank" rel="noreferrer" className="flex gap-3 hover:text-white"><MessageCircle className="h-4 w-4 shrink-0 text-gold" />WhatsApp us</a></li>
              <li><a href={`mailto:${CONTACT.email}`} className="flex gap-3 hover:text-white"><Mail className="h-4 w-4 shrink-0 text-gold" />{CONTACT.email}</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/55 sm:flex-row sm:px-6">
            <span>© {new Date().getFullYear()} Afrigate Corporate Services Limited. All rights reserved.</span>
            <span>Dar es Salaam, Tanzania</span>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a href={waLink()} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp" className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105">
        <WhatsAppIcon className="h-7 w-7" />
      </a>
    </div>
  );
}
