// src/lib/__tests__/onboarding/demoData.test.js — E9
import { describe, it, expect } from 'vitest'
import { generateDemoSessions, offsetDate, getDemoSports } from '../../onboarding/demoData.js'

// ── offsetDate ─────────────────────────────────────────────────────────────

describe('offsetDate', () => {
  it('adds days correctly', () => {
    expect(offsetDate('2024-06-01', 0)).toBe('2024-06-01')
    expect(offsetDate('2024-06-01', 29)).toBe('2024-06-30')
    expect(offsetDate('2024-06-30', 1)).toBe('2024-07-01')
  })
  it('handles month rollover', () => {
    expect(offsetDate('2024-01-31', 1)).toBe('2024-02-01')
  })
})

// ── getDemoSports ──────────────────────────────────────────────────────────

describe('getDemoSports', () => {
  it('returns non-empty array', () => {
    const sports = getDemoSports()
    expect(Array.isArray(sports)).toBe(true)
    expect(sports.length).toBeGreaterThan(0)
  })
  it('includes Running, Cycling, Triathlon', () => {
    const sports = getDemoSports()
    expect(sports).toContain('Running')
    expect(sports).toContain('Cycling')
    expect(sports).toContain('Triathlon')
  })
})

// ── generateDemoSessions ───────────────────────────────────────────────────

describe('generateDemoSessions', () => {
  const BASE = '2024-06-01'

  it('returns an array', () => {
    expect(Array.isArray(generateDemoSessions(BASE))).toBe(true)
  })

  it('all sessions have is_demo=true', () => {
    const sessions = generateDemoSessions(BASE)
    for (const s of sessions) {
      expect(s.is_demo).toBe(true)
    }
  })

  it('all sessions have required fields', () => {
    const sessions = generateDemoSessions(BASE)
    for (const s of sessions) {
      expect(typeof s.date).toBe('string')
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(typeof s.type).toBe('string')
      expect(typeof s.duration).toBe('number')
      expect(s.duration).toBeGreaterThan(0)
      expect(typeof s.rpe).toBe('number')
      expect(typeof s.tss).toBe('number')
    }
  })

  it('all sessions fall within 30-day window', () => {
    const sessions = generateDemoSessions(BASE)
    const endDate  = offsetDate(BASE, 29)
    for (const s of sessions) {
      expect(s.date >= BASE).toBe(true)
      expect(s.date <= endDate).toBe(true)
    }
  })

  it('generates sessions for Running', () => {
    const sessions = generateDemoSessions(BASE, 'Running')
    const types = [...new Set(sessions.map(s => s.type))]
    expect(types).toContain('Running')
  })

  it('generates sessions for Cycling', () => {
    const sessions = generateDemoSessions(BASE, 'Cycling')
    const types = [...new Set(sessions.map(s => s.type))]
    expect(types).toContain('Cycling')
  })

  it('generates sessions for Triathlon — includes all 3 sports', () => {
    const sessions = generateDemoSessions(BASE, 'Triathlon')
    const types = [...new Set(sessions.map(s => s.type))]
    expect(types).toContain('Running')
    expect(types).toContain('Cycling')
    expect(types).toContain('Swimming')
  })

  it('notes contain [DEMO] marker', () => {
    const sessions = generateDemoSessions(BASE)
    for (const s of sessions) {
      expect(s.notes).toContain('[DEMO]')
    }
  })

  it('unknown sport falls back to default plan (Running)', () => {
    const sessions = generateDemoSessions(BASE, 'Rowing')
    expect(sessions.length).toBeGreaterThan(0)
    // Should have sessions (falls back to Running plan)
    expect(sessions.every(s => s.is_demo)).toBe(true)
  })

  it('total TSS is meaningful for PMC chart (> 300 over 30d)', () => {
    const sessions = generateDemoSessions(BASE, 'Running')
    const totalTSS = sessions.reduce((s, x) => s + x.tss, 0)
    expect(totalTSS).toBeGreaterThan(300)
  })

  it('no sessions have tss=0 (demo data should always have load)', () => {
    const sessions = generateDemoSessions(BASE, 'Cycling')
    for (const s of sessions) {
      expect(s.tss).toBeGreaterThan(0)
    }
  })
})
