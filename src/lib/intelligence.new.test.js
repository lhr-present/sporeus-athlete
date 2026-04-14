import { describe, it, expect } from 'vitest'
import { getTimeOfDayAdvice, autoTagSession } from './intelligence.js'

describe('getTimeOfDayAdvice', () => {
  it('hour=6 returns string containing Morning', () => {
    const result = getTimeOfDayAdvice(6)
    expect(typeof result).toBe('string')
    expect(result).toContain('Morning')
  })

  it('hour=13 returns string containing peak', () => {
    const result = getTimeOfDayAdvice(13)
    expect(typeof result).toBe('string')
    expect(result.toLowerCase()).toContain('peak')
  })

  it('hour=20 returns string containing Evening or sleep', () => {
    const result = getTimeOfDayAdvice(20)
    expect(typeof result).toBe('string')
    const lower = result.toLowerCase()
    expect(lower.includes('evening') || lower.includes('sleep')).toBe(true)
  })

  it('hour=0 returns a string (midnight = morning band)', () => {
    const result = getTimeOfDayAdvice(0)
    expect(typeof result).toBe('string')
  })

  it('hour=25 returns null (invalid)', () => {
    expect(getTimeOfDayAdvice(25)).toBeNull()
  })
})

describe('autoTagSession', () => {
  it('{type:"Race"} → "Race"', () => {
    expect(autoTagSession({ type: 'Race', tss: 80, rpe: 9 })).toBe('Race')
  })

  it('notes containing "Cooper test" → "Test"', () => {
    expect(autoTagSession({ type: 'Easy Run', tss: 50, rpe: 4, notes: 'Cooper test today' })).toBe('Test')
  })

  it('tss=130 > 120 → "Key Session"', () => {
    expect(autoTagSession({ type: 'Tempo', tss: 130, rpe: 7, notes: '' })).toBe('Key Session')
  })

  it('rpe<=5 AND tss<60 → "Recovery"', () => {
    expect(autoTagSession({ type: 'Easy Run', tss: 45, rpe: 4, notes: '' })).toBe('Recovery')
  })

  it('Interval, tss=90, rpe=8 → null (no rule matches)', () => {
    expect(autoTagSession({ type: 'Interval', tss: 90, rpe: 8, notes: '' })).toBeNull()
  })

  it('null → null', () => {
    expect(autoTagSession(null)).toBeNull()
  })

  it('{} (empty object) → null', () => {
    expect(autoTagSession({})).toBeNull()
  })

  it('"time trial 10k", tss=100, rpe=8 → null', () => {
    expect(autoTagSession({ type: 'time trial 10k', tss: 100, rpe: 8, notes: '' })).toBeNull()
  })
})
