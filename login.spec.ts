import { test, expect } from '@playwright/test';




test('Login', async ({ page }) => {
  test.setTimeout(80000);
  try{

  await page.goto('https://dev-outamateds.outamationlabs.com/');
  await page.waitForTimeout(1500);  

  const Email = "foram.amin@outamation.com";
  const Password = "Outamation@1234";
  const successMessageSelector = 'Login : Successfully Login'; 
  const errorMessageSelector = 'Login : Login failed'; 

  await page.locator('[type="email"]').fill(Email);
  await page.waitForTimeout(1500); 
  await page.locator('[type="submit"]').click();
  await page.locator('[name="passwd"]').fill(Password);
  await page.locator('[type="submit"]').click();
  await page.waitForTimeout(1500); 
  await page.locator('[type="submit"]').click();
  //await page.waitForTimeout(5000); 
  console.log('Login Successfully');
  await page.waitForTimeout(3000); 
  
 if (successMessageSelector) {
        console.log('Success - Login Successful');
    } else if (errorMessageSelector) {
        console.log('Login : Login failed');
    } else {
        console.log('Login status unknown: No success or error message displayed.');
    }

await expect(page.locator('[class="mat-mdc-card-header-text"]').nth(0)).toBeVisible();
await expect(page.locator('[class="mat-mdc-card-header-text"]').nth(1)).toBeVisible();
await page.waitForTimeout(1500);
  

const orderstatus = page.locator('[class="mat-mdc-card-header-text"]').nth(0);
const orderperday = page.locator('[class="mat-mdc-card-header-text"]').nth(1);

  if (await orderstatus.isVisible() && await orderperday.isVisible()) {
    console.log(' Dashboard data loaded successfully');
  } else {
    console.log('Dashboard data has not been loaded');
  } 
 }catch (error) {
    console.error(' Dashboard throws an error:', error.message);
  }




  

});