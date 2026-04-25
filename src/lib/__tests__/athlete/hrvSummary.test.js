import { describe, it, expect } from 'vitest'
import {
  extractHRVEntries,
  computeHRVBaseline,
  lastNEntries,
  computeHRVSummary,
} from '../../athlete/hrvSummary.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Build synthetic recovery entries spanning 30 days.
// hrv values oscillate 3.5–4.2 (realistic lnRMSSD range); some null.
function makeRecovery(n = 30, baseDate = '2026-03-27') {
  const entries = []
  const base = new Date(baseDate + 'T00:00:00Z')
  for (let i = 0; i < n; i++) {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    // Null every 7th entry; otherwise oscillate between 3.5 and 4.2
    const hrv = (i + 1) % 7 === 0 ? null : 3.5 + ((i % 8) * 0.1)
    entries.push({ date: dateStr, hrv })
  }
  return entries
}

// ─── extractHRVEntries ────────────────────────────────────────────────────────
describe('extractHRVEntries', () => {
  it('returns [] for empty array', () => {
    expect(extractHRVEntries([])).toEqual([])
  })

  it('returns [] when called with no argument', () => {
    expect(extractHRVEntries()).toEqual([])
  })

  it('filters out entries with null hrv', () => {
    const recovery = [
      { date: '2026-01-01', hrv: null },
      { date: '2026-01-02', hrv: 3.8 },
    ]
    const result = extractHRVEntries(recovery)
    expect(result).toHaveLength(1)
    expect(result[0].hrv).toBe(3.8)
  })

  it('filters out entries with hrv = 0 (not positive)', () => {
    const recovery = [
      { date: '2026-01-01', hrv: 0 },
      { date: '2026-01-02', hrv: 3.9 },
    ]
    const result = extractHRVEntries(recovery)
    expect(result).toHaveLength(1)
  })

  it('filters out entries with negative hrv', () => {
    const recovery = [
      { date: '2026-01-01', hrv: -1 },
      { date: '2026-01-02', hrv: 4.0 },
    ]
    expect(extractHRVEntries(recovery)).toHaveLength(1)
  })

  it('filters out entries with missing date', () => {
    const recovery = [
      { hrv: 3.8 },
      { date: '2026-01-02', hrv: 4.0 },
    ]
    expect(extractHRVEntries(recovery)).toHaveLength(1)
  })

  it('sorts entries oldest→newest regardless of input order', () => {
    const recovery = [
      { date: '2026-01-03', hrv: 4.0 },
      { date: '2026-01-01', hrv: 3.5 },
      { date: '2026-01-02', hrv: 3.8 },
    ]
    const result = extractHRVEntries(recovery)
    expect(result[0].date).toBe('2026-01-01')
    expect(result[1].date).toBe('2026-01-02')
    expect(result[2].date).toBe('2026-01-03')
  })

  it('returns only { date, hrv } shape', () => {
    const recovery = [{ date: '2026-01-01', hrv: 3.8, extraField: 'x' }]
    const result = extractHRVEntries(recovery)
    expect(result[0]).toEqual({ date: '2026-01-01', hrv: 3.8 })
  })

  it('handles non-array gracefully', () => {
    expect(extractHRVEntries(null)).toEqual([])
    expect(extractHRVEntries(undefined)).toEqual([])
  })
})

// ─── computeHRVBaseline ───────────────────────────────────────────────────────
describe('computeHRVBaseline', () => {
  it('returns null for empty entries', () => {
    expect(computeHRVBaseline([], '2026-04-25')).toBeNull()
  })

  it('returns null for fewer than 7 valid entries in the 28-day window', () => {
    const entries = [
      { date: '2026-04-20', hrv: 3.8 },
      { date: '2026-04-21', hrv: 3.9 },
      { date: '2026-04-22', hrv: 4.0 },
    ]
    expect(computeHRVBaseline(entries, '2026-04-25')).toBeNull()
  })

  it('returns { mean, sd } with positive values for 7+ entries in window', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-04-${String(i + 15).padStart(2, '0')}`,
      hrv: 3.8 + i * 0.02,
    }))
    const result = computeHRVBaseline(entries, '2026-04-25')
    expect(result).not.toBeNull()
    expect(result.mean).toBeGreaterThan(0)
    expect(result.sd).toBeGreaterThanOrEqual(0)
  })

  it('excludes entries outside the 28-day window', () => {
    // 3 recent + 6 old (>28 days ago)
    const recent = Array.from({ length: 3 }, (_, i) => ({
      date: `2026-04-${String(22 + i).padStart(2, '0')}`,
      hrv: 3.8,
    }))
    const old = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-03-${String(1 + i).padStart(2, '0')}`,
      hrv: 3.8,
    }))
    expect(computeHRVBaseline([...recent, ...old], '2026-04-25')).toBeNull()
  })

  it('mean and sd are numeric (rounded)', () => {
    const entries = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-04-${String(i + 10).padStart(2, '0')}`,
      hrv: 3.8 + i * 0.03,
    }))
    const result = computeHRVBaseline(entries, '2026-04-25')
    expect(typeof result.mean).toBe('number')
    expect(typeof result.sd).toBe('number')
  })
})

// ─── lastNEntries ─────────────────────────────────────────────────────────────
describe('lastNEntries', () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({
    date: `2026-04-${String(i + 1).padStart(2, '0')}`,
    hrv: 3.5 + i * 0.03,
  }))

  it('returns last 14 entries sorted oldest→newest', () => {
    const result = lastNEntries(entries, 14)
    expect(result).toHaveLength(14)
    expect(result[0].date).toBe('2026-04-07')
    expect(result[13].date).toBe('2026-04-20')
  })

  it('returns all entries when n >= entries.length', () => {
    expect(lastNEntries(entries, 50)).toHaveLength(20)
  })

  it('returns [] for empty input', () => {
    expect(lastNEntries([], 14)).toEqual([])
  })

  it('returns [] for non-array', () => {
    expect(lastNEntries(null, 14)).toEqual([])
  })

  it('returns single entry when n=1', () => {
    const result = lastNEntries(entries, 1)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-04-20')
  })
})

// ─── computeHRVSummary ────────────────────────────────────────────────────────
describe('computeHRVSummary', () => {
  it('returns null for empty recovery', () => {
    expect(computeHRVSummary([])).toBeNull()
  })

  it('returns null when fewer than 7 valid hrv entries', () => {
    const recovery = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      hrv: 3.8,
    }))
    expect(computeHRVSummary(recovery, '2026-04-25')).toBeNull()
  })

  it('returns correct shape for sufficient entries', () => {
    const recovery = makeRecovery(30, '2026-03-27')
    const result = computeHRVSummary(recovery, '2026-04-25')
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('current')
    expect(result).toHaveProperty('baseline')
    expect(result).toHaveProperty('readiness')
    expect(result).toHaveProperty('trend')
    expect(result).toHaveProperty('suppressed')
    expect(result).toHaveProperty('last14')
    expect(result).toHaveProperty('citation')
  })

  it('current equals the latest hrv value', () => {
    const recovery = makeRecovery(30, '2026-03-27')
    const entries = recovery
      .filter(e => e.hrv != null && e.hrv > 0)
      .sort((a, b) => a.date < b.date ? -1 : 1)
    const expected = entries[entries.length - 1].hrv
    const result = computeHRVSummary(recovery, '2026-04-25')
    expect(result.current).toBe(expected)
  })

  it('last14 has at most 14 entries', () => {
    const recovery = makeRecovery(30, '2026-03-27')
    const result = computeHRVSummary(recovery, '2026-04-25')
    expect(result.last14.length).toBeLessThanOrEqual(14)
    expect(result.last14.length).toBeGreaterThan(0)
  })

  it('citation matches expected string', () => {
    const recovery = makeRecovery(30, '2026-03-27')
    const result = computeHRVSummary(recovery, '2026-04-25')
    expect(result.citation).toBe('Plews 2012 · Kiviniemi 2007')
  })

  it('suppressed is a boolean', () => {
    const recovery = makeRecovery(30, '2026-03-27')
    const result = computeHRVSummary(recovery, '2026-04-25')
    expect(typeof result.suppressed).toBe('boolean')
  })

  it('suppressed is true when recent HRV well below baseline (CV >=10% and drop >5%)', () => {
    // Build entries: first 20 days high HRV, last 7 days very low and variable
    const baseDate = new Date('2026-03-27T00:00:00Z')
    const recovery = []
    for (let i = 0; i < 20; i++) {
      const d = new Date(baseDate)
      d.setUTCDate(baseDate.getUTCDate() + i)
      recovery.push({ date: d.toISOString().slice(0, 10), hrv: 4.2 })
    }
    // Last 7 days: alternating very low (1.5) and higher (4.0) to create high CV + drop
    const lowHighPairs = [1.5, 4.0, 1.5, 4.0, 1.5, 4.0, 1.5]
    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate)
      d.setUTCDate(baseDate.getUTCDate() + 20 + i)
      recovery.push({ date: d.toISOString().slice(0, 10), hrv: lowHighPairs[i] })
    }
    const today = new Date(baseDate)
    today.setUTCDate(baseDate.getUTCDate() + 26)
    const result = computeHRVSummary(recovery, today.toISOString().slice(0, 10))
    expect(result).not.toBeNull()
    expect(result.suppressed).toBe(true)
  })
})
