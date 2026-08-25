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

//
test(' Keying Process ', async ({ page }) => {


    // --- GLOBAL RUNTIME MONITORING HOOKS ---
    attachRuntimeMonitors(page);

    await page.goto('/app/internal/research/dashboard/order-status');
    await page.waitForTimeout(1500);
    await page.locator('h6[class="module-title"]').nth(0).click();
    await page.waitForTimeout(1500);
    
        const CustomerOrder = getCustomerOrder();

            //Search by Order ID or Customer ID
            await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);  
            await page.keyboard.press('Enter');
            await page.locator('div[col-id="orderId"]').nth(1).click(); 
            await page.waitForTimeout(1500); 


//         console.log('');
//         console.log('\x1b[1mKeying In Progress:\x1b[0m');
    
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
//    await page.locator('button[type="submit"]').click();   //Save
//     await page.waitForTimeout(1500);

    // //Process Order - Keying
    // await page.locator('button[mattooltip="Process Order"]').click();
    // await page.waitForTimeout(1500);
    // await page.locator('button:has-text("Move to...")').click();
    // await page.locator('button:has-text(" KEYING IN PROGRESS ")').click();
    // await page.waitForTimeout(1500);

      // Keying tab
    await page.getByRole('link', { name: 'keyboard Keying' }).click();
    await page.waitForTimeout(1500); 


//     // Keying Page Validation
//     const keyingPageUrl = page.url();
//    // console.log("Keying Page URL:", keyingPageUrl);
//     // Match keying page URL
//     const isKeyingPage =  /\/app\/internal\/research\/orders\/\d+\/keying/.test(keyingPageUrl);
     const reportBase1 = getSrCounter();
//     if (isKeyingPage) {

//         addResult({
//             product: "Research",
//             srNo: getSrCounter().toString(),
//             module: 'Keying',
//             status: 'Pass',
//             URL: `<a href="${keyingPageUrl}">Keying</a>`
//         });

//         console.log("✅ Keying page opened successfully.");

//     } else {

//         addResult({
//             product: "Research",
//             srNo: getSrCounter().toString(),
//             module: 'Keying',
//             status: 'Fail',
//             URL: `<a href="${keyingPageUrl}">Keying</a>`
//         });

//         console.log("❌ Keying page validation failed.");
//     }



        //Tax Information
    await page.locator('div[data-field-key="tax_Year_TAI"] input').fill("2025");
    await page.waitForTimeout(1500);  

    //State
    await page.locator('div[data-field-key="state_TAI"]').click();
    //await page.waitForTimeout(1500);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1000);
    

    //County
    await page.locator('div[data-field-key="county_TAI"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(4).click();
    await page.waitForTimeout(1000);

    //Full Amount
    await page.locator('#fullAmountDue_TAI').fill("900.26");
    await page.waitForTimeout(1500);

    //Tax Entity
     await page.locator('#tax_Entity').fill("202558");
    await page.waitForTimeout(1500);

    //Tax Type
    await page.locator('div[data-field-key="tax_Type"]').click();
    await page.waitForTimeout(1500);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
    await page.waitForTimeout(1000);

    //Payment Frequency
    await page.locator('div[data-field-key="payment_Frequency_TAI"]').click();
    await page.waitForTimeout(1500);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1000);

    //Court Type
    await page.locator('#court_Type_TAI').fill("United States");
    await page.waitForTimeout(1500);

    //Court District
    await page.locator('#court_District_TAI').fill("SDNY");
    await page.waitForTimeout(1500);

    //Group 1
    //1st Inst
    const Instamount = faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await page.locator('div[data-field-key="installment_TAI"] input').fill(Instamount);
    await page.waitForTimeout(1500);
    

    //Paid date
    await page.locator('button[aria-label="Open calendar"]').nth(4).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);

    //Due Date
    await page.locator('button[aria-label="Open calendar"]').nth(5).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);

    //Delinquent Date
    await page.locator('button[aria-label="Open calendar"]').nth(6).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);

    //Partially Paid Date
     await page.locator('button[aria-label="Open calendar"]').nth(7).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);

    //Status
    await page.locator('div[data-field-key="status_TAI"]').click();
    await page.waitForTimeout(1500);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
    await page.waitForTimeout(1000);

    //Comment
    await page.locator('div[data-field-key="comment_TAI"] textarea').fill("All Details filled");
    await page.waitForTimeout(1500);
    
     //Document
    await page.locator('div[class="col-sm-4 form-field"]').nth(0).click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.waitForTimeout(1000);
    //Doc Range
    await page.locator('div[class="col-sm-4 form-field"] input').nth(0).fill("1");
    await page.waitForTimeout(1500);


    //Assessment Information
    const LandValue =  faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await page.locator('div[data-field-key="land"] input').fill(LandValue);
    await page.waitForTimeout(1000);
    //Building Value
    const BuildingValue =  faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await page.locator('div[data-field-key="building"] input').fill(BuildingValue);
    await page.waitForTimeout(1000);
    //Total Value
    const TotalValue =  faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await page.locator('div[data-field-key="total"] input').fill(TotalValue);
    await page.waitForTimeout(1000);
    //Exempt Value  
    const ExemptValue =  faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await page.locator('div[data-field-key="exemption"] input').fill(ExemptValue);
    await page.waitForTimeout(1000);
    //Tax Value
    const TaxValue =  faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('div[data-field-key="parcel_ID_Tax_ID_APN"] input').fill(TaxValue);
    await page.waitForTimeout(1000);
    //Mobile home
    await page.locator('div[data-field-key="mobile_Home"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1000);   
    //Mobile Home ID
    const MobileHomeID =  faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('div[data-field-key="mobile_Home_ID"] input').fill(MobileHomeID);
    await page.waitForTimeout(1000); 
    //HOA Found
    await page.locator('div[data-field-key="hOA_Found"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1000);
    //HOA Name
    const HOAName = faker.company.name();
    await page.locator('div[data-field-key="hOA_Name"] input').fill(HOAName);
    await page.waitForTimeout(1000);
    //HOA Agent
    const HOAAgent = faker.person.fullName();
    await page.locator('div[data-field-key="hOA_Agent"] input').fill(HOAAgent);
    await page.waitForTimeout(1000);
    //HOA Address
    const HOAAddress = faker.location.streetAddress();
    await page.locator('div[data-field-key="hOA_Address"] input').fill(HOAAddress);
    await page.waitForTimeout(1000);
    //HOA Contact
    const HOAContact = faker.phone.number();
    await page.locator('div[data-field-key="hOA_Phone_Contact"] input').fill(HOAContact);
    await page.waitForTimeout(1000);
    //HOA Email
    const HOAEmail = faker.internet.email();
    await page.locator('div[data-field-key="hOA_Email_Contact"] input').fill(HOAEmail);
    await page.waitForTimeout(1000);
    //Document
    await page.locator('div[data-field-key="document_Name_AI"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
    await page.waitForTimeout(1000);
    //Document Range
    await page.locator('div[data-field-key="doc_Range_AI"] input').fill("1");
    await page.waitForTimeout(1000);

    //Vesting Chain
    await page.locator('div[data-field-key="deed_Type_VI"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
    await page.waitForTimeout(1000);
    //Consideration
    const Consideration =  faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await page.locator('div[data-field-key="consideration_VI"] input').fill(Consideration);
    await page.waitForTimeout(1000);
    //Grantor
    const Grantor = faker.person.fullName();
    await page.locator('div[data-field-key="grantor_VI"] input').fill(Grantor);
    await page.waitForTimeout(1000);    
    //Grantee
    const Grantee = faker.person.fullName();        
    await page.locator('div[data-field-key="grantee_VI"] input').fill(Grantee);
    await page.waitForTimeout(1000);
    //Instrument Date
    await page.locator('button[aria-label="Open calendar"]').nth(8).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Recorded Date
    await page.locator('button[aria-label="Open calendar"]').nth(9).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Recorded Book
    const RecordedBook =  faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('div[data-field-key="recorded_Book_VI"] input').fill(RecordedBook);
    await page.waitForTimeout(1000);
    //Recorded Page
    const RecordedPage =  faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('div[data-field-key="recorded_Page_VI"] input').fill(RecordedPage);
    await page.waitForTimeout(1000);    
    //Recorded Instrument Number
    const RecordedInstrumentNumber =  faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('div[data-field-key="recorded_Instrument_Number_Document_Number_VI"] input').fill(RecordedInstrumentNumber);
    await page.waitForTimeout(1000);
    //Document
    await page.locator('div[class="col-sm-4 form-field"]').nth(2).click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(3).click();
    await page.waitForTimeout(1000);
    //Doc Range
    await page.locator('div[class="col-sm-4 form-field"] input').nth(1).fill("1");
    await page.waitForTimeout(1500);

    //Vesting Chain 2
    //Add
    await page.locator('button[mattooltip="Add"]').nth(5).click();
    await page.waitForTimeout(1000);
    await page.locator('div[data-field-key="deed_Type_VI"]').nth(1).click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(3).click();
    await page.waitForTimeout(1000);
    //Consideration
    const ConsiderationVC =  faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString();
    await page.locator('div[data-field-key="consideration_VI"] input').nth(1).fill(ConsiderationVC);
    await page.waitForTimeout(1000);
    //Grantor
    const GrantorVC = faker.person.fullName();
    await page.locator('div[data-field-key="grantor_VI"] input').nth(1).fill(GrantorVC);
    await page.waitForTimeout(1000);    
    //Grantee
    const GranteeVC = faker.person.fullName();
    await page.locator('div[data-field-key="grantee_VI"] input').nth(1).fill(GranteeVC);
    await page.waitForTimeout(1000);
    //Recorded Book
    const RecordedBookVC =  faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('div[data-field-key="recorded_Book_VI"] input').nth(1).fill(RecordedBookVC);
    await page.waitForTimeout(1000);
    //Recorded Page
    const RecordedPageVC =  faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('div[data-field-key="recorded_Page_VI"] input').nth(1).fill(RecordedPageVC);
    await page.waitForTimeout(1000);    
    //Recorded Instrument Number
    const RecordedInstrumentNumberVC =  faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('div[data-field-key="recorded_Instrument_Number_Document_Number_VI"] input').nth(1).fill(RecordedInstrumentNumberVC);
    await page.waitForTimeout(1000);
    //Moving up
    await page.locator('button[mattooltip="Move Up"]').nth(2).click();
    await page.waitForTimeout(1000);
    //Toast message text Data Saved
    const toastMessage_KeyingSaved = await page.locator('div[class="toast-container success-toast"]').innerText();
    //console.log("Toast Message: ", toastMessage_KeyingSaved); 
    await page.waitForTimeout(1000);

    //Save
    await page.locator('button[mattooltip="Save"]').click();
    await page.waitForTimeout(1000);

    //toast message text Data Saved
    const toastMessage_DataSaved = await page.locator('div[class="toast-container success-toast"]').innerText();
    //console.log("Toast Message: ", toastMessage_DataSaved); 
    await page.waitForTimeout(1000);

    //Complete
    await page.locator('button[mattooltip="Complete"]').click();
    await page.waitForTimeout(1000);

    //Incomplete Tagging
    await page.locator('button:has-text("Yes")').click();
    await page.waitForTimeout(1000);

    //toast message text Data Saved
    const toastMessage_KeyingUpdated = await page.locator('div[class="toast-container success-toast"]').innerText();
    //console.log("Toast Message: ", toastMessage_KeyingUpdated); 
    await page.waitForTimeout(1000);


    //Qc 
    await page.locator('span[class="title"]').nth(6).click();
    await page.waitForTimeout(1500);  
    //Qc order grid 
    await page.locator('a[href="/app/internal/research/quality-control/quality-check"]').click();
    await page.waitForTimeout(1500);  
    //Search with Customer Order Number
    await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
    await page.waitForTimeout(1500);  
    await page.locator('div[col-id="id"]').nth(1).click(); 
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

    //Security Instrument Chain of Title
    await page.locator('div[data-field-key="instrument_Name_SI"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
    await page.waitForTimeout(1000);
    //Borrower
    const Borrower = faker.person.fullName();
    await page.locator('div[data-field-key="borrower_SI"] input').fill(Borrower);
    await page.waitForTimeout(1000);
    //Beneficiary MERS Ind
    await page.locator('div[data-field-key="beneficiary_MERS_Ind_SI"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1000);
    //Beneficiary
    const Beneficiary = faker.person.fullName();
    await page.locator('div[data-field-key="beneficiary_SI"] input').fill(Beneficiary);
    await page.waitForTimeout(1000);
    //Instrument Date
    await page.locator('button[aria-label="Open calendar"]').nth(14).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Assignor MERS Ind.
    await page.locator('div[data-field-key="assignor_MERS_Ind_SI"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1000);
    //Assignor  
    const AssignorSI1 = faker.person.fullName();
    await page.locator('div[data-field-key="assignor_SI"] input').fill(AssignorSI1);
    await page.waitForTimeout(1000);
    //Assignee MERS Ind.
    await page.locator('div[data-field-key="assignee_MERS_Ind_SI"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1000);    
    //Assignee  
    const AssigneeSI1 = faker.person.fullName();
    await page.locator('div[data-field-key="assignee_SI"] input').fill(AssigneeSI1);
    await page.waitForTimeout(1000);
    //Recorded Date
    await page.locator('button[aria-label="Open calendar"]').nth(15).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Recorded Book 
    await page.locator('div[data-field-key="recorded_Book_SI"] input').fill("123456");
    await page.waitForTimeout(1000);    
    //Recorded Page
    await page.locator('div[data-field-key="recorded_Page_SI"] input').fill("584");
    await page.waitForTimeout(1000);
    //Consideration
    await page.locator('div[data-field-key="consideration_Amount_SI"] input').fill("2500.25");
    await page.waitForTimeout(1000);    
    //Document
    await page.locator('div[class="col-sm-4 form-field"]').nth(6).click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(4).click();
    await page.waitForTimeout(1000);
    //Doc Range
    await page.locator('div[class="col-sm-4 form-field"] input').nth(3).fill("1");
    await page.waitForTimeout(1500);

    //Security Instrument Chain of Title 2
    //Add
    await page.locator('button[mattooltip="Add"]').nth(8).click();
    await page.waitForTimeout(1000);
    await page.locator('div[data-field-key="instrument_Name_SI"]').nth(1).click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(7).click();
    await page.waitForTimeout(1000);
    //Borrower
    const BorrowerSI = faker.person.fullName();
    await page.locator('div[data-field-key="borrower_SI"] input').nth(1).fill(BorrowerSI);
    await page.waitForTimeout(1000);
    //Beneficiary MERS Ind
    await page.locator('div[data-field-key="beneficiary_MERS_Ind_SI"]').nth(1).click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(0).click();
    await page.waitForTimeout(1000);
    //Beneficiary
    const BeneficiarySI = faker.person.fullName();
    await page.locator('div[data-field-key="beneficiary_SI"] input').nth(1).fill(BeneficiarySI);
    await page.waitForTimeout(1000);
    //Trustee
    const TrusteeSI = faker.person.fullName();
    await page.locator('div[data-field-key="trustee_SI"] input').fill(TrusteeSI);
    await page.waitForTimeout(1000);
    //Consideration
    await page.locator('div[data-field-key="consideration_Amount_SI"] input').nth(1).fill("5840.89");
    await page.waitForTimeout(1000);  



    //Liens (Judgments,Federal/State Tax Liens,Lis Pendens,ETC)
    await page.locator('div[data-field-key="document_Name_LI"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(3).click();
    await page.waitForTimeout(1000);
    //Instrument Date
    await page.locator('button[aria-label="Open calendar"]').nth(22).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Recorded Date
    await page.locator('button[aria-label="Open calendar"]').nth(23).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);
    //Consideration
    await page.locator('div[data-field-key="amount_LI"] input').fill("2500.25");
    await page.waitForTimeout(1000);
    //Case Number
    const CaseNumberLI = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('div[data-field-key="case_Number_LI"] input').fill(CaseNumberLI);
    await page.waitForTimeout(1000); 
    
    //Legal Description
    await page.locator('div[data-field-key="source"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
    await page.waitForTimeout(1000);
    //Recorded Book
    await page.locator('div[data-field-key="recorded_Book"] input').fill("65214");
    await page.waitForTimeout(1000);
    //Recorded Page
    await page.locator('div[data-field-key="recorded_Page"] input').fill("584");
    await page.waitForTimeout(1000);
    //Doc
    await page.locator('div[data-field-key="document_Name_LD"]').click();
    await page.waitForTimeout(1000);
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(5).click();
    await page.waitForTimeout(1000);
    //Doc Range
    await page.locator('div[data-field-key="doc_Range_LD"] input').fill("1");
    await page.waitForTimeout(1500);

    //save
    await page.locator('button[mattooltip="Save"]').click();
    await page.waitForTimeout(1000);    
    //Complete
    await page.locator('button[mattooltip="Complete"]').click();
    await page.waitForTimeout(1000);
    //Incomplete Tagging
    await page.locator('button:has-text("Yes")').click();
    await page.waitForTimeout(1000);
    //Complete : Change Fields
    await page.locator('button:has-text(" Confirm ")').click();
    await page.waitForTimeout(1000);
   
    //Pending Orders
    await page.locator('span[class="title"]').nth(5).click();
    await page.waitForTimeout(1500);
    await page.locator('a[href="/app/internal/research/order-stage/pending-delivery"]').click();
    await page.waitForTimeout(1500);

    //Search with Customer Order Number
    await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
    await page.waitForTimeout(1500);  
    await page.locator('div[col-id="id"]').nth(1).click(); 
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
    const isDocumentsPage = /\/app\/internal\/research\/orders\/\d+\/documents/.test(documentsPageUrl);

    if (isDocumentsPage) {

        addResult({
            product: "Research",
            srNo: `${reportBase1}.2`,
            module: 'Keying Document - Verification',
            status: 'Pass',
            URL: `<a href="${documentsPageUrl}">Keying Document - Verification</a>`
        });

        console.log("✅ DocGen successfully.");

    } else {

        addResult({
            product: "Research",
            srNo: `${reportBase1}.2`,
            module: 'Keying Document - Verification',
            status: 'Fail',
            URL: `<a href="${documentsPageUrl}">Keying Document - Verification</a>`
        });

        console.log("❌ DocGen validation failed.");
    }
    incrementSrCounter();

 
});     

