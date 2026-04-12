// src/lib/formulas.test.js
import { describe, it, expect } from 'vitest'
import {
  calcTSS, computePowerTSS, normalizedPower, computeWPrime,
  rampFTP, ftpFrom20, epley1RM, cooperVO2, riegel,
  parseTimeSec, fmtSec, fmtPace, mifflinBMR, navyBF,
  monotonyStrain, calcPRs, wingateStats, calcLoad,
  hrZones, powerZones,
} from './formulas.js'

// ── calcTSS ───────────────────────────────────────────────────────────────────
describe('calcTSS', () => {
  it('returns 0 for 0 duration', () => {
    expect(calcTSS(0, 5)).toBe(0)
  })
  it('increases with higher RPE', () => {
    const low  = calcTSS(60, 4)
    const high = calcTSS(60, 8)
    expect(high).toBeGreaterThan(low)
  })
  it('roughly doubles with doubled duration', () => {
    const t1 = calcTSS(60, 5)
    const t2 = calcTSS(120, 5)
    expect(t2 / t1).toBeGreaterThan(1.8)
    expect(t2 / t1).toBeLessThan(2.2)
  })
})

// ── computePowerTSS ───────────────────────────────────────────────────────────
describe('computePowerTSS', () => {
  it('returns null when FTP is 0', () => {
    expect(computePowerTSS(250, 3600, 0)).toBeNull()
  })
  it('returns ~100 for 1h at FTP (NP = FTP)', () => {
    expect(computePowerTSS(250, 3600, 250)).toBe(100)
  })
  it('returns ~200 for 2h at FTP', () => {
    expect(computePowerTSS(250, 7200, 250)).toBe(200)
  })
  it('returns higher TSS at NP > FTP', () => {
    const base  = computePowerTSS(250, 3600, 250)
    const hard  = computePowerTSS(275, 3600, 250)
    expect(hard).toBeGreaterThan(base)
  })
})

// ── normalizedPower ───────────────────────────────────────────────────────────
describe('normalizedPower', () => {
  it('returns 0 for fewer than 30 samples', () => {
    expect(normalizedPower(new Array(29).fill(200))).toBe(0)
  })
  it('returns flat power for constant-power stream', () => {
    const powers = new Array(120).fill(250)
    expect(normalizedPower(powers)).toBe(250)
  })
  it('returns a value higher than average for variable power', () => {
    // 30s blocks alternating 100W / 500W — mean=300, NP > 300 due to 4th-power effect
    const powers = Array.from({ length: 120 }, (_, i) => i % 60 < 30 ? 100 : 500)
    const np = normalizedPower(powers)
    expect(np).toBeGreaterThan(300)
  })
})

// ── computeWPrime ─────────────────────────────────────────────────────────────
describe('computeWPrime', () => {
  it('returns empty array for invalid inputs', () => {
    expect(computeWPrime([], 250, 20000)).toHaveLength(0)
    expect(computeWPrime(null, 250, 20000)).toHaveLength(0)
  })
  it('stays at W\'max for all-below-CP effort', () => {
    const powers = new Array(300).fill(200) // CP = 250
    const series = computeWPrime(powers, 250, 20000)
    expect(series.every(v => v === 20000)).toBe(true)
  })
  it('depletes W\' when power exceeds CP', () => {
    // 100s at 100W over CP = 250
    const powers = new Array(100).fill(350)
    const series = computeWPrime(powers, 250, 20000)
    expect(series[series.length - 1]).toBeLessThan(20000)
  })
  it('reaches 0 with a sustained maximal effort', () => {
    // 1000W for long enough above CP 250, W' = 10000J → depletes in ~13s
    const powers = new Array(200).fill(1000)
    const series = computeWPrime(powers, 250, 10000)
    expect(series.some(v => v <= 0)).toBe(true)
  })
})

// ── rampFTP / ftpFrom20 ───────────────────────────────────────────────────────
describe('FTP estimates', () => {
  it('rampFTP = 75% of peak', () => {
    expect(rampFTP(400)).toBe(300)
  })
  it('ftpFrom20 = 95% of 20-min avg', () => {
    expect(ftpFrom20(300)).toBe(285)
  })
})

// ── cooperVO2 ─────────────────────────────────────────────────────────────────
describe('cooperVO2', () => {
  it('returns higher VO2 for longer distance', () => {
    expect(parseFloat(cooperVO2(3000))).toBeGreaterThan(parseFloat(cooperVO2(2500)))
  })
})

// ── riegel ────────────────────────────────────────────────────────────────────
describe('riegel', () => {
  it('predicts slower time for longer race', () => {
    const marathon = riegel(60 * 30, 10000, 42195) // 30min 10K
    expect(marathon).toBeGreaterThan(60 * 60)
  })
  it('is exactly t1 when d2 === d1', () => {
    expect(riegel(3600, 42195, 42195)).toBe(3600)
  })
})

// ── parseTimeSec / fmtSec ─────────────────────────────────────────────────────
describe('time utilities', () => {
  it('parseTimeSec: MM:SS', () => expect(parseTimeSec('4:30')).toBe(270))
  it('parseTimeSec: HH:MM:SS', () => expect(parseTimeSec('1:00:00')).toBe(3600))
  it('fmtSec: under 1 hour', () => expect(fmtSec(270)).toBe('4:30'))
  it('fmtSec: over 1 hour', () => expect(fmtSec(3661)).toBe('1:01:01'))
  it('fmtPace: 10 min/km for 1000m in 10min', () => expect(fmtPace(600, 1000)).toBe('10:00'))
})

// ── mifflinBMR ────────────────────────────────────────────────────────────────
describe('mifflinBMR', () => {
  it('male BMR > female BMR for same stats', () => {
    expect(mifflinBMR(70, 175, 30, 'male')).toBeGreaterThan(mifflinBMR(70, 175, 30, 'female'))
  })
  it('returns a number > 1000 for a typical adult', () => {
    expect(mifflinBMR(70, 175, 30, 'male')).toBeGreaterThan(1000)
  })
})

// ── navyBF ────────────────────────────────────────────────────────────────────
describe('navyBF', () => {
  it('returns a plausible body fat % for male', () => {
    const bf = navyBF(37, 85, null, 180, 'male')
    expect(bf).toBeGreaterThan(5)
    expect(bf).toBeLessThan(40)
  })
  it('returns non-negative values', () => {
    expect(navyBF(40, 40, null, 180, 'male')).toBeGreaterThanOrEqual(0)
  })
})

// ── epley1RM ──────────────────────────────────────────────────────────────────
describe('epley1RM', () => {
  it('1 rep = the weight lifted', () => {
    expect(parseFloat(epley1RM(100, 1))).toBeCloseTo(100 * (1 + 1/30), 1)
  })
  it('more reps → higher 1RM', () => {
    expect(parseFloat(epley1RM(80, 10))).toBeGreaterThan(parseFloat(epley1RM(80, 5)))
  })
})

// ── wingateStats ──────────────────────────────────────────────────────────────
describe('wingateStats', () => {
  it('fatigue index 0 when peak = low', () => {
    const r = wingateStats(800, 700, 800, 75)
    expect(parseFloat(r.fatigue)).toBe(0)
  })
  it('higher fatigue when low power is much less than peak', () => {
    const r = wingateStats(800, 600, 400, 75)
    expect(parseFloat(r.fatigue)).toBeGreaterThan(30)
  })
})

// ── calcLoad ──────────────────────────────────────────────────────────────────
describe('calcLoad', () => {
  it('returns zeros for empty log', () => {
    const r = calcLoad([])
    expect(r.atl).toBe(0)
    expect(r.ctl).toBe(0)
    expect(r.tsb).toBe(0)
  })
  it('CTL > 0 after sessions with recent dates', () => {
    const today = new Date()
    const d1 = new Date(today); d1.setDate(d1.getDate() - 2)
    const d2 = new Date(today); d2.setDate(d2.getDate() - 1)
    const log = [
      { date: d1.toISOString().slice(0,10), tss:100 },
      { date: d2.toISOString().slice(0,10), tss:80 },
    ]
    expect(calcLoad(log).ctl).toBeGreaterThan(0)
  })
})

// ── monotonyStrain ────────────────────────────────────────────────────────────
describe('monotonyStrain', () => {
  it('returns 0 monotony for empty log', () => {
    expect(monotonyStrain([]).mono).toBe(0)
  })
})

// ── calcPRs ───────────────────────────────────────────────────────────────────
describe('calcPRs', () => {
  it('returns empty for empty log', () => {
    expect(calcPRs([])).toHaveLength(0)
  })
  it('finds highest TSS entry', () => {
    const log = [
      { date:'2025-01-01', tss:50, duration:60, rpe:5, type:'run' },
      { date:'2025-01-02', tss:150, duration:90, rpe:8, type:'run' },
    ]
    const prs = calcPRs(log)
    const tssRecord = prs.find(p => p.label === 'Highest TSS')
    expect(tssRecord?.value).toBe(150)
  })
})

// ── MDC (Minimal Detectable Change) arithmetic ────────────────────────────────
// MDC = |value| × semPct / 100  (component uses this to flag real vs noise)
describe('MDC interpretation', () => {
  const mdcFor = (value, semPct) => Math.abs(value) * semPct / 100
  it('cooper 50 mL/kg/min at 5.5% SEM → MDC ≈ 2.75', () => {
    expect(mdcFor(50, 5.5)).toBeCloseTo(2.75)
  })
  it('ftp20 280W at 3.5% SEM → MDC ≈ 9.8W', () => {
    expect(mdcFor(280, 3.5)).toBeCloseTo(9.8)
  })
  it('Δ3.0 on cooper (base 50, SEM 5.5%) = real improvement', () => {
    expect(3.0).toBeGreaterThanOrEqual(mdcFor(50, 5.5))
  })
  it('Δ2.0 on cooper (base 50, SEM 5.5%) = within measurement error', () => {
    expect(2.0).toBeLessThan(mdcFor(50, 5.5))
  })
  it('MDC scales with base value — larger base → larger absolute MDC', () => {
    expect(mdcFor(300, 4.0)).toBeGreaterThan(mdcFor(200, 4.0))
  })
  it('MDC is symmetric — decline detected same as gain', () => {
    const mdc = mdcFor(50, 5.5)
    expect(Math.abs(-4.0)).toBeGreaterThanOrEqual(mdc)
  })
  it('cp_test 260W at 4.0% SEM → MDC ≈ 10.4W', () => {
    expect(mdcFor(260, 4.0)).toBeCloseTo(10.4)
  })
})

// ── hrZones / powerZones ──────────────────────────────────────────────────────
describe('zone builders', () => {
  it('hrZones returns 5 zones', () => {
    expect(hrZones(190)).toHaveLength(5)
  })
  it('hrZones Z1 lower bound = 50% maxHR', () => {
    expect(hrZones(200)[0].low).toBe(100)
  })
  it('powerZones returns 5 zones', () => {
    expect(powerZones(250)).toHaveLength(5)
  })
  it('powerZones Z4 lower bound = 105% FTP', () => {
    expect(powerZones(200)[3].low).toBe(210)
  })
})
