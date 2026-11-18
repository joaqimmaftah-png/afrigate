# Preview-first releases

## Verified service configuration (2026-11-10)

- Vercel `afrigate` is linked to this GitHub repository, production branch `main`.
- Branch pushes automatically create unique preview deployment URLs; Vercel posts commit/PR links. Earlier PR #1 had a READY preview and its merge produced a READY production deployment.
- Fork protection is enabled. Do not expose privileged credentials to untrusted PR code.
- Vercel build command is now `npm test && npm run build`; failed tests/builds must not replace the live deployment.
- `.github/workflows/ci.yml` runs on branch pushes, main PRs, and manual dispatch using Node 24: locked install, lint-regression gate, tests, TypeScript/Vite build, then a blocking high/critical vulnerability audit.
- CI has read-only repository access and no production credentials; its dummy public build configuration is compile-only, not a functional staging backend.

## Remaining blockers — do not mistake a READY build for functional staging

An isolated free-plan Supabase project `afrigate-staging` (`ufexjnqkppmcpjstabob`, eu-west-1) is now provisioned. All four Supabase variables are configured for Vercel **Preview only**, separate from the unchanged Production values. The staging service-role credential is sensitive/server-only. Existing preview deployments must be rebuilt to pick up the new values.

Applied staging migrations: `20261110143510_initial_schema` and `20261110143523_seed_service_catalog`, corresponding to the two versioned SQL files in this repository. Verified 12 RLS-protected tables, private consultation-docs bucket, four active service records, zero auth users and zero consultations at provisioning. No production users, files, SMTP credentials or customer records were copied.

The staging Google provider and test email delivery are not configured yet. Use the signed-in Preview checks below to verify deployed password-based flows; a READY deployment or public API response alone is not verification.

The owner reports configuring branch protection. Independent API verification remains unavailable: GitHub returned HTTP 403 `Resource not accessible by integration` when reading main branch protection. Therefore enforced PR/review/check gates could not be configured or verified through this connection. An owner must configure them in Settings > Rules > Rulesets (or Branches > protection), or grant the integration repository Administration access:

- Target `main`; require a pull request; prevent force pushes and deletion.
- Require up-to-date branches and passing checks `quality` (CI) and `Vercel` (verify exact displayed names after first run).
- Dismiss stale approvals, require resolved conversations, and require one independent approval if another maintainer is available. GitHub does not let an author approve their own PR; a solo-owner workflow needs owner review of the preview before manual merge instead.
- Apply protections to administrators where supported; avoid routine bypasses.
- Disable auto-merge unless the release policy intentionally changes.

Until protection is enforced, direct main pushes can still deploy without review. This is not a completed approval barrier.

## Staging backend setup

Use a separate Supabase project with synthetic data only. Apply the versioned migrations there, never import production customer files or real staff accounts for tests. Configure these Vercel **Preview-only** variables:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: staging URL/public key.
- `NEXT_PUBLIC_SUPABASE_URL`: staging server URL (legacy variable name).
- `SUPABASE_SERVICE_ROLE_KEY`: staging secret, marked sensitive, server-only.

Configure staging Auth site/redirect URLs to the actual preview hosts. Permit a narrowly scoped preview hostname pattern, never a broad production wildcard. Configure Google callback for the staging Supabase project separately. Use test email delivery, not real customer mail. Protect preview access through Vercel settings if the plan permits; never change production access accidentally. Arbitrary preview code can read preview secrets, so only deploy trusted code with staging credentials.

## Review and release

1. Push the working branch; open a PR against main. Every subsequent push receives a new immutable preview URL, while the branch alias updates.
2. Wait for CI and Vercel. Open the preview URL from the PR's Vercel comment/check.
3. Verify staging services, login/logout/reset/Google flow, customer-only default role, staff authorization, consultations, messages, appointments, upload/download restrictions, mobile layout and navigation. Confirm test writes are in staging, never production.
4. Record the tested commit SHA and preview URL in the PR checklist. A new commit invalidates the prior review.
5. Approve/review and manually merge only after checks and functional testing pass. Do not manually promote a preview built with staging variables into production.
6. The main merge triggers a fresh Vercel production build with Production variables. No automatic database migrations are run by CI: review backward compatibility, take backups and apply additive migrations deliberately.
7. Smoke-test the public site, services API, sign-in and a controlled authenticated flow after release. Monitor Vercel runtime errors and Supabase auth/database logs.

## Rollback

In Vercel Deployments, select the previous known-good **Production** deployment and use Rollback/Instant Rollback where available. Also revert the faulty change via a new PR so the next main build does not reintroduce it. Code rollback does not undo database changes; prefer additive, backward-compatible migrations and recovery from verified backups rather than destructive down-migrations.

## Known quality debt

Full `npm run lint` currently reports 19 pre-existing errors. The committed per-file/per-rule baseline keeps them visible and fails CI on increased counts or new categories; it is not a claim of clean lint. Resolve findings and reduce baseline entries in future PRs. Current tests are mocked security/unit checks, not browser E2E tests. The Vercel project reports Node 26 as its setting, while package.json requests Node 24 and CI explicitly uses 24; verify effective runtime in deployment logs and align project settings via the dashboard (the connector does not expose nodeVersion).

## Build-tool security

[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) affects all published `picomatch` versions through 4.0.7. Until an official patched release is available, the lockfile resolves the build/lint consumers of `picomatch` to `tools/build-glob`, a local compatibility layer built on `minimatch` 11.0.9. It contains no Picomatch parser code, supports the glob calls used by the locked tools, and rejects extended glob syntax rather than silently changing it. Tests cover recursive/brace matching, tinyglobby's directory traversal, and Vite's default deny rules. There is no audit exception or forced Vite downgrade. Remove the adapter and its override when migrating to a verified patched `picomatch`, and rerun the regression tests, full build, and blocking audit.

## Automated staging smoke test

1. **Vercel does the signed-in work.** At the end of `npm run build`, the connected AfriGate Git Preview uses its existing Preview credentials and the actual API handlers. The check pins the Vercel project, Git repository, and both staging backend URLs before creating any fixtures. It verifies password sign-in, default roles, consultation ownership/assignment, public lookup, and either the disabled transport gate or the enabled transport RPCs. Local builds and Production never run these checks. Only a passing Preview build writes `/afrigate-staging-smoke.json` to `dist`; it contains the commit, immutable origin, public staging reference, flag state, and result, not credentials or fixture data.
2. **GitHub checks the deployment without staging secrets.** `.github/workflows/staging-smoke.yml` runs after a successful Vercel-created GitHub `Preview` deployment. It matches the build result to that commit and origin and checks the deployed service catalog and anonymous access restrictions over HTTP. It fails for a missing or mismatched result, even if the application serves its fallback HTML. When dispatching manually, select the branch and use the immutable Preview URL for that exact commit. `STAGING_PUBLIC_KEY` and `STAGING_SERVICE_ROLE_KEY` are no longer needed in GitHub Actions; leave staging keys in Vercel Preview only.

This result describes the checks run by the trusted build; it is not a signature or a substitute for reviewing the commit and deployment. The automatic signed-in check invokes handlers in process and the independent GitHub probe is unauthenticated; exercise deployed signed-in paths with the opt-in browser test below. The handler check creates uniquely named synthetic accounts with random passwords (no email is sent), then deletes only their records and accounts. If cleanup fails, inspect the Vercel build and remove only that run's fixtures in staging; do not reset the database.

### Opt-in deployed browser smoke

On a trusted **Preview branch only**, enable both transport flags and set `AFRIGATE_STAGING_BROWSER_URL` to a **ready, immutable AfriGate Preview origin** with transport enabled. `AFRIGATE_VERIFY_STAGING=true`, if set, also requires transport to be enabled; it is not needed for the automatic base Auth checks. Use the reviewed deployment, not a production URL or movable branch alias. Temporarily installed Chromium uses the same short-lived accounts and can reach only that Preview and the staging backend. It checks password sign-in, the desktop and mobile directory, mobile filters and sign-out, the provider gate, consultation/admin access, and an appointment request and confirmation. Without the booking opt-in below, the smoke cleans up its own fixtures. Remove the smoke opt-ins after verification. This does not test Google consent, email delivery, or private file transfers.

For a **one-off two-carrier booking check**, also set `AFRIGATE_STAGING_BOOKING_RUN` to a fresh lowercase UUID. Run it only while staging is reserved for synthetic data, and do not reuse that UUID. The test creates two approved providers through the deployed API and uses the browser for the request, offers, selection and confirmation. It checks that the competitor cannot confirm or see booking contacts and that confirming again does not create a new booking. The normal service-role key deliberately cannot delete transport rows. Once the build exits (pass or fail), remove the booking opt-in and run `scripts/staging-booking-cleanup.sql` with that UUID in the **afrigate-staging** SQL editor. Verify that the synthetic providers, requests, bookings, accounts and associated records are gone. Do not broaden table grants to automate this cleanup.
