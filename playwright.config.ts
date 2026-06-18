import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

//dotenv.config();
dotenv.config({ quiet: true }); //Added 

const environment = process.env.ENV?.toUpperCase() || 'DEV';
const isHeadless = process.env.HEADLESS !== 'false';

const urls: Record<string, string> = {
  DEV: 'https://dev-outamateds.outamationlabs.com/',
  UAT: 'https://uat-outamateds.outamationlabs.com/',
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 50 * 60 * 1000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: isHeadless,
    video: 'on-first-retry',
    trace: 'on-first-retry',
    screenshot: 'on',
    bypassCSP: true,
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    baseURL: urls[environment],
    // In headless mode --start-maximized is ignored, so set a large fixed viewport.
    // In headed mode viewport: null lets --start-maximized take effect.
    viewport: isHeadless ? { width: 1920, height: 1080 } : null,
    launchOptions: {
      args: isHeadless ? [] : ['--start-maximized' ], //,'--force-device-scale-factor=1'
    },

    // //New added to test
    // viewport: null,
    // launchOptions: {
    //   // 2. Only pass the native maximize flag
    //   args: ['--start-maximized'],
    // },


  },

  projects: [
    // STEP 1 — Login runs first, saves session to playwright/.auth/user.json
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // STEP 2 — All other tests load the saved session (no re-login)
    {
        
      name: 'e2e-tests', //New added
      dependencies: ['setup'],
      testIgnore: /.*\.setup\.ts/,
      use: {
        browserName: 'chromium',
        storageState: 'playwright/.auth/user.json',
      },
    },
  ],
});
