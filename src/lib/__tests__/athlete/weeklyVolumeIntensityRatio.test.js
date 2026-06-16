// src/lib/__tests__/athlete/weeklyVolumeIntensityRatio.test.js
//
// Pure-fn tests for analyzeWeeklyVolumeIntensityRatio — Foster 2001 /
// Seiler 2010 weekly volume÷intensity ratio + intensity-creep detector.
import { describe, it, expect } from 'vitest'
import {
  analyzeWeeklyVolumeIntensityRatio,
  WEEKLY_VOL_INT_RATIO_CITATION,
} from '../../athlete/weeklyVolumeIntensityRatio.js'
import { sanitizeLogEntry } from '../../validate.js'

// 2026-05-18 is a Monday — so the ISO week containing TODAY starts on
// 2026-05-18 itself, and 8 weeks back oldest week starts 2026-03-30.
const TODAY = '2026-05-18'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Week start ISO (Monday) for week k weeks before the today-week.
// k=0 is today's week, k=7 is the oldest week in an 8-week window.
function weekStartIso(k, today = TODAY) {
  return isoMinusDays(today, k * 7)
}

// Build a log where each of the 8 trailing weeks has a single Wednesday
// session with given (durationMin, tss). `weeklyData` is oldest-first
// length-8 array of { durationMin, tss } | null. Null means no entries.
function buildWeeklyLog(weeklyData, today = TODAY) {
  const log = []
  const weeks = weeklyData.length
  for (let i = 0; i < weeks; i++) {
    const slot = weeklyData[i]
    if (!slot) continue
    // weeks - 1 - i = "k" weeks back from today's week
    const k = weeks - 1 - i
    const monday = weekStartIso(k, today)
    // Wednesday of that week = monday + 2 days
    const date = isoMinusDays(monday, -2)
    log.push({ date, durationMin: slot.durationMin, tss: slot.tss })
  }
  return log
}

// ─── Tests: null / insufficient signals ──────────────────────────────────────

describe('analyzeWeeklyVolumeIntensityRatio — null / insufficient signals', () => {
  it('returns null for an empty log', () => {
    expect(
      analyzeWeeklyVolumeIntensityRatio({ log: [], today: TODAY })
    ).toBeNull()
  })

  it('returns null for invalid today', () => {
    const log = [{ date: '2026-04-01', durationMin: 60, tss: 50 }]
    expect(
      analyzeWeeklyVolumeIntensityRatio({ log, today: 'not-a-date' })
    ).toBeNull()
  })

  it('returns null for non-array log', () => {
    expect(
      analyzeWeeklyVolumeIntensityRatio({ log: null, today: TODAY })
    ).toBeNull()
  })

  it('returns null for windowWeeks < 1', () => {
    const log = buildWeeklyLog(
      [60, 60, 60, 60, 60, 60, 60, 60].map(d => ({ durationMin: d, tss: 50 }))
    )
    expect(
      analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY, windowWeeks: 0 })
    ).toBeNull()
  })

  it('returns null when fewer than 5 weeks have a valid ratio', () => {
    // Only 4 of 8 weeks have any TSS — not enough valid ratios.
    const log = buildWeeklyLog([
      null,
      null,
      null,
      null,
      { durationMin: 60, tss: 50 },
      { durationMin: 60, tss: 50 },
      { durationMin: 60, tss: 50 },
      { durationMin: 60, tss: 50 },
    ])
    expect(
      analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY })
    ).toBeNull()
  })

  it('treats zero-TSS weeks as null ratio (still emits other valid weeks)', () => {
    // 5 weeks have valid ratios; weeks 0–2 have minutes but zero TSS
    // (e.g. strength-only logged without TSS) → ratio = null for those.
    const log = []
    // Weeks 0–2 (oldest): minutes but tss=0
    for (let i = 0; i < 3; i++) {
      const k = 7 - i
      const monday = weekStartIso(k)
      log.push({ date: isoMinusDays(monday, -2), durationMin: 60, tss: 0 })
    }
    // Weeks 3–7: minutes + tss
    for (let i = 3; i < 8; i++) {
      const k = 7 - i
      const monday = weekStartIso(k)
      log.push({ date: isoMinusDays(monday, -2), durationMin: 60, tss: 50 })
    }
    const r = analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks).toHaveLength(8)
    expect(r.weeks[0].ratio).toBeNull()
    expect(r.weeks[1].ratio).toBeNull()
    expect(r.weeks[2].ratio).toBeNull()
    expect(r.weeks[3].ratio).toBeCloseTo(60 / 50, 6)
  })
})

// ─── Tests: weekly bucket math + chronological order ─────────────────────────

describe('analyzeWeeklyVolumeIntensityRatio — week bucket math', () => {
  it('builds 8 chronological weekly buckets ending in the week containing today', () => {
    const log = buildWeeklyLog(
      Array(8).fill({ durationMin: 60, tss: 50 })
    )
    const r = analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks).toHaveLength(8)
    // Oldest first → newest last (today's week).
    expect(r.weeks[0].weekStart).toBe('2026-03-30')
    expect(r.weeks[7].weekStart).toBe('2026-05-18')
    // Every week valid ratio = 60/50 = 1.2.
    for (const w of r.weeks) {
      expect(w.totalMinutes).toBe(60)
      expect(w.totalTss).toBe(50)
      expect(w.ratio).toBeCloseTo(1.2, 6)
    }
  })

  it('aggregates multiple sessions in the same week', () => {
    const log = []
    const monday = weekStartIso(0) // today's week
    // Three sessions Mon/Wed/Fri in today's week.
    log.push({ date: monday,                       durationMin: 30, tss: 25 })
    log.push({ date: isoMinusDays(monday, -2),     durationMin: 60, tss: 50 })
    log.push({ date: isoMinusDays(monday, -4),     durationMin: 90, tss: 75 })
    // Fill the other 7 weeks with a single Wed session @ 60/50 to clear
    // the 5-valid-weeks threshold.
    for (let k = 1; k <= 7; k++) {
      const m = weekStartIso(k)
      log.push({ date: isoMinusDays(m, -2), durationMin: 60, tss: 50 })
    }
    const r = analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY })
    expect(r).not.toBeNull()
    const last = r.weeks[7]
    expect(last.totalMinutes).toBe(180)
    expect(last.totalTss).toBe(150)
    expect(last.ratio).toBeCloseTo(180 / 150, 6)
  })

  it('ignores entries outside the 8-week window', () => {
    const log = buildWeeklyLog(
      Array(8).fill({ durationMin: 60, tss: 50 })
    )
    // Add a wild-out-of-range entry one year ago — must not affect any week.
    log.push({ date: '2025-05-18', durationMin: 999, tss: 999 })
    const r = analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY })
    expect(r).not.toBeNull()
    for (const w of r.weeks) expect(w.totalMinutes).toBe(60)
  })

  it('emits citation on success', () => {
    const log = buildWeeklyLog(
      Array(8).fill({ durationMin: 60, tss: 50 })
    )
    const r = analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY })
    expect(r.citation).toBe(WEEKLY_VOL_INT_RATIO_CITATION)
    expect(r.citation).toMatch(/Foster 2001/)
    expect(r.citation).toMatch(/Seiler 2010/)
  })
})

// ─── Tests: band classification ──────────────────────────────────────────────

describe('analyzeWeeklyVolumeIntensityRatio — band classification', () => {
  it('STABLE — identical weeks → delta 0 → STABLE band', () => {
    const log = buildWeeklyLog(
      Array(8).fill({ durationMin: 60, tss: 50 })
    )
    const r = analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STABLE')
    expect(Math.abs(r.delta)).toBeLessThan(1e-9)
    expect(r.earlyAvg).toBeCloseTo(1.2, 6)
    expect(r.recentAvg).toBeCloseTo(1.2, 6)
    expect(r.avgRatio).toBeCloseTo(1.2, 6)
  })

  it('CREEPING_INTENSITY — recent ratio shrinks ≥10% vs early', () => {
    // Early weeks: ratio = 60/50 = 1.2
    // Recent weeks: ratio = 60/75 = 0.8  → delta = (0.8-1.2)/1.2 ≈ -0.333
    const early  = { durationMin: 60, tss: 50 }
    const recent = { durationMin: 60, tss: 75 }
    const log = buildWeeklyLog([
      early, early, early, early,
      recent, recent, recent, recent,
    ])
    const r = analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CREEPING_INTENSITY')
    expect(r.delta).toBeLessThanOrEqual(-0.10)
    expect(r.earlyAvg).toBeCloseTo(1.2, 6)
    expect(r.recentAvg).toBeCloseTo(0.8, 6)
  })

  it('VOLUME_GROWING — recent ratio expands ≥10% vs early', () => {
    // Early: 60/50 = 1.2; Recent: 90/50 = 1.8  → delta = +0.5
    const early  = { durationMin: 60, tss: 50 }
    const recent = { durationMin: 90, tss: 50 }
    const log = buildWeeklyLog([
      early, early, early, early,
      recent, recent, recent, recent,
    ])
    const r = analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('VOLUME_GROWING')
    expect(r.delta).toBeGreaterThanOrEqual(0.10)
  })

  it('STABLE band is sticky inside ±10% — +5% delta → STABLE', () => {
    // Recent ratio 5% bigger than early.
    const early  = { durationMin: 60, tss: 50 }     // 1.2
    const recent = { durationMin: 63, tss: 50 }     // 1.26 → +5%
    const log = buildWeeklyLog([
      early, early, early, early,
      recent, recent, recent, recent,
    ])
    const r = analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STABLE')
    expect(Math.abs(r.delta)).toBeLessThan(0.10)
  })

  it('CREEPING_INTENSITY edge — delta just past -0.10 lands in CREEPING_INTENSITY', () => {
    // Construct: early avg ratio = 1.0, recent avg ratio = 0.88
    //   → delta = -0.12 (just past the -0.10 boundary).
    const early  = { durationMin: 50, tss: 50 }   // 1.0
    const recent = { durationMin: 44, tss: 50 }   // 0.88
    const log = buildWeeklyLog([
      early, early, early, early,
      recent, recent, recent, recent,
    ])
    const r = analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.delta).toBeLessThanOrEqual(-0.10)
    expect(r.band).toBe('CREEPING_INTENSITY')
  })
})

// ─── Round-trip through sanitizeLogEntry (dead-card regression guard) ────────
// The sanitizer renames `durationMin` → `duration`. Pre-fix this card summed
// `e.durationMin`, so totalMinutes was 0 on every real (sanitized) entry while
// raw-field tests passed. Round-tripping the log proves the card reads the
// emitted `duration`.
describe('analyzeWeeklyVolumeIntensityRatio — sanitized round-trip', () => {
  it('aggregates volume from sanitizer-emitted `duration` (not raw durationMin)', () => {
    // The app stores `duration`; remap the helper's legacy `durationMin` to it
    // before sanitizing so the log matches what is actually persisted.
    const raw = buildWeeklyLog(Array(8).fill({ durationMin: 60, tss: 50 }))
      .map(({ durationMin, ...rest }) => ({ ...rest, duration: durationMin }))
    const log = raw.map(sanitizeLogEntry)
    expect(log[0].durationMin).toBeUndefined()
    expect(log[0].duration).toBe(60)
    const r = analyzeWeeklyVolumeIntensityRatio({ log, today: TODAY })
    expect(r).not.toBeNull()
    for (const w of r.weeks) {
      expect(w.totalMinutes).toBe(60)
      expect(w.ratio).toBeCloseTo(1.2, 6)
    }
  })
})
