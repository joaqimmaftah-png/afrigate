# Transport marketplace pilot

This add-on starts at finding an approved company and ends at an in-platform booking reference. It does not collect payment or handle shipments, live tracking, dispatch, delivery, or invoices. Existing client accounts, consultations, and consultation tracking are unchanged. Carriers and clients coordinate the remaining arrangements directly.

## Roll out on staging first

1. Follow the [preview-first release workflow](RELEASE_WORKFLOW.md). Apply `20261118090000_transport_marketplace.sql` in the isolated staging Supabase project **after** the consultation migrations. It adds seven tables and two service-only database functions; it does not migrate existing accounts or insert sample companies.
2. Set `TRANSPORT_ENABLED=true` on the preview server and `VITE_TRANSPORT_ENABLED=true` for the preview build. Scope both variables to the selected **Preview branch**, then deploy a fresh build. Both flags are off by default. Keep production disabled until a staging review and explicit release approval.
3. In **Staff → Transport Providers**, add a company with its booking contact email, directional routes, and supported container types. It remains pending. Ask provider team members to sign in with their verified AfriGate account, then add each by their account email. No staff privilege or new login is needed. Check the business and relevant permits, insurance, and coverage out of band, then **Verify and publish**. Only approved companies with an active team member are listed. To remove access, remove a member or suspend the company.
4. Try as a client in **Transport → Find providers**, and as two different company members in **Provider workspace → Requests & quotes**. Pick overlapping local and transit routes where two companies can quote. Send one request to one to five companies and compare offers in the same currency. Only the invited company can reply, and only the requester can select one current offer.
5. Verify that selecting a quote does not create a booking. The selected provider must confirm by the earlier of 24 hours or offer expiry. A declined, withdrawn, or expired selection lets the client consider other offers while they are valid. When confirmed, both parties see the booking reference, the exact agreed quote, and the other party’s contact email. Other providers do not see the selected offer or the client’s contact.
6. Test access with two separate clients, two provider companies, and an administrator. Cover stale/existing quotes, retries, an attempted second confirmation, expired offers, revoked team access, the mobile portal, and unchanged consultation flows. For a live pilot, measure quote response time, requests receiving at least two quotes, and confirmed bookings.

To pause a rollout, disable the API flag and redeploy with the client flag disabled. Leave the additive migration and commercial records in place. Do not reset either database to roll back a UI release.

### Staging record — 2026-11-18

- Staging Supabase project `ufexjnqkppmcpjstabob` was restored. The management API recorded the repository's `20261118090000_transport_marketplace.sql` as `20261118094643_transport_marketplace`, after the two core migrations. Do not reapply it based on the timestamp difference.
- In hosted PostgreSQL, synthetic fixtures exercised provider approval, private invitations, two itemized quotes, requester/company isolation, and selected-provider confirmation. The test rolled back the fixture rows. All seven transport tables have RLS, and only the service role can call the transport RPCs through PostgREST.
- For a separate Auth and PostgREST smoke on a trusted Preview branch, see [the opt-in build smoke](RELEASE_WORKFLOW.md#opt-in-vercel-preview-build-smoke). It does not replace a deployed browser review.

## Implementation and local verification

- `api/transport.js` verifies the caller with the existing Auth helper. It passes only the verified user ID to `transport_read` and `transport_write`. Those functions check active account, ownership, or approved company membership. The marketplace tables are deny-by-default with no browser grants; SQL functions use a locked search path and only the server role can execute the public RPCs.
- A request lock serializes quote submissions, selection, and confirmation. Quote revisions are immutable; a confirmed booking uniquely points to one revision. An expiring selection needs no scheduler. It is treated as open after its deadline and reset when a request action changes state. The existing notification bell and audit log receive marketplace events.
- `npm test` applies the real baseline and marketplace migrations to an in-memory PostgreSQL instance and exercises the actual handler with synthetic identity and RPC adapters. No production Supabase credentials are used. This is not a substitute for the hosted staging Auth and PostgREST smoke test above.
