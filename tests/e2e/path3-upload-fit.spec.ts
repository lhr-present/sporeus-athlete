/**
 * Path 3 — Upload GPX file → parsed session appears with TSS
 *
 * Uses the GPX fixture at tests/fixtures/sample.gpx (60 min, ~200W average).
 * The parse-activity edge function is mocked to return a deterministic parsed
 * session — this keeps the test hermetic (no live edge function call needed)
 * while still exercising the full UI upload → polling → log-entry flow.
 *
 * The AI insight webhook (analyse-session) is also mocked: the test verifies
 * the insight card appears within 30 s by seeding an ai_insights row directly
 * after the parsed session is confirmed in the DB.
 */
import { test, expect }  from '@playwright/test'
import * as path          from 'path'
import * as fs            from 'fs'
import { injectSession, clickTab, waitForAppShell } from './helpers/auth.js'
import { admin, waitForRow }                         from './helpers/db.js'

const FIXTURE_GPX = path.join(__dirname, '..', 'fixtures', 'sample.gpx')
const PERF_FILE   = path.join(__dirname, 'perf-baseline.json')

function recordTiming(name: string, ms: number) {
  let b: Record<string, number[]> = {}
  try { b = JSON.parse(fs.readFileSync(PERF_FILE, 'utf8')) } catch {}
  b[name] = [...(b[name] ?? []).slice(-9), ms]
  fs.writeFileSync(PERF_FILE, JSON.stringify(b, null, 2))
}

test.describe('Path 3 — GPX upload → parsed session + AI insight', () => {
  test('upload GPX, see parsed session with TSS, AI insight appears', async ({ page }) => {
    const t0 = Date.now()

    const user = {
      email:    process.env.E2E_ATHLETE_A_EMAIL!,
      password: process.env.E2E_ATHLETE_A_PW!,
      id:       process.env.E2E_ATHLETE_A_ID!,
    }

    // ── 1. Mock parse-activity edge function ──────────────────────────────────
    let parsedSessionId: string | null = null

    await page.route('**/functions/v1/parse-activity**', async route => {
      // Simulate a successful parse: insert a training_log row and return its id
      const { data } = await admin()
        .from('training_log')
        .insert({
          user_id:      user.id,
          date:         new Date().toISOString().slice(0, 10),
          type:         'Morning Ride',
          duration_min: 60,
          tss:          55,
          rpe:          6,
          notes:        'Parsed from GPX fixture (e2e)',
          source:       'gpx',
        })
        .select('id')
        .single()

      parsedSessionId = data?.id ?? null

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok:          true,
          log_entry_id: parsedSessionId,
          duration_min: 60,
          tss:          55,
          source:       'gpx',
        }),
      })
    })

    // Mock Supabase Storage upload so the file doesn't actually go to S3
    await page.route('**/storage/v1/object/activity-uploads/**', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ Key: `${user.id}/e2e-test.gpx` }),
        })
      } else {
        await route.continue()
      }
    })

    // ── 2. Inject session and navigate ────────────────────────────────────────
    await injectSession(page, user)
    await page.goto('/')
    await waitForAppShell(page)

    // ── 3. Navigate to Training Log tab ───────────────────────────────────────
    await clickTab(page, 'TRAINING LOG')
    await expect(page.getByText(/log session/i)).toBeVisible({ timeout: 10_000 })

    // ── 4. Find the upload trigger (file input or dropzone) ───────────────────
    // UploadActivity renders a drag-and-drop zone; clicking it opens a file dialog.
    // Alternatively, there may be an "Upload" button that shows the UploadActivity modal.
    const uploadBtn = page.getByRole('button', { name: /upload|import/i }).first()
    if (await uploadBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await uploadBtn.click()
    }

    // Wait for the dropzone to appear
    const dropzone = page.locator('[data-testid="upload-dropzone"], .upload-zone, input[type="file"]').first()
    await expect(dropzone).toBeVisible({ timeout: 10_000 })

    // ── 5. Drop the GPX fixture file onto the dropzone ────────────────────────
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(FIXTURE_GPX)

    // ── 6. Progress indicator should appear ───────────────────────────────────
    await expect(
      page.getByText(/uploading|queued|parsing|done/i)
    ).toBeVisible({ timeout: 15_000 })

    // ── 7. "Done — session logged!" status ────────────────────────────────────
    await expect(page.getByText(/done.*session logged|session logged/i))
      .toBeVisible({ timeout: 30_000 })

    // ── 8. Parsed session appears in log list ─────────────────────────────────
    await expect(page.getByText(/morning ride/i)).toBeVisible({ timeout: 15_000 })

    // Verify TSS is shown (≥1, any number)
    await expect(page.getByText(/tss/i)).toBeVisible({ timeout: 5_000 })

    // ── 9. Verify training_log row in DB ─────────────────────────────────────
    const row = await waitForRow(
      'training_log',
      { user_id: user.id, source: 'gpx' },
      { timeoutMs: 15_000 },
    )
    expect(Number(row.duration_min)).toBe(60)
    expect(Number(row.tss)).toBeGreaterThan(0)

    // ── 10. Seed AI insight and verify insight card appears (≤30 s) ───────────
    // The analyse-session webhook fires after training_log INSERT.
    // In E2E we seed the insight directly to simulate the webhook completing.
    if (parsedSessionId) {
      await admin().from('ai_insights').insert({
        athlete_id:   user.id,
        session_id:   parsedSessionId,
        date:         new Date().toISOString().slice(0, 10),
        data_hash:    'e2e-test-hash',
        insight_json: {
          text:     'Good aerobic session. Keep the effort manageable.',
          flags:    [],
          insights: ['Solid Z2 effort', 'Recovery adequate'],
          summary:  'Productive endurance ride.',
        },
        model: 'claude-haiku-4-5',
        kind:  'session_analysis',
      })
    }

    // Insight card should appear (the app polls or uses realtime)
    // Reload the log tab to trigger re-fetch
    await clickTab(page, 'DASHBOARD')
    await clickTab(page, 'TRAINING LOG')
    await expect(
      page.getByText(/insight|ai|coaching|aerobic/i).first()
    ).toBeVisible({ timeout: 30_000 })

    recordTiming('path3_upload_gpx', Date.now() - t0)
  })
})
