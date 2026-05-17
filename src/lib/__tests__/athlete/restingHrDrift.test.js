// ─── restingHrDrift.test.js — pure-fn tests for RHR drift detector ──────────
import { describe, it, expect } from 'vitest'
import {
  detectRestingHrDrift,
  RHR_DRIFT_CITATION,
} from '../../athlete/restingHrDrift.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function daysBefore(todayISO, n) {
  const [y, m, d] = todayISO.split('-').map(v => parseInt(v, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - n)
  return dt.toISOString().slice(0, 10)
}

/** Build a recovery array spanning `total` consecutive days ending at `today`.
 *  RHR values are taken from the `values` array, where values[0] is the
 *  OLDEST day and values[total-1] is `today`.
 */
function buildRecovery(today, values) {
  const total = values.length
  const out = []
  for (let i = 0; i < total; i++) {
    // i = 0 → oldest, i = total-1 → today
    const ageFromToday = total - 1 - i
    out.push({ date: daysBefore(today, ageFromToday), restingHR: values[i] })
  }
  return out
}

const TODAY = '2026-05-17'

// ── tests ────────────────────────────────────────────────────────────────────

describe('detectRestingHrDrift — guard rails', () => {
  it('(a) returns null for empty / missing recovery input', () => {
    expect(detectRestingHrDrift({ recovery: [], today: TODAY })).toBeNull()
    expect(detectRestingHrDrift({ recovery: null, today: TODAY })).toBeNull()
    expect(detectRestingHrDrift({})).toBeNull()
  })

  it('(b) returns null when baseline sample is too small (< 7)', () => {
    // 6 baseline-eligible days + 3 recent days = 9 days total, but baseline
    // window only has 6 entries → null.
    const values = [50, 50, 50, 50, 50, 50, 52, 52, 52]   // 9 total
    const recovery = buildRecovery(TODAY, values)
    expect(detectRestingHrDrift({ recovery, today: TODAY })).toBeNull()
  })

  it('(b2) returns null when recent sample < 3 entries', () => {
    // Only 2 entries — recent window can't form.
    const recovery = [
      { date: daysBefore(TODAY, 1), restingHR: 50 },
      { date: daysBefore(TODAY, 0), restingHR: 55 },
    ]
    expect(detectRestingHrDrift({ recovery, today: TODAY })).toBeNull()
  })
})

describe('detectRestingHrDrift — non-drift cases', () => {
  it('(c) stable RHR around baseline → isDrifting = false', () => {
    // 14 baseline + 3 recent, all ~50 bpm.
    const values = Array.from({ length: 17 }, () => 50)
    const recovery = buildRecovery(TODAY, values)
    const r = detectRestingHrDrift({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.isDrifting).toBe(false)
    expect(r.baseline).toBeCloseTo(50, 1)
    expect(r.recent3dMean).toBeCloseTo(50, 1)
    expect(r.deltaPct).toBeCloseTo(0, 1)
    expect(r.consecutiveDriftDays).toBe(0)
  })

  it('(d) one-off spike on the most recent day only → isDrifting = false', () => {
    // 14 days at 50 bpm baseline, then 2 days at 50, last day at 60.
    const values = [
      ...Array.from({ length: 14 }, () => 50),  // baseline window
      50, 50, 60,                                // recent 3: only last is high
    ]
    const recovery = buildRecovery(TODAY, values)
    const r = detectRestingHrDrift({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.isDrifting).toBe(false)
    // 1-day spike → at most 1 consecutive drift day.
    expect(r.consecutiveDriftDays).toBeLessThan(3)
  })

  it('(f) downward shift (recent < baseline) → isDrifting = false', () => {
    // 14 days at 55 bpm baseline, last 3 at 48 bpm (parasympathetic dominance).
    const values = [
      ...Array.from({ length: 14 }, () => 55),
      48, 48, 48,
    ]
    const recovery = buildRecovery(TODAY, values)
    const r = detectRestingHrDrift({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.isDrifting).toBe(false)
    expect(r.deltaPct).toBeLessThan(0)
    expect(r.consecutiveDriftDays).toBe(0)
  })
})

describe('detectRestingHrDrift — drift detection', () => {
  it('(e) 3 consecutive days at +6% above baseline → isDrifting = true, consecutiveDriftDays = 3', () => {
    // Baseline ~50 bpm, recent 3 days at 53 bpm (+6%).
    const values = [
      ...Array.from({ length: 14 }, () => 50),
      53, 53, 53,
    ]
    const recovery = buildRecovery(TODAY, values)
    const r = detectRestingHrDrift({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.isDrifting).toBe(true)
    expect(r.consecutiveDriftDays).toBe(3)
    expect(r.deltaPct).toBeGreaterThan(5)
    expect(r.citation).toBe(RHR_DRIFT_CITATION)
  })

  it('(g) baseline math — baseline=50 recent=55 → deltaPct=10', () => {
    // 14 days at 50 (baseline) + 3 days at 55 (recent).
    const values = [
      ...Array.from({ length: 14 }, () => 50),
      55, 55, 55,
    ]
    const recovery = buildRecovery(TODAY, values)
    const r = detectRestingHrDrift({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.baseline).toBeCloseTo(50, 1)
    expect(r.recent3dMean).toBeCloseTo(55, 1)
    expect(r.deltaPct).toBeCloseTo(10, 1)
    expect(r.isDrifting).toBe(true)
  })

  it('(h) baseline window excludes the last 3 days — recent spike does NOT pollute baseline', () => {
    // If the baseline accidentally included the last 3 days, the spike at
    // the end would lift the baseline and partially cancel the delta. We
    // assert that baseline is exactly the older 14-day mean (50), NOT a
    // mix that includes the recent 70-bpm days.
    const values = [
      ...Array.from({ length: 14 }, () => 50),   // baseline window
      70, 70, 70,                                 // recent — would be ~57.x avg if pooled
    ]
    const recovery = buildRecovery(TODAY, values)
    const r = detectRestingHrDrift({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.baseline).toBeCloseTo(50, 1)        // strictly the older 14 days
    expect(r.recent3dMean).toBeCloseTo(70, 1)
    expect(r.deltaPct).toBeCloseTo(40, 1)
    expect(r.isDrifting).toBe(true)
  })

  it('respects custom thresholds — driftThresholdPct=10 raises the bar', () => {
    // +6% recent: would trigger at 5% threshold, but NOT at 10%.
    const values = [
      ...Array.from({ length: 14 }, () => 50),
      53, 53, 53,
    ]
    const recovery = buildRecovery(TODAY, values)
    const r = detectRestingHrDrift({
      recovery, today: TODAY, driftThresholdPct: 10,
    })
    expect(r).not.toBeNull()
    expect(r.isDrifting).toBe(false)
  })

  it('includes citation string', () => {
    const values = [
      ...Array.from({ length: 14 }, () => 50),
      55, 55, 55,
    ]
    const recovery = buildRecovery(TODAY, values)
    const r = detectRestingHrDrift({ recovery, today: TODAY })
    expect(r.citation).toMatch(/Buchheit/)
    expect(r.citation).toMatch(/Plews/)
    expect(r.citation).toMatch(/Bouchard/)
  })
})
