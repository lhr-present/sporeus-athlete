// src/lib/__tests__/athlete/derivedSessionTargets.test.js
//
// v9.91.0 — Tests for derivedSessionTargets
import { describe, it, expect } from 'vitest'
import {
  deriveSessionPace,
  deriveSessionPower,
  deriveSessionTargets,
} from '../../athlete/derivedSessionTargets.js'

describe('deriveSessionPace', () => {
  it('returns null when session or profile is missing', () => {
    expect(deriveSessionPace(null, { threshold: '4:30' })).toBeNull()
    expect(deriveSessionPace({ zone: 'Z4' }, null)).toBeNull()
  })

  it('returns null when profile.threshold is unset or invalid', () => {
    expect(deriveSessionPace({ zone: 'Z4' }, {})).toBeNull()
    expect(deriveSessionPace({ zone: 'Z4' }, { threshold: '' })).toBeNull()
    expect(deriveSessionPace({ zone: 'Z4' }, { threshold: 'not a pace' })).toBeNull()
    expect(deriveSessionPace({ zone: 'Z4' }, { threshold: '99:99' })).toBeNull()
  })

  it('returns null when zone cannot be inferred', () => {
    expect(deriveSessionPace({ type: 'Easy run' }, { threshold: '4:30' })).toBeNull()
    expect(deriveSessionPace({ zone: 'Z9' }, { threshold: '4:30' })).toBeNull()
    expect(deriveSessionPace({ zones: { Z1: 0, Z2: 0 } }, { threshold: '4:30' })).toBeNull()
  })

  it('threshold (Z4) pace ≈ threshold itself', () => {
    const p = deriveSessionPace({ zone: 'Z4' }, { threshold: '4:30' })
    // Z4: offset is ±5s, so range is 4:25–4:35
    expect(p).toBe('4:25–4:35')
  })

  it('easy (Z1) pace is 60-90s slower than threshold', () => {
    const p = deriveSessionPace({ zone: 'Z1' }, { threshold: '4:30' })
    // Z1: T + 60–90s → 5:30–6:00
    expect(p).toBe('5:30–6:00')
  })

  it('marathon (Z2) pace is 20-35s slower than threshold', () => {
    const p = deriveSessionPace({ zone: 'Z2' }, { threshold: '4:30' })
    // Z2: T + 20–35s → 4:50–5:05
    expect(p).toBe('4:50–5:05')
  })

  it('tempo (Z3) pace is 8-15s slower than threshold', () => {
    const p = deriveSessionPace({ zone: 'Z3' }, { threshold: '4:30' })
    // Z3: T + 8–15s → 4:38–4:45
    expect(p).toBe('4:38–4:45')
  })

  it('VO2max (Z5) pace is 8-15s faster than threshold', () => {
    const p = deriveSessionPace({ zone: 'Z5' }, { threshold: '4:30' })
    // Z5: T − 8 to −15s → 4:15–4:22
    expect(p).toBe('4:15–4:22')
  })

  it('rep (Z6) pace is 18-30s faster than threshold', () => {
    const p = deriveSessionPace({ zone: 'Z6' }, { threshold: '4:30' })
    // Z6: T − 18 to −30s → 4:00–4:12
    expect(p).toBe('4:00–4:12')
  })

  it('picks dominant zone from zones object (Z5 wins over Z1)', () => {
    // VO2max session: warm-up Z1 30min + Z5 15min
    const p = deriveSessionPace(
      { zones: { Z1: 30, Z2: 0, Z3: 0, Z4: 0, Z5: 15 } },
      { threshold: '4:30' }
    )
    expect(p).toBe('4:15–4:22')  // Z5
  })

  it('falls back to lower zone when no high-intensity present', () => {
    const p = deriveSessionPace(
      { zones: { Z1: 60, Z2: 10, Z3: 0, Z4: 0, Z5: 0 } },
      { threshold: '4:30' }
    )
    expect(p).toBe('4:50–5:05')  // Z2
  })

  it('returns null for cycling-flagged session (use deriveSessionPower)', () => {
    expect(deriveSessionPace({ zone: 'Z4', type: 'Bike intervals' }, { threshold: '4:30' })).toBeNull()
    expect(deriveSessionPace({ zone: 'Z4' }, { threshold: '4:30', primarySport: 'cycling' })).toBeNull()
  })

  it('case-insensitive zone match', () => {
    expect(deriveSessionPace({ zone: 'z4' }, { threshold: '4:30' })).toBe('4:25–4:35')
  })

  it('handles seconds rollover (59 → 60)', () => {
    // threshold 5:00, Z1 → +60..90s → 6:00–6:30 (60 rollover to 6:00 not 5:60)
    const p = deriveSessionPace({ zone: 'Z1' }, { threshold: '5:00' })
    expect(p).toBe('6:00–6:30')
  })
})

describe('deriveSessionPower', () => {
  it('returns null when session or profile is missing', () => {
    expect(deriveSessionPower(null, { ftp: 250 })).toBeNull()
    expect(deriveSessionPower({ zone: 'Z4' }, null)).toBeNull()
  })

  it('returns null when not a cycling session', () => {
    expect(deriveSessionPower({ zone: 'Z4', type: 'Easy run' }, { ftp: 250, primarySport: 'running' })).toBeNull()
  })

  it('returns null when ftp is unset or zero', () => {
    expect(deriveSessionPower({ zone: 'Z4', type: 'Bike intervals' }, {})).toBeNull()
    expect(deriveSessionPower({ zone: 'Z4', type: 'Bike intervals' }, { ftp: 0 })).toBeNull()
    expect(deriveSessionPower({ zone: 'Z4', type: 'Bike intervals' }, { ftp: 'nope' })).toBeNull()
  })

  it('Z4 (threshold) = 91-105% FTP', () => {
    const p = deriveSessionPower({ zone: 'Z4', type: 'Bike threshold' }, { ftp: 250 })
    // 250 * 0.91 = 227.5 → 228; 250 * 1.05 = 262.5 → 263
    expect(p).toBe('228–263W')
  })

  it('Z2 (endurance) = 56-75% FTP', () => {
    const p = deriveSessionPower({ zone: 'Z2', type: 'Bike endurance' }, { ftp: 250 })
    // 140–188W
    expect(p).toBe('140–188W')
  })

  it('Z5 (VO2) = 106-120% FTP', () => {
    const p = deriveSessionPower({ zone: 'Z5', type: 'Bike VO2' }, { ftp: 200 })
    // 200 * 1.06 = 212; 200 * 1.20 = 240
    expect(p).toBe('212–240W')
  })

  it('detects cycling via primarySport', () => {
    const p = deriveSessionPower({ zone: 'Z4', type: 'Intervals' }, { ftp: 200, primarySport: 'cycling' })
    expect(p).toBe('182–210W')
  })

  it('detects cycling via type keyword "ride"', () => {
    const p = deriveSessionPower({ zone: 'Z3', type: 'Tempo ride' }, { ftp: 200 })
    expect(p).toBe('152–180W')
  })
})

describe('deriveSessionTargets', () => {
  it('returns pace for runners (running profile, run session)', () => {
    const out = deriveSessionTargets({ zone: 'Z4' }, { threshold: '4:30', primarySport: 'running' })
    expect(out.paceTarget).toBe('4:25–4:35')
    expect(out.powerTarget).toBeNull()
  })

  it('returns power for cyclists', () => {
    const out = deriveSessionTargets({ zone: 'Z4', type: 'Bike intervals' }, { ftp: 250 })
    expect(out.paceTarget).toBeNull()
    expect(out.powerTarget).toBe('228–263W')
  })

  it('returns both null when physiology is unset', () => {
    const out = deriveSessionTargets({ zone: 'Z4' }, {})
    expect(out.paceTarget).toBeNull()
    expect(out.powerTarget).toBeNull()
  })
})
