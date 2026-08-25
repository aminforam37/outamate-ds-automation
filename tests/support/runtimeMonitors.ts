import type { Page } from '@playwright/test';

/**
 * Third-party origins the app embeds but that we do not own. Failures from these
 * are not defects in the application under test, so they are filtered out of the
 * console output.
 *
 * - intelliabot.com — the IntelliaBot chat widget. The dev environment points at
 *   the *UAT* chatbot backend (outamation-uat.chatbot-backend.intelliabot.com),
 *   which sends no Access-Control-Allow-Origin header, so every page load logs
 *   CORS errors for /docs/public/branding and /docs/embed/.../threads. That is an
 *   app/infra configuration issue to raise with the team — not a test failure.
 */
const THIRD_PARTY_ORIGINS = ['intelliabot.com'];

const isThirdParty = (text: string): boolean =>
  THIRD_PARTY_ORIGINS.some((host) => text.includes(host));

/**
 * Attaches the console / pageerror / failed-response listeners used by the order
 * creation and keying specs. Previously this block was copy-pasted into seven
 * spec files, which had already drifted into two variants that filtered
 * different things.
 */
export function attachRuntimeMonitors(page: Page): void {
  page.on('pageerror', (exception) => {
    console.error(`🛑 [Application Crash] Unhandled runtime exception: ${exception.message}`);
  });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();

    // AG Grid trial-licence banner and its asterisk border rows
    const isAgGridNoise =
      text.includes('ag-grid') ||
      text.includes('AG Grid') ||
      text.includes('License Key Not Found') ||
      text.includes('license key') ||
      text.includes('unlocked for trial') ||
      text.includes('hide the watermark') ||
      text.startsWith('*****');

    // Angular's generic wrappers carry no detail — the underlying request is
    // already reported by the 'response' listener below with URL and status.
    const isGenericHttpWrapper =
      text.includes('HttpErrorResponse') || text.includes('Failed to load resource');

    if (isAgGridNoise || isGenericHttpWrapper || isThirdParty(text)) return;

    console.error(`⚠️ [Browser Console Error] ${text}`);
  });

  page.on('response', (response) => {
    if (response.status() < 400) return;
    const url = response.url();
    if (isThirdParty(url)) return;
    console.error(`❌ [Network Drop] Failed target: ${url} [Status: ${response.status()}]`);
  });
}
