import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/en';
import { addResult, getResults, getSrCounter, incrementSrCounter  } from '../resultsCollector'; 
import { sendMail } from '../mail';
import { attachRuntimeMonitors } from './support/runtimeMonitors';
import { setCustomerOrder } from '../Variable';
const fs = require('fs');
const path = require('path');


let status = 'Fail';
let isPassed = true;


async function assertTransition(
    page: any, 
    expectedUrlPattern: RegExp, 
    contextName: string, 
    checkGrid: boolean = false
) {
    // 1. Confirm Routing Matrix
    try {
        await page.waitForURL(expectedUrlPattern, { timeout: 15000 });
    } catch (e) {
        throw new Error(`❌ Navigation Failure: Failed to reach the [${contextName}] route map layout. Current URL: ${page.url()}`);
    }

    // 2. Scan for Runtime Material validation blocks or general application crashes
    const errorToast = page.locator('.warning-toast, .toast-container.danger-toast, mat-error, .error-message');
    const genericToast = page.locator('span[class="toast-message"], .toast-container');

    if (await errorToast.first().isVisible()) {
        const errorDetails = await errorToast.first().innerText().catch(() => 'Unknown Error Trace');
        throw new Error(`🛑 Flow Blocked on [${contextName}]: System threw an operational alert banner: "${errorDetails}"`);
    }

    // 3. Inspect Grid Processing Pipelines (If flag is true)
    if (checkGrid) {
        const gridRows = page.locator('.ag-center-cols-container .ag-row');
        try {
            await gridRows.first().waitFor({ state: 'visible', timeout: 8000 });
        } catch (e) {
            throw new Error(`⚠️ Grid Rendering Timeout on [${contextName}]: Component rendered, but server engine returned an empty table payload.`);
        }
    }

    console.log(`✨ Inspected Transition Target Successfully: [${contextName}]`);
}

//@Outamate DS:
test(' Order Creation ', async ({ page }) => {


    // --- GLOBAL RUNTIME MONITORING HOOKS ---
    attachRuntimeMonitors(page);

    await page.goto('/app/internal/research/dashboard/order-status');
    await page.waitForTimeout(1500);
    await page.locator('h6[class="module-title"]').nth(0).click();
    await page.waitForTimeout(1500);

    console.log("");
    console.log("\x1b[1mOrder Creation:\x1b[0m");
    console.log("📝 Initiating new order creation flow...");


    //Order Entry 
    await page.locator('span[class="title"]').nth(3).click();
    await page.waitForTimeout(1500);  

    //Order Creation
    await page.locator('a[href="/app/internal/research/orders/new"]').click();
    await page.waitForTimeout(1500);

   
    const reportBase = getSrCounter();
        const orderUrl = page.url();

        const isOrderCreationPage =  /\/app\/internal\/research\/orders\/new$/.test(orderUrl);

        addResult({
            product: "Research",
            srNo: getSrCounter().toString(),
            module: 'Order Creation',
            status: isOrderCreationPage ? 'Pass' : 'Fail',
            URL: `<a href="${orderUrl}" target="_blank">Order Creation</a>`
        });

        // console.log("Current URL:", orderUrl);
        // console.log("Order Creation Page:", isOrderCreationPage);
    
        incrementSrCounter();

    //Customer
    await page.locator('[aria-haspopup="listbox"]').nth(0).click();
    await page.waitForTimeout(1500);
    // const CusName = await page.locator('span[class="mdc-list-item__primary-text"]').nth(25);
    // await page.waitForTimeout(1500);
    const CusName = page.getByText('Test Company', { exact: true });
    await page.waitForTimeout(1500);
    const CustomerName = await CusName.innerText();
    //console.log("Customer Name: ", CustomerName);
    await CusName.click();
    await page.waitForTimeout(1500);
    //const CustomerName = await page.locator('mat-select[formcontrolname="client"] > div').innerText();

    //Division
    await page.locator('[aria-haspopup="listbox"]').nth(1).click();
    await page.waitForTimeout(1500);
    const DivisionElement = await page.locator('span[class="mdc-list-item__primary-text"]').nth(1);
    await page.waitForTimeout(1500);
    const Division = await DivisionElement.innerText();
    await DivisionElement.click();
    await page.waitForTimeout(1500);
    //const Division = await page.locator('mat-select[formcontrolname="division"] > div').innerText();

    //Lender Name 
    const lenderLocator = page.locator('input[formcontrolname="lenderName"]');
    await lenderLocator.fill("BOB Bank");
    await page.waitForTimeout(1500);
    const LenderName = await lenderLocator.inputValue();
   // console.log("Lender Name:", LenderName);
   // const lenderName = await page.locator('mat-form-field input[formcontrolname="lenderName"]').inputValue();

   //Order Type
    await page.locator('[aria-haspopup="listbox"]').nth(2).click();
    await page.waitForTimeout(1500);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);
    

    //Product Type
    await page.locator('[aria-haspopup="listbox"]').nth(3).click();
    await page.waitForTimeout(1500);
    const ProductTypeElement = await page.locator('span[class="mdc-list-item__primary-text"]').nth(1);
    await page.waitForTimeout(1500);
    const ProductType = await ProductTypeElement.innerText();
    await ProductTypeElement.click();
    await page.waitForTimeout(1500);
   // const ProductType = await page.locator('mat-select[formcontrolname="productType"] > div').innerText();
    

    // Sub-Product Type
    await page.locator('[aria-haspopup="listbox"]').nth(4).click();
    await page.waitForTimeout(1500);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);


    //Customer Order
    const CustomerOrderField = faker.number.int({ min: 100000, max: 999999 }).toString();
    const CustomerOrderField1= await page.locator('input[formcontrolname="customerNumber"]');
    await CustomerOrderField1.fill(CustomerOrderField);
    await page.waitForTimeout(1500);
    const CustomerOrder = await CustomerOrderField1.inputValue();
    setCustomerOrder(CustomerOrder);
    //console.log("Customer Order: ", CustomerOrder);

    //Parcel Number
    const ParcelNumber = faker.number.int({ min: 1000000, max: 9999999 }).toString();
    await page.locator('input[formcontrolname="parcelNumber"]').fill(ParcelNumber);
    await page.waitForTimeout(1500);
    //console.log("Parcel Number: ", ParcelNumber);

    //Address Line1
    const AddressLine1 = faker.location.streetAddress();
    await page.locator('input[formcontrolname="line1"]').fill(AddressLine1);
    await page.waitForTimeout(1500);
    //console.log("Address Line 1: ", AddressLine1);

    //ZipCode
    const Zipcode =  '99501';
    await page.locator('input[formcontrolname="zip"]').fill(Zipcode);
    await page.waitForTimeout(1500);
    //console.log("Zip Code: ", Zipcode);

    //City
    const City = faker.location.city();
    await page.locator('input[formcontrolname="city"]').fill(City);
    await page.waitForTimeout(1000);
    //console.log("City: ", City);

    //State
    await page.locator('[aria-haspopup="listbox"]').nth(5).click();
    await page.waitForTimeout(1500);
    const StateField = await page.locator('span[class="mdc-list-item__primary-text"]').nth(0);
    const State = await StateField.innerText();
    await StateField.click();
    await page.waitForTimeout(1000);
    //console.log("State: ", State);    
    //const State = await page.locator('mat-select[formcontrolname="state"] > div').innerText();
    

    //County
    await page.locator('[aria-haspopup="listbox"]').nth(6).click();
    await page.waitForTimeout(1000);
    const CountyField = await page.locator('span[class="mdc-list-item__primary-text"]').nth(4);
    const County = await CountyField.innerText();
    await CountyField.click();
    await page.waitForTimeout(1000);
    //console.log("County: ", County);
    //const County = await page.locator('mat-select[formcontrolname="county"] > div').innerText();

    //First Name
    const firstName = faker.person.firstName();
    await page.locator('input[formcontrolname="firstName"]').nth(0).fill(firstName);
    

    //Middle Name
    const middleName = faker.person.middleName();
    await page.locator('input[formcontrolname="middleName"]').nth(0).fill(middleName);
    

    //Last Name
    const lastName = faker.person.lastName();
    await page.locator('input[formcontrolname="lastName"]').nth(0).fill(lastName);

    //Loan Number
    const LoanNumber = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('input[id="LoanNumber"]').fill(LoanNumber);
    await page.waitForTimeout(1000);

    //Consideration Amount
    const ConsiderationNumber = faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await page.locator('input[formcontrolname="considerationAmount"]').fill(ConsiderationNumber);
    await page.waitForTimeout(1000);

    //Instrument Date
    await page.locator('button[aria-label="Open calendar"]').nth(0).click();
    await page.waitForTimeout(1500);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    const InstrumentDate = await page.locator('mat-form-field input[formcontrolname="instrumentDate"]').inputValue();

    
    //Special Instruction
    const SpecialInstructions = await page.locator('textarea[formcontrolname="specialInstructions"]').fill("All documents needed");
    await page.waitForTimeout(1000);

    //Submit Order
    await page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-primary"]').click();
    await page.waitForTimeout(1500);

    // Wait for redirect to Order Details page
    await page.waitForURL(/\/app\/internal\/research\/orders\/\d+\/details/);

    const orderDetailsUrl = page.url();

   // console.log("Order Details URL:", orderDetailsUrl);

        // Fetch the toast message text
     const toastMessage_OrderCreated = await page.locator("div[class='toast-container success-toast']").innerText();
     //console.log("Toast Message: ", toastMessage_OrderCreated); 

   
      if (CustomerOrder) {
      console.log(`✅ Order created successfully. Order ID: ${CustomerOrder}.`);
    } else {
      console.log("❌ Order creation failed. Order ID not generated or submission was unsuccessful.");
    }


    console.log("");
    console.log("\x1b[1mEdit Order:\x1b[0m");

    //Order Details 
    await page.locator('a[href*="/details"]').click();

    //Edit Order
    await page.locator('button[mattooltip="Edit Order"]').click();
    await page.waitForTimeout(1500);

    // Store edit page URL
    const editOrderUrl = page.url();

    //Edit Order - Change Customer
    await page.locator('[aria-haspopup="listbox"]').nth(0).click();
    await page.waitForTimeout(1500);
    // const CusNameUD = await page.locator('span[class="mdc-list-item__primary-text"]').nth(2);
    // await page.waitForTimeout(1500);
    const CusNameUD = page.getByText('Covius', { exact: true });
    await page.waitForTimeout(1500);
    const CustomerNameEdit = await CusNameUD.innerText();
    //console.log("Customer Name: ", CustomerNameEdit);
    await CusNameUD.click();
    await page.waitForTimeout(1500);


    //Edit Order - Change Division
     await page.locator('[aria-haspopup="listbox"]').nth(1).click();
    await page.waitForTimeout(1500);
    const DivisionElementUD = await page.locator('span[class="mdc-list-item__primary-text"]').nth(1);
    await page.waitForTimeout(1500);
    const DivisionEdit = await DivisionElementUD.innerText();
    //console.log("Division: ", DivisionEdit);
    await DivisionElementUD.click();
    await page.waitForTimeout(1500);

    //Edit Order - Change Lender
    const lenderLocatorUD = page.locator('input[formcontrolname="lenderName"]');
    await lenderLocatorUD.fill("John Doe");
    await page.waitForTimeout(1500);
    const LenderNameEdit = await lenderLocatorUD.inputValue();
    //console.log("Lender Name: ", LenderNameEdit);

    //Product Type
    await page.locator('[aria-haspopup="listbox"]').nth(3).click();
    await page.waitForTimeout(1500);
    const ProductTypeEdit = await page.locator('span[class="mdc-list-item__primary-text"]').nth(2);
    await page.waitForTimeout(1500);
    const ProductTypeED = await ProductTypeEdit.innerText();
    await ProductTypeEdit.click();
    await page.waitForTimeout(1500);

    //Edit Order - Change Address
    const AddressLine1Edit = faker.location.streetAddress();
    await page.locator('input[formcontrolname="line1"]').fill(AddressLine1Edit);
    await page.waitForTimeout(1500);
  //  console.log("Address Line 1: ", AddressLine1Edit);

    //Edit Order - Save order
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(1500);

    // Wait until redirected after save
    await page.waitForURL(/\/app\/internal\/research\/orders\/\d+\/details/);
    const editedOrderUrl = page.url();
    //console.log("Edited Order URL:", editedOrderUrl);

    // Validate edit order success
    const isOrderEdited = /\/app\/internal\/research\/orders\/\d+\/details/.test(editedOrderUrl);
        addResult({
        product: "Research",
        srNo: `${reportBase}.1`,
        module: 'Edit Order',
        status: isOrderEdited ? 'Pass' : 'Fail',
        URL: `<a href="${editOrderUrl}" target="_blank">Edit Order</a>`
    });

    if (isOrderEdited) {

        console.log("✅ Order edited successfully.");

    } else {
        console.log("❌ Order edit failed.");
    }



    //Verify changes in History tab
    await page.locator('button[mattooltip="History"]').click();
    await page.waitForTimeout(1500);
    
    const NewvalueCustomer = (await page.getByRole('gridcell', { name: 'Covius' }).innerText()).trim();
   // console.log("New Customer Name in History: ", NewvalueCustomer);
    const NewvalueDivision = (await page.getByRole('gridcell', { name: 'Batch Division' }).innerText()).trim();
   //console.log("New Division in History: ", NewvalueDivision);
    const NewvalueLender = (await page.getByRole('gridcell', { name: 'John Doe' }).innerText()).trim();
    //console.log("New Lender Name in History: ", NewvalueLender);
    const NewvalueProductType = (await page.getByRole('gridcell', { name: ProductTypeED }).innerText()).trim();
   // console.log("New Product Type in History: ", NewvalueProductType);
    const NewvalueAddress =  (await page.getByRole('gridcell', { name: AddressLine1Edit }).innerText()).trim();
  //  console.log("New Address Line 1 in History: ", NewvalueAddress);

  

    if (NewvalueCustomer === CustomerNameEdit 
        && NewvalueDivision === DivisionEdit
        && NewvalueLender === LenderNameEdit   
        && NewvalueProductType === ProductTypeED 
        && NewvalueAddress === AddressLine1Edit
        ) {
        addResult({
            product: "Research",
            srNo: `${reportBase}.2`,
            module: 'Edit History Verification',
            status: 'Pass',
            URL: `<a href="${page.url()}">Edit History</a>`
        });
        console.log("✅ History details are correct and match the created order.");
    } else {            
            addResult({
            product: "Research",
            srNo: `${reportBase}.2`,
            module: 'Edit History Verification',
            status: 'Fail',
            URL: `<a href="${page.url()}">Edit History</a>`
        });
        console.log("❌ History details do not match the created order or are incorrect.");
        
    }   

    
    //Close History tab
    await page.locator('i[class="ri-close-fill"]').click();
    await page.waitForTimeout(1500);
    

   
  // Document Upload
 
  console.log('');
  console.log('\x1b[1mDocument Upload:\x1b[0m');

  // Navigate to Documents tab
  await page.locator('a[href*="/documents"]').click();
  await page.locator('button[aria-label="Add"]').waitFor({ state: 'visible', timeout: 10000 });

  // Open upload dialog
  await page.locator('button[aria-label="Add"]').click();

  // Wait for the file input to appear inside the dialog/modal
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: 'attached', timeout: 10000 });

  // Resolve file paths
  const filePath1 = path.resolve('Documents/INDEX.pdf');
  const filePath2 = path.resolve('Documents/Prior SP.pdf');
  const filePath3 = path.resolve('Documents/26219076.pdf'); //C:\DS_playwright-test 1\Documents\26219076.pdf
  const filePath4 = path.resolve('Documents/26532140.pdf'); //C:\DS_playwright-test 1\Documents\26532140.pdf
  const filePath5 = path.resolve('Documents/25562238.DEED01.pdf'); //C:\DS_playwright-test 1\Documents\25562238.DEED01.
  const filePath6 = path.resolve('Documents/25562238.MTG01 1.pdf'); //C:\DS_playwright-test 1\Documents\25562238.MTG01 1.pdf
  const filePath7 = path.resolve('Documents/25748105.DEED01.pdf'); //C:\DS_playwright-test 1\Documents\25748105.DEED01.pdf
  const filePath8 = path.resolve('Documents/25748105.MTG01.pdf'); //C:\DS_playwright-test 1\Documents\25748105.MTG01.pdf

//   console.log('File 1 Path:', filePath1);
//   console.log('File 2 Path:', filePath2);
//   console.log('File 3 Path:', filePath3);
//   console.log('File 4 Path:', filePath4);

  // Verify files actually exist on disk before attempting upload
  if (!fs.existsSync(filePath1)) {
    console.log(`❌ File not found: ${filePath1}`);
  }
  if (!fs.existsSync(filePath2)) {
    console.log(`❌ File not found: ${filePath2}`);
  }
 if (!fs.existsSync(filePath3)) {
    console.log(`❌ File not found: ${filePath3}`);
  }
   if (!fs.existsSync(filePath4)) {
    console.log(`❌ File not found: ${filePath4}`);
  }
  if (!fs.existsSync(filePath5)) {
    console.log(`❌ File not found: ${filePath5}`);
  } 
  if (!fs.existsSync(filePath6)) {
    console.log(`❌ File not found: ${filePath6}`);
  }
  if (!fs.existsSync(filePath7)) {
    console.log(`❌ File not found: ${filePath7}`);
  }
  if (!fs.existsSync(filePath8)) {      
        console.log(`❌ File not found: ${filePath8}`);
    }

  // Set files — this triggers the file input change event
  await fileInput.setInputFiles([filePath1, filePath2,filePath3,filePath4,filePath5,filePath6,filePath7,filePath8]);
  await page.waitForTimeout(500); 

  // Document Type for Doc 1
  await page.locator('[aria-haspopup="listbox"]').nth(0).click();
  await page.locator('[role="option"]').nth(1).waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[role="option"]').nth(1).click();
  // Wait for listbox to close before opening next one
  await page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

  // Document Type for Doc 2
  await page.locator('[aria-haspopup="listbox"]').nth(1).click();
  await page.locator('[role="option"]').nth(2).waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[role="option"]').nth(2).click();
  await page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

  // Document Type for Doc 3
  await page.locator('[aria-haspopup="listbox"]').nth(2).click();
  await page.locator('[role="option"]').nth(3).waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[role="option"]').nth(3).click();
  await page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

    // Document Type for Doc 4
  await page.locator('[aria-haspopup="listbox"]').nth(3).click();
  await page.locator('[role="option"]').nth(4).waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[role="option"]').nth(4).click();
  await page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

  // Document Type for Doc 5
    await page.locator('[aria-haspopup="listbox"]').nth(4).click(); 
    await page.locator('[role="option"]').nth(5).waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('[role="option"]').nth(5).click();   
    await page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

    // Document Type for Doc 6
    await page.locator('[aria-haspopup="listbox"]').nth(5).click(); 
    await page.locator('[role="option"]').nth(6).waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('[role="option"]').nth(6).click();
    await page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

    // Document Type for Doc 7
    await page.locator('[aria-haspopup="listbox"]').nth(6).click();
    await page.locator('[role="option"]').nth(7).waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('[role="option"]').nth(7).click();   
    await page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

    // Document Type for Doc 8
    await page.locator('[aria-haspopup="listbox"]').nth(7).click();
    await page.locator('[role="option"]').nth(8).waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('[role="option"]').nth(8).click();   
    await page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});


  // Ensure upload button is enabled (form validation passed)
  const uploadButton = page.getByRole('button', { name: 'Upload' });
  await uploadButton.waitFor({ state: 'visible', timeout: 5000 });
  await expect(uploadButton).toBeEnabled({ timeout: 5000 });

  // KEY FIX: wait for the upload network request to complete BEFORE
  // checking success. waitForResponse intercepts the actual HTTP call
  // so we know the server received and accepted the files — not just
  // that the button was clicked.
  const uploadResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/documents') &&        // adjust to match your API endpoint
      response.request().method() === 'POST' &&
      response.status() === 200,
    { timeout: 30000 }
  );

  await uploadButton.click();

  // Wait for the actual HTTP upload to complete
  const uploadResponse = await uploadResponsePromise;
  //console.log(`   Upload response status: ${uploadResponse.status()}`);

  // After successful upload the modal should close and the Add button reappears
  await page.locator('button[aria-label="Add"]').waitFor({ state: 'visible', timeout: 15000 });

  // Verify documents appear in the grid
  const docRows = page.locator('.ag-center-cols-container .ag-row');
  await docRows.first().waitFor({ state: 'visible', timeout: 10000 });
  const docCount = await docRows.count();
  //console.log(`   Documents in grid after upload: ${docCount}`);
    const toastMessage_documents = await page.locator('span[class="toast-message"]').innerText();
    console.log(`✅ ${toastMessage_documents}`);

    
        console.log('');
        console.log('\x1b[1mKeying In Progress:\x1b[0m');
    
    //Search Details
    await page.locator('li[class="ng-star-inserted"]').nth(3).click();
    await page.waitForTimeout(1500); 
    //Searched From
    await page.locator('button[aria-label="Open calendar"]').nth(0).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);

    //Searched Through
    await page.locator('button[aria-label="Open calendar"]').nth(1).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);

    //Marketable
    await page.locator('input[class="mdc-radio__native-control"]').nth(0).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Save' }).click();  //Save
    //await page.locator('button[type="submit"]').click();  
    await page.waitForTimeout(1500);

    //Process Order - Keying
    await page.locator('button[mattooltip="Process Order"]').click();
    await page.waitForTimeout(1500);
    await page.locator('button:has-text("Move to...")').click();
    await page.locator('button:has-text(" KEYING IN PROGRESS ")').click();
    await page.waitForTimeout(1500);

      // Keying tab
    await page.getByRole('link', { name: 'keyboard Keying' }).click();
    await page.waitForTimeout(1500); 


    // Keying Page Validation
    const keyingPageUrl = page.url();
   // console.log("Keying Page URL:", keyingPageUrl);
    // Match keying page URL
    const isKeyingPage =  /\/app\/internal\/research\/orders\/\d+\/keying/.test(keyingPageUrl);
     const reportBase1 = getSrCounter();
    if (isKeyingPage) {

        addResult({
            product: "Research",
            srNo: getSrCounter().toString(),
            module: 'Keying',
            status: 'Pass',
            URL: `<a href="${keyingPageUrl}">Keying</a>`
        });

        console.log("✅ Keying page opened successfully.");

    } else {

        addResult({
            product: "Research",
            srNo: getSrCounter().toString(),
            module: 'Keying',
            status: 'Fail',
            URL: `<a href="${keyingPageUrl}">Keying</a>`
        });

        console.log("❌ Keying page validation failed.");
    }

      console.log("");
      console.log("\x1b[1mKeying Details Verification:\x1b[0m"); 
   
     
         const extractLender = (val: string) => {
        const match = val.match(/FOR\s(.+?)\s*,/i);
        return match ? match[1].trim() : val;
    };
    const normalize = (val: any) => typeof val === "number"? Number(val).toFixed(2): String(val ?? "").replace(/\s+/g, " ") .replace(/&amp;/g, "&") .trim() .toLowerCase();

    const Keying_Client = (await page.locator('#clientId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    const Keying_LoanNumber =await page.$eval('#loan_Number', el => (el as HTMLInputElement).value);
    const Keying_CustomerOrder = await page.$eval('#customerOrderNumber', el => (el as HTMLInputElement).value);
    const Keying_Product = (await page.locator('#productTypeId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    const Keying_State = (await page.locator('#address_State .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
   const Keying_County = (await page.locator('#countyId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
   const Keying_FirstName = await page.$eval('#borrower_FirstName', el => (el as HTMLInputElement).value);
   const Keying_MiddleName = await page.$eval('#borrower_MiddleName', el => (el as HTMLInputElement).value);
    const Keying_LastName = await page.$eval('#borrower_LastName', el => (el as HTMLInputElement).value);
    const Keying_AddressLine1 = await page.$eval('#address_Line1', el => (el as HTMLInputElement).value);
    const Keying_City = await page.$eval('#address_City', el => (el as HTMLInputElement).value);
    const Keying_Zipcode = await page.$eval('#address_Zip', el => (el as HTMLInputElement).value);
    const Keying_ConsiderationAmount = await page.$eval('#considerationAmount', el => (el as HTMLInputElement).value);
    const Keying_instrumentDate = await page.$eval('#instrumentDate', el => (el as HTMLInputElement).value);

    console.log("========== Field Comparison ==========");
    console.log(`Client                : Expected="${CustomerNameEdit}" | Actual="${Keying_Client}"`);
    console.log(`Loan Number           : Expected="${LoanNumber}" | Actual="${Keying_LoanNumber}"`);
    console.log(`Customer Order        : Expected="${CustomerOrder}" | Actual="${Keying_CustomerOrder}"`);
    console.log(`Product               : Expected="${ProductTypeED}" | Actual="${Keying_Product}"`);
    console.log(`State                 : Expected="${State}" | Actual="${Keying_State}"`);
    console.log(`County                : Expected="${County}" | Actual="${Keying_County}"`);
    console.log(`First Name            : Expected="${firstName}" | Actual="${Keying_FirstName}"`);
    console.log(`Middle Name           : Expected="${middleName}" | Actual="${Keying_MiddleName}"`);
    console.log(`Last Name             : Expected="${lastName}" | Actual="${Keying_LastName}"`);
    console.log(`Address Line1         : Expected="${AddressLine1Edit}" | Actual="${Keying_AddressLine1}"`);
    console.log(`City                  : Expected="${City}" | Actual="${Keying_City}"`);
    console.log(`Zipcode               : Expected="${Zipcode}" | Actual="${Keying_Zipcode}"`);
    console.log(`Consideration Amount  : Expected="${ConsiderationNumber}" | Actual="${Keying_ConsiderationAmount}"`);
    console.log(`Instrument Date       : Expected="${InstrumentDate}" | Actual="${Keying_instrumentDate}"`);
    console.log("======================================");

    if (
            normalize(CustomerNameEdit) === normalize(Keying_Client) &&
            normalize(LoanNumber) === normalize(Keying_LoanNumber) &&
            normalize(CustomerOrder) === normalize(Keying_CustomerOrder) &&
            normalize(ProductTypeED) === normalize(Keying_Product) &&
            normalize(State) === normalize(Keying_State) &&
            normalize(County) === normalize(Keying_County) &&
            normalize(firstName) === normalize(Keying_FirstName) &&
            normalize(middleName) === normalize(Keying_MiddleName) &&
            normalize(lastName) === normalize(Keying_LastName) &&
            normalize(AddressLine1Edit) === normalize(Keying_AddressLine1) &&
            normalize(City) === normalize(Keying_City) &&
            normalize(Zipcode) === normalize(Keying_Zipcode) &&
            normalize(ConsiderationNumber) === normalize(Keying_ConsiderationAmount) &&
            normalize(InstrumentDate) === normalize(Keying_instrumentDate) 
    ) 
    
    {
        console.log("✅ All order fields verified successfully.");

          const verificationUrl = await page.url();
          const clickableVer = '<a href="' + verificationUrl + '" target="_blank">Keying Details</a>';
          addResult({
            product: "Research",
            srNo: `${reportBase1}.1`,
            module: 'Keying Details - Verification',
            status: 'Pass',
            URL: clickableVer
          });

    } else {
        console.log("❌ Order field verification failed. One or more fields have incorrect or missing values.");

        const failedVerificationUrl = await page.url();
        const clickableVer = '<a href="' + failedVerificationUrl + '" target="_blank">Keying Details</a>';
        addResult({
            product: "Research",
          srNo: `${reportBase1}.1`,
          module: 'Keying Details - Verification ',
          status: 'Fail',
          URL: clickableVer
  });
    }
// incrementSrCounter();

                
});

