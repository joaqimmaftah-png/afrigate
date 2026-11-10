# Afrigate Corporate Services

Client consultation platform for trade, tax and business advisory.

## Deployment status — 2026-11-10

**Production deployment built successfully; launch verification is blocked.** The connected Supabase account returned no legacy projects. With authorization, a new free-plan project `afrigate` (`yfinhvfqkzyqcvfwsvft`) was created in `eu-west-1`. Database, Auth, REST and Storage health checks passed. A new Vercel project named `afrigate` was created with the user's authorization in the connected team (`prj_7Hi29Z3dnzQdR2EPBcZluD1ikRbp`). It has the Vite preset, `npm ci` install command, `npm run build` build command and `dist` output directory. The project is now linked to `joaqimmaftah-png/afrigate`, production branch `main`, with Git deployment creation enabled. The four required Supabase environment variables have been configured for production only, with the service-role key marked sensitive. Git push of commit `9b8e6e8` automatically triggered deployment `dpl_HwiCJMs19P89Z36cwvnhMoB6e1YE`, which reached READY/PROMOTED with six Node functions. A redundant manually queued deployment was cancelled. Assigned production alias: `https://afrigate-africa-maarifa.vercel.app`. Anonymous requests to public/account API routes redirect to Vercel login; application runtime and database connectivity are not yet verified. Build logs confirmed Node 24.x from package.json overrides the project default of Node 26.x. Deployment protection remains enabled; anonymous public access and end-to-end automatic deployments are not yet verified. The unrelated `jielimishe` project was not modified. Migration `20261110070922_initial_schema` was applied to the new project. No legacy records were modified or migrated.

The user authorized a fresh project and migration of old data if available. No legacy projects are accessible, so no old users/data have been migrated. The new database contains the 12 application tables and a private document bucket, without demo accounts or business content. Live catalog checks verified RLS enabled on all 12 tables, no anonymous SELECT grants, no authenticated UPDATE grants, a private 10 MiB bucket, and zero Auth users. Browser access is intentionally through the authorized Node API, with no direct table policies. Signup is temporarily disabled until production URLs, email delivery and application configuration are ready; email confirmation is required, token expiry is one hour and refresh-token rotation is enabled. The Auth site URL is `https://afrigate-africa-maarifa.vercel.app`; exact `/login` and `/reset-password` redirect URLs are allowlisted. Google OAuth and production SMTP remain unconfigured (SMTP host/user/sender are unset in the latest response). The selected sender is Gmail; its App Password must be entered directly in Supabase settings. Production Supabase configuration is stored in Vercel; no server secret is committed to Git. Services/catalog records and the initial administrator still need provisioning; an empty project alone cannot support consultation creation.

## Architecture

- React 19, TypeScript, React Router, Tailwind 4 and Vite 7 frontend, compiled to `dist`.
- Six Node API entrypoints under `api/`: account, admin, appointments, consultations, files and public. Shared server code lives in `api/_lib/`, not standalone function routes.
- Supabase Auth issues sessions; the browser sends bearer tokens to same-origin API routes. The API verifies tokens with Supabase and loads the profile from the database.
- The API uses a **server-only service-role key**. This bypasses RLS, so every private operation must enforce resource ownership and role authorization in the API. Database RLS remains essential to prevent direct browser access.
- Roles: customer, consultant, admin. New profiles are provisioned as customers, never from a user-supplied role.
- Required public-schema tables referenced by code: `profiles`, `services`, `consultations`, `status_history`, `messages`, `documents`, `appointments`, `notifications`, `audit_logs`, `articles`, `testimonials`, `enquiries`.
- Files use a private `consultation-docs` Storage bucket, signed uploads and two-minute signed downloads. Uploads support PDF, images, Word, Excel and CSV; application limit is 10 MiB. Configure matching bucket size/MIME restrictions and deny unauthenticated direct object access.
- Google authentication currently uses an external OAuth proxy. It requires independent configuration and verification; message events are restricted to the configured proxy origin and opened popup. Do not assume that an existing development proxy is appropriate for production.
- Fonts load from Google Fonts. Other frontend assets are served locally from `public/`.

## Local checks

Use Node 24 (the intended Vercel runtime), then:

```sh
npm ci
cp .env.example .env.local
# Fill configuration locally without committing it.
npm test
npm run build
npm audit
npm run lint
```

Vite development alone does **not** run the Node API functions. Full-stack testing requires a compatible Vercel development environment or a deployed preview.

Validation performed in the Arena sandbox used Node 22.22.3, not the intended Node 24 runtime:

- `npm test`: five focused checks passed (missing-token rejection, admin role guard, error redaction, bounded input cleaning, instrumentation removal).
- `npm run build`: passed; main JavaScript bundle is approximately 758 kB before gzip, with a chunk-size warning.
- `npm audit` and `npm audit --omit=dev`: zero reported vulnerabilities after dependency updates. A minimatch override resolves the reported transitive vulnerability; retain audit checks on future upgrades.
- `npm run lint`: **fails with 19 existing application errors**, including effect state updates, render-time ref/purity checks, memoization and mixed Fast Refresh exports. These have not been suppressed or represented as passing.
- No live authentication, CRUD, browser/mobile, upload/download, email recovery, OAuth, database security, or deployment-workflow tests were possible. Unit checks do not substitute for them.

## Environment variables

`.env.example` documents names only. `.env` and environment-specific variants are ignored. Removing a file from tracking does **not** erase Git history. Review historical configuration and rotate any privileged credential previously committed. Existing advertised demo accounts must be audited and their credentials rotated or accounts disabled in the actual database before production; removing login shortcuts does not disable accounts.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Browser/build | Intended Supabase project HTTPS URL |
| `VITE_SUPABASE_ANON_KEY` | Browser/build | Public anon/publishable API key; security depends on RLS |
| `NEXT_PUBLIC_SUPABASE_URL` | Server | Same project URL used by the API; legacy name |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged API database access; store as a sensitive Vercel variable |
| `VITE_GOOGLE_CLIENT_ID` | Browser/build | Google OAuth public client ID |
| `VITE_GOOGLE_AUTH_PROXY` | Browser/build | Verified HTTPS OAuth proxy callback URL |

Only browser-safe values may use `VITE_` or `NEXT_PUBLIC_` prefixes: Vite config makes those prefixes eligible for client substitution. **Never prefix a service-role key, database password or private OAuth secret that way.** Do not copy development project credentials into production by default.

Legacy optional server variables `FULLSTACK_PROJECT_REF` and `FULLSTACK_RESTORE_API_URL` support an existing database wake hook after server errors. They are not required for a normal production Supabase project. Leave unset unless the endpoint and its authorization are independently reviewed.

## Vercel deployment configuration

When database access and configuration are resolved:

1. Use an Afrigate-specific Vercel project linked to `joaqimmaftah-png/afrigate`; do not repurpose `jielimishe`.
2. Framework: Vite; install: `npm ci`; build: `npm run build`; output: `dist`; runtime: Node 24. The root `api/` directory supplies Node serverless endpoints.
3. `vercel.json` rewrites frontend navigation to `index.html` while excluding `/api/` paths.
4. Set the variables above in the intended production environment before building. Use a separate Supabase project for previews rather than exposing production data to arbitrary preview code.
5. Confirm the intended production branch. This Arena session may push only `arena/d680b233-afrigate`; promoting a deployment from that branch is separate from changing the repository's production branch. The connector does not expose a production-branch update setting.
6. An actual push to the session branch triggered a production deployment successfully. The linked production branch was previously reported as `main`; before future releases, verify the current branch/environment mapping in Vercel to ensure only intended pushes publish production.
7. The Vercel connector does not expose the first-deployment `projectSettings`/auto-detection confirmation controls; if Vercel requires them, that initial confirmation needs to be completed through an authorized supported interface.
8. Configure a custom domain only after its exact name is confirmed. Verify DNS, SSL and anonymous accessibility; deployment protection must not block intended public production traffic.

## Supabase release checklist

- Inspect the existing schema, constraints, triggers, functions, migration history, RLS, grants, storage configuration and data without exporting private customer data into logs.
- Back up before making changes. Check in reviewed, versioned, additive migrations; do not reset or replace an existing schema.
- Ensure profile roles/activity cannot be changed by customers through direct database requests. Test with anonymous, customer A, customer B, assigned and unassigned consultants, and admin sessions.
- Restrict direct access to all private tables and storage objects. Permit public content only where intentionally published/active. API service-role access still needs separate authorization tests.
- Configure email confirmation, refresh-token rotation and production auth site/redirect URLs. Allow exact `/reset-password` redirects; configure working production email delivery and test signup/recovery with a controlled inbox.
- Verify the OAuth provider/proxy with production URLs. Never provision admin accounts based on signup metadata.
- Configure private storage and enforce upload size/MIME limits at bucket level, not only client-provided metadata.
- Review public enquiry/tracking abuse protection and rate limits before opening production traffic.

### Migrations executed

`20261110070922_initial_schema` — created the 12 application tables, foreign keys, checks, indexes, deny-by-default RLS/grants and private `consultation-docs` bucket with size/MIME restrictions. Supabase migration history confirms this version. SQL is checked in under `supabase/migrations/`. No profile trigger is installed: existing API logic provisions customer profiles after verified authentication. No RPC is required by the current application. End-to-end role, CRUD and signed upload tests are still pending.

## Production acceptance

Do not call this deployment complete until a live URL is anonymously reachable, APIs return expected results, database migrations/security checks pass, registration/login/logout/recovery work, cross-account access is denied, major consultation/appointment/admin/content workflows work, uploads/downloads are private and functional, responsive layouts and browser/server errors are checked, and GitHub-triggered deployments are observed. Record actual deployment identifiers, migration versions and test outcomes here when those checks are completed.

## Current launch blockers

- Vercel Authentication/deployment protection redirects anonymous production API requests to Vercel login. The connector has no setting to change this. In the existing project, review Settings → Deployment Protection and disable Vercel Authentication for intended public production traffic; retain Supabase/API authentication for private application routes. No protection bypass was added.
- Configure Gmail SMTP directly in Supabase using an App Password. The available connector cannot write SMTP settings. No admin invitation has been sent.
- Initial administrator and business service catalog remain unprovisioned. No data migration source is accessible.
- Signup remains disabled; do not enable until email delivery, redirects and application workflows are tested.
- The last lint run still reports 19 pre-existing application errors. Full authenticated CRUD, cross-account isolation, real uploads/downloads, recovery and mobile/browser tests remain pending.
- Upload registration now reads actual Storage object size/MIME metadata rather than trusting the request body; customers cannot label an upload as a consultant report. This still needs a live storage integration test.

### Services catalog correction

Migration `20261110092305_seed_service_catalog` added the four service areas already described on the site: Import & Export, Tax Consultation & Compliance, Business Registration, and Trade Facilitation. The new production database had zero service rows before this migration; a live SQL read verified four active rows afterwards. Existing rows are preserved with `ON CONFLICT (slug) DO NOTHING`. Homepage cards and desktop/mobile service navigation all use `/api/public?action=services`; Vercel protection must allow anonymous access to this endpoint. Public checks still redirected to Vercel login during diagnosis, so end-to-end rendering has not been verified. The UI now distinguishes loading, empty-catalog and failed-request states and offers retry rather than rendering an unexplained blank section. Non-JSON API responses are rejected explicitly rather than treated as successful data.
