import { describe, it, expect } from 'vitest'
import {
  stratifyAutonomicBalance,
  AUTONOMIC_BALANCE_CITATION,
} from '../../athlete/hrvAutonomicBalance.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TODAY = '2026-05-15'

function isoMinus(today, days) {
  const ms = new Date(today + 'T00:00:00Z').getTime() - days * 86400000
  return new Date(ms).toISOString().slice(0, 10)
}

// Build a 28d window (28 entries ending TODAY) of raw RMSSD values from `producer`.
// producer(i) — i runs 0 (oldest, 28d ago) → 27 (today).
function makeRMSSD(today, producer, n = 28) {
  const out = []
  for (let i = 0; i < n; i++) {
    out.push({ date: isoMinus(today, n - 1 - i), rmssd: producer(i) })
  }
  return out
}

// ─── Citation constant ───────────────────────────────────────────────────────
describe('AUTONOMIC_BALANCE_CITATION', () => {
  it('exports the expected citation string', () => {
    expect(AUTONOMIC_BALANCE_CITATION).toBe('Plews & Buchheit 2017; Stanley 2013; Buchheit 2014')
  })
})

// ─── (a) null / empty input ──────────────────────────────────────────────────
describe('stratifyAutonomicBalance — null/empty input', () => {
  it('returns null for an empty array', () => {
    expect(stratifyAutonomicBalance([], TODAY)).toBeNull()
  })

  it('returns null for non-array input', () => {
    expect(stratifyAutonomicBalance(null, TODAY)).toBeNull()
    expect(stratifyAutonomicBalance(undefined, TODAY)).toBeNull()
  })

  it('returns null when no entries have a usable HRV value', () => {
    const r = stratifyAutonomicBalance([
      { date: '2026-05-10' },
      { date: '2026-05-11', rmssd: 0 },
    ], TODAY)
    expect(r).toBeNull()
  })
})

// ─── (b) insufficient sample ─────────────────────────────────────────────────
describe('stratifyAutonomicBalance — insufficient sample', () => {
  it('marks sampleAdequate=false and forces BALANCED with < 4 entries in 7d', () => {
    // Only 3 entries in last week → 7d sample under-powered
    const entries = [
      { date: isoMinus(TODAY, 6), rmssd: 50 },
      { date: isoMinus(TODAY, 4), rmssd: 52 },
      { date: isoMinus(TODAY, 1), rmssd: 51 },
    ]
    const r = stratifyAutonomicBalance(entries, TODAY)
    expect(r).not.toBeNull()
    expect(r.sampleAdequate).toBe(false)
    expect(r.state).toBe('BALANCED')
    expect(r.sampleSize.d7).toBe(3)
  })

  it('marks sampleAdequate=false when 28d sample < 14 entries', () => {
    // 7 entries each in last week + week-2 → d7=7 (ok), d28=10 (under)
    const entries = []
    for (let i = 0; i < 5; i++) entries.push({ date: isoMinus(TODAY, i), rmssd: 50 })
    for (let i = 8; i < 13; i++) entries.push({ date: isoMinus(TODAY, i), rmssd: 50 })
    const r = stratifyAutonomicBalance(entries, TODAY)
    expect(r.sampleAdequate).toBe(false)
    expect(r.state).toBe('BALANCED')
  })
})

// ─── (c) PARASYMPATHETIC_RECOVERED ───────────────────────────────────────────
describe('stratifyAutonomicBalance — recovered state', () => {
  it('flags PARASYMPATHETIC_RECOVERED when 7d mean clearly above baseline + 0.5·SD with low CV', () => {
    // 21 oldest days hover at 45 ms, 7 newest at 65 ms → 7d ln mean above baseline + 0.5σ
    const entries = makeRMSSD(TODAY, i => (i < 21 ? 45 : 65))
    const r = stratifyAutonomicBalance(entries, TODAY)
    expect(r.sampleAdequate).toBe(true)
    expect(r.state).toBe('PARASYMPATHETIC_RECOVERED')
    expect(r.mean7d).toBeGreaterThan(r.baseline28d)
  })
})

// ─── (d) SYMPATHETIC_STRAINED via low mean ──────────────────────────────────
describe('stratifyAutonomicBalance — strained state via depressed mean', () => {
  it('flags SYMPATHETIC_STRAINED when 7d mean clearly below baseline − 0.5·SD', () => {
    // 21 oldest at 60 ms, 7 newest at 40 ms → 7d ln mean below baseline − 0.5σ
    const entries = makeRMSSD(TODAY, i => (i < 21 ? 60 : 40))
    const r = stratifyAutonomicBalance(entries, TODAY)
    expect(r.state).toBe('SYMPATHETIC_STRAINED')
    expect(r.mean7d).toBeLessThan(r.baseline28d)
  })
})

// ─── (e) BALANCED state ──────────────────────────────────────────────────────
describe('stratifyAutonomicBalance — balanced state', () => {
  it('returns BALANCED when 7d mean sits within ±0.5·SD of baseline', () => {
    // Stable around 55 ms with mild oscillation — 7d and 28d means converge
    const entries = makeRMSSD(TODAY, i => 55 + ((i % 4) - 1.5) * 2)
    const r = stratifyAutonomicBalance(entries, TODAY)
    expect(r.sampleAdequate).toBe(true)
    expect(r.state).toBe('BALANCED')
  })
})

// ─── (f) accepts both rmssd and lnRmssd input ───────────────────────────────
describe('stratifyAutonomicBalance — input forms', () => {
  it('accepts entries with pre-computed lnRmssd and produces same state as rmssd form', () => {
    const rmssdEntries = makeRMSSD(TODAY, i => (i < 21 ? 45 : 65))
    const lnEntries = rmssdEntries.map(e => ({ date: e.date, lnRmssd: Math.log(e.rmssd) }))
    const a = stratifyAutonomicBalance(rmssdEntries, TODAY)
    const b = stratifyAutonomicBalance(lnEntries, TODAY)
    expect(b.state).toBe(a.state)
    expect(b.mean7d).toBeCloseTo(a.mean7d, 3)
    expect(b.baseline28d).toBeCloseTo(a.baseline28d, 3)
  })
})

// ─── (g) CV > 12 forces strained ─────────────────────────────────────────────
describe('stratifyAutonomicBalance — CV blowout', () => {
  it('flags SYMPATHETIC_STRAINED when CV > 12% regardless of mean direction', () => {
    // Wildly oscillating values, but the 7d cluster is high so the
    // mean-direction rule would otherwise call this RECOVERED.
    const entries = makeRMSSD(TODAY, i => {
      // Half-cycle alternation between 20 ms and 120 ms over the 28d window
      // → very high CV. Last 7 entries are pushed up so mean7d > baseline.
      if (i >= 21) return i % 2 === 0 ? 100 : 130
      return i % 2 === 0 ? 20 : 120
    })
    const r = stratifyAutonomicBalance(entries, TODAY)
    expect(r.cv).toBeGreaterThan(12)
    expect(r.state).toBe('SYMPATHETIC_STRAINED')
  })
})

// ─── (h) future dates filtered out ───────────────────────────────────────────
describe('stratifyAutonomicBalance — future-date filter', () => {
  it('ignores entries whose date is after `today`', () => {
    // Stable baseline with mild oscillation → naturally BALANCED.
    const baseline = makeRMSSD(TODAY, i => 55 + ((i % 4) - 1.5) * 2)
    // Add a spurious future entry that, if respected, would land inside the
    // 7d window and skew mean7d well above baseline → would flip to RECOVERED.
    const withFuture = [...baseline, { date: isoMinus(TODAY, -5), rmssd: 200 }]
    const filtered = stratifyAutonomicBalance(withFuture, TODAY)
    const unfilteredEquivalent = stratifyAutonomicBalance(baseline, TODAY)

    // The future entry must not show up in either window.
    expect(filtered.sampleSize.d7).toBe(unfilteredEquivalent.sampleSize.d7)
    expect(filtered.sampleSize.d28).toBe(unfilteredEquivalent.sampleSize.d28)
    expect(filtered.state).toBe(unfilteredEquivalent.state)
    expect(filtered.state).toBe('BALANCED')
  })
})
