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

  await page.locator('input[name="username"]').fill(Email);
  await page.waitForTimeout(1500); 
  await page.locator('button[type="submit"]').click();
  await page.locator('input[name="passwd"]').fill(Password);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1500); 
  await page.locator('[type="submit"]').click();
  await page.waitForTimeout(1500); 

  // Real post-login signal: the dashboard module tiles only render once
  // authentication has actually succeeded. The previous check tested a non-empty
  // string literal (`if (successMessageSelector)`), so it was always true and
  // reported "logged in successfully" even on a failed login.
  let loggedIn = true;
  try {
    await page.locator('h6.module-title').first().waitFor({ state: 'visible', timeout: 30_000 });
    console.log("✅ User logged in Successfully and redirected to Dashboard.");
  } catch {
    loggedIn = false;
    console.log("❌ User login failed or user not redirected to Dashboard.");
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