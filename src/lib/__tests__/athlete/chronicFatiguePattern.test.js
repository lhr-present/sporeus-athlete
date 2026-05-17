// ─── chronicFatiguePattern.test.js — v9.203.0 ──────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  detectChronicFatiguePattern,
  CHRONIC_FATIGUE_CITATION,
  WINDOW_DAYS,
  LOW_DAY_THRESHOLD,
  LOW_SCORE_CUTOFF,
} from '../../athlete/chronicFatiguePattern.js'

const TODAY = '2026-05-07'

function entry(date, score, source = 'quick-tap') {
  return { date, score, source, id: `${date}-${score}` }
}

describe('detectChronicFatiguePattern', () => {
  it('exports the expected constants', () => {
    expect(WINDOW_DAYS).toBe(7)
    expect(LOW_DAY_THRESHOLD).toBe(3)
    expect(LOW_SCORE_CUTOFF).toBe(30)
    expect(CHRONIC_FATIGUE_CITATION).toMatch(/Halson/)
  })

  it('null/empty/non-array input → not chronic, zero counts', () => {
    expect(detectChronicFatiguePattern(null, TODAY)).toEqual({
      isChronic: false, lowDayCount: 0, daysExamined: 0, lastLowDate: null,
    })
    expect(detectChronicFatiguePattern([], TODAY)).toEqual({
      isChronic: false, lowDayCount: 0, daysExamined: 0, lastLowDate: null,
    })
    expect(detectChronicFatiguePattern(undefined, TODAY).isChronic).toBe(false)
  })

  it('single low day does NOT trip the threshold', () => {
    const recovery = [entry('2026-05-07', 25)]
    const r = detectChronicFatiguePattern(recovery, TODAY)
    expect(r.isChronic).toBe(false)
    expect(r.lowDayCount).toBe(1)
  })

  it('two low days does NOT trip (need ≥3)', () => {
    const recovery = [
      entry('2026-05-07', 25),
      entry('2026-05-06', 30),
    ]
    expect(detectChronicFatiguePattern(recovery, TODAY).isChronic).toBe(false)
  })

  it('three low days within the 7-day window DOES trip', () => {
    const recovery = [
      entry('2026-05-07', 25),
      entry('2026-05-05', 30),
      entry('2026-05-04', 20),
    ]
    const r = detectChronicFatiguePattern(recovery, TODAY)
    expect(r.isChronic).toBe(true)
    expect(r.lowDayCount).toBe(3)
    expect(r.lastLowDate).toBe('2026-05-07')
  })

  it('boundary: score=30 counts as low (≤ threshold)', () => {
    const recovery = [
      entry('2026-05-07', 30),
      entry('2026-05-06', 30),
      entry('2026-05-05', 30),
    ]
    expect(detectChronicFatiguePattern(recovery, TODAY).isChronic).toBe(true)
  })

  it('boundary: score=31 does NOT count (> threshold)', () => {
    const recovery = [
      entry('2026-05-07', 31),
      entry('2026-05-06', 31),
      entry('2026-05-05', 31),
    ]
    expect(detectChronicFatiguePattern(recovery, TODAY).isChronic).toBe(false)
  })

  it('low days outside the 7-day window are ignored', () => {
    const recovery = [
      entry('2026-05-07', 25),   // in window
      entry('2026-04-15', 25),   // ~22 days back, outside window
      entry('2026-04-10', 25),   // outside
    ]
    expect(detectChronicFatiguePattern(recovery, TODAY).isChronic).toBe(false)
  })

  it('multiple entries on the same day are de-duplicated', () => {
    const recovery = [
      entry('2026-05-07', 25, 'quick-tap'),
      entry('2026-05-07', 28, 'quick-tap'),
      entry('2026-05-07', 22, 'quick-tap'),
    ]
    const r = detectChronicFatiguePattern(recovery, TODAY)
    expect(r.lowDayCount).toBe(1)   // one calendar day, not three entries
    expect(r.isChronic).toBe(false)
  })

  it('future-dated entries are skipped', () => {
    const recovery = [
      entry('2026-05-07', 25),
      entry('2026-05-15', 25),  // future
      entry('2026-05-20', 25),  // future
    ]
    expect(detectChronicFatiguePattern(recovery, TODAY).lowDayCount).toBe(1)
  })

  it('non-finite scores are skipped (string / undefined)', () => {
    const recovery = [
      { date: '2026-05-07', score: 'drained' },
      { date: '2026-05-06', score: undefined },
      entry('2026-05-05', 20),
    ]
    expect(detectChronicFatiguePattern(recovery, TODAY).lowDayCount).toBe(1)
  })

  it('full-wellness-form entries also count (any source) when score is the 0-100 form', () => {
    // Quick-tap source not required — the detector reads `score` regardless
    // (so future surfaces using the same key wire automatically).
    const recovery = [
      entry('2026-05-07', 25, 'wellness-form'),
      entry('2026-05-06', 28, 'wellness-form'),
      entry('2026-05-05', 22, 'wellness-form'),
    ]
    expect(detectChronicFatiguePattern(recovery, TODAY).isChronic).toBe(true)
  })

  it('lastLowDate is the most recent low day, not necessarily today', () => {
    const recovery = [
      entry('2026-05-04', 20),
      entry('2026-05-03', 20),
      entry('2026-05-02', 20),
    ]
    const r = detectChronicFatiguePattern(recovery, TODAY)
    expect(r.isChronic).toBe(true)
    expect(r.lastLowDate).toBe('2026-05-04')
  })

  it('defaults today to current date when omitted', () => {
    // Just confirm no crash + reasonable shape
    const r = detectChronicFatiguePattern([])
    expect(r).toHaveProperty('isChronic')
    expect(r.isChronic).toBe(false)
  })
})
