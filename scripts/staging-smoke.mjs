import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const stagingUrl = 'https://ufexjnqkppmcpjstabob.supabase.co';
const inBuild = process.argv.includes('--vercel-build');
const url = inBuild ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.STAGING_SUPABASE_URL;
const key = inBuild ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.STAGING_SERVICE_ROLE_KEY;
const publicKey = inBuild ? process.env.VITE_SUPABASE_ANON_KEY : process.env.STAGING_PUBLIC_KEY;
const base = new URL(inBuild ? 'https://staging-build.invalid' : process.env.STAGING_PREVIEW_URL || 'https://invalid.example');
assert.equal(url, stagingUrl, 'Refusing to run outside the isolated staging project');
if (inBuild) {
  assert.equal(process.env.VERCEL_ENV, 'preview', 'Refusing to run outside a Vercel preview');
  assert.equal(process.env.VITE_SUPABASE_URL, stagingUrl, 'Preview browser must use the same staging project');
  assert.equal(process.env.VITE_TRANSPORT_ENABLED, 'true', 'Preview client transport flag required');
  assert.equal(process.env.TRANSPORT_ENABLED, 'true', 'Preview server transport flag required');
} else {
  assert.match(base.hostname, /^afrigate-(?!git-main-)[a-z0-9-]+-africa-maarifa\.vercel\.app$/);
  assert.equal(base.protocol, 'https:');
}
assert.ok(key && publicKey, 'Staging credentials required');
const handlers = inBuild ? new Map(await Promise.all(['public', 'account', 'admin', 'consultations', 'transport'].map(async name => [
  `/api/${name}`, (await import(`../api/${name}.js`)).default,
]))) : null;
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const accounts = [];
const run = randomUUID();
async function checked(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
async function request(path, token, options = {}) {
  const target = new URL(path, base);
  if (handlers) {
    const handler = handlers.get(target.pathname);
    assert.ok(handler, `No build smoke handler for ${target.pathname}`);
    let result;
    await handler({
      method: options.method || 'GET',
      query: Object.fromEntries(target.searchParams),
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: options.body,
    }, {
      code: 200,
      setHeader() {},
      status(code) { this.code = code; return this; },
      json(data) { result = { status: this.code, data }; },
    });
    assert.ok(result, 'Expected a JSON response from the handler');
    return result;
  }
  const response = await fetch(target, {
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
  return { id: user.id, token, email };
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
  const track = email => request('/api/public?action=track', null, {
    method: 'POST', body: JSON.stringify({ reference: created.data.reference, email }),
  });
  assert.equal((await track(customer.email)).status, 200);
  assert.equal((await track(other.email)).status, 404);
  console.log('PASS: staging password login, default customer role, admin-only management, consultation ownership/assignment and public lookup.');
  if (inBuild) {
    assert.equal((await request('/api/transport?action=directory')).status, 401);
    const directory = await request('/api/transport?action=directory', customer.token);
    assert.equal(directory.status, 200);
    assert.ok(Array.isArray(directory.data.items));
    const access = await request('/api/transport?action=access', customer.token);
    assert.equal(access.status, 200);
    assert.equal(access.data.provider, false);
    assert.equal((await request('/api/transport?action=providers', customer.token)).status, 403);
    assert.equal((await request('/api/transport?action=providers', admin.token)).status, 200);
    const invalid = await request('/api/transport?action=create_request', customer.token, { method: 'POST', body: '{}' });
    assert.equal(invalid.status, 400, 'PostgREST must return the transport write validation error');
    console.log('PASS: transport handlers reach the staging read/write RPCs through real Auth and PostgREST.');
  }
} finally {
  // Delete only this run's synthetic records; never truncate/reset staging.
  const ids = accounts.map((a) => a.id);
  if (ids.length) {
    const rows = await checked(await db.from('consultations').select('id').in('customer_id', ids));
    const consultationIds = rows.map((r) => r.id);
    if (consultationIds.length) {
      const links = consultationIds.flatMap(id => [`/portal/requests/${id}`, `/staff/consultations/${id}`]);
      await checked(await db.from('notifications').delete().in('link', links));
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
