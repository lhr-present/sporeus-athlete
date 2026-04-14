import { describe, it, expect } from 'vitest'
import { analyseSession } from '../intelligence.js'

describe('analyseSession', () => {
  it('comparison string includes percentage when recent log has same type', () => {
    const entry = { tss: 80, rpe: 6, type: 'Run', duration: 45, date: '2026-04-15' }
    const recentLog = [
      { tss: 50, rpe: 5, type: 'Run', duration: 40, date: '2026-04-08' },
      { tss: 60, rpe: 5, type: 'Run', duration: 42, date: '2026-04-01' },
    ]
    const result = analyseSession(entry, recentLog)
    expect(result.comparison).toMatch(/%/)
    expect(result.comparison).toMatch(/average/)
  })

  it('zone_estimate returns a string for all RPE values 1-10', () => {
    for (let rpe = 1; rpe <= 10; rpe++) {
      const result = analyseSession({ tss: 50, rpe, type: 'Run', duration: 40, date: '2026-04-15' }, [])
      expect(typeof result.zone_estimate).toBe('string')
      expect(result.zone_estimate.length).toBeGreaterThan(0)
    }
  })

  it('recovery_time increases with TSS', () => {
    const lowTSS  = analyseSession({ tss: 20, rpe: 3, type: 'Run', duration: 30, date: '2026-04-15' }, [])
    const highTSS = analyseSession({ tss: 160, rpe: 8, type: 'Run', duration: 120, date: '2026-04-15' }, [])
    const getHours = (s) => parseInt(s.match(/\d+/)[0])
    expect(getHours(highTSS.recovery_time)).toBeGreaterThan(getHours(lowTSS.recovery_time))
  })

  it('notes array is never empty for a valid entry', () => {
    const entry = { tss: 55, rpe: 5, type: 'Bike', duration: 60, date: '2026-04-15' }
    const result = analyseSession(entry, [])
    expect(Array.isArray(result.notes)).toBe(true)
    expect(result.notes.length).toBeGreaterThan(0)
  })

  it('handles missing fields gracefully (no throw)', () => {
    expect(() => analyseSession({}, [])).not.toThrow()
    expect(() => analyseSession(null, [])).not.toThrow()
    const result = analyseSession(null, [])
    expect(result.comparison).toBe('No data')
    expect(Array.isArray(result.notes)).toBe(true)
  })
})
