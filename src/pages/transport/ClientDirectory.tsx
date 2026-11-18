import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ClipboardList, MapPin, Plus, Search, SlidersHorizontal, Truck, X } from 'lucide-react';
import { Alert, EmptyState, Field, Spinner } from '../../components/ui';
import {
  CLIENT_TRANSPORT, CONTAINERS, CURRENCIES, MAX_SHORTLIST, SERVICES, todayEAT, transportPath, withShortlist,
  type Change, type Page, type Provider,
} from '../../lib/transport';
import { BackLink, LoadState, Pager, RouteText, TransportHeading, Verified } from './TransportUI';
import { useTransportAction, useTransportQuery } from './useTransport';

const filterKeys = ['q', 'service', 'container', 'origin', 'destination'] as const;
const validId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const getIds = (params: URLSearchParams) => [...new Set((params.get('ids') || '').split(',').map(id => id.toLowerCase()).filter(id => validId.test(id)))].slice(0, MAX_SHORTLIST);

export function TransportClientLayout() {
  return <div className="space-y-5">
    <nav className="flex flex-wrap gap-2" aria-label="Client transport workspace">
      <NavLink to={CLIENT_TRANSPORT} end className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-navy' : 'btn-ghost bg-white'}`}><Truck className="h-4 w-4" /> Find providers</NavLink>
      <NavLink to={`${CLIENT_TRANSPORT}/requests`} className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-navy' : 'btn-ghost bg-white'}`}><ClipboardList className="h-4 w-4" /> My transport requests</NavLink>
    </nav>
    <Outlet />
  </div>;
}

export function ProviderDirectory() {
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const selected = getIds(params);
  const filters = Object.fromEntries(filterKeys.map(key => [key, params.get(key) || '']));
  const page = Math.min(10000, Math.max(0, parseInt(params.get('page') || '0', 10) || 0));
  const list = useTransportQuery<Page<Provider>>(transportPath('directory', { ...filters, page }));
  const shortlist = useTransportQuery<Page<Provider>>(selected.length ? transportPath('directory', { ids: selected.join(',') }) : '');
  const filtered = Object.values(filters).some(Boolean);
  const foundProviders = shortlist.data?.items || [];
  const missing = shortlist.data ? selected.filter(id => !foundProviders.some(p => p.id === id)) : [];
  const updateIds = (ids: string[]) => {
    const next = new URLSearchParams(params);
    if (ids.length) next.set('ids', ids.join(',')); else next.delete('ids');
    setParams(next, { replace: true, preventScrollReset: true });
  };
  const filter = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    const next = new URLSearchParams();
    for (const key of filterKeys) {
      const value = String(values.get(key) || '').trim();
      if (value) next.set(key, value);
    }
    if (selected.length) next.set('ids', selected.join(','));
    setParams(next);
    setShowFilters(false);
  };

  return <div className="space-y-5">
    <header className="relative isolate overflow-hidden rounded-3xl bg-navy-deep px-6 py-7 text-white sm:px-8 sm:py-9">
      <img src="/images/hero-port.jpg" alt="" className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-45" />
      <div className="absolute inset-0 -z-10 bg-linear-to-r from-navy-deep via-navy-deep/90 to-navy-deep/40" />
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.19em] text-gold"><Truck className="h-4 w-4" /> Transport marketplace</p>
      <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight sm:text-4xl">Find a transport provider</h1>
      <p className="mt-3 max-w-xl text-sm text-white/90 sm:text-base">Search verified local and transit container carriers. Send one request to your shortlist and compare their offers in one place.</p>
    </header>

    <button type="button" className="btn btn-ghost bg-white sm:hidden" aria-expanded={showFilters} aria-controls="transport-filters" onClick={() => setShowFilters(value => !value)}><SlidersHorizontal className="h-4 w-4" /> {filtered ? 'Edit search filters' : 'Search & filters'}</button>
    <form id="transport-filters" key={JSON.stringify(filters)} onSubmit={filter} className={`card ${showFilters ? 'grid' : 'hidden sm:grid'} items-end gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3`}>
      <Field label="Provider name or base city" htmlFor="transport-search"><input className="input" id="transport-search" name="q" maxLength={120} placeholder="Search companies" defaultValue={filters.q} /></Field>
      <Field label="Service type" htmlFor="transport-service"><select className="input" id="transport-service" name="service" defaultValue={filters.service}><option value="">All services</option>{Object.entries(SERVICES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Container type" htmlFor="transport-equipment"><select className="input" id="transport-equipment" name="container" defaultValue={filters.container}><option value="">All container types</option>{Object.entries(CONTAINERS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="Route origin" htmlFor="transport-origin"><input className="input" id="transport-origin" name="origin" placeholder="e.g. Dar es Salaam" maxLength={100} defaultValue={filters.origin} /></Field>
      <Field label="Route destination" htmlFor="transport-destination"><input className="input" id="transport-destination" name="destination" placeholder="e.g. Kibaha or Lusaka" maxLength={100} defaultValue={filters.destination} /></Field>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-navy"><Search className="h-4 w-4" /> Search</button>
        {filtered && <Link className="btn btn-ghost" to={withShortlist(CLIENT_TRANSPORT, selected)}>Clear filters</Link>}
      </div>
    </form>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
      <section aria-label="Provider directory results" className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="font-display text-lg font-bold text-navy">Verified providers</h2><span className="text-sm text-muted" aria-live="polite">{list.data ? `${list.data.items.length} on this page` : ''}</span></div>
        {!list.data && <LoadState error={list.error} retry={list.reload} />}
        {list.data?.items.length === 0 && <EmptyState icon={<Search className="h-6 w-6" />} title={filtered ? 'No providers match these filters' : 'No verified providers listed yet'} text={filtered ? 'Try a broader route, or clear the filters to see all providers.' : 'Approved transport companies will appear here once they are onboarded.'} />}
        <div className="grid gap-3 sm:grid-cols-2">
          {list.data?.items.map(p => {
            const active = selected.includes(p.id);
            return <article key={p.id} className={`card flex min-w-0 flex-col gap-3 p-4 sm:p-5 ${active ? 'ring-2 ring-gold' : ''}`}>
              <div className="flex items-start justify-between gap-2"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy/5 text-navy"><Truck className="h-5 w-5" /></div><Verified /></div>
              <div><h3 className="font-display font-bold text-navy [overflow-wrap:anywhere]">{p.name}</h3><p className="mt-1 flex items-center gap-1.5 text-sm text-muted [overflow-wrap:anywhere]"><MapPin className="h-4 w-4 shrink-0" />{p.base_city}</p></div>
              {p.description && <p className="text-sm text-muted [overflow-wrap:anywhere]">{p.description}</p>}
              <div className="flex flex-wrap gap-1.5">{[...new Set(p.lanes.map(l => l.service_type))].map(type => <span key={type} className="rounded-md bg-canvas px-2 py-0.5 text-xs font-semibold text-navy">{SERVICES[type]}</span>)}</div>
              <div className="space-y-1 border-t border-line pt-3 text-sm"><p className="font-semibold text-navy">Routes</p>
                <ul className="space-y-0.5 text-muted">{p.lanes.slice(0, 2).map((lane, index) => <li key={index}><RouteText {...lane} /></li>)}</ul>
                {p.lanes.length > 2 && <details><summary className="cursor-pointer font-semibold text-navy">{p.lanes.length - 2} more routes</summary><ul className="space-y-0.5 text-muted">{p.lanes.slice(2).map((lane, index) => <li key={index}><RouteText {...lane} /> · {SERVICES[lane.service_type]}</li>)}</ul></details>}
                <p className="pt-1 text-xs text-muted">{p.container_types.map(type => CONTAINERS[type]).join(' · ')}</p>
              </div>
              <button type="button" aria-label={`Shortlist ${p.name}`} aria-pressed={active} disabled={!active && selected.length >= MAX_SHORTLIST}
                className={`btn btn-sm mt-auto w-full ${active ? 'btn-navy' : 'btn-ghost'}`}
                onClick={() => updateIds(active ? selected.filter(id => id !== p.id) : [...selected, p.id])}>{active ? <BadgeCheck className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{active ? 'Shortlisted' : 'Add to shortlist'}</button>
            </article>;
          })}
        </div>
        {list.data && <Pager page={page} more={list.data.has_more} onChange={n => {
          const next = new URLSearchParams(params);
          if (n) next.set('page', String(n)); else next.delete('page');
          setParams(next);
        }} />}
      </section>
      <aside className="card order-first space-y-3 p-4 xl:sticky xl:top-20 xl:order-none" aria-label="Provider shortlist">
        <div className="flex items-center justify-between gap-2"><h2 className="font-display font-bold text-navy">Your shortlist</h2><span className="rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-navy">{selected.length} / {MAX_SHORTLIST}</span></div>
        <p className="text-sm text-muted">Choose one or more companies to receive the same private request.</p>
        {shortlist.loading && <p className="text-sm text-muted" role="status">Updating shortlist…</p>}
        {shortlist.error && <LoadState error={shortlist.error} retry={shortlist.reload} />}
        {!!foundProviders.length && <ul className="divide-y divide-line rounded-xl border border-line px-3">{foundProviders.map(p => <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm font-semibold text-navy"><span className="[overflow-wrap:anywhere]">{p.name}</span><button type="button" aria-label={`Remove ${p.name}`} className="rounded-full p-1.5 hover:bg-canvas" onClick={() => updateIds(selected.filter(id => id !== p.id))}><X className="h-4 w-4" /></button></li>)}</ul>}
        {!!missing.length && <button type="button" className="text-left text-sm font-semibold text-danger underline" onClick={() => updateIds(selected.filter(id => !missing.includes(id)))}>Remove {missing.length} unavailable {missing.length === 1 ? 'provider' : 'providers'}</button>}
        {foundProviders.length > 0 && !missing.length && <Link className="btn btn-gold w-full" to={withShortlist(`${CLIENT_TRANSPORT}/new`, selected)}>Request quotes <ArrowRight className="h-4 w-4" /></Link>}
      </aside>
    </div>
  </div>;
}

export function NewTransportRequest() {
  const [params] = useSearchParams();
  const ids = getIds(params);
  const list = useTransportQuery<Page<Provider>>(ids.length ? transportPath('directory', { ids: ids.join(',') }) : '');
  const edit = withShortlist(CLIENT_TRANSPORT, ids);
  return <div className="space-y-5">
    <BackLink to={edit}>Back to shortlist</BackLink>
    <TransportHeading eyebrow="Transport marketplace" title="Request transport quotes" text="Send the same job details to your shortlisted providers. Submit a separate request if you need a different container type." />
    {!ids.length ? <EmptyState icon={<Truck className="h-6 w-6" />} title="Choose at least one provider" action={<Link className="btn btn-navy" to={CLIENT_TRANSPORT}>Find providers</Link>} />
      : !list.data ? <LoadState error={list.error} retry={list.reload} />
      : list.data.items.length !== ids.length ? <Alert>Some shortlisted providers are no longer available. <Link to={edit} className="font-semibold underline">Edit shortlist</Link>.</Alert>
      : <RequestForm key={ids.join(',')} providers={list.data.items} edit={edit} />}
  </div>;
}

function RequestForm({ providers, edit }: { providers: Provider[]; edit: string }) {
  const [submitKey] = useState(() => crypto.randomUUID());
  const nav = useNavigate();
  const save = useTransportAction();
  const services = Object.entries(SERVICES).filter(([type]) => providers.every(p => p.lanes.some(l => l.service_type === type)));
  const equipment = Object.entries(CONTAINERS).filter(([type]) => providers.every(p => p.container_types.some(c => c === type)));
  const send = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void save.run<Change>('create_request', { ...Object.fromEntries(data), provider_ids: providers.map(p => p.id), submit_key: submitKey },
      result => nav(`${CLIENT_TRANSPORT}/requests/${result.id}`, { replace: true }));
  };
  return <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
    <form className="card space-y-4 p-5 sm:p-6" onSubmit={send}>
      <h2 className="font-display font-bold text-navy">Job details</h2>
      {(!services.length || !equipment.length) ? <Alert>These providers don’t share a service and container type. <Link to={edit} className="font-semibold underline">Edit your shortlist</Link>.</Alert> : <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Service type" htmlFor="rfq-service"><select className="input" required name="service_type" id="rfq-service">{services.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <Field label="Preferred pickup date" htmlFor="rfq-date"><input className="input" required type="date" min={todayEAT()} name="pickup_date" id="rfq-date" /></Field>
          <Field label="Pickup area" htmlFor="rfq-origin"><input className="input" required minLength={2} maxLength={100} name="origin" id="rfq-origin" placeholder="City, terminal or depot" /></Field>
          <Field label="Destination area" htmlFor="rfq-destination"><input className="input" required minLength={2} maxLength={100} name="destination" id="rfq-destination" placeholder="City or delivery area" /></Field>
          <Field label="Container type" htmlFor="rfq-container"><select className="input" required id="rfq-container" name="container_type">{equipment.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <Field label="Number of containers" htmlFor="rfq-count"><input className="input" required type="number" min={1} max={100} step={1} defaultValue={1} id="rfq-count" name="container_count" /></Field>
          <Field label="Quote currency" htmlFor="rfq-currency" hint="All providers quote in this currency for easy comparison."><select className="input" name="currency" id="rfq-currency">{CURRENCIES.map(value => <option key={value}>{value}</option>)}</select></Field>
        </div>
        <Field label="Requirements (optional)" htmlFor="rfq-requirements" hint="Include any details that affect price or availability. Don’t include personal contact details or exact addresses."><textarea className="input min-h-24" rows={3} maxLength={1000} name="requirements" id="rfq-requirements" placeholder="e.g. Estimated weight, flexible pickup window, or special handling" /></Field>
        {save.error && <Alert>{save.error}</Alert>}
        <button type="submit" className="btn btn-gold" disabled={save.busy}>{save.busy ? <Spinner className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />} Send quote request</button>
      </>}
    </form>
    <section className="card space-y-3 p-5"><h2 className="font-display font-bold text-navy">Who receives this</h2><ul className="space-y-2 text-sm">{providers.map(p => <li className="flex items-start gap-2 [overflow-wrap:anywhere]" key={p.id}><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />{p.name}</li>)}</ul>
      <p className="text-sm text-muted">Your account contact is shared only with the provider that confirms the booking.</p><Link to={edit} className="text-sm font-semibold text-navy underline">Edit shortlist</Link>
    </section>
  </div>;
}
