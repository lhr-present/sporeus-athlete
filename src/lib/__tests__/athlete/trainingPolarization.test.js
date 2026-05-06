// trainingPolarization — unit tests
import { describe, it, expect } from 'vitest'
import {
  detectTrainingPolarization,
  TRAINING_POLARIZATION_CITATION,
} from '../../athlete/trainingPolarization.js'

const TODAY = '2026-05-05'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeLog(count, today, zonesArr) {
  const log = []
  for (let i = count - 1; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      zones: zonesArr.slice(),
      type: 'run',
    })
  }
  return log
}

describe('detectTrainingPolarization — empty / null', () => {
  it('null log → reliable=false, mixed pattern, all zeros', () => {
    const r = detectTrainingPolarization(null, TODAY)
    expect(r.pattern).toBe('mixed')
    expect(r.shares).toEqual({ Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 })
    expect(r.totalMinutes).toBe(0)
    expect(r.polarizationIndex).toBeNull()
    expect(r.reliable).toBe(false)
    expect(r.citation).toBe(TRAINING_POLARIZATION_CITATION)
  })

  it('empty array → reliable=false, mixed', () => {
    const r = detectTrainingPolarization([], TODAY)
    expect(r.pattern).toBe('mixed')
    expect(r.reliable).toBe(false)
  })
})

describe('detectTrainingPolarization — reliability flag', () => {
  it('totalMinutes < 200 → reliable=false (still computes pattern)', () => {
    const log = makeLog(5, TODAY, [10, 10, 5, 3, 2]) // 5 * 30 = 150
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.totalMinutes).toBeLessThan(200)
    expect(r.reliable).toBe(false)
    expect(r.pattern).toBeDefined()
  })

  it('distinct days < 7 → reliable=false even with totalMinutes >= 200', () => {
    const log = []
    for (let i = 0; i < 6; i++) {
      log.push({ date: addDays(TODAY, -i), zones: [40, 40, 5, 10, 5], type: 'run' })
    }
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.totalMinutes).toBeGreaterThanOrEqual(200)
    expect(r.reliable).toBe(false)
  })

  it('totalMinutes >= 200 AND distinct days >= 7 → reliable=true', () => {
    const log = makeLog(7, TODAY, [12, 12, 4, 1, 1]) // 7 * 30 = 210
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.totalMinutes).toBeGreaterThanOrEqual(200)
    expect(r.reliable).toBe(true)
  })
})

describe('detectTrainingPolarization — polarized fixture', () => {
  it('80% Z1+Z2, 15% Z4+Z5, 5% Z3 → polarized, positive PI', () => {
    const log = makeLog(28, TODAY, [40, 40, 5, 10, 5])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.pattern).toBe('polarized')
    expect(r.polarizationIndex).not.toBeNull()
    expect(r.polarizationIndex).toBeGreaterThan(0)
    expect(r.shares.Z1 + r.shares.Z2).toBeCloseTo(80, 1)
  })
})

describe('detectTrainingPolarization — pyramidal fixture', () => {
  it('60/25/10/4/1 strictly decreasing → pyramidal', () => {
    const log = makeLog(28, TODAY, [60, 25, 10, 4, 1])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.pattern).toBe('pyramidal')
    expect(r.message.en).toContain('Pyramidal')
    expect(r.recommendation.en).toContain('Z4/Z5')
  })
})

describe('detectTrainingPolarization — threshold fixture', () => {
  it('Z3 = 30% → threshold', () => {
    const log = makeLog(28, TODAY, [10, 30, 30, 20, 10])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.pattern).toBe('threshold')
    expect(r.shares.Z3).toBeCloseTo(30, 1)
    expect(r.message.en).toContain('Threshold')
    expect(r.recommendation.en).toContain("no-man's-land")
  })
})

describe('detectTrainingPolarization — mixed fixture', () => {
  it('no clear template → mixed', () => {
    const log = makeLog(28, TODAY, [5, 35, 20, 35, 5])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.pattern).toBe('mixed')
    expect(r.message.en).toContain('Mixed')
  })
})

describe('detectTrainingPolarization — classification priority', () => {
  it('threshold priority: Z3=27% beats pyramidal monotonic shape', () => {
    // [33, 33, 27, 4, 3] — Z3=27>25 triggers threshold; without that check
    // shape is monotonic-pyramidal (Z1=Z2≥Z3≥Z4≥Z5, all positive)
    const log = makeLog(28, TODAY, [33, 33, 27, 4, 3])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.shares.Z3).toBeCloseTo(27, 1)
    expect(r.pattern).toBe('threshold')
  })

  it('polarized priority: Z3=8, Z1+Z2=82, Z4+Z5=10 → polarized', () => {
    const log = makeLog(28, TODAY, [41, 41, 8, 7, 3])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.pattern).toBe('polarized')
  })

  it('polarized boundary: Z3=10 exact → not polarized (falls through to pyramidal)', () => {
    const log = makeLog(28, TODAY, [40, 40, 10, 7, 3])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.shares.Z3).toBeCloseTo(10, 1)
    expect(r.pattern).not.toBe('polarized')
    expect(r.pattern).toBe('pyramidal')
  })
})

describe('detectTrainingPolarization — polarizationIndex math', () => {
  it('Z1+Z2=80, Z4+Z5=20 → log10(4) ≈ 0.6', () => {
    const log = makeLog(28, TODAY, [40, 40, 0, 10, 10])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.shares.Z1 + r.shares.Z2).toBeCloseTo(80, 1)
    expect(r.shares.Z4 + r.shares.Z5).toBeCloseTo(20, 1)
    expect(r.polarizationIndex).toBeCloseTo(0.6, 1)
  })

  it('Z4+Z5 = 0 → polarizationIndex null', () => {
    const log = makeLog(28, TODAY, [50, 30, 10, 0, 0])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.shares.Z4 + r.shares.Z5).toBe(0)
    expect(r.polarizationIndex).toBeNull()
  })
})

describe('detectTrainingPolarization — windowDays override', () => {
  it('custom 84d window includes older entries', () => {
    const log = []
    // 14 entries 60d ago — outside default 28d, inside 84d
    for (let i = 0; i < 14; i++) {
      log.push({
        date: addDays(TODAY, -(60 + i)),
        zones: [40, 40, 5, 10, 5],
        type: 'run',
      })
    }
    const def = detectTrainingPolarization(log, TODAY) // 28d default
    const wide = detectTrainingPolarization(log, TODAY, 84)
    expect(def.totalMinutes).toBe(0)
    expect(wide.totalMinutes).toBeGreaterThan(0)
    expect(wide.windowDays).toBe(84)
  })

  it('windowDays defaults to 28 when not provided', () => {
    const r = detectTrainingPolarization([], TODAY)
    expect(r.windowDays).toBe(28)
  })
})

describe('detectTrainingPolarization — zone shape parsing', () => {
  it('array zone shape parses correctly', () => {
    const log = makeLog(28, TODAY, [40, 40, 5, 10, 5])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.totalMinutes).toBe(28 * 100)
  })

  it('object {Z1..Z5} zone shape parses correctly', () => {
    const log = []
    for (let i = 0; i < 28; i++) {
      log.push({
        date: addDays(TODAY, -i),
        zones: { Z1: 40, Z2: 40, Z3: 5, Z4: 10, Z5: 5 },
        type: 'run',
      })
    }
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.totalMinutes).toBe(28 * 100)
    expect(r.pattern).toBe('polarized')
  })

  it('lowercase {z1..z5} object shape parses', () => {
    const log = []
    for (let i = 0; i < 28; i++) {
      log.push({
        date: addDays(TODAY, -i),
        zones: { z1: 40, z2: 40, z3: 5, z4: 10, z5: 5 },
        type: 'run',
      })
    }
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.totalMinutes).toBe(28 * 100)
  })

  it('RPE fallback when no zones — rpe=4 buckets to Z2', () => {
    const log = []
    for (let i = 0; i < 28; i++) {
      log.push({ date: addDays(TODAY, -i), duration: 60, rpe: 4, type: 'run' })
    }
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.totalMinutes).toBe(28 * 60)
    expect(r.shares.Z2).toBeCloseTo(100, 1)
  })
})

describe('detectTrainingPolarization — date filtering & aggregation', () => {
  it('multiple entries on same date sum together', () => {
    const log = [
      { date: TODAY, zones: [20, 20, 0, 5, 5], type: 'run' },
      { date: TODAY, zones: [20, 20, 5, 5, 0], type: 'bike' },
    ]
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.totalMinutes).toBe(100)
    expect(r.shares.Z1).toBeCloseTo(40, 1)
  })

  it('out-of-window entries excluded', () => {
    const log = [
      { date: addDays(TODAY, -100), zones: [99, 99, 99, 99, 99], type: 'run' },
      { date: TODAY, zones: [40, 40, 5, 10, 5], type: 'run' },
    ]
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.totalMinutes).toBe(100)
  })
})

describe('detectTrainingPolarization — share rounding', () => {
  it('shares percentages sum to ~100 within rounding tolerance', () => {
    const log = makeLog(28, TODAY, [40, 40, 5, 10, 5])
    const r = detectTrainingPolarization(log, TODAY)
    const sum = r.shares.Z1 + r.shares.Z2 + r.shares.Z3 + r.shares.Z4 + r.shares.Z5
    expect(Math.abs(sum - 100)).toBeLessThan(0.5)
  })

  it('each share rounded to 1 decimal place', () => {
    const log = makeLog(28, TODAY, [37, 41, 8, 9, 5]) // odd splits
    const r = detectTrainingPolarization(log, TODAY)
    for (const k of ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']) {
      const v = r.shares[k]
      expect(Math.round(v * 10) / 10).toBe(v)
    }
  })
})

describe('detectTrainingPolarization — output contracts', () => {
  it('bilingual EN+TR present on message and recommendation', () => {
    const log = makeLog(28, TODAY, [60, 25, 10, 4, 1])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.message.en).toBeTruthy()
    expect(r.message.tr).toBeTruthy()
    expect(r.recommendation.en).toBeDefined()
    expect(r.recommendation.tr).toBeDefined()
  })

  it('citation present and matches export', () => {
    const log = makeLog(28, TODAY, [40, 40, 5, 10, 5])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.citation).toBe(TRAINING_POLARIZATION_CITATION)
    expect(r.citation).toContain('Esteve-Lanao')
  })

  it('options.today override produces deterministic output', () => {
    const log = makeLog(28, TODAY, [40, 40, 5, 10, 5])
    const a = detectTrainingPolarization(log, TODAY)
    const b = detectTrainingPolarization(log, TODAY)
    expect(a).toEqual(b)
  })

  it('polarized recommendation is empty (already optimal)', () => {
    const log = makeLog(28, TODAY, [40, 40, 5, 10, 5])
    const r = detectTrainingPolarization(log, TODAY)
    expect(r.pattern).toBe('polarized')
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })
})
