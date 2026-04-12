import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock at the Supabase system boundary
vi.mock('./supabase.js', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabase.js'
import { pushTable, pullTable, deleteRow, syncLog } from './cloudSync.js'

// Builds a chainable mock that matches the Supabase query-builder pattern:
//   supabase.from(table).upsert(rows)          → Promise
//   supabase.from(table).select('*').eq(...)   → Promise
//   supabase.from(table).delete().eq(...)      → Promise
function makeChain({ upsertErr = null, eqData = null, eqErr = null } = {}) {
  const chain = {
    upsert: vi.fn().mockResolvedValue({ error: upsertErr }),
    select: vi.fn(),
    delete: vi.fn(),
    eq:     vi.fn().mockResolvedValue({ data: eqData, error: eqErr }),
  }
  chain.select.mockReturnValue(chain)
  chain.delete.mockReturnValue(chain)
  supabase.from.mockReturnValue(chain)
  return chain
}

beforeEach(() => vi.clearAllMocks())

// ─── pushTable ────────────────────────────────────────────────────────────────
describe('pushTable', () => {
  it('upserts rows and returns null error on success', async () => {
    makeChain()
    const { error } = await pushTable('training_log', [{ id: '1', tss: 80 }])
    expect(error).toBeNull()
    expect(supabase.from).toHaveBeenCalledWith('training_log')
  })

  it('skips upsert and returns null error for empty rows', async () => {
    const { error } = await pushTable('training_log', [])
    expect(supabase.from).not.toHaveBeenCalled()
    expect(error).toBeNull()
  })

  it('skips upsert and returns null error for null rows', async () => {
    const { error } = await pushTable('training_log', null)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(error).toBeNull()
  })

  it('surfaces upsert errors', async () => {
    const chain = makeChain({ upsertErr: new Error('DB constraint') })
    const { error } = await pushTable('training_log', [{ id: '1' }])
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('DB constraint')
  })
})

// ─── pullTable ────────────────────────────────────────────────────────────────
describe('pullTable', () => {
  it('returns rows for a valid userId', async () => {
    makeChain({ eqData: [{ id: '1', tss: 80, user_id: 'u1' }] })
    const { data, error } = await pullTable('training_log', 'u1')
    expect(data).toEqual([{ id: '1', tss: 80, user_id: 'u1' }])
    expect(error).toBeNull()
  })

  it('returns error and skips query for missing userId', async () => {
    const { data, error } = await pullTable('training_log', null)
    expect(data).toBeNull()
    expect(error).toBeTruthy()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns error and skips query for undefined userId', async () => {
    const { data, error } = await pullTable('training_log', undefined)
    expect(data).toBeNull()
    expect(error).toBeTruthy()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('surfaces query errors', async () => {
    makeChain({ eqErr: new Error('network timeout') })
    const { data, error } = await pullTable('training_log', 'u1')
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('network timeout')
  })
})

// ─── deleteRow ────────────────────────────────────────────────────────────────
describe('deleteRow', () => {
  it('deletes a row and returns null error', async () => {
    makeChain()
    const { error } = await deleteRow('training_log', 'row-abc')
    expect(error).toBeNull()
    expect(supabase.from).toHaveBeenCalledWith('training_log')
  })

  it('returns error and skips query for null id', async () => {
    const { error } = await deleteRow('training_log', null)
    expect(error).toBeTruthy()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns error and skips query for undefined id', async () => {
    const { error } = await deleteRow('training_log', undefined)
    expect(error).toBeTruthy()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

// ─── syncLog ──────────────────────────────────────────────────────────────────
describe('syncLog', () => {
  it('pushes then pulls on success', async () => {
    makeChain({ eqData: [{ id: 'a', tss: 80, user_id: 'u1' }] })
    const { data, error } = await syncLog([{ id: 'a', tss: 80, date: '2026-01-01' }], 'u1')
    expect(error).toBeNull()
    expect(data).toEqual([{ id: 'a', tss: 80, user_id: 'u1' }])
  })

  it('tags each log entry with user_id before push', async () => {
    const chain = makeChain({ eqData: [] })
    await syncLog([{ id: 'b', tss: 60, date: '2026-01-02' }], 'u2')
    expect(chain.upsert).toHaveBeenCalledWith(
      [{ id: 'b', tss: 60, date: '2026-01-02', user_id: 'u2' }],
      { onConflict: 'id' }
    )
  })

  it('handles empty log (no rows pushed, still pulls)', async () => {
    makeChain({ eqData: [] })
    const { data, error } = await syncLog([], 'u3')
    expect(error).toBeNull()
    // empty rows → pushTable skips upsert → pullTable still runs
    expect(data).toEqual([])
  })

  it('returns error when not authenticated', async () => {
    const { data, error } = await syncLog([{ id: 'c' }], null)
    expect(data).toBeNull()
    expect(error).toBeTruthy()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns error and skips pull when push fails', async () => {
    const chain = makeChain({ upsertErr: new Error('network error') })
    const { data, error } = await syncLog([{ id: 'd', tss: 50, date: '2026-01-05' }], 'u4')
    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
    // eq (pull) should not have been called
    expect(chain.eq).not.toHaveBeenCalled()
  })
})
