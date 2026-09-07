import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { addResult, getResults, getSrCounter, incrementSrCounter } from '../resultsCollector';
import { sendMail } from '../mail';
import { attachRuntimeMonitors } from './support/runtimeMonitors';
import { setCustomerOrder } from '../Variable';
import path from 'path';
import fs from 'fs';

test('@Outamate DS: Invoice Creation ', async ({ page }) => {

    attachRuntimeMonitors(page);

    // Block the embedded IntelliaBot chat widget. It is a third party we don't own,
    // its backend sends no CORS headers (so every page load logged errors), and its
    // hidden textarea#message-input sits at the end of the DOM where it hijacks
    // positional locators like textarea.last(). Nothing under test depends on it.
    await page.route('**/*intelliabot.com/**', route => route.abort());



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

        // The 8-digit internal order id, taken from /orders/<id>/details. This is
        // what the invoice form works on — not CustomerOrder, which is the 6-digit
        // customer number shown in the grids.
        const CreatedOrderId = orderDetailsUrl.split(String.fromCharCode(47)+'orders'+String.fromCharCode(47))[1]?.split(String.fromCharCode(47))[0] ?? '';
        if (!CreatedOrderId) console.log(`⚠️  Could not read the order id from: ${orderDetailsUrl}`);
    
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


        //Abstractor fee
        await page.locator('input[formcontrolname="abstractorFee"]').fill("1000.25");
        await page.waitForTimeout(1500);

        //Upload Document
        // Attached through the Assign ABS panel's own control below. Do not
        // navigate to the Documents tab here — the Assign ABS panel
        // (div.add-new-popup.active) overlays the page, so clicking the tab
        // behind it is intercepted and retries until the test times out.

                // Resolve file paths
        const filePath2 = path.resolve('Documents/INDEX.pdf');

          if (!fs.existsSync(filePath2)) {
             console.log(`❌ File not found: ${filePath2}`);
        }

         const [fileChooser1] = await Promise.all([
            page.waitForEvent('filechooser'),
            page.locator('[formcontrolname="attachments"]').click(),
            // Note: If clicking "Drag and drop files or click here" is required instead, use:
            // page.getByText('Drag and drop files').click()
        ]);
        await fileChooser1.setFiles([filePath2]);
        await page.locator('button:has-text("Submit")').click();
     

        //Abstractor Name
        const AssignedAbstractor = 'Outamation_Foram'
        await page.locator('div[class="mat-mdc-form-field-flex"]').nth(3).click();
        await page.waitForTimeout(1500);
        await page.getByRole('option', { name: AssignedAbstractor  }).click();
        await page.waitForTimeout(1500);

                //Uncheck the Notify Via Email 
        await page.uncheck('[formcontrolname="isEmailNotification"] input');
        await page.waitForTimeout(1500);

       //Submit Assign ABS
        await page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-unthemed"]').nth(1).click();
        await page.waitForTimeout(1500);


    // ---- Email result helpers -------------------------------------------------
    /**
     * Turns an email module name into the phrase used in the console summary line,
     * e.g. 'Invoice Pending Approval' -> 'Invoice pending approval'. 'Invoice Paid'
     * reads better as 'Invoice payment', so it is mapped explicitly.
     */
    const PHRASE: Record<string, string> = { 'Invoice Paid': 'Invoice payment' };
    const phrase = (m: string) =>
        PHRASE[m] ?? (m.charAt(0).toUpperCase() + m.slice(1).toLowerCase());

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
        console.log(passed
            ? `✅ ${phrase(module)} completed successfully.`
            : `❌ ${phrase(module)} failed.`);
    };

    /**
     * Column-agnostic grid presence check, used as a fallback. AG Grid virtualises
     * columns horizontally, so a cell can be absent from the DOM even though its
     * row is present — requiring a specific col-id reports false "not found"s.
     */
    const inGrid = async (value: string): Promise<boolean> => {
        const row = page.locator('.ag-row').filter({ hasText: new RegExp(`\\b${value}\\b`) });
        const found = await row.first()
            .waitFor({ state: 'visible', timeout: 20_000 })
            .then(() => true)
            .catch(() => false);
        if (found) return true;

        const countText = await page.locator('span[ref="lbRecordCount"]').innerText().catch(() => '');
        const count = parseInt(countText.replace(/[^\d]/g, ''), 10) || 0;
        if (count > 0) {
            console.log(`ℹ️ ${value} matched via record count (${count}) — cell not rendered.`);
            return true;
        }
        console.log(`❌ ${value} not found in grid (record count: ${countText || 'n/a'})`);
        return false;
    };

    /**
     * The currency fields are input[type=number] behind a `$` matTextPrefix, and
     * their input handler can swallow a bare "0" — so fill() alone does not always
     * stick. Fill, read the value back, and retry by typing before giving up.
     */
    const fillAmount = async (control: string, value: string): Promise<boolean> => {
        // `control` goes straight into the selector, so it must be the exact Angular
        // formControlName. A display label (or a stray space left behind by an edit)
        // produces a selector that matches nothing and stalls until the 50-minute
        // test timeout — fail loudly and immediately instead.
        if (/\s/.test(control)) {
            throw new Error(`fillAmount: "${control}" is not a formControlName (whitespace present)`);
        }

        const input = page.locator(`input[formcontrolname="${control}"]`);
        await input.click();
        await input.fill('');
        await input.fill(value);

        if ((await input.inputValue()) !== value) {
            await input.fill('');
            await input.pressSequentially(value, { delay: 50 });
        }

        const actual = await input.inputValue();
        if (actual !== value) {
            console.log(`⚠️  ${control}: expected "${value}", control holds "${actual}"`);
            return false;
        }
        // console.log(`${control}: ${actual}`);
        return true;
    };
    // --------------------------------------------------------------------------

    console.log("");
    console.log("\x1b[1mInvoice Creation:\x1b[0m");
    console.log("🧾 Initiating new invoice creation flow...");

    // ---- Navigate ------------------------------------------------------------
    // Direct goto rather than the side menu: the Invoice group is a nested
    // expansion panel under "Vendor MGMT", and that section's span.title index
    // shifts with the signed-in user's permissions.
    await page.goto('/app/internal/research/invoice/new');
    await page.waitForTimeout(1500);

    const invoiceFormUrl = page.url();
    const invoiceFormOpened = await page.locator('h5', { hasText: 'Add Invoice' })
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);

    if (!invoiceFormOpened) {
        // Most likely cause: the login user lacks PermissionCodes.VendorManagement,
        // so RouteGuard redirected away before the form rendered.
        console.log(`❌ Add Invoice form did not render. Current URL: ${invoiceFormUrl}`);
    }
    // Not an email row of its own — folded into the Invoice Creation row below.

    // ---- Fill the form -------------------------------------------------------
    // Order matters: the Order IDs autocomplete is populated from the selected
    // abstractor's orders, and paymentMethod is auto-patched by that same call.

    // The order created and assigned to an abstractor by spec 13. Both values are
    // needed: the invoice form only offers orders belonging to the chosen
    // abstractor, so picking a different abstractor would not surface this order.
    // The order created and assigned earlier in this same spec.
    const TargetOrderId = CreatedOrderId;
    const TargetAbstractor = AssignedAbstractor;

    if (TargetOrderId && TargetAbstractor) {
        console.log(`✅ Invoicing order ${TargetOrderId} Abstractor: ${TargetAbstractor}`);
    } else {
        console.log('ℹ️ No order carried over from spec 13 — falling back to the first available abstractor/order.');
    }

    //Abstractor Name — the one the target order is assigned to, when known
    await page.locator('mat-select[formcontrolname="abstractorId"]').click();
    await page.waitForTimeout(1500);

    let abstractorOption = page.getByRole('option').first();
    if (TargetAbstractor) {
        const named = page.getByRole('option', { name: TargetAbstractor });
        if (await named.count() > 0) {
            abstractorOption = named.first();
        } else {
            // console.log(`⚠️  Abstractor "${TargetAbstractor}" not in the list — using the first option.`);
        }
    }
    const AbstractorName = (await abstractorOption.innerText()).trim();
    await abstractorOption.click();
    await page.waitForTimeout(1500);
    console.log('✅ Abstractor Name:', AbstractorName);

    //Order IDs
    const orderIdInput = page.locator('input[name="currentOrderId"]');

    /**
     * Adds one order id as a chip and reports whether the server accepted it.
     *
     * Appearing in the autocomplete is not sufficient: the form calls
     * GET .../invoices/validate-order/{orderId} per chip, and a 400 means the order
     * cannot be invoiced by this abstractor (already invoiced, or not in a billable
     * state). The chip then renders as .invalid-chip and blocks submit — which is
     * what happened with order 26900570 for abstractor 4. So the response is the
     * verdict, and a rejected chip is removed again.
     */
    const addOrderId = async (candidate: string): Promise<boolean> => {
        await orderIdInput.click();
        await orderIdInput.fill(candidate);
        await page.waitForTimeout(1000);

        const option = page.getByRole('option', { name: new RegExp(`\\b${candidate}\\b`) });
        if (await option.count() === 0) {
            console.log(`   ${candidate}: not offered for ${AbstractorName}`);
            await orderIdInput.fill('');
            return false;
        }

        let validated = false;
        try {
            const [res] = await Promise.all([
                page.waitForResponse(r => r.url().includes(`/validate-order/${candidate}`), { timeout: 30_000 }),
                option.first().click(),
            ]);
            validated = res.ok();
            if (!validated) console.log(`   ${candidate}: validate-order returned ${res.status()}`);
        } catch {
            console.log(`   ${candidate}: no validate-order response seen`);
        }
        await page.waitForTimeout(1000);

        const invalid = await page.locator('mat-chip-row.invalid-chip').count();
        if (!validated || invalid > 0) {
            console.log(`   ${candidate}: rejected — removing the chip`);
            const remove = page.locator(`button[aria-label="remove ${candidate}"]`);
            if (await remove.count() > 0) {
                await remove.first().click();
            } else {
                await page.locator('mat-chip-row.invalid-chip button').first().click().catch(() => { });
            }
            await page.waitForTimeout(1000);
            return false;
        }

      //   console.log(`   ${candidate}: accepted`);
        return true;
    };

    // Prefer the order carried over from spec 13; if the server won't invoice it,
    // fall through to whatever else this abstractor has that does validate.
    let OrderId = '';
    if (TargetOrderId && await addOrderId(TargetOrderId)) {
        OrderId = TargetOrderId;
    } else {
        if (TargetOrderId) {
            console.log(`⚠️  Order ${TargetOrderId} is not invoiceable for ${AbstractorName} — trying the abstractor's other orders.`);
        }
        await orderIdInput.click();
        await orderIdInput.fill('');
        await page.waitForTimeout(1500);

        const offered = await page.getByRole('option').allInnerTexts();
        const candidates = offered
            .map(t => (t.match(/\d{8}/) || [''])[0])
            .filter(Boolean)
            .filter(id => id !== TargetOrderId);

        for (const candidate of candidates.slice(0, 5)) {
            if (await addOrderId(candidate)) {
                OrderId = candidate;
                break;
            }
        }
    }

    if (!OrderId) {
        console.log(`❌ No invoiceable order found for ${AbstractorName} — submit will be blocked.`);
    } else {
        console.log('✅ Order ID:', OrderId);
    }

    //Invoice Date — the input opens its datepicker on focus
    await page.locator('input[formcontrolname="invoiceDate"]').click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);

    //Invoice # — unique per run so the verification search matches exactly this one
    const InvoiceNumber = `INV-${faker.number.int({ min: 100000, max: 999999 })}`;
    await page.locator('input[formcontrolname="invoiceNumber"]').fill(InvoiceNumber);
    await page.waitForTimeout(1500);
    console.log('✅ Invoice Number:', InvoiceNumber);

    //Invoice Amount / Credits Applied / Total Payment Due
    const invoiceAmount = '1000.25';
    // "0.00" rather than "0": a bare zero gets dropped by the currency input's
    // handler, which is why Credits Applied was coming through empty. The
    // nonNegativeCurrencyValidator regex ^\d+(\.\d{1,2})?$ accepts either form.
    const creditsApplied = '4500.00';

    await fillAmount('invoiceAmount', invoiceAmount);
    await fillAmount('creditsApplied', creditsApplied);
    await fillAmount('totalPaymentDue', invoiceAmount);

    //Payment Method — set after the abstractor, which auto-patches this control
    await page.locator('mat-select[formcontrolname="paymentMethod"]').click();
    await page.waitForTimeout(1500);
    await page.getByRole('option', { name: 'Check', exact: true }).click();
    await page.waitForTimeout(1500);

    //Notes — DTO field `notes` is non-optional
    await page.locator('textarea[formcontrolname="note"]').fill('Automated invoice creation test');
    await page.waitForTimeout(1500);

    // ---- Document Details ----------------------------------------------------
    // Expanding this panel is what actually creates the invoice in add mode:
    // onDocumentPanelToggle() calls createInvoiceFromForm(), which POSTs to
    // api/abstractors/{abstractorId}/invoices and sets IsAddMode = false. The panel
    // stays disabled ("Complete invoice details first") until the fields above are
    // valid, so it has to come after the fill block.
    let createResponse: any = null;
    try {
        [createResponse] = await Promise.all([
            page.waitForResponse(
                r => /\/abstractors\/\d+\/invoices(\?.*)?$/.test(r.url())
                    && r.request().method() === 'POST',
                { timeout: 60_000 }
            ),
            page.locator('mat-expansion-panel-header', { hasText: 'Document Details' }).click(),
        ]);
    } catch {
        createResponse = null;
    }

    // The success toast is the primary signal — createInvoiceFromForm() shows
    // 'Creating invoice...' (info) and then 'Invoice created successfully! Upload
    // related documents!' on success. Waiting for the *success* text avoids reading
    // the in-flight info toast and calling it a failure.
    const createdToastShown = await page.locator('.toast-message')
        .filter({ hasText: /created successfully/i })
        .first()
        .waitFor({ state: 'visible', timeout: 60_000 })
        .then(() => true)
        .catch(() => false);

    const createToast = (await page.locator('.toast-message').last()
        .innerText({ timeout: 10_000 }).catch(() => '')).trim();
    if (createToast) console.log(`ℹ️  ${createToast}`);

    // Either signal is enough: the toast confirms the app's own view of success,
    // the response confirms the server's.
    const invoiceCreated = createdToastShown || (!!createResponse && createResponse.ok());
    if (!invoiceCreated) {
        console.log(`❌ Invoice not created. API: ${createResponse ? createResponse.status() : 'no POST seen'}, ` +
            `toast: "${createToast || 'none'}"`);
    }
    recordModule('Invoice Creation', invoiceCreated, page.url());

    // ---- Upload the supporting document --------------------------------------
    // Guard first: everything below assumes the invoice form. The observed failure
    // had the browser still on /orders/<id>/request-quotes, where "Add" opens a
    // different dialog entirely — so the type select was never going to be there.
    if (!/\/research\/invoice\//.test(page.url())) {
        console.log(`❌ Not on the invoice form (URL: ${page.url()}) — re-navigating before upload.`);
        await page.goto('/app/internal/research/invoice/new');
        await page.waitForTimeout(2000);
    }

    const invoiceFilePath = path.resolve('Documents/INDEX.pdf');
    if (!fs.existsSync(invoiceFilePath)) {
        console.log(`❌ File not found: ${invoiceFilePath}`);
    }

    // Scope to the Documents panel so "Add" cannot match a button elsewhere.
    const documentsPanel = page.locator('mat-expansion-panel', { hasText: 'Document Details' }).first();
    const addDocButton = documentsPanel.getByRole('button', { name: 'Add', exact: true });
    await addDocButton.click();
    await page.waitForTimeout(1500);

    // The document form is NOT a Material dialog — this app renders these panels as
    // its own overlay (div.add-new-popup, the same one that intercepted the
    // Documents-tab click in the Assign ABS flow), so scoping to
    // mat-dialog-container matched nothing. Wait on the attachments control
    // instead: it only exists once the form is actually open.
    const attachmentsControl = page.locator('[formcontrolname="attachments"]').first();
    await attachmentsControl.waitFor({ state: 'visible', timeout: 30_000 });

    const [invoiceFileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        attachmentsControl.click(),
    ]);
    await invoiceFileChooser.setFiles([invoiceFilePath]);
    await page.waitForTimeout(2000);

    // Document Type — required per uploaded row, and it must be INVOICE. The row's
    // select only renders once the file is attached, so wait for it rather than
    // clicking blind. The control names are built dynamically
    // ([formControlName]="'type_' + $index"), so there is no formcontrolname
    // attribute to select on; the static placeholder is the most stable handle.
    let typeSelect = page.locator('mat-select[placeholder="Select Type"]').first();
    if (await typeSelect.count() === 0) {
        // Fallback: the document form renders after the invoice form, so its
        // selects come last in DOM order.
        console.log('ℹ️ No mat-select[placeholder="Select Type"] — falling back to the last select on the page.');
        typeSelect = page.locator('mat-select').last();
    }
    await typeSelect.waitFor({ state: 'visible', timeout: 30_000 });
    await typeSelect.click();
    await page.waitForTimeout(1500);

    // Options render in a CDK overlay, so match on the page rather than the panel.
    const invoiceTypeOption = page.getByRole('option', { name: /^\s*INVOICE\s*$/i });
    let DocumentType = '';

    if (await invoiceTypeOption.count() > 0) {
        DocumentType = (await invoiceTypeOption.first().innerText()).trim();
        await invoiceTypeOption.first().click();
    } else {
        // Say what was actually on offer — the list is filtered by file extension,
        // so a missing INVOICE type is a real finding, not a selector problem.
        const available = await page.getByRole('option').allInnerTexts();
        console.log(`❌ No "INVOICE" document type offered. Available: ${available.map(t => t.trim()).join(' | ') || 'none'}`);
        await page.getByRole('option').first().click().catch(() => { });
        DocumentType = '(fallback)';
    }
    await page.waitForTimeout(1500);
   // console.log('Document Type:', DocumentType);

    let uploadResponse: any = null;
    try {
        [uploadResponse] = await Promise.all([
            page.waitForResponse(
                r => /\/invoices\/\d+\/documents$/.test(r.url())
                    && r.request().method() === 'POST',
                { timeout: 60_000 }
            ),
            page.getByRole('button', { name: 'Upload', exact: true }).click(),
        ]);
    } catch {
        uploadResponse = null;
    }
    await page.waitForTimeout(1500);

    const documentUploaded = !!uploadResponse && uploadResponse.ok();
    if (!documentUploaded) {
        console.log(`❌ Document upload failed. API: ${uploadResponse ? uploadResponse.status() : 'no POST sent'}`);
    } else {
        console.log(`📄 Uploaded ${path.basename(invoiceFilePath)} to the invoice.`);
    }
    // No email row — the outcome is logged above only.

    // ---- Save ----------------------------------------------------------------
    // The invoice already exists (the Document Details panel created it), so the
    // top action is now "Save" and issues a PUT rather than a POST — and the icon
    // ligature changes from done_all to save. The tooltip is a property binding, so
    // there is no mattooltip attribute to select on. Accept either verb/shape here
    // so this still passes if the app takes the plain add path.
    let saveResponse: any = null;
    try {
        [saveResponse] = await Promise.all([
            page.waitForResponse(
                r => /\/api\/abstractors\/\d+\/invoices(\/\d+)?$/.test(r.url())
                    && ['POST', 'PUT'].includes(r.request().method()),
                { timeout: 30_000 }
            ),
            page.locator('button:has(i:text-is("save"))').first().click(),
        ]);
    } catch {
        saveResponse = null;
    }

    const toastText = (await page.locator('.toast-message').last()
        .innerText({ timeout: 15_000 }).catch(() => '')).trim();
    if (toastText) console.log(`ℹ️  ${toastText}`);

    // navigateToVerification() runs for a non-abstractor user on a successful save
    const redirected = await page.waitForURL(/\/app\/internal\/research\/invoice\/verification/, { timeout: 20_000 })
        .then(() => true)
        .catch(() => false);

    const invoiceSaved = !!saveResponse && saveResponse.ok() && redirected;
    if (!invoiceSaved) {
        console.log(`❌ Invoice not saved. API: ${saveResponse ? saveResponse.status() : 'no request sent'}, ` +
            `redirected: ${redirected}, toast: "${toastText || 'none'}"`);
    }
    // No email row — the outcome is logged above only.

    // ---- Verify in the Verification queue ------------------------------------
    // A newly created invoice always lands in VERIFICATION status, which is where
    // navigateToVerification() has just sent us. Navigate explicitly if the save
    // did not redirect, so the verification row still reports something meaningful.
    if (!redirected) {
        await page.goto('/app/internal/research/invoice/verification');
        await page.waitForTimeout(1500);
    }

    await page.locator('input[placeholder="Search keyword"]').fill(InvoiceNumber);
    await page.waitForTimeout(1500);

    const invoiceRow = page.locator('.ag-row')
        .filter({ has: page.locator('[col-id="invoiceNumber"]', { hasText: InvoiceNumber }) });

    let invoiceFound = await invoiceRow.first()
        .waitFor({ state: 'visible', timeout: 20_000 })
        .then(() => true)
        .catch(() => false);

    // invoiceNumber is the 6th column and may be virtualised out of the DOM on a
    // narrow viewport — fall back to a row-level text match.
    if (!invoiceFound) invoiceFound = await inGrid(InvoiceNumber);

    if (invoiceFound) {
        console.log(`ℹ️ Invoice ${InvoiceNumber} is present in the Verification queue.`);
    }
    recordModule('Invoice Verification', invoiceFound, page.url());

    // ==== Invoice lifecycle ===================================================

    const QUEUE = {
        verification:    '/app/internal/research/invoice/verification',
        onHold:          '/app/internal/research/invoice/on-hold',
        pendingApproval: '/app/internal/research/invoice/pending-approval',
       approved:        '/app/internal/research/invoice/approved',
        pendingPayment:  '/app/internal/research/invoice/pending-payment',
        paid:            '/app/internal/research/invoice/paid',
        cancelled:       '/app/internal/research/invoice/cancelled',
    };

    /** Friendly queue name for console output, e.g. "Pending Payment". */
    const queueLabel = (route: string) =>
        (route.split('/').pop() || route)
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

    /**
     * Filters a queue down to one invoice and returns its grid row.
     *
     * Only navigates when not already on that queue — the retry loops below call
     * this repeatedly, and reloading the page each time was the bulk of the run
     * time. Waits on the grid being ready rather than on fixed sleeps.
     */
    const openQueue = async (route: string, invNo: string) => {
        const search = page.locator('input[placeholder="Search keyword"]');

        if (!page.url().includes(route)) {
            await page.goto(route);
        }
        // The search box only renders once the grid component is up.
        await search.waitFor({ state: 'visible', timeout: 30_000 });

        await search.fill('');
        await search.fill(invNo);
        // Let the client-side filter settle instead of sleeping a flat 2s.
        await page.waitForLoadState('domcontentloaded').catch(() => { });

        return page.locator('.ag-row')
            .filter({ has: page.locator('[col-id="invoiceNumber"]', { hasText: invNo }) })
            .first();
    };

    /**
     * Returns page-level locators for one invoice's row, keyed by its ag-Grid
     * row-index. Pinned columns (actions is pinned right, the selection checkbox
     * may be pinned left) live in SEPARATE .ag-row elements from the centre
     * columns, so a locator scoped to the centre row cannot reach them.
     */
    const rowParts = async (invNo: string, timeout = 15_000) => {
        const centre = page.locator('.ag-row')
            .filter({ has: page.locator('[col-id="invoiceNumber"]', { hasText: invNo }) })
            .first();
        await centre.waitFor({ state: 'visible', timeout });
        const idx = await centre.getAttribute('row-index');

        // Every .ag-row for this logical row, across all containers.
        const all = idx !== null ? page.locator(`.ag-row[row-index="${idx}"]`) : centre;

        return {
            centre,
            actions: all.locator('button[aria-label="Actions"]').first(),
            checkbox: all.locator('input.ag-checkbox-input, .ag-selection-checkbox input').first(),
        };
    };

    /**
     * Selects the invoice, opens Status Update, picks the target status by its
     * visible name, enters notes, submits. Returns whether the API accepted it.
     *
     * The form renders in the app's own overlay rather than a mat-dialog (the same
     * div.add-new-popup used elsewhere), so controls are located directly instead
     * of through a container.
     */
    const moveInvoiceTo = async (fromRoute: string, invNo: string, targetStatus: string, note: string): Promise<boolean> => {
        // Retry the lookup with a SHORT per-attempt timeout: the grid needs a moment
        // to pick up the previous status change, and it will not refresh itself, so
        // later attempts reload. A long first wait here cost ~20s per attempt for
        // nothing, since the data cannot arrive without a re-fetch.
        let parts;
        for (let attempt = 1; attempt <= 3; attempt++) {
            if (attempt > 1) await page.reload();
            await openQueue(fromRoute, invNo);
            try {
                parts = await rowParts(invNo, 5_000);
                break;
            } catch {
                // Grid hasn't caught up yet — reload and look again.
            }
        }
        if (!parts) {
            console.log(`❌ ${invNo} is not in the ${queueLabel(fromRoute)} queue — cannot move it to ${targetStatus}.`);
            return false;
        }

        // Status Update is disabled until a row is selected, so wait for it to
        // become enabled rather than sleeping and hoping.
        const statusUpdateButton = page.getByRole('button', { name: /Status Update/i }).first();
        await parts.checkbox.click();
        await expect(statusUpdateButton).toBeEnabled({ timeout: 15_000 });

        await statusUpdateButton.click();

        // The bulk form lives in the app's own overlay (div.add-new-popup.active).
        // Waiting for it beats a flat 2s sleep.
        const statusPopup = page.locator('div.add-new-popup.active').first();
        await statusPopup.waitFor({ state: 'visible', timeout: 30_000 });

        const statusSelect = statusPopup.locator('mat-select[formcontrolname="statusId"]').first();
        await statusSelect.waitFor({ state: 'visible', timeout: 15_000 });
        await statusSelect.click();

        const option = page.getByRole('option', { name: new RegExp(`^\\s*${targetStatus}\\s*$`, 'i') });
        // Wait for the option list to render before deciding it's absent.
        await page.getByRole('option').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => { });
        if (await option.count() === 0) {
            const available = await page.getByRole('option').allInnerTexts();
            console.log(`❌ Status "${targetStatus}" not offered from this queue. ` +
                `Available: ${available.map(t => t.trim()).join(' | ') || 'none'}`);
            await page.keyboard.press('Escape');
            return false;
        }
        await option.first().click();

        // The notes textarea only renders for On Hold / Cancelled / Rejected, where
        // it is also required. For every other target there is no field and none is
        // expected, so its absence is not worth reporting. Scoped to the popup so it
        // cannot pick up the invoice form's own note field or the embedded chat
        // widget's hidden textarea#message-input.
        const needsNote = /hold|cancel|reject/i.test(targetStatus);
        const notes = statusPopup.locator('textarea[formcontrolname="note"]').first();

        if (needsNote) {
            await notes.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => { });
        }
        if (await notes.isVisible().catch(() => false)) {
            await notes.fill(note);
        } else if (needsNote) {
            console.log(`⚠️  ${targetStatus} requires a note but no field appeared — the update will be rejected.`);
        }

        let patch: any = null;
        try {
            [patch] = await Promise.all([
                page.waitForResponse(
                    r => /\/invoices\/status$/.test(r.url())
                        && ['PATCH', 'POST', 'PUT'].includes(r.request().method()),
                    { timeout: 60_000 }
                ),
                statusPopup.getByRole('button', { name: 'Submit', exact: true }).click(),
            ]);
        } catch {
            patch = null;
        }

        const toast = (await page.locator('.toast-message').last()
            .innerText({ timeout: 10_000 }).catch(() => '')).trim();
        // One blank line before the toast so each transition reads as its own block:
        // toast, then the status change, then the module summary from recordModule.
        if (toast) {
            
            console.log(`ℹ️  ${toast}`);
        }

        const ok = !!patch && patch.ok();
        console.log("");
        console.log(ok
            ? `✅ ${invNo} status changed to ${targetStatus}.`
            : `❌ ${invNo} status change to ${targetStatus} failed` +
              `${patch ? ` (API ${patch.status()})` : ''}.`);
        return ok;
    };

    /**
     * Confirms the invoice landed in a queue. Reloads between attempts because the
     * grid will not pick up a server-side status change on its own; the per-attempt
     * wait is short since without a re-fetch more waiting cannot help.
     */
    const confirmInQueue = async (route: string, invNo: string, attempts = 3): Promise<boolean> => {
        for (let i = 1; i <= attempts; i++) {
            if (i > 1) await page.reload();
            const row = await openQueue(route, invNo);
            if (await row.waitFor({ state: 'visible', timeout: 5_000 })
                .then(() => true).catch(() => false)) return true;
        }
        console.log(`   ${invNo} did not appear in the ${queueLabel(route)} queue.`);
        return false;
    };

    // ---- Step 2: Update & verify invoice details ----------------------------
    // Runs before the transitions on purpose: the `actions` column is hidden on the
    // Approved / Pending Approval / Cancelled queues, so Actions -> Update is only
    // reachable while the invoice is still in Verification.
    const UpdatedAmount = '2500.75';
    const UpdatedNote = 'Updated by automation';

    await openQueue(QUEUE.verification, InvoiceNumber);
    const editParts = await rowParts(InvoiceNumber);
    await editParts.actions.click();
    await page.waitForTimeout(1500);
    await page.locator('span[class="menu-label"]', { hasText: 'Update' }).first().click();
    await page.waitForURL(/\/invoice\/\d+\/edit/, { timeout: 30_000 }).catch(() => { });
    await page.waitForTimeout(2000);

    await fillAmount('invoiceAmount', UpdatedAmount);
    await fillAmount('totalPaymentDue', UpdatedAmount);
    await page.locator('textarea[formcontrolname="note"]').fill(UpdatedNote);
    await page.waitForTimeout(1000);

    let updateResponse: any = null;
    try {
        [updateResponse] = await Promise.all([
            page.waitForResponse(
                r => /\/abstractors\/\d+\/invoices\/\d+$/.test(r.url())
                    && r.request().method() === 'PUT',
                { timeout: 60_000 }
            ),
            page.locator('button:has(i:text-is("save"))').first().click(),
        ]);
    } catch {
        updateResponse = null;
    }
    const updateToast = (await page.locator('.toast-message').last()
        .innerText({ timeout: 10_000 }).catch(() => '')).trim();
    if (updateToast) console.log(`ℹ️  ${updateToast}`);

    // Persistence check: reopen the invoice from the queue and read the value back
    // rather than trusting the form state we just typed into.
    await openQueue(QUEUE.verification, InvoiceNumber);
    const reopenParts = await rowParts(InvoiceNumber);
    await reopenParts.actions.click();
    await page.waitForTimeout(1500);
    await page.locator('span[class="menu-label"]', { hasText: 'Update' }).first().click();
    await page.waitForTimeout(2500);

    const persistedAmount = await page.locator('input[formcontrolname="invoiceAmount"]')
        .inputValue().catch(() => '');
    const amountPersisted = parseFloat(persistedAmount || '0') === parseFloat(UpdatedAmount);
    console.log(`✅ Invoice amount after reload: "${persistedAmount}" (expected ${UpdatedAmount})`);

    const invoiceUpdated = !!updateResponse && updateResponse.ok() && amountPersisted;
    recordModule('Invoice Update', invoiceUpdated, page.url());

    // ---- Steps 3-6: Hold -> Pending Approval -> Pending for Payment -> Paid
    // `queue` is where the invoice is expected to LAND after the transition, which is
    // not always the queue named by the status. Approving an invoice pushes it
    // straight through to Pending for Payment — it never appears in the Approved
    // grid — so that step checks the Pending Payment queue and reports under
    // "Invoice Pending Payment". There is deliberately no Approved queue visit and no
    // "Invoice Approved" email row.
    const LIFECYCLE = [
        { from: QUEUE.verification,    to: 'On Hold',          queue: QUEUE.onHold,          module: 'Invoice Hold' },
        { from: QUEUE.onHold,          to: 'Pending Approval', queue: QUEUE.pendingApproval, module: 'Invoice Pending Approval' },
        { from: QUEUE.pendingApproval, to: 'Approved',         queue: QUEUE.pendingPayment,  module: 'Invoice Pending Payment' },
        { from: QUEUE.pendingPayment,  to: 'Paid',             queue: QUEUE.paid,            module: 'Invoice Paid' },
    ];

    for (const step of LIFECYCLE) {
        const moved = await moveInvoiceTo(step.from, InvoiceNumber, step.to, `${step.to} via automation`);
        const landed = moved && await confirmInQueue(step.queue, InvoiceNumber);
        recordModule(step.module, landed, page.url());
    }

    // NOTE: Cancelled is deliberately not covered here. Paid and Cancelled are
    // mutually exclusive endings for one invoice, so cancelling this one after it
    // reached Paid would be refused by invoice-status-filter.service.ts. It needs a
    // second invoice — see the separate cancellation spec.

    // Surface the whole flow as a test failure too, not just red rows in the email.
    expect.soft(invoiceFormOpened, 'Add Invoice form rendered').toBe(true);
    expect.soft(invoiceCreated, `invoice created (toast: "${createToast}")`).toBe(true);
    expect.soft(documentUploaded, `${path.basename(invoiceFilePath)} uploaded to the invoice`).toBe(true);
    expect.soft(invoiceSaved, `invoice saved (toast: "${toastText}")`).toBe(true);
    expect.soft(invoiceFound, `invoice ${InvoiceNumber} found in Verification queue`).toBe(true);

    const results = getResults();
    await sendMail(results);
});
