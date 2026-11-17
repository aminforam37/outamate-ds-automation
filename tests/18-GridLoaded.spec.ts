import { test, expect, Page } from '@playwright/test';
import { addResult, getResults, getSrCounter, incrementSrCounter } from '../resultsCollector';
import { sendMail } from '../mail';

/**
 * `allowNoGrid`: the page hides the grid entirely when it has no data, so a missing grid means "empty", not "broken".
 * `allowDuplicateHeaders`: column titles this grid legitimately repeats; any other repeat still fails.
 */
type Grid = { name: string; route: string; permission: string; allowNoGrid?: boolean; allowDuplicateHeaders?: string[] };

/**
 * Grids are reached by route rather than by menu, because several sit in nested
 * accordions and the side-menu indexes shift with the signed-in user's permissions.
 * `permission` is the route's requiredPermissions code — a user without it is redirected
 * to /access-required rather than shown a broken grid.
 * Routes marked "unconfirmed" fall back to the side-menu link with the same text if the
 * route does not resolve.
 */
const RESEARCH_GRIDS: Grid[] = [
    { name: 'Search Queue',            route: '/app/internal/research/order-stage/search',                    permission: 'OrderStage' },
    { name: 'Batch Upload',            route: '/app/internal/research/orders/batch-upload',                   permission: 'Orders' },              // unconfirmed
    { name: 'All Orders',              route: '/app/internal/research/order-stage/orders',                    permission: 'OrderStage' },
    { name: 'Keying Queue',              route: '/app/internal/research/order-stage/keying',                    permission: 'OrderStage' },
    { name: 'Extraction Queue',         route: '/app/internal/research/order-stage/extraction',                permission: 'OrderStage' },
    { name: 'Pending Delivery',        route: '/app/internal/research/order-stage/pending-delivery',          permission: 'OrderStage' },
    { name: 'Delivered',               route: '/app/internal/research/order-stage/delivered',                 permission: 'OrderStage' },
    { name: 'Completed',               route: '/app/internal/research/order-stage/completed',                 permission: 'OrderStage' },
    { name: 'Cancelled',               route: '/app/internal/research/order-stage/cancelled',                 permission: 'OrderStage' },
    { name: 'Internal Doc Review',     route: '/app/internal/research/order-stage/internal-doc-review',       permission: 'InternalDocumnetReview' },
    { name: 'Tier 1 Processing Queue', route: '/app/internal/research/order-stage/tier-1-processing',         permission: 'OrderStage' },
    { name: 'Document Not Found',      route: '/app/internal/research/quality-control/document-not-found',    permission: 'QualityControl' },
    { name: 'Property Not Found',      route: '/app/internal/research/quality-control/property-not-found',    permission: 'QualityControl' },
    { name: 'Order Data Error',        route: '/app/internal/research/customer-support/order-data-error',     permission: 'CustomerSupport' },
    { name: 'Order Delivery Error',    route: '/app/internal/research/customer-support/order-delivery-error', permission: 'CustomerSupport' },
    { name: 'Tier 1 Exception Queue',  route: '/app/internal/research/customer-support/tier-1-exception',     permission: 'CustomerSupport' },
    { name: 'Quotes Review',           route: '/app/internal/research/vendor-mgt/quotes-review',              permission: 'VendorManagement' },
    { name: 'Doc Retrieval',           route: '/app/internal/research/vendor-mgt/doc-retrieval',              permission: 'DocRetrieval' },
    { name: 'Product Types',           route: '/app/internal/research/management/product-types',             permission: 'ManagementFunctions' },
    { name: 'Order Types',             route: '/app/internal/research/management/order-types',               permission: 'ManagementFunctions' },
    { name: 'Request Codes',           route: '/app/internal/research/management/request-codes',             permission: 'ManagementFunctions' },
    { name: 'Fee & COGS Types',        route: '/app/internal/research/management/fee-cogs-types',            permission: 'ManagementFunctions' }, // unconfirmed
];

const AOM_GRIDS: Grid[] = [
    { name: 'Batch Upload',     route: '/app/internal/assignments/orders/batch-upload',                permission: 'Orders' },
    { name: 'All Orders',       route: '/app/internal/assignments/order-stage/orders',                 permission: 'OrderStage' },
    { name: 'Extraction',       route: '/app/internal/assignments/order-stage/extraction',             permission: 'OrderStage' },          // unconfirmed
    { name: 'Post Rec Keying',  route: '/app/internal/assignments/order-stage/post-recording-keying',        permission: 'OrderStage', allowNoGrid: true },     // unconfirmed
    { name: 'Pending Delivery', route: '/app/internal/assignments/order-stage/pending-delivery',       permission: 'OrderStage' },
    { name: 'Delivered',        route: '/app/internal/assignments/order-stage/delivered',              permission: 'OrderStage' },
    { name: 'Completed',        route: '/app/internal/assignments/order-stage/completed',              permission: 'OrderStage' },
    { name: 'Cancelled',        route: '/app/internal/assignments/order-stage/cancelled',              permission: 'OrderStage' },
    { name: 'Quality Check',    route: '/app/internal/assignments/quality-control/quality-check',      permission: 'QualityControl' },
    { name: 'Post Rec QC',      route: '/app/internal/assignments/quality-control/post-recording-quality-check',        permission: 'QualityControl', allowNoGrid: true }, // unconfirmed
    { name: 'Rejects',          route: '/app/internal/assignments/quality-control/rejects',            permission: 'QualityControl' },
    { name: 'Order Data Error', route: '/app/internal/assignments/customer-support/order-data-error',  permission: 'CustomerSupport' },
    { name: 'Product Types',    route: '/app/internal/assignments/management/product-types',          permission: 'ManagementFunctions' },
    { name: 'Beneficiaries',    route: '/app/internal/assignments/management/beneficiary-upload',      permission: 'ManagementFunctions', allowDuplicateHeaders: ['Number of Names', 'MERS Indicator'] },
    { name: 'Fee & COGS Types', route: '/app/internal/assignments/management/fee-cogs-types',         permission: 'ManagementFunctions' }, // unconfirmed
];

const LRP_GRIDS: Grid[] = [
    { name: 'Batch Upload',     route: '/app/internal/lien-release/orders/batch-upload',               permission: 'Orders' },              // unconfirmed
    { name: 'All Orders',       route: '/app/internal/lien-release/order-stage/orders',                permission: 'OrderStage' },
    { name: 'Extraction',       route: '/app/internal/lien-release/order-stage/extraction',            permission: 'OrderStage' },          // unconfirmed
    { name: 'Post Rec Keying',  route: '/app/internal/lien-release/order-stage/post-recording-keying',       permission: 'OrderStage', allowNoGrid: true },     // unconfirmed
    { name: 'Pending Delivery', route: '/app/internal/lien-release/order-stage/pending-delivery',      permission: 'OrderStage' },
    { name: 'Delivered',        route: '/app/internal/lien-release/order-stage/delivered',             permission: 'OrderStage' },
    { name: 'Completed',        route: '/app/internal/lien-release/order-stage/completed',             permission: 'OrderStage' },
    { name: 'Cancelled',        route: '/app/internal/lien-release/order-stage/cancelled',             permission: 'OrderStage' },
    { name: 'Quality Check',    route: '/app/internal/lien-release/quality-control/quality-check',     permission: 'QualityControl' },
    { name: 'Post Rec QC',      route: '/app/internal/lien-release/quality-control/post-recording-quality-check',       permission: 'QualityControl', allowNoGrid: true }, // unconfirmed
    { name: 'Rejects',          route: '/app/internal/lien-release/quality-control/rejects',           permission: 'QualityControl' },
    { name: 'Order Data Error', route: '/app/internal/lien-release/customer-support/order-data-error', permission: 'CustomerSupport' },
    { name: 'Beneficiaries',    route: '/app/internal/lien-release/management/beneficiary-upload',     permission: 'ManagementFunctions', allowDuplicateHeaders: ['Number of Names'] },
    { name: 'Fee & COGS Types', route: '/app/internal/lien-release/management/fee-cogs-types',        permission: 'ManagementFunctions' }, // unconfirmed
];

/**
 * Console output that is not a defect in the page under test: the AG Grid
 * trial-licence banner, the embedded IntelliaBot widget, and Angular's generic HTTP
 * wrappers — the underlying request is already captured by the response listener.
 */
const isNoise = (text: string) =>
    /ag-grid|AG Grid|License Key Not Found|license key|unlocked for trial|hide the watermark/i.test(text)
    || text.startsWith('*****')
    || /intelliabot\.com/i.test(text)
    || /HttpErrorResponse|Failed to load resource/i.test(text);

/**
 * Opens each grid and verifies it renders, finishes loading, shows no application
 * error and has sane column headers. Returns the names of the grids that failed.
 * `modulePath` is the module's URL segment (research, assignments), used to find
 * side-menu links when a route does not resolve.
 */
async function verifyGrids(page: Page, baseURL: string | undefined, product: string, modulePath: string, grids: Grid[]) {
    const base = (baseURL ?? '').replace(/\/$/, '');
    const failures: string[] = [];

    const recordModule = (module: string, passed: boolean, url: string) => {
        addResult({
            product,
            srNo: getSrCounter().toString(),
            module,
            status: passed ? 'Pass' : 'Fail',
            URL: `<a href="${url}">${module}</a>`
        });
        incrementSrCounter();
    };

    /** Finds a side-menu link of this module by its text, for routes that did not resolve. */
    const menuHref = async (name: string) => {
        const hrefs = await page.locator(`a[href*="/${modulePath}/"]`).evaluateAll((els, n) =>
            els.filter(e => (e.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase() === n.toLowerCase())
                .map(e => e.getAttribute('href')), name);
        return hrefs.find(Boolean) ?? null;
    };

    console.log("");
    console.log(`\x1b[1m${product} Grid Load Verification:\x1b[0m`);
    console.log(`🔍 Checking ${grids.length} grids...`);

    // Third-party widget blocked outright so it cannot pollute the error counts.
    await page.route('**/*intelliabot.com/**', route => route.abort());

    for (const grid of grids) {
        const consoleErrors: string[] = [];
        const failedRequests: string[] = [];

        const onConsole = (msg: any) => {
            if (msg.type() === 'error' && !isNoise(msg.text())) {
                consoleErrors.push(msg.text().slice(0, 200));
            }
        };
        const onResponse = (res: any) => {
            if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url().replace(base, '')}`);
        };

        page.on('console', onConsole);
        page.on('response', onResponse);

        let rendered = false;
        let detail = '';
        let headerInfo = '';

        try {
            // 1. Grid opens
            let route = grid.route;
            await page.goto(route, { waitUntil: 'domcontentloaded' });

            if (/access-required/.test(page.url())) {
                detail = `access denied — the login user lacks ${grid.permission}`;
                throw new Error(detail);
            }

            if (!page.url().includes(route)) {
                // Route did not resolve — use the side-menu link of the same name instead.
                await page.waitForTimeout(2000);
                const href = await menuHref(grid.name);
                if (!href) {
                    detail = `route did not open (landed on ${page.url().replace(base, '')}) and no menu link "${grid.name}" found`;
                    throw new Error(detail);
                }
                route = href;
                await page.goto(route, { waitUntil: 'domcontentloaded' });
                console.log(`      note: ${grid.name} route resolved from menu → ${route}`);
            }

            // Application error messages and leftover spinners, checked on every path below.
            const errorBanner = page.locator(
                '.toast-container.danger-toast, .toast-container.error-toast, ' +
                '.error-toast, .danger-toast, .warning-toast, mat-error, .error-message'
            ).first();
            const spinner = page.locator('mat-spinner, mat-progress-spinner, mat-progress-bar, .loader, .spinner')
                .filter({ visible: true });

            // 2. Grid visible and rendered, with a header row
            const gridRoot = page.locator('.custom-grid .ag-root-wrapper, .ag-root-wrapper').first();
            const gridShown = await gridRoot.waitFor({ state: 'visible', timeout: 30_000 })
                .then(() => true)
                .catch(err => { if (!grid.allowNoGrid) throw err; return false; });

            if (!gridShown) {
                // Page hides the grid when it has no data — still require a clean, settled page.
                if (/access-required/.test(page.url()) || !page.url().includes(route)) {
                    detail = `page did not stay open (landed on ${page.url().replace(base, '')})`;
                    throw new Error(detail);
                }
                if (await errorBanner.isVisible().catch(() => false)) {
                    detail = `error shown — "${(await errorBanner.innerText().catch(() => '')).replace(/\s+/g, ' ').trim()}"`;
                    throw new Error(detail);
                }
                if (await spinner.count() > 0) {
                    detail = 'loading spinner still visible and no grid shown';
                    throw new Error(detail);
                }
                const emptyText = (await page.getByText(/no (records|data|rows|orders?)|nothing to (display|show)/i)
                    .first().innerText({ timeout: 1_000 }).catch(() => '')).replace(/\s+/g, ' ').trim();

                headerInfo = 'n/a (no grid)';
                detail = `loaded successfully — no data, grid not shown${emptyText ? ` ("${emptyText}")` : ''}`;
                rendered = true;
                continue;
            }

            await expect(page.locator('.ag-header-row').first()).toBeVisible({ timeout: 10_000 });

            // 3. No loading indicators remain
            const loadingOverlay = page.locator('.ag-overlay-loading-wrapper');
            const stillLoading = await loadingOverlay.first()
                .waitFor({ state: 'hidden', timeout: 30_000 }).then(() => false).catch(() => true);
            if (stillLoading) {
                detail = 'loading overlay still visible after 30s';
                throw new Error(detail);
            }

            // 4. Data loaded — rows, or a no-rows overlay once loading has settled.
            // ag-Grid shows the no-rows overlay BEFORE the data request returns, so
            // poll rather than accepting whichever appears first.
            const rows = page.locator('.ag-center-cols-container .ag-row');
            const noRows = page.locator('.ag-overlay-no-rows-wrapper');

            let rowCount = 0;
            let gridError = '';
            const deadline = Date.now() + 20_000;

            while (Date.now() < deadline) {
                if (await errorBanner.isVisible().catch(() => false)) {
                    gridError = (await errorBanner.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
                    break;
                }
                rowCount = await rows.count();
                if (rowCount > 0) break;
                await page.waitForTimeout(500);
            }

            if (gridError) {
                detail = `error shown — "${gridError}"`;
                throw new Error(detail);
            }

            if (rowCount === 0 && !await noRows.first().isVisible().catch(() => false)) {
                detail = 'grid never resolved — no rows and no "no rows" overlay';
                throw new Error(detail);
            }

            if (await spinner.count() > 0) {
                detail = 'loading spinner still visible after data settled';
                throw new Error(detail);
            }

            // 6. Column headers
            const headerCells = page.locator('.ag-header-row-column .ag-header-cell').filter({ visible: true });
            const headerCount = await headerCells.count();
            if (headerCount === 0) {
                detail = 'no column headers rendered';
                throw new Error(detail);
            }

            // Checkbox / action columns legitimately have no text, so only named headers are compared.
            const headerTexts = (await headerCells.locator('.ag-header-cell-text').allInnerTexts())
                .map(t => t.replace(/\s+/g, ' ').trim())
                .filter(Boolean);
            if (headerTexts.length === 0) {
                detail = 'column headers rendered without any text';
                throw new Error(detail);
            }

            const allowed = new Set((grid.allowDuplicateHeaders ?? []).map(h => h.replace(/\s+/g, ' ').trim().toLowerCase()));
            const duplicates = headerTexts.filter((t, i) => headerTexts.indexOf(t) !== i && !allowed.has(t.toLowerCase()));
            if (duplicates.length > 0) {
                detail = `duplicate column headers — ${[...new Set(duplicates)].join(', ')}`;
                throw new Error(detail);
            }

            // Sorting is only meaningful with data; restore the original order afterwards
            // so the grid's saved state does not carry into later runs.
            let sortInfo = 'sort n/a';
            const sortable = headerCells.and(page.locator('.ag-header-cell-sortable')).first();
            if (rowCount > 0 && await sortable.count() > 0) {
                const label = sortable.locator('.ag-header-cell-label');
                const sortName = (await sortable.locator('.ag-header-cell-text').innerText().catch(() => '')).trim();
                const initial = await sortable.getAttribute('aria-sort') ?? 'none';

                await label.click();
                await expect.poll(async () => await sortable.getAttribute('aria-sort') ?? 'none', { timeout: 5_000 })
                    .not.toBe(initial)
                    .catch(() => { });
                const changed = (await sortable.getAttribute('aria-sort') ?? 'none') !== initial;

                for (let i = 0; i < 3 && (await sortable.getAttribute('aria-sort') ?? 'none') !== initial; i++) {
                    await label.click();
                    await page.waitForTimeout(300);
                }

                if (!changed) {
                    detail = `column "${sortName}" is sortable but clicking it did not change the sort`;
                    throw new Error(detail);
                }
                sortInfo = `sort ok on "${sortName}"`;
            }

            headerInfo = `${headerTexts.length} headers [${headerTexts.slice(0, 5).join(', ')}${headerTexts.length > 5 ? ', …' : ''}], ${sortInfo}`;
            detail = rowCount > 0 ? `loaded successfully — ${rowCount} rows rendered` : 'loaded successfully — no rows to display';
            rendered = true;
        } catch (err) {
            if (!detail) detail = `did not render — ${(err as Error).message.split('\n')[0]}`;
        } finally {
            // In `finally` so the empty-page path's `continue` is still reported.
            page.off('console', onConsole);
            page.off('response', onResponse);

            const clean = consoleErrors.length === 0 && failedRequests.length === 0;
            const passed = rendered && clean;

            console.log(`${passed ? '✅' : '❌'} ${grid.name}: ${detail}`);
            if (headerInfo) console.log(`      headers: ${headerInfo}`);
            consoleErrors.slice(0, 3).forEach(e => console.log(`      console error: ${e}`));
            failedRequests.slice(0, 3).forEach(r => console.log(`      failed request: ${r}`));

            if (!passed) failures.push(grid.name);
            recordModule(grid.name, passed, page.url());
        }
    }

    return failures;
}

//@Outamate DS:
// One test for all three products: Playwright restarts the worker after a failed test,
// which would wipe the collected results, so separate tests can't share one email.
test(' Grid Loaded ', async ({ page, baseURL }) => {
    const research = await test.step('Research grids', () => verifyGrids(page, baseURL, 'Research', 'research', RESEARCH_GRIDS));
    const aom = await test.step('AOM grids', () => verifyGrids(page, baseURL, 'AOM', 'assignments', AOM_GRIDS));
    const lrp = await test.step('LRP grids', () => verifyGrids(page, baseURL, 'LRP', 'lien-release', LRP_GRIDS));

    // Single email covering all three products, sent before any assertion can stop the test.
    const results = getResults();
    await sendMail(results);

    expect.soft(research, `Research grids failing verification: ${research.join(', ')}`).toEqual([]);
    expect.soft(aom, `AOM grids failing verification: ${aom.join(', ')}`).toEqual([]);
    expect.soft(lrp, `LRP grids failing verification: ${lrp.join(', ')}`).toEqual([]);
});
