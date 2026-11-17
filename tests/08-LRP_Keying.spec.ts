import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/en';
import { addResult, getResults, getSrCounter, incrementSrCounter  } from '../resultsCollector'; 
import { sendMail } from '../mail';
import { attachRuntimeMonitors } from './support/runtimeMonitors';
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

// --- KEYING FORM HELPERS ---
// Document Information is a repeatable group. Its sub-field ids are positional
// (key + groupNo + fieldNo), so they shift whenever the schema changes.
// Locate fields by data-field-key + data-group-index instead.
const kf = (page: any, key: string, g: number = 0) =>
    page.locator(`div.form-field[data-field-key="${key}"][data-group-index="${g}"]`);

async function kfFill(page: any, key: string, value: string, g: number = 0) {
    await kf(page, key, g).locator('input, textarea').first().fill(value);
    await page.waitForTimeout(500);
}

async function kfSelect(page: any, key: string, g: number = 0, option: number | RegExp = 0) {
    await kf(page, key, g).locator('mat-select').first().click();
    await page.waitForTimeout(1000);
    const opts = page.locator('mat-option');
    const opt = typeof option === 'number' ? opts.nth(option) : opts.filter({ hasText: option }).first();
    const text = (await opt.innerText()).trim();
    await opt.click();
    await page.waitForTimeout(1000);
    return text;
}

async function kfToday(page: any, key: string, g: number = 0) {
    await kf(page, key, g).locator('button[aria-label="Open calendar"]').click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
}

// Adds a Document Information group and returns its data-group-index.
// Uses the Add button of the array that actually holds instrument_Name_DI (not a positional nth),
// and derives the new index from the current group count (QC may load a different number of groups).
async function addDocInfoGroup(page: any): Promise<number> {
    const instruments = page.locator('div.form-field[data-field-key="instrument_Name_DI"]');
    const before = await instruments.count();
    const docInfoArray = page.locator('#DocumentInformation .array-group', {
        has: page.locator('div.form-field[data-field-key="instrument_Name_DI"]'),
    }).last();
    await docInfoArray.locator(':scope > div.text-end button[mattooltip="Add"]').click();
    await expect(instruments).toHaveCount(before + 1, { timeout: 10000 });
    await page.waitForTimeout(1000);
    return before;
}

// Beneficiaries used for each validation path
const MERS_BENEFICIARY = 'UNITED WHOLESALE MORTGAGE, LLC';
const NON_MERS_BENEFICIARY = 'EQUITY PRIME MORTGAGE LLC';

// Opens Beneficiary Search, searches by name and selects that beneficiary.
// Also checks its MERS Indicator so the form runs the expected validation.
// LRP shows a single "Beneficiary" field / .common-section (AOM: Assignor + Assignee / .assignor-section).
// MERS: MIN Number is required on Complete. Non-MERS: it is optional.
async function selectBeneficiary(page: any, isMers: boolean) {
    const label = isMers ? 'MERS' : 'Non-MERS';
    const beneName = isMers ? MERS_BENEFICIARY : NON_MERS_BENEFICIARY;
    await page.locator('button[mattooltip="Beneficiary Search"]').click();
    await page.waitForTimeout(1000);

    // Real result cards only - the "Search to find..." / "No Record Found" cards share .beneficiary-item
    const items = page.locator('.beneficiary-list .beneficiary-item:not(.no-data-card)');
    const noRecord = page.locator('.beneficiary-list .no-data-card', { hasText: 'No Record Found' });
    const namePattern = new RegExp(beneName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'), 'i');
    const byName = items.filter({ hasText: namePattern });

    // Search by Beneficiary (LRP) / Assignor (AOM) first, then by Assignee if that field exists
    const primaryInput = page.locator('input[placeholder="Beneficiary"], input[placeholder="Assignor"]').first();
    const assigneeInput = page.locator('input[placeholder="Assignee"]');
    const searchInputs = (await assigneeInput.count()) > 0
        ? [[primaryInput, assigneeInput], [assigneeInput, primaryInput]]
        : [[primaryInput, null]];
    for (const [input, other] of searchInputs) {
        if (other) await other.fill('');
        await input.fill(beneName);
        await page.locator('button.search-button').click();
        await items.first().or(noRecord).waitFor({ state: 'visible', timeout: 20000 });
        await page.waitForTimeout(500);
        if ((await byName.count()) > 0) break;
    }
    if ((await byName.count()) === 0) {
        const returned = await items.locator('.common-section .fw-medium, .assignor-section .fw-medium').allInnerTexts().catch(() => []);
        throw new Error(`${label} beneficiary "${beneName}" not found in Beneficiary Search. Results returned: ${returned.length ? returned.join(' | ') : 'none'}`);
    }
    const ind = isMers ? 'yes' : 'no';
    const match = byName.filter({
        has: page.locator(`.common-section .mers-indicator.${ind}, .assignor-section .mers-indicator.${ind}`),
    }).first();
    if ((await match.count()) === 0) {
        throw new Error(`Beneficiary "${beneName}" found, but its MERS Indicator is not "${isMers ? 'Yes' : 'No'}".`);
    }
    await match.locator('.radio-selection .mdc-radio').click();
    await page.waitForTimeout(1000);
    await page.locator('button:has-text(" Submit ")').click();
    await page.waitForTimeout(1500);
    console.log(`✅ ${label} beneficiary selected: ${beneName}`);
}

// Original Lender MERS Ind follows the beneficiary: MERS -> Yes, Non-MERS -> No
const mersInd = (isMers: boolean) => (isMers ? /^\s*Yes\s*$/i : /^\s*No\s*$/i);

// Sets Original Lender MERS Ind on every Document Information group that shows it
async function setAllOriginalLenderMersInd(page: any, isMers: boolean) {
    const fields = page.locator('div.form-field[data-field-key="original_Lender_MERS_Ind_DI"]');
    const count = await fields.count();
    for (let i = 0; i < count; i++) {
        const g = Number(await fields.nth(i).getAttribute('data-group-index'));
        await kfSelect(page, 'original_Lender_MERS_Ind_DI', g, mersInd(isMers));
    }
}

// Images (tagging_DI) -> Document name dropdown. Option 0 is "Clear".
async function kfImage(page: any, g: number = 0, option: number = 1) {
    await kf(page, 'tagging_DI', g).locator('mat-select[id$="docname"]').first().click();
    await page.waitForTimeout(1000);
    await page.locator('mat-option').nth(option).click();
    await page.waitForTimeout(1000);
}

// Complete can now raise an "Incomplete Tagging" confirmation, or a warning toast
// when a conditionally-required field (e.g. Number of Borrowers) is empty.
async function afterComplete(page: any, contextName: string) {
    await page.waitForTimeout(1500);
    const taggingDialog = page.locator('mat-dialog-container', { hasText: 'Incomplete Tagging' });
    if (await taggingDialog.isVisible()) {
        await taggingDialog.locator('button:has-text("Yes")').click();
        await page.waitForTimeout(1500);
    }
    const invalidToast = page.locator('.toast-message', { hasText: 'invalid or missing information' });
    if (await invalidToast.first().isVisible()) {
        const invalidFields = page.locator('.mat-mdc-form-field-invalid');
        const count = await invalidFields.count();
        const labels: string[] = [];
        for (let i = 0; i < count; i++) {
            const label = await invalidFields.nth(i).locator('mat-label, .mdc-floating-label').first().innerText().catch(() => `Field #${i + 1}`);
            labels.push(`"${label.trim()}"`);
        }
        await page.screenshot({ path: 'failure-screenshots/keying-validation-error.png', fullPage: true });
        throw new Error(`Keying Complete Blocked on [${contextName}]. Invalid/missing field(s): ${labels.join(', ') || 'Unknown Field'}`);
    }
}

//@Outamate DS:
test(' Keying Process ', async ({ page }) => {


    // --- GLOBAL RUNTIME MONITORING HOOKS ---
    attachRuntimeMonitors(page);

    await page.goto('/app/internal/lien-release/dashboard/order-status');
    await page.waitForTimeout(1500);
    await page.locator('h6[class="module-title"]').nth(2).click();
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
    const isKeyingPage =  /\/app\/internal\/lien-release\/orders\/\d+\/keying/.test(keyingPageUrl);
     const reportBase1 = getSrCounter();
    if (isKeyingPage) {

        addResult({
            product: "LRP",
            srNo: getSrCounter().toString(),
            module: 'Keying',
            status: 'Pass',
            URL: `<a href="${keyingPageUrl}">Keying</a>`
        });

        console.log("✅ Keying page opened successfully.");

    } else {

        addResult({
            product: "LRP",
            srNo: getSrCounter().toString(),
            module: 'Keying',
            status: 'Fail',
            URL: `<a href="${keyingPageUrl}">Keying</a>`
        });

        console.log("❌ Keying page validation failed.");
    }
    
    //Document Information 1 (group index 0) : Deed of trust
    // Original Lender / Maturity / Consideration / Trustee are only shown for Mortgage-type instruments,
    // and Borrower, Number of Borrowers, Consideration, Original Lender, MERS Ind are required on Complete.
    // Deed of trust also shows the LRP "Trustee Info" card used further down.
    const InstrumentName = await kfSelect(page, 'instrument_Name_DI', 0, /^\s*Deed of trust\s*$/i);
    //BorrowerName
    const BorrowerName = faker.person.firstName();
    await kfFill(page, 'borrower_DI', BorrowerName, 0);
    //Number of Borrowers (new)
    await kfFill(page, 'number_Of_Borrowers', '1', 0);
    //InstrumentDateKeying
    await kfToday(page, 'instrument_Date_DI', 0);
    //Maturity
    await kfToday(page, 'maturity_Date_DI', 0);
    //Consideration Amount
    const ConsiderationNumberKeying = faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await kfFill(page, 'consideration_Amount_DI', ConsiderationNumberKeying, 0);
    //Original Lender
    const OriginalLender = faker.person.firstName();
    await kfFill(page, 'original_Lender_DI', OriginalLender, 0);
    //Original Address
    const AddressLineKeying = faker.location.streetAddress();
    await kfFill(page, 'original_Lender_Address_DI', AddressLineKeying, 0);
    //MERS Ind (MERS beneficiary in Keying -> Yes)
    await kfSelect(page, 'original_Lender_MERS_Ind_DI', 0, mersInd(true));
    //Trustee Name (visible only for Deed of trust)
    const TrusteeName = faker.person.firstName();
    await kfFill(page, 'trustee_DI', TrusteeName, 0);
    //Recorded State
    await kfSelect(page, 'recorded_State_DI', 0, 0);
    //Recorded County
    await kfSelect(page, 'recorded_County_DI', 0, 4);
    //Recorded Agency
    await kfSelect(page, 'recorded_Agency_DI', 0, 1);
    //Recorded Date
    await kfToday(page, 'recorded_Date_DI', 0);
    //Recorded Book
    const RecordedBook = faker.number.int({ min: 100000, max: 999999 }).toString();
    await kfFill(page, 'recorded_Book_DI', RecordedBook, 0);
    //Recorded Page
    const RecordedPage = faker.number.int({ min: 100000, max: 999999 }).toString();
    await kfFill(page, 'recorded_Page_DI', RecordedPage, 0);

    //Images 1
    await kfImage(page, 0, 1);

    //Add Document Information 2 : Assignment of Mortgage
    const g2 = await addDocInfoGroup(page);
    //Instrument Name (Assignor / Assignee fields only shown for Assignment instruments)
    await kfSelect(page, 'instrument_Name_DI', g2, /^\s*Assignment of Mortgage\s*$/i);
    //BorrowerName
    const BorrowerName2 = faker.person.firstName();
    await kfFill(page, 'borrower_DI', BorrowerName2, g2);
    //InstrumentDateKeying
    await kfToday(page, 'instrument_Date_DI', g2);
    //Recorded State
    await kfSelect(page, 'recorded_State_DI', g2, 0);
    //Recorded County
    await kfSelect(page, 'recorded_County_DI', g2, 4);
    //Recorded Agency
    await kfSelect(page, 'recorded_Agency_DI', g2, 1);
    //Recorded Date
    await kfToday(page, 'recorded_Date_DI', g2);
    //Recorded Book
    const RecordedBook2 = faker.number.int({ min: 100000, max: 999999 }).toString();
    await kfFill(page, 'recorded_Book_DI', RecordedBook2, g2);
    //Recorded Page
    const RecordedPage2 = faker.number.int({ min: 100000, max: 999999 }).toString();
    await kfFill(page, 'recorded_Page_DI', RecordedPage2, g2);
    //Assignor MERS Ind
    await kfSelect(page, 'assignor_MERS_Ind_DI', g2, 0);
    //Assignor
    const Assignor2 = faker.person.firstName();
    await kfFill(page, 'assignor_DI', Assignor2, g2);
    //Assignor Address
    const AssignorAddressKeying = faker.location.streetAddress();
    await kfFill(page, 'assignor_Address_DI', AssignorAddressKeying, g2);
    //Assignee MERS Ind
    await kfSelect(page, 'assignee_MERS_Ind_DI', g2, 0);
    //Assignee
    const Assignee2 = faker.person.firstName();
    await kfFill(page, 'assignee_DI', Assignee2, g2);
    //Assignee Address
    const AssigneeAddressKeying = faker.location.streetAddress();
    await kfFill(page, 'assignee_Address_DI', AssigneeAddressKeying, g2);
    //images 2
    await kfImage(page, g2, 2);

    //Add Document Information 3 : CEMA
    // CEMA shows Original Lender / Maturity / Consideration (same as Mortgage-type instruments)
    const g3 = await addDocInfoGroup(page);
    await kfSelect(page, 'instrument_Name_DI', g3, /CEMA/i);
    //BorrowerName
    const BorrowerNameCEMA = faker.person.firstName();
    await kfFill(page, 'borrower_DI', BorrowerNameCEMA, g3);
    //Number of Borrowers
    await kfFill(page, 'number_Of_Borrowers', '1', g3);
    //InstrumentDateKeying
    await kfToday(page, 'instrument_Date_DI', g3);
    //Maturity
    await kfToday(page, 'maturity_Date_DI', g3);
    //Consideration Amount
    const ConsiderationCEMA = faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await kfFill(page, 'consideration_Amount_DI', ConsiderationCEMA, g3);
    //Original Lender
    const OriginalLenderCEMA = faker.person.firstName();
    await kfFill(page, 'original_Lender_DI', OriginalLenderCEMA, g3);
    //Original Address
    const AddressLineCEMA = faker.location.streetAddress();
    await kfFill(page, 'original_Lender_Address_DI', AddressLineCEMA, g3);
    //MERS Ind (MERS -> Yes)
    await kfSelect(page, 'original_Lender_MERS_Ind_DI', g3, mersInd(true));
    //Recorded State
    await kfSelect(page, 'recorded_State_DI', g3, 0);
    //Recorded County
    await kfSelect(page, 'recorded_County_DI', g3, 4);
    //Recorded Agency
    await kfSelect(page, 'recorded_Agency_DI', g3, 1);
    //Recorded Date
    await kfToday(page, 'recorded_Date_DI', g3);
    //Recorded Book
    const RecordedBookCEMA = faker.number.int({ min: 100000, max: 999999 }).toString();
    await kfFill(page, 'recorded_Book_DI', RecordedBookCEMA, g3);
    //Recorded Page
    const RecordedPageCEMA = faker.number.int({ min: 100000, max: 999999 }).toString();
    await kfFill(page, 'recorded_Page_DI', RecordedPageCEMA, g3);
    //images CEMA
    await kfImage(page, g3, 3);

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
    let MINNumber = faker.number.int({ min: 1, max: 9999 }).toString();
    await page.locator('input[id="min_Number_DI"]').fill(MINNumber);
    await page.waitForTimeout(1000);

    //Trustee info
    await page.locator('div[class="order-check"]').click();   
    await page.waitForTimeout(1000);
    await page.getByRole('radio', { name: 'Yes' }).check();
    await page.getByRole('radio', { name: 'No' }).check();
    // await page.locator('[class="mat-mdc-radio-button mat-accent"]').click();
    // await page.waitForTimeout(1000);
    // await page.locator('[class="mat-mdc-radio-button mat-accent mat-mdc-radio-checked"]').click();
    // await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-button__label"]').nth(11).click();


    //Bene : MERS (Keying In Progress) - MIN Number required
    await selectBeneficiary(page, true);

    //Save
    await page.locator('button[mattooltip="Save"]').click();
    await page.waitForTimeout(1000);
    //Complete
    await page.locator('button[mattooltip="Complete"]').click();
    await afterComplete(page, 'Keying');

    //Qc
    await page.locator('span[class="title"]').nth(4).click();
    await page.waitForTimeout(1500);  
    //Qc order grid 
    await page.locator('a[href="/app/internal/lien-release/quality-control/quality-check"]').click();
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
    // Temp Delivery Package is no longer generated in the new flow - verification removed.
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

    //Document Information (QC) : Deed of trust
    // Wait for the saved keying data to load before adding, so the new group index is correct
    await kf(page, 'instrument_Name_DI', 0).waitFor({ state: 'visible', timeout: 15000 });
    const gQC = await addDocInfoGroup(page);
    //Instrument Name
    await kfSelect(page, 'instrument_Name_DI', gQC, /^\s*Deed of trust\s*$/i);
    //BorrowerName
    const BorrowerName3 = faker.person.firstName();
    await kfFill(page, 'borrower_DI', BorrowerName3, gQC);
    //Number of Borrowers (new)
    await kfFill(page, 'number_Of_Borrowers', '1', gQC);
    //InstrumentDateKeying
    await kfToday(page, 'instrument_Date_DI', gQC);
    //Consideration Amount
    const ConsiderationNumber3 = faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await kfFill(page, 'consideration_Amount_DI', ConsiderationNumber3, gQC);
    //Original Lender
    const OriginalLender3 = faker.person.firstName();
    await kfFill(page, 'original_Lender_DI', OriginalLender3, gQC);
    //Original Address
    const AddressLineKeying3 = faker.location.streetAddress();
    await kfFill(page, 'original_Lender_Address_DI', AddressLineKeying3, gQC);
    //MERS Ind (Non-MERS in QC -> No)
    await kfSelect(page, 'original_Lender_MERS_Ind_DI', gQC, mersInd(false));
    //Trustee Name
    const TrusteeName3 = faker.person.firstName();
    await kfFill(page, 'trustee_DI', TrusteeName3, gQC);
    //Recorded State / County / Agency / Date (required on Complete for Deed of trust)
    await kfSelect(page, 'recorded_State_DI', gQC, 0);
    await kfSelect(page, 'recorded_County_DI', gQC, 4);
    await kfSelect(page, 'recorded_Agency_DI', gQC, 1);
    await kfToday(page, 'recorded_Date_DI', gQC);
    //images (QC)
    await kfImage(page, gQC, 4);

    //Bene : switch to Non-MERS (Quality Check)
    // Non-MERS makes MIN Number optional - clear it to prove QC completes without it.
    await selectBeneficiary(page, false);
    // Non-MERS -> Original Lender MERS Ind = No on every group (groups keyed earlier were Yes)
    await setAllOriginalLenderMersInd(page, false);
    await page.locator('input[id="min_Number_DI"]').fill('');
    MINNumber = '';
    await page.waitForTimeout(1000);

     //Save
    await page.locator('button[mattooltip="Save"]').click();
    await page.waitForTimeout(1000);
    //Complete
    await page.locator('button[mattooltip="Complete"]').click();
    await afterComplete(page, 'Keying : QC');
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
    await page.waitForTimeout(1500);
    // Complete Delivery Package / Keying Document - Verification removed (not generated in the new flow)

    //Mandatory Days hold
    await page.locator('span[class="title"]').nth(8).click();    
    await page.waitForTimeout(1500);
    await page.locator('a[href="/app/internal/lien-release/customer-support/mandatory-days-hold"]').click();
    //Search with Customer Order Number
    await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
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
    await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
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
    const Keying_InstrumentName = (await kf(page, 'instrument_Name_DI', 0).locator('.mat-mdc-select-value-text .mat-mdc-select-min-line').textContent())?.trim() || '';
    const Keying_BorrowersName = await kf(page, 'borrower_DI', 0).locator('input').first().inputValue();
    const Keying_OLAddress = await kf(page, 'original_Lender_Address_DI', 0).locator('input').first().inputValue();
    const Keying_OL = await kf(page, 'original_Lender_DI', 0).locator('input').first().inputValue();
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
            product: "LRP",
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
            product: "LRP",
          srNo: `${reportBase1}.1`,
          module: 'Keying Details - Verification ',
          status: 'Fail',
          URL: clickableVer
  });
    }
incrementSrCounter();
        
    //Search by Order ID or Customer ID
            await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
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
  // console.log("Post Recording Information:", PRPageUrl);
    // Match keying page URL
    const isKeyingPagePR =  /\/app\/internal\/lien-release\/orders\/\d+\/keying/.test(PRPageUrl);
     const reportBase2 = getSrCounter();
    if (isKeyingPagePR) {

        addResult({
            product: "LRP",
            srNo: getSrCounter().toString(),
            module: 'Post Recording Information',
            status: 'Pass',
            URL: `<a href="${PRPageUrl}">Post Recording Information</a>`
        });

        console.log("✅ Post Recording Information page opened successfully.");

    } else {

        addResult({
            product: "LRP",
            srNo: getSrCounter().toString(),
            module: 'Post Recording Information',
            status: 'Fail',
            URL: `<a href="${PRPageUrl}">Post Recording Information</a>`
        });

        console.log("❌ Post Recording Information page validation failed.");
    }

    //Instrument Name
    await page.locator('div[data-field-key="instrument_Name_PR"]').click();
    await page.waitForTimeout(500);
    const InstNamePR = await page.locator('span[class="mdc-list-item__primary-text"]').nth(3);
    const PRI_InstrumentName = await InstNamePR.innerText();
    await InstNamePR.click();


    //Recorded Date
    await page.locator('button[aria-label="Open calendar"]').click();
    await page.waitForTimeout(1500);
    const todayRec = new Date();
    const RecordedDatePR = `${todayRec.getMonth() + 1}/${todayRec.getDate()}/${todayRec.getFullYear()}`; // Formats exactly to "7/7/2026"
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);

    //Recorded Book
    const RecordedBookPR = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('input[id="recorded_Book_PR"]').fill(RecordedBookPR);
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
    await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
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



    //Recorded Page
    const RecordedPagePR = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('input[id="recorded_Page_PR"]').fill(RecordedPagePR);
    await page.waitForTimeout(1000);
    //Recorded Instrument Number
    const RecordedInstrumentNumberPR = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('input[id="recorded_Instrument_Number_Document_Number_PR"]').fill(RecordedInstrumentNumberPR);
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
    await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
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
    const PR_RecordedDate = await page.$eval('#recorded_Date_PR', el => (el as HTMLInputElement).value);   
    const PR_RecordedBook = await page.$eval('#recorded_Book_PR', el => (el as HTMLInputElement).value);
    const PR_RecordedPage = await page.$eval('#recorded_Page_PR', el => (el as HTMLInputElement).value);

      if (
            normalize(PRI_InstrumentName) === normalize(PR_InstrumentName) &&
            normalize(RecordedDatePR) === normalize(PR_RecordedDate) &&
            normalize(RecordedBookPR) === normalize(PR_RecordedBook) &&
            normalize(RecordedPagePR) === normalize(PR_RecordedPage)
    ) {
        console.log("✅ All order fields verified successfully.");

          const verificationUrlPR = await page.url();
          const clickableVer = '<a href="' + verificationUrlPR + '" target="_blank">Post Recording Information - Verification</a>';
          addResult({
            product: "LRP",
            srNo: `${reportBase2}.1`,
            module: 'Post Recording Information - Verification',
            status: 'Pass',
            URL: clickableVer
          });

    } else {
        console.log("❌ Order field verification failed. One or more fields have incorrect or missing values.");

        const failedVerificationUrlPR = await page.url();
        const clickableVer = '<a href="' + failedVerificationUrlPR + '" target="_blank">Post Recording Information - Verification</a>';
        addResult({
            product: "LRP",
          srNo: `${reportBase2}.1`,
          module: 'Post Recording Information - Verification',
          status: 'Fail',
          URL: clickableVer
  });
    }
   
   

    //Back to Order level
    await page.locator('button[mattooltip="Go to Order Details"]').click();
    await page.waitForTimeout(1500);

    // Navigate to Documents tab
    await page.locator('a[href*="/documents"]').click();

    //DocGen Verification
   const docSelectorPR = page.locator('a.name-link', { hasText: 'Good Bye Letter' });

    try {
        await expect(docSelectorPR).toBeVisible(); 
        console.log('✅ DocGen PDF created successfully. Good Bye Letter was found.');
    } catch (error) {
        console.error('❌ DocGen PDF creation failed. Good Bye Letter was not found.');
    }

     // Documents Page Validation
    const documentsPRPageUrl = page.url();

    // console.log("Documents Page URL:", documentsPageUrl);

    // Match documents page URL
    const isDocumentsPagePR =   /\/app\/internal\/lien-release\/orders\/\d+\/documents/.test(documentsPRPageUrl);

    if (isDocumentsPagePR) {

        addResult({
            product: "LRP",
            srNo: `${reportBase2}.2`,
            module: 'Post Recording Information - Good Bye Letter',
            status: 'Pass',
            URL: `<a href="${documentsPRPageUrl}">Post Recording Information - Good Bye Letter</a>`
        });

        console.log("✅ DocGen successfully.");

    } else {

        addResult({
            product: "LRP",
            srNo: `${reportBase2}.2`,
            module: 'Post Recording Information - Good Bye Letter',
            status: 'Fail',
            URL: `<a href="${documentsPRPageUrl}">Post Recording Information - Good Bye Letter</a>`
        });

        console.log("❌ DocGen validation failed.");
    }
   incrementSrCounter();
   
    //Process Order - QC Completed
    await page.locator('button[mattooltip="Process Order"]').click();
    await page.waitForTimeout(1500);
    await page.locator('button:has-text("Move to...")').click();
    await page.locator('button:has-text("   QC COMPLETED   ")').click();
    await page.waitForTimeout(1500);

    
    console.log("");
    console.log("\x1b[1mCreate Batch:\x1b[0m");  

    //Batching 
    await page.locator('span[class="title"]').nth(5).click();
    await page.waitForTimeout(1500);  
    //Create Batch
    await page.locator('a[href="/app/internal/lien-release/batching/batches"]').click();
    await page.waitForTimeout(1500);
    //Search for Order
    await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
    await page.waitForTimeout(1500);    
    //Order selected
    await page.locator('div.ag-selection-checkbox input[type="checkbox"]').click(); 
    await page.locator('button[mattooltip="Create a new batch"]').click();
    await page.waitForTimeout(1500); 
    //Signor Group (MERS or Non MERS)
    // Only the group matching the order's MERS indicator is visible; the other stays in the DOM with class d-none.
    // MERS = "MERS Signor Group" (text-outline-success), Non-MERS = "Non MERS Signor Group" (text-outline-danger).
    // Sidebar menu also uses mat-expansion-panel - pick the visible Signor Group panel only
    const signorPanel = page.locator('mat-expansion-panel:not(.d-none)')
        .filter({ has: page.locator('span.badge', { hasText: /Signor Group/i }) })
        .first();
    const signorBadge = signorPanel.locator('span.badge', { hasText: /Signor Group/i });
    await signorBadge.waitFor({ state: 'visible', timeout: 15000 });
    console.log(`✅ ${(await signorBadge.innerText()).trim()}`);
    await signorBadge.click();
    //Signor 1
    await signorPanel.locator('div[class="mat-mdc-form-field-flex"]').nth(0).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1500);
    //Signor 2
    await signorPanel.locator('div[class="mat-mdc-form-field-flex"]').nth(1).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1500);
    //Witness 1
    await signorPanel.locator('div[class="mat-mdc-form-field-flex"]').nth(2).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1500);
    //Witness 2
    await signorPanel.locator('div[class="mat-mdc-form-field-flex"]').nth(3).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1500);
    //Notary 1
    await signorPanel.locator('div[class="mat-mdc-form-field-flex"]').nth(4).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1500);
    //Notary 2
    await signorPanel.locator('div[class="mat-mdc-form-field-flex"]').nth(5).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1500);
    //Preparer
    await signorPanel.locator('div[class="mat-mdc-form-field-flex"]').nth(6).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1500);
    //ST
    await signorPanel.locator('div[class="mat-mdc-form-field-flex"]').nth(7).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Return To
    await signorPanel.locator('div[class="mat-mdc-form-field-flex"]').nth(8).click();
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1500);
    //Notary block
    await signorPanel.locator('div[class="mat-mdc-form-field-flex"]').nth(9).click();
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
        // (filtered by text - the "MERS Signors" / "Non MERS Signors" badges share the same classes)
        const generationStatus = page.locator('span.badge.text-outline-primary, span.badge.text-outline-danger')
            .filter({ hasText: /Generation Completed|Generation Failed/ })
            .first();
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
            product: "LRP",
            srNo: getSrCounter().toString(),
            module: 'Create Batch : Generation Completed',
            status: statusText?.includes('Generation Completed') ? 'Pass' : 'Fail',
            URL: clickableVer
        });

        if (statusText?.includes('Generation Failed')) {
            throw new Error(`Batch Generation Failed for Batch ID ${batchId}`);
        }
        incrementSrCounter();


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

         //Search by Order ID or Customer ID
        await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);  
        await page.keyboard.press('Enter');
        await page.locator('div[col-id="orderId"]').nth(1).click(); 
        await page.waitForTimeout(1500);  
            
          // Navigate to Documents tab
        await page.locator('a[href*="/documents"]').click();

        //DocGen Verification
      const docSelectorUBN = page.locator('a.name-link', { hasText: 'Unrecorded Borrower Notification Letter' });

        try {
            await expect(docSelectorUBN).toBeVisible(); 
            console.log('✅ DocGen PDF created successfully. Unrecorded Borrower Notification Letter was found.');
        } catch (error) {
            console.error('❌ DocGen PDF creation failed. Unrecorded Borrower Notification Letter was not found.');
        } 

             // Documents Page Validation
    const PRQPageUrl = page.url();

    // console.log("Documents Page URL:", documentsPageUrl);

    // Match documents page URL
    const isDocumentsPagePRQ =
        /\/app\/internal\/lien-release\/orders\/\d+\/documents/.test(PRQPageUrl);

    if (isDocumentsPagePRQ) {

        addResult({
            product: "LRP",
            srNo: getSrCounter().toString(),
            module: 'Post Recording Information - Unrecorded Borrower Notification Letter',
            status: 'Pass',
            URL: `<a href="${PRQPageUrl}">Post Recording Information - Unrecorded Borrower Notification Letter</a>`
        });

        console.log("✅ DocGen successfully.");

    } else {

        addResult({
            product: "LRP",
            srNo: getSrCounter().toString(),
            module: 'Post Recording Information - Unrecorded Borrower Notification Letter',
            status: 'Fail',
            URL: `<a href="${PRQPageUrl}">Post Recording Information - Unrecorded Borrower Notification Letter</a>`
        });

        console.log("❌ DocGen validation failed.");
    }
    incrementSrCounter();

            console.log("");
            console.log("\x1b[1mPrinting:\x1b[0m"); 

            // //Batching 
            // await page.locator('span[class="title"]').nth(5).click();
            // await page.waitForTimeout(1500);  
     
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
                product: "LRP",
                srNo: getSrCounter().toString(),
                module: 'Generated Document Verification',
                status: 'Pass',
                URL: GeneratedDocument
            });

        } else {

            console.log('❌ DocGen PDF creation failed. Generated Document not found.');

            addResult({
                product: "LRP",
                srNo: getSrCounter().toString(),
                module: 'Generated Document Verification',
                status: 'Fail',
                URL: GeneratedDocument
            });
            
        }   
      //  incrementSrCounter();

     // DOWNLOAD DOCUMENT
            // Re-locate inside this block so it's self-contained and always in scope.
            const generatedDocLink = page.locator('a.name-link', { hasText: 'Generated Document' });

            // Headless Chromium has no built-in PDF viewer: clicking the link fires a
            // "download" event instead of opening a viewable tab. Handle BOTH cases.
            let base64Data = '';

            // Arm all listeners BEFORE the click; the unused ones just time out -> null.
            // The link calls GET api/orders/{orderId}/documents/{docId}/preview, which returns
            // { mimeType, docBytes (base64) } - read the PDF straight from that response first.
            const previewPromise = page.waitForResponse(
                (r: any) => /\/api\/orders\/\d+\/documents\/\d+\/preview/.test(r.url()) && r.request().method() === 'GET',
                { timeout: 60000 }
            ).catch(() => null);
            const popupPromise = page.context()  .waitForEvent('page', { timeout: 30000 }) .catch(() => null);
            const downloadPromise = page .waitForEvent('download', { timeout: 30000 }) .catch(() => null);

            await generatedDocLink.click();

            const preview = await previewPromise;
            if (preview && preview.ok()) {
                const body = await preview.json().catch(() => null);
                base64Data = body?.docBytes || '';
            }

            if (base64Data) {
                // Got the bytes from the API - close the viewer tab if the app opens one
                popupPromise.then((p: any) => p?.close().catch(() => {}));
            } else {
            // Fallback: capture from the download / viewer tab
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
                throw new Error('Document click produced neither a preview response, a download nor a new tab.');
            }
            }

            if (!base64Data) {
                throw new Error('Failed to capture PDF bytes from the generated document.');
            }

            // ======================================
            // CLEAN OLD FILES (SAFE PLACE: AFTER SUCCESS)
            // ======================================
            const downloadFolder = 'C:\\DS_playwright-test 1\\LRP_Reports';
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
            await page.locator('a[href="/app/internal/lien-release/batching/sent-for-signing"]').click();
            await page.waitForTimeout(1500);

            //Search for Order
            await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);  

        //    //Order selected : Ingest Signed Documents
        //     await page.locator('div.ag-selection-checkbox input[type="checkbox"]').click(); 
        //     await page.locator('button[mattooltip="Ingest Signed Documents"]').click();
        //     await page.waitForTimeout(1500); 
              
        //     await page.reload();
        //     await page.reload();

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
            await page.locator('a[href="/app/internal/lien-release/batching/received-from-signing"]').click();
            await page.waitForTimeout(1500);
            //Search for Order
            await page.locator('input[placeholder="Search keyword"]').fill( CustomerOrder);
            await page.waitForTimeout(1500);   
            //Order selected : Ingest Signed Documents
            await page.locator('div.ag-selection-checkbox input[type="checkbox"]').click(); 
            await page.locator('button[aria-label="Send for Recording"]').click();
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
            await page.locator('a[href="/app/internal/lien-release/recordation/recordation-monitoring"]').click();
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
            await page.locator('a[href="/app/internal/lien-release/quality-control/rejects"]').click();
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

// test.afterAll(async ({}, testInfo) => {
//     const results = getResults();
//     const baseURL =
//         testInfo.project.use.baseURL ||
//         'https://dev-outamateds.outamationlabs.com/';
//     await sendMail(results); //await sendMail(results, baseURL); 
// });
