// ─── e2e/upload-activity.spec.js — Playwright: FIT/GPX upload flow ────────────
// Full upload → parse → training log entry flow.
// Requires: dev server running on http://localhost:5173, signed-in test account.

import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES  = path.join(__dirname, 'fixtures')

test.describe('FIT/GPX Upload', () => {
  test.beforeEach(async ({ page }) => {
    // Assumes test account already authenticated via storageState or login fixture
    await page.goto('http://localhost:5173/')
    await page.getByRole('button', { name: /log/i }).click()
    await expect(page.getByText('SESSION HISTORY')).toBeVisible()
  })

  test('opens upload panel from ↑ UPLOAD & PARSE button', async ({ page }) => {
    await page.getByRole('button', { name: /upload & parse/i }).click()
    await expect(page.getByText('↑ UPLOAD ACTIVITY')).toBeVisible()
    await expect(page.getByText(/drop .fit or .gpx file/i)).toBeVisible()
  })

  test('rejects file > 25 MB client-side', async ({ page }) => {
    await page.getByRole('button', { name: /upload & parse/i }).click()
    // Create a 26 MB dummy buffer via JS
    await page.evaluate(() => {
      const dt = new DataTransfer()
      const bigArr = new Uint8Array(27 * 1024 * 1024)
      const file = new File([bigArr], 'toobig.fit', { type: 'application/octet-stream' })
      dt.items.add(file)
      const input = document.querySelector('input[type="file"]')
      Object.defineProperty(input, 'files', { configurable: true, value: dt.files })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await expect(page.getByText(/too large|25 MB/i)).toBeVisible()
  })

  test('FIT file upload → parse → new session in log', async ({ page }) => {
    // Uses a real minimal FIT fixture (generated offline)
    const fitPath = path.join(FIXTURES, 'sample.fit')
    await page.getByRole('button', { name: /upload & parse/i }).click()
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(fitPath)
    await expect(page.getByText(/uploading|parsing/i)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/done — session logged/i)).toBeVisible({ timeout: 30_000 })
    // Session should appear in training log
    await page.getByRole('button', { name: /view log/i }).click()
    await expect(page.locator('table').getByText('file_upload').first()).toBeVisible({ timeout: 5000 })
  })
})
