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

    // ---- Email result helpers -------------------------------------------------
    /** Records one module row for the summary email and logs the outcome. */
    const recordModule = (module: string, passed: boolean, url: string) => {
        addResult({
            product: "Research",
            srNo: getSrCounter().toString(),
            module,
            status: passed ? 'Pass' : 'Fail',
            URL: `<a href="${url}">${module}</a>`
        });
        incrementSrCounter();
        console.log(passed ? `✅ ${module}: Pass` : `❌ ${module}: Fail`);
    };

    /**
     * Non-throwing History check: returns true/false instead of aborting the test.
     * A hard expect() here would kill the run on the first bad transition, so the
     * later modules would be missing from the email entirely rather than red.
     */
    const historyShows = async (from: string, to: string): Promise<boolean> => {
        await page.locator('button[mattooltip="History"]').click();
        await page.waitForSelector('.ag-center-cols-container');
        const row = page.locator('.ag-center-cols-container div[role="row"]')
            .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
            .filter({ has: page.locator('[col-id="previousValue"]', { hasText: new RegExp(`^${from}$`) }) })
            .filter({ has: page.locator('[col-id="newValue"]', { hasText: new RegExp(`^${to}$`) }) });

        let ok = true;
        try {
            await expect(row.first()).toBeVisible({ timeout: 20_000 });
            console.log(`✅ Verified History: ${from} -> ${to}`);
        } catch {
            ok = false;
            console.log(`❌ History does not show ${from} -> ${to}`);
        }
        await page.locator('i[class="ri-close-fill"]').click();
        await page.waitForTimeout(1500);
        return ok;
    };

    /**
     * Confirms the order is present in the queue grid currently on screen.
     *
     * Matching is deliberately column-agnostic. The queue grids don't share a
     * column set (ABS Rejects is keyed on orderId, not customerNumber), and the
     * matching cell may live in the pinned-left container rather than the centre
     * one — so '.ag-center-cols-container' + col-id="customerNumber" reported
     * "not found" for orders that were in the grid.
     */
    const inQueueGrid = async (order: string): Promise<boolean> => {
        // '.ag-row' covers the pinned and centre containers alike.
        const row = page.locator('.ag-row').filter({ hasText: new RegExp(`\\b${order}\\b`) });
        const found = await row.first()
            .waitFor({ state: 'visible', timeout: 1500 })
            .then(() => true)
            .catch(() => false);
        if (found) return true;

        // Fallback: AG Grid also virtualises columns horizontally, so on a wide
        // grid the cell holding the order number may not be rendered at all. The
        // keyword search has already filtered the grid down to this order, so a
        // non-zero record count is sufficient evidence the row is present.
        const countText = await page.locator('span[ref="lbRecordCount"]').innerText().catch(() => '');
        const count = parseInt(countText.replace(/[^\d]/g, ''), 10) || 0;
    //     if (count > 0) {
    //         console.log(`ℹ️ Order ${order} matched via record count (${count}) — cell not rendered (column virtualisation).`);
    //         return true;
    //     }

    //     console.log(`❌ Order ${order} not found in the current queue grid (record count: ${countText || 'n/a'})`);
    //     return false;
        return count > 0;  //Added 
    };


    const normalize = (val: any) => typeof val === "number" ? Number(val).toFixed(2)
        : String(val ?? "").replace(/\s+/g, " ").replace(/&amp;/g, "&").trim().toLowerCase();

    /**
     * This spec walks the ABS flow twice — first via Assign ABS, then via Quotes
     * Request. flowPass is set to 2 at the start of the second walk so the email
     * rows are distinguishable instead of appearing as duplicate module names.
     */
    let flowPass = 1;
    const label = (m: string) => flowPass === 1 ? m : `${m} (Quote Request)`;

    // Reused by every transition check so both passes read identically.
    let historyOk = false;
    let mod = '';
    let modUrl = '';
    // --------------------------------------------------------------------------

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

            // Pending ABS Assign Validation
            const PendingABSAssignUrl = page.url();
            const PendingABSAssignToast = await page.locator('span[class="toast-message"]').first()
                .innerText({ timeout: 10_000 }).catch(() => '');
            const PendingABSAssign = PendingABSAssignToast !== '';
            if (PendingABSAssign) {

                addResult({
                    product: "Research",
                    srNo: getSrCounter().toString(),
                    module: 'Pending ABS Assign',
                    status: 'Pass',
                    URL: `<a href="${PendingABSAssignUrl}">Pending ABS Assign</a>`
                });

                console.log("✅ Order moved to PENDING ABS ASSIGN successfully.");

            } else {

                addResult({
                    product: "Research",
                    srNo: getSrCounter().toString(),
                    module: 'Pending ABS Assign',
                    status: 'Fail',
                    URL: `<a href="${PendingABSAssignUrl}">Pending ABS Assign</a>`
                });

                console.log("❌ Order not moved to PENDING ABS ASSIGN.");
            }
            incrementSrCounter();

        //Quotes & Assign ABS
            await page.getByRole('link', { name: ' Quotes & Assigned ABS ' }).click();
            await page.waitForTimeout(1500); 

        // Quotes & Assign ABS Validation
        const QuotesAssignABSUrl = page.url();
        const QuotesAssignABS = await page.locator('button[aria-label="Assign ABS"]')
            .waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false);
        if (QuotesAssignABS) {

            addResult({
                product: "Research",
                srNo: getSrCounter().toString(),
                module: 'Request Quotes',
                status: 'Pass',
                URL: `<a href="${QuotesAssignABSUrl}">Request Quotes</a>`
            });

            console.log("✅ Request Quotes tab opened successfully.");

        } else {

            addResult({
                product: "Research",
                srNo: getSrCounter().toString(),
                module: 'Request Quotes',
                status: 'Fail',
                URL: `<a href="${QuotesAssignABSUrl}">Request Quotes</a>`
            });

            console.log("❌ Request Quotes tab validation failed.");
        }
        incrementSrCounter();

        //Assign ABS
        await page.locator('button[aria-label="Assign ABS"]').click();
        await page.waitForTimeout(1500);


        //Abstractor fee
        await page.locator('input[formcontrolname="abstractorFee"]').fill("1000.25");
        await page.waitForTimeout(1500);

        //Upload Document
        // Attached through the Assign ABS panel's own control below. Do not
        // navigate to the Documents tab here — the Assign ABS panel
        // (div.add-new-popup.active) overlays the page, so clicking the tab
        // behind it is intercepted and retries until the test times out.

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

        
            // Verify History: PENDING ABS ASSIGN -> ABS ASSIGNED
            historyOk = await historyShows('PENDING ABS ASSIGN', 'ABS ASSIGNED');
    
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
            // console.log("Customer Order in Assigned Queue: ", CustomerOrder_AssignedQueue);
            const CustomerName_AssignedQueue = (await page.locator('div[col-id="client"]').nth(1).innerText()).trim();
            // console.log("Customer Name in Assigned Queue: ", CustomerName_AssignedQueue);
            const AbstractorName_AssignedQueue = (await page.locator('div[col-id="abstractor"]').nth(1).innerText()).trim();
            console.log("✅ Abstractor Name in Assigned Queue: ", AbstractorName_AssignedQueue);


            // ABS Assign Validation — history transition, queue presence, and the
            // client/abstractor details shown in the ABS Assigned grid.
            mod = label('ABS Assign');
            modUrl = page.url();
            const ABSAssignDetails =
                normalize(CustomerOrder_AssignedQueue) === normalize(CustomerOrder) &&
                normalize(CustomerName_AssignedQueue) === normalize(CustomerName) &&
                normalize(AbstractorName_AssignedQueue) === normalize(AbstractorName);

            if (historyOk && ABSAssignDetails && await inQueueGrid(CustomerOrder)) {

                addResult({
                    product: "Research",
                    srNo: getSrCounter().toString(),
                    module: mod,
                    status: 'Pass',
                    URL: `<a href="${modUrl}">${mod}</a>`
                });

                console.log(`✅ ${mod}: assigned and present in ABS Assigned queue.`);

            } else {

                addResult({
                    product: "Research",
                    srNo: getSrCounter().toString(),
                    module: mod,
                    status: 'Fail',
                    URL: `<a href="${modUrl}">${mod}</a>`
                });

                console.log(`❌ ${mod} validation failed. Order ID: ${CustomerOrder}`);
            }
            incrementSrCounter();


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
    
    // Verify History: ABS ASSIGNED -> ABS CONFIRMED
    historyOk = await historyShows('ABS ASSIGNED', 'ABS CONFIRMED');

        //ABS Confirmed
        await page.locator('a[href="/app/internal/research/vendor-mgt/abs-confirmed"]').click();
        await page.waitForTimeout(1500);
        await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);

        // ABS Confirmed Validation
        mod = label('ABS Confirmed');
        modUrl = page.url();
        if (historyOk && await inQueueGrid(CustomerOrder)) {

            addResult({
                product: "Research",
                srNo: getSrCounter().toString(),
                module: mod,
                status: 'Pass',
                URL: `<a href="${modUrl}">${mod}</a>`
            });

            console.log(`✅ ${mod}: order present in queue.`);

        } else {

            addResult({
                product: "Research",
                srNo: getSrCounter().toString(),
                module: mod,
                status: 'Fail',
                URL: `<a href="${modUrl}">${mod}</a>`
            });

            console.log(`❌ ${mod} validation failed.`);
        }
        incrementSrCounter();

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
    
    // Verify History: ABS CONFIRMED -> RECEIVED FROM ABS
    historyOk = await historyShows('ABS CONFIRMED', 'RECEIVED FROM ABS');

    //ABS Confirmed
        await page.locator('a[href="/app/internal/research/vendor-mgt/received-from-abs"]').click();
        await page.waitForTimeout(1500);
        await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
        await page.waitForTimeout(1500);

        // Received From ABS Validation
        mod = label('Received From ABS');
        modUrl = page.url();
        if (historyOk && await inQueueGrid(CustomerOrder)) {

            addResult({
                product: "Research",
                srNo: getSrCounter().toString(),
                module: mod,
                status: 'Pass',
                URL: `<a href="${modUrl}">${mod}</a>`
            });

            console.log(`✅ ${mod}: order present in queue.`);

        } else {

            addResult({
                product: "Research",
                srNo: getSrCounter().toString(),
                module: mod,
                status: 'Fail',
                URL: `<a href="${modUrl}">${mod}</a>`
            });

            console.log(`❌ ${mod} validation failed.`);
        }
        incrementSrCounter();

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

        // Quality Check Validation — no History transition is recorded for this
        // step today, so the check is the order's presence in the queue.
        mod = label('Quality Check');
        modUrl = page.url();
        if (await inQueueGrid(CustomerOrder)) {

            addResult({
                product: "Research",
                srNo: getSrCounter().toString(),
                module: mod,
                status: 'Pass',
                URL: `<a href="${modUrl}">${mod}</a>`
            });

            console.log(`✅ ${mod}: order present in queue.`);

        } else {

            addResult({
                product: "Research",
                srNo: getSrCounter().toString(),
                module: mod,
                status: 'Fail',
                URL: `<a href="${modUrl}">${mod}</a>`
            });

            console.log(`❌ ${mod} validation failed.`);
        }
        incrementSrCounter();

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

        // Verify History: QUALITY CHECK -> ABS REJECTS
        historyOk = await historyShows('QUALITY CHECK', 'ABS REJECTS');

            //ABS Rejects
            await page.locator('span[class="title"]').nth(8).click();
            await page.waitForTimeout(1500);
            await page.locator('a[href="/app/internal/research/vendor-mgt/abs-rejects"]').click();
            await page.waitForTimeout(1500);
            await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);

            // // ABS Reject Validation
            
            mod = label('ABS Reject');
            modUrl = page.url();
            if (historyOk && await inQueueGrid(CustomerOrder)) {

           addResult({
                    product: "Research",
                    srNo: getSrCounter().toString(),
                    module: mod,
                    status: 'Pass',
                    URL: `<a href="${modUrl}">${mod}</a>`
                });

             console.log(`✅ ${mod}: order present in queue.`);

              } else {

             addResult({
                    product: "Research",
                    srNo: getSrCounter().toString(),
                    module: mod,
                    status: 'Fail',
                    URL: `<a href="${modUrl}">${mod}</a>`
                });

                           console.log(`❌ ${mod} validation failed.`);
            }
            incrementSrCounter();

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
           
            

            // Quotes Review Validation
            mod = 'Quotes Review';
            modUrl = page.url();
            if (normalize(CustomerOrder_QRQueue) === normalize(CustomerOrder)
                && normalize(CustomerName_QRQueue) === normalize(CustomerName)
                && await inQueueGrid(CustomerOrder)) {

                addResult({
                    product: "Research",
                    srNo: getSrCounter().toString(),
                    module: mod,
                    status: 'Pass',
                    URL: `<a href="${modUrl}">${mod}</a>`
                });

                console.log(`✅ ${mod}: grid validation successful for Order ID: ${CustomerOrder_QRQueue}`);

            } else {

                addResult({
                    product: "Research",
                    srNo: getSrCounter().toString(),
                    module: mod,
                    status: 'Fail',
                    URL: `<a href="${modUrl}">${mod}</a>`
                });

                console.log(`❌ ${mod} grid validation failed. Order ID: ${CustomerOrder}`);
            }
            incrementSrCounter();
         
            const searchInput = page.locator('input[placeholder="Search keyword"]');
            await searchInput.clear();
            await searchInput.fill(CustomerOrder);
            await page.waitForTimeout(1500);
            await page.locator('div[col-id="customerNumber"]').nth(1).click();
            await page.waitForTimeout(1500);

            // //Search by Order ID or Customer ID
            // await page.locator('input[placeholder="Search by Order ID or Customer ID"]').fill(CustomerOrder);
            // await page.waitForTimeout(1500);  
            // await page.keyboard.press('Enter');
            // await page.locator('div[col-id="orderId"]').nth(1).click(); 
            // await page.waitForTimeout(1500); 

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

        
            // Verify History: PENDING ABS ASSIGN -> ABS ASSIGNED
            historyOk = await historyShows('PENDING ABS ASSIGN', 'ABS ASSIGNED');
    
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
    
    // Verify History: ABS ASSIGNED -> ABS CONFIRMED
    historyOk = await historyShows('ABS ASSIGNED', 'ABS CONFIRMED');

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
        
        // Verify History: ABS CONFIRMED -> RECEIVED FROM ABS
        historyOk = await historyShows('ABS CONFIRMED', 'RECEIVED FROM ABS');

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

        // Verify History: QUALITY CHECK -> ABS REJECTS
        historyOk = await historyShows('QUALITY CHECK', 'ABS REJECTS');

            //ABS Rejects
            await page.locator('span[class="title"]').nth(8).click();
            await page.waitForTimeout(1500);
            await page.locator('a[href="/app/internal/research/vendor-mgt/abs-rejects"]').click();
            await page.waitForTimeout(1500);
            await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
            await page.waitForTimeout(1500);

           
 const results = getResults();
     await sendMail(results);


});

// test.afterAll(async ({}, testInfo) => {
//     const results = getResults();
//     const baseURL =
//         testInfo.project.use.baseURL ||
//         'https://dev-outamateds.outamationlabs.com/';
//     await sendMail(results); //await sendMail(results, baseURL); 
// });