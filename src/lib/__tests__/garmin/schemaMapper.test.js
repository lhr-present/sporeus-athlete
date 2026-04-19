// src/lib/__tests__/garmin/schemaMapper.test.js — E10 Garmin spike
// Essential tests for the schema mapper pure function.
// Spec says: no 100+ tests for the prototype — kept minimal and focused.
import { describe, it, expect } from 'vitest'
import {
  mapActivityType,
  ateToRpe,
  garminDateToLocal,
  mapGarminActivity,
  mapGarminActivities,
} from '../../garmin/schemaMapper.js'

// ── mapActivityType ────────────────────────────────────────────────────────

describe('mapActivityType', () => {
  it('maps running to Running', () => {
    expect(mapActivityType('running')).toBe('Running')
    expect(mapActivityType('trail_running')).toBe('Running')
    expect(mapActivityType('indoor_running')).toBe('Running')
  })
  it('maps cycling variants to Cycling', () => {
    expect(mapActivityType('cycling')).toBe('Cycling')
    expect(mapActivityType('road_biking')).toBe('Cycling')
    expect(mapActivityType('virtual_ride')).toBe('Cycling')
  })
  it('maps swimming to Swimming', () => {
    expect(mapActivityType('swimming')).toBe('Swimming')
    expect(mapActivityType('open_water_swimming')).toBe('Swimming')
  })
  it('maps rowing to Rowing', () => {
    expect(mapActivityType('rowing')).toBe('Rowing')
  })
  it('maps unknown type to Other', () => {
    expect(mapActivityType('unknown_sport')).toBe('Other')
    expect(mapActivityType('')).toBe('Other')
    expect(mapActivityType(null)).toBe('Other')
  })
})

// ── ateToRpe ───────────────────────────────────────────────────────────────

describe('ateToRpe', () => {
  it('returns null for missing ATE', () => {
    expect(ateToRpe(null)).toBeNull()
    expect(ateToRpe(undefined)).toBeNull()
  })
  it('maps 0 ATE to low RPE', () => {
    const rpe = ateToRpe(0)
    expect(rpe).toBeGreaterThanOrEqual(1)
    expect(rpe).toBeLessThanOrEqual(3)
  })
  it('maps 5 ATE to high RPE (9–10)', () => {
    const rpe = ateToRpe(5)
    expect(rpe).toBeGreaterThanOrEqual(9)
    expect(rpe).toBeLessThanOrEqual(10)
  })
  it('maps mid ATE (~2.5) to mid RPE (5–7)', () => {
    const rpe = ateToRpe(2.5)
    expect(rpe).toBeGreaterThanOrEqual(5)
    expect(rpe).toBeLessThanOrEqual(7)
  })
  it('clamps output to 1–10', () => {
    expect(ateToRpe(-1)).toBe(1)
    expect(ateToRpe(10)).toBe(10)
  })
})

// ── garminDateToLocal ──────────────────────────────────────────────────────

describe('garminDateToLocal', () => {
  it('parses YYYY-MM-DD HH:MM:SS string', () => {
    expect(garminDateToLocal('2024-06-15 07:30:00')).toBe('2024-06-15')
  })
  it('parses YYYY-MM-DD string directly', () => {
    expect(garminDateToLocal('2024-06-15')).toBe('2024-06-15')
  })
  it('returns null for null/undefined', () => {
    expect(garminDateToLocal(null)).toBeNull()
    expect(garminDateToLocal(undefined)).toBeNull()
  })
})

// ── mapGarminActivity ──────────────────────────────────────────────────────

describe('mapGarminActivity', () => {
  const garminRun = {
    activityId:          '12345678',
    activityName:        'Morning Run',
    startTimeLocal:      '2024-06-01 07:00:00',
    activityType:        { typeKey: 'running' },
    duration:            3600,       // 60 minutes
    averageHR:           145,
    maxHR:               172,
    distance:            10000,      // 10 km
    aerobicTrainingEffect: 3.2,
    trainingStressScore: 65,
  }

  it('returns null for null input', () => {
    expect(mapGarminActivity(null)).toBeNull()
  })

  it('maps date correctly', () => {
    const row = mapGarminActivity(garminRun)
    expect(row.date).toBe('2024-06-01')
  })

  it('converts duration from seconds to minutes', () => {
    const row = mapGarminActivity(garminRun)
    expect(row.duration).toBe(60)
  })

  it('maps activity type', () => {
    const row = mapGarminActivity(garminRun)
    expect(row.type).toBe('Running')
  })

  it('maps HR fields', () => {
    const row = mapGarminActivity(garminRun)
    expect(row.bpm_avg).toBe(145)
    expect(row.bpm_max).toBe(172)
  })

  it('maps distance to km', () => {
    const row = mapGarminActivity(garminRun)
    expect(row.distance_km).toBe(10.0)
  })

  it('maps TSS when present', () => {
    const row = mapGarminActivity(garminRun)
    expect(row.tss).toBe(65)
  })

  it('maps ATE to RPE estimate', () => {
    const row = mapGarminActivity(garminRun)
    expect(row.rpe).toBeGreaterThanOrEqual(1)
    expect(row.rpe).toBeLessThanOrEqual(10)
  })

  it('adds [Garmin] prefix to notes', () => {
    const row = mapGarminActivity(garminRun)
    expect(row.notes).toContain('[Garmin]')
    expect(row.notes).toContain('Morning Run')
  })

  it('stores garmin_activity_id', () => {
    const row = mapGarminActivity(garminRun)
    expect(row.garmin_activity_id).toBe('12345678')
  })

  it('body battery goes to _unmapped (no training_log column)', () => {
    const withBattery = { ...garminRun, bodyBattery: 72 }
    const row = mapGarminActivity(withBattery)
    expect(row._unmapped.bodyBattery).toBe(72)
  })

  it('maps cycling with normalizedPower', () => {
    const garminBike = {
      activityId:    '99',
      startTimeLocal:'2024-06-02 08:00:00',
      activityType:  { typeKey: 'cycling' },
      duration:      5400,
      normalizedPower: 240,
      trainingStressScore: 95,
    }
    const row = mapGarminActivity(garminBike)
    expect(row.power_norm).toBe(240)
    expect(row.type).toBe('Cycling')
  })
})

// ── mapGarminActivities ────────────────────────────────────────────────────

describe('mapGarminActivities', () => {
  it('returns [] for non-array input', () => {
    expect(mapGarminActivities(null)).toEqual([])
    expect(mapGarminActivities({})).toEqual([])
  })

  it('filters out zero-duration activities', () => {
    const activities = [
      { activityId:'1', startTimeLocal:'2024-06-01', activityType:{typeKey:'running'}, duration:3600 },
      { activityId:'2', startTimeLocal:'2024-06-02', activityType:{typeKey:'running'}, duration:0 },
    ]
    const rows = mapGarminActivities(activities)
    expect(rows.length).toBe(1)
    expect(rows[0].garmin_activity_id).toBe('1')
  })

  it('maps multiple activities', () => {
    const activities = [
      { activityId:'1', startTimeLocal:'2024-06-01', activityType:{typeKey:'running'}, duration:3600, averageHR:145, trainingStressScore:60 },
      { activityId:'2', startTimeLocal:'2024-06-03', activityType:{typeKey:'cycling'}, duration:7200, normalizedPower:250, trainingStressScore:120 },
    ]
    const rows = mapGarminActivities(activities)
    expect(rows.length).toBe(2)
    expect(rows[0].type).toBe('Running')
    expect(rows[1].type).toBe('Cycling')
  })
})
