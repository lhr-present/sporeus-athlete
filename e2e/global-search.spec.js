// ─── e2e/global-search.spec.js — Playwright: global Ctrl+K search flow ───────
// Tests: open palette, type query, FTS results appear, keyboard nav, close.
// Guards: skipped unless E2E_FTS=1 env var is set (requires live Supabase + test data).
//
// Run: E2E_FTS=1 npx playwright test e2e/global-search.spec.js

import { test, expect } from '@playwright/test'

const ENABLED = !!process.env.E2E_FTS

test.describe('Global Search (Ctrl+K)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!ENABLED, 'E2E_FTS not set — skipping live FTS tests')
    await page.goto('http://localhost:5173/')
    // Wait for app shell to load
    await expect(page.locator('body')).toBeVisible()
  })

  test('Ctrl+K opens the search palette', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog', { name: /search/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /search/i })).toBeFocused()
  })

  test('ESC closes the palette', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog', { name: /search/i })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: /search/i })).not.toBeVisible()
  })

  test('typing a query shows FTS results from DB', async ({ page }) => {
    await page.keyboard.press('Control+k')
    const input = page.getByRole('textbox', { name: /search/i })
    await input.fill('run')

    // Wait for debounce + DB response (up to 3s)
    await expect(page.locator('[data-testid="fts-result"], .db-result').first())
      .toBeVisible({ timeout: 3000 })
      .catch(() => {
        // If no testid, look for db result count in footer
        return expect(page.getByText(/\d+ db results/)).toBeVisible({ timeout: 3000 })
      })
  })

  test('ArrowDown + Enter navigates to first result', async ({ page }) => {
    await page.keyboard.press('Control+k')
    const input = page.getByRole('textbox', { name: /search/i })
    await input.fill('run')

    // Wait for results
    await page.waitForTimeout(400)

    // Navigate to first result and select
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')

    // Palette should close after navigation
    await expect(page.getByRole('dialog', { name: /search/i })).not.toBeVisible()
  })

  test('clicking the backdrop closes the palette', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog', { name: /search/i })).toBeVisible()

    // Click the backdrop (outside the dialog)
    await page.mouse.click(10, 10)
    await expect(page.getByRole('dialog', { name: /search/i })).not.toBeVisible()
  })

  test('/ prefix shows command results', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await page.getByRole('textbox', { name: /search/i }).fill('/export')
    await expect(page.getByText(/export/i)).toBeVisible()
    // Should show command shortcut badge ⌘E
    await expect(page.getByText('⌘E')).toBeVisible()
  })

  test('# prefix filters local log entries', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await page.getByRole('textbox', { name: /search/i }).fill('#run')
    // Should not call DB search (log is local) — just check no crash + palette stays open
    await expect(page.getByRole('dialog', { name: /search/i })).toBeVisible()
  })
})
