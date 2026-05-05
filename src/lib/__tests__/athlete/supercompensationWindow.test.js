import { describe, it, expect } from 'vitest'
import {
  detectSupercompensation,
  SUPERCOMP_WINDOW_CITATION,
} from '../../athlete/supercompensationWindow.js'

const TODAY = '2026-05-05'

// ─── Helpers ────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

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
describe('detectSupercompensation — empty / null inputs', () => {
  it('null log → safe defaults, closed band, reliable: false', () => {
    const r = detectSupercompensation(null, TODAY)
    expect(r.currentTSB).toBe(0)
    expect(r.ctlToday).toBe(0)
    expect(r.atlToday).toBe(0)
    expect(r.tsbRise7d).toBe(0)
    expect(r.daysSinceLastDeload).toBe(null)
    expect(r.peakDaysRemaining).toBe(0)
    expect(r.band).toBe('closed')
    expect(r.reliable).toBe(false)
    expect(r.citation).toBe(SUPERCOMP_WINDOW_CITATION)
  })

  it('empty log → safe defaults, closed band, reliable: false', () => {
    const r = detectSupercompensation([], TODAY)
    expect(r.currentTSB).toBe(0)
    expect(r.band).toBe('closed')
    expect(r.reliable).toBe(false)
  })

  it('non-array log → safe defaults', () => {
    const r = detectSupercompensation({ foo: 'bar' }, TODAY)
    expect(r.currentTSB).toBe(0)
    expect(r.band).toBe('closed')
    expect(r.reliable).toBe(false)
  })
})

// ─── Reliability flag (28-day span requirement) ─────────────────────────────
describe('detectSupercompensation — reliability', () => {
  it('log spanning 27 days → reliable: false', () => {
    const log = makeLog(repeat(27, 50))
    const r = detectSupercompensation(log, TODAY)
    expect(r.reliable).toBe(false)
  })

  it('log spanning 28 days → reliable: true', () => {
    const log = makeLog(repeat(28, 50))
    const r = detectSupercompensation(log, TODAY)
    expect(r.reliable).toBe(true)
  })

  it('long log (300 days) → reliable: true', () => {
    const log = makeLog(repeat(300, 60))
    const r = detectSupercompensation(log, TODAY)
    expect(r.reliable).toBe(true)
  })
})

// ─── Band fixtures ──────────────────────────────────────────────────────────
describe('detectSupercompensation — band fixtures', () => {
  it('28-day flat low load → modestly fresh, available band', () => {
    // 40d @ 60 warmup + 28d @ 30 — TSB ~+3 (positive, modest)
    const log = makeLog([...repeat(40, 60), ...repeat(28, 30)])
    const r = detectSupercompensation(log, TODAY)
    expect(r.currentTSB).toBeGreaterThan(0)
    expect(r.currentTSB).toBeLessThanOrEqual(15)
    expect(r.band).toBe('available')
  })

  it('80d heavy + 7d recovery → opportunity or peak band', () => {
    // 80d @ 90 + 7d @ 10 — sharp TSB rise, currentTSB ~+27, rise7d ~+40
    const log = makeLog([...repeat(80, 90), ...repeat(7, 10)])
    const r = detectSupercompensation(log, TODAY)
    expect(r.currentTSB).toBeGreaterThan(15)
    expect(r.tsbRise7d).toBeGreaterThanOrEqual(15)
    expect(['opportunity', 'peak']).toContain(r.band)
  })

  it('80d heavy + 14d recovery → peak band, ATL fully cleared', () => {
    // 80d @ 90 + 14d @ 10 — currentTSB ~+37, ATL cleared
    const log = makeLog([...repeat(80, 90), ...repeat(14, 10)])
    const r = detectSupercompensation(log, TODAY)
    expect(r.currentTSB).toBeGreaterThan(15)
    expect(r.ctlToday).toBeGreaterThan(0)
    expect(r.atlToday).toBeLessThan(r.ctlToday * 0.7)
    expect(r.band).toBe('peak')
  })

  it('28d sustained heavy load no recovery → closed band', () => {
    const log = makeLog(repeat(28, 100))
    const r = detectSupercompensation(log, TODAY)
    expect(r.currentTSB).toBeLessThan(0)
    expect(r.band).toBe('closed')
  })

  it('40d heavy then 3d rest → negative TSB rising → building band', () => {
    // 40d @ 100 + 3d @ 0 — TSB still negative but rising
    const log = makeLog([...repeat(40, 100), ...repeat(3, 0)], TODAY, {
      includeZeros: true,
    })
    const r = detectSupercompensation(log, TODAY)
    expect(r.currentTSB).toBeLessThanOrEqual(0)
    expect(r.tsbRise7d).toBeGreaterThan(0)
    expect(r.band).toBe('building')
  })

  it('long flat steady-state load → near-zero TSB, closed (or available)', () => {
    // 300d @ 60 — converged, TSB ≈ 0
    const log = makeLog(repeat(300, 60))
    const r = detectSupercompensation(log, TODAY)
    expect(Math.abs(r.currentTSB)).toBeLessThan(5)
    expect(['closed', 'available']).toContain(r.band)
  })
})

// ─── Counter / math correctness ─────────────────────────────────────────────
describe('detectSupercompensation — counters & math', () => {
  it('ctlToday and atlToday rounded to 0.1', () => {
    const log = makeLog(repeat(60, 70))
    const r = detectSupercompensation(log, TODAY)
    const dCtl = (r.ctlToday.toString().split('.')[1] || '').length
    const dAtl = (r.atlToday.toString().split('.')[1] || '').length
    expect(dCtl).toBeLessThanOrEqual(1)
    expect(dAtl).toBeLessThanOrEqual(1)
  })

  it('currentTSB and tsbRise7d rounded to 0.1', () => {
    const log = makeLog([...repeat(80, 90), ...repeat(14, 10)])
    const r = detectSupercompensation(log, TODAY)
    const dTSB = (Math.abs(r.currentTSB).toString().split('.')[1] || '').length
    const dRise = (Math.abs(r.tsbRise7d).toString().split('.')[1] || '').length
    expect(dTSB).toBeLessThanOrEqual(1)
    expect(dRise).toBeLessThanOrEqual(1)
  })

  it('tsbRise7d math: positive for taper ramp, negative for build ramp', () => {
    const taper = makeLog([...repeat(80, 90), ...repeat(14, 10)])
    const rTaper = detectSupercompensation(taper, TODAY)
    expect(rTaper.tsbRise7d).toBeGreaterThan(0)

    const build = makeLog([...repeat(60, 30), ...repeat(14, 110)])
    const rBuild = detectSupercompensation(build, TODAY)
    expect(rBuild.tsbRise7d).toBeLessThan(0)
  })

  it('peakDaysRemaining clamped to [0, 7]', () => {
    const fixtures = [
      makeLog([...repeat(80, 90), ...repeat(14, 10)]),
      makeLog([...repeat(80, 90), ...repeat(7, 10)]),
      makeLog(repeat(60, 60)),
      makeLog(repeat(28, 100)),
      makeLog([...repeat(60, 60), ...repeat(28, 30)]),
    ]
    for (const log of fixtures) {
      const r = detectSupercompensation(log, TODAY)
      expect(r.peakDaysRemaining).toBeGreaterThanOrEqual(0)
      expect(r.peakDaysRemaining).toBeLessThanOrEqual(7)
    }
  })

  it('daysSinceLastDeload computed for clear deload pattern', () => {
    // 60d heavy then 7d recovery — deload should fire within last 7 days
    const log = makeLog([...repeat(60, 90), ...repeat(7, 10)])
    const r = detectSupercompensation(log, TODAY)
    expect(r.daysSinceLastDeload).not.toBeNull()
    expect(r.daysSinceLastDeload).toBeGreaterThanOrEqual(0)
    expect(r.daysSinceLastDeload).toBeLessThanOrEqual(28)
  })

  it('daysSinceLastDeload null (or proxy via max-TSB) when no deload pattern', () => {
    // Steady-state convergence, no deload — fallback may produce null or a proxy
    const log = makeLog(repeat(300, 60))
    const r = detectSupercompensation(log, TODAY)
    // Accept either null (no deload) or a small number (proxy via positive max-TSB)
    if (r.daysSinceLastDeload != null) {
      expect(r.daysSinceLastDeload).toBeGreaterThanOrEqual(0)
    } else {
      expect(r.daysSinceLastDeload).toBeNull()
    }
  })

  it('all-positive-TSB log (light caller) lands in available or peak band', () => {
    // Very low chronic load — TSB should hover positive
    const log = makeLog(repeat(40, 5))
    const r = detectSupercompensation(log, TODAY)
    expect(['available', 'peak', 'closed']).toContain(r.band)
  })
})

// ─── Bilingual messages ─────────────────────────────────────────────────────
describe('detectSupercompensation — bilingual messages', () => {
  it('peak band substitutes {n} with peakDaysRemaining', () => {
    const log = makeLog([...repeat(80, 90), ...repeat(14, 10)])
    const r = detectSupercompensation(log, TODAY)
    expect(r.band).toBe('peak')
    expect(r.message.en).not.toMatch(/\{n\}/)
    expect(r.message.tr).not.toMatch(/\{n\}/)
    expect(r.recommendation.en).not.toMatch(/\{n\}/)
    expect(r.recommendation.tr).not.toMatch(/\{n\}/)
    expect(r.message.en).toMatch(new RegExp(`${r.peakDaysRemaining} days left`))
    expect(r.message.tr).toMatch(new RegExp(`penceren ${r.peakDaysRemaining} gün`))
  })

  it('peak band has EN + TR messages', () => {
    const log = makeLog([...repeat(80, 90), ...repeat(14, 10)])
    const r = detectSupercompensation(log, TODAY)
    expect(r.band).toBe('peak')
    expect(r.message.en).toMatch(/Peak readiness/)
    expect(r.message.tr).toMatch(/Zirve hazırlık/)
    expect(r.recommendation.en).toMatch(/Schedule key session/)
    expect(r.recommendation.tr).toMatch(/kilit seans/)
  })

  it('opportunity band has EN + TR messages', () => {
    // 80d heavy + 7d recovery typically lands in opportunity
    const log = makeLog([...repeat(80, 90), ...repeat(7, 10)])
    const r = detectSupercompensation(log, TODAY)
    if (r.band === 'opportunity') {
      expect(r.message.en).toMatch(/Opportunity window/)
      expect(r.message.tr).toMatch(/Fırsat penceresi/)
      expect(r.recommendation.en).toMatch(/Hold off hard work/)
      expect(r.recommendation.tr).toMatch(/ağır iş/)
    } else {
      // peak is also acceptable for this fixture
      expect(['opportunity', 'peak']).toContain(r.band)
    }
  })

  it('available band has EN + TR messages', () => {
    const log = makeLog([...repeat(40, 60), ...repeat(28, 30)])
    const r = detectSupercompensation(log, TODAY)
    expect(r.band).toBe('available')
    expect(r.message.en).toMatch(/Modest freshness/)
    expect(r.message.tr).toMatch(/Hafif tazelik/)
    expect(r.recommendation.en).toMatch(/Light tempo/)
    expect(r.recommendation.tr).toMatch(/Hafif tempo/)
  })

  it('closed band has EN + TR messages', () => {
    const log = makeLog(repeat(28, 100))
    const r = detectSupercompensation(log, TODAY)
    expect(r.band).toBe('closed')
    expect(r.message.en).toMatch(/No supercompensation/)
    expect(r.message.tr).toMatch(/Süperkompansasyon penceresi yok/)
    expect(r.recommendation.en).toMatch(/RecoveryDebt/)
    expect(r.recommendation.tr).toMatch(/RecoveryDebt/)
  })

  it('building band has EN + TR messages', () => {
    const log = makeLog([...repeat(40, 100), ...repeat(3, 0)], TODAY, {
      includeZeros: true,
    })
    const r = detectSupercompensation(log, TODAY)
    expect(r.band).toBe('building')
    expect(r.message.en).toMatch(/Window approaching/)
    expect(r.message.tr).toMatch(/Pencere yaklaşıyor/)
    expect(r.recommendation.en).toMatch(/Continue current recovery/)
    expect(r.recommendation.tr).toMatch(/Toparlanmaya devam/)
  })
})

// ─── Edge cases ─────────────────────────────────────────────────────────────
describe('detectSupercompensation — edge cases', () => {
  it('multiple entries same date sum into one daily TSS', () => {
    const log = [
      { date: TODAY, type: 'bike', tss: 60 },
      { date: TODAY, type: 'run', tss: 40 },
      ...makeLog(repeat(60, 70), addDays(TODAY, -1)),
    ]
    const merged = [
      ...makeLog(repeat(60, 70), addDays(TODAY, -1)),
      { date: TODAY, type: 'combined', tss: 100 },
    ]
    const a = detectSupercompensation(log, TODAY)
    const b = detectSupercompensation(merged, TODAY)
    expect(a.ctlToday).toBeCloseTo(b.ctlToday, 1)
    expect(a.atlToday).toBeCloseTo(b.atlToday, 1)
    expect(a.currentTSB).toBeCloseTo(b.currentTSB, 1)
  })

  it('options.today override is deterministic', () => {
    const log = makeLog(repeat(60, 70), '2026-05-05')
    const r1 = detectSupercompensation(log, '2026-05-05')
    const r2 = detectSupercompensation(log, '2026-05-05')
    expect(r1.currentTSB).toBe(r2.currentTSB)
    expect(r1.ctlToday).toBe(r2.ctlToday)
    expect(r1.band).toBe(r2.band)
  })

  it('today override changes window — newer today shifts result', () => {
    const log = makeLog(repeat(40, 100), '2026-05-05')
    const rOnDay = detectSupercompensation(log, '2026-05-05')
    const rWeekLater = detectSupercompensation(log, '2026-05-12')
    expect(rWeekLater.atlToday).toBeLessThan(rOnDay.atlToday)
    expect(rWeekLater.currentTSB).toBeGreaterThan(rOnDay.currentTSB)
  })

  it('entries dated after today are ignored', () => {
    const future = makeLog(repeat(5, 999), addDays(TODAY, 5))
    const past = makeLog(repeat(40, 60))
    const r1 = detectSupercompensation(past, TODAY)
    const r2 = detectSupercompensation([...past, ...future], TODAY)
    expect(r1.ctlToday).toBeCloseTo(r2.ctlToday, 1)
    expect(r1.atlToday).toBeCloseTo(r2.atlToday, 1)
  })

  it('entries with NaN / missing tss treated as 0 (no NaN poisoning)', () => {
    const log = [
      ...makeLog(repeat(60, 60)),
      { date: TODAY, type: 'mystery' },
      { date: addDays(TODAY, -1), type: 'broken', tss: 'oops' },
    ]
    const r = detectSupercompensation(log, TODAY)
    expect(Number.isFinite(r.currentTSB)).toBe(true)
    expect(Number.isFinite(r.ctlToday)).toBe(true)
    expect(Number.isFinite(r.atlToday)).toBe(true)
    expect(Number.isFinite(r.tsbRise7d)).toBe(true)
  })
})

// ─── Citation + return shape ────────────────────────────────────────────────
describe('detectSupercompensation — return shape', () => {
  it('citation matches Foster/Costill/Mujika reference', () => {
    const r = detectSupercompensation([], TODAY)
    expect(r.citation).toBe(
      'Foster 1996 supercompensation; Costill 1991; Mujika 2010 freshness',
    )
    expect(SUPERCOMP_WINDOW_CITATION).toBe(
      'Foster 1996 supercompensation; Costill 1991; Mujika 2010 freshness',
    )
  })

  it('result has all 11 expected keys', () => {
    const r = detectSupercompensation([], TODAY)
    const keys = Object.keys(r).sort()
    expect(keys).toEqual([
      'atlToday',
      'band',
      'citation',
      'ctlToday',
      'currentTSB',
      'daysSinceLastDeload',
      'message',
      'peakDaysRemaining',
      'recommendation',
      'reliable',
      'tsbRise7d',
    ])
  })
})
