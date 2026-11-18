import assert from 'node:assert/strict';
import test from 'node:test';
import { STAGING_BACKEND, STAGING_RECEIPT_PATH, stagingBuildContext, stagingPreviewOrigin, verifyStagingPreview } from '../scripts/staging-preview.mjs';

const origin = 'https://afrigate-aplmdwbil-africa-maarifa.vercel.app';
const sha = '1'.repeat(40);
const preview = {
  VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_PROJECT_ID: 'prj_7Hi29Z3dnzQdR2EPBcZluD1ikRbp',
  VERCEL_GIT_REPO_ID: '1452299541', VERCEL_GIT_COMMIT_SHA: sha, VERCEL_URL: new URL(origin).hostname,
  NEXT_PUBLIC_SUPABASE_URL: STAGING_BACKEND, VITE_SUPABASE_URL: STAGING_BACKEND,
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-placeholder', VITE_SUPABASE_ANON_KEY: 'test-only-placeholder',
};

test('staging checks accept only an immutable AfriGate HTTPS origin', () => {
  assert.equal(stagingPreviewOrigin(origin), origin);
  for (const url of [origin.replace('https:', 'http:'), 'https://afrigate-one.vercel.app', 'https://example.invalid',
    'https://afrigate-git-main-africa-maarifa.vercel.app', `${origin}/portal`, `${origin}?redirect=1`,
    origin.replace('https://', 'https://someuser@')]) assert.throws(() => stagingPreviewOrigin(url));
});

test('only the connected Vercel Git Preview can require signed-in staging checks', () => {
  assert.deepEqual(stagingBuildContext(preview), { version: 1, commit: sha, origin, backend: STAGING_BACKEND, transport: false });
  assert.equal(stagingBuildContext({}), null);
  assert.equal(stagingBuildContext({ ...preview, VERCEL_ENV: 'production' }), null);
  assert.equal(stagingBuildContext({ ...preview, VERCEL_GIT_REPO_ID: 'another-repo' }), null);
  assert.equal(stagingBuildContext({ ...preview, VERCEL_PROJECT_ID: 'another-project' }), null);
  assert.throws(() => stagingBuildContext({ ...preview, VERCEL_ENV: 'production', AFRIGATE_VERIFY_STAGING: 'true' }), /connected AfriGate Vercel Preview/);
  assert.throws(() => stagingBuildContext({ ...preview, NEXT_PUBLIC_SUPABASE_URL: 'https://wrong-backend.supabase.co' }), /isolated AfriGate staging/);
  assert.throws(() => stagingBuildContext({ ...preview, SUPABASE_SERVICE_ROLE_KEY: '' }), /credentials are not configured/);
  assert.throws(() => stagingBuildContext({ ...preview, TRANSPORT_ENABLED: 'true' }), /flags must agree/);
  assert.throws(() => stagingBuildContext({ ...preview, AFRIGATE_STAGING_BROWSER_URL: origin }), /require both Preview transport flags/);
  assert.equal(stagingBuildContext({ ...preview, TRANSPORT_ENABLED: 'true', VITE_TRANSPORT_ENABLED: 'true' }).transport, true);
});

function deployedPreview(receipt, overrides = {}) {
  const calls = [];
  const responses = {
    [STAGING_RECEIPT_PATH]: Response.json(receipt),
    '/api/public?action=services': Response.json([1, 2, 3, 4]),
    '/api/account?action=me': Response.json({ error: 'Please sign in' }, { status: 401 }),
    '/api/transport?action=access': Response.json({ error: 'Not available' }, { status: receipt.transport ? 401 : 404 }),
    ...overrides,
  };
  return { calls, async request(target, options) {
    assert.ok(target.startsWith(origin + '/'));
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers, undefined);
    const path = target.slice(origin.length);
    calls.push(path);
    return responses[path];
  } };
}

test('credential-free Preview verification requires the matching build result and checks the deployed API', async () => {
  for (const transport of [false, true]) {
    const mock = deployedPreview({ ...stagingBuildContext(preview), result: 'passed', transport });
    assert.deepEqual(await verifyStagingPreview({ url: origin, commit: sha }, mock.request), { commit: sha, transport });
    assert.deepEqual(mock.calls, [STAGING_RECEIPT_PATH, '/api/public?action=services', '/api/account?action=me', '/api/transport?action=access']);
  }
});

test('missing, stale or misleading build results do not pass the Preview check', async () => {
  const receipt = { ...stagingBuildContext(preview), result: 'passed' };
  const verify = mock => verifyStagingPreview({ url: origin, commit: sha }, mock.request);
  await assert.rejects(verify(deployedPreview(receipt, { [STAGING_RECEIPT_PATH]: new Response('<html>SPA fallback</html>') })), /did not return JSON/);
  for (const result of [
    { ...receipt, commit: '2'.repeat(40) }, { ...receipt, backend: 'https://wrong-backend.supabase.co' },
    { ...receipt, origin: 'https://afrigate-another-africa-maarifa.vercel.app' }, { ...receipt, result: 'failed' },
  ]) {
    const mock = deployedPreview(result);
    await assert.rejects(verify(mock), /No matching staging build result/);
    assert.deepEqual(mock.calls, [STAGING_RECEIPT_PATH]);
  }
  await assert.rejects(verify(deployedPreview(receipt, { '/api/account?action=me': Response.json({ role: 'customer' }) })), /unexpected status/);
});
