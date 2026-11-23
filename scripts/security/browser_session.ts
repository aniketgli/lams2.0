/**
 * Sign-in / sign-out in a real browser (Chrome on the CI runner), with two tabs of one browser sharing the cookie:
 * the situation in which users were bounced from the lobby back to "signed out after 15 minutes of inactivity".
 *
 * Only for the throw-away CI server (.github/workflows/security.yml), after seed.ts:
 *     npm i --prefix /tmp/pw playwright-core && PLAYWRIGHT_CORE=/tmp/pw/node_modules/playwright-core bun scripts/security/browser_session.ts
 * (installed outside the project so its node_modules stay untouched)
 * Exit code 1 when a check fails.
 */
import type { Page } from 'playwright-core';

const BASE = (process.env.SECURITY_TEST_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  console.error(`Refusing to run against ${BASE}: only a local test server is allowed.`);
  process.exit(2);
}
const PASSWORD = process.env.SECURITY_TEST_PASSWORD || 'Test@12345';
const EMAIL = 'admin@wii.gov.in';
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

let failed = 0;
function check(title: string, ok: boolean, detail = ''): void {
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${title}${detail ? ` — ${detail}` : ''}`);
}

const signedIn = async (page: Page) =>
  page.evaluate(async () => (await fetch('/api/auth/me', { headers: { Accept: 'application/json', 'x-wii-passive': '1' } })).status === 200);
const onLogin = async (page: Page) => (await page.locator('input[placeholder="Enter your email address"]').count()) > 0;

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.fill('input[placeholder="Enter your email address"]', EMAIL);
  await page.fill('input[placeholder="Enter your password"]', PASSWORD);
  await page.click('button[type="submit"]');
  try {
    await page.waitForFunction(() => !document.querySelector('input[placeholder="Enter your email address"]'), undefined, { timeout: 15000 });
  } catch {
    const alert = await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
    throw new Error(`sign-in did not leave the sign-in page: ${alert.join(' | ') || '(no message)'}`);
  }
}

async function main(): Promise<void> {
  const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext();
  const logs: string[] = [];
  const watch = (page: Page, name: string) => page.on('console', (m) => { if (/\[session\]/.test(m.text())) logs.push(`${name}: ${m.text()}`); });

  // 1. One tab: sign in and stay signed in.
  const a = await context.newPage(); watch(a, 'A');
  await signIn(a);
  await a.waitForTimeout(6000);
  check('One tab: signed in and still signed in after 6 s', !(await onLogin(a)) && await signedIn(a));

  // 2. A second tab of the same browser opens signed in; signing out in one signs out both.
  const b = await context.newPage(); watch(b, 'B');
  await b.goto(`${BASE}/`);
  await b.waitForTimeout(2000);
  check('Second tab opens signed in', !(await onLogin(b)));
  await a.evaluate(async () => {
    const me = await (await fetch('/api/auth/me', { headers: { Accept: 'application/json' } })).json();
    (window as any).__tag = me.sessionTag;
  });
  await a.getByRole('button', { name: /sign out/i }).first().click().catch(() => undefined);
  await a.waitForTimeout(3000);
  check('Signing out in one tab signs out the other', await onLogin(a) && await onLogin(b));

  // 3. Sign in again in tab B: tab A follows, neither bounces back.
  await signIn(b);
  await b.waitForTimeout(6000);
  check('Signing in again: no bounce back to the sign-in page', !(await onLogin(b)) && await signedIn(b), await onLogin(b) ? await b.locator('[role="alert"]').innerText().catch(() => '') : '');
  check('…and the other tab follows the new sign-in', !(await onLogin(a)));

  // 4. A tab still running an older version of the app (no sign-in tag) says "signed out for inactivity" and
  //    sends an untagged sign-out: the current sign-in must survive in every tab.
  await a.evaluate(async () => {
    new BroadcastChannel('wii-session').postMessage({ type: 'signed-out', message: 'You were signed out after 15 minutes of inactivity.' });
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{}' });
  });
  await b.waitForTimeout(3000);
  check('An old tab\'s untagged "signed out" does not end the current sign-in', !(await onLogin(b)) && await signedIn(b));

  // 5. Forgot password screen on the sign-in page.
  const c = await (await browser.newContext()).newPage();
  await c.goto(`${BASE}/login`);
  await c.getByRole('button', { name: /reset it with a code/i }).click();
  await c.fill('input[placeholder="Enter your email address"]', 'staff@wii.gov.in');
  await c.getByRole('button', { name: /send code/i }).click();
  const sent = await c.getByText(/a 6-digit code has been sent/i).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false);
  const codeBox = await c.locator('input[placeholder="6-digit code"]').count();
  const shown = sent && codeBox === 1 ? '' : (await c.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
  check('Forgot password: the link opens the form, a code is requested, the code step follows', sent && codeBox === 1, shown);
  await c.getByRole('button', { name: /back to sign in/i }).click();
  check('…and "Back to sign in" returns to the sign-in form', await onLogin(c));

  // 6. PMS: its administrator opens the Employees page (shared with HRMS) from the PMS sidebar.
  const d = await (await browser.newContext()).newPage();
  const errors: string[] = [];
  d.on('pageerror', (e) => errors.push(e.message));
  await d.goto(`${BASE}/login`);
  await d.fill('input[placeholder="Enter your email address"]', 'pmsadmin@wii.gov.in');
  await d.fill('input[placeholder="Enter your password"]', PASSWORD);
  await d.click('button[type="submit"]');
  await d.waitForFunction(() => !document.querySelector('input[placeholder="Enter your email address"]'), undefined, { timeout: 15000 }).catch(() => undefined);
  await d.evaluate(async () => {
    const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    await post('/api/access/module', { moduleId: 'pms' });
    await post('/api/access/active-role', { moduleId: 'pms', role: 'Administrator' });
  });
  await d.goto(`${BASE}/pms/employees`);
  const header = await d.getByText('Employee Profiles & Directory').first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true, () => false);
  const newButton = await d.getByRole('button', { name: /new employee/i }).count();
  const sidebar = await d.getByRole('button', { name: /^projects$/i }).count();
  const roleName = await d.getByText('PMS Administrator').count();
  check('PMS: the Employees page opens with "New employee", the PMS sidebar and the PMS role name',
    header && newButton > 0 && sidebar > 0 && roleName > 0 && errors.length === 0 && d.url().endsWith('/pms/employees'),
    header ? `button ${newButton}, sidebar ${sidebar}, role ${roleName}, errors ${errors.join(' | ')}, url ${d.url()}` : (await d.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300));
  if (process.env.SCREENSHOT_DIR) await d.screenshot({ path: `${process.env.SCREENSHOT_DIR}/pms-employees.png`, fullPage: true }).catch(() => undefined);

  if (logs.length) console.log(`\nSession messages in the browser:\n  ${logs.join('\n  ')}`);
  await browser.close();
  console.log(`\n${failed ? `${failed} check(s) failed.` : 'Browser sign-in works.'}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
