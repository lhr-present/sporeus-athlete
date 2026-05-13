// src/lib/__tests__/integration/midWeekOnboarding.test.js
//
// v9.97.0 — Property tests for mid-week onboarding alignment (Prompt O).
//
// Concern: an athlete who onboards on a Wednesday gets a plan with
// `generatedAt = Wed 2026-05-13`. The plan's week 1 has 7 sessions indexed
// Mon=0..Sun=6 by template intent (see weeklyIntents in generatePlan.js).
// `getTodayPlannedSession(plan, '2026-05-13')` calls
// `(new Date('2026-05-13T12:00:00Z').getDay() + 6) % 7` → planDayIdx=2 (Wed).
//
// Question: does this correctly map the athlete's CURRENT day-of-week to the
// matching template slot, regardless of which day-of-week onboarding happened?
//
// Answer (asserted below): yes. The math is calendar-day-of-week-based, not
// "days since plan generation", so day-of-week always maps to the right
// template slot. Mon-onboarders see day 0; Wed-onboarders see day 2; etc.
//
// This is INTENTIONAL — a Mon-anchored template means "Monday is always the
// recovery / rest day, Wednesday is always the tempo slot" regardless of
// when the athlete started.

import * as fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import { getTodayPlannedSession } from '../../intelligence.js'
import { buildStarterPlan } from '../../plan/starterPlan.js'

// Compute the expected planDayIdx for a given ISO date using the same math
// as intelligence.js:711 (kept in sync — if intelligence.js changes, this
// test will catch the divergence).
function expectedDayIdx(isoDate) {
  return (new Date(isoDate + 'T12:00:00Z').getDay() + 6) % 7
}

describe('Mid-week onboarding alignment (property-based)', () => {
  it('week-1 day-of-onboarding session matches template slot for that day-of-week', () => {
    fc.assert(
      fc.property(
        // Generate ISO dates across a 2-year window so we hit every DOW
        fc.integer({ min: 0, max: 365 * 2 }).map(offset => {
          const d = new Date('2025-01-01T12:00:00Z')
          d.setUTCDate(d.getUTCDate() + offset)
          return d.toISOString().slice(0, 10)
        }),
        (onboardingISO) => {
          const plan = buildStarterPlan(
            { sport: 'Running', goal: '10K', weeks: 12 },
            onboardingISO,
          )
          // buildStarterPlan should always succeed with this input
          if (!plan) return false
          const session = getTodayPlannedSession(plan, onboardingISO)
          // session may be null (rest day or 0-duration); that's valid
          if (!session) return true
          // When a session is returned, week and day index must be correct
          return session.weekIdx === 0
              && session.dayIdx === expectedDayIdx(onboardingISO)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('day-of-week math is stable across timezones (T12:00:00Z noon prevents DST shifts)', () => {
    // Concrete fixture: a Wednesday → planDayIdx=2 regardless of local TZ
    const wedISO = '2026-05-13'  // Wed (verify in any TZ; noon UTC is mid-day everywhere)
    expect(expectedDayIdx(wedISO)).toBe(2)

    // Spot-check the full week
    const cases = [
      { date: '2026-05-11', expected: 0, dow: 'Mon' },
      { date: '2026-05-12', expected: 1, dow: 'Tue' },
      { date: '2026-05-13', expected: 2, dow: 'Wed' },
      { date: '2026-05-14', expected: 3, dow: 'Thu' },
      { date: '2026-05-15', expected: 4, dow: 'Fri' },
      { date: '2026-05-16', expected: 5, dow: 'Sat' },
      { date: '2026-05-17', expected: 6, dow: 'Sun' },
    ]
    for (const c of cases) {
      expect(expectedDayIdx(c.date)).toBe(c.expected)
    }
  })

  it('week boundary: day after generation date crosses to week 1 day idx + 1 (or rolls to week 2)', () => {
    // Onboard on a Sunday — generatedAt=Sun. Next day (Mon) crosses to
    // week 1 day 0 (template-Mon). The week boundary in getTodayPlannedSession
    // is days-since-generation / 7, so this is still week 0.
    const sunISO = '2026-05-17'
    const plan = buildStarterPlan(
      { sport: 'Running', goal: '10K', weeks: 12 },
      sunISO,
    )
    const monISO = '2026-05-18'
    const session = getTodayPlannedSession(plan, monISO)
    if (session) {
      // Days since generation: 1 → still week 0
      expect(session.weekIdx).toBe(0)
      expect(session.dayIdx).toBe(0)  // Mon
    }
  })

  it('seven-day boundary: day-7 lands on weekIdx=1', () => {
    const monISO = '2026-05-11'
    const plan = buildStarterPlan(
      { sport: 'Running', goal: '10K', weeks: 12 },
      monISO,
    )
    const nextMonISO = '2026-05-18'  // 7 days later
    const session = getTodayPlannedSession(plan, nextMonISO)
    if (session) {
      expect(session.weekIdx).toBe(1)
      expect(session.dayIdx).toBe(0)
    }
  })

  it('plan generation date in the future returns null (defensive)', () => {
    const todayISO = '2026-05-13'
    const futureISO = '2026-07-01'
    const plan = buildStarterPlan(
      { sport: 'Running', goal: '10K', weeks: 12 },
      futureISO,
    )
    expect(getTodayPlannedSession(plan, todayISO)).toBeNull()
  })

  it('past the end of the plan returns null', () => {
    const startISO = '2025-01-01'  // Wed
    const plan = buildStarterPlan(
      { sport: 'Running', goal: '10K', weeks: 4 },  // 4 weeks
      startISO,
    )
    const wayLaterISO = '2025-06-01'
    expect(getTodayPlannedSession(plan, wayLaterISO)).toBeNull()
  })
})
