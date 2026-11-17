import { test as setup, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { addResult, getResults,  getSrCounter, incrementSrCounter } from '../resultsCollector'; 
import { sendMail } from '../mail';


let status = 'Fail';
let isPassed = true;
const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page ,baseURL}) => {

await page.goto(baseURL ??  '/');
  await page.waitForTimeout(1500);  

  console.log("\x1b[1mLogin:\x1b[0m");
  console.log("🔐 Starting Login Module Tests...");

    
    const Email = process.env.LOGIN_Username || '';
    const Password = process.env.LOGIN_Password || '';

  if (!Email || !Password) {
    throw new Error(
      'LOGIN_Username / LOGIN_Password are not set in .env — cannot authenticate.'
    );
  }

  const appHost = new URL(baseURL ?? page.url()).host;
  // The sign-in redirect lands on bare "/app" before the app routes onward.
  const onApp = (url: URL) => url.host === appHost && /^\/app(\/|$)/.test(url.pathname);

  await page.locator('input[name="username"]').fill(Email);
  await page.locator('button[type="submit"]').click();

  // Wait for the password page itself rather than a fixed pause.
  const passwd = page.locator('input[name="passwd"]');
  await passwd.waitFor({ state: 'visible', timeout: 60_000 });
  await passwd.fill(Password);
  await page.locator('[type="submit"]').click();

  // "Stay signed in?" may or may not be shown. Clicking a fixed submit after 1.5s raced
  // the page load on a slow sign-in and left the app on a blank page, so wait for
  // either that prompt or the app itself before acting.
  const staySignedIn = page.locator('#idSIButton9, input[type="submit"][value="Yes"]');
  await Promise.any([
    staySignedIn.waitFor({ state: 'visible', timeout: 60_000 }),
    page.waitForURL(onApp, { timeout: 60_000 }),
  ]).catch(() => { });
  if (!onApp(new URL(page.url())) && await staySignedIn.isVisible().catch(() => false)) {
    await staySignedIn.click();
  }

  // Real post-login signal: the dashboard module tiles only render once
  // authentication has actually succeeded. The previous check tested a non-empty
  // string literal (`if (successMessageSelector)`), so it was always true and
  // reported "logged in successfully" even on a failed login.
  // The app may also skip the module tiles and reopen the last-used module directly
  // (and the side menu can be collapsed in a headed window), so landing on any /app/
  // page of the application host counts as success too.
  let loggedIn = true;
  try {
    await Promise.any([
      page.locator('h6.module-title').first().waitFor({ state: 'visible', timeout: 60_000 }),
      page.waitForURL(onApp, { timeout: 60_000 }),
    ]);

    // Reaching /app is not enough: it can sit blank while the app finishes signing in,
    // and saving the session then gives later specs an unusable user.json. Wait for the
    // app shell (module tiles or the side menu's Logout — attached, since the menu can
    // be collapsed); if /app stays blank, open a dashboard directly.
    const shell = page.locator('h6.module-title').or(page.getByText('Logout', { exact: true })).first();
    const shellUp = () => shell.waitFor({ state: 'attached', timeout: 30_000 }).then(() => true).catch(() => false);
    if (!await shellUp()) {
      await page.goto('/app/internal/research/dashboard/order-status', { waitUntil: 'domcontentloaded' });
      if (!await shellUp()) throw new Error('app shell never loaded');
    }
    console.log("✅ User logged in Successfully and redirected to Dashboard.");
  } catch {
    loggedIn = false;
    console.log("❌ User login failed or user not redirected to Dashboard.");
    console.log(`   stuck on: ${page.url()}`);
  }

    status = loggedIn ? 'Pass' : 'Fail';
    addResult({
        srNo: getSrCounter().toString(),
        module: 'Login',
        status,
        URL: `<a href="${baseURL}">Login</a>`
    });
     incrementSrCounter();

    // Fail the setup project outright on a bad login. Previously this only
    // asserted the hostname, which the login page itself satisfies — so a wrong
    // password still saved a useless user.json and left every downstream spec
    // failing on unrelated locator errors.
    expect(loggedIn, 'dashboard module tiles visible after login').toBe(true);

    console.log('✅ Login Successful');

    // Save Login Session
    await page.context().storageState({ path: authFile });

});