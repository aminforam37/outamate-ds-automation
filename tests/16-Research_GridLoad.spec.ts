import { test, expect } from '@playwright/test';
import { addResult, getResults, getSrCounter, incrementSrCounter } from '../resultsCollector';
import { sendMail } from '../mail';

/**
 * Every grid is reached by route rather than by menu, because several sit in nested
 * accordions and the side-menu indexes shift with the signed-in user's permissions.
 * `permission` is the route's requiredPermissions code — a user without it is
 * redirected rather than shown a broken grid, which is a different kind of failure.
 */
const GRIDS: { name: string; route: string; permission: string }[] = [
    { name: 'Search Queue',            route: '/app/internal/research/order-stage/search',                   permission: 'OrderStage' },
    { name: 'Pending Delivery',        route: '/app/internal/research/order-stage/pending-delivery',         permission: 'OrderStage' },
    { name: 'Delivered',               route: '/app/internal/research/order-stage/delivered',                permission: 'OrderStage' },
    { name: 'Completed',               route: '/app/internal/research/order-stage/completed',                permission: 'OrderStage' },
    { name: 'Cancelled',               route: '/app/internal/research/order-stage/cancelled',                permission: 'OrderStage' },
    { name: 'Internal Doc Review',     route: '/app/internal/research/order-stage/internal-doc-review',      permission: 'InternalDocumnetReview' },
    { name: 'Tier 1 Processing Queue', route: '/app/internal/research/order-stage/tier-1-processing',        permission: 'OrderStage' },
    { name: 'BOT Search Queue',        route: '/app/internal/research/order-stage/rpa-bot-search',           permission: 'OrderStage' },
    { name: 'Document Not Found',      route: '/app/internal/research/quality-control/document-not-found',   permission: 'QualityControl' },
    { name: 'Property Not Found',      route: '/app/internal/research/quality-control/property-not-found',   permission: 'QualityControl' },
    { name: 'Order Data Error',        route: '/app/internal/research/customer-support/order-data-error',    permission: 'CustomerSupport' },
    { name: 'Order Delivery Error',    route: '/app/internal/research/customer-support/order-delivery-error', permission: 'CustomerSupport' },
    { name: 'Tier 1 Exception Queue',  route: '/app/internal/research/customer-support/tier-1-exception',    permission: 'CustomerSupport' },
    { name: 'Quotes Review',           route: '/app/internal/research/vendor-mgt/quotes-review',             permission: 'VendorManagement' },
    { name: 'Doc Retrieval',           route: '/app/internal/research/vendor-mgt/doc-retrieval',             permission: 'DocRetrieval' },
    { name: 'Product Types',           route: '/app/internal/research/management/product-types',            permission: 'ManagementFunctions' },
    { name: 'Order Types',             route: '/app/internal/research/management/order-types',              permission: 'ManagementFunctions' },
    { name: 'Client Request Codes',    route: '/app/internal/research/management/request-codes',             permission: 'ManagementFunctions' },
];
//@Outamate DS:
test(' Grid Load Verification', async ({ page, baseURL }) => {
    const base = (baseURL ?? '').replace(/\/$/, '');

    const recordModule = (module: string, passed: boolean, url: string) => {
        addResult({
            product: "Research",
            srNo: getSrCounter().toString(),
            module,
            status: passed ? 'Pass' : 'Fail',
            URL: `<a href="${url}">${module}</a>`
        });
        incrementSrCounter();
    };

    /**
     * Console output that is not a defect in the page under test: the AG Grid
     * trial-licence banner, the embedded IntelliaBot widget (third party, sends no
     * CORS headers), and Angular's generic HTTP wrappers — the underlying request is
     * already captured by the response listener with a URL and status.
     */
    const isNoise = (text: string) =>
        /ag-grid|AG Grid|License Key Not Found|license key|unlocked for trial|hide the watermark/i.test(text)
        || text.startsWith('*****')
        || /intelliabot\.com/i.test(text)
        || /HttpErrorResponse|Failed to load resource/i.test(text);

    console.log("");
    console.log("\x1b[1mGrid Load Verification:\x1b[0m");
    console.log(`🔍 Checking ${GRIDS.length} grids...`);

    // Third-party widget blocked outright so it cannot pollute the error counts.
    await page.route('**/*intelliabot.com/**', route => route.abort());

    for (const grid of GRIDS) {
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

        try {
            await page.goto(grid.route, { waitUntil: 'domcontentloaded' });

            // A missing permission redirects to /access-required rather than
            // rendering a broken grid — report that distinctly.
            if (/access-required/.test(page.url())) {
                detail = `access denied — the login user lacks ${grid.permission}`;
                throw new Error(detail);
            }

            // The grid shell has to appear...
            await page.locator('.custom-grid .ag-root-wrapper').first()
                .waitFor({ state: 'visible', timeout: 30_000 });

            // ...and then resolve to EITHER rows or a no-rows overlay. An empty grid
            // is a valid result; one that never resolves either way is broken, and
            // that distinction is the whole point of this check. The overlay reads
            // "No Rows To Display" when empty, "No matching records found" when a
            // filter excludes everything — either means the grid is alive.
            // Wait for the data to actually settle before judging it.
            //
            // Do NOT accept "rows OR no-rows overlay" as soon as either appears:
            // ag-Grid shows the no-rows overlay BEFORE the data request returns, so
            // that races and reports a populated grid as empty. Poll instead, and
            // only believe "empty" once the loading overlay has cleared and no rows
            // have arrived within the settle window.
            const rows = page.locator('.ag-center-cols-container .ag-row');
            const noRows = page.locator('.ag-overlay-no-rows-wrapper');
            const errorBanner = page.locator(
                '.toast-container.danger-toast, .toast-container.error-toast, ' +
                '.error-toast, .danger-toast, .warning-toast, mat-error, .error-message'
            ).first();

            await page.locator('.ag-overlay-loading-wrapper')
                .waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => { });

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

            // A visible error message means the grid failed even if a shell rendered
            // — e.g. "An error occurred, try again later!".
            if (gridError) {
                detail = `error shown — "${gridError}"`;
                throw new Error(detail);
            }

            // Nothing arrived: only trust "empty" if the no-rows overlay is actually up.
            if (rowCount === 0 && !await noRows.first().isVisible().catch(() => false)) {
                detail = 'grid never resolved — no rows and no "no rows" overlay';
                throw new Error(detail);
            }

            detail = 'loaded successfully';
            rendered = true;
        } catch (err) {
            if (!detail) detail = `did not render — ${(err as Error).message.split('\n')[0]}`;
        }

        page.off('console', onConsole);
        page.off('response', onResponse);

        const clean = consoleErrors.length === 0 && failedRequests.length === 0;
        const passed = rendered && clean;

        console.log(`${passed ? '✅' : '❌'} ${grid.name}: ${detail}`);
        consoleErrors.slice(0, 3).forEach(e => console.log(`      console error: ${e}`));
        failedRequests.slice(0, 3).forEach(r => console.log(`      failed request: ${r}`));

        recordModule(grid.name, passed, page.url());
    }

    // const results = getResults();
    // await sendMail(results);

});
