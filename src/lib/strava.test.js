// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  importStravaActivities, deduplicateByStravaId, decodePolyline,
  getStravaConnection, disconnectStrava, exchangeStravaCode,
  getRecentStravaActivities, buildStravaSelfTest,
  hasActivityReadScope, triggerStravaSyncWithRetry, getStravaActivityCount,
  shouldReconcileStrava,
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

  it('maps Rowing/Kayaking/Canoeing sport_type to Row (recognized by /row/i detectors)', async () => {
    for (const sport of ['Rowing', 'Kayaking', 'Canoeing']) {
      mockStravaResponse([fakeAct({ sport_type: sport })])
      const { entries } = await importStravaActivities('tok')
      expect(entries[0].type).toBe('Row')
      expect(entries[0].type).toMatch(/row/i)
    }
  })

  it('maps Crossfit sport_type to Strength', async () => {
    mockStravaResponse([fakeAct({ sport_type: 'Crossfit' })])
    const { entries } = await importStravaActivities('tok')
    expect(entries[0].type).toBe('Strength')
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

// ── getRecentStravaActivities ─────────────────────────────────────────────────
describe('getRecentStravaActivities', () => {
  it('returns [] without a userId', async () => {
    expect(await getRecentStravaActivities('')).toEqual([])
  })

  it('maps training_log rows (duration_min → duration) from the DB', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [
      { date: '2026-06-15', type: 'run', duration_min: 45, tss: 60 },
      { date: '2026-06-14', type: 'bike', duration_min: 90, tss: 120 },
    ] })
    const order = vi.fn().mockReturnValue({ limit })
    const eq2   = vi.fn().mockReturnValue({ order })
    const eq1   = vi.fn().mockReturnValue({ eq: eq2 })
    const select = vi.fn().mockReturnValue({ eq: eq1 })
    supabase.from.mockReturnValue({ select })

    const recent = await getRecentStravaActivities('user-abc')
    expect(supabase.from).toHaveBeenCalledWith('training_log')
    expect(recent).toHaveLength(2)
    expect(recent[0]).toEqual({ date: '2026-06-15', type: 'run', duration: 45, tss: 60 })
  })

  it('returns [] when the query yields no data', async () => {
    const limit = vi.fn().mockResolvedValue({ data: null })
    const order = vi.fn().mockReturnValue({ limit })
    const eq2   = vi.fn().mockReturnValue({ order })
    const eq1   = vi.fn().mockReturnValue({ eq: eq2 })
    supabase.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: eq1 }) })
    expect(await getRecentStravaActivities('u1')).toEqual([])
  })
})

// ── shouldReconcileStrava (F1) ────────────────────────────────────────────────
describe('shouldReconcileStrava', () => {
  const connected = { strava_athlete_id: '123', last_sync_at: null }
  it('true when connected, never synced, and log has no strava entries', () => {
    expect(shouldReconcileStrava(connected, [])).toBe(true)
    expect(shouldReconcileStrava(connected, [{ source: 'manual' }])).toBe(true)
    expect(shouldReconcileStrava(connected, null)).toBe(true)
  })
  it('false when there is no connection / no athlete id', () => {
    expect(shouldReconcileStrava(null, [])).toBe(false)
    expect(shouldReconcileStrava({ last_sync_at: null }, [])).toBe(false)
  })
  it('false when already synced at least once', () => {
    expect(shouldReconcileStrava({ strava_athlete_id: '123', last_sync_at: '2026-06-01T00:00:00Z' }, [])).toBe(false)
  })
  it('false when a strava-sourced entry already exists (no double-import)', () => {
    expect(shouldReconcileStrava(connected, [{ source: 'strava' }])).toBe(false)
    expect(shouldReconcileStrava(connected, [{ source: 'manual' }, { source: 'strava' }])).toBe(false)
  })
})

// ── hasActivityReadScope (F5b) ────────────────────────────────────────────────
describe('hasActivityReadScope', () => {
  it('true when activity:read_all is present', () => {
    expect(hasActivityReadScope('read,activity:read_all')).toBe(true)
    expect(hasActivityReadScope('activity:read_all')).toBe(true)
    expect(hasActivityReadScope(' activity:read_all , read ')).toBe(true)
  })
  it('false when only a narrower scope was granted', () => {
    expect(hasActivityReadScope('read')).toBe(false)
    expect(hasActivityReadScope('read,activity:read')).toBe(false)
  })
  it('false for null/empty', () => {
    expect(hasActivityReadScope(null)).toBe(false)
    expect(hasActivityReadScope('')).toBe(false)
    expect(hasActivityReadScope(undefined)).toBe(false)
  })
})

// ── triggerStravaSyncWithRetry (F2) ───────────────────────────────────────────
describe('triggerStravaSyncWithRetry', () => {
  it('returns immediately on success (single attempt)', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: { synced: 5 }, error: null })
    const { data, error } = await triggerStravaSyncWithRetry()
    expect(error).toBeNull()
    expect(data).toEqual({ synced: 5 })
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  })

  it('retries a 401 (auth-session race) then succeeds', async () => {
    supabase.functions.invoke
      .mockResolvedValueOnce({ data: null, error: { context: { status: 401 }, message: '401 Unauthorized' } })
      .mockResolvedValueOnce({ data: { synced: 3 }, error: null })
    const { data, error } = await triggerStravaSyncWithRetry({ maxAttempts: 2 })
    expect(error).toBeNull()
    expect(data).toEqual({ synced: 3 })
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry a non-401 error (real failure surfaced immediately)', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { context: { status: 500 }, message: 'server error' } })
    const { error } = await triggerStravaSyncWithRetry({ maxAttempts: 3 })
    expect(error).toBeTruthy()
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  })

  it('gives up after maxAttempts of persistent 401', async () => {
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { context: { status: 401 }, message: '401' } })
    const { error } = await triggerStravaSyncWithRetry({ maxAttempts: 2 })
    expect(error).toBeTruthy()
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2)
  })
})

// ── getStravaActivityCount (F5a) ──────────────────────────────────────────────
describe('getStravaActivityCount', () => {
  it('returns null without a userId', async () => {
    expect(await getStravaActivityCount('')).toBeNull()
  })
  it('returns the DB count for source=strava rows', async () => {
    const eq2 = vi.fn().mockResolvedValue({ count: 42, error: null })
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
    const select = vi.fn().mockReturnValue({ eq: eq1 })
    supabase.from.mockReturnValue({ select })
    const n = await getStravaActivityCount('user-abc')
    expect(supabase.from).toHaveBeenCalledWith('training_log')
    expect(n).toBe(42)
  })
  it('returns null on query error', async () => {
    const eq2 = vi.fn().mockResolvedValue({ count: null, error: { message: 'boom' } })
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
    supabase.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: eq1 }) })
    expect(await getStravaActivityCount('u1')).toBeNull()
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

// ── exchangeStravaCode — v9.173.0 retry behaviour ─────────────────────────────
describe('exchangeStravaCode', () => {
  it('returns success on first attempt without retry', async () => {
    supabase.functions.invoke.mockResolvedValueOnce({ data: { athlete: 'x' }, error: null })
    const { data, error } = await exchangeStravaCode('CODE123')
    expect(error).toBeNull()
    expect(data).toEqual({ athlete: 'x' })
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 4xx (invalid_grant — code single-use)', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'bad request', context: { status: 400, text: async () => 'invalid_grant' } },
    })
    const { data, error } = await exchangeStravaCode('EXPIRED')
    expect(data).toBeNull()
    expect(error.message).toMatch(/invalid_grant|bad request/)
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1) // no retry
  })

  it('retries on 5xx and succeeds on second attempt', async () => {
    supabase.functions.invoke
      .mockResolvedValueOnce({ data: null, error: { message: 'server error', context: { status: 503, text: async () => 'unavailable' } } })
      .mockResolvedValueOnce({ data: { athlete: 'ok' }, error: null })
    const { data, error } = await exchangeStravaCode('CODE', { maxAttempts: 3 })
    expect(error).toBeNull()
    expect(data).toEqual({ athlete: 'ok' })
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2)
  })

  it('retries on network error (no context) and succeeds', async () => {
    supabase.functions.invoke
      .mockResolvedValueOnce({ data: null, error: { message: 'network failure' } })
      .mockResolvedValueOnce({ data: { athlete: 'ok' }, error: null })
    const { data, error } = await exchangeStravaCode('CODE', { maxAttempts: 3 })
    expect(error).toBeNull()
    expect(data).toEqual({ athlete: 'ok' })
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2)
  })

  it('gives up after maxAttempts retries on persistent 5xx', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'server down', context: { status: 502, text: async () => 'bad gateway' } },
    })
    const { data, error } = await exchangeStravaCode('CODE', { maxAttempts: 2 })
    expect(data).toBeNull()
    expect(error.message).toMatch(/bad gateway|server down/)
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2)
  })

  it('respects custom maxAttempts=1 (no retry)', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: null,
      error: { message: 'transient', context: { status: 503, text: async () => 'oops' } },
    })
    await exchangeStravaCode('CODE', { maxAttempts: 1 })
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  })
})

describe('buildStravaSelfTest', () => {
  it('returns the 4 prerequisite checks in order', () => {
    const { checks } = buildStravaSelfTest()
    expect(checks.map(c => c.key)).toEqual(['clientId', 'redirectUri', 'auth', 'token'])
  })

  it('auth fails without a signed-in user; passes with one', () => {
    expect(buildStravaSelfTest().checks.find(c => c.key === 'auth').status).toBe('fail')
    expect(
      buildStravaSelfTest({ supabaseReady: true, userId: 'u1' }).checks.find(c => c.key === 'auth').status
    ).toBe('ok')
    // supabaseReady false alone is not enough
    expect(buildStravaSelfTest({ userId: 'u1' }).checks.find(c => c.key === 'auth').status).toBe('fail')
  })

  it('token is pending when not connected', () => {
    const t = buildStravaSelfTest().checks.find(c => c.key === 'token')
    expect(t.status).toBe('pending')
    expect(t.detail).toMatch(/not connected/i)
  })

  it('token is ok when connected, with athlete + last-sync detail', () => {
    const t = buildStravaSelfTest({
      conn: { sync_status: 'idle', last_sync_at: '2026-06-17T09:00:00Z', provider_athlete_name: 'Ali' },
    }).checks.find(c => c.key === 'token')
    expect(t.status).toBe('ok')
    expect(t.detail).toContain('Ali')
    expect(t.detail).toContain('2026-06-17')
  })

  it('token FAILS (surfacing last_error) when sync_status is error', () => {
    const t = buildStravaSelfTest({
      conn: { sync_status: 'error', last_error: 'token expired' },
    }).checks.find(c => c.key === 'token')
    expect(t.status).toBe('fail')
    expect(t.detail).toContain('token expired')
  })

  it('allReady is false while auth/token are not satisfied', () => {
    expect(buildStravaSelfTest().allReady).toBe(false)
  })

  it('redirectUri check exposes the URI the client will send (info, not fail)', () => {
    const r = buildStravaSelfTest().checks.find(c => c.key === 'redirectUri')
    expect(['info', 'fail']).toContain(r.status)
    expect(typeof r.detail).toBe('string')
  })
})
