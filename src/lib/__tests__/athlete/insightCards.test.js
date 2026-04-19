// src/lib/__tests__/athlete/insightCards.test.js — E6
// Critical property: these tests verify the anti-hallucination guarantees.
// Every card function must return null when data is insufficient — never a vague claim.
import { describe, it, expect } from 'vitest'
import {
  weeklyFitnessCard,
  consistencyCard,
  milestoneCard,
  workloadPatternCard,
  generateInsightCards,
} from '../../athlete/insightCards.js'

// ── weeklyFitnessCard ──────────────────────────────────────────────────────

describe('weeklyFitnessCard', () => {
  it('returns null when ctlNow is null', () => {
    expect(weeklyFitnessCard(null, 40)).toBeNull()
  })
  it('returns null when ctl4wAgo is null', () => {
    expect(weeklyFitnessCard(50, null)).toBeNull()
  })
  it('returns null when ctl4wAgo is 0 (division guard)', () => {
    expect(weeklyFitnessCard(50, 0)).toBeNull()
  })
  it('returns null when delta < 3%', () => {
    // 100 → 102 = 2.0% change (Math.round(2.0) = 2, which is < 3)
    expect(weeklyFitnessCard(102, 100)).toBeNull()
  })
  it('returns null when delta is exactly 2% (boundary)', () => {
    // 100 → 102 = exactly 2%, pct = 2 < 3 → null
    expect(weeklyFitnessCard(102, 100)).toBeNull()
  })
  it('returns card when delta ≥ 3% (positive)', () => {
    // 40 → 42 = 5%
    const card = weeklyFitnessCard(42, 40)
    expect(card).not.toBeNull()
    expect(card.type).toBe('weekly_fitness')
    expect(card.en).toContain('risen')
    expect(card.en).toContain('5%')
    expect(card.tr).toContain('arttı')
  })
  it('returns card when delta ≥ 3% (negative)', () => {
    // 40 → 38 = 5% drop
    const card = weeklyFitnessCard(38, 40)
    expect(card).not.toBeNull()
    expect(card.en).toContain('dropped')
    expect(card.tr).toContain('düştü')
  })
  it('card includes both old and new CTL values', () => {
    const card = weeklyFitnessCard(55, 50)
    expect(card.en).toContain('50')
    expect(card.en).toContain('55')
  })
  it('pct rounds correctly', () => {
    // 100 → 104 = exactly 4%
    const card = weeklyFitnessCard(104, 100)
    expect(card.en).toContain('4%')
  })
})

// ── consistencyCard ────────────────────────────────────────────────────────

describe('consistencyCard', () => {
  const asOf = '2024-06-30'

  it('returns null for non-array log', () => {
    expect(consistencyCard(null, asOf)).toBeNull()
    expect(consistencyCard({}, asOf)).toBeNull()
  })

  it('returns null when log has fewer than 4 entries', () => {
    const log = [
      { date: '2024-06-25' },
      { date: '2024-06-26' },
      { date: '2024-06-27' },
    ]
    expect(consistencyCard(log, asOf)).toBeNull()
  })

  it('returns null when asOf is missing', () => {
    const log = Array.from({ length: 10 }, (_, i) => ({ date: `2024-06-${String(i + 1).padStart(2,'0')}` }))
    expect(consistencyCard(log, null)).toBeNull()
    expect(consistencyCard(log, '')).toBeNull()
  })

  it('returns null when prior window has 0 sessions (no comparison possible)', () => {
    // All sessions in last 4 weeks only
    const log = [
      { date: '2024-06-10' },
      { date: '2024-06-15' },
      { date: '2024-06-20' },
      { date: '2024-06-25' },
    ]
    expect(consistencyCard(log, asOf)).toBeNull()
  })

  it('returns null when delta < 2 (not meaningful)', () => {
    // asOf=2024-06-30 → recent=[2024-06-02,2024-06-30], prior=[2024-05-05,2024-06-01]
    // recent=5, prior=4, delta=1 → null
    const prior4w = Array.from({ length: 4 }, (_, i) => ({ date: `2024-05-${String(i + 5).padStart(2,'0')}` }))
    const recent4w = Array.from({ length: 5 }, (_, i) => ({ date: `2024-06-${String(i + 2).padStart(2,'0')}` }))
    const log = [...prior4w, ...recent4w]
    expect(consistencyCard(log, asOf)).toBeNull()
  })

  it('positive card when recent > prior by ≥2', () => {
    // asOf=2024-06-30 → recent=[2024-06-02,2024-06-30], prior=[2024-05-05,2024-06-01]
    // prior=3 sessions in prior window, recent=6 sessions in recent window → delta=3
    const prior4w = Array.from({ length: 3 }, (_, i) => ({ date: `2024-05-${String(i + 5).padStart(2,'0')}` }))
    const recent4w = Array.from({ length: 6 }, (_, i) => ({ date: `2024-06-${String(i + 2).padStart(2,'0')}` }))
    const log = [...prior4w, ...recent4w]
    const card = consistencyCard(log, asOf)
    expect(card).not.toBeNull()
    expect(card.type).toBe('consistency')
    expect(card.en).toContain('6')
    expect(card.en).toContain('3')
    expect(card.en).toContain('Consistency')
  })

  it('negative card when recent < prior by ≥2', () => {
    // prior=6, recent=3, delta=-3
    const prior4w = Array.from({ length: 6 }, (_, i) => ({ date: `2024-05-${String(i + 5).padStart(2,'0')}` }))
    const recent4w = Array.from({ length: 3 }, (_, i) => ({ date: `2024-06-${String(i + 2).padStart(2,'0')}` }))
    const log = [...prior4w, ...recent4w]
    const card = consistencyCard(log, asOf)
    expect(card).not.toBeNull()
    expect(card.en).toContain('dropped')
    expect(card.tr).toContain('düştü')
  })
})

// ── milestoneCard ──────────────────────────────────────────────────────────

describe('milestoneCard', () => {
  const MILESTONES = [10, 25, 50, 100, 150, 200, 250, 300, 500, 750, 1000]

  it('returns null for non-milestone counts', () => {
    for (const n of [1, 11, 24, 51, 99, 101, 999]) {
      expect(milestoneCard(n)).toBeNull()
    }
  })

  it('returns card for every defined milestone', () => {
    for (const n of MILESTONES) {
      const card = milestoneCard(n)
      expect(card).not.toBeNull()
      expect(card.type).toBe('milestone')
      expect(card.en).toContain(String(n))
      expect(card.tr).toContain(String(n))
    }
  })

  it('card text includes session number', () => {
    const card = milestoneCard(100)
    expect(card.en).toContain('100')
    expect(card.tr).toContain('100')
  })
})

// ── workloadPatternCard ────────────────────────────────────────────────────

describe('workloadPatternCard', () => {
  it('returns null for non-array input', () => {
    expect(workloadPatternCard(null)).toBeNull()
    expect(workloadPatternCard(2.5)).toBeNull()
  })

  it('returns null for array with < 2 entries', () => {
    expect(workloadPatternCard([])).toBeNull()
    expect(workloadPatternCard([2.5])).toBeNull()
  })

  it('returns null when only 1 of last 2 weeks is high', () => {
    expect(workloadPatternCard([3.0, 1.8])).toBeNull()  // last=1.8
    expect(workloadPatternCard([1.5, 2.5])).toBeNull()  // second-to-last=1.5
  })

  it('returns null when last 2 weeks are exactly 2.0 (threshold is > 2.0)', () => {
    expect(workloadPatternCard([2.0, 2.0])).toBeNull()
  })

  it('returns card when both last 2 weeks > 2.0', () => {
    const card = workloadPatternCard([1.0, 2.1, 2.5])
    expect(card).not.toBeNull()
    expect(card.type).toBe('workload_pattern')
    expect(card.en).toContain('monotony')
    expect(card.tr).toContain('monotoni')
  })

  it('returns card for exactly 2-element array both > 2.0', () => {
    const card = workloadPatternCard([2.3, 2.7])
    expect(card).not.toBeNull()
  })

  it('only checks last 2 elements of longer arrays', () => {
    // First elements are high but last 2 are low
    expect(workloadPatternCard([3.0, 3.0, 3.0, 1.5, 1.8])).toBeNull()
  })

  it('returns null when any of last 2 is null', () => {
    expect(workloadPatternCard([null, 2.5])).toBeNull()
    expect(workloadPatternCard([2.5, null])).toBeNull()
  })
})

// ── generateInsightCards — anti-hallucination integration ─────────────────

describe('generateInsightCards — anti-hallucination', () => {
  it('returns [] with empty input', () => {
    expect(generateInsightCards()).toEqual([])
    expect(generateInsightCards({})).toEqual([])
  })

  it('returns [] with empty log and no CTL data', () => {
    const cards = generateInsightCards({ log: [], asOf: '2024-06-30' })
    expect(cards).toEqual([])
  })

  it('NEVER fabricates consistency card when log < 8 sessions', () => {
    // Even with asOf and some sessions, must be silent below 8
    const log = Array.from({ length: 7 }, (_, i) => ({
      date: `2024-06-${String(i + 1).padStart(2,'0')}`,
    }))
    const cards = generateInsightCards({ log, asOf: '2024-06-30' })
    expect(cards.find(c => c.type === 'consistency')).toBeUndefined()
  })

  it('NEVER fabricates CTL card when prior CTL is missing', () => {
    const cards = generateInsightCards({ log: [], ctlNow: 50, ctl4wAgo: null })
    expect(cards.find(c => c.type === 'weekly_fitness')).toBeUndefined()
  })

  it('NEVER fabricates CTL card when CTL change is trivial (< 3%)', () => {
    const cards = generateInsightCards({ log: [], ctlNow: 50, ctl4wAgo: 49 })
    expect(cards.find(c => c.type === 'weekly_fitness')).toBeUndefined()
  })

  it('NEVER fabricates workload card when monotony data is insufficient', () => {
    const cards = generateInsightCards({ log: [], monotonyHistory: [2.5] })
    expect(cards.find(c => c.type === 'workload_pattern')).toBeUndefined()
  })

  it('NEVER fabricates workload card when only 1 week is high', () => {
    const cards = generateInsightCards({ log: [], monotonyHistory: [1.0, 2.8] })
    expect(cards.find(c => c.type === 'workload_pattern')).toBeUndefined()
  })

  it('returns milestone card when total exactly hits a milestone', () => {
    const log = Array.from({ length: 100 }, (_, i) => ({
      date: `2024-${String(Math.floor(i/30)+1).padStart(2,'0')}-${String((i%30)+1).padStart(2,'0')}`,
    }))
    const cards = generateInsightCards({ log })
    expect(cards.find(c => c.type === 'milestone')).toBeDefined()
  })

  it('returns CTL card when data is sufficient', () => {
    const cards = generateInsightCards({ ctlNow: 60, ctl4wAgo: 50 })
    expect(cards.find(c => c.type === 'weekly_fitness')).toBeDefined()
  })

  it('returns workload card when monotony is high for 2+ weeks', () => {
    const cards = generateInsightCards({ monotonyHistory: [2.2, 2.8] })
    expect(cards.find(c => c.type === 'workload_pattern')).toBeDefined()
  })

  it('milestone fires first in returned array', () => {
    const log = Array.from({ length: 50 }, (_, i) => ({
      date: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
    }))
    const cards = generateInsightCards({
      log,
      ctlNow: 60,
      ctl4wAgo: 50,
      monotonyHistory: [2.2, 2.8],
    })
    if (cards.length > 1) {
      expect(cards[0].type).toBe('milestone')
    }
  })

  it('all returned cards have required fields (type, en, tr)', () => {
    const cards = generateInsightCards({
      ctlNow: 60,
      ctl4wAgo: 50,
      monotonyHistory: [2.2, 2.8],
    })
    for (const card of cards) {
      expect(card.type).toBeTruthy()
      expect(typeof card.en).toBe('string')
      expect(typeof card.tr).toBe('string')
    }
  })
})
