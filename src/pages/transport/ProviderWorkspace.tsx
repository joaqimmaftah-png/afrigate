import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ClipboardList, FileText, RefreshCw, Send } from 'lucide-react';
import { Alert, EmptyState, Field, Spinner } from '../../components/ui';
import { CONTAINERS, deadline, pickupDate, price, PROVIDER_INBOX, todayEAT, transportPath, type Change, type Opportunity, type Page } from '../../lib/transport';
import { ActionDialog, BackLink, BookingCard, LoadState, Pager, QuoteTerms, RequestSummary, RouteText, TransportHeading, TransportState } from './TransportUI';
import { useTransportAction, useTransportQuery } from './useTransport';

export function ProviderInbox() {
  const [page, setPage] = useState(0);
  const query = useTransportQuery<Page<Opportunity>>(transportPath('inbox', { page }));
  return <div className="space-y-5">
    <TransportHeading eyebrow="Provider workspace" title="Requests & quotes" text="Review invitations, send transport offers, and confirm availability when a client selects your quote."
      action={<button type="button" className="btn btn-ghost btn-sm bg-white" disabled={query.loading} onClick={query.reload}><RefreshCw className="h-4 w-4" /> Refresh</button>} />
    {!query.data && <LoadState error={query.error} retry={query.reload} />}
    {query.data?.items.length === 0 && <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No invitations yet" text="When a client invites your company to quote, the request will appear in this inbox." />}
    <ul className="space-y-3">{query.data?.items.map(item => <li key={`${item.provider_id}/${item.request.id}`}>
      <Link to={`${PROVIDER_INBOX}/${item.provider_id}/${item.request.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-navy/40 sm:p-5">
        <div className="min-w-0"><p className="text-xs font-semibold text-muted [overflow-wrap:anywhere]">{item.provider_name} · {item.request.reference}</p>
          <h2 className="mt-1 font-display font-bold text-navy"><RouteText {...item.request} /></h2>
          <p className="mt-1 text-sm text-muted">{pickupDate(item.request.pickup_date)} · {item.request.container_count} × {CONTAINERS[item.request.container_type]}</p></div>
        <div className="flex items-center gap-3"><TransportState status={item.state} /><ArrowRight className="h-4 w-4 shrink-0 text-navy" /></div>
      </Link>
    </li>)}</ul>
    {query.data && <Pager page={page} more={query.data.has_more} onChange={setPage} />}
  </div>;
}

export function ProviderInvitation() {
  const { providerId, id } = useParams();
  return <div className="space-y-5"><BackLink to={PROVIDER_INBOX}>Requests & quotes</BackLink><Invitation key={`${providerId}/${id}`} id={id || ''} providerId={providerId || ''} /></div>;
}

function Invitation({ id, providerId }: { id: string; providerId: string }) {
  const query = useTransportQuery<Opportunity>(transportPath('opportunity', { id, provider_id: providerId }));
  const mutation = useTransportAction();
  const [editing, setEditing] = useState(false);
  const [action, setAction] = useState<'confirm' | 'decline' | null>(null);
  if (!query.data) return <LoadState error={query.error} retry={query.reload} />;
  const item = query.data;
  const canQuote = item.state === 'quoted' || item.state === 'needs_quote';
  const showForm = canQuote && (editing || !item.quote);
  const canned = action === 'confirm'
    ? { title: 'Confirm this booking?', label: 'Confirm booking', message: 'Only confirm if your company can perform the transport on the offered date and terms. The client will receive the confirmed booking and your business contact.' }
    : { title: 'Decline this request?', label: 'Decline request', message: 'The client will be notified. Your company won’t be able to quote or confirm this request after declining.' };
  const ask = (value: 'confirm' | 'decline') => { mutation.clear(); setAction(value); };
  const act = () => {
    if (action) void mutation.run<Change>(action, { request_id: id, provider_id: providerId, quote_id: item.quote?.id },
      () => { setAction(null); setEditing(false); query.reload(); });
  };
  return <div className="space-y-5">
    <TransportHeading eyebrow="Provider invitation" title={item.request.reference} text={`Invited company: ${item.provider_name}`}
      action={<div className="flex flex-wrap items-center gap-2"><TransportState status={item.state} /><button type="button" className="btn btn-ghost btn-sm bg-white" disabled={query.loading || mutation.busy} onClick={query.reload}><RefreshCw className="h-4 w-4" /> Refresh</button></div>} />
    <RequestSummary request={item.request} />
    {item.booking && <BookingCard booking={item.booking} viewer="provider" />}
    {item.state === 'confirm' && item.confirmation_due_at && <Alert kind="info">
      <p><strong>The client selected your offer.</strong> Confirm availability by {deadline(item.confirmation_due_at)}, or decline if your company can’t take the job.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-navy btn-sm" onClick={() => ask('confirm')} disabled={query.loading}>Confirm booking</button>
        <button type="button" className="btn btn-ghost btn-sm bg-white" onClick={() => ask('decline')} disabled={query.loading}>Decline selection</button>
      </div>
    </Alert>}
    {item.state === 'closed' && <Alert kind="info">This invitation is not accepting replies. Refresh if you’re waiting for a decision.</Alert>}
    {item.state === 'declined' && <Alert kind="info">Your company declined this request.</Alert>}
    {item.quote && <section className="card max-w-2xl space-y-3 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-display font-bold text-navy"><FileText className="h-4 w-4" />{item.booking ? 'Agreed offer' : 'Your latest offer'}</h2>
        {!item.booking && !item.quote.valid && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-muted">Expired</span>}
      </div>
      <QuoteTerms quote={item.quote} currency={item.request.currency} agreed={!!item.booking} />
      {canQuote && !editing && <button type="button" className="btn btn-ghost btn-sm" disabled={query.loading} onClick={() => setEditing(true)}>Revise offer</button>}
    </section>}
    {showForm && <QuoteForm key={item.quote?.id || 'new'} item={item} loading={query.loading} onSaved={() => { setEditing(false); query.reload(); }} onCancel={() => setEditing(false)} />}
    {canQuote && <button type="button" className="btn btn-ghost btn-sm bg-white text-danger" onClick={() => ask('decline')} disabled={query.loading}>Decline request</button>}
    {action && <ActionDialog {...canned} busy={mutation.busy} error={mutation.error} onCancel={() => { setAction(null); query.reload(); }} onConfirm={act} />}
  </div>;
}

function QuoteForm({ item, loading, onSaved, onCancel }: { item: Opportunity; loading: boolean; onSaved: () => void; onCancel: () => void }) {
  const mutation = useTransportAction();
  const q = item.quote;
  const currency = item.request.currency;
  const today = todayEAT();
  const requestedDate = q?.available_on || item.request.pickup_date;
  const [total, setTotal] = useState(q?.total || 0);
  const calculate = (e: FormEvent<HTMLFormElement>) => {
    const form = new FormData(e.currentTarget);
    setTotal(['base_amount','taxes','extra_charges'].reduce((sum, key) => sum + (Number(form.get(key)) || 0), 0));
  };
  const send = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void mutation.run<Change>('submit_quote', {
      ...Object.fromEntries(new FormData(e.currentTarget)), request_id: item.request.id, provider_id: item.provider_id, quote_id: q?.id,
    }, onSaved);
  };
  return <form className="card max-w-2xl space-y-4 p-5 sm:p-6" onSubmit={send} onChange={calculate}>
    <div><h2 className="font-display font-bold text-navy">{q ? 'Revise offer' : 'Send a transport offer'}</h2><p className="mt-1 text-sm text-muted">Quote in {currency}. List any conditions or charges not included in your total.</p></div>
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label={`Transport price (${currency})`} htmlFor="quote-base"><input id="quote-base" name="base_amount" className="input" required type="number" min="0.01" max="99999999999.99" step="0.01" inputMode="decimal" defaultValue={q?.base_amount} /></Field>
      <Field label={`Taxes (${currency})`} htmlFor="quote-taxes"><input id="quote-taxes" name="taxes" className="input" required type="number" min="0" max="99999999999.99" step="0.01" inputMode="decimal" defaultValue={q?.taxes || 0} /></Field>
      <Field label={`Extra charges (${currency})`} htmlFor="quote-extras"><input id="quote-extras" name="extra_charges" className="input" required type="number" min="0" max="99999999999.99" step="0.01" inputMode="decimal" defaultValue={q?.extra_charges || 0} /></Field>
    </div>
    <p className="rounded-xl bg-canvas px-4 py-2 text-sm text-muted" aria-live="polite">Quote total: <strong className="ml-1 text-navy">{price(total, currency)}</strong></p>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Pickup available on" htmlFor="quote-date"><input id="quote-date" name="available_on" className="input" required type="date" min={today} defaultValue={requestedDate < today ? today : requestedDate} /></Field>
      <Field label="Offer valid for" htmlFor="quote-valid" hint="An offer cannot stay open past the offered pickup date."><select id="quote-valid" name="valid_for_hours" className="input" defaultValue="24"><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option><option value="168">7 days</option></select></Field>
    </div>
    <Field label="Inclusions and terms" htmlFor="quote-terms" hint="Note what is included, any exclusions, and whether taxes are included or extra."><textarea id="quote-terms" className="input" name="terms" required rows={4} minLength={5} maxLength={1000} defaultValue={q?.terms} /></Field>
    {mutation.error && <Alert>{mutation.error}</Alert>}
    <div className="flex flex-wrap gap-2"><button type="submit" className="btn btn-gold" disabled={loading || mutation.busy}>{mutation.busy ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}{q ? 'Send revised offer' : 'Send offer'}</button>
      {q && <button type="button" className="btn btn-ghost" disabled={mutation.busy} onClick={onCancel}>Cancel edit</button>}
    </div>
  </form>;
}
