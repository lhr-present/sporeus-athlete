// playwright.prod-smoke.config.js
// Targets the LIVE production deploy (default https://app.sporeus.com).
// No webServer — prod is already running. Override target via:
//   PLAYWRIGHT_PROD_URL=https://staging.example.com npx playwright test --config=playwright.prod-smoke.config.js
import { defineConfig, devices } from '@playwright/test'

const PROD_URL = process.env.PLAYWRIGHT_PROD_URL || 'https://app.sporeus.com'

export default defineConfig({
  testDir:       './tests/e2e',
  testMatch:     ['program-tab-prod.spec.js'],
  fullyParallel: false,
  forbidOnly:    !!process.env.CI,
  retries:       process.env.CI ? 2 : 0,
  workers:       1,
  reporter:      [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    baseURL:           PROD_URL,
    trace:             'on-first-retry',
    screenshot:        'only-on-failure',
    video:             'retain-on-failure',
    navigationTimeout: 30_000,
    actionTimeout:     15_000,
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
