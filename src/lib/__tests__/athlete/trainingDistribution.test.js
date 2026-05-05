// E128
import { describe, it, expect } from 'vitest'
import { detectTrainingDistribution } from '../../athlete/trainingDistribution.js'

// Reference date: Thursday 2026-04-30
// Default 84-day window: 2026-02-06 .. 2026-04-30 (inclusive)
const TODAY = '2026-04-30'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Canonical entries
const z2Entry = (date, dur = 60, tss = 50) => ({
  date, type: 'run', duration: dur, tss, rpe: 5, zones: [0, dur, 0, 0, 0],
})
const z3Entry = (date, dur = 50, tss = 60) => ({
  date, type: 'run', duration: dur, tss, rpe: 6, zones: [0, 0, dur, 0, 0],
})
const _z5Entry = (date, dur = 30, tss = 70) => ({
  date, type: 'run', duration: dur, tss, rpe: 9, zones: [0, 0, 0, 0, dur],
})

// Build a polarized log: 75% Z2 minutes + 15% Z5 + 10% Z3 across N entries
function buildPolarizedLog(today = TODAY) {
  const out = []
  // 6 weeks × 7 days; pattern: 5 Z2 sessions, 1 Z5, 1 Z3 → ~71% Z2 by count,
  // but minutes are what matter — make Z2 dominant by minutes too.
  for (let w = 0; w < 6; w++) {
    const wkStart = addDays(today, -(w * 7 + 6))
    // 5 Z2 (each 75 min) → 375 min Z2
    for (let d = 0; d < 5; d++) out.push(z2Entry(addDays(wkStart, d), 75, 60))
    // 1 Z3 (50 min) → 50 min Z3
    out.push(z3Entry(addDays(wkStart, 5), 50, 60))
    // 1 Z5 (75 min split) → 75 min Z5
    out.push({
      date: addDays(wkStart, 6),
      type: 'run',
      duration: 45,
      tss: 80,
      rpe: 8,
      zones: [0, 0, 0, 0, 75],
    })
  }
  // Totals: 375+50+75 = 500 min/week → Z2=75%, Z3=10%, Z5=15%
  return out
}

// ─── Empty / null inputs ─────────────────────────────────────────────────────
describe('detectTrainingDistribution — empty / null', () => {
  it('returns safe defaults for null log', () => {
    const r = detectTrainingDistribution(null, 84, TODAY)
    expect(r.reliable).toBe(false)
    expect(r.polarizedMatch).toBe('poor')
    expect(r.zones).toEqual({ Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 })
    expect(r.intents).toEqual({ recovery: 0, long: 0, steady: 0, tempo: 0, intervals: 0 })
    expect(r.weeklyAvg).toEqual({ tss: 0, durationMin: 0, sessions: 0 })
    expect(r.totalSessions).toBe(0)
    expect(r.weeksObserved).toBe(0)
  })

  it('returns safe defaults for empty array log', () => {
    const r = detectTrainingDistribution([], 84, TODAY)
    expect(r.reliable).toBe(false)
    expect(r.polarizedMatch).toBe('poor')
    expect(r.totalSessions).toBe(0)
  })

  it('returns safe defaults for non-array input', () => {
    const r = detectTrainingDistribution('nope', 84, TODAY)
    expect(r.reliable).toBe(false)
    expect(r.totalSessions).toBe(0)
  })
})

// ─── Reliability ─────────────────────────────────────────────────────────────
describe('detectTrainingDistribution — reliability', () => {
  it('reliable=false when fewer than 4 weeks observed', () => {
    // 3 sessions in same ISO week
    const log = [
      z2Entry(TODAY, 60, 50),
      z2Entry(addDays(TODAY, -1), 60, 50),
      z2Entry(addDays(TODAY, -2), 60, 50),
    ]
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.reliable).toBe(false)
    expect(r.weeksObserved).toBe(1)
    // still computes
    expect(r.zones.Z2).toBe(100)
    expect(r.totalSessions).toBe(3)
  })

  it('reliable=true once weeksObserved ≥ 4', () => {
    const log = []
    for (let w = 0; w < 5; w++) {
      log.push(z2Entry(addDays(TODAY, -w * 7), 60, 50))
    }
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.weeksObserved).toBeGreaterThanOrEqual(4)
    expect(r.reliable).toBe(true)
  })
})

// ─── Polarized model match ───────────────────────────────────────────────────
describe('detectTrainingDistribution — polarized match', () => {
  it('polarized 75/15/10 synthetic log → good', () => {
    const log = buildPolarizedLog()
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.zones.Z2).toBe(75)
    expect(r.zones.Z3).toBe(10)
    expect(r.zones.Z5).toBe(15)
    expect(r.polarizedMatch).toBe('good')
    expect(r.polarizedNote.en).toMatch(/polarized 80\/20 model/)
  })

  it('all-Z2 log → moderate (Z5 too low)', () => {
    const log = []
    for (let i = 0; i < 6 * 7; i++) {
      log.push(z2Entry(addDays(TODAY, -i), 60, 50))
    }
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.zones.Z2).toBe(100)
    expect(r.zones.Z5).toBe(0)
    expect(r.polarizedMatch).toBe('poor')
  })

  it('all-Z3 log → poor (no Z5, too much threshold)', () => {
    const log = []
    for (let i = 0; i < 4 * 7; i++) {
      log.push(z3Entry(addDays(TODAY, -i), 50, 60))
    }
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.zones.Z3).toBe(100)
    expect(r.polarizedMatch).toBe('poor')
  })

  it('boundary: Z2=70 Z5=15 Z3=10 (rest Z4=5) → good (inclusive)', () => {
    // Use a single aggregated log with explicit zone minutes.
    // Distribute over 5 weeks so reliable=true.
    const log = []
    for (let w = 0; w < 5; w++) {
      const date = addDays(TODAY, -w * 7)
      log.push({
        date,
        type: 'run',
        duration: 100,
        tss: 100,
        rpe: 5,
        zones: [0, 70, 10, 5, 15],
      })
    }
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.zones.Z2).toBe(70)
    expect(r.zones.Z3).toBe(10)
    expect(r.zones.Z5).toBe(15)
    expect(r.polarizedMatch).toBe('good')
  })

  it('boundary: Z2=69 → not good (drops to moderate or poor)', () => {
    const log = []
    for (let w = 0; w < 5; w++) {
      const date = addDays(TODAY, -w * 7)
      log.push({
        date,
        type: 'run',
        duration: 100,
        tss: 100,
        rpe: 5,
        zones: [0, 69, 10, 6, 15],
      })
    }
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.zones.Z2).toBe(69)
    expect(r.polarizedMatch).not.toBe('good')
    // Z2≥60, Z5≥5, Z3≤20 → moderate
    expect(r.polarizedMatch).toBe('moderate')
  })

  it('boundary: Z3=11 → not good (drops to moderate)', () => {
    const log = []
    for (let w = 0; w < 5; w++) {
      const date = addDays(TODAY, -w * 7)
      log.push({
        date,
        type: 'run',
        duration: 100,
        tss: 100,
        rpe: 5,
        zones: [0, 70, 11, 4, 15],
      })
    }
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.zones.Z3).toBe(11)
    expect(r.polarizedMatch).not.toBe('good')
    expect(r.polarizedMatch).toBe('moderate')
  })

  it('boundary: Z5=5 AND Z2=60 AND Z3=20 → moderate (inclusive)', () => {
    const log = []
    for (let w = 0; w < 5; w++) {
      const date = addDays(TODAY, -w * 7)
      log.push({
        date,
        type: 'run',
        duration: 100,
        tss: 100,
        rpe: 5,
        zones: [10, 60, 20, 5, 5],
      })
    }
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.zones.Z2).toBe(60)
    expect(r.zones.Z3).toBe(20)
    expect(r.zones.Z5).toBe(5)
    expect(r.polarizedMatch).toBe('moderate')
  })

  it('Z5=4 (just below 5) → not moderate (poor)', () => {
    const log = []
    for (let w = 0; w < 5; w++) {
      const date = addDays(TODAY, -w * 7)
      log.push({
        date,
        type: 'run',
        duration: 100,
        tss: 100,
        rpe: 5,
        zones: [11, 60, 20, 5, 4],
      })
    }
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.zones.Z5).toBe(4)
    expect(r.polarizedMatch).toBe('poor')
  })
})

// ─── Weekly averages ─────────────────────────────────────────────────────────
describe('detectTrainingDistribution — weekly averages', () => {
  it('weeklyAvg.tss is a whole number', () => {
    const log = buildPolarizedLog()
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(Number.isInteger(r.weeklyAvg.tss)).toBe(true)
    expect(r.weeklyAvg.tss).toBeGreaterThan(0)
  })

  it('weeklyAvg.durationMin is a whole number', () => {
    const log = buildPolarizedLog()
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(Number.isInteger(r.weeklyAvg.durationMin)).toBe(true)
    expect(r.weeklyAvg.durationMin).toBeGreaterThan(0)
  })

  it('weeklyAvg.sessions ≈ totalSessions / weeksObserved', () => {
    const log = buildPolarizedLog()
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.weeklyAvg.sessions).toBe(
      Math.round(r.totalSessions / r.weeksObserved),
    )
  })
})

// ─── Window handling ─────────────────────────────────────────────────────────
describe('detectTrainingDistribution — window handling', () => {
  it('custom windowDays=28 narrows window', () => {
    const log = []
    // 1 session per week for 12 weeks
    for (let w = 0; w < 12; w++) {
      log.push(z2Entry(addDays(TODAY, -w * 7), 60, 50))
    }
    const r28 = detectTrainingDistribution(log, 28, TODAY)
    const r84 = detectTrainingDistribution(log, 84, TODAY)
    expect(r28.totalSessions).toBeLessThan(r84.totalSessions)
    expect(r28.totalSessions).toBeLessThanOrEqual(4)
    expect(r84.totalSessions).toBe(12)
  })

  it('default windowDays=84 captures ~12 weeks', () => {
    const log = []
    for (let w = 0; w < 12; w++) {
      log.push(z2Entry(addDays(TODAY, -w * 7), 60, 50))
    }
    const r = detectTrainingDistribution(log, undefined, TODAY)
    expect(r.totalSessions).toBe(12)
  })

  it('sessions outside window are excluded', () => {
    const log = [
      z2Entry(TODAY, 60, 50),
      // 200 days ago — well outside 84d default
      z2Entry(addDays(TODAY, -200), 60, 50),
    ]
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.totalSessions).toBe(1)
  })
})

// ─── Distribution sums ───────────────────────────────────────────────────────
describe('detectTrainingDistribution — sums', () => {
  it('zone percentages sum to ~100 when zones present', () => {
    const log = buildPolarizedLog()
    const r = detectTrainingDistribution(log, 84, TODAY)
    const sum = r.zones.Z1 + r.zones.Z2 + r.zones.Z3 + r.zones.Z4 + r.zones.Z5
    // rounding can cause off-by-one or two
    expect(sum).toBeGreaterThanOrEqual(98)
    expect(sum).toBeLessThanOrEqual(102)
  })

  it('zone percentages all 0 when log empty', () => {
    const r = detectTrainingDistribution([], 84, TODAY)
    expect(r.zones).toEqual({ Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 })
  })

  it('intent percentages sum to ≤ 100 (some sessions may be unclassifiable)', () => {
    // Mix of classifiable and unclassifiable entries
    const log = [
      // classifiable
      { date: TODAY, type: 'run', duration: 60, tss: 50, rpe: 5, zones: [0, 60, 0, 0, 0] },
      { date: addDays(TODAY, -1), type: 'run', duration: 50, tss: 60, rpe: 6, zones: [0, 0, 50, 0, 0] },
      // unclassifiable: NaN rpe → null
      { date: addDays(TODAY, -2), type: 'strength', duration: 45, tss: 30 },
      // unclassifiable: rpe present but no rule matches (e.g. rpe 6 dur 100)
      { date: addDays(TODAY, -3), type: 'run', duration: 100, tss: 80, rpe: 6, zones: [0, 0, 50, 50, 0] },
    ]
    const r = detectTrainingDistribution(log, 84, TODAY)
    const intentSum =
      r.intents.recovery + r.intents.long + r.intents.steady +
      r.intents.tempo + r.intents.intervals
    expect(intentSum).toBeLessThanOrEqual(100)
    expect(intentSum).toBeGreaterThan(0)
  })

  it('intent percentages sum to ~100 when all sessions classifiable', () => {
    const log = []
    // 4 weeks of pure steady sessions
    for (let i = 0; i < 28; i++) {
      log.push({
        date: addDays(TODAY, -i),
        type: 'run',
        duration: 60,
        tss: 50,
        rpe: 5,
        zones: [0, 60, 0, 0, 0],
      })
    }
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.intents.steady).toBe(100)
    const intentSum =
      r.intents.recovery + r.intents.long + r.intents.steady +
      r.intents.tempo + r.intents.intervals
    expect(intentSum).toBe(100)
  })
})

// ─── Weeks observed ──────────────────────────────────────────────────────────
describe('detectTrainingDistribution — weeksObserved', () => {
  it('counts distinct ISO weeks correctly', () => {
    // One session per week for 5 weeks
    const log = []
    for (let w = 0; w < 5; w++) {
      log.push(z2Entry(addDays(TODAY, -w * 7), 60, 50))
    }
    const r = detectTrainingDistribution(log, 84, TODAY)
    expect(r.weeksObserved).toBe(5)
  })

  it('multiple sessions in same week count as 1 week', () => {
    const log = [
      z2Entry(TODAY, 60, 50),
      z2Entry(addDays(TODAY, -1), 60, 50),
      z2Entry(addDays(TODAY, -2), 60, 50),
    ]
    const r = detectTrainingDistribution(log, 84, TODAY)
    // TODAY=2026-04-30 (Thu), -1=Wed, -2=Tue → all same ISO week
    expect(r.weeksObserved).toBe(1)
  })
})

// ─── Schema / contract ───────────────────────────────────────────────────────
describe('detectTrainingDistribution — schema', () => {
  it('result has all 9 expected keys', () => {
    const r = detectTrainingDistribution([], 84, TODAY)
    const keys = Object.keys(r).sort()
    expect(keys).toEqual([
      'citation',
      'intents',
      'polarizedMatch',
      'polarizedNote',
      'reliable',
      'totalSessions',
      'weeklyAvg',
      'weeksObserved',
      'zones',
    ])
  })

  it('all bilingual notes have non-empty en + tr', () => {
    // Trigger each match band
    const polarizedLog = buildPolarizedLog()
    const goodR = detectTrainingDistribution(polarizedLog, 84, TODAY)
    expect(goodR.polarizedNote.en.length).toBeGreaterThan(0)
    expect(goodR.polarizedNote.tr.length).toBeGreaterThan(0)

    const moderateLog = []
    for (let w = 0; w < 5; w++) {
      moderateLog.push({
        date: addDays(TODAY, -w * 7),
        type: 'run',
        duration: 100,
        tss: 100,
        rpe: 5,
        zones: [10, 60, 20, 5, 5],
      })
    }
    const modR = detectTrainingDistribution(moderateLog, 84, TODAY)
    expect(modR.polarizedMatch).toBe('moderate')
    expect(modR.polarizedNote.en.length).toBeGreaterThan(0)
    expect(modR.polarizedNote.tr.length).toBeGreaterThan(0)

    const poorR = detectTrainingDistribution([], 84, TODAY)
    expect(poorR.polarizedMatch).toBe('poor')
    expect(poorR.polarizedNote.en.length).toBeGreaterThan(0)
    expect(poorR.polarizedNote.tr.length).toBeGreaterThan(0)
  })

  it('citation field present and matches expected string', () => {
    const r = detectTrainingDistribution([], 84, TODAY)
    expect(r.citation).toBe('Seiler 2010; Stöggl & Sperlich 2014')
  })

  it('all zone percentages are integers (no decimals)', () => {
    const log = buildPolarizedLog()
    const r = detectTrainingDistribution(log, 84, TODAY)
    for (const k of ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']) {
      expect(Number.isInteger(r.zones[k])).toBe(true)
    }
  })

  it('all intent percentages are integers', () => {
    const log = buildPolarizedLog()
    const r = detectTrainingDistribution(log, 84, TODAY)
    for (const k of ['recovery', 'long', 'steady', 'tempo', 'intervals']) {
      expect(Number.isInteger(r.intents[k])).toBe(true)
    }
  })
})
