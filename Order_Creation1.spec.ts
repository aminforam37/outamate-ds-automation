import { test, expect } from '@playwright/test';
import { sendMail } from '../mail';

const path = require('path');

let srNo = 1;
let testResults: {srNo: any, module: any, status: any, URL: any }[] = [];
let status = 'Fail';

test.beforeEach('Login', async ({ page }) => {
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
  await page.waitForTimeout(1500); 
  //await page.pause();
  
 if (successMessageSelector) {
        console.log('Success - Login Successful');
        await page.waitForTimeout(1500); 
    } else if (errorMessageSelector) {
        console.log('Login : Login failed');
        await page.waitForTimeout(1500); 
    } else {
        console.log('Login status unknown: No success or error message displayed.');
        await page.waitForTimeout(1500); 
    }

   if (page.url().includes('https://dev-outamateds.outamationlabs.com/')) {
        status = 'Pass';  
       // console.log('Success - Login Successful');
        testResults.push({
            srNo: '1',
            module: 'Login',
            status: 'Pass',
             URL: '<a href="https://dev-outamateds.outamationlabs.com/">Login</a>'
        });
    } else {
        //console.log('Login failed');
        testResults.push({
            srNo: '1',
            module: 'Login',
            status: 'Fail',
           URL: '<a href="https://dev-outamateds.outamationlabs.com/">Login</a>'
        });
    }



});

test('Order Creation', async ({ page }) => {

  test.setTimeout(180000);

//await page.goto('https://dev-outamateds.outamationlabs.com/app/internal/dashboard/order-status');
await page.waitForTimeout(1500);  

//   const Email = "foram.amin@outamation.com";
//   const Password = "Outamation@1234";
//   const successMessageSelector = 'Login : Successfully Login'; 
//   const errorMessageSelector = 'Login : Login failed'; 

//   await page.locator('[type="email"]').fill(Email);
//   await page.waitForTimeout(1500); 
//   await page.locator('[type="submit"]').click();
//   await page.locator('[name="passwd"]').fill(Password);
//   await page.locator('[type="submit"]').click();
//   await page.waitForTimeout(1500); 
//   await page.locator('[type="submit"]').click();
//   //await page.waitForTimeout(5000); 
//   console.log('Login Successfully');
//   await page.waitForTimeout(1500); 
//   //await page.pause();
  
//  if (successMessageSelector) {
//         console.log('Success - Login Successful');
//     } else if (errorMessageSelector) {
//         console.log('Login : Login failed');
//     } else {
//         console.log('Login status unknown: No success or error message displayed.');
//     }

     try {
      await page.waitForURL('**/app/internal/dashboard/order-status', { timeout: 10000 });
    
      const orderstatus = page.locator('[class="mat-mdc-card-header-text"]').nth(0);
      const orderperday = page.locator('[class="mat-mdc-card-header-text"]').nth(1);
    
      if (
        page.url().includes('/app/internal/dashboard/order-status') &&
        await orderstatus.isVisible() &&
        await orderperday.isVisible()
      ) {
        //console.log('✅ Dashboard loaded successfully and all expected data is displayed.');
        status = 'Pass';
        testResults.push({
          srNo: '2',
          module: 'Dashboard',
          status: 'Pass',
           URL: '<a href="https://dev-outamateds.outamationlabs.com/app/internal/dashboard/order-status">Dashboard</a>'
        });
      } else {
       // console.log('❌ Dashboard failed to load or required data elements are missing.');
        status = 'Fail';
        testResults.push({
          srNo: '2',
          module: 'Dashboard',
          status: 'Fail',
           URL: '<a href="https://dev-outamateds.outamationlabs.com/app/internal/dashboard/order-status">Dashboard</a>'
        });
      }
    
    } catch (error) {
       console.error('❌ Failed to load Dashboard: Timeout or unexpected navigation.');
        console.error(`ℹ️ Error Details: ${error.message}`);
      status = 'Fail';
      testResults.push({
        srNo: '2',
        module: 'Dashboard',
        status: 'Fail',
         URL: '<a href="https://dev-outamateds.outamationlabs.com/app/internal/dashboard/order-status">Dashboard</a>'
      });
    }


//     //Order Entry
//     await page.locator('span[class="mat-content ng-tns-c2622717266-6"]').click();
//     await page.waitForTimeout(1000); 
//     //Create Order
//     await page.locator('span[_ngcontent-ng-c1025041153]').nth(10).click();
//     await page.waitForTimeout(1000); 

//     //Customer
//     await page.locator('[aria-haspopup="listbox"]').nth(0).click();
//     await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
//     await page.waitForTimeout(1500);
//     const CustomerName = await page.locator('mat-select[formcontrolname="client"] > div').innerText();
    

//     //Divison
//     await page.locator('[aria-haspopup="listbox"]').nth(1).click();
//     await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
//     await page.waitForTimeout(1500);
//     const Divison = await page.locator('mat-form-field input[ng-reflect-name="division"]').inputValue();
    

//     //Lender Name
//     await page.locator('input[formcontrolname="lenderName"]').fill("NA");
//     const lenderName = await page.locator('mat-form-field input[formcontrolname="lenderName"]').inputValue();
   

//     //Order Type
//     await page.locator('[aria-haspopup="listbox"]').nth(2).click();
//     await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
//     await page.waitForTimeout(1500);
    

//     //Product Type
//      await page.locator('[aria-haspopup="listbox"]').nth(3).click();
//     await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
//     await page.waitForTimeout(1500);
//     const ProductType = await page.locator('mat-select[formcontrolname="product"] > div').innerText();
    

//     // Sub-Product Type
//     await page.locator('[aria-haspopup="listbox"]').nth(4).click();
//     await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
//     await page.waitForTimeout(1500);

//     //Customer Order
//     const CustomerOrder = 'ODS-091120';
    
//     await page.locator('input[formcontrolname="customerNumber"]').fill(CustomerOrder);
//     await page.waitForTimeout(1500);
    

//     //Parcel Number
//     await page.locator('input[formcontrolname="parcelNumber"]').fill("89444");
//     await page.waitForTimeout(1500);

//     //Address Line1
//     const AddressLine1 = '27 Jody Road';
//     await page.locator('input[formcontrolname="line1"]').fill(AddressLine1);
//     await page.waitForTimeout(1500);

//     //ZipCode
//     const Zipcode =  '99501';
//     await page.locator('input[formcontrolname="zip"]').fill(Zipcode);
//     await page.waitForTimeout(1500);

//     //City
//     const City = 'Atlanta';
//     await page.locator('input[formcontrolname="city"]').fill(City);
//     await page.waitForTimeout(1000);

//     //State
//     await page.locator('[aria-haspopup="listbox"]').nth(5).click();
//     //await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
//     await page.waitForTimeout(1000);
//     const State = await page.locator('mat-select[formcontrolname="state"] > div').innerText();
    

//     //County
//     await page.locator('[aria-haspopup="listbox"]').nth(6).click();
//     await page.waitForTimeout(1000);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(4).click();
//     await page.waitForTimeout(1000);
//     const County = await page.locator('mat-select[formcontrolname="county"] > div').innerText();
    


//     //First Name
//     const firstName = 'Grace  ';
//     await page.locator('input[formcontrolname="firstName"]').nth(0).fill(firstName);
    

//     //Middle Name
//     const middleName = 'W';
//     await page.locator('input[formcontrolname="middleName"]').nth(0).fill(middleName);
    

//     //Last Name
//     const lastName = 'Carlos';
//     await page.locator('input[formcontrolname="lastName"]').nth(0).fill(lastName);
   
 
//     //Loan Number
//     const LoanNumber = '8777';
//     await page.locator('input[id="LoanNumber"]').fill(LoanNumber);
//     await page.waitForTimeout(1000);

//     //Consideration Number
//     const ConsiderationNumber = '900.25';
//     await page.locator('input[formcontrolname="considerationAmount"]').fill(ConsiderationNumber);
//     await page.waitForTimeout(1000);

//     //Instrument Date
//     await page.locator('button[aria-label="Open calendar"]').nth(0).click();
//     await page.waitForTimeout(1500);
//     await page.locator('.mat-calendar-body-today').click();
//     await page.waitForTimeout(1000);
//     const InstrumentDate = await page.locator('mat-form-field input[formcontrolname="instrumentDate"]').inputValue();
   


//     //Special Instruction
//     await page.locator('textarea[formcontrolname="specialInstructions"]').fill("All documents needed");
//     await page.waitForTimeout(1000);

//     //attachments
//     const filePath = 'C:/DS_playwright-test/Documents/CIC Visily Screens.pdf';
//     await page.setInputFiles('input[type="file"]', filePath);
//     await page.waitForTimeout(1000);


//     // Create
//     await page.locator('button[type="submit"]').nth(1).click();
//     await page.waitForTimeout(1000);

//     // Fetch the toast message text
//     const toastMessage = await page.locator("div[class='toast-container success-toast']").innerText();
//     console.log("Toast Message: ", toastMessage); 


// await page.waitForURL('https://dev-outamateds.outamationlabs.com/app/internal/orders/new', { timeout: 10000 });
//     if (page.url().includes('https://dev-outamateds.outamationlabs.com/app/internal/orders/new')) {
//         status = 'Pass';  
//         console.log('Order Creation Pass');
//         testResults.push({
//             srNo: '2',
//             module: 'Order Creation',
//             status: 'Pass',
//             path: 'Order Creation'
//         });
//     } else {
//         console.log('Order Creation Failed');
//         testResults.push({
//             srNo: '2',
//             module: 'Order Creation',
//             status: 'Fail',
//             path: 'Order Creation'
//         });
//     }




    


//});



//test('Keying', async ({ page }) => {

  //  //Order Entry
  //   await page.locator('span[class="mat-content ng-tns-c2622717266-6"]').click();
  //   await page.waitForTimeout(1000); 
  //   //All Orders
  //   await page.locator('span[_ngcontent-ng-c1025041153]').nth(11).click();
  //   await page.waitForTimeout(1000); 

  //   //Customer Order
  //   await page.locator('input[aria-label="Customer Order # Filter Input"]').fill("ODS-091120");
  //   await page.waitForTimeout(1000); 
  //   //Order Opened
  //   await page.locator('div[class="ag-pinned-left-cols-container"]').click();
  //   await page.waitForTimeout(1500); 


  const searchInput = page.locator('input[formcontrolname="orderId"]');
await searchInput.waitFor({ state: 'visible' });
await page.waitForTimeout(1500);
// 2. Click to focus and clear any value
await searchInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(1500);
// 3. Use .fill() instead of deprecated .type()
await searchInput.fill('ODS-091120');
await page.waitForTimeout(1500);
// 4. Press Enter to submit the search
await searchInput.press('Enter');

//Order Opened
    await page.locator('div[class="ag-pinned-left-cols-container"]').click();
    await page.waitForTimeout(1500);


  //   //Search Details
  //   await page.locator('li[class="ng-star-inserted"]').nth(3).click();
  //   await page.waitForTimeout(1500); 
  //   //Searched From
  //   await page.locator('button[aria-label="Open calendar"]').nth(0).click();
  //   await page.waitForTimeout(1000);
  //   await page.locator('.mat-calendar-body-today').click();
  //   await page.waitForTimeout(1000);

  //   //Searched Through
  //   await page.locator('button[aria-label="Open calendar"]').nth(1).click();
  //   await page.waitForTimeout(1000);
  //   await page.locator('.mat-calendar-body-today').click();
  //   await page.waitForTimeout(1000);

  //   //Marketable
  //   await page.locator('input[class="mdc-radio__native-control"]').nth(0).click();
  //   await page.waitForTimeout(1000);
  //  await page.locator('button[type="submit"]').nth(1).click();   //Save
  //   await page.waitForTimeout(1500);

  //   //Toast message text for Search Details
  //   const toastMessage1 = await page.locator("div[class='toast-container success-toast']").innerText();
  //   console.log("Toast Message: ", toastMessage1); 

  //   //Process Order
  //   await page.locator('button[mattooltip="Process Order"]').click();
  //   await page.waitForTimeout(1000); 

  //   //Process Order Dropdown
  //   await page.locator('button[aria-haspopup="menu"]').click();
  //   await page.waitForTimeout(1000); 

  //   //Selecting Keying in Progress
  //   await page.locator('span[class="mat-mdc-menu-item-text"]').nth(10).click();
  //   await page.waitForTimeout(1000); 

  const Orderprocessing = page.locator('li[class="ng-star-inserted"]', { hasText: ' Keying' });

try {
  await expect(Orderprocessing).toBeVisible();
  console.log('✅ Order successfully processed through Keying.');

  const keyingUrl = await page.url(); // Ensure you're using await here if needed

  console.log('🔗 Captured Keying URL:', keyingUrl); // Confirm it's not undefined

  const clickableLink = '<a href="' + keyingUrl + '" target="_blank">Keying Stage</a>';

  testResults.push({
    srNo: '3',
    module: 'Order Processing - Keying Stage',
    status: 'Pass',
    URL: clickableLink
  });

} catch (error) {
  console.error('❌ Order did not reach the "Keying" stage.');

  const failedUrl = await page.url();
  const clickableLink = '<a href="' + failedUrl + '" target="_blank">Keying Stage</a>';

  testResults.push({
    srNo: '3',
    module: 'Order Processing - Keying Stage',
    status: 'Fail',
    URL: clickableLink
  });
}

  await sendMail(testResults);


    // //Document
    // await page.locator('li[class="ng-star-inserted"]').nth(1).click();
    // await page.waitForTimeout(1000);  
    // await page.locator('span[class="mat-mdc-button-persistent-ripple mdc-button__ripple"]').nth(3).click(); //Add Doc
    // await page.waitForTimeout(1000); 
    // //attachments
    // // const filePath1 = 'C:/DS_playwright-test/Documents/CIC Visily Screens.pdf';
    // // await page.setInputFiles('input[type="file"]', filePath1);
    // // await page.waitForTimeout(1000);
    // const filePath1 = path.resolve('C:/DS_playwright-test/Documents/CIC Visily Screens.pdf');
    // const filePath2 = path.resolve('C:/DS_playwright-test/Documents/OutamateDS-Outamation Title Order creation API-160425-141552.pdf');

    // await page.setInputFiles('input[type="file"]', [filePath1,filePath2] );

  
    // await page.waitForTimeout(1000);

    // await page.locator('td:nth-child(2) > mat-form-field input').nth(0).fill("Doc1"); //Doc Name
    // await page.waitForTimeout(1000);
    // await page.locator('[aria-haspopup="listbox"]').nth(0).click(); //Doc Type
    // await page.waitForTimeout(1000);
    // await page.locator('[role="option"]').nth(1).click(); //Doc Type == Values
    // await page.waitForTimeout(1000);
   
    
    // await page.locator('td:nth-child(2) > mat-form-field input').nth(1).fill("Doc2");//Doc Name
    // await page.waitForTimeout(1000);
    // await page.locator('[aria-haspopup="listbox"]').nth(1).click(); //Doc Type
    // await page.waitForTimeout(1000);
    // await page.locator('[role="option"]').nth(2).click(); //Doc Type == Values
    // await page.waitForTimeout(1000);

    // // Upload attach
    // await page.locator('span[class="mat-mdc-button-persistent-ripple mdc-button__ripple"]').nth(7).click();
    // await page.waitForTimeout(1500);  


    // //Select Keying
    // await page.locator('li[class="ng-star-inserted"]').nth(4).click();
    // await page.waitForTimeout(1500);  


    // //Verification Title Order Data 

    // // const Grid_Client = await page.locator('div[col-id="client"]').nth(1).innerText();
    // // const Grid_CustomerOrder = await page.locator('div[col-id="customerNumber"]').nth(1).innerText();
    // // const Grid_Product = await page.locator('div[col-id="product"]').nth(1).innerText();
    // // const Grid_State = await page.locator('div[col-id="state"]').nth(1).innerText();
    // // const Grid_County = await page.locator('div[col-id="county"]').nth(1).innerText();

    // const Keying_Client = (await page.locator('#clientId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    // const Keying_LoanNumber =await page.$eval('#loan_Number', el => (el as HTMLInputElement).value);
    // const Keying_CustomerOrder = await page.$eval('#customerOrderNumber', el => (el as HTMLInputElement).value);
    // const Keying_Product = (await page.locator('#productTypeId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    // const Keying_State = (await page.locator('#address_State .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    // const Keying_County = (await page.locator('#countyId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    // const Keying_FirstName = await page.$eval('#borrower_FirstName', el => (el as HTMLInputElement).value);
    // const Keying_MiddleName = await page.$eval('#borrower_MiddleName', el => (el as HTMLInputElement).value);
    // const Keying_LastName = await page.$eval('#borrower_LastName', el => (el as HTMLInputElement).value);
    // const Keying_AddressLine1 = await page.$eval('#address_Line1', el => (el as HTMLInputElement).value);
    // const Keying_City = await page.$eval('#address_City', el => (el as HTMLInputElement).value);
    // const Keying_Zipcode = await page.$eval('#address_Zip', el => (el as HTMLInputElement).value);
    // const Keying_ConsiderationAmount = await page.$eval('#considerationAmount', el => (el as HTMLInputElement).value);
    // const Keying_instrumentDate = await page.$eval('#instrumentDate', el => (el as HTMLInputElement).value);

    // // console.log('CustomerName:', CustomerName, '| Keying_Client:', Keying_Client);
    // // console.log('LoanNumber:', LoanNumber, '| Keying_LoanNumber:', Keying_LoanNumber);
    // // console.log('CustomerOrder:', CustomerOrder, '| Keying_CustomerOrder:', Keying_CustomerOrder);
    // // console.log('ProductType:', ProductType, '| Keying_Product:', Keying_Product);
    // // console.log('State:', State, '| Keying_State:', Keying_State);
    // // console.log('County:', County, '| Keying_County:', Keying_County);
    // // console.log('FirstName:', firstName, '| Keying_FirstName:', Keying_FirstName);
    // // console.log('MiddleName:', middleName, '| Keying_MiddleName:', Keying_MiddleName);
    // // console.log('LastName:', lastName, '| Keying_LastName:', Keying_LastName);
    // // console.log('AddressLine1:', AddressLine1, '| Keying_AddressLine1:', Keying_AddressLine1);
    // // console.log('City:', City, '| Keying_City:', Keying_City);
    // // console.log('Zipcode:', Zipcode, '| Keying_Zipcode:', Keying_Zipcode);
    // // console.log('ConsiderationAmount:', ConsiderationNumber, '| Keying_ConsiderationAmount:', Keying_ConsiderationAmount);
    // // console.log('InstrumentDate:', InstrumentDate, '| Keying_instrumentDate:', Keying_instrumentDate);




    // if (
    //      CustomerName.trim() == Keying_Client.trim() &&
    //      LoanNumber.trim() == Keying_LoanNumber.trim() &&
    //      CustomerOrder.trim() == Keying_CustomerOrder.trim() &&
    //      ProductType.trim() == Keying_Product.trim() &&
    //      State.trim() == Keying_State.trim() &&
    //      County.trim() == Keying_County.trim() &&
    //      firstName.trim() == Keying_FirstName.trim() &&
    //      middleName.trim() == Keying_MiddleName.trim() &&
    //      lastName.trim() == Keying_LastName.trim() &&
    //      AddressLine1.trim() == Keying_AddressLine1.trim() &&
    //      City.trim() == Keying_City.trim() &&
    //      Zipcode.trim() == Keying_Zipcode.trim() &&
    //      ConsiderationNumber.trim() == Keying_ConsiderationAmount.trim()&&
    //      InstrumentDate.trim() == Keying_instrumentDate.trim()

        
    
    // ) {
    //     console.log(" Details Matched Successfully!");
    // } else {
    //     console.log(" Details do not match!");
    // }

});




// test.beforeEach('Login', async ({ page }) => {
//   await page.goto('https://dev-outamateds.outamationlabs.com/');
//   await page.waitForTimeout(1500);  

//   console.log("\x1b[1mLogin:\x1b[0m");
//   console.log("🔐 Starting Login Module Tests...");

//   const Email = "foram.amin@outamation.com";
//   const Password = "Outamation@1234";
//   const successMessageSelector = 'Login : Successfully Login'; 
//   const errorMessageSelector = 'Login : Login failed'; 

//   await page.locator('[type="email"]').fill(Email);
//   await page.waitForTimeout(1500); 
//   await page.locator('[type="submit"]').click();
//   await page.locator('[name="passwd"]').fill(Password);
//   await page.locator('[type="submit"]').click();
//   await page.waitForTimeout(1500); 
//   await page.locator('[type="submit"]').click();
//   await page.waitForTimeout(1500); 
 
  
//  if (successMessageSelector) {
//         console.log("✅ User logged in Successfully and redirected to Dashboard.");
//         await page.waitForTimeout(1500); 
//     } else if (errorMessageSelector) {
//         console.log("❌ User login failed or user not redirected to Dashboard.");
//         await page.waitForTimeout(1500); 
//     } else {
//         console.log('Login status unknown: No success or error message displayed.');
//         await page.waitForTimeout(1500); 
//     }
// if (page.url().includes('https://dev-outamateds.outamationlabs.com/')) {
//         status = 'Pass';  
//        // console.log('Success - Login Successful');
//         testResults.push({
//             srNo: '1',
//             module: 'Login',
//             status: 'Pass',
//              URL: '<a href="https://dev-outamateds.outamationlabs.com/">Login</a>'
//         });
//     } else {
//         //console.log('Login failed');
//         testResults.push({
//             srNo: '1',
//             module: 'Login',
//             status: 'Fail',
//            URL: '<a href="https://dev-outamateds.outamationlabs.com/">Login</a>'
//         });
//     }





// });


// test('Order Creation', async ({ page }) => {

//     test.setTimeout(180000);
//     //await page.waitForTimeout(1500); 

//     console.log("");
//     console.log("Dashboard:");

//      try {
//       await page.waitForURL('**/app/internal/dashboard/order-status', { timeout: 10000 });
    
//       const orderstatus = page.locator('[class="mat-mdc-card-header-text"]').nth(0);
//       const orderperday = page.locator('[class="mat-mdc-card-header-text"]').nth(1);
    
//       if (
//         page.url().includes('/app/internal/dashboard/order-status') &&
//         await orderstatus.isVisible() &&
//         await orderperday.isVisible()
//       ) {
//         //console.log('✅ Dashboard loaded successfully and all expected data is displayed.');
//         status = 'Pass';
//         testResults.push({
//           srNo: '2',
//           module: 'Dashboard',
//           status: 'Pass',
//            URL: '<a href="https://dev-outamateds.outamationlabs.com/app/internal/dashboard/order-status">Dashboard</a>'
//         });
//       } else {
//        // console.log('❌ Dashboard failed to load or required data elements are missing.');
//         status = 'Fail';
//         testResults.push({
//           srNo: '2',
//           module: 'Dashboard',
//           status: 'Fail',
//            URL: '<a href="https://dev-outamateds.outamationlabs.com/app/internal/dashboard/order-status">Dashboard</a>'
//         });
//       }
    
//     } catch (error) {
//        console.error('❌ Failed to load Dashboard: Timeout or unexpected navigation.');
//         console.error(`ℹ️ Error Details: ${error.message}`);
//       status = 'Fail';
//       testResults.push({
//         srNo: '2',
//         module: 'Dashboard',
//         status: 'Fail',
//          URL: '<a href="https://dev-outamateds.outamationlabs.com/app/internal/dashboard/order-status">Dashboard</a>'
//       });
//     }

//     // console.log("📊 Verifying dashboard count and charts...");
//     // console.log("──────── Dashboard Verification ────────");
//     // console.log("Sr No  | Metric            | Value");
//     // console.log("1      | Open              | 50");
//     // console.log("2      | Overdue           | 1266");
//     // console.log("3      | At Risk           | 9");
//     // console.log("4      | Hold              | 55");
//     // console.log("5      | Orders Per Day    | Chart visible");
//     // console.log("────────────────────────────────");

    
//     console.log("📊 Verifying dashboard count and charts...");
//     const tableWidth = 53;
//     const title = ' Dashboard Verification ';
//     const sidePadding = Math.floor((tableWidth - title.length) / 2);
//     const paddedTitle = '─'.repeat(sidePadding) + title + '─'.repeat(tableWidth - title.length - sidePadding);

//     console.log(paddedTitle);


//     const data = [
//         { "Sr No": 1, Metric: 'Open',            Value: 38 },
//         { "Sr No": 2, Metric: 'Overdue',         Value: 66 },
//         { "Sr No": 3, Metric: 'At Risk',         Value: 6 },
//         { "Sr No": 4, Metric: 'Hold',            Value: 13 },
//         { "Sr No": 5, Metric: 'Orders Per Day',  Value: 'Chart visible' }
//     ];

//     function pad(value, length) {
//         return String(value).padEnd(length, ' ');
//     }

//     const col1Width = 7;
//     const col2Width = 21;
//     const col3Width = 21;

//     console.log(`${pad("Sr No", col1Width)}| ${pad("Metric", col2Width)}| ${pad("Value", col3Width)}`);
//     console.log(`${'-'.repeat(col1Width)}|${'-'.repeat(col2Width + 1)}|${'-'.repeat(col3Width + 1)}`);

//     data.forEach(row => {
//         console.log(`${pad(row["Sr No"], col1Width)}| ${pad(row.Metric, col2Width)}| ${pad(row.Value, col3Width)}`);
//     });

//     console.log('─'.repeat(tableWidth));

//     const dashboardCheckPassed = true; 
//     if (dashboardCheckPassed) {
//         console.log("✅ All expected widgets and Charts are displayed correctly.");
//     } else {
//         console.log("❌ One or more expected widgets or charts are missing or not displayed correctly on the Dashboard.");
//     }


//     console.log("");
//     console.log("Order Creation:");
//     console.log("📝 Initiating new order creation flow...");
//     //Order Entry
//     await page.locator('span[class="mat-content ng-tns-c2622717266-6"]').click();
//     await page.waitForTimeout(1000); 
//     //Create Order
//     await page.locator('span[_ngcontent-ng-c1025041153]').nth(10).click();
//     await page.waitForTimeout(1000); 

//     //Customer
//     await page.locator('[aria-haspopup="listbox"]').nth(0).click();
//     await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
//     await page.waitForTimeout(1500);
//     const CustomerName = await page.locator('mat-select[formcontrolname="client"] > div').innerText();
    

//     //Divison
//     await page.locator('[aria-haspopup="listbox"]').nth(1).click();
//     await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
//     await page.waitForTimeout(1500);
//     const Divison = await page.locator('mat-form-field input[ng-reflect-name="division"]').inputValue();
    

//     //Lender Name
//     await page.locator('input[formcontrolname="lenderName"]').fill("NA");
//     const lenderName = await page.locator('mat-form-field input[formcontrolname="lenderName"]').inputValue();
   

//     //Order Type
//     await page.locator('[aria-haspopup="listbox"]').nth(2).click();
//     await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
//     await page.waitForTimeout(1500);
    

//     //Product Type
//      await page.locator('[aria-haspopup="listbox"]').nth(3).click();
//     await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
//     await page.waitForTimeout(1500);
//     const ProductType = await page.locator('mat-select[formcontrolname="product"] > div').innerText();
    

//     // Sub-Product Type
//     await page.locator('[aria-haspopup="listbox"]').nth(4).click();
//     await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
//     await page.waitForTimeout(1500);

//     //Customer Order
//     const CustomerOrder = 'ODS-07232504';
//     await page.locator('input[formcontrolname="customerNumber"]').fill(CustomerOrder);
//     await page.waitForTimeout(1500);
    

//     //Parcel Number
//     await page.locator('input[formcontrolname="parcelNumber"]').fill("5641425");
//     await page.waitForTimeout(1500);

//     //Address Line1
//     const AddressLine1 = '222 Still Pastures Drive';
//     await page.locator('input[formcontrolname="line1"]').fill(AddressLine1);
//     await page.waitForTimeout(1500);

//     //ZipCode
//     const Zipcode =  '99501';
//     await page.locator('input[formcontrolname="zip"]').fill(Zipcode);
//     await page.waitForTimeout(1500);

//     //City
//     const City = 'Columbia';
//     await page.locator('input[formcontrolname="city"]').fill(City);
//     await page.waitForTimeout(1000);

//     //State
//     await page.locator('[aria-haspopup="listbox"]').nth(5).click();
//     //await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
//     await page.waitForTimeout(1000);
//     const State = await page.locator('mat-select[formcontrolname="state"] > div').innerText();
    

//     //County
//     await page.locator('[aria-haspopup="listbox"]').nth(6).click();
//     await page.waitForTimeout(1000);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(4).click();
//     await page.waitForTimeout(1000);
//     const County = await page.locator('mat-select[formcontrolname="county"] > div').innerText();
    


//     //First Name
//     const firstName = 'Thomas';
//     await page.locator('input[formcontrolname="firstName"]').nth(0).fill(firstName);
    

//     //Middle Name
//     const middleName = 'A';
//     await page.locator('input[formcontrolname="middleName"]').nth(0).fill(middleName);
    

//     //Last Name
//     const lastName = 'Davis';
//     await page.locator('input[formcontrolname="lastName"]').nth(0).fill(lastName);
   
 
//     //Loan Number
//     const LoanNumber = '44474';
//     await page.locator('input[id="LoanNumber"]').fill(LoanNumber);
//     await page.waitForTimeout(1000);

//     //Consideration Number
//     const ConsiderationNumber = '650.25';
//     await page.locator('input[formcontrolname="considerationAmount"]').fill(ConsiderationNumber);
//     await page.waitForTimeout(1000);

//     //Instrument Date
//     await page.locator('button[aria-label="Open calendar"]').nth(0).click();
//     await page.waitForTimeout(1500);
//     await page.locator('.mat-calendar-body-today').click();
//     await page.waitForTimeout(1000);
//     const InstrumentDate = await page.locator('mat-form-field input[formcontrolname="instrumentDate"]').inputValue();
   


//     //Special Instruction
//     await page.locator('textarea[formcontrolname="specialInstructions"]').fill("All documents needed");
//     await page.waitForTimeout(1000);

//     //attachments
//     const filePath = 'C:/DS_playwright-test/Documents/CIC Visily Screens.pdf';
//     await page.setInputFiles('input[type="file"]', filePath);
//     await page.waitForTimeout(1000);


//     // Create
//     await page.locator('button[type="submit"]').nth(1).click();
//     await page.waitForTimeout(1000);

//     // Fetch the toast message text
//     const toastMessage_OrderCreated = await page.locator("div[class='toast-container success-toast']").innerText();
//     //console.log("Toast Message: ", toastMessage_OrderCreated); 

//     await page.waitForURL('https://dev-outamateds.outamationlabs.com/app/internal/orders/new', { timeout: 10000 });
//     if (page.url().includes('https://dev-outamateds.outamationlabs.com/app/internal/orders/new')) {
//         status = 'Pass';  
//        // console.log('Order Creation Pass');
//         testResults.push({
//             srNo: '2',
//             module: 'Order Creation',
//             status: 'Pass',
//              URL: '<a href="https://dev-outamateds.outamationlabs.com/app/internal/orders/new">Order Creation</a>'
//         });
//     } else {
//        // console.log('Order Creation Failed');
//         testResults.push({
//             srNo: '2',
//             module: 'Order Creation',
//             status: 'Fail',
//             URL: '<a href="https://dev-outamateds.outamationlabs.com/app/internal/orders/new">Order Creation</a>'
//         });
//     }


    

//       if (CustomerOrder) {
//       console.log(`✅ Order created successfully. Order ID: ${CustomerOrder}.`);
//     } else {
//       console.log("❌ Order creation failed. Order ID not generated or submission was unsuccessful.");
//     }


//     //Search Details
//     await page.locator('li[class="ng-star-inserted"]').nth(3).click();
//     await page.waitForTimeout(1500); 
//     //Searched From
//     await page.locator('button[aria-label="Open calendar"]').nth(0).click();
//     await page.waitForTimeout(1000);
//     await page.locator('.mat-calendar-body-today').click();
//     await page.waitForTimeout(1000);

//     //Searched Through
//     await page.locator('button[aria-label="Open calendar"]').nth(1).click();
//     await page.waitForTimeout(1000);
//     await page.locator('.mat-calendar-body-today').click();
//     await page.waitForTimeout(1000);

//     //Marketable
//     await page.locator('input[class="mdc-radio__native-control"]').nth(0).click();
//     await page.waitForTimeout(1000);
//    await page.locator('button[type="submit"]').nth(1).click();   //Save
//     await page.waitForTimeout(1500);

//     //Toast message text for Search Details
//     const toastMessage1 = await page.locator("div[class='toast-container success-toast']").innerText();
//     //console.log("Toast Message: ", toastMessage1); 

//     //Process Order
//     await page.locator('button[mattooltip="Process Order"]').click();
//     await page.waitForTimeout(1000); 

//     //Process Order Dropdown
//     await page.locator('button[aria-haspopup="menu"]').click();
//     await page.waitForTimeout(1000); 

//     //Selecting Keying in Progress
//     await page.locator('span[class="mat-mdc-menu-item-text"]').nth(10).click();
//     await page.waitForTimeout(1000); 


//     console.log("");
//     console.log("Order Processing:");
//     console.log("✅ Order successfully processed through Keying.");

//     //Document
//     await page.locator('li[class="ng-star-inserted"]').nth(1).click();
//     await page.waitForTimeout(1000);  
//     await page.locator('span[class="mat-mdc-button-persistent-ripple mdc-button__ripple"]').nth(3).click(); //Add Doc
//     await page.waitForTimeout(1000);

//     //attachments
//     const filePath1 = path.resolve('C:/DS_playwright-test/Documents/CIC Visily Screens.pdf');
//     const filePath2 = path.resolve('C:/DS_playwright-test/Documents/OutamateDS-Outamation Title Order creation API-160425-141552.pdf');
//     await page.setInputFiles('input[type="file"]', [filePath1,filePath2] );
//     await page.waitForTimeout(1000);

//     await page.locator('td:nth-child(2) > mat-form-field input').nth(0).fill("Doc1"); //Doc Name
//     await page.waitForTimeout(1000);
//     await page.locator('[aria-haspopup="listbox"]').nth(0).click(); //Doc Type
//     await page.waitForTimeout(1000);
//     await page.locator('[role="option"]').nth(1).click(); //Doc Type == Values
//     await page.waitForTimeout(1000);
   
    
//     await page.locator('td:nth-child(2) > mat-form-field input').nth(1).fill("Doc2");//Doc Name
//     await page.waitForTimeout(1000);
//     await page.locator('[aria-haspopup="listbox"]').nth(1).click(); //Doc Type
//     await page.waitForTimeout(1000);
//     await page.locator('[role="option"]').nth(2).click(); //Doc Type == Values
//     await page.waitForTimeout(1000);

//     // Upload attach
//     await page.locator('span[class="mat-mdc-button-persistent-ripple mdc-button__ripple"]').nth(7).click();
//     await page.waitForTimeout(1500);  


//     //Select Keying
//     await page.locator('li[class="ng-star-inserted"]').nth(4).click();
//     await page.waitForTimeout(1500);  

//     console.log("");
//     console.log("Order Details Verification:");
//     console.log("📦 Navigating to order details page...");

//     const Keying_Client = (await page.locator('#clientId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
//     const Keying_LoanNumber =await page.$eval('#loan_Number', el => (el as HTMLInputElement).value);
//     const Keying_CustomerOrder = await page.$eval('#customerOrderNumber', el => (el as HTMLInputElement).value);
//     const Keying_Product = (await page.locator('#productTypeId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
//     const Keying_State = (await page.locator('#address_State .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
//     const Keying_County = (await page.locator('#countyId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
//     const Keying_FirstName = await page.$eval('#borrower_FirstName', el => (el as HTMLInputElement).value);
//     const Keying_MiddleName = await page.$eval('#borrower_MiddleName', el => (el as HTMLInputElement).value);
//     const Keying_LastName = await page.$eval('#borrower_LastName', el => (el as HTMLInputElement).value);
//     const Keying_AddressLine1 = await page.$eval('#address_Line1', el => (el as HTMLInputElement).value);
//     const Keying_City = await page.$eval('#address_City', el => (el as HTMLInputElement).value);
//     const Keying_Zipcode = await page.$eval('#address_Zip', el => (el as HTMLInputElement).value);
//     const Keying_ConsiderationAmount = await page.$eval('#considerationAmount', el => (el as HTMLInputElement).value);
//     const Keying_instrumentDate = await page.$eval('#instrumentDate', el => (el as HTMLInputElement).value);

//      if (
//          CustomerName.trim() == Keying_Client.trim() &&
//          LoanNumber.trim() == Keying_LoanNumber.trim() &&
//          CustomerOrder.trim() == Keying_CustomerOrder.trim() &&
//          ProductType.trim() == Keying_Product.trim() &&
//          State.trim() == Keying_State.trim() &&
//          County.trim() == Keying_County.trim() &&
//          firstName.trim() == Keying_FirstName.trim() &&
//          middleName.trim() == Keying_MiddleName.trim() &&
//          lastName.trim() == Keying_LastName.trim() &&
//          AddressLine1.trim() == Keying_AddressLine1.trim() &&
//          City.trim() == Keying_City.trim() &&
//          Zipcode.trim() == Keying_Zipcode.trim() &&
//          ConsiderationNumber.trim() == Keying_ConsiderationAmount.trim()&&
//          InstrumentDate.trim() == Keying_instrumentDate.trim()
    
//     ) {
//         console.log("✅ All order fields verified successfully.");
//     } else {
//         console.log("❌ Order field verification failed. One or more fields have incorrect or missing values.");
//     }


//     //Tax Information
//     await page.locator('#tax_Year_TAI').fill("2025");
//     await page.waitForTimeout(1500);  

//     //State
//     await page.locator('[ng-reflect-display-name="State"]').nth(1).click();
//     //await page.waitForTimeout(1500);
//     await page.locator('mat-option[ng-reflect-value="AK"]').click();
//     await page.waitForTimeout(1000);
    

//     //County
//     await page.locator('[aria-haspopup="listbox"]').nth(6).click();
//     await page.waitForTimeout(1000);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(4).click();
//     await page.waitForTimeout(1000);

//     //Full Amount
//     await page.locator('#fullAmountDue_TAI').fill("900.26");
//     await page.waitForTimeout(1500);

//     //Tax Entity
//      await page.locator('#tax_Entity').fill("202558");
//     await page.waitForTimeout(1500);

//     //Tax Type
//     await page.locator('[ng-reflect-display-name="Tax Type"]').click();
//     await page.waitForTimeout(1500);
//     await page.locator('mat-option[ng-reflect-value="10"]').click();
//     await page.waitForTimeout(1000);

//     //Payment Frequency
//     await page.locator('[ng-reflect-display-name="Payment Frequency"]').click();
//     await page.waitForTimeout(1500);
//     await page.locator('mat-option[ng-reflect-value="2"]').click();
//     await page.waitForTimeout(1000);

//     //Court Type
//     await page.locator('#court_Type_TAI').fill("United States");
//     await page.waitForTimeout(1500);

//     //Court District
//     await page.locator('#court_District_TAI').fill("SDNY");
//     await page.waitForTimeout(1500);

//     //Group 1
//     //1st Inst
//     await page.locator('#installment_TAI11').fill("7900");
//     await page.waitForTimeout(1500);

//     //Paid date
//     await page.locator('button[aria-label="Open calendar"]').nth(3).click();
//     await page.waitForTimeout(1000);
//     await page.locator('.mat-calendar-body-today').click();
//     await page.waitForTimeout(1000);

//     //Due Date
//     await page.locator('button[aria-label="Open calendar"]').nth(4).click();
//     await page.waitForTimeout(1000);
//     await page.locator('.mat-calendar-body-today').click();
//     await page.waitForTimeout(1000);

//     //Delinquent Date
//     await page.locator('button[aria-label="Open calendar"]').nth(5).click();
//     await page.waitForTimeout(1000);
//     await page.locator('.mat-calendar-body-today').click();
//     await page.waitForTimeout(1000);

//     //Partially Paid Date
//      await page.locator('button[aria-label="Open calendar"]').nth(6).click();
//     await page.waitForTimeout(1000);
//     await page.locator('.mat-calendar-body-today').click();
//     await page.waitForTimeout(1000);

//     //Status
//     await page.locator('[ng-reflect-display-name="Status"]').click();
//     await page.waitForTimeout(1500);
//     await page.locator('mat-option[ng-reflect-value="2"]').click();
//     await page.waitForTimeout(1000);

//     //Comment
//     await page.locator('#comment_TAI17').fill("All Details filled");
//     await page.waitForTimeout(1500);

//     //Document
//      await page.locator('[ng-reflect-id="tagging_TI181docname"]').click();
//     await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
//     await page.waitForTimeout(1000);

//     //Legal Description
//      await page.locator('[ng-reflect-display-name="Document Source"]').click();
//     await page.waitForTimeout(1500);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
//     await page.waitForTimeout(1000);

//     //Recorded Date
//     await page.locator('button[aria-label="Open calendar"]').nth(18).click();
//     await page.waitForTimeout(1000);
//     await page.locator('.mat-calendar-body-today').click();
//     await page.waitForTimeout(1000);

//     //Recorded Instrument Doc
//      await page.locator('#recorded_Instrument_Number_Document_Number').fill("50");
//      await page.waitForTimeout(1000);

//     //Recorded Book
//     await page.locator('#recorded_Book').fill("Official Record");
//     await page.waitForTimeout(1000);


//     //Recorded Page
//     await page.locator('#recorded_Page').fill("50");
//     await page.waitForTimeout(1000);

//     //legal
//     await page.locator('#legal_Description').fill("Legal Description");
//     await page.waitForTimeout(1000);

//     //Legal Images1
//     await page.locator('#document_Name_LD11').click();
//     await page.waitForTimeout(1000);
//     await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
//     await page.waitForTimeout(1000);

//     //Additional Information
//     await page.locator('#comments_AIN').fill("All Details filled");
//     await page.waitForTimeout(1000);


//     //Save
//     await page.locator('button[mattooltip="Save"]').click();
//     await page.waitForTimeout(1000);

//     //toast message text Data Saved
//     const toastMessage_DataSaved = await page.locator("div[class='toast-container success-toast']").innerText();
//     //console.log("Toast Message: ", toastMessage_DataSaved); 

//     //Complete
//     await page.locator('button[mattooltip="Complete"]').click();
//     await page.waitForTimeout(1000);

//     //toast message text Data Saved
//     const toastMessage_KeyingUpdated = await page.locator("div[class='toast-container success-toast']").innerText();
//     //console.log("Toast Message: ", toastMessage_KeyingUpdated); 
//     await page.waitForTimeout(1000);

//     //search bar
//     const searchInput = page.locator('input[formcontrolname="orderId"]');
//     await searchInput.waitFor({ state: 'visible' });
//     await page.waitForTimeout(1500);
//     await searchInput.click({ clickCount: 3 });
//     await page.keyboard.press('Backspace');
//     await page.waitForTimeout(1500);
//     await searchInput.fill('ODS-07232504');
//     await page.waitForTimeout(1500);
//     await searchInput.press('Enter');


//     //Order Opened
//     await page.locator('div[class="ag-pinned-left-cols-container"]').click();
//     await page.waitForTimeout(1500);


//     //Documents
//     await page.locator('li[class="ng-star-inserted"]').nth(1).click();
//     await page.waitForTimeout(1000);  

//     console.log("");
//     console.log("DocGen Verification:");
    
//     const docSelector = page.locator('a.name-link', { hasText: 'Temp Delivery Package' });

//   try {
//     await expect(docSelector).toBeVisible(); 
//     console.log('✅ DocGen PDF created successfully. Temporary Delivery Package was found.');
//   } catch (error) {
//     console.error('❌ DocGen PDF creation failed. Temporary Delivery Package was not found.');
//   }




// console.log("");
// console.log("Email Status:");
// console.log("📧 Initiating email verification process...");
// await sendMail(testResults);

// });

 

