import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock supabase.js ─────────────────────────────────────────────────────────
let _selectData = []
let _updateError = null
let _insertError = null

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      is:     vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn(async () => ({ error: _insertError })),
      then:   undefined,  // prevent accidental chaining
    })),
  },
  isSupabaseReady: () => true,
}))

// Override chainable mock to return data on final await
import { supabase } from './supabase.js'

function makeChain(data = [], error = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    is:     vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn(async () => ({ error: _insertError })),
  }
  // Make chain awaitable at the end
  chain.then = (resolve) => resolve({ data, error })
  return chain
}

beforeEach(() => {
  _selectData = []
  _updateError = null
  _insertError = null
  vi.clearAllMocks()
  supabase.from.mockImplementation(() => makeChain(_selectData, null))
})

import { exportAthleteData, deleteAthleteData } from './gdprExport.js'

// ─── Test 1: exportAthleteData throws on missing userId ───────────────────────
it('exportAthleteData throws when userId is missing', async () => {
  await expect(exportAthleteData(null)).rejects.toThrow('userId required')
  await expect(exportAthleteData('')).rejects.toThrow('userId required')
})

// ─── Test 2: exportAthleteData returns structured object ──────────────────────
it('exportAthleteData returns userId, exportedAt, and tables', async () => {
  _selectData = [{ id: 'row1', user_id: 'u1', score: 80 }]
  supabase.from.mockImplementation(() => makeChain(_selectData, null))

  const result = await exportAthleteData('u1')

  expect(result.userId).toBe('u1')
  expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}/)
  expect(result.tables).toHaveProperty('wellness_logs')
  expect(result.tables).toHaveProperty('_localStorage')
})

// ─── Test 3: deleteAthleteData throws on missing userId ───────────────────────
it('deleteAthleteData throws when userId is missing', async () => {
  await expect(deleteAthleteData(null)).rejects.toThrow('userId required')
})

// ─── Test 4: deleteAthleteData returns tablesAffected list ────────────────────
it('deleteAthleteData returns tablesAffected array without error', async () => {
  const updateChain = {
    update: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    is:     vi.fn(async () => ({ error: null })),
    insert: vi.fn(async () => ({ error: null })),
  }
  supabase.from.mockImplementation(() => updateChain)

  const result = await deleteAthleteData('u1')

  expect(result.error).toBeNull()
  expect(Array.isArray(result.tablesAffected)).toBe(true)
})
