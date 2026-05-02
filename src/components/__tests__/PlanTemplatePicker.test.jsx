// @vitest-environment jsdom
// Tests for the PlanTemplatePicker — preset card grid + confirm-then-load flow.
// We mock the E13 generatePlan lib + announcer + DataContext so we can assert
// on calls and outputs without exercising the real plan-generation cost.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'

// Empty data context so calcLoad returns CTL=0 (floored to 20).
vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({ log: [], recovery: [] }),
}))

// Mock E13 generatePlan so we can assert on args + control return values.
vi.mock('../../lib/plan/generatePlan.js', async () => {
  const actual = await vi.importActual('../../lib/plan/generatePlan.js')
  return {
    ...actual,
    generatePlan: vi.fn(actual.generatePlan),
  }
})

// announce() is called on success — capture invocations.
vi.mock('../../lib/a11y/announcer.js', () => ({
  announce: vi.fn(),
  init: vi.fn(),
  destroy: vi.fn(),
}))

import PlanTemplatePicker, { PLAN_TEMPLATE_PRESETS } from '../PlanTemplatePicker.jsx'
import { generatePlan as adaptiveGeneratePlan } from '../../lib/plan/generatePlan.js'
import { announce } from '../../lib/a11y/announcer.js'

function renderPicker({ lang = 'en', presets } = {}) {
  const ctx = {
    t: (k) => LABELS[lang]?.[k] ?? LABELS.en?.[k] ?? k,
    lang,
    setLang: () => {},
  }
  const props = presets !== undefined ? { presets } : {}
  return render(
    <LangCtx.Provider value={ctx}>
      <PlanTemplatePicker {...props} />
    </LangCtx.Provider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('PlanTemplatePicker', () => {
  it('renders all 7 presets in the grid', () => {
    renderPicker()
    // Each preset card carries a deterministic data-testid
    for (const p of PLAN_TEMPLATE_PRESETS) {
      expect(screen.getByTestId(`preset-card-${p.id}`)).toBeInTheDocument()
    }
    expect(PLAN_TEMPLATE_PRESETS).toHaveLength(7)
  })

  it('shows English names + descriptions when lang=en', () => {
    renderPicker({ lang: 'en' })
    expect(screen.getByText('5K Race')).toBeInTheDocument()
    expect(screen.getByText('Marathon')).toBeInTheDocument()
    expect(screen.getByText('2000m Row')).toBeInTheDocument()
    // English description fragment
    expect(screen.getByText(/8-week sharpening block for a 5K/i)).toBeInTheDocument()
    // Heading
    expect(screen.getByText('Quick start templates')).toBeInTheDocument()
  })

  it('shows Turkish names + descriptions when lang=tr', () => {
    localStorage.setItem('sporeus-lang', JSON.stringify('tr'))
    renderPicker({ lang: 'tr' })
    expect(screen.getByText('5K Yarış')).toBeInTheDocument()
    expect(screen.getByText('Maraton')).toBeInTheDocument()
    expect(screen.getByText('2000m Kürek')).toBeInTheDocument()
    expect(screen.getByText(/5K için 8 haftalık keskinleştirme/i)).toBeInTheDocument()
    expect(screen.getByText('Hızlı başlangıç şablonları')).toBeInTheDocument()
  })

  it('clicking "Use this plan" opens the confirmation modal', () => {
    renderPicker()
    // No dialog yet
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Click first card's "Use" button
    const card = screen.getByTestId('preset-card-5k')
    const useBtn = card.querySelector('button')
    fireEvent.click(useBtn)
    // Modal opens
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText(/This will replace your current plan/i)).toBeInTheDocument()
  })

  it('confirming calls generatePlan with the preset args', () => {
    renderPicker()
    const card = screen.getByTestId('preset-card-half')
    fireEvent.click(card.querySelector('button'))
    // Click the confirm button in the modal — labelled "Use this plan"
    const confirmBtns = screen.getAllByText('Use this plan')
    // The card button + the modal confirm button share the label;
    // last rendered is the modal confirm.
    fireEvent.click(confirmBtns[confirmBtns.length - 1])

    expect(adaptiveGeneratePlan).toHaveBeenCalledTimes(1)
    const args = adaptiveGeneratePlan.mock.calls[0][0]
    expect(args).toMatchObject({
      goal:          'pr',
      weeksToRace:   12,
      availableDays: 5,
      model:         'traditional',
      level:         'intermediate',
    })
    expect(typeof args.currentCTL).toBe('number')
    expect(args.currentCTL).toBeGreaterThanOrEqual(20)  // floor enforced
  })

  it('cancelling does not generate a plan', () => {
    renderPicker()
    const card = screen.getByTestId('preset-card-5k')
    fireEvent.click(card.querySelector('button'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(adaptiveGeneratePlan).not.toHaveBeenCalled()
    expect(localStorage.getItem('sporeus-plan')).toBeNull()
  })

  it('writes the plan to localStorage under sporeus-plan after confirm', () => {
    renderPicker()
    const card = screen.getByTestId('preset-card-10k')
    fireEvent.click(card.querySelector('button'))
    const confirmBtns = screen.getAllByText('Use this plan')
    fireEvent.click(confirmBtns[confirmBtns.length - 1])

    const raw = localStorage.getItem('sporeus-plan')
    expect(raw).not.toBeNull()
    const stored = JSON.parse(raw)
    expect(stored.goal).toBe('10K')
    expect(stored.fromTemplate).toBe('10k')
    expect(Array.isArray(stored.weeks)).toBe(true)
    expect(stored.weeks.length).toBeGreaterThan(0)
  })

  it('announces "Plan loaded" politely on success (bilingual)', () => {
    renderPicker()
    const card = screen.getByTestId('preset-card-marathon')
    fireEvent.click(card.querySelector('button'))
    const confirmBtns = screen.getAllByText('Use this plan')
    fireEvent.click(confirmBtns[confirmBtns.length - 1])
    const calls = announce.mock.calls
    expect(calls.some(c => /Plan loaded:/i.test(c[0]) && c[1] === 'polite')).toBe(true)
    expect(calls.some(c => /Marathon/.test(c[0]))).toBe(true)
  })

  it('each card has an aria-label describing the preset', () => {
    renderPicker()
    for (const p of PLAN_TEMPLATE_PRESETS) {
      const card = screen.getByTestId(`preset-card-${p.id}`)
      const label = card.getAttribute('aria-label')
      expect(label).toBeTruthy()
      expect(label).toContain(p.name.en)
      expect(label).toMatch(/\d+\s*weeks/)
    }
  })

  it('TR confirm modal shows Turkish copy', () => {
    localStorage.setItem('sporeus-lang', JSON.stringify('tr'))
    renderPicker({ lang: 'tr' })
    const card = screen.getByTestId('preset-card-5k')
    fireEvent.click(card.querySelector('button'))
    expect(screen.getByText(/Bu mevcut planınızı değiştirecek/i)).toBeInTheDocument()
    expect(screen.getByText('İptal')).toBeInTheDocument()
  })

  it('renders empty state when given an empty preset list', () => {
    renderPicker({ presets: [] })
    expect(screen.getByTestId('plan-template-picker-empty')).toBeInTheDocument()
    expect(screen.getByText('No templates available.')).toBeInTheDocument()
    // No preset cards rendered
    expect(screen.queryByTestId('preset-card-5k')).not.toBeInTheDocument()
  })

  it('dispatches sporeus:plan-loaded window event on confirm', () => {
    renderPicker()
    const handler = vi.fn()
    window.addEventListener('sporeus:plan-loaded', handler)
    const card = screen.getByTestId('preset-card-base')
    fireEvent.click(card.querySelector('button'))
    const confirmBtns = screen.getAllByText('Use this plan')
    fireEvent.click(confirmBtns[confirmBtns.length - 1])
    expect(handler).toHaveBeenCalledTimes(1)
    const ev = handler.mock.calls[0][0]
    expect(ev.detail.presetId).toBe('base')
    window.removeEventListener('sporeus:plan-loaded', handler)
  })
})
