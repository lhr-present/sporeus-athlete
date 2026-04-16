import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  importStravaActivities, deduplicateByStravaId, decodePolyline,
  getStravaConnection, disconnectStrava,
} from './strava.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('./supabase.js', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
}))

vi.mock('./fetch.js', () => ({
  safeFetch: vi.fn(),
}))

import { safeFetch } from './fetch.js'
import { supabase } from './supabase.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fakeAct(overrides = {}) {
  return {
    id: 1001,
    name: 'Morning Run',
    sport_type: 'Run',
    start_date_local: '2026-04-10T07:00:00Z',
    moving_time: 3600,
    elapsed_time: 3700,
    distance: 10000,
    average_heartrate: 145,
    max_heartrate: 170,
    average_cadence: 88,
    ...overrides,
  }
}

function mockStravaResponse(acts, status = 200) {
  safeFetch.mockResolvedValue({
    ok: status === 200,
    status,
    json: async () => acts,
    text: async () => 'error body',
    statusText: 'OK',
  })
}

function makeFromChain(resolvedValue) {
  const maybeSingle = vi.fn().mockResolvedValue(resolvedValue)
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  supabase.from.mockReturnValue({ select })
  return { maybeSingle, eq, select }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── importStravaActivities ────────────────────────────────────────────────────
describe('importStravaActivities', () => {
  it('returns empty + error when no access token', async () => {
    const { entries, error } = await importStravaActivities('')
    expect(entries).toHaveLength(0)
    expect(error).toBeInstanceOf(Error)
  })

  it('maps a run activity to a log entry', async () => {
    mockStravaResponse([fakeAct()])
    const { entries, error } = await importStravaActivities('tok123')
    expect(error).toBeNull()
    expect(entries).toHaveLength(1)
    const e = entries[0]
    expect(e.type).toBe('Run')
    expect(e.date).toBe('2026-04-10')
    expect(e.strava_id).toBe('1001')
    expect(e.source).toBe('strava')
    expect(e.durationSec).toBe(3600)
    expect(e.distanceM).toBe(10000)
  })

  it('returns error on non-200 Strava API response', async () => {
    safeFetch.mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized', statusText: 'Unauthorized' })
    const { entries, error } = await importStravaActivities('bad-token')
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(/401/)
    expect(entries).toHaveLength(0)
  })

  it('stops pagination when fewer than 200 activities returned', async () => {
    mockStravaResponse([fakeAct({ id: 1 }), fakeAct({ id: 2 })])
    const { entries } = await importStravaActivities('tok')
    expect(safeFetch).toHaveBeenCalledTimes(1)
    expect(entries).toHaveLength(2)
  })

  it('returns error with status on 429 rate-limit response', async () => {
    safeFetch.mockResolvedValue({ ok: false, status: 429, text: async () => 'Rate Limit Exceeded', statusText: 'Too Many Requests' })
    const { entries, error } = await importStravaActivities('tok')
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(/429/)
    expect(entries).toHaveLength(0)
  })

  it('uses duration-only TSS when activity has no HR data', async () => {
    const act = fakeAct({ average_heartrate: undefined, max_heartrate: undefined })
    mockStravaResponse([act])
    const { entries, error } = await importStravaActivities('tok')
    expect(error).toBeNull()
    expect(entries[0].tss).toBeGreaterThan(0)
    expect(entries[0].avgHR).toBeNull()
  })

  it('includes decoded trackpoints when summary_polyline is present', async () => {
    // '??' encodes the single point (0, 0)
    const act = fakeAct({ map: { summary_polyline: '??' } })
    mockStravaResponse([act])
    const { entries } = await importStravaActivities('tok')
    expect(entries[0].trackpoints).toBeDefined()
    expect(entries[0].trackpoints).toHaveLength(1)
    expect(entries[0].trackpoints[0]).toMatchObject({ lat: 0, lon: 0 })
  })

  it('maps Ride sport_type to Ride entry type', async () => {
    mockStravaResponse([fakeAct({ sport_type: 'Ride' })])
    const { entries } = await importStravaActivities('tok')
    expect(entries[0].type).toBe('Ride')
  })

  it('maps Swim sport_type to Swim entry type', async () => {
    mockStravaResponse([fakeAct({ sport_type: 'Swim' })])
    const { entries } = await importStravaActivities('tok')
    expect(entries[0].type).toBe('Swim')
  })
})

// ── deduplicateByStravaId ─────────────────────────────────────────────────────
describe('deduplicateByStravaId', () => {
  it('keeps all incoming when existing has no strava_id entries', () => {
    const existing = [{ date: '2026-04-01', tss: 50 }]
    const incoming = [{ strava_id: '1001', date: '2026-04-10' }, { strava_id: '1002', date: '2026-04-11' }]
    expect(deduplicateByStravaId(existing, incoming)).toHaveLength(2)
  })

  it('filters out entries whose strava_id already exists', () => {
    const existing = [{ strava_id: '1001', date: '2026-04-10' }]
    const incoming = [
      { strava_id: '1001', date: '2026-04-10' },
      { strava_id: '1002', date: '2026-04-11' },
    ]
    const result = deduplicateByStravaId(existing, incoming)
    expect(result).toHaveLength(1)
    expect(result[0].strava_id).toBe('1002')
  })

  it('treats numeric and string strava_id as equal (coercion)', () => {
    const existing = [{ strava_id: 1001 }]
    const incoming = [{ strava_id: '1001' }, { strava_id: '1002' }]
    const result = deduplicateByStravaId(existing, incoming)
    expect(result).toHaveLength(1)
    expect(result[0].strava_id).toBe('1002')
  })

  it('returns empty array when incoming is empty', () => {
    const existing = [{ strava_id: '1001' }]
    expect(deduplicateByStravaId(existing, [])).toHaveLength(0)
  })
})

// ── decodePolyline ────────────────────────────────────────────────────────────
describe('decodePolyline', () => {
  it('returns empty array for empty string', () => {
    expect(decodePolyline('')).toEqual([])
  })

  it('returns empty array for null/undefined', () => {
    expect(decodePolyline(null)).toEqual([])
    expect(decodePolyline(undefined)).toEqual([])
  })

  it('decodes single point at origin — "??" → [[0, 0]]', () => {
    // '?' has charCode 63; 63 - 63 = 0; delta=0 for both lat and lon
    const result = decodePolyline('??')
    expect(result).toHaveLength(1)
    expect(result[0][0]).toBeCloseTo(0, 5)
    expect(result[0][1]).toBeCloseTo(0, 5)
  })

  it('decodes single point at (1.0, 1.0)', () => {
    // Analytically verified: lat=1.0 delta encodes to "_ibE", same for lon
    const result = decodePolyline('_ibE_ibE')
    expect(result).toHaveLength(1)
    expect(result[0][0]).toBeCloseTo(1.0, 5)
    expect(result[0][1]).toBeCloseTo(1.0, 5)
  })

  it('decodes 2-point path with delta encoding — [[0,0],[1,1]]', () => {
    // First point (0,0) = "??", second delta (+1.0,+1.0) = "_ibE_ibE"
    const result = decodePolyline('??_ibE_ibE')
    expect(result).toHaveLength(2)
    expect(result[0][0]).toBeCloseTo(0, 5)
    expect(result[0][1]).toBeCloseTo(0, 5)
    expect(result[1][0]).toBeCloseTo(1.0, 5)
    expect(result[1][1]).toBeCloseTo(1.0, 5)
  })

  it('decodes negative coordinate correctly — (-1.0, 0.0)', () => {
    // Analytically verified: -1.0 lat encodes to "~hbE", 0.0 lon encodes to "?"
    const result = decodePolyline('~hbE?')
    expect(result).toHaveLength(1)
    expect(result[0][0]).toBeCloseTo(-1.0, 5)
    expect(result[0][1]).toBeCloseTo(0.0, 5)
  })
})

// ── getStravaConnection ───────────────────────────────────────────────────────
describe('getStravaConnection', () => {
  it('returns { data: null, error: null } when userId is falsy', async () => {
    const r1 = await getStravaConnection(null)
    expect(r1.data).toBeNull()
    expect(r1.error).toBeNull()
    const r2 = await getStravaConnection('')
    expect(r2.data).toBeNull()
    expect(r2.error).toBeNull()
  })

  it('returns sync_status and provider_athlete_name from query result', async () => {
    const mockRow = {
      strava_athlete_id: 12345,
      last_sync_at: '2026-04-16T10:00:00Z',
      updated_at: '2026-04-16T10:00:00Z',
      sync_status: 'idle',
      last_error: null,
      provider_athlete_name: 'Jane Doe',
    }
    makeFromChain({ data: mockRow, error: null })
    const { data, error } = await getStravaConnection('user-abc')
    expect(error).toBeNull()
    expect(data.sync_status).toBe('idle')
    expect(data.provider_athlete_name).toBe('Jane Doe')
    expect(data.strava_athlete_id).toBe(12345)
  })
})

// ── disconnectStrava ──────────────────────────────────────────────────────────
describe('disconnectStrava', () => {
  it('calls edge function invoke with action disconnect', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null })
    await disconnectStrava()
    expect(supabase.functions.invoke).toHaveBeenCalledWith('strava-oauth', {
      body: { action: 'disconnect' },
    })
  })

  it('returns data and error from invoke result', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null })
    const { data, error } = await disconnectStrava()
    expect(data).toEqual({ ok: true })
    expect(error).toBeNull()
  })
})
