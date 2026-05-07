// ─── recentBest.test.js — v8.95.0: 16 tests ──────────────────────────────────
import { describe, it, expect } from 'vitest'
import { findRecentBest } from '../../athlete/recentBest.js'

const TODAY = '2026-05-07'

// Helper: build a log entry. distance is in km (sanitizeLogEntry / manual
// input convention) and duration is in minutes (matches sanitizeLogEntry).
function entry({ daysAgo = 0, type = 'Easy Run', sport, distanceKm, distanceM, duration, durationSec, today = TODAY }) {
  const d = new Date(today + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - daysAgo)
  const date = d.toISOString().slice(0, 10)
  const out = { date, type }
  if (sport != null) out.sport = sport
  if (distanceKm != null) out.distanceKm = distanceKm
  if (distanceM  != null) out.distanceM  = distanceM
  if (duration   != null) out.duration   = duration
  if (durationSec!= null) out.durationSec= durationSec
  return out
}

describe('findRecentBest — v8.95.0', () => {
  it('null/empty log returns null', () => {
    expect(findRecentBest(null,  { today: TODAY })).toBeNull()
    expect(findRecentBest([],    { today: TODAY })).toBeNull()
    expect(findRecentBest('xx',  { today: TODAY })).toBeNull()
  })

  it('single run @ 10K returns 10K bucket with canonical units', () => {
    const r = findRecentBest([
      entry({ daysAgo: 5, type: 'Long Run', distanceKm: 10, duration: 50 }),
    ], { today: TODAY })
    expect(r).toEqual({
      sport: 'run',
      distanceM: 10000,
      timeSec: 3000,
      sessionDate: '2026-05-02',
      daysAgo: 5,
    })
  })

  it('two runs same bucket → picks fastest', () => {
    const r = findRecentBest([
      entry({ daysAgo: 20, type: 'Easy Run', distanceKm: 10, duration: 55 }),
      entry({ daysAgo: 10, type: '10K Run',  distanceKm: 10, duration: 42 }),
    ], { today: TODAY })
    expect(r.timeSec).toBe(42 * 60)
    expect(r.daysAgo).toBe(10)
  })

  it('bucket tolerance: 5.4K matches 5K', () => {
    const r = findRecentBest([
      entry({ daysAgo: 3, type: 'Easy Run', distanceKm: 5.4, duration: 27 }),
    ], { today: TODAY })
    expect(r.distanceM).toBe(5000)
  })

  it('bucket tolerance: 6.5K does NOT match 5K', () => {
    const r = findRecentBest([
      entry({ daysAgo: 3, type: 'Easy Run', distanceKm: 6.5, duration: 30 }),
    ], { today: TODAY })
    // 6.5 is outside ±15% of both 5K (1.30 ratio) and 10K (0.65 ratio)
    expect(r).toBeNull()
  })

  it('3 sports logged, primarySport=bike returns bike', () => {
    const log = [
      entry({ daysAgo: 5,  type: 'Easy Run',   distanceKm: 10, duration: 50 }),
      entry({ daysAgo: 3,  type: 'Long ride',  distanceKm: 40, duration: 75 }),
      entry({ daysAgo: 1,  type: 'Pool swim',  distanceKm: 1.5, duration: 30 }),
    ]
    const r = findRecentBest(log, { today: TODAY, primarySport: 'bike' })
    expect(r.sport).toBe('bike')
    expect(r.distanceM).toBe(40000)
  })

  it('no primarySport, equal counts → most-recent activity wins', () => {
    const log = [
      entry({ daysAgo: 30, type: 'Easy Run',  distanceKm: 10, duration: 50 }),
      entry({ daysAgo: 2,  type: 'Long ride', distanceKm: 40, duration: 75 }),
    ]
    const r = findRecentBest(log, { today: TODAY })
    expect(r.sport).toBe('bike')
  })

  it('entries older than lookbackDays excluded', () => {
    const r = findRecentBest([
      entry({ daysAgo: 200, type: 'Long Run', distanceKm: 10, duration: 50 }),
    ], { today: TODAY, lookbackDays: 90 })
    expect(r).toBeNull()
  })

  it('duration in minutes vs durationSec preferred', () => {
    const r = findRecentBest([
      entry({ daysAgo: 5, type: 'Easy Run', distanceKm: 10, duration: 999, durationSec: 2700 }),
    ], { today: TODAY })
    // durationSec wins over duration
    expect(r.timeSec).toBe(2700)
  })

  it('distanceM (meters) accepted alongside distanceKm', () => {
    const r = findRecentBest([
      entry({ daysAgo: 5, type: 'Easy Run', distanceM: 10000, duration: 50 }),
    ], { today: TODAY })
    expect(r.distanceM).toBe(10000)
    expect(r.timeSec).toBe(3000)
  })

  it('classifies Easy Run / Long ride / Pool swim correctly', () => {
    const log = [
      entry({ daysAgo: 7,  type: 'Easy Run',  distanceKm: 5,    duration: 25 }),
      entry({ daysAgo: 6,  type: 'Long ride', distanceKm: 20,   duration: 40 }),
      entry({ daysAgo: 5,  type: 'Pool swim', distanceKm: 1.5,  duration: 30 }),
    ]
    expect(findRecentBest(log, { today: TODAY, primarySport: 'run'  }).sport).toBe('run')
    expect(findRecentBest(log, { today: TODAY, primarySport: 'bike' }).sport).toBe('bike')
    expect(findRecentBest(log, { today: TODAY, primarySport: 'swim' }).sport).toBe('swim')
  })

  it('daysAgo computed correctly with today option', () => {
    const r = findRecentBest([
      entry({ daysAgo: 12, type: 'Easy Run', distanceKm: 5, duration: 25, today: TODAY }),
    ], { today: TODAY })
    expect(r.daysAgo).toBe(12)
    expect(r.sessionDate).toBe('2026-04-25')
  })

  it('entry without distance is skipped (not enough info)', () => {
    const r = findRecentBest([
      entry({ daysAgo: 3, type: 'Long ride', duration: 75 }), // no distance
    ], { today: TODAY })
    expect(r).toBeNull()
  })

  it('malformed entries (missing date / NaN distance) → skipped, not crashed', () => {
    const log = [
      null,
      undefined,
      'hello',
      { type: 'Easy Run', distanceKm: 10, duration: 50 }, // missing date
      { date: 'bogus', type: 'Easy Run', distanceKm: 10, duration: 50 },
      { date: '2026-05-04', type: 'Easy Run', distanceKm: NaN, duration: 50 },
      entry({ daysAgo: 4, type: 'Easy Run', distanceKm: 10, duration: 50 }),
    ]
    const r = findRecentBest(log, { today: TODAY })
    expect(r).not.toBeNull()
    expect(r.sport).toBe('run')
    expect(r.distanceM).toBe(10000)
  })

  it('triathlon profile + mixed log → returns most-trained sport', () => {
    const log = [
      entry({ daysAgo: 30, type: 'Easy Run',  distanceKm: 10, duration: 50 }),
      entry({ daysAgo: 20, type: 'Easy Run',  distanceKm: 5,  duration: 25 }),
      entry({ daysAgo: 15, type: 'Easy Run',  distanceKm: 10, duration: 52 }),
      entry({ daysAgo: 10, type: 'Long ride', distanceKm: 40, duration: 75 }),
      entry({ daysAgo: 5,  type: 'Pool swim', distanceKm: 1.5, duration: 30 }),
    ]
    const r = findRecentBest(log, { today: TODAY, primarySport: 'triathlon' })
    expect(r.sport).toBe('run')
  })

  it('session in the future (date > today) excluded', () => {
    const r = findRecentBest([
      entry({ daysAgo: -5, type: 'Easy Run', distanceKm: 10, duration: 50 }),
    ], { today: TODAY })
    expect(r).toBeNull()
  })
})
