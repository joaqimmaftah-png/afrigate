import assert from 'node:assert/strict';

export const STAGING_BACKEND = 'https://ufexjnqkppmcpjstabob.supabase.co';
export const STAGING_RECEIPT_PATH = '/afrigate-staging-smoke.json';
const REPOSITORY_ID = '1452299541';
const PROJECT_ID = 'prj_7Hi29Z3dnzQdR2EPBcZluD1ikRbp';

export function stagingPreviewOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Expected an immutable AfriGate Preview URL'); }
  assert.equal(url.protocol, 'https:', 'Expected an HTTPS preview URL');
  assert.match(url.hostname, /^afrigate-[a-z0-9]+-africa-maarifa\.vercel\.app$/, 'Use an immutable AfriGate Preview URL');
  assert.ok(!url.username && !url.password && !url.port && !url.search && !url.hash && url.pathname === '/',
    'Use only the immutable Preview origin');
  return url.origin;
}

function commitSha(sha) {
  assert.ok(typeof sha === 'string' && /^[a-f0-9]{40}$/.test(sha), 'Expected a full Git commit SHA');
  return sha;
}

// Hosted Auth is tested where the staging credentials already live. Neither
// the GitHub job nor a Production/local build needs the staging service key.
export function stagingBuildContext(env = process.env) {
  const optIn = env.AFRIGATE_VERIFY_STAGING === 'true' || env.AFRIGATE_STAGING_BROWSER_URL || env.AFRIGATE_STAGING_BOOKING_RUN !== undefined;
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'preview' || env.VERCEL_PROJECT_ID !== PROJECT_ID || env.VERCEL_GIT_REPO_ID !== REPOSITORY_ID) {
    assert.ok(!optIn, 'Extra staging checks require the connected AfriGate Vercel Preview');
    return null;
  }
  assert.ok(env.NEXT_PUBLIC_SUPABASE_URL === STAGING_BACKEND && env.VITE_SUPABASE_URL === STAGING_BACKEND,
    'Both Preview backend URLs must point to the isolated AfriGate staging project');
  assert.ok(env.SUPABASE_SERVICE_ROLE_KEY && env.VITE_SUPABASE_ANON_KEY, 'Vercel Preview staging credentials are not configured');
  const transport = env.TRANSPORT_ENABLED === 'true';
  assert.equal(env.VITE_TRANSPORT_ENABLED === 'true', transport, 'Preview transport flags must agree');
  if (optIn) assert.ok(transport, 'Extra staging checks require both Preview transport flags');
  return {
    version: 1,
    commit: commitSha(env.VERCEL_GIT_COMMIT_SHA),
    origin: stagingPreviewOrigin(`https://${env.VERCEL_URL}`),
    backend: STAGING_BACKEND,
    transport,
  };
}

export async function verifyStagingPreview({ url, commit }, request = fetch) {
  const origin = stagingPreviewOrigin(url);
  const sha = commitSha(commit);
  async function json(path, expectedStatus) {
    const response = await request(`${origin}${path}`, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, expectedStatus, `${path} returned an unexpected status`);
    assert.match(response.headers.get('content-type') || '', /application\/json/i, `${path} did not return JSON`);
    return response.json();
  }
  const receipt = await json(STAGING_RECEIPT_PATH, 200);
  assert.ok(receipt?.version === 1 && receipt.result === 'passed' && receipt.commit === sha &&
    receipt.origin === origin && receipt.backend === STAGING_BACKEND && typeof receipt.transport === 'boolean',
  'No matching staging build result for this Preview and commit');
  const services = await json('/api/public?action=services', 200);
  assert.ok(Array.isArray(services) && services.length >= 4, 'Preview service catalog is missing');
  await json('/api/account?action=me', 401);
  await json('/api/transport?action=access', receipt.transport ? 401 : 404);
  return { commit: sha, transport: receipt.transport };
}
