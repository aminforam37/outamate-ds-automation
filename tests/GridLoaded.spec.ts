import { test, expect } from '@playwright/test';
import { addResult, getResults, getSrCounter, incrementSrCounter  } from '../resultsCollector'; 
import { sendMail } from '../mail';
import { faker } from '@faker-js/faker/locale/en';
import { getCustomerOrder } from '../Variable';
const fs = require('fs');
const path = require('path');

test(' Grid Loaded ', async ({ page }) => {


    await page.goto('/app/internal/lien-release/dashboard/order-status');
    await page.waitForTimeout(1500);
    await page.locator('h6[class="module-title"]').nth(2).click();
    await page.waitForTimeout(1500);

//     // Order Entry
//     await page.locator('mat-expansion-panel-header', { hasText: 'Order Entry' }).click({ force: true });
//     await page.waitForTimeout(500);  

//     //All Orders Grid
//     const allOrdersGridItem = page.locator('a[href="/app/internal/lien-release/order-stage/orders"]').click();
//     await page.waitForTimeout(1500);  


//     // 2. Wait for the main grid container to be visible
//   const gridContainer = page.locator('.ag-root-wrapper, [role="grid"]');
//   await expect(gridContainer).toBeVisible({ timeout: 15000 });

//   // 3. Ensure no common error keywords are visible on the page/grid
//   const errorText = page.locator('text=/error|failed|unable to load/i');
//   await expect(errorText).not.toBeVisible();

//   // 4. Verify that data rows have successfully rendered inside the grid
//   // In AG Grid, rows typically have the class 'ag-row'
//  const gridRows = page.locator('.ag-center-cols-container .ag-row[row-index]');
  
//   // Wait for at least one row to load to confirm it isn't an empty grid
//   await expect(gridRows.first()).toBeVisible({ timeout: 10000 });

//  // 5. Verify and log the visible row count
//   const visibleRowCount = await gridRows.count();
//   expect(visibleRowCount).toBeGreaterThan(0);
//   console.log(`Grid loaded successfully! Visible rows on this page: ${visibleRowCount}`);

//   // 6. Robust Pagination Check
//   // Finds the pagination panel container and ensures it matches the standard "X to Y of Z" format
//   const paginationLabel = page.locator('.ag-paging-panel').getByText(/1 to \d+ of \d+/);
  
//   if (await paginationLabel.count() > 0) {
//     await expect(paginationLabel).toBeVisible();
//     const paginationText = await paginationLabel.innerText();
//     console.log(`Pagination confirmation: "${paginationText.trim()}"`);
//   }

            //Search by Order ID or Customer ID
            await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill('ODS-070901');
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

//    // VERIFICATION PLACE 1: HOLD to KEYING IN PROGRESS

//    // Open history modal (adjust selector if your history button is named differently)
//    await page.locator('button[mattooltip="History"]').click();
//    await page.waitForSelector('.ag-center-cols-container'); // Wait for ag-Grid to load

//    // Assert that the HOLD -> KEYING IN PROGRESS entry exists
//    try {
//     await expect(
//      page.locator('.ag-center-cols-container div[role="row"]')
//        .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
//        .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^HOLD$/ }) })
//        .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^KEYING IN PROGRESS$/ }) })).toBeVisible();

//         console.log("✅ Verified History: HOLD -> KEYING IN PROGRESS");
//     } catch (error) {
//         console.log("❌ Failed History: HOLD -> KEYING IN PROGRESS transition not found.");
//     // Throws a normal Playwright failure to halt the test without calling addResult()
//      //   throw new Error("History Validation Failed: HOLD -> KEYING IN PROGRESS transition not found.");
//     }


//    // Close the history modal to resume the test flow (adjust selector for your close cross/button)
//     await page.locator('i[class="ri-close-fill"]').click();
//     await page.waitForTimeout(1500);


   // Keying tab
    await page.getByRole('link', { name: 'keyboard Keying' }).click();
    await page.waitForTimeout(1500); 


    // Keying Page Validation
    const keyingPageUrl = page.url();
   console.log("Keying Page URL:", keyingPageUrl);
    // Match keying page URLi dont
    const hasOrderDataText = await page.locator('h5:has-text("Order Data"), div:has-text("Order Data")').first().isVisible().catch(() => false);
    console.log("Order Data Section Visible:", hasOrderDataText);
    const isKeyingPage =  /\/app\/internal\/lien-release\/orders\/\d+\/keying/.test(keyingPageUrl) && hasOrderDataText ;
     const reportBase1 = getSrCounter();
    if (isKeyingPage) {

        addResult({
            product: "LRP",
            srNo: getSrCounter().toString(),
            module: 'Keying',
            status: 'Pass',
            URL: `<a href="${keyingPageUrl}#order-data">Keying</a>`
        });

        console.log( "✅ Keying page opened successfully.");

    } else {

        addResult({
            product: "LRP",
            srNo: getSrCounter().toString(),
            module: 'Keying',
            status:  'Fail',
            URL: `<a href="${keyingPageUrl}#order-data">Keying</a>`
        });

        console.log("❌ Keying page validation failed.");
    }
    
    //Document Information 
    await page.locator('div[data-section-code="DocumentInformation"]').nth(0).click();
    await page.waitForTimeout(1000);
    const InstName = await page.locator('span[class="mdc-list-item__primary-text"]').nth(4);
    const InstrumentName = await InstName.innerText();
    await InstName.click();
    
    
    await page.waitForTimeout(1000);
    //BorrowerName
    const BorrowerName = faker.person.firstName();
    await page.getByLabel('Borrower(s) Name').fill(BorrowerName);
    await page.waitForTimeout(1000);
    //InstrumentDateKeying
    await page.locator('button[aria-label="Open calendar"]').nth(2).click();
    await page.waitForTimeout(1000);
    const InstrumentDateKeying = await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Maturity
    await page.locator('button[aria-label="Open calendar"]').nth(3).click();
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
    //Trustee Name 
    const TrusteeName = faker.person.firstName();
    await page.locator('input[id="trustee_DI110"]').fill(TrusteeName);
    await page.waitForTimeout(1500);
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
    await page.locator('button[aria-label="Open calendar"]').nth(4).click();
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
    await page.locator('div[data-section-code="DocumentInformation"]').nth(20).click();
    await page.waitForTimeout(1500);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1500);
    //BorrowerName
    const BorrowerName2 = faker.person.firstName();
    await page.getByLabel('Borrower(s) Name').nth(1).fill(BorrowerName2);
    await page.waitForTimeout(1500);
    //InstrumentDateKeying
    await page.locator('button[aria-label="Open calendar"]').nth(5).click();
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
    await page.locator('button[aria-label="Open calendar"]').nth(6).click();
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
    await page.locator('div[data-field-key="recording_type_RC_LRP"]').click();
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

    //Trustee info
    await page.locator('[class="mat-mdc-radio-button mat-accent mat-mdc-radio-checked"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-button__label"]').nth(11).click();

    //Bene 
    await page.locator('button[mattooltip="Beneficiary Search"]').click();
    await page.waitForTimeout(1000);
    //Bene Assignor
    await page.locator('input[placeholder="Beneficiary"]').fill('S');
    //Search 
    await page.locator('span[class="mat-mdc-button-persistent-ripple mdc-button__ripple"]').nth(5).click();
    await page.locator('div[class="mdc-radio"]').nth(2).click();
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
    await page.locator('a[href="/app/internal/lien-release/quality-control/quality-check"]').click();
    await page.waitForTimeout(1500);  
    //Search with Customer Order Number
    await page.locator('input[placeholder="Search keyword"]').fill('ODS-070901');                          
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
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(3).click();
    await page.waitForTimeout(1500);
    //BorrowerName
    const BorrowerName3 = faker.person.firstName();
    await page.getByLabel('Borrower(s) Name').nth(2).fill(BorrowerName3);
    await page.waitForTimeout(1500);
    //InstrumentDateKeying
    await page.locator('button[aria-label="Open calendar"]').nth(9).click();
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
    // //Trustee Name 
    // const TrusteeName3 = faker.person.firstName();
    // await page.locator('input[id="trustee_DI310"]').fill(TrusteeName3);
    // await page.waitForTimeout(1500);
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
    await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill('ODS-070901');
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
     console.log("Documents Page URL:", documentsPageUrl);

    // Match documents page URL
    const isDocumentsPage =  /\/app\/internal\/lien-release\/orders\/\d+\/documents/.test(documentsPageUrl);

    if (isDocumentsPage) {

        addResult({
            product: "LRP",
            srNo: `${reportBase1}.1`,
            module: 'Keying Document - Verification',
            status: 'Pass',
            URL: `<a href="${documentsPageUrl}">Keying Document - Verification</a>`
        });

        console.log("✅ DocGen successfully.");

    } else {

        addResult({
            product: "LRP",
            srNo: `${reportBase1}.1`,
            module: 'Keying Document - Verification',
            status: 'Fail',
            URL: `<a href="${documentsPageUrl}">Keying Document - Verification</a>`
        });

        console.log("❌ DocGen validation failed.");
    }

    //Mandatory Days hold
    await page.locator('span[class="title"]').nth(8).click();    
    await page.waitForTimeout(1500);
    await page.locator('a[href="/app/internal/lien-release/customer-support/mandatory-days-hold"]').click();
    //Search with Customer Order Number
    await page.locator('input[placeholder="Search keyword"]').fill('ODS-070901');
    await page.waitForTimeout(1500);  

     //Action menu
    await page.locator('button[aria-label="Actions"]').click();
    await page.waitForTimeout(1000);
    //Complete Batch : Bypass Hold
    await page.locator('span[class="mat-mdc-menu-item-text"]').nth(0).click();
    await page.waitForTimeout(1000);
    //Notes 
    await page.locator('textarea[formcontrolname="note"]').fill('Bypass Hold');
    await page.locator('button:has-text(" Submit ")').click();
    await page.waitForTimeout(1500);

    //Search by Order ID or Customer ID
    await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill('ODS-070901');
    await page.waitForTimeout(1500);  
    await page.keyboard.press('Enter');
    await page.locator('div[col-id="orderId"]').nth(1).click(); 
    await page.waitForTimeout(1500); 



     console.log("");
    console.log("\x1b[1mKeying Details Verification:\x1b[0m"); 
    await page.reload();
    
    await page.getByRole('link', { name: 'keyboard Keying' }).click();
    await page.waitForTimeout(1500); 

     
         const extractLender = (val: string) => {
        const match = val.match(/FOR\s(.+?)\s*,/i);
        return match ? match[1].trim() : val;
    };
//const normalize = (val: any) => typeof val === "number"? Number(val).toFixed(2): String(val ?? "").replace(/\s+/g, " ") .replace(/&amp;/g, "&") .trim() .toLowerCase();

//New added
        const normalize = (val: any) =>
    typeof val === "number"? Number(val).toFixed(2)  : !isNaN(Number(String(val ?? "").replace(/[$,]/g, "").trim()))   ? Number(String(val ?? "").replace(/[$,]/g, "").trim()).toFixed(2)
            : String(val ?? "")
                  .replace(/\s+/g, " ")
                  .replace(/&amp;/g, "&")
                  .trim()
                  .toLowerCase();

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

          const verificationUrl =  page.url();
          console.log("Verification URL:", verificationUrl);
          const clickableVer = '<a href="' + verificationUrl + '#order-data" target="_blank">Keying Details</a>';
          addResult({
            product: "LRP",
            srNo: `${reportBase1}.2`,
            module: 'Keying Details - Verification',
            status: 'Pass',
            URL: clickableVer
          });

    } else {
        console.log("❌ Order field verification failed. One or more fields have incorrect or missing values.");

        const failedVerificationUrl =  page.url();
        const clickableVer = '<a href="' + failedVerificationUrl + '#order-data" target="_blank">Keying Details</a>';
        addResult({
            product: "LRP",
          srNo: `${reportBase1}.2`,
          module: 'Keying Details - Verification ',
          status: 'Fail',
          URL: clickableVer
  });
    }
incrementSrCounter();
        
    //Search by Order ID or Customer ID
            await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill('ODS-070901');
            await page.waitForTimeout(1500);  
            await page.keyboard.press('Enter');
            await page.locator('div[col-id="orderId"]').nth(1).click(); 
            await page.waitForTimeout(1500);

 
            
        console.log('');
        console.log('\x1b[1mPOST RECORDING KEYING :\x1b[0m');
    

    //Process Order - Keying
    await page.locator('button[mattooltip="Process Order"]').click();
    await page.waitForTimeout(1500);
    await page.locator('button[aria-haspopup="menu"]').click();
    await page.locator('button:has-text("  POST RECORDING KEYING  ")').click();
    await page.waitForTimeout(1500);


    // VERIFICATION PLACE 2: QC COMPLETED -> POST RECORDING KEYING
    await page.locator('button[mattooltip="History"]').click();
     await page.waitForSelector('.ag-center-cols-container');

   // Assert that the QC COMPLETED -> POST RECORDING KEYING entry exists
   try{
   await expect(
     page.locator('.ag-center-cols-container div[role="row"]')
       .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
       .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^QC COMPLETED$/ }) })
       .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^POST RECORDING KEYING$/ }) }) ).toBeVisible();

        console.log("✅ Verified History: QC COMPLETED -> POST RECORDING KEYING");

    } catch (error) {

        console.log("❌ Failed History: QC COMPLETED -> POST RECORDING KEYING transition not found.");
        // Throws a normal Playwright failure to halt the test without calling addResult()
        throw new Error("History Validation Failed: QC COMPLETED -> POST RECORDING KEYING transition not found.");
    }

    // Close the history modal to finish the test case safely
    await page.locator('i[class="ri-close-fill"]').click();
    await page.waitForTimeout(1500);

    // Keying tab
    await page.getByRole('link', { name: 'keyboard Keying' }).click();
    await page.waitForTimeout(1500);     


        // Keying Page Validation
    const PRPageUrl = page.url();
   console.log("Post Recording Information:", PRPageUrl);
    // Match keying page URL
    const hasPostRecText = await page.locator('h5:has-text("Post Recording Information"), div:has-text("Post Recording Information")').first().isVisible().catch(() => false);
    const isKeyingPagePR =  /\/app\/internal\/lien-release\/orders\/\d+\/keying/.test(PRPageUrl) && hasPostRecText;
     const reportBase2 = getSrCounter();
    if (isKeyingPagePR) {

        addResult({
            product: "LRP",
            srNo: getSrCounter().toString(),
            module: 'Post Recording Information',
            status: 'Pass',
            URL: `<a href="${PRPageUrl}#post-recording-information" target="_blank">Post Recording Information</a>`
        });

        console.log("✅ Post Recording Information page opened successfully.");

    } else {

        addResult({
            product: "LRP",
            srNo: getSrCounter().toString(),
            module: 'Post Recording Information',
            status: 'Fail',
            URL: `<a href="${PRPageUrl}#post-recording-information" target="_blank">Post Recording Information</a>`
        });

        console.log("❌ Post Recording Information page validation failed.");
    }

    //Instrument Name
    await page.locator('div[data-field-key="instrument_Name_PR"]').click();
    await page.waitForTimeout(500);
    const InstNamePR = await page.locator('span[class="mdc-list-item__primary-text"]').nth(3);
    const PRI_InstrumentName = await InstNamePR.innerText();
    await InstNamePR.click();

    //BorrowerName
    const BorrowerNamePR = faker.person.firstName();
    await page.getByLabel('Borrower(s) Name').fill(BorrowerNamePR);
    await page.waitForTimeout(1000);

    //InstrumentDateKeying
    await page.locator('button[aria-label="Open calendar"]').nth(0).click();
    await page.waitForTimeout(1000);
    const today = new Date();
    const InstrumentDatePR = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`; // Formats exactly to "7/7/2026"
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
            
    //Consideration Amount
    const ConsiderationNumberPR = faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await page.getByLabel('Consideration Amount').fill(ConsiderationNumberPR);
    await page.waitForTimeout(1000);

    //Original Lender
    const OriginalLenderPR = faker.person.firstName();
    await page.locator('input[id="original_Lender_PR"]').fill(OriginalLenderPR);
    await page.waitForTimeout(1000);

    //Beneficiary Name
    const BeneficiaryNamePR = faker.person.firstName();
    await page.locator('input[id="beneficiary_PR"]').fill(BeneficiaryNamePR);
    await page.waitForTimeout(1000);
    
    //Beneficial Address
    const BeneficialAddressPR = faker.location.streetAddress();
    await page.locator('input[id="beneficiary_Address_PR"]').fill(BeneficialAddressPR);
    await page.waitForTimeout(1000);

    //Siging Line
    const SigingLinePR = faker.location.streetAddress();
    await page.locator('input[id="siging_Line_PR"]').fill(SigingLinePR);
    await page.waitForTimeout(1000);

    //Trustee Name
    const TrusteeNamePR = faker.person.firstName();
    await page.locator('input[id="trustee_PR"]').fill(TrusteeNamePR);
    await page.waitForTimeout(1000);

    //Save 
    await page.locator('button[mattooltip="Save"]').click();
    await page.waitForTimeout(1000);
    //Complete 
    await page.locator('button[mattooltip="Complete"]').click();
    await page.waitForTimeout(1000);

        console.log('');
        console.log('\x1b[1mPOST RECORDING QUALITY CHECK :\x1b[0m');


     await page.waitForTimeout(1500);

    //Search by Order ID or Customer ID
    await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(' ODS-070901');
    await page.waitForTimeout(1500);  
    await page.keyboard.press('Enter');
    await page.locator('div[col-id="orderId"]').nth(1).click(); 
    await page.waitForTimeout(1500);

    // VERIFICATION PLACE 2: POST RECORDING KEYING -> POST RECORDING QUALITY CHECK
    await page.locator('button[mattooltip="History"]').click();
     await page.waitForSelector('.ag-center-cols-container');

   // Assert that the POST RECORDING KEYING -> POST RECORDING QUALITY CHECK entry exists
   try{
   await expect(
     page.locator('.ag-center-cols-container div[role="row"]')
       .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
       .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^POST RECORDING KEYING$/ }) })
       .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^POST RECORDING QUALITY CHECK$/ }) }) ).toBeVisible();

        console.log("✅ Verified History: POST RECORDING KEYING -> POST RECORDING QUALITY CHECK");

    } catch (error) {

        console.log("❌ Failed History: POST RECORDING KEYING -> POST RECORDING QUALITY CHECK transition not found.");
        // Throws a normal Playwright failure to halt the test without calling addResult()
        throw new Error("History Validation Failed: POST RECORDING KEYING -> POST RECORDING QUALITY CHECK transition not found.");
    }

    // Close the history modal to finish the test case safely
    await page.locator('i[class="ri-close-fill"]').click();
    await page.waitForTimeout(1500);


    // Keying tab
    await page.getByRole('link', { name: 'keyboard Keying' }).click();
    await page.waitForTimeout(1500);  

    //Recorded State
    await page.locator('div[data-field-key="recorded_State_PR"]').click();
    await page.waitForTimeout(1000);
    const RdStatePR = await page.locator('span[class="mdc-list-item__primary-text"]').nth(0);
    const RecordedStatePR = await RdStatePR.innerText();
    await RdStatePR.click();
    await page.waitForTimeout(1000);
    //Recorded County 
    await page.locator('div[data-field-key="recorded_County_PR"]').click();
    await page.waitForTimeout(1000);
    const CountyPR = await page.locator('span[class="mdc-list-item__primary-text"]').nth(4);
    const RecordedCountyPR = await CountyPR.innerText();
    await CountyPR.click();
    await page.waitForTimeout(1000);
    //Recorded Agency
    await page.locator('div[data-field-key="recorded_Agency_PR"]').click(); 
    await page.waitForTimeout(1500);
    const AgencyPR = await page.locator('span[class="mdc-list-item__primary-text"]').nth(1);
    const RecordedAgencyPR = await AgencyPR.innerText();
    await AgencyPR.click();
    await page.waitForTimeout(1500);
    //Recorded Date
    await page.locator('button[aria-label="Open calendar"]').nth(1).click();
    await page.waitForTimeout(1500);
    const todayRec = new Date();
    const RecordedDatePR = `${todayRec.getMonth() + 1}/${todayRec.getDate()}/${todayRec.getFullYear()}`; // Formats exactly to "7/7/2026"
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Recorded Book
    const RecordedBookPR = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('input[id="recorded_Book_PR"]').fill(RecordedBookPR);
    await page.waitForTimeout(1000);
    //Recorded Page
    const RecordedPagePR = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('input[id="recorded_Page_PR"]').fill(RecordedPagePR);
    await page.waitForTimeout(1000);

    //Save 
    await page.locator('button[mattooltip="Save"]').click();
    await page.waitForTimeout(1000);
    //Complete 
    await page.locator('button[mattooltip="Complete"]').click();
    await page.waitForTimeout(1000);

    //Order Stage
    await page.locator('span[class="title"]').nth(3).click();
    await page.waitForTimeout(1500);  
    //Pending Delivery
    await page.locator('a[href="/app/internal/lien-release/order-stage/pending-delivery"]').click();
    await page.waitForTimeout(1000);
    //Search with Customer Order Number
    await page.locator('input[placeholder="Search keyword"]').fill('ODS-070901');
    await page.waitForTimeout(1500);  
    await page.locator('div[col-id="id"]').nth(1).click(); 
    await page.waitForTimeout(1500); 

    //Verify History for POST RECORDING QUALITY CHECK 
      console.log("");
    console.log("\x1b[1mPost Recording Verification:\x1b[0m"); 
    await page.reload();

    //Process Order - Post Recording Keying QC  
    await page.locator('button[mattooltip="Process Order"]').click();
    await page.waitForTimeout(1500);
    await page.locator('button[aria-haspopup="menu"]').click();
    await page.locator('button:has-text("   POST RECORDING QUALITY CHECK   ")').click();
    await page.waitForTimeout(1500);
    
    await page.getByRole('link', { name: 'keyboard Keying' }).click();
    await page.waitForTimeout(1500); 




    const PR_InstrumentName = (await page.locator('#instrument_Name_PR .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    const PR_instrumentDate = await page.$eval('#instrument_Date_PR', el => (el as HTMLInputElement).value);
    const PR_BorrowersName = await page.$eval('#borrower_PR', el => (el as HTMLInputElement).value);
    const PR_ConsiderationAmount = await page.$eval('#consideration_Amount_PR', el => (el as HTMLInputElement).value);
    const PR_OL = await page.$eval('#original_Lender_PR', el => (el as HTMLInputElement).value);
    const PR_Beneficiary = await page.$eval('#beneficiary_PR', el => (el as HTMLInputElement).value);
    const PR_BeneficiaryAddress = await page.$eval('#beneficiary_Address_PR', el => (el as HTMLInputElement).value);
    const PR_SigingLine = await page.$eval('#siging_Line_PR', el => (el as HTMLInputElement).value);
    const PR_Trustee = await page.$eval('#trustee_PR', el => (el as HTMLInputElement).value);
    const PR_RecordedState = (await page.locator('#recorded_State_PR .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    const PR_RecordedCounty = (await page.locator('#recorded_County_PR .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    const PR_RecordedAgency = (await page.locator('#recorded_Agency_PR .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    const PR_RecordedDate = await page.$eval('#recorded_Date_PR', el => (el as HTMLInputElement).value);   
    const PR_RecordedBook = await page.$eval('#recorded_Book_PR', el => (el as HTMLInputElement).value);
    const PR_RecordedPage = await page.$eval('#recorded_Page_PR', el => (el as HTMLInputElement).value);

      if (
            normalize(PRI_InstrumentName) === normalize(PR_InstrumentName) &&
            normalize(BorrowerNamePR) === normalize(PR_BorrowersName) &&
            normalize(InstrumentDatePR) === normalize(PR_instrumentDate) &&
            normalize(ConsiderationNumberPR) === normalize(PR_ConsiderationAmount) &&
            normalize(OriginalLenderPR) === normalize(PR_OL) &&
            normalize(BeneficiaryNamePR) === normalize(PR_Beneficiary) &&
            normalize(BeneficialAddressPR) === normalize(PR_BeneficiaryAddress) &&
            normalize(SigingLinePR) === normalize(PR_SigingLine) &&
            normalize(TrusteeNamePR) === normalize(PR_Trustee) &&
            normalize(RecordedStatePR) === normalize(PR_RecordedState) &&
            normalize(RecordedCountyPR) === normalize(PR_RecordedCounty) &&
            normalize(RecordedAgencyPR) === normalize(PR_RecordedAgency) &&
            normalize(RecordedDatePR) === normalize(PR_RecordedDate) &&
            normalize(RecordedBookPR) === normalize(PR_RecordedBook) &&
            normalize(RecordedPagePR) === normalize(PR_RecordedPage)
    ) {
        console.log("✅ All order fields verified successfully.");

          const verificationUrlPR =  page.url();
          console.log("Verification URL:", verificationUrlPR);
          const clickableVer = '<a href="' + verificationUrlPR + '#post-recording-information" target="_blank">Post Recording Information - Verification</a>';
          addResult({
            product: "LRP",
            srNo: `${reportBase2}.1`,
            module: 'Post Recording Information - Verification',
            status: 'Pass',
            URL: clickableVer
          });

    } else {
        console.log("❌ Order field verification failed. One or more fields have incorrect or missing values.");

        const failedVerificationUrlPR =  page.url();
        const clickableVer = '<a href="' + failedVerificationUrlPR + '#post-recording-information" target="_blank">Post Recording Information - Verification</a>';
        addResult({
            product: "LRP",
          srNo: `${reportBase2}.1`,
          module: 'Post Recording Information - Verification',
          status: 'Fail',
          URL: clickableVer
  });
    }
   
   
   



    const results = getResults();
     await sendMail(results);



      // console.log("Instrument Name:", normalize(PRI_InstrumentName), "==", normalize(PR_InstrumentName));
    // console.log("Borrower Name:", normalize(BorrowerNamePR), "==", normalize(PR_BorrowersName));
    // console.log("Instrument Date:", normalize(InstrumentDatePR), "==", normalize(PR_instrumentDate));
    // console.log("Consideration Amount:", normalize(ConsiderationNumberPR), "==", normalize(PR_ConsiderationAmount));
    // console.log("Original Lender:", normalize(OriginalLenderPR), "==", normalize(PR_OL));
    // console.log("Beneficiary:", normalize(BeneficiaryNamePR), "==", normalize(PR_Beneficiary));
    // console.log("Beneficiary Address:", normalize(BeneficialAddressPR), "==", normalize(PR_BeneficiaryAddress));
    // console.log("Signing Line:", normalize(SigingLinePR), "==", normalize(PR_SigingLine));
    // console.log("Trustee:", normalize(TrusteeNamePR), "==", normalize(PR_Trustee));
    // console.log("Recorded State:", normalize(RecordedStatePR), "==", normalize(PR_RecordedState));
    // console.log("Recorded County:", normalize(RecordedCountyPR), "==", normalize(PR_RecordedCounty));
    // console.log("Recorded Agency:", normalize(RecordedAgencyPR), "==", normalize(PR_RecordedAgency));
    // console.log("Recorded Date:", normalize(RecordedDatePR), "==", normalize(PR_RecordedDate));
    // console.log("Recorded Book:", normalize(RecordedBookPR), "==", normalize(PR_RecordedBook));
    // console.log("Recorded Page:", normalize(RecordedPagePR), "==", normalize(PR_RecordedPage));

});   




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

    
    
            //Search by Order ID or Customer ID
            await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder); //CustomerOrder
            await page.waitForTimeout(1500);  
            await page.keyboard.press('Enter');
            await page.locator('div[col-id="orderId"]').nth(1).click(); 
            await page.waitForTimeout(1500); 

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
        await page.waitForTimeout(1500);


            //Process Order
            await page.locator('button[mattooltip="Process Order"]').click();
            await page.waitForTimeout(1500);
            await page.locator('button:has-text("Move to...")').click();
            await page.locator('button:has-text("  PENDING ABS ASSIGN  ")').click();
            await page.waitForTimeout(1500);

        //Quotes & Assign ABS
            await page.getByRole('link', { name: ' Quotes & Assigned ABS ' }).click();
            await page.waitForTimeout(1500); 

        //Assign ABS
        await page.locator('button[aria-label="Assign ABS"]').click();
        await page.waitForTimeout(1500);

         // Assign ABS Validation
        const AssignABSUrl = page.url();
        // Match keying page URL
        const AssignABS =  /\/app\/internal\/research\/orders\/\d+\/request-quotes/.test(AssignABSUrl);
        //const reportBase1 = getSrCounter();
        if (AssignABS) {

            addResult({
                product: "Research",
                srNo: getSrCounter().toString(),
                module: 'Assign ABS',
                status: 'Pass',
                URL: `<a href="${AssignABSUrl}">Assign ABS</a>`
            });

            console.log("✅ Assign ABS page opened successfully.");

        } else {

            addResult({
                product: "Research",
                srNo: getSrCounter().toString(),
                module: 'Assign ABS',
                status: 'Fail',
                URL: `<a href="${AssignABSUrl}">Assign ABS</a>`
            });

            console.log("❌ Assign ABS page validation failed.");
        }


        //Abstractor fee
        await page.locator('input[formcontrolname="abstractorFee"]').fill("1000.25");
        await page.waitForTimeout(1500);
        //Upload Document
         // Resolve file paths
        const filePath1 = path.resolve('Documents/INDEX.pdf');

          if (!fs.existsSync(filePath1)) {
             console.log(`❌ File not found: ${filePath1}`);
        }

         const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser'),
            page.locator('[formcontrolname="attachments"]').click(),
            // Note: If clicking "Drag and drop files or click here" is required instead, use:
            // page.getByText('Drag and drop files').click()
        ]);
        await fileChooser.setFiles([filePath1]);
        await page.locator('button:has-text("Submit")').click();

        //Abstractor Name
        const AbstractorName = 'Outamation_Foram'
        await page.locator('div[class="mat-mdc-form-field-flex"]').nth(3).click();
        await page.waitForTimeout(1500);
        await page.getByRole('option', { name: AbstractorName  }).click();
        await page.waitForTimeout(1500);

        //Uncheck the Notify Via Email 
        await page.uncheck('[formcontrolname="isEmailNotification"] input');
        await page.waitForTimeout(1500);

       //Submit Assign ABS
        await page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-unthemed"]').nth(1).click();
        await page.waitForTimeout(1500);

    
            //Search bt OrderID
        const searchBar = page.locator('input[placeholder="Search by Order ID or Customer ID"]');
        await searchBar.click();
        await searchBar.fill('');
        await searchBar.pressSequentially(CustomerOrder, { delay: 100 });
        await searchBar.dispatchEvent('input');
        await page.keyboard.press('Enter');
        await page.locator('div[col-id="orderId"]').nth(1).click(); 
        await page.waitForTimeout(1500);

        
               // Open history modal
            await page.locator('button[mattooltip="History"]').click();
            await page.waitForSelector('.ag-center-cols-container');
            // Verify PENDING ABS ASSIGN -> ABS ASSIGNED
            await expect(
                page.locator('.ag-center-cols-container div[role="row"]')
                    .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
                    .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^PENDING ABS ASSIGN$/ }) })
                    .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^ABS ASSIGNED$/ }) })
            ).toBeVisible();

            console.log("✅ Verified History: PENDING ABS ASSIGN -> ABS ASSIGNED");
            // Close history modal
            await page.locator('i[class="ri-close-fill"]').click();
            await page.waitForTimeout(1500);
    
        //ABS Assigned
        await page.locator('span[class="title"]').nth(8).click();
        await page.waitForTimeout(1500);
        await page.locator('a[href="/app/internal/research/vendor-mgt/abs-assigned"]').click();
        await page.waitForTimeout(1500);
        await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);  

        //Verify details : ABS Assigned Grid
         //Verify Order Details
            const CustomerOrder_AssignedQueue = (await page.locator('div[col-id="customerNumber"]').nth(1).innerText()).trim();
            console.log("Customer Order in Assigned Queue: ", CustomerOrder_AssignedQueue);
            const CustomerName_AssignedQueue = (await page.locator('div[col-id="client"]').nth(1).innerText()).trim();
            console.log("Customer Name in Assigned Queue: ", CustomerName_AssignedQueue);
            const AbstractorName_AssignedQueue = (await page.locator('div[col-id="abstractor"]').nth(1).innerText()).trim();
            console.log("Abstractor Name in Assigned Queue: ", AbstractorName_AssignedQueue);

               const normalize = (val: any) => typeof val === "number"? Number(val).toFixed(2): String(val ?? "").replace(/\s+/g, " ") .replace(/&amp;/g, "&") .trim() .toLowerCase(); //New added

            if (normalize(CustomerOrder_AssignedQueue) === normalize(CustomerOrder) &&
                normalize(CustomerName_AssignedQueue) === normalize(CustomerName) && 
                normalize(AbstractorName_AssignedQueue) === normalize(AbstractorName))
            {
                console.log(`✅ Abstractor Name validation successful for Order ID: ${CustomerOrder_AssignedQueue}`);
            } else {        
                console.log(`❌ Abstractor Name validation failed. Order ID: ${CustomerOrder}`);
            }


       //Action Menu
       await page.locator('button[aria-label="Actions"]').click();
       await page.waitForTimeout(1500);
       await page.locator('button:has-text("Process Order")').click();
       await page.waitForTimeout(1500);
       await page.locator('button:has-text("Move to...")').click();
       await page.locator('button:has-text("   ABS CONFIRMED   ")').click();
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
     // Verify ABS ASSIGNED -> ABS CONFIRMED
    await expect(
                        page.locator('.ag-center-cols-container div[role="row"]')
                    .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
                    .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^ABS ASSIGNED$/ }) })
                    .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^ABS CONFIRMED$/ }) })
            ).toBeVisible();

            console.log("✅ Verified History: ABS ASSIGNED -> ABS CONFIRMED");
            // Close history modal
            await page.locator('i[class="ri-close-fill"]').click();
            await page.waitForTimeout(1500);

        //ABS Confirmed
        await page.locator('a[href="/app/internal/research/vendor-mgt/abs-confirmed"]').click();
        await page.waitForTimeout(1500);
        await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);  
       //Action Menu
       await page.locator('button[aria-label="Actions"]').click();
       await page.waitForTimeout(1500);
       await page.locator('button:has-text("Process Order")').click();
       await page.waitForTimeout(1500);
        await page.locator('button:has-text("Move to...")').click();
        await page.locator('button:has-text("    RECEIVED FROM ABS    ")').click();
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
     // Verify ABS CONFIRMED -> RECEIVED FROM ABS
    await expect(
                        page.locator('.ag-center-cols-container div[role="row"]')
                    .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
                    .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^ABS CONFIRMED$/ }) })
                    .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^RECEIVED FROM ABS$/ }) })
            ).toBeVisible();

            console.log("✅ Verified History: ABS CONFIRMED -> RECEIVED FROM ABS");
            // Close history modal
            await page.locator('i[class="ri-close-fill"]').click();
            await page.waitForTimeout(1500);

    //ABS Confirmed
        await page.locator('a[href="/app/internal/research/vendor-mgt/received-from-abs"]').click();
        await page.waitForTimeout(1500);
        await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);  
       //Action Menu
       await page.locator('button[aria-label="Actions"]').click();
       await page.waitForTimeout(1500);
       await page.locator('button:has-text("Process Order")').click();
       await page.waitForTimeout(1500);
       await page.locator('button:has-text("Move to...")').click();
       await page.getByRole('menuitem', { name: 'QUALITY CHECK', exact: true }).click();
       await page.waitForTimeout(1500);
        

        //Quality Check
        await page.locator('span[class="title"]').nth(6).click();
        await page.waitForTimeout(1500);
        await page.locator('a[href="/app/internal/research/quality-control/quality-check"]').click();
        await page.waitForTimeout(1500);
        await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);
        
        //Action Menu
       await page.locator('button[aria-label="Actions"]').click();
       await page.waitForTimeout(1500);
       await page.locator('span[class="menu-label"]').nth(1).click();
       await page.waitForTimeout(1500);
       //Move Order to ABS Reject Queue
        //Severity 
        await page.locator('div[class="mat-mdc-form-field-flex"]').nth(1).click();
        await page.waitForTimeout(1500);
        await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
        //Issue Type
        await page.locator('div[class="mat-mdc-form-field-flex"]').nth(2).click();
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

        //Search by Order ID or Customer ID
        await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);  
        await page.keyboard.press('Enter');
        await page.locator('div[col-id="orderId"]').nth(1).click(); 
        await page.waitForTimeout(1500);

        // Open history modal   
        await page.locator('button[mattooltip="History"]').click(); 
        await page.waitForSelector('.ag-center-cols-container');
         // Verify QUALITY CHECK -> ABS REJECTS
        await expect(
                        page.locator('.ag-center-cols-container div[role="row"]')
                    .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
                    .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^QUALITY CHECK$/ }) })
                    .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^ABS REJECTS$/ }) })
            ).toBeVisible();

            console.log("✅ Verified History: QUALITY CHECK -> ABS REJECTS");
            // Close history modal
            await page.locator('i[class="ri-close-fill"]').click();
            await page.waitForTimeout(1500);

            //ABS Rejects
            await page.locator('span[class="title"]').nth(8).click();
            await page.waitForTimeout(1500);
            await page.locator('a[href="/app/internal/research/vendor-mgt/abs-rejects"]').click();
            await page.waitForTimeout(1500);
            await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);
            //Open the order
            await page.locator('div[col-id="orderId"]').nth(1).click(); 
            await page.waitForTimeout(1500);

            //Process Order
            await page.locator('button[mattooltip="Process Order"]').click();
            await page.waitForTimeout(1500);
            await page.locator('button:has-text("Move to...")').click();
            await page.locator('button:has-text("   PENDING ABS ASSIGN  ")').click();
            await page.waitForTimeout(1500);
            //Quotes & Assign ABS
            await page.getByRole('link', { name: ' Quotes & Assigned ABS ' }).click();
            await page.waitForTimeout(1500);
            //Quotes
            await page.locator('button[aria-label="Quotes Request"]').click();
            await page.waitForTimeout(1500);
            //Abstractor list
            await page.locator('div[class="mat-mdc-form-field-flex"]').nth(2).click();
            await page.waitForTimeout(1500);
            await page.getByRole('option', { name: 'Outamation_hepin' }).click();
            await page.waitForTimeout(1500);
            await page.keyboard.press('Tab');
            await page.locator('button:has-text("Submit")').click();
            await page.waitForTimeout(1500);
              
            //Verify details : Quotes Review Grid
            // await page.locator('span[class="title"]').nth(8).click();
            // await page.waitForTimeout(1500);
            await page.locator('a[href="/app/internal/research/vendor-mgt/quotes-review"]').click();
            await page.waitForTimeout(1500);
            await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);
            //Verify Order Details
            const CustomerOrder_QRQueue = (await page.locator('div[col-id="customerNumber"]').nth(1).innerText()).trim();
            // console.log("Customer Order in Hold Queue: ", CustomerOrder_HoldQueue);
            const CustomerName_QRQueue = (await page.locator('div[col-id="client"]').nth(1).innerText()).trim();
            //console.log("Customer Name in Hold Queue: ", CustomerName_HoldQueue);
           
            

            if (normalize(CustomerOrder_QRQueue) === normalize(CustomerOrder)
                && normalize(CustomerName_QRQueue) === normalize(CustomerName)) 
            {
                console.log(`✅ Quotes Review Grid validation successful for Order ID: ${CustomerOrder_QRQueue}`);
            } else {        
                console.log(`❌ Quotes Review Grid validation failed. Order ID: ${CustomerOrder}`);
            }
         
            // const searchInput = page.locator('input[placeholder="Search keyword"]');
            // await searchInput.clear();
            // await searchInput.fill(CustomerOrder);
            // await page.waitForTimeout(1500);
            // await page.locator('div[col-id="customerNumber"]').nth(1).click();
            // await page.waitForTimeout(1500);

            //Search by Order ID or Customer ID
            await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);  
            await page.keyboard.press('Enter');
            await page.locator('div[col-id="orderId"]').nth(1).click(); 
            await page.waitForTimeout(1500); 

            //Quotes & Assign ABS
            await page.getByRole('link', { name: ' Quotes & Assigned ABS ' }).click();
            await page.waitForTimeout(1500);


            //Action Menu
            await page.locator('button[aria-label="Actions"]').nth(1).click();
            await page.waitForTimeout(1500);
            //Click on Edit 
            await page.locator('button[role="menuitem"]').click();
            await page.waitForTimeout(1500);  
            //Quotes & Assign
            await page.locator('input[formcontrolname="quote"]').fill("1000.25");  
            await page.waitForTimeout(1500); 
            //ETA
            await page.locator('button[aria-label="Open calendar"]').nth(0).click();
            await page.waitForTimeout(1000);
            await page.locator('.mat-calendar-body-today').click();
            await page.waitForTimeout(1000);
            //Received Date
            await page.locator('button[aria-label="Open calendar"]').nth(1).click();
            await page.waitForTimeout(1000);
            await page.locator('.mat-calendar-body-today').click();
            await page.waitForTimeout(1000);        
            //Submit
            await page.locator('button:has-text("Submit")').click();
            await page.waitForTimeout(1500);
            //Click on Assign
            await page.getByRole('link', { name: 'Assign', exact: true }).click();
            await page.waitForTimeout(1500);
            //Send Assignement Email
            await page.locator('button:has-text("Cancel")').click();
            await page.waitForTimeout(1500);

                  //Search bt OrderID
            const searchBarQR = page.locator('input[placeholder="Search by Order ID or Customer ID"]');
            await searchBarQR.click();
            await searchBarQR.fill('');
            await searchBarQR.pressSequentially(CustomerOrder, { delay: 100 });
            await searchBarQR.dispatchEvent('input');
            await page.keyboard.press('Enter');
            await page.locator('div[col-id="orderId"]').nth(1).click(); 
            await page.waitForTimeout(1500);

        
               // Open history modal
            await page.locator('button[mattooltip="History"]').click();
            await page.waitForSelector('.ag-center-cols-container');
            // Verify PENDING ABS ASSIGN -> ABS ASSIGNED
            await expect(
                page.locator('.ag-center-cols-container div[role="row"]')
                    .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
                    .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^PENDING ABS ASSIGN$/ }) })
                    .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^ABS ASSIGNED$/ }) })
            ).toBeVisible();

            console.log("✅ Verified History: PENDING ABS ASSIGN -> ABS ASSIGNED");
            // Close history modal
            await page.locator('i[class="ri-close-fill"]').click();
            await page.waitForTimeout(1500);
    
        //ABS Assigned
        await page.locator('span[class="title"]').nth(8).click();
        await page.waitForTimeout(1500);
        await page.locator('a[href="/app/internal/research/vendor-mgt/abs-assigned"]').click();
        await page.waitForTimeout(1500);
        await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);  


       //Action Menu
       await page.locator('button[aria-label="Actions"]').click();
       await page.waitForTimeout(1500);
       await page.locator('button:has-text("Process Order")').click();
       await page.waitForTimeout(1500);
       await page.locator('button:has-text("Move to...")').click();
       await page.locator('button:has-text("   ABS CONFIRMED   ")').click();
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
     // Verify ABS ASSIGNED -> ABS CONFIRMED
    await expect(
                        page.locator('.ag-center-cols-container div[role="row"]')
                    .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
                    .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^ABS ASSIGNED$/ }) })
                    .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^ABS CONFIRMED$/ }) })
            ).toBeVisible();

            console.log("✅ Verified History: ABS ASSIGNED -> ABS CONFIRMED");
            // Close history modal
            await page.locator('i[class="ri-close-fill"]').click();
            await page.waitForTimeout(1500);

        //ABS Confirmed
        await page.locator('a[href="/app/internal/research/vendor-mgt/abs-confirmed"]').click();
        await page.waitForTimeout(1500);
        await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);  
       //Action Menu
       await page.locator('button[aria-label="Actions"]').click();
       await page.waitForTimeout(1500);
       await page.locator('button:has-text("Process Order")').click();
       await page.waitForTimeout(1500);
        await page.locator('button:has-text("Move to...")').click();
        await page.locator('button:has-text("    RECEIVED FROM ABS    ")').click();
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
        // Verify ABS CONFIRMED -> RECEIVED FROM ABS
        await expect(
                        page.locator('.ag-center-cols-container div[role="row"]')
                    .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
                    .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^ABS CONFIRMED$/ }) })
                    .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^RECEIVED FROM ABS$/ }) })
            ).toBeVisible();

            console.log("✅ Verified History: ABS CONFIRMED -> RECEIVED FROM ABS");
            // Close history modal
            await page.locator('i[class="ri-close-fill"]').click();
            await page.waitForTimeout(1500);

    //ABS Confirmed
        await page.locator('a[href="/app/internal/research/vendor-mgt/received-from-abs"]').click();
        await page.waitForTimeout(1500);
        await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);  
       //Action Menu
       await page.locator('button[aria-label="Actions"]').click();
       await page.waitForTimeout(1500);
       await page.locator('button:has-text("Process Order")').click();
       await page.waitForTimeout(1500);
       await page.locator('button:has-text("Move to...")').click();
       await page.getByRole('menuitem', { name: 'QUALITY CHECK', exact: true }).click();
       await page.waitForTimeout(1500);
        

        //Quality Check
        await page.locator('span[class="title"]').nth(6).click();
        await page.waitForTimeout(1500);
        await page.locator('a[href="/app/internal/research/quality-control/quality-check"]').click();
        await page.waitForTimeout(1500);
        await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);
        
        //Action Menu
       await page.locator('button[aria-label="Actions"]').click();
       await page.waitForTimeout(1500);
       await page.locator('span[class="menu-label"]').nth(1).click();
       await page.waitForTimeout(1500);
       //Move Order to ABS Reject Queue
        //Severity 
        await page.locator('div[class="mat-mdc-form-field-flex"]').nth(1).click();
        await page.waitForTimeout(1500);
        await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
        //Issue Type
        await page.locator('div[class="mat-mdc-form-field-flex"]').nth(2).click();
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
        const toastMessage_RejectOrderQR = await page.locator('span[class="toast-message"]').innerText();
        console.log(`✅ Order moved to reject queue successfully.${toastMessage_RejectOrder}`);

        //Search by Order ID or Customer ID
        await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);  
        await page.keyboard.press('Enter');
        await page.locator('div[col-id="orderId"]').nth(1).click(); 
        await page.waitForTimeout(1500);

        // Open history modal   
        await page.locator('button[mattooltip="History"]').click(); 
        await page.waitForSelector('.ag-center-cols-container');
         // Verify QUALITY CHECK -> ABS REJECTS
        await expect(
                        page.locator('.ag-center-cols-container div[role="row"]')
                    .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
                    .filter({ has: page.locator('[col-id="previousValue"]', { hasText: /^QUALITY CHECK$/ }) })
                    .filter({ has: page.locator('[col-id="newValue"]', { hasText: /^ABS REJECTS$/ }) })
            ).toBeVisible();

            console.log("✅ Verified History: QUALITY CHECK -> ABS REJECTS");
            // Close history modal
            await page.locator('i[class="ri-close-fill"]').click();
            await page.waitForTimeout(1500);

            //ABS Rejects
            await page.locator('span[class="title"]').nth(8).click();
            await page.waitForTimeout(1500);
            await page.locator('a[href="/app/internal/research/vendor-mgt/abs-rejects"]').click();
            await page.waitForTimeout(1500);
            await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);

//  const results = getResults();
//      await sendMail(results);


});

test.afterAll(async ({}, testInfo) => {
    const results = getResults();
    const baseURL =
        testInfo.project.use.baseURL ||
        'https://dev-outamateds.outamationlabs.com/';
    await sendMail(results); //await sendMail(results, baseURL); 
});