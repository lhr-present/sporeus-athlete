// @vitest-environment jsdom
// Tests for the E13 Advanced (adaptive) wiring inside PlanGenerator.jsx.
// We verify the toggle, control rendering, propagation of inputs to the
// adaptive generator, taper invocation, validatePlan warnings, announce()
// calls, and bilingual labels — without modifying the existing legacy flow.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'

// ─── Mocks ──────────────────────────────────────────────────────────────────
// Empty data context — no log entries, so calcLoad returns CTL=0 (floored to 20).
vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({ log: [], recovery: [] }),
}))

// findOptimalWeekStructure returns {reliable:false} so the data card is hidden.
vi.mock('../../lib/patterns.js', () => ({
  findOptimalWeekStructure: () => ({ reliable: false, en: '', tr: '' }),
}))

// Spy on legacy generatePlan to verify it isn't called in advanced mode.
vi.mock('../../lib/formulas.js', async () => {
  const actual = await vi.importActual('../../lib/formulas.js')
  return {
    ...actual,
    generatePlan: vi.fn((...args) => actual.generatePlan(...args)),
  }
})

// Mock the new E13 lib calls so we can assert args + control return values.
vi.mock('../../lib/plan/generatePlan.js', async () => {
  const actual = await vi.importActual('../../lib/plan/generatePlan.js')
  return {
    ...actual,
    generatePlan: vi.fn(actual.generatePlan),
  }
})
vi.mock('../../lib/plan/taperEngine.js', async () => {
  const actual = await vi.importActual('../../lib/plan/taperEngine.js')
  return {
    ...actual,
    applyTaper:   vi.fn(actual.applyTaper),
    suggestTaper: vi.fn(actual.suggestTaper),
  }
})
vi.mock('../../lib/plan/planValidators.js', async () => {
  const actual = await vi.importActual('../../lib/plan/planValidators.js')
  return {
    ...actual,
    validatePlan: vi.fn(actual.validatePlan),
  }
})

// announce() is called on success/error — capture invocations.
vi.mock('../../lib/a11y/announcer.js', () => ({
  announce: vi.fn(),
  init: vi.fn(),
  destroy: vi.fn(),
}))

// ─── Imports (after mocks) ─────────────────────────────────────────────────
import PlanGenerator from '../PlanGenerator.jsx'
import { generatePlan as legacyGeneratePlan } from '../../lib/formulas.js'
import {
  generatePlan as adaptiveGeneratePlan,
} from '../../lib/plan/generatePlan.js'
import { applyTaper, suggestTaper } from '../../lib/plan/taperEngine.js'
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

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('PlanGenerator — Advanced (adaptive) toggle', () => {
  it('renders the Advanced toggle checkbox', () => {
    renderPG()
    expect(screen.getByLabelText(/Advanced \(adaptive\)/i)).toBeInTheDocument()
  })

  it('toggles Advanced controls visibility', () => {
    renderPG()
    // Hidden by default
    expect(screen.queryByLabelText(/Available days per week/i)).not.toBeInTheDocument()
    // Toggle on
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    expect(screen.getByLabelText(/Available days per week/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Periodization model/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Auto-taper/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Race date/i)).toBeInTheDocument()
  })

  it('uses the LEGACY generatePlan when Advanced is OFF', () => {
    renderPG()
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    expect(legacyGeneratePlan).toHaveBeenCalled()
    expect(adaptiveGeneratePlan).not.toHaveBeenCalled()
  })

  it('uses the NEW E13 generatePlan when Advanced is ON', () => {
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    expect(adaptiveGeneratePlan).toHaveBeenCalledTimes(1)
    expect(legacyGeneratePlan).not.toHaveBeenCalled()
    const args = adaptiveGeneratePlan.mock.calls[0][0]
    expect(args).toMatchObject({
      goal:          expect.any(String),
      currentCTL:    expect.any(Number),
      weeksToRace:   expect.any(Number),
      availableDays: expect.any(Number),
      model:         expect.any(String),
      level:         expect.any(String),
    })
  })

  it('propagates availableDays input value to the E13 call', () => {
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    const days = screen.getByLabelText(/Available days per week/i)
    fireEvent.change(days, { target: { value: '4' } })
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    const args = adaptiveGeneratePlan.mock.calls[0][0]
    expect(args.availableDays).toBe(4)
  })

  it('propagates the model select to the E13 call', () => {
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    const sel = screen.getByLabelText(/Periodization model/i)
    fireEvent.change(sel, { target: { value: 'polarized' } })
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    expect(adaptiveGeneratePlan.mock.calls[0][0].model).toBe('polarized')
  })

  it('does not run applyTaper if no race date is set', () => {
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    // Auto-taper is on by default; no race date → applyTaper must NOT fire
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    expect(applyTaper).not.toHaveBeenCalled()
  })

  it('runs applyTaper when race date is set and auto-taper is on', () => {
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-01' } })
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    expect(suggestTaper).toHaveBeenCalled()
    expect(applyTaper).toHaveBeenCalled()
  })

  it('surfaces validatePlan errors as warning messages', () => {
    // Force validatePlan to return a synthetic error
    validatePlan.mockReturnValueOnce({
      valid: false,
      errors: [
        { code: 'TSS_SPIKE', message: { en: 'Synthetic TSS spike warning', tr: 'Sentetik TSS uyarısı' } },
      ],
    })
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    expect(screen.getByText(/Synthetic TSS spike warning/)).toBeInTheDocument()
    expect(screen.getByText(/PLAN WARNINGS \(1\)/)).toBeInTheDocument()
  })

  it('announces success politely when plan is valid', () => {
    // Real validator path; default plan should be valid for these inputs
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    const calls = announce.mock.calls
    // Expect at least one polite "Plan generated" announcement
    expect(calls.some(c => c[0] === 'Plan generated' && c[1] === 'polite')).toBe(true)
  })

  it('announces assertively when validatePlan returns errors', () => {
    validatePlan.mockReturnValueOnce({
      valid: false,
      errors: [
        { code: 'TSS_SPIKE', message: { en: 'Spike', tr: 'Uyarı' } },
      ],
    })
    renderPG()
    fireEvent.click(screen.getByLabelText(/Advanced \(adaptive\)/i))
    fireEvent.click(screen.getAllByText(t('genPlanBtn'))[0])
    const calls = announce.mock.calls
    expect(calls.some(c => /1 issues/.test(c[0]) && c[1] === 'assertive')).toBe(true)
  })

  it('renders Turkish (TR) labels when lang=tr', () => {
    // Component reads lang from localStorage('sporeus-lang')
    localStorage.setItem('sporeus-lang', JSON.stringify('tr'))
    renderPG({ lang: 'tr' })
    expect(screen.getByLabelText(/Gelişmiş \(uyarlanabilir\)/i)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Gelişmiş \(uyarlanabilir\)/i))
    expect(screen.getByLabelText(/Haftalık antrenman günü/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Yarış tarihi/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Otomatik taper/i)).toBeInTheDocument()
  })
})
