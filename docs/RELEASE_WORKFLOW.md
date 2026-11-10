# Preview-first releases

## Verified service configuration (2026-11-10)

- Vercel `afrigate` is linked to this GitHub repository, production branch `main`.
- Branch pushes automatically create unique preview deployment URLs; Vercel posts commit/PR links. Earlier PR #1 had a READY preview and its merge produced a READY production deployment.
- Fork protection is enabled. Do not expose privileged credentials to untrusted PR code.
- Vercel build command is now `npm test && npm run build`; failed tests/builds must not replace the live deployment.
- `.github/workflows/ci.yml` runs on branch pushes, main PRs, and manual dispatch using Node 24: locked install, lint-regression gate, tests, high/critical vulnerability audit, TypeScript/Vite build.
- CI has read-only repository access and no production credentials; its dummy public build configuration is compile-only, not a functional staging backend.

## Remaining blockers — do not mistake a READY build for functional staging

Vercel currently has Supabase variables scoped to **Production only**. Preview deployments do not have a configured backend. Do NOT copy production credentials to Preview to make tests pass. A separate staging Supabase project is required for authentication, CRUD, uploads and staff testing. Provisioning and end-to-end verification are not completed by this PR.

GitHub returned HTTP 403 `Resource not accessible by integration` when reading main branch protection. Therefore enforced PR/review/check gates could not be configured or verified through this connection. An owner must configure them in Settings > Rules > Rulesets (or Branches > protection), or grant the integration repository Administration access:

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
