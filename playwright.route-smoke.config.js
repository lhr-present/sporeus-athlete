// playwright.route-smoke.config.js
// Minimal config for P3 route-smoke CI gate.
// Serves the pre-built dist/ via vite preview — no Supabase credentials needed.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:       './tests/e2e',
  testMatch:     ['route-smoke.spec.ts'],
  fullyParallel: true,
  forbidOnly:    !!process.env.CI,
  retries:       process.env.CI ? 1 : 0,
  workers:       process.env.CI ? 4 : undefined,
  reporter:      [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],

  use: {
    baseURL: 'http://localhost:4173',
    trace:   'on-first-retry',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command:             'npm run preview -- --port 4173',
    url:                 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout:             30_000,
    stdout:              'ignore',
    stderr:              'pipe',
  },
})
