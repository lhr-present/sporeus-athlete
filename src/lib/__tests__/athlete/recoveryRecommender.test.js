// src/lib/__tests__/athlete/recoveryRecommender.test.js — E26
// Tests for wellnessFromEntry, hoursSince, getTopRecoveryProtocols.
// No mocking of internal libs — uses real getRecommendedProtocols calls.
import { describe, it, expect } from 'vitest'
import {
  wellnessFromEntry,
  hoursSince,
  getTopRecoveryProtocols,
} from '../../athlete/recoveryRecommender.js'

const TODAY = '2026-04-25'

// ── wellnessFromEntry ─────────────────────────────────────────────────────────

describe('wellnessFromEntry', () => {
  it('null entry returns null', () => {
    expect(wellnessFromEntry(null)).toBeNull()
  })

  it('undefined entry returns null', () => {
    expect(wellnessFromEntry(undefined)).toBeNull()
  })

  it('entry with all fields missing returns null', () => {
    expect(wellnessFromEntry({ date: '2026-04-25', hrv: 55 })).toBeNull()
  })

  it('all-3 entry returns 3.0', () => {
    const entry = { sleep: 3, energy: 3, soreness: 3 }
    // (3 + 3 + (6-3)) / 3 = 9/3 = 3.0
    expect(wellnessFromEntry(entry)).toBe(3.0)
  })

  it('high energy low soreness gives score > 3', () => {
    const entry = { sleep: 4, energy: 5, soreness: 1 }
    // (4 + 5 + 5) / 3 = 14/3 ≈ 4.7
    const score = wellnessFromEntry(entry)
    expect(score).toBeGreaterThan(3)
  })

  it('perfect recovery (all 5s, soreness 1) returns 5', () => {
    const entry = { sleep: 5, energy: 5, soreness: 1 }
    // (5 + 5 + 5) / 3 = 5.0
    expect(wellnessFromEntry(entry)).toBe(5.0)
  })

  it('worst case (sleep=1, energy=1, soreness=5) returns 1', () => {
    const entry = { sleep: 1, energy: 1, soreness: 5 }
    // (1 + 1 + 1) / 3 = 1.0
    expect(wellnessFromEntry(entry)).toBe(1.0)
  })

  it('partial fields use defaults of 3 for missing ones', () => {
    const entry = { sleep: 5 }
    // (5 + 3 + (6-3)) / 3 = 11/3 ≈ 3.7
    const score = wellnessFromEntry(entry)
    expect(score).toBe(3.7)
  })
})

// ── hoursSince ────────────────────────────────────────────────────────────────

describe('hoursSince', () => {
  it('same date returns 0', () => {
    expect(hoursSince(TODAY, TODAY)).toBe(0)
  })

  it('1 day ago returns 24', () => {
    expect(hoursSince('2026-04-24', TODAY)).toBe(24)
  })

  it('2 days ago returns 48', () => {
    expect(hoursSince('2026-04-23', TODAY)).toBe(48)
  })

  it('null dateStr returns null', () => {
    expect(hoursSince(null, TODAY)).toBeNull()
  })

  it('empty string dateStr returns null', () => {
    expect(hoursSince('', TODAY)).toBeNull()
  })
})

// ── getTopRecoveryProtocols ───────────────────────────────────────────────────

describe('getTopRecoveryProtocols', () => {
  it('null inputs return protocols array (fallback defaults from getRecommendedProtocols)', () => {
    const result = getTopRecoveryProtocols(null, null, 3, TODAY)
    expect(Array.isArray(result.protocols)).toBe(true)
    expect(result.protocols.length).toBeGreaterThan(0)
  })

  it('null inputs expose null wellnessScore, sessionTSS, hoursSinceSession', () => {
    const result = getTopRecoveryProtocols(null, null, 3, TODAY)
    expect(result.wellnessScore).toBeNull()
    expect(result.sessionTSS).toBeNull()
    expect(result.hoursSinceSession).toBeNull()
  })

  it('with real data — array length <= limit', () => {
    const recovery = { sleep: 2, energy: 2, soreness: 4, date: '2026-04-24' }
    const session  = { date: '2026-04-24', tss: 120, type: 'run' }
    const result = getTopRecoveryProtocols(recovery, session, 3, TODAY)
    expect(result.protocols.length).toBeLessThanOrEqual(3)
  })

  it('all returned protocols have id and name fields', () => {
    const recovery = { sleep: 3, energy: 3, soreness: 3 }
    const session  = { date: '2026-04-23', tss: 60, type: 'run' }
    const result = getTopRecoveryProtocols(recovery, session, 3, TODAY)
    for (const p of result.protocols) {
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('name')
    }
  })

  it('limit=1 returns at most 1 protocol', () => {
    const recovery = { sleep: 4, energy: 4, soreness: 2 }
    const session  = { date: '2026-04-24', tss: 50, type: 'bike' }
    const result = getTopRecoveryProtocols(recovery, session, 1, TODAY)
    expect(result.protocols.length).toBeLessThanOrEqual(1)
  })

  it('wellnessScore is derived correctly from recovery entry', () => {
    const recovery = { sleep: 3, energy: 3, soreness: 3 }
    const result = getTopRecoveryProtocols(recovery, null, 3, TODAY)
    expect(result.wellnessScore).toBe(3.0)
  })

  it('sessionTSS and hoursSinceSession are derived from latestSession', () => {
    const session = { date: '2026-04-23', tss: 100 }
    const result = getTopRecoveryProtocols(null, session, 3, TODAY)
    expect(result.sessionTSS).toBe(100)
    expect(result.hoursSinceSession).toBe(48)
  })

  it('high TSS recent session includes a protocol with id nutrition_window', () => {
    const recovery = { sleep: 3, energy: 3, soreness: 3 }
    const session  = { date: TODAY, tss: 100, type: 'run' } // < 2h, tss > 80
    const result = getTopRecoveryProtocols(recovery, session, 3, TODAY)
    const ids = result.protocols.map(p => p.id)
    expect(ids).toContain('nutrition_window')
  })
})
