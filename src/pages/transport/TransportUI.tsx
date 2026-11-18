import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Container, Mail, RefreshCw } from 'lucide-react';
import { Alert, Skeleton, Spinner } from '../../components/ui';
import { CONTAINERS, deadline, pickupDate, price, SERVICES, type Booking, type Currency, type OpportunityStatus, type ProviderStatus, type Quote, type RequestStatus, type TransportRequest } from '../../lib/transport';

const states: Record<RequestStatus | ProviderStatus | OpportunityStatus, [string, string]> = {
  open: ['Open for quotes', 'bg-sky-50 text-sky-900'], awaiting_confirmation: ['Awaiting confirmation', 'bg-amber-50 text-amber-900'],
  booked: ['Confirmed', 'bg-emerald-50 text-emerald-800'], closed: ['Closed', 'bg-slate-100 text-slate-700'],
  pending: ['Pending review', 'bg-amber-50 text-amber-900'], approved: ['Verified and listed', 'bg-emerald-50 text-emerald-800'],
  suspended: ['Suspended', 'bg-red-50 text-red-800'], needs_quote: ['Needs a quote', 'bg-sky-50 text-sky-900'],
  quoted: ['Quote sent', 'bg-indigo-50 text-indigo-800'], confirm: ['Confirm availability', 'bg-amber-50 text-amber-900'],
  declined: ['Declined', 'bg-slate-100 text-slate-700'],
};

export function TransportState({ status }: { status: keyof typeof states }) {
  const [label, tone] = states[status];
  return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{label}</span>;
}

export function Verified() {
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800"><BadgeCheck className="h-3.5 w-3.5 shrink-0" /> Verified</span>;
}

export function TransportHeading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text?: string; action?: ReactNode }) {
  return <header className="flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-navy-soft">{eyebrow}</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold text-navy sm:text-3xl">{title}</h1>
      {text && <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{text}</p>}
    </div>
    {action}
  </header>;
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="inline-flex items-center gap-2 text-sm font-semibold text-navy hover:underline"><ArrowLeft className="h-4 w-4" />{children}</Link>;
}

export function LoadState({ error, retry }: { error?: string; retry: () => void }) {
  if (error) return <Alert>{error} <button type="button" className="ml-2 inline-flex items-center gap-1 font-semibold underline" onClick={retry}><RefreshCw className="h-3 w-3" /> Try again</button></Alert>;
  return <div className="space-y-3" role="status" aria-label="Loading transport information"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
}

export function Pager({ page, more, onChange }: { page: number; more: boolean; onChange: (page: number) => void }) {
  if (!page && !more) return null;
  return <nav aria-label="Transport results pages" className="flex flex-wrap items-center justify-between gap-2">
    <button type="button" className="btn btn-ghost btn-sm" disabled={!page} onClick={() => onChange(page - 1)}><ChevronLeft className="h-4 w-4" /> Previous</button>
    <span className="text-sm text-muted">Page {page + 1}</span>
    <button type="button" className="btn btn-ghost btn-sm" disabled={!more} onClick={() => onChange(page + 1)}> Next <ChevronRight className="h-4 w-4" /></button>
  </nav>;
}

export function RouteText({ origin, destination }: { origin: string; destination: string }) {
  return <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 [overflow-wrap:anywhere]">
    {origin}<ArrowRight className="h-[1em] w-[1em] shrink-0 text-gold-deep" aria-label="to" />{destination}
  </span>;
}

export function RequestSummary({ request }: { request: TransportRequest }) {
  return <div className="card space-y-4 p-5 sm:p-6">
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{SERVICES[request.service_type]}</p>
      <h2 className="mt-1 font-display text-lg font-bold text-navy sm:text-xl"><RouteText origin={request.origin} destination={request.destination} /></h2>
    </div>
    <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
      <div className="flex items-start gap-2"><CalendarDays className="h-5 w-5 shrink-0 text-navy-soft" /><div><p className="text-xs text-muted">Preferred pickup</p><p className="font-semibold">{pickupDate(request.pickup_date)}</p></div></div>
      <div className="flex items-start gap-2"><Container className="h-5 w-5 shrink-0 text-navy-soft" /><div><p className="text-xs text-muted">Equipment</p><p className="font-semibold">{request.container_count} × {CONTAINERS[request.container_type]}</p></div></div>
      <div><p className="text-xs text-muted">Quote currency</p><p className="font-semibold">{request.currency}</p></div>
    </div>
    {request.requirements && <div className="border-t border-line pt-3 text-sm"><p className="font-semibold text-navy">Job requirements</p><p className="mt-1 whitespace-pre-wrap text-muted [overflow-wrap:anywhere]">{request.requirements}</p></div>}
  </div>;
}

export function QuoteTerms({ quote, currency, agreed = false }: { quote: Quote; currency: Currency; agreed?: boolean }) {
  const rows = [
    ['Transport price', price(quote.base_amount, currency)], ['Taxes', price(quote.taxes, currency)],
    ['Additional charges', price(quote.extra_charges, currency)], ['Pickup offered', pickupDate(quote.available_on)],
    ...(!agreed ? [['Offer valid until', deadline(quote.valid_until)]] : []),
  ];
  return <div className="space-y-3">
    <p className="rounded-lg bg-canvas px-3 py-2 font-display text-lg font-bold text-navy [overflow-wrap:anywhere]">{price(quote.total, currency)} <span className="ml-1 font-sans text-xs font-semibold text-muted">total</span></p>
    <dl className="divide-y divide-line text-sm">{rows.map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-x-2 py-1.5"><dt className="text-muted">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
    <div className="border-t border-line pt-2 text-sm"><h4 className="font-semibold text-navy">Inclusions and terms</h4><p className="mt-1 whitespace-pre-wrap text-muted [overflow-wrap:anywhere]">{quote.terms}</p></div>
  </div>;
}

export function BookingCard({ booking, viewer }: { booking: Booking; viewer: 'client' | 'provider' }) {
  const [name, email] = viewer === 'client' ? [booking.provider_name, booking.provider_email] : [booking.customer_name, booking.customer_email];
  return <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
    <div className="flex gap-3"><CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-emerald-700" /><div>
      <h2 className="font-display text-lg font-bold text-emerald-950">Booking confirmed</h2>
      <p className="mt-1 text-sm text-emerald-900"><strong>{booking.reference}</strong> · {deadline(booking.confirmed_at)}</p>
      <p className="mt-2 text-sm text-emerald-900">Invoicing and next arrangements are handled directly between the client and provider.</p>
    </div></div>
    <div className="min-w-0 rounded-xl bg-white/75 px-4 py-2 text-sm"><p className="font-semibold text-emerald-950 [overflow-wrap:anywhere]">{name}</p>
      <a href={`mailto:${encodeURIComponent(email).replace('%40', '@')}`} className="inline-flex items-center gap-1.5 text-navy underline [overflow-wrap:anywhere]"><Mail className="h-4 w-4 shrink-0" />{email}</a>
    </div>
  </section>;
}

export function ActionDialog({ title, message, label, busy, error, onCancel, onConfirm }: {
  title: string; message: string; label: string; busy: boolean; error: string; onCancel: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return <dialog ref={dialog} aria-labelledby={heading} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}
    className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-2xl border border-line bg-white p-5 text-ink shadow-2xl backdrop:bg-navy-deep/50 sm:p-6">
    <div className="space-y-4">
      <h2 id={heading} className="font-display text-lg font-bold text-navy [overflow-wrap:anywhere]">{title}</h2>
      <p className="text-sm text-muted">{message}</p>
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Go back</button>
        <button type="button" className="btn btn-navy" onClick={onConfirm} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{label}</button>
      </div>
    </div>
  </dialog>;
}
