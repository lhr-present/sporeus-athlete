// src/lib/__tests__/athlete/seasonalLoadDistribution.test.js
//
// Pure-fn tests for analyzeSeasonalLoadDistribution — Issurin 2010 + Bompa 2018.
import { describe, it, expect } from 'vitest'
import {
  analyzeSeasonalLoadDistribution,
  SEASONAL_LOAD_CITATION,
} from '../../athlete/seasonalLoadDistribution.js'

const TODAY = '2026-05-15'

// ─── Helpers ────────────────────────────────────────────────────────────────

// Compute the 12 month keys ending at TODAY's month (oldest first).
function build12MonthKeys(todayIso = TODAY) {
  const d = new Date(todayIso + 'T00:00:00Z')
  const endY = d.getUTCFullYear()
  const endM = d.getUTCMonth()
  const out = []
  for (let i = 11; i >= 0; i--) {
    const total = endY * 12 + endM - i
    const y = Math.floor(total / 12)
    const m = total - y * 12
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`)
  }
  return out
}

// Build a log where each month-key gets `n` sessions of TSS == perSession.
// monthlyTotals: array of length 12 with desired monthly TSS totals
//   (oldest first matching build12MonthKeys order). Zero means "no session".
function buildLogFromMonthly(monthlyTotals, todayIso = TODAY) {
  const keys = build12MonthKeys(todayIso)
  const log = []
  for (let i = 0; i < keys.length; i++) {
    const total = monthlyTotals[i]
    if (!total) continue
    // Use the 15th of each month for stability.
    log.push({ date: `${keys[i]}-15`, tss: total })
  }
  return log
}

// ─── Null / insufficient signal ─────────────────────────────────────────────

describe('analyzeSeasonalLoadDistribution — null cases', () => {
  it('returns null when log is not an array', () => {
    expect(analyzeSeasonalLoadDistribution({ log: null, today: TODAY })).toBeNull()
    expect(analyzeSeasonalLoadDistribution({ log: undefined, today: TODAY })).toBeNull()
  })

  it('returns null for an empty log', () => {
    expect(analyzeSeasonalLoadDistribution({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 6 months have any sessions', () => {
    // 5 populated months
    const log = buildLogFromMonthly([0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100])
    expect(analyzeSeasonalLoadDistribution({ log, today: TODAY })).toBeNull()
  })

  it('returns a result once exactly 6 months are populated', () => {
    const log = buildLogFromMonthly([0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100])
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.months).toHaveLength(12)
  })
})

// ─── Shape + metadata ───────────────────────────────────────────────────────

describe('analyzeSeasonalLoadDistribution — shape', () => {
  it('returns 12 months in chronological order with YYYY-MM keys', () => {
    const totals = [100,110,120,130,140,150,160,170,180,190,200,210]
    const log = buildLogFromMonthly(totals)
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    expect(r.months).toHaveLength(12)
    // Keys must be sorted ascending and end with TODAY's month
    for (let i = 1; i < r.months.length; i++) {
      expect(r.months[i].month > r.months[i - 1].month).toBe(true)
    }
    expect(r.months[11].month).toBe('2026-05')
    expect(r.months[0].month).toBe('2025-06')
  })

  it('returns english 3-letter month labels (JAN, FEB, ...)', () => {
    const totals = new Array(12).fill(100)
    const log = buildLogFromMonthly(totals)
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    // 2026-05 should be MAY
    const may = r.months.find(m => m.month === '2026-05')
    expect(may.monthLabel).toBe('MAY')
    const jan = r.months.find(m => m.month === '2026-01')
    expect(jan.monthLabel).toBe('JAN')
  })

  it('exposes Issurin 2010 + Bompa 2018 citation', () => {
    const log = buildLogFromMonthly(new Array(12).fill(100))
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    expect(r.citation).toBe(SEASONAL_LOAD_CITATION)
    expect(r.citation).toMatch(/Issurin 2010/)
    expect(r.citation).toMatch(/Bompa 2018/)
  })

  it('peakMonth and troughMonth match the highest / lowest TSS month', () => {
    const totals = [50, 60, 70, 80, 90, 100, 200, 90, 80, 70, 60, 50]
    const log = buildLogFromMonthly(totals)
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    expect(r.peakMonth.tss).toBe(200)
    expect(r.troughMonth.tss).toBe(50)
  })

  it('avgTss equals the mean across the 12 months', () => {
    const totals = new Array(12).fill(120)
    const log = buildLogFromMonthly(totals)
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    expect(r.avgTss).toBe(120)
    expect(r.cv).toBe(0)
  })

  it('handles months with zero sessions (counted as 0 TSS toward stats)', () => {
    // 6 populated, 6 zero — passes the gate.
    const totals = [0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100]
    const log = buildLogFromMonthly(totals)
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.troughMonth.tss).toBe(0)
    expect(r.peakMonth.tss).toBe(100)
  })

  it('ignores sessions outside the 12-month window', () => {
    const log = [
      { date: '2024-01-15', tss: 500 }, // outside window
      { date: '2026-05-10', tss: 80 },
      { date: '2025-06-10', tss: 50 },
      { date: '2025-07-10', tss: 50 },
      { date: '2025-08-10', tss: 50 },
      { date: '2025-09-10', tss: 50 },
      { date: '2025-10-10', tss: 50 },
      { date: '2025-11-10', tss: 50 },
    ]
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Old 2024 entry must not appear in any month total
    const has2024 = r.months.some(m => m.month.startsWith('2024'))
    expect(has2024).toBe(false)
  })
})

// ─── Pattern classification: FLAT ───────────────────────────────────────────

describe('analyzeSeasonalLoadDistribution — pattern FLAT', () => {
  it('classifies near-equal monthly TSS as FLAT (CV < 0.25)', () => {
    // All identical → CV = 0 → FLAT
    const totals = new Array(12).fill(120)
    const log = buildLogFromMonthly(totals)
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    expect(r.pattern).toBe('FLAT')
    expect(r.cv).toBeLessThan(0.25)
  })

  it('classifies slightly varying load as FLAT when CV stays under 0.25', () => {
    const totals = [100, 110, 105, 95, 100, 102, 108, 95, 100, 105, 110, 100]
    const log = buildLogFromMonthly(totals)
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    expect(r.cv).toBeLessThan(0.25)
    expect(r.pattern).toBe('FLAT')
  })
})

// ─── Pattern classification: BLOCK ──────────────────────────────────────────

describe('analyzeSeasonalLoadDistribution — pattern BLOCK', () => {
  it('classifies a single huge spike + low background as BLOCK', () => {
    // 11 months of low load + 1 huge peak → CV > 0.5 + peak / avg > 1.8
    const totals = [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 800]
    const log = buildLogFromMonthly(totals)
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    expect(r.cv).toBeGreaterThan(0.5)
    expect(r.peakMonth.tss / r.avgTss).toBeGreaterThan(1.8)
    expect(r.pattern).toBe('BLOCK')
  })
})

// ─── Pattern classification: VOLATILE ───────────────────────────────────────

describe('analyzeSeasonalLoadDistribution — pattern VOLATILE', () => {
  it('classifies multiple comparable peaks (CV > 0.5, no single peak > 1.8x avg) as VOLATILE', () => {
    // Two roughly equal peaks interleaved with low months → CV > 0.5, but
    // the single peak / mean ratio stays below the BLOCK threshold (1.8).
    // Pattern of high+low alternation.
    const totals = [400, 50, 400, 50, 400, 50, 400, 50, 400, 50, 400, 50]
    const log = buildLogFromMonthly(totals)
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    expect(r.cv).toBeGreaterThan(0.5)
    // Mean = 225, peak = 400 → ratio ≈ 1.78 < 1.8
    expect(r.peakMonth.tss / r.avgTss).toBeLessThanOrEqual(1.8)
    expect(r.pattern).toBe('VOLATILE')
  })
})

// ─── Pattern classification: TRADITIONAL ────────────────────────────────────

describe('analyzeSeasonalLoadDistribution — pattern TRADITIONAL', () => {
  it('classifies a gentle ramp + taper as TRADITIONAL', () => {
    // Gradual monthly change (≤30 % of prior month) for ≥8 of 12 months,
    // CV between 0.25 and 0.5, no dominant single peak.
    // 60 → 80 → 100 → 130 → 165 → 210 → 165 → 130 → 100 → 80 → 60 → 50
    // Each step ≤30 % of prior; range wide enough to push CV above 0.25.
    const totals = [60, 80, 100, 130, 165, 210, 165, 130, 100, 80, 60, 50]
    const log = buildLogFromMonthly(totals)
    const r = analyzeSeasonalLoadDistribution({ log, today: TODAY })
    expect(r.cv).toBeGreaterThanOrEqual(0.25)
    expect(r.cv).toBeLessThanOrEqual(0.5)
    expect(r.pattern).toBe('TRADITIONAL')
  })
})

// ─── today fallback ─────────────────────────────────────────────────────────

describe('analyzeSeasonalLoadDistribution — today default', () => {
  it('falls back to today UTC when no today arg is given', () => {
    // Build a log keyed to the actual current UTC month so the window
    // covers it. We only check shape (12 entries, non-null).
    const d = new Date()
    const endY = d.getUTCFullYear()
    const endM = d.getUTCMonth()
    const log = []
    for (let i = 11; i >= 0; i--) {
      const total = endY * 12 + endM - i
      const y = Math.floor(total / 12)
      const m = total - y * 12
      log.push({ date: `${y}-${String(m + 1).padStart(2, '0')}-15`, tss: 100 })
    }
    const r = analyzeSeasonalLoadDistribution({ log })
    expect(r).not.toBeNull()
    expect(r.months).toHaveLength(12)
  })
})
