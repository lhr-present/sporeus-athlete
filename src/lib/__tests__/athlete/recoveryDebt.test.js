import { describe, it, expect } from 'vitest'
import {
  detectRecoveryDebt,
  RECOVERY_DEBT_CITATION,
} from '../../athlete/recoveryDebt.js'

const TODAY = '2026-05-05'

// ─── Helpers ────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build a log from an array of daily TSS values, oldest-first, ending on `endDate`.
 * tssValues[last] = endDate; tssValues[0] = endDate - (length-1) days.
 * Days with TSS = 0 are omitted (rest days, no entry) unless `includeZeros`.
 */
function makeLog(tssValues, endDate = TODAY, { includeZeros = false } = {}) {
  const log = []
  for (let i = 0; i < tssValues.length; i++) {
    const v = tssValues[i]
    if (v > 0 || includeZeros) {
      log.push({ date: addDays(endDate, -(tssValues.length - 1 - i)), type: 'run', tss: v })
    }
  }
  return log
}

function repeat(n, v) {
  return Array.from({ length: n }, () => v)
}

// ─── Empty / null inputs ────────────────────────────────────────────────────
describe('detectRecoveryDebt — empty / null inputs', () => {
  it('null log → safe defaults, fresh band, reliable: false', () => {
    const r = detectRecoveryDebt(null, TODAY)
    expect(r.currentTSB).toBe(0)
    expect(r.ctlToday).toBe(0)
    expect(r.atlToday).toBe(0)
    expect(r.cumulativeDeficit).toBe(0)
    expect(r.debtDays).toBe(0)
    expect(r.maxConsecutiveNegativeDays).toBe(0)
    expect(r.band).toBe('fresh')
    expect(r.reliable).toBe(false)
    expect(r.citation).toBe(RECOVERY_DEBT_CITATION)
  })

  it('empty log → safe defaults, fresh band, reliable: false', () => {
    const r = detectRecoveryDebt([], TODAY)
    expect(r.currentTSB).toBe(0)
    expect(r.cumulativeDeficit).toBe(0)
    expect(r.band).toBe('fresh')
    expect(r.reliable).toBe(false)
  })

  it('non-array log (object) → safe defaults', () => {
    const r = detectRecoveryDebt({ foo: 'bar' }, TODAY)
    expect(r.currentTSB).toBe(0)
    expect(r.band).toBe('fresh')
    expect(r.reliable).toBe(false)
  })
})

// ─── Reliability flag (28-day span requirement) ─────────────────────────────
describe('detectRecoveryDebt — reliability', () => {
  it('log spanning 27 days → reliable: false', () => {
    const log = makeLog(repeat(27, 50))
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.reliable).toBe(false)
  })

  it('log spanning 28 days → reliable: true', () => {
    const log = makeLog(repeat(28, 50))
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.reliable).toBe(true)
  })

  it('long log (300 days) → reliable: true', () => {
    const log = makeLog(repeat(300, 60))
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.reliable).toBe(true)
  })
})

// ─── Band fixtures ──────────────────────────────────────────────────────────
describe('detectRecoveryDebt — band fixtures', () => {
  it('long warm-up + taper → fresh band, positive TSB', () => {
    // 100d @ 70 then 28d @ 15 — well-rested taper
    const log = makeLog([...repeat(100, 70), ...repeat(28, 15)])
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.currentTSB).toBeGreaterThan(0)
    expect(r.cumulativeDeficit).toBeLessThan(50)
    expect(r.band).toBe('fresh')
  })

  it('fully-converged steady load → maintaining band, near-zero TSB', () => {
    // 300d @ 60 — steady state, TSB ≈ 0
    const log = makeLog(repeat(300, 60))
    const r = detectRecoveryDebt(log, TODAY)
    expect(Math.abs(r.currentTSB)).toBeLessThan(5)
    expect(r.cumulativeDeficit).toBeLessThan(150)
    expect(r.band).toBe('maintaining')
  })

  it('warm-up + small spike → building band, moderate negative TSB', () => {
    // 120d @ 60 + 5d @ 110 — TSB ~-23, cumDef ~187
    const log = makeLog([...repeat(120, 60), ...repeat(5, 110)])
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.currentTSB).toBeLessThan(-10)
    expect(r.currentTSB).toBeGreaterThan(-25)
    expect(r.cumulativeDeficit).toBeLessThan(250)
    expect(r.band).toBe('building')
  })

  it('warm-up + large spike → fatigued band', () => {
    // 120d @ 60 + 8d @ 130 — TSB ~-38, cumDef ~305, maxRun=8
    const log = makeLog([...repeat(120, 60), ...repeat(8, 130)])
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.currentTSB).toBeLessThanOrEqual(-25)
    expect(r.cumulativeDeficit).toBeGreaterThanOrEqual(250)
    expect(r.cumulativeDeficit).toBeLessThan(400)
    expect(r.maxConsecutiveNegativeDays).toBeLessThan(14)
    expect(r.band).toBe('fatigued')
  })

  it('sustained heavy load → overreached band (cumDef and maxRun exceed)', () => {
    // 28d @ 120 — TSB highly negative, cumDef ≫ 400, maxRun = 28
    const log = makeLog(repeat(28, 120))
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.cumulativeDeficit).toBeGreaterThanOrEqual(400)
    expect(r.maxConsecutiveNegativeDays).toBeGreaterThanOrEqual(14)
    expect(r.band).toBe('overreached')
  })

  it('28d sustained heavy block (long warm-up) → overreached via maxRun', () => {
    // 60d @ 60 + 14d @ 110 — moderate TSB but full 14-day run
    const log = makeLog([...repeat(60, 60), ...repeat(14, 110)])
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.maxConsecutiveNegativeDays).toBeGreaterThanOrEqual(14)
    expect(r.band).toBe('overreached')
  })

  it('28 days TSS=50 then 14 days TSS=120 → strongly negative TSB, overreached or fatigued', () => {
    const log = makeLog([...repeat(28, 50), ...repeat(14, 120)])
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.currentTSB).toBeLessThan(-25)
    expect(['fatigued', 'overreached']).toContain(r.band)
  })
})

// ─── Counter math ───────────────────────────────────────────────────────────
describe('detectRecoveryDebt — counters', () => {
  it('cumulativeDeficit accumulates only negative-TSB days, not positive', () => {
    // Long warm-up + taper means most of last 28 days have positive TSB → low deficit
    const log = makeLog([...repeat(100, 70), ...repeat(28, 15)])
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.currentTSB).toBeGreaterThan(0)
    expect(r.cumulativeDeficit).toBeLessThan(10)
  })

  it('debtDays counts only days with TSB < -10', () => {
    // Steady state TSB ≈ 0 → no debtDays
    const log = makeLog(repeat(300, 60))
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.debtDays).toBe(0)
  })

  it('maxConsecutiveNegativeDays counts longest run of TSB < -10', () => {
    // Long warm-up then 7 hard days → run of ~7
    const log = makeLog([...repeat(120, 60), ...repeat(7, 130)])
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.maxConsecutiveNegativeDays).toBeGreaterThanOrEqual(5)
    expect(r.maxConsecutiveNegativeDays).toBeLessThanOrEqual(8)
  })

  it('debtDays equals maxConsecutiveNegativeDays for unbroken run', () => {
    const log = makeLog(repeat(28, 120))
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.debtDays).toBe(r.maxConsecutiveNegativeDays)
  })
})

// ─── Rounding ───────────────────────────────────────────────────────────────
describe('detectRecoveryDebt — rounding', () => {
  it('currentTSB rounded to 0.1', () => {
    const log = makeLog(repeat(60, 50))
    const r = detectRecoveryDebt(log, TODAY)
    const decimals = (Math.abs(r.currentTSB).toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(1)
  })

  it('ctlToday and atlToday rounded to 0.1', () => {
    const log = makeLog(repeat(60, 70))
    const r = detectRecoveryDebt(log, TODAY)
    const dCtl = (r.ctlToday.toString().split('.')[1] || '').length
    const dAtl = (r.atlToday.toString().split('.')[1] || '').length
    expect(dCtl).toBeLessThanOrEqual(1)
    expect(dAtl).toBeLessThanOrEqual(1)
  })

  it('cumulativeDeficit is an integer', () => {
    const log = makeLog([...repeat(120, 60), ...repeat(7, 130)])
    const r = detectRecoveryDebt(log, TODAY)
    expect(Number.isInteger(r.cumulativeDeficit)).toBe(true)
  })
})

// ─── Edge cases ─────────────────────────────────────────────────────────────
describe('detectRecoveryDebt — edge cases', () => {
  it('multiple entries on the same date sum into one daily TSS', () => {
    const log = [
      { date: TODAY, type: 'bike', tss: 60 },
      { date: TODAY, type: 'run', tss: 40 },
      ...makeLog(repeat(60, 70), addDays(TODAY, -1)),
    ]
    const merged = [
      ...makeLog(repeat(60, 70), addDays(TODAY, -1)),
      { date: TODAY, type: 'combined', tss: 100 },
    ]
    const a = detectRecoveryDebt(log, TODAY)
    const b = detectRecoveryDebt(merged, TODAY)
    expect(a.ctlToday).toBeCloseTo(b.ctlToday, 1)
    expect(a.atlToday).toBeCloseTo(b.atlToday, 1)
    expect(a.currentTSB).toBeCloseTo(b.currentTSB, 1)
  })

  it('entries with no tss / NaN tss are treated as 0 (do not NaN the EWMA)', () => {
    const log = [
      ...makeLog(repeat(60, 60)),
      { date: TODAY, type: 'mystery' }, // no tss
      { date: addDays(TODAY, -1), type: 'broken', tss: 'oops' }, // NaN
    ]
    const r = detectRecoveryDebt(log, TODAY)
    expect(Number.isFinite(r.currentTSB)).toBe(true)
    expect(Number.isFinite(r.ctlToday)).toBe(true)
    expect(Number.isFinite(r.atlToday)).toBe(true)
  })

  it('options.today override is deterministic', () => {
    const log = makeLog(repeat(60, 70), '2026-05-05')
    const r1 = detectRecoveryDebt(log, '2026-05-05')
    const r2 = detectRecoveryDebt(log, '2026-05-05')
    expect(r1.currentTSB).toBe(r2.currentTSB)
    expect(r1.ctlToday).toBe(r2.ctlToday)
  })

  it('today override changes window — newer today shifts result', () => {
    // Same log, different "today" reference
    const log = makeLog(repeat(40, 100), '2026-05-05')
    const rOnDay = detectRecoveryDebt(log, '2026-05-05')
    const rWeekLater = detectRecoveryDebt(log, '2026-05-12')
    expect(rWeekLater.atlToday).toBeLessThan(rOnDay.atlToday) // ATL decays faster
  })

  it('entries dated after today are ignored', () => {
    const future = makeLog(repeat(5, 999), addDays(TODAY, 5))
    const past = makeLog(repeat(40, 60))
    const r1 = detectRecoveryDebt(past, TODAY)
    const r2 = detectRecoveryDebt([...past, ...future], TODAY)
    expect(r1.ctlToday).toBeCloseTo(r2.ctlToday, 1)
    expect(r1.atlToday).toBeCloseTo(r2.atlToday, 1)
  })

  it('pre-window entries warm up CTL — day-28 CTL > day-1 CTL on a 56-day fixture', () => {
    // Compare: 28-day log ending today vs same load 28 days earlier ending in window
    // Slice the same constant load into "early" and "late" halves and verify CTL grows
    const earlyLog = makeLog(repeat(28, 80), addDays(TODAY, -28))
    const fullLog = makeLog(repeat(56, 80))
    const rEarly = detectRecoveryDebt(earlyLog, addDays(TODAY, -28)) // CTL after first 28 days
    const rFull = detectRecoveryDebt(fullLog, TODAY) // CTL after full 56 days
    // CTL after 56 days of constant load is meaningfully higher than after 28
    expect(rFull.ctlToday).toBeGreaterThan(rEarly.ctlToday + 10)
  })
})

// ─── Bilingual messages ─────────────────────────────────────────────────────
describe('detectRecoveryDebt — bilingual messages', () => {
  it('fresh band has EN + TR messages, empty recommendation', () => {
    const log = makeLog([...repeat(100, 70), ...repeat(28, 15)])
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.band).toBe('fresh')
    expect(r.message.en).toMatch(/Fresh/)
    expect(r.message.tr).toMatch(/Taze/)
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })

  it('maintaining band has EN + TR messages, empty recommendation', () => {
    const log = makeLog(repeat(300, 60))
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.band).toBe('maintaining')
    expect(r.message.en).toMatch(/Balanced/)
    expect(r.message.tr).toMatch(/Dengeli/)
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })

  it('building band has EN + TR messages and recommendation', () => {
    const log = makeLog([...repeat(120, 60), ...repeat(5, 110)])
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.band).toBe('building')
    expect(r.message.en).toMatch(/Building fatigue/)
    expect(r.message.tr).toMatch(/Yorgunluk/)
    expect(r.recommendation.en).toMatch(/recovery/i)
    expect(r.recommendation.tr).toMatch(/toparlanma/)
  })

  it('fatigued band has EN + TR recommendation', () => {
    const log = makeLog([...repeat(120, 60), ...repeat(8, 130)])
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.band).toBe('fatigued')
    expect(r.message.en).toMatch(/Fatigued/)
    expect(r.message.tr).toMatch(/Yorgun/)
    expect(r.recommendation.en).toMatch(/easy days/i)
    expect(r.recommendation.tr).toMatch(/kolay gün/)
  })

  it('overreached band has EN + TR recommendation', () => {
    const log = makeLog(repeat(28, 120))
    const r = detectRecoveryDebt(log, TODAY)
    expect(r.band).toBe('overreached')
    expect(r.message.en).toMatch(/Recovery debt/)
    expect(r.message.tr).toMatch(/Toparlanma borcu/)
    expect(r.recommendation.en).toMatch(/recovery block/i)
    expect(r.recommendation.tr).toMatch(/toparlanma bloğu/)
  })
})

// ─── Citation + return shape ────────────────────────────────────────────────
describe('detectRecoveryDebt — return shape', () => {
  it('citation is "Banister 1991; Coggan PMC; Halson 2014 overreaching"', () => {
    const r = detectRecoveryDebt([], TODAY)
    expect(r.citation).toBe('Banister 1991; Coggan PMC; Halson 2014 overreaching')
    expect(RECOVERY_DEBT_CITATION).toBe('Banister 1991; Coggan PMC; Halson 2014 overreaching')
  })

  it('result has all 11 expected keys', () => {
    const r = detectRecoveryDebt([], TODAY)
    const keys = Object.keys(r).sort()
    expect(keys).toEqual([
      'atlToday',
      'band',
      'citation',
      'ctlToday',
      'cumulativeDeficit',
      'currentTSB',
      'debtDays',
      'maxConsecutiveNegativeDays',
      'message',
      'recommendation',
      'reliable',
    ])
  })
})
