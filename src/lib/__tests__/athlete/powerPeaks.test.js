// v9.480.0 — power peaks vector tests (executable contract for the Deno port).

import { describe, it, expect } from 'vitest'
import { computePowerPeaks, sanitizePowerPeaks, PEAK_WINDOWS } from '../../athlete/powerPeaks.js'

const flat = (watts, seconds) => Array(seconds).fill(watts)

describe('computePowerPeaks', () => {
  it('flat 200W hour → every window reads 200, lh300 = 200', () => {
    const p = computePowerPeaks(flat(200, 3600))
    expect(p).toMatchObject({ p5: 200, p60: 200, p300: 200, p1200: 200, p3600: 200, lh300: 200 })
  })

  it('omits windows longer than the series instead of fabricating', () => {
    const p = computePowerPeaks(flat(180, 600))   // 10 min
    expect(p.p300).toBe(180)
    expect('p1200' in p).toBe(false)
    expect('p3600' in p).toBe(false)
    expect(p.lh300).toBe(180)                     // last "hour" = whole series
  })

  it('finds an interval spike (60s @ 400W inside 1h @ 150W)', () => {
    const powers = [...flat(150, 1700), ...flat(400, 60), ...flat(150, 1840)]
    const p = computePowerPeaks(powers)
    expect(p.p60).toBe(400)
    expect(p.p5).toBe(400)
    expect(p.p300).toBeGreaterThan(150)
    expect(p.p300).toBeLessThan(400)
  })

  it('lh300 reflects final-hour fatigue (fresh 300W early, 240W late in a 2h ride)', () => {
    const powers = [...flat(300, 300), ...flat(250, 3300), ...flat(240, 3600)]
    const p = computePowerPeaks(powers)
    expect(p.p300).toBe(300)      // session best (fresh)
    expect(p.lh300).toBe(240)     // best 5-min inside the last hour
  })

  it('null for short/no-power series; 0-gap samples tolerated', () => {
    expect(computePowerPeaks(flat(200, 20))).toBeNull()
    expect(computePowerPeaks(flat(0, 3600))).toBeNull()
    expect(computePowerPeaks(null)).toBeNull()
    const gappy = [...flat(200, 100), ...flat(0, 50), ...flat(200, 100)]
    expect(computePowerPeaks(gappy).p5).toBe(200)
  })
})

describe('sanitizePowerPeaks', () => {
  it('keeps known keys with plausible watts, drops garbage', () => {
    expect(sanitizePowerPeaks({ p300: 250, lh300: 231.7, junk: 9, p60: 9000, p5: -5 }))
      .toEqual({ p300: 250, lh300: 232 })
    expect(sanitizePowerPeaks({ p5: 'x' })).toBeNull()
    expect(sanitizePowerPeaks(null)).toBeNull()
    expect(sanitizePowerPeaks([1, 2])).toBeNull()
  })
  it('window keys stay in sync with PEAK_WINDOWS', () => {
    const p = sanitizePowerPeaks(Object.fromEntries([...Object.keys(PEAK_WINDOWS), 'lh300'].map(k => [k, 100])))
    expect(Object.keys(p)).toHaveLength(Object.keys(PEAK_WINDOWS).length + 1)
  })
})
