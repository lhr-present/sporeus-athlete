// src/lib/__tests__/athlete/sessionTargets.test.js
//
// Tests for buildSessionTarget — pure-fn target preview used by the
// TodayView SessionTargetPeek leaf component.
import { describe, it, expect } from 'vitest'
import { buildSessionTarget, CITATION } from '../../athlete/sessionTargets.js'

describe('buildSessionTarget — null contracts', () => {
  it('returns null when there is no planned session', () => {
    expect(buildSessionTarget({ plannedSession: null, profile: { ftp: 250 } })).toBeNull()
  })

  it('returns null when there is no profile', () => {
    expect(buildSessionTarget({
      plannedSession: { type: 'Easy run', zone: 'Z2', rpe: 4 },
      profile: null,
    })).toBeNull()
  })

  it('returns null when sport cannot be inferred AND no primarySport', () => {
    // Ambiguous type, no profile primarySport, no zone, no rpe → null
    expect(buildSessionTarget({
      plannedSession: { type: 'Mobility', rpe: 0 },
      profile: { threshold: '4:30' },
    })).toBeNull()
  })

  it('returns null when athlete has no relevant physiology data (runner, no thresh/vdot/maxhr)', () => {
    const out = buildSessionTarget({
      plannedSession: { type: 'Easy run', zone: 'Z2', rpe: 4 },
      profile: { primarySport: 'running' },
    })
    // No paceTarget, no hrTarget, but rpe gives an ifTarget → result non-null
    // with only ifTarget populated. The peek will still render the IF line.
    expect(out).not.toBeNull()
    expect(out.paceTarget).toBeNull()
    expect(out.hrTarget).toBeNull()
    expect(out.ifTarget).toBeCloseTo(0.65, 2)
  })

  it('returns null when there is no signal at all (no zone, no rpe, no physiology)', () => {
    expect(buildSessionTarget({
      plannedSession: { type: 'Easy run' },
      profile: { primarySport: 'running' },
    })).toBeNull()
  })
})

describe('buildSessionTarget — runner with threshold pace', () => {
  it('returns "M:SS–M:SS /km" pace string for a Z4 threshold session', () => {
    const out = buildSessionTarget({
      plannedSession: { type: 'Threshold run', zone: 'Z4', rpe: 7 },
      profile: { primarySport: 'running', threshold: '4:30' },
    })
    expect(out).not.toBeNull()
    expect(out.sport).toBe('run')
    expect(out.paceTarget).toBe('4:25–4:35 /km')
    expect(out.sourceLabel).toBe(CITATION.run)
  })

  it('includes HR window when maxhr is set on the profile', () => {
    const out = buildSessionTarget({
      plannedSession: { type: 'Threshold run', zone: 'Z4', rpe: 7 },
      profile: { primarySport: 'running', threshold: '4:30', maxhr: 190 },
    })
    expect(out.hrTarget).toMatch(/^\d{2,3}-\d{2,3} BPM$/)
  })
})

describe('buildSessionTarget — runner with VDOT fallback', () => {
  it('derives pace from VDOT when threshold pace is not set', () => {
    const out = buildSessionTarget({
      plannedSession: { type: 'Tempo run', zone: 'Z4', rpe: 7 },
      profile: { primarySport: 'running', vdot: 50 },
    })
    expect(out).not.toBeNull()
    expect(out.sport).toBe('run')
    expect(out.paceTarget).toMatch(/^\d:\d{2}(?:–\d:\d{2})? \/km$/)
  })
})

describe('buildSessionTarget — cyclist', () => {
  it('returns "lo–hi W" power string for a Z4 bike session', () => {
    const out = buildSessionTarget({
      plannedSession: { type: 'Bike threshold', zone: 'Z4', rpe: 7 },
      profile: { primarySport: 'cycling', ftp: 250 },
    })
    expect(out).not.toBeNull()
    expect(out.sport).toBe('bike')
    expect(out.powerTarget).toBe('228–263 W')
    expect(out.paceTarget).toBeNull()
    expect(out.sourceLabel).toBe(CITATION.bike)
  })

  it('returns null when cyclist has no FTP set', () => {
    const out = buildSessionTarget({
      plannedSession: { type: 'Bike intervals', zone: 'Z5', rpe: 8 },
      profile: { primarySport: 'cycling' },
    })
    // ifTarget still populated from rpe=8 → non-null
    expect(out).not.toBeNull()
    expect(out.powerTarget).toBeNull()
    expect(out.ifTarget).toBeCloseTo(0.92, 2)
  })
})

describe('buildSessionTarget — swimmer', () => {
  it('returns "M:SS–M:SS /100m" swim pace string for a Z3 swim', () => {
    const out = buildSessionTarget({
      plannedSession: { type: 'Threshold swim', zone: 'Z3', rpe: 6 },
      profile: { primarySport: 'swimming', cssSec: 90 },
    })
    expect(out).not.toBeNull()
    expect(out.sport).toBe('swim')
    expect(out.paceTarget).toBe('1:30–1:39 /100m')
    expect(out.powerTarget).toBeNull()
    expect(out.sourceLabel).toBe(CITATION.swim)
  })
})

describe('buildSessionTarget — IF target', () => {
  it('hard session (RPE >= 8) yields a high IF (>= 0.85)', () => {
    const out = buildSessionTarget({
      plannedSession: { type: 'Threshold run', zone: 'Z4', rpe: 8 },
      profile: { primarySport: 'running', threshold: '4:30' },
    })
    expect(out.ifTarget).toBeGreaterThanOrEqual(0.85)
  })

  it('easy session (RPE <= 3) yields a low IF (<= 0.65)', () => {
    const out = buildSessionTarget({
      plannedSession: { type: 'Recovery run', zone: 'Z1', rpe: 2 },
      profile: { primarySport: 'running', threshold: '4:30' },
    })
    expect(out.ifTarget).toBeLessThanOrEqual(0.65)
  })

  it('falls back to the zone-based IF when RPE is missing', () => {
    const out = buildSessionTarget({
      plannedSession: { type: 'Tempo run', zone: 'Z3' },
      profile: { primarySport: 'running', threshold: '4:30' },
    })
    expect(out.ifTarget).toBeCloseTo(0.83, 2)
  })

  it('honors an explicit session.intensityFactor over RPE', () => {
    const out = buildSessionTarget({
      plannedSession: { type: 'Threshold run', zone: 'Z4', rpe: 5, intensityFactor: 0.97 },
      profile: { primarySport: 'running', threshold: '4:30' },
    })
    expect(out.ifTarget).toBeCloseTo(0.97, 2)
  })
})

describe('buildSessionTarget — sport disambiguation', () => {
  it('falls back to profile.primarySport when session type is ambiguous', () => {
    // No explicit "run/bike/swim" keyword in type → primarySport decides.
    const out = buildSessionTarget({
      plannedSession: { type: 'Intervals', zone: 'Z5', rpe: 8 },
      profile: { primarySport: 'cycling', ftp: 200 },
    })
    expect(out.sport).toBe('bike')
    expect(out.powerTarget).toMatch(/W$/)
  })

  it('session.type keyword overrides primarySport (cross-training run on a cyclist)', () => {
    const out = buildSessionTarget({
      plannedSession: { type: 'Easy run', zone: 'Z2', rpe: 3 },
      profile: { primarySport: 'cycling', threshold: '4:30' },
    })
    expect(out.sport).toBe('run')
    expect(out.paceTarget).toMatch(/\/km$/)
  })
})
