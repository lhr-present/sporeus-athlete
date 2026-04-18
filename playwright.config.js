// playwright.config.js — sporeus-athlete
// Place at repo root: ~/sporeus-athlete-app/playwright.config.js
import { defineConfig, devices } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';

// Load E2E env vars from .env.e2e (local only — git-ignored)
dotenvConfig({ path: '.env.e2e', override: false });

// Override with PLAYWRIGHT_BASE_URL=... to point at staging or a cloudflared tunnel.
// Production is at https://app.sporeus.com/
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173/';

export default defineConfig({
  testDir: './tests/e2e',
  // Exclude vitest files (.test.*) and global setup/teardown helpers
  testIgnore: [
    '**/*.test.{js,ts,mjs,cjs}',
    '**/global-setup.ts',
    '**/global-teardown.ts',
    '**/helpers/**',
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // 1 retry in CI; flaky-test guardrail requires 10/10 locally before landing
  retries: process.env.CI ? 1 : 0,
  // 5 parallel workers = all 5 critical paths run simultaneously (<5 min total)
  workers: process.env.CI ? 5 : undefined,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],

  globalSetup:    './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',

  use: {
    baseURL: BASE_URL,
    trace:       'on-first-retry',
    screenshot:  'only-on-failure',
    video:       'retain-on-failure',
    actionTimeout:    15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // ── Critical-path E2E (chromium only in CI — fast, deterministic) ─────────
    {
      name: 'chromium-e2e',
      testMatch: '**/path*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Smoke tests (all browsers) ────────────────────────────────────────────
    { name: 'chromium',      testMatch: '**/smoke.spec.js', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',       testMatch: '**/smoke.spec.js', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',        testMatch: '**/smoke.spec.js', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', testMatch: '**/smoke.spec.js', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', testMatch: '**/smoke.spec.js', use: { ...devices['iPhone 14'] } },
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
