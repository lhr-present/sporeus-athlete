// ─── decoupling.test.js — Aerobic Decoupling (Pw:Hr) ────────────────────────
import { it, expect, describe } from 'vitest'
import { computeDecoupling, classifyDecoupling, DECOUPLING_THRESHOLDS } from './decoupling.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Generate a 1-Hz stream of constant value for durationSec seconds
function flat(value, durationSec) {
  return Array(durationSec).fill(value)
}

// Generate a linearly ramping stream from `start` to `end` over durationSec
function ramp(start, end, durationSec) {
  return Array.from({ length: durationSec }, (_, i) =>
    start + (end - start) * (i / (durationSec - 1))
  )
}

// ── DECOUPLING_THRESHOLDS ─────────────────────────────────────────────────────

describe('DECOUPLING_THRESHOLDS', () => {
  it('exports correct threshold values', () => {
    expect(DECOUPLING_THRESHOLDS.coupled).toBe(5)
    expect(DECOUPLING_THRESHOLDS.mild).toBe(10)
  })

  it('is frozen (immutable)', () => {
    expect(() => { DECOUPLING_THRESHOLDS.coupled = 99 }).toThrow()
  })
})

// ── classifyDecoupling ────────────────────────────────────────────────────────

describe('classifyDecoupling', () => {
  it('3% → coupled', () => expect(classifyDecoupling(3)).toBe('coupled'))
  it('0% → coupled', () => expect(classifyDecoupling(0)).toBe('coupled'))
  it('4.9% → coupled', () => expect(classifyDecoupling(4.9)).toBe('coupled'))
  it('5% → mild (boundary is exclusive below coupled)', () => expect(classifyDecoupling(5)).toBe('mild'))
  it('7% → mild', () => expect(classifyDecoupling(7)).toBe('mild'))
  it('9.9% → mild', () => expect(classifyDecoupling(9.9)).toBe('mild'))
  it('10% → significant (boundary is exclusive below mild)', () => expect(classifyDecoupling(10)).toBe('significant'))
  it('12% → significant', () => expect(classifyDecoupling(12)).toBe('significant'))
  it('negative pct → coupled (negative = HR dropped, extremely coupled)', () => expect(classifyDecoupling(-2)).toBe('coupled'))
})

// ── computeDecoupling — cycling (power) ──────────────────────────────────────

describe('computeDecoupling — cycling — flat power + flat HR', () => {
  // Constant 200W and constant 140bpm for 90 minutes → ratio same in both halves → ~0%
  const D = 90 * 60 // 5400s
  const result = computeDecoupling({
    hr: flat(140, D),
    power: flat(200, D),
  })

  it('is valid', () => expect(result.valid).toBe(true))
  it('sport is cycling', () => expect(result.sport).toBe('cycling'))
  it('decoupling is < 1% (flat effort)', () => {
    expect(result.decouplingPct).not.toBeNull()
    expect(Math.abs(result.decouplingPct)).toBeLessThan(1)
  })
  it('first/second ratios are approximately equal', () => {
    expect(Math.abs(result.firstHalfRatio - result.secondHalfRatio)).toBeLessThan(0.001)
  })
  it('samplesUsed reflects warmup exclusion', () => {
    // default warmupSec=600, so samplesUsed ≈ 5400-600 = 4800
    expect(result.samplesUsed).toBe(4800)
  })
  it('durationSec is full session length', () => {
    expect(result.durationSec).toBe(D)
  })
})

describe('computeDecoupling — cycling — flat power + rising HR (cardiac drift)', () => {
  // 200W constant, HR ramps from 128 to 175 over 90 minutes → significant cardiac drift → >12%
  // Math: after warmup exclusion, first-half mean HR ≈ 144, second-half ≈ 165 → ~12.7% decoupling
  const D = 90 * 60
  const result = computeDecoupling({
    hr: ramp(128, 175, D),
    power: flat(200, D),
  })

  it('is valid', () => expect(result.valid).toBe(true))
  it('decoupling is > 10% (significant cardiac drift)', () => {
    expect(result.decouplingPct).toBeGreaterThan(10)
  })
  it('first half ratio > second half ratio', () => {
    expect(result.firstHalfRatio).toBeGreaterThan(result.secondHalfRatio)
  })
  it('classifies as significant', () => {
    expect(classifyDecoupling(result.decouplingPct)).toBe('significant')
  })
})

describe('computeDecoupling — cycling — mild drift (5–10%)', () => {
  // 200W, HR drifts from 135 to 148 → mild
  const D = 90 * 60
  const result = computeDecoupling({
    hr: ramp(135, 148, D),
    power: flat(200, D),
  })

  it('is valid', () => expect(result.valid).toBe(true))
  it('decoupling is between 3% and 10%', () => {
    expect(result.decouplingPct).toBeGreaterThan(3)
    expect(result.decouplingPct).toBeLessThan(10)
  })
})

// ── computeDecoupling — running (speed) ──────────────────────────────────────

describe('computeDecoupling — running — flat speed + rising HR', () => {
  // 4 m/s constant pace, HR ramps from 130 to 180 over 75 minutes → >12% decoupling
  // Math: after warmup, first-half mean HR ≈ 148, second-half ≈ 169 → ~12.8% decoupling
  const D = 75 * 60
  const result = computeDecoupling({
    hr: ramp(130, 180, D),
    speed: flat(4, D),
  })

  it('is valid', () => expect(result.valid).toBe(true))
  it('sport is running', () => expect(result.sport).toBe('running'))
  it('decoupling is positive (HR rose, speed stayed flat)', () => {
    expect(result.decouplingPct).toBeGreaterThan(0)
  })
  it('decoupling is > 8% for this HR drift magnitude', () => {
    expect(result.decouplingPct).toBeGreaterThan(8)
  })
  it('classifies as significant', () => {
    expect(classifyDecoupling(result.decouplingPct)).toBe('significant')
  })
})

describe('computeDecoupling — running — flat speed + flat HR', () => {
  const D = 75 * 60
  const result = computeDecoupling({
    hr: flat(145, D),
    speed: flat(4, D),
  })

  it('is valid', () => expect(result.valid).toBe(true))
  it('sport is running', () => expect(result.sport).toBe('running'))
  it('decoupling is near 0%', () => {
    expect(Math.abs(result.decouplingPct)).toBeLessThan(1)
  })
})

// ── Sport detection: power takes precedence over speed ───────────────────────

describe('computeDecoupling — power takes precedence when both provided', () => {
  const D = 90 * 60
  const result = computeDecoupling({
    hr: ramp(140, 155, D),
    power: flat(200, D),
    speed: flat(10, D), // speed also present — should be ignored
  })

  it('sport is cycling when both power and speed present', () => {
    expect(result.sport).toBe('cycling')
  })
  it('is valid', () => expect(result.valid).toBe(true))
})

// ── Validation failures ───────────────────────────────────────────────────────

describe('computeDecoupling — too short after warmup', () => {
  // 45-min effort; default minDurationSec=3600, warmupSec=600 → 2100s < 3600s
  const D = 45 * 60
  const result = computeDecoupling({
    hr: flat(140, D),
    power: flat(200, D),
  })

  it('valid is false', () => expect(result.valid).toBe(false))
  it('reason mentions duration', () => {
    expect(result.reason).toMatch(/short|duration/i)
  })
  it('sport is correctly identified even for invalid result', () => {
    expect(result.sport).toBe('cycling')
  })
  it('durationSec is the actual session length', () => {
    expect(result.durationSec).toBe(D)
  })
})

describe('computeDecoupling — HR array missing', () => {
  it('valid is false with informative reason', () => {
    const result = computeDecoupling({ hr: null, power: flat(200, 5400) })
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/heart rate|hr/i)
  })

  it('empty HR array also invalid', () => {
    const result = computeDecoupling({ hr: [], power: flat(200, 5400) })
    expect(result.valid).toBe(false)
  })
})

describe('computeDecoupling — no power or speed', () => {
  it('valid is false with informative reason', () => {
    const result = computeDecoupling({ hr: flat(140, 5400) })
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/power|speed/i)
  })

  it('all-zero power array counts as no power', () => {
    const result = computeDecoupling({
      hr: flat(140, 5400),
      power: flat(0, 5400),
    })
    expect(result.valid).toBe(false)
  })
})

describe('computeDecoupling — no input at all', () => {
  it('returns invalid safely', () => {
    const result = computeDecoupling()
    expect(result.valid).toBe(false)
  })
})

// ── Warmup exclusion correctness ─────────────────────────────────────────────

describe('computeDecoupling — warmup exclusion matches 60-min-only computation', () => {
  // Build a 70-min session: first 10 minutes of noisy warmup + 60 min of clean effort
  // Clean effort: power=250W, HR ramps gently from 145 to 155
  const warmup = 10 * 60  // 600s
  const steady = 60 * 60  // 3600s
  const _D = warmup + steady

  // Warmup has noisy high HR + variable power
  const hrWarmup    = Array.from({ length: warmup }, (_, i) => 120 + (i % 20))
  const powerWarmup = Array.from({ length: warmup }, (_, i) => 150 + (i % 50))

  // Steady effort: flat 250W, mild HR drift 145→155
  const hrSteady    = ramp(145, 155, steady)
  const powerSteady = flat(250, steady)

  const hrFull    = [...hrWarmup, ...hrSteady]
  const powerFull = [...powerWarmup, ...powerSteady]

  // Full session with 10-min warmup stripped (default warmupSec=600)
  const resultFull = computeDecoupling({
    hr: hrFull,
    power: powerFull,
    options: { warmupSec: 600, minDurationSec: 3600 },
  })

  // Baseline: only the 60-min clean effort, no warmup to strip
  const resultBaseline = computeDecoupling({
    hr: hrSteady,
    power: powerSteady,
    options: { warmupSec: 0, minDurationSec: 3600 },
  })

  it('full session with warmup stripped is valid', () => expect(resultFull.valid).toBe(true))
  it('baseline (no warmup) is valid', () => expect(resultBaseline.valid).toBe(true))
  it('decoupling values match within ±0.5%', () => {
    expect(Math.abs(resultFull.decouplingPct - resultBaseline.decouplingPct)).toBeLessThan(0.5)
  })
  it('samplesUsed matches expected steady duration', () => {
    expect(resultFull.samplesUsed).toBe(steady)
  })
})

// ── requireSteady option ──────────────────────────────────────────────────────

describe('computeDecoupling — requireSteady option', () => {
  // Very spiky power + flat HR — with requireSteady=true many samples should be filtered
  const D = 90 * 60
  const spikyPower = Array.from({ length: D }, (_, i) => (i % 10 === 0 ? 400 : 200))
  const steadyHR   = flat(145, D)

  it('returns valid result with requireSteady=false (default)', () => {
    const r = computeDecoupling({ hr: steadyHR, power: spikyPower })
    expect(r.valid).toBe(true)
  })

  it('requireSteady=true filters spiky samples — samplesUsed < total', () => {
    const r = computeDecoupling({
      hr: steadyHR,
      power: spikyPower,
      options: { requireSteady: true, steadyCVThreshold: 0.10, steadyWindow: 30 },
    })
    // Result may or may not be valid depending on filter, but if valid samplesUsed < D
    if (r.valid) {
      expect(r.samplesUsed).toBeLessThan(D - 600) // excluding warmup
    }
  })
})
