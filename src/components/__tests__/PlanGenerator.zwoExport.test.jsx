// @vitest-environment jsdom
// Tests for the Zwift .zwo per-session export button wired into PlanGenerator.
//
// Coverage:
//   - Button renders for active sessions (type='intervals')
//   - Button does NOT render for Rest / off / zero-duration sessions
//   - Click triggers downloadZwoFile (Blob + URL.createObjectURL + anchor click)
//   - Filename pattern: sporeus-<type>-<YYYY-MM-DD>.zwo
//   - announce() polite on success
//   - announce() assertive on builder error (mocked sessionToZwoWorkout returns
//     a workout shape that buildZwoWorkout rejects)
//   - Bilingual: TR aria-label rendered when lang='tr'
//   - aria-label is set (a11y guard)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'

// ─── Mocks ──────────────────────────────────────────────────────────────────
// Force a stable plan with sessions of every shape we want to assert against,
// by stubbing generatePlan() so clicking "Generate" yields that plan.
vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({ log: [], recovery: [], profile: { ftp: 240 } }),
}))

vi.mock('../../lib/patterns.js', () => ({
  findOptimalWeekStructure: () => ({ reliable: false, en: '', tr: '' }),
}))

vi.mock('../../lib/a11y/announcer.js', () => ({
  announce: vi.fn(),
  init: vi.fn(),
  destroy: vi.fn(),
}))

// Controllable wrapper around the real zwoExport. When `__forceError` is true,
// buildZwoWorkout returns an error envelope so we can exercise the assertive
// announce path without spinning up a separate module graph.
const __zwoState = { forceError: false }
vi.mock('../../lib/integrations/zwoExport.js', async () => {
  const actual = await vi.importActual('../../lib/integrations/zwoExport.js')
  return {
    ...actual,
    buildZwoWorkout: (w) => {
      if (__zwoState.forceError) return { xml: '', errors: ['forced error'] }
      return actual.buildZwoWorkout(w)
    },
  }
})

vi.mock('../../lib/formulas.js', async () => {
  const actual = await vi.importActual('../../lib/formulas.js')
  return {
    ...actual,
    generatePlan: () => [
      {
        week: 1,
        phase: 'Base',
        totalHours: 6,
        tss: 300,
        zonePct: [10, 60, 20, 10, 0],
        sessions: [
          { day: 'Mon', type: 'Rest',      duration: 0,  rpe: 0, tss: 0,  zone: '—',  color: '#888',     description: '' },
          { day: 'Tue', type: 'intervals', duration: 60, rpe: 8, tss: 90, zone: 'Z4', color: '#e03030',  description: '5x3min' },
          { day: 'Wed', type: 'tempo',     duration: 75, rpe: 6, tss: 80, zone: 'Z3', color: '#f5c542',  description: 'Tempo block' },
        ],
      },
    ],
  }
})

// ─── Imports (after mocks) ─────────────────────────────────────────────────
import PlanGenerator from '../PlanGenerator.jsx'
import { announce } from '../../lib/a11y/announcer.js'

const t = key => LABELS.en?.[key] ?? key

function renderPG({ lang = 'en' } = {}) {
  const ctx = { t: (k) => LABELS[lang]?.[k] ?? LABELS.en?.[k] ?? k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={ctx}>
      <PlanGenerator onLogSession={vi.fn()} />
    </LangCtx.Provider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

// ─── Visibility gates ───────────────────────────────────────────────────────
describe('PlanGenerator — .zwo export button visibility', () => {
  it('renders the .zwo button for an active session (type=intervals)', () => {
    renderPG()
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    // After generating, sessions render; the button is per-row.
    const buttons = screen.getAllByLabelText(/Download Zwift workout file/i)
    // Two non-rest sessions in the mocked plan ⇒ two buttons.
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT render the .zwo button for a Rest session row', () => {
    renderPG()
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    // The mocked plan has 1 Rest session + 2 active sessions (intervals, tempo).
    // The .zwo button only renders for non-rest active sessions, so we expect
    // exactly 2 buttons (one per active session) — proving the Rest row was
    // skipped. If the Rest gate broke, we'd see 3.
    const buttons = screen.getAllByLabelText(/Download Zwift workout file/i)
    expect(buttons.length).toBe(2)
  })

  it('button has an aria-label (a11y)', () => {
    renderPG()
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    const btn = screen.getAllByLabelText(/Download Zwift workout file/i)[0]
    expect(btn).toHaveAttribute('aria-label')
  })
})

// ─── Click → download trigger ───────────────────────────────────────────────
describe('PlanGenerator — .zwo export button click', () => {
  it('triggers downloadZwoFile (URL.createObjectURL + anchor click)', () => {
    const createObjSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:zwo-mock')
    const revokeObjSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function () {})

    renderPG()
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    const btn = screen.getAllByLabelText(/Download Zwift workout file/i)[0]
    fireEvent.click(btn)

    expect(createObjSpy).toHaveBeenCalledTimes(1)
    const blobArg = createObjSpy.mock.calls[0][0]
    expect(blobArg).toBeInstanceOf(Blob)
    expect(blobArg.type).toMatch(/xml/i)
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)

    createObjSpy.mockRestore()
    revokeObjSpy.mockRestore()
    anchorClickSpy.mockRestore()
  })

  it('uses sporeus-<type>-<YYYY-MM-DD>.zwo filename pattern', () => {
    const today = new Date().toISOString().slice(0, 10)
    const origCreate = document.createElement.bind(document)
    let lastAnchor = null
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = origCreate(tag)
      if (tag === 'a') lastAnchor = el
      return el
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:zwo-mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderPG()
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    // First non-rest session in mock plan is type=intervals.
    const btn = screen.getAllByLabelText(/Download Zwift workout file/i)[0]
    fireEvent.click(btn)

    expect(lastAnchor).toBeTruthy()
    expect(lastAnchor.download).toBe(`sporeus-intervals-${today}.zwo`)

    createSpy.mockRestore()
  })

  it('announces "Workout downloaded" politely on success', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:zwo-mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderPG()
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    const btn = screen.getAllByLabelText(/Download Zwift workout file/i)[0]
    fireEvent.click(btn)

    const calls = announce.mock.calls
    expect(calls.some(c => c[0] === 'Workout downloaded' && c[1] === 'polite')).toBe(true)
  })
})

// ─── Error path — assertive announcement ───────────────────────────────────
describe('PlanGenerator — .zwo export builder error', () => {
  it('announces "Workout download failed" assertively when builder errors', () => {
    __zwoState.forceError = true
    try {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:zwo-mock')
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      renderPG()
      fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
      const btn = screen.getAllByLabelText(/Download Zwift workout file/i)[0]
      fireEvent.click(btn)

      const calls = announce.mock.calls
      expect(calls.some(c => c[0] === 'Workout download failed' && c[1] === 'assertive')).toBe(true)
    } finally {
      __zwoState.forceError = false
    }
  })
})

// ─── Bilingual — Turkish aria-label ─────────────────────────────────────────
describe('PlanGenerator — .zwo export bilingual', () => {
  it('renders Turkish aria-label when lang=tr', () => {
    localStorage.setItem('sporeus-lang', JSON.stringify('tr'))
    renderPG({ lang: 'tr' })
    fireEvent.click(screen.getAllByText(LABELS.tr.genPlanBtn)[0])
    const btn = screen.getAllByLabelText(/Zwift antrenman dosyası indir/i)[0]
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-label', 'Zwift antrenman dosyası indir')
  })
})
