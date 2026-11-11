import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ref = 'ufexjnqkppmcpjstabob';
const url = process.env.STAGING_SUPABASE_URL;
const key = process.env.STAGING_SERVICE_ROLE_KEY;
const publicKey = process.env.STAGING_PUBLIC_KEY;
const base = new URL(process.env.STAGING_PREVIEW_URL || 'https://invalid.example');
assert.equal(url, `https://${ref}.supabase.co`, 'Refusing to run outside the isolated staging project');
assert.match(base.hostname, /^afrigate-(?!git-main-)[a-z0-9-]+-africa-maarifa\.vercel\.app$/);
assert.equal(base.protocol, 'https:');
assert.ok(key && publicKey, 'Staging credentials required');
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const accounts = [];
const run = randomUUID();
async function checked(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
async function request(path, token, options = {}) {
  const response = await fetch(new URL(path, base), {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  assert.match(response.headers.get('content-type') || '', /application\/json/, 'Expected API JSON, not login/build HTML');
  return { status: response.status, data: await response.json() };
}
async function makeAccount(role) {
  const password = randomBytes(32).toString('base64url');
  const email = `${role}-${run}-${accounts.length}@example.invalid`;
  const { user } = await checked(await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Staging smoke ${role}` } }));
  accounts.push({ id: user.id });
  const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const session = await checked(await client.auth.signInWithPassword({ email, password }));
  const token = session.session.access_token;
  const first = await request('/api/account?action=me', token);
  assert.equal(first.status, 200);
  assert.equal(first.data.role, 'customer', 'New users must default to customer');
  if (role !== 'customer') await checked(await db.from('profiles').update({ role }).eq('id', user.id));
  const profile = await request('/api/account?action=me', token);
  assert.equal(profile.data.role, role);
  return { id: user.id, token };
}
try {
  // Both public and privileged data paths must target the same staging database.
  const services = await request('/api/public?action=services');
  assert.equal(services.status, 200);
  assert.ok(services.data.length >= 4);
  assert.equal((await request('/api/account?action=me')).status, 401);
  const customer = await makeAccount('customer');
  const other = await makeAccount('customer');
  const consultant = await makeAccount('consultant');
  const admin = await makeAccount('admin');
  assert.equal((await request('/api/admin?action=users', customer.token)).status, 403);
  assert.equal((await request('/api/admin?action=users', consultant.token)).status, 403);
  assert.equal((await request('/api/admin?action=users', admin.token)).status, 200);
  const created = await request('/api/consultations?action=create', customer.token, {
    method: 'POST', body: JSON.stringify({ service_id: services.data[0].id, subject: `Staging smoke ${run}`, description: 'Synthetic staging-only consultation for automated authorization checks.' }),
  });
  assert.ok(created.status === 200 || created.status === 201);
  const rows = await checked(await db.from('consultations').select('id').eq('customer_id', customer.id));
  assert.equal(rows.length, 1, 'Preview writes must land in staging, not production');
  const path = `/api/consultations?action=detail&id=${rows[0].id}`;
  assert.equal((await request(path, customer.token)).status, 200);
  assert.ok([403, 404].includes((await request(path, other.token)).status));
  assert.ok([403, 404].includes((await request(path, consultant.token)).status));
  await checked(await db.from('consultations').update({ consultant_id: consultant.id }).eq('id', rows[0].id));
  assert.equal((await request(path, consultant.token)).status, 200);
  assert.equal((await request(path, admin.token)).status, 200);
  console.log('PASS: staging login, customer default role, admin-only user management, consultation creation and ownership/assignment checks.');
} finally {
  // Delete only this run's synthetic records; never truncate/reset staging.
  const ids = accounts.map((a) => a.id);
  if (ids.length) {
    const rows = await checked(await db.from('consultations').select('id').in('customer_id', ids));
    const consultationIds = rows.map((r) => r.id);
    if (consultationIds.length) {
      for (const table of ['documents', 'appointments', 'messages', 'status_history']) {
        await checked(await db.from(table).delete().in('consultation_id', consultationIds));
      }
      await checked(await db.from('consultations').delete().in('id', consultationIds));
    }
    await checked(await db.from('notifications').delete().in('user_id', ids));
    await checked(await db.from('audit_logs').delete().in('actor_id', ids));
    await checked(await db.from('profiles').delete().in('id', ids));
    for (const account of accounts) await checked(await db.auth.admin.deleteUser(account.id));
    console.log('Synthetic records and temporary accounts cleaned up.');
  }
}
