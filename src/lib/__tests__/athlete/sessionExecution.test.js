// src/lib/__tests__/athlete/sessionExecution.test.js
//
// v9.89.0 — Tests for computeSessionExecution
import { describe, it, expect } from 'vitest'
import {
  computeSessionExecution,
  EXECUTION_STATUS_LABEL,
  EXECUTION_STATUS_COLOR,
  getExecutionImplication,
} from '../../athlete/sessionExecution.js'

describe('computeSessionExecution', () => {
  it('returns null when either input is missing', () => {
    expect(computeSessionExecution(null, { duration: 50 })).toBeNull()
    expect(computeSessionExecution({ duration: 50 }, null)).toBeNull()
    expect(computeSessionExecution(null, null)).toBeNull()
  })

  it('returns null when planned session has no duration (rest day)', () => {
    expect(computeSessionExecution({ duration: 0 }, { duration: 30 })).toBeNull()
    expect(computeSessionExecution({}, { duration: 30 })).toBeNull()
  })

  it('returns null when logged duration is missing or zero', () => {
    expect(computeSessionExecution({ duration: 50 }, { duration: 0 })).toBeNull()
    expect(computeSessionExecution({ duration: 50 }, {})).toBeNull()
  })

  it('flags on-target when duration within ±15% and RPE within ±1', () => {
    const out = computeSessionExecution(
      { duration: 60, rpe: 7 },
      { duration: 62, rpe: 7 }
    )
    expect(out).not.toBeNull()
    expect(out.status).toBe('on-target')
    expect(out.duration.planned).toBe(60)
    expect(out.duration.logged).toBe(62)
    expect(out.duration.deltaMin).toBe(2)
  })

  it('flags over when duration > 115% planned', () => {
    const out = computeSessionExecution(
      { duration: 60, rpe: 7 },
      { duration: 75, rpe: 7 }
    )
    expect(out.status).toBe('over')
  })

  it('flags under when duration in [50%, 85%) of planned', () => {
    const out = computeSessionExecution(
      { duration: 60, rpe: 7 },
      { duration: 40, rpe: 7 }
    )
    expect(out.status).toBe('under')
  })

  it('flags incomplete when duration < 50% of planned', () => {
    const out = computeSessionExecution(
      { duration: 60, rpe: 7 },
      { duration: 20, rpe: 7 }
    )
    expect(out.status).toBe('incomplete')
  })

  it('flags over when RPE exceeds planned + 1 even if duration on-target', () => {
    const out = computeSessionExecution(
      { duration: 60, rpe: 6 },
      { duration: 60, rpe: 9 }
    )
    expect(out.status).toBe('over')
    expect(out.rpe.delta).toBe(3)
  })

  it('flags under when RPE below planned - 1 and duration on-target', () => {
    const out = computeSessionExecution(
      { duration: 60, rpe: 8 },
      { duration: 60, rpe: 5 }
    )
    expect(out.status).toBe('under')
  })

  it('treats RPE undershoot during overshooting duration as on-target', () => {
    // Athlete ran longer at easier RPE — the duration overshoot already
    // covers the deviation; don't double-flag.
    const out = computeSessionExecution(
      { duration: 60, rpe: 8 },
      { duration: 80, rpe: 6 }  // duration 133% → over takes priority
    )
    expect(out.status).toBe('over')
  })

  it('omits rpe block when planned RPE is missing', () => {
    const out = computeSessionExecution(
      { duration: 60 },
      { duration: 60, rpe: 7 }
    )
    expect(out).not.toBeNull()
    expect(out.rpe).toBeUndefined()
  })

  it('omits rpe block when logged RPE is missing', () => {
    const out = computeSessionExecution(
      { duration: 60, rpe: 7 },
      { duration: 60 }
    )
    expect(out).not.toBeNull()
    expect(out.rpe).toBeUndefined()
  })

  it('computes TSS deltas when both sides have it (targetTSS form)', () => {
    const out = computeSessionExecution(
      { duration: 60, targetTSS: 80 },
      { duration: 62, tss: 88 }
    )
    expect(out.tss).toEqual({
      planned:  80,
      logged:   88,
      delta:    8,
      deltaPct: 0.1,
    })
  })

  it('computes TSS deltas when planned uses tss directly', () => {
    const out = computeSessionExecution(
      { duration: 60, tss: 80 },
      { duration: 60, tss: 80 }
    )
    expect(out.tss.delta).toBe(0)
  })

  it('omits tss block when either side missing', () => {
    expect(computeSessionExecution({ duration: 60 }, { duration: 60, tss: 80 }).tss).toBeUndefined()
    expect(computeSessionExecution({ duration: 60, tss: 80 }, { duration: 60 }).tss).toBeUndefined()
  })

  it('rounds deltaMin to one decimal place', () => {
    const out = computeSessionExecution(
      { duration: 60 },
      { duration: 62.345 }
    )
    expect(out.duration.deltaMin).toBe(2.3)
  })

  it('exposes consistent status labels and colors', () => {
    expect(EXECUTION_STATUS_LABEL['on-target'].en).toBe('on target')
    expect(EXECUTION_STATUS_LABEL['on-target'].tr).toBe('hedefte')
    expect(EXECUTION_STATUS_LABEL.over.tr).toBe('plan üstü')
    expect(EXECUTION_STATUS_LABEL.under.tr).toBe('plan altı')
    expect(EXECUTION_STATUS_LABEL.incomplete.tr).toBe('eksik')
    expect(EXECUTION_STATUS_COLOR['on-target']).toBe('#5bc25b')
    expect(EXECUTION_STATUS_COLOR.incomplete).toBe('#e03030')
  })

  it('boundary durations classify by strict-less-than thresholds', () => {
    // 30/60 = 50%. The function uses `loggedDur < plannedDur * 0.50`, so
    // exactly at 50% is NOT incomplete — it's under (since 30 < 0.85*60=51).
    const at50 = computeSessionExecution({ duration: 60, rpe: 7 }, { duration: 30, rpe: 7 })
    expect(at50.status).toBe('under')

    // 51/60 = 85%. `loggedDur < plannedDur * 0.85` is `51 < 51` = false, so
    // exactly at 85% is NOT under — it's on-target.
    const at85 = computeSessionExecution({ duration: 60, rpe: 7 }, { duration: 51, rpe: 7 })
    expect(at85.status).toBe('on-target')

    // Just-under: 50/60 ≈ 83.3% < 85% → under.
    const justUnder = computeSessionExecution({ duration: 60, rpe: 7 }, { duration: 50, rpe: 7 })
    expect(justUnder.status).toBe('under')

    // 69/60 = 115%. `loggedDur > plannedDur * 1.15` is `69 > 69` = false, so
    // exactly at 115% is NOT over — it's on-target.
    const at115 = computeSessionExecution({ duration: 60, rpe: 7 }, { duration: 69, rpe: 7 })
    expect(at115.status).toBe('on-target')

    // 70/60 ≈ 117% > 115% → over.
    const justOver = computeSessionExecution({ duration: 60, rpe: 7 }, { duration: 70, rpe: 7 })
    expect(justOver.status).toBe('over')
  })
})

// v9.140 — implication mapping
describe('getExecutionImplication', () => {
  it('returns null for null input', () => {
    expect(getExecutionImplication(null)).toBeNull()
  })

  it('returns null for on-target status (no banner needed)', () => {
    const exec = computeSessionExecution({ duration: 60, rpe: 6 }, { duration: 62, rpe: 6 })
    expect(exec.status).toBe('on-target')
    expect(getExecutionImplication(exec)).toBeNull()
  })

  it('returns recovery-debt sentence + Banister citation for over', () => {
    const exec = computeSessionExecution({ duration: 60, rpe: 6 }, { duration: 90, rpe: 6 })
    expect(exec.status).toBe('over')
    const imp = getExecutionImplication(exec)
    expect(imp.en).toMatch(/recovery debt/i)
    expect(imp.tr).toMatch(/toparlanma borcu/i)
    expect(imp.citation).toMatch(/Banister/)
  })

  it('returns no-cost sentence for under', () => {
    const exec = computeSessionExecution({ duration: 60, rpe: 6 }, { duration: 45, rpe: 6 })
    expect(exec.status).toBe('under')
    const imp = getExecutionImplication(exec)
    expect(imp.en).toMatch(/no recovery cost/i)
    expect(imp.tr).toMatch(/maliyeti yok/i)
    expect(imp.citation).toBeUndefined()
  })

  it('returns adherence-over-cramming sentence for incomplete', () => {
    const exec = computeSessionExecution({ duration: 60, rpe: 6 }, { duration: 20, rpe: 6 })
    expect(exec.status).toBe('incomplete')
    const imp = getExecutionImplication(exec)
    expect(imp.en).toMatch(/adherence over cramming/i)
    expect(imp.tr).toMatch(/süreklilik/i)
  })

  it('handles RPE-bumped over status', () => {
    // Duration on target but RPE went way over → status flips to over via RPE bump
    const exec = computeSessionExecution({ duration: 60, rpe: 5 }, { duration: 60, rpe: 9 })
    expect(exec.status).toBe('over')
    const imp = getExecutionImplication(exec)
    expect(imp).not.toBeNull()
    expect(imp.citation).toMatch(/Banister/)
  })
})
