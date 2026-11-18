import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Building2, Plus, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Alert, EmptyState, Field, Spinner } from '../../components/ui';
import { CONTAINERS, deadline, SERVICES, STAFF_PROVIDERS, transportPath, type AdminProvider, type Container, type Lane, type Page, type ProviderDetail } from '../../lib/transport';
import { ActionDialog, BackLink, LoadState, Pager, TransportHeading, TransportState } from './TransportUI';
import { useTransportAction, useTransportQuery } from './useTransport';

export function TransportProvidersAdmin() {
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const query = useTransportQuery<Page<AdminProvider>>(transportPath('providers', { page, q }));
  const search = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setQ(String(new FormData(e.currentTarget).get('q') || '').trim()); setPage(0);
  };
  return <div className="space-y-5">
    <TransportHeading eyebrow="Transport administration" title="Transport providers" text="Manage company profiles and team access. Verify each business before publishing its listing."
      action={<Link to={`${STAFF_PROVIDERS}/new`} className="btn btn-gold"><Plus className="h-4 w-4" /> Add provider</Link>} />
    <form className="card flex flex-wrap items-end gap-3 p-4" onSubmit={search}>
      <div className="min-w-48 flex-1"><Field label="Company name" htmlFor="provider-admin-search"><input id="provider-admin-search" className="input" name="q" maxLength={120} /></Field></div>
      <button type="submit" className="btn btn-navy"><Search className="h-4 w-4" /> Search</button>
    </form>
    {!query.data && <LoadState error={query.error} retry={query.reload} />}
    {query.data?.items.length === 0 && <EmptyState icon={<Building2 className="h-6 w-6" />} title={q ? 'No companies match this search' : 'No provider companies yet'} text={q ? 'Try another name or clear the search.' : 'Add a company as pending, then add its team and publish after verification.'} />}
    <ul className="space-y-3">{query.data?.items.map(p => <li key={p.id}>
      <Link to={`${STAFF_PROVIDERS}/${p.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-navy/40 sm:p-5">
        <div><h2 className="font-display font-bold text-navy [overflow-wrap:anywhere]">{p.name}</h2><p className="mt-1 text-sm text-muted">{p.base_city} · {p.lanes.length} {p.lanes.length === 1 ? 'route' : 'routes'}</p></div>
        <div className="flex items-center gap-3"><TransportState status={p.status} /><ArrowRight className="h-4 w-4 shrink-0 text-navy" /></div>
      </Link>
    </li>)}</ul>
    {query.data && <Pager page={page} more={query.data.has_more} onChange={setPage} />}
  </div>;
}

export function NewTransportProvider() {
  const nav = useNavigate();
  return <div className="space-y-5">
    <BackLink to={STAFF_PROVIDERS}>Transport providers</BackLink>
    <TransportHeading eyebrow="Transport administration" title="Add a provider" text="The company will stay private until you add its team and approve the listing." />
    <CompanyForm onSaved={id => nav(`${STAFF_PROVIDERS}/${id}`, { replace: true })} />
  </div>;
}

export function ManageTransportProvider() {
  const { providerId } = useParams();
  return <div className="space-y-5"><BackLink to={STAFF_PROVIDERS}>Transport providers</BackLink><ProviderPage key={providerId} id={providerId || ''} /></div>;
}

type AdminChoice = { kind: 'approve' | 'suspend' } | { kind: 'remove'; id: string; name: string };

function ProviderPage({ id }: { id: string }) {
  const query = useTransportQuery<ProviderDetail>(transportPath('provider', { id }));
  const mutation = useTransportAction();
  const [choice, setChoice] = useState<AdminChoice | null>(null);
  const [message, setMessage] = useState('');
  if (!query.data) return <LoadState error={query.error} retry={query.reload} />;
  const provider = query.data;
  const completed = (text: string) => { setMessage(text); setChoice(null); query.reload(); };
  const ask = (value: AdminChoice) => { mutation.clear(); setChoice(value); };
  const addMember = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = new FormData(form).get('email');
    void mutation.run('add_member', { provider_id: provider.id, email }, () => { form.reset(); completed('Team member added.'); });
  };
  const decision = choice?.kind === 'remove'
    ? { title: `Remove ${choice.name}?`, message: 'They will immediately lose this company’s invitations, quotes, and booking access. Their AfriGate account will not be changed.', label: 'Remove member' }
    : choice?.kind === 'suspend' ? { title: 'Suspend provider listing?', message: 'This company will disappear from the directory and lose workspace access. Existing booking records are not changed. A client with a pending selection can withdraw it.', label: 'Suspend provider' }
    : { title: 'Publish verified provider?', message: 'Only publish after you have checked the business, its relevant permits and insurance, and confirmed its service coverage. Clients will be able to invite this company to quote.', label: 'Publish verified listing' };
  const apply = () => {
    if (!choice) return;
    if (choice.kind === 'remove') void mutation.run('remove_member', { provider_id: id, member_id: choice.id }, () => completed('Team member removed.'));
    else void mutation.run('set_provider_status', { provider_id: id, status: choice.kind === 'approve' ? 'approved' : 'suspended' },
      () => completed(choice.kind === 'approve' ? 'Provider verified and published.' : 'Provider suspended.'));
  };
  return <div className="space-y-5">
    <TransportHeading eyebrow="Transport administration" title={provider.name} text={provider.verified_at ? `Last verified ${deadline(provider.verified_at)}` : 'Not yet verified. This listing is not visible to clients.'}
      action={<div className="flex flex-wrap items-center gap-2"><TransportState status={provider.status} />
        {provider.status === 'approved'
          ? <button type="button" disabled={mutation.busy || query.loading} className="btn btn-ghost btn-sm bg-white text-danger" onClick={() => ask({ kind: 'suspend' })}>Suspend listing</button>
          : <button type="button" disabled={mutation.busy || query.loading || !provider.members.some(m => m.active)} className="btn btn-navy btn-sm" onClick={() => ask({ kind: 'approve' })}><ShieldCheck className="h-4 w-4" />{provider.status === 'suspended' ? 'Verify and republish' : 'Verify and publish'}</button>}
      </div>} />
    {message && <Alert kind="success" onClose={() => setMessage('')}>{message}</Alert>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <CompanyForm provider={provider} loading={query.loading} onSaved={() => completed('Company profile saved.')} />
      <section className="card min-w-0 space-y-4 p-5" aria-labelledby="provider-team">
        <h2 className="flex items-center gap-2 font-display font-bold text-navy" id="provider-team"><Users className="h-5 w-5" /> Company team</h2>
        <p className="text-sm text-muted">Ask each team member to verify their account email and sign in to AfriGate once. Add them here by that email. They do not need a staff role.</p>
        {!provider.members.length && <p className="rounded-xl bg-canvas p-3 text-sm font-semibold text-navy">Add a team member before you publish.</p>}
        <ul className="divide-y divide-line">{provider.members.map(member => <li key={member.id} className="flex items-start justify-between gap-2 py-2 text-sm">
          <div className="min-w-0"><p className="font-semibold [overflow-wrap:anywhere]">{member.name}{!member.active && <span className="ml-1 text-xs text-danger">(inactive)</span>}</p><p className="text-muted [overflow-wrap:anywhere]">{member.email}</p></div>
          <button type="button" aria-label={`Remove ${member.name}`} className="shrink-0 rounded-full p-2 text-danger hover:bg-red-50" disabled={mutation.busy || query.loading} onClick={() => ask({ kind: 'remove', id: member.id, name: member.name })}><Trash2 className="h-4 w-4" /></button>
        </li>)}</ul>
        <form className="space-y-3" onSubmit={addMember}>
          <Field label="Team member email" htmlFor="provider-member-email"><input id="provider-member-email" name="email" required type="email" maxLength={200} className="input" /></Field>
          {!choice && mutation.error && <Alert>{mutation.error}</Alert>}
          <button type="submit" className="btn btn-ghost btn-sm" disabled={mutation.busy || query.loading}><Plus className="h-4 w-4" /> Add team member</button>
        </form>
      </section>
    </div>
    {choice && <ActionDialog {...decision} busy={mutation.busy} error={mutation.error} onConfirm={apply} onCancel={() => { mutation.clear(); setChoice(null); }} />}
  </div>;
}

const blankLane = (): Lane => ({ service_type: 'local', origin: '', destination: '' });

function CompanyForm({ provider, loading, onSaved }: { provider?: ProviderDetail; loading?: boolean; onSaved: (id: string) => void }) {
  const [lanes, setLanes] = useState<Lane[]>(provider?.lanes.length ? provider.lanes : [blankLane()]);
  const [equipment, setEquipment] = useState<Container[]>(provider?.container_types || []);
  const mutation = useTransportAction();
  const updateLane = (index: number, fields: Partial<Lane>) => setLanes(rows => rows.map((row, i) => i === index ? { ...row, ...fields } : row));
  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void mutation.run<{ id: string }>('save_provider', { ...Object.fromEntries(new FormData(e.currentTarget)), provider_id: provider?.id, lanes, container_types: equipment },
      data => onSaved(data.id));
  };
  return <form className="card min-w-0 space-y-5 p-5 sm:p-6" onSubmit={save}>
    <h2 className="font-display font-bold text-navy">Company profile</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Company name" htmlFor="provider-name"><input id="provider-name" className="input" required name="name" minLength={2} maxLength={120} defaultValue={provider?.name} /></Field>
      <Field label="Base city" htmlFor="provider-base"><input id="provider-base" className="input" required name="base_city" minLength={2} maxLength={100} defaultValue={provider?.base_city} /></Field>
      <div className="sm:col-span-2"><Field label="Booking email (private)" htmlFor="provider-booking-email" hint="Shared only with the client after a booking is confirmed."><input id="provider-booking-email" className="input" required name="booking_email" type="email" maxLength={200} defaultValue={provider?.booking_email} /></Field></div>
    </div>
    <Field label="Directory description (optional)" htmlFor="provider-description"><textarea id="provider-description" className="input" name="description" rows={3} maxLength={700} defaultValue={provider?.description} /></Field>
    <fieldset className="space-y-2"><legend className="label">Supported containers</legend>
      <div className="flex flex-wrap gap-2">{Object.entries(CONTAINERS).map(([key, label]) => {
        const value = key as Container;
        return <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm"><input type="checkbox" checked={equipment.includes(value)} className="accent-navy" onChange={e => {
          const checked = e.target.checked;
          setEquipment(types => checked ? [...types, value] : types.filter(type => type !== value));
        }} /> {label}</label>;
      })}</div>
    </fieldset>
    <section className="space-y-3 border-t border-line pt-4" aria-labelledby="provider-routes">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="provider-routes" className="font-display text-sm font-bold text-navy">Service routes</h3>
        <button type="button" disabled={lanes.length >= 12} className="btn btn-ghost btn-sm" onClick={() => setLanes(previous => [...previous, blankLane()])}><Plus className="h-4 w-4" /> Add route</button></div>
      <p className="text-sm text-muted">Routes are directional. List the return direction separately if the provider serves it.</p>
      {lanes.map((lane, index) => <fieldset key={index} className="grid items-end gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
        <legend className="px-1 text-xs font-semibold text-muted">Route {index + 1}</legend>
        <Field label="Origin" htmlFor={`lane-origin-${index}`}><input id={`lane-origin-${index}`} className="input" required minLength={2} maxLength={100} value={lane.origin} onChange={e => updateLane(index, { origin: e.target.value })} /></Field>
        <Field label="Destination" htmlFor={`lane-destination-${index}`}><input id={`lane-destination-${index}`} className="input" required minLength={2} maxLength={100} value={lane.destination} onChange={e => updateLane(index, { destination: e.target.value })} /></Field>
        <Field label="Service type" htmlFor={`lane-service-${index}`}><select id={`lane-service-${index}`} className="input" value={lane.service_type} onChange={e => updateLane(index, { service_type: e.target.value as Lane['service_type'] })}>{Object.entries(SERVICES).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></Field>
        {lanes.length > 1 && <button type="button" className="btn btn-ghost btn-sm w-fit text-danger" onClick={() => setLanes(previous => previous.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /> Remove route {index + 1}</button>}
      </fieldset>)}
    </section>
    {mutation.error && <Alert>{mutation.error}</Alert>}
    <div className="flex flex-wrap items-center gap-3"><button type="submit" className="btn btn-gold" disabled={!equipment.length || loading || mutation.busy}>{mutation.busy && <Spinner className="h-4 w-4" />}{provider ? 'Save company' : 'Save pending provider'}</button>
      {!equipment.length && <p className="text-sm text-muted">Select at least one container type.</p>}
    </div>
  </form>;
}
