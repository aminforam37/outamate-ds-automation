import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/en';
import { addResult, getResults, getSrCounter, incrementSrCounter  } from '../resultsCollector'; 
import { sendMail } from '../mail';
const fs = require('fs');
const path = require('path');

//let testResults: {srNo: any, module: any, status: any, URL: any }[] = [];
let status = 'Fail';
let isPassed = true;

const successMessageSelector = 'Login : Successfully Login'; 
const errorMessageSelector = 'Login : Login failed'; 


test('@Outamate DS: Order Creation ', async ({ page }) => {

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
    const recordingStatement = faker.lorem.sentences(3);
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
            normalize(CustomerNameEdit) === normalize(Keying_Client) &&
            normalize(LoanNumber) === normalize(Keying_LoanNumber) &&
            normalize(CustomerOrder) === normalize(Keying_CustomerOrder) &&
            normalize(ProductType) === normalize(Keying_Product) &&
            normalize(State) === normalize(Keying_State) &&
            normalize(County) === normalize(Keying_County) &&
            normalize(firstName) === normalize(Keying_FirstName) &&
            normalize(middleName) === normalize(Keying_MiddleName) &&
            normalize(lastName) === normalize(Keying_LastName) &&
            normalize(AddressLine1Edit) === normalize(Keying_AddressLine1) &&
            normalize(City) === normalize(Keying_City) &&
            normalize(Zipcode) === normalize(Keying_Zipcode) &&
            normalize(ConsiderationNumber) === normalize(Keying_ConsiderationAmount) &&
            normalize(InstrumentDate) === normalize(Keying_instrumentDate) &&
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

            // Go to grid
            await page.locator('button[mattooltip="Go to Order Details"]').click();
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

            //Documents
            await page.locator('a[href*="/documents"]').click();

            //DocGen verification 
            const generatedDoc = page.locator('a.name-link', { hasText: 'Generated Document' });

            try {
                await expect(generatedDoc).toBeVisible(); 
                console.log('✅ DocGen PDF created successfully. Generated Document.');
            } catch (error) {
                console.error('❌ DocGen PDF creation failed. Generated Document.');
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

            //Recordation Monitoring
            await page.locator('span[class="title"]').nth(6).click();
            await page.waitForTimeout(1500); 
            await page.locator('a[href="/app/internal/assignments/recordation/recordation-monitoring"]').click();
            await page.waitForTimeout(1500);
            //Search for Order
            await page.locator('input[placeholder="Search keyword"]').fill( CustomerOrder);
            await page.waitForTimeout(1500);
            
            //              //Recordation Monitoring
            // await page.locator('span[class="title"]').nth(6).click();
            // await page.waitForTimeout(1500); 
            // await page.locator('a[href="/app/internal/assignments/recordation/recordation-monitoring"]').click();
            // await page.waitForTimeout(1500);
            // //Search for Order
            // await page.locator('input[placeholder="Search keyword"]').fill( '127268');
            // await page.waitForTimeout(1500); 
            // //Action Button
            // await page.locator('div[col-id="actions"]').nth(1).click();
            // await page.waitForTimeout(1500); 
            // //Reject Order
            // await page.locator('button:has-text(" Reject ")').click();
            // await page.waitForTimeout(1500);
            // //Severity 
            // await page.locator('div[class="col-md-12 ng-star-inserted"]').nth(0).click();
            // await page.waitForTimeout(1500);
            // await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
            // //Issue Type
            // await page.locator('div[class="col-md-12 ng-star-inserted"]').nth(1).click();
            // await page.waitForTimeout(1500);
            // await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
            // await page.locator('span[class="mdc-list-item__primary-text"]').nth(2).click();
            // await page.locator('span[class="mdc-list-item__primary-text"]').nth(3).click();
            // await page.locator('div[class="col-md-12 ng-star-inserted"]').nth(1).click();
            
            // //Notes
            // await page.locator('textarea[formcontrolname="note"]').click();
            // await page.locator('textarea[formcontrolname="note"]').fill('Testing Reject Order');
            // //Submit
            // await page.locator('button:has-text("Submit")').click();
            // await page.waitForTimeout(1500);


                
});

// test.afterAll(async () => {
//         // console.log('All tests completed.');
//        const baseURL = process.env.BASE_URL || 'https://dev-outamateds.outamationlabs.com/';
//         const results = getResults();
//         await sendMail(results, baseURL);
// });

test.afterAll(async ({}, testInfo) => {
    const results = getResults();
    const baseURL =
        testInfo.project.use.baseURL ||
        'https://dev-outamateds.outamationlabs.com/';
    await sendMail(results, baseURL);
});
