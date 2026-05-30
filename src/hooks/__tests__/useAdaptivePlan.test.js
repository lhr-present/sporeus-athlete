// @vitest-environment jsdom
// ─── useAdaptivePlan.test.js ─────────────────────────────────────────────────
// Verifies the weekly adherence → load-adjustment logic in useAdaptivePlan.js.
// The hook compares the PREVIOUS week's actual TSS against the planned TSS for
// the corresponding plan week, and recommends a next-week adjustment.
//
// Adherence bands (from the source):
//   < 0.65       → status 'low',       adjustPct -20
//   0.65 – 0.79… → status 'under',     adjustPct -10
//   0.80 – 1.20  → status 'on_track',  adjustPct   0
//   1.21 – 1.40  → status 'exceeded',  adjustPct   0
//   > 1.40       → status 'overreach', adjustPct   0
//
// Week index: floor((prevMonday - planStart) / 7d). Returns null when
// weekIndex < 0 or weekIndex >= plan.weeks.length.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mirror the boundary-mock style from useTrainingLogQuery.test.js: stub the
// localStorage hook so dismissal state is inert and we read raw adaptation.
vi.mock('../useLocalStorage.js', () => ({
  useLocalStorage: vi.fn(() => [{}, vi.fn()]),
}))

import { useAdaptivePlan } from '../useAdaptivePlan.js'

// ── Date helpers — recreate the hook's own getMonday/prevMonday math ───────────
function getMonday(d = new Date()) {
  const day = d.getUTCDay() || 7
  const mon = new Date(d)
  mon.setUTCDate(d.getUTCDate() - day + 1)
  mon.setUTCHours(0, 0, 0, 0)
  return mon.toISOString().slice(0, 10)
}
const THIS_MONDAY = getMonday()
const PREV_MONDAY = (() => {
  const d = new Date(THIS_MONDAY)
  d.setUTCDate(d.getUTCDate() - 7)
  return d.toISOString().slice(0, 10)
})()

// planStart that lands prevMonday on a chosen weekIndex.
function planStartForWeekIndex(idx) {
  const d = new Date(PREV_MONDAY)
  d.setUTCDate(d.getUTCDate() - idx * 7)
  return d.toISOString().slice(0, 10)
}
// A date that falls inside the previous week window [PREV_MONDAY, PREV_MONDAY+7).
function dateInPrevWeek(offsetDays = 1) {
  const d = new Date(PREV_MONDAY)
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

// Build a plan with `count` weeks of fixed planned TSS, prevMonday → weekIndex `idx`.
function buildPlan(plannedTSS, { idx = 0, count = 4, nextTSS = plannedTSS } = {}) {
  const weeks = Array.from({ length: count }, (_, i) => ({
    TSS: i === idx + 1 ? nextTSS : plannedTSS,
  }))
  return { start_date: planStartForWeekIndex(idx), weeks }
}
// Build a log whose previous-week TSS sums to `actualTSS`.
function buildLog(actualTSS) {
  return [{ date: dateInPrevWeek(2), tss: actualTSS, type: 'Run', duration: 60 }]
}

describe('useAdaptivePlan — no-op guards', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null adaptation when plan has no weeks', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(100), { start_date: PREV_MONDAY, weeks: [] }))
    expect(result.current.adaptation).toBeNull()
  })
  it('returns null adaptation when log is empty', () => {
    const { result } = renderHook(() => useAdaptivePlan([], buildPlan(100)))
    expect(result.current.adaptation).toBeNull()
  })
  it('returns null when plan has no start_date', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(100), { weeks: [{ TSS: 100 }, { TSS: 100 }] }))
    expect(result.current.adaptation).toBeNull()
  })
})

describe('useAdaptivePlan — week-index edges', () => {
  beforeEach(() => vi.clearAllMocks())

  it('weekIndex < 0 (plan starts in the future) → null', () => {
    // planStart one week AFTER prevMonday → weekIndex = -1
    const future = new Date(PREV_MONDAY)
    future.setUTCDate(future.getUTCDate() + 7)
    const plan = { start_date: future.toISOString().slice(0, 10), weeks: [{ TSS: 100 }, { TSS: 100 }] }
    const { result } = renderHook(() => useAdaptivePlan(buildLog(100), plan))
    expect(result.current.adaptation).toBeNull()
  })

  it('weekIndex >= weeks.length (plan ended) → null', () => {
    // prevMonday maps to index 5 but plan only has 2 weeks.
    const plan = { start_date: planStartForWeekIndex(5), weeks: [{ TSS: 100 }, { TSS: 100 }] }
    const { result } = renderHook(() => useAdaptivePlan(buildLog(100), plan))
    expect(result.current.adaptation).toBeNull()
  })

  it('weekIndex 0 (first week) → produces an adaptation', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(100), buildPlan(100, { idx: 0 })))
    expect(result.current.adaptation).not.toBeNull()
    expect(result.current.adaptation.weekIndex).toBe(0)
  })

  it('returns null when the planned week has zero TSS', () => {
    const plan = { start_date: planStartForWeekIndex(0), weeks: [{ TSS: 0 }, { TSS: 100 }] }
    const { result } = renderHook(() => useAdaptivePlan(buildLog(100), plan))
    expect(result.current.adaptation).toBeNull()
  })
})

describe('useAdaptivePlan — adherence-band boundaries', () => {
  beforeEach(() => vi.clearAllMocks())

  // planned 100 → adherence == actual/100.
  it('adherence 0.64 (< 0.65) → low, -20%', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(64), buildPlan(100, { nextTSS: 100 })))
    expect(result.current.adaptation.status).toBe('low')
    expect(result.current.adaptation.adjustPct).toBe(-20)
    // adjustedNextTSS = round(100 * 0.80) = 80
    expect(result.current.adaptation.adjustedNextTSS).toBe(80)
  })

  it('adherence exactly 0.65 → under, -10% (lower boundary inclusive)', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(65), buildPlan(100, { nextTSS: 100 })))
    expect(result.current.adaptation.status).toBe('under')
    expect(result.current.adaptation.adjustPct).toBe(-10)
    expect(result.current.adaptation.adjustedNextTSS).toBe(90)
  })

  it('adherence 0.79 → under, -10% (just below on_track)', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(79), buildPlan(100)))
    expect(result.current.adaptation.status).toBe('under')
    expect(result.current.adaptation.adjustPct).toBe(-10)
  })

  it('adherence exactly 0.80 → on_track, 0% (boundary inclusive)', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(80), buildPlan(100)))
    expect(result.current.adaptation.status).toBe('on_track')
    expect(result.current.adaptation.adjustPct).toBe(0)
    expect(result.current.adaptation.adjustedNextTSS).toBeNull()
  })

  it('adherence exactly 1.20 → on_track, 0% (upper boundary inclusive)', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(120), buildPlan(100)))
    expect(result.current.adaptation.status).toBe('on_track')
    expect(result.current.adaptation.adjustPct).toBe(0)
  })

  it('adherence 1.21 (> 1.20) → exceeded, 0%', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(121), buildPlan(100)))
    expect(result.current.adaptation.status).toBe('exceeded')
    expect(result.current.adaptation.adjustPct).toBe(0)
  })

  it('adherence exactly 1.40 → exceeded (boundary: not yet overreach)', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(140), buildPlan(100)))
    expect(result.current.adaptation.status).toBe('exceeded')
  })

  it('adherence 1.41 (> 1.40) → overreach, 0%', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(141), buildPlan(100)))
    expect(result.current.adaptation.status).toBe('overreach')
    expect(result.current.adaptation.adjustPct).toBe(0)
  })
})

describe('useAdaptivePlan — output shape + messages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports actual/planned/adherence percentages rounded', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(50), buildPlan(100)))
    const a = result.current.adaptation
    expect(a.actualTSS).toBe(50)
    expect(a.plannedTSS).toBe(100)
    expect(a.adherence).toBe(50)   // 0.50 → 50%
    expect(a.prevMonday).toBe(PREV_MONDAY)
  })

  it('provides EN + TR messages', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(100), buildPlan(100)))
    const a = result.current.adaptation
    expect(typeof a.message).toBe('string')
    expect(typeof a.messageTr).toBe('string')
    expect(a.message.length).toBeGreaterThan(10)
  })

  it('adjustedNextTSS is null when next week has no planned TSS', () => {
    // idx 0, count 1 → no next week → nextPlannedTSS 0 → adjustedNextTSS null even when adjustPct != 0
    const plan = { start_date: planStartForWeekIndex(0), weeks: [{ TSS: 100 }] }
    const { result } = renderHook(() => useAdaptivePlan(buildLog(50), plan))
    expect(result.current.adaptation.adjustPct).toBe(-20)
    expect(result.current.adaptation.adjustedNextTSS).toBeNull()
  })

  it('sums only entries within the previous-week window', () => {
    const inWeek = { date: dateInPrevWeek(1), tss: 40, type: 'Run' }
    const inWeek2 = { date: dateInPrevWeek(5), tss: 30, type: 'Ride' }
    // An entry on THIS_MONDAY is outside [prevMonday, prevMonday+7) → excluded.
    const outOfWeek = { date: THIS_MONDAY, tss: 999, type: 'Run' }
    const plan = buildPlan(100, { idx: 0 })
    const { result } = renderHook(() => useAdaptivePlan([inWeek, inWeek2, outOfWeek], plan))
    expect(result.current.adaptation.actualTSS).toBe(70)
  })

  it('reads lowercase tss key on plan weeks too', () => {
    const plan = { start_date: planStartForWeekIndex(0), weeks: [{ tss: 100 }, { tss: 100 }] }
    const { result } = renderHook(() => useAdaptivePlan(buildLog(80), plan))
    expect(result.current.adaptation.plannedTSS).toBe(100)
    expect(result.current.adaptation.status).toBe('on_track')
  })
})

describe('useAdaptivePlan — dismissal', () => {
  it('returns adaptation=null when this week is already dismissed', async () => {
    const { useLocalStorage } = await import('../useLocalStorage.js')
    // Seed dismissed map keyed by `${prevMonday}-${weekIndex}` (idx 0).
    useLocalStorage.mockReturnValue([{ [`${PREV_MONDAY}-0`]: true }, vi.fn()])
    const { result } = renderHook(() => useAdaptivePlan(buildLog(100), buildPlan(100, { idx: 0 })))
    expect(result.current.adaptation).toBeNull()
  })

  it('exposes a dismiss() function', () => {
    const { result } = renderHook(() => useAdaptivePlan(buildLog(100), buildPlan(100)))
    expect(typeof result.current.dismiss).toBe('function')
  })
})
