-- Additive: sourcing and booking only. Existing consultations are not migrated.
-- Only the trusted Node API may execute the two public RPCs. It supplies the
-- actor from verified Auth, never from the request body. All row-level checks
-- and state changes live here so the checks and the writes share a transaction.
create schema transport_private;
revoke all on schema transport_private from public, anon, authenticated, service_role;
create sequence transport_private.request_number;

create table public.transport_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  base_city text not null check (char_length(base_city) between 2 and 100),
  description text not null default '' check (char_length(description) <= 700),
  booking_email text not null,
  container_types text[] not null check (
    cardinality(container_types) between 1 and 5 and array_position(container_types, null) is null
    and container_types <@ array['20_dry','40_dry','40_high_cube','20_reefer','40_reefer']::text[]
  ),
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.transport_provider_lanes (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.transport_providers(id),
  service_type text not null check (service_type in ('local','transit')),
  origin text not null check (char_length(origin) between 2 and 100),
  destination text not null check (char_length(destination) between 2 and 100)
);
create unique index transport_provider_lanes_unique on public.transport_provider_lanes
  (provider_id, service_type, lower(origin), lower(destination));
create index transport_providers_directory on public.transport_providers (status, lower(name), id);
create table public.transport_provider_members (
  provider_id uuid not null references public.transport_providers(id),
  profile_id uuid not null references public.profiles(id),
  primary key (provider_id, profile_id)
);
create index transport_provider_members_profile on public.transport_provider_members (profile_id, provider_id);

create table public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('TR-' || nextval('transport_private.request_number'::regclass)::text),
  customer_id uuid not null references public.profiles(id),
  submit_key uuid not null,
  service_type text not null check (service_type in ('local','transit')),
  origin text not null check (char_length(origin) between 2 and 100),
  destination text not null check (char_length(destination) between 2 and 100),
  pickup_date date not null,
  container_type text not null check (container_type in ('20_dry','40_dry','40_high_cube','20_reefer','40_reefer')),
  container_count integer not null check (container_count between 1 and 100),
  currency text not null check (currency in ('TZS','USD','KES')),
  requirements text not null default '' check (char_length(requirements) <= 1000),
  status text not null default 'open' check (status in ('open','awaiting_confirmation','booked','closed')),
  selected_quote_id uuid,
  confirmation_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, submit_key),
  check ((selected_quote_id is not null) = (status in ('awaiting_confirmation','booked'))),
  check ((confirmation_due_at is not null) = (status = 'awaiting_confirmation'))
);
create index transport_requests_customer on public.transport_requests (customer_id, updated_at desc, id);
create table public.transport_invitations (
  request_id uuid not null references public.transport_requests(id),
  provider_id uuid not null references public.transport_providers(id),
  declined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (request_id, provider_id)
);
create index transport_invitations_inbox on public.transport_invitations (provider_id, created_at desc, request_id);
create table public.transport_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  provider_id uuid not null,
  revision integer not null check (revision >= 1),
  base_amount numeric(13,2) not null check (base_amount > 0),
  taxes numeric(13,2) not null check (taxes >= 0),
  extra_charges numeric(13,2) not null check (extra_charges >= 0),
  total numeric(14,2) generated always as (base_amount + taxes + extra_charges) stored,
  available_on date not null,
  valid_until timestamptz not null,
  terms text not null check (char_length(terms) between 5 and 1000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (request_id, id),
  unique (request_id, provider_id, revision),
  foreign key (request_id, provider_id) references public.transport_invitations(request_id, provider_id)
);
alter table public.transport_requests add foreign key (id, selected_quote_id) references public.transport_quotes(request_id, id);
create table public.transport_bookings (
  request_id uuid primary key references public.transport_requests(id),
  quote_id uuid not null,
  reference text not null unique,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid not null references public.profiles(id),
  provider_name text not null,
  provider_email text not null,
  customer_name text not null,
  customer_email text not null,
  foreign key (request_id, quote_id) references public.transport_quotes(request_id, id)
);

alter table public.transport_providers enable row level security;
alter table public.transport_provider_lanes enable row level security;
alter table public.transport_provider_members enable row level security;
alter table public.transport_requests enable row level security;
alter table public.transport_invitations enable row level security;
alter table public.transport_quotes enable row level security;
alter table public.transport_bookings enable row level security;
revoke all on public.transport_providers, public.transport_provider_lanes, public.transport_provider_members,
  public.transport_requests, public.transport_invitations, public.transport_quotes, public.transport_bookings
  from public, anon, authenticated, service_role;

create function transport_private.text_field(value text, label text, low integer, high integer)
returns text language plpgsql immutable set search_path = '' as $$
begin
  value := regexp_replace(coalesce(value, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if char_length(value) not between low and high then
    raise sqlstate 'PT400' using message = label || ' must be between ' || low || ' and ' || high || ' characters.';
  end if;
  return value;
end;
$$;

create function transport_private.provider_ready(provider uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.transport_providers p
    join public.transport_provider_members m on m.provider_id = p.id
    join public.profiles u on u.id = m.profile_id
    where p.id = provider and p.status = 'approved' and u.is_active
  );
$$;

create function transport_private.provider_card(p public.transport_providers)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'base_city', p.base_city, 'description', p.description,
    'container_types', p.container_types, 'lanes', coalesce((
      select jsonb_agg(jsonb_build_object('service_type', l.service_type, 'origin', l.origin, 'destination', l.destination)
        order by l.service_type, l.origin, l.destination)
      from public.transport_provider_lanes l where l.provider_id = p.id
    ), '[]'::jsonb));
$$;

create function transport_private.request_status(r public.transport_requests)
returns text language sql stable set search_path = '' as $$
  select case when r.status = 'awaiting_confirmation' and r.confirmation_due_at <= now() then 'open' else r.status end;
$$;

create function transport_private.request_card(r public.transport_requests)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', r.id, 'reference', r.reference, 'service_type', r.service_type, 'status', transport_private.request_status(r),
    'origin', r.origin, 'destination', r.destination, 'pickup_date', r.pickup_date, 'currency', r.currency,
    'container_type', r.container_type, 'container_count', r.container_count, 'requirements', r.requirements, 'created_at', r.created_at);
$$;

create function transport_private.quote_valid(q public.transport_quotes, at_time timestamptz)
returns boolean language sql immutable set search_path = '' as $$
  select q.id is not null and q.valid_until > at_time and q.available_on >= (at_time at time zone 'Africa/Dar_es_Salaam')::date;
$$;

create function transport_private.quote_card(q public.transport_quotes)
returns jsonb language sql stable set search_path = '' as $$
  select case when q.id is null then null else jsonb_build_object('id', q.id, 'revision', q.revision, 'base_amount', q.base_amount,
    'taxes', q.taxes, 'extra_charges', q.extra_charges, 'total', q.total, 'available_on', q.available_on,
    'valid_until', q.valid_until, 'terms', q.terms, 'valid', transport_private.quote_valid(q, now())) end;
$$;

create function transport_private.booking_card(transport_request uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('reference', b.reference, 'confirmed_at', b.confirmed_at,
    'provider_name', b.provider_name, 'provider_email', b.provider_email,
    'customer_name', b.customer_name, 'customer_email', b.customer_email)
  from public.transport_bookings b where b.request_id = transport_request;
$$;

-- Used only after the read RPC scopes the invitation to an approved membership.
create function transport_private.opportunity(r public.transport_requests, i public.transport_invitations, p public.transport_providers)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  q public.transport_quotes;
  state text := transport_private.request_status(r);
  selected boolean;
begin
  select t.* into q from public.transport_quotes t where t.request_id = r.id and t.provider_id = p.id order by t.revision desc limit 1;
  selected := coalesce(r.selected_quote_id = q.id, false);
  return jsonb_build_object('request', transport_private.request_card(r) || jsonb_build_object('status',
    case when state = 'open' or selected then state else 'closed' end), 'provider_id', p.id, 'provider_name', p.name,
    'quote', transport_private.quote_card(q),
    'state', case when state = 'booked' and selected then 'booked'
      when i.declined_at is not null then 'declined'
      when state = 'awaiting_confirmation' and selected then 'confirm'
      when state <> 'open' then 'closed'
      when q.id is null then 'needs_quote' else 'quoted' end,
    'confirmation_due_at', case when state = 'awaiting_confirmation' and selected then r.confirmation_due_at end,
    'booking', case when state = 'booked' and selected then transport_private.booking_card(r.id) end);
end;
$$;

create function transport_private.page(items jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('items', case when jsonb_array_length(items) > 12 then items - 12 else coalesce(items, '[]'::jsonb) end,
    'has_more', coalesce(jsonb_array_length(items) > 12, false));
$$;

create function transport_private.notify_provider(provider uuid, title text, message text, link text)
returns void language sql volatile set search_path = '' as $$
  insert into public.notifications (user_id, title, body, link)
    select m.profile_id, title, message, link from public.transport_provider_members m
    join public.profiles p on p.id = m.profile_id
    where m.provider_id = provider and p.is_active;
$$;

create function public.transport_read(p_actor uuid, p_action text, p_input jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  actor_role text;
  p public.transport_providers;
  r public.transport_requests;
  i public.transport_invitations;
  result jsonb;
  skip_rows integer := least(10000, greatest(0, coalesce((p_input->>'page')::integer, 0))) * 12;
  search text := lower(left(btrim(coalesce(p_input->>'q', '')), 120));
  route_origin text := lower(left(btrim(coalesce(p_input->>'origin', '')), 100));
  route_destination text := lower(left(btrim(coalesce(p_input->>'destination', '')), 100));
begin
  select u.role into actor_role from public.profiles u where u.id = p_actor and u.is_active;
  if actor_role is null then raise sqlstate 'PT403' using message = 'An active account is required.'; end if;
  if p_action in ('directory','requests','request') and actor_role <> 'customer' then
    raise sqlstate 'PT403' using message = 'Client access only.';
  end if;
  if p_action in ('providers','provider') and actor_role <> 'admin' then
    raise sqlstate 'PT403' using message = 'Only Afrigate administrators can manage providers.';
  end if;

  case p_action
    when 'access' then
      return jsonb_build_object('provider', exists (select 1 from public.transport_provider_members m
        join public.transport_providers p0 on p0.id = m.provider_id and p0.status = 'approved' where m.profile_id = p_actor));
    when 'directory' then
      select jsonb_agg(transport_private.provider_card(rows) order by lower(rows.name), rows.id) into result from (
        select p0.* from public.transport_providers p0
        where p0.status = 'approved' and transport_private.provider_ready(p0.id)
          and not exists (select 1 from public.transport_provider_members self where self.profile_id = p_actor and self.provider_id = p0.id)
          and (search = '' or strpos(lower(p0.name), search) > 0 or strpos(lower(p0.base_city), search) > 0)
          and (coalesce(p_input->>'container', '') = '' or p_input->>'container' = any(p0.container_types))
          and (not p_input ? 'ids' or p0.id::text in (select jsonb_array_elements_text(p_input->'ids')))
          and exists (select 1 from public.transport_provider_lanes l where l.provider_id = p0.id
            and (coalesce(p_input->>'service', '') = '' or l.service_type = p_input->>'service')
            and (route_origin = '' or strpos(lower(l.origin), route_origin) > 0)
            and (route_destination = '' or strpos(lower(l.destination), route_destination) > 0))
        order by lower(p0.name), p0.id limit 13 offset skip_rows
      ) rows;
      return transport_private.page(result);
    when 'requests' then
      select jsonb_agg(transport_private.request_card(rows) || jsonb_build_object(
        'quote_count', (select count(distinct q.provider_id) from public.transport_quotes q where q.request_id = rows.id),
        'invite_count', (select count(*) from public.transport_invitations i0 where i0.request_id = rows.id)
      ) order by rows.updated_at desc, rows.id) into result from (
        select r0.* from public.transport_requests r0 where r0.customer_id = p_actor
        order by r0.updated_at desc, r0.id limit 13 offset skip_rows
      ) rows;
      return transport_private.page(result);
    when 'request' then
      select r0.* into r from public.transport_requests r0 where r0.id = (p_input->>'id')::uuid and r0.customer_id = p_actor;
      if not found then raise sqlstate 'PT404' using message = 'Transport request not found.'; end if;
      select jsonb_agg(jsonb_build_object('provider_id', p0.id, 'provider_name', p0.name,
        'declined', i0.declined_at is not null, 'provider_ready', transport_private.provider_ready(p0.id),
        'quote', transport_private.quote_card(q)) order by lower(p0.name), p0.id) into result
      from public.transport_invitations i0 join public.transport_providers p0 on p0.id = i0.provider_id
      left join lateral (select t.* from public.transport_quotes t where t.request_id = r.id and t.provider_id = p0.id order by t.revision desc limit 1) q on true
      where i0.request_id = r.id;
      return jsonb_build_object('request', transport_private.request_card(r), 'offers', coalesce(result, '[]'::jsonb),
        'selected_quote_id', case when transport_private.request_status(r) <> 'open' then r.selected_quote_id end,
        'confirmation_due_at', case when transport_private.request_status(r) = 'awaiting_confirmation' then r.confirmation_due_at end,
        'booking', transport_private.booking_card(r.id));
    when 'inbox' then
      select jsonb_agg(transport_private.opportunity(r0, i0, p0) order by entries.created_at desc, entries.request_id, entries.provider_id) into result
      from (
        select i1.* from public.transport_provider_members m join public.transport_providers p1 on p1.id = m.provider_id and p1.status = 'approved'
        join public.transport_invitations i1 on i1.provider_id = m.provider_id join public.transport_requests r1 on r1.id = i1.request_id
        where m.profile_id = p_actor and r1.customer_id <> p_actor
        order by i1.created_at desc, i1.request_id, i1.provider_id limit 13 offset skip_rows
      ) entries join public.transport_invitations i0 on (i0.request_id, i0.provider_id) = (entries.request_id, entries.provider_id)
      join public.transport_requests r0 on r0.id = entries.request_id join public.transport_providers p0 on p0.id = entries.provider_id;
      return transport_private.page(result);
    when 'opportunity' then
      select i0.* into i from public.transport_invitations i0
      join public.transport_requests r0 on r0.id = i0.request_id and r0.customer_id <> p_actor
      join public.transport_provider_members m on m.provider_id = i0.provider_id and m.profile_id = p_actor
      join public.transport_providers p0 on p0.id = m.provider_id and p0.status = 'approved'
      where i0.request_id = (p_input->>'id')::uuid and i0.provider_id = (p_input->>'provider_id')::uuid;
      if not found then raise sqlstate 'PT404' using message = 'Invitation not found.'; end if;
      select * into r from public.transport_requests where id = i.request_id;
      select * into p from public.transport_providers where id = i.provider_id;
      return transport_private.opportunity(r, i, p);
    when 'providers' then
      select jsonb_agg(transport_private.provider_card(rows) || jsonb_build_object('status', rows.status) order by lower(rows.name), rows.id) into result from (
        select p0.* from public.transport_providers p0 where search = '' or strpos(lower(p0.name), search) > 0
        order by lower(p0.name), p0.id limit 13 offset skip_rows
      ) rows;
      return transport_private.page(result);
    when 'provider' then
      select * into p from public.transport_providers where id = (p_input->>'id')::uuid;
      if not found then raise sqlstate 'PT404' using message = 'Provider company not found.'; end if;
      return transport_private.provider_card(p) || jsonb_build_object('status', p.status, 'booking_email', p.booking_email, 'verified_at', p.verified_at,
        'members', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'email', coalesce(a.email, u.email), 'name', u.full_name, 'active', u.is_active) order by u.full_name)
          from public.transport_provider_members m join public.profiles u on u.id = m.profile_id
          left join auth.users a on a.id = u.id where m.provider_id = p.id), '[]'::jsonb));
    else raise sqlstate 'PT404' using message = 'Unknown transport action.';
  end case;
end;
$$;

create function public.transport_write(p_actor uuid, p_action text, p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  a public.profiles;
  p public.transport_providers;
  r public.transport_requests;
  i public.transport_invitations;
  q public.transport_quotes;
  lane jsonb;
  provider uuid;
  member uuid;
  req_id uuid := (p_input->>'request_id')::uuid;
  offer_id uuid := (p_input->>'quote_id')::uuid;
  invitation_ids uuid[];
  equipment text[];
  service text;
  box_type text;
  confirmed_contact record;
  action_time timestamptz;
  available date;
  hours integer;
  home_date date;
  destination_email text;
  numeric_field text;
  target_type text;
  target_id uuid;
  provider_link text;
  client_link text;
begin
  select * into a from public.profiles where id = p_actor and is_active;
  if not found then raise sqlstate 'PT403' using message = 'An active account is required.'; end if;

  if p_action in ('save_provider','set_provider_status','add_member','remove_member') then
    if a.role <> 'admin' then raise sqlstate 'PT403' using message = 'Only Afrigate administrators can manage providers.'; end if;
    provider := (p_input->>'provider_id')::uuid;
    if provider is not null or p_action <> 'save_provider' then
      select * into p from public.transport_providers where id = provider for update;
      if not found then raise sqlstate 'PT404' using message = 'Provider company not found.'; end if;
    end if;
    if p_action = 'save_provider' then
      destination_email := lower(transport_private.text_field(p_input->>'booking_email', 'Booking email', 3, 200));
      if destination_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise sqlstate 'PT400' using message = 'Enter a valid booking email.';
      end if;
      if jsonb_typeof(p_input->'container_types') is distinct from 'array' or jsonb_typeof(p_input->'lanes') is distinct from 'array' then
        raise sqlstate 'PT400' using message = 'Add a route and at least one supported container type.';
      end if;
      select array_agg(distinct box) into equipment from jsonb_array_elements_text(p_input->'container_types') box;
      if equipment is null or jsonb_array_length(p_input->'lanes') not between 1 and 12 then
        raise sqlstate 'PT400' using message = 'Add at least one container type and between 1 and 12 routes.';
      end if;
      if provider is null then
        insert into public.transport_providers (name, base_city, description, booking_email, container_types)
        values (transport_private.text_field(p_input->>'name','Company name',2,120), transport_private.text_field(p_input->>'base_city','Base city',2,100),
          transport_private.text_field(p_input->>'description','Description',0,700), destination_email, equipment) returning * into p;
      else
        update public.transport_providers set name = transport_private.text_field(p_input->>'name','Company name',2,120),
          base_city = transport_private.text_field(p_input->>'base_city','Base city',2,100),
          description = transport_private.text_field(p_input->>'description','Description',0,700),
          booking_email = destination_email, container_types = equipment where id = provider returning * into p;
        delete from public.transport_provider_lanes where provider_id = provider;
      end if;
      for lane in select value from jsonb_array_elements(p_input->'lanes') loop
        if coalesce(lane->>'service_type','') not in ('local','transit') then raise sqlstate 'PT400' using message = 'Choose a service type for each route.'; end if;
        insert into public.transport_provider_lanes (provider_id, service_type, origin, destination)
          values (p.id, lane->>'service_type', transport_private.text_field(lane->>'origin','Route origin',2,100),
            transport_private.text_field(lane->>'destination','Route destination',2,100)) on conflict do nothing;
      end loop;
    elsif p_action = 'set_provider_status' then
      if p_input->>'status' = 'approved' then
        if p.status = 'approved' then return jsonb_build_object('id', p.id, 'status', p.status); end if;
        if not exists (select 1 from public.transport_provider_lanes l where l.provider_id = p.id) or not exists (
          select 1 from public.transport_provider_members m join public.profiles u on u.id = m.profile_id where m.provider_id = p.id and u.is_active
        ) then raise sqlstate 'PT409' using message = 'Add a route and at least one active team member before publishing.'; end if;
        update public.transport_providers set status = 'approved', verified_at = now() where id = p.id returning * into p;
        perform transport_private.notify_provider(p.id, 'Provider workspace approved', 'Your company is available in the transport directory.', '/provider/inbox');
      elsif p_input->>'status' = 'suspended' and p.status in ('approved','suspended') then
        if p.status = 'suspended' then return jsonb_build_object('id', p.id, 'status', p.status); end if;
        update public.transport_providers set status = 'suspended' where id = p.id returning * into p;
      else raise sqlstate 'PT400' using message = 'Choose a valid provider status.';
      end if;
    elsif p_action = 'add_member' then
      select u.id into member from auth.users auth_user join public.profiles u on u.id = auth_user.id
        where lower(auth_user.email) = lower(transport_private.text_field(p_input->>'email','Account email',3,200))
          and auth_user.email_confirmed_at is not null and u.is_active;
      if not found then raise sqlstate 'PT404' using message = 'No active account with that verified email. Ask the member to sign in first.'; end if;
      insert into public.transport_provider_members (provider_id, profile_id) values (p.id, member) on conflict do nothing;
      if not found then return jsonb_build_object('id', p.id, 'status', p.status); end if;
      if p.status = 'approved' then
        insert into public.notifications (user_id, title, body, link) values (member, 'Provider workspace access', 'You have been added to ' || p.name || '.', '/provider/inbox');
      end if;
    else
      member := (p_input->>'member_id')::uuid;
      if p.status = 'approved' and not exists (select 1 from public.transport_provider_members m join public.profiles u on u.id = m.profile_id
        where m.provider_id = p.id and u.is_active and m.profile_id <> member) then
        raise sqlstate 'PT409' using message = 'Suspend the listing or add another active member before removing the last member.';
      end if;
      delete from public.transport_provider_members where provider_id = p.id and profile_id = member;
      if not found then return jsonb_build_object('id', p.id, 'status', p.status); end if;
    end if;
    insert into public.audit_logs (actor_id, actor_email, actor_role, action, entity, entity_id, details)
    values (a.id, a.email, a.role, 'transport.' || p_action, 'transport_provider', p.id::text,
      jsonb_strip_nulls(jsonb_build_object('status', p.status, 'member_id', member)));
    return jsonb_build_object('id', p.id, 'status', p.status);
  end if;

  if p_action in ('create_request','select_quote','release_quote','close_request') and a.role <> 'customer' then
    raise sqlstate 'PT403' using message = 'Client access only.';
  end if;
  if p_action = 'create_request' then
    if (p_input->>'submit_key')::uuid is null then raise sqlstate 'PT400' using message = 'Missing request key. Reload the request form and try again.'; end if;
    select * into r from public.transport_requests where customer_id = a.id and submit_key = (p_input->>'submit_key')::uuid;
    if found then return jsonb_build_object('id', r.id, 'status', transport_private.request_status(r)); end if;
    if jsonb_typeof(p_input->'provider_ids') is distinct from 'array' or coalesce(jsonb_array_length(p_input->'provider_ids'), 0) not between 1 and 5 then
      raise sqlstate 'PT400' using message = 'Select between 1 and 5 providers.';
    end if;
    select array_agg(distinct value::uuid order by value::uuid) into invitation_ids from jsonb_array_elements_text(p_input->'provider_ids');
    service := coalesce(p_input->>'service_type','');
    box_type := coalesce(p_input->>'container_type','');
    if service not in ('local','transit') then raise sqlstate 'PT400' using message = 'Choose local or transit transport.'; end if;
    home_date := (now() at time zone 'Africa/Dar_es_Salaam')::date;
    available := (p_input->>'pickup_date')::date;
    if available is null or available not between home_date and home_date + 366 then
      raise sqlstate 'PT400' using message = 'Choose a pickup date within the next year.';
    end if;
    -- Prevent provider status, membership and coverage edits during invitation checks.
    perform 1 from public.transport_providers t where t.id = any(invitation_ids) order by t.id for share;
    foreach provider in array invitation_ids loop
      if not transport_private.provider_ready(provider) or not exists (
        select 1 from public.transport_providers t join public.transport_provider_lanes l on l.provider_id = t.id
        where t.id = provider and l.service_type = service and box_type = any(t.container_types)
      ) or exists (select 1 from public.transport_provider_members m where m.provider_id = provider and m.profile_id = a.id) then
        raise sqlstate 'PT409' using message = 'A selected provider is unavailable or does not support this service and container type. Update your shortlist.';
      end if;
    end loop;
    insert into public.transport_requests (customer_id, submit_key, service_type, origin, destination, pickup_date, container_type, container_count, currency, requirements)
      values (a.id, (p_input->>'submit_key')::uuid, service, transport_private.text_field(p_input->>'origin','Pickup area',2,100),
        transport_private.text_field(p_input->>'destination','Destination',2,100), available, box_type,
        (p_input->>'container_count')::integer, p_input->>'currency', transport_private.text_field(p_input->>'requirements','Requirements',0,1000))
      on conflict (customer_id, submit_key) do nothing returning * into r;
    if not found then
      select * into r from public.transport_requests where customer_id = a.id and submit_key = (p_input->>'submit_key')::uuid;
      return jsonb_build_object('id', r.id, 'status', transport_private.request_status(r));
    end if;
    foreach provider in array invitation_ids loop
      insert into public.transport_invitations (request_id, provider_id) values (r.id, provider);
      perform transport_private.notify_provider(provider, 'New transport request', 'You were invited to quote on ' || r.reference || '.', '/provider/inbox/' || provider || '/' || r.id);
    end loop;
    insert into public.audit_logs (actor_id, actor_email, actor_role, action, entity, entity_id)
      values (a.id, a.email, a.role, 'transport.create_request', 'transport_request', r.id::text);
    return jsonb_build_object('id', r.id, 'status', r.status);
  end if;

  -- Serialize all offer, selection and confirmation changes per request.
  if p_action in ('select_quote','release_quote','close_request') then
    select * into r from public.transport_requests where id = req_id and customer_id = a.id for update;
    if not found then raise sqlstate 'PT404' using message = 'Transport request not found.'; end if;
  elsif p_action in ('submit_quote','decline','confirm') then
    provider := (p_input->>'provider_id')::uuid;
    select r0.* into r from public.transport_requests r0 join public.transport_invitations i0 on i0.request_id = r0.id
      join public.transport_provider_members m on m.provider_id = i0.provider_id and m.profile_id = a.id
      join public.transport_providers p0 on p0.id = m.provider_id and p0.status = 'approved'
      where r0.id = req_id and i0.provider_id = provider and r0.customer_id <> a.id for update of r0;
    if not found then raise sqlstate 'PT404' using message = 'Invitation not found.'; end if;
    select * into p from public.transport_providers where id = provider and status = 'approved' for share;
    if not found or not exists (select 1 from public.transport_provider_members m where m.provider_id = provider and m.profile_id = a.id) then
      raise sqlstate 'PT404' using message = 'Invitation not found.';
    end if;
    select i0.* into i from public.transport_invitations i0 where i0.request_id = r.id and i0.provider_id = provider;
    select t.* into q from public.transport_quotes t where t.request_id = r.id and t.provider_id = provider order by t.revision desc limit 1;
  else raise sqlstate 'PT404' using message = 'Unknown transport action.';
  end if;

  action_time := clock_timestamp();
  home_date := (action_time at time zone 'Africa/Dar_es_Salaam')::date;
  client_link := '/portal/transport/requests/' || r.id;
  if r.status = 'awaiting_confirmation' and r.confirmation_due_at <= action_time then
    update public.transport_requests set status = 'open', selected_quote_id = null, confirmation_due_at = null, updated_at = action_time
      where id = r.id returning * into r;
  end if;
  target_type := 'transport_request';
  target_id := r.id;
  case p_action
    when 'select_quote' then
      if r.status in ('awaiting_confirmation','booked') and r.selected_quote_id = offer_id then
        return jsonb_build_object('id', r.id, 'status', r.status);
      end if;
      if r.status <> 'open' then raise sqlstate 'PT409' using message = 'This request is not open for selection. Refresh to see its current status.'; end if;
      select t.* into q from public.transport_quotes t
        join public.transport_invitations i0 on (i0.request_id, i0.provider_id) = (t.request_id, t.provider_id)
        join public.transport_providers p0 on p0.id = t.provider_id
        where t.id = offer_id and t.request_id = r.id and i0.declined_at is null and p0.status = 'approved'
          and not exists (select 1 from public.transport_quotes newer where newer.request_id = r.id and newer.provider_id = t.provider_id and newer.revision > t.revision)
        for share of p0;
      action_time := clock_timestamp();
      if not found or not transport_private.provider_ready(q.provider_id) or not transport_private.quote_valid(q, action_time) then
        raise sqlstate 'PT409' using message = 'This offer is no longer available. Refresh to see current offers.';
      end if;
      update public.transport_requests set status = 'awaiting_confirmation', selected_quote_id = q.id,
        confirmation_due_at = least(q.valid_until, action_time + interval '24 hours', ((q.available_on + 1)::timestamp at time zone 'Africa/Dar_es_Salaam')),
        updated_at = action_time where id = r.id returning * into r;
      perform transport_private.notify_provider(q.provider_id, 'Your offer was selected', 'Confirm availability for ' || r.reference || ' before the deadline.', '/provider/inbox/' || q.provider_id || '/' || r.id);
    when 'release_quote' then
      if r.status = 'open' then return jsonb_build_object('id', r.id, 'status', r.status); end if;
      if r.status <> 'awaiting_confirmation' or r.selected_quote_id is distinct from offer_id then
        raise sqlstate 'PT409' using message = 'The selected offer has changed. Refresh the request.';
      end if;
      select * into q from public.transport_quotes where id = r.selected_quote_id;
      update public.transport_requests set status = 'open', selected_quote_id = null, confirmation_due_at = null, updated_at = action_time
        where id = r.id returning * into r;
      perform transport_private.notify_provider(q.provider_id, 'Quote selection withdrawn', 'The client withdrew the selection for ' || r.reference || '.', '/provider/inbox/' || q.provider_id || '/' || r.id);
    when 'close_request' then
      if r.status = 'closed' then return jsonb_build_object('id', r.id, 'status', r.status); end if;
      if r.status = 'booked' then raise sqlstate 'PT409' using message = 'This request is booked. Arrange any changes directly with your provider.'; end if;
      update public.transport_requests set status = 'closed', selected_quote_id = null, confirmation_due_at = null, updated_at = action_time
        where id = r.id returning * into r;
      for provider in select i0.provider_id from public.transport_invitations i0 where i0.request_id = r.id and i0.declined_at is null loop
        perform transport_private.notify_provider(provider, 'Transport request closed', r.reference || ' is no longer accepting quotes.', '/provider/inbox/' || provider || '/' || r.id);
      end loop;
    when 'submit_quote' then
      if r.status <> 'open' or i.declined_at is not null then raise sqlstate 'PT409' using message = 'This invitation is not accepting quotes.'; end if;
      if q.id is distinct from offer_id then raise sqlstate 'PT409' using message = 'The quote changed. Refresh before sending a revision.'; end if;
      available := (p_input->>'available_on')::date;
      hours := (p_input->>'valid_for_hours')::integer;
      if available is null or available not between home_date and home_date + 366 or hours is null or hours not in (12,24,48,72,168) then
        raise sqlstate 'PT400' using message = 'Choose a current availability date and a valid quote duration.';
      end if;
      foreach numeric_field in array array['base_amount','taxes','extra_charges'] loop
        if coalesce(p_input->>numeric_field,'') !~ '^[0-9]{1,11}(\.[0-9]{1,2})?$' then
          raise sqlstate 'PT400' using message = 'Enter non-negative amounts with up to two decimal places.';
        end if;
      end loop;
      if (p_input->>'base_amount')::numeric <= 0 then raise sqlstate 'PT400' using message = 'The transport price must be greater than zero.'; end if;
      insert into public.transport_quotes (request_id, provider_id, revision, base_amount, taxes, extra_charges, available_on, valid_until, terms, created_by)
        values (r.id, provider, coalesce(q.revision, 0) + 1, (p_input->>'base_amount')::numeric, (p_input->>'taxes')::numeric,
          (p_input->>'extra_charges')::numeric, available, least(action_time + make_interval(hours => hours), ((available + 1)::timestamp at time zone 'Africa/Dar_es_Salaam')),
          transport_private.text_field(p_input->>'terms','Quote terms',5,1000), a.id) returning * into q;
      target_type := 'transport_quote'; target_id := q.id;
      update public.transport_requests set updated_at = action_time where id = r.id;
      insert into public.notifications (user_id, title, body, link) values (r.customer_id, 'Transport offer received', p.name || ' sent an offer for ' || r.reference || '.', client_link);
    when 'decline' then
      if i.declined_at is not null then return jsonb_build_object('id', r.id, 'status', r.status); end if;
      if q.id is distinct from offer_id then raise sqlstate 'PT409' using message = 'The quote changed. Refresh the invitation.'; end if;
      if r.status = 'awaiting_confirmation' and q.id = r.selected_quote_id then
        update public.transport_requests set status = 'open', selected_quote_id = null, confirmation_due_at = null, updated_at = action_time
          where id = r.id returning * into r;
      elsif r.status <> 'open' then raise sqlstate 'PT409' using message = 'This invitation is no longer open.';
      else update public.transport_requests set updated_at = action_time where id = r.id;
      end if;
      update public.transport_invitations i0 set declined_at = action_time where i0.request_id = r.id and i0.provider_id = provider;
      insert into public.notifications (user_id, title, body, link) values (r.customer_id, 'Provider declined a transport request', p.name || ' is unavailable for ' || r.reference || '.', client_link);
    when 'confirm' then
      if r.status = 'booked' and q.id = r.selected_quote_id and q.id = offer_id then
        return jsonb_build_object('id', r.id, 'status', r.status);
      end if;
      if r.status <> 'awaiting_confirmation' or i.declined_at is not null or q.id is null or q.id is distinct from offer_id
        or q.id is distinct from r.selected_quote_id or not transport_private.quote_valid(q, action_time) then
        raise sqlstate 'PT409' using message = 'This selection is no longer awaiting your confirmation.';
      end if;
      select u.full_name as name, coalesce(auth_user.email, u.email) as email into confirmed_contact
        from public.profiles u left join auth.users auth_user on auth_user.id = u.id where u.id = r.customer_id and u.is_active;
      if not found then raise sqlstate 'PT409' using message = 'The client account is no longer active.'; end if;
      insert into public.transport_bookings (request_id, quote_id, reference, confirmed_at, confirmed_by, provider_name, provider_email, customer_name, customer_email)
        values (r.id, q.id, 'TB-' || substring(r.reference from 4), action_time, a.id, p.name, p.booking_email, confirmed_contact.name, confirmed_contact.email);
      update public.transport_requests set status = 'booked', confirmation_due_at = null, updated_at = action_time where id = r.id returning * into r;
      provider_link := '/provider/inbox/' || p.id || '/' || r.id;
      insert into public.notifications (user_id, title, body, link) values (r.customer_id, 'Transport booking confirmed', p.name || ' confirmed ' || r.reference || '.', client_link);
      perform transport_private.notify_provider(p.id, 'Transport booking confirmed', 'Your company confirmed ' || r.reference || '.', provider_link);
  end case;
  insert into public.audit_logs (actor_id, actor_email, actor_role, action, entity, entity_id, details)
    values (a.id, a.email, a.role, 'transport.' || p_action, target_type, target_id::text,
      jsonb_strip_nulls(jsonb_build_object('request_id', r.id, 'provider_id', coalesce(provider, q.provider_id), 'quote_id', q.id, 'status', r.status)));
  return jsonb_build_object('id', r.id, 'status', r.status);
end;
$$;

revoke all on all functions in schema transport_private from public, anon, authenticated, service_role;
revoke all on function public.transport_read(uuid, text, jsonb), public.transport_write(uuid, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.transport_read(uuid, text, jsonb), public.transport_write(uuid, text, jsonb) to service_role;
