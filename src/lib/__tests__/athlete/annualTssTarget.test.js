// ─── annualTssTarget.test.js — pure-fn unit tests ──────────────────────────
// Covers:
//   - all 5 bands (ELITE_ENDURANCE / COMPETITIVE / CONSISTENT / DEVELOPING / CASUAL)
//   - null gates: early in year (< 14 days), zero TSS, empty / non-array log
//   - projection math (linear extrapolation, weekly avg pace, day-of-year)
//   - leap-year handling (today = 2024-03-15 → 366 days, day 75)
import { describe, it, expect } from 'vitest'
import { analyzeAnnualTssTarget } from '../../athlete/annualTssTarget.js'

const TODAY = '2026-05-19'
// 2026 is non-leap. Jan(31)+Feb(28)+Mar(31)+Apr(30)+19 = 139 days into year.
const DAYS_INTO_2026 = 139
const DAYS_IN_2026   = 365
// Projection multiplier ~ 365 / 139 ≈ 2.6259

/**
 * Build a small set of sessions inside the current YTD window with a known
 * total TSS. We only need date + tss for this card.
 */
function buildYtdSessions(totalTss, count = 10, firstDate = '2026-01-05') {
  const each = totalTss / count
  const out = []
  for (let i = 0; i < count; i++) {
    const day = (i * 10) + 5 // spread sessions across early days
    const month = String(Math.min(5, 1 + Math.floor(i / 4))).padStart(2, '0')
    const date  = `2026-${month}-${String(((day - 1) % 28) + 1).padStart(2, '0')}`
    out.push({ date, tss: each })
  }
  // Anchor first to a known date to keep things easy
  out[0] = { date: firstDate, tss: each }
  return out
}

describe('analyzeAnnualTssTarget — null gates', () => {
  it('returns null for non-array / undefined log', () => {
    expect(analyzeAnnualTssTarget({ log: undefined, today: TODAY })).toBeNull()
    expect(analyzeAnnualTssTarget({ log: null, today: TODAY })).toBeNull()
    expect(analyzeAnnualTssTarget({})).toBeNull() // log undefined, today defaulted
  })

  it('returns null when daysIntoYear < 14 (too early to project)', () => {
    const earlyToday = '2026-01-10' // day 10
    const log = [{ date: '2026-01-05', tss: 50 }]
    expect(analyzeAnnualTssTarget({ log, today: earlyToday })).toBeNull()
  })

  it('returns null when ytdTss = 0 even with logged sessions', () => {
    // Sessions have no tss field
    const log = [
      { date: '2026-01-05' },
      { date: '2026-02-10', tss: 0 },
    ]
    expect(analyzeAnnualTssTarget({ log, today: TODAY })).toBeNull()
  })

  it('returns null when log is empty', () => {
    expect(analyzeAnnualTssTarget({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when all TSS is from outside the current year', () => {
    const log = [
      { date: '2025-06-01', tss: 100 },
      { date: '2024-08-15', tss: 200 },
    ]
    expect(analyzeAnnualTssTarget({ log, today: TODAY })).toBeNull()
  })
})

describe('analyzeAnnualTssTarget — band classification (5 bands)', () => {
  it('classifies ELITE_ENDURANCE when projection >= 5000', () => {
    // YTD = 2000 → projection ~ 2000 * 365/139 ≈ 5252 → ELITE
    const log = buildYtdSessions(2000)
    const r = analyzeAnnualTssTarget({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('ELITE_ENDURANCE')
    expect(r.projectedAnnualTss).toBeGreaterThanOrEqual(5000)
    expect(r.citation).toBe('Hellard 2019; Tønnessen 2014')
  })

  it('classifies COMPETITIVE when 3000 <= projection < 5000', () => {
    // YTD = 1400 → projection ~ 3677 → COMPETITIVE
    const log = buildYtdSessions(1400)
    const r = analyzeAnnualTssTarget({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('COMPETITIVE')
    expect(r.projectedAnnualTss).toBeGreaterThanOrEqual(3000)
    expect(r.projectedAnnualTss).toBeLessThan(5000)
  })

  it('classifies CONSISTENT when 1500 <= projection < 3000', () => {
    // YTD = 800 → projection ~ 2101 → CONSISTENT
    const log = buildYtdSessions(800)
    const r = analyzeAnnualTssTarget({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CONSISTENT')
    expect(r.projectedAnnualTss).toBeGreaterThanOrEqual(1500)
    expect(r.projectedAnnualTss).toBeLessThan(3000)
  })

  it('classifies DEVELOPING when 500 <= projection < 1500', () => {
    // YTD = 300 → projection ~ 788 → DEVELOPING
    const log = buildYtdSessions(300)
    const r = analyzeAnnualTssTarget({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('DEVELOPING')
    expect(r.projectedAnnualTss).toBeGreaterThanOrEqual(500)
    expect(r.projectedAnnualTss).toBeLessThan(1500)
  })

  it('classifies CASUAL when projection < 500', () => {
    // YTD = 100 → projection ~ 263 → CASUAL
    const log = buildYtdSessions(100)
    const r = analyzeAnnualTssTarget({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CASUAL')
    expect(r.projectedAnnualTss).toBeLessThan(500)
  })
})

describe('analyzeAnnualTssTarget — projection math', () => {
  it('computes ytdTss / projectedAnnualTss / weeklyAvgPace correctly', () => {
    // Hand-crafted: 4 sessions × 250 TSS = 1000 YTD
    const log = [
      { date: '2026-01-10', tss: 250 },
      { date: '2026-02-15', tss: 250 },
      { date: '2026-03-20', tss: 250 },
      { date: '2026-05-01', tss: 250 },
    ]
    const r = analyzeAnnualTssTarget({ log, today: TODAY })
    expect(r).not.toBeNull()

    expect(r.ytdTss).toBe(1000)
    expect(r.daysIntoYear).toBe(DAYS_INTO_2026)
    expect(r.totalDaysInYear).toBe(DAYS_IN_2026)

    // projectedAnnualTss = 1000 * (365 / 139)
    const expectedProjection = 1000 * (DAYS_IN_2026 / DAYS_INTO_2026)
    expect(r.projectedAnnualTss).toBeCloseTo(expectedProjection, 5)

    // weeklyAvgPace = 1000 / (139 / 7)
    const expectedWeekly = 1000 / (DAYS_INTO_2026 / 7)
    expect(r.weeklyAvgPace).toBeCloseTo(expectedWeekly, 5)
  })

  it('only includes TSS from current calendar year (ignores last year)', () => {
    const log = [
      { date: '2025-12-31', tss: 9999 }, // ignored
      { date: '2025-06-01', tss: 500 },  // ignored
      { date: '2026-01-05', tss: 100 },  // counts
      { date: '2026-04-10', tss: 200 },  // counts
    ]
    const r = analyzeAnnualTssTarget({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.ytdTss).toBe(300)
  })

  it('ignores sessions dated after today (no future leakage)', () => {
    const log = [
      { date: '2026-01-05', tss: 100 },
      { date: '2026-06-10', tss: 999 }, // after today (2026-05-19) — ignored
    ]
    const r = analyzeAnnualTssTarget({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.ytdTss).toBe(100)
  })

  it('skips entries with non-numeric tss / missing date safely', () => {
    const log = [
      { date: '2026-01-05', tss: 100 },
      { date: '2026-02-10', tss: 'abc' }, // skipped
      { tss: 50 },                         // skipped (no date)
      { date: '2026-03-15', tss: 200 },
    ]
    const r = analyzeAnnualTssTarget({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.ytdTss).toBe(300)
  })
})

describe('analyzeAnnualTssTarget — leap year handling', () => {
  it('uses 366 total days for leap year 2024 (today=2024-03-15)', () => {
    // 2024 is leap year. Jan(31)+Feb(29)+15 = 75 days into 366-day year.
    const log = [
      { date: '2024-01-10', tss: 500 },
      { date: '2024-02-20', tss: 500 },
    ]
    const r = analyzeAnnualTssTarget({ log, today: '2024-03-15' })
    expect(r).not.toBeNull()
    expect(r.totalDaysInYear).toBe(366)
    expect(r.daysIntoYear).toBe(75)
    expect(r.ytdTss).toBe(1000)
    // projection = 1000 * (366 / 75) = 4880
    expect(r.projectedAnnualTss).toBeCloseTo(1000 * (366 / 75), 5)
  })

  it('uses 365 days for non-leap year 2026', () => {
    const log = buildYtdSessions(500)
    const r = analyzeAnnualTssTarget({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalDaysInYear).toBe(365)
  })

  it('handles century non-leap year 2100 (divisible by 100, not 400)', () => {
    const log = [
      { date: '2100-01-05', tss: 200 },
      { date: '2100-02-10', tss: 200 },
    ]
    const r = analyzeAnnualTssTarget({ log, today: '2100-03-01' })
    expect(r).not.toBeNull()
    expect(r.totalDaysInYear).toBe(365)
  })

  it('handles year-400 leap year 2000 (divisible by 400)', () => {
    const log = [
      { date: '2000-01-05', tss: 200 },
      { date: '2000-02-10', tss: 200 },
    ]
    const r = analyzeAnnualTssTarget({ log, today: '2000-03-01' })
    expect(r).not.toBeNull()
    expect(r.totalDaysInYear).toBe(366)
  })
})
