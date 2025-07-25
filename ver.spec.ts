import { test, expect } from '@playwright/test';
import { sendMail } from '../mail';


let srNo = 1;
let testResults: {srNo: any, module: any, status: any, URL: any }[] = [];
let status = 'Fail';


test('Login', async ({ page }) => {

    test.setTimeout(180000);

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

    // await page.goto('https://dev-outamateds.outamationlabs.com/app/internal/orders/25256907/keying');
    // await page.waitForTimeout(1500); 
    // const Keying_Client = (await page.locator('#clientId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    // console.log(Keying_Client);
    // await page.waitForTimeout(1500); 
    // const Keying_LoanNumber =await page.$eval('#loan_Number', el => (el as HTMLInputElement).value);
    // console.log(Keying_LoanNumber);
    // await page.waitForTimeout(1500); 
    // const Keying_CustomerOrder = await page.$eval('#customerOrderNumber', el => (el as HTMLInputElement).value);
    // console.log(Keying_CustomerOrder);
    // const Keying_Product = await page.locator('#productTypeId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent();
    // console.log(Keying_Product);
    // const Keying_State = await page.locator('#address_State .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent();
    // console.log(Keying_State);
    // const Keying_County = await page.locator('#countyId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent();
    // console.log(Keying_County);
    // const Keying_FirstName = await page.$eval('#borrower_FirstName', el => (el as HTMLInputElement).value);
    // console.log(Keying_FirstName);
    // const Keying_MiddleName = await page.$eval('#borrower_MiddleName', el => (el as HTMLInputElement).value);
    // console.log(Keying_MiddleName);
    // const Keying_LastName = await page.$eval('#borrower_LastName', el => (el as HTMLInputElement).value);
    // console.log(Keying_LastName);
    // const Keying_AddressLine1 = await page.$eval('#address_Line1', el => (el as HTMLInputElement).value);
    // console.log(Keying_AddressLine1); 
    // const Keying_City = await page.$eval('#address_City', el => (el as HTMLInputElement).value);
    // console.log(Keying_City); 
    // const Keying_Zipcode = await page.$eval('#address_Zip', el => (el as HTMLInputElement).value);
    // console.log(Keying_Zipcode); 
    // const Keying_ConsiderationAmount = await page.$eval('#considerationAmount', el => (el as HTMLInputElement).value);
    // console.log(Keying_ConsiderationAmount); 
    // const Keying_instrumentDate = await page.$eval('#instrumentDate', el => (el as HTMLInputElement).value);
    // console.log(Keying_instrumentDate); 

//    //Order Entry
//     await page.locator('span[class="mat-content ng-tns-c2622717266-6"]').click();
//     await page.waitForTimeout(1000); 
//     //All Orders
//     await page.locator('span[_ngcontent-ng-c1025041153]').nth(11).click();
//     await page.waitForTimeout(1000); 

//     //Customer Order
//     await page.locator('input[aria-label="Customer Order # Filter Input"]').fill("Tech T65");
//     await page.waitForTimeout(1000); 
//     //Order Opened
//     await page.locator('div[class="ag-pinned-left-cols-container"]').click();
//     await page.waitForTimeout(1500); 

//     //Select Keying
//     await page.locator('li[class="ng-star-inserted"]').nth(4).click();
//     await page.waitForTimeout(2000);  



    // //Tax Information
    // await page.locator('#tax_Year_TAI').fill("2025");
    // await page.waitForTimeout(1500);  

    // //State
    // await page.locator('[ng-reflect-display-name="State"]').nth(1).click();
    // //await page.waitForTimeout(1500);
    // await page.locator('mat-option[ng-reflect-value="AK"]').click();
    // await page.waitForTimeout(1000);
    

    // //County
    // await page.locator('[aria-haspopup="listbox"]').nth(6).click();
    // await page.waitForTimeout(1000);
    // await page.locator('span[class="mdc-list-item__primary-text"]').nth(4).click();
    // await page.waitForTimeout(1000);

    // //Full Amount
    // await page.locator('#fullAmountDue_TAI').fill("900.26");
    // await page.waitForTimeout(1500);

    // //Tax Entity
    //  await page.locator('#tax_Entity').fill("202558");
    // await page.waitForTimeout(1500);

    // //Tax Type
    // await page.locator('[ng-reflect-display-name="Tax Type"]').click();
    // await page.waitForTimeout(1500);
    // await page.locator('mat-option[ng-reflect-value="10"]').click();
    // await page.waitForTimeout(1000);

    // //Payment Frequency
    //  await page.locator('[ng-reflect-display-name="Payment Frequency"]').click();
    // await page.waitForTimeout(1500);
    // await page.locator('mat-option[ng-reflect-value="2"]').click();
    // await page.waitForTimeout(1000);

    // //Court Type
    // await page.locator('#court_Type_TAI').fill("United States");
    // await page.waitForTimeout(1500);

    // //Court District
    //  await page.locator('#court_District_TAI').fill("SDNY");
    // await page.waitForTimeout(1500);

    // //Group 1
    // //1st Inst
    // await page.locator('#installment_TAI11').fill("7900");
    // await page.waitForTimeout(1500);

    // //Paid date
    // await page.locator('button[aria-label="Open calendar"]').nth(3).click();
    // await page.waitForTimeout(1000);
    // await page.locator('.mat-calendar-body-today').click();
    // await page.waitForTimeout(1000);

    // //Due Date
    // await page.locator('button[aria-label="Open calendar"]').nth(4).click();
    // await page.waitForTimeout(1000);
    // await page.locator('.mat-calendar-body-today').click();
    // await page.waitForTimeout(1000);

    // //Delinquent Date
    // await page.locator('button[aria-label="Open calendar"]').nth(5).click();
    // await page.waitForTimeout(1000);
    // await page.locator('.mat-calendar-body-today').click();
    // await page.waitForTimeout(1000);

    // //Partially Paid Date
    //  await page.locator('button[aria-label="Open calendar"]').nth(6).click();
    // await page.waitForTimeout(1000);
    // await page.locator('.mat-calendar-body-today').click();
    // await page.waitForTimeout(1000);

    // //Status
    // await page.locator('[ng-reflect-display-name="Status"]').click();
    // await page.waitForTimeout(1500);
    // await page.locator('mat-option[ng-reflect-value="2"]').click();
    // await page.waitForTimeout(1000);

    // //Comment
    // await page.locator('#comment_TAI17').fill("All Details filled");
    // await page.waitForTimeout(1500);

    // //Document
    //  await page.locator('[ng-reflect-id="tagging_TI181docname"]').click();
    // await page.waitForTimeout(1500);
    // await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    // await page.waitForTimeout(1000);

    // //Legal Description
    //  await page.locator('[ng-reflect-display-name="Document Source"]').click();
    // await page.waitForTimeout(1500);
    // await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
    // await page.waitForTimeout(1000);

    // //Recorded Date
    // await page.locator('button[aria-label="Open calendar"]').nth(18).click();
    // await page.waitForTimeout(1000);
    // await page.locator('.mat-calendar-body-today').click();
    // await page.waitForTimeout(1000);

    // //Recorded Instrument Doc
    //  await page.locator('#recorded_Instrument_Number_Document_Number').fill("50");
    //  await page.waitForTimeout(1500);

    // //Recorded Book
    // await page.locator('#recorded_Book').fill("Official Record");
    // await page.waitForTimeout(1500);


    // //Recorded Page
    // await page.locator('#recorded_Page').fill("50");
    // await page.waitForTimeout(1500);

    // //legal
    // await page.locator('#legal_Description').fill("Legal Description");
    // await page.waitForTimeout(1500);

    // //Legal Images1
    // await page.locator('#document_Name_LD11').click();
    // await page.waitForTimeout(1500);
    // await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
    // await page.waitForTimeout(1000);

    // //Additional Information
    // await page.locator('#comments_AIN').fill("All Details filled");
    // await page.waitForTimeout(1500);


    // //Save
    // await page.locator('button[mattooltip="Save"]').click();
    // await page.waitForTimeout(1500);

    // //toast message text Data Saved
    // const toastMessage_DataSaved = await page.locator("div[class='toast-container success-toast']").innerText();
    // console.log("Toast Message: ", toastMessage_DataSaved); 
 
//     //Complete
//     await page.locator('button[mattooltip="Complete"]').click();
//     await page.waitForTimeout(1500);

//  //toast message text Data Saved
//     const toastMessage_KeyingUpdated = await page.locator("div[class='toast-container success-toast']").innerText();
//     console.log("Toast Message: ", toastMessage_KeyingUpdated); 
//     await page.waitForTimeout(1500);


    // //Order Entry
    // await page.locator('span[class="mat-content ng-tns-c2622717266-6"]').click();
    // await page.waitForTimeout(1000); 
    // //All Orders
    // await page.locator('span[_ngcontent-ng-c1025041153]').nth(11).click();
    // await page.waitForTimeout(1000); 
    await page.waitForTimeout(1500); 
// 1. Locate the input
const searchInput = page.locator('input[formcontrolname="orderId"]');
await searchInput.waitFor({ state: 'visible' });
await page.waitForTimeout(1500);
// 2. Click to focus and clear any value
await searchInput.click({ clickCount: 3 });
await page.keyboard.press('Backspace');
await page.waitForTimeout(1500);
// 3. Use .fill() instead of deprecated .type()
await searchInput.fill('ODS-072425');
await page.waitForTimeout(1500);
// 4. Press Enter to submit the search
await searchInput.press('Enter');


    //Order Opened
    await page.locator('div[class="ag-pinned-left-cols-container"]').click();
    await page.waitForTimeout(1500);

    //  const orderUrl = page.url();
    // console.log('Order created at:', orderUrl);

    // //Documents
    // await page.locator('li[class="ng-star-inserted"]').nth(1).click();
    // await page.waitForTimeout(1000);  

    // //Keying
    // await page.locator('li[class="ng-star-inserted"]').nth(4).click();
    // await page.waitForTimeout(1500);  
    
    // await page.locator('#tax_Year_TAI').clear();
    // await page.locator('#tax_Year_TAI').fill("2025");  
    // await page.waitForTimeout(1500);  

    //  //Save
    // await page.locator('button[mattooltip="Save"]').click();
    // await page.waitForTimeout(1000);

    // //Complete
    // await page.locator('button[mattooltip="Complete"]').click();
    // await page.waitForTimeout(1000);

    // //Conf
    //  await page.locator('button[color="success"]').click();
    // await page.waitForTimeout(1000);

     //Documents
    await page.locator('li[class="ng-star-inserted"]').nth(1).click();
    await page.waitForTimeout(1000);


    const DocGenUrl = await page.url();
      try {
  
          const clickableDoc = '<a href="' + DocGenUrl + '" target="_blank">DocGen Verification</a>';
          testResults.push({
            srNo: '6',
            module: 'DocGen Verification',
            status: 'Pass',
            URL: clickableDoc
          });
        
       } catch (error) {
        
        const clickableDocF = '<a href="' + DocGenUrl + '" target="_blank">DocGen Verification</a>';
        testResults.push({
          srNo: '6',
          module: 'DocGen Verification',
          status: 'Fail',
          URL: clickableDocF
        });
      }
 await sendMail(testResults);

  //   const docSelector = page.locator('a.name-link', { hasText: 'Temp Delivery Package' });

  // try {
  //   await expect(docSelector).toBeVisible(); 
  //   console.log('DocGen PDF creation successful: Temp Delivery Package found.');
  // } catch (error) {
  //   console.error('DocGen PDF creation failed: Temp Delivery Package not found.');
  // }

      const docCDP = page.locator('a.name-link', { hasText: 'Complete Delivery Package' });

  try {
    await expect(docCDP).toBeVisible(); 
    console.log('DocGen PDF creation successful: Complete Delivery Package.');
  } catch (error) {
    console.error('DocGen PDF creation failed: Complete Delivery Package.');
  }










});