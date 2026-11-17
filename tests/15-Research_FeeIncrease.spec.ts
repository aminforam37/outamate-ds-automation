import { test, expect, type Page, type Locator } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { addResult, getResults, getSrCounter, incrementSrCounter } from '../resultsCollector';
import { sendMail } from '../mail';

/**
 * Fee Increase workflow, end to end across both portals:
 *   1. Internal  — raise a Fee Change Request on a new order
 *   2. Internal  — Submit Request To Client   (-> Pending Client Response)
 *   3. Customer  — Approve the request
 *   4. Internal  — verify the status synced   (-> Approved)
 *
 * The customer half runs in its own browser context because the project pins every
 * spec to playwright/.auth/user.json (an internal account). Client credentials come
 * from .env: LoGIN_UsernameClient / LoGIN_PasswordClient — the account must belong to
 * the same client the order is raised for ('Test Company').
 */

const INTERNAL_FEE_QUEUE = '/app/internal/research/customer-support/fee-increase';
const CUSTOMER_FEE_QUEUE = '/app/customer/research/hold/fee-change-request';

// Search Inquiry queues. The internal one is a sibling of the fee queue; note the
// order-level tab is /orders/:id/search-inquiries.
const INTERNAL_SI_QUEUE = '/app/internal/research/customer-support/search-inquiries';
const CUSTOMER_SI_QUEUE = '/app/customer/research/hold/search-inquiries';

// InquiryStatuses (shared-global/models/common.ts) — the enum value IS the label.
const PENDING_CLIENT_RESPONSE = 'Pending Client Response';
const APPROVED = 'Approved';
const RECEIVED_CLIENT_RESPONSE = 'Received Client Response';
const RESOLVED = 'Resolved';

test(' Fee Increase Workflow', async ({ page, browser, baseURL }) => {

    /**
     * Absolute URL for a route constant. Email rows should link to the module's own
     * page, not to page.url() — that returns wherever navigation happened to leave
     * the browser, which made the links inconsistent between rows.
     */
    const abs = (route: string) => `${(baseURL ?? '').replace(/\/$/, '')}${route}`;

    const orderUrl = (tab = 'details') => abs(`/app/internal/research/orders/${OrderId}/${tab}`);

    const record = (module: string, passed: boolean, url: string) => {
        addResult({
            product: "Research",
            srNo: getSrCounter().toString(),
            module,
            status: passed ? 'Pass' : 'Fail',
            URL: `<a href="${url}">${module}</a>`
        });
        incrementSrCounter();
        console.log(passed ? `✅ ${module} completed successfully.` : `❌ ${module} failed.`);
    };

    /** Microsoft Entra CIAM sign-in, as in Login.setup.ts. */
    const signIn = async (p: Page, user: string, pass: string) => {
        await p.goto(baseURL ?? '/');
        await p.locator('input[name="username"]').fill(user);
        await p.locator('button[type="submit"]').click();
        await p.locator('input[name="passwd"]').fill(pass);
        await p.locator('button[type="submit"]').click();
        await p.locator('[type="submit"]').click({ timeout: 15_000 }).catch(() => { });
        await p.waitForURL(/\/app\//, { timeout: 60_000 }).catch(() => { });
    };

    const pick = async (index: number, option = 1) => {
        await page.locator('[aria-haspopup="listbox"]').nth(index).click();
        await page.waitForTimeout(1000);
        await page.locator('span[class="mdc-list-item__primary-text"]').nth(option).click();
        await page.waitForTimeout(1000);
    };

    /**
     * Opens a fee-increase queue, filters to one order, and returns every .ag-row for
     * that record. Pinned columns (orderId is pinned left, actions pinned right) live
     * in SEPARATE .ag-row elements from the centre columns, so a locator scoped to one
     * container cannot reach the others.
     */
    const feeQueueRow = async (p: Page, route: string, order: string): Promise<Locator | null> => {
        await p.goto(route);
        await p.locator('input[placeholder="Search keyword"]').fill(order);
        await p.waitForTimeout(2500);

        const centre = p.locator('.ag-row').filter({ hasText: new RegExp(`\\b${order}\\b`) }).first();
        const found = await centre.waitFor({ state: 'visible', timeout: 30_000 })
            .then(() => true).catch(() => false);
        if (!found) return null;

        const idx = await centre.getAttribute('row-index');
        return idx !== null ? p.locator(`.ag-row[row-index="${idx}"]`) : centre;
    };

    /** The status cell renders <span class="badge ...">{{ value }}</span>. */
    const readStatus = async (row: Locator) =>
        (await row.locator('[col-id="inquiryStatus"]').innerText().catch(() => '')).trim();

    /** Picks one item from a grid row's Actions menu. */
    const rowAction = async (p: Page, row: Locator, label: string) => {
        await row.locator('button[aria-label="Actions"]').first().click();
        await p.waitForTimeout(1000);
        await p.locator('span[class="menu-label"]', { hasText: label }).first().click();
    };

    console.log("");
    console.log("\x1b[1mFee Increase Workflow:\x1b[0m");

    // ======================================================================
    // Order setup — the request needs an order to hang off
    // ======================================================================
    console.log("📝 Creating an order...");

    await page.goto('/app/internal/research/dashboard/order-status');
    await page.waitForTimeout(1500);
    await page.locator('h6[class="module-title"]').nth(0).click();
    await page.waitForTimeout(1500);
    await page.locator('span[class="title"]').nth(3).click();
    await page.waitForTimeout(1500);
    await page.locator('a[href="/app/internal/research/orders/new"]').click();
    await page.waitForTimeout(1500);

    // Client must match the customer account used in step 3.
    await page.locator('[aria-haspopup="listbox"]').nth(0).click();
    await page.waitForTimeout(1000);
    await page.getByText('Test Company', { exact: true }).click();
    await page.waitForTimeout(1000);

    await pick(1);                                  // Division
    await page.locator('input[formcontrolname="lenderName"]').fill('BOB Bank');
    await pick(2);                                  // Order Type
    await pick(3);                                  // Product Type
    await pick(4);                                  // Sub-Product Type

    const CustomerOrder = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('input[formcontrolname="customerNumber"]').fill(CustomerOrder);
    await page.locator('input[formcontrolname="parcelNumber"]')
        .fill(faker.number.int({ min: 1000000, max: 9999999 }).toString());
    await page.locator('input[formcontrolname="line1"]').fill(faker.location.streetAddress());
    await page.locator('input[formcontrolname="zip"]').fill('99501');
    await page.locator('input[formcontrolname="city"]').fill(faker.location.city());

    await pick(5, 0);                               // State
    await pick(6, 4);                               // County

    await page.locator('input[formcontrolname="firstName"]').nth(0).fill(faker.person.firstName());
    await page.locator('input[formcontrolname="lastName"]').nth(0).fill(faker.person.lastName());
    await page.locator('input[id="LoanNumber"]')
        .fill(faker.number.int({ min: 100000, max: 999999 }).toString());
    await page.locator('input[formcontrolname="considerationAmount"]')
        .fill(faker.finance.amount({ min: 1000, max: 10000, dec: 2 }).toString());

    await page.locator('button[aria-label="Open calendar"]').nth(0).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);

    await page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-primary"]').click();
    await page.waitForURL(/\/orders\/\d+\/details/, { timeout: 60_000 }).catch(() => { });

    const OrderId = page.url().split('/orders/')[1]?.split('/')[0] ?? '';

   // console.log(`   Order ID: ${OrderId}   Customer Order #: ${CustomerOrder}`);

    // ======================================================================
    // Step 1 — raise the Fee Change Request
    // ======================================================================
    console.log("");
   // console.log("💰 Raising the fee change request...");

    // A sidebar tab link, not a button. routerLink writes a real href.
    await page.locator('a[href$="/fee-change-request"]').first().click();
    await page.waitForTimeout(2000);

    // "Add" carries static attributes, so aria-label is reliable here.
    await page.locator('button[aria-label="Add Inquiry"]').click();

    // The form is in the app's own overlay, not a mat-dialog.
    const feeForm = page.locator('div.add-new-popup.active').first();
    await feeForm.waitFor({ state: 'visible', timeout: 30_000 });

    // Confirm it is the right overlay before filling anything.
    const formTitle = (await feeForm.locator('h5').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  //  console.log(`   popup: "${formTitle}"`);

    /** Reads a mat-select's displayed value. */
    const selectedText = async (control: string) =>
        (await feeForm.locator(`mat-select[formcontrolname="${control}"] .mat-mdc-select-value`)
            .innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

    /**
     * Chooses an option from a mat-select, then confirms the trigger actually shows a
     * value and retries once if not.
     *
     * Two things to be careful of here:
     *  - Options render in a CDK overlay, so they are scoped to .mat-mdc-select-panel
     *    rather than matched page-wide (a page-wide getByRole('option') can pick up a
     *    stale or detached panel).
     *  - `multiple` selects keep the panel open. Do NOT close it with Escape:
     *    popup-dialog listens on document keydown, so Escape dismisses the whole Fee
     *    Change Request form. Clicking the CDK backdrop closes just the select.
     */
    const selectOption = async (control: string, multiple = false) => {
        for (let attempt = 1; attempt <= 2; attempt++) {
            await feeForm.locator(`mat-select[formcontrolname="${control}"]`).click();

            const panel = page.locator('.mat-mdc-select-panel').last();
            await panel.waitFor({ state: 'visible', timeout: 20_000 });

            const option = panel.getByRole('option').first();
            await option.waitFor({ state: 'visible', timeout: 20_000 });
            await option.click();

            // Close with Tab, NOT Escape and NOT a backdrop click: Escape is caught by
            // popup-dialog's document keydown handler and closes the whole form, and
            // the CDK backdrop sits under the panel so a centre click lands on an
            // option instead.
            if (multiple) {
                await page.keyboard.press('Tab');
            }
            await page.locator('.mat-mdc-select-panel').last()
                .waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => { });

            if (await selectedText(control)) return;
         //   console.log(`   ${control} did not take on attempt ${attempt}`);
        }
    };

    /**
     * The fee field is input[type=number] behind a `$` matTextPrefix, and its handler
     * can swallow a plain fill() — the same behaviour that left Credits Applied empty
     * in the invoice spec. Fill, read back, and retry by typing.
     */
    const fillFee = async (value: string) => {
        const input = feeForm.locator('input[formcontrolname="fee"]');
        await input.click();
        await input.fill('');
        await input.fill(value);
        if ((await input.inputValue()) !== value) {
            await input.fill('');
            await input.pressSequentially(value, { delay: 50 });
        }
    };

    await selectOption('severityId');
    await selectOption('inquiryTypeId');
    await selectOption('feeTypeIds', true);      // multiple

    //Fee Amount — Validators.min(0.01)
    const FeeAmount = '250.75';
    await fillFee(FeeAmount);

    //Notes — required, and must contain non-whitespace
    await feeForm.locator('textarea[formcontrolname="note"]').fill('Fee increase requested by automation');
    await page.waitForTimeout(300);

    // Read every control back, so a field that silently did not take is named rather
    // than collapsing into a generic "failed". Uses the selectedText() defined above.
    const formState = {
        severityId: await selectedText('severityId'),
        inquiryTypeId: await selectedText('inquiryTypeId'),
        feeTypeIds: await selectedText('feeTypeIds'),
        fee: await feeForm.locator('input[formcontrolname="fee"]').inputValue().catch(() => ''),
        note: await feeForm.locator('textarea[formcontrolname="note"]').inputValue().catch(() => ''),
    };
    // console.log(`   form: ${JSON.stringify(formState)}`);

    const missing = Object.entries(formState).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
        console.log(`   ⚠️  unset required field(s): ${missing.join(', ')} — submit will be rejected.`);
    }

    // A strict-mode violation on the submit button throws instantly, which would look
    // like an immediate unexplained failure — so check the count first.
    const submitBtn = feeForm.getByRole('button', { name: 'Submit', exact: true });
    const submitCount = await submitBtn.count();
    if (submitCount !== 1) {
        console.log(`   ⚠️  expected 1 Submit button in the popup, found ${submitCount}.`);
    }

    let createResp: any = null;
    try {
        [createResp] = await Promise.all([
            page.waitForResponse(
                r => /\/orders\/\d+\/fee-inquiries$/.test(r.url()) && r.request().method() === 'POST',
                { timeout: 60_000 }
            ),
            submitBtn.first().click(),
        ]);
    } catch (err) {
        console.log(`   submit failed: ${(err as Error).message.split('\n')[0]}`);
        createResp = null;
    }

    const createToast = (await page.locator('.toast-message').last()
        .innerText({ timeout: 15_000 }).catch(() => '')).trim();
    if (createToast) console.log(`ℹ️  ${createToast}`);

    const requestCreated = !!createResp && createResp.ok();
    record('Fee Request Creation', requestCreated, orderUrl('fee-change-request'));

    // ======================================================================
    // Step 2 — submit the request to the client
    // ======================================================================
    console.log("");
    console.log("📤 Submitting the request to the client...");

    let row = await feeQueueRow(page, INTERNAL_FEE_QUEUE, OrderId);
    let submitted = false;

    if (!row) {
        console.log(`   ${OrderId} not found in the internal Fee Increase queue.`);
    } else {
        console.log(`✅ Status before: "${await readStatus(row)}"`);

        // Exact label casing: "Submit Request To Client". No confirmation dialog —
        // it PATCHes statusId 1 straight away.
        let patchResp: any = null;
        try {
            [patchResp] = await Promise.all([
                page.waitForResponse(
                    r => /\/inquiries\/\d+\/status$/.test(r.url()) && r.request().method() === 'PATCH',
                    { timeout: 60_000 }
                ),
                rowAction(page, row, 'Submit Request To Client'),
            ]);
        } catch (err) {
            console.log(`   submit to client failed: ${(err as Error).message.split('\n')[0]}`);
            patchResp = null;
        }

        const toast = (await page.locator('.toast-message').last()
            .innerText({ timeout: 15_000 }).catch(() => '')).trim();
        if (toast) console.log(`ℹ️  ${toast}`);

        // Re-read from a fresh fetch: the grid does not refresh itself.
        row = await feeQueueRow(page, INTERNAL_FEE_QUEUE, OrderId);
        const status = row ? await readStatus(row) : '';
        console.log(`✅ Status after: "${status}"`);

        submitted = !!patchResp && patchResp.ok() && status === PENDING_CLIENT_RESPONSE;
    }
    record('Submit Request To Client', submitted, abs(INTERNAL_FEE_QUEUE));

    // ======================================================================
    // Step 3 — the client approves
    // ======================================================================
    console.log("");
    console.log("🔐 Signing in to the Customer Portal...");

    const clientUser = process.env.LoGIN_UsernameClient || '';
    const clientPass = process.env.LoGIN_PasswordClient || '';
    if (!clientUser || !clientPass) {
        throw new Error('LoGIN_UsernameClient / LoGIN_PasswordClient are not set in .env');
    }

    const clientContext = await browser.newContext({ storageState: undefined });
    const clientPage = await clientContext.newPage();
    await signIn(clientPage, clientUser, clientPass);

    const clientRow = await feeQueueRow(clientPage, CUSTOMER_FEE_QUEUE, OrderId);
    let approved = false;

    if (!clientRow) {
        console.log(`   ${OrderId} not visible to the client. URL: ${clientPage.url()}`);
    } else {
        console.log(`✅ Client status: "${await readStatus(clientRow)}"`);

        // Approve opens a notes dialog (title "Notes") with a required note.
        let approveResp: any = null;
        try {
            [approveResp] = await Promise.all([
                clientPage.waitForResponse(
                    r => /\/inquiries\/\d+\/status$/.test(r.url()) && r.request().method() === 'PATCH',
                    { timeout: 60_000 }
                ),
                (async () => {
                    await rowAction(clientPage, clientRow, 'Approve');
                    const notes = clientPage.locator('div.add-new-popup.active').first();
                    await notes.waitFor({ state: 'visible', timeout: 30_000 });
                    await notes.locator('textarea[formcontrolname="note"]')
                        .fill('Approved by client via automation');
                    await notes.getByRole('button', { name: 'Submit', exact: true }).click();
                })(),
            ]);
        } catch (err) {
            console.log(`❌ Approval failed: ${(err as Error).message.split('\n')[0]}`);
            approveResp = null;
        }

        const toast = (await clientPage.locator('.toast-message').last()
            .innerText({ timeout: 15_000 }).catch(() => '')).trim();
        if (toast) console.log(`ℹ️  ${toast}`);

        approved = !!approveResp && approveResp.ok();
    }
    record('Client Approval', approved, abs(CUSTOMER_FEE_QUEUE));

    await clientContext.close();

    // ======================================================================
    // Step 4 — verify the decision synced back
    // ======================================================================
    // No re-login: the client ran in its own context, so this session is untouched.
    console.log("");
    console.log("🔁 Verifying the status synced to the Internal Portal...");

    const globalSearch = page.locator('input[placeholder="Search by Order ID or Customer ID"]');
    await globalSearch.fill(CustomerOrder);
    await globalSearch.press('Enter');
    await page.waitForTimeout(2500);

    const orderCell = page.locator('.ag-row [col-id="orderId"]').first();
    const foundOrder = await orderCell.waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => true).catch(() => false);

    if (!foundOrder) {
        console.log(`❌ ${CustomerOrder} returned no rows from the header search.`);
    }
    await orderCell.click();
    await page.waitForTimeout(2000);

    await page.locator('a[href$="/fee-change-request"]').first().click();
    await page.locator('h3', { hasText: 'Fee Change Request' }).first()
        .waitFor({ state: 'visible', timeout: 30_000 }).catch(() => { });
    await page.waitForTimeout(1500);

    // The order-level grid (FeeInquiryComponent) uses the same inquiryStatus column
    // and badge renderer as the queue. This order is created fresh in this spec, so
    // it holds exactly one inquiry and .first() is unambiguous — pointing the spec at
    // an existing order with several requests would need filtering by fee or date.
    const finalStatus = (await page
        .locator('.ag-row [col-id="inquiryStatus"]').first()
        .innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    console.log(`✅ Internal status: "${finalStatus}"`);

    const synced = finalStatus === APPROVED;
   // record('Status Synchronization', synced, orderUrl('fee-change-request'));
    // Not an email row — the outcome is logged above and asserted below only.

    expect.soft(!!OrderId, 'order created').toBe(true);
    expect.soft(requestCreated, `fee request created (toast: "${createToast}")`).toBe(true);
    expect.soft(submitted, `status reached ${PENDING_CLIENT_RESPONSE}`).toBe(true);
    expect.soft(approved, 'client approval submitted').toBe(true);
    expect.soft(synced, `internal status is ${APPROVED} (was "${finalStatus}")`).toBe(true);

    // ======================================================================
    // Section 6 — Search Inquiry, on the same order
    // ======================================================================
    console.log("");
    console.log("\x1b[1mSearch Inquiry Workflow:\x1b[0m");

    /**
     * Reads the inquiry status from the ORDER-LEVEL Search Inquiry tab, which uses
     * col-id="inquiryStatus" and nothing else.
     *
     * Deliberately NOT read from the queue: matching '[col-id="status"]' there
     * resolved to an order-status cell and reported "FEE INCREASE" — the order's own
     * status left over from the fee flow — instead of the inquiry status.
     */
    const readInquiryStatus = async (): Promise<string> => {
        await page.goto(`/app/internal/research/orders/${OrderId}/search-inquiries`);
        await page.waitForTimeout(2500);
        return (await page.locator('.ag-row [col-id="inquiryStatus"]').first()
            .innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    };

    // The order status as it stands NOW, immediately before the inquiry is raised —
    // not the status it had at creation. Step 3 verifies the order returns to this.
    await page.goto(`/app/internal/research/orders/${OrderId}/details`);
    await page.waitForTimeout(2500);
    const PreInquiryStatus = (await page.locator('span.badge.text-soft-dark').first()
        .innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    // console.log(`   order status before the inquiry: "${PreInquiryStatus}"`);

    // ---- Step 1: raise the Search Inquiry --------------------------------
    await page.goto(`/app/internal/research/orders/${OrderId}/search-inquiries`);
    await page.waitForTimeout(2000);

    // aria-label is "Add" here, not "Add Inquiry" as on the fee form. It is disabled
    // while an inquiry with statusId 1 or 2 already exists.
    await page.locator('button[aria-label="Add"]').click();

    const siForm = page.locator('div.add-new-popup.active').first();
    await siForm.waitFor({ state: 'visible', timeout: 30_000 });
    // console.log(`   popup: "${(await siForm.locator('h5').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim()}"`);

    /** Same shape as the fee form's selectOption: wait for the panel, verify it took. */
    const siSelect = async (control: string, count = 1) => {
        for (let attempt = 1; attempt <= 2; attempt++) {
            await siForm.locator(`mat-select[formcontrolname="${control}"]`).click();
            const panel = page.locator('.mat-mdc-select-panel').last();
            await panel.waitFor({ state: 'visible', timeout: 20_000 });

            // Multi-selects render checkbox options and keep the panel open, so tick
            // as many as asked for.
            const options = panel.getByRole('option');
            const available = await options.count();
            for (let i = 0; i < Math.min(count, available); i++) {
                await options.nth(i).click();
            }

            // Close with Tab, NOT Escape and NOT a backdrop click:
            //  - Escape is caught by popup-dialog's document keydown handler and
            //    dismisses the entire Search Inquiry form.
            //  - The CDK backdrop spans the viewport but sits UNDER the panel, so a
            //    centre click lands on .panel-search or an option and never closes it.
            await page.keyboard.press('Tab');
            await panel.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => { });

            const value = (await siForm
                .locator(`mat-select[formcontrolname="${control}"] .mat-mdc-select-value`)
                .innerText().catch(() => '')).trim();
            if (value) return;
            console.log(`   ${control} did not take on attempt ${attempt}`);
        }
    };

    await siSelect('severityId');
    await siSelect('inquiryTypeIds', 3);   // "Inquiry Type" — multiple, tick 3 checkboxes
    // The requirement's "Description" is this control; there is no field named description.
    await siForm.locator('textarea[formcontrolname="note"]').fill('Search inquiry raised by automation');
    await page.waitForTimeout(300);

    let siCreateResp: any = null;
    try {
        [siCreateResp] = await Promise.all([
            page.waitForResponse(
                r => /\/orders\/\d+\/search-inquiries$/.test(r.url()) && r.request().method() === 'POST',
                { timeout: 60_000 }
            ),
            siForm.getByRole('button', { name: 'Submit', exact: true }).click(),
        ]);
    } catch (err) {
        console.log(`   inquiry submit failed: ${(err as Error).message.split('\n')[0]}`);
        siCreateResp = null;
    }

    const siToast = (await page.locator('.toast-message').last()
        .innerText({ timeout: 15_000 }).catch(() => '')).trim();
    if (siToast) console.log(`ℹ️  ${siToast}`);

    const inquiryCreated = !!siCreateResp && siCreateResp.ok();
    record('Search Inquiry Creation', inquiryCreated, orderUrl('search-inquiries'));

    // ---- Step 2: submit to client, then the client responds --------------
    // console.log("");
  //  console.log("📤 Submitting the inquiry to the client...");

    let siRow = await feeQueueRow(page, INTERNAL_SI_QUEUE, OrderId);
    let siSent = false;

    if (!siRow) {
        console.log(` ${OrderId} not found in the Search Inquiries queue.`);
    } else {
        // "Submit Inquiry to Client" — note this differs from the fee queue's
        // "Submit Request To Client" in both noun and casing. No dialog; it PATCHes
        // statusId 1 immediately.
        try {
            await rowAction(page, siRow, 'Submit Inquiry to Client');
            await page.waitForTimeout(2500);
            siSent = true;
        } catch (err) {
            console.log(`   submit to client failed: ${(err as Error).message.split('\n')[0]}`);
        }
        const t = (await page.locator('.toast-message').last().innerText({ timeout: 15_000 }).catch(() => '')).trim();
        if (t) console.log(`ℹ️  ${t}`);
    }
    record('Submit Inquiry To Client', siSent, abs(INTERNAL_SI_QUEUE));

    console.log("");
    console.log("🔐 Client responding to the inquiry...");

    const siContext = await browser.newContext({ storageState: undefined });
    const siPage = await siContext.newPage();
    await signIn(siPage, clientUser, clientPass);

    const siClientRow = await feeQueueRow(siPage, CUSTOMER_SI_QUEUE, OrderId);
    let clientResponded = false;

    if (!siClientRow) {
        console.log(`   ${OrderId} not visible to the client. URL: ${siPage.url()}`);
    } else {
        // The client's only route in is "Update", which reopens the same form with
        // severity hidden and inquiry type disabled — they fill Notes and Save.
        // That PATCHes statusId 7 = Received Client Response.
        try {
            await rowAction(siPage, siClientRow, 'Update');
            const dlg = siPage.locator('div.add-new-popup.active').first();
            await dlg.waitFor({ state: 'visible', timeout: 30_000 });
            await dlg.locator('textarea[formcontrolname="note"]').fill('Client response via automation');
            await dlg.getByRole('button', { name: 'Save', exact: true }).click();
            await siPage.waitForTimeout(2500);
            clientResponded = true;
        } catch (err) {
            console.log(`❌ Client response failed: ${(err as Error).message.split('\n')[0]}`);
        }
        const t = (await siPage.locator('.toast-message').last().innerText({ timeout: 15_000 }).catch(() => '')).trim();
        if (t) console.log(`ℹ️  ${t}`);
    }
    record('Client Inquiry Response', clientResponded, abs(CUSTOMER_SI_QUEUE));
    await siContext.close();

    const afterResponse = await readInquiryStatus();
    console.log(`✅ Inquiry status: "${afterResponse}"`);

    // ---- Step 3: the order reverts to its pre-inquiry status -------------
    console.log("");
    console.log("🔁 Checking the order reverted to its pre-inquiry status...");

    await page.goto(`/app/internal/research/orders/${OrderId}/details`);
    await page.waitForTimeout(2500);
    const revertedStatus = (await page.locator('span.badge.text-soft-dark').first()
        .innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    console.log(`✅ Order status: "${revertedStatus}" `);  //(before the inquiry: "${PreInquiryStatus}")

    const reverted = !!PreInquiryStatus && revertedStatus === PreInquiryStatus;
    record('Order Status Reverted ', reverted, orderUrl('details'));

    // // ---- Step 4: resolve the inquiry -------------------------------------
    // console.log("");
    // console.log("✔️ Resolving the inquiry...");

    // siRow = await feeQueueRow(page, INTERNAL_SI_QUEUE, OrderId);
    // let resolved = false;

    // if (!siRow) {
    //     console.log(`✅ ${OrderId} not found in the Search Inquiries queue.`);
    // } else {
    //     // There is no "Resolve" menu item. Resolution is done through the Status
    //     // mat-select on the edit form, reached via "Update", then Save (a PUT).
    //     try {
    //         await rowAction(page, siRow, 'Update');
    //         const dlg = page.locator('div.add-new-popup.active').first();
    //         await dlg.waitFor({ state: 'visible', timeout: 30_000 });

    //         await dlg.locator('mat-select[formcontrolname="statusId"]').click();
    //         const panel = page.locator('.mat-mdc-select-panel').last();
    //         await panel.waitFor({ state: 'visible', timeout: 20_000 });
    //         await panel.getByRole('option', { name: RESOLVED, exact: true }).click();

    //         await dlg.locator('textarea[formcontrolname="note"]').fill('Resolved by automation');
    //         await dlg.getByRole('button', { name: 'Save', exact: true }).click();
    //         await page.waitForTimeout(2500);
    //     } catch (err) {
    //         console.log(`❌ Resolve failed: ${(err as Error).message.split('\n')[0]}`);
    //     }
    //     const t = (await page.locator('.toast-message').last().innerText({ timeout: 15_000 }).catch(() => '')).trim();
    //     if (t) console.log(`ℹ️  ${t}`);

    //     const status = await readInquiryStatus();
    //     console.log(`✅ Inquiry status: "${status}"`);
    //     resolved = status === RESOLVED;
    // }
    // record('Inquiry Resolution', resolved, orderUrl('search-inquiries'));

    expect.soft(inquiryCreated, 'search inquiry created').toBe(true);
    expect.soft(siSent, 'inquiry submitted to client').toBe(true);
    expect.soft(clientResponded, 'client response submitted').toBe(true);
    expect.soft(reverted, `order reverted to "${PreInquiryStatus}" (is "${revertedStatus}")`).toBe(true);
  //  expect.soft(resolved, `inquiry is ${RESOLVED}`).toBe(true);

   // await sendMail(getResults());
    
});
