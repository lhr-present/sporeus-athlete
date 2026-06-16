// @vitest-environment jsdom
// ─── AthleteRow.test.jsx — top-alert prescriptive caption ─────────────────────
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../../contexts/LangCtx.jsx'
import { topAlert, AlertCaption, buildInsightInput } from '../../coach/AthleteRow.jsx'
import { getAthleteInsights } from '../../../lib/ruleInsights.js'

// Build a demo-style _log: `tss` on each of the last `days` days (offset 0 = today).
function logForLastDays(tssByOffset) {
  const today = new Date()
  return Object.entries(tssByOffset).map(([offset, tss]) => {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - Number(offset))
    return { date: d.toISOString().slice(0, 10), tss }
  })
}

afterEach(cleanup)

function renderCaption(ath, lang = 'en') {
  return render(
    <LangCtx.Provider value={{ t: k => k, lang, setLang: () => {} }}>
      <AlertCaption ath={ath} />
    </LangCtx.Provider>
  )
}

describe('topAlert', () => {
  it('returns null for a healthy athlete (no active non-readiness alert)', () => {
    expect(topAlert({ acwr_ratio: 1.1, adherence_pct: 90, last_hrv_score: 7 })).toBeNull()
  })

  it('never returns the readiness pseudo-alert even when readiness is high', () => {
    // High ACWR drives readiness to "high" but readiness is excluded from topAlert.
    const alert = topAlert({ acwr_ratio: 1.8, adherence_pct: 90, last_hrv_score: 7 })
    expect(alert === null || alert.key !== 'readiness').toBe(true)
  })

  it('returns the highest-severity active alert when one is present', () => {
    // Build an alert set directly to confirm ordering contract: getAthleteInsights
    // sorts severity ascending, so the first flagged non-readiness entry is most severe.
    const alerts = getAthleteInsights({
      acwr: 1.0, wellnessAvg: 60,
      loads7days: [10, 10, 10, 50, 50, 50, 50], // week2 >> week1 → loadTrend flags
    })
    const active = alerts.find(a => a.flag && a.key !== 'readiness')
    expect(active).toBeDefined()
    expect(active.action).toBeTruthy()
    expect(active.actionTr).toBeTruthy()
  })

  it('fires a load-trend alert from RPC-provided loads7days (real squad path)', () => {
    // Real squad shape: RPC returns loads7days (oldest→newest). Week2 ramp >10% → flag.
    const alert = topAlert({
      acwr_ratio: 1.0, adherence_pct: 90, last_hrv_score: 7,
      loads7days: [10, 10, 10, 50, 50, 50, 50],
    })
    expect(alert).not.toBeNull()
    expect(alert.flag).toBe(true)
    expect(alert.key).not.toBe('readiness')
    expect(alert.action).toBeTruthy()
  })

  it('fires a missed-rest alert from RPC-provided consecutive_training_days', () => {
    const alert = topAlert({
      acwr_ratio: 1.0, adherence_pct: 90, last_hrv_score: 7,
      loads7days: [80, 10, 30, 60, 20, 10, 30], // flat-trend + varied → no load/monotony flag
      consecutive_training_days: 9,              // ≥6 → missed-rest flags
    })
    expect(alert).not.toBeNull()
    expect(alert.key).toBe('rest')
    expect(alert.flag).toBe(true)
  })

  it('does not fire load rules when no load signals are present (no-harm)', () => {
    // No loads7days, no _log, no consecutive count → only readiness has data, which is
    // excluded from topAlert, so a healthy athlete stays clean (no crash, no false alert).
    expect(topAlert({ acwr_ratio: 1.1, adherence_pct: 90, last_hrv_score: 7 })).toBeNull()
  })

  it('derives load signals from demo _log when RPC fields are absent', () => {
    // Demo squad carries _log instead of loads7days. Heavy even load every day for 8 days
    // → 8 consecutive training days → missed-rest flag, with no RPC-provided fields.
    const ath = {
      acwr_ratio: 1.0, adherence_pct: 90, last_hrv_score: 7,
      _log: logForLastDays({ 0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 60, 7: 60 }),
    }
    const alert = topAlert(ath)
    expect(alert).not.toBeNull()
    expect(alert.flag).toBe(true)
  })
})

describe('buildInsightInput', () => {
  it('passes through RPC-provided loads7days and consecutive_training_days', () => {
    const input = buildInsightInput({
      acwr_ratio: 1.2, adherence_pct: 80, last_hrv_score: 6,
      loads7days: [1, 2, 3, 4, 5, 6, 7], consecutive_training_days: 4,
    })
    expect(input.acwr).toBe(1.2)
    expect(input.loads7days).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(input.consecutiveTrainingDays).toBe(4)
  })

  it('leaves load signals undefined when neither RPC fields nor _log exist', () => {
    const input = buildInsightInput({ acwr_ratio: 1.0, adherence_pct: 90, last_hrv_score: 7 })
    expect(input.loads7days).toBeUndefined()
    expect(input.consecutiveTrainingDays).toBeUndefined()
  })

  it('derives a 7-element loads7days array from _log when RPC fields are absent', () => {
    const input = buildInsightInput({
      acwr_ratio: 1.0, adherence_pct: 90, last_hrv_score: 7,
      _log: logForLastDays({ 0: 50, 2: 30, 6: 20 }), // sparse log, rest days = 0
    })
    expect(Array.isArray(input.loads7days)).toBe(true)
    expect(input.loads7days).toHaveLength(7)
    expect(input.loads7days[6]).toBe(50) // index 6 = today
    expect(input.loads7days[0]).toBe(20) // index 0 = 6 days ago
    expect(input.loads7days[4]).toBe(30) // index 4 = 2 days ago
    expect(input.loads7days[5]).toBe(0)  // 1 day ago = rest day
    expect(typeof input.consecutiveTrainingDays).toBe('number')
  })
})

describe('AlertCaption', () => {
  it('renders nothing when there is no active alert', () => {
    const { container } = renderCaption({ acwr_ratio: 1.1, adherence_pct: 90, last_hrv_score: 7 })
    expect(container.firstChild).toBeNull()
  })

  it('renders the EN action string when a load-signal alert is present', () => {
    // loads7days now reaches getAthleteInsights via buildInsightInput, so a real
    // week-on-week ramp produces a firing alert and a visible prescriptive caption.
    const ath = {
      acwr_ratio: 1.0, adherence_pct: 90, last_hrv_score: 7,
      loads7days: [10, 10, 10, 50, 50, 50, 50],
    }
    const { container } = renderCaption(ath, 'en')
    expect(container.firstChild).not.toBeNull()
    expect(container.textContent).toContain('→')
  })

  it('renders the TR action string for the same alert when lang is tr', () => {
    const ath = {
      acwr_ratio: 1.0, adherence_pct: 90, last_hrv_score: 7,
      loads7days: [10, 10, 10, 50, 50, 50, 50],
    }
    const enText = renderCaption(ath, 'en').container.textContent
    cleanup()
    const trText = renderCaption(ath, 'tr').container.textContent
    expect(trText).toBeTruthy()
    expect(trText).not.toBe(enText)
  })
})
