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

// v9.153.0 (Prompt 8) — HR/pace delta blocks
describe('computeSessionExecution — HR delta', () => {
  it('omits hr block when planned has no hrTarget', () => {
    const out = computeSessionExecution(
      { duration: 60, rpe: 7 },
      { duration: 60, rpe: 7, avgHR: 152 }
    )
    expect(out.hr).toBeUndefined()
  })

  it('omits hr block when log has no avgHR', () => {
    const out = computeSessionExecution(
      { duration: 60, rpe: 7, hrTarget: 150 },
      { duration: 60, rpe: 7 }
    )
    expect(out.hr).toBeUndefined()
  })

  it('marks in-range when avgHR inside the planned band', () => {
    const out = computeSessionExecution(
      { duration: 60, rpe: 4, hrTarget: '140-160' },
      { duration: 60, rpe: 4, avgHR: 152 }
    )
    expect(out.hr.status).toBe('in-range')
    expect(out.hr.gap).toBe(0)
    expect(out.hr.plannedRange).toEqual([140, 160])
    expect(out.hr.planned).toBe(150)
    expect(out.hr.logged).toBe(152)
  })

  it('marks above when avgHR exceeds the upper band', () => {
    const out = computeSessionExecution(
      { duration: 60, rpe: 4, hrTarget: '140-160' },
      { duration: 60, rpe: 4, avgHR: 172 }
    )
    expect(out.hr.status).toBe('above')
    expect(out.hr.gap).toBe(12)
    expect(out.hr.delta).toBe(22)
  })

  it('marks below when avgHR under the lower band', () => {
    const out = computeSessionExecution(
      { duration: 60, rpe: 4, hrTarget: '140-160' },
      { duration: 60, rpe: 4, avgHR: 128 }
    )
    expect(out.hr.status).toBe('below')
    expect(out.hr.gap).toBe(-12)
  })

  it('treats single-value hrTarget as a degenerate band', () => {
    const out = computeSessionExecution(
      { duration: 60, hrTarget: 150 },
      { duration: 60, avgHR: 150 }
    )
    expect(out.hr.plannedRange).toBeNull()
    expect(out.hr.status).toBe('in-range')
  })

  it('handles malformed hrTarget by omitting the block', () => {
    const out = computeSessionExecution(
      { duration: 60, hrTarget: 'asdf' },
      { duration: 60, avgHR: 150 }
    )
    expect(out.hr).toBeUndefined()
  })
})

describe('computeSessionExecution — Pace delta', () => {
  it('omits pace block when planned has no paceTarget', () => {
    const out = computeSessionExecution(
      { duration: 60 },
      { duration: 60, distanceM: 10000, durationSec: 3300 }
    )
    expect(out.pace).toBeUndefined()
  })

  it('omits pace block when log has no distance/duration data', () => {
    const out = computeSessionExecution(
      { duration: 60, paceTarget: '5:30/km' },
      { duration: 60 }
    )
    expect(out.pace).toBeUndefined()
  })

  it('derives logged pace from distanceM + durationSec', () => {
    // 10km in 55 min = 330 sec/km = 5:30/km
    const out = computeSessionExecution(
      { duration: 55, paceTarget: '5:30/km' },
      { duration: 55, distanceM: 10000, durationSec: 3300 }
    )
    expect(out.pace.planned).toBe(330)
    expect(out.pace.logged).toBe(330)
    expect(out.pace.delta).toBe(0)
    expect(out.pace.status).toBe('on-target')
  })

  it('uses avgPaceSecKm when present (fileImport path)', () => {
    const out = computeSessionExecution(
      { duration: 60, paceTarget: '5:30/km' },
      { duration: 60, avgPaceSecKm: 320 }
    )
    expect(out.pace.logged).toBe(320)
    expect(out.pace.delta).toBe(-10)
    expect(out.pace.status).toBe('fast')
  })

  it('marks slow when logged pace >3% slower than planned', () => {
    const out = computeSessionExecution(
      { duration: 60, paceTarget: '5:00/km' },
      { duration: 60, avgPaceSecKm: 320 }   // 300 → 320 = +6.7%
    )
    expect(out.pace.status).toBe('slow')
    expect(out.pace.delta).toBe(20)
  })

  it('marks fast when logged pace >3% faster than planned', () => {
    const out = computeSessionExecution(
      { duration: 60, paceTarget: '5:00/km' },
      { duration: 60, avgPaceSecKm: 280 }   // -6.7%
    )
    expect(out.pace.status).toBe('fast')
  })

  it('falls back to duration (min) when durationSec absent', () => {
    // 8km in 40min → 300 sec/km
    const out = computeSessionExecution(
      { duration: 40, paceTarget: '5:00/km' },
      { duration: 40, distanceM: 8000 }
    )
    expect(out.pace.logged).toBe(300)
    expect(out.pace.status).toBe('on-target')
  })

  it('handles swim-style paceTarget (1:30/100m)', () => {
    const out = computeSessionExecution(
      { duration: 30, paceTarget: '1:30/100m' },
      { duration: 30, avgPaceSecKm: 88 }  // ~1:28 — under 3% so on-target
    )
    expect(out.pace.planned).toBe(90)
    expect(out.pace.status).toBe('on-target')
  })
})
