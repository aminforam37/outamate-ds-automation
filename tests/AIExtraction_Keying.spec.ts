import { test, chromium, Page, Locator } from '@playwright/test';
import { faker } from '@faker-js/faker/locale/en';
import { addResult, getResults, getSrCounter, incrementSrCounter } from '../resultsCollector';
import { sendMail } from '../mail';
const fs = require('fs');
import path from 'path';

/**
 * Research keying order filled by AI extraction (one order, Covius).
 *
 *  1. Order created → AI documents uploaded (document type is set automatically) → Search Details saved.
 *  2. Process Order → Move to... → READY FOR MERGE. The system then runs on its own:
 *       current status → READY FOR MERGE → MERGE IN PROGRESS → READY FOR EXTRACTION → EXTRACTION IN PROGRESS → KEYING
 *     A retry returns the order to the status (and assignee) it started from; a failure goes to EXTRACTION FAILED.
 *  3. Process Order → Move to... → KEYING IN PROGRESS → Keying form, populated from the documents.
 *     The keying API returns `extractedMetadata` (only in KEYING / QUALITY CHECK). Each field shows a
 *     confidence badge; a field under ALLOWED_CONFIDENCE (95%) needs the "reviewed" tick, otherwise the
 *     server rejects the save with LowConfidenceScore. The script ticks exactly those fields.
 *  4. Complete → QUALITY CHECK → (same review) Complete → PENDING DELIVERY.
 *
 * The order status is read in a hidden browser with the same login, so the Keying form is never
 * reloaded or left while keying and no manual refresh is needed.
 *
 * Env: EXTRACTION_TIMEOUT_MIN (default 15), ALLOWED_CONFIDENCE (default 95).
 */
const Q = '/app/internal/research';
const CLIENT = 'Covius';
const AI_DOCS = [
    '25562238.DEED01.pdf',
    '25562238.MTG01 1.pdf',
    '25748105.DEED01.pdf',
    '25748105.MTG01.pdf',
    '25900625.ASMT01.pdf',
];
const EXTRACTION_TIMEOUT_MS = Number(process.env.EXTRACTION_TIMEOUT_MIN || 15) * 60_000;
const ALLOWED_CONFIDENCE = Number(process.env.ALLOWED_CONFIDENCE || 95);
const SYSTEM_PATH = ['READY FOR MERGE', 'MERGE IN PROGRESS', 'READY FOR EXTRACTION', 'EXTRACTION IN PROGRESS', 'KEYING'];
const OUT_DIR = path.resolve('Bulk_Orders');

type Order = { orderId: string; customerNumber: string; client: string; productType: string };

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
const loose = (s: string) => norm(s).replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
const soft = { timeout: 5_000 };
const errorToast = (page: Page) =>
    page.locator('.warning-toast, .toast-container.danger-toast, .toast-container.error-toast').first();
/** isVisible() never waits, so every "is it there" check uses waitFor(). */
const shown = (l: Locator, ms: number) => l.waitFor({ state: 'visible', timeout: ms }).then(() => true).catch(() => false);

// ---------------------------------------------------------------------------
// Status — read in a hidden browser so the working page is never reloaded or left
// ---------------------------------------------------------------------------

let statusTab: Page;

async function waitForSpinner(page: Page, timeoutMs = 60_000) {
    await page.waitForTimeout(200);
    await page.locator('ngx-spinner .ngx-spinner-overlay').first().waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => { });
}

async function openOrder(page: Page, orderId: string, tab = 'details') {
    await page.goto(`${Q}/orders/${orderId}/${tab}`, { waitUntil: 'domcontentloaded' });
    await page.locator('span.badge.text-soft-dark').first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => { });
    await waitForSpinner(page);
}

async function readStatus(orderId: string): Promise<string> {
    await openOrder(statusTab, orderId);
    return norm(await statusTab.locator('span.badge.text-soft-dark').first().innerText({ timeout: 10_000 }).catch(() => ''));
}

async function expectStatus(orderId: string, target: string, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    let current = await readStatus(orderId);
    while (current !== target && Date.now() < deadline) {
        await statusTab.waitForTimeout(2_000);
        current = await readStatus(orderId);
    }
    if (current !== target) throw new Error(`expected status "${target}" but it is "${current}"`);
}

// ---------------------------------------------------------------------------
// Order creation, documents, Search Details
// ---------------------------------------------------------------------------

/** Opens the nth mat-select and picks an option by text (loosely) or index. */
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
    if (!await shown(option, 5_000)) {
        await page.keyboard.press('Escape');
        await panel.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => { });
        return null;
    }
    const text = (await option.innerText()).trim();
    await option.click();
    await panel.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => { });
    return text;
}

const todayText = () => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

/** Today on every visible date picker still empty (Prior Effective Date and the like). */
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

/** Visible controls still invalid (required and empty), tagged for `fillRequiredEmpty`. */
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

/** Fills only required fields that are still empty — extracted values are never overwritten. */
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
        const calendar = el.locator('xpath=ancestor::mat-form-field[1]').locator('button[aria-label="Open calendar"]');
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

/** New Order: Covius, first product type offered. */
async function createOrder(page: Page): Promise<Order> {
    await page.goto(`${Q}/orders/new`, { waitUntil: 'domcontentloaded' });
    const client = await pick(page, 0, CLIENT, 'Customer');
    if (!client) throw new Error(`client "${CLIENT}" not in Customer dropdown`);
    await pick(page, 1, 1, 'Division', true);
    await page.locator('input[formcontrolname="lenderName"]').fill('BOB Bank');
    if (!await pick(page, 2, 1, 'Order Type')) throw new Error(`no Order Type for "${client}"`);
    const productType = await pick(page, 3, 1, 'Product Type') ?? await pick(page, 3, 0, 'Product Type');
    if (!productType) throw new Error(`no Product Type for "${client}"`);
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

    const instrument = page.locator('mat-form-field').filter({ has: page.locator('input[formcontrolname="instrumentDate"]') })
        .locator('button[aria-label="Open calendar"]').first();
    await (await instrument.count() ? instrument : page.locator('button[aria-label="Open calendar"]').nth(0)).click();
    await page.locator('.mat-calendar-body-today').click();
    await page.waitForTimeout(500);
    await fillEmptyDates(page);
    await page.locator('textarea[formcontrolname="specialInstructions"]').fill('All documents needed');
    await fillRequiredEmpty(page);
    const missing = [...new Set(await invalidControls(page))];
    if (missing.length) throw new Error(`New Order required fields still empty for "${productType}": ${missing.join(', ')}`);

    await page.locator('button[class="mdc-button mat-mdc-button-base mdc-button--unelevated mat-mdc-unelevated-button mat-primary"]').click();
    if (!await page.waitForURL(/\/app\/internal\/research\/orders\/\d+\/details/, { timeout: 120_000 }).then(() => true).catch(() => false)) {
        const why = norm(await page.locator('.toast-message, mat-error').first().innerText({ timeout: 1_000 }).catch(() => ''));
        throw new Error(`order did not open after Save${why ? ` — "${why}"` : ''}`);
    }
    const orderId = page.url().split('/orders/')[1]?.split('/')[0] ?? '';
    return { orderId, customerNumber, client, productType };
}

/** Documents tab → Add → the AI documents (document type is set automatically) → Upload. */
async function uploadAiDocuments(page: Page, o: Order): Promise<string> {
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
    const toast = (await page.locator('span.toast-message').first().innerText({ timeout: 10_000 }).catch(() => '')).trim();
    await add.waitFor({ state: 'visible', timeout: 15_000 });
    const rows = page.locator('.ag-center-cols-container .ag-row');
    await rows.first().waitFor({ state: 'visible', timeout: 10_000 });
    if (await rows.count() < files.length) throw new Error(`only ${await rows.count()} of ${files.length} documents listed`);
    return toast;
}

/** Search Details: Searched From/Through (today), Does Exceed Marketable Title, Number of Names Run for CJ. */
async function saveSearchDetails(page: Page, orderId: string) {
    await openOrder(page, orderId);
    // Each click names itself in the error, so a timeout says where it stopped.
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
    const saved = page.waitForResponse(r => r.request().method() !== 'GET' && ['xhr', 'fetch'].includes(r.request().resourceType()), { timeout: 15_000 })
        .catch(() => null);
    await page.getByRole('button', { name: 'Save' }).click();
    if (!await saved) await page.waitForTimeout(1_000);
}

// ---------------------------------------------------------------------------
// Process Order → Move to... → status
// ---------------------------------------------------------------------------

async function menuEntries(page: Page): Promise<string> {
    const texts = await page.locator('[role="menuitem"], .mat-mdc-menu-panel button, .cdk-overlay-container button').allInnerTexts().catch(() => [] as string[]);
    return [...new Set(texts.map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean))].join(', ') || 'nothing';
}

/** Saves a screenshot of what Process Order shows and returns its path, for the error. */
async function snap(page: Page, target: string): Promise<string> {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const file = path.join(OUT_DIR, `AI_process_order_${target}.png`);
    await page.screenshot({ path: file, fullPage: false }).catch(() => { });
    return file;
}

/** Process Order → `target`, listed directly or under "Move to...". Does not wait for the status. */
async function processOrder(page: Page, orderId: string, target: string) {
    await openOrder(page, orderId);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => { });
    await waitForSpinner(page);
    const button = page.locator('button[mattooltip="Process Order"]').first();
    // The menu is recognised by its entries (menu items or the "Move to..." button), not its container.
    const menu = page.locator('[role="menuitem"], button.move-to-button, button:has-text("Move to...")').first();
    for (let i = 1; i <= 3; i++) {
        await button.click({ timeout: 20_000 })
            .catch(() => { throw new Error(`Process Order button not available (moving to ${target})`); });
        await waitForSpinner(page);
        if (await shown(menu, 5_000)) break;
        if (i === 3) {
            const file = await snap(page, target);
            const overlay = (await page.locator('.cdk-overlay-container').innerHTML().catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
            throw new Error(`Process Order opened no menu (moving to ${target}) — screenshot ${file}${overlay ? `; overlay: ${overlay}` : '; overlay empty'}`);
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1_500);
    }
    const option = page.getByRole('menuitem', { name: target, exact: true })
        .or(page.locator('button').filter({ hasText: new RegExp(`^\\s*${target}\\s*$`, 'i') })).first();
    for (let i = 0; i < 3 && !await shown(option, 2_000); i++) {
        await waitForSpinner(page);
        const subMenu = page.locator('button.move-to-button, button:has-text("Move to...")').first();
        if (!await shown(subMenu, 3_000)) break;
        await subMenu.click({ timeout: 10_000 }).catch(() => { });
        await shown(option, 5_000);
    }
    if (!await shown(option, 2_000)) {
        const offered = await menuEntries(page);
        const file = await snap(page, target);
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        throw new Error(`"${target}" not offered in Process Order — menu shows: ${offered} — screenshot ${file}`);
    }
    await option.click();
    await waitForSpinner(page);
    await page.locator('button:has-text("Confirm"), button:has-text("Yes")').first().click({ timeout: 2_000 }).catch(() => { });
    if (await shown(errorToast(page), 2_000)) {
        throw new Error(`error toast — "${norm(await errorToast(page).innerText().catch(() => ''))}"`);
    }
}

// ---------------------------------------------------------------------------
// Keying form and confidence review
// ---------------------------------------------------------------------------

/** Latest `extractedMetadata` scores returned by the keying API (field key → confidence %). */
let metadata = new Map<string, number>();
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
        if (map.size) metadata = map;
    });
}

/** Opens the Keying form by URL and waits for it (and the extracted values) to load. */
async function openKeying(page: Page, orderId: string) {
    if (!page.url().includes(`/orders/${orderId}/keying`)) {
        await page.goto(`${Q}/orders/${orderId}/keying`, { waitUntil: 'domcontentloaded' });
    }
    await waitForSpinner(page);
    if (!await shown(page.locator('#clientId'), 30_000)) throw new Error(`keying form did not load (${page.url()})`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => { });
    await waitForSpinner(page);
}

async function expectKeyingHeader(page: Page, o: Order) {
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
 * Every keying field showing a confidence badge: its score (badge/tooltip "nn%", else the API's
 * extractedMetadata) and whether its "reviewed" tick is set. Tags each tick for clicking.
 */
async function fieldConfidence(page: Page): Promise<FieldConfidence[]> {
    const api = Object.fromEntries([...metadata.entries()].map(([k, v]) => [k.toLowerCase(), v]));
    return page.locator('div[data-field-key]').evaluateAll((els, api) => {
        document.querySelectorAll('[data-auto-field]').forEach(e => e.removeAttribute('data-auto-field'));
        const out: { key: string; score: number | null; reviewed: boolean }[] = [];
        els.forEach(el => {
            // Each field: div[data-field-key] > … > .confidence-container > (review circle) + span.confidence-badge "90%".
            // The same key repeats per group (Security Instrument 1, 2, …), so fields are tagged by position.
            const container = el.querySelector('.confidence-container');
            const badge = el.querySelector('.confidence-badge');
            if (!container && !badge) return;
            const m = (badge?.textContent ?? '').match(/(\d{1,3}(?:\.\d+)?)\s*%/);
            const key = el.getAttribute('data-field-key') ?? '';
            const score = m ? Number(m[1]) : (api[key.toLowerCase()] ?? null);
            // Reviewed: the circle shows as checked/selected/reviewed.
            const reviewed = !!container?.querySelector('input:checked, [aria-checked="true"], [aria-pressed="true"], [class*="reviewed" i], [class*="checked" i], [class*="selected" i]')
                || /\b(reviewed|checked|selected)\b/i.test(container?.className ?? '');
            el.setAttribute('data-auto-field', String(out.length));
            out.push({ key, score, reviewed });
        });
        return out;
    }, api);
}

/** Ticks "reviewed" on every field under ALLOWED_CONFIDENCE (with `all`, also unticked fields without a score). */
/**
 * Clicks the review circle of every field under ALLOWED_CONFIDENCE (the circle left of the "90%" badge,
 * shown only for low scores). Round 1 clicks the circle element; a later round (`retry`), used when the
 * server still answers LowConfidenceScore, clicks the spot just left of the badge instead.
 */
async function reviewLowConfidence(page: Page, retry = false): Promise<{ low: string[]; ok: number; unknown: number }> {
    const fields = await fieldConfidence(page);
    const isLow = (f: FieldConfidence) => f.score !== null && f.score < ALLOWED_CONFIDENCE;
    const targets = fields.map((f, i) => ({ ...f, i })).filter(f => isLow(f) && !f.reviewed);
    for (const f of targets) {
        const field = page.locator(`[data-auto-field="${f.i}"]`);
        const container = field.locator('.confidence-container').first();
        const badge = field.locator('.confidence-badge').first();
        await badge.scrollIntoViewIfNeeded({ timeout: 3_000 }).catch(() => { });
        // The review circle: .confidence-container > div.custom-checkbox (i.checkmark-icon) next to the % badge.
        const circle = container.locator('.custom-checkbox').first();
        let clicked = false;
        if (!retry) clicked = await circle.click({ timeout: 3_000 }).then(() => true).catch(() => false);
        if (!clicked) {
            // Where the circle sits in the form: just left of the badge, vertically centred on it.
            const box = await badge.boundingBox();
            if (box) {
                await page.mouse.click(box.x - 12, box.y + box.height / 2);
                clicked = true;
            }
        }
        await page.waitForTimeout(300);
    }
    return {
        low: fields.filter(isLow).map(f => `${f.key} (${f.score}%)`),
        ok: fields.filter(f => f.score !== null && f.score >= ALLOWED_CONFIDENCE).length,
        unknown: fields.filter(f => f.score === null).length,
    };
}

/** HTML of the first low-confidence field still not reviewed — added to the error so the selector can be fixed. */
async function unresolvedSample(page: Page): Promise<string> {
    const fields = await fieldConfidence(page);
    const left = fields.map((f, i) => ({ ...f, i })).filter(f => !f.reviewed && f.score !== null && f.score < ALLOWED_CONFIDENCE);
    if (!left.length) return `${fields.length} confidence fields, none flagged`;
    const html = await page.locator(`[data-auto-field="${left[0].i}"] .confidence-container`).first().evaluate(e => e.outerHTML).catch(() => '');
    return `${left.length} still flagged (${left.slice(0, 5).map(f => `${f.key} ${f.score}%`).join(', ')}); circle markup: ${html.replace(/<!--.*?-->/g, '').replace(/\s+/g, ' ').slice(0, 900)}`;
}

/**
 * Review low-confidence fields, fill required empties, Save and Complete. If the server still answers
 * LowConfidenceScore, tick every remaining unreviewed field and try again (3 rounds).
 */
async function reviewAndComplete(page: Page, o: Order, nextStatus: string, timeoutMs = 60_000) {
    for (let round = 1; round <= 3; round++) {
        await waitForSpinner(page);
        const r = await reviewLowConfidence(page, round > 1);
        console.log(`   confidence < ${ALLOWED_CONFIDENCE}%: ${r.low.length}${r.low.length ? ` — ${r.low.join(', ')}` : ''}; ok ${r.ok}; no score ${r.unknown}`);
        await fillRequiredEmpty(page);

        const rejected: string[] = [];
        const onResponse = async (resp: any) => {
            if (resp.request().method() === 'GET' || resp.status() < 400) return;
            rejected.push(`${resp.status()} ${(await resp.text().catch(() => '')).slice(0, 200)}`);
        };
        page.on('response', onResponse);
        await page.locator('button[mattooltip="Save"]').click(soft).catch(() => { });
        await waitForSpinner(page);
        await page.waitForTimeout(1_000);
        // Close anything left open (popover, backdrop) so Complete is clickable; say what blocks it if not.
        await page.keyboard.press('Escape');
        await page.locator('.cdk-overlay-backdrop').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => { });
        await page.locator('button[mattooltip="Complete"]').click({ timeout: 15_000 }).catch(err => {
            const msg = (err as Error).message;
            const blocker = msg.match(/<[^>]+>[^\n]*intercepts pointer events/)?.[0]
                ?? (/disabled|not enabled/i.test(msg) ? 'button is disabled' : msg.split('\n')[0]);
            page.off('response', onResponse);
            throw new Error(`Complete button could not be clicked — ${blocker}`);
        });
        await page.locator('button:has-text("Yes")').click(soft).catch(() => { });            // incomplete tagging
        await page.locator('button:has-text(" Confirm ")').click(soft).catch(() => { });      // changed fields
        await waitForSpinner(page);
        await page.waitForTimeout(1_500);
        page.off('response', onResponse);

        const toast = norm(await errorToast(page).innerText({ timeout: 1_000 }).catch(() => ''));
        const lowScore = /LOW ?CONFIDENCE/i.test(`${toast} ${rejected.join(' ')}`);
        if (lowScore && round < 3) {
            console.log(`   server: low confidence score (round ${round}) — ticking the remaining fields`);
            continue;
        }
        try {
            await expectStatus(o.orderId, nextStatus, timeoutMs);
            return;
        } catch (err) {
            const missing = [...new Set(await invalidControls(page).catch(() => [] as string[]))];
            const why = [toast && `toast "${toast}"`, rejected.length && `server ${rejected.join(' | ')}`, missing.length && `required: ${missing.join(', ')}`]
                .filter(Boolean).join('; ');
            throw new Error(`Complete did not reach ${nextStatus} (${(err as Error).message})${why ? ` — ${why}` : ''}`
                + (lowScore ? ` — ${await unresolvedSample(page)}` : ''));
        }
    }
}

// ---------------------------------------------------------------------------
// Verifications
// ---------------------------------------------------------------------------

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
    // Pinned columns are separate .ag-row elements, so whole rows are read by row-index.
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

async function expectInQueue(page: Page, route: string, o: Order, queue: string) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const search = page.locator('input[placeholder="Search keyword"]');
    await search.waitFor({ state: 'visible', timeout: 30_000 });
    await search.fill(o.customerNumber);
    const row = page.locator('.ag-row').filter({ hasText: new RegExp(`\\b${o.customerNumber}\\b`) });
    if (await shown(row.first(), 10_000)) return;
    const count = parseInt((await page.locator('span[ref="lbRecordCount"]').innerText().catch(() => '')).replace(/[^\d]/g, ''), 10) || 0;
    if (count === 0) throw new Error(`not found in the ${queue} queue`);
}

async function expectDocument(page: Page, o: Order, name: string) {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        await page.goto(`${Q}/orders/${o.orderId}/documents`, { waitUntil: 'domcontentloaded' });
        if (await shown(page.locator('a.name-link', { hasText: name }).first(), 10_000)) return;
        await page.waitForTimeout(5_000);
    }
    throw new Error(`"${name}" not generated`);
}

// ---------------------------------------------------------------------------

test.use({ actionTimeout: 30_000, navigationTimeout: 60_000 });

test('Order Processing Workflow: Upload, Search Details, Merge, Extraction, and Keying', async ({ page, baseURL }) => {
    test.setTimeout(0);
    const base = (baseURL ?? '').replace(/\/$/, '');
    watchMetadata(page);

    // Hidden browser with the same login, used only to read the order status.
    const statusBrowser = await chromium.launch({ headless: true });
    const statusContext = await statusBrowser.newContext({
        storageState: test.info().project.use.storageState as string, baseURL, ignoreHTTPSErrors: true,
        viewport: { width: 1920, height: 1080 },
    });
    statusTab = await statusContext.newPage();

    const started = Date.now();
    let o: Order | null = null;
    let lastStep = 'not created';
    let error = '';
    const section = (title: string) => console.log(`\n\x1b[1m${title}:\x1b[0m`);
    const step = async (name: string, run: () => Promise<void>) => {
        const t = Date.now();
        try {
            await run();
        } catch (err) {
            throw new Error(`${name}: ${(err as Error).message.split('\n')[0]}`);
        }
        lastStep = name;
        console.log(`✅ ${name} (${Math.round((Date.now() - t) / 1000)}s)`);
    };

    try {
        section('Order Creation');
        await step('Order Created', async () => {
            o = await createOrder(page);
            console.log(`   ${o.client} | ${o.productType} | order ${o.orderId} / customer # ${o.customerNumber}`);
        });
        const order = o as unknown as Order;

        section('Search Details and Documents');
        // Search Details first (as in spec 18): after the upload the order is in ORDER DATA ERROR and its tabs change.
        await step('Search Details Saved', async () => {
            await saveSearchDetails(page, order.orderId);
        });
        let startStatus = '';
        await step('Documents Uploaded', async () => {
            const toast = await uploadAiDocuments(page, order);
            console.log(`   ${AI_DOCS.length} files${toast ? ` — "${toast}"` : ''}`);
            startStatus = await readStatus(order.orderId);
            console.log(`   status before merge: ${startStatus}`);
        });

        section('Merge and AI Extraction');
        await step('READY FOR MERGE', async () => {
            await processOrder(page, order.orderId, 'READY FOR MERGE');
        });
        await step('Merge + Extraction → KEYING', async () => {
            const t0 = Date.now();
            const seen: string[] = [];
            let status = '';
            while (Date.now() - t0 < EXTRACTION_TIMEOUT_MS) {
                status = await readStatus(order.orderId);
                if (status && seen[seen.length - 1] !== status) {
                    seen.push(status);
                    console.log(`   … ${status} (${Math.round((Date.now() - t0) / 1000)}s)`);
                }
                if (status === 'KEYING') return;
                if (status === 'EXTRACTION FAILED') throw new Error(`extraction failed (${seen.join(' → ')})`);
                if (seen.length > 1 && status === startStatus) throw new Error(`extraction retried — order returned to ${status} (${seen.join(' → ')})`);
                await statusTab.waitForTimeout(10_000);
            }
            throw new Error(`not KEYING after ${EXTRACTION_TIMEOUT_MS / 60_000} min — last "${status}" (${seen.join(' → ')})`);
        });
        await step('History shows the status path', async () => {
            await expectHistoryPath(page, order, [startStatus, ...SYSTEM_PATH].filter(Boolean));
        });
        await step('MERGED + OCR documents, files Extracted', async () => {
            await expectExtractedDocuments(page, order);
        });

        section('Keying');
        await step('KEYING IN PROGRESS', async () => {
            // Process Order → Move to... → KEYING IN PROGRESS (as done manually). If that fails, the
            // Keying tab link is tried so the error shows whether it starts keying instead.
            const viaMenu = await processOrder(page, order.orderId, 'KEYING IN PROGRESS').then(() => '').catch(e => (e as Error).message);
            if (viaMenu) {
                console.log(`   ${viaMenu}\n   → trying the Keying tab link`);
                await openOrder(page, order.orderId);
                await page.getByRole('link', { name: 'keyboard Keying' }).click({ timeout: 20_000 });
                await page.waitForURL(/\/orders\/\d+\/keying/, { timeout: 30_000 });
            }
            await expectStatus(order.orderId, 'KEYING IN PROGRESS', 20_000).catch(err => {
                throw new Error(`${(err as Error).message}${viaMenu ? ` (Process Order: ${viaMenu})` : ''}`);
            });
            await openKeying(page, order.orderId);
            await expectKeyingHeader(page, order);
        });
        await step('Keying form populated from documents', async () => {
            const filled = await populatedFields(page);
            console.log(`   ${filled.length} field(s) populated; extractedMetadata ${metadata.size ? `${metadata.size} score(s)` : 'not seen'}`);
            if (!filled.length) throw new Error('keying form has no populated fields');
        });
        await step('Keying Complete → QUALITY CHECK', async () => {
            await reviewAndComplete(page, order, 'QUALITY CHECK');
            await expectInQueue(page, `${Q}/quality-control/quality-check`, order, 'Quality Check');
        });

        section('Quality Check and Delivery');
        await step('QC Complete → PENDING DELIVERY', async () => {
            await openKeying(page, order.orderId);
            await reviewAndComplete(page, order, 'PENDING DELIVERY', 120_000);
            await expectInQueue(page, `${Q}/order-stage/pending-delivery`, order, 'Pending Delivery');
            await expectDocument(page, order, 'Complete Delivery Package');
        });
    } catch (err) {
        error = (err as Error).message;
        console.log(`❌ ${error}`);
    }

    const order = o as Order | null;
    const reached = order ? await readStatus(order.orderId).catch(() => '') : '';
    await statusBrowser.close().catch(() => { });
    const url = order ? `${base}${Q}/orders/${order.orderId}/details` : '';
    console.log(`\n⏱️ ${Math.round((Date.now() - started) / 1000)}s — last step "${lastStep}"${reached ? `, order status ${reached}` : ''}`);

    addResult({
        product: 'Research AI Extraction',
        srNo: getSrCounter().toString(),
        module: `AI Extraction | ${order?.client ?? CLIENT} | ${order?.productType ?? '-'} → ${lastStep}`,
        status: error ? 'Fail' : 'Pass',
        URL: order ? `<a href="${url}">Order ${order.orderId} / ${order.customerNumber}</a>` : error,
    });
    incrementSrCounter();
   // await sendMail(getResults());
    if (error) throw new Error(error);
});
