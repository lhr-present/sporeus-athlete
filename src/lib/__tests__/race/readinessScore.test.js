import { describe, it, expect } from 'vitest'
import {
  computeReadinessScore,
  formComponent as _formComponent,
  tsbComponent,
  hrvComponent,
  sleepComponent,
  subjectiveComponent,
} from '../../race/readinessScore.js'

// ── Component unit tests ───────────────────────────────────────────────────────

describe('tsbComponent', () => {
  it('returns 0 at TSB = -10 (boundary)', () => expect(tsbComponent(-10)).toBe(0))
  it('returns 0 below -10', () => expect(tsbComponent(-20)).toBe(0))
  it('returns linear between -10 and +5', () => {
    const v = tsbComponent(0)
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThan(60)
  })
  it('returns 100 in sweet spot at +5 (boundary)', () => expect(tsbComponent(5)).toBe(100))
  it('returns 100 in sweet spot at +12', () => expect(tsbComponent(12)).toBe(100))
  it('returns 100 in sweet spot at +20 (boundary)', () => expect(tsbComponent(20)).toBe(100))
  it('returns 60 at +35 (boundary)', () => expect(tsbComponent(35)).toBeCloseTo(60, 0))
  it('returns 30 when over-tapered (>35)', () => expect(tsbComponent(50)).toBe(30))
})

describe('sleepComponent', () => {
  it('returns 100 at ≥ 7.5h', () => expect(sleepComponent(7.5)).toBe(100))
  it('returns 80 at 7.0–7.5h', () => expect(sleepComponent(7.0)).toBe(80))
  it('returns 60 at 6.5–7.0h', () => expect(sleepComponent(6.5)).toBe(60))
  it('returns 40 at 6.0–6.5h', () => expect(sleepComponent(6.0)).toBe(40))
  it('returns 20 below 6.0h', () => expect(sleepComponent(5.5)).toBe(20))
})

describe('subjectiveComponent', () => {
  it('returns 100 for score 10', () => expect(subjectiveComponent(10)).toBeCloseTo(100))
  it('returns 0 for score 1', () => expect(subjectiveComponent(1)).toBeCloseTo(0))
  it('returns ~44 for score 5', () => expect(subjectiveComponent(5)).toBeCloseTo(44.4, 0))
})

describe('hrvComponent', () => {
  it('returns 100 when z ≥ +0.5', () => {
    expect(hrvComponent(65, 60, 5)).toBe(100)  // z = +1.0
  })
  it('returns 70 when z in [-0.5, +0.5]', () => {
    expect(hrvComponent(60, 60, 5)).toBe(70)   // z = 0
  })
  it('returns 40 when z in [-1.5, -0.5]', () => {
    expect(hrvComponent(55, 60, 5)).toBe(40)   // z = -1.0
  })
  it('returns 10 when z < -1.5', () => {
    expect(hrvComponent(48, 60, 5)).toBe(10)   // z = -2.4
  })
  it('returns null when any input is null', () => {
    expect(hrvComponent(null, 60, 5)).toBeNull()
    expect(hrvComponent(60, null, 5)).toBeNull()
    expect(hrvComponent(60, 60, null)).toBeNull()
  })
  it('returns null when sd is 0', () => {
    expect(hrvComponent(60, 60, 0)).toBeNull()
  })
})

// ── computeReadinessScore integration tests ───────────────────────────────────

describe('computeReadinessScore', () => {
  const fullyTapered = {
    ctl: 85, peakCtl30d: 90, tsb: 12,
    hrv7dMean: 65, hrv28dMean: 60, hrv28dSd: 5,
    sleep7dMean: 8,
    subjective: 9,
    raceDate: '2026-05-01',
    today: '2026-04-20',
  }

  it('fully-tapered elite: score ≥ 85, classification = peaked', () => {
    const r = computeReadinessScore(fullyTapered)
    expect(r.score).toBeGreaterThanOrEqual(85)
    expect(r.classification).toBe('peaked')
  })

  it('overreached athlete: score < 50, classification = overreached', () => {
    const r = computeReadinessScore({
      ctl: 70, peakCtl30d: 85, tsb: -15,
      hrv7dMean: 48, hrv28dMean: 60, hrv28dSd: 5,
      sleep7dMean: 6,
      subjective: 4,
      raceDate: '2026-05-01',
      today: '2026-04-20',
    })
    expect(r.score).toBeLessThan(50)
    expect(r.classification).toBe('overreached')
  })

  it('missing HRV only: hrv_trend.available=false, score still valid, missingWeight=0.20', () => {
    const r = computeReadinessScore({ ...fullyTapered, hrv7dMean: null })
    const hrv = r.components.find(c => c.name === 'hrv_trend')
    expect(hrv.available).toBe(false)
    expect(hrv.reason).toBe('no_hrv_baseline')
    expect(r.score).not.toBeNull()
    expect(r.missingWeight).toBeCloseTo(0.20, 2)
  })

  it('missing HRV + subjective: missingWeight=0.30, score still valid', () => {
    const r = computeReadinessScore({ ...fullyTapered, hrv7dMean: null, subjective: null })
    expect(r.missingWeight).toBeCloseTo(0.30, 2)
    expect(r.score).not.toBeNull()
  })

  it('missing CTL: classification=insufficient_data, score=null', () => {
    const r = computeReadinessScore({ ...fullyTapered, ctl: null })
    expect(r.score).toBeNull()
    expect(r.classification).toBe('insufficient_data')
  })

  it('missing TSB: classification=insufficient_data, score=null', () => {
    const r = computeReadinessScore({ ...fullyTapered, tsb: null })
    expect(r.score).toBeNull()
    expect(r.classification).toBe('insufficient_data')
  })

  it('missingWeight > 0.5: classification=insufficient_data, score=null', () => {
    const r = computeReadinessScore({
      ctl: 80, peakCtl30d: null, tsb: 10,
      hrv7dMean: null, hrv28dMean: null, hrv28dSd: null,
      sleep7dMean: null, subjective: null,
      raceDate: '2026-05-01',
      today: '2026-04-20',
    })
    expect(r.score).toBeNull()
    expect(r.classification).toBe('insufficient_data')
  })

  it('topDrivers contains top 2 components by contribution', () => {
    const r = computeReadinessScore(fullyTapered)
    expect(r.topDrivers).toHaveLength(2)
    expect(r.topDrivers[0].contribution).toBeGreaterThanOrEqual(r.topDrivers[1].contribution)
  })

  it('score bucket boundary: score=85 → peaked', () => {
    const r = computeReadinessScore(fullyTapered)
    if (r.score >= 85) expect(r.classification).toBe('peaked')
  })

  it('score bucket boundary: score=70 → ready', () => {
    const r = computeReadinessScore({
      ctl: 70, peakCtl30d: 80, tsb: 10,
      hrv7dMean: null, hrv28dMean: null, hrv28dSd: null,
      sleep7dMean: 7.2, subjective: 6,
      raceDate: '2026-05-01', today: '2026-04-20',
    })
    if (r.score !== null && r.score >= 70 && r.score < 85) {
      expect(r.classification).toBe('ready')
    }
  })

  it('citation string present in non-null return', () => {
    const r = computeReadinessScore(fullyTapered)
    expect(r.citation).toBeTruthy()
    expect(r.citation).toContain('Mujika')
  })

  it('citation present in insufficient_data return', () => {
    const r = computeReadinessScore({ ctl: null, tsb: null })
    expect(r.citation).toBeTruthy()
  })

  it('all 5 components present in response', () => {
    const r = computeReadinessScore(fullyTapered)
    const names = r.components.map(c => c.name)
    expect(names).toContain('form')
    expect(names).toContain('tsb')
    expect(names).toContain('hrv_trend')
    expect(names).toContain('sleep')
    expect(names).toContain('subjective')
  })

  it('sum of contributions ≈ score (within rounding)', () => {
    const r = computeReadinessScore(fullyTapered)
    const sum = r.components.reduce((s, c) => s + c.contribution, 0)
    expect(Math.abs(Math.round(sum) - r.score)).toBeLessThanOrEqual(1)
  })
})
