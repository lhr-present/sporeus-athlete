// src/lib/__tests__/science/efficiencyFactor.test.js
// E12 — Citation-grounded tests for efficiencyFactor.js
//
// References:
//   Coggan A.R. (2003). Training and Racing with a Power Meter. VeloPress.
//   Allen H. & Coggan A.R. (2010). Training & Racing with a Power Meter (2nd ed.).
//
// Reference scenario: an athlete with NP=220W and avgHR=140bpm.
//   EF = 220 / 140 = 1.571  (Coggan 2003 cycling definition)

import { describe, it, expect } from 'vitest'
import { computeEF, efTrend } from '../../science/efficiencyFactor.js'

// ── computeEF — cycling (Coggan 2003) ─────────────────────────────────────────

describe('computeEF — cycling (Coggan 2003)', () => {
  it('returns null when session is null', () => {
    expect(computeEF(null)).toBeNull()
  })

  it('returns null when avgHR is missing', () => {
    expect(computeEF({ np: 200, sport: 'cycling' })).toBeNull()
  })

  it('returns null when avgHR is below minimum (< 40 bpm)', () => {
    expect(computeEF({ avgHR: 30, np: 200, sport: 'cycling' })).toBeNull()
  })

  it('returns null when no power and no pace', () => {
    expect(computeEF({ avgHR: 140, sport: 'cycling' })).toBeNull()
  })

  // Reference: Coggan (2003) — EF = NP / avgHR = 220 / 140 ≈ 1.571
  it('computes EF = 1.571 for NP=220W, avgHR=140bpm (Coggan 2003)', () => {
    const result = computeEF({ avgHR: 140, np: 220, sport: 'cycling' })
    expect(result).not.toBeNull()
    expect(result.ef).toBeCloseTo(1.571, 2)
    expect(result.metric).toBe('np/hr')
    expect(result.sport).toBe('cycling')
  })

  // Coggan: NP preferred; avgPower used as fallback
  it('uses avgPower as fallback when np is absent', () => {
    const result = computeEF({ avgHR: 140, avgPower: 200, sport: 'cycling' })
    expect(result).not.toBeNull()
    expect(result.metric).toBe('power/hr')
    expect(result.ef).toBeCloseTo(200 / 140, 2)
  })

  it('prefers np over avgPower when both provided', () => {
    const result = computeEF({ avgHR: 140, np: 220, avgPower: 200, sport: 'cycling' })
    expect(result.ef).toBeCloseTo(220 / 140, 2)
    expect(result.metric).toBe('np/hr')
  })
})

// ── computeEF — running (Coggan 2003 adapted) ────────────────────────────────

describe('computeEF — running (Coggan 2003 adapted)', () => {
  // Reference: running EF = avgPaceMPerMin / avgHR
  // e.g. 5 m/s = 300 m/min; avgHR = 150 → EF = 300/150 = 2.000
  it('computes EF = 2.000 for pace=300m/min, avgHR=150bpm', () => {
    const result = computeEF({ avgHR: 150, avgPaceMPerMin: 300, sport: 'running' })
    expect(result).not.toBeNull()
    expect(result.ef).toBeCloseTo(2.0, 2)
    expect(result.metric).toBe('pace/hr')
    expect(result.sport).toBe('running')
  })

  it('returns null when pace is zero', () => {
    expect(computeEF({ avgHR: 150, avgPaceMPerMin: 0, sport: 'running' })).toBeNull()
  })
})

// ── computeEF — sport auto-detection ─────────────────────────────────────────

describe('computeEF — auto sport detection', () => {
  it('detects cycling when np provided and sport omitted', () => {
    const result = computeEF({ avgHR: 140, np: 220 })
    expect(result?.sport).toBe('cycling')
  })

  it('detects running when avgPaceMPerMin provided and sport omitted', () => {
    const result = computeEF({ avgHR: 150, avgPaceMPerMin: 250 })
    expect(result?.sport).toBe('running')
  })
})

// ── efTrend — Coggan (2003) ───────────────────────────────────────────────────

describe('efTrend — Coggan (2003)', () => {
  it('returns null when sessions array is empty', () => {
    expect(efTrend([], 30)).toBeNull()
  })

  it('returns null when fewer than 8 valid sessions in window', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      avgHR: 140, np: 220, sport: 'cycling',
    }))
    expect(efTrend(sessions, 30)).toBeNull()
  })

  it('returns trend object with required fields for ≥ 8 sessions', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      avgHR: 140, np: 220, sport: 'cycling',
    }))
    const result = efTrend(sessions, 30)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('trend')
    expect(result).toHaveProperty('changePercent')
    expect(result).toHaveProperty('cv')
    expect(result).toHaveProperty('sessionsN')
    expect(result).toHaveProperty('mean')
    expect(result).toHaveProperty('efValues')
    expect(result).toHaveProperty('dates')
    expect(result).toHaveProperty('citation')
  })

  it('detects "stable" when EF is constant across sessions', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      avgHR: 140, np: 220, sport: 'cycling',
    }))
    const result = efTrend(sessions, 30)
    expect(result.trend).toBe('stable')
    expect(result.changePercent).toBeCloseTo(0, 1)
    expect(result.cv).toBeCloseTo(0, 3)
  })

  it('detects "improving" when EF rises ≥ 2% first→second half', () => {
    // NP constant at 220W, but HR decreases over time → EF increases
    // First 5: avgHR=150 → EF=220/150=1.467
    // Last 5:  avgHR=140 → EF=220/140=1.571 (+7%)
    const sessions = [
      ...Array.from({ length: 5 }, (_, i) => ({
        date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        avgHR: 150, np: 220, sport: 'cycling',
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: `2026-04-${String(i + 1).padStart(2, '0')}`,
        avgHR: 140, np: 220, sport: 'cycling',
      })),
    ]
    const result = efTrend(sessions, 40)
    expect(result).not.toBeNull()
    expect(result.trend).toBe('improving')
    expect(result.changePercent).toBeGreaterThanOrEqual(2)
  })

  it('detects "declining" when EF drops ≥ 2% first→second half', () => {
    // HR rises over time → EF decreases
    const sessions = [
      ...Array.from({ length: 5 }, (_, i) => ({
        date: `2026-03-${String(i + 1).padStart(2, '0')}`,
        avgHR: 140, np: 220, sport: 'cycling',
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: `2026-04-${String(i + 1).padStart(2, '0')}`,
        avgHR: 155, np: 220, sport: 'cycling',
      })),
    ]
    const result = efTrend(sessions, 40)
    expect(result).not.toBeNull()
    expect(result.trend).toBe('declining')
    expect(result.changePercent).toBeLessThanOrEqual(-2)
  })

  it('excludes sessions older than windowDays', () => {
    // 8 sessions within window + 5 very old ones
    const old = Array.from({ length: 5 }, (_, i) => ({
      date: '2025-01-01',
      avgHR: 140, np: 220, sport: 'cycling',
    }))
    const recent = Array.from({ length: 8 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      avgHR: 140, np: 220, sport: 'cycling',
    }))
    const result = efTrend([...old, ...recent], 30)
    expect(result).not.toBeNull()
    expect(result.sessionsN).toBe(8)
  })
})
