// tests/e2e/program-tab-prod.spec.js
// Post-deploy smoke against the LIVE production URL (default app.sporeus.com).
// Verifies Mission #1 PROGRAM tab is in nav, renders ProgramView, and exposes
// the EliteProgramCard form. Bypasses AuthGate via sporeus-guest-mode flag so
// no Supabase test creds are required.
//
// Override target with PLAYWRIGHT_PROD_URL=https://staging.example.com
//
// Run locally:  npx playwright test --config=playwright.prod-smoke.config.js
import { test, expect } from '@playwright/test'

test.describe('app.sporeus.com — Mission #1 PROGRAM tab smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Activate guest mode + clear any stored tab so adaptive default → 'program'
    await page.addInitScript(() => {
      try {
        localStorage.setItem('sporeus-guest-mode', '1')
        localStorage.removeItem('sporeus-eliteProgram')
        localStorage.removeItem('sporeus-yearly-plan')
        localStorage.removeItem('sporeus_log')
        sessionStorage.removeItem('sporeus-active-tab')
      } catch {}
    })
  })

  test('PROGRAM tab is wired in nav and renders ProgramView', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))

    await page.goto('/')

    // PROGRAM tab is reachable from the top nav (desktop) or mobile bottom bar.
    const programTab = page.getByRole('tab', { name: /program/i }).first()
    await expect(programTab).toBeVisible({ timeout: 20_000 })
    await programTab.click()

    // ProgramView ships a bilingual headline — match either EN or TR variant.
    const headline = page.getByText(
      /YEARLY PROGRAM BUILDER|YILLIK PROGRAM ÜRETİCİ/i
    )
    await expect(headline).toBeVisible({ timeout: 15_000 })

    // The scroll-target wrapper around EliteProgramCard must be present.
    await expect(page.locator('[data-elite-program-card]')).toBeAttached()

    // No uncaught JS exceptions during the flow.
    expect(errors, `Unexpected pageerrors:\n${errors.join('\n')}`).toEqual([])
  })

  test('first-time guest lands on PROGRAM by default (adaptive landing)', async ({ page }) => {
    await page.goto('/')

    // The adaptive default-tab logic should have selected 'program' for a
    // fresh guest with no plan + no log entries. We verify the headline is
    // visible without any tab click.
    const headline = page.getByText(
      /YEARLY PROGRAM BUILDER|YILLIK PROGRAM ÜRETİCİ/i
    )
    await expect(headline).toBeVisible({ timeout: 20_000 })
  })
})
