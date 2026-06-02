import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { addResult, getResults,  getSrCounter, incrementSrCounter } from '../resultsCollector'; 
import { sendMail } from '../mail';


//let testResults: {srNo: any, module: any, status: any, URL: any }[] = [];
let status = 'Fail';
let isPassed = true;

const successMessageSelector = 'Login : Successfully Login'; 
const errorMessageSelector = 'Login : Login failed'; 


test('@Outamate DS: Dashboard Received ', async ({ page , baseURL}) => {

    await page.goto(baseURL ??  '/app/internal/assignments/dashboard/order-status');
    await page.waitForLoadState('networkidle');
    await page.locator('h6[class="module-title"]').nth(1).click();
    await page.waitForTimeout(1500);

    console.log("");
    console.log("\x1b[1mDashboard:\x1b[0m");
    await page.waitForTimeout(3000);
    //Open Counts from Dashboard
    const dashboardOpen = await page.locator('h5[id="open-count"]').innerText();
    console.log('Open Count:', dashboardOpen);
    await page.waitForTimeout(1500);

    const currentUrl = page.url();

    //Overdue Counts from Dashboard
    const dashboardOverdue = await page.locator('h5[id="overdue-count"]').innerText();
    await page.waitForTimeout(1500);
    console.log('Overdue Count:', dashboardOverdue);
    await page.waitForTimeout(1500);
    //At Risk Counts from Dashboard
    const dashboardRisk = await page.locator('h5[id="atRisk-count"]').innerText();
    await page.waitForTimeout(1500);
    console.log('At Risk Count:', dashboardRisk);
    await page.waitForTimeout(1500);
    //Hold Counts from Dashboard
    const dashboardHold = await page.locator('h5[id="hold-count"]').innerText();
    await page.waitForTimeout(3000);
    console.log('Hold Count:', dashboardHold);
    await page.waitForTimeout(1500);


    console.log("\x1b[1m1.Open Counts:\x1b[0m");
    // console.log('1.Open Counts!!');
    
    // Order Entry
    await page.locator('mat-expansion-panel-header', { hasText: 'Order Entry' }).click({ force: true });
    // await page.locator('span[class="title"]').nth(2).click(); 
    await page.waitForTimeout(500);  

    //All Orders Grid
    const allOrdersGridItem = page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(9);
   // await allOrdersGridItem.waitFor({ state: 'visible' });
    await allOrdersGridItem.click();
   // await page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(9).click();
    
   //Due Tomorrow Grid
    await page.locator('span.chip-label:has-text("Due Tomorrow")').click(); // [class="mdc-evolution-chip__text-label mat-mdc-chip-action-label"]
    await page.waitForTimeout(1500);
    
        const statusesDueTomorrow = ['HOLD', 'FEE INCREASE', 'SEARCH INQUIRIES','COMPLETED - PROPERTY NOT FOUND'];

        // Open filter only once
        await page.locator('div.ag-floating-filter-button').nth(7).click();

        for (const status of statusesDueTomorrow) {

        const searchBox = page.locator('input[aria-label="Search filter values"]');

        // Clear and search
        await searchBox.clear();
        await searchBox.fill(status);

        // Wait for filtered results
        await page.waitForTimeout(1000);

        // Find matching option
        const option = page
            .locator('div.ag-input-field-label.ag-label.ag-checkbox-label.ag-label-ellipsis')
            .filter({ hasText: status });

        // Click only if available
        if (await option.count() > 0) {
            //console.log(`${status} available`);
            await option.first().click();
        } else {
        // console.log(`${status} NOT available`);
        }

            await page.waitForTimeout(1000);
    }
 
    const DueTomorrowGrid = await page.locator('span[ref="lbRecordCount"]').innerText();
    await page.waitForTimeout(1500);
    console.log('Due Tomorrow Grid Count:', DueTomorrowGrid);
    await page.reload();
    //Due in 2+ days Grid Count
    await page.locator('span.chip-label:has-text("Due in 2+ days")').click();
    await page.waitForTimeout(1500);
    
    
        const statusesDuein2days = ['HOLD', 'FEE INCREASE', 'SEARCH INQUIRIES','COMPLETED - PROPERTY NOT FOUND'];

        // Open filter only once
        await page.locator('div.ag-floating-filter-button').nth(7).click();

        for (const status of statusesDuein2days) {

        const searchBox = page.locator('input[aria-label="Search filter values"]');

        // Clear and search
        await searchBox.clear();
        await searchBox.fill(status);

        // Wait for filtered results
        await page.waitForTimeout(1000);

        // Find matching option
        const option = page
            .locator('div.ag-input-field-label.ag-label.ag-checkbox-label.ag-label-ellipsis')
            .filter({ hasText: status });

        // Click only if available
        if (await option.count() > 0) {
            //console.log(`${status} available`);
            await option.first().click();
        } else {
        // console.log(`${status} NOT available`);
        }

            await page.waitForTimeout(1000);
    }

    const Due2DayGrid = await page.locator('span[ref="lbRecordCount"]').innerText();
    await page.waitForTimeout(1500);
    
    console.log('Due in 2+ days Grid Count:', Due2DayGrid);

    const totalCount = parseInt(DueTomorrowGrid) + parseInt(Due2DayGrid);
    //console.log('Total Count from Due Tomorrow and Due 2Day Grids:', totalCount);

    const dashboardCountText = dashboardOpen.replace(/,/g, '').trim();
    
        if (dashboardCountText === totalCount.toString()) {
        console.log('✅ The counts match!');
        } else {
            isPassed = false;
        console.log(`❌ The counts do not match. Dashboard: ${dashboardCountText}, Total Count: ${totalCount}`);
        }       

        console.log("\x1b[1m2.Overdue Counts:\x1b[0m");
        //OverDue Grid
        await page.reload();

        // // Order Entry
        // await page.locator('span[class="title"]').nth(2).click();
        // await page.waitForTimeout(1500);  
        // //All Orders Grid
        // await page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(9).click();
        // await page.reload();
        //Overdue Grid
        await page.locator('span.chip-label:has-text("Overdue")').click();
        await page.waitForTimeout(1500);

        // // Click on the filter icon for the "Status" column
        // await page.locator('div[class="ag-floating-filter-button"]').nth(7).click();
        // await page.locator('input[aria-label="Search filter values"]').pressSequentially('HOLD', { delay: 50 });
        // await page.waitForTimeout(1500);
        // await page.locator('div[class="ag-input-field-label ag-label ag-checkbox-label ag-label-ellipsis"]').nth(1).click();
        // await page.waitForTimeout(1500);

        // //Click on the filter icon for the "Status" column
        // await page.locator('input[aria-label="Search filter values"]').clear();
        // await page.waitForTimeout(500);
        // await page.locator('input[aria-label="Search filter values"]').pressSequentially('FEE INCREASE', { delay: 50 });
        // await page.waitForTimeout(1500);
        // await page.locator('div[class="ag-input-field-label ag-label ag-checkbox-label ag-label-ellipsis"]').nth(1).click();
        // await page.waitForTimeout(1500);

        // //Click on the filter icon for the "Status" column
        // await page.locator('input[aria-label="Search filter values"]').clear();
        // await page.waitForTimeout(500);
        // await page.locator('input[aria-label="Search filter values"]').pressSequentially('SEARCH INQUIRIES', { delay: 50 });
        // await page.waitForTimeout(1500);
        // // await page.locator('div[class="ag-input-field-label ag-label ag-checkbox-label ag-label-ellipsis"]').nth(1).click();
        // // await page.waitForTimeout(3000);

    

        // const OverdueGrid = await page.locator('span[ref="lbRecordCount"]').innerText();
        // await page.waitForTimeout(1500);
        // console.log('Overdue Grid Count:', OverdueGrid);

        // if (dashboardOverdue === OverdueGrid) {
        //     console.log('✅ The counts match!');
        // } else {
        //     isPassed = false;
        //     console.log(`❌ The counts do not match. Dashboard: ${dashboardOverdue}, Overdue Grid Count: ${OverdueGrid}`);
        // }

        const statuses = ['HOLD', 'FEE INCREASE', 'SEARCH INQUIRIES'];

        // Open filter only once
        await page.locator('div.ag-floating-filter-button').nth(7).click();

        for (const status of statuses) {

        const searchBox = page.locator('input[aria-label="Search filter values"]');

        // Clear and search
        await searchBox.clear();
        await searchBox.fill(status);

        // Wait for filtered results
        await page.waitForTimeout(1000);

        // Find matching option
        const option = page
            .locator('div.ag-input-field-label.ag-label.ag-checkbox-label.ag-label-ellipsis')
            .filter({ hasText: status });

        // Click only if available
        if (await option.count() > 0) {
            //console.log(`${status} available`);
            await option.first().click();
        } else {
        // console.log(`${status} NOT available`);
        }

            await page.waitForTimeout(1000);

    }
        const OverdueGrid = await page.locator('span[ref="lbRecordCount"]').innerText();
        await page.waitForTimeout(1500);
        console.log('Overdue Grid Count:', OverdueGrid);

        if (dashboardOverdue === OverdueGrid) {
            console.log('✅ The counts match!');
        } else {
            isPassed = false;
            console.log(`❌ The counts do not match. Dashboard: ${dashboardOverdue}, Overdue Grid Count: ${OverdueGrid}`);
        }

        //  //Back to Dashborad
        // await page.locator('span[class="title"]').nth(0).click();
        // await page.waitForTimeout(1500);
        // //Click Status
        // await page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(0).click();
        // await page.waitForTimeout(1500);

        console.log("\x1b[1m3.At Risk Counts:\x1b[0m");
        //At Risk Grid
        await page.reload();

        // // Order Entry
        // await page.locator('span[class="title"]').nth(2).click();
        // await page.waitForTimeout(1500);  
        // //All Orders Grid
        // await page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(9).click();

        //Due Today Grid
        await page.locator('span.chip-label:has-text("Due Today")').click();
        await page.waitForTimeout(1500);

         const statusesRisk = ['HOLD', 'FEE INCREASE', 'SEARCH INQUIRIES'];

        // Open filter only once
        await page.locator('div.ag-floating-filter-button').nth(7).click();

        for (const status of statusesRisk) {

        const searchBox = page.locator('input[aria-label="Search filter values"]');

        // Clear and search
        await searchBox.clear();
        await searchBox.fill(status);

        // Wait for filtered results
        await page.waitForTimeout(1000);

        // Find matching option
        const option = page
            .locator('div.ag-input-field-label.ag-label.ag-checkbox-label.ag-label-ellipsis')
            .filter({ hasText: status });

        // Click only if available
        if (await option.count() > 0) {
            //console.log(`${status} available`);
            await option.first().click();
        } else {
        // console.log(`${status} NOT available`);
        }

            await page.waitForTimeout(1000);
    }

        const AtRiskGrid = await page.locator('span[ref="lbRecordCount"]').innerText();
        await page.waitForTimeout(1500);
        console.log('At Risk Grid Count:', AtRiskGrid);     
        
        if (dashboardRisk === AtRiskGrid) {
            console.log('✅ The counts match!');
        }   else {      
            isPassed = false;
            console.log(`❌ The counts do not match. Dashboard: ${dashboardRisk}, At Risk Grid Count: ${AtRiskGrid}`);
        }

        // //Back to Dashborad
        // await page.locator('span[class="title"]').nth(0).click();
        // await page.waitForTimeout(1500);
        // //Click Status
        // await page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(0).click();
        // await page.waitForTimeout(1500);

        console.log("\x1b[1m4.Hold Counts:\x1b[0m");
        //Hold Grid
        await page.reload();

        // // Order Entry
        // await page.locator('span[class="title"]').nth(2).click();
        // await page.waitForTimeout(1500);  
        // //All Orders Grid
        // await page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(9).click();

        // //Overdue Grid
        // await page.locator('span.chip-label:has-text("Due Today")').click();
        // await page.waitForTimeout(1500);

        // Open Status filter
        await page.locator('div.ag-floating-filter-button').nth(7).click();

        // Wait for popup
        const searchInput = page.locator('input[aria-label="Search filter values"]');
        await searchInput.waitFor();

        // Uncheck Select All
        await page.getByText('(Select All)').click();
        await page.waitForTimeout(1000);

        // Search HOLD
        await searchInput.fill('HOLD');
        await page.waitForTimeout(1000);
        await page.getByText('HOLD', { exact: true }).click();
        await page.waitForTimeout(1000);
        // Close filter popup
        await page.keyboard.press('Escape');


        const HoldGrid = await page.locator('span[ref="lbRecordCount"]').innerText();
        await page.waitForTimeout(1500);
        console.log('Hold Grid Count:', HoldGrid);          
        if (dashboardHold === HoldGrid) {
            console.log('✅ The counts match!');
        } else {
            isPassed = false;
            console.log(`❌ The counts do not match. Dashboard: ${dashboardHold}, Hold Grid Count: ${HoldGrid}`);
        }   
        
    await page.waitForLoadState('networkidle');   
   
    const openMatch = dashboardOpen === dashboardOpen;
    const overdueMatch = dashboardOverdue === OverdueGrid;
    const atRiskMatch = dashboardRisk === AtRiskGrid;
    const holdMatch = dashboardHold === HoldGrid;

    let status = (openMatch && overdueMatch && atRiskMatch && holdMatch) ? 'Pass' : 'Fail';

    addResult({
    srNo: getSrCounter().toString(),
    module: 'Dashboard',
    status: status,
    URL: `<a href="${currentUrl}">Dashboard</a>`
  });

    // if (page.url().includes('/app/internal/assignments/dashboard/order-status'))
    // {

    //     status = 'Pass';
    // addResult({
    //     srNo: getSrCounter().toString(),
    //     module: 'Dashboard',
    //     status: 'Pass',
    //     URL: '<a href="https://dev-outamateds.outamationlabs.com/app/internal/assignments/dashboard/order-status">Dashboard</a>'
    // });

    // } else {

    // addResult({
    //     srNo: getSrCounter().toString(),
    //     module: 'Dashboard',
    //     status: 'Fail',
    //     URL: '<a href="https://dev-outamateds.outamationlabs.com/app/internal/assignments/dashboard/order-status">Dashboard</a>'
    // });

    // }
    incrementSrCounter();

   //  const baseURL = process.env.BASE_URL || 'https://dev-outamateds.outamationlabs.com/';
    //  const results = getResults();
    //  await sendMail(results, baseURL);

});