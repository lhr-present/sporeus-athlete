import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapOWActivity, getDevices, removeDevice, triggerSync } from './deviceSync.js'

// ─── Mock supabase module ──────────────────────────────────────────────────────

const { mockFrom, mockInvoke } = vi.hoisted(() => ({
  mockFrom:    vi.fn(),
  mockInvoke:  vi.fn(),
}))

vi.mock('./supabase.js', () => ({
  supabase: {
    from:      (...args) => mockFrom(...args),
    functions: { invoke: (...args) => mockInvoke(...args) },
    rpc:       vi.fn(),
  },
  isSupabaseReady: () => true,
}))

// ─── mapOWActivity ─────────────────────────────────────────────────────────────

describe('mapOWActivity', () => {
  it('maps running → run', () => {
    const r = mapOWActivity({ type: 'running', start_time: '2026-04-12T08:00:00Z', duration_seconds: 3600 })
    expect(r.type).toBe('run')
    expect(r.date).toBe('2026-04-12')
    expect(r.duration_min).toBe(60)
  })

  it('maps cycling → bike', () => {
    expect(mapOWActivity({ type: 'cycling' }).type).toBe('bike')
  })

  it('maps swimming → swim', () => {
    expect(mapOWActivity({ type: 'swimming' }).type).toBe('swim')
  })

  it('maps unknown type → other', () => {
    expect(mapOWActivity({ type: 'skateboarding' }).type).toBe('other')
  })

  it('handles missing type gracefully', () => {
    expect(mapOWActivity({}).type).toBe('other')
  })

  it('rounds duration to whole minutes', () => {
    const r = mapOWActivity({ duration_seconds: 3661 })
    expect(r.duration_min).toBe(61)
  })
})

// ─── getDevices ────────────────────────────────────────────────────────────────

describe('getDevices', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty array when userId is null', async () => {
    const { devices, error } = await getDevices(null)
    expect(devices).toEqual([])
    expect(error).toBeNull()
  })

  it('returns devices from supabase', async () => {
    const fakeChain = {
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({ data: [{ id: 'abc', provider: 'garmin' }], error: null }),
    }
    mockFrom.mockReturnValue(fakeChain)
    const { devices } = await getDevices('user-1')
    expect(devices).toHaveLength(1)
    expect(devices[0].provider).toBe('garmin')
  })
})

// ─── removeDevice ──────────────────────────────────────────────────────────────

describe('removeDevice', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls delete with deviceId', async () => {
    const fakeChain = {
      delete: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockResolvedValue({ error: null }),
    }
    mockFrom.mockReturnValue(fakeChain)
    const { error } = await removeDevice('device-1')
    expect(error).toBeNull()
    expect(fakeChain.delete).toHaveBeenCalled()
  })

  it('returns error when deviceId missing', async () => {
    const { error } = await removeDevice(null)
    expect(error).toBeInstanceOf(Error)
  })
})

// ─── triggerSync ───────────────────────────────────────────────────────────────

describe('triggerSync', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns results from edge function', async () => {
    mockInvoke.mockResolvedValue({
      data: { results: [{ deviceId: 'x', status: 'ok', count: 3 }], synced: 3 },
      error: null,
    })
    const { results, synced, error } = await triggerSync()
    expect(error).toBeNull()
    expect(synced).toBe(3)
    expect(results).toHaveLength(1)
  })

  it('returns error object on failure without throwing', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'network error' } })
    const { results, error } = await triggerSync()
    expect(error).toBeDefined()
    expect(results).toEqual([])
  })
})
