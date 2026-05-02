// @vitest-environment jsdom
// ─── CoachingInsightsDigest.test.jsx — render tests for the digest card ──────
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CoachingInsightsDigest from '../dashboard/CoachingInsightsDigest.jsx'

// ─── Render helper with overridable lang ─────────────────────────────────────
function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <CoachingInsightsDigest {...props} />
    </LangCtx.Provider>
  )
}

// ─── Date helpers (anchored to "today") ──────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function isoWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dow = d.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

// ─── Synthetic log builders ──────────────────────────────────────────────────
// Healthy mix: covers all 5 zones AND all 5 session intents AND ≤1 hard day/wk.
// Cycle through 7-day templates that include recovery, long, steady, tempo, intervals.
function buildHealthyLog() {
  const today = todayStr()
  const w4Start = isoWeekStart(today)
  const w1Start = addDays(w4Start, -21)
  const log = []
  // Per-week template (Mon..Sun): recovery, steady, recovery, steady, long, tempo, intervals
  // Hard days (RPE>=6): Sat (tempo) + Sun (intervals) → 2 hard/wk → flagged.
  // We need ≤1 hard day/wk to keep density low. Move tempo to RPE 5 steady.
  // Keep one intervals/wk → 1 hard day/wk → unflagged.
  const templates = [
    // Mon: recovery (RPE 3, 45min, Z1-heavy)
    { rpe: 3, duration: 45, zones: [60, 30, 5, 3, 2] },
    // Tue: steady (RPE 5, 60min, Z2-heavy)
    { rpe: 5, duration: 60, zones: [10, 70, 10, 5, 5] },
    // Wed: recovery (RPE 2, 40min, Z1-heavy)
    { rpe: 2, duration: 40, zones: [70, 25, 3, 1, 1] },
    // Thu: steady (RPE 5, 60min, Z2-heavy)
    { rpe: 5, duration: 60, zones: [10, 70, 10, 5, 5] },
    // Fri: long (RPE 5, 120min, Z2-heavy)
    { rpe: 5, duration: 120, zones: [10, 75, 10, 3, 2] },
    // Sat: tempo (RPE 6, 50min, Z3-dominant) — counts as hard
    { rpe: 6, duration: 50, zones: [5, 15, 50, 20, 10] },
    // Sun: easy (RPE 4) — keep total hard days/wk = 1 (just Sat)
    { rpe: 4, duration: 60, zones: [10, 75, 10, 3, 2] },
  ]
  for (let w = 0; w < 4; w++) {
    const weekStart = addDays(w1Start, w * 7)
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d)
      const t = templates[d]
      log.push({
        date,
        type: 'run',
        rpe: t.rpe,
        duration: t.duration,
        zones: t.zones.slice(),
      })
    }
  }
  // Add an intervals session each week to ensure all 5 intents present.
  // Replace each week's Sun easy entry with an intervals session.
  // intervals: RPE 8, duration 45min, Z4+Z5 share > 30%.
  for (let w = 0; w < 4; w++) {
    const weekStart = addDays(w1Start, w * 7)
    const sun = addDays(weekStart, 6)
    const idx = log.findIndex(e => e.date === sun)
    if (idx >= 0) {
      log[idx] = {
        date: sun,
        type: 'run',
        rpe: 8,
        duration: 45,
        zones: [0, 10, 20, 40, 30],
      }
    }
  }
  // Now there are 2 hard days/wk (Sat tempo RPE 6 + Sun intervals RPE 8) → flagged.
  // Drop the tempo to RPE 5 with Z2-heavy to keep it under hard-threshold but still
  // maintain "tempo" intent? No — tempo classification needs RPE 6-7. We need
  // tempo present somewhere across the 28 days. Keep ONE tempo session (week 4
  // only) and downgrade the rest to steady. That gives 28d intents = all 5,
  // but only 1 hard day/wk in weeks 1-3 and 2 hard/wk in week 4 → not consecutive
  // flagged → still low risk.
  for (let w = 0; w < 3; w++) {
    const weekStart = addDays(w1Start, w * 7)
    const sat = addDays(weekStart, 5)
    const idx = log.findIndex(e => e.date === sat)
    if (idx >= 0) {
      log[idx] = {
        date: sat,
        type: 'run',
        rpe: 5,
        duration: 60,
        zones: [10, 70, 10, 5, 5],
      }
    }
  }
  return log
}

function buildHighDensityLog() {
  // 4 hard days/wk for 4 weeks → consecutiveFlagged ≥ 2 → high risk.
  const today = todayStr()
  const w4Start = isoWeekStart(today)
  const w1Start = addDays(w4Start, -21)
  const log = []
  for (let w = 0; w < 4; w++) {
    const weekStart = addDays(w1Start, w * 7)
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d)
      // 5 hard days (Mon..Fri), 2 easy days (Sat..Sun)
      const hard = d < 5
      log.push({
        date,
        type: 'run',
        rpe: hard ? 8 : 4,
        duration: 60,
        zones: hard ? [0, 10, 10, 60, 20] : [10, 70, 10, 5, 5],
      })
    }
  }
  return log
}

function buildStaleZ5Log() {
  // 28 days of Z2-only → Z5 stale, density low (RPE 4), variety low.
  const today = todayStr()
  const log = []
  for (let i = 27; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      zones: [10, 80, 5, 3, 2],
    })
  }
  return log
}

function buildLowVarietyOnlyLog() {
  // Mostly steady-only sessions, every zone present (>=5%) but density low.
  // Z2-dominant with a small slice of every other zone so no zone is stale,
  // RPE 5 → not hard → density low, only "steady" intent → variety low.
  const today = todayStr()
  const log = []
  for (let i = 27; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      zones: [10, 60, 10, 10, 10],
    })
  }
  return log
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('CoachingInsightsDigest — empty state', () => {
  it('renders empty state when log is empty (no detector reliable)', () => {
    renderCard({ log: [] })
    expect(
      screen.getByText(/Log 14\+ days of training to unlock coaching insights/i)
    ).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — all-green state', () => {
  it('shows ✓ + healthy message when all detectors are green', () => {
    const log = buildHealthyLog()
    renderCard({ log })
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByText(/All training metrics healthy/i)).toBeInTheDocument()
  })

  it('all-green state has role=status', () => {
    const log = buildHealthyLog()
    renderCard({ log })
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — high density risk', () => {
  it('surfaces a density insight at the top with red bullet for high risk', () => {
    const log = buildHighDensityLog()
    renderCard({ log })
    // Density insight present
    expect(screen.getByText(/consecutive weeks of 4\+ hard days/i)).toBeInTheDocument()
    // Red bullet visible
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('🔴')
    // DENSITY badge
    expect(screen.getByText('DENSITY')).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — stale zones', () => {
  it('surfaces a zones insight when Z5 (and others) are stale', () => {
    const log = buildStaleZ5Log()
    renderCard({ log })
    // Stale message visible — Z1, Z3, Z4, Z5 are all stale; surface the first
    expect(screen.getByText(/has been neglected for 28 days/i)).toBeInTheDocument()
    expect(screen.getByText('ZONES')).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — low variety', () => {
  it('surfaces a variety insight when only steady sessions are logged', () => {
    const log = buildLowVarietyOnlyLog()
    renderCard({ log })
    expect(screen.getByText(/session types in last 28 days/i)).toBeInTheDocument()
    expect(screen.getByText('VARIETY')).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — capping', () => {
  it('caps insights at 3 rows maximum', () => {
    // High-density log triggers density-high + stale zones (4 zones stale) +
    // variety-low (only intervals intent classified). Total raw insights ≥ 3.
    const log = buildHighDensityLog()
    renderCard({ log })
    const rows = screen.getAllByRole('listitem')
    expect(rows.length).toBeLessThanOrEqual(3)
  })
})

describe('CoachingInsightsDigest — bilingual', () => {
  it('renders TR labels and copy when lang=tr', () => {
    const log = buildHighDensityLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText('YOĞUNLUK')).toBeInTheDocument()
    // TR card title
    expect(screen.getByText('ANTRENÖR İÇGÖRÜLERİ')).toBeInTheDocument()
  })

  it('renders TR empty-state copy when lang=tr', () => {
    renderCard({ log: [] }, 'tr')
    expect(
      screen.getByText(/Antrenman içgörüleri için 14\+ gün antrenman kaydet/i)
    ).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — a11y', () => {
  it('card root has role=region with bilingual aria-label', () => {
    const log = buildHighDensityLog()
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Coaching insights/i)
  })

  it('each insight row exposes its own aria-label with severity + source + message', () => {
    const log = buildHighDensityLog()
    renderCard({ log })
    const rows = screen.getAllByRole('listitem')
    expect(rows.length).toBeGreaterThan(0)
    rows.forEach(r => {
      const label = r.getAttribute('aria-label')
      expect(label).toBeTruthy()
      expect(label).toMatch(/priority/i)
    })
  })
})

describe('CoachingInsightsDigest — citation', () => {
  it('renders the combined citation footer', () => {
    const log = buildHighDensityLog()
    renderCard({ log })
    expect(
      screen.getByText(/Seiler 2010; Foster 2001; Gabbett 2016/)
    ).toBeInTheDocument()
  })
})
