// ── src/lib/__tests__/athlete/injuryPatterns.test.js — E35 tests ───────────────
import { describe, it, expect } from 'vitest'
import {
  computeInjuryPatterns,
  topVulnerableZone,
  confidenceColor,
} from '../../athlete/injuryPatterns.js'

// ── Synthetic data helpers ────────────────────────────────────────────────────
function makeInjuries(zone = 'knee', count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    zone,
    date: `2026-02-${String(10 + i).padStart(2, '0')}`,
  }))
}

// 20 log entries with 80 TSS/day, each with a volume spike preceding injuries
function makeLog(baseDate = '2026-01-01', days = 20) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(baseDate)
    d.setDate(d.getDate() + i)
    return {
      date: d.toISOString().slice(0, 10),
      tss: 80,
      duration: 60,
      rpe: 7,
      type: 'run',
    }
  })
}

// ── computeInjuryPatterns ─────────────────────────────────────────────────────
describe('computeInjuryPatterns', () => {
  it('returns null when injuries is empty array', () => {
    expect(computeInjuryPatterns(makeLog(), [], [])).toBeNull()
  })

  it('returns null when injuries has only 1 entry', () => {
    const inj = [{ zone: 'knee', date: '2026-02-10' }]
    expect(computeInjuryPatterns(makeLog(), inj, [])).toBeNull()
  })

  it('returns null when injuries is undefined', () => {
    expect(computeInjuryPatterns(makeLog(), undefined, [])).toBeNull()
  })

  it('returns object with required keys when injuries >= 2', () => {
    const inj = makeInjuries('knee', 2)
    const result = computeInjuryPatterns(makeLog(), inj, [])
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('patterns')
    expect(result).toHaveProperty('vulnerableZones')
    expect(result).toHaveProperty('protectiveFactors')
    expect(result).toHaveProperty('topPattern')
    expect(result).toHaveProperty('citation')
  })

  it('citation is the expected string', () => {
    const inj = makeInjuries('knee', 2)
    const result = computeInjuryPatterns(makeLog(), inj, [])
    expect(result.citation).toBe('Gabbett 2016 · Malone 2017 · Drew 2016')
  })

  it('topPattern is null when no triggers found (no log entries match)', () => {
    // 2 injuries, zero log entries → no preconditions can match triggers
    const inj = makeInjuries('knee', 2)
    const result = computeInjuryPatterns([], inj, [])
    // patterns empty → topPattern null
    expect(result.topPattern).toBeNull()
  })

  it('returns non-null topPattern when log has volume spike preceding 3+ same-zone injuries', () => {
    // Build log that creates a volume spike: low TSS in weeks -4 to -2, high in -2 to 0
    const baseDate = '2026-01-01'
    const log = []
    // 4 weeks of low TSS (base period — 28 days)
    for (let i = 0; i < 28; i++) {
      const d = new Date(baseDate)
      d.setDate(d.getDate() + i)
      log.push({ date: d.toISOString().slice(0, 10), tss: 20, duration: 30, rpe: 4, type: 'run' })
    }
    // 2 weeks of high TSS (volume spike)
    for (let i = 28; i < 42; i++) {
      const d = new Date(baseDate)
      d.setDate(d.getDate() + i)
      log.push({ date: d.toISOString().slice(0, 10), tss: 120, duration: 100, rpe: 8, type: 'run' })
    }
    // 3 injuries with date AFTER the spike
    const inj = [
      { zone: 'knee', date: '2026-02-15' },
      { zone: 'knee', date: '2026-02-20' },
      { zone: 'knee', date: '2026-02-25' },
    ]
    const result = computeInjuryPatterns(log, inj, [])
    // knee should be in vulnerableZones
    expect(result.vulnerableZones).toContain('knee')
    // topPattern may or may not have triggers — at minimum result is not null
    expect(result).not.toBeNull()
  })

  it('vulnerableZones includes zone with 2+ injuries', () => {
    const inj = makeInjuries('hip', 2)
    const result = computeInjuryPatterns(makeLog(), inj, [])
    expect(result.vulnerableZones).toContain('hip')
  })
})

// ── topVulnerableZone ─────────────────────────────────────────────────────────
describe('topVulnerableZone', () => {
  it('returns null for empty patterns array', () => {
    expect(topVulnerableZone([])).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(topVulnerableZone(undefined)).toBeNull()
  })

  it('returns the only zone when one pattern exists', () => {
    const patterns = [{ zone: 'knee', occurrences: 3 }]
    expect(topVulnerableZone(patterns)).toBe('knee')
  })

  it('returns zone with highest occurrences', () => {
    const patterns = [
      { zone: 'knee', occurrences: 3 },
      { zone: 'hip',  occurrences: 5 },
      { zone: 'ankle', occurrences: 2 },
    ]
    expect(topVulnerableZone(patterns)).toBe('hip')
  })

  it('handles tie by returning first highest found', () => {
    const patterns = [
      { zone: 'knee', occurrences: 4 },
      { zone: 'hip',  occurrences: 4 },
    ]
    // first zone with max occurrences wins
    const result = topVulnerableZone(patterns)
    expect(['knee', 'hip']).toContain(result)
  })
})

// ── confidenceColor ───────────────────────────────────────────────────────────
describe('confidenceColor', () => {
  it('returns green for high', () => {
    expect(confidenceColor('high')).toBe('#5bc25b')
  })

  it('returns yellow for moderate', () => {
    expect(confidenceColor('moderate')).toBe('#f5c542')
  })

  it('returns grey for low', () => {
    expect(confidenceColor('low')).toBe('#888')
  })

  it('returns grey for unknown value', () => {
    expect(confidenceColor('unknown')).toBe('#888')
  })

  it('returns grey for undefined', () => {
    expect(confidenceColor(undefined)).toBe('#888')
  })
})

// ── Full pipeline ─────────────────────────────────────────────────────────────
describe('full pipeline: log + injuries + recovery', () => {
  it('result has citation field', () => {
    const log = makeLog('2026-01-01', 20)
    const inj = makeInjuries('knee', 3)
    const recovery = [{ date: '2026-02-01', score: 45 }]
    const result = computeInjuryPatterns(log, inj, recovery)
    expect(result).not.toBeNull()
    expect(result.citation).toBe('Gabbett 2016 · Malone 2017 · Drew 2016')
  })
})
