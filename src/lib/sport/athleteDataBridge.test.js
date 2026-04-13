import { describe, it, expect } from 'vitest'
import {
  deriveCtlAtl, findRecentResult, sessionFrequencyPerWeek, extractProfileSport, fmtTimeInput, parseTimeInput,
} from './athleteDataBridge.js'

// ── deriveCtlAtl ──────────────────────────────────────────────────────────────
describe('deriveCtlAtl', () => {
  it('returns {ctl:0, atl:0} for empty log', () => {
    expect(deriveCtlAtl([])).toEqual({ ctl: 0, atl: 0 })
    expect(deriveCtlAtl(null)).toEqual({ ctl: 0, atl: 0 })
  })

  it('returns positive CTL for sustained training log', () => {
    // Build 60 days of daily 100 TSS
    const today = new Date()
    const log = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (59 - i))
      return { date: d.toISOString().slice(0, 10), tss: 100 }
    })
    const { ctl, atl } = deriveCtlAtl(log)
    expect(ctl).toBeGreaterThan(0)
    expect(atl).toBeGreaterThan(0)
  })

  it('CTL < ATL after sudden heavy block (fatigue > fitness for short bursts)', () => {
    // Single very heavy day builds ATL faster than CTL
    const today = new Date()
    // Start with baseline
    const log = Array.from({ length: 10 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (10 - i))
      return { date: d.toISOString().slice(0, 10), tss: 200 }
    })
    const { ctl, atl } = deriveCtlAtl(log)
    // After 10 days of 200 TSS, ATL (τ=7) should be higher than CTL (τ=42)
    expect(atl).toBeGreaterThan(ctl)
  })
})

// ── findRecentResult ──────────────────────────────────────────────────────────
describe('findRecentResult', () => {
  it('returns null for empty log', () => {
    expect(findRecentResult([], 'Test')).toBeNull()
    expect(findRecentResult(null, 'Test')).toBeNull()
  })

  it('returns most recent matching entry', () => {
    const log = [
      { type: 'Test', distanceM: 2000, durationSec: 390, date: '2026-01-15' },
      { type: 'Test', distanceM: 2000, durationSec: 380, date: '2026-03-01' },
      { type: 'Easy Run', distanceM: 5000, durationSec: 1800, date: '2026-03-10' },
    ]
    const r = findRecentResult(log, 'Test', 2000)
    expect(r).not.toBeNull()
    expect(r.date).toBe('2026-03-01')  // most recent
    expect(r.timeSec).toBe(380)
  })

  it('returns null when no match for distanceM filter', () => {
    const log = [{ type: 'Test', distanceM: 5000, durationSec: 1200, date: '2026-03-01' }]
    expect(findRecentResult(log, 'Test', 2000)).toBeNull()
  })

  it('falls back to duration×60 when durationSec is absent', () => {
    const log = [{ type: 'Race', distanceM: 5000, duration: 20, date: '2026-02-01' }]
    const r = findRecentResult(log, 'Race')
    expect(r.timeSec).toBe(1200)  // 20 × 60
  })
})

// ── sessionFrequencyPerWeek ───────────────────────────────────────────────────
describe('sessionFrequencyPerWeek', () => {
  it('returns 0 for empty log', () => {
    expect(sessionFrequencyPerWeek([])).toBe(0)
  })

  it('returns correct frequency for dense recent log', () => {
    const today = new Date()
    // 20 sessions in last 4 weeks = 5/week
    const log = Array.from({ length: 20 }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      return { date: d.toISOString().slice(0, 10), tss: 80 }
    })
    expect(sessionFrequencyPerWeek(log, 4)).toBe(5)
  })

  it('ignores sessions older than the window', () => {
    const today = new Date()
    const old = new Date(today)
    old.setDate(old.getDate() - 60)  // 60 days ago, outside 4-week window
    const log = [{ date: old.toISOString().slice(0, 10), tss: 100 }]
    expect(sessionFrequencyPerWeek(log, 4)).toBe(0)
  })
})

// ── extractProfileSport ───────────────────────────────────────────────────────
describe('extractProfileSport', () => {
  it('maps "Rowing" to "rowing"', () => {
    expect(extractProfileSport({ primarySport: 'Rowing' })).toBe('rowing')
  })

  it('maps "Triathlon" to "triathlon"', () => {
    expect(extractProfileSport({ sport: 'triathlon' })).toBe('triathlon')
  })

  it('maps "cycling" substring correctly', () => {
    expect(extractProfileSport({ primarySport: 'Road Cycling' })).toBe('cycling')
  })

  it('returns null for unrecognized sport', () => {
    expect(extractProfileSport({ sport: 'kayaking' })).toBeNull()
  })

  it('returns null for null/empty profile', () => {
    expect(extractProfileSport(null)).toBeNull()
    expect(extractProfileSport({})).toBeNull()
  })
})

// ── fmtTimeInput / parseTimeInput ─────────────────────────────────────────────
describe('fmtTimeInput', () => {
  it('formats 390s as "6:30"', () => {
    expect(fmtTimeInput(390)).toBe('6:30')
  })

  it('returns empty string for null/zero', () => {
    expect(fmtTimeInput(null)).toBe('')
    expect(fmtTimeInput(0)).toBe('')
  })
})

describe('parseTimeInput', () => {
  it('parses "6:30" to 390', () => {
    expect(parseTimeInput('6:30')).toBe(390)
  })

  it('returns null for empty string', () => {
    expect(parseTimeInput('')).toBeNull()
    expect(parseTimeInput(null)).toBeNull()
  })
})
