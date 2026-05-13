// v9.107.0 (Prompt LL) — training streak tests.

import { describe, it, expect } from 'vitest'
import { computeTrainingStreak } from '../../athlete/trainingStreak.js'

const TODAY = '2026-05-14'
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function e(date, tss = 50) { return { date, tss } }

describe('computeTrainingStreak', () => {
  it('returns zeros for empty log', () => {
    expect(computeTrainingStreak([], TODAY)).toEqual({ current: 0, longest: 0, lastDate: null })
    expect(computeTrainingStreak(null, TODAY).current).toBe(0)
  })

  it('counts a single-day streak when today has training', () => {
    const log = [e(TODAY)]
    const out = computeTrainingStreak(log, TODAY)
    expect(out.current).toBe(1)
    expect(out.longest).toBe(1)
    expect(out.lastDate).toBe(TODAY)
  })

  it('counts a 5-day streak ending today', () => {
    const log = [-4, -3, -2, -1, 0].map(d => e(addDays(TODAY, d)))
    const out = computeTrainingStreak(log, TODAY)
    expect(out.current).toBe(5)
    expect(out.longest).toBe(5)
  })

  it('allows one-day grace when today has no entry but yesterday does', () => {
    const log = [-3, -2, -1].map(d => e(addDays(TODAY, d)))
    const out = computeTrainingStreak(log, TODAY)
    expect(out.current).toBe(3)
  })

  it('breaks streak when neither today nor yesterday has training', () => {
    const log = [-5, -4, -3].map(d => e(addDays(TODAY, d)))
    const out = computeTrainingStreak(log, TODAY)
    expect(out.current).toBe(0)
    expect(out.longest).toBe(3)
  })

  it('breaks current streak on a missed mid-day', () => {
    // -3, -2, missing -1, today
    const log = [e(addDays(TODAY, -3)), e(addDays(TODAY, -2)), e(TODAY)]
    const out = computeTrainingStreak(log, TODAY)
    expect(out.current).toBe(1)
    expect(out.longest).toBe(2)
  })

  it('finds the longest streak even when current is shorter', () => {
    // 4-day run at -10..-7, then gap, then 2-day run ending today
    const log = [
      ...[-10, -9, -8, -7].map(d => e(addDays(TODAY, d))),
      ...[-1, 0].map(d => e(addDays(TODAY, d))),
    ]
    const out = computeTrainingStreak(log, TODAY)
    expect(out.current).toBe(2)
    expect(out.longest).toBe(4)
  })

  it('treats tss=0 entries as not-trained (placeholder logs)', () => {
    const log = [
      { date: addDays(TODAY, -2), tss: 50 },
      { date: addDays(TODAY, -1), tss: 0 },
      { date: TODAY, tss: 50 },
    ]
    const out = computeTrainingStreak(log, TODAY)
    expect(out.current).toBe(1)  // -1 breaks because tss=0
    expect(out.longest).toBe(1)
  })

  it('deduplicates multiple sessions on the same day', () => {
    const log = [
      { date: TODAY, tss: 50 },
      { date: TODAY, tss: 80 },
      { date: addDays(TODAY, -1), tss: 60 },
      { date: addDays(TODAY, -1), tss: 40 },
    ]
    const out = computeTrainingStreak(log, TODAY)
    expect(out.current).toBe(2)
  })

  it('tolerates malformed entries', () => {
    const log = [
      e(TODAY),
      { date: null, tss: 50 },
      { date: 'not-a-date', tss: 50 },
      { tss: 50 },
      e(addDays(TODAY, -1)),
    ]
    const out = computeTrainingStreak(log, TODAY)
    expect(out.current).toBe(2)
  })

  it('lastDate reflects the most recent qualifying entry', () => {
    const log = [
      e(addDays(TODAY, -5)),
      e(addDays(TODAY, -2)),
      e(addDays(TODAY, -10)),
    ]
    const out = computeTrainingStreak(log, TODAY)
    expect(out.lastDate).toBe(addDays(TODAY, -2))
  })

  it('handles a long history with one current-day entry', () => {
    const log = []
    for (let i = 1; i <= 100; i++) log.push(e(addDays(TODAY, -i - 5)))
    log.push(e(TODAY))
    const out = computeTrainingStreak(log, TODAY)
    expect(out.current).toBe(1)
    expect(out.longest).toBe(100)
  })

  it('respects custom today parameter', () => {
    const log = [-2, -1, 0].map(d => e(addDays('2026-04-01', d)))
    const out = computeTrainingStreak(log, '2026-04-01')
    expect(out.current).toBe(3)
  })
})
