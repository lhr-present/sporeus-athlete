// src/lib/hrv.test.js
import { describe, it, expect } from 'vitest'
import {
  cleanRRIntervals,
  calculateRMSSD,
  calculateLnRMSSD,
  scoreReadiness,
  calculateDFAAlpha1,
  parsePolarHRM,
} from './hrv.js'

// ─── cleanRRIntervals ─────────────────────────────────────────────────────────
describe('cleanRRIntervals', () => {
  it('returns empty result for empty input', () => {
    const r = cleanRRIntervals([])
    expect(r.cleaned).toEqual([])
    expect(r.ectopicCount).toBe(0)
    expect(r.ectopicPct).toBe(0)
  })

  it('removes values outside 300–2000 ms', () => {
    const r = cleanRRIntervals([100, 800, 2500, 750, 200, 900])
    expect(r.cleaned).toHaveLength(3) // 800, 750, 900 survive
    expect(r.cleaned).not.toContain(100)
    expect(r.cleaned).not.toContain(2500)
  })

  it('detects ectopic beat with >20% deviation from local mean', () => {
    // Normal: 800 × 5 neighbours, then spike at 1500 (>20% above 800 mean)
    const rr = [800, 800, 1500, 800, 800]
    const r = cleanRRIntervals(rr)
    expect(r.ectopicCount).toBeGreaterThan(0)
  })

  it('returns ectopicPct as percentage', () => {
    // All normal (small variance)
    const rr = Array.from({ length: 100 }, () => 800)
    const r = cleanRRIntervals(rr)
    expect(r.ectopicPct).toBe(0)
  })

  it('linearly interpolates removed beats', () => {
    // [800, 1500 (ectopic), 800] — interpolated middle should be ~800
    const rr = [800, 800, 1500, 800, 800]
    const r = cleanRRIntervals(rr)
    const idx = 2  // middle index
    expect(r.cleaned[idx]).toBeGreaterThanOrEqual(750)
    expect(r.cleaned[idx]).toBeLessThanOrEqual(850)
  })
})

// ─── calculateRMSSD ──────────────────────────────────────────────────────────
describe('calculateRMSSD', () => {
  it('returns 0 for empty or single-element array', () => {
    expect(calculateRMSSD([])).toBe(0)
    expect(calculateRMSSD([800])).toBe(0)
  })

  it('returns correct RMSSD for known values', () => {
    // diffs: 10, -20, 30, -20 → sq: 100, 400, 900, 400 → mean=450 → √450 ≈ 21.2
    const rr = [800, 810, 790, 820, 800]
    expect(calculateRMSSD(rr)).toBeCloseTo(21.2, 0)
  })

  it('returns 0 for constant RR intervals (no successive differences)', () => {
    const rr = Array.from({ length: 10 }, () => 800)
    expect(calculateRMSSD(rr)).toBe(0)
  })

  it('increases with larger beat-to-beat variation', () => {
    const low  = [800, 810, 795, 805]   // small variation
    const high = [800, 850, 750, 820]   // large variation
    expect(calculateRMSSD(high)).toBeGreaterThan(calculateRMSSD(low))
  })
})

// ─── calculateLnRMSSD ────────────────────────────────────────────────────────
describe('calculateLnRMSSD', () => {
  it('returns ln(rmssd)', () => {
    expect(calculateLnRMSSD(Math.E)).toBeCloseTo(1.0, 3)   // ln(e) = 1
    expect(calculateLnRMSSD(1)).toBeCloseTo(0.0, 3)         // ln(1) = 0
    expect(calculateLnRMSSD(100)).toBeCloseTo(4.605, 2)     // ln(100)
  })

  it('returns 0 for invalid input', () => {
    expect(calculateLnRMSSD(0)).toBe(0)
    expect(calculateLnRMSSD(-5)).toBe(0)
    expect(calculateLnRMSSD(null)).toBe(0)
  })

  it('is always less than rmssd for rmssd > 1', () => {
    expect(calculateLnRMSSD(50)).toBeLessThan(50)
    expect(calculateLnRMSSD(80)).toBeLessThan(80)
  })
})

// ─── scoreReadiness ──────────────────────────────────────────────────────────
describe('scoreReadiness', () => {
  it('returns null for invalid baseline', () => {
    expect(scoreReadiness(4.0, 0)).toBeNull()
    expect(scoreReadiness(4.0, null)).toBeNull()
    expect(scoreReadiness(null, 4.0)).toBeNull()
  })

  it('returns green / elevated status when today >102% of baseline', () => {
    const baseline = 4.0
    const today    = 4.0 * 1.05  // 105% — clearly above 102%
    const r = scoreReadiness(today, baseline)
    expect(r.status).toBe('elevated')
    expect(r.color).toBe('#5bc25b')
    expect(r.score).toBeGreaterThanOrEqual(9)
    expect(r.recommendation).toMatch(/high intensity/i)
  })

  it('returns yellow / normal status when 97–102% of baseline', () => {
    const baseline = 4.0
    const today    = 4.0 * 1.00  // exactly 100%
    const r = scoreReadiness(today, baseline)
    expect(r.status).toBe('normal')
    expect(r.color).toBe('#f5c542')
    expect(r.score).toBeGreaterThanOrEqual(5)
    expect(r.score).toBeLessThanOrEqual(8)
  })

  it('returns red / suppressed status when <97% of baseline', () => {
    const baseline = 4.0
    const today    = 4.0 * 0.92  // 92% — below 97%
    const r = scoreReadiness(today, baseline)
    expect(r.status).toBe('suppressed')
    expect(r.color).toBe('#e03030')
    expect(r.score).toBeLessThanOrEqual(5)
    expect(r.recommendation).toMatch(/easy/i)
  })

  it('pct reflects actual percentage', () => {
    const r = scoreReadiness(4.2, 4.0)
    expect(r.pct).toBe(Math.round((4.2 / 4.0) * 100))
  })
})

// ─── calculateDFAAlpha1 ───────────────────────────────────────────────────────
describe('calculateDFAAlpha1', () => {
  it('returns null for fewer than 300 intervals', () => {
    expect(calculateDFAAlpha1([])).toBeNull()
    expect(calculateDFAAlpha1(Array(299).fill(800))).toBeNull()
  })

  it('returns null for degenerate (constant) signal', () => {
    // All equal → integrated series is all-zero → F(n)=0 → log(0) invalid
    expect(calculateDFAAlpha1(Array(300).fill(800))).toBeNull()
  })

  it('returns a float for a realistic varied signal (300+ beats)', () => {
    // Slightly varied periodic signal — not biologically perfect but computable
    const rr = Array.from({ length: 300 }, (_, i) => 800 + (i % 7) * 12 - 36)
    const alpha = calculateDFAAlpha1(rr)
    expect(alpha).not.toBeNull()
    expect(typeof alpha).toBe('number')
  })

  it('result is within physiologically plausible range [0, 2]', () => {
    const rr = Array.from({ length: 350 }, (_, i) => {
      // Correlated noise — AR(1) process approximation
      return 800 + Math.sin(i * 0.1) * 30 + (i % 5) * 8 - 20
    })
    const alpha = calculateDFAAlpha1(rr)
    if (alpha !== null) {
      expect(alpha).toBeGreaterThan(0)
      expect(alpha).toBeLessThan(2)
    }
  })

  it('returns value rounded to 3 decimal places', () => {
    const rr = Array.from({ length: 300 }, (_, i) => 800 + Math.sin(i * 0.2) * 25)
    const alpha = calculateDFAAlpha1(rr)
    if (alpha !== null) {
      const decimals = (String(alpha).split('.')[1] || '').length
      expect(decimals).toBeLessThanOrEqual(3)
    }
  })
})

// ─── parsePolarHRM ────────────────────────────────────────────────────────────
describe('parsePolarHRM', () => {
  it('returns empty array for empty or null input', () => {
    expect(parsePolarHRM('')).toEqual([])
    expect(parsePolarHRM(null)).toEqual([])
  })

  it('extracts RR intervals from [HRData] section', () => {
    const hrm = `[Params]
Version=106
SMode=10000000
[HRData]
70	800
72	750
68	810
[HRZones]
150`
    const rr = parsePolarHRM(hrm)
    expect(rr).toContain(800)
    expect(rr).toContain(750)
    expect(rr).toContain(810)
    // HR values (70, 72, 68) and zone value (150) should NOT be included
    rr.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(300)
      expect(v).toBeLessThanOrEqual(2000)
    })
  })

  it('ignores data outside [HRData] section', () => {
    const hrm = `[Params]
800
[HRData]
750
[Summary]
800`
    const rr = parsePolarHRM(hrm)
    expect(rr).toEqual([750])
  })

  it('handles CR+LF line endings', () => {
    const hrm = '[HRData]\r\n70\t800\r\n72\t750\r\n'
    const rr = parsePolarHRM(hrm)
    expect(rr).toContain(800)
    expect(rr).toContain(750)
  })
})
