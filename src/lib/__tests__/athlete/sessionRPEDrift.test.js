// sessionRPEDrift — unit tests
import { describe, it, expect } from 'vitest'
import {
  detectSessionRPEDrift,
  SESSION_RPE_DRIFT_CITATION,
} from '../../athlete/sessionRPEDrift.js'

const TODAY = '2026-05-05'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeLog(entries) {
  return entries.map((e, i) => ({
    date: e.date || addDays(TODAY, -i),
    duration: e.duration ?? 60,
    ...e,
  }))
}

describe('detectSessionRPEDrift — empty / null', () => {
  it('null log → reliable=false, vacuous good band', () => {
    const r = detectSessionRPEDrift(null, TODAY)
    expect(r.totalSessions).toBe(0)
    expect(r.driftSessions).toBe(0)
    expect(r.driftPct).toBe(0)
    expect(r.band).toBe('good')
    expect(r.reliable).toBe(false)
    expect(r.worstType).toBeNull()
    expect(r.citation).toBe(SESSION_RPE_DRIFT_CITATION)
  })

  it('empty array → reliable=false, vacuous good', () => {
    const r = detectSessionRPEDrift([], TODAY)
    expect(r.totalSessions).toBe(0)
    expect(r.band).toBe('good')
    expect(r.reliable).toBe(false)
  })

  it('non-array log → safe defaults', () => {
    const r = detectSessionRPEDrift({ foo: 'bar' }, TODAY)
    expect(r.totalSessions).toBe(0)
    expect(r.band).toBe('good')
  })
})

describe('detectSessionRPEDrift — single session', () => {
  it('single typed session within plan → no drift', () => {
    const log = makeLog([{ intent: 'easy', rpe: 4 }])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.totalSessions).toBe(1)
    expect(r.driftSessions).toBe(0)
    expect(r.driftPct).toBe(0)
    expect(r.band).toBe('good')
  })

  it('intent=easy with rpe=5 → mild drift (delta 1)', () => {
    const log = makeLog([{ intent: 'easy', rpe: 5 }])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.driftSessions).toBe(1)
    expect(r.bySeverity.mild).toBe(1)
    expect(r.bySeverity.moderate).toBe(0)
    expect(r.bySeverity.severe).toBe(0)
  })

  it('intent=easy with rpe=6 → moderate severity (delta 2)', () => {
    const log = makeLog([{ intent: 'easy', rpe: 6 }])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.driftSessions).toBe(1)
    expect(r.bySeverity.mild).toBe(0)
    expect(r.bySeverity.moderate).toBe(1)
    expect(r.bySeverity.severe).toBe(0)
  })

  it('intent=easy with rpe=8 → severe severity (delta ≥3)', () => {
    const log = makeLog([{ intent: 'easy', rpe: 8 }])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.driftSessions).toBe(1)
    expect(r.bySeverity.severe).toBe(1)
  })
})

describe('detectSessionRPEDrift — reliability', () => {
  it('exactly 8 typed sessions → reliable=true', () => {
    const log = makeLog(Array.from({ length: 8 }, () => ({ intent: 'easy', rpe: 3 })))
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.totalSessions).toBe(8)
    expect(r.reliable).toBe(true)
  })

  it('7 typed sessions → reliable=false (still computes)', () => {
    const log = makeLog(Array.from({ length: 7 }, () => ({ intent: 'easy', rpe: 3 })))
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.totalSessions).toBe(7)
    expect(r.reliable).toBe(false)
  })
})

describe('detectSessionRPEDrift — band boundaries', () => {
  it('driftPct=20 exactly → moderate (>=20% rule)', () => {
    // 8 compliant + 2 drift = 20%
    const log = makeLog([
      ...Array.from({ length: 8 }, () => ({ intent: 'easy', rpe: 3 })),
      ...Array.from({ length: 2 }, () => ({ intent: 'easy', rpe: 7 })),
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.driftPct).toBe(20)
    expect(r.band).toBe('moderate')
  })

  it('driftPct=19 → good (strict <20%)', () => {
    // 81 compliant + 19 drift across 28 days
    const compliant = Array.from({ length: 81 }, (_, i) => ({
      date: addDays(TODAY, -(i % 28)), intent: 'easy', rpe: 3,
    }))
    const drift = Array.from({ length: 19 }, (_, i) => ({
      date: addDays(TODAY, -(i % 28)), intent: 'easy', rpe: 7,
    }))
    const r = detectSessionRPEDrift([...compliant, ...drift], TODAY)
    expect(r.driftPct).toBe(19)
    expect(r.band).toBe('good')
  })

  it('driftPct=40 exactly → high (>=40% rule)', () => {
    // 6 compliant + 4 drift = 40%
    const log = makeLog([
      ...Array.from({ length: 6 }, () => ({ intent: 'easy', rpe: 3 })),
      ...Array.from({ length: 4 }, () => ({ intent: 'easy', rpe: 7 })),
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.driftPct).toBe(40)
    expect(r.band).toBe('high')
  })

  it('driftPct=39 → moderate (strict <40%)', () => {
    const compliant = Array.from({ length: 61 }, (_, i) => ({
      date: addDays(TODAY, -(i % 28)), intent: 'easy', rpe: 3,
    }))
    const drift = Array.from({ length: 39 }, (_, i) => ({
      date: addDays(TODAY, -(i % 28)), intent: 'easy', rpe: 7,
    }))
    const r = detectSessionRPEDrift([...compliant, ...drift], TODAY)
    expect(r.driftPct).toBe(39)
    expect(r.band).toBe('moderate')
  })
})

describe('detectSessionRPEDrift — type recognition', () => {
  it('intent precedence over type (intent=easy overrides type=Run)', () => {
    const log = makeLog([{ intent: 'easy', type: 'Run', rpe: 7 }])
    const r = detectSessionRPEDrift(log, TODAY)
    // easy plan=4 → 7-4=3 → severe
    expect(r.driftSessions).toBe(1)
    expect(r.bySeverity.severe).toBe(1)
    expect(r.byType.easy.total).toBe(1)
  })

  it('falls back to type when no intent (type=Tempo Run → steady)', () => {
    const log = makeLog([{ type: 'Tempo Run', rpe: 8 }])
    const r = detectSessionRPEDrift(log, TODAY)
    // tempo plan=7 → 8-7=1 → mild
    expect(r.driftSessions).toBe(1)
    expect(r.bySeverity.mild).toBe(1)
    expect(r.byType.steady.total).toBe(1)
  })

  it('long/endurance regex from type recognized (max RPE 5)', () => {
    const log = makeLog([{ type: 'Long Run', rpe: 7 }])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.driftSessions).toBe(1)
    expect(r.byType.long.total).toBe(1)
  })

  it('threshold/sweetspot regex from type recognized (max RPE 8)', () => {
    const log = makeLog([
      { type: 'Threshold', rpe: 9 },
      { type: 'Sweet Spot', rpe: 8 },
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.byType.threshold.total).toBe(2)
    expect(r.byType.threshold.drift).toBe(1)
  })

  it('intervals/vo2 type → max RPE 10 (cannot drift)', () => {
    const log = makeLog([
      { type: 'VO2 intervals', rpe: 10 },
      { type: 'Race-Pace', rpe: 10 },
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.byType.intervals.total).toBe(2)
    expect(r.byType.intervals.drift).toBe(0)
  })

  it('unrecognized intent/type skipped (not counted)', () => {
    const log = makeLog([
      { type: 'misc', rpe: 7 },
      { intent: 'cross-train', rpe: 5 },
      { intent: 'easy', rpe: 3 },
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.totalSessions).toBe(1)
  })
})

describe('detectSessionRPEDrift — byType grouping', () => {
  it('groups 3 easy + 2 long + 3 tempo correctly', () => {
    const log = makeLog([
      { intent: 'easy', rpe: 3 },
      { intent: 'easy', rpe: 4 },
      { intent: 'easy', rpe: 6 },     // drift
      { intent: 'long', rpe: 5 },
      { intent: 'long', rpe: 6 },     // drift
      { intent: 'tempo', rpe: 6 },
      { intent: 'tempo', rpe: 7 },
      { intent: 'tempo', rpe: 8 },    // drift
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.byType.easy).toEqual({ drift: 1, total: 3 })
    expect(r.byType.long).toEqual({ drift: 1, total: 2 })
    expect(r.byType.steady).toEqual({ drift: 1, total: 3 })
    expect(r.totalSessions).toBe(8)
    expect(r.driftSessions).toBe(3)
  })

  it('worstType identifies type with highest drift % (min 3 sessions)', () => {
    // easy 3 sessions, 1 drift = 33%
    // tempo 3 sessions, 2 drift = 67%
    const log = makeLog([
      { intent: 'easy', rpe: 3 },
      { intent: 'easy', rpe: 4 },
      { intent: 'easy', rpe: 6 },
      { intent: 'tempo', rpe: 5 },
      { intent: 'tempo', rpe: 8 },
      { intent: 'tempo', rpe: 9 },
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.worstType).toBe('steady')
  })

  it('worstType=null when no type bucket has 3+ sessions', () => {
    const log = makeLog([
      { intent: 'easy', rpe: 6 },
      { intent: 'easy', rpe: 6 },
      { intent: 'long', rpe: 7 },
      { intent: 'tempo', rpe: 8 },
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.worstType).toBeNull()
  })
})

describe('detectSessionRPEDrift — message substitution', () => {
  it('substitutes {p}% in moderate message', () => {
    // 8 compliant + 2 drift = 20%
    const log = makeLog([
      ...Array.from({ length: 8 }, () => ({ intent: 'easy', rpe: 3 })),
      ...Array.from({ length: 2 }, () => ({ intent: 'easy', rpe: 7 })),
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.message.en).toMatch(/20% of sessions drift/)
    expect(r.message.tr).toMatch(/%20/)
  })

  it('appends worstType to message when band !== good', () => {
    // tempo bucket has 3 with all-drift; easy clean
    const log = makeLog([
      { intent: 'easy', rpe: 3 },
      { intent: 'easy', rpe: 3 },
      { intent: 'easy', rpe: 3 },
      { intent: 'tempo', rpe: 9 },
      { intent: 'tempo', rpe: 9 },
      { intent: 'tempo', rpe: 9 },
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.band).not.toBe('good')
    expect(r.worstType).toBe('steady')
    expect(r.message.en).toMatch(/worst on steady sessions/)
    expect(r.message.tr).toMatch(/en kötü steady seansları/)
  })

  it('does NOT append worstType reference when band=good', () => {
    const log = makeLog(Array.from({ length: 10 }, () => ({ intent: 'easy', rpe: 3 })))
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.band).toBe('good')
    expect(r.message.en).not.toMatch(/worst on/)
    expect(r.message.tr).not.toMatch(/en kötü/)
  })
})

describe('detectSessionRPEDrift — filtering', () => {
  it('excludes entries outside 28-day window', () => {
    const old = { date: addDays(TODAY, -50), intent: 'easy', rpe: 9 }
    const recent = Array.from({ length: 5 }, (_, i) => ({
      date: addDays(TODAY, -i), intent: 'easy', rpe: 3,
    }))
    const r = detectSessionRPEDrift([old, ...recent], TODAY)
    expect(r.totalSessions).toBe(5)
    expect(r.driftSessions).toBe(0)
  })

  it('excludes entries with null/undefined rpe', () => {
    const log = makeLog([
      { intent: 'easy', rpe: 3 },
      { intent: 'easy', rpe: null },
      { intent: 'easy', rpe: undefined },
      { intent: 'easy' }, // no rpe
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.totalSessions).toBe(1)
  })

  it('options.today override is deterministic', () => {
    const past = '2025-12-01'
    const log = [
      { date: '2025-11-15', intent: 'easy', rpe: 3, duration: 60 },
      { date: '2025-12-01', intent: 'easy', rpe: 7, duration: 60 },
    ]
    const r = detectSessionRPEDrift(log, past)
    // Both within 28d of 2025-12-01
    expect(r.totalSessions).toBe(2)
    expect(r.driftSessions).toBe(1)
  })
})

describe('detectSessionRPEDrift — output shape', () => {
  it('citation present and matches export', () => {
    const r = detectSessionRPEDrift([], TODAY)
    expect(r.citation).toBe('Foster 2001 session RPE; Seiler 2010 polarized')
    expect(SESSION_RPE_DRIFT_CITATION).toBe(r.citation)
  })

  it('bilingual EN+TR keys non-empty for moderate band', () => {
    const log = makeLog([
      ...Array.from({ length: 8 }, () => ({ intent: 'easy', rpe: 3 })),
      ...Array.from({ length: 2 }, () => ({ intent: 'easy', rpe: 7 })),
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.band).toBe('moderate')
    expect(r.message.en.length).toBeGreaterThan(0)
    expect(r.message.tr.length).toBeGreaterThan(0)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('bilingual EN+TR keys non-empty for high band', () => {
    const log = makeLog([
      ...Array.from({ length: 4 }, () => ({ intent: 'easy', rpe: 3 })),
      ...Array.from({ length: 6 }, () => ({ intent: 'easy', rpe: 8 })),
    ])
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.band).toBe('high')
    expect(r.message.en.length).toBeGreaterThan(0)
    expect(r.message.tr.length).toBeGreaterThan(0)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('recommendation is empty for good band', () => {
    const log = makeLog(Array.from({ length: 10 }, () => ({ intent: 'easy', rpe: 3 })))
    const r = detectSessionRPEDrift(log, TODAY)
    expect(r.band).toBe('good')
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })
})
