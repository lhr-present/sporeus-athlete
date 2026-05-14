// v9.109.0 (Prompt TT) — comeback detector tests.

import { describe, it, expect } from 'vitest'
import { detectComebackGap } from '../../athlete/comebackDetector.js'

const TODAY = '2026-05-14'
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function fillTraining(startISO, days, tss = 60) {
  const out = []
  for (let i = 0; i < days; i++) {
    out.push({ date: addDays(startISO, i), tss })
  }
  return out
}

describe('detectComebackGap', () => {
  it('returns not-comeback for empty log', () => {
    const out = detectComebackGap([], TODAY)
    expect(out.isComeback).toBe(false)
    expect(out.lastDate).toBeNull()
    expect(out.gapDays).toBe(0)
  })

  it('returns not-comeback when last session is recent', () => {
    const log = fillTraining(addDays(TODAY, -20), 14)  // last session 7 days ago
    const out = detectComebackGap(log, TODAY)
    expect(out.isComeback).toBe(false)
    expect(out.gapDays).toBe(7)
  })

  it('flags comeback at exactly 14d gap with enough prior CTL', () => {
    // 21 days of training ending 14 days ago — builds CTL above floor.
    // fillTraining(start, n) emits dates [start, start+1, ..., start+n-1]
    // so to end at day -14 we start at day -34.
    const log = fillTraining(addDays(TODAY, -34), 21, 70)
    const out = detectComebackGap(log, TODAY)
    expect(out.isComeback).toBe(true)
    expect(out.gapDays).toBe(14)
    expect(out.priorCTL).toBeGreaterThan(10)
    expect(out.easedCTL).toBe(Math.round(out.priorCTL * 0.5))
  })

  it('does not flag comeback below CTL floor (athlete was barely training)', () => {
    // Two single sessions over a month — prior CTL stays tiny
    const log = [
      { date: addDays(TODAY, -25), tss: 30 },
      { date: addDays(TODAY, -22), tss: 40 },
    ]
    const out = detectComebackGap(log, TODAY)
    expect(out.isComeback).toBe(false)
    expect(out.priorCTL).toBeLessThan(10)
  })

  it('does not flag comeback for gaps over 6 months (treat as fresh start)', () => {
    const log = fillTraining(addDays(TODAY, -240), 30, 80)
    const out = detectComebackGap(log, TODAY)
    expect(out.isComeback).toBe(false)
    expect(out.gapDays).toBeGreaterThan(180)
  })

  it('eased CTL is 50% of prior CTL', () => {
    const log = fillTraining(addDays(TODAY, -50), 28, 75)
    const out = detectComebackGap(log, TODAY)
    expect(out.isComeback).toBe(true)
    expect(out.easedCTL).toBeCloseTo(out.priorCTL * 0.5, 0)
  })

  it('handles malformed log entries gracefully', () => {
    const log = [
      { date: addDays(TODAY, -30), tss: 60 },
      { /* no date */ tss: 40 },
      'not an object',
      { date: null, tss: 50 },
    ]
    const out = detectComebackGap(log, TODAY)
    expect(out.gapDays).toBe(30)
    // priorCTL from a single 60-TSS session is below floor
    expect(out.isComeback).toBe(false)
  })

  it('lastDate reflects the most recent qualifying entry', () => {
    const log = [
      { date: '2026-04-15', tss: 60 },
      { date: '2026-04-22', tss: 80 },
      { date: '2026-04-10', tss: 70 },
    ]
    const out = detectComebackGap(log, TODAY)
    expect(out.lastDate).toBe('2026-04-22')
  })

  it('respects custom today parameter', () => {
    const log = fillTraining('2026-03-01', 21, 80)
    const out = detectComebackGap(log, '2026-04-15')
    expect(out.isComeback).toBe(true)
    expect(out.gapDays).toBeGreaterThan(14)
  })
})
