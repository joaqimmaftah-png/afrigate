import assert from 'node:assert/strict';

const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const heading = (page, name) => page.getByRole('heading', { name, exact: true });
const text = (page, value) => page.getByText(value, { exact: true });
const inDays = days => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function submit(page, preview, path, method, status, click) {
  const [response] = await Promise.all([
    page.waitForResponse(response => response.url() === `${preview}${path}` && response.request().method() === method),
    click.click(),
  ]);
  assert.equal(response.status(), status);
  return response.json();
}

export async function checkStagingAppointment({ preview, go, buyer, staff, consultation, request, other, phase }) {
  phase('requesting an appointment from the consultation');
  await go(buyer, `/portal/requests/${consultation.id}`);
  await button(buyer, 'Book').click();
  const form = buyer.getByRole('dialog', { name: 'Book a consultation appointment' });
  const date = inDays(3);
  await form.getByLabel('Date', { exact: true }).fill(date);
  await form.getByLabel('Time (EAT)').fill('10:00');
  await form.getByLabel('Meeting method').selectOption('Phone call');
  const path = '/api/appointments';
  const appointment = await submit(buyer, preview, path, 'POST', 201, button(form, 'Request appointment'));
  assert.equal(appointment.consultation_id, consultation.id);
  assert.equal(appointment.status, 'Requested');
  assert.equal(new Date(appointment.scheduled_at).toISOString(), `${date}T07:00:00.000Z`);
  phase('checking that an unrelated client cannot see the appointment');
  const outside = await request(path, other.token);
  assert.equal(outside.status, 200);
  assert.ok(!outside.data.some(item => item.id === appointment.id), 'Other clients must not see the appointment');

  phase('confirming the appointment as the assigned consultant');
  await go(staff, '/staff/appointments');
  const staffCard = staff.locator('.card').filter({ has: staff.getByRole('link', { name: consultation.reference, exact: true }) });
  await button(staffCard, 'Confirm').click();
  const dialog = staff.getByRole('dialog', { name: 'Confirm appointment' });
  const confirmed = await submit(staff, preview, path, 'PUT', 200, button(dialog, 'Confirm appointment'));
  assert.equal(confirmed.id, appointment.id);
  assert.equal(confirmed.status, 'Confirmed');
  await go(buyer, '/portal/appointments');
  const buyerCard = buyer.locator('.card').filter({ has: buyer.getByRole('link', { name: consultation.reference, exact: true }) });
  await text(buyerCard, 'Confirmed').waitFor();
  console.log('PASS: deployed appointment request, visibility to assigned staff, confirmation and client privacy.');
}

// Deliberate, one-off staging run. The service role cannot delete transport
// records by design; remove fixtures via an operator's scoped SQL afterwards.
export async function checkStagingBooking({ run, preview, go, login, request, buyer, customer, other, admin, carriers, phase }) {
  const transport = (action, query = {}) => `/api/transport?${new URLSearchParams({ action, ...query })}`;
  const read = async (action, account, query, status = 200) => {
    const response = await request(transport(action, query), account.token);
    assert.equal(response.status, status, `Staging ${action}`);
    return response.data;
  };
  const write = async (action, account, data, status = 200) => {
    const response = await request(transport(action), account.token, { method: 'POST', body: JSON.stringify(data) });
    assert.equal(response.status, status, `Staging ${action}`);
    return response.data;
  };
  const origin = 'Dar es Salaam';
  const destination = 'Kibaha';
  const pickup = inDays(5);
  const providers = [];
  phase('creating two synthetic carriers through the deployed admin API');
  assert.equal((await read('providers', admin, { q: run })).items.length, 0, 'Use a new run identifier');
  for (const [index, suffix] of ['a', 'b'].entries()) {
    const name = `Staging Carrier ${suffix.toUpperCase()} ${run}`;
    const email = `booking-${suffix}-${run}@example.invalid`;
    const { id } = await write('save_provider', admin, {
      name, base_city: origin, description: 'Synthetic staging smoke carrier', booking_email: email,
      container_types: ['40_dry'], lanes: [{ service_type: 'local', origin, destination }],
    });
    const account = carriers[index];
    await write('add_member', admin, { provider_id: id, email: account.email });
    await write('set_provider_status', admin, { provider_id: id, status: 'approved' });
    providers.push({ id, name, email, account, terms: `Staging offer from carrier ${suffix.toUpperCase()}`, amount: index === 0 ? '750' : '950' });
  }
  const [winner, loser] = providers;

  phase('sending a two-carrier quote request from the desktop directory');
  const route = '/portal/transport';
  await go(buyer, `${route}?q=${run}&service=local`);
  await text(buyer, '2 on this page').waitFor();
  for (const provider of providers) {
    assert.equal(await buyer.getByText(provider.email, { exact: true }).count(), 0, 'Directory must hide booking contact');
    await button(buyer, `Shortlist ${provider.name}`).click();
    await buyer.waitForURL(url => url.searchParams.get('ids')?.split(',').includes(provider.id));
  }
  await buyer.getByRole('link', { name: 'Request quotes' }).click();
  await buyer.getByLabel('Pickup area').fill(origin);
  await buyer.getByLabel('Destination area').fill(destination);
  await buyer.getByLabel('Preferred pickup date').fill(pickup);
  const rfq = await submit(buyer, preview, transport('create_request'), 'POST', 200, button(buyer, 'Send quote request'));
  const buyerPath = `${route}/requests/${rfq.id}`;
  await buyer.waitForURL(`${preview}${buyerPath}`);
  const id = rfq.id;
  const readBuyer = () => read('request', customer, { id });
  const opportunity = (provider) => read('opportunity', provider.account, { id, provider_id: provider.id });
  const { request: job } = await readBuyer();
  await read('request', other, { id }, 404);

  phase('receiving two independent itemized offers and checking pre-booking privacy');
  for (const provider of providers) {
    const carrier = await login(provider.account, '/provider/inbox', { width: 1360, height: 900 });
    await carrier.getByRole('link', { name: new RegExp(job.reference) }).click();
    await carrier.getByLabel('Transport price (TZS)').fill(provider.amount);
    await carrier.getByLabel('Taxes (TZS)').fill('80');
    await carrier.getByLabel('Extra charges (TZS)').fill('20');
    await carrier.getByLabel('Inclusions and terms').fill(provider.terms);
    await submit(carrier, preview, transport('submit_quote'), 'POST', 200, button(carrier, 'Send offer'));
    await heading(carrier, 'Your latest offer').waitFor();
    provider.page = carrier;
    provider.path = `/provider/inbox/${provider.id}/${id}`;
  }
  const quoted = await readBuyer();
  assert.equal(quoted.offers.length, 2);
  const quote = provider => quoted.offers.find(offer => offer.provider_id === provider.id).quote;
  assert.equal(quote(winner).total, 850);
  assert.equal(quote(loser).total, 1050);
  for (const [provider, competitor] of [[winner, loser], [loser, winner]]) {
    const offer = await opportunity(provider);
    assert.equal(offer.quote.id, quote(provider).id);
    assert.equal(offer.booking, null);
    const publicView = JSON.stringify(offer);
    assert.ok(!publicView.includes(quote(competitor).id) && !publicView.includes(customer.email), 'Provider must not see competing offers or client contacts');
  }

  phase('selecting and confirming the booking as the selected carrier');
  await go(buyer, buyerPath);
  await text(buyer, winner.terms).waitFor();
  await text(buyer, loser.terms).waitFor();
  await button(buyer, `Select offer from ${winner.name}`).click();
  const selection = buyer.getByRole('dialog', { name: 'Select this offer?' });
  await submit(buyer, preview, transport('select_quote'), 'POST', 200, button(selection, 'Select offer'));
  const selected = await readBuyer();
  assert.equal(selected.request.status, 'awaiting_confirmation');
  assert.equal(selected.booking, null);
  const confirmDetails = provider => ({ request_id: id, provider_id: provider.id, quote_id: quote(provider).id });
  await write('confirm', loser.account, confirmDetails(loser), 409);
  await go(winner.page, winner.path);
  await button(winner.page, 'Confirm booking').click();
  const confirmation = winner.page.getByRole('dialog', { name: 'Confirm this booking?' });
  await submit(winner.page, preview, transport('confirm'), 'POST', 200, button(confirmation, 'Confirm booking'));
  await heading(winner.page, 'Booking confirmed').waitFor();
  await winner.page.getByRole('link', { name: customer.email, exact: true }).waitFor();
  const booked = await readBuyer();
  assert.equal(booked.request.status, 'booked');
  assert.equal(booked.booking.provider_email, winner.email);
  assert.match(booked.booking.reference, /^TB-/);
  await write('confirm', winner.account, confirmDetails(winner));
  assert.equal((await readBuyer()).booking.reference, booked.booking.reference);
  await go(buyer, buyerPath);
  await heading(buyer, 'Booking confirmed').waitFor();
  await buyer.getByRole('link', { name: winner.email, exact: true }).waitFor();
  await go(loser.page, loser.path);
  await loser.page.getByText('This invitation is not accepting replies.', { exact: false }).waitFor();
  const closed = await opportunity(loser);
  assert.equal(closed.booking, null);
  assert.ok(!JSON.stringify(closed).includes(customer.email));
  assert.equal(await heading(loser.page, 'Booking confirmed').count(), 0);
  console.log('PASS: deployed two-carrier request, itemized quotes, private comparison, selection, confirmation and idempotent booking.');
}
