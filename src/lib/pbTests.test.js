import { describe, it, expect } from 'vitest'
import { detectPersonalBests } from './intelligence.js'

describe('detectPersonalBests', () => {
  it('detects highest TSS for session type', () => {
    const existingLog = [
      { id: 1, date: '2024-01-01', type: 'Easy Run', tss: 95 },
      { id: 2, date: '2024-01-08', type: 'Easy Run', tss: 80 },
    ]
    const newEntry = { id: 3, date: '2024-01-15', type: 'Easy Run', tss: 102 }
    const result = detectPersonalBests(newEntry, existingLog)
    expect(result).not.toBeNull()
    expect(result.length).toBeGreaterThan(0)
    const str = result[0]
    expect(str).toContain('95')
    expect(str).toContain('102')
  })

  it('detects highest single-week TSS total', () => {
    // Build a previous week with total 380 TSS
    // Use a fixed reference: current entry is in week starting 2024-01-14 (Sunday)
    // Previous week: 2024-01-07 – 2024-01-13
    const existingLog = [
      { id: 1, date: '2024-01-07', type: 'Easy Run', tss: 130 },
      { id: 2, date: '2024-01-09', type: 'Ride', tss: 130 },
      { id: 3, date: '2024-01-11', type: 'Easy Run', tss: 120 },
      // This week (2024-01-14) entries so far — 200 already in log
      { id: 4, date: '2024-01-14', type: 'Easy Run', tss: 200 },
    ]
    // New entry pushes this week to 420 (200 + 220)
    const newEntry = { id: 5, date: '2024-01-16', type: 'Ride', tss: 220 }
    const result = detectPersonalBests(newEntry, existingLog)
    expect(result).not.toBeNull()
    const weekPB = result.find(r => r.includes('single-week'))
    expect(weekPB).toBeDefined()
    expect(weekPB).toContain('420')
    expect(weekPB).toContain('380')
  })

  it('returns null when no PB is set', () => {
    const existingLog = [
      { id: 1, date: '2024-01-01', type: 'Easy Run', tss: 80 },
      { id: 2, date: '2024-01-08', type: 'Easy Run', tss: 75 },
    ]
    // New entry has TSS 50 — below existing max of 80
    const newEntry = { id: 3, date: '2024-01-15', type: 'Easy Run', tss: 50 }
    const result = detectPersonalBests(newEntry, existingLog)
    expect(result).toBeNull()
  })

  it('returns null for empty existing log (no prev to compare)', () => {
    const newEntry = { id: 1, date: '2024-01-15', type: 'Easy Run', tss: 90 }
    const result = detectPersonalBests(newEntry, [])
    expect(result).toBeNull()
  })

  it('returns multiple PB strings when multiple bests are set in one session', () => {
    // Build a log with entries spread over several weeks so the weekly comparison fires.
    // Previous weeks have max TSS per type of 100, and best weekly total of 200.
    // This week already has 0 entries; new entry has TSS 150 — beats type PB (100)
    // and weekly total (150) beats previous best week (200)? No — need thisWeek > bestPrevWeek.
    // Strategy: previous best week = 140, new entry alone = 150 → weekly PB fires too.
    const existingLog = [
      // Week of 2024-01-07 (Sun) — total 140
      { id: 1, date: '2024-01-07', type: 'Easy Run', tss: 70 },
      { id: 2, date: '2024-01-09', type: 'Easy Run', tss: 70 },
      // Week of 2023-12-31 — total 80
      { id: 3, date: '2023-12-31', type: 'Easy Run', tss: 80 },
    ]
    // New entry in week of 2024-01-14: TSS 150 → beats type max (70) and weekly total (150 > 140)
    const newEntry = { id: 4, date: '2024-01-14', type: 'Easy Run', tss: 150 }
    const result = detectPersonalBests(newEntry, existingLog)
    expect(result).not.toBeNull()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('returns null for null newEntry (defensive)', () => {
    const result = detectPersonalBests(null, [{ id: 1, date: '2024-01-01', type: 'Easy Run', tss: 80 }])
    expect(result).toBeNull()
  })
})
