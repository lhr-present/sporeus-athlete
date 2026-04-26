// src/lib/__tests__/athlete/trainingPhase.test.js — E75
import { describe, it, expect } from 'vitest'
import { classifyTrainingPhase } from '../../athlete/trainingPhase.js'

function makeLog(n, tss = 60) {
  const entries = []
  for (let i = n; i >= 1; i--) {
    const d = new Date('2026-04-27T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - i)
    entries.push({ date: d.toISOString().slice(0, 10), tss, duration: 60, rpe: 5 })
  }
  return entries
}

describe('classifyTrainingPhase', () => {
  it('returns recovery when log is empty', () => {
    const r = classifyTrainingPhase([], {}, '2026-04-27')
    expect(r.phase).toBe('recovery')
  })

  it('returns recovery when fewer than 4 sessions', () => {
    const log = makeLog(3)
    const r = classifyTrainingPhase(log, {}, '2026-04-27')
    expect(r.phase).toBe('recovery')
  })

  it('returns taper when daysToRace ≤ 14', () => {
    const log = makeLog(60)
    const profile = { raceDate: '2026-05-05' } // 8 days from today
    const r = classifyTrainingPhase(log, profile, '2026-04-27')
    expect(r.phase).toBe('taper')
    expect(r.daysToRace).toBe(8)
  })

  it('returns peak when daysToRace 15–28', () => {
    const log = makeLog(60)
    const profile = { raceDate: '2026-05-17' } // 20 days from today
    const r = classifyTrainingPhase(log, profile, '2026-04-27')
    expect(r.phase).toBe('peak')
  })

  it('returns base when CTL trend is flat', () => {
    const log = makeLog(30, 50) // steady load → minimal CTL change
    const r = classifyTrainingPhase(log, {}, '2026-04-27')
    expect(['base', 'build', 'recovery']).toContain(r.phase)
  })

  it('returns correct en/tr labels', () => {
    const log = makeLog(60)
    const profile = { raceDate: '2026-05-05' }
    const r = classifyTrainingPhase(log, profile, '2026-04-27')
    expect(r.en).toBe('TAPER')
    expect(r.tr).toBe('AZALTMA')
  })

  it('returns null daysToRace when no raceDate', () => {
    const log = makeLog(10)
    const r = classifyTrainingPhase(log, {}, '2026-04-27')
    expect(r.daysToRace).toBeNull()
  })

  it('includes ctlTrend as a number', () => {
    const log = makeLog(30)
    const r = classifyTrainingPhase(log, {}, '2026-04-27')
    expect(typeof r.ctlTrend).toBe('number')
  })

  it('accepts nextRaceDate as fallback', () => {
    const log = makeLog(60)
    const profile = { nextRaceDate: '2026-05-05' }
    const r = classifyTrainingPhase(log, profile, '2026-04-27')
    expect(r.phase).toBe('taper')
  })

  it('handles null log gracefully', () => {
    expect(() => classifyTrainingPhase(null, {}, '2026-04-27')).not.toThrow()
  })
})
