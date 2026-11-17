import { test, chromium, Page, Browser, Locator, Response } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/en';
import { addResult, getResults, getSrCounter, incrementSrCounter } from '../resultsCollector';
import { sendMail } from '../mail';

// Without these, Playwright waits forever on a click, goto or waitForSelector whose element
// never comes, and the lane hangs silently. With them the order fails with the locator named
// and the lane moves on to its next order.
test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

/**
 * Bulk Research orders using only the workflows already proven by specs 11–15.
 *
 * RUN_PLAN lists the workflows and their order counts. Orders run in LANES parallel lanes
 * (default 4), dealt round-robin, and each order keeps ONE client and ONE product type from
 * creation to the end of its workflow:
 *
 *   Keying           (11 + 12): documents uploaded → KEYING IN PROGRESS → QUALITY CHECK → PENDING DELIVERY
 *                               (Covius, First American; LoanCare - OM only with Assignment Information Report)
 *   Fee Increase     (15):      fee request → Pending Client Response → client approves → Approved
 *   Search Inquiries (15):      inquiry → submitted to client → client responds → order reverts
 *   Pending ABS      (13):      PENDING ABS ASSIGN → ABS ASSIGNED → ABS CONFIRMED → RECEIVED FROM ABS → QUALITY CHECK
 *                               → ABS REJECTS, then again via Quotes Request (Quotes Review → ABS ASSIGNED → … → ABS REJECTS)
 *   AI Extraction    (AI.spec): Search Details → AI documents uploaded → READY FOR MERGE → (system) MERGE IN PROGRESS
 *                               → READY FOR EXTRACTION → EXTRACTION IN PROGRESS → KEYING → KEYING IN PROGRESS
 *                               → low-confidence fields (< 95%) reviewed → QUALITY CHECK → PENDING DELIVERY (Covius)
 *
 * Scale up by raising the `count` values in RUN_PLAN.
 *
 * Env:
 *   START_ROW/END_ROW order numbers to run (default: all)
 *   LANES             orders processed at the same time, each in its own browser context (default 4)
 *   ORDER_PATHS_FILE  workbook whose column A lists the product types
 *   LoGIN_UsernameClient / LoGIN_PasswordClient  Test Company client account (Fee Increase, Search Inquiries)
 *
 * Every run creates new orders; saved orders are never reused. Progress lives in Bulk_Orders/
 * (Playwright empties test-results/ on every run), and the previous run's file is kept as
 * progress_<time>.json.
 */
const INPUT = process.env.ORDER_PATHS_FILE || path.resolve('TestData/Research_Order_Status_Paths.xlsx');
const OUT_DIR = path.resolve('Bulk_Orders');
const PROGRESS = path.join(OUT_DIR, 'progress.json');
const REPORT = path.join(OUT_DIR, 'Research_Bulk_Orders_Report.xlsx');
const ABSTRACTOR = 'Outamation_Foram';
const QUOTE_ABSTRACTOR = 'Outamation_hepin';     // Quotes Request pass of spec 13
const Q = '/app/internal/research';

/** Keying clients and their product types are listed below. Test Company is the client spec 13/15 use. */
const RUN_PLAN: { workflow: string; count: number; clients: string[] }[] = [
    { workflow: 'Keying', count: 30, clients: ['Covius', 'LoanCare - OM'] },
    { workflow: 'Fee Increase', count: 30, clients: ['Test Company'] },
    { workflow: 'Search Inquiries', count: 30, clients: ['Test Company'] },
    { workflow: 'Pending ABS', count: 30, clients: ['Test Company'] },
    { workflow: 'AI Extraction', count: 30, clients: ['Covius'] },
];

/** AI Extraction: product types whose status path includes merge + extraction, the documents, and the score threshold. */
const AI_PRODUCT_TYPES = ['Current Owner-Loan Mod', '1-Owner', '2-Owners', 'Full Search', 'Update', 'Document Retrieval'];
const AI_DOCS = ['25562238.DEED01.pdf', '25562238.MTG01 1.pdf', '25748105.DEED01.pdf', '25748105.MTG01.pdf', '25900625.ASMT01.pdf'];
const ALLOWED_CONFIDENCE = Number(process.env.ALLOWED_CONFIDENCE || 95);
const EXTRACTION_TIMEOUT_MS = Number(process.env.EXTRACTION_TIMEOUT_MIN || 15) * 60_000;
const AI_SYSTEM_PATH = ['READY FOR MERGE', 'MERGE IN PROGRESS', 'READY FOR EXTRACTION', 'EXTRACTION IN PROGRESS', 'KEYING'];

/**
 * Clients keyed only for one product type. These never fall back to another product type.
 * Clients that aren't listed rotate through the product types in the workbook.
 */
const FIXED_PRODUCT: Record<string, string> = { 'LoanCare - OM': 'Assignment Information Report' };

/** Product types whose New Order form requires Prior Effective Date. */
const NEEDS_PRIOR_EFFECTIVE_DATE = ['Update', 'Policy Update', 'Current Owner-Loan Mod Update'];

/** Documents uploaded before keying (spec 11), each given the document type at the same index + 1. */
const KEYING_DOCS = ['INDEX.pdf', 'Prior SP.pdf', '26219076.pdf'];

type Order = { orderId: string; customerNumber: string; client: string; productType: string };
type Outcome = Order & {
    orderNo: number; workflow: string; orderUrl: string; lastStep: string; reached: string;
    preInquiryStatus?: string; result: 'Done' | 'Blocked' | 'Fail'; error: string; seconds?: number;
    startStatus?: string; lowConfidence?: string;
};
/**
 * One lane: its own internal page, (once needed) its own client-portal page, and a page in a hidden
 * browser used only to read the live order status (so the Keying form is never reloaded or left).
 */
type Ctx = { page: Page; browser: Browser; base: string; viewport: { width: number; height: number } | null; client?: Page | null; status?: Page };
/** `status` marks steps that end in an order status (recorded as the order's reached status). */
type Step = { name: string; status?: string; run: (ctx: Ctx, o: Outcome) => Promise<void> };

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
/** Client names compared without commas/dots, so "Sokolof Remtulla LLP" matches "Sokolof Remtulla, LLP". */
const loose = (s: string) => norm(s).replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
const soft = { timeout: 5_000 };

// ---------------------------------------------------------------------------
// Input / progress / report
// ---------------------------------------------------------------------------

async function readProductTypes(): Promise<string[]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(INPUT);
    const types = new Set<string>();
    wb.worksheets[0].eachRow((r: any) => {
        const t = String(r.getCell(1).text ?? '').trim();
        if (t) types.add(t);
    });
    return [...types];
}

/** Every run creates new orders. The previous run's progress is kept as progress_<time>.json, never reused. */
function archiveProgress() {
    if (!fs.existsSync(PROGRESS)) return;
    const stamp = new Date(fs.statSync(PROGRESS).mtime).toISOString().replace(/[:.]/g, '-');
    fs.renameSync(PROGRESS, path.join(OUT_DIR, `progress_${stamp}.json`));
}

function saveProgress(progress: Record<number, Outcome>) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 2));
}

async function writeReport(progress: Record<number, Outcome>) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Bulk Orders');
    ws.columns = [
        { header: 'Order #', key: 'orderNo', width: 8 },
        { header: 'Workflow', key: 'workflow', width: 16 },
        { header: 'Client', key: 'client', width: 34 },
        { header: 'Product Type', key: 'productType', width: 34 },
        { header: 'Order ID', key: 'orderId', width: 10 },
        { header: 'Customer Number', key: 'customerNumber', width: 16 },
        { header: 'Order URL', key: 'orderUrl', width: 60 },
        { header: 'Last Step', key: 'lastStep', width: 28 },
        { header: 'Order Status', key: 'reached', width: 22 },
        { header: 'Result', key: 'result', width: 10 },
        { header: 'Time (s)', key: 'seconds', width: 9 },
        { header: 'Low Confidence Reviewed (AI)', key: 'lowConfidence', width: 50 },
        { header: 'Error', key: 'error', width: 80 },
    ];
    ws.getRow(1).font = { bold: true };
    Object.values(progress).sort((a, b) => a.orderNo - b.orderNo).forEach(o => {
        const row = ws.addRow(o);
        if (o.result !== 'Done') row.font = { color: { argb: 'FFC00000' } };
    });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await wb.xlsx.writeFile(REPORT);
}

// ---------------------------------------------------------------------------
// Order creation and navigation
// ---------------------------------------------------------------------------

/**
 * Opens the nth mat-select on the page and picks an option by text (matched loosely),
 * or by index. `field` names the dropdown in errors. An `optional` dropdown that doesn't
 * open (Division / Sub-Product for some clients and products) is skipped.
 */
/** Product types each client's New Order form offers, learned from the dropdown the first time it opens. */
const offeredTypes = new Map<string, string[]>();

async function pick(page: Page, selectIndex: number, choice: string | number, field: string, optional = false,
    onOptions?: (texts: string[]) => void) {
    const wait = optional ? 5_000 : 20_000;
    const opened = await page.locator('[aria-haspopup="listbox"]').nth(selectIndex).click({ timeout: wait })
        .then(() => page.locator('.mat-mdc-select-panel').last().waitFor({ state: 'visible', timeout: wait }))
        .then(() => true).catch(() => false);
    if (!opened) {
        if (optional) return null;
        throw new Error(`${field} dropdown did not open`);
    }
    const panel = page.locator('.mat-mdc-select-panel').last();
    let option: Locator;
    if (typeof choice === 'number') {
        option = panel.getByRole('option').nth(choice);
    } else {
        const texts = await panel.getByRole('option').allInnerTexts();
        onOptions?.(texts.map(t => t.trim()).filter(Boolean));
        const i = texts.findIndex(t => loose(t) === loose(choice));
        option = panel.getByRole('option').nth(i < 0 ? 9999 : i);
    }
    if (!await option.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await page.keyboard.press('Escape');
        await panel.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => { });
        return null;
    }
    const text = (await option.innerText()).trim();
    await option.click();
    await panel.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => { });
    return text;
}

/** Save didn't open the new order. `stillNew`: the page is still on /orders/new, so no order was made. */
class CreateTimeout extends Error {
    constructor(message: string, public stillNew: boolean) { super(message); }
}

/** createOrder, retried once when Save timed out without creating anything. */
async function createOrderRetry(page: Page, client: string, productType: string): Promise<Order | null> {
    try {
        return await createOrder(page, client, productType);
    } catch (err) {
        if (!(err instanceof CreateTimeout) || !err.stillNew) throw err;
        console.log(`   ↻ ${err.message}; retrying once`);
        return createOrder(page, client, productType);
    }
}

/** New Order form, as in 11-Research_OrderCreation_Verification. Null if the product type is not offered. */
async function createOrder(page: Page, client: string, productType: string): Promise<Order | null> {
    await page.goto(`${Q}/orders/new`, { waitUntil: 'domcontentloaded' });

    const clientName = await pick(page, 0, client, 'Customer');
    if (!clientName) throw new Error(`client "${client}" not in Customer dropdown`);
    await pick(page, 1, 1, 'Division', true);                 // some clients have no divisions
    await page.locator('input[formcontrolname="lenderName"]').fill('BOB Bank');
    if (!await pick(page, 2, 1, 'Order Type')) throw new Error(`no Order Type for "${client}"`);
    if (!await pick(page, 3, productType, 'Product Type', false, texts => offeredTypes.set(client, texts))) return null;
    await pick(page, 4, 1, 'Sub-Product Type', true);

    const customerNumber = faker.number.int({ min: 100000, max: 999999 }).toString();
    await page.locator('input[formcontrolname="customerNumber"]').fill(customerNumber);
    await page.locator('input[formcontrolname="parcelNumber"]').fill(faker.number.int({ min: 1000000, max: 9999999 }).toString());
    await page.locator('input[formcontrolname="line1"]').fill(faker.location.streetAddress());
    await page.locator('input[formcontrolname="zip"]').fill('99501');
    await page.locator('input[formcontrolname="city"]').fill(faker.location.city());
    if (!await pick(page, 5, 0, 'State')) throw new Error('no State option');
    if (!await pick(page, 6, 4, 'County')) throw new Error('no County option');

    await page.locator('input[formcontrolname="firstName"]').nth(0).fill(faker.person.firstName());
    await page.locator('input[formcontrolname="middleName"]').nth(0).fill(faker.person.middleName());
    await page.locator('input[formcontrolname="lastName"]').nth(0).fill(faker.person.lastName());
    await page.locator('input[id="LoanNumber"]').fill(faker.number.int({ min: 100000, max: 999999 }).toString());
    await page.locator('input[formcontrolname="considerationAmount"]').fill(faker.finance.amount({ min: 1000, max: 10000, dec: 2 }));

    // Date pickers are found by their field: Prior Effective Date adds a second calendar
    // for some product types, so a plain index would pick the wrong one.
    const dateField = (field: Locator) => page.locator('mat-form-field').filter({ has: field }).locator('button[aria-label="Open calendar"]').first();
    const instrument = dateField(page.locator('input[formcontrolname="instrumentDate"]'));
    await (await instrument.count() ? instrument : page.locator('button[aria-label="Open calendar"]').nth(0)).click();
    await page.locator('.mat-calendar-body-today').click();

    // Prior Effective Date (Update, Policy Update, Current Owner-Loan Mod Update) and any other
    // date the product adds: every date field still empty gets today, whatever its label.
    if (NEEDS_PRIOR_EFFECTIVE_DATE.some(p => loose(p) === loose(productType))) await page.waitForTimeout(1_000);
    await fillEmptyDates(page);
    await page.locator('textarea[formcontrolname="specialInstructions"]').fill('Bulk status automation order');
    await fillRequiredEmpty(page);

    // Fail now, naming the field, rather than waiting two minutes for a Save that can't succeed.
    const missing = [...new Set(await invalidControls(page))];
    if (missing.length) throw new Error(`New Order required fields still empty for "${productType}": ${missing.join(', ')}`);

    await page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-primary"]').click();
    const opened = await page.waitForURL(/\/app\/internal\/research\/orders\/\d+\/details/, { timeout: 120_000 })
        .then(() => true).catch(() => false);
    if (!opened) {
        const why = norm(await page.locator('.toast-message, mat-error').first().innerText({ timeout: 1_000 }).catch(() => ''));
        throw new CreateTimeout(`order did not open after Save${why ? ` — "${why}"` : ''}`, /\/orders\/new/.test(page.url()));
    }
    const orderId = page.url().split('/orders/')[1]?.split('/')[0] ?? '';
    return { orderId, customerNumber, client: clientName, productType };
}

/** Sets today on every visible date picker whose input is still empty. */
async function fillEmptyDates(page: Page) {
    const fields = page.locator('mat-form-field').filter({ has: page.locator('button[aria-label="Open calendar"]') });
    const n = await fields.count();
    for (let i = 0; i < n; i++) {
        const field = fields.nth(i);
        if (!await field.isVisible().catch(() => false)) continue;
        if ((await field.locator('input').first().inputValue().catch(() => 'x')).trim()) continue;
        await field.locator('button[aria-label="Open calendar"]').first().click(soft).catch(() => { });
        await page.locator('.mat-calendar-body-today').click(soft).catch(() => page.keyboard.press('Escape'));
    }
}

/** Today as MM/DD/YYYY, for date inputs typed directly. */
const todayText = () => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

/**
 * Runs `act` (a Save/Submit click) and waits for the save request it sends — an XHR/fetch
 * POST/PUT/PATCH matching `url` — instead of a fixed pause. Falls back to 1s if none comes.
 */
async function actAndSettle(page: Page, act: () => Promise<unknown>, url: RegExp = /./, timeoutMs = 15_000) {
    const resp = page.waitForResponse(r => url.test(r.url()) && r.request().method() !== 'GET'
        && ['xhr', 'fetch'].includes(r.request().resourceType()), { timeout: timeoutMs })
        .catch(() => null);
    await act();
    if (!await resp) await page.waitForTimeout(1_000);
}

async function openOrder(page: Page, orderId: string, tab = 'details') {
    await page.goto(`${Q}/orders/${orderId}/${tab}`, { waitUntil: 'domcontentloaded' });
    await page.locator('span.badge.text-soft-dark').first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => { });
}

async function readStatus(page: Page, orderId: string): Promise<string> {
    await openOrder(page, orderId);
    return norm(await page.locator('span.badge.text-soft-dark').first().innerText().catch(() => ''));
}

/** Polls the order's status badge until it is `target`. */
async function expectStatus(page: Page, orderId: string, target: string, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    let current = '';
    while (Date.now() < deadline) {
        current = await readStatus(page, orderId);
        if (current === target) return;
        await page.waitForTimeout(1_000);
    }
    throw new Error(`expected status "${target}" but it is "${current}"`);
}

const errorToast = (page: Page) =>
    page.locator('.warning-toast, .toast-container.danger-toast, .toast-container.error-toast').first();

/**
 * In the open Process Order dialog, moves the order to `target`. The dialog has one of two forms:
 *  - a split button "Move to <NEXT STATUS>" + ▾ (when the app suggests a next status): the left half
 *    is clicked when it already names `target`, otherwise ▾ lists every status;
 *  - a single "Move to..." button opening the status menu (when there is no suggested status).
 */
async function chooseMoveTarget(page: Page, target: string) {
    const suggested = page.locator('button.split-button-left').filter({ visible: true }).first();
    const dropdown = page.locator('button.split-button-right, button.move-to-button, button:has-text("Move to...")')
        .filter({ visible: true }).first();
    if (!await suggested.or(dropdown).first().waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)) {
        throw new Error(`Process Order dialog showed no "Move to" button (moving to ${target})`);
    }
    if (await suggested.isVisible() && loose(await suggested.innerText()) === loose(`Move to ${target}`)) {
        await suggested.click();
        return;
    }
    await dropdown.click({ timeout: 10_000 });
    const option = page.getByRole('menuitem', { name: target, exact: true }).filter({ visible: true }).first();
    if (!await option.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
        const options = (await page.getByRole('menuitem').filter({ visible: true }).allInnerTexts().catch(() => [] as string[]))
            .map(t => norm(t)).filter(Boolean);
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        throw new Error(`"${target}" not offered in Process Order (offered: ${options.join(', ') || 'none'})`);
    }
    await option.click();
}

/**
 * Process Order → Move to… → `target`, as in specs 11 and 13. Retried once: an order can
 * move itself (e.g. to TIER 1 EXCEPTION after a document upload) just as the move is made.
 */
async function moveTo(page: Page, orderId: string, target: string, queue?: { route: string; customerNumber: string }) {
    for (let attempt = 1; ; attempt++) {
        if (queue) {
            // From the queue grid: row Actions → Process Order (as spec 13 does for ABS ASSIGNED / ABS CONFIRMED).
            const row = await queueRow(page, queue.route, queue.customerNumber);
            await row.locator('button[aria-label="Actions"]').first().click({ timeout: 15_000 });
            await page.locator('button:has-text("Process Order")').first().click({ timeout: 15_000 })
                .catch(() => { throw new Error(`no "Process Order" in the row's Actions menu (${queue.route})`); });
        } else {
            await openOrder(page, orderId);
            await page.locator('button[mattooltip="Process Order"]').click({ timeout: 15_000 })
                .catch(() => { throw new Error('"Process Order" button not shown on the order page'); });
        }
        await chooseMoveTarget(page, target);
        if (await errorToast(page).isVisible({ timeout: 2_000 }).catch(() => false)) {
            throw new Error(`error toast — "${norm(await errorToast(page).innerText().catch(() => ''))}"`);
        }
        try {
            await expectStatus(page, orderId, target);
            return;
        } catch (err) {
            if (attempt >= 2) throw err;
        }
    }
}

/** Search Details (searched from/through today, marketable) — prerequisite in specs 11 and 13. */
async function saveSearchDetails(page: Page, orderId: string) {
    await openOrder(page, orderId);
    const tab = page.locator('li[class="ng-star-inserted"]').nth(3);
    await tab.waitFor({ state: 'visible', timeout: 30_000 });
    await tab.click();

    const calendars = page.locator('button[aria-label="Open calendar"]');
    await calendars.nth(1).waitFor({ state: 'visible', timeout: 20_000 });
    for (const i of [0, 1]) {
        await calendars.nth(i).click();
        await page.locator('.mat-calendar-body-today').click();
        await page.locator('.mat-calendar').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => { });
    }
    await page.locator('input[class="mdc-radio__native-control"]').nth(0).click();

    await actAndSettle(page, () => page.getByRole('button', { name: 'Save' }).click());
    if (await errorToast(page).isVisible({ timeout: 1_000 }).catch(() => false)) {
        throw new Error(`Search Details not saved — "${norm(await errorToast(page).innerText().catch(() => ''))}"`);
    }
    const saved = await page.locator('span.toast-message').first().waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true).catch(() => false);
    if (!saved) throw new Error('Search Details not saved — no confirmation toast after Save');
}

// ---------------------------------------------------------------------------
// Verifications (same checks as specs 11, 12 and 13)
// ---------------------------------------------------------------------------

/** The order is listed in a queue grid, searched by its customer number (spec 13 inQueueGrid). */
async function expectInQueue(page: Page, route: string, o: Order, queue: string) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const search = page.locator('input[placeholder="Search keyword"]');
    await search.waitFor({ state: 'visible', timeout: 30_000 });
    await search.fill(o.customerNumber);

    // Wait for the filtered row itself rather than a fixed pause.
    const row = page.locator('.ag-row').filter({ hasText: new RegExp(`\\b${o.customerNumber}\\b`) });
    if (await row.first().waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) return;
    const count = parseInt((await page.locator('span[ref="lbRecordCount"]').innerText().catch(() => '')).replace(/[^\d]/g, ''), 10) || 0;
    if (count === 0) throw new Error(`not found in the ${queue} queue`);
}

/** History shows Order Status from → to (spec 13 historyShows). */
async function expectHistory(page: Page, o: Order, from: string, to: string) {
    await openOrder(page, o.orderId);
    await page.locator('button[mattooltip="History"]').click();
    await page.waitForSelector('.ag-center-cols-container');
    const row = page.locator('.ag-center-cols-container div[role="row"]')
        .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
        .filter({ has: page.locator('[col-id="previousValue"]', { hasText: new RegExp(`^${from}$`) }) })
        .filter({ has: page.locator('[col-id="newValue"]', { hasText: new RegExp(`^${to}$`) }) });
    const ok = await row.first().waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false);
    await page.locator('i[class="ri-close-fill"]').click().catch(() => { });
    if (!ok) throw new Error(`History does not show ${from} → ${to}`);
}

/** A generated document is listed on the order's Documents tab (spec 12 DocGen check). */
async function expectDocument(page: Page, o: Order, name: string) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        await page.goto(`${Q}/orders/${o.orderId}/documents`, { waitUntil: 'domcontentloaded' });
        if (await page.locator('a.name-link', { hasText: name }).first()
            .waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) return;
        await page.waitForTimeout(5_000);
    }
    throw new Error(`"${name}" not generated`);
}

/** Uploads KEYING_DOCS on the Documents tab and waits for the upload request to succeed (spec 11). */
async function uploadDocuments(page: Page, o: Order) {
    const files = KEYING_DOCS.map(f => path.resolve('Documents', f));
    const missing = files.filter(f => !fs.existsSync(f));
    if (missing.length) throw new Error(`document not found: ${missing.join(', ')}`);

    await page.goto(`${Q}/orders/${o.orderId}/documents`, { waitUntil: 'domcontentloaded' });
    const add = page.locator('button[aria-label="Add"]');
    await add.waitFor({ state: 'visible', timeout: 30_000 });
    await add.click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.waitFor({ state: 'attached', timeout: 10_000 });
    await fileInput.setInputFiles(files);
    await page.waitForTimeout(500);

    for (let i = 0; i < files.length; i++) {
        await page.locator('[aria-haspopup="listbox"]').nth(i).click();
        await page.locator('[role="option"]').nth(i + 1).click({ timeout: 5_000 });
        await page.locator('[role="listbox"]').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => { });
    }

    const upload = page.getByRole('button', { name: 'Upload' });
    await upload.waitFor({ state: 'visible', timeout: 5_000 });
    if (!await upload.isEnabled()) throw new Error('Upload button stayed disabled');
    const uploaded = page.waitForResponse(r =>
        r.url().includes('/documents') && r.request().method() === 'POST' && r.status() === 200, { timeout: 60_000 });
    await upload.click();
    await uploaded.catch(() => { throw new Error('document upload request did not succeed'); });

    await add.waitFor({ state: 'visible', timeout: 15_000 });
    const rows = page.locator('.ag-center-cols-container .ag-row');
    await rows.first().waitFor({ state: 'visible', timeout: 10_000 });
    if (await rows.count() < files.length) throw new Error(`only ${await rows.count()} of ${files.length} documents listed`);
}

async function openKeying(page: Page, orderId: string) {
    await openOrder(page, orderId);
    await page.getByRole('link', { name: 'keyboard Keying' }).click();
    await page.waitForURL(/\/orders\/\d+\/keying/, { timeout: 30_000 });
    await page.locator('#clientId').waitFor({ state: 'visible', timeout: 30_000 }).catch(() => { });
    await page.waitForTimeout(500);
}

/** Keying page opens and carries the order's client, customer number and product type (spec 11). */
async function expectKeyingFields(page: Page, o: Order) {
    await openKeying(page, o.orderId);
    const selectText = (id: string) => page.locator(`#${id} .mat-mdc-select-value-text .mat-mdc-select-min-line`).textContent().catch(() => '');
    const checks: [string, string, string | null][] = [
        ['Client', o.client, await selectText('clientId')],
        ['Customer Order #', o.customerNumber, await page.locator('#customerOrderNumber').inputValue().catch(() => '')],
        ['Product', o.productType, await selectText('productTypeId')],
    ];
    const wrong = checks.filter(([, expected, actual]) => loose(expected) !== loose(actual ?? ''));
    if (wrong.length) {
        throw new Error(`keyed fields differ — ${wrong.map(([f, e, a]) => `${f}: expected "${e}", got "${(a ?? '').trim()}"`).join('; ')}`);
    }
}

// ---------------------------------------------------------------------------
// Keying form (spec 12). Fields are best-effort because keying sections differ by
// client and product; Complete then decides whether the form was sufficient.
// ---------------------------------------------------------------------------

/**
 * A field the client/product form doesn't have is skipped at once. Waiting the full
 * timeout for each absent field cost minutes per order.
 */
const present = async (page: Page, selector: string, nth: number) =>
    await page.locator(selector).count() > nth && await page.locator(selector).nth(nth).isVisible().catch(() => false);

const fill = async (page: Page, selector: string, value: string, nth = 0) => {
    if (!await present(page, selector, nth)) return;
    await page.locator(selector).nth(nth).fill(value, soft).catch(() => { });
};

const choose = async (page: Page, selector: string, option: number, nth = 0) => {
    if (!await present(page, selector, nth)) return;
    if (!await page.locator(selector).nth(nth).click(soft).then(() => true).catch(() => false)) return;
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(option).click(soft).catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(300);
};

const today = async (page: Page, calendar: number) => {
    if (!await present(page, 'button[aria-label="Open calendar"]', calendar)) return;
    if (!await page.locator('button[aria-label="Open calendar"]').nth(calendar).click(soft).then(() => true).catch(() => false)) return;
    await page.locator('.mat-calendar-body-today').click(soft).catch(() => page.keyboard.press('Escape'));
};

const amount = () => faker.finance.amount({ min: 1000, max: 10000, dec: 2 });
const sixDigits = () => faker.number.int({ min: 100000, max: 999999 }).toString();

/** Visible keying controls that are still invalid (required and empty), tagged for `fillRequiredEmpty`. */
async function invalidControls(page: Page): Promise<string[]> {
    // Clear tags from an earlier call so an index never matches two fields.
    await page.evaluate(() => document.querySelectorAll('[data-auto-req]').forEach(e => e.removeAttribute('data-auto-req')));
    return page.locator('input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid').evaluateAll(els =>
        els.filter(e => (e as HTMLElement).offsetParent !== null).map((e, i) => {
            e.setAttribute('data-auto-req', String(i));
            const field = e.closest('[data-field-key], mat-form-field');
            const label = field?.querySelector('mat-label, label')?.textContent?.trim()
                || field?.getAttribute('data-field-key') || e.getAttribute('formcontrolname') || e.id || '?';
            return label.replace(/\s*\*\s*$/, '');
        }));
}

/**
 * Fills whatever required field the client/product form still has empty after the
 * standard fill. Covius and LoanCare forms are already complete, so this only acts on
 * forms with extra required fields (First American).
 */
async function fillRequiredEmpty(page: Page) {
    const labels = await invalidControls(page);
    for (let i = 0; i < labels.length; i++) {
        const el = page.locator(`[data-auto-req="${i}"]`);
        const tag = await el.evaluate(e => e.tagName.toLowerCase()).catch(() => '');
        if (!tag) continue;
        if (tag === 'mat-select') {
            if (!await el.click(soft).then(() => true).catch(() => false)) continue;
            await page.locator('.mat-mdc-select-panel').last().getByRole('option').first().click(soft)
                .catch(() => page.keyboard.press('Escape'));
            await page.waitForTimeout(300);
            continue;
        }
        const field = el.locator('xpath=ancestor::mat-form-field[1]');
        const calendar = field.locator('button[aria-label="Open calendar"]');
        if (await calendar.count() > 0) {
            await calendar.first().click(soft).catch(() => { });
            await page.locator('.mat-calendar-body-today').click(soft).catch(() => page.keyboard.press('Escape'));
            continue;
        }
        const type = await el.getAttribute('type').catch(() => '');
        const isDate = await el.evaluate(e => e.classList.contains('mat-datepicker-input') || /date/i.test(e.getAttribute('formcontrolname') ?? ''))
            .catch(() => false);
        await el.fill(isDate ? todayText() : type === 'number' ? '1000' : 'Automation', soft).catch(() => { });
    }
}

/**
 * Clicks Complete and answers what follows until the app sends PATCH /api/keying/<id>/complete:
 * "Yes" on Incomplete Tagging, then (in QUALITY CHECK) "Confirm" on the Changed Fields panel, which
 * the app shows only after it has saved the form, often more than 5s later. Returns that response,
 * or null if it never came (with the error toast, if one showed). Callers must not navigate away
 * before this returns: leaving the keying page cancels the Complete.
 */
async function clickCompleteAndConfirm(page: Page, timeoutMs = 120_000): Promise<{ resp: Response | null; toast: string }> {
    let resp: Response | null | undefined;
    page.waitForResponse(r => /\/api\/keying\/\d+\/complete$/.test(r.url()) && r.request().method() === 'PATCH', { timeout: timeoutMs })
        .then(r => { resp = r; }, () => { resp = null; });

    await page.locator('button[mattooltip="Complete"]').click({ timeout: 15_000 });
    const yes = page.getByRole('button', { name: 'Yes', exact: true }).filter({ visible: true }).first();
    const confirm = page.getByRole('button', { name: 'Confirm', exact: true }).filter({ visible: true }).first();
    let toast = '';
    while (resp === undefined) {
        if (await yes.isVisible().catch(() => false)) await yes.click(soft).catch(() => { });
        if (await confirm.isVisible().catch(() => false)) await confirm.click(soft).catch(() => { });
        if (await errorToast(page).isVisible().catch(() => false)) {
            toast = norm(await errorToast(page).innerText({ timeout: 1_000 }).catch(() => ''));
            break;
        }
        await page.waitForTimeout(1_000);
    }
    return { resp: resp ?? null, toast };
}

/**
 * Save, then Complete with its Yes / Confirm prompts. Returns why Complete may have been refused
 * (error toast, failed or missing complete request, required fields still empty), or '' when it went through.
 */
async function saveAndComplete(page: Page): Promise<string> {
    await page.locator('button[mattooltip="Save"]').click(soft).catch(() => { });
    await page.waitForTimeout(1500);
    const { resp, toast } = await clickCompleteAndConfirm(page);
    if (resp?.ok()) return '';

    const missing = await invalidControls(page).catch(() => [] as string[]);
    const request = resp ? `complete request HTTP ${resp.status()} ${(await resp.text().catch(() => '')).slice(0, 150)}`
        : !toast ? 'complete request never sent (Confirm on Changed Fields not reached)' : '';
    return [toast && `toast "${toast}"`, request, missing.length && `required: ${[...new Set(missing)].join(', ')}`]
        .filter(Boolean).join('; ');
}

/** Completes keying and expects the next status, naming what blocked Complete if it didn't move. */
async function completeTo(page: Page, o: Order, status: string, timeoutMs = 30_000) {
    const why = await saveAndComplete(page);
    try {
        await expectStatus(page, o.orderId, status, timeoutMs);
    } catch (err) {
        throw new Error(why ? `Complete refused — ${why}` : (err as Error).message);
    }
}

async function fillKeying(page: Page) {
    // Tax Information
    await fill(page, 'div[data-field-key="tax_Year_TAI"] input', '2025');
    await choose(page, 'div[data-field-key="state_TAI"]', 1);
    await choose(page, 'div[data-field-key="county_TAI"]', 4);
    await fill(page, '#fullAmountDue_TAI', '900.26');
    await fill(page, '#tax_Entity', '202558');
    await choose(page, 'div[data-field-key="tax_Type"]', 2);
    await choose(page, 'div[data-field-key="payment_Frequency_TAI"]', 1);
    await fill(page, '#court_Type_TAI', 'United States');
    await fill(page, '#court_District_TAI', 'SDNY');
    await fill(page, 'div[data-field-key="installment_TAI"] input', amount());
    for (const c of [4, 5, 6, 7]) await today(page, c);           // Paid / Due / Delinquent / Partially Paid
    await choose(page, 'div[data-field-key="status_TAI"]', 2);
    await fill(page, 'div[data-field-key="comment_TAI"] textarea', 'All Details filled');
    await choose(page, 'div[class="col-sm-4 form-field"]', 1, 0); // Document
    await fill(page, 'div[class="col-sm-4 form-field"] input', '1', 0);

    // Assessment Information
    await fill(page, 'div[data-field-key="land"] input', amount());
    await fill(page, 'div[data-field-key="building"] input', amount());
    await fill(page, 'div[data-field-key="total"] input', amount());
    await fill(page, 'div[data-field-key="exemption"] input', amount());
    await fill(page, 'div[data-field-key="parcel_ID_Tax_ID_APN"] input', sixDigits());
    await choose(page, 'div[data-field-key="mobile_Home"]', 0);
    await fill(page, 'div[data-field-key="mobile_Home_ID"] input', sixDigits());
    await choose(page, 'div[data-field-key="hOA_Found"]', 0);
    await fill(page, 'div[data-field-key="hOA_Name"] input', faker.company.name());
    await fill(page, 'div[data-field-key="hOA_Agent"] input', faker.person.fullName());
    await fill(page, 'div[data-field-key="hOA_Address"] input', faker.location.streetAddress());
    await fill(page, 'div[data-field-key="hOA_Phone_Contact"] input', faker.phone.number());
    await fill(page, 'div[data-field-key="hOA_Email_Contact"] input', faker.internet.email());
    await choose(page, 'div[data-field-key="document_Name_AI"]', 2);
    await fill(page, 'div[data-field-key="doc_Range_AI"] input', '1');

    // Vesting Chain
    await choose(page, 'div[data-field-key="deed_Type_VI"]', 2);
    await fill(page, 'div[data-field-key="consideration_VI"] input', amount());
    await fill(page, 'div[data-field-key="grantor_VI"] input', faker.person.fullName());
    await fill(page, 'div[data-field-key="grantee_VI"] input', faker.person.fullName());
    await today(page, 8);                                          // Instrument Date
    await today(page, 9);                                          // Recorded Date
    await fill(page, 'div[data-field-key="recorded_Book_VI"] input', sixDigits());
    await fill(page, 'div[data-field-key="recorded_Page_VI"] input', sixDigits());
    await fill(page, 'div[data-field-key="recorded_Instrument_Number_Document_Number_VI"] input', sixDigits());
    await choose(page, 'div[class="col-sm-4 form-field"]', 3, 2); // Document
    await fill(page, 'div[class="col-sm-4 form-field"] input', '1', 1);
}

async function fillQcKeying(page: Page) {
    // Security Instrument Chain of Title
    await choose(page, 'div[data-field-key="instrument_Name_SI"]', 2);
    await fill(page, 'div[data-field-key="borrower_SI"] input', faker.person.fullName());
    await choose(page, 'div[data-field-key="beneficiary_MERS_Ind_SI"]', 0);
    await fill(page, 'div[data-field-key="beneficiary_SI"] input', faker.person.fullName());
    await today(page, 14);
    await choose(page, 'div[data-field-key="assignor_MERS_Ind_SI"]', 0);
    await fill(page, 'div[data-field-key="assignor_SI"] input', faker.person.fullName());
    await choose(page, 'div[data-field-key="assignee_MERS_Ind_SI"]', 0);
    await fill(page, 'div[data-field-key="assignee_SI"] input', faker.person.fullName());
    await today(page, 15);
    await fill(page, 'div[data-field-key="recorded_Book_SI"] input', '123456');
    await fill(page, 'div[data-field-key="recorded_Page_SI"] input', '584');
    await fill(page, 'div[data-field-key="consideration_Amount_SI"] input', '2500.25');
    await choose(page, 'div[class="col-sm-4 form-field"]', 4, 6); // Document
    await fill(page, 'div[class="col-sm-4 form-field"] input', '1', 3);

    // Liens (Judgments, Federal/State Tax Liens, Lis Pendens, etc.)
    await choose(page, 'div[data-field-key="document_Name_LI"]', 3);
    await today(page, 22);
    await today(page, 23);
    await fill(page, 'div[data-field-key="amount_LI"] input', '2500.25');
    await fill(page, 'div[data-field-key="case_Number_LI"] input', sixDigits());
    await choose(page, 'div[data-field-key="source"]', 2);         // Legal Description
    await fill(page, 'div[data-field-key="recorded_Book"] input', '65214');
    await fill(page, 'div[data-field-key="recorded_Page"] input', '584');
    await choose(page, 'div[data-field-key="document_Name_LD"]', 5);
    await fill(page, 'div[data-field-key="doc_Range_LD"] input', '1');
}

/** Assign ABS panel from spec 13 (fee, INDEX.pdf, abstractor, no email). */
async function assignAbs(page: Page, orderId: string) {
    await openOrder(page, orderId);
    await page.getByRole('link', { name: ' Quotes & Assigned ABS ' }).click();
    await page.locator('button[aria-label="Assign ABS"]').click({ timeout: 20_000 });
    await page.locator('input[formcontrolname="abstractorFee"]').fill('1000.25');

    const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('[formcontrolname="attachments"]').click(),
    ]);
    await fileChooser.setFiles([path.resolve('Documents/INDEX.pdf')]);
    await page.locator('button:has-text("Submit")').click();

    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(3).click();
    await page.getByRole('option', { name: ABSTRACTOR }).click();
    await page.uncheck('[formcontrolname="isEmailNotification"] input');
    await actAndSettle(page, () => page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-unthemed"]').nth(1).click());
}

/** Cells of the (already filtered) queue grid's first row match, e.g. client and abstractor (spec 13). */
async function expectQueueDetails(page: Page, queue: string, checks: [colId: string, expected: string][]) {
    const wrong: string[] = [];
    for (const [colId, expected] of checks) {
        const actual = (await page.locator(`div[col-id="${colId}"]`).nth(1).innerText({ timeout: 10_000 }).catch(() => '')).trim();
        if (loose(actual) !== loose(expected)) wrong.push(`${colId}: expected "${expected}", got "${actual}"`);
    }
    if (wrong.length) throw new Error(`${queue} grid details differ — ${wrong.join('; ')}`);
}

/**
 * Quality Check queue → Actions → Reject (2nd menu item) with severity, three issue
 * types and a note, as in spec 13. The order moves to ABS REJECTS.
 */
async function rejectToAbs(page: Page, o: Order) {
    const row = await queueRow(page, `${Q}/quality-control/quality-check`, o.customerNumber);
    await row.locator('button[aria-label="Actions"]').first().click();
    await page.locator('span[class="menu-label"]').nth(1).click({ timeout: 10_000 });
    await page.locator('textarea[formcontrolname="note"]').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(1).click();      // Severity
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(2).click();      // Issue Type (multi)
    for (const i of [1, 2, 3]) await page.locator('span[class="mdc-list-item__primary-text"]').nth(i).click();
    await page.keyboard.press('Tab');
    await page.locator('textarea[formcontrolname="note"]').fill('Testing Reject Order');
    await actAndSettle(page, () => page.locator('button:has-text("Submit")').click());
    if (await errorToast(page).isVisible({ timeout: 1_000 }).catch(() => false)) {
        throw new Error(`reject refused — "${norm(await errorToast(page).innerText().catch(() => ''))}"`);
    }
}

/** Quotes & Assigned ABS → Quotes Request to QUOTE_ABSTRACTOR (spec 13, second pass). */
async function requestQuote(page: Page, orderId: string) {
    await openOrder(page, orderId);
    await page.getByRole('link', { name: ' Quotes & Assigned ABS ' }).click();
    await page.locator('button[aria-label="Quotes Request"]').click({ timeout: 20_000 });
    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(2).waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('div[class="mat-mdc-form-field-flex"]').nth(2).click();
    await page.getByRole('option', { name: QUOTE_ABSTRACTOR }).click();
    await page.keyboard.press('Tab');
    await actAndSettle(page, () => page.locator('button:has-text("Submit")').click());
}

/** Edits the received quote (amount, ETA, received date), then Assign without the email (spec 13). */
async function assignQuote(page: Page, orderId: string) {
    // Each click names itself, so a failure says which part of the quote assignment stopped.
    const step = <T>(what: string, run: () => Promise<T>) =>
        run().catch(err => { throw new Error(`${what}: ${(err as Error).message.split('\n')[0]}`); });

    await openOrder(page, orderId);
    await step('Quotes & Assigned ABS tab', () => page.getByRole('link', { name: ' Quotes & Assigned ABS ' }).click());
    // The quote abstractor's own row (the first pass's abstractor row is also listed, as "Assigned").
    const row = page.locator('.ag-center-cols-container .ag-row').filter({ hasText: QUOTE_ABSTRACTOR }).first();
    await step(`${QUOTE_ABSTRACTOR} quote row`, () => row.waitFor({ state: 'visible', timeout: 30_000 }));
    const idx = await row.getAttribute('row-index');
    const actions = page.locator(`.ag-row[row-index="${idx}"] button[aria-label="Actions"]`).filter({ visible: true }).first();
    await step('quote row Actions', () => actions.click({ timeout: 20_000 }));
    await step('Edit in quote Actions menu', () => page.getByRole('menuitem', { name: /Edit/ }).filter({ visible: true }).first().click());
    await step('quote amount', () => page.locator('input[formcontrolname="quote"]').fill('1000.25'));
    await today(page, 0);                                                              // ETA
    await today(page, 1);                                                              // Received Date
    await step('quote Submit', () => actAndSettle(page, () => page.locator('button:has-text("Submit")').filter({ visible: true }).first().click()));
    await step('"Assign" link (shown once the quote is saved)', () => actAndSettle(page, async () => {
        await page.getByRole('link', { name: 'Assign', exact: true }).filter({ visible: true }).first().click();
        await page.locator('button:has-text("Cancel")').filter({ visible: true }).first().click({ timeout: 10_000 }); // skip the assignment email
    }));
}

// ---------------------------------------------------------------------------
// Fee Increase / Search Inquiry helpers (spec 15). Both span the internal and the
// customer portal; the client half runs in its own browser context.
// ---------------------------------------------------------------------------

const INTERNAL_FEE_QUEUE = `${Q}/customer-support/fee-increase`;
const CUSTOMER_FEE_QUEUE = '/app/customer/research/hold/fee-change-request';
const INTERNAL_SI_QUEUE = `${Q}/customer-support/search-inquiries`;
const CUSTOMER_SI_QUEUE = '/app/customer/research/hold/search-inquiries';

/** Microsoft Entra sign-in, as in spec 15. */
async function signIn(p: Page, base: string, user: string, pass: string) {
    await p.goto(base || '/');
    await p.locator('input[name="username"]').fill(user);
    await p.locator('button[type="submit"]').click();
    await p.locator('input[name="passwd"]').fill(pass);
    await p.locator('button[type="submit"]').click();
    await p.locator('[type="submit"]').click({ timeout: 15_000 }).catch(() => { });
    await p.waitForURL(/\/app(\/|$)/, { timeout: 60_000 }).catch(() => { });
}

/**
 * Runs `fn` on a page signed in as the Test Company client. Each lane signs in once and
 * reuses its session (signing in for every order was the slowest step); lanes never share one.
 */
async function asClient(ctx: Ctx, fn: (p: Page) => Promise<void>) {
    const user = process.env.LoGIN_UsernameClient || '';
    const pass = process.env.LoGIN_PasswordClient || '';
    if (!user || !pass) throw new Error('LoGIN_UsernameClient / LoGIN_PasswordClient are not set in .env');
    if (!ctx.client || ctx.client.isClosed()) {
        const context = await ctx.browser.newContext({ storageState: undefined, baseURL: ctx.base || undefined, viewport: ctx.viewport });
        ctx.client = await context.newPage();
        await ctx.client.route('**/*intelliabot.com/**', route => route.abort());
        await signIn(ctx.client, ctx.base, user, pass);
    }
    const client = ctx.client;
    try {
        await fn(client);
    } catch (err) {
        // Start the next order with a fresh session in case this one went bad.
        await client.context().close().catch(() => { });
        ctx.client = null;
        throw err;
    }
}

/**
 * Opens a queue filtered to one order and returns the full row. Pinned columns live in
 * separate .ag-row elements sharing a row-index, so the row is re-selected by index.
 */
async function queueRow(p: Page, route: string, orderId: string): Promise<Locator> {
    for (let attempt = 1; attempt <= 2; attempt++) {
        await p.goto(route);
        const search = p.locator('input[placeholder="Search keyword"]');
        await search.waitFor({ state: 'visible', timeout: 30_000 });
        await search.fill(orderId);
        // The grid re-renders once the filtered data arrives; acting before that hits a stale row.
        await p.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { });
        await p.waitForTimeout(500);
        const centre = p.locator('.ag-row').filter({ hasText: new RegExp(`\\b${orderId}\\b`) }).first();
        if (await centre.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
            const idx = await centre.getAttribute('row-index');
            return idx !== null ? p.locator(`.ag-row[row-index="${idx}"]`) : centre;
        }
        // Some grids (Quality Check) don't render the number's column. The search has
        // already filtered the grid, so exactly one record is this order (as in spec 13).
        const count = parseInt((await p.locator('span[ref="lbRecordCount"]').innerText().catch(() => '')).replace(/[^\d]/g, ''), 10) || 0;
        if (count === 1) return p.locator('.ag-row[row-index="0"]');
    }
    throw new Error(`order ${orderId} not in ${route}`);
}

const inquiryStatus = async (row: Locator) =>
    (await row.locator('[col-id="inquiryStatus"]').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();

/** Actions → `label`, retried when the menu closes because the grid re-rendered. */
async function rowAction(p: Page, row: Locator, label: string) {
    const item = p.locator('span[class="menu-label"]', { hasText: label }).first();
    for (let attempt = 1; attempt <= 3; attempt++) {
        await row.locator('button[aria-label="Actions"]').first().click();
        if (await item.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)) {
            await item.click();
            return;
        }
        await p.keyboard.press('Escape');
        await p.waitForTimeout(1_000);
    }
    throw new Error(`"${label}" not in the row's Actions menu`);
}

/** Inquiry status on the order's own tab (fee-change-request / search-inquiries). */
async function orderInquiryStatus(page: Page, orderId: string, tab: string) {
    await page.goto(`${Q}/orders/${orderId}/${tab}`, { waitUntil: 'domcontentloaded' });
    await page.locator('.ag-row [col-id="inquiryStatus"]').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => { });
    await page.waitForTimeout(1_000);
    return (await page.locator('.ag-row [col-id="inquiryStatus"]').first().innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
}

/** Re-reads an inquiry status until it is `expected`; the other portal syncs with a delay. */
async function waitForInquiryStatus(read: () => Promise<string>, expected: string, what: string, timeoutMs = 45_000) {
    const deadline = Date.now() + timeoutMs;
    let status = '';
    while (Date.now() < deadline) {
        status = await read().catch(() => '');
        if (status === expected) return;
        await new Promise(r => setTimeout(r, 3_000));
    }
    throw new Error(`${what} status is "${status}", expected "${expected}"`);
}

/**
 * Chooses from a mat-select inside a popup form and confirms it took. Multi-selects
 * stay open and are closed with Tab — Escape would dismiss the whole popup.
 */
async function popupSelect(page: Page, form: Locator, control: string, count = 1, multiple = false) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        await form.locator(`mat-select[formcontrolname="${control}"]`).click();
        const panel = page.locator('.mat-mdc-select-panel').last();
        await panel.waitFor({ state: 'visible', timeout: 20_000 });
        const options = panel.getByRole('option');
        const n = Math.min(count, await options.count());
        for (let i = 0; i < n; i++) await options.nth(i).click();
        if (multiple) await page.keyboard.press('Tab');
        await panel.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => { });
        const value = (await form.locator(`mat-select[formcontrolname="${control}"] .mat-mdc-select-value`).innerText().catch(() => '')).trim();
        if (value) return;
    }
    throw new Error(`${control} could not be selected`);
}

/** Submits a popup form and waits for the given POST to succeed. */
async function submitAndExpect(page: Page, form: Locator, urlPattern: RegExp, what: string) {
    const [resp] = await Promise.all([
        page.waitForResponse(r => urlPattern.test(r.url()) && r.request().method() === 'POST', { timeout: 60_000 }),
        form.getByRole('button', { name: 'Submit', exact: true }).first().click(),
    ]);
    if (!resp.ok()) throw new Error(`${what} rejected (HTTP ${resp.status()})`);
}

/** Clicks a row action and waits for the inquiry-status PATCH it sends. */
async function actionAndPatch(p: Page, act: () => Promise<void>, what: string) {
    const [resp] = await Promise.all([
        p.waitForResponse(r => /\/inquiries\/\d+\/status$/.test(r.url()) && r.request().method() === 'PATCH', { timeout: 60_000 }),
        act(),
    ]);
    if (!resp.ok()) throw new Error(`${what} rejected (HTTP ${resp.status()})`);
}

// ---------------------------------------------------------------------------
// AI Extraction helpers (from AI.spec.ts)
// ---------------------------------------------------------------------------

/** isVisible() never waits, so every "is it there" check here uses waitFor(). */
const shown = (l: Locator, ms: number) => l.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);

async function waitForSpinner(page: Page, timeoutMs = 60_000) {
    await page.waitForTimeout(200);
    await page.locator('ngx-spinner .ngx-spinner-overlay').first().waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => { });
}

/** The live status, read on the lane's hidden status page — the working page is left where it is. */
async function liveStatus(ctx: Ctx, orderId: string): Promise<string> {
    if (!ctx.status) return readStatus(ctx.page, orderId);
    await openOrder(ctx.status, orderId);
    await waitForSpinner(ctx.status);
    return norm(await ctx.status.locator('span.badge.text-soft-dark').first().innerText({ timeout: 10_000 }).catch(() => ''));
}

async function expectLiveStatus(ctx: Ctx, orderId: string, target: string, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    let current = await liveStatus(ctx, orderId);
    while (current !== target && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2_000));
        current = await liveStatus(ctx, orderId);
    }
    if (current !== target) throw new Error(`expected status "${target}" but it is "${current}"`);
}

/** Search Details for AI orders: as `saveSearchDetails`, plus Number of Names and any other required field. */
async function saveAiSearchDetails(page: Page, orderId: string) {
    await openOrder(page, orderId);
    await waitForSpinner(page);
    const click = (l: Locator, what: string) => l.click({ timeout: 15_000 })
        .catch(() => { throw new Error(`Search Details: could not click ${what}`); });
    const tab = page.locator('li').filter({ hasText: /Search Details/i }).first();
    await click(await shown(tab, 5_000) ? tab : page.locator('li[class="ng-star-inserted"]').nth(3), 'the Search Details tab');
    await waitForSpinner(page);
    await click(page.locator('button[aria-label="Open calendar"]').nth(0), 'Searched From calendar');
    await click(page.locator('.mat-calendar-body-today'), 'today (Searched From)');
    await click(page.locator('button[aria-label="Open calendar"]').nth(1), 'Searched Through calendar');
    await click(page.locator('.mat-calendar-body-today'), 'today (Searched Through)');
    await click(page.locator('input[class="mdc-radio__native-control"]').nth(0), 'Does Exceed Marketable Title');
    const names = page.locator('mat-form-field').filter({ hasText: /Number of Names/i }).locator('input').first();
    if (await shown(names, 2_000)) await names.fill('1');
    await fillRequiredEmpty(page);
    const missing = [...new Set(await invalidControls(page))];
    if (missing.length) throw new Error(`Search Details required fields still empty: ${missing.join(', ')}`);
    await actAndSettle(page, () => page.getByRole('button', { name: 'Save' }).click());
}

/** Documents tab → Add → the AI documents (document type is set automatically) → Upload. */
async function uploadAiDocuments(page: Page, o: Order) {
    const files = AI_DOCS.map(f => path.resolve('Documents', f));
    const missing = files.filter(f => !fs.existsSync(f));
    if (missing.length) throw new Error(`document not found: ${missing.join(', ')}`);
    await page.goto(`${Q}/orders/${o.orderId}/documents`, { waitUntil: 'domcontentloaded' });
    const add = page.locator('button[aria-label="Add"]');
    await add.waitFor({ state: 'visible', timeout: 30_000 });
    await add.click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.waitFor({ state: 'attached', timeout: 10_000 });
    await fileInput.setInputFiles(files);
    const upload = page.getByRole('button', { name: 'Upload' });
    await upload.waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(1_000);                                   // document types auto-fill
    if (!await upload.isEnabled()) throw new Error('Upload button stayed disabled');
    const uploaded = page.waitForResponse(r =>
        r.url().includes('/documents') && r.request().method() === 'POST' && r.status() === 200, { timeout: 60_000 });
    await upload.click();
    await uploaded.catch(() => { throw new Error('document upload request did not succeed'); });
    await add.waitFor({ state: 'visible', timeout: 15_000 });
    const rows = page.locator('.ag-center-cols-container .ag-row');
    await rows.first().waitFor({ state: 'visible', timeout: 10_000 });
    if (await rows.count() < files.length) throw new Error(`only ${await rows.count()} of ${files.length} documents listed`);
}

/** Process Order → `target` (listed directly or under "Move to..."), with retries. Does not wait for the status. */
async function processOrder(page: Page, orderId: string, target: string) {
    await openOrder(page, orderId);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => { });
    await waitForSpinner(page);
    const button = page.locator('button[mattooltip="Process Order"]').first();
    // The Process Order dialog: split button "Move to <NEXT>" + ▾, or a single "Move to..." button.
    const dialog = page.locator('button.split-button-left, button.split-button-right, button.move-to-button, button:has-text("Move to...")')
        .filter({ visible: true }).first();
    for (let i = 1; i <= 3; i++) {
        await button.click({ timeout: 20_000 })
            .catch(() => { throw new Error(`Process Order button not available (moving to ${target})`); });
        await waitForSpinner(page);
        if (await shown(dialog, 5_000)) break;
        if (i === 3) throw new Error(`Process Order opened no dialog (moving to ${target})`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1_500);
    }
    await chooseMoveTarget(page, target);
    await waitForSpinner(page);
    await page.locator('button:has-text("Confirm"), button:has-text("Yes")').first().click({ timeout: 2_000 }).catch(() => { });
    if (await shown(errorToast(page), 2_000)) {
        throw new Error(`error toast — "${norm(await errorToast(page).innerText().catch(() => ''))}"`);
    }
}

/** Latest `extractedMetadata` scores returned by the keying API, per lane page (field key → confidence %). */
const aiMetadata = new WeakMap<Page, Map<string, number>>();
const safeJson = (s: string) => { try { return JSON.parse(s); } catch { return null; } };

/** Collects every { key, confidence } pair found under an `extractedMetadata` property, whatever its shape. */
function readConfidence(json: unknown): Map<string, number> {
    const out = new Map<string, number>();
    const pct = (v: number) => (v <= 1 ? v * 100 : v);
    const walkMeta = (node: unknown, keyHint = '') => {
        if (Array.isArray(node)) { node.forEach(n => walkMeta(n, keyHint)); return; }
        if (!node || typeof node !== 'object') return;
        const obj = node as Record<string, unknown>;
        const scoreKey = Object.keys(obj).find(k => /confidence|score/i.test(k) && typeof obj[k] === 'number');
        const nameKey = Object.keys(obj).find(k => /^(fieldKey|key|field|fieldName|name|path)$/i.test(k) && typeof obj[k] === 'string');
        if (scoreKey && (nameKey || keyHint)) out.set(String(nameKey ? obj[nameKey] : keyHint), pct(obj[scoreKey] as number));
        for (const [k, v] of Object.entries(obj)) if (v && typeof v === 'object') walkMeta(v, k);
    };
    const find = (node: unknown) => {
        if (Array.isArray(node)) { node.forEach(find); return; }
        if (!node || typeof node !== 'object') return;
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
            if (/^extractedMetadata$/i.test(k)) walkMeta(typeof v === 'string' ? safeJson(v) : v);
            else find(v);
        }
    };
    find(json);
    return out;
}

function watchMetadata(page: Page) {
    page.on('response', async r => {
        if (r.request().method() !== 'GET' || !/json/i.test(r.headers()['content-type'] ?? '')) return;
        const text = await r.text().catch(() => '');
        if (!/extractedMetadata/i.test(text)) return;
        const map = readConfidence(safeJson(text));
        if (map.size) aiMetadata.set(page, map);
    });
}

/** Opens the Keying form by URL (no link click) and waits for it and the extracted values. */
async function openAiKeying(page: Page, orderId: string) {
    if (!page.url().includes(`/orders/${orderId}/keying`)) {
        await page.goto(`${Q}/orders/${orderId}/keying`, { waitUntil: 'domcontentloaded' });
    }
    await waitForSpinner(page);
    if (!await shown(page.locator('#clientId'), 30_000)) throw new Error(`keying form did not load (${page.url()})`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => { });
    await waitForSpinner(page);
}

/** Client, customer number and product on the open Keying form. */
async function expectAiKeyingHeader(page: Page, o: Order) {
    const selectText = (id: string) => page.locator(`#${id} .mat-mdc-select-value-text .mat-mdc-select-min-line`).textContent().catch(() => '');
    const checks: [string, string, string | null][] = [
        ['Client', o.client, await selectText('clientId')],
        ['Customer Order #', o.customerNumber, await page.locator('#customerOrderNumber').inputValue().catch(() => '')],
        ['Product', o.productType, await selectText('productTypeId')],
    ];
    const wrong = checks.filter(([, e, a]) => loose(e) !== loose(a ?? ''));
    if (wrong.length) throw new Error(`keying header differs — ${wrong.map(([f, e, a]) => `${f}: expected "${e}", got "${(a ?? '').trim()}"`).join('; ')}`);
}

async function populatedFields(page: Page): Promise<string[]> {
    return page.locator('div[data-field-key]').evaluateAll(els => els.filter(el => {
        const ctrl = el.querySelector('input:not([type=radio]):not([type=checkbox]), textarea') as HTMLInputElement | null;
        if (ctrl?.value.trim()) return true;
        return !!el.querySelector('.mat-mdc-select-value-text')?.textContent?.trim();
    }).map(el => el.getAttribute('data-field-key') ?? '').filter(Boolean));
}

type FieldConfidence = { key: string; score: number | null; reviewed: boolean };

/**
 * Every keying field with a confidence badge: div[data-field-key] > … > .confidence-container >
 * div.custom-checkbox (review circle) + span.confidence-badge "90%". The same key repeats per group
 * (Security Instrument 1, 2, …), so fields are tagged by position.
 */
async function fieldConfidence(page: Page): Promise<FieldConfidence[]> {
    const api = Object.fromEntries([...(aiMetadata.get(page) ?? new Map<string, number>()).entries()].map(([k, v]) => [k.toLowerCase(), v]));
    return page.locator('div[data-field-key]').evaluateAll((els, api) => {
        document.querySelectorAll('[data-auto-field]').forEach(e => e.removeAttribute('data-auto-field'));
        const out: { key: string; score: number | null; reviewed: boolean }[] = [];
        els.forEach(el => {
            const container = el.querySelector('.confidence-container');
            const badge = el.querySelector('.confidence-badge');
            if (!container && !badge) return;
            const m = (badge?.textContent ?? '').match(/(\d{1,3}(?:\.\d+)?)\s*%/);
            const key = el.getAttribute('data-field-key') ?? '';
            const score = m ? Number(m[1]) : (api[key.toLowerCase()] ?? null);
            const reviewed = !!container?.querySelector('input:checked, [aria-checked="true"], [aria-pressed="true"], [class*="reviewed" i], [class*="checked" i], [class*="selected" i]')
                || /\b(reviewed|checked|selected)\b/i.test(container?.className ?? '');
            el.setAttribute('data-auto-field', String(out.length));
            out.push({ key, score, reviewed });
        });
        return out;
    }, api);
}

/**
 * Clicks the review circle (div.custom-checkbox) of every field under ALLOWED_CONFIDENCE. On a `retry`
 * (the server still answered LowConfidenceScore) it clicks the spot just left of the % badge instead.
 */
async function reviewLowConfidence(page: Page, retry = false): Promise<{ low: string[]; ok: number; unknown: number }> {
    const fields = await fieldConfidence(page);
    const isLow = (f: FieldConfidence) => f.score !== null && f.score < ALLOWED_CONFIDENCE;
    for (const f of fields.map((f, i) => ({ ...f, i })).filter(f => isLow(f) && !f.reviewed)) {
        const field = page.locator(`[data-auto-field="${f.i}"]`);
        const badge = field.locator('.confidence-badge').first();
        await badge.scrollIntoViewIfNeeded({ timeout: 3_000 }).catch(() => { });
        const clicked = !retry && await field.locator('.confidence-container .custom-checkbox').first()
            .click({ timeout: 3_000 }).then(() => true).catch(() => false);
        if (!clicked) {
            const box = await badge.boundingBox();
            if (box) await page.mouse.click(box.x - 12, box.y + box.height / 2);
        }
        await page.waitForTimeout(300);
    }
    return {
        low: fields.filter(isLow).map(f => `${f.key} (${f.score}%)`),
        ok: fields.filter(f => f.score !== null && f.score >= ALLOWED_CONFIDENCE).length,
        unknown: fields.filter(f => f.score === null).length,
    };
}

/**
 * Review low-confidence fields, fill required empties, Save and Complete, and expect `nextStatus`. If the
 * server still answers LowConfidenceScore, review again and retry (3 rounds).
 */
async function reviewAndComplete(ctx: Ctx, o: Outcome, nextStatus: string, timeoutMs = 60_000) {
    const { page } = ctx;
    for (let round = 1; round <= 3; round++) {
        await waitForSpinner(page);
        const r = await reviewLowConfidence(page, round > 1);
        console.log(`   #${o.orderNo} confidence < ${ALLOWED_CONFIDENCE}%: ${r.low.length}${r.low.length ? ` — ${r.low.join(', ')}` : ''}; ok ${r.ok}; no score ${r.unknown}`);
        if (round === 1 && r.low.length) o.lowConfidence = [o.lowConfidence, r.low.join(', ')].filter(Boolean).join(' | ');
        await fillRequiredEmpty(page);

        const rejected: string[] = [];
        const onResponse = async (resp: any) => {
            if (resp.request().method() === 'GET' || resp.status() < 400) return;
            rejected.push(`${resp.status()} ${(await resp.text().catch(() => '')).slice(0, 200)}`);
        };
        page.on('response', onResponse);
        try {
            await page.locator('button[mattooltip="Save"]').click(soft).catch(() => { });
            await waitForSpinner(page);
            await page.waitForTimeout(1_000);
            await page.keyboard.press('Escape');
            await page.locator('.cdk-overlay-backdrop').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => { });
            // Complete → Yes (incomplete tagging) → Confirm (changed fields), until the complete request is sent.
            await clickCompleteAndConfirm(page).catch(err => {
                const msg = (err as Error).message;
                const blocker = msg.match(/<[^>]+>[^\n]*intercepts pointer events/)?.[0]
                    ?? (/not enabled/i.test(msg) ? 'button is disabled' : msg.split('\n')[0]);
                throw new Error(`Complete button could not be clicked — ${blocker}`);
            });
            await waitForSpinner(page);
            await page.waitForTimeout(1_500);
        } finally {
            page.off('response', onResponse);
        }

        const toast = norm(await errorToast(page).innerText({ timeout: 1_000 }).catch(() => ''));
        const lowScore = /LOW ?CONFIDENCE/i.test(`${toast} ${rejected.join(' ')}`);
        if (lowScore && round < 3) continue;
        try {
            await expectLiveStatus(ctx, o.orderId, nextStatus, timeoutMs);
            return;
        } catch (err) {
            const missing = [...new Set(await invalidControls(page).catch(() => [] as string[]))];
            const why = [toast && `toast "${toast}"`, rejected.length && `server ${rejected.join(' | ')}`, missing.length && `required: ${missing.join(', ')}`]
                .filter(Boolean).join('; ');
            throw new Error(`Complete did not reach ${nextStatus} (${(err as Error).message})${why ? ` — ${why}` : ''}`);
        }
    }
}

/** History shows every Order Status transition along `route`; names the missing ones. */
async function expectHistoryPath(page: Page, o: Order, route: string[]) {
    await openOrder(page, o.orderId);
    await page.locator('button[mattooltip="History"]').click();
    await page.locator('.ag-center-cols-container div[role="row"]').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => { });
    const missing: string[] = [];
    for (let i = 1; i < route.length; i++) {
        const row = page.locator('.ag-center-cols-container div[role="row"]')
            .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
            .filter({ has: page.locator('[col-id="previousValue"]', { hasText: new RegExp(`^${route[i - 1]}$`) }) })
            .filter({ has: page.locator('[col-id="newValue"]', { hasText: new RegExp(`^${route[i]}$`) }) });
        if (!await shown(row.first(), 5_000)) missing.push(`${route[i - 1]} → ${route[i]}`);
    }
    await page.locator('i[class="ri-close-fill"]').click().catch(() => { });
    if (missing.length) throw new Error(`History does not show ${missing.join(', ')}`);
}

/** Documents tab: Supporting Documents (MERGED) and (OCR) exist and every uploaded file shows Extracted. */
async function expectExtractedDocuments(page: Page, o: Order) {
    await page.goto(`${Q}/orders/${o.orderId}/documents`, { waitUntil: 'domcontentloaded' });
    await page.locator('.ag-center-cols-container .ag-row').first().waitFor({ state: 'visible', timeout: 30_000 });
    await waitForSpinner(page);
    const rows = await page.locator('.ag-row').evaluateAll(els => {
        const m: Record<string, string> = {};
        els.forEach(e => { const i = e.getAttribute('row-index') ?? ''; m[i] = `${m[i] ?? ''} ${(e as HTMLElement).innerText}`; });
        return Object.values(m);
    });
    const problems: string[] = [];
    for (const name of ['Supporting Documents (MERGED)', 'Supporting Documents (OCR)']) {
        if (!rows.some(t => t.includes(name))) problems.push(`"${name}" missing`);
    }
    for (const file of AI_DOCS) {
        const row = rows.find(t => t.includes(file.replace(/\.pdf$/i, '')));
        if (!row) problems.push(`${file} not listed`);
        else if (!/\bExtracted\b/i.test(row)) problems.push(`${file} not Extracted (${/PendingForExtraction/i.test(row) ? 'PendingForExtraction' : 'no extraction status'})`);
    }
    if (problems.length) throw new Error(problems.join('; '));
}

// ---------------------------------------------------------------------------
// The five workflows — each step acts, then verifies
// ---------------------------------------------------------------------------

const AI_EXTRACTION_FLOW: Step[] = [
    { name: 'Search Details Saved', run: async ({ page }, o) => {
        await saveAiSearchDetails(page, o.orderId);
    } },
    { name: 'AI Documents Uploaded', run: async (ctx, o) => {
        await uploadAiDocuments(ctx.page, o);
        o.startStatus = await liveStatus(ctx, o.orderId);
    } },
    { name: 'READY FOR MERGE', run: async ({ page }, o) => {
        await processOrder(page, o.orderId, 'READY FOR MERGE');
    } },
    { name: 'Merge + Extraction → KEYING', status: 'KEYING', run: async (ctx, o) => {
        // System: READY FOR MERGE → MERGE IN PROGRESS → READY FOR EXTRACTION → EXTRACTION IN PROGRESS → KEYING.
        const t0 = Date.now();
        const seen: string[] = [];
        let status = '';
        while (Date.now() - t0 < EXTRACTION_TIMEOUT_MS) {
            status = await liveStatus(ctx, o.orderId);
            if (status && seen[seen.length - 1] !== status) seen.push(status);
            if (status === 'KEYING') {
                console.log(`   #${o.orderNo} extraction ${Math.round((Date.now() - t0) / 1000)}s: ${seen.join(' → ')}`);
                return;
            }
            if (status === 'EXTRACTION FAILED') throw new Error(`extraction failed (${seen.join(' → ')})`);
            if (seen.length > 1 && status === o.startStatus) throw new Error(`extraction retried — order returned to ${status} (${seen.join(' → ')})`);
            await new Promise(r => setTimeout(r, 10_000));
        }
        throw new Error(`not KEYING after ${EXTRACTION_TIMEOUT_MS / 60_000} min — last "${status}" (${seen.join(' → ')})`);
    } },
    { name: 'History shows the status path', run: async ({ page }, o) => {
        await expectHistoryPath(page, o, [o.startStatus ?? '', ...AI_SYSTEM_PATH].filter(Boolean));
    } },
    { name: 'MERGED + OCR documents, files Extracted', run: async ({ page }, o) => {
        await expectExtractedDocuments(page, o);
    } },
    { name: 'KEYING IN PROGRESS (AI)', status: 'KEYING IN PROGRESS', run: async (ctx, o) => {
        const { page } = ctx;
        // Process Order → Move to... → KEYING IN PROGRESS; if the menu fails, the Keying tab link.
        const viaMenu = await processOrder(page, o.orderId, 'KEYING IN PROGRESS').then(() => '').catch(e => (e as Error).message);
        if (viaMenu) {
            await openOrder(page, o.orderId);
            await page.getByRole('link', { name: 'keyboard Keying' }).click({ timeout: 20_000 });
            await page.waitForURL(/\/orders\/\d+\/keying/, { timeout: 30_000 });
        }
        await expectLiveStatus(ctx, o.orderId, 'KEYING IN PROGRESS', 20_000).catch(err => {
            throw new Error(`${(err as Error).message}${viaMenu ? ` (Process Order: ${viaMenu})` : ''}`);
        });
        await openAiKeying(page, o.orderId);
        await expectAiKeyingHeader(page, o);
        if (!(await populatedFields(page)).length) throw new Error('keying form has no populated fields');
    } },
    { name: 'QUALITY CHECK (AI)', status: 'QUALITY CHECK', run: async (ctx, o) => {
        await reviewAndComplete(ctx, o, 'QUALITY CHECK');
        await expectInQueue(ctx.page, `${Q}/quality-control/quality-check`, o, 'Quality Check');
    } },
    { name: 'PENDING DELIVERY (AI)', status: 'PENDING DELIVERY', run: async (ctx, o) => {
        await openAiKeying(ctx.page, o.orderId);
        // QC Complete goes QUALITY CHECK → PENDING DELIVERY - COMPRESSION IN PROGRESS → (system) PENDING DELIVERY.
        await reviewAndComplete(ctx, o, 'PENDING DELIVERY', 180_000);
        await expectInQueue(ctx.page, `${Q}/order-stage/pending-delivery`, o, 'Pending Delivery');
        await expectDocument(ctx.page, o, 'Complete Delivery Package');
    } },
];

const KEYING_FLOW: Step[] = [
    { name: 'Documents Uploaded', run: async ({ page }, o) => {
        await saveSearchDetails(page, o.orderId);
        await uploadDocuments(page, o);
    } },
    { name: 'KEYING IN PROGRESS', status: 'KEYING IN PROGRESS', run: async ({ page }, o) => {
        await moveTo(page, o.orderId, 'KEYING IN PROGRESS');
        await expectKeyingFields(page, o);
    } },
    { name: 'QUALITY CHECK', status: 'QUALITY CHECK', run: async ({ page }, o) => {
        // Re-check client and product type right before keying.
        await expectKeyingFields(page, o);
        await fillKeying(page);
        await fillRequiredEmpty(page);
        await completeTo(page, o, 'QUALITY CHECK');
        await expectInQueue(page, `${Q}/quality-control/quality-check`, o, 'Quality Check');
    } },
    { name: 'PENDING DELIVERY', status: 'PENDING DELIVERY', run: async ({ page }, o) => {
        await openKeying(page, o.orderId);
        await fillQcKeying(page);
        await fillRequiredEmpty(page);
        // QC Complete goes QUALITY CHECK → PENDING DELIVERY - COMPRESSION IN PROGRESS → (system) PENDING DELIVERY.
        await completeTo(page, o, 'PENDING DELIVERY', 180_000);
        await expectInQueue(page, `${Q}/order-stage/pending-delivery`, o, 'Pending Delivery');
        await expectDocument(page, o, 'Complete Delivery Package');
    } },
];

const FEE_INCREASE_FLOW: Step[] = [
    { name: 'Fee Request Created', run: async ({ page }, o) => {
        await openOrder(page, o.orderId);
        await page.locator('a[href$="/fee-change-request"]').first().click();
        await page.locator('button[aria-label="Add Inquiry"]').click();
        const form = page.locator('div.add-new-popup.active').first();
        await form.waitFor({ state: 'visible', timeout: 30_000 });

        await popupSelect(page, form, 'severityId');
        await popupSelect(page, form, 'inquiryTypeId');
        await popupSelect(page, form, 'feeTypeIds', 1, true);

        // The $-prefixed number input can swallow fill(); read back and retype if so.
        const fee = form.locator('input[formcontrolname="fee"]');
        await fee.fill('250.75');
        if ((await fee.inputValue()) !== '250.75') { await fee.fill(''); await fee.pressSequentially('250.75', { delay: 50 }); }
        await form.locator('textarea[formcontrolname="note"]').fill('Fee increase requested by automation');

        await submitAndExpect(page, form, /\/orders\/\d+\/fee-inquiries$/, 'fee request');
    } },
    { name: 'Pending Client Response', run: async ({ page }, o) => {
        const row = await queueRow(page, INTERNAL_FEE_QUEUE, o.orderId);
        await actionAndPatch(page, () => rowAction(page, row, 'Submit Request To Client'), 'Submit Request To Client');
        await waitForInquiryStatus(async () => inquiryStatus(await queueRow(page, INTERNAL_FEE_QUEUE, o.orderId)),
            'Pending Client Response', 'fee request');
    } },
    { name: 'Client Approved', run: async (ctx, o) => {
        await asClient(ctx, async p => {
            const row = await queueRow(p, CUSTOMER_FEE_QUEUE, o.orderId);
            await actionAndPatch(p, async () => {
                await rowAction(p, row, 'Approve');
                const notes = p.locator('div.add-new-popup.active').first();
                await notes.waitFor({ state: 'visible', timeout: 30_000 });
                await notes.locator('textarea[formcontrolname="note"]').fill('Approved by client via automation');
                await notes.getByRole('button', { name: 'Submit', exact: true }).click();
            }, 'client approval');
        });
    } },
    { name: 'Approved (synced)', run: async ({ page }, o) => {
        await waitForInquiryStatus(() => orderInquiryStatus(page, o.orderId, 'fee-change-request'),
            'Approved', 'internal fee request');
    } },
];

const SEARCH_INQUIRY_FLOW: Step[] = [
    { name: 'Inquiry Raised', run: async ({ page }, o) => {
        o.preInquiryStatus = await readStatus(page, o.orderId);
        await page.goto(`${Q}/orders/${o.orderId}/search-inquiries`, { waitUntil: 'domcontentloaded' });
        await page.locator('button[aria-label="Add"]').click({ timeout: 30_000 });
        const form = page.locator('div.add-new-popup.active').first();
        await form.waitFor({ state: 'visible', timeout: 30_000 });

        await popupSelect(page, form, 'severityId');
        await popupSelect(page, form, 'inquiryTypeIds', 3, true);
        await form.locator('textarea[formcontrolname="note"]').fill('Search inquiry raised by automation');

        await submitAndExpect(page, form, /\/orders\/\d+\/search-inquiries$/, 'search inquiry');
    } },
    { name: 'Submitted To Client', run: async ({ page }, o) => {
        const row = await queueRow(page, INTERNAL_SI_QUEUE, o.orderId);
        await actAndSettle(page, () => rowAction(page, row, 'Submit Inquiry to Client'));
    } },
    { name: 'Client Responded', run: async (ctx, o) => {
        await asClient(ctx, async p => {
            const row = await queueRow(p, CUSTOMER_SI_QUEUE, o.orderId);
            await rowAction(p, row, 'Update');
            const dlg = p.locator('div.add-new-popup.active').first();
            await dlg.waitFor({ state: 'visible', timeout: 30_000 });
            await dlg.locator('textarea[formcontrolname="note"]').fill('Client response via automation');
            await actAndSettle(p, () => dlg.getByRole('button', { name: 'Save', exact: true }).click());
        });
    } },
    { name: 'Order Reverted', run: async ({ page }, o) => {
        await waitForInquiryStatus(() => orderInquiryStatus(page, o.orderId, 'search-inquiries'),
            'Received Client Response', 'inquiry');
        if (o.preInquiryStatus) {
            await expectStatus(page, o.orderId, o.preInquiryStatus, 45_000).catch(err => {
                throw new Error(`order did not revert — ${(err as Error).message}`);
            });
        }
    } },
];

/**
 * ABS CONFIRMED → RECEIVED FROM ABS → QUALITY CHECK → ABS REJECTS, shared by both passes
 * of spec 13. `suffix` keeps the step names of the second pass distinct.
 */
const absTail = (suffix: string): Step[] => [
    { name: `ABS CONFIRMED${suffix}`, status: 'ABS CONFIRMED', run: async ({ page }, o) => {
        await moveTo(page, o.orderId, 'ABS CONFIRMED');
        await expectHistory(page, o, 'ABS ASSIGNED', 'ABS CONFIRMED');
        await expectInQueue(page, `${Q}/vendor-mgt/abs-confirmed`, o, 'ABS Confirmed');
    } },
    { name: `RECEIVED FROM ABS${suffix}`, status: 'RECEIVED FROM ABS', run: async ({ page }, o) => {
        // Spec 13 makes this move from the ABS Confirmed queue (row Actions → Process Order).
        await moveTo(page, o.orderId, 'RECEIVED FROM ABS', { route: `${Q}/vendor-mgt/abs-confirmed`, customerNumber: o.customerNumber });
        await expectHistory(page, o, 'ABS CONFIRMED', 'RECEIVED FROM ABS');
        await expectInQueue(page, `${Q}/vendor-mgt/received-from-abs`, o, 'Received From ABS');
    } },
    { name: `QUALITY CHECK${suffix}`, status: 'QUALITY CHECK', run: async ({ page }, o) => {
        await moveTo(page, o.orderId, 'QUALITY CHECK');
        await expectInQueue(page, `${Q}/quality-control/quality-check`, o, 'Quality Check');
    } },
    { name: `ABS REJECTS${suffix}`, status: 'ABS REJECTS', run: async ({ page }, o) => {
        await rejectToAbs(page, o);
        await expectStatus(page, o.orderId, 'ABS REJECTS');
        await expectHistory(page, o, 'QUALITY CHECK', 'ABS REJECTS');
        await expectInQueue(page, `${Q}/vendor-mgt/abs-rejects`, o, 'ABS Rejects');
    } },
];

/** Spec 13: Assign ABS pass, rejected back from QC, then the Quotes Request pass. */
const PENDING_ABS_FLOW: Step[] = [
    { name: 'PENDING ABS ASSIGN', status: 'PENDING ABS ASSIGN', run: async ({ page }, o) => {
        await saveSearchDetails(page, o.orderId);
        await moveTo(page, o.orderId, 'PENDING ABS ASSIGN');
    } },
    { name: 'ABS ASSIGNED', status: 'ABS ASSIGNED', run: async ({ page }, o) => {
        await assignAbs(page, o.orderId);
        await expectStatus(page, o.orderId, 'ABS ASSIGNED');
        await expectHistory(page, o, 'PENDING ABS ASSIGN', 'ABS ASSIGNED');
        await expectInQueue(page, `${Q}/vendor-mgt/abs-assigned`, o, 'ABS Assigned');
        await expectQueueDetails(page, 'ABS Assigned', [
            ['customerNumber', o.customerNumber], ['client', o.client], ['abstractor', ABSTRACTOR],
        ]);
    } },
    ...absTail(''),

    // Second pass: back to PENDING ABS ASSIGN, this time through a quote.
    { name: 'PENDING ABS ASSIGN (Quote Request)', status: 'PENDING ABS ASSIGN', run: async ({ page }, o) => {
        await moveTo(page, o.orderId, 'PENDING ABS ASSIGN');
    } },
    { name: 'Quotes Review', run: async ({ page }, o) => {
        await requestQuote(page, o.orderId);
        await expectInQueue(page, `${Q}/vendor-mgt/quotes-review`, o, 'Quotes Review');
        await expectQueueDetails(page, 'Quotes Review', [['customerNumber', o.customerNumber], ['client', o.client]]);
    } },
    { name: 'ABS ASSIGNED (Quote Request)', status: 'ABS ASSIGNED', run: async ({ page }, o) => {
        await assignQuote(page, o.orderId);
        await expectStatus(page, o.orderId, 'ABS ASSIGNED');
        await expectHistory(page, o, 'PENDING ABS ASSIGN', 'ABS ASSIGNED');
        await expectInQueue(page, `${Q}/vendor-mgt/abs-assigned`, o, 'ABS Assigned');
    } },
    ...absTail(' (Quote Request)'),
];

const FLOWS: Record<string, Step[]> = {
    'Keying': KEYING_FLOW,
    'Fee Increase': FEE_INCREASE_FLOW,
    'Search Inquiries': SEARCH_INQUIRY_FLOW,
    'Pending ABS': PENDING_ABS_FLOW,
    'AI Extraction': AI_EXTRACTION_FLOW,
};

/** Expands RUN_PLAN into numbered orders, each with its workflow and fixed client. */
const SCHEDULE = RUN_PLAN.flatMap(p =>
    Array.from({ length: p.count }, (_, i) => ({ workflow: p.workflow, client: p.clients[i % p.clients.length] }))
).map((s, i) => ({ orderNo: i + 1, ...s }));

// ---------------------------------------------------------------------------

type Planned = (typeof SCHEDULE)[number];

/** Creates one new order and runs its workflow in this lane. Log lines carry #n since lanes interleave. */
async function runOrder(ctx: Ctx, planned: Planned, productTypes: string[], progress: Record<number, Outcome>): Promise<Outcome> {
    const { page } = ctx;
    const n = planned.orderNo;
    const started = Date.now();
    const outcome: Outcome = {
        orderNo: n, workflow: planned.workflow, client: planned.client, productType: '',
        orderId: '', customerNumber: '', orderUrl: '', lastStep: '', reached: '', result: 'Fail', error: '',
    };
    console.log(`▶ #${n} ${planned.workflow} | ${outcome.client}`);

    try {
        // Always a new order. The client stays fixed; if it doesn't offer a product type,
        // move on to the next product type, not the next client.
        let created: Order | null = null;
        const fixed = FIXED_PRODUCT[planned.client];
        if (fixed) {
            created = await createOrderRetry(page, planned.client, fixed);
            if (!created) throw new Error(`client "${planned.client}" does not offer "${fixed}"`);
        }
        // AI Extraction orders use only product types whose path goes through merge + extraction.
        // Pending ABS orders never use "QPWB - Typing Only - Revision".
        const allTypes = (planned.workflow === 'AI Extraction' ? AI_PRODUCT_TYPES : productTypes)
            .filter(p => !(planned.workflow === 'Pending ABS' && loose(p) === loose('QPWB - Typing Only - Revision')));
        // Once the client's Product Type list is known, only try types it actually offers: each miss
        // reloads the whole New Order form, and dozens of misses cost up to half an hour per order.
        const usable = () => {
            const known = offeredTypes.get(planned.client)?.map(loose);
            return known ? allTypes.filter(p => known.includes(loose(p))) : allTypes;
        };
        for (let t = 0, list = usable(); t < list.length && !created; t++, list = usable()) {
            created = await createOrderRetry(page, planned.client, list[(n - 1 + t) % list.length]);
        }
        if (!created) throw new Error(`client "${planned.client}" offers none of the product types`);
        Object.assign(outcome, created, { orderUrl: `${ctx.base}${Q}/orders/${created.orderId}/details` });
        progress[n] = outcome;
        saveProgress(progress);
        console.log(`   #${n} Created Order ${outcome.orderId} (Cust# ${outcome.customerNumber}) | ${outcome.productType}`);
        outcome.reached = await readStatus(page, outcome.orderId);

        for (const step of FLOWS[planned.workflow]) {
            try {
                await step.run(ctx, outcome);
            } catch (err) {
                outcome.reached = await readStatus(page, outcome.orderId).catch(() => outcome.reached);
                throw new Error(`${step.name}: ${(err as Error).message.split('\n')[0]}`);
            }
            outcome.lastStep = step.name;
            outcome.reached = step.status ?? outcome.reached;
            progress[n] = outcome;
            saveProgress(progress);
            console.log(`   #${n} ✅ ${step.name}`);
        }

        outcome.reached = await readStatus(page, outcome.orderId).catch(() => outcome.reached);
        outcome.result = 'Done';
    } catch (err) {
        outcome.result = outcome.orderId ? 'Blocked' : 'Fail';
        outcome.error = (err as Error).message.split('\n')[0];
    }

    outcome.seconds = Math.round((Date.now() - started) / 1000);
    console.log(outcome.result === 'Done'
        ? `   #${n} 🏁 Done in ${outcome.seconds}s`
        : `   #${n} ❌ ${outcome.error} (${outcome.seconds}s)`);
    progress[n] = outcome;
    saveProgress(progress);
    return outcome;
}

//@Outamate DS:
test(' Research Bulk Order Processing ', async ({ page, browser, baseURL }) => {
    test.setTimeout(0);
    const base = (baseURL ?? '').replace(/\/$/, '');
    const viewport = page.viewportSize();
    const storageState = test.info().project.use.storageState;

    const start = Number(process.env.START_ROW || 1);
    const end = Math.min(Number(process.env.END_ROW || SCHEDULE.length), SCHEDULE.length);
    const selected = SCHEDULE.filter(s => s.orderNo >= start && s.orderNo <= end);
    const laneCount = Math.max(1, Math.min(Number(process.env.LANES || 4), selected.length));
    archiveProgress();
    const progress: Record<number, Outcome> = {};
    const productTypes = await readProductTypes();

    console.log('');
    console.log('\x1b[1mResearch Bulk Order Processing:\x1b[0m');
    console.log(`🔢 Orders ${start}–${end} of ${SCHEDULE.length} in ${laneCount} parallel lane(s): ${RUN_PLAN.map(p => `${p.workflow} ${p.count}`).join(', ')}`);
    const runStarted = Date.now();

    // AI Extraction orders read the live status in a hidden browser (same login), one page per lane,
    // so the Keying form is never reloaded or left and no extra windows open.
    const needsStatus = selected.some(s => s.workflow === 'AI Extraction');
    const statusBrowser = needsStatus ? await chromium.launch({ headless: true }) : null;
    const statusContext = statusBrowser
        ? await statusBrowser.newContext({ storageState: storageState as string, baseURL: baseURL || undefined, ignoreHTTPSErrors: true, viewport: { width: 1920, height: 1080 } })
        : null;

    // Lane 1 uses the test's page; every other lane gets its own signed-in context.
    const lanes: Ctx[] = [];
    const replaced = new WeakSet<Page>();                // pages swapped out on purpose (no "closed" alarm)
    const setupLanePage = async (lanePage: Page, i: number) => {
        lanePage.setDefaultTimeout(30_000);              // same limits as test.use above, for every lane
        lanePage.setDefaultNavigationTimeout(60_000);
        await lanePage.route('**/*intelliabot.com/**', route => route.abort());
        lanePage.on('crash', () => console.log(`💥 Lane ${i + 1}: browser page crashed`));
        lanePage.on('close', () => { if (!replaced.has(lanePage)) console.log(`🛑 Lane ${i + 1}: browser page was closed`); });
        if (needsStatus) watchMetadata(lanePage);
        return lanePage;
    };
    for (let i = 0; i < laneCount; i++) {
        const lanePage = i === 0 ? page
            : await (await browser.newContext({ storageState, baseURL: baseURL || undefined, viewport })).newPage();
        await setupLanePage(lanePage, i);
        const status = statusContext ? await statusContext.newPage() : undefined;
        lanes.push({ page: lanePage, browser, base, viewport, client: null, status });
    }

    // A network change can leave a page stuck reloading an error page, so that every later goto is
    // "interrupted by another navigation" and the rest of the lane fails in a second each. Orders that
    // failed like that before being created get a fresh page in the same signed-in context and one retry.
    const PAGE_BROKEN = /net::ERR_|interrupted by another navigation|chrome-error|Customer dropdown did not open|page\.goto: Timeout/i;
    const freshPage = async (ctx: Ctx, li: number) => {
        const old = ctx.page;
        replaced.add(old);
        ctx.page = await setupLanePage(await old.context().newPage(), li);
        await old.close().catch(() => { });
        await ctx.page.waitForTimeout(5_000);            // let the network settle
    };

    // Orders are dealt round-robin, so each lane gets a mix of workflows and they finish together.
    await Promise.all(lanes.map(async (ctx, li) => {
        for (const planned of selected.filter((_, i) => i % laneCount === li)) {
            // Once a lane's browser is gone, its later orders would fail instantly — stop that lane.
            if (ctx.page.isClosed()) {
                console.log(`🛑 Lane ${li + 1} closed. Its remaining orders are skipped.`);
                break;
            }
            const outcome = await runOrder(ctx, planned, productTypes, progress);
            if (outcome.result === 'Fail' && !outcome.orderId && PAGE_BROKEN.test(outcome.error)) {
                console.log(`   ↻ Lane ${li + 1}: fresh page, retrying #${planned.orderNo} once`);
                const ok = await freshPage(ctx, li).then(() => true).catch(() => false);
                if (ok) await runOrder(ctx, planned, productTypes, progress);
            }
        }
    }));

    for (const [i, ctx] of lanes.entries()) {
        await ctx.client?.context().close().catch(() => { });
        if (i > 0) await ctx.page.context().close().catch(() => { });
    }
    await statusBrowser?.close().catch(() => { });

    // Email rows in order-number order, whatever order the lanes finished in.
    for (const o of Object.values(progress).sort((a, b) => a.orderNo - b.orderNo)) {
        addResult({
            product: 'Research Bulk Orders',
            srNo: getSrCounter().toString(),
            module: `#${o.orderNo} ${o.workflow} | ${o.client} | ${o.productType || '-'} → ${o.lastStep || 'not created'}`,
            status: o.result === 'Done' ? 'Pass' : 'Fail',
            URL: o.orderUrl ? `<a href="${o.orderUrl}">Order ${o.orderId} / ${o.customerNumber}</a>` : o.error,
        });
        incrementSrCounter();
    }

    await writeReport(progress);
    const all = Object.values(progress);
    console.log('');
    for (const p of RUN_PLAN) {
        const ofW = all.filter(o => o.workflow === p.workflow);
        console.log(`📊 ${p.workflow}: ${ofW.filter(o => o.result === 'Done').length}/${ofW.length} completed`);
    }
    console.log(`⏱️ Total ${Math.round((Date.now() - runStarted) / 60_000)} min for ${all.length} orders`);
    console.log(`📄 Report: ${REPORT}`);

    const results = getResults();
    await sendMail(results);
});
