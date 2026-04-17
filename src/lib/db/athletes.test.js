// ─── db/athletes.test.js — Unit tests for the athletes data-access layer ───────
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase.js', () => ({
  isSupabaseReady: vi.fn(() => true),
  supabase: {
    from:      vi.fn(),
    auth:      { getSession: vi.fn() },
    functions: { invoke: vi.fn() },
  },
}))

import { isSupabaseReady, supabase } from '../supabase.js'
import { fetchSquad, getAthleteProfile, upsertCoachAthlete } from './athletes.js'

function makeQueryChain(result = { data: null, error: null }) {
  const chain = {}
  for (const m of ['select','eq','upsert','maybeSingle']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (res, rej) => Promise.resolve(result).then(res, rej)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  isSupabaseReady.mockReturnValue(true)
})

// ── fetchSquad ─────────────────────────────────────────────────────────────────
describe('fetchSquad', () => {
  it('returns NOT_CONFIGURED when Supabase is not ready', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await fetchSquad()
    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
    expect(supabase.auth.getSession).not.toHaveBeenCalled()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  it('invokes squad-sync edge function (auth header injected automatically)', async () => {
    const squadData = { athletes: [{ id: 'a1' }] }
    supabase.functions.invoke.mockResolvedValue({ data: squadData, error: null })

    const { data, error } = await fetchSquad()

    expect(error).toBeNull()
    expect(data).toEqual(squadData)
    // getSession must NOT be called — onAuthStateChange-only architecture
    expect(supabase.auth.getSession).not.toHaveBeenCalled()
    // invoke called with function name only — SDK injects auth header automatically
    expect(supabase.functions.invoke).toHaveBeenCalledWith('squad-sync')
  })

  it('handles unauthenticated state gracefully — invoke still called, edge fn rejects', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { message: 'Unauthorized' } })

    await fetchSquad()

    expect(supabase.auth.getSession).not.toHaveBeenCalled()
    expect(supabase.functions.invoke).toHaveBeenCalledWith('squad-sync')
  })
})

// ── getAthleteProfile ──────────────────────────────────────────────────────────
describe('getAthleteProfile', () => {
  it('returns NOT_CONFIGURED when Supabase is not ready', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await getAthleteProfile('u1')
    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('queries profiles table by id and returns single row', async () => {
    const profile = { id: 'u1', display_name: 'Alice', sport: 'cycling' }
    const chain = makeQueryChain({ data: profile, error: null })
    supabase.from.mockReturnValue(chain)

    const { data, error } = await getAthleteProfile('u1')

    expect(error).toBeNull()
    expect(data).toEqual(profile)
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('id', 'u1')
    expect(chain.maybeSingle).toHaveBeenCalledOnce()
  })

  it('returns null data (not error) when athlete does not exist', async () => {
    const chain = makeQueryChain({ data: null, error: null })
    supabase.from.mockReturnValue(chain)

    const { data, error } = await getAthleteProfile('nonexistent')
    expect(data).toBeNull()
    expect(error).toBeNull()
  })
})

// ── upsertCoachAthlete ─────────────────────────────────────────────────────────
describe('upsertCoachAthlete', () => {
  it('returns NOT_CONFIGURED when Supabase is not ready', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await upsertCoachAthlete('c1', 'a1')
    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('upserts with coach_id and athlete_id', async () => {
    const chain = makeQueryChain({ data: null, error: null })
    supabase.from.mockReturnValue(chain)

    await upsertCoachAthlete('c1', 'a1')

    expect(supabase.from).toHaveBeenCalledWith('coach_athletes')
    expect(chain.upsert).toHaveBeenCalledWith({ coach_id: 'c1', athlete_id: 'a1' })
  })

  it('merges extra fields into the upsert payload', async () => {
    const chain = makeQueryChain({ data: null, error: null })
    supabase.from.mockReturnValue(chain)

    await upsertCoachAthlete('c1', 'a1', { coachLevelOverride: 'pro', status: 'active' })

    expect(chain.upsert).toHaveBeenCalledWith({
      coach_id:           'c1',
      athlete_id:         'a1',
      coachLevelOverride: 'pro',
      status:             'active',
    })
  })
})
