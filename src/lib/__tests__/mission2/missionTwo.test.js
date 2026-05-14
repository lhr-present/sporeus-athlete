// v9.113.0 (Prompt DDD) — Mission 2 framework tests.

import { describe, it, expect } from 'vitest'
import {
  getMission2Status,
  MISSION_2_EVENTS,
  MISSION_2_LABELS,
} from '../../mission2/missionTwo.js'

const TODAY = '2026-05-14'
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function sess(date, duration = 60, type = 'Run', tss = 50) {
  return { date, duration, type, tss }
}
function m1event(date = '2026-04-01') {
  return { event_name: 'mission_1_complete', created_at: `${date}T10:00:00Z` }
}

describe('MISSION_2_EVENTS', () => {
  it('has the 4 canonical events in order', () => {
    expect(MISSION_2_EVENTS).toEqual([
      'mission_1_complete',
      'race_committed',
      'first_month_completed',
      'pr_logged',
    ])
  })
  it('has bilingual labels for every event', () => {
    for (const k of MISSION_2_EVENTS) {
      expect(MISSION_2_LABELS[k]?.en?.title).toBeTruthy()
      expect(MISSION_2_LABELS[k]?.tr?.title).toBeTruthy()
    }
  })
})

describe('getMission2Status — entry gate', () => {
  it('returns entered=false when mission_1_complete not present', () => {
    const out = getMission2Status({ attributionEvents: [], profile: {}, log: [], today: TODAY })
    expect(out.entered).toBe(false)
    expect(out.complete).toBe(false)
    expect(out.completedCount).toBe(0)
    expect(out.totalCount).toBe(4)
  })
  it('returns entered=true when mission_1_complete event present', () => {
    const out = getMission2Status({ attributionEvents: [m1event()], profile: {}, log: [], today: TODAY })
    expect(out.entered).toBe(true)
    expect(out.events.find(e => e.key === 'mission_1_complete').done).toBe(true)
    expect(out.events.find(e => e.key === 'mission_1_complete').at).toBe('2026-04-01')
  })
  it('handles null/undefined inputs gracefully', () => {
    const out = getMission2Status()
    expect(out.entered).toBe(false)
    expect(out.totalCount).toBe(4)
  })
})

describe('getMission2Status — race_committed', () => {
  it('marks race_committed when raceDate ≥7 days in future', () => {
    const profile = { raceDate: addDays(TODAY, 7) }
    const out = getMission2Status({ attributionEvents: [], profile, log: [], today: TODAY })
    const race = out.events.find(e => e.key === 'race_committed')
    expect(race.done).toBe(true)
    expect(race.at).toBe(addDays(TODAY, 7))
  })
  it('does NOT mark race_committed for races <7 days out', () => {
    const profile = { raceDate: addDays(TODAY, 6) }
    const out = getMission2Status({ attributionEvents: [], profile, log: [], today: TODAY })
    expect(out.events.find(e => e.key === 'race_committed').done).toBe(false)
  })
  it('does NOT mark race_committed for past races', () => {
    const profile = { raceDate: addDays(TODAY, -10) }
    const out = getMission2Status({ attributionEvents: [], profile, log: [], today: TODAY })
    expect(out.events.find(e => e.key === 'race_committed').done).toBe(false)
  })
  it('handles missing raceDate', () => {
    const out = getMission2Status({ attributionEvents: [], profile: {}, log: [], today: TODAY })
    expect(out.events.find(e => e.key === 'race_committed').done).toBe(false)
  })
})

describe('getMission2Status — first_month_completed', () => {
  it('marks first_month_completed when 12+ sessions over 30+ days', () => {
    // 12 sessions spread across 30 days
    const log = Array.from({ length: 12 }, (_, i) => sess(addDays(TODAY, -30 + i * 3)))
    const out = getMission2Status({ attributionEvents: [], profile: {}, log, today: TODAY })
    const mth = out.events.find(e => e.key === 'first_month_completed')
    expect(mth.done).toBe(true)
    expect(mth.at).toBeTruthy()
  })
  it('does NOT mark when fewer than 12 sessions', () => {
    const log = Array.from({ length: 11 }, (_, i) => sess(addDays(TODAY, -30 + i * 3)))
    const out = getMission2Status({ attributionEvents: [], profile: {}, log, today: TODAY })
    expect(out.events.find(e => e.key === 'first_month_completed').done).toBe(false)
  })
  it('does NOT mark when span is <30 days', () => {
    // 12 sessions in 14 days
    const log = Array.from({ length: 12 }, (_, i) => sess(addDays(TODAY, -14 + i)))
    const out = getMission2Status({ attributionEvents: [], profile: {}, log, today: TODAY })
    expect(out.events.find(e => e.key === 'first_month_completed').done).toBe(false)
  })
  it('ignores tss=0 and duration=0 entries', () => {
    const log = Array.from({ length: 11 }, (_, i) => sess(addDays(TODAY, -30 + i * 3)))
    log.push({ date: TODAY, tss: 0, duration: 0, type: 'Rest' })
    const out = getMission2Status({ attributionEvents: [], profile: {}, log, today: TODAY })
    expect(out.events.find(e => e.key === 'first_month_completed').done).toBe(false)
  })
})

describe('getMission2Status — pr_logged', () => {
  it('marks pr_logged when later session beats prior duration of same type', () => {
    const log = [
      sess(addDays(TODAY, -20), 60, 'Run'),
      sess(addDays(TODAY, -10), 75, 'Run'),  // beats 60
    ]
    const out = getMission2Status({ attributionEvents: [], profile: {}, log, today: TODAY })
    const pr = out.events.find(e => e.key === 'pr_logged')
    expect(pr.done).toBe(true)
    expect(pr.at).toBe(addDays(TODAY, -10))
  })
  it('returns the EARLIEST PR session', () => {
    const log = [
      sess(addDays(TODAY, -30), 30, 'Run'),
      sess(addDays(TODAY, -20), 45, 'Run'),  // first PR
      sess(addDays(TODAY, -10), 60, 'Run'),  // later PR
    ]
    const out = getMission2Status({ attributionEvents: [], profile: {}, log, today: TODAY })
    expect(out.events.find(e => e.key === 'pr_logged').at).toBe(addDays(TODAY, -20))
  })
  it('does NOT mark when no session beats prior best', () => {
    const log = [
      sess(addDays(TODAY, -20), 60, 'Run'),
      sess(addDays(TODAY, -10), 60, 'Run'),
      sess(addDays(TODAY, -5),  45, 'Run'),
    ]
    const out = getMission2Status({ attributionEvents: [], profile: {}, log, today: TODAY })
    expect(out.events.find(e => e.key === 'pr_logged').done).toBe(false)
  })
  it('tracks PRs per type independently', () => {
    const log = [
      sess(addDays(TODAY, -20), 60, 'Run'),
      sess(addDays(TODAY, -15), 45, 'Bike'),  // first Bike, no prior
      sess(addDays(TODAY, -10), 50, 'Bike'),  // beats prior Bike
    ]
    const out = getMission2Status({ attributionEvents: [], profile: {}, log, today: TODAY })
    expect(out.events.find(e => e.key === 'pr_logged').done).toBe(true)
    expect(out.events.find(e => e.key === 'pr_logged').at).toBe(addDays(TODAY, -10))
  })
  it('tolerates entries with no duration', () => {
    const log = [
      sess(addDays(TODAY, -20), 60, 'Run'),
      { date: addDays(TODAY, -15), type: 'Run', duration: null },
      sess(addDays(TODAY, -10), 70, 'Run'),
    ]
    const out = getMission2Status({ attributionEvents: [], profile: {}, log, today: TODAY })
    expect(out.events.find(e => e.key === 'pr_logged').done).toBe(true)
  })
})

describe('getMission2Status — complete state', () => {
  it('returns complete=true only when all 4 events done', () => {
    const log = Array.from({ length: 12 }, (_, i) => sess(addDays(TODAY, -30 + i * 3), 30 + i * 5, 'Run'))
    const profile = { raceDate: addDays(TODAY, 30) }
    const out = getMission2Status({
      attributionEvents: [m1event()],
      profile,
      log,
      today: TODAY,
    })
    expect(out.entered).toBe(true)
    expect(out.complete).toBe(true)
    expect(out.completedCount).toBe(4)
  })
  it('returns partial when only some milestones hit', () => {
    const out = getMission2Status({
      attributionEvents: [m1event()],
      profile: { raceDate: addDays(TODAY, 14) },
      log: [],
      today: TODAY,
    })
    expect(out.entered).toBe(true)
    expect(out.complete).toBe(false)
    expect(out.completedCount).toBe(2)  // m1 + race_committed
  })
})
