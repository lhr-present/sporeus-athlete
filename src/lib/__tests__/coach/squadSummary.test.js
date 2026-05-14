// v9.130.0 — Squad summary tests.

import { describe, it, expect } from 'vitest'
import { summarizeSquad } from '../../coach/squadSummary.js'

const TODAY = '2026-05-14'
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function ath(overrides = {}) {
  return {
    display_name: 'Anon',
    today_tsb: 0,
    adherence_pct: 80,
    acwr_status: 'optimal',
    training_status: 'Building',
    last_session_date: addDays(TODAY, -1),
    this_week_sessions: 3,
    ...overrides,
  }
}

describe('summarizeSquad — guards', () => {
  it('empty squad', () => {
    const out = summarizeSquad([], TODAY)
    expect(out.total).toBe(0)
    expect(out.counts).toEqual({ urgent: 0, attention: 0, ok: 0 })
    expect(out.topReasons).toEqual([])
    expect(out.activity.avgAdherencePct).toBeNull()
  })
  it('tolerates non-array input', () => {
    expect(summarizeSquad(null, TODAY).total).toBe(0)
    expect(summarizeSquad(undefined, TODAY).total).toBe(0)
  })
})

describe('summarizeSquad — attention level counts', () => {
  it('classifies each athlete via getAthleteAttentionSignal', () => {
    const list = [
      ath({ adherence_pct: 90 }),                          // ok
      ath({ acwr_status: 'caution' }),                     // attention
      ath({ acwr_status: 'danger' }),                      // urgent
      ath({ training_status: 'Detraining' }),              // urgent
      ath({ last_session_date: addDays(TODAY, -10) }),     // urgent (stale_7d)
    ]
    const out = summarizeSquad(list, TODAY)
    expect(out.total).toBe(5)
    expect(out.counts.urgent).toBe(3)
    expect(out.counts.attention).toBe(1)
    expect(out.counts.ok).toBe(1)
  })
})

describe('summarizeSquad — topReasons', () => {
  it('aggregates reason counts in descending order', () => {
    const list = [
      ath({ acwr_status: 'danger' }),
      ath({ acwr_status: 'danger' }),
      ath({ acwr_status: 'danger' }),
      ath({ last_session_date: addDays(TODAY, -10) }),
      ath({ last_session_date: addDays(TODAY, -10) }),
    ]
    const out = summarizeSquad(list, TODAY)
    expect(out.topReasons[0].key).toBe('acwr_danger')
    expect(out.topReasons[0].count).toBe(3)
    expect(out.topReasons[1].key).toBe('stale_7d')
    expect(out.topReasons[1].count).toBe(2)
  })
  it('preserves bilingual labels on aggregated reasons', () => {
    const list = [ath({ acwr_status: 'danger' })]
    const out = summarizeSquad(list, TODAY)
    expect(out.topReasons[0].label.en).toContain('ACWR danger')
    expect(out.topReasons[0].label.tr).toContain('ACWR tehlikeli')
  })
})

describe('summarizeSquad — activity', () => {
  it('counts athletes active in last 7 days', () => {
    const list = [
      ath({ last_session_date: addDays(TODAY, -1) }),
      ath({ last_session_date: addDays(TODAY, -3) }),
      ath({ last_session_date: addDays(TODAY, -10) }),
    ]
    const out = summarizeSquad(list, TODAY)
    expect(out.activity.activeLast7d).toBe(2)
  })
  it('counts athletes with zero sessions this week', () => {
    const list = [
      ath({ this_week_sessions: 4 }),
      ath({ this_week_sessions: 0 }),
      ath({ this_week_sessions: 0 }),
    ]
    const out = summarizeSquad(list, TODAY)
    expect(out.activity.zeroSessionsThisWeek).toBe(2)
  })
  it('falls back to last_session_date when this_week_sessions missing', () => {
    const list = [
      ath({ this_week_sessions: undefined, last_session_date: addDays(TODAY, -10) }),
    ]
    const out = summarizeSquad(list, TODAY)
    expect(out.activity.zeroSessionsThisWeek).toBe(1)
  })
  it('averages adherence across athletes', () => {
    const list = [
      ath({ adherence_pct: 100 }),
      ath({ adherence_pct: 60 }),
      ath({ adherence_pct: 80 }),
    ]
    const out = summarizeSquad(list, TODAY)
    expect(out.activity.avgAdherencePct).toBe(80)
  })
  it('skips non-numeric adherence values', () => {
    const list = [
      ath({ adherence_pct: 100 }),
      ath({ adherence_pct: null }),
    ]
    const out = summarizeSquad(list, TODAY)
    expect(out.activity.avgAdherencePct).toBe(100)
  })
  it('returns null avg when no adherence values', () => {
    const list = [ath({ adherence_pct: null })]
    const out = summarizeSquad(list, TODAY)
    expect(out.activity.avgAdherencePct).toBeNull()
  })
})
