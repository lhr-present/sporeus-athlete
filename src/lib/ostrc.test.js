// src/lib/ostrc.test.js — OSTRC-Q2 pure function tests
import { describe, it, expect } from 'vitest'
import { ostrcScore, ostrcRisk, isoWeekKey } from './ostrc.js'

// ── ostrcScore ────────────────────────────────────────────────────────────────
describe('ostrcScore', () => {
  it('returns 0 for all-zero answers', () => {
    expect(ostrcScore([0, 0, 0, 0])).toBe(0)
  })

  it('returns 100 for all-max answers', () => {
    expect(ostrcScore([25, 25, 25, 25])).toBe(100)
  })

  it('sums mixed values correctly', () => {
    expect(ostrcScore([6, 13, 6, 0])).toBe(25)
  })

  it('handles undefined answers as 0', () => {
    expect(ostrcScore([undefined, 13, undefined, 6])).toBe(19)
  })

  it('handles single-element array', () => {
    expect(ostrcScore([19])).toBe(19)
  })
})

// ── ostrcRisk ─────────────────────────────────────────────────────────────────
describe('ostrcRisk', () => {
  it('returns none for score 0', () => {
    expect(ostrcRisk(0)).toBe('none')
  })

  it('returns minor for score 1', () => {
    expect(ostrcRisk(1)).toBe('minor')
  })

  it('returns minor at boundary score 25', () => {
    expect(ostrcRisk(25)).toBe('minor')
  })

  it('returns moderate for score 26', () => {
    expect(ostrcRisk(26)).toBe('moderate')
  })

  it('returns moderate at boundary score 50', () => {
    expect(ostrcRisk(50)).toBe('moderate')
  })

  it('returns substantial for score 51', () => {
    expect(ostrcRisk(51)).toBe('substantial')
  })

  it('returns substantial for max score 100', () => {
    expect(ostrcRisk(100)).toBe('substantial')
  })
})

// ── isoWeekKey ────────────────────────────────────────────────────────────────
describe('isoWeekKey', () => {
  it('returns string matching YYYY-Www format', () => {
    expect(isoWeekKey()).toMatch(/^\d{4}-W\d{2}$/)
  })

  it('returns W02 for Jan 5 2026 (first Monday of ISO week 2)', () => {
    expect(isoWeekKey(new Date('2026-01-05'))).toBe('2026-W02')
  })

  it('returns W01 for Jan 1 2026 (Thursday — in week 1)', () => {
    expect(isoWeekKey(new Date('2026-01-01'))).toBe('2026-W01')
  })

  it('returns W15 for Apr 12 2026', () => {
    // Apr 12 is Sunday → it's in week 15 (Mon Apr 6 – Sun Apr 12)
    expect(isoWeekKey(new Date('2026-04-12'))).toBe('2026-W15')
  })

  it('is stable within the same week (Mon–Sun)', () => {
    const mon = isoWeekKey(new Date('2026-04-06'))
    const sun = isoWeekKey(new Date('2026-04-12'))
    expect(mon).toBe(sun)
  })

  it('increments across week boundary', () => {
    const sun = isoWeekKey(new Date('2026-04-12'))
    const mon = isoWeekKey(new Date('2026-04-13'))
    const [, w1] = sun.split('-W')
    const [, w2] = mon.split('-W')
    expect(Number(w2)).toBe(Number(w1) + 1)
  })
})
