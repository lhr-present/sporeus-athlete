// ─── db/wellness.test.js — Unit tests for the wellness data-access layer ───────
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase.js', () => ({
  isSupabaseReady: vi.fn(() => true),
  supabase: { from: vi.fn() },
}))

import { isSupabaseReady, supabase } from '../supabase.js'
import {
  getWellnessLogs,
  getWellnessLogsForAthletes,
  upsertWellnessEntry,
} from './wellness.js'

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

// ── getWellnessLogs ────────────────────────────────────────────────────────────
describe('getWellnessLogs', () => {
  it('returns NOT_CONFIGURED when Supabase is not ready', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await getWellnessLogs('u1')
    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('queries recovery table with correct user filter and defaults', async () => {
    const rows = [{ id: 'w1', user_id: 'u1', date: '2026-04-01', hrv: 72 }]
    const chain = makeQueryChain({ data: rows, error: null })
    supabase.from.mockReturnValue(chain)

    const { data, error } = await getWellnessLogs('u1')

    expect(error).toBeNull()
    expect(data).toEqual(rows)
    expect(supabase.from).toHaveBeenCalledWith('recovery')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(chain.order).toHaveBeenCalledWith('date', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(90) // default days
  })

  it('respects a custom days argument', async () => {
    const chain = makeQueryChain({ data: [], error: null })
    supabase.from.mockReturnValue(chain)

    await getWellnessLogs('u1', 30)
    expect(chain.limit).toHaveBeenCalledWith(30)
  })

  it('surfaces query errors', async () => {
    const chain = makeQueryChain({ data: null, error: new Error('RLS denied') })
    supabase.from.mockReturnValue(chain)

    const { error } = await getWellnessLogs('u1')
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('RLS denied')
  })
})

// ── getWellnessLogsForAthletes ─────────────────────────────────────────────────
describe('getWellnessLogsForAthletes', () => {
  it('early-returns silently for empty userIds array', async () => {
    const { data, error } = await getWellnessLogsForAthletes([], '2026-01-01')
    expect(data).toBeNull()
    expect(error).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('early-returns silently when Supabase not ready (even with userIds)', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await getWellnessLogsForAthletes(['u1'], '2026-01-01')
    expect(data).toBeNull()
    expect(error).toBeNull()
  })

  it('queries with .in() and .gte() for multiple athletes', async () => {
    const rows = [{ user_id: 'u1', date: '2026-03-01' }, { user_id: 'u2', date: '2026-03-15' }]
    const chain = makeQueryChain({ data: rows, error: null })
    supabase.from.mockReturnValue(chain)

    const { data, error } = await getWellnessLogsForAthletes(['u1', 'u2'], '2026-03-01')

    expect(error).toBeNull()
    expect(data).toEqual(rows)
    expect(supabase.from).toHaveBeenCalledWith('recovery')
    expect(chain.in).toHaveBeenCalledWith('user_id', ['u1', 'u2'])
    expect(chain.gte).toHaveBeenCalledWith('date', '2026-03-01')
  })
})

// ── upsertWellnessEntry ────────────────────────────────────────────────────────
describe('upsertWellnessEntry', () => {
  it('returns NOT_CONFIGURED when Supabase is not ready', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await upsertWellnessEntry({ user_id: 'u1', date: '2026-04-01', hrv: 68 })
    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('upserts entry with correct conflict key', async () => {
    const chain = makeQueryChain({ data: null, error: null })
    supabase.from.mockReturnValue(chain)
    const entry = { user_id: 'u1', date: '2026-04-01', hrv: 68, rhr: 52 }

    await upsertWellnessEntry(entry)

    expect(supabase.from).toHaveBeenCalledWith('recovery')
    expect(chain.upsert).toHaveBeenCalledWith(entry, { onConflict: 'user_id,date' })
  })
})
