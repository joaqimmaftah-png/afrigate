import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ClipboardList, RefreshCw, Truck } from 'lucide-react';
import { Alert, EmptyState } from '../../components/ui';
import { CLIENT_TRANSPORT, CONTAINERS, deadline, pickupDate, price, transportPath, type Change, type Offer, type Page, type RequestDetail, type RequestListItem } from '../../lib/transport';
import { ActionDialog, BackLink, BookingCard, LoadState, Pager, QuoteTerms, RequestSummary, RouteText, TransportHeading, TransportState } from './TransportUI';
import { useTransportAction, useTransportQuery } from './useTransport';

const requestsPath = `${CLIENT_TRANSPORT}/requests`;

export function ClientTransportRequests() {
  const [page, setPage] = useState(0);
  const query = useTransportQuery<Page<RequestListItem>>(transportPath('requests', { page }));
  return <div className="space-y-5">
    <TransportHeading eyebrow="Transport marketplace" title="My transport requests" text="Review the offers you’ve received and see which bookings are confirmed." action={<Link to={CLIENT_TRANSPORT} className="btn btn-gold"><Truck className="h-4 w-4" /> Find providers</Link>} />
    {!query.data && <LoadState error={query.error} retry={query.reload} />}
    {query.data?.items.length === 0 && <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No transport requests yet" text="Choose a verified provider or shortlist several to start receiving quotes." action={<Link to={CLIENT_TRANSPORT} className="btn btn-navy">Explore providers</Link>} />}
    <ul className="space-y-3">{query.data?.items.map(item => <li key={item.id}>
      <Link to={`${requestsPath}/${item.id}`} className="card flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4 transition hover:border-navy/40 sm:p-5">
        <div className="min-w-0"><p className="font-mono text-xs font-bold text-navy-soft">{item.reference}</p><h2 className="mt-1 font-display font-bold text-navy"><RouteText {...item} /></h2>
          <p className="mt-1 text-sm text-muted">{pickupDate(item.pickup_date)} · {item.container_count} × {CONTAINERS[item.container_type]}</p></div>
        <div className="flex flex-wrap items-center gap-3 text-sm"><TransportState status={item.status} /><span className="text-muted">{item.quote_count} of {item.invite_count} providers quoted</span><ArrowRight className="h-4 w-4 shrink-0 text-navy" /></div>
      </Link>
    </li>)}</ul>
    {query.data && <Pager page={page} more={query.data.has_more} onChange={setPage} />}
  </div>;
}

type Choice = { action: 'select_quote' | 'release_quote' | 'close_request'; quoteId?: string; title: string; message: string; label: string };
const usable = (offer: Offer) => !!offer.quote?.valid && !offer.declined && offer.provider_ready;

export function ClientTransportRequest() {
  const { id } = useParams();
  return <div className="space-y-5"><BackLink to={requestsPath}>My transport requests</BackLink><RequestDetailPage key={id} id={id || ''} /></div>;
}

function RequestDetailPage({ id }: { id: string }) {
  const query = useTransportQuery<RequestDetail>(transportPath('request', { id }));
  const mutation = useTransportAction();
  const [choice, setChoice] = useState<Choice | null>(null);
  if (!query.data) return <LoadState error={query.error} retry={query.reload} />;
  const { request, offers, booking, confirmation_due_at: due, selected_quote_id: selected } = query.data;
  const ordered = [...offers].sort((a,b) => Number(b.quote?.id === selected) - Number(a.quote?.id === selected)
    || Number(usable(b)) - Number(usable(a)) || (a.quote?.total ?? Infinity) - (b.quote?.total ?? Infinity)
    || a.provider_name.localeCompare(b.provider_name));
  const selection = offers.find(offer => offer.quote?.id === selected);
  const matchedName = booking?.provider_name || selection?.provider_name;
  const choose = (value: Choice) => { mutation.clear(); setChoice(value); };
  const change = () => {
    if (!choice) return;
    void mutation.run<Change>(choice.action, { request_id: id, quote_id: choice.quoteId }, () => { setChoice(null); query.reload(); });
  };
  return <div className="space-y-5">
    <TransportHeading eyebrow="Transport request" title={request.reference} text="Review and compare offers from the providers you invited."
      action={<div className="flex flex-wrap items-center gap-2"><TransportState status={request.status} /><button type="button" className="btn btn-ghost btn-sm bg-white" onClick={query.reload} disabled={query.loading || mutation.busy}><RefreshCw className="h-4 w-4" /> Refresh</button></div>} />
    <RequestSummary request={request} />
    {booking && <BookingCard booking={booking} viewer="client" />}
    {request.status === 'awaiting_confirmation' && selection && <Alert kind="info">
      <p><strong>Waiting for {matchedName} to confirm.</strong> This isn’t a booking yet.{due && ` Confirm by ${deadline(due)} or the request will reopen.`}</p>
      {!selection.provider_ready && <p className="mt-1">This provider is currently unavailable. You can withdraw the selection and choose another offer.</p>}
      {selected && <button type="button" className="mt-2 font-semibold underline" disabled={query.loading} onClick={() => choose({ action: 'release_quote', quoteId: selected, title: 'Withdraw your selection?', message: 'The selected provider will be notified. You can review the offers and select another one.', label: 'Withdraw selection' })}>Withdraw selection</button>}
    </Alert>}
    {request.status === 'open' && <p className="text-sm text-muted">Selecting an offer asks that provider to confirm availability. Your other offers remain available until they expire.</p>}
    {request.status === 'closed' && <Alert kind="info">This request is closed. Offers are kept here for your reference.</Alert>}
    <section className="space-y-3" aria-label="Compare transport offers">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="font-display text-lg font-bold text-navy">Provider offers</h2><span className="text-sm text-muted">All prices in {request.currency} · {offers.length} invited</span></div>
      <div className={`grid gap-3 sm:grid-cols-2 ${ordered.length > 2 ? 'xl:grid-cols-3' : ''}`}>{ordered.map(offer => {
        const quote = offer.quote;
        const picked = quote?.id === selected;
        const selectable = request.status === 'open' && usable(offer);
        const label = picked ? (booking ? 'Agreed offer' : 'Selected offer') : offer.declined ? 'Declined' : !offer.provider_ready ? 'Provider unavailable'
          : !quote ? (request.status === 'open' || request.status === 'awaiting_confirmation' ? 'Waiting for offer' : 'No offer')
          : request.status === 'booked' ? 'Not selected' : !quote.valid ? 'Expired' : 'Offer received';
        return <article key={offer.provider_id} className={`card flex min-w-0 flex-col gap-3 p-4 sm:p-5 ${picked ? 'ring-2 ring-gold' : ''}`}>
          <div><p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p><h3 className="mt-1 font-display font-bold text-navy [overflow-wrap:anywhere]">{picked && booking ? booking.provider_name : offer.provider_name}</h3></div>
          {quote && <QuoteTerms quote={quote} currency={request.currency} agreed={picked && !!booking} />}
          {selectable && quote && <button type="button" disabled={query.loading} className="btn btn-navy btn-sm mt-auto w-full" onClick={() => choose({ action: 'select_quote', quoteId: quote.id,
            title: 'Select this offer?', message: `Ask ${offer.provider_name} to confirm their offer of ${price(quote.total, request.currency)}. The booking won’t be confirmed until they accept.`, label: 'Select offer' })}>Select offer <span className="sr-only">from {offer.provider_name}</span></button>}
        </article>;
      })}</div>
    </section>
    {(request.status === 'open' || request.status === 'awaiting_confirmation') && <button type="button" className="btn btn-ghost btn-sm bg-white text-danger" disabled={query.loading} onClick={() => choose({ action: 'close_request', title: 'Close this quote request?', message: 'Invited providers will be notified, and no offer can be selected on this request. This won’t affect any other request.', label: 'Close request' })}>Close request</button>}
    {choice && <ActionDialog {...choice} busy={mutation.busy} error={mutation.error} onCancel={() => { setChoice(null); query.reload(); }} onConfirm={change} />}
  </div>;
}
