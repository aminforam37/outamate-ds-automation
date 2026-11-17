import { test, expect, type Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { addResult, getResults, getSrCounter, incrementSrCounter } from '../resultsCollector';
import { sendMail } from '../mail';

/**
 * Internal portal: create an order and capture its Order ID.
 * Customer portal: verify the same order is present and can be opened.
 *
 * The customer half runs in its own browser context because the project pins every
 * spec to playwright/.auth/user.json (an internal account).
 * Client credentials come from .env: LoGIN_UsernameClient / LoGIN_PasswordClient.
 */

// "All Open Orders" is the only customer grid with no status filter, so it is the
// only one a brand-new order can appear in.
const CUSTOMER_GRID = '/app/customer/research/order-stage/all-open-orders';

//@Outamate DS:
test('Client Login Order Visibility', async ({ page, browser, baseURL }) => {

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
        // "Stay signed in?" is not always shown.
        await p.locator('[type="submit"]').click({ timeout: 15_000 }).catch(() => { });
        // MSAL lands on "/" and only then routes into /app/...
        await p.waitForURL(/\/app\//, { timeout: 60_000 }).catch(() => { });
    };

    const pick = async (index: number, option = 1) => {
        await page.locator('[aria-haspopup="listbox"]').nth(index).click();
        await page.waitForTimeout(1000);
        await page.locator('span[class="mdc-list-item__primary-text"]').nth(option).click();
        await page.waitForTimeout(1000);
    };

    console.log("");
    console.log("\x1b[1mClient Login — Order Visibility:\x1b[0m");

    // ---- Internal portal: create the order -------------------------------
    console.log("📝 Creating an order in the Internal Portal...");

    await page.goto('/app/internal/research/dashboard/order-status');
    await page.waitForTimeout(1500);
    await page.locator('h6[class="module-title"]').nth(0).click();
    await page.waitForTimeout(1500);

    await page.locator('span[class="title"]').nth(3).click();
    await page.waitForTimeout(1500);
    await page.locator('a[href="/app/internal/research/orders/new"]').click();
    await page.waitForTimeout(1500);

    // Customer must match the client account used below, or the order is invisible to it.
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

    // Instrument Date
    await page.locator('button[aria-label="Open calendar"]').nth(0).click();
    await page.waitForTimeout(1000);
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(1000);

    // Submit — success redirects to /orders/<id>/details, which carries the Order ID.
    await page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-primary"]').click();
    const created = await page.waitForURL(/\/orders\/\d+\/details/, { timeout: 60_000 })
        .then(() => true).catch(() => false);

    const OrderId = page.url().split('/orders/')[1]?.split('/')[0] ?? '';
    console.log(`   Order ID: ${OrderId}   Customer Order #: ${CustomerOrder}`);
    record('Internal Order Creation', created && !!OrderId, page.url());

    // ---- Customer portal: verify the order -------------------------------
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

    await clientPage.goto(CUSTOMER_GRID);
    await clientPage.waitForURL(/\/app\/customer\//, { timeout: 60_000 }).catch(() => { });

    const loggedIn = /\/app\/customer\//.test(clientPage.url())
        && !/access-required/.test(clientPage.url());
    if (!loggedIn) console.log(`   landed on ${clientPage.url()}`);
    record('Customer Portal Login', loggedIn, clientPage.url());

    // Present in the client's grid. The customer grid column is customerOrderNumber,
    // not customerNumber as on the internal grids.
    await clientPage.locator('input[placeholder="Search keyword"]').fill(CustomerOrder);
    await clientPage.waitForTimeout(2500);

    const orderRow = clientPage.locator('.ag-row')
        .filter({ has: clientPage.locator('[col-id="customerOrderNumber"]', { hasText: CustomerOrder }) });
    const present = await orderRow.first().waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => true).catch(() => false);
    record('Order Visible to Client', present, clientPage.url());

    // Accessible: the client can open it.
    await clientPage.goto(`/app/customer/research/orders/${OrderId}/details`);
    const accessible = await clientPage.getByText(CustomerOrder).first()
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => true).catch(() => false);
    record('Order Accessible to Client', accessible, clientPage.url());

    await clientContext.close();

    // ---- Back to the Internal Portal -------------------------------------
    // No re-login needed: the client ran in its own context, so this session was
    // never disturbed. Reaching the order here also proves that.
    //
    // Checked via the order detail page rather than a queue grid, because the queues
    // are status-filtered and a brand-new order may not be in any particular one.
    console.log("");
    console.log("🔁 Re-checking the order in the Internal Portal...");

    await page.goto(`/app/internal/research/orders/${OrderId}/details`);
    const internalOk = /\/app\/internal\//.test(page.url())
        && await page.getByText(CustomerOrder).first()
            .waitFor({ state: 'visible', timeout: 30_000 })
            .then(() => true).catch(() => false);
    if (!internalOk) console.log(`   landed on ${page.url()}`);
    record('Order Verified in Internal Portal', internalOk, page.url());

    expect.soft(created && !!OrderId, 'order created').toBe(true);
    expect.soft(loggedIn, 'customer portal reachable').toBe(true);
    expect.soft(present, `order ${CustomerOrder} in client grid`).toBe(true);
    expect.soft(accessible, `order ${OrderId} openable by client`).toBe(true);
    expect.soft(internalOk, `order ${OrderId} still reachable internally`).toBe(true);

    //await sendMail(getResults());
});

test.afterAll(async ({}, testInfo) => {
    const results = getResults();
    const baseURL =
        testInfo.project.use.baseURL ||
        'https://dev-outamateds.outamationlabs.com/';
    await sendMail(results); //await sendMail(results, baseURL); 
});