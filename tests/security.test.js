import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-not-a-real-key';
const { getAuth, requireRole, handleError, clean } = await import('../api/_lib/util.js');

test('unauthenticated requests are denied before database access', async () => {
  await assert.rejects(getAuth({ headers: {} }), { status: 401 });
});
test('customers and consultants cannot pass admin checks', () => {
  for (const role of ['customer', 'consultant']) {
    assert.throws(() => requireRole({ role }, ['admin']), { status: 403 });
  }
  assert.doesNotThrow(() => requireRole({ role: 'admin' }, ['admin']));
});
test('server errors do not return database details', () => {
  const res = { status(n) { this.code = n; return this; }, json(body) { this.body = body; } };
  handleError(res, new Error('private database information'));
  assert.equal(res.code, 500);
  assert.ok(!res.body.error.includes('private'));
  handleError(res, { status: 403, message: 'Forbidden' });
  assert.equal(res.body.error, 'Forbidden');
});
test('input cleaning trims and bounds strings', () => {
  assert.equal(clean('  abcdef  ', 3), 'abc');
  assert.equal(clean(null), '');
});
test('production HTML contains no recording or picker scripts', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('rrweb'));
  assert.ok(!html.includes('data-element-picker'));
  assert.ok(html.includes('/src/main.tsx'));
});
