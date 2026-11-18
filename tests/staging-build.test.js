import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { stagingPreviewOrigin } from '../scripts/staging-browser.mjs';

test('staging browser accepts only an immutable AfriGate HTTPS origin', () => {
  const preview = 'https://afrigate-aplmdwbil-africa-maarifa.vercel.app';
  assert.equal(stagingPreviewOrigin(preview), preview);
  for (const url of [
    'http://afrigate-aplmdwbil-africa-maarifa.vercel.app', 'https://afrigate-one.vercel.app',
    'https://afrigate-git-main-africa-maarifa.vercel.app', 'https://example.invalid',
    `${preview}/portal`, `${preview}?redirect=1`, preview.replace('https://', 'https://someuser@'),
  ]) assert.throws(() => stagingPreviewOrigin(url));
});

// Opt in only on a trusted Vercel Preview branch. The script also checks the
// environment and pins both backend URLs before creating any fixture accounts.
test('staging build: real Auth, PostgREST, and consultation handlers', {
  skip: process.env.AFRIGATE_VERIFY_STAGING !== 'true',
}, async () => {
  const script = fileURLToPath(new URL('../scripts/staging-smoke.mjs', import.meta.url));
  const timeout = process.env.AFRIGATE_STAGING_BROWSER_URL ? 300_000 : 180_000;
  const child = spawn(process.execPath, [script, '--vercel-build'], { stdio: 'inherit', timeout });
  const [code, signal] = await once(child, 'exit');
  assert.equal(signal, null, 'Staging smoke did not finish');
  assert.equal(code, 0, 'Staging smoke failed');
});
