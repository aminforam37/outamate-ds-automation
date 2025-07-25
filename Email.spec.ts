import { test, expect } from '@playwright/test';
import { sendMail } from '../mail';

let srNo = 1;
let testResults: {srNo: any, module: any, status: any, URL: any }[] = [];
 
test ('Sendemail', async ({ page }) => {
     test.setTimeout(80000);

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

  await page.waitForTimeout(1000); 
 
    let status = 'Fail';
 
    if (page.url().includes('https://dev-outamateds.outamationlabs.com/')) {
        status = 'Pass';  
        console.log('Success - Login Successful');
        testResults.push({
            srNo: '1',
            module: 'Login',
            status: 'Pass',
            URL: '<a href="https://dev-outamateds.outamationlabs.com/">Login</a>'
        });
    } else {
        console.log('Login failed');
        testResults.push({
            srNo: '1',
            module: 'Login',
            status: 'Fail',
            URL: '<a href="https://dev-outamateds.outamationlabs.com/">Login</a>'
        });
    }
   

    await page.waitForURL('**/app/internal/dashboard/order-status', { timeout: 10000 });
    if (page.url().includes('/app/internal/dashboard/order-status')) {
        status = 'Pass';  
        console.log('Dashboard Loaded');
        testResults.push({
            srNo: '2',
            module: 'Dashboard',
            status: 'Pass',
            URL: '<a href="https://dev-outamateds.outamationlabs.com/app/internal/dashboard/order-status">Dashboard</a>'
        });
    } else {
        console.log('Dashboard failed');
        testResults.push({
            srNo: '2',
            module: 'Dashboard',
            status: 'Fail',
            URL: '<a href="https://dev-outamateds.outamationlabs.com/app/internal/dashboard/order-status">Dashboard</a>'
        });
    }
 


    




 await sendMail(testResults);



 
});
 