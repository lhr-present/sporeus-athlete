// ─── db/coachSessions.test.js — Unit tests for coach session RSVP layer ────────
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing the module
vi.mock('../supabase.js', () => ({
  isSupabaseReady: vi.fn(() => true),
  supabase: {
    from: vi.fn(),
  },
}))

import { aggregateAttendance } from './coachSessions.js'
import { supabase, isSupabaseReady } from '../supabase.js'

// ── aggregateAttendance (pure function — no mock needed) ─────────────────────

describe('aggregateAttendance', () => {
  it('returns zero counts for empty array', () => {
    const result = aggregateAttendance([])
    expect(result).toEqual({ confirmed: 0, declined: 0, pending: 0, total: 0 })
  })

  it('counts confirmed correctly', () => {
    const rows = [
      { status: 'confirmed' },
      { status: 'confirmed' },
      { status: 'declined' },
    ]
    const result = aggregateAttendance(rows)
    expect(result.confirmed).toBe(2)
    expect(result.declined).toBe(1)
    expect(result.pending).toBe(0)
    expect(result.total).toBe(3)
  })

  it('counts pending correctly', () => {
    const rows = [
      { status: 'pending' },
      { status: 'pending' },
      { status: 'pending' },
    ]
    const result = aggregateAttendance(rows)
    expect(result.pending).toBe(3)
    expect(result.total).toBe(3)
  })

  it('total equals sum of all statuses', () => {
    const rows = [
      { status: 'confirmed' },
      { status: 'declined' },
      { status: 'pending' },
      { status: 'confirmed' },
    ]
    const result = aggregateAttendance(rows)
    expect(result.total).toBe(result.confirmed + result.declined + result.pending)
  })

  it('ignores unknown status values gracefully', () => {
    const rows = [{ status: 'unknown' }, { status: 'confirmed' }]
    const result = aggregateAttendance(rows)
    expect(result.confirmed).toBe(1)
    expect(result.total).toBe(2) // total is always rows.length
  })
})

// ── createSession (mocked Supabase) ─────────────────────────────────────────

describe('createSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isSupabaseReady.mockReturnValue(true)
  })

  it('returns NOT_CONFIGURED when Supabase not ready', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { createSession } = await import('./coachSessions.js')
    const result = await createSession('coach1', { title: 'Test', session_date: '2026-04-20' })
    expect(result.error).toBeDefined()
    expect(result.data).toBeNull()
  })

  it('calls insert with correct shape', async () => {
    const selectMock = vi.fn().mockResolvedValue({ data: { id: 'sess1', title: 'Tempo Run' }, error: null })
    const _singleMock = vi.fn().mockReturnValue({ select: () => ({ single: () => selectMock() }) })

    // Chain: from().insert().select().single()
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'sess1', title: 'Tempo Run', coach_id: 'c1', session_date: '2026-04-20' }, error: null })
      })
    })
    supabase.from.mockReturnValue({ insert: insertMock })

    const { createSession } = await import('./coachSessions.js')
    const _result = await createSession('c1', { title: 'Tempo Run', session_date: '2026-04-20' })
    expect(supabase.from).toHaveBeenCalledWith('coach_sessions')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ coach_id: 'c1', title: 'Tempo Run', session_date: '2026-04-20' })
    )
  })
})

// ── upsertAttendance (mocked Supabase) ───────────────────────────────────────

describe('upsertAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isSupabaseReady.mockReturnValue(true)
  })

  it('upserts with correct session_id, athlete_id, status', async () => {
    const upsertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'att1', status: 'confirmed' }, error: null })
      })
    })
    supabase.from.mockReturnValue({ upsert: upsertMock })

    const { upsertAttendance } = await import('./coachSessions.js')
    await upsertAttendance('sess1', 'ath1', 'confirmed')

    expect(supabase.from).toHaveBeenCalledWith('session_attendance')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: 'sess1', athlete_id: 'ath1', status: 'confirmed' }),
      expect.objectContaining({ onConflict: 'session_id,athlete_id' })
    )
  })

  it('returns NOT_CONFIGURED when Supabase not ready', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { upsertAttendance } = await import('./coachSessions.js')
    const result = await upsertAttendance('sess1', 'ath1', 'confirmed')
    expect(result.error).toBeDefined()
    expect(result.data).toBeNull()
  })
})
