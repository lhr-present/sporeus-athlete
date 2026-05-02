// ─── sessionVariety.test.js — E122: Session Variety Detector unit tests ─────
import { describe, it, expect } from 'vitest'
import { detectSessionVariety } from '../../athlete/sessionVariety.js'

// Reference date: Thursday 2026-04-30
// 28-day window: 2026-04-03 .. 2026-04-30 (inclusive)
const TODAY = '2026-04-30'

// ─── Helpers ────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Canonical entries — each one hits exactly one intent rule.
const recoveryEntry = (date) => ({
  date, type: 'run', duration: 30, rpe: 2, zones: [50, 50, 0, 0, 0],
})
const longEntry = (date) => ({
  date, type: 'run', duration: 120, rpe: 4, zones: [10, 80, 10, 0, 0],
})
const steadyEntry = (date) => ({
  date, type: 'run', duration: 60, rpe: 5, zones: [10, 80, 10, 0, 0],
})
const tempoEntry = (date) => ({
  date, type: 'run', duration: 50, rpe: 6, zones: [0, 20, 50, 30, 0],
})
const intervalsEntry = (date) => ({
  date, type: 'run', duration: 45, rpe: 8, zones: [0, 10, 20, 40, 30],
})

/**
 * Build N consecutive days ending today, all hitting the same intent builder.
 */
function buildLog(builder, n, today = TODAY) {
  const out = []
  for (let i = 0; i < n; i++) out.push(builder(addDays(today, -i)))
  return out
}

// ─── Empty / null ───────────────────────────────────────────────────────────
describe('detectSessionVariety — empty / null inputs', () => {
  it('returns defaults for null log', () => {
    const r = detectSessionVariety(null, TODAY)
    expect(r.reliable).toBe(false)
    expect(r.variety).toBe('low')
    expect(r.mixScore).toBe(0)
    expect(r.missing).toEqual(['recovery', 'long', 'steady', 'tempo', 'intervals'])
  })

  it('returns defaults for empty array log', () => {
    const r = detectSessionVariety([], TODAY)
    expect(r.reliable).toBe(false)
    expect(r.variety).toBe('low')
    expect(r.mixScore).toBe(0)
    expect(r.missing.length).toBe(5)
  })

  it('returns defaults for non-array input', () => {
    const r = detectSessionVariety('not-a-log', TODAY)
    expect(r.variety).toBe('low')
    expect(r.mixScore).toBe(0)
    expect(r.reliable).toBe(false)
  })
})

// ─── Reliability ────────────────────────────────────────────────────────────
describe('detectSessionVariety — reliability flag', () => {
  it('marks reliable=false when fewer than 14 distinct days', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(steadyEntry(addDays(TODAY, -i)))
    const r = detectSessionVariety(log, TODAY)
    expect(r.reliable).toBe(false)
  })

  it('marks reliable=true with ≥14 distinct days', () => {
    const log = buildLog(steadyEntry, 20)
    const r = detectSessionVariety(log, TODAY)
    expect(r.reliable).toBe(true)
  })
})

// ─── Mix score / variety ────────────────────────────────────────────────────
describe('detectSessionVariety — mix score and variety classification', () => {
  it('all-recovery 28d log → mixScore=1, variety=low, 4 missing', () => {
    const log = buildLog(recoveryEntry, 28)
    const r = detectSessionVariety(log, TODAY)
    expect(r.mixScore).toBe(1)
    expect(r.variety).toBe('low')
    expect(r.intents.recovery).toBeGreaterThan(0)
    expect(r.missing.length).toBe(4)
    expect(r.missing).not.toContain('recovery')
  })

  it('3-intent mix (recovery+long+steady) → mixScore=3, variety=moderate', () => {
    const log = [
      ...buildLog(recoveryEntry, 5),
      ...[longEntry(addDays(TODAY, -10)), longEntry(addDays(TODAY, -17))],
      ...[steadyEntry(addDays(TODAY, -8)), steadyEntry(addDays(TODAY, -15)),
          steadyEntry(addDays(TODAY, -22))],
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.mixScore).toBe(3)
    expect(r.variety).toBe('moderate')
    expect(r.missing).toEqual(['tempo', 'intervals'])
  })

  it('4-intent mix → variety=good', () => {
    const log = [
      recoveryEntry(addDays(TODAY, -1)),
      longEntry(addDays(TODAY, -3)),
      steadyEntry(addDays(TODAY, -5)),
      tempoEntry(addDays(TODAY, -7)),
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.mixScore).toBe(4)
    expect(r.variety).toBe('good')
    expect(r.missing).toEqual(['intervals'])
  })

  it('5-intent mix → variety=good, missing=[]', () => {
    const log = [
      recoveryEntry(addDays(TODAY, -1)),
      longEntry(addDays(TODAY, -3)),
      steadyEntry(addDays(TODAY, -5)),
      tempoEntry(addDays(TODAY, -7)),
      intervalsEntry(addDays(TODAY, -9)),
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.mixScore).toBe(5)
    expect(r.variety).toBe('good')
    expect(r.missing).toEqual([])
  })

  // Boundary tests
  it('boundary: mixScore=2 IS low (strict)', () => {
    const log = [
      recoveryEntry(addDays(TODAY, -1)),
      longEntry(addDays(TODAY, -3)),
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.mixScore).toBe(2)
    expect(r.variety).toBe('low')
  })

  it('boundary: mixScore=3 IS moderate (strict)', () => {
    const log = [
      recoveryEntry(addDays(TODAY, -1)),
      longEntry(addDays(TODAY, -3)),
      steadyEntry(addDays(TODAY, -5)),
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.mixScore).toBe(3)
    expect(r.variety).toBe('moderate')
  })

  it('boundary: mixScore=4 IS good (strict)', () => {
    const log = [
      recoveryEntry(addDays(TODAY, -1)),
      longEntry(addDays(TODAY, -3)),
      steadyEntry(addDays(TODAY, -5)),
      tempoEntry(addDays(TODAY, -7)),
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.mixScore).toBe(4)
    expect(r.variety).toBe('good')
  })
})

// ─── Classification rules ───────────────────────────────────────────────────
describe('detectSessionVariety — classification rules', () => {
  it('recovery: RPE=3 + 45min → recovery', () => {
    const log = [
      { date: addDays(TODAY, -1), duration: 45, rpe: 3, zones: [50, 50, 0, 0, 0] },
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.intents.recovery).toBe(1)
    expect(r.intents.long + r.intents.steady + r.intents.tempo + r.intents.intervals).toBe(0)
  })

  it('recovery boundary: RPE=3 + 60min → recovery (≤ inclusive)', () => {
    const log = [
      { date: addDays(TODAY, -1), duration: 60, rpe: 3, zones: [50, 50, 0, 0, 0] },
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.intents.recovery).toBe(1)
  })

  it('long: duration=90 + RPE=5 → long (precedence over steady)', () => {
    const log = [
      { date: addDays(TODAY, -1), duration: 90, rpe: 5, zones: [10, 80, 10, 0, 0] },
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.intents.long).toBe(1)
    expect(r.intents.steady).toBe(0)
  })

  it('long: duration=120 + RPE=4 → long', () => {
    const log = [longEntry(addDays(TODAY, -1))]
    const r = detectSessionVariety(log, TODAY)
    expect(r.intents.long).toBe(1)
  })

  it('steady: RPE=5 + 60min + Z2-dominant → steady', () => {
    const log = [steadyEntry(addDays(TODAY, -1))]
    const r = detectSessionVariety(log, TODAY)
    expect(r.intents.steady).toBe(1)
  })

  it('tempo: RPE=6 + 50min + Z3+Z4 → tempo', () => {
    const log = [
      { date: addDays(TODAY, -1), duration: 50, rpe: 6, zones: [0, 20, 50, 30, 0] },
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.intents.tempo).toBe(1)
  })

  it('intervals: RPE=8 + 45min + Z4+Z5 share > 30% → intervals', () => {
    const log = [
      { date: addDays(TODAY, -1), duration: 45, rpe: 8, zones: [0, 10, 20, 40, 30] },
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.intents.intervals).toBe(1)
  })

  it('intervals requires zone evidence: RPE=8 + 45min, Z4+Z5=20% → not intervals', () => {
    const log = [
      { date: addDays(TODAY, -1), duration: 45, rpe: 8, zones: [10, 50, 20, 15, 5] },
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.intents.intervals).toBe(0)
  })

  it('unclassifiable: NaN RPE → not counted', () => {
    const log = [
      { date: addDays(TODAY, -1), duration: 60, rpe: NaN, zones: [10, 80, 10, 0, 0] },
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.mixScore).toBe(0)
    expect(r.intents.recovery + r.intents.long + r.intents.steady
      + r.intents.tempo + r.intents.intervals).toBe(0)
  })

  it('unclassifiable: missing duration → not counted', () => {
    const log = [{ date: addDays(TODAY, -1), rpe: 5 }]
    const r = detectSessionVariety(log, TODAY)
    expect(r.mixScore).toBe(0)
  })

  it('multiple sessions same day all count separately', () => {
    const day = addDays(TODAY, -2)
    const log = [
      recoveryEntry(day),
      tempoEntry(day),
      intervalsEntry(day),
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.intents.recovery).toBe(1)
    expect(r.intents.tempo).toBe(1)
    expect(r.intents.intervals).toBe(1)
    expect(r.mixScore).toBe(3)
  })

  it('out-of-window entries are ignored', () => {
    const log = [
      // 40 days ago — outside 28d window
      { date: addDays(TODAY, -40), duration: 60, rpe: 6,
        zones: [0, 20, 50, 30, 0] },
      steadyEntry(addDays(TODAY, -1)),
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.intents.tempo).toBe(0)
    expect(r.intents.steady).toBe(1)
  })
})

// ─── Bilingual messages + shape ─────────────────────────────────────────────
describe('detectSessionVariety — bilingual messages and result shape', () => {
  it('low variety: en + tr non-empty for both message and recommendation', () => {
    const log = buildLog(recoveryEntry, 5)
    const r = detectSessionVariety(log, TODAY)
    expect(r.variety).toBe('low')
    expect(r.message.en.length).toBeGreaterThan(0)
    expect(r.message.tr.length).toBeGreaterThan(0)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('moderate variety: en + tr non-empty for both message and recommendation', () => {
    const log = [
      recoveryEntry(addDays(TODAY, -1)),
      longEntry(addDays(TODAY, -3)),
      steadyEntry(addDays(TODAY, -5)),
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.variety).toBe('moderate')
    expect(r.message.en.length).toBeGreaterThan(0)
    expect(r.message.tr.length).toBeGreaterThan(0)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('good variety: empty recommendation, non-empty message', () => {
    const log = [
      recoveryEntry(addDays(TODAY, -1)),
      longEntry(addDays(TODAY, -3)),
      steadyEntry(addDays(TODAY, -5)),
      tempoEntry(addDays(TODAY, -7)),
      intervalsEntry(addDays(TODAY, -9)),
    ]
    const r = detectSessionVariety(log, TODAY)
    expect(r.variety).toBe('good')
    expect(r.message.en).toBe('Good session variety.')
    expect(r.message.tr).toBe('İyi seans çeşitliliği.')
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })

  it('low-variety recommendation references the first missing intent (TR label mapped)', () => {
    // Only recovery present → first missing is 'long' → TR 'uzun'
    const log = buildLog(recoveryEntry, 5)
    const r = detectSessionVariety(log, TODAY)
    expect(r.recommendation.en).toContain('long')
    expect(r.recommendation.tr).toContain('uzun')
  })

  it('citation always present', () => {
    const r = detectSessionVariety([], TODAY)
    expect(r.citation).toBe('Seiler 2010; Foster 2001')
  })

  it('result has all 8 expected keys', () => {
    const r = detectSessionVariety([steadyEntry(addDays(TODAY, -1))], TODAY)
    expect(Object.keys(r).sort()).toEqual([
      'citation', 'intents', 'message', 'missing',
      'mixScore', 'recommendation', 'reliable', 'variety',
    ])
  })

  it('each intents value is a number ≥ 0', () => {
    const log = [
      recoveryEntry(addDays(TODAY, -1)),
      longEntry(addDays(TODAY, -3)),
      steadyEntry(addDays(TODAY, -5)),
      tempoEntry(addDays(TODAY, -7)),
      intervalsEntry(addDays(TODAY, -9)),
    ]
    const r = detectSessionVariety(log, TODAY)
    for (const k of ['recovery', 'long', 'steady', 'tempo', 'intervals']) {
      expect(typeof r.intents[k]).toBe('number')
      expect(r.intents[k]).toBeGreaterThanOrEqual(0)
    }
  })
})
