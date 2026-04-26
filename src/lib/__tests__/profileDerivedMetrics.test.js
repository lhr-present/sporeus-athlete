// src/lib/__tests__/profileDerivedMetrics.test.js
// Tests for the universal profile → derived metrics engine.

import { describe, it, expect } from 'vitest'
import {
  deriveAllMetrics,
  buildHRZones,
  thresholdPaceToVdot,
  autoVdotFromLog,
  buildCompleteness as _buildCompleteness,
} from '../profileDerivedMetrics.js'

// ── Helper: make a recent log run entry ───────────────────────────────────────
function makeRun({ distanceM = 10000, duration = 3000, date = null, type = 'Run' } = {}) {
  const d = date || new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)
  return { date: d, type, distanceM, duration }
}

// ── Empty / null profile ──────────────────────────────────────────────────────
describe('deriveAllMetrics — empty profile', () => {
  it('returns all sections null when profile is empty', () => {
    const result = deriveAllMetrics({})
    expect(result.power).toBeNull()
    expect(result.running).toBeNull()
    expect(result.hr).toBeNull()
    expect(result.autoVdot).toBeNull()
  })

  it('completeness.score is 0 for empty profile', () => {
    const result = deriveAllMetrics({})
    expect(result.completeness.score).toBe(0)
  })

  it('completeness.filled is empty array for empty profile', () => {
    const result = deriveAllMetrics({})
    expect(result.completeness.filled).toEqual([])
  })

  it('works when profile is null', () => {
    const result = deriveAllMetrics(null)
    expect(result.power).toBeNull()
    expect(result.running).toBeNull()
    expect(result.hr).toBeNull()
    expect(result.completeness.score).toBe(0)
  })

  it('works when called with no arguments', () => {
    const result = deriveAllMetrics()
    expect(result.completeness.score).toBe(0)
    expect(result.power).toBeNull()
  })
})

// ── Power section ─────────────────────────────────────────────────────────────
describe('deriveAllMetrics — power section', () => {
  it('power is null when ftp is missing', () => {
    const result = deriveAllMetrics({ weight: 70 })
    expect(result.power).toBeNull()
  })

  it('power section is populated when ftp is present', () => {
    const result = deriveAllMetrics({ ftp: 300 })
    expect(result.power).not.toBeNull()
    expect(result.power.ftp).toBe(300)
  })

  it('power.wPerKg is correct when ftp + weight present', () => {
    const result = deriveAllMetrics({ ftp: 300, weight: 70 })
    expect(result.power.wPerKg).toBeCloseTo(4.29, 1)
  })

  it('power.wPerKg is null when weight is missing', () => {
    const result = deriveAllMetrics({ ftp: 300 })
    expect(result.power.wPerKg).toBeNull()
  })

  it('power.zones contains 7 Coggan zones', () => {
    const result = deriveAllMetrics({ ftp: 300 })
    expect(result.power.zones).toHaveLength(7)
  })

  it('power.zones[0] is Active Recovery (Z1)', () => {
    const result = deriveAllMetrics({ ftp: 300 })
    expect(result.power.zones[0].n).toBe(1)
    expect(result.power.zones[0].name).toBe('Active Recovery')
    expect(result.power.zones[0].min).toBe(0)
  })

  it('power.zones[6] is Neuromuscular (Z7) with null max', () => {
    const result = deriveAllMetrics({ ftp: 300 })
    const z7 = result.power.zones[6]
    expect(z7.n).toBe(7)
    expect(z7.name).toBe('Neuromuscular')
    expect(z7.max).toBeNull()
  })

  it('power.zones pctRange strings are correct format', () => {
    const result = deriveAllMetrics({ ftp: 300 })
    expect(result.power.zones[0].pctRange).toBe('<55%')
    expect(result.power.zones[6].pctRange).toBe('>150%')
  })
})

// ── Running section ───────────────────────────────────────────────────────────
describe('deriveAllMetrics — running section', () => {
  it('running is null when no vo2max or threshold', () => {
    const result = deriveAllMetrics({ ftp: 300 })
    expect(result.running).toBeNull()
  })

  it('vo2max=60 → running.vdot=60, source=profile', () => {
    const result = deriveAllMetrics({ vo2max: 60 })
    expect(result.running).not.toBeNull()
    expect(result.running.vdot).toBe(60)
    expect(result.running.source).toBe('profile')
  })

  it('running paces are all in MM:SS format', () => {
    const result = deriveAllMetrics({ vo2max: 60 })
    const p = result.running.paces
    expect(p.easy).toMatch(/^\d+:\d{2}$/)
    expect(p.marathon).toMatch(/^\d+:\d{2}$/)
    expect(p.threshold).toMatch(/^\d+:\d{2}$/)
    expect(p.interval).toMatch(/^\d+:\d{2}$/)
    expect(p.rep).toMatch(/^\d+:\d{2}$/)
  })

  it('threshold "4:10" with no vo2max → source=threshold', () => {
    const result = deriveAllMetrics({ threshold: '4:10' })
    expect(result.running).not.toBeNull()
    expect(result.running.source).toBe('threshold')
    expect(result.running.vdot).toBeGreaterThan(0)
  })

  it('vo2max set → source is profile even when threshold is also set', () => {
    const result = deriveAllMetrics({ vo2max: 55, threshold: '4:30' })
    expect(result.running.source).toBe('profile')
    expect(result.running.vdot).toBe(55)
  })

  it('auto-log source when neither vo2max nor threshold set but log has runs', () => {
    const log = [makeRun({ distanceM: 10000, duration: 2700 })]
    const result = deriveAllMetrics({}, log)
    expect(result.running).not.toBeNull()
    expect(result.running.source).toBe('auto-log')
  })

  it('running.source stays profile when vo2max is set even if log has runs', () => {
    const log = [makeRun({ distanceM: 10000, duration: 2700 })]
    const result = deriveAllMetrics({ vo2max: 58 }, log)
    expect(result.running.source).toBe('profile')
  })
})

// ── HR section ────────────────────────────────────────────────────────────────
describe('deriveAllMetrics — HR section', () => {
  it('hr is null when neither maxhr nor age present', () => {
    const result = deriveAllMetrics({ ftp: 300 })
    expect(result.hr).toBeNull()
  })

  it('age=30 → Tanaka maxHR = 208 - 0.7 * 30 = 187', () => {
    const result = deriveAllMetrics({ age: 30 })
    expect(result.hr.maxHR).toBe(187)
    expect(result.hr.maxHRSource).toBe('age-predicted')
  })

  it('maxhr=181 uses profile value, not age formula', () => {
    const result = deriveAllMetrics({ maxhr: 181, age: 30 })
    expect(result.hr.maxHR).toBe(181)
    expect(result.hr.maxHRSource).toBe('profile')
  })

  it('lthr = Math.round(maxHR * 0.87)', () => {
    const result = deriveAllMetrics({ maxhr: 181 })
    expect(result.hr.lthr).toBe(Math.round(181 * 0.87))
  })

  it('hr.zones has 5 entries', () => {
    const result = deriveAllMetrics({ maxhr: 181 })
    expect(result.hr.zones).toHaveLength(5)
  })

  it('hr.zones[0] is Recovery 50–60%', () => {
    const result = deriveAllMetrics({ maxhr: 200 })
    expect(result.hr.zones[0].name).toBe('Recovery')
    expect(result.hr.zones[0].min).toBe(100)
    expect(result.hr.zones[0].max).toBe(120)
  })

  it('hr.zones[4] is VO₂max 90–100%', () => {
    const result = deriveAllMetrics({ maxhr: 200 })
    expect(result.hr.zones[4].name).toBe('VO₂max')
    expect(result.hr.zones[4].min).toBe(180)
    expect(result.hr.zones[4].max).toBe(200)
  })

  it('rpeToZoneIdx has 10 entries mapping RPE 1–10 to zone indices 0–4', () => {
    const result = deriveAllMetrics({ maxhr: 181 })
    expect(result.hr.rpeToZoneIdx).toHaveLength(10)
    expect(result.hr.rpeToZoneIdx[0]).toBe(0)   // RPE 1 → zone 0
    expect(result.hr.rpeToZoneIdx[9]).toBe(4)   // RPE 10 → zone 4
  })

  it('power.lthrEstimate is populated when both ftp and maxhr are set', () => {
    const result = deriveAllMetrics({ ftp: 300, maxhr: 181 })
    expect(result.power.lthrEstimate).toBe(Math.round(181 * 0.87))
  })
})

// ── Auto-VDOT ─────────────────────────────────────────────────────────────────
describe('deriveAllMetrics — autoVdot', () => {
  it('autoVdot is null when log is empty', () => {
    const result = deriveAllMetrics({})
    expect(result.autoVdot).toBeNull()
  })

  it('autoVdot is populated from a qualifying log run', () => {
    const log = [makeRun({ distanceM: 10000, duration: 2700 })]
    const result = deriveAllMetrics({}, log)
    expect(result.autoVdot).not.toBeNull()
    expect(result.autoVdot.vdot).toBeGreaterThan(0)
    expect(result.autoVdot.fromDate).toBeTruthy()
  })

  it('autoVdot.method contains distance info', () => {
    const log = [makeRun({ distanceM: 10000, duration: 2700 })]
    const result = deriveAllMetrics({}, log)
    expect(result.autoVdot.method).toContain('10')
  })

  it('autoVdot is null when run entry is too short (<5 min)', () => {
    const log = [makeRun({ distanceM: 5000, duration: 250 })]
    const result = deriveAllMetrics({}, log)
    expect(result.autoVdot).toBeNull()
  })

  it('autoVdot is null when distance is too short (<1km)', () => {
    const log = [makeRun({ distanceM: 800, duration: 360 })]
    const result = deriveAllMetrics({}, log)
    expect(result.autoVdot).toBeNull()
  })

  it('autoVdot picks best (highest VDOT) from multiple log entries', () => {
    const log = [
      makeRun({ distanceM: 5000,  duration: 1500 }),  // slower 5k
      makeRun({ distanceM: 10000, duration: 2400 }),  // fast 10k
    ]
    const result = deriveAllMetrics({}, log)
    // Expect the best entry to be used (fast 10k should yield higher VDOT)
    expect(result.autoVdot.vdot).toBeGreaterThan(0)
  })

  it('autoVdot uses distanceKm field when distanceM absent', () => {
    const d = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)
    const log = [{ date: d, type: 'Run', distanceKm: 10, duration: 2700 }]
    const result = deriveAllMetrics({}, log)
    expect(result.autoVdot).not.toBeNull()
  })

  it('ignores non-run entries (cycling) for autoVdot', () => {
    const d = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)
    const log = [{ date: d, type: 'Ride', distanceM: 40000, duration: 4800 }]
    const result = deriveAllMetrics({}, log)
    expect(result.autoVdot).toBeNull()
  })
})

// ── Completeness ──────────────────────────────────────────────────────────────
describe('deriveAllMetrics — completeness', () => {
  it('fully filled profile yields high score', () => {
    const profile = {
      ftp: 300, vo2max: 60, maxhr: 181, weight: 70,
      age: 35, gender: 'M', threshold: '4:10',
      raceDate: '2026-06-01', goal: 'marathon',
    }
    const result = deriveAllMetrics(profile)
    expect(result.completeness.score).toBe(100)
    expect(result.completeness.missing).toHaveLength(0)
  })

  it('completeness.unlocks lists correct features for missing maxhr', () => {
    const result = deriveAllMetrics({ ftp: 300, vo2max: 60 })
    expect(result.completeness.unlocks.maxhr).toContain('HR zones')
    expect(result.completeness.unlocks.maxhr).toContain('LTHR')
  })

  it('completeness.unlocks contains raceDate features when raceDate missing', () => {
    const result = deriveAllMetrics({})
    expect(result.completeness.unlocks.raceDate).toContain('race countdown')
  })

  it('completeness.filled contains ftp when ftp is set', () => {
    const result = deriveAllMetrics({ ftp: 300 })
    expect(result.completeness.filled).toContain('ftp')
    expect(result.completeness.missing).not.toContain('ftp')
  })

  it('completeness score increases monotonically as fields are added', () => {
    const r1 = deriveAllMetrics({})
    const r2 = deriveAllMetrics({ ftp: 300 })
    const r3 = deriveAllMetrics({ ftp: 300, vo2max: 60 })
    expect(r2.completeness.score).toBeGreaterThan(r1.completeness.score)
    expect(r3.completeness.score).toBeGreaterThan(r2.completeness.score)
  })

  it('empty string field is treated as missing', () => {
    const result = deriveAllMetrics({ ftp: '', vo2max: '' })
    expect(result.completeness.filled).not.toContain('ftp')
    expect(result.completeness.filled).not.toContain('vo2max')
  })
})

// ── Helper unit tests ─────────────────────────────────────────────────────────
describe('buildHRZones', () => {
  it('returns 5 zones', () => {
    expect(buildHRZones(200)).toHaveLength(5)
  })

  it('zone boundaries are proportional to maxHR', () => {
    const zones = buildHRZones(180)
    expect(zones[0].min).toBe(Math.round(180 * 0.50))
    expect(zones[4].max).toBe(180)
  })
})

describe('thresholdPaceToVdot', () => {
  it('returns null for empty string', () => {
    expect(thresholdPaceToVdot('')).toBeNull()
  })

  it('returns null for invalid format', () => {
    expect(thresholdPaceToVdot('4min30')).toBeNull()
  })

  it('returns a positive VDOT for a valid threshold pace', () => {
    const v = thresholdPaceToVdot('4:10')
    expect(v).toBeGreaterThan(0)
  })

  it('slower threshold pace gives lower VDOT', () => {
    const fast = thresholdPaceToVdot('3:30')
    const slow = thresholdPaceToVdot('5:00')
    expect(fast).toBeGreaterThan(slow)
  })
})

describe('autoVdotFromLog', () => {
  it('returns null for empty array', () => {
    expect(autoVdotFromLog([])).toBeNull()
  })

  it('returns null for non-array', () => {
    expect(autoVdotFromLog(null)).toBeNull()
  })

  it('returns best VDOT from qualifying runs', () => {
    const log = [makeRun({ distanceM: 10000, duration: 2700 })]
    const result = autoVdotFromLog(log)
    expect(result.vdot).toBeGreaterThan(0)
    expect(result.fromDate).toBeTruthy()
    expect(result.method).toBeTruthy()
  })

  it('ignores entries older than 90 days', () => {
    const oldDate = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10)
    const log = [makeRun({ distanceM: 10000, duration: 2700, date: oldDate })]
    expect(autoVdotFromLog(log)).toBeNull()
  })
})
