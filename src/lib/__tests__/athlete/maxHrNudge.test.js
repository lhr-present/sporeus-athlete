// @vitest-environment jsdom
// v9.471.0 — max-HR nudge detector tests (E5a).

import { describe, it, expect, beforeEach } from 'vitest'
import { detectNewMaxHr, isMaxHrNudgeDismissed, dismissMaxHrNudge } from '../../athlete/maxHrNudge.js'

const P = { maxhr: '185' }
const hrSession = (maxHR, avgHR = 150, date = '2026-07-01') => ({ date, maxHR, avgHR })

describe('detectNewMaxHr', () => {
  it('fires when a real HR session exceeds profile max by >=2 bpm', () => {
    const hit = detectNewMaxHr([hrSession(190)], P)
    expect(hit).toEqual({ observedMax: 190, entryDate: '2026-07-01' })
  })
  it('picks the highest across sessions', () => {
    const hit = detectNewMaxHr([hrSession(188, 150, '2026-06-01'), hrSession(193, 160, '2026-06-20'), hrSession(190)], P)
    expect(hit.observedMax).toBe(193)
    expect(hit.entryDate).toBe('2026-06-20')
  })
  it('null when within noise threshold (<2 bpm above)', () => {
    expect(detectNewMaxHr([hrSession(186)], P)).toBeNull()
    expect(detectNewMaxHr([hrSession(185)], P)).toBeNull()
  })
  it('ignores entries without avgHR (maxHR spike with no HR-session context)', () => {
    expect(detectNewMaxHr([{ date: '2026-07-01', maxHR: 200 }], P)).toBeNull()
  })
  it('ignores implausible values (maxHR < avgHR, or > 250)', () => {
    expect(detectNewMaxHr([{ date: '2026-07-01', maxHR: 140, avgHR: 150 }], P)).toBeNull()
    expect(detectNewMaxHr([{ date: '2026-07-01', maxHR: 260, avgHR: 150 }], P)).toBeNull()
  })
  it('null when profile has no maxhr (ProfileCompletenessNudge owns that case)', () => {
    expect(detectNewMaxHr([hrSession(190)], {})).toBeNull()
    expect(detectNewMaxHr([hrSession(190)], { maxhr: '' })).toBeNull()
  })
  it('null on empty/absent log', () => {
    expect(detectNewMaxHr([], P)).toBeNull()
    expect(detectNewMaxHr(null, P)).toBeNull()
  })
})

describe('dismissal (per observed value)', () => {
  beforeEach(() => localStorage.clear())
  it('dismissing a value suppresses it and lower values, re-nudges on higher', () => {
    expect(isMaxHrNudgeDismissed(190)).toBe(false)
    dismissMaxHrNudge(190)
    expect(isMaxHrNudgeDismissed(190)).toBe(true)
    expect(isMaxHrNudgeDismissed(188)).toBe(true)
    expect(isMaxHrNudgeDismissed(193)).toBe(false)
  })
})
