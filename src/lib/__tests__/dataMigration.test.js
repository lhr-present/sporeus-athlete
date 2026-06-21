import { vi, describe, it, expect, beforeEach } from 'vitest'

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
    insert: vi.fn(),   // v9.340 — training_log now uses insert(), not upsert()
    update: vi.fn(),
    delete: vi.fn(),   // v9.360 — idempotency cleanup before training_log insert
    match:  vi.fn(),
    eq:     vi.fn(),
  }
  chain.from.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.delete.mockReturnValue(chain)
  chain.upsert.mockResolvedValue({ error: null })
  chain.insert.mockResolvedValue({ error: null })
  chain.match.mockResolvedValue({ error: null })
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
  mockChain.insert.mockResolvedValue({ error: null })
  mockChain.eq.mockResolvedValue({ error: null })
  mockChain.match.mockResolvedValue({ error: null })
  mockChain.from.mockReturnValue(mockChain)
  mockChain.update.mockReturnValue(mockChain)
  mockChain.delete.mockReturnValue(mockChain)
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
    expect(mockChain.insert).toHaveBeenCalledTimes(1)  // 90 < 100 → 1 batch
    const [rows] = mockChain.insert.mock.calls[0]
    expect(rows).toHaveLength(90)
    expect(rows[0].user_id).toBe('user1')
    expect(progress).toHaveBeenCalled()
  })

  it('batches 150 entries as two insert calls (100 + 50)', async () => {
    localStorage.setItem('sporeus_log', JSON.stringify(makeDays(150)))
    await migrateToSupabase('user1', vi.fn())
    // insert called twice for training_log (v9.340 — was upsert)
    expect(mockChain.insert).toHaveBeenCalledTimes(2)
    const firstBatch  = mockChain.insert.mock.calls[0][0]
    const secondBatch = mockChain.insert.mock.calls[1][0]
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
    const [rows] = mockChain.insert.mock.calls[0]
    // Only 2 valid entries should be inserted
    expect(rows).toHaveLength(2)
    expect(rows.every(r => r.date)).toBe(true)
  })

  it('throws when supabase insert returns an error', async () => {
    localStorage.setItem('sporeus_log', JSON.stringify(makeDays(3)))
    mockChain.insert.mockResolvedValueOnce({ error: { message: 'DB connection failed' } })
    await expect(migrateToSupabase('user1', vi.fn())).rejects.toThrow('DB connection failed')
  })

  // v9.360.0 — retry-safety: a prior aborted migration must not double the log.
  it('clears prior migration rows before re-inserting training_log', async () => {
    localStorage.setItem('sporeus_log', JSON.stringify(makeDays(3)))
    await migrateToSupabase('user1', vi.fn())
    expect(mockChain.from).toHaveBeenCalledWith('training_log')
    expect(mockChain.delete).toHaveBeenCalled()
    expect(mockChain.match).toHaveBeenCalledWith({ user_id: 'user1', source: 'manual' })
    expect(mockChain.insert).toHaveBeenCalled()
  })

  it('skips the training_log insert when the cleanup delete fails (no insert on top of un-cleared rows)', async () => {
    localStorage.setItem('sporeus_log', JSON.stringify(makeDays(3)))
    mockChain.match.mockResolvedValueOnce({ error: { message: 'cleanup failed' } })
    await expect(migrateToSupabase('user1', vi.fn())).rejects.toThrow('cleanup failed')
    expect(mockChain.insert).not.toHaveBeenCalled()
  })

  // v9.434.0 (F1) — retry-safety for injuries/test_results/race_results. These
  // upserts have no onConflict and id-less rows = plain INSERT, so a partial-
  // migration Retry would DOUBLE the history. Each must delete the user's own
  // rows (match { user_id }) before upserting — mirrors the training_log guard.
  it('clears prior injuries rows before upserting (retry-safe)', async () => {
    localStorage.setItem('sporeus-injuries', JSON.stringify([{ zone: 'knee', date: '2026-01-01', level: 3 }]))
    await migrateToSupabase('user1', vi.fn())
    expect(mockChain.from).toHaveBeenCalledWith('injuries')
    expect(mockChain.match).toHaveBeenCalledWith({ user_id: 'user1' })
    expect(mockChain.upsert).toHaveBeenCalled()
  })

  it('clears prior test_results rows before upserting (retry-safe)', async () => {
    localStorage.setItem('sporeus-test-results', JSON.stringify([{ date: '2026-01-01', testId: 'cooper', value: 3000 }]))
    await migrateToSupabase('user1', vi.fn())
    expect(mockChain.from).toHaveBeenCalledWith('test_results')
    expect(mockChain.match).toHaveBeenCalledWith({ user_id: 'user1' })
    expect(mockChain.upsert).toHaveBeenCalled()
  })

  it('clears prior race_results rows before upserting (retry-safe)', async () => {
    localStorage.setItem('sporeus-race-results', JSON.stringify([{ date: '2026-01-01', distance: 10000, actual: 2400 }]))
    await migrateToSupabase('user1', vi.fn())
    expect(mockChain.from).toHaveBeenCalledWith('race_results')
    expect(mockChain.match).toHaveBeenCalledWith({ user_id: 'user1' })
    expect(mockChain.upsert).toHaveBeenCalled()
  })

  it('skips injuries upsert when cleanup delete fails (no insert on un-cleared rows)', async () => {
    localStorage.setItem('sporeus-injuries', JSON.stringify([{ zone: 'knee', date: '2026-01-01' }]))
    mockChain.match.mockResolvedValueOnce({ error: { message: 'injuries cleanup failed' } })
    await expect(migrateToSupabase('user1', vi.fn())).rejects.toThrow('injuries cleanup failed')
    expect(mockChain.upsert).not.toHaveBeenCalled()
  })

  it('sets sporeus-migrated=1 only after all tables succeed', async () => {
    localStorage.setItem('sporeus_log', JSON.stringify(makeDays(2)))
    await migrateToSupabase('user1', vi.fn())
    expect(localStorage.getItem('sporeus-migrated')).toBe('1')
  })

  // v9.357.0 — lock the upsert conflict-target per table. The mock always
  // succeeds, so this can't catch a missing DB constraint, but it DOES catch a
  // regression of the onConflict STRING (the exact failure mode behind the
  // training_log 42P10 / guest-migration data loss). recovery dedups on
  // (user_id,date) — NOT id — and must not regress to a bare/ id-based target.
  it('migrates recovery with onConflict (user_id,date), not id', async () => {
    localStorage.setItem('sporeus-recovery', JSON.stringify([
      { date: '2026-01-01', score: 70 }, { date: '2026-01-02', score: 65 },
    ]))
    await migrateToSupabase('user1', vi.fn())
    expect(mockChain.from).toHaveBeenCalledWith('recovery')
    const recUpsert = mockChain.upsert.mock.calls.find(c => c[1] && c[1].onConflict === 'user_id,date')
    expect(recUpsert, 'recovery upsert must target onConflict user_id,date').toBeTruthy()
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
