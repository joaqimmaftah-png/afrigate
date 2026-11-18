import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { checkStagingAppointment, checkStagingBooking } from './staging-journeys.mjs';

const exec = promisify(execFile);

export function stagingPreviewOrigin(value) {
  const target = new URL(value);
  assert.equal(target.protocol, 'https:', 'Expected an HTTPS preview URL');
  assert.match(target.hostname, /^afrigate-[a-z0-9]+-africa-maarifa\.vercel\.app$/, 'Use an immutable AfriGate Preview URL');
  assert.ok(!target.username && !target.password && !target.port && !target.search && !target.hash && target.pathname === '/',
    'Use only the immutable Preview origin');
  return target.origin;
}

// Called only by the guarded Preview build smoke. No browser tooling is
// installed in the app itself or launched for routine CI/Production builds.
export async function checkStagingBrowser({ preview, staging, customer, other, consultant, admin, consultation, request, booking }) {
  const probe = await fetch(`${preview}/api/transport?action=access`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  assert.equal(probe.status, 401, 'Expected an enabled transport API requiring login on the Preview');
  assert.match(probe.headers.get('content-type') || '', /application\/json/, 'Expected the AfriGate API, not a deployment login page');
  const deps = await mkdtemp(join(tmpdir(), 'afrigate-browser-'));
  const oldTmp = process.env.TMPDIR;
  let browser;
  let phase = 'installing browser test tooling';
  // The package installer and browser never need the staging service key.
  const childEnv = { PATH: process.env.PATH, HOME: deps, TMPDIR: deps, CI: '1' };
  try {
    await exec('npm', ['install', '--prefix', deps, '--no-save', '--no-package-lock', '--ignore-scripts', '--no-audit', '--no-fund',
      '--registry=https://registry.npmjs.org', '--fetch-retries=0', '--fetch-timeout=40000',
      'playwright-core@1.65.1', '@sparticuz/chromium@153.0.0'], { cwd: deps, env: childEnv, timeout: 90000 });
    const require = createRequire(join(deps, 'package.json'));
    const { chromium } = require('playwright-core');
    phase = 'launching Chromium';
    process.env.TMPDIR = deps;
    const { default: packaged, inflate } = await import(pathToFileURL(require.resolve('@sparticuz/chromium')).href);
    const executablePath = await packaged.executablePath();
    const libs = await inflate(join(deps, 'node_modules', '@sparticuz', 'chromium', 'bin', 'al2023.tar.br'));
    browser = await chromium.launch({
      executablePath, headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      env: { ...childEnv, LD_LIBRARY_PATH: join(libs, 'lib') },
    });
    const go = (page, path) => page.goto(`${preview}${path}`, { waitUntil: 'domcontentloaded' });
    const directory = page => page.getByRole('heading', { name: 'Find a transport provider', exact: true });
    const login = async (account, path, viewport) => {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block', timezoneId: 'Africa/Dar_es_Salaam' });
      // Never submit credentials to a different project, even on a misconfigured build.
      await context.route('**/*', route => [preview, staging].includes(new URL(route.request().url()).origin)
        ? route.continue() : route.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await go(page, path);
      await page.waitForURL(url => url.origin === preview && url.pathname === '/login' && url.searchParams.get('next') === path);
      await page.getByLabel('Email address').fill(account.email);
      await page.getByLabel('Password', { exact: true }).fill(account.password);
      await Promise.all([
        page.waitForResponse(response => response.url().startsWith(`${staging}/auth/v1/token?`) && response.status() === 200),
        page.getByRole('button', { name: 'Sign in', exact: true }).click(),
      ]);
      await page.waitForURL(`${preview}${path}`);
      return page;
    };

    phase = 'checking desktop client sign-in and private consultation access';
    const desktop = await login(customer, '/portal/transport', { width: 1360, height: 900 });
    await directory(desktop).waitFor();
    await desktop.getByText(/\d+ on this page/).waitFor();
    await go(desktop, `/portal/requests/${consultation.id}`);
    await desktop.getByRole('heading', { name: consultation.subject, exact: true }).waitFor();
    await go(desktop, '/provider/inbox');
    await desktop.getByText('Provider workspace access required', { exact: true }).waitFor();

    phase = 'checking mobile directory filters, private access and sign-out';
    const mobile = await login(other, '/portal/transport', { width: 390, height: 844 });
    await directory(mobile).waitFor();
    await mobile.getByText(/\d+ on this page/).waitFor();
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile directory must fit the viewport');
    await mobile.getByRole('button', { name: 'Search & filters' }).click();
    await mobile.getByLabel('Service type').selectOption('transit');
    await mobile.getByRole('button', { name: 'Search', exact: true }).click();
    await mobile.waitForURL(url => url.searchParams.get('service') === 'transit');
    await mobile.getByText(/\d+ on this page/).waitFor();
    await go(mobile, `/portal/requests/${consultation.id}`);
    await mobile.getByText('You do not have access to this consultation.', { exact: true }).waitFor();
    await mobile.getByRole('button', { name: 'Open menu' }).click();
    await mobile.getByRole('button', { name: 'Sign out', exact: true }).click();
    await mobile.waitForURL(`${preview}/`);
    await go(mobile, '/portal/transport');
    await mobile.waitForURL(url => url.pathname === '/login');
    await mobile.context().close();

    phase = 'checking assigned consultant and provider administration pages';
    const staff = await login(consultant, `/staff/consultations/${consultation.id}`, { width: 1360, height: 900 });
    await staff.getByRole('heading', { name: consultation.subject, exact: true }).waitFor();
    phase = 'requesting and confirming a consultation appointment';
    await checkStagingAppointment({ preview, go, buyer: desktop, staff, consultation, request, other });
    await staff.context().close();
    phase = 'checking provider administration';
    const management = await login(admin, '/staff/transport-providers', { width: 1360, height: 900 });
    await management.getByRole('heading', { name: 'Transport providers', exact: true }).waitFor();
    await management.getByRole('link', { name: 'Add provider', exact: true }).waitFor();
    await management.context().close();
    console.log('PASS: deployed staging browser — desktop/mobile login, directory filter, provider gate, consultation privacy/assignment, admin page and logout.');
    if (booking) {
      booking.begin();
      await checkStagingBooking({ ...booking, preview, go, login, request, buyer: desktop, customer, other, admin,
        phase: next => { phase = next; } });
    }
  } catch {
    // Playwright errors may include values typed into the login form.
    throw new Error(`Staging browser check failed while ${phase}.`);
  } finally {
    try {
      if (browser) await browser.close();
    } finally {
      if (oldTmp === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = oldTmp;
      await rm(deps, { recursive: true, force: true });
    }
  }
}
