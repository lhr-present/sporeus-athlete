// src/lib/__tests__/onboarding/day0Insight.test.js — E9
import { describe, it, expect } from 'vitest'
import {
  dominantZone,
  day0Insight,
  earlyTrendInsight,
  firstCTLInsight,
  selectInsight,
} from '../../onboarding/day0Insight.js'

// ── dominantZone ───────────────────────────────────────────────────────────

describe('dominantZone', () => {
  it('rpe ≤ 2 → z1', () => {
    expect(dominantZone({ rpe: 1 })).toBe('z1')
    expect(dominantZone({ rpe: 2 })).toBe('z1')
  })
  it('rpe 3–4 → z2', () => {
    expect(dominantZone({ rpe: 3 })).toBe('z2')
    expect(dominantZone({ rpe: 4 })).toBe('z2')
  })
  it('rpe 5–6 → z3', () => {
    expect(dominantZone({ rpe: 5 })).toBe('z3')
    expect(dominantZone({ rpe: 6 })).toBe('z3')
  })
  it('rpe 7–8 → z4', () => {
    expect(dominantZone({ rpe: 7 })).toBe('z4')
    expect(dominantZone({ rpe: 8 })).toBe('z4')
  })
  it('rpe 9–10 → z5', () => {
    expect(dominantZone({ rpe: 9 })).toBe('z5')
    expect(dominantZone({ rpe: 10 })).toBe('z5')
  })
  it('no rpe → z1 (defaults to 0)', () => {
    expect(dominantZone({})).toBe('z1')
  })
})

// ── day0Insight ────────────────────────────────────────────────────────────

describe('day0Insight', () => {
  it('returns null for missing session', () => {
    expect(day0Insight(null)).toBeNull()
    expect(day0Insight({})).toBeNull()  // no duration
  })

  it('returns object with headline, body, science', () => {
    const result = day0Insight({ type: 'Running', duration: 60, rpe: 5, tss: 70 })
    expect(result).not.toBeNull()
    expect(typeof result.headline).toBe('string')
    expect(typeof result.body).toBe('string')
    expect(typeof result.science).toBe('string')
  })

  it('includes session duration in headline', () => {
    const result = day0Insight({ type: 'Running', duration: 45, rpe: 5, tss: 55 })
    expect(result.headline).toContain('45')
  })

  it('Z2 session body mentions CTL and Zone 2', () => {
    const result = day0Insight({ type: 'Running', duration: 60, rpe: 4, tss: 70 })
    // rpe=4 → z2
    expect(result.body).toMatch(/[Zz]one 2|CTL|Seiler/i)
  })

  it('Z5 session body mentions TSB or fatigue', () => {
    const result = day0Insight({ type: 'Run', duration: 40, rpe: 10, tss: 90 })
    // rpe=10 → z5
    expect(result.body).toMatch(/TSB|fatigue|recovery/i)
  })

  it('Turkish output uses Turkish text', () => {
    const result = day0Insight({ type: 'Koşu', duration: 45, rpe: 5, tss: 55 }, 'tr')
    expect(result.headline).toContain('antrenman')
  })

  it('body never contains sycophantic phrases', () => {
    const badPhrases = ['amazing', 'awesome', "you're doing great", 'great job']
    const result = day0Insight({ type: 'Run', duration: 60, rpe: 6, tss: 75 })
    const lower = (result.body + result.headline).toLowerCase()
    for (const p of badPhrases) {
      expect(lower).not.toContain(p)
    }
  })

  it('includes a real number (duration or TSS) in body', () => {
    const result = day0Insight({ type: 'Cycling', duration: 75, rpe: 6, tss: 88 })
    // Body should contain at least one of: 75, 88
    expect(result.body.includes('75') || result.body.includes('88') || result.headline.includes('75')).toBe(true)
  })
})

// ── earlyTrendInsight ──────────────────────────────────────────────────────

describe('earlyTrendInsight', () => {
  it('returns null for < 3 sessions', () => {
    expect(earlyTrendInsight([])).toBeNull()
    expect(earlyTrendInsight([{ rpe: 5 }])).toBeNull()
    expect(earlyTrendInsight([{ rpe: 5 }, { rpe: 5 }])).toBeNull()
  })

  it('returns insight for 3+ sessions', () => {
    const sessions = [
      { rpe: 4, tss: 60, duration: 60 },
      { rpe: 4, tss: 65, duration: 65 },
      { rpe: 4, tss: 55, duration: 55 },
    ]
    const result = earlyTrendInsight(sessions)
    expect(result).not.toBeNull()
    expect(typeof result.headline).toBe('string')
    expect(typeof result.science).toBe('string')
  })

  it('Z2-dominant sessions mention aerobic / base', () => {
    const sessions = [
      { rpe: 4, tss: 60, duration: 60 },
      { rpe: 3, tss: 50, duration: 50 },
      { rpe: 4, tss: 65, duration: 65 },
    ]
    const result = earlyTrendInsight(sessions)
    expect(result.body).toMatch(/aerobic|Z2|base/i)
  })

  it('headline includes session count', () => {
    const sessions = Array.from({ length: 5 }, () => ({ rpe: 5, tss: 60, duration: 60 }))
    const result = earlyTrendInsight(sessions)
    expect(result.headline).toContain('5')
  })

  it('science cites Seiler 2010', () => {
    const sessions = [{ rpe: 5, tss: 60, duration: 60 }, { rpe: 5, tss: 60, duration: 60 }, { rpe: 5, tss: 60, duration: 60 }]
    const result = earlyTrendInsight(sessions)
    expect(result.science).toContain('Seiler')
  })
})

// ── firstCTLInsight ────────────────────────────────────────────────────────

describe('firstCTLInsight', () => {
  it('returns null for zero CTL', () => {
    expect(firstCTLInsight(0)).toBeNull()
    expect(firstCTLInsight(null)).toBeNull()
  })

  it('includes CTL value in headline', () => {
    const result = firstCTLInsight(32.5)
    expect(result.headline).toContain('32.5')
  })

  it('science cites Banister', () => {
    const result = firstCTLInsight(40)
    expect(result.science).toMatch(/Banister|τ=42/i)
  })

  it('Turkish output is in Turkish', () => {
    const result = firstCTLInsight(35, 'tr')
    expect(result.headline).toContain('CTL')
    expect(result.body).toMatch(/antrenman|hafta/i)
  })
})

// ── selectInsight ──────────────────────────────────────────────────────────

describe('selectInsight', () => {
  it('returns null for empty sessions', () => {
    expect(selectInsight([])).toBeNull()
    expect(selectInsight(null)).toBeNull()
  })

  it('returns day0Insight for 1 session', () => {
    const sessions = [{ date: '2024-06-01', type: 'Run', duration: 45, rpe: 5, tss: 55 }]
    const result = selectInsight(sessions, 0)
    expect(result).not.toBeNull()
    expect(result.headline).toContain('First session')
  })

  it('returns earlyTrendInsight for 3–6 sessions', () => {
    const sessions = Array.from({ length: 4 }, (_, i) => ({
      date: `2024-06-0${i + 1}`,
      type: 'Run', duration: 50, rpe: 5, tss: 60,
    }))
    const result = selectInsight(sessions, 0)
    expect(result).not.toBeNull()
    expect(result.headline).toContain('4')
  })

  it('returns firstCTLInsight for 7+ sessions with CTL', () => {
    const sessions = Array.from({ length: 7 }, (_, i) => ({
      date: `2024-06-${String(i + 1).padStart(2,'0')}`,
      type: 'Run', duration: 50, rpe: 5, tss: 60,
    }))
    const result = selectInsight(sessions, 28.5)
    expect(result).not.toBeNull()
    expect(result.headline).toContain('28.5')
  })

  it('for 7+ sessions but no CTL, falls back to earlyTrendInsight', () => {
    const sessions = Array.from({ length: 8 }, (_, i) => ({
      date: `2024-06-${String(i + 1).padStart(2,'0')}`,
      type: 'Run', duration: 50, rpe: 5, tss: 60,
    }))
    const result = selectInsight(sessions, 0)  // ctl=0
    expect(result).not.toBeNull()
    // Should show earlyTrend since ctl is 0
    expect(result.headline).toContain('8')
  })
})
