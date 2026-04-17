// ─── generate-weekly-report.spec.js — Playwright E2E: PDF report generation ───
// Requires ATHLETE_EMAIL + ATHLETE_PASSWORD env vars pointing to a real
// Supabase user with at least one session in the past 7 days.
//
// Run: npx playwright test e2e/generate-weekly-report.spec.js

const { test, expect } = require('@playwright/test')
const path = require('path')

const ATHLETE_EMAIL    = process.env.ATHLETE_EMAIL
const ATHLETE_PASSWORD = process.env.ATHLETE_PASSWORD
const BASE_URL         = process.env.BASE_URL || 'http://localhost:5173'

test.describe('PDF Report generation (Reports tab)', () => {
  test.skip(!ATHLETE_EMAIL || !ATHLETE_PASSWORD,
    'Set ATHLETE_EMAIL + ATHLETE_PASSWORD env vars to run report e2e tests')

  let page

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    page = await context.newPage()

    // Sign in
    await page.goto(`${BASE_URL}/`)
    await page.getByRole('button', { name: /sign in/i }).click()
    await page.getByLabel(/email/i).fill(ATHLETE_EMAIL)
    await page.getByLabel(/password/i).fill(ATHLETE_PASSWORD)
    await page.getByRole('button', { name: /continue|sign in/i }).click()
    await page.waitForURL(`${BASE_URL}/`)
  })

  test('navigates to Reports tab', async () => {
    await page.getByRole('tab', { name: /reports/i }).click()
    await expect(page.getByText(/PDF REPORTS/i)).toBeVisible({ timeout: 5000 })
  })

  test('shows Weekly Training Report generate button', async () => {
    await page.getByRole('tab', { name: /reports/i }).click()
    await expect(page.getByText(/Weekly Training Report/i)).toBeVisible()
    // At least one Generate button visible
    const generateBtns = page.getByRole('button', { name: /^Generate$/i })
    await expect(generateBtns.first()).toBeVisible()
  })

  test('generates a weekly report and shows success message', async () => {
    await page.getByRole('tab', { name: /reports/i }).click()

    // Find the weekly Generate button specifically
    const weeklyCard = page.locator('div').filter({ hasText: /Weekly Training Report/ }).first()
    const generateBtn = weeklyCard.getByRole('button', { name: /^Generate$/i })
    await expect(generateBtn).toBeVisible()
    await generateBtn.click()

    // Button text should change to "Generating…"
    await expect(weeklyCard.getByText(/Generating/i)).toBeVisible({ timeout: 3000 })

    // Wait for success (edge function may take 5–15s)
    await expect(page.getByText(/generated\./i)).toBeVisible({ timeout: 30_000 })

    // A Download link should appear in the success banner
    await expect(page.getByRole('link', { name: /Download/i })).toBeVisible()
  })

  test('new report row appears in history after generation', async () => {
    // After generating above, reload the tab to confirm the row persists
    await page.getByRole('tab', { name: /dashboard/i }).click()
    await page.getByRole('tab', { name: /reports/i }).click()

    // History should contain a weekly row
    await expect(page.getByText('Weekly Training Report')).toBeVisible({ timeout: 5000 })
  })

  test('download button triggers file download', async () => {
    await page.getByRole('tab', { name: /reports/i }).click()

    // Wait for history to load
    await expect(page.getByTitle('Download')).toBeVisible({ timeout: 5000 })

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTitle('Download').first().click(),
    ])

    // File name should contain 'sporeus' and end in .pdf
    expect(download.suggestedFilename()).toMatch(/sporeus.*\.pdf/)

    // Verify the download completes and the file is non-zero
    const filePath = await download.path()
    const fs = require('fs')
    const stat = fs.statSync(filePath)
    expect(stat.size).toBeGreaterThan(5_000)

    // Check PDF magic bytes
    const buf = Buffer.alloc(4)
    const fd = fs.openSync(filePath, 'r')
    fs.readSync(fd, buf, 0, 4, 0)
    fs.closeSync(fd)
    expect(buf.toString('ascii')).toBe('%PDF')
  })
})
