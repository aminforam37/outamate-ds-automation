import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { addResult, getResults, getSrCounter, incrementSrCounter  } from '../resultsCollector'; 
import { sendMail } from '../mail';
import path from 'path';
import fs from 'fs';

//let testResults: {srNo: any, module: any, status: any, URL: any }[] = [];
let status = 'Fail';
let isPassed = true;

const successMessageSelector = 'Login : Successfully Login'; 
const errorMessageSelector = 'Login : Login failed'; 




test('@Outamate DS: Reports ', async ({ page, baseURL }) => {
    const base = (baseURL ?? '').replace(/\/$/, '');

    await page.goto('/app/internal/assignments/dashboard/order-status');
    await page.waitForTimeout(1500);
    // Navigate to AOM
    await page.locator('h6[class="module-title"]').nth(1).click();
    await page.waitForTimeout(1500);

    console.log("");
    console.log("\x1b[1mReports:\x1b[0m");

    const reportBase = getSrCounter(); // Capture current srCounter value for this report module

    addResult({
        srNo: getSrCounter().toString(),
        module: 'Reports',
        status: 'Pass',
        URL: 'Reports'
    });
    
    incrementSrCounter();

    //Reports 
    const sidebar = page.locator('.sidebar, .sidenav, .sidebar-area');

    await sidebar.evaluate((el: HTMLElement) => {
    el.scrollTop = el.scrollHeight;
    });

    const reports = page.locator('mat-expansion-panel-header', { hasText: 'Reports'});
    await reports.click();

    console.log("\x1b[1m1.New Orders Export Reports:\x1b[0m");
    //Order Export Report
    await page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Date Picker
    await page.locator('div[class="mat-mdc-form-field-icon-suffix ng-star-inserted"]').click();
    await page.waitForTimeout(1500);
    await page.locator('button[class="mdc-button mat-mdc-button-base mat-mdc-button mat-unthemed"]').nth(6).click();
    await page.waitForTimeout(1500);

    // await page.locator('button[aria-label="Export Orders"]').click();
    // await page.waitForTimeout(1500);
    // await page.locator('button[role="menuitem"]').nth(0).click();
    // await page.waitForTimeout(1500);

    // Base folder
    const baseReportsDir = 'C:\\DS_playwright-test 1\\AOM_Reports';

    // Ensure base folder exists
    if (!fs.existsSync(baseReportsDir)) {
    fs.mkdirSync(baseReportsDir, { recursive: true });
    }

    // Find existing timestamp folder (from previous run)
    const existingFoldersCOGS = fs.readdirSync(baseReportsDir) .filter(item => fs.statSync(path.join(baseReportsDir, item)).isDirectory());

    //  If such folder exists, delete it
    if (existingFoldersCOGS.length > 0) {
    for (const folder of existingFoldersCOGS) {
        const fullPath = path.join(baseReportsDir, folder);
      //  console.log("Deleting previous report folder:", fullPath);
        fs.rmSync(fullPath, { recursive: true, force: true });
    }
    }

    //  Create a NEW folder with datetime name
    const timestampCOGS = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '');
    const currentRunDir = path.join(baseReportsDir, timestampCOGS);
    fs.mkdirSync(currentRunDir);
   // console.log("Created new report folder:", currentRunDir);
    

    // Wait for download event
    const downloadPromise = page.waitForEvent('download');

    // Click Export button
    await page.locator('button[aria-label="Export Orders"]').click();
    await page.waitForTimeout(1500);

    // Select Excel option
    await page.locator('button[role="menuitem"]').nth(0).click();

    // Capture download
    const download = await downloadPromise;

    // Original downloaded file name
    const originalFileName = await download.suggestedFilename();

    // File extension
    const extension = path.extname(originalFileName);

    // Validate Excel format
    expect(['.xlsx', '.xls']).toContain(extension);

    // Save with SAME downloaded file name
    const filePath = path.join(currentRunDir, originalFileName);

    // Save file directly into AOM_Reports folder
    await download.saveAs(filePath);

    console.log(`File downloaded successfully: ${originalFileName}`);

    // ================= VALIDATIONS =================

    // 1. Validate file exists
    expect(fs.existsSync(filePath)).toBeTruthy();

    //console.log('File exists in AOM_Reports folder');

    // 2. Validate correct format
    expect(['.xlsx']).toContain(extension);

    //console.log('Correct Excel format:', extension);

    // 3. Validate file not empty/corrupted
    const stats = fs.statSync(filePath);

    expect(stats.size).toBeGreaterThan(0);


    // //console.log('File is not empty/corrupted');
    //  if (page.url().includes('https://dev-outamateds.outamationlabs.com/app/internal/assignments/reports/order-export')) {

    //     addResult({
    //         srNo: `${reportBase}.1`,
    //         module: 'Order Export Report',
    //         status: 'Pass',
    //         URL: `<a href="${base}/app/internal/assignments/reports/order-export">Order Export Report</a>`
    //     });
    // } else {
    //     addResult({
    //         srNo: `${reportBase}.1`,
    //         module: 'Order Export Report',
    //         status: 'Fail',
    //         URL: `<a href="${base}/app/internal/assignments/reports/order-export">Order Export Report</a>`
    //     });
    // }

    //Reports 
    await page.locator('mat-expansion-panel').filter({ hasText: 'Reports' }).click();
    await page.waitForTimeout(1500);
    //await page.locator('span[class="title"]').nth(1).click();
    //await page.waitForTimeout(1500);  


    console.log("\x1b[1m2.Pipeline Reports:\x1b[0m");
    // Pipeline Report
    await page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(2).click();
    await page.waitForTimeout(1500);
    //Select Customer 
    await page.locator('div[class="mat-mdc-text-field-wrapper mdc-text-field mdc-text-field--filled"]').nth(0).click();
    await page.waitForTimeout(1500);
    await page.locator('div[class="mdc-checkbox"]').click();
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    //Status
    await page.locator('div[class="mat-mdc-text-field-wrapper mdc-text-field mdc-text-field--filled"]').nth(1).click();
    await page.waitForTimeout(1500);
    await page.locator('div[class="mdc-checkbox"]').click();
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    //Date Picker
    await page.locator('div[class="mat-mdc-form-field-icon-suffix ng-star-inserted"]').click();
    await page.waitForTimeout(1500);
    await page.locator('button[class="mdc-button mat-mdc-button-base mat-mdc-button mat-unthemed"]').nth(6).click();
    await page.waitForTimeout(1500);
    //Apply Filters
    await page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-primary ng-star-inserted"]').click();
    await page.waitForTimeout(1500);

//      // Exact folder path
//   const reportsDir2 = 'C:\\DS_playwright-test\\AOM_Reports';

  // Wait for download event
  const downloadPromise2 = page.waitForEvent('download');

  // Click Export button
  await page.locator('button[aria-label="Export Orders"]').click();

  await page.waitForTimeout(1500);

  // Select Excel option
  await page.locator('button[role="menuitem"]').nth(0).click();

  // Capture download
  const download2 = await downloadPromise2;

 // Original downloaded file name
  const originalFileName2 = await download2.suggestedFilename();

  // File extension
  const extension2 = path.extname(originalFileName2);

  // Validate Excel format
  expect(['.xlsx', '.xls']).toContain(extension2);

  // Save with SAME downloaded file name
  const filePath2 = path.join(currentRunDir, originalFileName2);

  // Save file directly into AOM_Reports folder
  await download2.saveAs(filePath2);

 console.log(`File downloaded successfully: ${originalFileName2}`);

  // ================= VALIDATIONS =================

  // 1. Validate file exists
  expect(fs.existsSync(filePath2)).toBeTruthy();

  //console.log('File exists in AOM_Reports folder');

  // 2. Validate correct format
  expect(['.xlsx']).toContain(extension2);

  //console.log('Correct Excel format:', extension2);

  // 3. Validate file not empty/corrupted
  const stats2 = fs.statSync(filePath2);

  expect(stats2.size).toBeGreaterThan(0);

  //console.log('File is not empty/corrupted');

//   if (page.url().includes('https://dev-outamateds.outamationlabs.com/app/internal/assignments/reports/pipeline-report')) {

//       addResult({
//             srNo: `${reportBase}.2`,
//             module: 'Pipeline Report',
//             status: 'Pass',
//             URL: `<a href="${base}/app/internal/assignments/reports/pipeline-report">Pipeline Report</a>`
//         });
//     } else {
//         addResult({
//             srNo: `${reportBase}.2`,
//             module: 'Pipeline Report',
//             status: 'Fail',
//             URL: `<a href="${base}/app/internal/assignments/reports/pipeline-report">Pipeline Report</a>`
//         });
//     }


    //Reports 
    await page.locator('mat-expansion-panel').filter({ hasText: 'Reports' }).click();
    await page.waitForTimeout(1500);
    // await page.locator('span[class="title"]').nth(1).click();
    // await page.waitForTimeout(1500);  
    
    console.log("\x1b[1m3.Revenue Reports:\x1b[0m");
    // Revenue Report
    await page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(3).click();
    await page.waitForTimeout(1500);
    //Select View: Client 

    //Date Picker
    await page.locator('div[class="mat-mdc-form-field-icon-suffix ng-star-inserted"]').click();
    await page.waitForTimeout(1500);
    await page.locator('button[class="mdc-button mat-mdc-button-base mat-mdc-button mat-unthemed"]').nth(6).click();
    await page.waitForTimeout(1500);

    // // Exact folder path
    // const reportsDirRev1 = 'C:\\DS_playwright-test\\AOM_Reports';

    // Wait for download event
    const downloadPromiseRev1 = page.waitForEvent('download');

     // Click Export button
    await page.locator('button[aria-label="Export Orders"]').click();
    await page.waitForTimeout(1500);

  // Select Excel option
  await page.locator('button[role="menuitem"]').nth(0).click();

  // Capture download
  const downloadRev1 = await downloadPromiseRev1;

 // Original downloaded file name
  const originalFileNameRev1 = await downloadRev1.suggestedFilename();

  // File extension
  const extensionRev1 = path.extname(originalFileNameRev1);

  // Validate Excel format
  expect(['.xlsx', '.xls']).toContain(extensionRev1);

  // Save with SAME downloaded file name
  const filePathRev1 = path.join(currentRunDir, originalFileNameRev1);

  // Save file directly into AOM_Reports folder
  await downloadRev1.saveAs(filePathRev1);

  console.log(`File downloaded successfully: ${originalFileNameRev1}`);

  // ================= VALIDATIONS =================

  // 1. Validate file exists
  expect(fs.existsSync(filePathRev1)).toBeTruthy();

  //console.log('File exists in AOM_Reports folder');

  // 2. Validate correct format
  expect(['.xlsx']).toContain(extensionRev1);

  //console.log('Correct Excel format:', extensionRev1);

  // 3. Validate file not empty/corrupted
  const statsRev1 = fs.statSync(filePathRev1);

  expect(statsRev1.size).toBeGreaterThan(0);

  //console.log('File is not empty/corrupted');

  //Select View: Order
  await page.locator('div[class="mat-mdc-text-field-wrapper mdc-text-field mdc-text-field--filled"]').nth(0).click();
  await page.waitForTimeout(1500);
  await page.locator('[class="mat-mdc-option mdc-list-item ng-star-inserted"]').click();
  await page.waitForTimeout(1500);
  //Date Picker
  await page.locator('div[class="mat-mdc-form-field-icon-suffix ng-star-inserted"]').click();
  await page.waitForTimeout(1500);
  await page.locator('button[class="mdc-button mat-mdc-button-base mat-mdc-button mat-unthemed"]').nth(6).click();
  await page.waitForTimeout(1500);

//    // Exact folder path
//     const reportsDirRev2 = 'C:\\DS_playwright-test\\AOM_Reports';

  // Wait for download event
  const downloadPromiseRev2 = page.waitForEvent('download');

  // Click Export button
  await page.locator('button[aria-label="Export Orders"]').click();

  await page.waitForTimeout(1500);

  // Select Excel option
  await page.locator('button[role="menuitem"]').nth(0).click();

  // Capture download
  const downloadRev2 = await downloadPromiseRev2;

 // Original downloaded file name
  const originalFileNameRev2 = await downloadRev2.suggestedFilename();

  // File extension
  const extensionRev2 = path.extname(originalFileNameRev2);

  // Validate Excel format
  expect(['.xlsx', '.xls']).toContain(extensionRev2);

  // Save with SAME downloaded file name
  const filePathRev2 = path.join(currentRunDir, originalFileNameRev2);

  // Save file directly into AOM_Reports folder
  await downloadRev2.saveAs(filePathRev2);

  console.log(`File downloaded successfully: ${originalFileNameRev2}`);

  // ================= VALIDATIONS =================

  // 1. Validate file exists
  expect(fs.existsSync(filePathRev2)).toBeTruthy();

  //console.log('File exists in AOM_Reports folder');

  // 2. Validate correct format
  expect(['.xlsx']).toContain(extensionRev2);

  //console.log('Correct Excel format:', extensionRev2);

  // 3. Validate file not empty/corrupted
  const statsRev2 = fs.statSync(filePathRev2);

  expect(statsRev2.size).toBeGreaterThan(0);

  //console.log('File is not empty/corrupted');

//   if (page.url().includes('https://dev-outamateds.outamationlabs.com/app/internal/assignments/reports/revenue-report')) {

//         addResult({
//             srNo: `${reportBase}.3`,
//             module: 'Revenue Report',
//             status: 'Pass',
//             URL: `<a href="${base}/app/internal/assignments/reports/revenue-report">Revenue Report</a>`
//         });
//     } else {
//         addResult({
//             srNo: `${reportBase}.3`,
//             module: 'Revenue Report',
//             status: 'Fail',
//             URL: `<a href="${base}/app/internal/assignments/reports/revenue-report">Revenue Report</a>`
//         });
//     }

    //Reports 
    await page.locator('mat-expansion-panel').filter({ hasText: 'Reports' }).click();
    await page.waitForTimeout(1500);
    // await page.locator('span[class="title"]').nth(1).click();
    // await page.waitForTimeout(1500);  


    console.log("\x1b[1m4.Fee & COGS Reports:\x1b[0m");
    // Fee & COGS Report
    await page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(4).click();
    await page.waitForTimeout(1500);
    //Select View: Fee Type
    //Date Picker
    await page.locator('div[class="mat-mdc-form-field-icon-suffix ng-star-inserted"]').click();
    await page.waitForTimeout(1500);
    await page.locator('button[class="mdc-button mat-mdc-button-base mat-mdc-button mat-unthemed"]').nth(6).click();
    await page.waitForTimeout(1500);
    //Apply Filters
    await page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-primary ng-star-inserted"]').click(); 
    await page.waitForTimeout(1500);


    // =================== DOWNLOAD LOGIC ====================

     // Wait for download event
    const downloadPromiseFee = page.waitForEvent('download');

     // Click Export button
    await page.locator('button[aria-label="Export Orders"]').click();
    await page.waitForTimeout(1500);

  // Select Excel option
  await page.locator('button[role="menuitem"]').nth(0).click();

  // Capture download
  const downloadFee = await downloadPromiseFee;

 // Original downloaded file name
  const originalFileNameFee = await downloadFee.suggestedFilename();

  // File extension
  const extensionFee = path.extname(originalFileNameFee);

  // Validate Excel format
  expect(['.xlsx', '.xls']).toContain(extensionFee);

  // Save with SAME downloaded file name
  const filePathFee = path.join(currentRunDir, originalFileNameFee);

  // Save file directly into AOM_Reports folder
  await downloadFee.saveAs(filePathFee);

  console.log(`File downloaded successfully: ${originalFileNameFee}`);


    // =================== VALIDATIONS ====================

    // File exists?
    expect(fs.existsSync(filePathFee)).toBeTruthy();
    //console.log('File exists:', filePathFee);

    // Correct extension?
    expect(['.xlsx']).toContain(extensionFee);

    // Not empty?
    const statsFee = fs.statSync(filePathFee);
    expect(statsFee.size).toBeGreaterThan(0);

   // console.log('File is valid and not empty');


    //Select View: COGS Type
    await page.locator('div[class="mat-mdc-text-field-wrapper mdc-text-field mdc-text-field--filled"]').nth(0).click();
    await page.waitForTimeout(1500);
    await page.locator('[role="option"]').nth(1).click();
    await page.waitForTimeout(1500);
    //Date Picker
    await page.locator('div[class="mat-mdc-form-field-icon-suffix ng-star-inserted"]').click();
    await page.waitForTimeout(1500);
    await page.locator('button[class="mdc-button mat-mdc-button-base mat-mdc-button mat-unthemed"]').nth(6).click();
    await page.waitForTimeout(1500);
     //Apply Filters
    await page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-primary ng-star-inserted"]').click(); 
    await page.waitForTimeout(1500);



    // =================== DOWNLOAD LOGIC ====================

      // Wait for download event
    const downloadPromiseCOGS  = page.waitForEvent('download');

     // Click Export button
    await page.locator('button[aria-label="Export Orders"]').click();
    await page.waitForTimeout(1500);

  // Select Excel option
  await page.locator('button[role="menuitem"]').nth(0).click();

  // Capture download
  const downloadCOGS = await downloadPromiseCOGS;

 // Original downloaded file name
  const originalFileNameCOGS = await downloadCOGS.suggestedFilename();

  // File extension
  const extensionCOGS = path.extname(originalFileNameCOGS);

  // Validate Excel format
  expect(['.xlsx']).toContain(extensionCOGS);

  // Save with SAME downloaded file name
  const filePathCOGS = path.join(currentRunDir, originalFileNameCOGS);

  // Save file directly into AOM_Reports folder
  await downloadCOGS.saveAs(filePathCOGS);

  console.log(`File downloaded successfully: ${originalFileNameCOGS}`);


    // =================== VALIDATIONS ====================

    // File exists?
    expect(fs.existsSync(filePathCOGS)).toBeTruthy();
    //console.log('File exists:', filePathCOGS);

    // Correct extension?
    expect(['.xlsx']).toContain(extensionCOGS);

    // Not empty?
    const statsCOGS = fs.statSync(filePathCOGS);
    expect(statsCOGS.size).toBeGreaterThan(0);

    //console.log('File is valid and not empty');

    // if (page.url().includes('https://dev-outamateds.outamationlabs.com/app/internal/assignments/reports/fee-cogs-report')) {

    //     addResult({
    //         srNo: `${reportBase}.4`,
    //         module: 'Fee & COGS Report',
    //         status: 'Pass',
    //         URL: `<a href="${base}/app/internal/assignments/reports/fee-cogs-report">Fee & COGS Report</a>`
    //     });
    // } else {
    //     addResult({
    //         srNo: `${reportBase}.4`,
    //         module: 'Fee & COGS Report',
    //         status: 'Fail',
    //         URL: `<a href="${base}/app/internal/assignments/reports/fee-cogs-report">Fee & COGS Report</a>`
    //     });
    // }
    
    //Reports 
    await page.locator('mat-expansion-panel').filter({ hasText: 'Reports' }).click();
    await page.waitForTimeout(1500);
    // await page.locator('span[class="title"]').nth(1).click();
    // await page.waitForTimeout(1500);  


    console.log("\x1b[1m5.Quality Check Reports:\x1b[0m");
    // Quality Check Report
    await page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(5).click(); 
    await page.waitForTimeout(1500);
    //Date Picker
    await page.locator('div[class="mat-mdc-form-field-icon-suffix ng-star-inserted"]').click();
    await page.waitForTimeout(1500);
    await page.locator('button[class="mdc-button mat-mdc-button-base mat-mdc-button mat-unthemed"]').nth(6).click();
    await page.waitForTimeout(1500);

        // =================== DOWNLOAD LOGIC ====================

      // Wait for download event
    const downloadPromiseQC = page.waitForEvent('download');

     // Click Export button
    await page.locator('button[aria-label="Export Orders"]').click();
    await page.waitForTimeout(1500);

  // Select Excel option
  await page.locator('button[role="menuitem"]').nth(0).click();

  // Capture download
  const downloadQC = await downloadPromiseQC;

 // Original downloaded file name
  const originalFileNameQC = await downloadQC.suggestedFilename();

  // File extension
  const extensionQC = path.extname(originalFileNameQC);

  // Validate Excel format
  expect(['.xlsx']).toContain(extensionQC);

  // Save with SAME downloaded file name
  const filePathQC = path.join(currentRunDir, originalFileNameQC);

  // Save file directly into AOM_Reports folder
  await downloadQC.saveAs(filePathQC);

  console.log(`File downloaded successfully: ${originalFileNameQC}`);


    // =================== VALIDATIONS ====================

    // File exists?
    expect(fs.existsSync(filePathQC)).toBeTruthy();
    //console.log('File exists:', filePathQC);

    // Correct extension?
    expect(['.xlsx']).toContain(extensionQC);

    // Not empty?
    const statsQC = fs.statSync(filePathQC);
    expect(statsQC.size).toBeGreaterThan(0);

   // console.log('File is valid and not empty');

    // if (page.url().includes('https://dev-outamateds.outamationlabs.com/app/internal/assignments/reports/quality-check-report')) {

    //     addResult({
    //         srNo: `${reportBase}.5`,
    //         module: 'Quality Check Report',
    //         status: 'Pass',
    //         URL: `<a href="${base}/app/internal/assignments/reports/quality-check-report">Quality Check Report</a>`
    //     });
    // } else {
    //     addResult({
    //         srNo: `${reportBase}.5`,
    //         module: 'Quality Check Report',
    //         status: 'Fail',
    //         URL: `<a href="${base}/app/internal/assignments/reports/quality-check-report">Quality Check Report</a>`
    //     });
    // }


    //Reports 
    await page.locator('mat-expansion-panel').filter({ hasText: 'Reports' }).click();
    await page.waitForTimeout(1500);

    console.log("\x1b[1m6.Production Reports:\x1b[0m");
    // Production Report
    await page.locator('li[class="sidemenu-item ng-star-inserted"]').nth(6).click();
    await page.waitForTimeout(1500);
    //Date Picker
    await page.locator('div[class="mat-mdc-form-field-icon-suffix ng-star-inserted"]').click();
    await page.waitForTimeout(1500);
    await page.locator('button[class="mdc-button mat-mdc-button-base mat-mdc-button mat-unthemed"]').nth(6).click();
    await page.waitForTimeout(1500);

        // =================== DOWNLOAD LOGIC ====================

  // Wait for download event
    const downloadPromiseProd = page.waitForEvent('download');

     // Click Export button
    await page.locator('button[aria-label="Export Orders"]').click();
    await page.waitForTimeout(1500);

  // Select Excel option
  await page.locator('button[role="menuitem"]').nth(0).click();

  // Capture download
  const downloadProd = await downloadPromiseProd;

 // Original downloaded file name
  const originalFileNameProd = await downloadProd.suggestedFilename();

  // File extension
  const extensionProd = path.extname(originalFileNameProd);

  // Validate Excel format
  expect(['.xlsx']).toContain(extensionProd);

  // Save with SAME downloaded file name
  const filePathProd = path.join(currentRunDir, originalFileNameProd);

  // Save file directly into AOM_Reports folder
  await downloadProd.saveAs(filePathProd);

  console.log(`File downloaded successfully: ${originalFileNameProd}`);


    // =================== VALIDATIONS ====================

    // File exists?
    expect(fs.existsSync(filePathProd)).toBeTruthy();
    //console.log('File exists:', filePathProd);

    // Correct extension?
    expect(['.xlsx']).toContain(extensionProd);

    // Not empty?
    const statsProd = fs.statSync(filePathProd);
    expect(statsProd.size).toBeGreaterThan(0);

   // console.log('File is valid and not empty');

    // if (page.url().includes('https://dev-outamateds.outamationlabs.com/app/internal/assignments/reports/standard-report')) {

    //     addResult({
    //         srNo: `${reportBase}.6`,
    //         module: 'Production Report',
    //         status: 'Pass',
    //         URL: `<a href="${base}/app/internal/assignments/reports/standard-report">Production Report</a>`
    //     });
    // } else {
    //     addResult({
    //         srNo: `${reportBase}.6`,
    //         module: 'Production Report',
    //         status: 'Fail',
    //         URL: `<a href="${base}/app/internal/assignments/reports/standard-report">Production Report</a>`
    //     });
    // }


         const parentFolder = 'C:\\DS_playwright-test\\AOM_Reports';

         if (!fs.existsSync(parentFolder)) {
        console.log(`❌ Parent folder does not exist: ${parentFolder}`);
        return;
        }

        // Find all subfolders inside the parent folder, sorted by modification time (newest first)
            const subfolders = fs
            .readdirSync(parentFolder)
            .map((name) => {
            const fullPath = path.join(parentFolder, name);
            return { name, fullPath, stat: fs.statSync(fullPath) };
            })
            .filter((entry) => entry.stat.isDirectory())
            .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs); // newest first

            if (subfolders.length === 0) {
            console.log(`❌ No subfolders found under ${parentFolder}`);
            addResult({
            srNo: `${reportBase}.0`,
            module: 'Download Folder',
            status: 'Fail',
            URL: `<span>No run folder found in ${parentFolder}</span>`,
            });
            return;
        }

        const downloadFolder = subfolders[0].fullPath;
      //  console.log(`📁 Latest run folder: ${subfolders[0].name}`);
      //  console.log(`   Full path: ${downloadFolder}`);

        const allFiles = fs.readdirSync(downloadFolder).filter((entry) =>
            fs.statSync(path.join(downloadFolder, entry)).isFile()
        );
      //  console.log(`   Total files in folder: ${allFiles.length}`);

        const folderLink = `<a href="file:///${downloadFolder.replace(/\\/g, '/')}">${subfolders[0].name}</a>`;

        // Helper: count files starting with "<baseName>_"
        const countFiles = (baseName: string): { count: number; files: string[] } => {
            const files = allFiles.filter((f) => f.startsWith(`${baseName}_`));
            return { count: files.length, files };
        };

        
        // ---------- 1. New Orders Export Report (expect 1) ----------
        {
            const { count, files } = countFiles('new-orders-export');
            if (count === 1) {
            //console.log(`✅ New Orders Export Report — found ${count} file`);
            for (const f of files) //console.log(`     • ${f}`);
            addResult({
                srNo: `${reportBase}.1`,
                module: 'Orders Export Report',
                status: 'Pass',
                URL: `<a href="${base}/app/internal/assignments/reports/order-export">Order Export Report</a>`
            });
            } else {
          //   console.log(`❌ New Orders Export Report — expected 1, found ${count}`);
            for (const f of files) //console.log(`     • ${f}`);
            addResult({
                srNo: `${reportBase}.1`,
                module: 'Orders Export Report',
                status: 'Fail',
                URL: `<a href="${base}/app/internal/assignments/reports/order-export">Order Export Report</a>`
            });
            }
        }

        // ---------- 2. Pipeline Report (expect 1) ----------
        {
            const { count, files } = countFiles('pipeline');
            if (count === 1) {
          //     console.log(`✅ Pipeline Report — found ${count} file`);
            for (const f of files) //console.log(`     • ${f}`);
            addResult({
                srNo: `${reportBase}.2`,
                module: 'Pipeline Report',
                status: 'Pass',
                URL: `<a href="${base}/app/internal/assignments/reports/pipeline-report">Pipeline Report</a>`
            });
            } else {
          //  console.log(`❌ Pipeline Report — expected 1, found ${count}`);
            for (const f of files) //console.log(`     • ${f}`);
            addResult({
                srNo: `${reportBase}.2`,
                module: 'Pipeline Report',
                status: 'Fail',
                URL: `<a href="${base}/app/internal/assignments/reports/pipeline-report">Pipeline Report</a>`
            });
            }
        }

        // ---------- 3. Revenue Report (expect 2) ----------
        {
            const { count, files } = countFiles('revenue');
            
            addResult({
                    srNo: `${reportBase}.3`,
                    module: 'Revenue Reports',
                    status: 'Pass',
                    URL: 'Revenue report '
                });

            
            if (count === 2) {
          //     console.log(`✅ Revenue Report — found ${count} files`);
        files.forEach((f, index) => { //console.log(`     • ${f}`);
            addResult({
                srNo: `${reportBase}.3.${index + 1}`,
                module:  `Revenue Report ${index + 1}`,
                status: 'Pass',
                URL: `<a href="${base}/app/internal/assignments/reports/revenue-report">Revenue Report</a>`
            });
        });

            } else {
          //  console.log(`❌ Revenue Report — expected 2, found ${count}`);
        files.forEach((f, index) => { //console.log(`     • ${f}`);
            addResult({
                srNo: `${reportBase}.3.${index + 1}`,
                module: `Revenue Report ${index + 1}`,
                status: 'Fail',
                URL: `<a href="${base}/app/internal/assignments/reports/revenue-report">Revenue Report</a>`
            });
        });            
            }
        }

        // ---------- 4. COGS Report (expect 2) ----------
    {
        const { count, files } = countFiles('cogs');

        addResult({
                    srNo: `${reportBase}.4`,
                    module: 'Fee & COGS Reports',
                    status: 'Pass',
                    URL: 'Fee & COGS report '
                });

            if (count === 2) {
          //  console.log(`✅ COGS Report — found ${count} files`);
         files.forEach((f, index) => { //console.log(`     • ${f}`);
            addResult({
                srNo: `${reportBase}.4.${index + 1}`,
                module: `Fee & COGS Report ${index + 1}`,
                status: 'Pass',
                URL: `<a href="${base}/app/internal/assignments/reports/fee-cogs-report">Fee & COGS Report</a>`
            });
          });  
            } else {
          //  console.log(`❌ COGS Report — expected 2, found ${count}`);
        files.forEach((f, index) => { //console.log(`     • ${f}`);
            addResult({
                srNo: `${reportBase}.4.${index + 1}`,
                module: `Fee & COGS Report ${index + 1}`,
                status: 'Fail',
                URL:`<a href="${base}/app/internal/assignments/reports/fee-cogs-report">Fee & COGS Report</a>`
            });
        });    
            }
        }

        // ---------- 5. Quality Check Report (expect 1) ----------
        {
            const { count, files } = countFiles('quality-check');
            if (count === 1) {
       //     console.log(`✅ Quality Check Report — found ${count} file`);
            for (const f of files) //console.log(`     • ${f}`);
            addResult({
                srNo: `${reportBase}.5`,
                module: 'Quality Check Report',
                status: 'Pass',
                URL: `<a href="${base}/app/internal/assignments/reports/quality-check-report">Quality Check Report</a>`
            });
            } else {
         //   console.log(`❌ Quality Check Report — expected 1, found ${count}`);
            for (const f of files) //console.log(`     • ${f}`);
            addResult({
                srNo: `${reportBase}.5`,
                module: 'Quality Check Report',
                status: 'Fail',
                URL: `<a href="${base}/app/internal/assignments/reports/quality-check-report">Quality Check Report</a>`
            });
            }
        }

        // ---------- 6. Production Report (expect 1) ----------
        {
            const { count, files } = countFiles('production-report');
            if (count === 1) {
          //  console.log(`✅ Production Report — found ${count} file`);
            for (const f of files) //console.log(`     • ${f}`);
            addResult({
                srNo: `${reportBase}.6`,
                module: 'Production Report',
                status: 'Pass',
                URL:  `<a href="${base}/app/internal/assignments/reports/standard-report">Production Report</a>`
            });
            } else {
         //   console.log(`❌ Production Report — expected 1, found ${count}`);
            for (const f of files) //console.log(`     • ${f}`);
            addResult({
                srNo: `${reportBase}.6`,
                module: 'Production Report',
                status: 'Fail',
                URL:  `<a href="${base}/app/internal/assignments/reports/standard-report">Production Report</a>`
            });
            }
        }        


    
    // const results = getResults();
    //  await sendMail(results);

});    

;