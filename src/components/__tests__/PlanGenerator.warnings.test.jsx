// @vitest-environment jsdom
// Tests for the visible plan-validator warnings panel and the CSV-export
// affordances added to PlanGenerator.jsx.
//
// Coverage:
//   - planToCSV() pure function (header-only, single-week, comma escaping)
//   - Warnings panel visibility gates (Advanced off, no errors, errors)
//   - Bilingual + collapse/expand interaction
//   - CSV export button gating + Blob download trigger + announce()

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({ log: [], recovery: [] }),
}))

vi.mock('../../lib/patterns.js', () => ({
  findOptimalWeekStructure: () => ({ reliable: false, en: '', tr: '' }),
}))

vi.mock('../../lib/plan/planValidators.js', async () => {
  const actual = await vi.importActual('../../lib/plan/planValidators.js')
  return { ...actual, validatePlan: vi.fn(actual.validatePlan) }
})

vi.mock('../../lib/a11y/announcer.js', () => ({
  announce: vi.fn(),
  init: vi.fn(),
  destroy: vi.fn(),
}))

// ─── Imports (after mocks) ─────────────────────────────────────────────────
import PlanGenerator, { planToCSV } from '../PlanGenerator.jsx'
import { validatePlan } from '../../lib/plan/planValidators.js'
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

beforeEach(async () => {
  vi.clearAllMocks()
  // clearAllMocks does not reset .mockReturnValue() on persistent mocks; restore
  // the validator to its real implementation so each test starts clean.
  const real = await vi.importActual('../../lib/plan/planValidators.js')
  validatePlan.mockImplementation(real.validatePlan)
  localStorage.clear()
})

// ─── Pure planToCSV() ───────────────────────────────────────────────────────
describe('planToCSV()', () => {
  it('returns header-only when plan is null/empty', () => {
    expect(planToCSV(null)).toBe(
      'Week,Day,SessionIntent,TargetTSS,RPELow,RPEHigh,Zone,Description\n'
    )
    expect(planToCSV({ weeks: [] })).toBe(
      'Week,Day,SessionIntent,TargetTSS,RPELow,RPEHigh,Zone,Description\n'
    )
  })

  it('produces one row per session for a single-week plan', () => {
    const plan = {
      weeks: [{
        week: 1,
        sessions: [
          { day: 'Mon', type: 'Endurance', tss: 60, rpe: 4, zone: 'Z2', description: 'Easy' },
          { day: 'Tue', type: 'Rest',      tss: 0,  rpe: 0, zone: '—',  description: '' },
        ],
      }],
    }
    const csv = planToCSV(plan)
    const lines = csv.trim().split('\n')
    // header + 2 sessions
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('Week,Day,SessionIntent,TargetTSS,RPELow,RPEHigh,Zone,Description')
    expect(lines[1]).toBe('1,Mon,Endurance,60,4,4,Z2,Easy')
  })

  it('escapes CSV fields containing commas, quotes, and newlines', () => {
    const plan = {
      weeks: [{
        week: 1,
        sessions: [
          { day: 'Wed', type: 'Tempo', tss: 80, rpe: 6, zone: 'Z3',
            description: 'Hard, steady "race-pace" effort' },
        ],
      }],
    }
    const csv = planToCSV(plan)
    const lines = csv.trim().split('\n')
    // Description should be quoted, internal quotes doubled
    expect(lines[1]).toContain('"Hard, steady ""race-pace"" effort"')
  })
})

// ─── Visible warnings panel ──────────────────────────────────────────────────
describe('PlanGenerator — visible warnings panel', () => {
  it('does NOT render warnings panel when Advanced mode is OFF', () => {
    // Force the validator to return errors — but Advanced is off, so panel hides.
    validatePlan.mockReturnValue({
      valid: false,
      errors: [{ code: 'TSS_SPIKE', message: { en: 'spike', tr: 'sıkıntı' } }],
    })
    renderPG()
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    expect(screen.queryByText(/PLAN WARNINGS/)).not.toBeInTheDocument()
  })

  it('does NOT render warnings panel when validation has no errors', () => {
    // Real validatePlan path; default plan is valid → no warnings panel
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    expect(screen.queryByText(/PLAN WARNINGS/)).not.toBeInTheDocument()
  })

  it('renders the warnings panel when Advanced is ON and errors exist', () => {
    validatePlan.mockReturnValue({
      valid: false,
      errors: [
        { code: 'TSS_SPIKE',   message: { en: 'TSS jumped too fast.', tr: 'TSS çok hızlı arttı.' }, weekNum: 3 },
        { code: 'NO_RECOVERY', message: { en: 'No recovery day.',     tr: 'Toparlanma günü yok.'   }, weekNum: 5 },
      ],
    })
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    expect(screen.getByText(/PLAN WARNINGS \(2\)/)).toBeInTheDocument()
    expect(screen.getByText(/TSS jumped too fast/)).toBeInTheDocument()
    expect(screen.getByText(/No recovery day/)).toBeInTheDocument()
  })

  it('renders each error code as a small monospace tag', () => {
    validatePlan.mockReturnValue({
      valid: false,
      errors: [
        { code: 'TSS_SPIKE',   message: { en: 'a-msg', tr: 'a' }, weekNum: 1 },
        { code: 'NO_RECOVERY', message: { en: 'b-msg', tr: 'b' }, weekNum: 2 },
      ],
    })
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    expect(screen.getByText('TSS_SPIKE')).toBeInTheDocument()
    expect(screen.getByText('NO_RECOVERY')).toBeInTheDocument()
    // weekNum tag rendered inside the warnings region (week-selector buttons
    // elsewhere also render "W1"/"W2", so scope the query to the region).
    const region = screen.getByRole('region', { name: /Plan warnings/i })
    expect(region.textContent).toContain('W1')
    expect(region.textContent).toContain('W2')
  })

  it('renders Turkish (TR) message text when lang=tr', () => {
    localStorage.setItem('sporeus-lang', JSON.stringify('tr'))
    validatePlan.mockReturnValue({
      valid: false,
      errors: [
        { code: 'TSS_SPIKE', message: { en: 'English text', tr: 'Türkçe uyarı' }, weekNum: 4 },
      ],
    })
    renderPG({ lang: 'tr' })
    fireEvent.click(screen.getByLabelText(/Gelişmiş \(uyarlanabilir\)/i))
    fireEvent.click(screen.getAllByText(LABELS.tr.genPlanBtn)[0])
    expect(screen.getByText(/PLAN UYARILARI \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/Türkçe uyarı/)).toBeInTheDocument()
    expect(screen.queryByText(/English text/)).not.toBeInTheDocument()
  })

  it('toggles aria-expanded on the collapse/expand button', () => {
    validatePlan.mockReturnValue({
      valid: false,
      errors: [
        { code: 'TSS_SPIKE', message: { en: 'visible', tr: 'görünür' }, weekNum: 2 },
      ],
    })
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    // Initially expanded
    const toggle = screen.getByLabelText(/Hide warnings/i)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/visible/)).toBeInTheDocument()
    // Collapse
    fireEvent.click(toggle)
    const collapsedToggle = screen.getByLabelText(/Show warnings/i)
    expect(collapsedToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(/visible/)).not.toBeInTheDocument()
  })

  it('wraps the panel in a region with bilingual aria-label', () => {
    validatePlan.mockReturnValue({
      valid: false,
      errors: [{ code: 'TSS_SPIKE', message: { en: 'x', tr: 'y' } }],
    })
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    const region = screen.getByRole('region', { name: /Plan warnings/i })
    expect(region).toBeInTheDocument()
  })
})

// ─── CSV export button ──────────────────────────────────────────────────────
describe('PlanGenerator — CSV export button', () => {
  it('does NOT render the CSV export button when no plan exists', () => {
    renderPG()
    expect(screen.queryByLabelText(/Export plan as CSV/i)).not.toBeInTheDocument()
  })

  it('renders the CSV export button after a plan is generated', () => {
    renderPG()
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    expect(screen.getByLabelText(/Export plan as CSV/i)).toBeInTheDocument()
  })

  it('triggers a Blob download with the correct filename pattern on click', () => {
    const createObjSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url')
    const revokeObjSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})
    // Spy on the anchor click to capture filename
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function () { /* prevent jsdom navigation */ })

    renderPG()
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    const btn = screen.getByLabelText(/Export plan as CSV/i)
    fireEvent.click(btn)

    expect(createObjSpy).toHaveBeenCalledTimes(1)
    // First arg is a Blob
    const blobArg = createObjSpy.mock.calls[0][0]
    expect(blobArg).toBeInstanceOf(Blob)
    expect(blobArg.type).toMatch(/text\/csv/)
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)

    createObjSpy.mockRestore()
    revokeObjSpy.mockRestore()
    anchorClickSpy.mockRestore()
  })

  it('uses today\'s ISO date in the export filename', () => {
    const today = new Date().toISOString().slice(0, 10)
    // Capture the anchor element used to download
    const origCreate = document.createElement.bind(document)
    let lastAnchor = null
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation(tag => {
      const el = origCreate(tag)
      if (tag === 'a') lastAnchor = el
      return el
    })
    const createObjSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderPG()
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    fireEvent.click(screen.getByLabelText(/Export plan as CSV/i))

    expect(lastAnchor).toBeTruthy()
    expect(lastAnchor.download).toBe(`sporeus-plan-${today}.csv`)

    createSpy.mockRestore()
    createObjSpy.mockRestore()
  })

  it('announces a polite "Plan exported" message after successful export', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderPG()
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    fireEvent.click(screen.getByLabelText(/Export plan as CSV/i))

    const calls = announce.mock.calls
    expect(calls.some(c => c[0] === 'Plan exported' && c[1] === 'polite')).toBe(true)
  })
})
