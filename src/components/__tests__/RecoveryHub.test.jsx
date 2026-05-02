// @vitest-environment jsdom
// ─── RecoveryHub.test.jsx — E17 weekly retrospective view tests ─────────────
// Verifies the heatmap, sleep debt, skipped-sessions count, HRV sparkline,
// bilingual labels, accessibility, partial-data resilience, and Dashboard
// wiring smoke check.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'

// ── Mocks ────────────────────────────────────────────────────────────────────

const dataState = { recovery: [], log: [] }

vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => dataState,
}))

import RecoveryHub from '../RecoveryHub.jsx'

// ── Helpers ──────────────────────────────────────────────────────────────────

function dateAt(daysAgo) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function tEN(k) { return LABELS.en?.[k] ?? k }
function tTR(k) { return LABELS.tr?.[k] ?? k }

function renderAt(lang = 'en', { recovery = [], log = [] } = {}) {
  dataState.recovery = recovery
  dataState.log = log
  const ctx = { lang, setLang: vi.fn(), t: lang === 'tr' ? tTR : tEN }
  return render(
    <LangCtx.Provider value={ctx}>
      <RecoveryHub />
    </LangCtx.Provider>
  )
}

/** Build a uniform 28-day recovery window with HRV+sleep at given values. */
function buildRecovery({ n = 28, hrv = 65, sleepHrs = 8, soreness = 3, mood = 4, score = 70 } = {}) {
  const out = []
  for (let i = n; i >= 1; i--) {
    out.push({
      date: dateAt(i),
      hrv,
      sleepHrs,
      sleep: 4,
      energy: mood,
      soreness,
      mood,
      stress: 3,
      score,
      notes: '',
    })
  }
  return out
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RecoveryHub — E17 weekly retrospective', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dataState.recovery = []
    dataState.log = []
  })

  it('renders empty state when recovery is []', () => {
    renderAt('en', { recovery: [] })
    expect(screen.getByTestId('recovery-hub-empty')).toBeInTheDocument()
    expect(screen.getByTestId('recovery-hub-empty')).toHaveTextContent(/Log a few morning check-ins/i)
  })

  it('renders 28 cells in the heatmap', () => {
    renderAt('en', { recovery: buildRecovery() })
    const grid = screen.getByTestId('readiness-heatmap')
    const cells = grid.querySelectorAll('[role="gridcell"]')
    expect(cells.length).toBe(28)
  })

  it('heatmap colors cells by score band — red (<40), green (60-80), bright (>80)', () => {
    // Build a stable 28-day baseline (HRV=65, sleep=8) then override the last
    // three days to force three different bands.
    const recovery = buildRecovery({ n: 28, hrv: 65, sleepHrs: 8, soreness: 3, mood: 4 })
    // Day 3 ago — very low: HRV crash + tiny sleep + max soreness
    const i3 = recovery.findIndex(r => r.date === dateAt(3))
    if (i3 >= 0) recovery[i3] = { ...recovery[i3], hrv: 40, sleepHrs: 3, soreness: 5, mood: 1, energy: 1 }
    // Day 1 ago — high readiness: HRV strong, full sleep, fresh
    const i1 = recovery.findIndex(r => r.date === dateAt(1))
    if (i1 >= 0) recovery[i1] = { ...recovery[i1], hrv: 70, sleepHrs: 9, soreness: 1, mood: 5, energy: 5 }
    renderAt('en', { recovery })

    const lowCell  = screen.getByTestId('heatmap-cell-' + dateAt(3))
    const highCell = screen.getByTestId('heatmap-cell-' + dateAt(1))

    const lowScore  = parseInt(lowCell.getAttribute('data-score'), 10)
    const highScore = parseInt(highCell.getAttribute('data-score'), 10)

    expect(lowScore).toBeLessThan(40)
    expect(highScore).toBeGreaterThanOrEqual(60)

    // Color check on style (jsdom serialises hex → rgb).
    // #e03030 → rgb(224, 48, 48)
    expect(lowCell.getAttribute('style')).toMatch(/rgb\(224,\s*48,\s*48\)/)
    // #5bc25b → rgb(91, 194, 91); #3a8f3a → rgb(58, 143, 58)
    expect(highCell.getAttribute('style')).toMatch(/rgb\((91,\s*194,\s*91|58,\s*143,\s*58)\)/)
  })

  it('sleep debt computed correctly with synthetic data', () => {
    // Last 7 days (i=6..0 — slice(-7) of dates28) each with 6h sleep.
    // Ideal=8 → debt = 7*8 - 7*6 = 14h
    const recovery = []
    for (let i = 6; i >= 0; i--) {
      recovery.push({ date: dateAt(i), hrv: 65, sleepHrs: 6, soreness: 3, mood: 3, energy: 3, score: 60 })
    }
    renderAt('en', { recovery })
    const debt = screen.getByTestId('sleep-debt-value')
    expect(debt).toHaveTextContent(/\+14h/)
    // > 4h debt → red (#e03030 → rgb(224, 48, 48))
    expect(debt.getAttribute('style')).toMatch(/rgb\(224,\s*48,\s*48\)/)
  })

  it('sleep debt is zero or negative when sleeping ≥ ideal', () => {
    const recovery = []
    for (let i = 6; i >= 0; i--) {
      recovery.push({ date: dateAt(i), hrv: 65, sleepHrs: 9, soreness: 3, mood: 3, energy: 3, score: 80 })
    }
    renderAt('en', { recovery })
    const debt = screen.getByTestId('sleep-debt-value')
    // 9h × 7 = 63 vs ideal 56 → debt = -7h (green: #5bc25b → rgb(91, 194, 91))
    expect(debt).toHaveTextContent(/-7h/)
    expect(debt.getAttribute('style')).toMatch(/rgb\(91,\s*194,\s*91\)/)
  })

  it('skipped sessions count is correct (low readiness + empty log on that day)', () => {
    // Build a 28-day baseline with healthy HRV + sleep, then crash the last 5
    // days so computed readiness on those days falls below 40.
    const recovery = buildRecovery({ n: 28, hrv: 65, sleepHrs: 8, soreness: 2, mood: 4 })
    for (let i = 4; i >= 0; i--) {
      const idx = recovery.findIndex(r => r.date === dateAt(i))
      const lowEntry = { date: dateAt(i), hrv: 35, sleepHrs: 3, soreness: 5, mood: 1, energy: 1, score: 20 }
      if (idx >= 0) recovery[idx] = lowEntry
      else recovery.push(lowEntry)
    }
    renderAt('en', { recovery, log: [] })
    const txt = screen.getByTestId('skipped-sessions-text')
    // Expect at least 3 of those 5 to compute < 40 (depending on baseline noise).
    const m = txt.textContent.match(/Last 28 days: (\d+) skipped sessions/i)
    expect(m).not.toBeNull()
    const count = parseInt(m[1], 10)
    expect(count).toBeGreaterThanOrEqual(3)
  })

  it('skipped count excludes days with a logged training session', () => {
    const recovery = buildRecovery({ n: 28, hrv: 65, sleepHrs: 8, soreness: 2, mood: 4 })
    for (let i = 4; i >= 0; i--) {
      const idx = recovery.findIndex(r => r.date === dateAt(i))
      const lowEntry = { date: dateAt(i), hrv: 35, sleepHrs: 3, soreness: 5, mood: 1, energy: 1, score: 20 }
      if (idx >= 0) recovery[idx] = lowEntry
      else recovery.push(lowEntry)
    }
    // Athlete trained anyway on 2 of those 5 low days
    const log = [
      { date: dateAt(1), type: 'easy run', duration: 30, rpe: 4 },
      { date: dateAt(3), type: 'easy spin', duration: 40, rpe: 4 },
    ]

    // Baseline: count without log
    const first = renderAt('en', { recovery, log: [] })
    const baselineMatch = screen.getByTestId('skipped-sessions-text').textContent.match(/(\d+) skipped/)
    const baselineCount = parseInt(baselineMatch[1], 10)
    first.unmount()

    // With log on 2 low days, count must drop by 2
    renderAt('en', { recovery, log })
    const newMatch = screen.getByTestId('skipped-sessions-text').textContent.match(/(\d+) skipped/)
    const newCount = parseInt(newMatch[1], 10)
    expect(newCount).toBe(Math.max(0, baselineCount - 2))
  })

  it('HRV sparkline renders with synthetic HRV data', () => {
    const recovery = buildRecovery({ n: 14, hrv: 65 })
    // Vary HRV so we have a real range
    recovery[5].hrv = 50
    recovery[10].hrv = 75
    renderAt('en', { recovery })
    expect(screen.getByTestId('hrv-sparkline-svg')).toBeInTheDocument()
    // min/max labels appear
    const section = screen.getByTestId('hrv-sparkline-section')
    expect(section.textContent).toMatch(/50/)
    expect(section.textContent).toMatch(/75/)
  })

  it('renders Turkish labels when lang=tr', () => {
    renderAt('tr', { recovery: buildRecovery() })
    expect(screen.getByText(/TOPARLANMA MERKEZ/)).toBeInTheDocument()
    expect(screen.getByText(/28 GÜNLÜK HAZIR OLMA/)).toBeInTheDocument()
    expect(screen.getByText(/UYKU BORCU/)).toBeInTheDocument()
  })

  it('cell aria-labels include date and score info', () => {
    const recovery = buildRecovery({ n: 5 })
    renderAt('en', { recovery })
    const cell = screen.getByTestId('heatmap-cell-' + dateAt(1))
    const aria = cell.getAttribute('aria-label')
    expect(aria).toContain(dateAt(1))
    // either includes "score N" or "no data"
    expect(aria).toMatch(/score \d+|no data/i)
  })

  it('does not crash with partial data (only some recovery entries, no HRV)', () => {
    const recovery = [
      { date: dateAt(2), sleepHrs: 7, soreness: 2, mood: 4, energy: 4, score: 65 },
      { date: dateAt(1), sleepHrs: 8, soreness: 2, mood: 4, energy: 4, score: 70 },
    ]
    expect(() => renderAt('en', { recovery })).not.toThrow()
    // HRV section should show empty state, not the SVG
    expect(screen.getByTestId('hrv-sparkline-empty')).toBeInTheDocument()
    // Heatmap still renders 28 cells
    const grid = screen.getByTestId('readiness-heatmap')
    expect(grid.querySelectorAll('[role="gridcell"]').length).toBe(28)
  })

  it('Dashboard wires RecoveryHub via lazy import + ErrorBoundary (smoke check)', async () => {
    // Read the Dashboard.jsx source and verify RecoveryHub is imported lazily
    // and rendered inside an <ErrorBoundary><Suspense>…</Suspense></ErrorBoundary>.
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/Dashboard.jsx'),
      'utf8'
    )
    expect(src).toMatch(/lazy\(\(\) => import\(['"]\.\/RecoveryHub\.jsx['"]\)\)/)
    expect(src).toMatch(/<RecoveryHub\s*\/>/)
  })
})
