import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { addResult, getResults, getSrCounter, incrementSrCounter  } from '../resultsCollector'; 
import { sendMail } from '../mail';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { error } from 'console';


test('Batch Upload Orders', async ({ page }) => {

     await page.goto('/app/internal/assignments/dashboard/order-status');
    await page.waitForTimeout(1500);
    await page.locator('h6[class="module-title"]').nth(1).click();
    await page.waitForTimeout(1500);
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Order Template');

  // 1. Map all of your exact columns
  worksheet.columns = [
    { header: 'Client/Customer', key: 'client', width: 20 },
    { header: 'Project Code', key: 'projectCode', width: 15 },
    { header: 'Division', key: 'division', width: 15 },
    { header: 'Customer Order #', key: 'customerOrderNum', width: 20 },
    { header: 'Lender Name', key: 'lenderName', width: 20 },
    { header: 'Product Type', key: 'productType', width: 15 },
    { header: 'Borrower First Name', key: 'bFirstName', width: 15 },
    { header: 'Borrower Middle Name', key: 'bMiddleName', width: 15 },
    { header: 'Borrower Last Name', key: 'bLastName', width: 15 },
    { header: 'Co-Borrower First Name', key: 'coBFirstName', width: 15 },
    { header: 'Co-Borrower Middle Name', key: 'coBMiddleName', width: 15 },
    { header: 'Co-Borrower Last Name', key: 'coBLastName', width: 15 },
    { header: 'Parcel Number', key: 'parcelNumber', width: 15 },
    { header: 'Address 1', key: 'address1', width: 25 },
    { header: 'Address 2', key: 'address2', width: 15 },
    { header: 'City', key: 'city', width: 15 },
    { header: 'State', key: 'state', width: 10 },
    { header: 'ZipCode', key: 'zipCode', width: 12 },
    { header: 'County', key: 'county', width: 15 },
    { header: 'Loan Number', key: 'loanNumber', width: 20 },
    { header: 'Consideration Amount', key: 'amount', width: 15 },
    { header: 'Instrument Date', key: 'instrumentDate', width: 15 },
    { header: 'Assignor', key: 'assignor', width: 20 },
    { header: 'Assignee', key: 'assignee', width: 20 },
    { header: 'Special Instructions', key: 'instructions', width: 30 }
  ];

  // 2. Generate multiple rows of completely unique data using Faker

  const totalRowsToUpload = 1; 

  for (let i = 0; i < totalRowsToUpload; i++) {
    worksheet.addRow({
      client: "Covius",
      projectCode: "APDR001 - Assignment Prep With Document Retrieval",
      division: "Bulk Division",
      
      // Using unique strings guarantees no duplicate order/loan constraints will be breached
      customerOrderNum:`ODS-${faker.number.int({ min: 10000, max: 99999 })}`, 
      
      lenderName: "Bank of America",
      productType: "Assignment Prep Only",
      bFirstName: faker.person.firstName(),
      bMiddleName: faker.person.firstName(),
      bLastName: faker.person.lastName(),
      coBFirstName: faker.person.firstName(),
      coBMiddleName: faker.person.firstName(),
      coBLastName: faker.person.lastName(),
      parcelNumber: faker.string.numeric(10),
      address1: faker.location.streetAddress(),
      address2: faker.location.secondaryAddress(),
      city: faker.location.city(),
      state: faker.location.state({ abbreviated: true }),
      zipCode: faker.location.zipCode('#####'),
      county: `${faker.location.county()} County`,
      
      // Unique loan number
      loanNumber: `LN-${faker.string.numeric(12)}`,
      
      amount: faker.finance.amount({ min: 100000, max: 999999, dec: 2 }),
      instrumentDate: new Date().toLocaleDateString('en-US'),
      assignor: faker.company.name(),
      assignee: faker.company.name(),
      instructions: "Documents uploaded"
    });
  }

        // 3. Save file locally
        const tempFolder = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempFolder)){
            fs.mkdirSync(tempFolder, { recursive: true });
        }

        // Clean up any existing .xlsx files in the BatchUpload folder before creating a new one
        // fs.readdirSync(tempFolder).forEach((file) => {
        // if (file.endsWith('.xlsx')) {
        //     fs.unlinkSync(path.join(tempFolder, file));
        //     console.log(`✅ Deleted old file: ${file}`);
        // }
        // });
        for (const file of fs.readdirSync(tempFolder)) {
        if (!file.endsWith('.xlsx')) continue;

        const oldFilePath = path.join(tempFolder, file);

        try {
            fs.unlinkSync(oldFilePath);
            console.log(`✅ Deleted old file: ${file}`);
        } catch (err) {
            const error = err as NodeJS.ErrnoException;

            console.warn(`⚠️ Could not delete ${file}. Error: ${error.code ?? 'UNKNOWN'}`);
        }
        }

     const filePath = path.join(tempFolder, `batch_orders_${Date.now()}.xlsx`);
     await workbook.xlsx.writeFile(filePath);

  
    //Order Entry 
    await page.locator('span[class="title"]').nth(2).click();
    await page.waitForTimeout(1500);  
    await page.locator('a[href="/app/internal/assignments/orders/batch-upload"]').click(); 
    await page.locator('button[aria-label="Add Batch Upload"]').nth(1).click();    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    await page.locator('span[class="mdc-button__label"]').nth(10).click(); 
    await page.waitForTimeout(1500);
    // const uploadButton = page.getByRole('button', { name: 'Upload' });
    // await uploadButton.waitFor({ state: 'visible', timeout: 5000 });
    // await uploadButton.click();

    // 5. Success Validation
    const successMessage = page.locator('span[class="toast-message"]').innerText();


  // 6. Cleanup file after test
  fs.unlinkSync(filePath);

});