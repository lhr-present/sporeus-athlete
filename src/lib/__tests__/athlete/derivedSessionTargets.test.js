// src/lib/__tests__/athlete/derivedSessionTargets.test.js
//
// v9.91.0 — Tests for derivedSessionTargets
import { describe, it, expect } from 'vitest'
import {
  deriveSessionPace,
  deriveSessionPower,
  deriveSessionSwimPace,
  deriveSessionHr,
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

// v9.98.0 — Swim CSS pace path (Prompt M)
describe('deriveSessionSwimPace', () => {
  it('returns null when session or profile is missing', () => {
    expect(deriveSessionSwimPace(null, { cssSec: 90 })).toBeNull()
    expect(deriveSessionSwimPace({ zone: 'Z3' }, null)).toBeNull()
  })

  it('returns null when session is not a swim', () => {
    expect(deriveSessionSwimPace({ zone: 'Z3', type: 'Tempo run' }, { cssSec: 90 })).toBeNull()
    expect(deriveSessionSwimPace({ zone: 'Z3' }, { cssSec: 90, primarySport: 'Running' })).toBeNull()
  })

  it('returns null when cssSec is unset / invalid', () => {
    expect(deriveSessionSwimPace({ zone: 'Z3', type: 'Long swim' }, {})).toBeNull()
    expect(deriveSessionSwimPace({ zone: 'Z3', type: 'Long swim' }, { cssSec: 0 })).toBeNull()
    expect(deriveSessionSwimPace({ zone: 'Z3', type: 'Long swim' }, { cssSec: 'nope' })).toBeNull()
  })

  it('Z3 (CSS) pace = 100-110% of CSS (the canonical threshold band)', () => {
    // CSS = 90s/100m → Z3 fast=90 (1:30), slow=99 (1:39)
    expect(deriveSessionSwimPace(
      { zone: 'Z3', type: 'Threshold swim' },
      { cssSec: 90 },
    )).toBe('1:30–1:39/100m')
  })

  it('Z5 (VO2max) is faster than CSS', () => {
    // CSS = 90 → Z5 fast=90*0.85=76.5≈77 (1:17), slow=90*0.95=85.5≈86 (1:26)
    const out = deriveSessionSwimPace(
      { zone: 'Z5', type: 'Interval swim' },
      { cssSec: 90 },
    )
    expect(out).toBe('1:17–1:26/100m')
  })

  it('Z1 (recovery) is slower than CSS (120-130%)', () => {
    // CSS = 90 → Z1 fast=90*1.20=108 (1:48), slow=90*1.30=117 (1:57)
    expect(deriveSessionSwimPace(
      { zone: 'Z1', type: 'Recovery swim' },
      { cssSec: 90 },
    )).toBe('1:48–1:57/100m')
  })

  it('detects swim via primarySport', () => {
    expect(deriveSessionSwimPace(
      { zone: 'Z3', type: 'Intervals' },
      { cssSec: 90, primarySport: 'Swimming' },
    )).toBe('1:30–1:39/100m')
  })

  it('detects swim via type keyword "swim"', () => {
    expect(deriveSessionSwimPace(
      { zone: 'Z4', type: 'Threshold swim' },
      { cssSec: 90 },
    )).toBe('1:26–1:30/100m')
  })

  it('handles seconds rollover (59 → 60)', () => {
    // CSS = 100 → Z3 fast=100 (1:40), slow=110 (1:50)
    expect(deriveSessionSwimPace(
      { zone: 'Z3', type: 'Swim' },
      { cssSec: 100 },
    )).toBe('1:40–1:50/100m')
  })

  it('case-insensitive zone match', () => {
    expect(deriveSessionSwimPace(
      { zone: 'z3', type: 'Swim' },
      { cssSec: 90 },
    )).toBe('1:30–1:39/100m')
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

  it('returns swim pace for swimmers (v9.98.0)', () => {
    const out = deriveSessionTargets(
      { zone: 'Z3', type: 'Threshold swim' },
      { cssSec: 90, primarySport: 'Swimming' },
    )
    expect(out.paceTarget).toBe('1:30–1:39/100m')
    expect(out.powerTarget).toBeNull()
  })

  it('paceTarget routes to swim path when sport is Swimming, not run pace', () => {
    // Swimmer with BOTH threshold (run) and cssSec set — swim path wins
    const out = deriveSessionTargets(
      { zone: 'Z3', type: 'Long swim' },
      { cssSec: 90, threshold: '4:30', primarySport: 'Swimming' },
    )
    expect(out.paceTarget).toMatch(/100m/)
  })
})

// v9.155.0 (Prompt 12) — HR target derivation
describe('deriveSessionHr', () => {
  it('returns null when maxhr is missing or out of range', () => {
    expect(deriveSessionHr({ zone: 'Z2' }, {})).toBeNull()
    expect(deriveSessionHr({ zone: 'Z2' }, { maxhr: 0 })).toBeNull()
    expect(deriveSessionHr({ zone: 'Z2' }, { maxhr: 50 })).toBeNull()    // <60 sanity
    expect(deriveSessionHr({ zone: 'Z2' }, { maxhr: 300 })).toBeNull()   // >250 sanity
    expect(deriveSessionHr({ zone: 'Z2' }, { maxhr: 'foo' })).toBeNull()
  })

  it('returns null when zone cannot be inferred', () => {
    expect(deriveSessionHr({}, { maxhr: 190 })).toBeNull()
    expect(deriveSessionHr({ zone: 'Z9' }, { maxhr: 190 })).toBeNull()
  })

  it('returns null for cycling sessions (power, not HR)', () => {
    expect(deriveSessionHr(
      { zone: 'Z3', type: 'Bike intervals' },
      { maxhr: 190 },
    )).toBeNull()
    expect(deriveSessionHr(
      { zone: 'Z3' },
      { maxhr: 190, primarySport: 'Cycling' },
    )).toBeNull()
  })

  it('returns null for swim sessions (CSS pace, not HR)', () => {
    expect(deriveSessionHr(
      { zone: 'Z3', type: 'Threshold swim' },
      { maxhr: 190 },
    )).toBeNull()
  })

  it('returns a band string for valid run zones', () => {
    // maxhr=190, Z2 → 75%-83% → 142-158
    expect(deriveSessionHr({ zone: 'Z2', type: 'Easy run' }, { maxhr: 190 })).toBe('143-158')
    // Z4 threshold → 88%-93% → 167-177
    expect(deriveSessionHr({ zone: 'Z4', type: 'Threshold' }, { maxhr: 190 })).toBe('167-177')
    // Z5 VO2 → 93%-98% → 177-186
    expect(deriveSessionHr({ zone: 'Z5', type: 'Intervals' }, { maxhr: 190 })).toBe('177-186')
  })

  it('handles per-minute zones object (intent-dominant)', () => {
    // VO2 session: mostly Z1 warm-up by minutes but Z5 is the prescription
    expect(deriveSessionHr(
      { zones: { Z1: 25, Z2: 0, Z3: 0, Z4: 0, Z5: 30 }, type: 'Intervals' },
      { maxhr: 190 },
    )).toBe('177-186')
  })
})

describe('deriveSessionTargets — hrTarget integration', () => {
  it('returns hrTarget alongside paceTarget for runners with both maxhr + threshold', () => {
    const out = deriveSessionTargets(
      { zone: 'Z4', type: 'Threshold run' },
      { maxhr: 190, threshold: '4:30', primarySport: 'Running' },
    )
    expect(out.paceTarget).toMatch(/^\d:\d{2}–\d:\d{2}$/)
    expect(out.hrTarget).toBe('167-177')
  })

  it('returns hrTarget=null for cyclists', () => {
    const out = deriveSessionTargets(
      { zone: 'Z3', type: 'Bike tempo' },
      { maxhr: 190, ftp: 250, primarySport: 'Cycling' },
    )
    expect(out.hrTarget).toBeNull()
  })

  it('returns hrTarget=null when maxhr missing even if threshold set', () => {
    const out = deriveSessionTargets(
      { zone: 'Z2', type: 'Easy run' },
      { threshold: '4:30' },
    )
    expect(out.paceTarget).not.toBeNull()
    expect(out.hrTarget).toBeNull()
  })
})

// v9.159.0 (Prompt E) — thresholdDerived fallback
describe('deriveSessionPace — thresholdDerived fallback', () => {
  it('uses thresholdDerived when threshold is empty', () => {
    const out = deriveSessionPace(
      { zone: 'Z4', type: 'Threshold' },
      { threshold: '', thresholdDerived: '4:30', primarySport: 'Running' },
    )
    expect(out).not.toBeNull()
    expect(out).toMatch(/^\d:\d{2}/)
  })

  it('user-set threshold wins over thresholdDerived', () => {
    const fromUser = deriveSessionPace(
      { zone: 'Z2', type: 'Easy' },
      { threshold: '4:00', thresholdDerived: '5:30', primarySport: 'Running' },
    )
    const fromDerived = deriveSessionPace(
      { zone: 'Z2', type: 'Easy' },
      { threshold: '', thresholdDerived: '5:30', primarySport: 'Running' },
    )
    expect(fromUser).not.toBe(fromDerived)
  })

  it('returns null when both threshold and thresholdDerived are empty', () => {
    expect(deriveSessionPace(
      { zone: 'Z2', type: 'Easy' },
      { threshold: '', thresholdDerived: '', primarySport: 'Running' },
    )).toBeNull()
  })
})

// v9.160.0 (Prompt F) — rowing dragFactor + zone label
import { deriveSessionRowingTarget } from '../../athlete/derivedSessionTargets.js'

describe('deriveSessionRowingTarget', () => {
  it('returns null for non-rowing sports', () => {
    expect(deriveSessionRowingTarget(
      { zone: 'Z3', type: 'Tempo run' },
      { dragFactor: 130, primarySport: 'Running' },
    )).toBeNull()
    expect(deriveSessionRowingTarget(
      { zone: 'Z3', type: 'FTP intervals' },
      { dragFactor: 130, primarySport: 'Cycling' },
    )).toBeNull()
  })

  it('detects rowing via primarySport', () => {
    const out = deriveSessionRowingTarget(
      { zone: 'Z3', type: 'Aerobic' },
      { dragFactor: 130, primarySport: 'Rowing' },
    )
    expect(out).not.toBeNull()
    expect(out.dragFactor).toBe(130)
    expect(out.zoneLabel).toBe('AT')
  })

  it('detects rowing via session type (erg keyword)', () => {
    const out = deriveSessionRowingTarget(
      { zone: 'Z4', type: 'Erg threshold' },
      { dragFactor: 130 },
    )
    expect(out).not.toBeNull()
    expect(out.zoneLabel).toBe('TR')
  })

  it('maps E13 zones to British Rowing labels', () => {
    const sess = (z) => ({ zone: z, type: 'Erg' })
    const prof = { dragFactor: 130 }
    expect(deriveSessionRowingTarget(sess('Z1'), prof).zoneLabel).toBe('UT2')
    expect(deriveSessionRowingTarget(sess('Z2'), prof).zoneLabel).toBe('UT1')
    expect(deriveSessionRowingTarget(sess('Z3'), prof).zoneLabel).toBe('AT')
    expect(deriveSessionRowingTarget(sess('Z4'), prof).zoneLabel).toBe('TR')
    expect(deriveSessionRowingTarget(sess('Z5'), prof).zoneLabel).toBe('2k')
  })

  it('omits dragFactor when outside the validated 80-220 range', () => {
    const sess = { zone: 'Z3', type: 'Erg' }
    expect(deriveSessionRowingTarget(sess, { dragFactor: 50 }).dragFactor).toBeNull()
    expect(deriveSessionRowingTarget(sess, { dragFactor: 250 }).dragFactor).toBeNull()
    expect(deriveSessionRowingTarget(sess, { dragFactor: 'foo' }).dragFactor).toBeNull()
  })

  it('flags dfNote = high_df above WRIC cap (>150)', () => {
    const out = deriveSessionRowingTarget(
      { zone: 'Z3', type: 'Erg' },
      { dragFactor: 160 },
    )
    expect(out.dfNote).toBe('high_df')
  })

  it('flags dfNote = low_df below junior threshold (<100)', () => {
    const out = deriveSessionRowingTarget(
      { zone: 'Z3', type: 'Erg' },
      { dragFactor: 90 },
    )
    expect(out.dfNote).toBe('low_df')
  })

  it('dfNote null for typical training range (100-150)', () => {
    const out = deriveSessionRowingTarget(
      { zone: 'Z3', type: 'Erg' },
      { dragFactor: 130 },
    )
    expect(out.dfNote).toBeNull()
  })

  it('returns null when neither dragFactor nor zoneLabel can be derived', () => {
    // Rowing session detected, but no DF + unparseable zone
    const out = deriveSessionRowingTarget(
      { zone: 'Z9', type: 'Erg' },
      { dragFactor: 50, primarySport: 'Rowing' },  // both invalid
    )
    expect(out).toBeNull()
  })

  it('returns object with zoneLabel only when dragFactor is absent', () => {
    const out = deriveSessionRowingTarget(
      { zone: 'Z2', type: 'Erg' },
      { primarySport: 'Rowing' },
    )
    expect(out).not.toBeNull()
    expect(out.dragFactor).toBeNull()
    expect(out.zoneLabel).toBe('UT1')
    expect(out.dfNote).toBeNull()
  })
})

// rowingTarget integration on the combined deriveSessionTargets
describe('deriveSessionTargets — rowingTarget integration', () => {
  it('exposes rowingTarget for rowing sessions', () => {
    const out = deriveSessionTargets(
      { zone: 'Z3', type: 'Erg AT' },
      { dragFactor: 130, primarySport: 'Rowing' },
    )
    expect(out.rowingTarget).not.toBeNull()
    expect(out.rowingTarget.dragFactor).toBe(130)
  })

  it('rowingTarget null for non-rowing sports', () => {
    const out = deriveSessionTargets(
      { zone: 'Z3', type: 'Threshold' },
      { dragFactor: 130, threshold: '4:30', primarySport: 'Running' },
    )
    expect(out.rowingTarget).toBeNull()
  })
})
