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
