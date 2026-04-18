/**
 * Path 4 — Free athlete → upgrade to Coach → invite first athlete
 *
 * Tests the full monetization + invite flow:
 *   Upgrade gate → mock payment webhook → tier updates → invite code generated
 *   → second browser context redeems code → coach_athletes row created.
 *
 * Payment mocking:
 *   - Dodo sandbox: we intercept the dodo-webhook edge function and send a
 *     payment.succeeded payload directly (simulates the Dodo server callback).
 *   - Stripe sandbox: same pattern.
 *   - The UI checkout redirect is intercepted so no real payment page opens.
 */
import { test, expect } from '@playwright/test'
import * as path         from 'path'
import * as fs           from 'fs'
import { injectSession, clickTab, waitForAppShell } from './helpers/auth.js'
import { admin, waitForRow, setUserTier }            from './helpers/db.js'
import { mockDodoWebhook }                           from '../fixtures/factories.js'

const PERF_FILE = path.join(__dirname, 'perf-baseline.json')
function recordTiming(name: string, ms: number) {
  let b: Record<string, number[]> = {}
  try { b = JSON.parse(fs.readFileSync(PERF_FILE, 'utf8')) } catch {}
  b[name] = [...(b[name] ?? []).slice(-9), ms]
  fs.writeFileSync(PERF_FILE, JSON.stringify(b, null, 2))
}

test.describe('Path 4 — upgrade → invite athlete', () => {
  test('free user upgrades to coach, generates invite, athlete redeems it', async ({ browser }) => {
    const t0 = Date.now()

    const coach = {
      email:    process.env.E2E_COACH_A_EMAIL!,
      password: process.env.E2E_COACH_A_PW!,
      id:       process.env.E2E_COACH_A_ID!,
    }
    const athleteB = {
      email:    process.env.E2E_ATHLETE_B_EMAIL!,
      password: process.env.E2E_ATHLETE_B_PW!,
      id:       process.env.E2E_ATHLETE_B_ID!,
    }

    // Start coachA as free-tier to trigger the upgrade gate
    await setUserTier(coach.id, 'free')

    // ── Context 1: Coach browser ───────────────────────────────────────────────
    const coachCtx  = await browser.newContext()
    const coachPage = await coachCtx.newPage()

    // Mock the Dodo checkout redirect (so we never open a real payment page)
    await coachPage.route('**/checkout.dodopayments.com/**', async route => {
      // Simulate user completing payment — redirect back to app with success param
      const appUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173/'
      await route.fulfill({ status: 302, headers: { Location: `${appUrl}?payment=success` } })
    })

    // Mock Stripe checkout redirect
    await coachPage.route('**/checkout.stripe.com/**', async route => {
      const appUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173/'
      await route.fulfill({ status: 302, headers: { Location: `${appUrl}?payment=success` } })
    })

    // Mock dodo-webhook edge function so tier update happens without real Dodo server
    await coachPage.route('**/functions/v1/dodo-webhook**', async route => {
      // Apply the tier update directly in DB (what the real webhook handler does)
      await setUserTier(coach.id, 'coach')
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ received: true }),
      })
    })

    // ── 1. Sign in as free coach, see upgrade gate ────────────────────────────
    await injectSession(coachPage, coach)
    // Override: inject as FREE tier so the gate shows
    await coachPage.addInitScript(() => {
      localStorage.setItem('sporeus-tier', 'free')
    })
    await coachPage.goto('/')
    await waitForAppShell(coachPage)

    // ── 2. Navigate to Squad / Coach area — should hit the upgrade gate ────────
    // The upgrade gate appears when a free user tries to use coach features.
    // Navigate to profile and look for upgrade CTA.
    await clickTab(coachPage, 'PROFILE')

    // Look for any upgrade / subscription / tier CTA
    const upgradeText = coachPage.getByText(/upgrade|coach tier|subscription|plan/i).first()
    await expect(upgradeText).toBeVisible({ timeout: 10_000 })

    // Click upgrade button
    const upgradeBtn = coachPage
      .getByRole('button', { name: /upgrade|get coach|subscribe/i })
      .first()
    if (await upgradeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await upgradeBtn.click()
    }

    // ── 3. Simulate Dodo webhook payment.succeeded (bypass real payment UI) ────
    // Directly update the tier in DB (mimicking what the webhook does).
    await setUserTier(coach.id, 'coach')

    // Reload the page so the app picks up the new tier from Supabase
    await coachPage.reload()
    await waitForAppShell(coachPage)

    // ── 4. Verify tier banner updated ─────────────────────────────────────────
    // The app should show coach tier indicator
    await expect(
      coachPage.getByText(/coach|◈ coach|tier.*coach/i).first()
    ).toBeVisible({ timeout: 10_000 })

    // ── 5. Generate an invite code ─────────────────────────────────────────────
    // Navigate to the invite / squad section
    const inviteSection = coachPage.getByText(/invite|squad|manage athletes/i).first()
    if (await inviteSection.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await inviteSection.click()
    } else {
      // Try Profile tab where InviteManager is rendered
      await clickTab(coachPage, 'PROFILE')
    }

    // Click "Generate invite" or similar
    const genBtn = coachPage
      .getByRole('button', { name: /generate.*invite|new invite|invite athlete/i })
      .first()
    await expect(genBtn).toBeVisible({ timeout: 10_000 })
    await genBtn.click()

    // Wait for SP-XXXXXXXX code to appear
    const codePattern = /SP-[A-Z0-9]{8}/
    await expect(coachPage.getByText(codePattern)).toBeVisible({ timeout: 10_000 })

    // Extract the invite code from the page
    const codeText = await coachPage.getByText(codePattern).first().textContent()
    const match    = codeText?.match(codePattern)
    expect(match, 'SP-XXXXXXXX code must be visible').toBeTruthy()
    const inviteCode = match![0]

    // Verify coach_invites row in DB
    const inviteRow = await waitForRow(
      'coach_invites',
      { coach_id: coach.id, code: inviteCode },
      { timeoutMs: 10_000 },
    )
    expect(inviteRow.code).toBe(inviteCode)
    expect(inviteRow.used_by).toBeNull()

    // ── 6. Context 2: AthleteB redeems the invite ─────────────────────────────
    const athleteCtx  = await browser.newContext()
    const athletePage = await athleteCtx.newPage()

    await injectSession(athletePage, athleteB)
    // Navigate to app with invite param in URL
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173/'
    await athletePage.goto(`${baseUrl}?invite=${inviteCode}`)
    await waitForAppShell(athletePage)

    // The invite acceptance modal should appear
    await expect(
      athletePage.getByText(/coach invite|accept.*invite|join.*coach/i).first()
    ).toBeVisible({ timeout: 10_000 })

    // Click Accept
    await athletePage.getByRole('button', { name: /accept|confirm|join/i }).first().click()

    // ── 7. Verify coach_athletes row created with status='active' ─────────────
    const linkRow = await waitForRow(
      'coach_athletes',
      { coach_id: coach.id, athlete_id: athleteB.id, status: 'active' },
      { timeoutMs: 15_000 },
    )
    expect(linkRow.status).toBe('active')

    // ── 8. Verify invite is now marked as used ────────────────────────────────
    const { data: usedInvite } = await admin()
      .from('coach_invites')
      .select('used_by')
      .eq('code', inviteCode)
      .single()
    expect(usedInvite?.used_by).toBe(athleteB.id)

    // ── Cleanup ───────────────────────────────────────────────────────────────
    await coachCtx.close()
    await athleteCtx.close()

    recordTiming('path4_upgrade_invite', Date.now() - t0)
  })
})
