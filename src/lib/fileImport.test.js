import { describe, it, expect } from 'vitest'
import { parseBulkCSV, deduplicateByDate, parseConcept2CSV } from './fileImport.js'

// ── splitCSVLine (via parseBulkCSV) — escaped-quote `""` handling ──────────────
describe('parseBulkCSV — RFC4180 escaped quotes in notes', () => {
  it('round-trips a doubled-quote `""` to a single literal `"`', () => {
    const csv = [
      'date,type,duration_min,notes',
      '2026-04-01,Run,60,"he said ""hi"" today"',
    ].join('\n')
    const result = parseBulkCSV(csv)
    expect(result).toHaveLength(1)
    expect(result[0].notes).toBe('he said "hi" today')
  })

  it('keeps embedded commas inside quoted fields', () => {
    const csv = [
      'date,type,duration_min,notes',
      '2026-04-01,Run,60,"long, steady, aerobic"',
    ].join('\n')
    const result = parseBulkCSV(csv)
    expect(result[0].notes).toBe('long, steady, aerobic')
  })
})

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
  it('skips incoming entry if existing has same date AND type AND duration within ±5min', () => {
    const existing = [{ date:'2026-04-01', type:'Run', durationMin:60 }]
    const incoming = [
      { date:'2026-04-01', type:'Run', durationMin:62 },  // within tolerance — same activity, skip
      { date:'2026-04-02', type:'Run', durationMin:45 },
    ]
    const result = deduplicateByDate(existing, incoming)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-04-02')
  })
})

describe('deduplicateByDate — keeps same-date different-type entries', () => {
  it('allows two different sessions on same date', () => {
    const existing = [{ date:'2026-04-01', type:'Run', durationMin:60 }]
    const incoming = [
      { date:'2026-04-01', type:'Ride', durationMin:90 },  // different type — keep
      { date:'2026-04-01', type:'Run',  durationMin:60 },  // same type+duration — skip
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

// HIGH — data-loss regression: two distinct same-day SAME-type sessions (e.g.
// AM intervals + PM recovery run) must both survive. The old `date|type` key
// collapsed them into one, silently dropping the genuinely-new 2nd session.
describe('deduplicateByDate — keeps two distinct same-day same-type sessions', () => {
  it('keeps an AM intervals run and a PM recovery run on the same day (different durations)', () => {
    const existing = []
    const incoming = [
      { date:'2026-04-01', type:'Run', durationMin:75, tss:90 },  // AM intervals
      { date:'2026-04-01', type:'Run', durationMin:35, tss:30 },  // PM recovery
    ]
    const result = deduplicateByDate(existing, incoming)
    expect(result).toHaveLength(2)
  })

  it('keeps a distinct 2nd same-type session against an existing logged one', () => {
    const existing = [{ date:'2026-04-01', type:'Run', durationMin:75 }]  // already-logged AM
    const incoming = [
      { date:'2026-04-01', type:'Run', durationMin:75 },  // re-import of AM — skip
      { date:'2026-04-01', type:'Run', durationMin:35 },  // genuinely new PM — keep
    ]
    const result = deduplicateByDate(existing, incoming)
    expect(result).toHaveLength(1)
    expect(result[0].durationMin).toBe(35)
  })

  it('still dedups a true re-import of the same activity (duration within tolerance)', () => {
    const existing = [{ date:'2026-04-01', type:'Ride', durationMin:120 }]
    const incoming = [{ date:'2026-04-01', type:'Ride', durationMin:121 }]  // ±1min — same activity
    const result = deduplicateByDate(existing, incoming)
    expect(result).toHaveLength(0)
  })

  it('de-duplicates near-identical rows within a single incoming batch', () => {
    const incoming = [
      { date:'2026-04-01', type:'Swim', durationMin:45 },
      { date:'2026-04-01', type:'Swim', durationMin:46 },  // within tolerance of the first — drop
    ]
    const result = deduplicateByDate([], incoming)
    expect(result).toHaveLength(1)
  })
})

// v9.363.0 — Concept2 parser must skip (not NaN-leak) malformed time cells
describe('parseConcept2CSV — malformed time', () => {
  const header = 'Date,Description,Total Time,Total Distance,Avg Pace,Stroke Rate'
  it('skips a row whose time is non-numeric (DNF) instead of logging NaN duration', () => {
    const csv = [header,
      '2026-04-01,2k test,7:30.0,2000,1:52.5,30',   // valid
      '2026-04-02,bad row,DNF,2000,1:52.5,30',        // malformed time → skip
    ].join('\n')
    const out = parseConcept2CSV(csv)
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-04-01')
    expect(Number.isFinite(out[0].duration)).toBe(true)
    // no row with NaN duration leaks through
    expect(out.every(r => Number.isFinite(r.duration) && r.duration > 0)).toBe(true)
  })
})

// ─── v9.477 — unified TSS estimator (kept in sync with edge stravaActivity +
// parse-activity; these values are the cross-path contract) ───────────────────
import { estimateTSS } from './fileImport.js'

describe('estimateTSS — unified scale (v9.477)', () => {
  it('1h at LTHR (0.87×max) scores ~100 by definition', () => {
    const maxHR = 200
    const tss = estimateTSS(60, Math.round(maxHR * 0.87), maxHR, null)
    expect(tss).toBeGreaterThanOrEqual(97)
    expect(tss).toBeLessThanOrEqual(103)
  })
  it('no-HR fallback is 50 TSS/h (was 30/h against its own comment)', () => {
    expect(estimateTSS(60, null, null, null)).toBe(50)
    expect(estimateTSS(90, null, null, null)).toBe(75)
    expect(estimateTSS(30, 0, 200, null)).toBe(25)
  })
  it('caps at 400 and scales with intensity', () => {
    const easy = estimateTSS(60, 130, 200, null)
    const hard = estimateTSS(60, 180, 200, null)
    expect(hard).toBeGreaterThan(easy)
    expect(estimateTSS(600, 195, 200, null)).toBe(400)
  })
  it('explicit LTHR overrides the 0.87×max default', () => {
    const withDefault = estimateTSS(60, 160, 200, null)      // lthr 174
    const withLower   = estimateTSS(60, 160, 200, 160)       // 1h AT lthr → ~100
    expect(withLower).toBeGreaterThan(withDefault)
    expect(withLower).toBeGreaterThanOrEqual(97)
    expect(withLower).toBeLessThanOrEqual(103)
  })
})
