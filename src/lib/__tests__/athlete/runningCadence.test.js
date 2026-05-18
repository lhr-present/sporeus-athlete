// ─── runningCadence.test.js — Daniels/Heiderscheit 28d cadence trend ─────────
import { describe, it, expect } from 'vitest'
import {
  computeRunningCadenceTrend,
  RUNNING_CADENCE_CITATION,
} from '../../athlete/runningCadence.js'

const TODAY = '2026-05-17'

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Return an ISO date `n` days before TODAY. */
function daysAgo(n) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function runEntry({ cadence, daysAgo: ago = 1, type = 'run', rpe = 5, ...extra }) {
  return { type, date: daysAgo(ago), rpe, ...extra, ...(cadence !== undefined ? { cadence } : {}) }
}

// ─── 1. Empty / non-array log → null ─────────────────────────────────────────
describe('computeRunningCadenceTrend — guard clauses', () => {
  it('returns null for an empty log', () => {
    expect(computeRunningCadenceTrend({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for non-array log', () => {
    expect(computeRunningCadenceTrend({ log: null, today: TODAY })).toBeNull()
    expect(computeRunningCadenceTrend({ log: undefined, today: TODAY })).toBeNull()
  })

  // 2. No running sessions → null
  it('returns null when the log has no running sessions', () => {
    const log = [
      { type: 'bike', date: daysAgo(1), cadence: 90, rpe: 5 },
      { type: 'swim', date: daysAgo(2), cadence: 60, rpe: 5 },
    ]
    expect(computeRunningCadenceTrend({ log, today: TODAY })).toBeNull()
  })

  // 3. <3 valid cadence entries → null
  it('returns null when fewer than 3 running entries carry a valid cadence', () => {
    const log = [
      runEntry({ cadence: 175, daysAgo: 2 }),
      runEntry({ cadence: 178, daysAgo: 5 }),
      // No cadence on this one — only 2 qualify
      { type: 'run', date: daysAgo(7), rpe: 5 },
    ]
    expect(computeRunningCadenceTrend({ log, today: TODAY })).toBeNull()
  })
})

// 4. avg 175 spm → TARGET
describe('computeRunningCadenceTrend — band classification', () => {
  it('avg 175 spm → band TARGET', () => {
    const log = [
      runEntry({ cadence: 173, daysAgo: 2 }),
      runEntry({ cadence: 175, daysAgo: 5 }),
      runEntry({ cadence: 177, daysAgo: 10 }),
    ]
    const r = computeRunningCadenceTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.avgCadence).toBe(175)
    expect(r.band).toBe('TARGET')
    expect(r.n).toBe(3)
    expect(r.citation).toBe(RUNNING_CADENCE_CITATION)
  })

  // 5. avg 160 spm → OVERSTRIDING
  it('avg 160 spm → band OVERSTRIDING', () => {
    const log = [
      runEntry({ cadence: 158, daysAgo: 2 }),
      runEntry({ cadence: 160, daysAgo: 5 }),
      runEntry({ cadence: 162, daysAgo: 10 }),
    ]
    const r = computeRunningCadenceTrend({ log, today: TODAY })
    expect(r.avgCadence).toBe(160)
    expect(r.band).toBe('OVERSTRIDING')
  })

  // 6. avg 167 spm → LONG_STRIDE
  it('avg 167 spm → band LONG_STRIDE', () => {
    const log = [
      runEntry({ cadence: 165, daysAgo: 2 }),
      runEntry({ cadence: 167, daysAgo: 5 }),
      runEntry({ cadence: 169, daysAgo: 10 }),
    ]
    const r = computeRunningCadenceTrend({ log, today: TODAY })
    expect(r.avgCadence).toBe(167)
    expect(r.band).toBe('LONG_STRIDE')
  })

  // 7. avg 190 spm → SHORT_STRIDE
  it('avg 190 spm → band SHORT_STRIDE', () => {
    const log = [
      runEntry({ cadence: 188, daysAgo: 2 }),
      runEntry({ cadence: 190, daysAgo: 5 }),
      runEntry({ cadence: 192, daysAgo: 10 }),
    ]
    const r = computeRunningCadenceTrend({ log, today: TODAY })
    expect(r.avgCadence).toBe(190)
    expect(r.band).toBe('SHORT_STRIDE')
  })
})

// 8. Accepts cadence / spm / avgCadence field names
describe('computeRunningCadenceTrend — field name flexibility', () => {
  it('accepts entries with cadence, spm, or avgCadence', () => {
    const log = [
      { type: 'run', date: daysAgo(2),  rpe: 5, cadence:    175 },
      { type: 'run', date: daysAgo(5),  rpe: 5, spm:        177 },
      { type: 'run', date: daysAgo(10), rpe: 5, avgCadence: 179 },
    ]
    const r = computeRunningCadenceTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.n).toBe(3)
    expect(r.avgCadence).toBe(177)
    expect(r.band).toBe('TARGET')
  })
})

// ─── Extra coverage — windowing, exclusions, sport-field detection, weeklyMeans
describe('computeRunningCadenceTrend — window + exclusions', () => {
  it('excludes entries outside the 28-day window', () => {
    const log = [
      runEntry({ cadence: 175, daysAgo: 5 }),
      runEntry({ cadence: 178, daysAgo: 10 }),
      runEntry({ cadence: 180, daysAgo: 15 }),
      runEntry({ cadence: 100, daysAgo: 45 }), // outside 28d — would skew if included
    ]
    const r = computeRunningCadenceTrend({ log, today: TODAY })
    expect(r.n).toBe(3)
    expect(r.avgCadence).toBeGreaterThan(170)
  })

  it('excludes recovery/walk and RPE<3 entries', () => {
    const log = [
      runEntry({ cadence: 175, daysAgo: 2 }),
      runEntry({ cadence: 178, daysAgo: 5 }),
      runEntry({ cadence: 180, daysAgo: 8 }),
      runEntry({ cadence: 100, daysAgo: 3, type: 'run recovery' }), // excluded
      runEntry({ cadence: 100, daysAgo: 4, type: 'walk' }),         // excluded
      runEntry({ cadence: 100, daysAgo: 6, rpe: 2 }),               // RPE<3 → excluded
    ]
    const r = computeRunningCadenceTrend({ log, today: TODAY })
    expect(r.n).toBe(3)
    expect(r.avgCadence).toBeGreaterThan(170)
  })

  it('detects run sessions via the sport field', () => {
    const log = [
      { sport: 'running', date: daysAgo(2),  rpe: 5, cadence: 175 },
      { sport: 'running', date: daysAgo(5),  rpe: 5, cadence: 177 },
      { sport: 'running', date: daysAgo(10), rpe: 5, cadence: 179 },
    ]
    const r = computeRunningCadenceTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.n).toBe(3)
  })

  it('rejects out-of-range cadence values (clamp 100–250)', () => {
    const log = [
      runEntry({ cadence: 50,  daysAgo: 2 }), // too low
      runEntry({ cadence: 300, daysAgo: 5 }), // too high
      runEntry({ cadence: 175, daysAgo: 8 }), // valid
      runEntry({ cadence: 177, daysAgo: 9 }), // valid
    ]
    // Only 2 valid → null (<3)
    expect(computeRunningCadenceTrend({ log, today: TODAY })).toBeNull()
  })

  it('returns a 4-length weeklyMeans array (oldest → newest)', () => {
    const log = [
      runEntry({ cadence: 170, daysAgo: 25 }), // week 0 (oldest)
      runEntry({ cadence: 174, daysAgo: 16 }), // week 1
      runEntry({ cadence: 178, daysAgo: 9  }), // week 2
      runEntry({ cadence: 182, daysAgo: 2  }), // week 3 (newest)
    ]
    const r = computeRunningCadenceTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeklyMeans).toHaveLength(4)
    expect(r.weeklyMeans[0]).toBe(170)
    expect(r.weeklyMeans[3]).toBe(182)
  })
})
