import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { STAGING_RECEIPT_PATH, stagingBuildContext } from './staging-preview.mjs';

const receipt = new URL(`../dist${STAGING_RECEIPT_PATH}`, import.meta.url);
await rm(receipt, { force: true });
const context = stagingBuildContext();
if (context) {
  const script = fileURLToPath(new URL('./staging-smoke.mjs', import.meta.url));
  const timeout = process.env.AFRIGATE_STAGING_BROWSER_URL ? 300_000 : 180_000;
  // The smoke must not activate the old database wake integration.
  const env = { ...process.env, FULLSTACK_PROJECT_REF: '', FULLSTACK_RESTORE_API_URL: '' };
  const child = spawn(process.execPath, [script, '--vercel-build'], { env, stdio: 'inherit', timeout });
  const [code, signal] = await once(child, 'exit');
  assert.equal(signal, null, 'Staging smoke did not finish');
  assert.equal(code, 0, 'Staging smoke failed');
  await writeFile(receipt, `${JSON.stringify({ ...context, result: 'passed' })}\n`, { flag: 'wx' });
  console.log('Staging authorization checks passed; this Preview carries the build result.');
}
