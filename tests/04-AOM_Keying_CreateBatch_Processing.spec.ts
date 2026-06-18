import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/en';
import { addResult, getResults, getSrCounter, incrementSrCounter  } from '../resultsCollector'; 
import { sendMail } from '../mail';
import { getCustomerOrder } from '../Variable';
const fs = require('fs');
const path = require('path');

//let testResults: {srNo: any, module: any, status: any, URL: any }[] = [];
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

    console.log(` Inspected Transition Target Successfully: [${contextName}]`);
}


test('@Outamate DS: Keying Process ', async ({ page }) => {


    // --- GLOBAL RUNTIME MONITORING HOOKS ---
    page.on('pageerror', (exception) => {
        console.error(`🛑 [Application Crash] Unhandled runtime exception: ${exception.message}`);
    });
    page.on('console', (msg) => {
      const text = msg.text();
        
        // Define all match triggers for the AG Grid trial noise
        const isAgGridNoise = 
            text.includes('ag-grid') || 
            text.includes('AG Grid') || 
            text.includes('License Key Not Found') || 
            text.includes('license key') ||
            text.includes('unlocked for trial') ||
            text.includes('hide the watermark') ||
            text.startsWith('*****'); // Blocks the massive asterisk border rows

        // Only log actual errors that aren't related to the AG Grid trial license
        if (msg.type() === 'error' && !isAgGridNoise) {
            console.error(`⚠️ [Browser Console Error] ${text}`);
        }
    });
    page.on('response', (response) => {
        if (response.status() >= 400) {
            console.error(`❌ [Network Drop] Failed target: ${response.url()} [Status: ${response.status()}]`);
        }
    });

    await page.goto('/app/internal/assignments/dashboard/order-status');
    await page.waitForTimeout(1500);
    await page.locator('h6[class="module-title"]').nth(1).click();
    await page.waitForTimeout(1500);
    
        const CustomerOrder = getCustomerOrder();

            //Search by Order ID or Customer ID
            await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);  
            await page.keyboard.press('Enter');
            await page.locator('div[col-id="orderId"]').nth(1).click(); 
            await page.waitForTimeout(1500); 


        console.log('');
        console.log('\x1b[1mKeying In Progress:\x1b[0m');
    

    //Process Order - Keying
    await page.locator('button[mattooltip="Process Order"]').click();
    await page.waitForTimeout(1500);
    await page.locator('button:has-text("Move to...")').click();
    await page.locator('button:has-text(" KEYING IN PROGRESS ")').click();
    await page.waitForTimeout(1500);

    //VERIFICATION PLACE 1: HOLD to KEYING IN PROGRESS

   // Open history modal (adjust selector if your history button is named differently)
   await page.locator('button[mattooltip="History"]').click();
   await page.waitForSelector('.ag-center-cols-container'); // Wait for ag-Grid to load

   // Assert that the HOLD -> KEYING IN PROGRESS entry exists
   try {
    await expect(
     page.locator('.ag-center-cols-container div[role="row"]')
       .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
       .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^HOLD$/ }) })
       .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^KEYING IN PROGRESS$/ }) })).toBeVisible();

        console.log("✅ Verified History: HOLD -> KEYING IN PROGRESS");
    } catch (error) {
        console.log("❌ Failed History: HOLD -> KEYING IN PROGRESS transition not found.");
    // Throws a normal Playwright failure to halt the test without calling addResult()
     //   throw new Error("History Validation Failed: HOLD -> KEYING IN PROGRESS transition not found.");
    }


   // Close the history modal to resume the test flow (adjust selector for your close cross/button)
    await page.locator('i[class="ri-close-fill"]').click();
    await page.waitForTimeout(1500);


   // Keying tab
    await page.getByRole('link', { name: 'keyboard Keying' }).click();
    await page.waitForTimeout(1500); 


    // Keying Page Validation
    const keyingPageUrl = page.url();
   // console.log("Keying Page URL:", keyingPageUrl);
    // Match keying page URL
    const isKeyingPage =  /\/app\/internal\/assignments\/orders\/\d+\/keying/.test(keyingPageUrl);
     const reportBase1 = getSrCounter();
    if (isKeyingPage) {

        addResult({
            srNo: getSrCounter().toString(),
            module: 'Keying',
            status: 'Pass',
            URL: `<a href="${keyingPageUrl}">Keying</a>`
        });

        console.log("✅ Keying page opened successfully.");

    } else {

        addResult({
            srNo: getSrCounter().toString(),
            module: 'Keying',
            status: 'Fail',
            URL: `<a href="${keyingPageUrl}">Keying</a>`
        });

        console.log("❌ Keying page validation failed.");
    }
    
    //Document Information 
    await page.locator('div[data-section-code="DocumentInformation"]').nth(0).click();
    await page.waitForTimeout(1000);
    const InstName = await page.locator('span[class="mdc-list-item__primary-text"]').nth(7);
    const InstrumentName = await InstName.innerText();
    await InstName.click();
    
    
    await page.waitForTimeout(1000);
    //BorrowerName
    const BorrowerName = faker.person.firstName();
    await page.getByLabel('Borrower(s) Name').fill(BorrowerName);
    await page.waitForTimeout(1000);
    //InstrumentDateKeying
    await page.locator('button[aria-label="Open calendar"]').nth(1).click();
    await page.waitForTimeout(1000);
    const InstrumentDateKeying = await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Maturity
    await page.locator('button[aria-label="Open calendar"]').nth(2).click();
    await page.waitForTimeout(1000);
    const MaturityDateKeying = await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Consideration Amount
    const ConsiderationNumberKeying = faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await page.getByLabel('Consideration Amount').nth(1).fill(ConsiderationNumberKeying);
    await page.waitForTimeout(1000);
    //Original Lender
    const OriginalLender = faker.person.firstName();
    await page.locator('input[id="original_Lender_DI17"]').fill(OriginalLender);
    await page.waitForTimeout(1000);
    //Original Address
    const AddressLineKeying = faker.location.streetAddress();
    await page.locator('input[id="original_Lender_Address_DI18"]').fill(AddressLineKeying);
    await page.waitForTimeout(1000);
    //MERS Ind
    await page.locator('div[data-field-key="original_Lender_MERS_Ind_DI"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1000);
    // //Trustee Name 
    // const TrusteeName = faker.person.firstName();
    // await page.locator('div[data-section-code="DocumentInformation"]').nth(7).fill(TrusteeName);
    // await page.waitForTimeout(1500);
    //Recorded State
    await page.locator('div[data-field-key="recorded_State_DI"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1000);
    //Recorded County 
    await page.locator('div[data-field-key="recorded_County_DI"]').click();
    await page.waitForTimeout(1000);
    const CountyKeying = await page.locator('span[class="mdc-list-item__primary-text"]').nth(4).click();
    await page.waitForTimeout(1000);
    //Recorded Agency
    await page.locator('div[data-field-key="recorded_Agency_DI"]').click(); 
    await page.waitForTimeout(1500);
    const RecordedAgency = await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Recorded Date
    await page.locator('button[aria-label="Open calendar"]').nth(3).click();
    await page.waitForTimeout(1500);
    const RecordedDate = await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Recorded Book
    const RecordedBook = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('input[id="recorded_Book_DI115"]').fill(RecordedBook);
    await page.waitForTimeout(1000);
    //Recorded Page
    const RecordedPage = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('input[id="recorded_Page_DI116"]').fill(RecordedPage);
    await page.waitForTimeout(1000);

    //Images 1 
    await page.locator('div[class="col-sm-4 form-field"]').nth(0).click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1000);

    //Add Document Information 1 
    //Add button 
    await page.locator('button[mattooltip="Add"]').nth(2).click();
    await page.waitForTimeout(1000);
    //Instrument Name 
    await page.locator('div[data-section-code="DocumentInformation"]').nth(19).click();
    await page.waitForTimeout(1500);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1500);
    //BorrowerName
    const BorrowerName2 = faker.person.firstName();
    await page.getByLabel('Borrower(s) Name').nth(1).fill(BorrowerName2);
    await page.waitForTimeout(1500);
    //InstrumentDateKeying
    await page.locator('button[aria-label="Open calendar"]').nth(4).click();
    await page.waitForTimeout(1500);
    const InstrumentDateKeying2= await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Recorded State
    await page.locator('div[data-field-key="recorded_State_DI"]').nth(1).click();
    await page.waitForTimeout(1500);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1500);
    //Recorded County 
    await page.locator('div[data-field-key="recorded_County_DI"]').nth(1).click();
    await page.waitForTimeout(1500);
    const CountyKeying2 = await page.locator('span[class="mdc-list-item__primary-text"]').nth(4).click();
    await page.waitForTimeout(1500);
    //Recorded Agency
    await page.locator('div[data-field-key="recorded_Agency_DI"]').nth(1).click(); 
    await page.waitForTimeout(1500);
    const RecordedAgency2 = await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Recorded Date
    await page.locator('button[aria-label="Open calendar"]').nth(5).click();
    await page.waitForTimeout(1500);
    const RecordedDate2 = await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Recorded Book
    const RecordedBook2 = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('input[id="recorded_Book_DI215"]').fill(RecordedBook2);
    await page.waitForTimeout(1000);
    //Recorded Page
    const RecordedPage2 = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('input[id="recorded_Page_DI216"]').fill(RecordedPage2);
    await page.waitForTimeout(1000);
    //Assignor MERS Ind 
    await page.locator('div[data-field-key="assignor_MERS_Ind_DI"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1000);
    //Assignor
    const Assignor2 = faker.person.firstName();
    await page.locator('input[id="assignor_DI229"]').fill(Assignor2);
    await page.waitForTimeout(1500);
    //Assignor Address
    const AssignorAddressKeying = faker.location.streetAddress();
    await page.locator('input[id="assignor_Address_DI230"]').fill(AssignorAddressKeying);
    await page.waitForTimeout(1500);
    // //Assignee MERS Ind 
    await page.locator('div[data-field-key="assignee_MERS_Ind_DI"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1000);
    //Assignee
    const Assignee2 = faker.person.firstName();
    await page.locator('input[id="assignee_DI232"]').fill(Assignee2);
    await page.waitForTimeout(1500);
    //Assignor Address
    const AssigneeAddressKeying = faker.location.streetAddress();
    await page.locator('input[id="assignee_Address_DI233"]').fill(AssigneeAddressKeying);
    await page.waitForTimeout(1500);
    //images 2
    await page.locator('div[class="col-sm-4 form-field"]').nth(2).click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
    await page.waitForTimeout(1000);

    //Recording Category
    await page.locator('div[data-field-key="recording_Type_RC"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1000);
    //Recording Statement
    await page.locator('div[data-field-key="recording_Statement_RC"]').click();
    await page.waitForTimeout(1000);
    const recordingStatement = faker.company.catchPhrase();
    await page.keyboard.type(recordingStatement);
    await page.waitForTimeout(1000);
    //Property Information
     await page.locator('div[data-field-key="legal_Description_Preamble_PI"]').click();
    await page.waitForTimeout(1000);
    const LegalDescription = faker.lorem.sentences(3);
    await page.keyboard.type(LegalDescription);
    await page.waitForTimeout(1000);

    //Subdivison
    await page.locator('div[data-field-key="sub_Division_PI"]').click();
    const sub = await page.locator('span[class="mdc-list-item__primary-text"]').nth(1);
    const Subdivison = await sub.innerText();
    await sub.click();
    //Section
    const section = faker.number.int({ min: 1, max: 9999 }).toString();
    await page.locator('input[id="section_PI"]').fill(section);
    //Block
    const Block = faker.string.alpha({ length: 2, casing: 'upper' });
    await page.locator('input[id="block_PI"]').fill(Block);
    //Lot
    const Lot = faker.number.int({ min: 1, max: 9999 }).toString();
    await page.locator('input[id="lot_PI"]').fill(Lot);
    //Sub Lot
    const SubLot = faker.number.int({ min: 1, max: 9999 }).toString();
    await page.locator('input[id="sub_Lot_PI"]').fill(SubLot);
    //Parcel ID
    const ParcelID = faker.number.int({ min: 1, max: 9999 }).toString();
    await page.locator('input[id="plat_Number_PI"]').fill(ParcelID);
    //MIN Number
    const MINNumber = faker.number.int({ min: 1, max: 9999 }).toString();
    await page.locator('input[id="min_Number_DI"]').fill(MINNumber);
    await page.waitForTimeout(1000);

    //Bene 
    await page.locator('button[mattooltip="Beneficiary Search"]').click();
    await page.waitForTimeout(1000);
    //Bene Assignor
    await page.locator('input[placeholder="Assignor"]').fill('S');
    //Search 
    await page.locator('span[class="mat-mdc-button-persistent-ripple mdc-button__ripple"]').nth(5).click();
    await page.locator('div[class="mdc-radio"]').click();
    await page.waitForTimeout(1000);
    //Submit
    await page.locator('button:has-text(" Submit ")').click();
    await page.waitForTimeout(1500);

    //Save 
    await page.locator('button[mattooltip="Save"]').click();
    await page.waitForTimeout(1000);
    //Complete 
    await page.locator('button[mattooltip="Complete"]').click();
    await page.waitForTimeout(1000);

    //Qc 
    await page.locator('span[class="title"]').nth(4).click();
    await page.waitForTimeout(1500);  
    //Qc order grid 
    await page.locator('a[href="/app/internal/assignments/quality-control/quality-check"]').click();
    await page.waitForTimeout(1500);  
    //Search with Customer Order Number
    await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
    await page.waitForTimeout(1500);  
    await page.locator('div[col-id="id"]').nth(1).click(); 
    await page.waitForTimeout(1500); 

        // VERIFICATION PLACE 2: KEYING IN PROGRESS to QUALITY CHECK
    await page.locator('button[mattooltip="History"]').click();
     await page.waitForSelector('.ag-center-cols-container');

   // Assert that the KEYING IN PROGRESS -> QUALITY CHECK entry exists
   try{
   await expect(
     page.locator('.ag-center-cols-container div[role="row"]')
       .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
       .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^KEYING IN PROGRESS$/ }) })
       .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^QUALITY CHECK$/ }) }) ).toBeVisible();

        console.log("✅ Verified History: KEYING IN PROGRESS -> QUALITY CHECK");

    } catch (error) {

        console.log("❌ Failed History: KEYING IN PROGRESS -> QUALITY CHECK transition not found.");
        // Throws a normal Playwright failure to halt the test without calling addResult()
        throw new Error("History Validation Failed: KEYING IN PROGRESS -> QUALITY CHECK transition not found.");
    }

   // Close the history modal to finish the test case safely
    await page.locator('i[class="ri-close-fill"]').click();
    await page.waitForTimeout(1500);

    // Navigate to Documents tab
    await page.locator('a[href*="/documents"]').click();

    //DocGen Verification
   const docSelector = page.locator('a.name-link', { hasText: 'Temp Delivery Package' });

    try {
        await expect(docSelector).toBeVisible(); 
        console.log('✅ DocGen PDF created successfully. Temporary Delivery Package was found.');
    } catch (error) {
        console.error('❌ DocGen PDF creation failed. Temporary Delivery Package was not found.');
    }

    const docSupporting = page.locator('a.name-link', { hasText: 'Supporting Documents' });
    try {
        await expect(docSupporting).toBeVisible(); 
        console.log('✅ DocGen PDF created successfully. Supporting Documents was found.');
    } catch (error) {
        console.error('❌ DocGen PDF creation failed. Supporting Documents was not found.');
    }

    //Keying : QC
    await page.getByRole('link', { name: 'keyboard Keying' }).click();
    await page.waitForTimeout(1500); 

    //Title order data images 1
    await page.locator('div[data-field-key="document_Name_TOD"]').click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(3).click();
    await page.waitForTimeout(1500); 

    //Document Information 3
    //Add button 
    await page.locator('button[mattooltip="Add"]').nth(3).click();
    await page.waitForTimeout(1000);
    //Instrument Name 
    await page.locator('div[data-field-key="instrument_Name_DI"]').nth(2).click();
    await page.waitForTimeout(1500);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(4).click();
    await page.waitForTimeout(1500);
    //BorrowerName
    const BorrowerName3 = faker.person.firstName();
    await page.getByLabel('Borrower(s) Name').nth(2).fill(BorrowerName3);
    await page.waitForTimeout(1500);
    //InstrumentDateKeying
    await page.locator('button[aria-label="Open calendar"]').nth(8).click();
    await page.waitForTimeout(1500);
    const InstrumentDateKeying3= await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Consideration Amount
    const ConsiderationNumber3 = faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await page.getByLabel('Consideration Amount').nth(2).fill(ConsiderationNumber3);
    await page.waitForTimeout(1000);
    //Original Lender
    const OriginalLender3 = faker.person.firstName();
    await page.locator('input[id="original_Lender_DI37"]').fill(OriginalLender3);
    await page.waitForTimeout(1000);

    //Original Address
    const AddressLineKeying3 = faker.location.streetAddress();
    await page.locator('input[id="original_Lender_Address_DI38"]').fill(AddressLineKeying3);
    await page.waitForTimeout(1000);
    //MERS Ind
    await page.locator('div[data-field-key="original_Lender_MERS_Ind_DI"]').nth(1).click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1000);
    //Trustee Name 
    const TrusteeName3 = faker.person.firstName();
    await page.locator('input[id="trustee_DI310"]').fill(TrusteeName3);
    await page.waitForTimeout(1500);
    //images 3
    await page.locator('div[class="col-sm-4 form-field"]').nth(4).click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(4).click();
    await page.waitForTimeout(1000);

     //Save 
    await page.locator('button[mattooltip="Save"]').click();
    await page.waitForTimeout(1000);
    //Complete 
    await page.locator('button[mattooltip="Complete"]').click();
    await page.waitForTimeout(1000);
    //Confirm
    await page.locator('button[color="success"]').click();
    await page.waitForTimeout(1500);


    //Search by Order ID or Customer ID
    await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
    await page.waitForTimeout(1500);  
    await page.keyboard.press('Enter');
    await page.locator('div[col-id="orderId"]').nth(1).click(); 
    await page.waitForTimeout(1500); 


    //Navigate to Documents tab
    await page.locator('a[href*="/documents"]').click();

    //DocGen verification 
    const docCDP = page.locator('a.name-link', { hasText: 'Complete Delivery Package' });

    try {
        await expect(docCDP).toBeVisible(); 
        console.log('✅ DocGen PDF created successfully. Complete Delivery Package.');
    } catch (error) {
        console.error('❌ DocGen PDF creation failed. Complete Delivery Package.');
    }

    // Documents Page Validation
    const documentsPageUrl = page.url();

    // console.log("Documents Page URL:", documentsPageUrl);

    // Match documents page URL
    const isDocumentsPage =
        /\/app\/internal\/assignments\/orders\/\d+\/documents/.test(documentsPageUrl);

    if (isDocumentsPage) {

        addResult({
            srNo: `${reportBase1}.1`,
            module: 'Keying Document - Verification',
            status: 'Pass',
            URL: `<a href="${documentsPageUrl}">Keying Document - Verification</a>`
        });

        console.log("✅ DocGen successfully.");

    } else {

        addResult({
            srNo: `${reportBase1}.1`,
            module: 'Keying Document - Verification',
            status: 'Fail',
            URL: `<a href="${documentsPageUrl}">Keying Document - Verification</a>`
        });

        console.log("❌ DocGen validation failed.");
    }

     console.log("");
    console.log("\x1b[1mKeying Details Verification:\x1b[0m"); 
    await page.reload();
    
    await page.getByRole('link', { name: 'keyboard Keying' }).click();
    await page.waitForTimeout(1500); 

     
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
    const Keying_InstrumentName = (await page.locator('#instrument_Name_DI12 .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    const Keying_BorrowersName = await page.$eval('#borrower_DI13', el => (el as HTMLInputElement).value);
    const Keying_OLAddress = await page.$eval('#original_Lender_Address_DI18', el => (el as HTMLInputElement).value);
    const Keying_OL = await page.$eval('#original_Lender_DI17', el => (el as HTMLInputElement).value);
    const Keying_SubDivision = (await page.locator('#sub_Division_PI .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    const Keying_Section = await page.$eval('#section_PI', el => (el as HTMLInputElement).value);
    const Keying_Block = await page.$eval('#block_PI', el => (el as HTMLInputElement).value);
    const Keying_Lot = await page.$eval('#lot_PI', el => (el as HTMLInputElement).value);
    const Keying_Sublot = await page.$eval('#sub_Lot_PI', el => (el as HTMLInputElement).value);
    const Keying_PracelID = await page.$eval('#plat_Number_PI', el => (el as HTMLInputElement).value);
    const Keying_MinNumber = await page.$eval('#min_Number_DI', el => (el as HTMLInputElement).value);


    if (
            // normalize(CustomerNameEdit) === normalize(Keying_Client) &&
            // normalize(LoanNumber) === normalize(Keying_LoanNumber) &&
            // normalize(CustomerOrder) === normalize(Keying_CustomerOrder) &&
            // normalize(ProductType) === normalize(Keying_Product) &&
            // normalize(State) === normalize(Keying_State) &&
            // normalize(County) === normalize(Keying_County) &&
            // normalize(firstName) === normalize(Keying_FirstName) &&
            // normalize(middleName) === normalize(Keying_MiddleName) &&
            // normalize(lastName) === normalize(Keying_LastName) &&
            // normalize(AddressLine1Edit) === normalize(Keying_AddressLine1) &&
            // normalize(City) === normalize(Keying_City) &&
            // normalize(Zipcode) === normalize(Keying_Zipcode) &&
            // normalize(ConsiderationNumber) === normalize(Keying_ConsiderationAmount) &&
            // normalize(InstrumentDate) === normalize(Keying_instrumentDate) &&
            normalize(InstrumentName) === normalize(Keying_InstrumentName) &&
            normalize(BorrowerName) === normalize(Keying_BorrowersName) &&
            normalize(AddressLineKeying) === normalize(Keying_OLAddress) &&
            normalize(OriginalLender) === normalize(extractLender(Keying_OL)) &&
            normalize(Subdivison) === normalize(Keying_SubDivision) &&
            normalize(section) === normalize(Keying_Section) &&
            normalize(Block) === normalize(Keying_Block) &&
            normalize(Lot) === normalize(Keying_Lot) &&
            normalize(SubLot) === normalize(Keying_Sublot) &&
            normalize(ParcelID) === normalize(Keying_PracelID) &&
            normalize(MINNumber) === normalize(Keying_MinNumber)
    ) {
        console.log("✅ All order fields verified successfully.");

          const verificationUrl = await page.url();
          const clickableVer = '<a href="' + verificationUrl + '" target="_blank">Keying Details</a>';
          addResult({
            srNo: `${reportBase1}.2`,
            module: 'Keying Details - Verification',
            status: 'Pass',
            URL: clickableVer
          });

    } else {
        console.log("❌ Order field verification failed. One or more fields have incorrect or missing values.");

        const failedVerificationUrl = await page.url();
        const clickableVer = '<a href="' + failedVerificationUrl + '" target="_blank">Keying Details</a>';
        addResult({
          srNo: `${reportBase1}.2`,
          module: 'Keying Details - Verification ',
          status: 'Fail',
          URL: clickableVer
  });
    }
incrementSrCounter();
    console.log("");
    console.log("\x1b[1mCreate Batch:\x1b[0m");  

    //Batching 
    await page.locator('span[class="title"]').nth(5).click();
    await page.waitForTimeout(1500);  
    //Create Batch
    await page.locator('a[href="/app/internal/assignments/batching/batches"]').click();
    await page.waitForTimeout(1500);
    //Search for Order
    await page.locator('input[placeholder="Search keyword"]').fill( CustomerOrder);
    await page.waitForTimeout(1500);    
    //Order selected
    await page.locator('div.ag-selection-checkbox input[type="checkbox"]').click(); 
    await page.locator('button[mattooltip="Create a new batch"]').click();
    await page.waitForTimeout(1500); 
    //MERS Signor
    await page.locator('span[class="badge text-outline-success"]').click();
    //Signor 1
    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(2).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Signor 2
    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(3).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Witness 1
    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(4).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Witness 2
    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(5).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Notary 1
    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(6).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Notary 2
    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(7).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Preparer
    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(8).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Return To
    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(9).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Notary block
    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(10).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1500);
    //Submit
    await page.locator('button[mattooltip="Submit"]').click();
    await page.waitForTimeout(1500);

    // 1. Give the network requests and UI animations a solid moment to complete
    await page.waitForTimeout(3000);

    // 2. Define the exact elements from your screen capture
    const warningToast = page.locator('.warning-toast, .toast-message');
    const invalidFields = page.locator('.mat-mdc-form-field-invalid, mat-form-field.mat-form-field-invalid');

    // 3. Explicitly check if the UI is showing an error or a red field
    const isToastVisible = await warningToast.first().isVisible();
    const redFieldCount = await invalidFields.count();

    if (isToastVisible || redFieldCount > 0) {
        // 4. Save visual evidence instantly
        await page.screenshot({ path: 'failure-screenshots/validation-error.png', fullPage: true });

        // 5. Extract toast message text safely
        let alertMessage = "Toast message closed before capture";
        if (isToastVisible) {
            alertMessage = (await warningToast.first().innerText()).trim();
        }

        // 6. Extract the exact names of the fields that are red
        let brokenFields = [];
        for (let i = 0; i < redFieldCount; i++) {
            const label = await invalidFields.nth(i).locator('label, mat-label, .mdc-floating-label').first().innerText().catch(() => `Field #${i+1}`);
            brokenFields.push(`"${label.trim()}"`);
        }
        const brokenFieldsList = brokenFields.length > 0 ? brokenFields.join(', ') : 'Unknown Field';

        console.error(` UI ALERT MESSAGE  : "${alertMessage}"`);
        console.error(` BROKEN UI FIELD(S): ${brokenFieldsList} was left blank or invalid.`);
        

        // 8. Force the test runner to register a clear FAILED status
        throw new Error(` Form Submission Blocked! Missing Field: ${brokenFieldsList}`);
    } else {
        // console.log('\n====================================================================');
        // console.log('✅ Success: Form submitted cleanly with zero UI errors detected.');
        // console.log('====================================================================\n');
    }

        //Refresh created batch 
        await page.locator('button[mattooltip="Refresh Data"]').click();
        await page.waitForTimeout(1000);
        await page.locator('button[mattooltip="Refresh Data"]').click();
        await page.waitForTimeout(1000);
        await page.locator('button[mattooltip="Refresh Data"]').click();
        await page.waitForTimeout(1000);

        // Wait for either "Generation Completed" or "Generation Failed"
        const generationStatus = page.locator('span.badge.text-outline-primary, span.badge.text-outline-danger');
        // Wait until status changes from "In Progress"
        await expect(generationStatus).toHaveText( /Generation Completed|Generation Failed/,{ timeout: 120000 });

        const statusText = (await generationStatus.textContent())?.trim();
        console.log(`✅ Batch Status: ${statusText}`);

        if (statusText?.includes('Generation Completed'))
        {
           // console.log('Proceeding to next step...'); 

        } else if (statusText?.includes('Generation Failed')) {
             throw new Error('Batch Generation Failed');
        }

             // Get full batch heading text
            const batchText = await page.locator('h2').textContent();

            if (!batchText) {
                throw new Error('Batch text not found');
            }
            // Extract batch name
            const match = batchText.match(/Batch-\d+/);
            if (!match) {
                throw new Error('Batch name not found');
            }
            // Safe string value
            const batchName: string = match[0];
            console.log(`✅ Batch created successfully: ${batchName}`);

                        
            const GenerationedUrl = await page.url();

            // Extract batch ID (304)
            const batchIdMatch = GenerationedUrl.match(/batching\/(\d+)\/batch-details/);

            if (!batchIdMatch) {
                throw new Error('Batch ID not found in URL');
            }

            const batchId = batchIdMatch[1];
            // console.log(`✅ Batch ID: ${batchId}`);
            // console.log(`🔗 Batch URL: ${GenerationedUrl}`);
            const clickableVer = `<a href="${GenerationedUrl}" target="_blank">Create Batch : Generation Completed</a>`;
           
        addResult({
            srNo: getSrCounter().toString(),
            module: 'Create Batch : Generation Completed',
            status: statusText?.includes('Generation Completed') ? 'Pass' : 'Fail',
            URL: clickableVer
        });
        incrementSrCounter();

        if (statusText?.includes('Generation Failed')) {
            throw new Error(`Batch Generation Failed for Batch ID ${batchId}`);
        }


            // Go to grid
            await page.locator('button[mattooltip="Go to Order Details"]').click();
            await page.waitForTimeout(1500);

            //Search by Order ID or Customer ID
            await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);  
            await page.keyboard.press('Enter');
            await page.locator('div[col-id="orderId"]').nth(1).click(); 
            await page.waitForTimeout(1500); 

             // Open history modal
            await page.locator('button[mattooltip="History"]').click();
            await page.waitForSelector('.ag-center-cols-container');

            // Verify QC COMPLETED -> SIGNING PREPARATION
            await expect(
                page.locator('.ag-center-cols-container div[role="row"]')
                    .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
                    .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^QC COMPLETED$/ }) })
                    .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^SIGNING PREPARATION$/ }) })
            ).toBeVisible();

            console.log("✅ Verified History: QC COMPLETED -> SIGNING PREPARATION");

               // Close the history modal to resume the test flow (adjust selector for your close cross/button)
                await page.locator('i[class="ri-close-fill"]').click();
                await page.waitForTimeout(1500);

            console.log("");
            console.log("\x1b[1mPrinting:\x1b[0m"); 
            // //Batching 
            // await page.locator('span[class="title"]').nth(5).click();
            // await page.waitForTimeout(1500);   
            //Back to pritning page
            await page.locator('a[href*="/printing"]').click();
            await page.waitForTimeout(1500);    

            // Search batch
            await page.fill('input[placeholder="Search keyword"]', batchName);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1500);

            // Search batch
             await page.locator('input[placeholder="Search keyword"]').fill(batchName);
            await page.waitForTimeout(1500);  
            await page.keyboard.press('Enter'); 

            //Action menu
            await page.locator('button[aria-label="Actions"]').click();
            await page.waitForTimeout(1000);
            //Complete Batch
            await page.locator('span[class="mat-mdc-menu-item-text"]').nth(2).click();
            await page.waitForTimeout(1000);

            //Search by Order ID or Customer ID
            await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);  
            await page.keyboard.press('Enter');
            await page.locator('div[col-id="orderId"]').nth(1).click(); 
            await page.waitForTimeout(1500); 

            // Open history modal
            await page.locator('button[mattooltip="History"]').click();
            await page.waitForSelector('.ag-center-cols-container');
            // Verify SIGNING PREPARATION -> SENT FOR SIGNING
            await expect(
                page.locator('.ag-center-cols-container div[role="row"]')
                    .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
                    .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^SIGNING PREPARATION$/ }) })
                    .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^SENT FOR SIGNING$/ }) })
            ).toBeVisible();

            console.log("✅ Verified History: SIGNING PREPARATION -> SENT FOR SIGNING");

            // Close history modal
            await page.locator('i[class="ri-close-fill"]').click();
            await page.waitForTimeout(1500);

            //Documents
            await page.locator('a[href*="/documents"]').click();
            await page.waitForTimeout(1500);

        // Verification URL
        const verificationUrl = await page.url();
        const GeneratedDocument = `<a href="${verificationUrl}" target="_blank">Documents</a>`;

        // DocGen verification
        const generatedDoc = page.locator('a.name-link', { hasText: 'Generated Document' });
        const isDocVisible = await generatedDoc.isVisible();
        
        if (isDocVisible) {

            console.log('✅ DocGen PDF created successfully. Generated Document.');

            addResult({
                srNo: getSrCounter().toString(),
                module: 'Generated Document Verification',
                status: 'Pass',
                URL: GeneratedDocument
            });

        } else {

            console.log('❌ DocGen PDF creation failed. Generated Document not found.');

            addResult({
                srNo: getSrCounter().toString(),
                module: 'Generated Document Verification',
                status: 'Fail',
                URL: GeneratedDocument
            });
            
        }   

        
    //    // DOWNLOAD DOCUMENT
    //    // Wait for new tab/page
    //     const [newPage] = await Promise.all([page.context().waitForEvent('page'),   generatedDoc.click() ]);
    //     // Wait until fully loaded
    //     await newPage.waitForLoadState();
    //    // console.log('✅ Document opened in new tab');

    //             const base64Data = await newPage.evaluate(async () => {

    //             const response = await fetch(window.location.href);

    //             const blob = await response.blob();

    //             return await new Promise<string>((resolve, reject) => {

    //                 const reader = new FileReader();

    //                 reader.readAsDataURL(blob);

    //                 reader.onloadend = () => {

    //                     const base64 = reader.result?.toString().split(',')[1];

    //                     resolve(base64 || '');
    //                 };

    //                 reader.onerror = reject;
    //             });

    //         });

    //         // CLEAN OLD FILES (SAFE PLACE: AFTER SUCCESS)
    //         const downloadFolder = 'C:\\DS_playwright-test 1\\Documents';
    //         const files = fs.readdirSync(downloadFolder);

    //         for (const file of files) {
    //             if (file.startsWith('GeneratedDocument_') && file.endsWith('.pdf')) {
    //                 fs.unlinkSync(path.join(downloadFolder, file));
    //                 console.log(` Deleted old file: ${file}`);
    //             }
    //         }


    //         // ======================================
    //         // SAVE PDF LOCALLY
    //         // ======================================

    //        // const downloadFolder = 'C:\\DS_playwright-test 1\\Documents';

    //         const fileName = `GeneratedDocument_${Date.now()}.pdf`;
    //         const filePath = path.join(downloadFolder, fileName);

    //         // Convert base64 → buffer
    //         const pdfBuffer = Buffer.from(base64Data, 'base64');

    //         // Save file
    //         fs.writeFileSync(filePath, pdfBuffer);

    //       //  console.log(`✅ PDF saved at: ${filePath}`);

    //         await newPage.close();
    //         await page.bringToFront();
    //         await page.reload();


            // DOWNLOAD DOCUMENT
       // Headless Chromium has no built-in PDF viewer: clicking the link fires a
       // "download" event instead of opening a viewable tab. Handle BOTH cases.
    // ======================================
            // DOWNLOAD DOCUMENT
            // ======================================
            // Re-locate inside this block so it's self-contained and always in scope.
            const generatedDocLink = page.locator('a.name-link', { hasText: 'Generated Document' });

            // Headless Chromium has no built-in PDF viewer: clicking the link fires a
            // "download" event instead of opening a viewable tab. Handle BOTH cases.
            let base64Data = '';

            // Arm both listeners BEFORE the click; the unused one just times out -> null.
            const popupPromise = page.context()  .waitForEvent('page', { timeout: 7000 }) .catch(() => null);
            const downloadPromise = page .waitForEvent('download', { timeout: 7000 }) .catch(() => null);

            await generatedDocLink.click();

            const [popup, download] = await Promise.all([popupPromise, downloadPromise]);

            if (download) {
                // Headless path: link triggered a file download
                const tmpPath = await download.path();
                base64Data = fs.readFileSync(tmpPath).toString('base64');
            } else if (popup) {
              // Headed path: PDF opened in a new tab, usually as a blob: URL.
            // blob: URLs only exist inside the browser, so page.request.get()
            // can't reach them — fetch in-page via evaluate instead.
            await popup.waitForLoadState('domcontentloaded').catch(() => {});

            base64Data = await popup.evaluate(async () => {
                const response = await fetch(window.location.href);
                const blob = await response.blob();
                return await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => {
                        const result = reader.result?.toString().split(',')[1];
                        resolve(result || '');
                    };
                    reader.onerror = reject;
                });
            });
                await popup.close();
            } else {
                throw new Error('Document click produced neither a download nor a new tab.');
            }

            if (!base64Data) {
                throw new Error('Failed to capture PDF bytes from the generated document.');
            }

            // ======================================
            // CLEAN OLD FILES (SAFE PLACE: AFTER SUCCESS)
            // ======================================
            const downloadFolder = 'C:\\DS_playwright-test 1\\Documents';
            const files = fs.readdirSync(downloadFolder);

            for (const file of files) {
                if (file.startsWith('GeneratedDocument_') && file.endsWith('.pdf')) {
                    fs.unlinkSync(path.join(downloadFolder, file));
                    console.log(`✅ Deleted old file: ${file}`);
                }
            }

            // ======================================
            // SAVE PDF LOCALLY
            // ======================================
            const fileName = `GeneratedDocument_${Date.now()}.pdf`;
            const filePath = path.join(downloadFolder, fileName);

            // Convert base64 -> buffer
            const pdfBuffer = Buffer.from(base64Data, 'base64');

            // Save file
            fs.writeFileSync(filePath, pdfBuffer);

           //console.log(`✅ PDF saved at: ${filePath}`);

            // Return focus to the main page
            await page.bringToFront();
            await page.reload();

            console.log("");
            console.log("\x1b[1mSent For Signing:\x1b[0m"); 

            // Batching
            await page.locator('span.title').nth(5).click();
            await page.waitForTimeout(1500);

            //Sent For Signing
            await page.locator('a[href="/app/internal/assignments/batching/sent-for-signing"]').click();
            await page.waitForTimeout(1500);

            //Search for Order
            await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);    
            // //Order selected : Ingest Signed Documents
            // await page.locator('div.ag-selection-checkbox input[type="checkbox"]').click(); 
            // await page.locator('button[mattooltip="Ingest Signed Documents"]').click();
            // await page.waitForTimeout(1500); 

            //Action 
            await page.locator('div[col-id="actions"]').nth(1).click();
            await page.locator('span[class="mat-mdc-menu-item-text"]').nth(0).click();
            await page.waitForTimeout(1500);

            //Upload file
            await page.locator('input[type="file"]').setInputFiles(filePath);
           // console.log('✅ File uploaded successfully');
            await page.locator('div[class="d-flex footer"]').click();
            await page.waitForTimeout(1500);
            //Toaster message 
            const toastMessage_fileuploaded = await page.locator('span[class="toast-message"]').innerText();
            console.log(`✅ ${toastMessage_fileuploaded}`);

            //Search by Order ID or Customer ID
            await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);  
            await page.keyboard.press('Enter');
            await page.locator('div[col-id="orderId"]').nth(1).click(); 
            await page.waitForTimeout(1500); 

            // Open history modal
            await page.locator('button[mattooltip="History"]').click();
            await page.waitForSelector('.ag-center-cols-container');
            // Verify SENT FOR SIGNING -> RECEIVED FROM SIGNING
            await expect(
                page.locator('.ag-center-cols-container div[role="row"]')
                    .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
                    .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^SENT FOR SIGNING$/ }) })
                    .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^RECEIVED FROM SIGNING$/ }) })
            ).toBeVisible();

            console.log("✅ Verified History: SENT FOR SIGNING -> RECEIVED FROM SIGNING");
            // Close history modal
            await page.locator('i[class="ri-close-fill"]').click();
            await page.waitForTimeout(1500);


            //Documents
            await page.locator('a[href*="/documents"]').click();
            await page.waitForTimeout(1500);

             const imageCount = await page.locator('[col-id="documentType"]').filter({ hasText: 'To Be Recorded Image' }).count();

            if (imageCount > 0) {
                console.log('✅ To Be Recorded Image document found.');
            } else {
                console.log('❌ To Be Recorded Image document not found.');
            }


            console.log("");
            console.log("\x1b[1mReceived from Signing:\x1b[0m"); 

            // //Batching 
            // await page.locator('span[class="title"]').nth(5).click();
            // await page.waitForTimeout(1500);   
            //Received from Signing
            await page.locator('a[href="/app/internal/assignments/batching/received-from-signing"]').click();
            await page.waitForTimeout(1500);
            //Search for Order
            await page.locator('input[placeholder="Search keyword"]').fill( CustomerOrder);
            await page.waitForTimeout(1500);   
            //Order selected : Ingest Signed Documents
            await page.locator('div.ag-selection-checkbox input[type="checkbox"]').click(); 
            await page.locator('button[mattooltip="Send for Recording"]').click();
            await page.waitForTimeout(1500); 

            //Toaster message 
            const toastMessage_ReceivedfromSigning = await page.locator('span[class="toast-message"]').innerText();
            console.log(`✅ ${toastMessage_ReceivedfromSigning}`);

             //Search by Order ID or Customer ID
            await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);  
            await page.keyboard.press('Enter');
            await page.locator('div[col-id="orderId"]').nth(1).click(); 
            await page.waitForTimeout(1500); 

            // Open history modal
            await page.locator('button[mattooltip="History"]').click();
            await page.waitForSelector('.ag-center-cols-container');
            // Verify RECEIVED FROM SIGNING -> SENT FOR RECORDING
            await expect(
                page.locator('.ag-center-cols-container div[role="row"]')
                    .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
                    .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^RECEIVED FROM SIGNING$/ }) })
                    .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^SENT FOR RECORDING$/ }) })
            ).toBeVisible();

            console.log("✅ Verified History: RECEIVED FROM SIGNING -> SENT FOR RECORDING");
            // Close history modal
            await page.locator('i[class="ri-close-fill"]').click();
            await page.waitForTimeout(1500);

            console.log("");
            console.log("\x1b[1mRecordation Monitoring:\x1b[0m"); 
            //Recordation Monitoring
            await page.locator('span[class="title"]').nth(6).click();
            await page.waitForTimeout(1500); 
            await page.locator('a[href="/app/internal/assignments/recordation/recordation-monitoring"]').click();
            await page.waitForTimeout(1500);
            //Search for Order
            await page.locator('input[placeholder="Search keyword"]').fill( CustomerOrder);
            await page.waitForTimeout(1500);
             //Action Button
            await page.locator('div[col-id="actions"]').nth(1).click();
            await page.waitForTimeout(1500); 
            //Reject Order
            await page.locator('button:has-text(" Reject ")').click();
            await page.waitForTimeout(1500);
            //Severity 
            await page.locator('div[class="col-md-12 ng-star-inserted"]').nth(0).click();
            await page.waitForTimeout(1500);
            await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
            //Issue Type
            await page.locator('div[class="col-md-12 ng-star-inserted"]').nth(1).click();
            await page.waitForTimeout(1500);
            await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
            await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
            await page.locator('span[class="mdc-list-item__primary-text"]').nth(3).click();
            await page.keyboard.press('Tab');
            
            //Notes
            await page.locator('textarea[formcontrolname="note"]').click();
            await page.locator('textarea[formcontrolname="note"]').fill('Testing Reject Order');
            await page.waitForTimeout(1500);
            //Submit
            await page.locator('button:has-text("Submit")').click();
            await page.waitForTimeout(1500);
            //Toaster message
            const toastMessage_RejectOrder = await page.locator('span[class="toast-message"]').innerText();
            console.log(`✅ Order moved to reject queue successfully.${toastMessage_RejectOrder}`);

            //Reject Queue
            await page.locator('span[class="title"]').nth(4).click();
            await page.locator('a[href="/app/internal/assignments/quality-control/rejects"]').click();
            await page.waitForTimeout(1500);
            //Search for Order
            await page.locator('input[placeholder="Search keyword"]').fill( CustomerOrder);
            await page.waitForTimeout(1500);
            //  //Action Button
            // await page.locator('div[col-id="actions"]').nth(1).click();
            // await page.waitForTimeout(1500); 
            // //Update Order
            // await page.locator('button:has-text(" Update ")').click();
            // await page.waitForTimeout(1500);

            console.log("");
            console.log("\x1b[1mEmail:\x1b[0m"); 

});    

test.afterAll(async ({}, testInfo) => {
    const results = getResults();
    const baseURL =
        testInfo.project.use.baseURL ||
        'https://dev-outamateds.outamationlabs.com/';
    await sendMail(results, baseURL);
});
