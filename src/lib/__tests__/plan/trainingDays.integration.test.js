// End-to-end verification of the training-days feature through the REAL pipeline:
//   buildStarterPlan() → generatePlan() (E13) → adaptE13PlanToLegacy() → saved plan
//   → getTodayPlannedSession()
// Unit tests cover each piece with hand-built data; this proves the pieces agree
// when a real generator-produced plan flows through, which is what ships. (v9.379)
import { describe, it, expect } from 'vitest'
import { buildStarterPlan } from '../../plan/starterPlan.js'
import { getTodayPlannedSession } from '../../intelligence.js'

// generatedAt anchors week 0. Mon 2026-06-08 … Sun 2026-06-14 are all in week 0.
const MONDAY    = '2026-06-08' // isoDow 0
const TUESDAY   = '2026-06-09' // isoDow 1
const WEDNESDAY = '2026-06-10' // isoDow 2
const SATURDAY  = '2026-06-13' // isoDow 5
const SUNDAY    = '2026-06-14' // isoDow 6

const isoDow = d => (new Date(d + 'T12:00:00Z').getDay() + 6) % 7

describe('training-days end-to-end (real plan pipeline)', () => {
  // guard the fixture dates so a wrong assumption fails loudly here, not silently
  it('fixture weekday assumptions hold', () => {
    expect([isoDow(MONDAY), isoDow(TUESDAY), isoDow(WEDNESDAY), isoDow(SATURDAY), isoDow(SUNDAY)])
      .toEqual([0, 1, 2, 5, 6])
  })

  it('athlete who trains Mon/Wed/Fri/Sun gets a real session on SUNDAY (not forced rest)', () => {
    const plan = buildStarterPlan(
      { goal: 'Marathon', athleteLevel: 'intermediate', trainingDow: [0, 2, 4, 6] },
      MONDAY,
    )
    expect(plan).not.toBeNull()
    expect(plan.trainingDow).toEqual([0, 2, 4, 6])
    // weeklyIntents compresses to availableDays = dow.length (4) → 4 packed sessions
    expect(plan.weeks[0].sessions.length).toBe(4)

    // Sunday (isoDow 6) is ordinal 3 in the set → the 4th session, NOT rest.
    const sun = getTodayPlannedSession(plan, SUNDAY)
    expect(sun).not.toBeNull()
    expect(sun.dayIdx).toBe(3)
    expect(sun.duration).toBeGreaterThan(0)

    // Tuesday is NOT in the set → rest.
    expect(getTodayPlannedSession(plan, TUESDAY)).toBeNull()
  })

  it('default (no trainingDow) reproduces legacy Mon-first packing — weekend rests', () => {
    const plan = buildStarterPlan(
      { goal: 'Half Marathon', athleteLevel: 'intermediate', trainDays: 5 },
      MONDAY,
    )
    expect(plan).not.toBeNull()
    expect(plan.trainingDow).toEqual([0, 1, 2, 3, 4]) // defaultDowForCount(5)

    // A weekday (Wed, ordinal 2) has a session…
    expect(getTodayPlannedSession(plan, WEDNESDAY)).not.toBeNull()
    // …and Saturday (isoDow 5, not in [0..4]) is rest — matching prior behavior.
    expect(getTodayPlannedSession(plan, SATURDAY)).toBeNull()
  })
})
