import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importStravaActivities, deduplicateByStravaId } from './strava.js'

vi.mock('./supabase.js', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}))

// Mock safeFetch
vi.mock('./fetch.js', () => ({
  safeFetch: vi.fn(),
}))

import { safeFetch } from './fetch.js'

// Helper: fake Strava activity
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
    // Only 1 fetch call (2 acts < 200 → no more pages)
    expect(safeFetch).toHaveBeenCalledTimes(1)
    expect(entries).toHaveLength(2)
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
})
