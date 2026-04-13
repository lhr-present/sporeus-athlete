import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── localStorage mock (node env — no jsdom) ───────────────────────────────────
const store = {}
const lsMock = {
  getItem:    k => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v) },
  removeItem: k => { delete store[k] },
  clear:      () => { Object.keys(store).forEach(k => delete store[k]) },
}
vi.stubGlobal('localStorage', lsMock)

// ── supabase mock (hoisted so vi.mock factory can reference it) ────────────────
const { mockChain } = vi.hoisted(() => {
  const chain = {
    from:   vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    eq:     vi.fn(),
  }
  chain.from.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.upsert.mockResolvedValue({ error: null })
  chain.eq.mockResolvedValue({ error: null })
  return { mockChain: chain }
})

vi.mock('../supabase.js', () => ({ supabase: mockChain }))

import { detectLocalData, migrateToSupabase, isMigrated } from '../dataMigration.js'

// ── helpers ───────────────────────────────────────────────────────────────────
function makeDays(n) {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-0${Math.floor(i / 28) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
    tss:  50 + i,
    type: 'Run',
  }))
}

beforeEach(() => {
  lsMock.clear()
  vi.clearAllMocks()
  mockChain.upsert.mockResolvedValue({ error: null })
  mockChain.eq.mockResolvedValue({ error: null })
  mockChain.from.mockReturnValue(mockChain)
  mockChain.update.mockReturnValue(mockChain)
})

// ── detectLocalData ───────────────────────────────────────────────────────────
describe('detectLocalData', () => {
  it('returns null when already migrated', () => {
    localStorage.setItem('sporeus-migrated', '1')
    localStorage.setItem('sporeus_log', JSON.stringify([{ date: '2026-01-01', tss: 50 }]))
    expect(detectLocalData()).toBeNull()
  })

  it('returns null when localStorage has no data', () => {
    expect(detectLocalData()).toBeNull()
  })

  it('returns counts when training log data exists', () => {
    localStorage.setItem('sporeus_log', JSON.stringify(makeDays(5)))
    const result = detectLocalData()
    expect(result).not.toBeNull()
    expect(result.log).toBe(5)
    expect(result.total).toBe(5)
  })

  it('handles corrupted localStorage JSON value without throwing', () => {
    // readLS falls back to [] when JSON is invalid
    localStorage.setItem('sporeus_log', 'NOT_VALID_JSON')
    // total becomes 0, so detectLocalData returns null
    expect(detectLocalData()).toBeNull()
  })

  it('includes trainingAge in total check', () => {
    localStorage.setItem('sporeus-training-age', '10')
    const result = detectLocalData()
    expect(result).not.toBeNull()
    expect(result.trainingAge).toBe('10')
  })
})

// ── migrateToSupabase ─────────────────────────────────────────────────────────
describe('migrateToSupabase', () => {
  it('throws when userId is falsy', async () => {
    await expect(migrateToSupabase(null)).rejects.toThrow('Supabase not ready or no userId')
  })

  it('migrates empty localStorage — sets migrated flag and returns true', async () => {
    const result = await migrateToSupabase('user1', vi.fn())
    expect(result).toBe(true)
    expect(localStorage.getItem('sporeus-migrated')).toBe('1')
    // Nothing to upsert — supabase.from never called
    expect(mockChain.from).not.toHaveBeenCalled()
  })

  it('migrates 90 days of training log with a single batch', async () => {
    localStorage.setItem('sporeus_log', JSON.stringify(makeDays(90)))
    const progress = vi.fn()
    const result = await migrateToSupabase('user1', progress)
    expect(result).toBe(true)
    expect(mockChain.from).toHaveBeenCalledWith('training_log')
    expect(mockChain.upsert).toHaveBeenCalledTimes(1)  // 90 < 100 → 1 batch
    const [rows] = mockChain.upsert.mock.calls[0]
    expect(rows).toHaveLength(90)
    expect(rows[0].user_id).toBe('user1')
    expect(progress).toHaveBeenCalled()
  })

  it('batches 150 entries as two upsert calls (100 + 50)', async () => {
    localStorage.setItem('sporeus_log', JSON.stringify(makeDays(150)))
    await migrateToSupabase('user1', vi.fn())
    // upsert called twice for training_log
    expect(mockChain.upsert).toHaveBeenCalledTimes(2)
    const firstBatch  = mockChain.upsert.mock.calls[0][0]
    const secondBatch = mockChain.upsert.mock.calls[1][0]
    expect(firstBatch).toHaveLength(100)
    expect(secondBatch).toHaveLength(50)
  })

  it('skips entry without date field and continues migration', async () => {
    const entries = [
      { date: '2026-01-01', tss: 60 },
      { tss: 70 },               // corrupted — no date
      null,                       // null entry
      { date: '2026-01-03', tss: 50 },
    ]
    localStorage.setItem('sporeus_log', JSON.stringify(entries))
    const result = await migrateToSupabase('user1', vi.fn())
    expect(result).toBe(true)
    const [rows] = mockChain.upsert.mock.calls[0]
    // Only 2 valid entries should be upserted
    expect(rows).toHaveLength(2)
    expect(rows.every(r => r.date)).toBe(true)
  })

  it('throws when supabase upsert returns an error', async () => {
    localStorage.setItem('sporeus_log', JSON.stringify(makeDays(3)))
    mockChain.upsert.mockResolvedValueOnce({ error: { message: 'DB connection failed' } })
    await expect(migrateToSupabase('user1', vi.fn())).rejects.toThrow('DB connection failed')
  })

  it('sets sporeus-migrated=1 only after all tables succeed', async () => {
    localStorage.setItem('sporeus_log', JSON.stringify(makeDays(2)))
    await migrateToSupabase('user1', vi.fn())
    expect(localStorage.getItem('sporeus-migrated')).toBe('1')
  })
})

// ── isMigrated ────────────────────────────────────────────────────────────────
describe('isMigrated', () => {
  it('returns false before migration', () => {
    expect(isMigrated()).toBe(false)
  })

  it('returns true after migration flag is set', () => {
    localStorage.setItem('sporeus-migrated', '1')
    expect(isMigrated()).toBe(true)
  })
})
