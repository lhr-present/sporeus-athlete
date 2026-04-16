// playwright.config.js — sporeus-athlete
// Place at repo root: ~/sporeus-athlete-app/playwright.config.js
import { defineConfig, devices } from '@playwright/test';

// Override with PLAYWRIGHT_BASE_URL=... to point at staging or a cloudflared tunnel.
// Production is at https://app.sporeus.com/
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173/';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/*.test.{js,ts,mjs,cjs}'],   // *.test.* files are vitest — exclude from Playwright
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',     // viewable with `npx playwright show-trace`
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },

  projects: [
    { name: 'chromium',      use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',       use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',        use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],

  // Auto-boots `npm run dev` if nothing is already on :5173.
  // Reuses your existing dev server when you're iterating locally.
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
