// ─── e2e/live-squad-feed.spec.js — Playwright two-context realtime feed test ───
// Simulates a coach watching the live squad feed while an athlete logs a session.
// Requires a seeded Supabase test environment with:
//   - A coach user (COACH_EMAIL / COACH_PASSWORD)
//   - An athlete already linked to that coach
//
// Skip gracefully when COACH_EMAIL env var is absent (CI without Supabase creds).

import { test, expect } from '@playwright/test'

const COACH_EMAIL    = process.env.COACH_EMAIL    || ''
const COACH_PASSWORD = process.env.COACH_PASSWORD || ''
const ATHLETE_EMAIL  = process.env.ATHLETE_EMAIL  || ''
const ATHLETE_PASS   = process.env.ATHLETE_PASS   || ''
const APP_URL        = process.env.APP_URL        || 'http://localhost:5173'

test.describe('Live Squad Feed — realtime update', () => {
  test.skip(!COACH_EMAIL || !ATHLETE_EMAIL, 'Supabase test credentials not set — skipping realtime e2e')

  test('athlete session appears in coach live feed', async ({ browser }) => {
    // ── Coach context: open app + navigate to Coach tab ───────────────────────
    const coachCtx  = await browser.newContext()
    const coachPage = await coachCtx.newPage()
    await coachPage.goto(APP_URL)

    // Sign in as coach
    await coachPage.getByRole('button', { name: /sign in/i }).click()
    await coachPage.getByPlaceholder(/email/i).fill(COACH_EMAIL)
    await coachPage.getByPlaceholder(/password/i).fill(COACH_PASSWORD)
    await coachPage.getByRole('button', { name: /sign in/i }).last().click()

    // Navigate to Coach tab
    await coachPage.getByRole('tab', { name: /coach/i }).click()
    await expect(coachPage.getByText(/SQUAD FEED/i)).toBeVisible({ timeout: 10000 })

    // Confirm live feed is connected
    await expect(coachPage.getByText(/● LIVE/i)).toBeVisible({ timeout: 15000 })

    // ── Athlete context: log a training session ───────────────────────────────
    const athleteCtx  = await browser.newContext()
    const athletePage = await athleteCtx.newPage()
    await athletePage.goto(APP_URL)

    await athletePage.getByRole('button', { name: /sign in/i }).click()
    await athletePage.getByPlaceholder(/email/i).fill(ATHLETE_EMAIL)
    await athletePage.getByPlaceholder(/password/i).fill(ATHLETE_PASS)
    await athletePage.getByRole('button', { name: /sign in/i }).last().click()

    // Quick add a session
    await athletePage.keyboard.press('+')
    await athletePage.locator('input[name="type"]').fill('run')
    await athletePage.locator('input[name="duration_min"]').fill('45')
    await athletePage.getByRole('button', { name: /add|save/i }).click()

    // ── Coach context: feed should update ────────────────────────────────────
    await expect(
      coachPage.locator('[data-testid="squad-feed-event"]').first()
    ).toBeVisible({ timeout: 20000 })

    const feedItem = coachPage.locator('[data-testid="squad-feed-event"]').first()
    await expect(feedItem).toContainText(/run/i)

    // ── Cleanup ───────────────────────────────────────────────────────────────
    await coachCtx.close()
    await athleteCtx.close()
  })

  test('LiveSquadFeed collapses and expands on header click', async ({ page }) => {
    await page.goto(APP_URL)

    // Sign in as coach (minimal — just test collapse UI without realtime)
    if (COACH_EMAIL) {
      await page.getByRole('button', { name: /sign in/i }).click()
      await page.getByPlaceholder(/email/i).fill(COACH_EMAIL)
      await page.getByPlaceholder(/password/i).fill(COACH_PASSWORD)
      await page.getByRole('button', { name: /sign in/i }).last().click()
      await page.getByRole('tab', { name: /coach/i }).click()
    }

    const header = page.locator('text=SQUAD FEED').first()
    await expect(header).toBeVisible({ timeout: 10000 })

    // Feed should be expanded (▲ indicator)
    await expect(page.locator('text=▲').first()).toBeVisible()

    // Click header to collapse
    await header.click()
    await expect(page.locator('text=▼').first()).toBeVisible()

    // Click again to expand
    await header.click()
    await expect(page.locator('text=▲').first()).toBeVisible()
  })
})
