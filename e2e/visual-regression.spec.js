// ─── e2e/visual-regression.spec.js — Playwright visual regression snapshots ──
// 4 snapshot tests covering the main app views in guest (unauthenticated) mode.
//
// AUTH NOTE: These tests run in guest mode by injecting `sporeus-guest-mode=1`
// into localStorage via addInitScript, which bypasses the Supabase auth gate
// (see src/App.jsx lines ~551-564). This matches how the app behaves for users
// who dismiss the auth nudge and continue without signing in.
//
// If you need authenticated snapshots (e.g. to capture dashboard data or coach
// features), you will need a seeded test user. Use the injectSession() helper
// from tests/e2e/helpers/auth.ts and set E2E_ATHLETE_A_EMAIL / _PW in .env.e2e.
//
// Update snapshots: npx playwright test e2e/visual-regression.spec.js --update-snapshots
// Run in headed mode: npx playwright test e2e/visual-regression.spec.js --headed
//
// Snapshots are stored in: e2e/snapshots/visual-regression/

import { test, expect } from '@playwright/test'

// ── Guest mode init script ─────────────────────────────────────────────────────
// Injected before every navigation. Sets the minimum localStorage keys required
// to bypass: auth gate, GDPR consent modal, and onboarding wizard.
// Forces English so snapshot names are stable across locale changes.
async function injectGuestMode(page) {
  await page.addInitScript(() => {
    // Bypass Supabase auth gate (App.jsx: isGuest check)
    localStorage.setItem('sporeus-guest-mode', '1')
    // Bypass GDPR consent modal (CONSENT_VERSION = '1.1')
    localStorage.setItem('sporeus-consent-v1', '1.1')
    // Bypass onboarding wizard
    localStorage.setItem('sporeus-onboarded', 'true')
    // Force English UI — deterministic selectors and snapshot names
    localStorage.setItem('sporeus-lang', '"en"')
  })
}

// ── Wait for the app shell to be stable before snapshotting ───────────────────
async function waitForAppShell(page) {
  // Tab bar is rendered only after auth/onboarding bypassed
  await page.waitForSelector('[role="tablist"]', { timeout: 15_000 })
  // Let async suspense boundaries and any animations settle
  await page.waitForLoadState('networkidle')
}

// ── Navigate to a tab by clicking its role="tab" button ──────────────────────
async function navigateToTab(page, tabLabelRegex) {
  await page.getByRole('tab', { name: tabLabelRegex }).click()
  // Brief pause so the new tab's content renders before screenshot
  await page.waitForTimeout(300)
}

// ─── Snapshot tests ───────────────────────────────────────────────────────────

test.describe('Visual Regression — main views (guest mode)', () => {
  test.beforeEach(async ({ page }) => {
    await injectGuestMode(page)
    await page.goto('/')
    await waitForAppShell(page)
  })

  test('dashboard-view', async ({ page }) => {
    // DASHBOARD tab (tab id: 'dashboard', label: 'DASHBOARD')
    await navigateToTab(page, /dashboard/i)
    // Snapshot the main content area; exclude the clock (changes every second)
    const main = page.locator('main, [role="main"]').first()
    await expect(main).toBeVisible()
    await expect(page).toHaveScreenshot('dashboard-view.png', {
      animations: 'disabled',
      // Mask the live clock in the header to prevent timestamp-induced diff noise
      mask: [page.locator('header time, [data-testid="clock"], .sp-clock')],
    })
  })

  test('today-view', async ({ page }) => {
    // TODAY tab is the default landing tab (tab id: 'today', label: 'TODAY')
    // Navigate explicitly for clarity; app may already be on today tab
    await navigateToTab(page, /^today$|^bugün$/i)
    const main = page.locator('main, [role="main"]').first()
    await expect(main).toBeVisible()
    await expect(page).toHaveScreenshot('today-view.png', {
      animations: 'disabled',
      mask: [page.locator('header time, [data-testid="clock"], .sp-clock')],
    })
  })

  test('training-log-view', async ({ page }) => {
    // LOG tab (tab id: 'log', label: 'TRAINING LOG' / 'ANTRENMAN GÜNLÜĞÜ')
    await navigateToTab(page, /log|günlük/i)
    const main = page.locator('main, [role="main"]').first()
    await expect(main).toBeVisible()
    await expect(page).toHaveScreenshot('training-log-view.png', {
      animations: 'disabled',
      mask: [page.locator('header time, [data-testid="clock"], .sp-clock')],
    })
  })

  test('profile-view', async ({ page }) => {
    // PROFILE tab (tab id: 'profile', label: 'PROFILE' / 'PROFİL')
    await navigateToTab(page, /profile|profi̇l/i)
    const main = page.locator('main, [role="main"]').first()
    await expect(main).toBeVisible()
    await expect(page).toHaveScreenshot('profile-view.png', {
      animations: 'disabled',
      mask: [page.locator('header time, [data-testid="clock"], .sp-clock')],
    })
  })
})
