// src/lib/__tests__/db/attributionEvents.test.js
//
// v9.99.0 — tests for attributionEvents.js pure helpers.

import { describe, it, expect } from 'vitest'
import {
  filterMissionTimelineEvents,
  MISSION_1_EVENTS,
} from '../../db/attributionEvents.js'

describe('filterMissionTimelineEvents', () => {
  it('returns empty array for null/undefined/non-array input', () => {
    expect(filterMissionTimelineEvents(null)).toEqual([])
    expect(filterMissionTimelineEvents(undefined)).toEqual([])
    expect(filterMissionTimelineEvents('nope')).toEqual([])
    expect(filterMissionTimelineEvents({})).toEqual([])
  })

  it('returns empty array when events are empty', () => {
    expect(filterMissionTimelineEvents([])).toEqual([])
  })

  it('filters out non-Mission-1 events (e.g., landing, utm)', () => {
    const input = [
      { event_name: 'landing', created_at: '2026-05-10' },
      { event_name: 'signup_completed', created_at: '2026-05-11' },
      { event_name: 'page_view', created_at: '2026-05-12' },
      { event_name: 'starter_plan_seeded', created_at: '2026-05-13' },
    ]
    const out = filterMissionTimelineEvents(input)
    expect(out).toHaveLength(2)
    expect(out.map(e => e.event_name)).toEqual(['signup_completed', 'starter_plan_seeded'])
  })

  it('preserves order (oldest → newest, as fetched)', () => {
    const input = [
      { event_name: 'signup_completed', created_at: '2026-05-11' },
      { event_name: 'starter_plan_seeded', created_at: '2026-05-13' },
      { event_name: 'first_session_logged', created_at: '2026-05-15' },
    ]
    const out = filterMissionTimelineEvents(input)
    expect(out.map(e => e.event_name)).toEqual([
      'signup_completed', 'starter_plan_seeded', 'first_session_logged',
    ])
  })

  it('keeps all Mission-1 event types: signup, starter_plan_seeded, first_session_logged, first_week_completed', () => {
    const allEvents = MISSION_1_EVENTS.map(name => ({ event_name: name, created_at: '2026-05-13' }))
    const out = filterMissionTimelineEvents(allEvents)
    expect(out).toHaveLength(MISSION_1_EVENTS.length)
  })

  it('preserves event row fields (props, created_at, id)', () => {
    const input = [
      { id: 'a', event_name: 'starter_plan_seeded', created_at: '2026-05-13', props: { goal: '5K' } },
    ]
    const out = filterMissionTimelineEvents(input)
    expect(out[0]).toEqual(input[0])
  })

  it('MISSION_1_EVENTS contains exactly the 4 canonical milestones', () => {
    expect(MISSION_1_EVENTS).toEqual([
      'signup_completed',
      'first_session_logged',
      'first_week_completed',
      'starter_plan_seeded',
    ])
  })
})
