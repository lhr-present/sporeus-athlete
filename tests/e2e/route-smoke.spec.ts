// tests/e2e/route-smoke.spec.ts
// P1: Route-level smoke suite — mounts every special route and asserts
//   1. Body is non-blank (not white screen)
//   2. No uncaught JS exceptions (pageerror)
//   3. Expected sentinel text is present
//
// No auth required for any of these routes — they all bypass the AuthGate.
// This suite runs in CI without Supabase credentials.
//
// Coverage rationale:
//   • BOOK_MODE (ch1..ch22): These routes are the QR codes in the printed book.
//     Any auth-gate regression silently breaks every QR link.
//     Bugs caught: v9.2.3 (BOOK_MODE behind auth wall), v9.2.2 (useLanguage build break)
//   • EMBED_MODE, SCIENCE_MODE, PRIVACY_MODE: All bypass auth — same failure class.

import { test, expect } from '@playwright/test'

// ── Route manifest ────────────────────────────────────────────────────────────

const BOOK_ROUTES = [
  { path: '/b/ch1',  sentinel: 'CHAPTER 1'  },
  { path: '/b/ch7',  sentinel: 'CHAPTER 7'  },
  { path: '/b/ch22', sentinel: 'CHAPTER 22' },
]

const SPECIAL_ROUTES = [
  // Auth gate — should show sign-in form, not crash
  { path: '/',             sentinel: 'Sporeus',  allowAuthGate: true },
  // Embed mode — stripped UI, no auth required
  { path: '/?embed=true',  sentinel: 'Sporeus',  allowAuthGate: true },
  // Science mode — standalone panel, no auth required
  { path: '/?science=1',   sentinel: 'Sporeus',  allowAuthGate: true },
  // Privacy mode — standalone policy view, no auth required
  { path: '/?privacy=1',   sentinel: 'Sporeus',  allowAuthGate: true },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const IGNORED_ERRORS = [
  /favicon/i,
  /CORS/i,              // attribution-log CORS in dev — expected
  /ERR_FAILED/i,        // supabase not configured in route-smoke env
  /Failed to fetch/i,
  /NetworkError/i,
  /supabase.*not configured/i,
  /VITE_SUPABASE/i,
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function captureErrors(page: any) {
  const errors: string[] = []
  page.on('pageerror', (e) => {
    // A pageerror means uncaught JS exception — always fatal
    errors.push(`pageerror: ${e.message}`)
  })
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    if (IGNORED_ERRORS.some((re) => re.test(text))) return
    errors.push(`console.error: ${text}`)
  })
  return errors
}

// ── Book chapter routes ───────────────────────────────────────────────────────

test.describe('BOOK_MODE routes (no auth required)', () => {
  for (const { path, sentinel } of BOOK_ROUTES) {
    test(`${path} renders without auth`, async ({ page }) => {
      const errors = captureErrors(page)

      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')

      // Must not hit auth gate
      const bodyText = await page.locator('body').innerText()
      expect(bodyText.trim().length, `${path}: white screen`).toBeGreaterThan(50)
      expect(bodyText, `${path}: auth wall instead of chapter`).not.toContain('Sign in')
      expect(bodyText, `${path}: auth wall instead of chapter`).not.toContain('Giriş yap')

      // Must contain the chapter sentinel
      await expect(page.locator('body')).toContainText(sentinel, { timeout: 8_000 })

      // Must contain the signup CTA
      const cta = page.getByText(/Create Free Sporeus Account|Ücretsiz Sporeus Hesabı/i)
      await expect(cta.first()).toBeVisible({ timeout: 8_000 })

      // No uncaught JS exceptions
      expect(errors.filter(e => e.startsWith('pageerror')), `${path} uncaught JS:\n${errors.join('\n')}`).toEqual([])
    })
  }
})

// ── All 22 chapter routes ────────────────────────────────────────────────────

test.describe('BOOK_MODE all chapters render', () => {
  for (let i = 1; i <= 22; i++) {
    const path = `/b/ch${i}`
    const sentinel = `CHAPTER ${i}`
    test(`${path} renders`, async ({ page }) => {
      const errors = captureErrors(page)
      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')
      await expect(page.locator('body')).toContainText(sentinel, { timeout: 8_000 })
      expect(errors.filter(e => e.startsWith('pageerror'))).toEqual([])
    })
  }
})

// ── Special query-param routes ────────────────────────────────────────────────

test.describe('special query-param routes render', () => {
  for (const { path, sentinel } of SPECIAL_ROUTES) {
    test(`${path} renders without crashing`, async ({ page }) => {
      const errors = captureErrors(page)

      await page.goto(path)
      await page.waitForLoadState('domcontentloaded')

      const bodyText = await page.locator('body').innerText()
      expect(bodyText.trim().length, `${path}: white screen`).toBeGreaterThan(50)

      expect(errors.filter(e => e.startsWith('pageerror')), `${path} uncaught JS:\n${errors.join('\n')}`).toEqual([])
    })
  }
})
