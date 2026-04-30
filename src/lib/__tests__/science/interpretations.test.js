// src/lib/__tests__/science/interpretations.test.js
// Vitest unit tests for interpretations.js — 5 pure functions, no mocking.

import { describe, it, expect } from 'vitest'
import {
  interpretACWR,
  interpretCTL,
  interpretTSB,
  interpretMonotony,
  interpretDecoupling,
} from '../../../lib/science/interpretations.js'

// ─── interpretACWR ────────────────────────────────────────────────────────────

describe('interpretACWR', () => {
  it('returns en/tr/citation shape for all branches', () => {
    const result = interpretACWR(1.0)
    expect(result).toHaveProperty('en')
    expect(result).toHaveProperty('tr')
    expect(result).toHaveProperty('citation')
    expect(typeof result.en).toBe('string')
    expect(typeof result.tr).toBe('string')
    expect(typeof result.citation).toBe('string')
  })

  it('null ratio — en contains "Insufficient"', () => {
    const result = interpretACWR(null)
    expect(result.en).toContain('Insufficient')
  })

  it('null ratio — tr contains "yeterli"', () => {
    const result = interpretACWR(null)
    expect(result.tr).toContain('yeterli')
  })

  it('null ratio — has a non-empty citation', () => {
    const result = interpretACWR(null)
    expect(result.citation.length).toBeGreaterThan(0)
  })

  it('ratio > 1.5 — en mentions "1.5"', () => {
    const result = interpretACWR(1.7)
    expect(result.en).toContain('1.5')
  })

  it('ratio > 1.5 — en formats value to 2 decimals (1.70)', () => {
    const result = interpretACWR(1.7)
    expect(result.en).toContain('1.70')
  })

  it('ratio > 1.5 — tr formats value to 2 decimals', () => {
    const result = interpretACWR(1.7)
    expect(result.tr).toContain('1.70')
  })

  it('ratio 1.4 — caution zone branch (1.3 < x <= 1.5)', () => {
    const result = interpretACWR(1.4)
    expect(result.en).toContain('caution')
  })

  it('ratio 1.4 — tr caution zone message', () => {
    const result = interpretACWR(1.4)
    expect(result.tr).toContain('dikkat')
  })

  it('ratio 1.4 — en formats to 1.40', () => {
    const result = interpretACWR(1.4)
    expect(result.en).toContain('1.40')
  })

  // boundary: ratio === 1.3 — the source uses `ratio > 1.3` for caution so 1.3 falls into optimal (>= 0.8)
  it('boundary ratio === 1.3 falls into optimal zone, not caution', () => {
    const result = interpretACWR(1.3)
    expect(result.en).toContain('optimal')
  })

  it('ratio 1.0 — optimal zone message', () => {
    const result = interpretACWR(1.0)
    expect(result.en).toContain('optimal')
  })

  it('ratio 1.0 — tr optimal zone message', () => {
    const result = interpretACWR(1.0)
    expect(result.tr).toContain('optimal')
  })

  it('ratio 1.0 — formats to 1.00', () => {
    const result = interpretACWR(1.0)
    expect(result.en).toContain('1.00')
  })

  // boundary: ratio === 0.8 — source uses `ratio >= 0.8` so 0.8 is optimal
  it('boundary ratio === 0.8 falls into optimal zone', () => {
    const result = interpretACWR(0.8)
    expect(result.en).toContain('optimal')
  })

  it('ratio 0.5 — undertraining zone', () => {
    const result = interpretACWR(0.5)
    expect(result.en).toContain('undertraining')
  })

  it('ratio 0.5 — tr undertraining zone', () => {
    const result = interpretACWR(0.5)
    expect(result.tr).toContain('yetersiz')
  })

  it('ratio 0.5 — formats to 0.50', () => {
    const result = interpretACWR(0.5)
    expect(result.en).toContain('0.50')
  })

  it('all non-null branches include the Gabbett citation', () => {
    for (const ratio of [0.5, 0.8, 1.0, 1.4, 1.7]) {
      const result = interpretACWR(ratio)
      expect(result.citation).toContain('Gabbett')
    }
  })
})

// ─── interpretCTL ────────────────────────────────────────────────────────────

describe('interpretCTL', () => {
  it('returns en/tr/citation shape', () => {
    const result = interpretCTL(50, 45)
    expect(result).toHaveProperty('en')
    expect(result).toHaveProperty('tr')
    expect(result).toHaveProperty('citation')
  })

  it('CTL < 40 — base-building message', () => {
    const result = interpretCTL(20, 15)
    expect(result.en).toContain('Base-building')
  })

  it('CTL < 40 — tr base-building message', () => {
    const result = interpretCTL(20, 15)
    expect(result.tr).toContain('Baz geliştirme')
  })

  it('CTL 40-69 — solid aerobic base message', () => {
    const result = interpretCTL(55, 50)
    expect(result.en).toContain('Solid aerobic base')
  })

  it('CTL 70-99 — high-performance range message', () => {
    const result = interpretCTL(85, 80)
    expect(result.en).toContain('High-performance')
  })

  it('CTL >= 100 — elite fitness zone message', () => {
    const result = interpretCTL(110, 100)
    expect(result.en).toContain('Elite fitness zone')
  })

  it('delta > 5 — rising trend arrow in output', () => {
    const result = interpretCTL(60, 50)  // delta = +10 > 5
    expect(result.en).toContain('↑')
  })

  it('delta < -5 — declining trend arrow in output', () => {
    const result = interpretCTL(40, 50)  // delta = -10 < -5
    expect(result.en).toContain('↓')
  })

  it('delta within -5 to 5 — neutral trend arrow', () => {
    const result = interpretCTL(52, 50)  // delta = +2
    expect(result.en).toContain('→')
  })

  it('null prevCTL — no trend or delta text injected', () => {
    const result = interpretCTL(50, null)
    expect(result.en).not.toContain('↑')
    expect(result.en).not.toContain('↓')
    expect(result.en).not.toContain('→')
  })

  it('includes CTL value in output', () => {
    const result = interpretCTL(75, 70)
    expect(result.en).toContain('75')
    expect(result.tr).toContain('75')
  })

  it('citation contains Banister', () => {
    const result = interpretCTL(50, 45)
    expect(result.citation).toContain('Banister')
  })
})

// ─── interpretTSB ─────────────────────────────────────────────────────────────

describe('interpretTSB', () => {
  it('returns en/tr/citation shape', () => {
    const result = interpretTSB(5)
    expect(result).toHaveProperty('en')
    expect(result).toHaveProperty('tr')
    expect(result).toHaveProperty('citation')
  })

  it('null TSB — returns "No TSB data" message', () => {
    const result = interpretTSB(null)
    expect(result.en).toBe('No TSB data.')
    expect(result.tr).toBe('TSF verisi yok.')
  })

  it('TSB > 25 — transitional / decaying fitness message', () => {
    const result = interpretTSB(30)
    expect(result.en).toContain('transitional')
  })

  it('TSB = 5 — fresh / peak form (boundary >= 5)', () => {
    const result = interpretTSB(5)
    expect(result.en).toContain('fresh')
  })

  it('TSB = 15 — fresh zone message', () => {
    const result = interpretTSB(15)
    expect(result.en).toContain('fresh')
  })

  it('TSB fresh + isRaceWeek=true — compete message', () => {
    const result = interpretTSB(10, true)
    expect(result.en).toContain('compete')
  })

  it('TSB fresh + isRaceWeek=false — save this form message', () => {
    const result = interpretTSB(10, false)
    expect(result.en).toContain('Save this form')
  })

  it('TSB 0 — neutral zone (>= -10)', () => {
    const result = interpretTSB(0)
    expect(result.en).toContain('neutral')
  })

  it('TSB = -10 — neutral zone (boundary >= -10)', () => {
    const result = interpretTSB(-10)
    expect(result.en).toContain('neutral')
  })

  it('TSB = -15 — optimal training stress zone (-10 to -30)', () => {
    const result = interpretTSB(-15)
    expect(result.en).toContain('optimal training stress')
  })

  it('TSB = -30 — optimal training stress zone (boundary >= -30)', () => {
    const result = interpretTSB(-30)
    expect(result.en).toContain('optimal training stress')
  })

  it('TSB < -30 — overreaching risk message', () => {
    const result = interpretTSB(-35)
    expect(result.en).toContain('overreaching')
  })

  it('TSB < -30 — tr overreaching message', () => {
    const result = interpretTSB(-35)
    expect(result.tr).toContain('aşırı yüklenme')
  })

  it('citation contains Coggan', () => {
    const result = interpretTSB(5)
    expect(result.citation).toContain('Coggan')
  })
})

// ─── interpretMonotony ────────────────────────────────────────────────────────

describe('interpretMonotony', () => {
  it('returns en/tr/citation shape', () => {
    const result = interpretMonotony(1.2, 500)
    expect(result).toHaveProperty('en')
    expect(result).toHaveProperty('tr')
    expect(result).toHaveProperty('citation')
  })

  it('null monotony — cannot compute message', () => {
    const result = interpretMonotony(null, 500)
    expect(result.en).toContain('monotony')
  })

  it('null monotony — tr message mentions monotoni', () => {
    const result = interpretMonotony(null, null)
    expect(result.tr).toContain('monotoni')
  })

  it('monotony > 2.0 — high overreach risk message', () => {
    const result = interpretMonotony(2.5, 1000)
    expect(result.en).toContain('high overreach risk')
  })

  it('monotony > 2.0 — tr message mentions yüksek', () => {
    const result = interpretMonotony(2.5, 1000)
    expect(result.tr).toContain('yüksek')
  })

  it('monotony > 2.0 — value formatted to 2 decimals', () => {
    const result = interpretMonotony(2.5, 1000)
    expect(result.en).toContain('2.50')
  })

  it('monotony = 2.0 — boundary: NOT high risk (> 2.0 is the condition)', () => {
    const result = interpretMonotony(2.0, 800)
    expect(result.en).not.toContain('high overreach risk')
  })

  it('monotony between 1.5 and 2.0 — moderate concern message', () => {
    const result = interpretMonotony(1.8, 700)
    expect(result.en).toContain('moderate concern')
  })

  it('monotony = 1.5 — boundary: safe range (> 1.5 is the condition)', () => {
    const result = interpretMonotony(1.5, 600)
    expect(result.en).toContain('safe range')
  })

  it('monotony <= 1.5 — safe range message', () => {
    const result = interpretMonotony(1.2, 500)
    expect(result.en).toContain('safe range')
  })

  it('monotony <= 1.5 — tr safe range message', () => {
    const result = interpretMonotony(1.0, 400)
    expect(result.tr).toContain('güvenli')
  })

  it('citation contains Foster', () => {
    const result = interpretMonotony(1.2, 500)
    expect(result.citation).toContain('Foster')
  })
})

// ─── interpretDecoupling ─────────────────────────────────────────────────────

describe('interpretDecoupling', () => {
  it('returns en/tr/citation shape', () => {
    const result = interpretDecoupling(3)
    expect(result).toHaveProperty('en')
    expect(result).toHaveProperty('tr')
    expect(result).toHaveProperty('citation')
  })

  it('null decouplingPct — no data message', () => {
    const result = interpretDecoupling(null)
    expect(result.en).toBe('No decoupling data for this session.')
    expect(result.tr).toContain('ayrışma verisi yok')
  })

  it('decoupling < 5 — well coupled message', () => {
    const result = interpretDecoupling(3)
    expect(result.en).toContain('well coupled')
  })

  it('decoupling < 5 — tr iyi bağlı message', () => {
    const result = interpretDecoupling(3)
    expect(result.tr).toContain('iyi bağlı')
  })

  it('decoupling < 5 — value formatted to 1 decimal', () => {
    const result = interpretDecoupling(3.4)
    expect(result.en).toContain('3.4%')
  })

  it('decoupling = 4.9 — still well coupled (< 5 boundary)', () => {
    const result = interpretDecoupling(4.9)
    expect(result.en).toContain('well coupled')
  })

  it('decoupling = 5.0 — mild drift zone (>= 5, < 10)', () => {
    const result = interpretDecoupling(5.0)
    expect(result.en).toContain('mild drift')
  })

  it('decoupling 7 — mild drift message', () => {
    const result = interpretDecoupling(7)
    expect(result.en).toContain('mild drift')
  })

  it('decoupling 7 — tr hafif kayma message', () => {
    const result = interpretDecoupling(7)
    expect(result.tr).toContain('hafif kayma')
  })

  it('decoupling = 9.9 — still mild drift (< 10 boundary)', () => {
    const result = interpretDecoupling(9.9)
    expect(result.en).toContain('mild drift')
  })

  it('decoupling >= 10 — significant drift message', () => {
    const result = interpretDecoupling(12)
    expect(result.en).toContain('significant')
  })

  it('decoupling >= 10 — tr belirgin message', () => {
    const result = interpretDecoupling(12)
    expect(result.tr).toContain('belirgin')
  })

  it('decoupling = 10.0 — significant (boundary, falls to >= 10 branch)', () => {
    const result = interpretDecoupling(10.0)
    expect(result.en).toContain('significant')
  })

  it('decoupling 15 — value formatted to 1 decimal (15.0)', () => {
    const result = interpretDecoupling(15)
    expect(result.en).toContain('15.0%')
  })

  it('citation contains Friel', () => {
    const result = interpretDecoupling(3)
    expect(result.citation).toContain('Friel')
  })
})
