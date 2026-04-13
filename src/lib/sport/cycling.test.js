import { describe, it, expect } from 'vitest'
import {
  calculateFTP, getCyclingZone, getCyclingZones, calculateCyclingTSS, predictCyclingTime, wattsPerKg,
} from './cycling.js'

// ── calculateFTP ──────────────────────────────────────────────────────────────
describe('calculateFTP', () => {
  it('returns null for empty input', () => {
    expect(calculateFTP(null)).toBeNull()
    expect(calculateFTP([])).toBeNull()
  })

  it('uses CP model for 2+ efforts', () => {
    const r = calculateFTP([
      { timeSec: 180, powerW: 400 },
      { timeSec: 720, powerW: 300 },
    ])
    expect(r).not.toBeNull()
    expect(r.method).toBe('CP')
    expect(r.ftpWatts).toBeGreaterThan(200)
  })

  it('uses 20-min TT method for single ~20-min test', () => {
    const r = calculateFTP([{ timeSec: 1200, powerW: 280 }])
    expect(r).not.toBeNull()
    expect(r.method).toBe('20min')
    expect(r.ftpWatts).toBeCloseTo(280 * 0.95, 0)
  })

  it('CP method: FTP (CP) < max effort power', () => {
    const r = calculateFTP([
      { timeSec: 60,  powerW: 500 },
      { timeSec: 300, powerW: 380 },
      { timeSec: 720, powerW: 310 },
    ])
    expect(r.ftpWatts).toBeLessThan(500)
  })
})

// ── getCyclingZone ─────────────────────────────────────────────────────────────
describe('getCyclingZone', () => {
  it('returns zone 1 (Active Recovery) for < 55% FTP', () => {
    expect(getCyclingZone(130, 250)).toBe(1)  // 52% → zone 1
  })

  it('returns zone 4 (Lactate Threshold) for 95% FTP', () => {
    expect(getCyclingZone(237, 250)).toBe(4)  // 94.8% → zone 4
  })

  it('returns zone 7 (Neuromuscular) for > 150% FTP', () => {
    expect(getCyclingZone(400, 250)).toBe(7)  // 160%
  })

  it('returns null for invalid inputs', () => {
    expect(getCyclingZone(null, 250)).toBeNull()
    expect(getCyclingZone(200, 0)).toBeNull()
  })
})

// ── getCyclingZones ────────────────────────────────────────────────────────────
describe('getCyclingZones', () => {
  it('returns 7 zones for valid FTP', () => {
    const zones = getCyclingZones(250)
    expect(zones).toHaveLength(7)
    expect(zones[0].id).toBe(1)
    expect(zones[6].id).toBe(7)
  })

  it('zone boundaries scale with FTP', () => {
    const z200 = getCyclingZones(200)
    const z300 = getCyclingZones(300)
    // Zone 2 upper bound: 75% FTP
    expect(z300[1].maxWatts).toBeGreaterThan(z200[1].maxWatts)
  })

  it('returns empty array for invalid FTP', () => {
    expect(getCyclingZones(0)).toEqual([])
    expect(getCyclingZones(null)).toEqual([])
  })
})

// ── calculateCyclingTSS ───────────────────────────────────────────────────────
describe('calculateCyclingTSS', () => {
  it('returns 100 for 60min at FTP (IF=1.0)', () => {
    expect(calculateCyclingTSS(60, 250, 250)).toBe(100)
  })

  it('above-FTP effort gives TSS > 100/hr', () => {
    expect(calculateCyclingTSS(60, 300, 250)).toBeGreaterThan(100)
  })

  it('scales linearly with duration', () => {
    const t30 = calculateCyclingTSS(30, 250, 250)
    const t60 = calculateCyclingTSS(60, 250, 250)
    expect(t60).toBeCloseTo(t30 * 2, 0)
  })

  it('returns null for invalid inputs', () => {
    expect(calculateCyclingTSS(null, 250, 250)).toBeNull()
    expect(calculateCyclingTSS(60, 0, 250)).toBeNull()
    expect(calculateCyclingTSS(60, 250, 0)).toBeNull()
  })
})

// ── predictCyclingTime ────────────────────────────────────────────────────────
describe('predictCyclingTime', () => {
  it('returns positive time for valid flat ride', () => {
    const t = predictCyclingTime(250, 40, 0)  // 40km flat
    expect(t).toBeGreaterThan(3000)   // > 50 min
    expect(t).toBeLessThan(7200)      // < 2h
  })

  it('hilly course takes longer than flat', () => {
    const flat  = predictCyclingTime(250, 40, 0)
    const hilly = predictCyclingTime(250, 40, 1000)
    expect(hilly).toBeGreaterThan(flat)
  })

  it('returns null for invalid inputs', () => {
    expect(predictCyclingTime(0, 40, 0)).toBeNull()
    expect(predictCyclingTime(250, 0, 0)).toBeNull()
    expect(predictCyclingTime(null, 40, 0)).toBeNull()
  })
})

// ── wattsPerKg ────────────────────────────────────────────────────────────────
describe('wattsPerKg', () => {
  it('returns correct W/kg for 250W at 70kg', () => {
    expect(wattsPerKg(250, 70)).toBeCloseTo(3.57, 1)
  })

  it('returns null for invalid inputs', () => {
    expect(wattsPerKg(null, 70)).toBeNull()
    expect(wattsPerKg(250, 0)).toBeNull()
  })
})
