import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, MessagesSquare, FolderLock, CalendarCheck2 } from 'lucide-react';
import { Logo } from '../../components/ui';

export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col bg-white px-5 py-8 sm:px-10">
        <Link to="/" className="w-fit"><Logo compact /></Link>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-2xl font-extrabold text-navy sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
        <p className="text-center text-xs text-muted">© {new Date().getFullYear()} Afrigate Corporate Services Limited</p>
      </div>
      <div className="relative hidden overflow-hidden bg-navy lg:block">
        <img src="/images/hero-port.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-br from-navy-deep/95 via-navy/85 to-navy/60" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Afrigate Client Portal</div>
          <h2 className="mt-3 max-w-md font-display text-3xl font-extrabold leading-tight">Your digital office for trade, tax and business advisory.</h2>
          <ul className="mt-8 space-y-4">
            {[
              { i: MessagesSquare, t: 'Message your consultant in a private workspace' },
              { i: FolderLock, t: 'Exchange documents securely' },
              { i: CalendarCheck2, t: 'Book consultations online, by phone or in person' },
              { i: ShieldCheck, t: 'Track every request with a unique reference' },
            ].map((x) => <li key={x.t} className="flex items-center gap-3 text-white/85"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-gold"><x.i className="h-5 w-5" /></span>{x.t}</li>)}
          </ul>
          <p className="mt-10 font-display text-sm font-semibold tracking-wide text-gold">Trade • Comply • Grow Together</p>
        </div>
      </div>
    </div>
  );
}

export function GoogleButton({ onClick, label = 'Continue with Google' }: { onClick: () => void; label?: string }) {
  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID || !import.meta.env.VITE_GOOGLE_AUTH_PROXY) return null;
  return (
    <button type="button" onClick={onClick} className="btn btn-ghost w-full rounded-xl py-3">
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" /><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.4 7.4 24 12 24z" /><path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5h-4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z" /><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" /></svg>
      {label}
    </button>
  );
}
