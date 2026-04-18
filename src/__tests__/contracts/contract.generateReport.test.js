// @vitest-environment node
// ─── Contract C5: generate-report data bundles → PDF template inputs ─────────────
// Validates WeeklyReportData, MonthlySquadData, RaceReadinessData shapes and
// the critical MV column mapping (ctl_42d/atl_7d → ctl/atl/tsb).

import { describe, it, expect } from 'vitest'

// ── Shape validators ────────────────────────────────────────────────────────────

function isValidWeeklyMetrics(m) {
  return (
    typeof m === 'object' && m !== null &&
    typeof m.ctl              === 'number' &&
    typeof m.atl              === 'number' &&
    typeof m.tsb              === 'number' &&
    typeof m.weekTss          === 'number' &&
    typeof m.sessionsCount    === 'number' &&
    typeof m.totalDurationMin === 'number' &&
    (m.avgRpe === null || typeof m.avgRpe === 'number')
  )
}

function isValidWeeklyReportData(d) {
  return (
    typeof d === 'object' && d !== null &&
    typeof d.athlete?.display_name === 'string' &&
    typeof d.weekStart === 'string' &&
    typeof d.weekEnd   === 'string' &&
    isValidWeeklyMetrics(d.metrics) &&
    Array.isArray(d.sessions) &&
    Array.isArray(d.insights)
  )
}

function isValidAthleteMonthlyData(a) {
  return (
    typeof a === 'object' && a !== null &&
    typeof a.athlete_id   === 'string' &&
    typeof a.display_name === 'string' &&
    typeof a.ctl  === 'number' &&
    typeof a.atl  === 'number' &&
    typeof a.tsb  === 'number' &&
    Array.isArray(a.weeklyTss) && a.weeklyTss.length === 4 &&
    Array.isArray(a.flags)
  )
}

function isValidRaceReadinessData(d) {
  return (
    typeof d === 'object' && d !== null &&
    typeof d.race?.distance_km === 'number' &&
    typeof d.readinessScore    === 'number' && d.readinessScore >= 0 && d.readinessScore <= 100 &&
    ['fresh', 'trained', 'fatigued', 'unknown'].includes(d.taperStatus) &&
    (d.predictedTime === null || typeof d.predictedTime === 'string') &&
    typeof d.metrics?.ctl === 'number' &&
    Array.isArray(d.injuryFlags) &&
    typeof d.daysToRace === 'number' && d.daysToRace >= 0
  )
}

// ── MV column mapping (the fixed bug) ─────────────────────────────────────────

/** Simulates how generate-report now correctly maps MV columns (v8.0.1 fix) */
function mapMvRowToMetrics(mvRow) {
  return {
    ctl: mvRow?.ctl_42d ?? 0,
    atl: mvRow?.atl_7d  ?? 0,
    tsb: (mvRow?.ctl_42d ?? 0) - (mvRow?.atl_7d ?? 0),
  }
}

/** Simulates the OLD (buggy) mapping */
function mapMvRowToMetricsBuggy(mvRow) {
  return {
    ctl: mvRow?.ctl ?? 0,
    atl: mvRow?.atl ?? 0,
    tsb: mvRow?.tsb ?? 0,
  }
}

const SAMPLE_MV_ROW = { user_id: 'u1', date: '2026-04-18', ctl_42d: 52.3, atl_7d: 58.1 }

describe('C5 — generate-report data bundle contract', () => {
  describe('MV column name mapping (Bug #4 fix)', () => {
    it('fixed mapping reads ctl_42d and atl_7d', () => {
      const m = mapMvRowToMetrics(SAMPLE_MV_ROW)
      expect(m.ctl).toBe(52.3)
      expect(m.atl).toBe(58.1)
    })

    it('fixed mapping computes tsb as ctl_42d - atl_7d', () => {
      const m = mapMvRowToMetrics(SAMPLE_MV_ROW)
      expect(m.tsb).toBeCloseTo(52.3 - 58.1)
    })

    it('buggy mapping would have returned 0 for ctl/atl/tsb', () => {
      // Confirms the old bug
      const m = mapMvRowToMetricsBuggy(SAMPLE_MV_ROW)
      expect(m.ctl).toBe(0)
      expect(m.atl).toBe(0)
      expect(m.tsb).toBe(0)
    })

    it('null MV row defaults to zeros', () => {
      const m = mapMvRowToMetrics(null)
      expect(m.ctl).toBe(0)
      expect(m.atl).toBe(0)
      expect(m.tsb).toBe(0)
    })

    it('TSB is negative when ATL > CTL (building phase)', () => {
      const m = mapMvRowToMetrics({ ctl_42d: 40, atl_7d: 55 })
      expect(m.tsb).toBeLessThan(0)
    })

    it('TSB is positive when CTL > ATL (tapering)', () => {
      const m = mapMvRowToMetrics({ ctl_42d: 60, atl_7d: 45 })
      expect(m.tsb).toBeGreaterThan(0)
    })
  })

  describe('WeeklyReportData shape', () => {
    const valid = {
      athlete:  { display_name: 'Ali', email: 'ali@test.com' },
      weekStart: '2026-04-14', weekEnd: '2026-04-20',
      metrics: { ctl: 52, atl: 58, tsb: -6, weekTss: 320, sessionsCount: 5, totalDurationMin: 280, avgRpe: 6.8 },
      sessions:  [],
      insights:  [],
    }

    it('valid data passes shape check', () => {
      expect(isValidWeeklyReportData(valid)).toBe(true)
    })

    it('avgRpe can be null', () => {
      expect(isValidWeeklyReportData({ ...valid, metrics: { ...valid.metrics, avgRpe: null } })).toBe(true)
    })

    it('sessions and insights must be arrays', () => {
      expect(isValidWeeklyReportData({ ...valid, sessions: null })).toBe(false)
      expect(isValidWeeklyReportData({ ...valid, insights: 'foo' })).toBe(false)
    })
  })

  describe('AthleteMonthlyData shape', () => {
    const valid = {
      athlete_id: 'u1', display_name: 'Ali',
      ctl: 52, atl: 58, tsb: -6,
      weeklyTss: [150, 200, 180, 250],
      sessionsCount: 18, flags: [],
    }

    it('valid data passes shape check', () => {
      expect(isValidAthleteMonthlyData(valid)).toBe(true)
    })

    it('weeklyTss must have exactly 4 entries', () => {
      expect(isValidAthleteMonthlyData({ ...valid, weeklyTss: [100, 200, 150] })).toBe(false)
      expect(isValidAthleteMonthlyData({ ...valid, weeklyTss: [100, 200, 150, 300] })).toBe(true)
    })
  })

  describe('RaceReadinessData shape', () => {
    const valid = {
      athlete:        { display_name: 'Ali' },
      race:           { name: 'Istanbul Marathon', date: '2026-11-15', distance_km: 42.195, sport: 'run' },
      predictedTime:  '3:45:00',
      taperStatus:    'trained',
      readinessScore: 72,
      metrics:        { ctl: 60, atl: 52, tsb: 8 },
      recentSessions: [],
      injuryFlags:    [],
      daysToRace:     211,
    }

    it('valid data passes shape check', () => {
      expect(isValidRaceReadinessData(valid)).toBe(true)
    })

    it('predictedTime can be null', () => {
      expect(isValidRaceReadinessData({ ...valid, predictedTime: null })).toBe(true)
    })

    it('readinessScore must be 0–100', () => {
      expect(isValidRaceReadinessData({ ...valid, readinessScore: -1 })).toBe(false)
      expect(isValidRaceReadinessData({ ...valid, readinessScore: 101 })).toBe(false)
      expect(isValidRaceReadinessData({ ...valid, readinessScore: 100 })).toBe(true)
    })

    it('taperStatus must be one of the four allowed values', () => {
      expect(isValidRaceReadinessData({ ...valid, taperStatus: 'fresh' })).toBe(true)
      expect(isValidRaceReadinessData({ ...valid, taperStatus: 'rested' })).toBe(false)
    })

    it('daysToRace cannot be negative', () => {
      expect(isValidRaceReadinessData({ ...valid, daysToRace: -1 })).toBe(false)
      expect(isValidRaceReadinessData({ ...valid, daysToRace: 0 })).toBe(true)
    })
  })
})
