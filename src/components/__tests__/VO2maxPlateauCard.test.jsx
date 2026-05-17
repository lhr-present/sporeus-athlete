// @vitest-environment jsdom
// ─── VO2maxPlateauCard.test.jsx — render tests for the plateau warning ──────
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import VO2maxPlateauCard from '../dashboard/VO2maxPlateauCard.jsx'

afterEach(() => cleanup())

const t = (date, value, type = 'VO2max') => ({
  date, type, value, unit: 'ml/kg/min',
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <VO2maxPlateauCard {...props} />
    </LangCtx.Provider>
  )
}

// Newest test is ≥ 6 weeks before today (2026-05-17 system clock); plateau
// detection gates on the most-recent test being ≥ plateauWeeks old.
const PLATEAU_RESULTS = [
  t('2026-01-01', 50.0),
  t('2026-02-15', 50.5),
  t('2026-04-01', 49.8),
]

const RISING_RESULTS = [
  t('2025-11-01', 50),
  t('2025-12-15', 53),
  t('2026-02-01', 56),
]

describe('VO2maxPlateauCard — silent cases', () => {
  it('renders nothing when testResults is empty', () => {
    const { container } = renderCard({ testResults: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when called with no testResults prop', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for rising progression (isPlateau=false)', () => {
    const { container } = renderCard({ testResults: RISING_RESULTS })
    expect(container.firstChild).toBeNull()
  })
})

describe('VO2maxPlateauCard — warning render', () => {
  it('renders the plateau warning region when a plateau is detected', () => {
    renderCard({ testResults: PLATEAU_RESULTS })
    const region = screen.getByRole('region', { name: /VO2max plateau warning/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/VO2MAX PLATEAU/)
    expect(region.textContent).toMatch(/Bompa 2009/)
  })

  it('exposes data-plateau="true" attribute in the rendered case', () => {
    renderCard({ testResults: PLATEAU_RESULTS })
    const card = document.querySelector('[data-vo2max-plateau-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-plateau')).toBe('true')
  })

  it('surfaces variance, week span, and a recommendation', () => {
    renderCard({ testResults: PLATEAU_RESULTS })
    const card = document.querySelector('[data-vo2max-plateau-card]')
    expect(card.textContent).toMatch(/VARIANCE/)
    expect(card.textContent).toMatch(/WEEK SPAN/)
    const rec = document.querySelector('[data-vo2max-plateau-recommendation]')
    expect(rec).not.toBeNull()
    expect(['change-stimulus', 'deload-restart', 'add-hills'])
      .toContain(rec.getAttribute('data-vo2max-plateau-recommendation'))
  })

  it('renders Turkish heading "VO2MAX PLATOSU" when lang=tr', () => {
    renderCard({ testResults: PLATEAU_RESULTS }, 'tr')
    const region = screen.getByRole('region', { name: /VO2max platosu uyarısı/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/VO2MAX PLATOSU/)
    expect(region.textContent).toMatch(/VARYANS/)
  })
})
