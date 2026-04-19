// src/lib/__tests__/coach/morningBriefing.test.js — E5
import { describe, it, expect } from 'vitest'
import { flagAthlete, generateMorningBriefing } from '../../coach/morningBriefing.js'

const athlete = (overrides = {}) => ({
  id: 'a1', name: 'Test Athlete',
  acwr: 1.0, tsb: -10,
  hrvToday: 65, hrv7dMean: 68,
  missedStreak: 0, newInjury: false,
  testDeltaPct: 0,
  ...overrides,
})

// ─── flagAthlete ──────────────────────────────────────────────────────────────
describe('flagAthlete', () => {
  it('clean athlete → no flags', () => {
    expect(flagAthlete(athlete())).toHaveLength(0)
  })

  it('ACWR > 1.5 → critical acwr_danger flag', () => {
    const flags = flagAthlete(athlete({ acwr: 1.6 }))
    expect(flags.some(f => f.code === 'acwr_danger' && f.level === 'critical')).toBe(true)
  })

  it('ACWR at exactly 1.5 → no acwr flag (> not >=)', () => {
    const flags = flagAthlete(athlete({ acwr: 1.5 }))
    expect(flags.some(f => f.code === 'acwr_danger')).toBe(false)
  })

  it('HRV drop >= 20% → warning hrv_drop flag', () => {
    // 7d mean 100, today 75 = 25% drop
    const flags = flagAthlete(athlete({ hrv7dMean: 100, hrvToday: 75 }))
    expect(flags.some(f => f.code === 'hrv_drop' && f.level === 'warning')).toBe(true)
  })

  it('HRV drop < 20% → no hrv flag', () => {
    // 7d mean 100, today 85 = 15% drop
    const flags = flagAthlete(athlete({ hrv7dMean: 100, hrvToday: 85 }))
    expect(flags.some(f => f.code === 'hrv_drop')).toBe(false)
  })

  it('missedStreak >= 3 → warning missed_streak flag', () => {
    const flags = flagAthlete(athlete({ missedStreak: 3 }))
    expect(flags.some(f => f.code === 'missed_streak' && f.level === 'warning')).toBe(true)
  })

  it('missedStreak = 2 → no flag', () => {
    expect(flagAthlete(athlete({ missedStreak: 2 })).some(f => f.code === 'missed_streak')).toBe(false)
  })

  it('newInjury = true → critical new_injury flag', () => {
    const flags = flagAthlete(athlete({ newInjury: true }))
    expect(flags.some(f => f.code === 'new_injury' && f.level === 'critical')).toBe(true)
  })

  it('TSB < -30 → warning tsb_overreach flag', () => {
    const flags = flagAthlete(athlete({ tsb: -35 }))
    expect(flags.some(f => f.code === 'tsb_overreach' && f.level === 'warning')).toBe(true)
  })

  it('TSB = -30 → no tsb flag (< not <=)', () => {
    expect(flagAthlete(athlete({ tsb: -30 })).some(f => f.code === 'tsb_overreach')).toBe(false)
  })

  it('testDeltaPct >= 3% → info test_pr flag', () => {
    const flags = flagAthlete(athlete({ testDeltaPct: 0.05 }))
    expect(flags.some(f => f.code === 'test_pr' && f.level === 'info')).toBe(true)
  })

  it('testDeltaPct = 2% → no test_pr flag', () => {
    expect(flagAthlete(athlete({ testDeltaPct: 0.02 })).some(f => f.code === 'test_pr')).toBe(false)
  })

  it('multiple flags returned for multiple triggers', () => {
    const flags = flagAthlete(athlete({ acwr: 1.8, tsb: -35, newInjury: true }))
    expect(flags.length).toBeGreaterThanOrEqual(3)
  })

  it('flags include bilingual text (en and tr)', () => {
    const flags = flagAthlete(athlete({ acwr: 1.6 }))
    for (const f of flags) {
      expect(typeof f.en).toBe('string')
      expect(typeof f.tr).toBe('string')
      expect(f.en.length).toBeGreaterThan(0)
      expect(f.tr.length).toBeGreaterThan(0)
    }
  })
})

// ─── generateMorningBriefing ──────────────────────────────────────────────────
describe('generateMorningBriefing', () => {
  it('empty squad → allGreen=true, summary in EN', () => {
    const result = generateMorningBriefing([], 'en')
    expect(result.allGreen).toBe(true)
    expect(result.flagged).toHaveLength(0)
    expect(typeof result.summary).toBe('string')
  })

  it('empty squad → allGreen=true, summary in TR', () => {
    const result = generateMorningBriefing([], 'tr')
    expect(result.allGreen).toBe(true)
  })

  it('all-green squad → allGreen=true and no flagged athletes', () => {
    const squad = [athlete({ id: 'a1' }), athlete({ id: 'a2' })]
    const result = generateMorningBriefing(squad, 'en')
    expect(result.allGreen).toBe(true)
    expect(result.flagged).toHaveLength(0)
    expect(result.summary).toContain('all 2')
  })

  it('squad with one flagged athlete → allGreen=false', () => {
    const squad = [athlete({ id: 'a1' }), athlete({ id: 'a2', acwr: 1.7 })]
    const result = generateMorningBriefing(squad, 'en')
    expect(result.allGreen).toBe(false)
    expect(result.flagged).toHaveLength(1)
    expect(result.flagged[0].athlete.id).toBe('a2')
  })

  it('summary mentions critical count when present', () => {
    const squad = [athlete({ id: 'a1', acwr: 2.0 })]
    const result = generateMorningBriefing(squad, 'en')
    expect(result.summary).toMatch(/1 critical/i)
  })

  it('critical athletes appear before warnings in flagged list', () => {
    const squad = [
      athlete({ id: 'warn', tsb: -35 }),      // warning
      athlete({ id: 'crit', acwr: 1.8 }),      // critical
    ]
    const result = generateMorningBriefing(squad, 'en')
    expect(result.flagged[0].athlete.id).toBe('crit')
  })

  it('coach name injected into all-green summary', () => {
    const squad = [athlete()]
    const result = generateMorningBriefing(squad, 'en', 'Coach Ali')
    expect(result.summary).toContain('Coach Ali')
  })

  it('null squad handled gracefully', () => {
    expect(() => generateMorningBriefing(null)).not.toThrow()
  })

  it('TR language summary for flagged squad', () => {
    const squad = [athlete({ id: 'a1', newInjury: true })]
    const result = generateMorningBriefing(squad, 'tr')
    expect(result.allGreen).toBe(false)
    expect(result.summary).toMatch(/dikkat|kritik/i)
  })
})
