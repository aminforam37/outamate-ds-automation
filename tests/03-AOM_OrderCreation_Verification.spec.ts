import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/en';
import { addResult, getResults, getSrCounter, incrementSrCounter  } from '../resultsCollector'; 
import { sendMail } from '../mail';
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


test('@Outamate DS: Order Creation ', async ({ page }) => {


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
            text.startsWith('*****'); 

            const isGenericHttpWrapper = 
            text.includes('HttpErrorResponse') || 
            text.includes('Failed to load resource');

        // Only log actual errors that aren't related to the AG Grid trial license
        if (msg.type() === 'error' && !isAgGridNoise && !isGenericHttpWrapper) {
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

    console.log("");
    console.log("\x1b[1mOrder Creation:\x1b[0m");
    console.log("📝 Initiating new order creation flow...");


    //Order Entry 
    await page.locator('span[class="title"]').nth(2).click();
    await page.waitForTimeout(1500);  

    //Order Creation
    await page.locator('a[href="/app/internal/assignments/orders/new"]').click();
    await page.waitForTimeout(1500);

   
    const reportBase = getSrCounter();
        const orderUrl = page.url();

        const isOrderCreationPage =
            /\/app\/internal\/assignments\/orders\/new$/.test(orderUrl);

        addResult({
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

    //Project Code
    await page.locator('[aria-haspopup="listbox"]').nth(1).click();
    await page.waitForTimeout(1500);
    const ProjCode = await page.locator('span[class="mdc-list-item__primary-text"]').nth(1);
    await page.waitForTimeout(1500);
    const ProjectCode = await ProjCode.innerText();
    //console.log("Project Code: ", ProjectCode);
    await ProjCode.click();
    await page.waitForTimeout(1500);
   // const ProjectCode = await page.locator('mat-select[formcontrolname="project"] > div').innerText();

    //Division
    await page.locator('[aria-haspopup="listbox"]').nth(2).click();
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

    //Product Type
    await page.locator('[aria-haspopup="listbox"]').nth(3).click();
    await page.waitForTimeout(1500);
    const ProductTypeElement = await page.locator('span[class="mdc-list-item__primary-text"]').nth(1);
    await page.waitForTimeout(1500);
    const ProductType = await ProductTypeElement.innerText();
    await ProductTypeElement.click();
    await page.waitForTimeout(1500);
   // const ProductType = await page.locator('mat-select[formcontrolname="productType"] > div').innerText();

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
    await page.locator('[aria-haspopup="listbox"]').nth(4).click();
    await page.waitForTimeout(1500);
    const StateField = await page.locator('span[class="mdc-list-item__primary-text"]').nth(0);
    const State = await StateField.innerText();
    await StateField.click();
    await page.waitForTimeout(1000);
    //console.log("State: ", State);    
    //const State = await page.locator('mat-select[formcontrolname="state"] > div').innerText();
    

    //County
    await page.locator('[aria-haspopup="listbox"]').nth(5).click();
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

    // //Assignee
    // const Assignee = faker.person.fullName();
    // await page.locator('input[formcontrolname="aomAssignee"]').fill(Assignee);
    // await page.waitForTimeout(1500);

    // //Assignor
    // const Assignor = faker.person.fullName();
    // await page.locator('input[formcontrolname="aomAssignor"]').fill(Assignor);
    // await page.waitForTimeout(1500);

    //Signing/Vesting
    const SigningLocator = page.locator('input[formcontrolname="signing"]');
     await SigningLocator.fill("Signing");
     await page.waitForTimeout(1500);
     const Signing = await SigningLocator.inputValue();
     //console.log("Signing/Vesting: ", Signing);
    

    //Special Instruction
    const SpecialInstructions = await page.locator('textarea[formcontrolname="specialInstructions"]').fill("All documents needed");
    await page.waitForTimeout(1000);

    //Submit Order
    await page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-primary"]').click();
    await page.waitForTimeout(1500);

    // Wait for redirect to Order Details page
    await page.waitForURL(/\/app\/internal\/assignments\/orders\/\d+\/details/);

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
    console.log("\x1b[1mOrder Details Verification:\x1b[0m");

    //Hold Queue Verification
    await page.locator('span[class="title"]').nth(7).click();
    await page.waitForTimeout(1500);
    //Hold Queue 
    await page.locator('a[href="/app/internal/assignments/customer-support/hold"]').click();
    await page.waitForTimeout(1500);  
    //Search with Customer Order Number
    await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
    await page.waitForTimeout(1500);    
    // await page.locator('div[col-id="orderId"]').nth(1); 
    // await page.waitForTimeout(1500);

    //Verify Order Details
   // const OrderID_HoldQueue = await page.locator('div[col-id="orderId"]').nth(1).innerText();
    const CustomerOrder_HoldQueue = (await page.locator('div[col-id="customerOrderNumber"]').nth(1).innerText()).trim();
    // console.log("Customer Order in Hold Queue: ", CustomerOrder_HoldQueue);
    const CustomerName_HoldQueue = (await page.locator('div[col-id="customer"]').nth(1).innerText()).trim();
   //console.log("Customer Name in Hold Queue: ", CustomerName_HoldQueue);
    const projectCode_HoldQueue = (await page.locator('div[col-id="projectCode"]').nth(1).innerText()).trim();
    //console.log("Project Code in Hold Queue: ", projectCode_HoldQueue);         
    const Division_HoldQueue = (await page.locator('div[col-id="clientDivision"]').nth(1).innerText()).trim();
    //console.log("Division in Hold Queue: ", Division_HoldQueue);
    const ProductType_HoldQueue = (await page.locator('div[col-id="productType"]').nth(1).innerText()).trim();
    //console.log("Product Type in Hold Queue: ", ProductType_HoldQueue);
    const address_HoldQueue = (await page.locator('div[col-id="propertyAddress"]').nth(1).innerText()).trim();
    //console.log("Address Line 1 in Hold Queue: ", address_HoldQueue);
    const state_HoldQueue = (await page.locator('div[col-id="state"]').nth(1).innerText()).trim();
    //console.log("State in Hold Queue: ", state_HoldQueue);
    const county_HoldQueue = (await page.locator('div[col-id="county"]').nth(1).innerText()).trim();
    //console.log("County in Hold Queue: ", county_HoldQueue);


   // const normalize = (val: string) => val?.replace(/\s+/g, " ").replace(/&amp;/g, "&").trim().toLowerCase();

   const normalize = (val: any) => typeof val === "number"? Number(val).toFixed(2): String(val ?? "").replace(/\s+/g, " ") .replace(/&amp;/g, "&") .trim() .toLowerCase(); //New added

    const expectedAddress = `${AddressLine1}, ${City}, ${State}, ${Zipcode}`;
    //console.log("Expected Address: ", expectedAddress);
    const expectedProjectCode = ProjectCode.split(" - ")[0].trim();
    //console.log("Expected Project Code: ", expectedProjectCode);

    if (normalize(CustomerOrder_HoldQueue) === normalize(CustomerOrder)
        && normalize(projectCode_HoldQueue) === normalize(expectedProjectCode)
        && normalize(CustomerName_HoldQueue) === normalize(CustomerName)
        && normalize(Division_HoldQueue) === normalize(Division)
        && normalize(ProductType_HoldQueue) === normalize(ProductType)
        && normalize(address_HoldQueue) === normalize(expectedAddress)
        && normalize(state_HoldQueue) === normalize(State)
        && normalize(county_HoldQueue) === normalize(County)) 
        // {
        // console.log("✅ Order details in Hold Queue are correct and match the created order.");
        // } else {
        // console.log("❌ Order details in Hold Queue do not match the created order or are incorrect.");
        // }   
    //      {
    //     console.log("✅ All order fields verified successfully.");

    //       const verificationUrl = await page.url();
    //       const clickableVer = '<a href="' + verificationUrl + '" target="_blank">Verification Details</a>';
    //       addResult({
    //         srNo: `${reportBase}.1`,
    //         module: 'Create Order Verification',
    //         status: 'Pass',
    //         URL: clickableVer
    //       });

    //     } else {
    //     console.log("❌ Order field verification failed. One or more fields have incorrect or missing values.");

    //     const failedVerificationUrl = await page.url();
    //     const clickableVer = '<a href="' + failedVerificationUrl + '" target="_blank">Verification Details</a>';
    //     addResult({
    //       srNo: `${reportBase}.2`,
    //       module: 'Create Order Verification',
    //       status: 'Fail',
    //       URL: clickableVer
    //  });
    //     }   
   // Ensure this entire snippet is inside your function block (e.g., async () => { ... })

   {

    addResult({
            srNo: `${reportBase}.1`,
            module: 'Create Order Verification',
            status: 'Pass',
            URL: `<a href="${orderDetailsUrl}" target="_blank">Create Order Verification</a>`
        });

        console.log("✅ All order fields verified successfully.");

    } else {

        addResult({
            srNo: `${reportBase}.1`,
            module: 'Create Order Verification',
            status: 'Fail',
            URL: `<a href="${orderDetailsUrl}" target="_blank">Create Order Verification</a>`
        });

        console.log("❌ Order field verification failed. One or more fields have incorrect or missing values.");
    }

    //Search with Customer Order Number
    await page.locator('input[placeholder="Search keyword"]').fill(CustomerOrder); //CustomerOrder
    await page.waitForTimeout(1500);    
    await page.locator('div[col-id="orderId"]').nth(1).click(); 
    await page.waitForTimeout(1500);
    

    console.log("");
    console.log("\x1b[1mRelated Orders Verification:\x1b[0m");


        await page.locator('a[href*="/related-orders"]').click();
        await page.waitForTimeout(1500);

        // Get Related Order rows
        const relatedOrderRows = page.locator('.ag-center-cols-container .ag-row');
        const relatedOrderCount = await relatedOrderRows.count();

        //console.log("Related Orders Count:", relatedOrderCount);

        let relatedOrder_CustomerOrder = '';
        let relatedOrder_ProductType = '';
        let relatedOrder_RequestCode = '';

        if (relatedOrderCount > 0) {

            console.log("✅ Related Order entry is available");
            const relatedOrdersUrl = page.url();
            relatedOrder_CustomerOrder = (  await page.locator('div[col-id="customerOrderNumber"]').nth(1).innerText() ).trim();

            relatedOrder_ProductType = (  await page.locator('div[col-id="productType"]').nth(1).innerText() ).trim();

            relatedOrder_RequestCode = (await page.locator('div[col-id="requestCode"]').nth(1).innerText() ).trim();

            // console.log("Customer Order in Related Orders:", relatedOrder_CustomerOrder);
            //  console.log("Product Type in Related Orders:", relatedOrder_ProductType);
            //  console.log("Request Code in Related Orders:", relatedOrder_RequestCode);
            
             addResult({
            srNo: `${reportBase}.2`,
            module: 'Related Orders ',
            status: 'Pass',
            URL: `<a href="${relatedOrdersUrl}" target="_blank">Related Orders</a>`
        });
        } else {

            console.log("❌ No Related Orders available");
             const relatedOrdersUrl = page.url();

            addResult({
                srNo: `${reportBase}.2`,
                module: 'Related Orders ',
                status: 'Fail',
                URL: `<a href="${relatedOrdersUrl}" target="_blank">Related Orders</a>`
            });
            return;
        }

        const [researchPage] = await Promise.all([
            page.context().waitForEvent('page'),
            page.locator('div[col-id="orderId"]').nth(1).click()
        ]);

        // Wait for new tab to load
        //await researchPage.waitForLoadState('networkidle');

      //  console.log("Research Page URL:", researchPage.url());


        // Wait for page load
        await researchPage.waitForLoadState('networkidle');
        await researchPage.waitForTimeout(1500);

    const CustomerOrder_Research = (await researchPage.locator('span.button-style.cursor-pointer').innerText()).trim();
   // console.log("Customer Order in Research:", CustomerOrder_Research);
    const ProductType_Research = (await researchPage.locator('span.d-block.text-body').filter({ hasText: 'Document Retrieval' }).innerText()).trim();
    //console.log("Product Type in Research: ", ProductType_Research);
    const RequestCode_Research = (await researchPage.locator('span.d-block.text-body').filter({ hasText: 'APR ' }).innerText()).trim();
    //console.log("Request Code in Research: ", RequestCode_Research);

        //const normalize = (val: string) => val ?.replace(/\s+/g, " ").replace(/&amp;/g, "&") .trim().toLowerCase();

       if (
        normalize(relatedOrder_CustomerOrder) === normalize(CustomerOrder_Research) &&
        normalize(relatedOrder_ProductType) === normalize(ProductType_Research) &&
        normalize(relatedOrder_RequestCode) === normalize(RequestCode_Research) 
        ) 
    {

        console.log("✅ Related Order details in Research Page are correct and match.");
        const ResearchUrl = await researchPage.url();
        const clickableResearch = '<a href="' + ResearchUrl + '" target="_blank">Research Page</a>';
        addResult({
            srNo: `${reportBase}.3`,
            module: 'New Research Order',
            status: 'Pass',
            URL: clickableResearch
        });
        } else {

        console.log("❌ Related Order details do not match.");
        const failedResearchUrl = await researchPage.url();
        const clickableResearch = '<a href="' + failedResearchUrl + '" target="_blank">Research Page</a>';
        addResult({
        srNo: `${reportBase}.3`,
        module: 'New Research Order',
        status: 'Fail',
        URL: clickableResearch
        });

    }

            await researchPage.close();
            await page.bringToFront();
           // console.log("AOM Page URL:", page.url());
            await page.waitForTimeout(1500);
            await page.locator('a[href*="/related-orders"]').click();
            await page.waitForTimeout(1500);


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

    //Edit Order - Change Project Code
    await page.locator('[aria-haspopup="listbox"]').nth(1).click();
    await page.waitForTimeout(1500);
    const ProjCodeUD = await page.locator('span[class="mdc-list-item__primary-text"]').nth(0);
    await page.waitForTimeout(1500);
    const ProjectCodeEdit = await ProjCodeUD.innerText();
   // console.log("Project Code: ", ProjectCodeEdit);
    await ProjCodeUD.click();
    await page.waitForTimeout(1500);

    //Edit Order - Change Division
     await page.locator('[aria-haspopup="listbox"]').nth(2).click();
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
    const ProductTypeEdit = await page.locator('span[class="mdc-list-item__primary-text"]').nth(1);
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
    await page.waitForURL(/\/app\/internal\/assignments\/orders\/\d+\/details/);
    const editedOrderUrl = page.url();
    //console.log("Edited Order URL:", editedOrderUrl);

    // Validate edit order success
    const isOrderEdited =
        /\/app\/internal\/assignments\/orders\/\d+\/details/.test(editedOrderUrl);
        addResult({
        srNo: `${reportBase}.4`,
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
    const NewvalueProjectCode = (await page.getByRole('gridcell', { name: 'AP001' }).innerText()).trim();
  //  console.log("New Project Code in History: ", NewvalueProjectCode);
    const NewvalueDivision = (await page.getByRole('gridcell', { name: 'Batch Division' }).innerText()).trim();
 //   console.log("New Division in History: ", NewvalueDivision);
    const NewvalueLender = (await page.getByRole('gridcell', { name: 'John Doe' }).innerText()).trim();
 //   console.log("New Lender Name in History: ", NewvalueLender);
    const NewvalueAddress =  (await page.getByRole('gridcell', { name: AddressLine1Edit }).innerText()).trim();
 //   console.log("New Address Line 1 in History: ", NewvalueAddress);

    const expectedProjectCodeHistory = NewvalueProjectCode.split(" - ")[0].trim();

    if (NewvalueCustomer === CustomerNameEdit 
        && NewvalueProjectCode === expectedProjectCodeHistory
        && NewvalueDivision === DivisionEdit
        && NewvalueLender === LenderNameEdit    
        && NewvalueAddress === AddressLine1Edit
        ) {
        addResult({
            srNo: `${reportBase}.5`,
            module: 'Edit History Verification',
            status: 'Pass',
            URL: `<a href="${page.url()}">Edit History</a>`
        });
        console.log("✅ History details are correct and match the created order.");
    } else {            
            addResult({
            srNo: `${reportBase}.5`,
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
  // Set files — this triggers the file input change event
  await fileInput.setInputFiles([filePath1, filePath2,filePath3,filePath4]);
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




                
});

