import { describe, it, expect } from 'vitest'
import { logEntryToRow, logRowToEntry } from '../useSupabaseData.js'

describe('logEntryToRow — activity metrics (v9.397)', () => {
  it('maps distanceM/avgHR/avgCadence to snake_case columns', () => {
    const row = logEntryToRow({ date: '2026-06-15', type: 'Run', duration: 45, tss: 60, distanceM: 10000, avgHR: 152, avgCadence: 168 }, 'u1')
    expect(row.distance_m).toBe(10000)
    expect(row.avg_hr).toBe(152)
    expect(row.avg_cadence).toBe(168)
  })

  it('falls back to distanceKm → distance_m (×1000) when distanceM absent', () => {
    const row = logEntryToRow({ date: '2026-06-15', type: 'Run', duration: 30, distanceKm: 8.5 }, 'u1')
    expect(row.distance_m).toBe(8500)
  })

  it('nulls metrics when absent / non-positive / non-finite', () => {
    const row = logEntryToRow({ date: '2026-06-15', type: 'Run', duration: 30, distanceM: 0, avgHR: -1, avgCadence: 'x' }, 'u1')
    expect(row.distance_m).toBeNull()
    expect(row.avg_hr).toBeNull()
    expect(row.avg_cadence).toBeNull()
  })
})

describe('logRowToEntry — activity metrics (v9.397)', () => {
  it('surfaces metric columns when present', () => {
    const e = logRowToEntry({ id: 'r1', date: '2026-06-15', type: 'run', duration_min: 45, tss: 60, distance_m: 10000, avg_hr: 152, avg_cadence: 168 })
    expect(e.distanceM).toBe(10000)
    expect(e.avgHR).toBe(152)
    expect(e.avgCadence).toBe(168)
  })

  it('omits metric keys entirely when columns are null (matches localStorage-only shape)', () => {
    const e = logRowToEntry({ id: 'r1', date: '2026-06-15', type: 'run', duration_min: 45, tss: 60, distance_m: null, avg_hr: null, avg_cadence: null })
    expect('distanceM' in e).toBe(false)
    expect('avgHR' in e).toBe(false)
    expect('avgCadence' in e).toBe(false)
  })
})

describe('metric round-trip entry → row → entry', () => {
  it('preserves distance/HR/cadence through a Supabase round-trip', () => {
    const entry = { id: 'x', date: '2026-06-15', type: 'Run', duration: 50, tss: 70, distanceM: 12000, avgHR: 148, avgCadence: 172 }
    const back = logRowToEntry({ ...logEntryToRow(entry, 'u1'), duration_min: 50 })
    expect(back.distanceM).toBe(12000)
    expect(back.avgHR).toBe(148)
    expect(back.avgCadence).toBe(172)
  })
})

describe('decoupling_pct mapping (v9.464)', () => {
  it('surfaces decoupling_pct as decouplingPct, including 0 and negatives', () => {
    expect(logRowToEntry({ id: 'r1', date: '2026-06-15', decoupling_pct: 7.5 }).decouplingPct).toBe(7.5)
    expect(logRowToEntry({ id: 'r1', date: '2026-06-15', decoupling_pct: 0 }).decouplingPct).toBe(0)
    expect(logRowToEntry({ id: 'r1', date: '2026-06-15', decoupling_pct: -2 }).decouplingPct).toBe(-2)
  })

  it('omits decouplingPct when column is null (matches localStorage-only shape)', () => {
    expect('decouplingPct' in logRowToEntry({ id: 'r1', date: '2026-06-15', decoupling_pct: null })).toBe(false)
  })

  it('persists decouplingPct to decoupling_pct on write; non-finite → null', () => {
    expect(logEntryToRow({ date: '2026-06-15', type: 'Ride', decouplingPct: 4.2 }, 'u1').decoupling_pct).toBe(4.2)
    expect(logEntryToRow({ date: '2026-06-15', type: 'Ride', decouplingPct: 0 }, 'u1').decoupling_pct).toBe(0)
    expect(logEntryToRow({ date: '2026-06-15', type: 'Ride' }, 'u1').decoupling_pct).toBeNull()
    expect(logEntryToRow({ date: '2026-06-15', type: 'Ride', decouplingPct: 'x' }, 'u1').decoupling_pct).toBeNull()
  })

  it('survives a full round-trip (decouplingTrend reads entry.decouplingPct)', () => {
    const back = logRowToEntry({ ...logEntryToRow({ date: '2026-06-15', type: 'Ride', decouplingPct: 6.1 }, 'u1'), id: 'r1' })
    expect(back.decouplingPct).toBe(6.1)
  })
})

describe('v9.465 enrichment columns (Strava P0)', () => {
  const enriched = {
    date: '2026-07-01', type: 'row', duration: 62, tss: 68, rpe: 6,
    np: 182, avgPower: 175, maxHR: 176, elevationGainM: 12,
    kilojoules: 640, sufferScore: 58, startTime: '06:15', rpeMethod: 'derived_hr',
  }

  it('hydrates all enrichment columns onto consumer-facing keys', () => {
    const e = logRowToEntry({ id: 'r1', date: '2026-07-01', np: 182, avg_power: 175, max_hr: 176,
      elevation_gain_m: 12, kilojoules: 640, suffer_score: 58, start_time: '06:15', rpe_method: 'derived_hr' })
    expect(e.np).toBe(182)
    expect(e.avgPower).toBe(175)
    expect(e.maxHR).toBe(176)
    expect(e.elevationGainM).toBe(12)
    expect(e.kilojoules).toBe(640)
    expect(e.sufferScore).toBe(58)
    expect(e.startTime).toBe('06:15')
    expect(e.rpeMethod).toBe('derived_hr')
  })

  it('omits enrichment keys when columns are null (localStorage-only shape parity)', () => {
    const e = logRowToEntry({ id: 'r1', date: '2026-07-01', np: null, avg_power: null, max_hr: null,
      elevation_gain_m: null, kilojoules: null, suffer_score: null, start_time: null, rpe_method: null })
    for (const k of ['np', 'avgPower', 'maxHR', 'elevationGainM', 'kilojoules', 'sufferScore', 'startTime', 'rpeMethod']) {
      expect(k in e).toBe(false)
    }
  })

  it('survives a full entry → row → entry round-trip (edited entries must not wipe columns)', () => {
    const back = logRowToEntry({ ...logEntryToRow(enriched, 'u1'), id: 'r1' })
    expect(back.np).toBe(182)
    expect(back.avgPower).toBe(175)
    expect(back.maxHR).toBe(176)
    expect(back.elevationGainM).toBe(12)
    expect(back.kilojoules).toBe(640)
    expect(back.sufferScore).toBe(58)
    expect(back.startTime).toBe('06:15')
    expect(back.rpeMethod).toBe('derived_hr')
  })

  it('writes null (not garbage) for absent/invalid enrichment values', () => {
    const row = logEntryToRow({ date: '2026-07-01', type: 'Run', duration: 30, startTime: '9am', rpeMethod: 7 }, 'u1')
    expect(row.np).toBeNull()
    expect(row.avg_power).toBeNull()
    expect(row.max_hr).toBeNull()
    expect(row.elevation_gain_m).toBeNull()
    expect(row.kilojoules).toBeNull()
    expect(row.suffer_score).toBeNull()
    expect(row.start_time).toBeNull()
    expect(row.rpe_method).toBeNull()
  })

  it('accepts normalizedPower as an np alias on write (Garmin mapper emits it)', () => {
    expect(logEntryToRow({ date: '2026-07-01', type: 'Ride', normalizedPower: 210 }, 'u1').np).toBe(210)
  })
})

describe('logEntryToRow — id handling (uuid column safety)', () => {
  it('includes id when it is a valid uuid', () => {
    const uuid = '0f8fad5b-d9cb-469f-a165-70867728950e'
    const row = logEntryToRow({ id: uuid, date: '2026-06-15', type: 'Run', duration: 30 }, 'u1')
    expect(row.id).toBe(uuid)
  })

  it('omits id for a legacy numeric id (DB default fills gen_random_uuid)', () => {
    const row = logEntryToRow({ id: 1700000000000, date: '2026-06-15', type: 'Run', duration: 30 }, 'u1')
    expect('id' in row).toBe(false)
  })

  it('omits id for a non-uuid string id', () => {
    const row = logEntryToRow({ id: 'not-a-uuid', date: '2026-06-15', type: 'Run', duration: 30 }, 'u1')
    expect('id' in row).toBe(false)
  })

  it('omits id when absent', () => {
    const row = logEntryToRow({ date: '2026-06-15', type: 'Run', duration: 30 }, 'u1')
    expect('id' in row).toBe(false)
  })
})
