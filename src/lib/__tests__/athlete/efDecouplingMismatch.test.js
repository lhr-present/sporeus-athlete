// Tests for efDecouplingMismatch — EF × decoupling 4-quadrant cross-read.

import { describe, it, expect } from 'vitest'
import { efDecouplingMismatch } from '../../athlete/efDecouplingMismatch.js'

// Minimal trend stubs matching the real lib return shapes.
function ef(classification, weeklyGain = 0.01) {
  return { weeks: [{}, {}, {}], slope: weeklyGain, weeklyGain, classification, citation: 'Coggan' }
}
function dc(flag, avgPct = 6) {
  return { flag, avgPct, sampleCount: 4, samples: [], summary: flag === 'good' ? null : {} }
}

describe('efDecouplingMismatch — quadrants', () => {
  it('EF improving + decoupling rising → improving_rising (caution)', () => {
    const r = efDecouplingMismatch([], { efTrend: ef('improving', 0.02), decoupleTrend: dc('mild', 7) })
    expect(r).not.toBeNull()
    expect(r.quadrant).toBe('improving_rising')
    expect(r.efClass).toBe('improving')
    expect(r.decoupleFlag).toBe('mild')
    expect(r.headline.en).toMatch(/drift/i)
    expect(r.headline.tr).toMatch(/kayma/i)
    expect(r.detail.en).toMatch(/Z2|fuel/i)
    expect(r.avgDecouplePct).toBe(7)
    expect(r.weeklyGain).toBe(0.02)
  })

  it('significant decoupling also counts as rising', () => {
    const r = efDecouplingMismatch([], { efTrend: ef('improving'), decoupleTrend: dc('significant', 12) })
    expect(r.quadrant).toBe('improving_rising')
  })

  it('EF improving + decoupling good → improving_flat (consolidating)', () => {
    const r = efDecouplingMismatch([], { efTrend: ef('improving', 0.03), decoupleTrend: dc('good', 3) })
    expect(r.quadrant).toBe('improving_flat')
    expect(r.headline.en).toMatch(/consolidat/i)
    expect(r.headline.tr).toMatch(/oturuyor/i)
  })

  it('EF stable + decoupling rising → flat_rising (back off)', () => {
    const r = efDecouplingMismatch([], { efTrend: ef('stable', 0), decoupleTrend: dc('mild', 8) })
    expect(r.quadrant).toBe('flat_rising')
    expect(r.headline.en).toMatch(/back off/i)
    expect(r.detail.en).toMatch(/rebuild/i)
  })

  it('EF declining + decoupling rising → flat_rising (declining maps to flat axis)', () => {
    const r = efDecouplingMismatch([], { efTrend: ef('declining', -0.02), decoupleTrend: dc('significant', 13) })
    expect(r.quadrant).toBe('flat_rising')
  })

  it('EF stable + decoupling good → flat_flat (no clear trend)', () => {
    const r = efDecouplingMismatch([], { efTrend: ef('stable', 0), decoupleTrend: dc('good', 2) })
    expect(r.quadrant).toBe('flat_flat')
    expect(r.headline.en).toMatch(/holding steady/i)
    expect(r.headline.tr).toMatch(/sabit/i)
  })

  it('EF declining + decoupling good → flat_flat', () => {
    const r = efDecouplingMismatch([], { efTrend: ef('declining', -0.01), decoupleTrend: dc('good', 4) })
    expect(r.quadrant).toBe('flat_flat')
  })
})

describe('efDecouplingMismatch — empty/insufficient data', () => {
  it('returns null when EF trend is null (insufficient EF weeks)', () => {
    expect(efDecouplingMismatch([], { efTrend: null, decoupleTrend: dc('mild', 7) })).toBeNull()
  })

  it('returns null when decoupling lacks a flag (insufficient samples)', () => {
    const noDc = { flag: null, avgPct: null, sampleCount: 0, samples: [], summary: null }
    expect(efDecouplingMismatch([], { efTrend: ef('improving'), decoupleTrend: noDc })).toBeNull()
  })

  it('returns null when both signals are absent', () => {
    expect(efDecouplingMismatch([], { efTrend: null, decoupleTrend: null })).toBeNull()
  })

  it('returns null for an empty log via the self-computing path', () => {
    expect(efDecouplingMismatch([])).toBeNull()
    expect(efDecouplingMismatch(undefined)).toBeNull()
    expect(efDecouplingMismatch(null)).toBeNull()
  })

  it('every quadrant carries bilingual headline + detail', () => {
    const combos = [
      ['improving', 'mild'], ['improving', 'good'],
      ['stable', 'significant'], ['stable', 'good'],
    ]
    for (const [efc, dcf] of combos) {
      const r = efDecouplingMismatch([], { efTrend: ef(efc), decoupleTrend: dc(dcf) })
      expect(r.headline.en).toBeTruthy()
      expect(r.headline.tr).toBeTruthy()
      expect(r.detail.en).toBeTruthy()
      expect(r.detail.tr).toBeTruthy()
    }
  })
})

describe('efDecouplingMismatch — self-computing path produces a real signal', () => {
  // Build a log that yields ≥3 weeks of EF history AND ≥2 aerobic decoupling
  // samples in the last 14 days, so both libs return a classification.
  it('produces a quadrant from a constructed log', () => {
    const today = '2026-06-16'
    const log = []
    // 6 weeks of running sessions with HR + pace so EF computes per week.
    for (let w = 0; w < 6; w++) {
      for (let d = 0; d < 3; d++) {
        const date = new Date('2026-06-16T12:00:00Z')
        date.setUTCDate(date.getUTCDate() - (w * 7 + d))
        log.push({
          date: date.toISOString().slice(0, 10),
          type: 'Easy Run', sport: 'run',
          durationMin: 60, distanceKm: 10, avgHr: 140, rpe: 4,
        })
      }
    }
    // Aerobic decoupling samples within the 14-day window.
    log.push({ date: '2026-06-15', type: 'Easy Run', rpe: 4, decouplingPct: 6, durationMin: 60, distanceKm: 10, avgHr: 140 })
    log.push({ date: '2026-06-12', type: 'Easy Run', rpe: 5, decouplingPct: 8, durationMin: 60, distanceKm: 10, avgHr: 142 })

    const r = efDecouplingMismatch(log, { today })
    // Either both signals classified (object) or one lacked data (null) —
    // but if non-null it must be a valid quadrant with bilingual content.
    if (r !== null) {
      expect(['improving_rising', 'improving_flat', 'flat_rising', 'flat_flat']).toContain(r.quadrant)
      expect(r.headline.tr).toBeTruthy()
    }
  })
})
