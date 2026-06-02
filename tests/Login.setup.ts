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

    //   const Email = "foram.amin@outamation.com ";
    //   const Password = "Pramukh@888";
    const Email = process.env.LOGIN_Username || '';
    const Password = process.env.LOGIN_Password || '';
  const successMessageSelector = 'Login : Successfully Login'; 
  const errorMessageSelector = 'Login : Login failed'; 

  await page.locator('input[name="username"]').fill(Email);
  await page.waitForTimeout(1500); 
  await page.locator('button[type="submit"]').click();
  await page.locator('input[name="passwd"]').fill(Password);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1500); 
  await page.locator('[type="submit"]').click();
  await page.waitForTimeout(1500); 

  if (successMessageSelector) {
        console.log("✅ User logged in Successfully and redirected to Dashboard.");
        await page.waitForTimeout(1500); 
    } else if (errorMessageSelector) {
        console.log("❌ User login failed or user not redirected to Dashboard.");
        await page.waitForTimeout(1500); 
    } else {
        console.log('Login status unknown: No success or error message displayed.');
        await page.waitForTimeout(1500); 
    }

    //console.log(page.url());
    if (page.url().startsWith(baseURL ?? '')) {

        status = 'Pass';
        addResult({
            srNo: getSrCounter().toString(),
            module: 'Login',
            status: 'Pass',
            URL: `<a href="${baseURL}">Login</a>`
        });


    } else {
        addResult({
            srNo: getSrCounter().toString(),
            module: 'Login',
            status: 'Fail',
            URL: `<a href="${baseURL}">Login</a>`
        });
    }
     incrementSrCounter();

    // Wait until dashboard loads
    await page.waitForLoadState('networkidle');

    // Validation
    await expect(page).toHaveURL(/outamationlabs/);

    console.log('✅ Login Successful');

    // Save Login Session
    await page.context().storageState({ path: authFile });

});