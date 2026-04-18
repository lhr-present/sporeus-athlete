/**
 * Path 1 — New user signup → first session logged
 *
 * Tests the core acquisition flow end-to-end:
 *   Sign up → consent gate → onboarding wizard → LOG tab → add session → verify in DB
 *
 * Uses email/password signup (Google OAuth is an alias in the same AuthGate;
 * email/password is fully exercised and equivalent for acquisition flow testing).
 * Requires E2E_* env vars (set by globalSetup or .env.e2e).
 *
 * Email confirmation must be DISABLED in the test Supabase branch
 * (Dashboard → Auth → Email → "Enable email confirmations" = OFF).
 */
import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { admin, deleteTestUser, waitForRow } from './helpers/db.js'
import { testEmail } from '../fixtures/factories.js'

const PERF_FILE = path.join(__dirname, 'perf-baseline.json')

function recordTiming(name: string, ms: number) {
  let baseline: Record<string, number[]> = {}
  try { baseline = JSON.parse(fs.readFileSync(PERF_FILE, 'utf8')) } catch {}
  baseline[name] = [...(baseline[name] ?? []).slice(-9), ms]   // keep last 10 runs
  fs.writeFileSync(PERF_FILE, JSON.stringify(baseline, null, 2))
}

test.describe('Path 1 — signup → log session', () => {
  let createdUserId: string | null = null
  const email    = testEmail('p1')
  const password = 'E2eTestPass!2026'

  test.afterAll(async () => {
    if (createdUserId) await deleteTestUser(createdUserId).catch(() => {})
  })

  test('new user can sign up, complete onboarding, and log a session', async ({ page }) => {
    const t0 = Date.now()

    // ── 1. Land on app ────────────────────────────────────────────────────────
    await page.goto('/')
    await expect(page.locator('text=SPOREUS')).toBeVisible({ timeout: 10_000 })

    // ── 2. Switch to sign-up mode and create account ──────────────────────────
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel(/email/i).fill(email)

    // Password field — AuthGate renders two inputs; target the second (password)
    const pwField = page.getByLabel(/password/i)
    await pwField.fill(password)
    await page.getByRole('button', { name: /create account|sign up/i }).click()

    // With email confirmation disabled, supabase signs the user in immediately.
    // Grab the user id before the app navigates away.
    // Poll until auth.users row exists (up to 10s).
    let userId: string | null = null
    for (let i = 0; i < 20; i++) {
      const { data } = await admin().auth.admin.listUsers()
      const u = data?.users?.find(u => u.email === email)
      if (u) { userId = u.id; break }
      await page.waitForTimeout(500)
    }
    expect(userId, 'User should have been created in Supabase').toBeTruthy()
    createdUserId = userId!

    // ── 3. Consent gate ───────────────────────────────────────────────────────
    // The GDPR consent modal appears on first visit.
    const consentBtn = page.getByRole('button', { name: /i consent|kabul/i })
    if (await consentBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await consentBtn.click()
    }

    // ── 4. Onboarding wizard ──────────────────────────────────────────────────
    // Step 0: Welcome screen — click Continue / Next
    const nextBtn = () => page.getByRole('button', { name: /next|continue|devam|ileri/i }).first()
    await expect(page.locator('text=◈ SPOREUS')).toBeVisible({ timeout: 10_000 })
    await nextBtn().click()

    // Step 1: Basic info — set name, select Cycling sport
    await page.getByPlaceholder(/athlete name/i).fill('Test Athlete P1')
    await page.getByRole('button', { name: /cycling/i }).click()
    await nextBtn().click()

    // Step 2: Fitness level — pick Intermediate (default), click next
    const intermBtn = page.getByRole('button', { name: /intermediate/i })
    if (await intermBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await intermBtn.click()
    }
    await nextBtn().click()

    // Step 3: Performance params — enter FTP 250
    const ftpInput = page.getByPlaceholder(/ftp|watts/i)
    if (await ftpInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await ftpInput.fill('250')
    }
    await nextBtn().click()

    // Continue through any remaining steps until the app shell appears
    for (let i = 0; i < 5; i++) {
      const btn = nextBtn()
      if (await btn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await btn.click()
      } else {
        break
      }
    }

    // ── 5. App shell should now be visible ────────────────────────────────────
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15_000 })

    // ── 6. Navigate to Training Log tab ───────────────────────────────────────
    await page.getByRole('tab', { name: /training log|log/i }).click()
    await expect(page.getByText(/log session/i)).toBeVisible({ timeout: 10_000 })

    // ── 7. Fill in a 60-minute session at RPE 6 ───────────────────────────────
    // Date defaults to today — leave it
    await page.getByLabel(/session type/i).selectOption('Easy Ride')

    const durInput = page.getByLabel(/duration/i)
    await durInput.fill('60')

    const rpeInput = page.getByLabel(/rpe/i)
    await rpeInput.fill('6')

    // TSS auto-calc: preview TSS if the button exists
    const previewBtn = page.getByRole('button', { name: /preview tss/i })
    if (await previewBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await previewBtn.click()
      // TSS preview should appear
      await expect(page.getByText(/tss/i)).toBeVisible({ timeout: 5_000 })
    }

    // ── 8. Submit the session ─────────────────────────────────────────────────
    await page.getByRole('button', { name: /add session|\+ add/i }).click()

    // ── 9. Session appears in the history list ────────────────────────────────
    await expect(page.getByText(/easy ride/i)).toBeVisible({ timeout: 10_000 })

    // ── 10. Verify DB row ─────────────────────────────────────────────────────
    const row = await waitForRow('training_log', { user_id: userId! }, { timeoutMs: 15_000 })
    expect(row.user_id).toBe(userId)
    expect(Number(row.duration_min)).toBe(60)
    expect(Number(row.rpe)).toBe(6)

    // ── Record timing ─────────────────────────────────────────────────────────
    recordTiming('path1_signup_log_session', Date.now() - t0)
  })
})
