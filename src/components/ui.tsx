import { type ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, X, Ship, Calculator, Building2, Globe2, Briefcase } from 'lucide-react';
import { STATUS_META, STATUSES, fmtDateTime } from '../lib/constants';

export function LogoMark({ className = 'h-9 w-9', light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 48 44" className={className} aria-hidden>
      <path d="M3 42 L22 3 L28 3 L46 42 H35.5 L25 18.5 L14 42 Z" fill={light ? '#ffffff' : '#0b2a5b'} />
      <path d="M0 37 C13 30 26 25 46 14 C36 25 22 33 8 42 L3 42 Z" fill="#e8a94a" />
    </svg>
  );
}

export function Logo({ variant = 'image', compact = false }: { variant?: 'image' | 'light'; compact?: boolean }) {
  if (variant === 'image') {
    return <img src="/images/logo.png" alt="Afrigate Corporate Services Limited — Your Trusted Business Solutions Partner" className={compact ? 'h-10 w-auto' : 'h-12 sm:h-14 w-auto'} />;
  }
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className={compact ? 'h-8 w-8' : 'h-10 w-10'} light />
      <div className="leading-none">
        <div className={`font-display font-extrabold tracking-wide text-white ${compact ? 'text-lg' : 'text-xl'}`}>AFRIGATE</div>
        <div className="font-display text-[9px] font-semibold tracking-[0.14em] text-gold mt-1">CORPORATE SERVICES LIMITED</div>
      </div>
    </div>
  );
}

export function ServiceIcon({ icon, className = 'h-6 w-6' }: { icon?: string; className?: string }) {
  const map: Record<string, typeof Ship> = { ship: Ship, calculator: Calculator, building: Building2, globe: Globe2 };
  const I = map[icon || ''] || Briefcase;
  return <I className={className} strokeWidth={1.75} />;
}

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const m = STATUS_META[status] || STATUS_META['Submitted'];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${m.tone} ${size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {status}
    </span>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted">
      <Spinner className="h-7 w-7 text-navy" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

export function Alert({ kind = 'error', children, onClose }: { kind?: 'error' | 'success' | 'info'; children: ReactNode; onClose?: () => void }) {
  const tone = kind === 'error' ? 'bg-red-50 text-red-800 border-red-200' : kind === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-sky-50 text-sky-900 border-sky-200';
  const Icon = kind === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${tone}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
      {onClose && <button onClick={onClose} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-gold-soft text-gold-deep">{icon}</div>
      <h3 className="font-display font-bold text-navy">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-navy-deep/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className={`rise max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4">
          <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-canvas" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs font-medium text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = 'navy', to }: { label: string; value: number | string; icon: ReactNode; tone?: 'navy' | 'gold' | 'green' | 'amber' | 'red'; to?: string }) {
  const tones: Record<string, string> = {
    navy: 'bg-navy/5 text-navy', gold: 'bg-gold-soft text-gold-deep', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700',
  };
  const inner = (
    <div className="card flex items-center gap-4 p-4 transition hover:shadow-md">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="font-display text-2xl font-bold text-ink">{value}</div>
        <div className="truncate text-xs font-medium text-muted">{label}</div>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export function StatusTimeline({ history, current }: { history: { status: string; created_at: string; note?: string | null; changed_by_name?: string | null }[]; current: string }) {
  const mainFlow = STATUSES.filter((s) => s !== 'Awaiting Customer Information');
  const currentIdx = mainFlow.indexOf(current as (typeof mainFlow)[number]);
  const reached = (s: string) => history.some((h) => h.status === s);
  return (
    <div>
      <ol className="relative space-y-0">
        {mainFlow.map((s, i) => {
          const entry = [...history].reverse().find((h) => h.status === s);
          const done = reached(s) || (currentIdx >= 0 && i <= currentIdx);
          const isCurrent = s === current || (current === 'Awaiting Customer Information' && s === 'In Progress' && false);
          return (
            <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
              {i < mainFlow.length - 1 && <span className={`absolute left-[9px] top-5 h-full w-0.5 ${done ? 'bg-gold' : 'bg-line'}`} />}
              <span className={`relative z-10 mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${isCurrent ? 'border-gold bg-gold' : done ? 'border-gold bg-white' : 'border-line bg-white'}`}>
                {done && !isCurrent && <span className="h-2 w-2 rounded-full bg-gold" />}
              </span>
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${done ? 'text-ink' : 'text-muted/70'}`}>{s}</div>
                {entry && <div className="text-xs text-muted">{fmtDateTime(entry.created_at)}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      {current === 'Awaiting Customer Information' && (
        <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Awaiting Customer Information — please reply in the conversation.</div>
      )}
    </div>
  );
}
