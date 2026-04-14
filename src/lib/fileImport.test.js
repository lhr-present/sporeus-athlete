import { describe, it, expect } from 'vitest'
import { parseBulkCSV, deduplicateByDate } from './fileImport.js'

// ── parseBulkCSV ──────────────────────────────────────────────────────────────

describe('parseBulkCSV — valid rows', () => {
  it('parses a standard CSV with all columns', () => {
    const csv = [
      'date,type,duration_min,tss,rpe,notes,distance_m',
      '2026-04-01,Run,60,65,6,Easy aerobic run,10000',
      '2026-04-03,Ride,90,85,7,Tempo intervals,40000',
    ].join('\n')
    const result = parseBulkCSV(csv)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ date:'2026-04-01', type:'Run', durationMin:60, tss:65, rpe:6, distanceM:10000, source:'csv_import' })
    expect(result[1]).toMatchObject({ date:'2026-04-03', type:'Ride', durationMin:90, tss:85, rpe:7, distanceM:40000 })
  })
})

describe('parseBulkCSV — skips rows with missing or invalid date', () => {
  it('skips rows missing the date field', () => {
    const csv = [
      'date,type,duration_min,tss,rpe,notes,distance_m',
      ',Run,60,65,6,Missing date,10000',
      '2026-05-01,Run,45,50,5,Valid row,8000',
    ].join('\n')
    const result = parseBulkCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-05-01')
  })

  it('skips rows with malformed date (not YYYY-MM-DD)', () => {
    const csv = [
      'date,type,duration_min,tss,rpe,notes,distance_m',
      '01/04/2026,Run,60,65,6,Wrong format,0',
      '2026-04-01,Swim,30,40,4,Good date,3000',
    ].join('\n')
    const result = parseBulkCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('Swim')
  })
})

describe('parseBulkCSV — handles extra whitespace', () => {
  it('trims whitespace from cell values', () => {
    const csv = [
      'date , type , duration_min , tss , rpe , notes , distance_m',
      '  2026-06-01  ,  Run  ,  60  ,  70  ,  6  ,  Some notes  ,  9000  ',
    ].join('\n')
    const result = parseBulkCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-06-01')
    expect(result[0].type).toBe('Run')
    expect(result[0].durationMin).toBe(60)
  })
})

describe('parseBulkCSV — normalizes type names', () => {
  it('maps common aliases to canonical types', () => {
    const csv = [
      'date,type,duration_min,tss,rpe,notes,distance_m',
      '2026-04-01,running,60,60,6,,0',
      '2026-04-02,bike,90,80,7,,0',
      '2026-04-03,swimming,45,50,5,,0',
      '2026-04-04,rowing,60,55,6,,0',
      '2026-04-05,unknown_sport,30,30,4,,0',
    ].join('\n')
    const result = parseBulkCSV(csv)
    expect(result[0].type).toBe('Run')
    expect(result[1].type).toBe('Ride')
    expect(result[2].type).toBe('Swim')
    expect(result[3].type).toBe('Row')
    expect(result[4].type).toBe('Training')  // fallback
  })
})

describe('parseBulkCSV — handles empty CSV', () => {
  it('returns empty array for CSV with only header', () => {
    const csv = 'date,type,duration_min,tss,rpe,notes,distance_m'
    expect(parseBulkCSV(csv)).toEqual([])
  })

  it('returns empty array for null/undefined input', () => {
    expect(parseBulkCSV(null)).toEqual([])
    expect(parseBulkCSV('')).toEqual([])
  })
})

describe('parseBulkCSV — handles BOM prefix (Excel exports)', () => {
  it('strips UTF-8 BOM (\\uFEFF) before parsing', () => {
    const csv = '\uFEFFdate,type,duration_min,tss,rpe,notes,distance_m\n2026-07-01,Run,60,65,6,BOM test,0'
    const result = parseBulkCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-07-01')
    expect(result[0].type).toBe('Run')
  })
})

// ── deduplicateByDate ─────────────────────────────────────────────────────────

describe('deduplicateByDate — skips duplicates', () => {
  it('skips incoming entry if existing has same date AND type', () => {
    const existing = [{ date:'2026-04-01', type:'Run' }]
    const incoming = [
      { date:'2026-04-01', type:'Run', durationMin:60 },
      { date:'2026-04-02', type:'Run', durationMin:45 },
    ]
    const result = deduplicateByDate(existing, incoming)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-04-02')
  })
})

describe('deduplicateByDate — keeps same-date different-type entries', () => {
  it('allows two different sessions on same date', () => {
    const existing = [{ date:'2026-04-01', type:'Run' }]
    const incoming = [
      { date:'2026-04-01', type:'Ride', durationMin:90 },  // different type — keep
      { date:'2026-04-01', type:'Run',  durationMin:60 },  // same type — skip
    ]
    const result = deduplicateByDate(existing, incoming)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('Ride')
  })

  it('returns all incoming when existing is empty', () => {
    const incoming = [
      { date:'2026-04-01', type:'Run' },
      { date:'2026-04-02', type:'Swim' },
    ]
    expect(deduplicateByDate([], incoming)).toHaveLength(2)
    expect(deduplicateByDate(null, incoming)).toHaveLength(2)
  })
})
