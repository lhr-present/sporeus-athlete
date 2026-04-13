// ─── db/sessions.test.js — Unit tests for the sessions data-access layer ───────
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase.js', () => ({
  isSupabaseReady: vi.fn(() => true),
  supabase: { from: vi.fn() },
}))

import { isSupabaseReady, supabase } from '../supabase.js'
import {
  getTrainingSessions,
  getSessionsForAthletes,
  upsertSession,
} from './sessions.js'

function makeQueryChain(result = { data: null, error: null }) {
  const chain = {}
  for (const m of ['select','eq','in','gte','order','limit','upsert']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (res, rej) => Promise.resolve(result).then(res, rej)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  isSupabaseReady.mockReturnValue(true)
})

// ── getTrainingSessions ────────────────────────────────────────────────────────
describe('getTrainingSessions', () => {
  it('returns NOT_CONFIGURED when Supabase is not ready', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await getTrainingSessions('u1')
    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('queries training_log with correct user filter and defaults', async () => {
    const rows = [{ id: 's1', user_id: 'u1', date: '2026-04-01', tss: 80 }]
    const chain = makeQueryChain({ data: rows, error: null })
    supabase.from.mockReturnValue(chain)

    const { data, error } = await getTrainingSessions('u1')

    expect(error).toBeNull()
    expect(data).toEqual(rows)
    expect(supabase.from).toHaveBeenCalledWith('training_log')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(chain.order).toHaveBeenCalledWith('date', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(365) // default days
  })

  it('respects a custom days argument', async () => {
    const chain = makeQueryChain({ data: [], error: null })
    supabase.from.mockReturnValue(chain)

    await getTrainingSessions('u1', 60)
    expect(chain.limit).toHaveBeenCalledWith(60)
  })

  it('surfaces query errors', async () => {
    const chain = makeQueryChain({ data: null, error: new Error('connection refused') })
    supabase.from.mockReturnValue(chain)

    const { error } = await getTrainingSessions('u1')
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('connection refused')
  })
})

// ── getSessionsForAthletes ─────────────────────────────────────────────────────
describe('getSessionsForAthletes', () => {
  it('early-returns silently for empty userIds array', async () => {
    const { data, error } = await getSessionsForAthletes([], '2026-01-01')
    expect(data).toBeNull()
    expect(error).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('early-returns silently when Supabase not ready (even with userIds)', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await getSessionsForAthletes(['u1'], '2026-01-01')
    expect(data).toBeNull()
    expect(error).toBeNull()
  })

  it('queries with .in() and .gte() for multiple athletes', async () => {
    const rows = [{ user_id: 'u1', date: '2026-03-10', tss: 95 }]
    const chain = makeQueryChain({ data: rows, error: null })
    supabase.from.mockReturnValue(chain)

    const { data, error } = await getSessionsForAthletes(['u1', 'u2'], '2026-03-01')

    expect(error).toBeNull()
    expect(data).toEqual(rows)
    expect(supabase.from).toHaveBeenCalledWith('training_log')
    expect(chain.in).toHaveBeenCalledWith('user_id', ['u1', 'u2'])
    expect(chain.gte).toHaveBeenCalledWith('date', '2026-03-01')
  })
})

// ── upsertSession ──────────────────────────────────────────────────────────────
describe('upsertSession', () => {
  it('returns NOT_CONFIGURED when Supabase is not ready', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await upsertSession({ user_id: 'u1', date: '2026-04-01', source: 'manual' })
    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('upserts session with user_id,date,source conflict key', async () => {
    const chain = makeQueryChain({ data: null, error: null })
    supabase.from.mockReturnValue(chain)
    const session = { user_id: 'u1', date: '2026-04-01', source: 'strava', tss: 120 }

    await upsertSession(session)

    expect(supabase.from).toHaveBeenCalledWith('training_log')
    expect(chain.upsert).toHaveBeenCalledWith(session, { onConflict: 'user_id,date,source' })
  })
})
