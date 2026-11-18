import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Opt in only on a trusted Vercel Preview branch. The script also checks the
// environment and pins both backend URLs before creating any fixture accounts.
test('staging build: real Auth, PostgREST, and consultation handlers', {
  skip: process.env.AFRIGATE_VERIFY_STAGING !== 'true',
}, async () => {
  const script = fileURLToPath(new URL('../scripts/staging-smoke.mjs', import.meta.url));
  const child = spawn(process.execPath, [script, '--vercel-build'], { stdio: 'inherit', timeout: 180_000 });
  const [code, signal] = await once(child, 'exit');
  assert.equal(signal, null, 'Staging smoke did not finish');
  assert.equal(code, 0, 'Staging smoke failed');
});
