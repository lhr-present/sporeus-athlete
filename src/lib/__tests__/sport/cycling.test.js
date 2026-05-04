// Coverage-gap sweep — src/lib/sport/cycling.js
// Tests the Coggan FTP/zone/TSS engine + W/kg + time prediction helpers.
import { describe, it, expect } from 'vitest'
import {
  calculateFTP,
  getCyclingZone,
  getCyclingZones,
  calculateCyclingTSS,
  predictCyclingTime,
  wattsPerKg,
} from '../../sport/cycling.js'

// ─── calculateFTP — null/empty/malformed ────────────────────────────────────
describe('calculateFTP — null/empty/malformed', () => {
  it('null input returns null', () => {
    expect(calculateFTP(null)).toBeNull()
  })
  it('undefined input returns null', () => {
    expect(calculateFTP(undefined)).toBeNull()
  })
  it('empty array returns null', () => {
    expect(calculateFTP([])).toBeNull()
  })
})

// ─── calculateFTP — CP model (≥2 efforts) ───────────────────────────────────
describe('calculateFTP — CP model path', () => {
  it('two efforts produce CP method with positive ftp + W\'', () => {
    const result = calculateFTP([
      { timeSec: 1200, powerW: 250 },
      { timeSec: 300,  powerW: 310 },
    ])
    expect(result).not.toBeNull()
    expect(result.method).toBe('CP')
    expect(result.ftpWatts).toBeGreaterThan(0)
    expect(result.wPrime).toBeGreaterThan(0)
    expect(Number.isInteger(result.ftpWatts)).toBe(true)
  })

  it('three efforts still uses CP model', () => {
    const result = calculateFTP([
      { timeSec: 180,  powerW: 360 },
      { timeSec: 600,  powerW: 290 },
      { timeSec: 1200, powerW: 260 },
    ])
    expect(result.method).toBe('CP')
    expect(result.ftpWatts).toBeGreaterThan(200)
  })
})

// ─── calculateFTP — 20-min fallback ─────────────────────────────────────────
describe('calculateFTP — 20-min fallback', () => {
  it('single 20-min effort uses fallback × 0.95', () => {
    const result = calculateFTP([{ timeSec: 1200, powerW: 300 }])
    expect(result).not.toEqual(null)
    expect(result.method).toBe('20min')
    expect(result.ftpWatts).toBe(285) // 300 × 0.95
    expect(result.wPrime).toBeUndefined()
  })

  it('20-min effort at 1100 sec lower bound', () => {
    const result = calculateFTP([{ timeSec: 1100, powerW: 280 }])
    expect(result.method).toBe('20min')
    expect(result.ftpWatts).toBe(266)
  })

  it('20-min effort at 1300 sec upper bound', () => {
    const result = calculateFTP([{ timeSec: 1300, powerW: 280 }])
    expect(result.method).toBe('20min')
    expect(result.ftpWatts).toBe(266)
  })

  it('single short effort outside 20-min window returns null', () => {
    const result = calculateFTP([{ timeSec: 300, powerW: 350 }])
    expect(result).toBeNull()
  })

  it('zero power returns null', () => {
    const result = calculateFTP([{ timeSec: 1200, powerW: 0 }])
    expect(result).toBeNull()
  })
})

// ─── getCyclingZone — boundaries + edge cases ───────────────────────────────
describe('getCyclingZone', () => {
  it('null/zero inputs return null', () => {
    expect(getCyclingZone(null, 250)).toBeNull()
    expect(getCyclingZone(200, null)).toBeNull()
    expect(getCyclingZone(200, 0)).toBeNull()
    expect(getCyclingZone(0, 250)).toBeNull()
    expect(getCyclingZone(-10, 250)).toBeNull()
  })

  it('Z1 active recovery (<55% FTP)', () => {
    expect(getCyclingZone(100, 300)).toBe(1) // 33%
    expect(getCyclingZone(0.5, 300)).toBe(1) // ~0% but truthy
  })

  it('Z2 endurance (55–75% FTP)', () => {
    expect(getCyclingZone(165, 300)).toBe(2) // 55%
    expect(getCyclingZone(200, 300)).toBe(2) // 67%
  })

  it('Z3 tempo (75–90% FTP)', () => {
    expect(getCyclingZone(225, 300)).toBe(3) // 75%
    expect(getCyclingZone(260, 300)).toBe(3) // ~87%
  })

  it('Z4 lactate threshold (90–105% FTP)', () => {
    expect(getCyclingZone(270, 300)).toBe(4) // 90%
    expect(getCyclingZone(300, 300)).toBe(4) // 100%
    expect(getCyclingZone(310, 300)).toBe(4) // 103%
  })

  it('Z5 VO2max (105–120% FTP)', () => {
    expect(getCyclingZone(315, 300)).toBe(5) // 105%
    expect(getCyclingZone(350, 300)).toBe(5) // ~117%
  })

  it('Z6 anaerobic (120–150% FTP)', () => {
    expect(getCyclingZone(360, 300)).toBe(6) // 120%
    expect(getCyclingZone(440, 300)).toBe(6) // ~147%
  })

  it('Z7 neuromuscular (≥150% FTP)', () => {
    expect(getCyclingZone(450, 300)).toBe(7) // 150%
    expect(getCyclingZone(900, 300)).toBe(7) // 300% sprint
  })
})

// ─── getCyclingZones — array shape ──────────────────────────────────────────
describe('getCyclingZones', () => {
  it('zero/null FTP returns empty array', () => {
    expect(getCyclingZones(0)).toEqual([])
    expect(getCyclingZones(null)).toEqual([])
    expect(getCyclingZones(undefined)).toEqual([])
    expect(getCyclingZones(-100)).toEqual([])
  })

  it('returns 7 zones for a valid FTP', () => {
    const zones = getCyclingZones(300)
    expect(zones).toHaveLength(7)
    expect(zones.map(z => z.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('zone watt boundaries scale linearly with FTP', () => {
    const zones = getCyclingZones(300)
    expect(zones[0].minWatts).toBe(0)
    expect(zones[0].maxWatts).toBe(165)   // 300 × 0.55
    expect(zones[1].minWatts).toBe(165)   // 300 × 0.55
    expect(zones[1].maxWatts).toBe(225)   // 300 × 0.75
    expect(zones[3].minWatts).toBe(270)   // 300 × 0.90
    expect(zones[3].maxWatts).toBe(315)   // 300 × 1.05
  })

  it('Z7 has null maxWatts (no upper bound)', () => {
    const zones = getCyclingZones(300)
    expect(zones[6].id).toBe(7)
    expect(zones[6].maxWatts).toBeNull()
    expect(zones[6].minWatts).toBe(450) // 300 × 1.50
  })

  it('zone names are present and correct', () => {
    const zones = getCyclingZones(250)
    expect(zones[0].name).toBe('Active Recovery')
    expect(zones[3].name).toBe('Lactate Threshold')
    expect(zones[6].name).toBe('Neuromuscular')
  })
})

// ─── calculateCyclingTSS — math correctness ─────────────────────────────────
describe('calculateCyclingTSS', () => {
  it('null/zero inputs return null', () => {
    expect(calculateCyclingTSS(null, 200, 250)).toBeNull()
    expect(calculateCyclingTSS(60, null, 250)).toBeNull()
    expect(calculateCyclingTSS(60, 200, null)).toBeNull()
    expect(calculateCyclingTSS(60, 200, 0)).toBeNull()
    expect(calculateCyclingTSS(0, 200, 250)).toBeNull()
    expect(calculateCyclingTSS(60, 0, 250)).toBeNull()
    expect(calculateCyclingTSS(-10, 200, 250)).toBeNull()
    expect(calculateCyclingTSS(60, -50, 250)).toBeNull()
  })

  it('60-min @ FTP yields TSS=100 (definitional)', () => {
    expect(calculateCyclingTSS(60, 250, 250)).toBe(100)
  })

  it('60-min @ IF=0.9 yields TSS=81', () => {
    expect(calculateCyclingTSS(60, 270, 300)).toBe(81)
  })

  it('30-min @ FTP yields TSS=50', () => {
    expect(calculateCyclingTSS(30, 250, 250)).toBe(50)
  })

  it('returns 1-decimal precision', () => {
    const result = calculateCyclingTSS(45, 200, 250)
    expect(result).toBe(48) // 0.75 × 0.64 × 100 = 48.0
  })

  it('120-min sweet-spot (~88% FTP) is realistic', () => {
    const result = calculateCyclingTSS(120, 220, 250)
    expect(result).toBeCloseTo(154.9, 1)
  })
})

// ─── predictCyclingTime — physics model ─────────────────────────────────────
describe('predictCyclingTime', () => {
  it('null/zero inputs return null', () => {
    expect(predictCyclingTime(null, 40, 0)).toBeNull()
    expect(predictCyclingTime(280, null, 0)).toBeNull()
    expect(predictCyclingTime(0, 40, 0)).toBeNull()
    expect(predictCyclingTime(280, 0, 0)).toBeNull()
    expect(predictCyclingTime(-100, 40, 0)).toBeNull()
    expect(predictCyclingTime(280, -10, 0)).toBeNull()
  })

  it('flat 40 km route at FTP yields ~4114 sec (40/35 × 3600)', () => {
    const result = predictCyclingTime(280, 40, 0)
    expect(result).toBe(Math.round((40 / 35) * 3600))
  })

  it('hilly route is slower than flat', () => {
    const flat  = predictCyclingTime(280, 40, 0)
    const hilly = predictCyclingTime(280, 40, 800)
    expect(hilly).toBeGreaterThan(flat)
  })

  it('extreme grade clamps to minimum 8 km/h floor', () => {
    // 10 km × 1500 m climb → 15% grade → speed = max(8, 35 - 37.5) = 8 km/h floor
    const result = predictCyclingTime(280, 10, 1500)
    expect(result).toBe(Math.round((10 / 8) * 3600))
  })

  it('ignores body weight (parameter is reserved)', () => {
    const a = predictCyclingTime(280, 40, 200, 60)
    const b = predictCyclingTime(280, 40, 200, 90)
    expect(a).toBe(b)
  })

  it('returns integer seconds', () => {
    const result = predictCyclingTime(250, 25, 200)
    expect(Number.isInteger(result)).toBe(true)
  })
})

// ─── wattsPerKg — ratio math ────────────────────────────────────────────────
describe('wattsPerKg', () => {
  it('null/zero inputs return null', () => {
    expect(wattsPerKg(null, 70)).toBeNull()
    expect(wattsPerKg(300, null)).toBeNull()
    expect(wattsPerKg(0, 70)).toBeNull()
    expect(wattsPerKg(300, 0)).toBeNull()
    expect(wattsPerKg(300, -10)).toBeNull()
  })

  it('300 W / 75 kg = 4.0 W/kg', () => {
    expect(wattsPerKg(300, 75)).toBe(4)
  })

  it('rounds to 2 decimal places', () => {
    expect(wattsPerKg(250, 73)).toBe(3.42) // 3.4246… → 3.42
  })

  it('elite 7+ W/kg is reachable', () => {
    expect(wattsPerKg(490, 70)).toBe(7)
  })

  it('handles extreme small bodyweight (sanity)', () => {
    expect(wattsPerKg(100, 0.5)).toBe(200)
  })
})
