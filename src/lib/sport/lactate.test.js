import { describe, it, expect } from 'vitest'
import { estimateLTFromStep, estimateLTFromHR, estimateLTFromRPE, formatLTResult } from './lactate.js'

// Realistic step-test data from a well-trained cyclist (W, mmol/L)
const BIKE_STEPS = [
  { load: 100, lactate: 1.1 },
  { load: 150, lactate: 1.3 },
  { load: 200, lactate: 1.6 },
  { load: 250, lactate: 2.2 },
  { load: 280, lactate: 3.1 },
  { load: 310, lactate: 5.0 },
  { load: 330, lactate: 7.5 },
]

// ── estimateLTFromStep ────────────────────────────────────────────────────────

describe('estimateLTFromStep', () => {
  it('returns lt in range of the step data', () => {
    const result = estimateLTFromStep(BIKE_STEPS)
    expect(result.error).toBeUndefined()
    expect(result.lt).toBeGreaterThan(BIKE_STEPS[0].load)
    expect(result.lt).toBeLessThan(BIKE_STEPS[BIKE_STEPS.length - 1].load)
  })

  it('lt is physiologically plausible (near 250-300W for this data)', () => {
    const result = estimateLTFromStep(BIKE_STEPS)
    expect(result.lt).toBeGreaterThan(200)
    expect(result.lt).toBeLessThan(330)
  })

  it('returns lt1 < lt2 (aerobic threshold below anaerobic)', () => {
    const result = estimateLTFromStep(BIKE_STEPS)
    if (result.lt1 != null) {
      expect(result.lt1).toBeLessThan(result.lt2)
    }
  })

  it('returns a fitted curve with >= 20 points', () => {
    const result = estimateLTFromStep(BIKE_STEPS)
    expect(result.curve).toBeInstanceOf(Array)
    expect(result.curve.length).toBeGreaterThanOrEqual(20)
    for (const pt of result.curve) {
      expect(pt).toHaveProperty('load')
      expect(pt).toHaveProperty('lactate')
    }
  })

  it('returns error for too few steps (< 4)', () => {
    const result = estimateLTFromStep([{ load: 100, lactate: 1 }, { load: 200, lactate: 2 }])
    expect(result.error).toBeTruthy()
    expect(result.lt).toBeNull()
  })

  it('returns error for null / undefined input', () => {
    expect(estimateLTFromStep(null).error).toBeTruthy()
    expect(estimateLTFromStep([]).error).toBeTruthy()
  })

  it('respects custom loadUnit in result', () => {
    const result = estimateLTFromStep(BIKE_STEPS, { loadUnit: 'km/h' })
    expect(result.loadUnit).toBe('km/h')
  })

  it('ltLactate is a number > 0 at the threshold point', () => {
    const result = estimateLTFromStep(BIKE_STEPS)
    expect(typeof result.ltLactate).toBe('number')
    expect(result.ltLactate).toBeGreaterThan(0)
  })
})

// ── estimateLTFromHR ──────────────────────────────────────────────────────────

describe('estimateLTFromHR', () => {
  const HR_STEPS = [
    { load: 100, hr: 120 }, { load: 150, hr: 135 }, { load: 200, hr: 148 },
    { load: 250, hr: 160 }, { load: 280, hr: 168 }, { load: 300, hr: 172 },
  ]

  it('returns lt within the load range', () => {
    const result = estimateLTFromHR(HR_STEPS)
    expect(result.lt).toBeGreaterThan(HR_STEPS[0].load)
    expect(result.lt).toBeLessThanOrEqual(HR_STEPS[HR_STEPS.length - 1].load)
  })

  it('returns error for fewer than 5 steps', () => {
    const result = estimateLTFromHR([{ load: 100, hr: 120 }, { load: 150, hr: 135 }])
    expect(result.error).toBeTruthy()
  })
})

// ── estimateLTFromRPE ─────────────────────────────────────────────────────────

describe('estimateLTFromRPE', () => {
  it('detects LT on Borg CR-10 scale (threshold at RPE=5)', () => {
    const steps = [
      { load: 100, rpe: 2 }, { load: 150, rpe: 3 }, { load: 200, rpe: 4.5 },
      { load: 250, rpe: 6 }, { load: 300, rpe: 8 },
    ]
    const result = estimateLTFromRPE(steps)
    expect(result.lt).toBeGreaterThan(200)
    expect(result.lt).toBeLessThanOrEqual(250)
  })

  it('returns error for fewer than 3 steps', () => {
    expect(estimateLTFromRPE([{ load: 100, rpe: 3 }]).error).toBeTruthy()
  })
})

// ── formatLTResult ────────────────────────────────────────────────────────────

describe('formatLTResult', () => {
  it('formats a bike result with FTP note', () => {
    const result = estimateLTFromStep(BIKE_STEPS)
    const fmt = formatLTResult(result, 'bike')
    expect(fmt.primary).toContain('LT2')
    expect(fmt.zoneNote).toContain('FTP')
  })

  it('returns dash for null result', () => {
    const fmt = formatLTResult({ lt: null }, 'run')
    expect(fmt.primary).toBe('—')
  })
})
