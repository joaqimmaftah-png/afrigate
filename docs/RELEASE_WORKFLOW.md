# Preview-first releases

## Verified service configuration (2026-11-10)

- Vercel `afrigate` is linked to this GitHub repository, production branch `main`.
- Branch pushes automatically create unique preview deployment URLs; Vercel posts commit/PR links. Earlier PR #1 had a READY preview and its merge produced a READY production deployment.
- Fork protection is enabled. Do not expose privileged credentials to untrusted PR code.
- Vercel build command is now `npm test && npm run build`; failed tests/builds must not replace the live deployment.
- `.github/workflows/ci.yml` runs on branch pushes, main PRs, and manual dispatch using Node 24: locked install, lint-regression gate, tests, high/critical vulnerability audit, TypeScript/Vite build.
- CI has read-only repository access and no production credentials; its dummy public build configuration is compile-only, not a functional staging backend.

## Remaining blockers — do not mistake a READY build for functional staging

An isolated free-plan Supabase project `afrigate-staging` (`ufexjnqkppmcpjstabob`, eu-west-1) is now provisioned. All four Supabase variables are configured for Vercel **Preview only**, separate from the unchanged Production values. The staging service-role credential is sensitive/server-only. Existing preview deployments must be rebuilt to pick up the new values.

Applied staging migrations: `20261110143510_initial_schema` and `20261110143523_seed_service_catalog`, corresponding to the two versioned SQL files in this repository. Verified 12 RLS-protected tables, private consultation-docs bucket, four active service records, zero auth users and zero consultations at provisioning. No production users, files, SMTP credentials or customer records were copied.

Staging Google provider and test email delivery are not configured yet. Authenticated end-to-end testing remains pending; do not claim the complete workflow is verified from public service checks alone.

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

## Automated staging authorization smoke test

`.github/workflows/staging-smoke.yml` runs after successful GitHub `Preview` deployment events (once this workflow is on main), or manually from Actions with an immutable preview URL. It always checks out the reviewed test code from main, has read-only GitHub permissions and never uses production credentials.

The script `scripts/staging-smoke.mjs` refuses a Supabase URL other than the known staging project. It creates four temporary, uniquely named synthetic accounts with random passwords through Supabase Admin Auth (no email is sent), checks the default customer role, exercises customer/consultant/admin authorization and consultation ownership/assignment, verifies the resulting write exists in the staging DB, then deletes only its own records/accounts in a finally block. No reusable demo password is published. These are API integration tests, not browser or Google-consent tests. If cleanup fails, review the job output and remove only the run's `example.invalid` accounts and associated synthetic records in staging; do not reset the database.

**Activation blocked:** the connected GitHub integration returned HTTP 403 when requesting the Actions secrets public key, so no Actions secrets could be added. The repository owner must add the following in Settings > Secrets and variables > Actions, or provide the integration Actions Secrets write permission:

- `STAGING_PUBLIC_KEY`: staging public/anon key.
- `STAGING_SERVICE_ROLE_KEY`: staging service-role key (never the production key).

Obtain both from **afrigate-staging**, not afrigate. Do not paste secret values in chat. The URL is pinned in the workflow. After merging this workflow and configuring secrets, run it manually against the latest preview URL to verify its first successful execution. Future successful preview deployment events then trigger it automatically. A missing secret fails the test; it never falls back to production. No live authenticated test has yet been executed, and no test accounts have yet been created by this script.
