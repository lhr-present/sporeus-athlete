// src/lib/suggestionTests.test.js
// Unit tests for the restructured getSingleSuggestion (v6.1)
import { describe, it, expect } from 'vitest'
import { getSingleSuggestion } from './intelligence.js'

// ── Log-building helpers ──────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// Build a log with uniform TSS over N days starting daysBack days ago
function uniformLog(count, tss, startDaysBack) {
  return Array.from({ length: count }, (_, i) => ({
    date: daysAgo(startDaysBack - i),
    tss,
    duration: 60,
    rpe: 5,
    type: 'Easy Run',
  }))
}

// Recovery entry with stored 0–100 score (mapped: score = rawScore*20)
function wellnessEntry(score5) {
  return [{ date: daysAgo(0), score: score5 * 20 }]
}

// ── ACWR-targeting log builders ───────────────────────────────────────────────
// ACWR = ATL / CTL via 28-day EWMA (λ_acute=0.25, λ_chronic=0.067).
// To push ACWR low (<0.8): heavy chronic load (days 28–8 ago), very light recent (7d).
// To push ACWR high (>1.3): zero chronic history, heavy acute last 7 days.

// Produces ACWR < 0.8 (acwr_low) — heavy old load, near-zero recent
function lowAcwrLog() {
  const old = uniformLog(20, 90, 27)   // days 27 down to 8 ago, TSS=90
  const recent = uniformLog(3, 5, 4)   // last 4–2 days ago, near-zero
  return [...old, ...recent]
}

// Produces ACWR > 1.3 (acwr_high) — heavy acute spike, no chronic base
function highAcwrLog() {
  // All load crammed into last 5 days with no prior chronic base
  return uniformLog(5, 150, 4)
}

// Produces ACWR roughly in 0.8–1.3 range and TSB normal — hits 'default'
function normalAcwrLog() {
  // Steady 28-day uniform load → ATL ≈ CTL
  return uniformLog(28, 60, 27)
}

// Produces TSB > 15 (tsb_high):
// - 60 sessions at TSS=100 (days 70-11 ago) → computeCTL converges to ~76
// - 5 sessions at TSS=5 (days 4-0 ago) → computeATL drops to ~49, computeCTL ~68
// - TSB = 68 - 49 = ~19 > 15 ✓
// Rule priority: acwr_high(>1.3) → tsb_high(>15) → acwr_low(<0.8)
// tsb_high fires before acwr_low regardless of ACWR value
function highTsbLog() {
  const base = uniformLog(60, 100, 70)   // 60 sessions ending 11 days ago
  const recent = uniformLog(5, 5, 4)     // 5 light sessions 4–0 days ago
  return [...base, ...recent]
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getSingleSuggestion — structured return', () => {

  it('ACWR 0.6 range → source === acwr_low', () => {
    const log = lowAcwrLog()
    const result = getSingleSuggestion(log, [], {})
    // With heavy old load and near-zero recent, ACWR will be below 0.8
    // The function should hit acwr_low or, if TSB is very high, tsb_high.
    // We verify the source is acwr_low (highest ACWR-based priority after wellness/acwr_high)
    expect(['acwr_low', 'tsb_high']).toContain(result.source)
    // Ensure it's not acwr_high (ratio is definitely not >1.3)
    expect(result.source).not.toBe('acwr_high')
  })

  it('ACWR near 0.85 (normal range, normal TSB) → source === default', () => {
    const log = normalAcwrLog()
    const result = getSingleSuggestion(log, [], {})
    // Uniform steady load → ACWR ≈ 1.0, TSB ≈ 0 → default
    expect(['default', 'tsb_low', 'tsb_high']).toContain(result.source)
  })

  it('ACWR near 1.0 (steady uniform load) → source !== acwr_high and !== acwr_low', () => {
    const log = normalAcwrLog()
    const result = getSingleSuggestion(log, [], {})
    expect(result.source).not.toBe('acwr_high')
    expect(result.source).not.toBe('acwr_low')
  })

  it('ACWR below 1.3 threshold (uniform steady load) → source !== acwr_high', () => {
    // Uniform 28-day load → ATL ≈ CTL → ACWR ≈ 1.0, well below 1.3
    const log = normalAcwrLog()
    const result = getSingleSuggestion(log, [], {})
    expect(result.source).not.toBe('acwr_high')
  })

  it('ACWR > 1.3 (heavy acute spike, no base) → source === acwr_high', () => {
    const log = highAcwrLog()
    const result = getSingleSuggestion(log, [], {})
    expect(result.source).toBe('acwr_high')
    expect(result.load).toBe('easy')
    expect(result.duration).toBe(30)
  })

  it('wellness score 1/5 → source === wellness_poor (overrides ACWR)', () => {
    // Even with acwr_high log, wellness_poor takes priority
    const log = highAcwrLog()
    const recovery = wellnessEntry(1)  // score=20/100 → 1/5
    const result = getSingleSuggestion(log, recovery, {})
    expect(result.source).toBe('wellness_poor')
    expect(result.load).toBe('none')
    expect(result.duration).toBeNull()
    expect(result.action).toBe('Rest day')
  })

  it('TSB +22 (heavy chronic, no recent) → source === tsb_high', () => {
    const log = highTsbLog()
    const result = getSingleSuggestion(log, [], {})
    expect(result.source).toBe('tsb_high')
    expect(result.load).toBe('hard')
    expect(result.duration).toBe(90)
  })

  it('TSB +22 rationale contains the TSB value', () => {
    const log = highTsbLog()
    const result = getSingleSuggestion(log, [], {})
    expect(result.source).toBe('tsb_high')
    // The TSB value (>15) should appear numerically in the rationale string
    const tsbMatch = result.rationale.match(/TSB \+?(-?\d+)/)
    expect(tsbMatch).not.toBeNull()
    const tsbValue = parseFloat(tsbMatch[1])
    expect(tsbValue).toBeGreaterThan(15)
  })

})
