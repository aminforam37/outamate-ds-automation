import { test, Page, Browser, Locator } from '@playwright/test';
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
 * Bulk AOM orders, using the flow proven by specs 03 (order creation + documents) and
 * 04 (keying, QC, batching, signing, recording, recordation reject).
 *
 * Every order runs, in its own lane, from creation to the Rejects queue:
 *
 *   created (HOLD) → documents uploaded → KEYING IN PROGRESS → QUALITY CHECK → QC COMPLETED
 *   → batch created (SIGNING PREPARATION) → Complete Batch (SENT FOR EXTERNAL SIGNING)
 *   → signed document ingested (RECEIVED FROM SIGNING) → SENT FOR RECORDING
 *   → rejected from Recordation Monitoring → Rejects queue
 *
 * Orders are batched in groups: each order runs to QC COMPLETED in its lane; once a client has
 * BATCH_SIZE orders waiting, one batch is created for them, generated and completed once, and
 * then each order continues on its own (signed document, recording, reject).
 * Clients: Covius and LoanCare - OM, alternating. Scale by raising `count` in RUN_PLAN.
 *
 * Env:
 *   START_ROW/END_ROW order numbers to run (default: all)
 *   LANES             orders processed at the same time, each in its own browser context (default 4)
 *   BATCH_SIZE        orders of one client per batch (default 10; 1 = one batch per order)
 *
 * Every run creates new orders. Progress lives in Bulk_Orders/AOM/ and the previous run's
 * file is kept as progress_<time>.json.
 */
const OUT_DIR = path.resolve('Bulk_Orders', 'AOM');
const DOC_DIR = path.join(OUT_DIR, 'docs');
const SCREEN_DIR = path.join(OUT_DIR, 'screens');      // one screenshot per failed order
const PROGRESS = path.join(OUT_DIR, 'progress.json');
const REPORT = path.join(OUT_DIR, 'AOM_Bulk_Orders_Report.xlsx');
const Q = '/app/internal/assignments';
/** false = don't open the History popup to confirm each status change (faster, fewer page loads). */
const VERIFY_HISTORY = false;
/** Orders of the same client put into one batch (env BATCH_SIZE, default 10). */
const BATCH_SIZE = Math.max(1, Number(process.env.BATCH_SIZE || 10));

const RUN_PLAN: { workflow: string; count: number; clients: string[] }[] = [
    // Debugging: 1 order (Covius). Set back to 60 (30 per client) once a single order passes end to end.
    { workflow: 'AOM Full', count: 20, clients: ['Covius', 'LoanCare - OM'] },
];

/** Documents uploaded after creation (spec 03), each given the document type at the same index + 1. */
const UPLOAD_DOCS = ['INDEX.pdf', 'Prior SP.pdf', '26219076.pdf', '26532140.pdf'];

/**
 * Clients whose Customer Order Number the app stores left-padded with zeros to a fixed length.
 * LoanCare AOM: 1234567 → 0001234567, 12345 → 0000012345, 0001234567 stays unchanged.
 */
const PAD_CUSTOMER_NUMBER: Record<string, number> = { 'LoanCare - OM': 10 };
const padLength = (client: string) =>
    Object.entries(PAD_CUSTOMER_NUMBER).find(([c]) => loose(c) === loose(client))?.[1];
const expectedCustomerNumber = (client: string, typed: string) => {
    const len = padLength(client);
    return len ? typed.padStart(len, '0') : typed;
};

/**
 * The Customer Order Number typed on the New Order form. Padded clients rotate through every
 * format the padding rule covers: 7 digits, 5 digits, already 10 digits with leading zeros, 6 digits.
 */
function typedCustomerNumber(client: string, orderNo: number): string {
    const digits = (n: number) => faker.number.int({ min: 10 ** (n - 1), max: 10 ** n - 1 }).toString();
    const len = padLength(client);
    if (!len) return digits(6);
    const ordinal = Math.floor((orderNo - 1) / 2);   // clients alternate, so this counts this client's orders
    switch (ordinal % 4) {
        case 0: return digits(7);                    // 1234567    → 0001234567
        case 1: return digits(5);                    // 12345      → 0000012345
        case 2: return digits(7).padStart(len, '0'); // 0001234567 → unchanged
        default: return digits(6);                   // 123456     → 0000123456
    }
}

/**
 * Beneficiary per client (searched by Assignor), with its MERS Indicator. It drives the keying:
 *  - MERS (Yes):    Original Lender MERS Ind = Yes, MIN Number filled (required on Complete)
 *  - Non-MERS (No): Original Lender MERS Ind = No,  MIN Number left empty (optional)
 */
const BENEFICIARY: Record<string, { name: string; mers: boolean }> = {
    'Covius': { name: 'MORTGAGE ELECTRONIC REGISTRATION SYSTEM INC', mers: true },   // MERS Indicator: Yes
    'LoanCare - OM': { name: 'MOVEMENT MORTGAGE, LLC', mers: false },               // MERS Indicator: No
};
const beneficiary = (client: string) => {
    const b = Object.entries(BENEFICIARY).find(([c]) => loose(c) === loose(client))?.[1];
    if (!b) throw new Error(`no beneficiary configured for client "${client}"`);
    return b;
};

/** `customerNumber` is the value the app is expected to store (padded for LoanCare - OM); `typedCustomerNumber` is what was entered. */
type Order = { orderId: string; customerNumber: string; typedCustomerNumber: string; client: string; productType: string };
type Outcome = Order & {
    orderNo: number; workflow: string; orderUrl: string; lastStep: string; reached: string;
    /** Waiting = reached QC COMPLETED, its batch group has not run yet. */
    result: 'Done' | 'Blocked' | 'Fail' | 'Waiting'; error: string; seconds?: number;
    batch?: string; batchUrl?: string; signedDoc?: string; notes?: string; screenshot?: string;
};
type Ctx = { page: Page; browser: Browser; base: string };
/** `status` marks steps that end in an order status (recorded as the order's reached status). */
type Step = { name: string; status?: string; run: (ctx: Ctx, o: Outcome) => Promise<void> };

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
const loose = (s: string) => norm(s).replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
const soft = { timeout: 5_000 };
const shown = (l: Locator, ms: number) => l.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);
const note = (o: Outcome, text: string) => { o.notes = [o.notes, text].filter(Boolean).join(' | '); };
const firstLine = (err: unknown) => (err as Error).message.split('\n')[0];

/**
 * Playwright's error, reduced to one line that still says WHAT it waited for and WHY it gave up:
 * "locator.click: Timeout 15000ms exceeded" alone doesn't name the button. Adds the locator from the
 * call log and the last blocker it reported (disabled, hidden, covered by another element).
 */
function describeError(err: unknown): string {
    const msg = (err as Error)?.message ?? String(err);
    const lines = msg.split('\n').map(l => l.replace(/\x1b\[[0-9;]*m/g, '').trim()).filter(Boolean);
    const head = lines[0] ?? msg;
    // Already described by clickReady/describeError: don't append the same details again.
    if (/ — /.test(head)) return head;
    if (!/Timeout \d+ms exceeded|strict mode violation/i.test(head)) return head;
    const target = lines.find(l => /waiting for (locator|getBy)/.test(l))?.replace(/^-\s*waiting for\s*/, '');
    const blocker = [...lines].reverse().find(l => /intercepts pointer events|not enabled|not visible|not stable|detached/i.test(l));
    const why = !blocker ? ''
        : /intercepts pointer events/i.test(blocker)
            ? `covered by ${(blocker.match(/<[^>]{0,120}>/)?.[0] ?? 'another element')}`
            : blocker.replace(/^-\s*/, '').replace(/^.*?element is /i, '');
    return [head, target && `waiting for ${target.slice(0, 160)}`, why].filter(Boolean).join(' — ');
}

/** Waits until the app's loading spinner (it covers the page and swallows clicks) has gone. */
async function waitForSpinner(page: Page, timeoutMs = 60_000) {
    await page.waitForTimeout(200);
    await page.locator('ngx-spinner .ngx-spinner-overlay, .ngx-spinner-overlay').first()
        .waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => { });
}

/**
 * Clicks once the spinner is gone, with a long timeout: when several lanes hit the app at once it
 * slows down and 15s is not enough. On failure the error names the button and what blocked it.
 */
async function clickReady(page: Page, target: Locator, what: string, timeoutMs = 60_000) {
    await waitForSpinner(page, timeoutMs);
    await target.click({ timeout: timeoutMs }).catch(err => {
        throw new Error(`"${what}" could not be clicked — ${describeError(err).replace(/^locator\.click: /, '')}`);
    });
}

// ---------------------------------------------------------------------------
// Progress / report
// ---------------------------------------------------------------------------

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
    const ws = wb.addWorksheet('AOM Bulk Orders');
    ws.columns = [
        { header: 'Order #', key: 'orderNo', width: 8 },
        { header: 'Client', key: 'client', width: 20 },
        { header: 'Product Type', key: 'productType', width: 30 },
        { header: 'Order ID', key: 'orderId', width: 10 },
        { header: 'Typed Customer #', key: 'typedCustomerNumber', width: 16 },
        { header: 'Customer Number', key: 'customerNumber', width: 16 },
        { header: 'Order URL', key: 'orderUrl', width: 60 },
        { header: 'Batch', key: 'batch', width: 14 },
        { header: 'Last Step', key: 'lastStep', width: 30 },
        { header: 'Order Status', key: 'reached', width: 26 },
        { header: 'Result', key: 'result', width: 10 },
        { header: 'Time (s)', key: 'seconds', width: 9 },
        { header: 'Notes', key: 'notes', width: 50 },
        { header: 'Error', key: 'error', width: 80 },
        { header: 'Screenshot', key: 'screenshot', width: 60 },
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
// Shared helpers (from spec 17)
// ---------------------------------------------------------------------------

/**
 * Opens the nth mat-select on the page and picks an option by text (matched loosely) or by
 * index. An `optional` dropdown that doesn't open is skipped (returns null).
 */
async function pick(page: Page, selectIndex: number, choice: string | number, field: string, optional = false) {
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

const present = async (page: Page, selector: string, nth = 0) =>
    await page.locator(selector).count() > nth && await page.locator(selector).nth(nth).isVisible().catch(() => false);

const fill = async (page: Page, selector: string, value: string, nth = 0) => {
    if (!await present(page, selector, nth)) return;
    await page.locator(selector).nth(nth).fill(value, soft).catch(() => { });
};

const todayText = () => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

const errorToast = (page: Page) =>
    page.locator('.warning-toast, .toast-container.danger-toast, .toast-container.error-toast').first();

async function failOnErrorToast(page: Page, what: string, ms = 2_000) {
    if (await errorToast(page).isVisible({ timeout: ms }).catch(() => false) || await shown(errorToast(page), ms)) {
        throw new Error(`${what} — error toast "${norm(await errorToast(page).innerText().catch(() => ''))}"`);
    }
}

/** Visible controls that are still invalid (required and empty), tagged for `fillRequiredEmpty`. */
async function invalidControls(page: Page): Promise<string[]> {
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

/** Fills whatever required field the client/product form still has empty after the standard fill. */
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

/**
 * Opens a queue filtered to one value and returns the full row. Pinned columns live in
 * separate .ag-row elements sharing a row-index, so the row is re-selected by index.
 */
/**
 * Searches a queue grid for `key` and returns that order's full row. Pinned columns live in
 * separate .ag-row elements sharing a row-index, so the row is re-selected by index.
 *
 * A row matches when it shows `key` or any of `alsoMatch` (e.g. the Order ID: the Quality Check
 * grid has no Customer Number column, spec 04 uses its col-id="id"). When nothing matches but the
 * search left exactly one row, that row is the order. Retried 3 times because an order can take a
 * moment to arrive in a queue; the error then says what the grid showed.
 */
async function queueRow(p: Page, route: string, key: string, alsoMatch: string[] = []): Promise<Locator> {
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b(${[key, ...alsoMatch].filter(Boolean).map(esc).join('|')})\\b`);
    let seen = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
        await p.goto(route, { waitUntil: 'domcontentloaded' });
        const search = p.locator('input[placeholder="Search keyword"]').first();
        await search.waitFor({ state: 'visible', timeout: 60_000 })
            .catch(() => { throw new Error(`"Search keyword" box not shown on ${route} after 60s`); });
        await waitForSpinner(p);
        await search.fill(key);
        await p.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { });
        await p.waitForTimeout(1_000);    // let the grid apply the search
        const match = p.locator('.ag-row').filter({ hasText: pattern }).first();
        if (await shown(match, 10_000)) {
            const idx = await match.getAttribute('row-index');
            return idx !== null ? p.locator(`.ag-row[row-index="${idx}"]`) : match;
        }
        // The search filtered the grid; a single remaining row is this order.
        const indexes = await p.locator('.ag-center-cols-container .ag-row').evaluateAll(els =>
            [...new Set(els.map(e => e.getAttribute('row-index')))]).catch(() => [] as (string | null)[]);
        if (indexes.length === 1 && indexes[0] !== null) return p.locator(`.ag-row[row-index="${indexes[0]}"]`);
        const records = (await p.locator('span[ref="lbRecordCount"]').first().innerText({ timeout: 1_000 }).catch(() => '?')).trim();
        const first = (await p.locator('.ag-center-cols-container .ag-row').first().innerText({ timeout: 1_000 }).catch(() => ''))
            .replace(/\s+/g, ' ').trim().slice(0, 80);
        seen = `${indexes.length} row(s) shown, record count "${records}"${first ? `, first row: "${first}"` : ''}`;
        await p.waitForTimeout(3_000);    // the order may still be moving into this queue
    }
    throw new Error(`"${key}" not in ${route} (searched 3 times; ${seen})`);
}

async function expectInQueue(page: Page, route: string, o: Order, queue: string) {
    await queueRow(page, route, o.customerNumber, [o.orderId]).catch(err => {
        throw new Error(`not found in the ${queue} queue — ${firstLine(err).replace(/^.*?\(searched/, '(searched')}`);
    });
}

/** Opens a menu item (by text, else by index) from the menu that is open now. */
async function menuItem(page: Page, text: RegExp, fallbackIndex: number) {
    const byText = page.locator('.mat-mdc-menu-panel').last().locator('button, [role="menuitem"]').filter({ hasText: text }).first();
    if (await shown(byText, 5_000)) return byText.click();
    return page.locator('span[class="mat-mdc-menu-item-text"]').nth(fallbackIndex).click({ timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// AOM order navigation and status checks
// ---------------------------------------------------------------------------

/**
 * Opens the order. When the server is overloaded the app sometimes bounces to the home dashboard
 * instead of the order: reload it (up to 4 tries, waiting longer each time) rather than failing.
 */
async function openOrder(page: Page, orderId: string, tab = 'details') {
    // The Keying page has no History button: there, the keying form (Client field) proves it opened.
    const loaded = tab === 'keying'
        ? page.locator('#clientId').first()
        : page.locator('button[mattooltip="History"]').first();
    for (let attempt = 1; ; attempt++) {
        await page.goto(`${Q}/orders/${orderId}/${tab}`, { waitUntil: 'domcontentloaded' }).catch(() => { });
        const ok = await shown(loaded, 45_000) && page.url().includes(`/orders/${orderId}`);
        await waitForSpinner(page);
        if (ok) return;
        if (attempt >= 4) throw new Error(`order ${orderId} page did not open (app showed ${page.url()})`);
        console.log(`   ↻ order ${orderId} did not open (app showed ${page.url().replace(/^https?:\/\/[^/]+/, '')}) — reload ${attempt}/3`);
        await page.waitForTimeout(10_000 * attempt);
    }
}

/**
 * Polls the order's History until it shows Order Status `from` → `to` (any `from` when omitted).
 * AOM status changes are verified through History, as spec 04 does.
 */
async function expectHistory(page: Page, o: Order, to: string, from?: string, timeoutMs = 90_000) {
    if (!VERIFY_HISTORY) {
        // History check switched off: just give the app a moment to apply the status change.
        await waitForSpinner(page);
        await page.waitForTimeout(3_000);
        return;
    }
    const deadline = Date.now() + timeoutMs;
    const exact = (s: string) => new RegExp(`^\\s*${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    let lastError = '';
    do {
        // A slow/bounced page is not a verdict: keep polling until the deadline.
        const opened = await openOrder(page, o.orderId)
            .then(() => clickReady(page, page.locator('button[mattooltip="History"]').first(), 'History'))
            .then(() => true)
            .catch(err => { lastError = describeError(err); return false; });
        if (!opened) { await page.waitForTimeout(5_000); continue; }
        lastError = '';
        await page.locator('.ag-center-cols-container div[role="row"]').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => { });
        let row = page.locator('.ag-center-cols-container div[role="row"]')
            .filter({ has: page.locator('[col-id="field"]', { hasText: 'Order Status' }) })
            .filter({ has: page.locator('[col-id="newValue"]', { hasText: exact(to) }) });
        if (from) row = row.filter({ has: page.locator('[col-id="previousValue"]', { hasText: exact(from) }) });
        const ok = await shown(row.first(), 5_000);
        await page.locator('i[class="ri-close-fill"]').click().catch(() => { });
        if (ok) return;
        await page.waitForTimeout(3_000);
    } while (Date.now() < deadline);
    throw new Error(lastError
        ? `could not read History to check ${from ?? '…'} → ${to}: ${lastError}`
        : `History does not show ${from ?? '…'} → ${to}`);
}

const AOM_STATUSES = ['HOLD', 'KEYING IN PROGRESS', 'QUALITY CHECK', 'QC COMPLETED', 'SIGNING PREPARATION',
    'SENT FOR EXTERNAL SIGNING', 'RECEIVED FROM SIGNING', 'SENT FOR RECORDING', 'REJECTS QUEUE'];

/** The status badge on the order's details page ('' when it can't be read). One page load, no popup. */
async function orderStatus(page: Page, orderId: string): Promise<string> {
    await openOrder(page, orderId).catch(() => { });
    const badge = page.locator(`text=/^\\s*(${AOM_STATUSES.join('|')})\\s*$/`).first();
    return norm(await badge.innerText({ timeout: 15_000 }).catch(() => ''));
}

/** Re-reads the status badge until it shows `status` (the move can take a moment). */
async function waitForStatus(page: Page, orderId: string, status: string, timeoutMs = 45_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    do {
        if (await orderStatus(page, orderId) === status) return true;
        await page.waitForTimeout(5_000);
    } while (Date.now() < deadline);
    return false;
}

/**
 * Runs a keying pass (`work`: open, fill, Save, Complete) and checks History for `from` → `to`.
 * Under load the app sometimes accepts Complete without moving the order, or the click fails:
 * if History still doesn't show the move, the keying is done once more before failing. Before
 * that retry, History is checked again so a late move is never keyed twice.
 */
async function keyAndComplete(page: Page, o: Outcome, to: string, from: string, work: () => Promise<void>) {
    const firstError = await work().then(() => '').catch(err => describeError(err));
    if (!VERIFY_HISTORY) {
        // No History popup, but the status badge must show the move: under load the app can
        // accept Complete without moving the order. Not moved → key once more, then fail.
        if (!firstError && await waitForStatus(page, o.orderId, to)) return;
        const now = await orderStatus(page, o.orderId);
        if (now === to) return;
        console.log(`   ↻ #${o.orderNo} ${o.orderId}: still ${now || '?'}, not ${to}${firstError ? ` (${firstError.slice(0, 120)})` : ''} — keying again`);
        await page.waitForTimeout(20_000);
        await work();
        if (!await waitForStatus(page, o.orderId, to)) {
            throw new Error(`Complete did not take: status is ${await orderStatus(page, o.orderId) || '?'}, not ${to} (keyed twice)`);
        }
        return;
    }
    const moved = await expectHistory(page, o, to, from, firstError ? 30_000 : 90_000).then(() => true).catch(() => false);
    if (moved) return;
    if (await expectHistory(page, o, to, undefined, 1).then(() => true).catch(() => false)) return;
    console.log(`   ↻ #${o.orderNo} ${o.orderId}: still not ${to}${firstError ? ` (${firstError.slice(0, 120)})` : ''} — keying again`);
    await page.waitForTimeout(20_000);
    await work();
    await expectHistory(page, o, to, from, 120_000);
}

/**
 * In the open Process Order dialog, moves the order to `target`: a split button
 * "Move to <NEXT>" + ▾, or a single "Move to..." button opening the status menu.
 */
async function chooseMoveTarget(page: Page, target: string) {
    const suggested = page.locator('button.split-button-left').filter({ visible: true }).first();
    const dropdown = page.locator('button.split-button-right, button.move-to-button, button:has-text("Move to...")')
        .filter({ visible: true }).first();
    if (!await shown(suggested.or(dropdown).first(), 15_000)) {
        throw new Error(`Process Order dialog showed no "Move to" button (moving to ${target})`);
    }
    if (await suggested.isVisible() && loose(await suggested.innerText()) === loose(`Move to ${target}`)) {
        await suggested.click();
        return;
    }
    await dropdown.click({ timeout: 10_000 });
    const option = page.getByRole('menuitem', { name: target, exact: true })
        .or(page.locator(`button:has-text(" ${target} ")`)).filter({ visible: true }).first();
    if (!await shown(option, 10_000)) {
        const options = (await page.getByRole('menuitem').filter({ visible: true }).allInnerTexts().catch(() => [] as string[]))
            .map(t => norm(t)).filter(Boolean);
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        throw new Error(`"${target}" not offered in Process Order (offered: ${options.join(', ') || 'none'})`);
    }
    await option.click();
}

/** Order page → Process Order → Move to `target`, then History shows the move. */
async function moveTo(page: Page, o: Order, target: string, from?: string) {
    await openOrder(page, o.orderId);
    await clickReady(page, page.locator('button[mattooltip="Process Order"]').first(), 'Process Order');
    await chooseMoveTarget(page, target);
    await failOnErrorToast(page, `moving to ${target}`);
    await expectHistory(page, o, target, from);
}

/** Waits (with reloads) for a document whose name contains `name` on the Documents tab. */
/**
 * Waits (with reloads) for a document named `name`, or of document type `name`, on the Documents tab.
 * One locator with .first(): a document usually matches by both its name link AND its type cell,
 * and waitFor() on a locator matching 2 elements throws (strict mode), which read as "not there".
 */
async function waitForDocument(page: Page, o: Order, name: string, timeoutMs = 60_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const doc = page.locator('a.name-link, .ag-row [col-id="documentType"]').filter({ hasText: name }).first();
    do {
        await openOrder(page, o.orderId, 'documents');
        await page.locator('.ag-center-cols-container .ag-row').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => { });
        if (await shown(doc, 10_000)) return true;
        await page.waitForTimeout(5_000);
    } while (Date.now() < deadline);
    return false;
}

// ---------------------------------------------------------------------------
// Order creation (spec 03)
// ---------------------------------------------------------------------------

class CreateTimeout extends Error {
    constructor(message: string, public stillNew: boolean) { super(message); }
}

async function createOrderRetry(page: Page, client: string, orderNo: number): Promise<Order> {
    try {
        return await createAomOrder(page, client, orderNo);
    } catch (err) {
        if (!(err instanceof CreateTimeout) || !err.stillNew) throw err;
        console.log(`   ↻ ${err.message}; retrying once`);
        return createAomOrder(page, client, orderNo);
    }
}

async function createAomOrder(page: Page, client: string, orderNo: number): Promise<Order> {
    await page.goto(`${Q}/orders/new`, { waitUntil: 'domcontentloaded' });

    const clientName = await pick(page, 0, client, 'Customer');
    if (!clientName) throw new Error(`client "${client}" not in Customer dropdown`);
    if (!await pick(page, 1, 1, 'Project Code')) throw new Error(`no Project Code for "${client}"`);
    await pick(page, 2, 1, 'Division', true);
    await page.locator('input[formcontrolname="lenderName"]').fill('BOB Bank');
    const productType = await pick(page, 3, 1, 'Product Type');
    if (!productType) throw new Error(`no Product Type for "${client}"`);

    const typed = typedCustomerNumber(client, orderNo);
    await page.locator('input[formcontrolname="customerNumber"]').fill(typed);
    await page.locator('input[formcontrolname="parcelNumber"]').fill(faker.number.int({ min: 1000000, max: 9999999 }).toString());
    await page.locator('input[formcontrolname="line1"]').fill(faker.location.streetAddress());
    await page.locator('input[formcontrolname="zip"]').fill('99501');
    await page.locator('input[formcontrolname="city"]').fill(faker.location.city());
    if (!await pick(page, 4, 0, 'State')) throw new Error('no State option');
    if (!await pick(page, 5, 4, 'County')) throw new Error('no County option');

    await page.locator('input[formcontrolname="firstName"]').nth(0).fill(faker.person.firstName());
    await page.locator('input[formcontrolname="middleName"]').nth(0).fill(faker.person.middleName());
    await page.locator('input[formcontrolname="lastName"]').nth(0).fill(faker.person.lastName());
    await fill(page, 'input[id="LoanNumber"]', faker.number.int({ min: 100000, max: 999999 }).toString());
    await fill(page, 'input[formcontrolname="considerationAmount"]', faker.finance.amount({ min: 1000, max: 10000, dec: 2 }));

    const instrument = page.locator('mat-form-field').filter({ has: page.locator('input[formcontrolname="instrumentDate"]') })
        .locator('button[aria-label="Open calendar"]').first();
    await (await instrument.count() ? instrument : page.locator('button[aria-label="Open calendar"]').nth(0)).click();
    await page.locator('.mat-calendar-body-today').click();
    await fillEmptyDates(page);

    await fill(page, 'input[formcontrolname="signing"]', 'Signing');
    await page.locator('textarea[formcontrolname="specialInstructions"]').fill('AOM bulk automation order');
    await fillRequiredEmpty(page);

    const missing = [...new Set(await invalidControls(page))];
    if (missing.length) throw new Error(`New Order required fields still empty: ${missing.join(', ')}`);

    await page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-primary"]').click();
    const opened = await page.waitForURL(/\/app\/internal\/assignments\/orders\/\d+\/details/, { timeout: 120_000 })
        .then(() => true).catch(() => false);
    if (!opened) {
        const why = norm(await page.locator('.toast-message, mat-error').first().innerText({ timeout: 1_000 }).catch(() => ''));
        throw new CreateTimeout(`order did not open after Save${why ? ` — "${why}"` : ''}`, /\/orders\/new/.test(page.url()));
    }
    const orderId = page.url().split('/orders/')[1]?.split('/')[0] ?? '';
    return { orderId, customerNumber: expectedCustomerNumber(client, typed), typedCustomerNumber: typed, client: clientName, productType };
}

/** Documents tab → Add → UPLOAD_DOCS with types 1..n → Upload (spec 03). */
async function uploadDocuments(page: Page, o: Order) {
    const files = UPLOAD_DOCS.map(f => path.resolve('Documents', f));
    const missing = files.filter(f => !fs.existsSync(f));
    if (missing.length) throw new Error(`document not found: ${missing.join(', ')}`);

    await openOrder(page, o.orderId, 'documents');
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

// ---------------------------------------------------------------------------
// AOM keying (spec 04). Fields the client's form doesn't have are skipped;
// Complete then names any required field still empty.
// ---------------------------------------------------------------------------

const kf = (page: Page, key: string, g = 0) =>
    page.locator(`div.form-field[data-field-key="${key}"][data-group-index="${g}"]`);

async function kfFill(page: Page, key: string, value: string, g = 0) {
    const input = kf(page, key, g).locator('input, textarea').first();
    if (!await input.isVisible().catch(() => false)) return;
    await input.fill(value, soft).catch(() => { });
}

async function kfSelect(page: Page, key: string, g = 0, option: number | RegExp = 0): Promise<string> {
    const select = kf(page, key, g).locator('mat-select').first();
    if (!await select.isVisible().catch(() => false)) return '';
    if (!await select.click(soft).then(() => true).catch(() => false)) return '';
    const panel = page.locator('.mat-mdc-select-panel').last();
    if (!await shown(panel, 5_000)) return '';
    const opts = panel.locator('mat-option');
    const opt = typeof option === 'number' ? opts.nth(option) : opts.filter({ hasText: option }).first();
    if (!await shown(opt, 3_000)) {
        await page.keyboard.press('Escape');
        await panel.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => { });
        return '';
    }
    const text = (await opt.innerText()).trim();
    await opt.click();
    await panel.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => { });
    await page.waitForTimeout(500);              // dependent fields render after the choice
    return text;
}

async function kfToday(page: Page, key: string, g = 0) {
    const button = kf(page, key, g).locator('button[aria-label="Open calendar"]').first();
    if (!await button.isVisible().catch(() => false)) return;
    if (!await button.click(soft).then(() => true).catch(() => false)) return;
    await page.locator('.mat-calendar-body-today').click(soft).catch(() => page.keyboard.press('Escape'));
}

async function kfImage(page: Page, g = 0, option = 1) {
    const select = kf(page, 'tagging_DI', g).locator('mat-select[id$="docname"]').first();
    if (!await select.isVisible().catch(() => false)) return;
    if (!await select.click(soft).then(() => true).catch(() => false)) return;
    await page.locator('mat-option').nth(option).click(soft).catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(300);
}

/** Clicks a field (a mat-select wrapper), then the option at `option` (spec 04 style). */
async function chooseField(page: Page, selector: string, option: number): Promise<string> {
    if (!await present(page, selector)) return '';
    if (!await page.locator(selector).first().click(soft).then(() => true).catch(() => false)) return '';
    const opt = page.locator('span[class="mdc-list-item__primary-text"]').nth(option);
    if (!await shown(opt, 3_000)) { await page.keyboard.press('Escape'); return ''; }
    const text = (await opt.innerText().catch(() => '')).trim();
    await opt.click(soft).catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(300);
    return text;
}

/** Clicks a rich-text field and types into it (Recording Statement, Legal Description). */
async function typeInto(page: Page, selector: string, text: string) {
    if (!await present(page, selector)) return;
    if (!await page.locator(selector).first().click(soft).then(() => true).catch(() => false)) return;
    await page.keyboard.type(text);
}

/** Adds a Document Information group and returns its data-group-index, or -1 when the form has none. */
async function addDocInfoGroup(page: Page): Promise<number> {
    const instruments = page.locator('div.form-field[data-field-key="instrument_Name_DI"]');
    const before = await instruments.count();
    if (!before) return -1;
    const docInfoArray = page.locator('#DocumentInformation .array-group', {
        has: page.locator('div.form-field[data-field-key="instrument_Name_DI"]'),
    }).last();
    const add = docInfoArray.locator(':scope > div.text-end button[mattooltip="Add"]');
    if (!await add.click(soft).then(() => true).catch(() => false)) return -1;
    const deadline = Date.now() + 10_000;
    while (await instruments.count() <= before && Date.now() < deadline) await page.waitForTimeout(300);
    if (await instruments.count() <= before) return -1;
    await page.waitForTimeout(500);
    return before;
}

const mersInd = (isMers: boolean) => (isMers ? /^\s*Yes\s*$/i : /^\s*No\s*$/i);

/**
 * Beneficiary Search → searches the beneficiary by Assignor, then Assignee → selects it with the
 * expected MERS Indicator → Submit (spec 04). Skipped when the form has no Beneficiary Search.
 */
async function selectBeneficiary(page: Page, client: string) {
    const { name: beneName, mers: isMers } = beneficiary(client);
    const label = isMers ? 'MERS' : 'Non-MERS';
    const open = page.locator('button[mattooltip="Beneficiary Search"]').first();
    if (!await open.isVisible().catch(() => false)) return;
    await open.click();

    const items = page.locator('.beneficiary-list .beneficiary-item:not(.no-data-card)');
    const noRecord = page.locator('.beneficiary-list .no-data-card', { hasText: 'No Record Found' });
    const namePattern = new RegExp(beneName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'), 'i');
    const byName = items.filter({ hasText: namePattern });
    const assignorInput = page.locator('input[placeholder="Assignor"]');
    const assigneeInput = page.locator('input[placeholder="Assignee"]');
    for (const [input, other] of [[assignorInput, assigneeInput], [assigneeInput, assignorInput]]) {
        await other.fill('');
        await input.fill(beneName);
        await page.locator('button.search-button').click();
        await items.first().or(noRecord).waitFor({ state: 'visible', timeout: 20_000 }).catch(() => { });
        await page.waitForTimeout(500);
        if ((await byName.count()) > 0) break;
    }
    const match = byName.filter({ has: page.locator(`.assignor-section .mers-indicator.${isMers ? 'yes' : 'no'}`) }).first();
    if ((await match.count()) === 0) {
        // Say what came back: nothing, the name with the other MERS Indicator, or other names.
        const returned = await items.evaluateAll(els => els.map(el => {
            const name = el.querySelector('.assignor-section .fw-medium')?.textContent?.trim() || el.textContent?.trim().slice(0, 60) || '?';
            const ind = el.querySelector('.assignor-section .mers-indicator');
            const mers = ind?.classList.contains('yes') ? 'Yes' : ind?.classList.contains('no') ? 'No' : '?';
            return `${name} (MERS ${mers})`;
        })).catch(() => [] as string[]);
        await page.keyboard.press('Escape').catch(() => { });
        const why = !returned.length ? 'search returned no results'
            : await byName.count() ? `found, but MERS Indicator is not ${isMers ? 'Yes' : 'No'}`
            : 'name not in results';
        throw new Error(`${label} beneficiary "${beneName}" for ${client}: ${why}. Results: ${returned.slice(0, 5).join(' | ') || 'none'}`);
    }
    await match.locator('.radio-selection .mdc-radio').click();
    await page.locator('button:has-text(" Submit ")').click();
    await page.waitForTimeout(1_000);
}

async function setAllOriginalLenderMersInd(page: Page, isMers: boolean) {
    const fields = page.locator('div.form-field[data-field-key="original_Lender_MERS_Ind_DI"]');
    const count = await fields.count();
    for (let i = 0; i < count; i++) {
        const g = Number(await fields.nth(i).getAttribute('data-group-index'));
        await kfSelect(page, 'original_Lender_MERS_Ind_DI', g, mersInd(isMers));
    }
}

/** Keying page opens and carries the order's client and customer number. */
async function openKeying(page: Page, o: Order) {
    await openOrder(page, o.orderId, 'keying');
    if (!await shown(page.locator('#clientId'), 30_000)) throw new Error(`keying form did not load (${page.url()})`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => { });
    const client = (await page.locator('#clientId .mat-mdc-select-value-text .mat-mdc-select-min-line').textContent().catch(() => '')) ?? '';
    const custNo = await page.locator('#customerOrderNumber').inputValue().catch(() => '');
    const wrong: string[] = [];
    if (loose(client) !== loose(o.client)) wrong.push(`Client: expected "${o.client}", got "${client.trim()}"`);
    if (custNo && loose(custNo) !== loose(o.customerNumber)) wrong.push(`Customer Order #: expected "${o.customerNumber}", got "${custNo}"`);
    if (wrong.length) throw new Error(`keyed fields differ — ${wrong.join('; ')}`);
}

/** Deed of trust, Assignment of Mortgage and CEMA groups, recording, property info and the client's beneficiary. */
async function fillAomKeying(page: Page, client: string) {
    const { mers } = beneficiary(client);
    // Document Information 1: Deed of trust
    await kfSelect(page, 'instrument_Name_DI', 0, /^\s*Deed of trust\s*$/i);
    await kfFill(page, 'borrower_DI', faker.person.firstName(), 0);
    await kfFill(page, 'number_Of_Borrowers', '1', 0);
    await kfToday(page, 'instrument_Date_DI', 0);
    await kfToday(page, 'maturity_Date_DI', 0);
    await kfFill(page, 'consideration_Amount_DI', faker.finance.amount({ min: 1000, max: 10000, dec: 2 }), 0);
    await kfFill(page, 'original_Lender_DI', faker.person.firstName(), 0);
    await kfFill(page, 'original_Lender_Address_DI', faker.location.streetAddress(), 0);
    await kfSelect(page, 'original_Lender_MERS_Ind_DI', 0, mersInd(mers));
    await kfFill(page, 'trustee_DI', faker.person.firstName(), 0);
    await kfSelect(page, 'recorded_State_DI', 0, 0);
    await kfSelect(page, 'recorded_County_DI', 0, 4);
    await kfSelect(page, 'recorded_Agency_DI', 0, 1);
    await kfToday(page, 'recorded_Date_DI', 0);
    await kfFill(page, 'recorded_Book_DI', faker.number.int({ min: 100000, max: 999999 }).toString(), 0);
    await kfFill(page, 'recorded_Page_DI', faker.number.int({ min: 100000, max: 999999 }).toString(), 0);
    await kfImage(page, 0, 1);

    // Document Information 2: Assignment of Mortgage
    const g2 = await addDocInfoGroup(page);
    if (g2 >= 0) {
        await kfSelect(page, 'instrument_Name_DI', g2, /^\s*Assignment of Mortgage\s*$/i);
        await kfFill(page, 'borrower_DI', faker.person.firstName(), g2);
        await kfToday(page, 'instrument_Date_DI', g2);
        await kfSelect(page, 'recorded_State_DI', g2, 0);
        await kfSelect(page, 'recorded_County_DI', g2, 4);
        await kfSelect(page, 'recorded_Agency_DI', g2, 1);
        await kfToday(page, 'recorded_Date_DI', g2);
        await kfFill(page, 'recorded_Book_DI', faker.number.int({ min: 100000, max: 999999 }).toString(), g2);
        await kfFill(page, 'recorded_Page_DI', faker.number.int({ min: 100000, max: 999999 }).toString(), g2);
        await kfSelect(page, 'assignor_MERS_Ind_DI', g2, 0);
        await kfFill(page, 'assignor_DI', faker.person.firstName(), g2);
        await kfFill(page, 'assignor_Address_DI', faker.location.streetAddress(), g2);
        await kfSelect(page, 'assignee_MERS_Ind_DI', g2, 0);
        await kfFill(page, 'assignee_DI', faker.person.firstName(), g2);
        await kfFill(page, 'assignee_Address_DI', faker.location.streetAddress(), g2);
        await kfImage(page, g2, 2);
    }

    // Document Information 3: CEMA
    const g3 = await addDocInfoGroup(page);
    if (g3 >= 0) {
        await kfSelect(page, 'instrument_Name_DI', g3, /CEMA/i);
        await kfFill(page, 'borrower_DI', faker.person.firstName(), g3);
        await kfFill(page, 'number_Of_Borrowers', '1', g3);
        await kfToday(page, 'instrument_Date_DI', g3);
        await kfToday(page, 'maturity_Date_DI', g3);
        await kfFill(page, 'consideration_Amount_DI', faker.finance.amount({ min: 1000, max: 10000, dec: 2 }), g3);
        await kfFill(page, 'original_Lender_DI', faker.person.firstName(), g3);
        await kfFill(page, 'original_Lender_Address_DI', faker.location.streetAddress(), g3);
        await kfSelect(page, 'original_Lender_MERS_Ind_DI', g3, mersInd(mers));
        await kfSelect(page, 'recorded_State_DI', g3, 0);
        await kfSelect(page, 'recorded_County_DI', g3, 4);
        await kfSelect(page, 'recorded_Agency_DI', g3, 1);
        await kfToday(page, 'recorded_Date_DI', g3);
        await kfFill(page, 'recorded_Book_DI', faker.number.int({ min: 100000, max: 999999 }).toString(), g3);
        await kfFill(page, 'recorded_Page_DI', faker.number.int({ min: 100000, max: 999999 }).toString(), g3);
        await kfImage(page, g3, 3);
    }

    // Recording Category / Property Information
    await chooseField(page, 'div[data-field-key="recording_Type_RC"]', 0);
    await typeInto(page, 'div[data-field-key="recording_Statement_RC"]', faker.company.catchPhrase());
    await typeInto(page, 'div[data-field-key="legal_Description_Preamble_PI"]', faker.lorem.sentences(3));
    await chooseField(page, 'div[data-field-key="sub_Division_PI"]', 1);
    await fill(page, 'input[id="section_PI"]', faker.number.int({ min: 1, max: 9999 }).toString());
    await fill(page, 'input[id="block_PI"]', faker.string.alpha({ length: 2, casing: 'upper' }));
    await fill(page, 'input[id="lot_PI"]', faker.number.int({ min: 1, max: 9999 }).toString());
    await fill(page, 'input[id="sub_Lot_PI"]', faker.number.int({ min: 1, max: 9999 }).toString());
    await fill(page, 'input[id="plat_Number_PI"]', faker.number.int({ min: 1, max: 9999 }).toString());
    // MIN Number is required for a MERS beneficiary, optional (left empty) for Non-MERS.
    await fill(page, 'input[id="min_Number_DI"]', mers ? faker.number.int({ min: 1, max: 9999 }).toString() : '');

    await selectBeneficiary(page, client);
}

/** QC pass: Title Order Data image and a QC Deed of trust group, keeping the client's beneficiary and MERS rules. */
async function fillAomQcKeying(page: Page, client: string) {
    const { mers } = beneficiary(client);
    await chooseField(page, 'div[data-field-key="document_Name_TOD"]', 3);

    await kf(page, 'instrument_Name_DI', 0).waitFor({ state: 'visible', timeout: 15_000 }).catch(() => { });
    const g = await addDocInfoGroup(page);
    if (g >= 0) {
        await kfSelect(page, 'instrument_Name_DI', g, /^\s*Deed of trust\s*$/i);
        await kfFill(page, 'borrower_DI', faker.person.firstName(), g);
        await kfFill(page, 'number_Of_Borrowers', '1', g);
        await kfToday(page, 'instrument_Date_DI', g);
        await kfFill(page, 'consideration_Amount_DI', faker.finance.amount({ min: 1000, max: 10000, dec: 2 }), g);
        await kfFill(page, 'original_Lender_DI', faker.person.firstName(), g);
        await kfFill(page, 'original_Lender_Address_DI', faker.location.streetAddress(), g);
        await kfSelect(page, 'original_Lender_MERS_Ind_DI', g, mersInd(mers));
        await kfFill(page, 'trustee_DI', faker.person.firstName(), g);
        await kfSelect(page, 'recorded_State_DI', g, 0);
        await kfSelect(page, 'recorded_County_DI', g, 4);
        await kfSelect(page, 'recorded_Agency_DI', g, 1);
        await kfToday(page, 'recorded_Date_DI', g);
        await kfImage(page, g, 4);
    }

    // The beneficiary saved in keying stays; every group's Original Lender MERS Ind follows it,
    // and MIN Number is kept for MERS / left empty for Non-MERS.
    await setAllOriginalLenderMersInd(page, mers);
    if (mers) {
        const min = page.locator('input[id="min_Number_DI"]');
        if (await min.isVisible().catch(() => false) && !(await min.inputValue().catch(() => '')).trim()) {
            await min.fill(faker.number.int({ min: 1, max: 9999 }).toString(), soft).catch(() => { });
        }
    } else {
        await fill(page, 'input[id="min_Number_DI"]', '');
    }
}

/**
 * Save → Complete → "Yes" on Incomplete Tagging. Fails with the invalid fields named when the
 * app shows "invalid or missing information" (spec 04 afterComplete). `confirm` clicks the QC
 * Confirm button (Changed Fields) afterwards.
 */
async function saveAndComplete(page: Page, contextName: string, confirm = false) {
    // Close any dropdown/date panel left open by the fill: its backdrop would swallow the clicks.
    await page.keyboard.press('Escape').catch(() => { });
    await page.locator('.cdk-overlay-backdrop').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => { });

    await clickReady(page, page.locator('button[mattooltip="Save"]').first(), `${contextName} Save`);
    await waitForSpinner(page);
    await page.waitForTimeout(1_000);
    const complete = page.locator('button[mattooltip="Complete"]').first();
    // A disabled Complete usually means the form is still invalid: name the fields instead of timing out.
    if (await complete.isDisabled().catch(() => false)) {
        await page.waitForTimeout(3_000);
        if (await complete.isDisabled().catch(() => false)) {
            const missing = [...new Set(await invalidControls(page).catch(() => [] as string[]))];
            throw new Error(`${contextName} Complete button is disabled${missing.length ? ` — invalid/missing: ${missing.join(', ')}` : ''}`);
        }
    }
    await clickReady(page, complete, `${contextName} Complete`);
    await waitForSpinner(page);
    await page.waitForTimeout(1_000);

    const taggingDialog = page.locator('mat-dialog-container', { hasText: 'Incomplete Tagging' });
    if (await shown(taggingDialog, 2_000)) {
        await taggingDialog.locator('button:has-text("Yes")').click();
        await page.waitForTimeout(1_500);
    }
    const invalidToast = page.locator('.toast-message', { hasText: 'invalid or missing information' });
    if (await shown(invalidToast.first(), 1_500)) {
        const missing = [...new Set(await invalidControls(page).catch(() => [] as string[]))];
        throw new Error(`${contextName} Complete blocked — invalid/missing: ${missing.join(', ') || 'unknown field'}`);
    }
    const confirmButton = page.locator('button[color="success"]').filter({ visible: true }).first();
    if (confirm) {
        if (await shown(confirmButton, 30_000)) await clickReady(page, confirmButton, `${contextName} Confirm`);
        await waitForSpinner(page);
        await page.waitForTimeout(1_000);
    }
    // "Service unavailable. Please try again later." is a temporary server overload (several lanes
    // completing at once): wait, then click Confirm (or Complete) again instead of failing the order.
    const busy = page.locator('.toast-container, .toast-message').filter({ hasText: /service unavailable|try again later/i }).first();
    for (let attempt = 1; attempt <= 4 && await shown(busy, 2_000); attempt++) {
        console.log(`   ⏳ ${contextName}: "Service unavailable" — retry ${attempt}/4 in ${15 * attempt}s`);
        await page.waitForTimeout(15_000 * attempt);
        await busy.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => { });
        if (confirm && await shown(confirmButton, 2_000)) {
            await clickReady(page, confirmButton, `${contextName} Confirm (retry ${attempt})`);
        } else if (await complete.isVisible().catch(() => false) && await complete.isEnabled().catch(() => false)) {
            await clickReady(page, complete, `${contextName} Complete (retry ${attempt})`);
            await waitForSpinner(page);
            if (await shown(taggingDialog, 2_000)) await taggingDialog.locator('button:has-text("Yes")').click().catch(() => { });
            if (confirm && await shown(confirmButton, 30_000)) await clickReady(page, confirmButton, `${contextName} Confirm (retry ${attempt})`);
        }
        await waitForSpinner(page);
        await page.waitForTimeout(1_500);
    }
    await failOnErrorToast(page, `${contextName} Complete`, 1_000);
}

// ---------------------------------------------------------------------------
// Batching / signing / recording (spec 04)
// ---------------------------------------------------------------------------

/**
 * Batch creation is serialised across lanes: the app names a batch after the second it was
 * submitted (Batch-yyyyMMddHHmmss), so two lanes submitting in the same second got the same name
 * and the Printing search could not tell them apart.
 */
let batchLock: Promise<unknown> = Promise.resolve();
function withBatchLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = batchLock.then(fn, fn);
    batchLock = run.catch(() => { }).then(() => new Promise(r => setTimeout(r, 1_500)));
    return run;
}

/**
 * Batches grid → ticks every order of the group (the grid keeps ticks while the search changes)
 * → returns the orders that could not be found or ticked.
 */
async function tickOrdersForBatch(page: Page, group: Outcome[]): Promise<{ ticked: Outcome[]; missing: { o: Outcome; why: string }[] }> {
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await page.goto(`${Q}/batching/batches`, { waitUntil: 'domcontentloaded' });
    const search = page.locator('input[placeholder="Search keyword"]').first();
    await search.waitFor({ state: 'visible', timeout: 60_000 })
        .catch(() => { throw new Error('"Search keyword" box not shown on the Batches grid after 60s'); });
    await waitForSpinner(page);
    const ticked: Outcome[] = [];
    const missing: { o: Outcome; why: string }[] = [];
    for (const o of group) {
        const pattern = new RegExp(`\\b(${esc(o.customerNumber)}|${esc(o.orderId)})\\b`);
        let row: Locator | null = null;
        for (let attempt = 1; attempt <= 3 && !row; attempt++) {
            await search.fill(o.customerNumber);
            await page.waitForTimeout(1_500);
            const match = page.locator('.ag-row').filter({ hasText: pattern }).first();
            if (await shown(match, 10_000)) {
                const idx = await match.getAttribute('row-index');
                row = idx !== null ? page.locator(`.ag-row[row-index="${idx}"]`) : match;
            } else {
                await search.fill('');
                await page.waitForTimeout(3_000);    // the order may still be arriving in this queue
            }
        }
        if (!row) { missing.push({ o, why: 'not in the Batches grid' }); continue; }
        const ok = await tickRow(page, row, 'Batches').then(() => true).catch(() => false);
        if (ok) ticked.push(o); else missing.push({ o, why: "could not tick its checkbox in the Batches grid" });
    }
    await search.fill('');
    await page.waitForTimeout(1_500);
    return { ticked, missing };
}

/** Creates one batch for the ticked group. Returns its name and details URL. */
async function createBatch(page: Page): Promise<{ batch: string; batchUrl: string }> {
    await clickReady(page, page.locator('button[mattooltip="Create a new batch"]').first(), 'Create a new batch');

    // Only the panel matching the order's MERS indicator is visible (the other has d-none).
    const signorPanel = page.locator('mat-expansion-panel:not(.d-none)')
        .filter({ has: page.locator('span.badge', { hasText: /Signor Group/i }) }).first();
    const signorBadge = signorPanel.locator('span.badge', { hasText: /Signor Group/i });
    await signorBadge.waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => { throw new Error('Signor Group panel not shown after "Create a new batch"'); });
    await signorBadge.click();
    // Signor 1, Signor 2, Witness 1, Witness 2, Notary 1, Notary 2, Preparer, Return To, Notary block
    const choices = [1, 1, 1, 1, 1, 1, 1, 1, 0];
    const names = ['Signor 1', 'Signor 2', 'Witness 1', 'Witness 2', 'Notary 1', 'Notary 2', 'Preparer', 'Return To', 'Notary block'];
    for (let i = 0; i < choices.length; i++) {
        await signorPanel.locator('div[class="mat-mdc-form-field-flex"]').nth(i).click({ timeout: 10_000 })
            .catch(() => { throw new Error(`${names[i]} dropdown not found`); });
        await page.locator('span[class="mdc-list-item__primary-text"]').nth(choices[i]).click({ timeout: 10_000 })
            .catch(() => { throw new Error(`${names[i]} has no option ${choices[i]}`); });
        await page.locator('.mat-mdc-select-panel').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => { });
    }
    await clickReady(page, page.locator('button[mattooltip="Submit"]').first(), 'batch Submit');
    await waitForSpinner(page);
    await page.waitForTimeout(1_000);

    const invalid = page.locator('.mat-mdc-form-field-invalid, mat-form-field.mat-form-field-invalid');
    if (await errorToast(page).isVisible().catch(() => false) || await invalid.count() > 0) {
        const toast = norm(await errorToast(page).innerText().catch(() => ''));
        const labels = await invalid.locator('label, mat-label, .mdc-floating-label').allInnerTexts().catch(() => [] as string[]);
        throw new Error(`batch Submit blocked${toast ? ` — "${toast}"` : ''}${labels.length ? `; invalid: ${labels.join(', ')}` : ''}`);
    }

    await page.waitForURL(/batching\/\d+\/batch-details/, { timeout: 60_000 })
        .catch(() => { throw new Error('batch details did not open after Submit'); });
    const batchUrl = page.url();
    const batch = ((await page.locator('h2').first().textContent().catch(() => '')) ?? '').match(/Batch-\d+/)?.[0] ?? '';
    return { batch, batchUrl };
}

/** Batch details → Refresh until generation completes or fails. A bigger batch gets more time. */
async function waitForGeneration(page: Page, batchUrl: string, size: number): Promise<string> {
    if (!page.url().includes(batchUrl.replace(/^https?:\/\/[^/]+/, ''))) await page.goto(batchUrl, { waitUntil: 'domcontentloaded' });
    const generation = page.locator('span.badge.text-outline-primary, span.badge.text-outline-danger')
        .filter({ hasText: /Generation Completed|Generation Failed/ }).first();
    const limitMs = Math.min(600_000, 180_000 + 30_000 * size);
    const deadline = Date.now() + limitMs;
    while (!await shown(generation, 3_000) && Date.now() < deadline) {
        await page.locator('button[mattooltip="Refresh Data"]').click(soft).catch(() => { });
        await page.waitForTimeout(3_000);
    }
    const statusText = (await generation.textContent().catch(() => '') ?? '').trim();
    if (!statusText) throw new Error(`batch generation did not finish in ${Math.round(limitMs / 60_000)} min`);
    if (/Generation Failed/.test(statusText)) throw new Error(`Batch Generation Failed (${batchUrl})`);
    return statusText;
}

/** Printing → this batch → Actions → Complete Batch. */
async function completeBatch(page: Page, o: Outcome) {
    if (!o.batch) throw new Error('no batch recorded for this order');
    // The Printing route is taken from the menu link (spec 04 clicks a[href*="/printing"]).
    let printing = `${Q}/batching/printing`;
    if (o.batchUrl) {
        await page.goto(o.batchUrl, { waitUntil: 'domcontentloaded' });
        const href = await page.locator('a[href*="/printing"]').first().getAttribute('href', { timeout: 15_000 }).catch(() => null);
        if (href) printing = href;
    }
    const row = await queueRow(page, printing, o.batch);
    await row.locator('button[aria-label="Actions"]').first().click();
    await menuItem(page, /Complete Batch/i, 2);
    await page.waitForTimeout(1_500);
    await failOnErrorToast(page, 'Complete Batch', 1_000);
}

/**
 * Documents tab → Generated Document → its PDF bytes, from the preview API response, a download
 * or the viewer tab (spec 04). Saved per order so lanes never touch each other's files.
 */
async function saveGeneratedDocument(page: Page, o: Outcome): Promise<string> {
    if (!await waitForDocument(page, o, 'Generated Document', 90_000)) throw new Error('"Generated Document" not generated');
    const link = page.locator('a.name-link', { hasText: 'Generated Document' }).first();

    const previewPromise = page.waitForResponse(
        r => /\/api\/orders\/\d+\/documents\/\d+\/preview/.test(r.url()) && r.request().method() === 'GET', { timeout: 60_000 }).catch(() => null);
    const popupPromise = page.context().waitForEvent('page', { timeout: 30_000 }).catch(() => null);
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 }).catch(() => null);
    await link.click();

    let base64 = '';
    const preview = await previewPromise;
    if (preview && preview.ok()) base64 = (await preview.json().catch(() => null))?.docBytes || '';
    if (base64) {
        popupPromise.then(p => p?.close().catch(() => { }));
    } else {
        const [popup, download] = await Promise.all([popupPromise, downloadPromise]);
        if (download) {
            base64 = fs.readFileSync(await download.path()).toString('base64');
        } else if (popup) {
            await popup.waitForLoadState('domcontentloaded').catch(() => { });
            base64 = await popup.evaluate(async () => {
                const blob = await (await fetch(window.location.href)).blob();
                return await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => resolve(reader.result?.toString().split(',')[1] || '');
                    reader.onerror = reject;
                });
            });
            await popup.close().catch(() => { });
        }
    }
    if (!base64) throw new Error('could not capture the Generated Document PDF');

    fs.mkdirSync(DOC_DIR, { recursive: true });
    const file = path.join(DOC_DIR, `GeneratedDocument_${o.orderId}.pdf`);
    fs.writeFileSync(file, Buffer.from(base64, 'base64'));
    // Close any viewer overlay the click left open.
    await page.keyboard.press('Escape').catch(() => { });
    return file;
}

/** Sent For External Signing → row Actions → first item (ingest) → upload the signed PDF. */
async function ingestSignedDocument(page: Page, o: Outcome) {
    if (!o.signedDoc || !fs.existsSync(o.signedDoc)) throw new Error('signed document file missing');
    const row = await queueRow(page, `${Q}/batching/sent-for-external-signing`, o.customerNumber, [o.orderId]);
    await row.locator('div[col-id="actions"]').first().click();
    await page.locator('span[class="mat-mdc-menu-item-text"]').nth(0).click({ timeout: 10_000 });
    const input = page.locator('input[type="file"]');
    await input.waitFor({ state: 'attached', timeout: 15_000 });
    await input.setInputFiles(o.signedDoc);
    await page.locator('div[class="d-flex footer"]').click();
    await failOnErrorToast(page, 'signed document upload');
    await page.locator('span[class="toast-message"]').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => { });
}

/**
 * Ticks the row's selection checkbox and confirms it is ticked: a click that lands while the grid
 * re-renders is lost, and the action button then runs with nothing selected.
 */
async function tickRow(page: Page, row: Locator, grid: string) {
    const box = row.locator('div.ag-selection-checkbox input[type="checkbox"]').first();
    for (let attempt = 1; attempt <= 3; attempt++) {
        await waitForSpinner(page);
        await box.click({ timeout: 30_000 }).catch(() => row.locator('div.ag-selection-checkbox').first().click({ timeout: 10_000 }).catch(() => { }));
        await page.waitForTimeout(500);
        if (await box.isChecked().catch(() => false)) return;
    }
    throw new Error(`could not tick the order's checkbox in the ${grid} grid`);
}

/**
 * Received From Signing → tick this order → Send for Recording, waiting for the request it sends.
 * Returns the server's answer for the error message, if it rejected the request.
 */
async function sendForRecording(page: Page, o: Outcome): Promise<string> {
    const row = await queueRow(page, `${Q}/batching/received-from-signing`, o.customerNumber, [o.orderId]);
    await tickRow(page, row, 'Received From Signing');
    const sent = page.waitForResponse(r => r.request().method() !== 'GET'
        && ['xhr', 'fetch'].includes(r.request().resourceType()), { timeout: 60_000 }).catch(() => null);
    await clickReady(page, page.locator('button[aria-label="Send for Recording"]').first(), 'Send for Recording');
    const resp = await sent;
    await waitForSpinner(page);
    await failOnErrorToast(page, 'Send for Recording');
    if (!resp) return 'no request was sent after clicking "Send for Recording"';
    if (!resp.ok()) return `request rejected: HTTP ${resp.status()} ${(await resp.text().catch(() => '')).slice(0, 150)}`;
    return '';
}

/** Recordation Monitoring → row Actions → Reject with severity, three issue types and a note. */
async function rejectFromRecordation(page: Page, o: Outcome) {
    const row = await queueRow(page, `${Q}/recordation/recordation-monitoring`, o.customerNumber, [o.orderId]);
    await row.locator('div[col-id="actions"]').first().click();
    await page.locator('button:has-text(" Reject ")').first().click({ timeout: 10_000 });
    await page.locator('textarea[formcontrolname="note"]').waitFor({ state: 'visible', timeout: 15_000 });

    await page.locator('div[class="col-md-12 ng-star-inserted"]').nth(0).click();          // Severity
    await page.locator('span[class="mdc-list-item__primary-text"]').nth(1).click();
    await page.locator('div[class="col-md-12 ng-star-inserted"]').nth(1).click();          // Issue Type (multi)
    for (const i of [1, 2, 3]) await page.locator('span[class="mdc-list-item__primary-text"]').nth(i).click();
    await page.keyboard.press('Tab');
    await page.locator('textarea[formcontrolname="note"]').fill('Testing Reject Order');
    await page.locator('button:has-text("Submit")').click();
    await failOnErrorToast(page, 'Recordation reject');
}

// ---------------------------------------------------------------------------
// The AOM workflow — each step acts, then verifies
// ---------------------------------------------------------------------------

/** Per order, in its lane: creation → … → QC COMPLETED. The order then waits for its batch group. */
const PRE_BATCH: Step[] = [
    { name: 'Customer Number Format', run: async ({ page }, o) => {
        // LoanCare - OM only: the stored Customer Order Number is left-padded to 10 digits.
        const len = padLength(o.client);
        if (!len) return;
        const row = await queueRow(page, `${Q}/customer-support/hold`, o.customerNumber, [o.orderId])
            .catch(() => { throw new Error(`typed "${o.typedCustomerNumber}" → expected "${o.customerNumber}", not found in the Hold queue`); });
        const actual = (await row.locator('div[col-id="customerOrderNumber"]').first().innerText({ timeout: 10_000 }).catch(() => '')).trim();
        if (actual !== o.customerNumber || actual.length !== len) {
            throw new Error(`typed "${o.typedCustomerNumber}" → expected "${o.customerNumber}", got "${actual}"`);
        }
    } },
    { name: 'Documents Uploaded', run: async ({ page }, o) => {
        await uploadDocuments(page, o);
    } },
    { name: 'KEYING IN PROGRESS', status: 'KEYING IN PROGRESS', run: async ({ page }, o) => {
        await moveTo(page, o, 'KEYING IN PROGRESS', 'HOLD');
        await openKeying(page, o);
    } },
    { name: 'QUALITY CHECK', status: 'QUALITY CHECK', run: async ({ page }, o) => {
        await keyAndComplete(page, o, 'QUALITY CHECK', 'KEYING IN PROGRESS', async () => {
            await openKeying(page, o);
            await fillAomKeying(page, o.client);
            await fillRequiredEmpty(page);
            await saveAndComplete(page, 'Keying');
        });
        // Optional checks skipped for speed: Quality Check queue lookup and "Supporting Documents".
    } },
    { name: 'QC COMPLETED', status: 'QC COMPLETED', run: async ({ page }, o) => {
        await keyAndComplete(page, o, 'QC COMPLETED', 'QUALITY CHECK', async () => {
            await openKeying(page, o);
            await fillAomQcKeying(page, o.client);
            await fillRequiredEmpty(page);
            await saveAndComplete(page, 'Keying : QC', true);
        });
    } },
];

// SIGNING PREPARATION (Batch) and SENT FOR EXTERNAL SIGNING (Complete Batch) run once per group
// of orders in runBatchGroup. These steps then run for each order of the group.
const POST_BATCH: Step[] = [
    { name: 'Generated Document saved', run: async ({ page }, o) => {
        if (VERIFY_HISTORY) await expectHistory(page, o, 'SENT FOR EXTERNAL SIGNING', 'SIGNING PREPARATION');
        o.signedDoc = await saveGeneratedDocument(page, o);
    } },
    { name: 'RECEIVED FROM SIGNING', status: 'RECEIVED FROM SIGNING', run: async ({ page }, o) => {
        await ingestSignedDocument(page, o);
        await expectHistory(page, o, 'RECEIVED FROM SIGNING', 'SENT FOR EXTERNAL SIGNING');
        if (!await waitForDocument(page, o, 'To Be Recorded Image', 30_000)) {
            note(o, 'To Be Recorded Image not found');   // keep the PDF: it may be needed to check what went wrong
            return;
        }
        // CLEAN UP (safe point): the app now holds the uploaded copy as "To Be Recorded Image",
        // so the downloaded Generated Document is no longer needed on disk.
        if (o.signedDoc && fs.existsSync(o.signedDoc)) {
            try { fs.unlinkSync(o.signedDoc); o.signedDoc = undefined; }
            catch (err) { note(o, `could not delete local Generated Document: ${firstLine(err)}`); }
        }
    } },
    { name: 'SENT FOR RECORDING', status: 'SENT FOR RECORDING', run: async ({ page }, o) => {
        // If History doesn't show the move, the send didn't take: send once more before failing.
        const first = await sendForRecording(page, o);
        const moved = await expectHistory(page, o, 'SENT FOR RECORDING', 'RECEIVED FROM SIGNING', 60_000)
            .then(() => true).catch(() => false);
        if (!moved) {
            console.log(`   #${o.orderNo} ↻ Send for Recording didn't take${first ? ` (${first})` : ''}; sending again`);
            // If the order already left the queue (History was just slow), the retry is skipped.
            const second = await sendForRecording(page, o).catch(e => `retry skipped: ${firstLine(e)}`);
            await expectHistory(page, o, 'SENT FOR RECORDING', 'RECEIVED FROM SIGNING').catch(err => {
                throw new Error(`${firstLine(err)} after sending twice${second || first ? ` — ${second || first}` : ''}`);
            });
        }
    } },
    { name: 'Rejected (Recordation)', status: 'REJECTS QUEUE', run: async ({ page }, o) => {
        await rejectFromRecordation(page, o);
        await expectInQueue(page, `${Q}/quality-control/rejects`, o, 'Rejects');
    } },
];

/** Saves a full-page screenshot for a failed step and stores its path on the order. */
async function failShot(page: Page, o: Outcome, stepName: string) {
    const shot = path.join(SCREEN_DIR, `${String(o.orderNo).padStart(3, '0')}_${o.orderId}_${stepName.replace(/[^\w]+/g, '-')}.png`);
    fs.mkdirSync(SCREEN_DIR, { recursive: true });
    if (await page.screenshot({ path: shot, fullPage: true, timeout: 15_000 }).then(() => true).catch(() => false)) o.screenshot = shot;
}

/** Runs steps in order for one order; the first failure throws "<step>: <reason>" after a screenshot. */
async function runSteps(ctx: Ctx, o: Outcome, steps: Step[], progress: Record<number, Outcome>) {
    for (const step of steps) {
        try {
            await step.run(ctx, o);
        } catch (err) {
            await failShot(ctx.page, o, step.name);
            throw new Error(`${step.name}: ${describeError(err)}`);
        }
        o.lastStep = step.name;
        o.reached = step.status ?? o.reached;
        progress[o.orderNo] = o;
        saveProgress(progress);
        console.log(`   #${o.orderNo} ✅ ${step.name}`);
    }
}

const finish = (o: Outcome, result: Outcome['result'], error = '') => {
    o.result = result;
    o.error = error;
    console.log(result === 'Done'
        ? `   #${o.orderNo} 🏁 Done (${o.seconds ?? 0}s)`
        : `   #${o.orderNo} ❌ ${error} (${o.seconds ?? 0}s)`);
};

/**
 * One batch for a group of orders of the same client (the Signor Group panel follows the
 * order's MERS indicator, so clients aren't mixed): tick all → Create → Submit → Generation
 * Completed → Complete Batch, then the per-order steps (signed document, recording, reject).
 */
async function runBatchGroup(ctx: Ctx, group: Outcome[], progress: Record<number, Outcome>, retry = false) {
    const started = Date.now();
    const ids = group.map(o => `#${o.orderNo}`).join(' ');
    console.log(`📦 Batch for ${group[0].client}: ${ids}`);
    const share = (since: number, n: number) => Math.round((Date.now() - since) / 1000 / Math.max(1, n));
    const failAll = async (orders: Outcome[], step: string, err: unknown) => {
        const msg = `${step}: ${describeError(err)}`;
        if (orders[0]) await failShot(ctx.page, orders[0], step);
        for (const o of orders) {
            o.screenshot = orders[0]?.screenshot;
            o.seconds = (o.seconds ?? 0) + share(started, orders.length);
            finish(o, 'Blocked', msg);
        }
        saveProgress(progress);
    };

    // SIGNING PREPARATION (Batch): one lane at a time, so batch names never collide.
    let members: Outcome[] = [];
    const retryLater: Outcome[] = [];
    const runRetry = async () => { if (retryLater.length) await runBatchGroup(ctx, retryLater, progress, true); };
    let info = { batch: '', batchUrl: '' };
    try {
        info = await withBatchLock(async () => {
            const { ticked, missing } = await tickOrdersForBatch(ctx.page, group);
            for (const { o, why } of missing) {
                o.seconds = (o.seconds ?? 0) + share(started, group.length);
                finish(o, 'Blocked', `SIGNING PREPARATION (Batch): ${why}`);
            }
            members = ticked;
            if (!members.length) throw new Error('none of the group could be ticked in the Batches grid');
            return createBatch(ctx.page);
        });
        const statusText = await waitForGeneration(ctx.page, info.batchUrl, members.length);
        if (!info.batch) throw new Error('batch name not found on batch details');

        // A tick can be lost while the grid re-renders: then the order is not in the batch and
        // stays QC COMPLETED. Keep only the orders that moved; batch the rest again once.
        const inBatch: Outcome[] = [];
        const leftOut: Outcome[] = [];
        for (const o of members) (await waitForStatus(ctx.page, o.orderId, 'SIGNING PREPARATION', 20_000) ? inBatch : leftOut).push(o);
        if (leftOut.length) {
            console.log(`   📦 ${info.batch}: ${leftOut.map(o => `#${o.orderNo}`).join(' ')} ticked but not in the batch (still ${await orderStatus(ctx.page, leftOut[0].orderId) || '?'})`
                + (retry ? '' : ' — batching them again'));
            if (retry) {
                for (const o of leftOut) {
                    o.seconds = (o.seconds ?? 0) + share(started, members.length);
                    finish(o, 'Blocked', `SIGNING PREPARATION (Batch): ticked but not included in ${info.batch} (twice)`);
                }
            } else {
                retryLater.push(...leftOut);
            }
        }
        members = inBatch;
        if (!members.length) throw new Error(`no order of the group is in ${info.batch}`);
        console.log(`   📦 ${info.batch} (${members.length} orders: ${members.map(o => `#${o.orderNo}`).join(' ')}): ${statusText}`);
        for (const o of members) {
            Object.assign(o, info, { lastStep: 'SIGNING PREPARATION (Batch)', reached: 'SIGNING PREPARATION' });
            if (VERIFY_HISTORY) await expectHistory(ctx.page, o, 'SIGNING PREPARATION', 'QC COMPLETED');
        }
        saveProgress(progress);
    } catch (err) {
        if (info.batch) for (const o of members) Object.assign(o, info);
        await failAll(members.length ? members : group.filter(o => o.result === 'Waiting' && !retryLater.includes(o)), 'SIGNING PREPARATION (Batch)', err);
        await runRetry();
        return;
    }

    // SENT FOR EXTERNAL SIGNING: Complete Batch once for the whole group.
    try {
        await completeBatch(ctx.page, members[0]);
        for (const o of members) Object.assign(o, { lastStep: 'SENT FOR EXTERNAL SIGNING', reached: 'SENT FOR EXTERNAL SIGNING' });
        saveProgress(progress);
        console.log(`   📦 ${info.batch} ✅ SENT FOR EXTERNAL SIGNING`);
    } catch (err) {
        await failAll(members, 'SENT FOR EXTERNAL SIGNING', err);
        await runRetry();
        return;
    }
    const batchShare = share(started, members.length);

    // Then each order on its own: one failure doesn't stop the rest of the group.
    for (const o of members) {
        const t = Date.now();
        try {
            await runSteps(ctx, o, POST_BATCH, progress);
            o.seconds = (o.seconds ?? 0) + batchShare + Math.round((Date.now() - t) / 1000);
            finish(o, 'Done');
        } catch (err) {
            o.seconds = (o.seconds ?? 0) + batchShare + Math.round((Date.now() - t) / 1000);
            finish(o, 'Blocked', describeError(err));
        }
        progress[o.orderNo] = o;
        saveProgress(progress);
    }
    await runRetry();
}

/** Expands RUN_PLAN into numbered orders, each with its workflow and fixed client. */
const SCHEDULE = RUN_PLAN.flatMap(p =>
    Array.from({ length: p.count }, (_, i) => ({ workflow: p.workflow, client: p.clients[i % p.clients.length] }))
).map((s, i) => ({ orderNo: i + 1, ...s }));
type Planned = (typeof SCHEDULE)[number];

/** Creates one new order and runs its workflow in this lane. Log lines carry #n since lanes interleave. */
async function runOrder(ctx: Ctx, planned: Planned, progress: Record<number, Outcome>): Promise<Outcome> {
    const { page } = ctx;
    const n = planned.orderNo;
    const started = Date.now();
    const outcome: Outcome = {
        orderNo: n, workflow: planned.workflow, client: planned.client, productType: '',
        orderId: '', customerNumber: '', typedCustomerNumber: '', orderUrl: '', lastStep: '', reached: '', result: 'Fail', error: '',
    };
    console.log(`▶ #${n} ${planned.workflow} | ${outcome.client}`);

    try {
        const created = await createOrderRetry(page, planned.client, n);
        Object.assign(outcome, created, { orderUrl: `${ctx.base}${Q}/orders/${created.orderId}/details`, reached: 'HOLD', lastStep: 'Order Created' });
        progress[n] = outcome;
        saveProgress(progress);
        const custNo = outcome.typedCustomerNumber === outcome.customerNumber
            ? outcome.customerNumber : `${outcome.typedCustomerNumber} → ${outcome.customerNumber}`;
        console.log(`   #${n} Created Order ${outcome.orderId} (Cust# ${custNo}) | ${outcome.productType}`);

        await runSteps(ctx, outcome, PRE_BATCH, progress);
        outcome.seconds = Math.round((Date.now() - started) / 1000);
        outcome.result = 'Waiting';
        console.log(`   #${n} ⏸ QC COMPLETED in ${outcome.seconds}s — waiting for its batch group`);
    } catch (err) {
        outcome.seconds = Math.round((Date.now() - started) / 1000);
        finish(outcome, outcome.orderId ? 'Blocked' : 'Fail', describeError(err));
    }
    progress[n] = outcome;
    saveProgress(progress);
    return outcome;
}

//@Outamate DS:
test(' AOM Bulk Order Processing ', async ({ page, browser, baseURL }) => {
    test.setTimeout(0);
    const base = (baseURL ?? '').replace(/\/$/, '');
    const viewport = page.viewportSize();
    const storageState = test.info().project.use.storageState;

    const start = Number(process.env.START_ROW || 1);
    const end = Math.min(Number(process.env.END_ROW || SCHEDULE.length), SCHEDULE.length);
    const selected = SCHEDULE.filter(s => s.orderNo >= start && s.orderNo <= end);
    const laneCount = Math.max(1, Math.min(Number(process.env.LANES || 4), selected.length));
    fs.mkdirSync(OUT_DIR, { recursive: true });
    archiveProgress();
    const progress: Record<number, Outcome> = {};

    console.log('');
    console.log('\x1b[1mAOM Bulk Order Processing:\x1b[0m');
    console.log(`🔢 Orders ${start}–${end} of ${SCHEDULE.length} in ${laneCount} parallel lane(s): ${RUN_PLAN.map(p => `${p.workflow} ${p.count} (${p.clients.join(', ')})`).join('; ')}`);
    const runStarted = Date.now();

    // Lane 1 uses the test's page; every other lane gets its own signed-in context.
    const lanes: Ctx[] = [];
    const replaced = new WeakSet<Page>();
    const setupLanePage = async (lanePage: Page, i: number) => {
        lanePage.setDefaultTimeout(30_000);
        lanePage.setDefaultNavigationTimeout(60_000);
        await lanePage.route('**/*intelliabot.com/**', route => route.abort());
        lanePage.on('crash', () => console.log(`💥 Lane ${i + 1}: browser page crashed`));
        lanePage.on('close', () => { if (!replaced.has(lanePage)) console.log(`🛑 Lane ${i + 1}: browser page was closed`); });
        return lanePage;
    };
    for (let i = 0; i < laneCount; i++) {
        const lanePage = i === 0 ? page
            : await (await browser.newContext({ storageState, baseURL: baseURL || undefined, viewport })).newPage();
        await setupLanePage(lanePage, i);
        lanes.push({ page: lanePage, browser, base });
    }

    // A network change can leave a page stuck on an error page. Orders that failed like that before
    // being created get a fresh page in the same signed-in context and one retry.
    const PAGE_BROKEN = /net::ERR_|interrupted by another navigation|chrome-error|Customer dropdown did not open|page\.goto: Timeout/i;
    const freshPage = async (ctx: Ctx, li: number) => {
        const old = ctx.page;
        replaced.add(old);
        ctx.page = await setupLanePage(await old.context().newPage(), li);
        await old.close().catch(() => { });
        await ctx.page.waitForTimeout(5_000);
    };

    // Orders at QC COMPLETED wait here per client. As soon as a client has BATCH_SIZE of them, the
    // lane that completed the last one batches the group, while the other lanes keep keying.
    const pending: Record<string, Outcome[]> = {};
    const groupsLeft: Outcome[][] = [];
    const runGroup = async (ctx: Ctx, li: number, group: Outcome[]) => {
        if (ctx.page.isClosed()) await freshPage(ctx, li).catch(() => { });
        await runBatchGroup(ctx, group, progress).catch(async err => {
            for (const o of group.filter(g => g.result === 'Waiting')) finish(o, 'Blocked', `batch group: ${describeError(err)}`);
            saveProgress(progress);
        });
    };

    await Promise.all(lanes.map(async (ctx, li) => {
        for (const planned of selected.filter((_, i) => i % laneCount === li)) {
            if (ctx.page.isClosed()) {
                console.log(`🛑 Lane ${li + 1} closed. Its remaining orders are skipped.`);
                break;
            }
            let outcome = await runOrder(ctx, planned, progress);
            if (outcome.result === 'Fail' && !outcome.orderId && PAGE_BROKEN.test(outcome.error)) {
                console.log(`   ↻ Lane ${li + 1}: fresh page, retrying #${planned.orderNo} once`);
                const ok = await freshPage(ctx, li).then(() => true).catch(() => false);
                if (ok) outcome = await runOrder(ctx, planned, progress);
            }
            if (outcome.result !== 'Waiting') continue;
            const queue = (pending[outcome.client] ??= []);
            queue.push(outcome);
            if (queue.length >= BATCH_SIZE) await runGroup(ctx, li, queue.splice(0, BATCH_SIZE));
        }
    }));

    // The remainder of each client (fewer than BATCH_SIZE) is batched now, groups spread over the lanes.
    for (const queue of Object.values(pending)) while (queue.length) groupsLeft.push(queue.splice(0, BATCH_SIZE));
    await Promise.all(lanes.map(async (ctx, li) => {
        for (let g = li; g < groupsLeft.length; g += lanes.length) await runGroup(ctx, li, groupsLeft[g]);
    }));
    for (const o of Object.values(progress)) if (o.result === 'Waiting') finish(o, 'Blocked', 'batch step did not run');

    // Closing the extra lanes on purpose: not a "page was closed" alarm.
    for (const [i, ctx] of lanes.entries()) {
        replaced.add(ctx.page);
        if (i > 0) await ctx.page.context().close().catch(() => { });
    }

    for (const o of Object.values(progress).sort((a, b) => a.orderNo - b.orderNo)) {
        addResult({
            product: 'AOM Bulk Orders',
            srNo: getSrCounter().toString(),
            module: `#${o.orderNo} ${o.client} | ${o.productType || '-'} → ${o.lastStep || 'not created'}`,
            status: o.result === 'Done' ? 'Pass' : 'Fail',
            URL: o.orderUrl
                ? `<a href="${o.orderUrl}">Order ${o.orderId} / ${o.typedCustomerNumber && o.typedCustomerNumber !== o.customerNumber
                    ? `${o.typedCustomerNumber} → ${o.customerNumber}` : o.customerNumber}</a>`
                : o.error,
        });
        incrementSrCounter();
    }

    await writeReport(progress);
    const all = Object.values(progress);
    console.log('');
    for (const client of [...new Set(RUN_PLAN.flatMap(p => p.clients))]) {
        const ofC = all.filter(o => o.client === client || loose(o.client) === loose(client));
        console.log(`📊 ${client}: ${ofC.filter(o => o.result === 'Done').length}/${ofC.length} completed`);
    }
    console.log(`⏱️ Total ${Math.round((Date.now() - runStarted) / 60_000)} min for ${all.length} orders`);
    console.log(`📄 Report: ${REPORT}`);

    const results = getResults();
    await sendMail(results);
});
