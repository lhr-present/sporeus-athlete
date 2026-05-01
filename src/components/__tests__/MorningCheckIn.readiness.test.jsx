// @vitest-environment jsdom
// ─── MorningCheckIn.readiness.test.jsx — E17 wiring tests ─────────────────────
// Verifies that handleSave delegates to computeReadinessScore + recommendSession
// (instead of the old inline simple-average) and that the saved view renders
// score, drivers, reliability badge, session recommendation, and bilingual TR.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'
import { computeReadinessScore } from '../../lib/recovery/readinessScore.js'
import { computeHRVTrend } from '../../lib/hrv.js'

// ── Mocks ────────────────────────────────────────────────────────────────────

// Capture setRecovery invocations across test cases so we can inspect entries.
const dataState = {
  recovery:    [],
  setRecovery: vi.fn(),
}

vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => dataState,
}))

vi.mock('../../hooks/useFocusTrap.js', () => ({ useFocusTrap: vi.fn() }))
vi.mock('../../lib/a11y/announcer.js', () => ({ announce: vi.fn() }))

import MorningCheckIn from '../MorningCheckIn.jsx'

// ── Helpers ──────────────────────────────────────────────────────────────────

function dateAt(daysAgo, base = new Date()) {
  const d = new Date(base)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

/** Build a recovery history with HRV + sleep — last value is "yesterday". */
function buildHistory({ hrvBase = 65, sleepBase = 7.5, hrvLast, sleepLast, n = 28 } = {}) {
  const out = []
  for (let i = n; i >= 1; i--) {
    out.push({
      date:     dateAt(i),
      hrv:      i === 1 && hrvLast   != null ? hrvLast   : hrvBase,
      sleepHrs: i === 1 && sleepLast != null ? sleepLast : sleepBase,
    })
  }
  return out
}

function tEN(key) { return LABELS.en?.[key] ?? key }
function tTR(key) { return LABELS.tr?.[key] ?? key }

function renderAt(lang = 'en', recovery = []) {
  dataState.recovery     = recovery
  dataState.setRecovery  = vi.fn(prev => prev)
  // Re-init mock to track calls per-render
  dataState.setRecovery.mockImplementation(updater => {
    if (typeof updater === 'function') {
      dataState.recovery = updater(dataState.recovery)
    } else {
      dataState.recovery = updater
    }
  })

  const ctx = {
    lang,
    setLang: vi.fn(),
    t: lang === 'tr' ? tTR : tEN,
  }

  return render(
    <LangCtx.Provider value={ctx}>
      <MorningCheckIn onClose={vi.fn()} />
    </LangCtx.Provider>
  )
}

function clickSave() {
  const saveBtn = screen.getByRole('button', { name: /^(Log|Kaydet)$/i })
  fireEvent.click(saveBtn)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MorningCheckIn — E17 readiness wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dataState.recovery = []
  })

  it('saves entry with composite readiness score (not simple average)', () => {
    const history = buildHistory({ hrvBase: 65, sleepBase: 7.5 })
    renderAt('en', history)

    // Enter HRV value matching baseline so HRV component scores high
    const hrvInput = screen.getByPlaceholderText(/e\.g\. 68/i)
    fireEvent.change(hrvInput, { target: { value: '65' } })

    clickSave()

    expect(dataState.setRecovery).toHaveBeenCalledTimes(1)
    const updated = dataState.recovery
    const today = new Date().toISOString().slice(0, 10)
    const entry = updated.find(e => e.date === today)
    expect(entry).toBeTruthy()

    // Recompute the expected score the same way the component does
    const sorenessScale10 = (3 - 1) * (9 / 4) + 1
    const expected = computeReadinessScore({
      hrvHistory:   [...history.filter(h => h.hrv > 0).map(h => ({ date: h.date, hrv: h.hrv })), { date: today, hrv: 65 }],
      sleepHistory: [...history.filter(h => h.sleepHrs > 0).map(h => ({ date: h.date, sleepHrs: h.sleepHrs })), { date: today, sleepHrs: 7 }],
      soreness:     sorenessScale10,
      mood:         3,
    })
    expect(entry.score).toBe(expected.score)

    // Sanity: NOT the legacy simple average. Default sliders give 3,3,3 →
    // (3 + 3 + (6 - 3)) / 3 = 3 → 60. Composite should differ on this fixture.
    expect(entry.score).not.toBe(60)
  })

  it('renders top-2 drivers from the readiness lib', () => {
    // Last sleep is 4 h on a 7.5 h baseline — sleep WILL be a driver.
    const history = buildHistory({ hrvBase: 65, sleepBase: 7.5 })
    renderAt('en', history)

    // Drop the sleep slider to 4 h
    const sleepRange = screen.getAllByRole('slider')[0]
    fireEvent.change(sleepRange, { target: { value: '4' } })

    clickSave()

    // The readiness card and at least one driver row should appear
    expect(screen.getByTestId('readiness-card')).toBeInTheDocument()
    expect(screen.getByTestId('driver-sleep')).toBeInTheDocument()
  })

  it('shows reliability badge when readiness has data', () => {
    const history = buildHistory({ hrvBase: 65, sleepBase: 7.5 })
    renderAt('en', history)

    // HRV present
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 68/i), { target: { value: '65' } })

    clickSave()

    const badge = screen.getByTestId('reliability-badge')
    expect(badge).toBeInTheDocument()
    expect(['data complete', 'partial data', 'limited data']).toContain(badge.textContent.trim())
  })

  it('renders the session recommendation kind', () => {
    const history = buildHistory({ hrvBase: 65, sleepBase: 7.5 })
    renderAt('en', history)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 68/i), { target: { value: '65' } })

    clickSave()

    const kind = screen.getByTestId('rec-kind')
    expect(kind).toBeInTheDocument()
    expect(['RECOVERY', 'EASY', 'PLANNED', 'PUSH']).toContain(kind.textContent.trim())
  })

  it('renders the composite numeric score in the readiness card', () => {
    const history = buildHistory({ hrvBase: 65, sleepBase: 7.5 })
    renderAt('en', history)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 68/i), { target: { value: '65' } })

    clickSave()

    const scoreEl = screen.getByTestId('readiness-score')
    expect(scoreEl).toBeInTheDocument()
    // Should contain a 0–100 number followed by "/100"
    expect(scoreEl.textContent).toMatch(/^\d{1,3}\/100$/)
  })

  it('renders "Insufficient data" message when readiness lib returns null score', async () => {
    // Mock the lib for this test to force a null score result.
    vi.resetModules()
    vi.doMock('../../lib/recovery/readinessScore.js', () => ({
      computeReadinessScore: () => ({
        score: null, drivers: [], reliability: 'low',
        components: { hrv: null, sleep: null, soreness: null, mood: null },
        citation: 'mock',
      }),
    }))
    vi.doMock('../../contexts/DataContext.jsx', () => ({
      useData: () => dataState,
    }))
    vi.doMock('../../hooks/useFocusTrap.js', () => ({ useFocusTrap: vi.fn() }))
    vi.doMock('../../lib/a11y/announcer.js', () => ({ announce: vi.fn() }))

    const Mocked = (await import('../MorningCheckIn.jsx')).default
    const ctx = { lang: 'en', setLang: vi.fn(), t: tEN }
    render(
      <LangCtx.Provider value={ctx}>
        <Mocked onClose={vi.fn()} />
      </LangCtx.Provider>
    )

    fireEvent.click(screen.getByRole('button', { name: /^Log$/i }))

    expect(screen.getByTestId('readiness-empty')).toBeInTheDocument()
    expect(screen.getByTestId('readiness-empty')).toHaveTextContent(/Insufficient data/i)

    vi.doUnmock('../../lib/recovery/readinessScore.js')
    vi.resetModules()
  })

  it('still saves the recovery entry to setRecovery (legacy path intact)', () => {
    const history = buildHistory({ hrvBase: 65, sleepBase: 7.5 })
    renderAt('en', history)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 68/i), { target: { value: '70' } })

    clickSave()

    expect(dataState.setRecovery).toHaveBeenCalled()
    const today = new Date().toISOString().slice(0, 10)
    const entry = dataState.recovery.find(e => e.date === today)
    expect(entry).toMatchObject({
      date:     today,
      hrv:      70,
      sleep:    3,
      energy:   3,
      soreness: 3,
    })
    // Same shape contract: keys sleepHrs, score, mood, stress, notes still present
    expect(entry).toHaveProperty('sleepHrs')
    expect(entry).toHaveProperty('score')
    expect(entry).toHaveProperty('mood')
    expect(entry).toHaveProperty('stress')
    expect(entry).toHaveProperty('notes')
  })

  it('HRV trend computation continues to work after the readiness change', () => {
    // Build 5 days with HRV — enough for the 3-min trend window
    const history = []
    for (let i = 6; i >= 1; i--) {
      history.push({ date: dateAt(i), hrv: 60 + i, sleepHrs: 7 })
    }
    renderAt('en', history)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 68/i), { target: { value: '68' } })

    clickSave()

    // The trend block uses the same data the component would compute internally.
    // Verify `computeHRVTrend` returns a non-insufficient_data trend on this fixture.
    const today = new Date().toISOString().slice(0, 10)
    const withNew = [...history, { date: today, hrv: 68 }]
    const trend = computeHRVTrend(withNew)
    expect(['stable', 'warning', 'unstable']).toContain(trend.trend)

    // The trend label should appear in the rendered DOM.
    expect(screen.getByText(/HRV — /i)).toBeInTheDocument()
  })

  it('renders Turkish strings when lang=tr', () => {
    const history = buildHistory({ hrvBase: 65, sleepBase: 7.5 })
    renderAt('tr', history)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. 68/i), { target: { value: '65' } })

    clickSave()

    // TR header text "Kaydedildi" replaces "Logged"
    expect(screen.getByText(/Kaydedildi/)).toBeInTheDocument()
    // TR readiness label
    expect(screen.getByText(/HAZIR OLMA/)).toBeInTheDocument()
    // Reliability badge in TR
    const badge = screen.getByTestId('reliability-badge')
    expect(['veri tam', 'kısmi veri', 'yetersiz veri']).toContain(badge.textContent.trim())
    // Session recommendation in TR
    const kind = screen.getByTestId('rec-kind')
    expect(['TOPARLANMA', 'KOLAY', 'PLANLI', 'YÜKLEN']).toContain(kind.textContent.trim())
  })
})
