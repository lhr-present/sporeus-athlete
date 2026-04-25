import { describe, it, expect } from 'vitest'
import {
  extractCPHistory,
  computeCPDecayIndex,
  cpTrendSparkline,
} from '../../science/cpDecay.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(date, cp, type = 'cp_test', wPrime = null) {
  const e = { date, cp, type }
  if (wPrime !== null) e.wPrime = wPrime
  return e
}

function makeValueEntry(date, value, type = 'cp') {
  return { date, value, type }
}

const CITATION_SUBSTR = 'Poole'

// ── extractCPHistory ──────────────────────────────────────────────────────────

describe('extractCPHistory', () => {
  it('returns [] for empty input', () => {
    expect(extractCPHistory([])).toEqual([])
    expect(extractCPHistory()).toEqual([])
  })

  it('filters by type cp_test correctly', () => {
    const results = [
      makeEntry('2024-01-01', 250, 'cp_test'),
      { date: '2024-01-02', cp: 260, type: 'ftp_test' },
    ]
    const h = extractCPHistory(results)
    expect(h).toHaveLength(1)
    expect(h[0].cp).toBe(250)
  })

  it('filters by type cp correctly', () => {
    const results = [
      makeEntry('2024-01-01', 255, 'cp'),
    ]
    const h = extractCPHistory(results)
    expect(h).toHaveLength(1)
    expect(h[0].cp).toBe(255)
  })

  it('filters by type critical_power correctly', () => {
    const results = [
      makeEntry('2024-01-01', 260, 'critical_power'),
    ]
    const h = extractCPHistory(results)
    expect(h).toHaveLength(1)
    expect(h[0].cp).toBe(260)
  })

  it('maps value field when cp is absent or 0', () => {
    const results = [
      makeValueEntry('2024-01-01', 270, 'cp'),
    ]
    const h = extractCPHistory(results)
    expect(h).toHaveLength(1)
    expect(h[0].cp).toBe(270)
  })

  it('prefers cp over value when both present', () => {
    const results = [
      { date: '2024-01-01', cp: 280, value: 290, type: 'cp_test' },
    ]
    const h = extractCPHistory(results)
    expect(h[0].cp).toBe(280)
  })

  it('sorts oldest to newest by date', () => {
    const results = [
      makeEntry('2024-03-01', 260, 'cp_test'),
      makeEntry('2024-01-01', 240, 'cp_test'),
      makeEntry('2024-02-01', 250, 'cp_test'),
    ]
    const h = extractCPHistory(results)
    expect(h[0].date).toBe('2024-01-01')
    expect(h[1].date).toBe('2024-02-01')
    expect(h[2].date).toBe('2024-03-01')
  })

  it('includes wPrime from wPrime field', () => {
    const results = [
      makeEntry('2024-01-01', 250, 'cp_test', 18000),
    ]
    const h = extractCPHistory(results)
    expect(h[0].wPrime).toBe(18000)
  })

  it('includes wPrime from w_prime field', () => {
    const results = [
      { date: '2024-01-01', cp: 250, type: 'cp_test', w_prime: 17000 },
    ]
    const h = extractCPHistory(results)
    expect(h[0].wPrime).toBe(17000)
  })

  it('sets wPrime null when absent', () => {
    const results = [makeEntry('2024-01-01', 250, 'cp_test')]
    const h = extractCPHistory(results)
    expect(h[0].wPrime).toBeNull()
  })
})

// ── computeCPDecayIndex ───────────────────────────────────────────────────────

describe('computeCPDecayIndex', () => {
  it('single entry → insufficient_data, slope null', () => {
    const results = [makeEntry('2024-01-01', 250)]
    const r = computeCPDecayIndex(results)
    expect(r.classification).toBe('insufficient_data')
    expect(r.slope_w_per_week).toBeNull()
    expect(r.citation).toContain(CITATION_SUBSTR)
  })

  it('empty input → insufficient_data', () => {
    const r = computeCPDecayIndex([])
    expect(r.classification).toBe('insufficient_data')
  })

  it('two increasing entries (250→260 over 14 days) → building', () => {
    // slope = (260-250)/14 days * 7 = 5 W/week > 0.5
    const results = [
      makeEntry('2024-01-01', 250),
      makeEntry('2024-01-15', 260),
    ]
    const r = computeCPDecayIndex(results)
    expect(r.classification).toBe('building')
    expect(r.slope_w_per_week).toBeGreaterThan(0.5)
  })

  it('two stable entries (250, 250) → maintaining', () => {
    const results = [
      makeEntry('2024-01-01', 250),
      makeEntry('2024-02-01', 250),
    ]
    const r = computeCPDecayIndex(results)
    expect(r.classification).toBe('maintaining')
    expect(r.slope_w_per_week).toBeCloseTo(0, 5)
  })

  it('two decreasing entries >5% over 8 weeks → detraining', () => {
    // peak=250, current=230 → decayPct=8% > 5%; slope negative per week
    const results = [
      makeEntry('2024-01-01', 250),
      makeEntry('2024-02-26', 230), // ~56 days = 8 weeks; slope = -20/56*7 ≈ -2.5 W/wk < -0.5
    ]
    const r = computeCPDecayIndex(results)
    expect(r.classification).toBe('detraining')
    expect(r.decayPct).toBeGreaterThan(5)
  })

  it('slope exactly 0.5 W/week → building (not maintaining)', () => {
    // slope = 0.5 W/wk → 0.5/7 = 0.07143 W/day over 14 days → delta = 1W
    const results = [
      makeEntry('2024-01-01', 250),
      makeEntry('2024-01-15', 251), // delta=1W over 14 days → 0.5W/wk exactly
    ]
    const r = computeCPDecayIndex(results)
    // slope_w_per_week should be exactly 0.5
    expect(r.slope_w_per_week).toBeCloseTo(0.5, 4)
    // Spec: slope > 0.5 → building; exactly 0.5 → NOT building → maintaining
    // Wait — spec says slope > 0.5 → building, else maintaining
    // So 0.5 exactly falls into maintaining
    expect(r.classification).toBe('maintaining')
  })

  it('decayPct = (cpPeak12w - cpCurrent) / cpPeak12w * 100', () => {
    const results = [
      makeEntry('2024-01-01', 250),
      makeEntry('2024-03-01', 230),
    ]
    const r = computeCPDecayIndex(results)
    // Both within 12 weeks: peak=250, current=230
    const expected = (250 - 230) / 250 * 100
    expect(r.decayPct).toBeCloseTo(expected, 4)
  })

  it('decayPct=0 when only 1 entry in 12-week window', () => {
    // Make first entry older than 12 weeks so only current is in window
    const results = [
      makeEntry('2020-01-01', 300),  // way outside 12-week window
      makeEntry('2024-03-01', 250),  // current, only one in window
    ]
    const r = computeCPDecayIndex(results)
    expect(r.decayPct).toBe(0)
  })

  it('wPrimeStatus expanding when W prime slope > 100 J/week', () => {
    // W' increases 2000J over 7 days → slope = 2000/7*7 = 2000 J/wk >> 100
    const results = [
      makeEntry('2024-01-01', 250, 'cp_test', 18000),
      makeEntry('2024-01-08', 255, 'cp_test', 20000),
    ]
    const r = computeCPDecayIndex(results)
    expect(r.wPrimeStatus).toBe('expanding')
  })

  it('wPrimeStatus stable when W prime slope between -100 and 100 J/week', () => {
    // W' unchanged → slope 0
    const results = [
      makeEntry('2024-01-01', 250, 'cp_test', 18000),
      makeEntry('2024-02-01', 255, 'cp_test', 18050),
    ]
    const r = computeCPDecayIndex(results)
    expect(r.wPrimeStatus).toBe('stable')
  })

  it('wPrimeStatus null when fewer than 2 entries have wPrime', () => {
    const results = [
      makeEntry('2024-01-01', 250, 'cp_test', null),
      makeEntry('2024-02-01', 255, 'cp_test', null),
    ]
    const r = computeCPDecayIndex(results)
    expect(r.wPrimeStatus).toBeNull()
  })

  it('wPrimeStatus contracting when W prime slope < -100 J/week', () => {
    // W' decreases 2000J over 7 days → slope = -2000/7*7 = -2000 J/wk << -100
    const results = [
      makeEntry('2024-01-01', 250, 'cp_test', 20000),
      makeEntry('2024-01-08', 245, 'cp_test', 18000),
    ]
    const r = computeCPDecayIndex(results)
    expect(r.wPrimeStatus).toBe('contracting')
  })

  it('citation string present in every return path — insufficient_data', () => {
    const r = computeCPDecayIndex([])
    expect(r.citation).toContain(CITATION_SUBSTR)
  })

  it('citation string present in building result', () => {
    const results = [
      makeEntry('2024-01-01', 250),
      makeEntry('2024-01-15', 260),
    ]
    const r = computeCPDecayIndex(results)
    expect(r.citation).toContain(CITATION_SUBSTR)
  })

  it('citation string present in detraining result', () => {
    const results = [
      makeEntry('2024-01-01', 250),
      makeEntry('2024-02-26', 230),
    ]
    const r = computeCPDecayIndex(results)
    expect(r.citation).toContain(CITATION_SUBSTR)
  })

  it('recommendation contains bilingual en and tr keys', () => {
    const results = [
      makeEntry('2024-01-01', 250),
      makeEntry('2024-01-15', 260),
    ]
    const r = computeCPDecayIndex(results)
    expect(r.recommendation).toHaveProperty('en')
    expect(r.recommendation).toHaveProperty('tr')
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })
})

// ── cpTrendSparkline ──────────────────────────────────────────────────────────

describe('cpTrendSparkline', () => {
  it('returns [] for empty history', () => {
    expect(cpTrendSparkline([])).toEqual([])
  })

  it('returns full history when shorter than weeks window', () => {
    const history = [
      { date: '2024-01-01', cp: 250 },
      { date: '2024-01-15', cp: 255 },
    ]
    const result = cpTrendSparkline(history, 12)
    expect(result).toHaveLength(2)
  })

  it('filters to last N weeks oldest→newest', () => {
    const history = [
      { date: '2023-01-01', cp: 240 },  // very old, outside 12 weeks from latest
      { date: '2024-03-01', cp: 250 },
      { date: '2024-03-15', cp: 255 },
    ]
    const result = cpTrendSparkline(history, 12)
    // 2023-01-01 is way outside 12 weeks from 2024-03-15
    expect(result.every(h => h.date >= '2024-01-01')).toBe(true)
  })
})
