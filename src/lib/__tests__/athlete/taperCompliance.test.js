import { describe, it, expect } from 'vitest'
import {
  detectTaperCompliance,
  TAPER_COMPLIANCE_CITATION,
} from '../../athlete/taperCompliance.js'

const TODAY = '2026-05-17'

function isoOffset(days, base = TODAY) {
  const d = new Date(base + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build a log entry roughly `daysAgo` days before TODAY with the given
 * duration in minutes. `daysAgo` may be a non-integer for fine control.
 */
function entry(daysAgo, duration) {
  return { date: isoOffset(-daysAgo), duration }
}

/**
 * Build a flat "baseline" log = 7 sessions/week of `dur` minutes across
 * days [14..28) before today, giving a baseline weekly volume of 7×dur.
 */
function flatBaseline(dur) {
  const out = []
  for (let d = 14; d < 28; d++) out.push(entry(d, dur))
  return out
}

describe('detectTaperCompliance — pure fn', () => {
  it('returns null when profile has no race date', () => {
    const r = detectTaperCompliance({ log: flatBaseline(60), profile: {}, today: TODAY })
    expect(r).toBeNull()
  })

  it('returns null when the race is in the past', () => {
    const r = detectTaperCompliance({
      log: flatBaseline(60),
      profile: { raceDate: isoOffset(-3) },
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('returns null when the race is more than 14 days away', () => {
    const r = detectTaperCompliance({
      log: flatBaseline(60),
      profile: { raceDate: isoOffset(21) },
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('classifies a 30% volume cut at 10 days out as ON_TARGET', () => {
    // Baseline weekly volume = 7 × 60 = 420 min. Cut 30% → this week = 294 min.
    const log = [
      ...flatBaseline(60),
      // 7 sessions in the last week summing to 294 min (42 each)
      entry(6, 42), entry(5, 42), entry(4, 42), entry(3, 42),
      entry(2, 42), entry(1, 42), entry(0.5, 42),
    ]
    const r = detectTaperCompliance({
      log,
      profile: { raceDate: isoOffset(10) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.daysToRace).toBe(10)
    expect(r.expectedVolumeCutPct).toBe(30)
    expect(r.actualVolumeCutPct).toBeCloseTo(30, 0)
    expect(r.compliance).toBe('ON_TARGET')
    expect(r.citation).toBe(TAPER_COMPLIANCE_CITATION)
  })

  it('classifies only a 10% volume cut at 10 days out as UNDERCUT', () => {
    // Baseline = 420 min/wk. 10% cut → 378 min this week.
    const log = [
      ...flatBaseline(60),
      entry(6, 54), entry(5, 54), entry(4, 54), entry(3, 54),
      entry(2, 54), entry(1, 54), entry(0.5, 54),
    ]
    const r = detectTaperCompliance({
      log,
      profile: { raceDate: isoOffset(10) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.compliance).toBe('UNDERCUT')
    expect(r.actualVolumeCutPct).toBeLessThan(30 - 15)
  })

  it('at 5 days out (expected 50% cut), 30% actual reads UNDERCUT', () => {
    // Baseline = 420 min/wk. 30% cut → 294 min this week.
    const log = [
      ...flatBaseline(60),
      entry(6, 42), entry(5, 42), entry(4, 42), entry(3, 42),
      entry(2, 42), entry(1, 42), entry(0.5, 42),
    ]
    const r = detectTaperCompliance({
      log,
      profile: { raceDate: isoOffset(5) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.expectedVolumeCutPct).toBe(50)
    expect(r.compliance).toBe('UNDERCUT')
  })

  it('at 5 days out, a 70% volume cut reads OVERCUT', () => {
    // Baseline = 420 min/wk. 70% cut → 126 min this week.
    const log = [
      ...flatBaseline(60),
      entry(6, 18), entry(5, 18), entry(4, 18), entry(3, 18),
      entry(2, 18), entry(1, 18), entry(0.5, 18),
    ]
    const r = detectTaperCompliance({
      log,
      profile: { raceDate: isoOffset(5) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.expectedVolumeCutPct).toBe(50)
    expect(r.compliance).toBe('OVERCUT')
    expect(r.actualVolumeCutPct).toBeGreaterThan(50 + 15)
  })

  it('returns null when baseline weekly volume is 0 (no prior training)', () => {
    const r = detectTaperCompliance({
      log: [
        // some recent activity but nothing in the baseline window
        entry(2, 60), entry(1, 60),
      ],
      profile: { raceDate: isoOffset(10) },
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('accepts nextRaceDate as a fallback for raceDate', () => {
    const r = detectTaperCompliance({
      log: flatBaseline(60),
      profile: { nextRaceDate: isoOffset(10) },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.daysToRace).toBe(10)
  })
})
