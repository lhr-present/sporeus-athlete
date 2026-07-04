// v9.132.0 — Strava sync health tests.

import { describe, it, expect } from 'vitest'
import {
  classifyStravaSync,
  STRAVA_STALE_DAYS,
  STRAVA_NEVER_SYNCED_FRESH_DAYS,
} from '../../athlete/stravaSyncHealth.js'

const NOW = '2026-05-14T12:00:00Z'
function daysAgoISO(n) {
  const d = new Date(NOW)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString()
}

describe('classifyStravaSync — disconnected', () => {
  it('returns disconnected for null connection', () => {
    const out = classifyStravaSync(null, NOW)
    expect(out.state).toBe('disconnected')
    expect(out.actionable).toBe(false)
    expect(out.summary).toBeNull()
  })
})

describe('classifyStravaSync — healthy', () => {
  it('healthy when sync_status=idle and last_sync_at is recent', () => {
    const out = classifyStravaSync({
      sync_status: 'idle', last_sync_at: daysAgoISO(0),
    }, NOW)
    expect(out.state).toBe('healthy')
    expect(out.actionable).toBe(false)
    expect(out.summary).toBeNull()
  })
  it('healthy when actively syncing', () => {
    const out = classifyStravaSync({
      sync_status: 'syncing', last_sync_at: daysAgoISO(0),
    }, NOW)
    expect(out.state).toBe('healthy')
  })
})

describe('classifyStravaSync — failing', () => {
  it('failing when sync_status=error', () => {
    const out = classifyStravaSync({
      sync_status: 'error', last_sync_at: daysAgoISO(1),
      last_error: 'rate_limit',
    }, NOW)
    expect(out.state).toBe('failing')
    expect(out.actionable).toBe(true)
    expect(out.summary.en).toContain('failing')
    expect(out.summary.en).toContain('rate_limit')
    expect(out.summary.tr).toContain('hata')
  })
  it('failing when last_error present even if status not "error"', () => {
    const out = classifyStravaSync({
      sync_status: 'idle', last_sync_at: daysAgoISO(0),
      last_error: 'token_revoked',
    }, NOW)
    expect(out.state).toBe('failing')
  })
  it('truncates very long error messages', () => {
    const longError = 'x'.repeat(200)
    const out = classifyStravaSync({
      sync_status: 'error', last_error: longError,
    }, NOW)
    expect(out.summary.en.length).toBeLessThan(300)
  })
  it('failing takes precedence over staleness', () => {
    const out = classifyStravaSync({
      sync_status: 'error', last_sync_at: daysAgoISO(10),
      last_error: 'oauth',
    }, NOW)
    expect(out.state).toBe('failing')
  })
})

describe('classifyStravaSync — stale', () => {
  it(`stale when last_sync_at >= ${STRAVA_STALE_DAYS} days`, () => {
    const out = classifyStravaSync({
      sync_status: 'idle', last_sync_at: daysAgoISO(STRAVA_STALE_DAYS),
    }, NOW)
    expect(out.state).toBe('stale')
    expect(out.daysSinceLastSync).toBe(STRAVA_STALE_DAYS)
    expect(out.summary.en).toContain(`${STRAVA_STALE_DAYS}`)
  })
  it('not stale when last sync is 1 day ago', () => {
    const out = classifyStravaSync({
      sync_status: 'idle', last_sync_at: daysAgoISO(1),
    }, NOW)
    expect(out.state).toBe('healthy')
  })
  it('stale with bilingual summary at 5 days', () => {
    const out = classifyStravaSync({
      sync_status: 'idle', last_sync_at: daysAgoISO(5),
    }, NOW)
    expect(out.summary.en).toContain('5')
    expect(out.summary.tr).toContain('5')
  })
})

describe('classifyStravaSync — never_synced (F3)', () => {
  it('never_synced when connected, no last_sync_at, and updated_at is fresh', () => {
    const out = classifyStravaSync({
      strava_athlete_id: '123', sync_status: 'idle',
      last_sync_at: null, updated_at: daysAgoISO(0),
    }, NOW)
    expect(out.state).toBe('never_synced')
    expect(out.actionable).toBe(true)
    expect(out.daysSinceLastSync).toBeNull()
    expect(out.summary.en).toContain('no activities imported yet')
    expect(out.summary.tr).toContain('henüz aktivite')
  })
  it('never_synced at the edge of the fresh window', () => {
    const out = classifyStravaSync({
      sync_status: 'idle', last_sync_at: null,
      updated_at: daysAgoISO(STRAVA_NEVER_SYNCED_FRESH_DAYS),
    }, NOW)
    expect(out.state).toBe('never_synced')
  })
  it('falls back to stale when never-synced token is OLD (past fresh window)', () => {
    const out = classifyStravaSync({
      sync_status: 'idle', last_sync_at: null,
      updated_at: daysAgoISO(STRAVA_NEVER_SYNCED_FRESH_DAYS + 5),
    }, NOW)
    expect(out.state).toBe('stale')
  })
  it('failing still takes precedence over never_synced', () => {
    const out = classifyStravaSync({
      sync_status: 'error', last_sync_at: null,
      updated_at: daysAgoISO(0), last_error: 'token_revoked',
    }, NOW)
    expect(out.state).toBe('failing')
  })
})

describe('classifyStravaSync — needsReconnect (v9.470)', () => {
  const failing = (last_error) => classifyStravaSync({
    sync_status: 'error', last_sync_at: daysAgoISO(1), updated_at: daysAgoISO(0), last_error,
  }, NOW)

  it('true for revoked / rejected / read-only-scope errors (sync retry can never fix)', () => {
    expect(failing('Strava authorization revoked — please reconnect Strava').needsReconnect).toBe(true)
    expect(failing('Strava authorization rejected — please reconnect Strava').needsReconnect).toBe(true)
    expect(failing('Strava granted read-only — reconnect and allow "View data about your activities"').needsReconnect).toBe(true)
  })
  it('false for retryable errors — incl. backfill_pending which mentions "reconnect"', () => {
    expect(failing('backfill_pending — reconnect or tap Sync').needsReconnect).toBe(false)
    expect(failing('Rate limit hit — retry after 300s').needsReconnect).toBe(false)
    expect(failing(null).needsReconnect).toBe(false)
  })
  it('reconnect summary tells the athlete a retry cannot fix it', () => {
    const out = failing('Strava authorization revoked — please reconnect Strava')
    expect(out.summary.en).toMatch(/Reconnect/i)
    expect(out.summary.en).toMatch(/cannot fix/i)
    expect(out.summary.tr).toMatch(/yeniden bağlan/i)
  })
  it('not set on healthy/stale/never_synced states', () => {
    expect(classifyStravaSync({ sync_status: 'idle', last_sync_at: daysAgoISO(0) }, NOW).needsReconnect).toBeUndefined()
    expect(classifyStravaSync({ sync_status: 'idle', last_sync_at: daysAgoISO(5) }, NOW).needsReconnect).toBeUndefined()
  })
})

describe('classifyStravaSync — malformed inputs', () => {
  it('treats invalid last_sync_at as stale', () => {
    const out = classifyStravaSync({
      sync_status: 'idle', last_sync_at: 'not-a-date',
    }, NOW)
    expect(out.state).toBe('stale')
    expect(out.daysSinceLastSync).toBeNull()
  })
  it('handles missing last_sync_at', () => {
    const out = classifyStravaSync({ sync_status: 'idle' }, NOW)
    expect(out.state).toBe('stale')
    expect(out.daysSinceLastSync).toBeNull()
  })
})
