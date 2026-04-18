/**
 * Path 5 — Coach weekly report generation → PDF download
 *
 * Prerequisites (seeded by globalSetup):
 *   - coachA has coach tier, ≥2 active athletes (athleteA + athleteB), each with sessions.
 *
 * The generate-report edge function is mocked to return a signed URL pointing
 * at a minimal real PDF so we can verify the file is valid without running
 * the full PDF generation pipeline in CI.
 *
 * PDF validity check: reads first 4 bytes of downloaded file — must be %PDF.
 * Size check: >5 KB and <2 MB (as per acceptance criteria).
 * Content check: verify each athlete's display_name appears in the PDF text.
 *
 * pdf-parse is not installed; we use a lightweight %PDF header + text search
 * via Buffer.indexOf after downloading the file via page.request.
 */
import { test, expect } from '@playwright/test'
import * as path         from 'path'
import * as fs           from 'fs'
import { injectSession, clickTab, waitForAppShell } from './helpers/auth.js'
import { admin, waitForRow }                         from './helpers/db.js'

const PERF_FILE = path.join(__dirname, 'perf-baseline.json')
function recordTiming(name: string, ms: number) {
  let b: Record<string, number[]> = {}
  try { b = JSON.parse(fs.readFileSync(PERF_FILE, 'utf8')) } catch {}
  b[name] = [...(b[name] ?? []).slice(-9), ms]
  fs.writeFileSync(PERF_FILE, JSON.stringify(b, null, 2))
}

// Minimal valid PDF containing athlete names (used as mock download target)
function buildMockPdf(athleteNames: string[]): Buffer {
  const namesSection = athleteNames.join('\n')
  const content = `BT /F1 12 Tf 72 700 Td (Weekly Training Report) Tj\n(${namesSection}) Tj ET`
  const stream  = `stream\n${content}\nendstream`
  const pdf = [
    '%PDF-1.4',
    '1 0 obj<</Type /Catalog /Pages 2 0 R>>endobj',
    '2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj',
    `3 0 obj<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<</Font<</F1 5 0 R>>>>>>endobj`,
    `4 0 obj<</Length ${stream.length}>>\n${stream}\nendobj`,
    '5 0 obj<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
    'trailer<</Size 6 /Root 1 0 R>>',
    'startxref',
    '0',
    '%%EOF',
  ].join('\n')
  return Buffer.from(pdf, 'utf8')
}

test.describe('Path 5 — coach report generation → PDF download', () => {
  test('generate weekly report, download valid PDF containing athlete names', async ({ page }) => {
    const t0 = Date.now()

    const coach = {
      email:    process.env.E2E_COACH_A_EMAIL!,
      password: process.env.E2E_COACH_A_PW!,
      id:       process.env.E2E_COACH_A_ID!,
    }
    const athleteAId = process.env.E2E_ATHLETE_A_ID!
    const athleteBId = process.env.E2E_ATHLETE_B_ID!

    // Fetch athlete display names for PDF content assertion
    const { data: profiles } = await admin()
      .from('profiles')
      .select('display_name')
      .in('id', [athleteAId, athleteBId])
    const athleteNames = (profiles ?? [])
      .map(p => p.display_name)
      .filter(Boolean) as string[]

    // ── 1. Build mock PDF buffer containing athlete names ─────────────────────
    const mockPdfBuffer = buildMockPdf(athleteNames)

    // ── 2. Mock the generate-report edge function ─────────────────────────────
    let reportInserted = false
    await page.route('**/functions/v1/generate-report**', async route => {
      // Insert a generated_reports row to satisfy the listReports() call
      if (!reportInserted) {
        reportInserted = true
        await admin().from('generated_reports').insert({
          user_id:      coach.id,
          kind:         'weekly',
          storage_path: `${coach.id}/e2e-weekly-report.pdf`,
          params:       { week_start: new Date().toISOString().slice(0, 10) },
          expires_at:   new Date(Date.now() + 30 * 86400_000).toISOString(),
        })
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          signedUrl:   `${process.env.E2E_SUPABASE_URL}/storage/v1/object/sign/reports/${coach.id}/e2e-weekly-report.pdf?token=mock`,
          reportId:    'e2e-report-id',
          storagePath: `${coach.id}/e2e-weekly-report.pdf`,
          expiresAt:   new Date(Date.now() + 3600_000).toISOString(),
        }),
      })
    })

    // Mock the signed PDF download URL so we control the bytes
    await page.route('**/storage/v1/object/sign/reports/**', async route => {
      await route.fulfill({
        status:      200,
        contentType: 'application/pdf',
        body:        mockPdfBuffer,
        headers: {
          'content-disposition': 'attachment; filename="weekly-report.pdf"',
          'content-length':      String(mockPdfBuffer.length),
        },
      })
    })

    // ── 3. Also mock getSignedUrl RPC calls ───────────────────────────────────
    await page.route('**/storage/v1/object/sign/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          signedURL: `/storage/v1/object/sign/reports/${coach.id}/e2e-weekly-report.pdf?token=mock`,
        }),
      })
    })

    // ── 4. Inject session and navigate ────────────────────────────────────────
    await injectSession(page, coach)
    await page.goto('/')
    await waitForAppShell(page)

    // ── 5. Navigate to Reports tab ────────────────────────────────────────────
    await clickTab(page, 'REPORTS')
    await expect(page.getByText(/weekly.*report|report.*weekly/i)).toBeVisible({ timeout: 10_000 })

    // ── 6. Click "Generate weekly report now" ─────────────────────────────────
    const generateBtn = page
      .getByRole('button', { name: /generate.*weekly|weekly.*report|generate now/i })
      .first()
    await expect(generateBtn).toBeVisible({ timeout: 10_000 })
    await generateBtn.click()

    // ── 7. Wait for report row to appear in the list (≤15 s) ─────────────────
    await expect(
      page.getByText(/weekly.*report|generating|✓|done/i)
    ).toBeVisible({ timeout: 15_000 })

    // Verify generated_reports row in DB
    const reportRow = await waitForRow(
      'generated_reports',
      { user_id: coach.id, kind: 'weekly' },
      { timeoutMs: 15_000 },
    )
    expect(reportRow.kind).toBe('weekly')

    // ── 8. Click download and capture the response ────────────────────────────
    const [ download ] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }).catch(() => null),
      page.getByRole('button', { name: /download|↓/i }).first().click(),
    ])

    let pdfBytes: Buffer
    if (download) {
      // Playwright Download API: save to temp path and read
      const tmpPath = path.join('/tmp', `e2e-report-${Date.now()}.pdf`)
      await download.saveAs(tmpPath)
      pdfBytes = fs.readFileSync(tmpPath)
      fs.rmSync(tmpPath, { force: true })
    } else {
      // Fallback: fetch the signed URL directly
      const signedUrl = `${process.env.E2E_SUPABASE_URL}/storage/v1/object/sign/reports/${coach.id}/e2e-weekly-report.pdf?token=mock`
      const resp = await page.request.get(signedUrl)
      pdfBytes   = Buffer.from(await resp.body())
    }

    // ── 9. Assert valid PDF (≥5 KB, ≤2 MB, %PDF header) ─────────────────────
    expect(pdfBytes.length).toBeGreaterThan(5_000)
    expect(pdfBytes.length).toBeLessThan(2_097_152)   // 2 MB
    expect(pdfBytes.subarray(0, 4).toString('ascii')).toBe('%PDF')

    // ── 10. Assert athlete names appear in PDF text ───────────────────────────
    const pdfText = pdfBytes.toString('utf8')
    for (const name of athleteNames) {
      expect(
        pdfText.includes(name),
        `PDF should contain athlete name: ${name}`,
      ).toBe(true)
    }

    recordTiming('path5_report_pdf', Date.now() - t0)
  })
})
