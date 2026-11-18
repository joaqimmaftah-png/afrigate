-- Operator-only, against afrigate-staging (ufexjnqkppmcpjstabob) after the
-- one-off booking smoke has exited. Substitute the exact UUID from that run.
-- Do not grant table access to service_role or apply this as a migration.
do $cleanup$
declare
  run_id constant uuid := 'REPLACE_WITH_EXACT_BOOKING_RUN_UUID';
  actors uuid[];
  providers uuid[];
  requests uuid[];
  consultations bigint[];
begin
  select coalesce(array_agg(id), '{}') into actors from auth.users where email in (
    'customer-' || run_id || '-0@example.invalid', 'customer-' || run_id || '-1@example.invalid',
    'consultant-' || run_id || '-2@example.invalid', 'admin-' || run_id || '-3@example.invalid',
    'customer-' || run_id || '-4@example.invalid', 'customer-' || run_id || '-5@example.invalid'
  );
  select coalesce(array_agg(id), '{}') into providers from public.transport_providers where
    (name = 'Staging Carrier A ' || run_id and booking_email = 'booking-a-' || run_id || '@example.invalid') or
    (name = 'Staging Carrier B ' || run_id and booking_email = 'booking-b-' || run_id || '@example.invalid');
  select coalesce(array_agg(id), '{}') into requests from public.transport_requests where customer_id = any(actors);
  select coalesce(array_agg(id), '{}') into consultations from public.consultations
    where customer_id = any(actors) and subject = 'Staging smoke ' || run_id;

  -- If a non-fixture client has interacted with these providers, stop rather
  -- than delete their records. Foreign keys provide an additional guard.
  if exists (select 1 from public.transport_invitations where provider_id = any(providers) and not (request_id = any(requests)))
     or exists (select 1 from public.transport_invitations where request_id = any(requests) and not (provider_id = any(providers)))
     or exists (select 1 from public.transport_provider_members where provider_id = any(providers) and not (profile_id = any(actors))) then
    raise exception 'Booking fixture is linked to non-fixture data; review manually';
  end if;

  delete from public.transport_bookings where request_id = any(requests);
  update public.transport_requests set selected_quote_id = null, confirmation_due_at = null, status = 'closed'
    where id = any(requests);
  delete from public.transport_quotes where request_id = any(requests);
  delete from public.transport_invitations where request_id = any(requests);
  delete from public.transport_requests where id = any(requests);
  delete from public.transport_provider_members where provider_id = any(providers);
  delete from public.transport_provider_lanes where provider_id = any(providers);
  delete from public.transport_providers where id = any(providers);

  delete from public.notifications where user_id = any(actors) or link in (
    select '/portal/requests/' || id from unnest(consultations) as c(id)
    union all select '/staff/consultations/' || id from unnest(consultations) as c(id)
  );
  delete from public.audit_logs where actor_id = any(actors);
  delete from public.appointments where consultation_id = any(consultations);
  delete from public.messages where consultation_id = any(consultations);
  delete from public.status_history where consultation_id = any(consultations);
  delete from public.consultations where id = any(consultations);
  delete from public.profiles where id = any(actors);
  delete from auth.users where id = any(actors);
end;
$cleanup$;
