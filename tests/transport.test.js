import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-only.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-not-a-real-key';
const { createTransportHandler } = await import('../api/transport.js');
const { HttpError } = await import('../api/_lib/util.js');

function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(data) { this.data = data; } };
}

test('transport is gated server-side, rejects anonymous calls, and binds the verified actor', async () => {
  const req = { method: 'POST', query: { action: 'create_request' }, headers: {}, body: { p_actor: 'untrusted' } };
  const disabled = response();
  await createTransportHandler({ enabled: () => false })(req, disabled);
  assert.equal(disabled.code, 404);
  const anonymous = response();
  await createTransportHandler({ enabled: () => true })(req, anonymous);
  assert.equal(anonymous.code, 401);

  const id = randomUUID();
  const verified = response();
  const handler = createTransportHandler({ enabled: () => true, authenticate: async () => ({ profile: { id } }),
    client: { async rpc(name, args) {
      assert.equal(name, 'transport_write');
      assert.equal(args.p_actor, id);
      assert.equal(args.p_action, 'create_request');
      return { data: { id }, error: null };
    } },
  });
  await handler(req, verified);
  assert.equal(verified.code, 200);
  assert.match(verified.headers['Cache-Control'], /no-store/);
  const invalid = response();
  await handler({ ...req, method: 'GET' }, invalid);
  assert.equal(invalid.code, 404);
});

test('transport API and Postgres marketplace: directory, privacy, quote versions, and booking', async t => {
  // In-memory Postgres executes the actual migrations. Only Supabase Auth and
  // the HTTP-to-RPC adapter are replaced; no staging/production calls happen.
  const db = new PGlite();
  t.after(async () => { await db.close(); });
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create schema storage; create table storage.buckets (id text, name text, public boolean, file_size_limit integer, allowed_mime_types text[]);`);
  for (const file of ['20261110070922_initial_schema.sql', '20261118090000_transport_marketplace.sql']) {
    await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  const users = new Map();
  async function member(label, role = 'customer', verified = true) {
    const id = randomUUID(), email = `${label}@example.invalid`;
    await db.query('insert into auth.users values ($1, $2, $3)', [id, email, verified ? new Date().toISOString() : null]);
    await db.query('insert into profiles (id,email,full_name,role) values ($1,$2,$3,$4)', [id, email, label, role]);
    const profile = { id, email, role };
    users.set(label, profile);
    return profile;
  }
  const admin = await member('admin', 'admin');
  const buyer = await member('buyer');
  const other = await member('other');
  const carrierA = await member('carrier-a');
  const carrierB = await member('carrier-b');
  const unverified = await member('unverified', 'customer', false);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from transport_quotes'), { code: '42501' });
  await assert.rejects(db.query('select transport_read($1,$2,$3)', [buyer.id, 'directory', '{}']), { code: '42501' });
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from transport_providers'), { code: '42501' });
  await assert.rejects(db.query('select transport_write($1,$2,$3)', [buyer.id, 'create_request', '{}']), { code: '42501' });
  await db.exec('set role service_role');
  await assert.rejects(db.query('select * from transport_bookings'), { code: '42501' });

  const handler = createTransportHandler({ enabled: () => true,
    authenticate: async req => {
      const profile = users.get(req.headers.authorization);
      if (!profile) throw new HttpError(401, 'Sign in first.');
      return { profile };
    },
    client: { async rpc(name, { p_actor, p_action, p_input }) {
      try {
        const { rows } = await db.query(`select ${name}($1,$2,$3) as data`, [p_actor, p_action, JSON.stringify(p_input)]);
        return { data: rows[0].data };
      } catch (error) {
        if (!['PT400','PT403','PT404','PT409','23514','22P02'].includes(error.code)) t.diagnostic(`${error.code}: ${error.message}\n${error.where}`);
        return { error };
      }
    } },
  });
  async function call(action, actor, values = {}, method = 'GET', expected = 200) {
    const res = response();
    await handler({ method, headers: { authorization: actor.email.split('@')[0] },
      query: { action, ...(method === 'GET' ? values : {}) }, body: method === 'POST' ? values : undefined }, res);
    assert.equal(res.code, expected, `${action}: ${JSON.stringify(res.data)}`);
    return res.data;
  }
  const write = (action, actor, values, expected) => call(action, actor, values, 'POST', expected);
  const read = (action, actor, values, expected) => call(action, actor, values, 'GET', expected);
  const pendingProvider = name => write('save_provider', admin, { name, description: 'Synthetic test carrier', base_city: 'Dar es Salaam',
    booking_email: 'bookings@example.invalid', container_types: ['20_dry', '40_dry'], lanes: [
      { service_type: 'local', origin: 'Dar es Salaam', destination: 'Kibaha' },
      { service_type: 'transit', origin: 'Dar es Salaam', destination: 'Lusaka' },
    ] });

  const a = await pendingProvider('Anchor Carrier');
  const b = await pendingProvider('Bay Carrier');
  await pendingProvider('Unlisted Carrier');
  await write('set_provider_status', admin, { provider_id: a.id, status: 'approved' }, 409);
  await write('add_member', admin, { provider_id: a.id, email: unverified.email }, 404);
  await write('add_member', buyer, { provider_id: a.id, email: buyer.email }, 403);
  for (const [provider, employee] of [[a, carrierA], [b, carrierB]]) {
    await write('add_member', admin, { provider_id: provider.id, email: employee.email });
    assert.equal((await read('access', employee)).provider, false);
    await write('set_provider_status', admin, { provider_id: provider.id, status: 'approved' });
    assert.equal((await read('access', employee)).provider, true);
  }
  const staffView = await read('provider', admin, { id: a.id });
  assert.equal(staffView.members[0].email, carrierA.email);
  await read('provider', carrierA, { id: a.id }, 403);
  const directory = await read('directory', buyer, { origin: 'dar', destination: 'lusaka', service: 'transit', container: '40_dry' });
  assert.deepEqual(directory.items.map(p => p.id), [a.id,b.id]);
  assert.ok(directory.items.every(p => !Object.hasOwn(p, 'booking_email')));
  assert.deepEqual((await read('directory', buyer, { service: 'local', destination: 'Lusaka' })).items, []);
  assert.deepEqual((await read('directory', buyer, { ids: b.id })).items.map(p => p.id), [b.id]);

  const futureDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const reqForm = { submit_key: randomUUID(), provider_ids: [a.id,b.id], origin: 'Dar es Salaam', destination: 'Kibaha',
    service_type: 'local', pickup_date: futureDate, container_count: 2, container_type: '40_dry', currency: 'TZS', requirements: 'Test move' };
  await write('create_request', carrierA, reqForm, 409);
  const request = await write('create_request', buyer, reqForm);
  assert.equal((await write('create_request', buyer, reqForm)).id, request.id);
  await read('request', other, { id: request.id }, 404);
  await read('opportunity', other, { id: request.id, provider_id: a.id }, 404);
  await read('opportunity', carrierA, { id: request.id, provider_id: b.id }, 404);
  assert.equal((await read('inbox', carrierA)).items[0].state, 'needs_quote');
  assert.equal((await read('inbox', other)).items.length, 0);

  const offer = { request_id: request.id, base_amount: '1000.99', taxes: '40.15', extra_charges: '30.10',
    available_on: futureDate, valid_for_hours: 48, terms: 'Test inclusion and exclusions' };
  await write('submit_quote', carrierB, { ...offer, provider_id: a.id }, 404);
  await write('submit_quote', carrierA, { ...offer, base_amount: '5.999', provider_id: a.id }, 400);
  await write('submit_quote', carrierA, { ...offer, provider_id: a.id });
  await write('submit_quote', carrierB, { ...offer, base_amount: '1550', provider_id: b.id });
  const currentOffers = await read('request', buyer, { id: request.id });
  assert.equal(currentOffers.offers[0].quote.total, 1071.24);
  assert.equal((await read('requests', buyer)).items[0].quote_count, 2);
  const quoteOne = currentOffers.offers[0].quote.id;
  const quoteB = currentOffers.offers[1].quote.id;
  const privateView = await read('opportunity', carrierA, { id: request.id, provider_id: a.id });
  assert.equal(privateView.quote.id, quoteOne);
  assert.equal(privateView.booking, null);
  assert.ok(!JSON.stringify(privateView).includes(quoteB));
  assert.ok(!JSON.stringify(privateView).includes(buyer.email));
  await write('submit_quote', carrierA, { ...offer, base_amount: '975', provider_id: a.id, quote_id: quoteOne });
  const quoteA = (await read('opportunity', carrierA, { id: request.id, provider_id: a.id })).quote.id;
  await write('select_quote', buyer, { request_id: request.id, quote_id: quoteOne }, 409);
  await write('select_quote', other, { request_id: request.id, quote_id: quoteA }, 404);

  const picked = await write('select_quote', buyer, { request_id: request.id, quote_id: quoteA });
  assert.equal(picked.status, 'awaiting_confirmation');
  assert.equal((await read('request', buyer, { id: request.id })).booking, null);
  await write('select_quote', buyer, { request_id: request.id, quote_id: quoteB }, 409);
  await write('confirm', carrierB, { request_id: request.id, provider_id: b.id, quote_id: quoteB }, 409);
  await write('decline', carrierA, { request_id: request.id, provider_id: a.id, quote_id: quoteA });
  assert.equal((await read('request', buyer, { id: request.id })).request.status, 'open');
  await write('select_quote', buyer, { request_id: request.id, quote_id: quoteA }, 409);
  await write('select_quote', buyer, { request_id: request.id, quote_id: quoteB });

  // Force the confirmation deadline into the past to exercise the lazy expiry.
  await db.exec('reset role');
  await db.query("update transport_requests set confirmation_due_at = now() - interval '1 minute' where id=$1", [request.id]);
  await db.exec('set role service_role');
  assert.equal((await read('request', buyer, { id: request.id })).request.status, 'open');
  await write('confirm', carrierB, { request_id: request.id, provider_id: b.id, quote_id: quoteB }, 409);
  await write('select_quote', buyer, { request_id: request.id, quote_id: quoteB });
  await write('release_quote', buyer, { request_id: request.id, quote_id: quoteB });
  await write('select_quote', buyer, { request_id: request.id, quote_id: quoteB });
  const confirmed = await write('confirm', carrierB, { request_id: request.id, provider_id: b.id, quote_id: quoteB });
  assert.equal(confirmed.status, 'booked');
  await write('confirm', carrierB, { request_id: request.id, provider_id: b.id, quote_id: quoteB });
  await write('close_request', buyer, { request_id: request.id }, 409);
  const booking = (await read('request', buyer, { id: request.id })).booking;
  assert.match(booking.reference, /^TB-/);
  assert.equal(booking.provider_email, 'bookings@example.invalid');
  assert.equal((await read('opportunity', carrierB, { id: request.id, provider_id: b.id })).booking.customer_email, buyer.email);
  assert.equal((await read('opportunity', carrierA, { id: request.id, provider_id: a.id })).booking, null);

  const secondRequest = await write('create_request', buyer, { ...reqForm, submit_key: randomUUID(), provider_ids: [a.id] });
  await write('submit_quote', carrierA, { ...offer, request_id: secondRequest.id, provider_id: a.id });
  const expiring = (await read('request', buyer, { id: secondRequest.id })).offers[0].quote.id;
  await db.exec('reset role');
  await db.query("update transport_quotes set valid_until = now() - interval '1 minute' where id=$1", [expiring]);
  await db.exec('set role service_role');
  assert.equal((await read('request', buyer, { id: secondRequest.id })).offers[0].quote.valid, false);
  await write('select_quote', buyer, { request_id: secondRequest.id, quote_id: expiring }, 409);
  await write('close_request', buyer, { request_id: secondRequest.id });
  await write('submit_quote', carrierA, { ...offer, request_id: secondRequest.id, provider_id: a.id, quote_id: expiring }, 409);

  await write('set_provider_status', admin, { provider_id: b.id, status: 'suspended' });
  assert.equal((await read('access', carrierB)).provider, false);
  await read('opportunity', carrierB, { id: request.id, provider_id: b.id }, 404);
  assert.equal((await read('request', buyer, { id: request.id })).booking.reference, booking.reference);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int as n from transport_bookings')).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from audit_logs where action='transport.confirm'")).rows[0].n, 1);
});
