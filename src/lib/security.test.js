/**
 * RLS invariant tests — pure function layer only.
 * Full integration tests require a real Supabase test environment.
 * These tests verify the policy logic expressed as JS functions mirrors the SQL.
 */

import { describe, it, expect } from 'vitest'

// ── Policy predicate mirrors ───────────────────────────────────────────────
// These JS functions mirror the SQL USING / WITH CHECK expressions.
// They are NOT a replacement for live RLS testing — they verify the
// intended logic is consistent across the codebase.

function ownRow(rowUserId, currentUid) {
  return rowUserId === currentUid
}

function coachOrAthlete(rowCoachId, rowAthleteId, currentUid) {
  return rowCoachId === currentUid || rowAthleteId === currentUid
}

function coachOnly(rowCoachId, currentUid) {
  return rowCoachId === currentUid
}

function coachWritesAthleteReads(rowCoachId, rowAthleteId, currentUid, isWrite) {
  if (isWrite) return rowCoachId === currentUid
  return rowCoachId === currentUid || rowAthleteId === currentUid
}

function msgInsert(athleteId, coachId, senderRole, currentUid) {
  return (athleteId === currentUid && senderRole === 'athlete')
      || (coachId   === currentUid && senderRole === 'coach')
}

function msgSelect(athleteId, coachId, currentUid) {
  return athleteId === currentUid || coachId === currentUid
}

function coachSessionSelect(sessionCoachId, athleteIsLinked, currentUid) {
  return sessionCoachId === currentUid || athleteIsLinked
}

// ── Tests ──────────────────────────────────────────────────────────────────

const UID_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const UID_B = 'bbbbbbbb-0000-0000-0000-000000000002'
const UID_C = 'cccccccc-0000-0000-0000-000000000003'

describe('RLS invariants — own-row tables', () => {
  it('user sees own row', () => {
    expect(ownRow(UID_A, UID_A)).toBe(true)
  })
  it('user cannot see other row', () => {
    expect(ownRow(UID_A, UID_B)).toBe(false)
  })
  it('null uid never matches', () => {
    expect(ownRow(UID_A, null)).toBe(false)
  })
})

describe('RLS invariants — coach_athletes', () => {
  it('coach can see own link', () => {
    expect(coachOrAthlete(UID_A, UID_B, UID_A)).toBe(true)
  })
  it('athlete can see own link', () => {
    expect(coachOrAthlete(UID_A, UID_B, UID_B)).toBe(true)
  })
  it('unrelated user cannot see link', () => {
    expect(coachOrAthlete(UID_A, UID_B, UID_C)).toBe(false)
  })
})

describe('RLS invariants — coach_notes (consolidated policy)', () => {
  it('coach can SELECT note', () => {
    expect(coachWritesAthleteReads(UID_A, UID_B, UID_A, false)).toBe(true)
  })
  it('athlete can SELECT own note', () => {
    expect(coachWritesAthleteReads(UID_A, UID_B, UID_B, false)).toBe(true)
  })
  it('third party cannot SELECT', () => {
    expect(coachWritesAthleteReads(UID_A, UID_B, UID_C, false)).toBe(false)
  })
  it('coach can INSERT (write)', () => {
    expect(coachWritesAthleteReads(UID_A, UID_B, UID_A, true)).toBe(true)
  })
  it('athlete cannot INSERT (write-check is coach-only)', () => {
    expect(coachWritesAthleteReads(UID_A, UID_B, UID_B, true)).toBe(false)
  })
  it('third party cannot INSERT', () => {
    expect(coachWritesAthleteReads(UID_A, UID_B, UID_C, true)).toBe(false)
  })
})

describe('RLS invariants — messages INSERT (merged policy)', () => {
  it('athlete can insert own message', () => {
    expect(msgInsert(UID_A, UID_B, 'athlete', UID_A)).toBe(true)
  })
  it('coach can insert own message', () => {
    expect(msgInsert(UID_A, UID_B, 'coach', UID_B)).toBe(true)
  })
  it('athlete cannot forge coach role', () => {
    expect(msgInsert(UID_A, UID_B, 'coach', UID_A)).toBe(false)
  })
  it('coach cannot forge athlete role', () => {
    expect(msgInsert(UID_A, UID_B, 'athlete', UID_B)).toBe(false)
  })
  it('unrelated user cannot insert', () => {
    expect(msgInsert(UID_A, UID_B, 'athlete', UID_C)).toBe(false)
    expect(msgInsert(UID_A, UID_B, 'coach',   UID_C)).toBe(false)
  })
})

describe('RLS invariants — messages SELECT (merged policy)', () => {
  it('athlete sees own thread', () => {
    expect(msgSelect(UID_A, UID_B, UID_A)).toBe(true)
  })
  it('coach sees own thread', () => {
    expect(msgSelect(UID_A, UID_B, UID_B)).toBe(true)
  })
  it('third party cannot see thread', () => {
    expect(msgSelect(UID_A, UID_B, UID_C)).toBe(false)
  })
})

describe('RLS invariants — coach_sessions SELECT (merged policy)', () => {
  it('coach sees own session', () => {
    expect(coachSessionSelect(UID_A, false, UID_A)).toBe(true)
  })
  it('linked athlete sees session', () => {
    expect(coachSessionSelect(UID_A, true, UID_B)).toBe(true)
  })
  it('unlinked user cannot see session', () => {
    expect(coachSessionSelect(UID_A, false, UID_B)).toBe(false)
  })
  it('unrelated user cannot see session', () => {
    expect(coachSessionSelect(UID_A, false, UID_C)).toBe(false)
  })
})

describe('RLS invariants — own-row with_check semantics', () => {
  it('INSERT with_check: matching uid passes', () => {
    expect(ownRow(UID_A, UID_A)).toBe(true)
  })
  it('INSERT with_check: non-matching uid fails', () => {
    expect(ownRow(UID_B, UID_A)).toBe(false)
  })
  it('coachOnly with_check: only coach passes', () => {
    expect(coachOnly(UID_A, UID_A)).toBe(true)
    expect(coachOnly(UID_A, UID_B)).toBe(false)
  })
})

describe('RLS invariants — data isolation guarantee', () => {
  const rows = [
    { user_id: UID_A },
    { user_id: UID_B },
    { user_id: UID_A },
    { user_id: UID_C },
  ]

  it('user A sees exactly own rows', () => {
    const visible = rows.filter(r => ownRow(r.user_id, UID_A))
    expect(visible).toHaveLength(2)
    expect(visible.every(r => r.user_id === UID_A)).toBe(true)
  })

  it('user B sees exactly own rows', () => {
    const visible = rows.filter(r => ownRow(r.user_id, UID_B))
    expect(visible).toHaveLength(1)
    expect(visible[0].user_id).toBe(UID_B)
  })

  it('null uid sees no rows', () => {
    const visible = rows.filter(r => ownRow(r.user_id, null))
    expect(visible).toHaveLength(0)
  })
})
