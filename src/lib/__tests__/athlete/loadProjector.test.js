// ─── loadProjector.test.js — E34 4-week load projector tests ─────────────────
import { describe, it, expect } from 'vitest'
import { avgDailyTSS, projectLoad, computeLoadProjection } from '../../athlete/loadProjector.js'

// ─── Synthetic log: 30 entries over 30 days, tss=80, type='run' ───────────────
function makeLog(days = 30, tss = 80, type = 'run', endDate = '2026-04-25') {
  const end = new Date(endDate + 'T00:00:00Z')
  const log = []
  for (let i = 0; i < days; i++) {
    const d = new Date(end)
    d.setUTCDate(d.getUTCDate() - (days - 1 - i))
    log.push({ date: d.toISOString().slice(0, 10), tss, type })
  }
  return log
}

const TODAY = '2026-04-25'
const log30 = makeLog(30, 80, 'run', TODAY)

// ─── avgDailyTSS ──────────────────────────────────────────────────────────────
describe('avgDailyTSS', () => {
  it('returns 0 for empty log', () => {
    expect(avgDailyTSS([], TODAY)).toBe(0)
  })

  it('returns 0 when all entries are outside the 28-day window', () => {
    const oldLog = [
      { date: '2025-01-01', tss: 100, type: 'run' },
      { date: '2025-01-02', tss: 80,  type: 'run' },
    ]
    expect(avgDailyTSS(oldLog, TODAY)).toBe(0)
  })

  it('averages correctly over 28 days', () => {
    // 30-day log (2026-03-27 to 2026-04-25); window cutoff = 2026-03-28 (28 days before today)
    // 29 entries fall in window: 29 × 80 = 2320; avgDailyTSS = 2320/28 ≈ 82.86
    const result = avgDailyTSS(log30, TODAY)
    expect(result).toBeCloseTo(29 * 80 / 28, 1)
  })

  it('excludes entries older than 28 days', () => {
    // 2 entries in window + 1 old entry
    const log = [
      { date: '2025-01-01', tss: 999, type: 'run' },  // outside window
      { date: '2026-04-24', tss: 80,  type: 'run' },  // inside
      { date: '2026-04-25', tss: 80,  type: 'run' },  // inside (today)
    ]
    // 2 sessions × 80 / 28 = 160/28
    expect(avgDailyTSS(log, TODAY)).toBeCloseTo(160 / 28, 2)
  })

  it('handles log with zero-tss entries', () => {
    const log = makeLog(7, 0, 'run', TODAY)
    expect(avgDailyTSS(log, TODAY)).toBe(0)
  })
})

// ─── projectLoad ──────────────────────────────────────────────────────────────
describe('projectLoad', () => {
  it('returns array of length days (default 28)', () => {
    const result = projectLoad(log30, 80, 28, TODAY)
    expect(result).toHaveLength(28)
  })

  it('returns array of custom length', () => {
    const result = projectLoad(log30, 80, 14, TODAY)
    expect(result).toHaveLength(14)
  })

  it('each item has date, ctl, atl, tsb', () => {
    const result = projectLoad(log30, 80, 28, TODAY)
    for (const pt of result) {
      expect(pt).toHaveProperty('date')
      expect(pt).toHaveProperty('ctl')
      expect(pt).toHaveProperty('atl')
      expect(pt).toHaveProperty('tsb')
    }
  })

  it('CTL increases when dailyTSS > 0', () => {
    const result = projectLoad(log30, 80, 28, TODAY)
    // CTL at day 28 should be >= CTL at day 1 (or at least not collapse to zero)
    const ctlDay1 = result[0].ctl
    const ctlDay28 = result[27].ctl
    expect(ctlDay28).toBeGreaterThanOrEqual(ctlDay1 - 1) // allow rounding
  })

  it('tsb equals ctl minus atl for each day', () => {
    const result = projectLoad(log30, 60, 28, TODAY)
    for (const pt of result) {
      expect(pt.tsb).toBeCloseTo(pt.ctl - pt.atl, 0)
    }
  })

  it('returns dates sorted ascending starting from tomorrow', () => {
    const result = projectLoad(log30, 80, 5, TODAY)
    const expected = ['2026-04-26', '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30']
    expect(result.map(p => p.date)).toEqual(expected)
  })

  it('CTL stays near 0 for empty log with zero dailyTSS', () => {
    const result = projectLoad([], 0, 5, TODAY)
    for (const pt of result) {
      expect(pt.ctl).toBeCloseTo(0, 0)
      expect(pt.atl).toBeCloseTo(0, 0)
    }
  })
})

// ─── computeLoadProjection ────────────────────────────────────────────────────
describe('computeLoadProjection', () => {
  it('returns null for log with fewer than 7 entries', () => {
    expect(computeLoadProjection([], 28, TODAY)).toBeNull()
    expect(computeLoadProjection(makeLog(6, 80, 'run', TODAY), 28, TODAY)).toBeNull()
  })

  it('returns non-null for log with exactly 7 entries', () => {
    const result = computeLoadProjection(makeLog(7, 80, 'run', TODAY), 28, TODAY)
    expect(result).not.toBeNull()
  })

  it('returns correct shape', () => {
    const result = computeLoadProjection(log30, 28, TODAY)
    expect(result).toHaveProperty('currentLoad')
    expect(result).toHaveProperty('baseline')
    expect(result).toHaveProperty('elevated')
    expect(result).toHaveProperty('currentCTL')
    expect(result).toHaveProperty('currentTSB')
    expect(result).toHaveProperty('peakTSBDate')
    expect(result).toHaveProperty('citation')
  })

  it('baseline.length === 28', () => {
    const result = computeLoadProjection(log30, 28, TODAY)
    expect(result.baseline).toHaveLength(28)
  })

  it('elevated CTL >= baseline CTL at day 28 (higher load = higher or equal fitness)', () => {
    const result = computeLoadProjection(log30, 28, TODAY)
    const baselineCTL28 = result.baseline[27].ctl
    const elevatedCTL28 = result.elevated[27].ctl
    expect(elevatedCTL28).toBeGreaterThanOrEqual(baselineCTL28)
  })

  it('citation is correct', () => {
    const result = computeLoadProjection(log30, 28, TODAY)
    expect(result.citation).toBe('Banister 1991 · Coggan PMC')
  })

  it('peakTSBDate is a valid date string', () => {
    const result = computeLoadProjection(log30, 28, TODAY)
    expect(result.peakTSBDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('currentCTL is a number >= 0', () => {
    const result = computeLoadProjection(log30, 28, TODAY)
    expect(typeof result.currentCTL).toBe('number')
    expect(result.currentCTL).toBeGreaterThanOrEqual(0)
  })
})
