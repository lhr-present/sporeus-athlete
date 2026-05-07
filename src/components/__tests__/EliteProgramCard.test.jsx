// @vitest-environment jsdom
// ─── EliteProgramCard.test.jsx — render tests for the elite-program surface ─
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import EliteProgramCard from '../dashboard/EliteProgramCard.jsx'

const STORAGE_KEY = 'sporeus-eliteProgram'

beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <EliteProgramCard log={[]} profile={{}} {...props} />
    </LangCtx.Provider>
  )
}

function fillFormAndSubmit({ sport = 'run', curTime = '50:00', tgtTime = '40:00', raceDate = '2026-08-15' } = {}) {
  if (sport && sport !== 'run') {
    const sportLabels = { bike: 'BIKE', swim: 'SWIM', triathlon: 'TRI' }
    const btn = screen.getByRole('button', { name: sportLabels[sport] })
    fireEvent.click(btn)
  }
  const curInput = screen.getByLabelText(/Current PR time/i)
  fireEvent.change(curInput, { target: { value: curTime } })
  const tgtInput = screen.getByLabelText(/Target PR time/i)
  fireEvent.change(tgtInput, { target: { value: tgtTime } })
  const dateInput = screen.getByLabelText(/Race date/i)
  fireEvent.change(dateInput, { target: { value: raceDate } })
  const submit = screen.getByRole('button', { name: /GENERATE/i })
  fireEvent.click(submit)
}

describe('EliteProgramCard — form mode', () => {
  it('renders 4 input fields (sport selector, current PR, target PR, race date)', () => {
    renderCard()
    expect(screen.getByRole('group', { name: /Sport selector/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Current PR time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Target PR time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Race date/i)).toBeInTheDocument()
  })

  it('sport selector toggles between 4 sports', () => {
    renderCard()
    const run = screen.getByRole('button', { name: 'RUN' })
    const bike = screen.getByRole('button', { name: 'BIKE' })
    const swim = screen.getByRole('button', { name: 'SWIM' })
    const tri = screen.getByRole('button', { name: 'TRI' })
    expect(run).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(bike)
    expect(bike).toHaveAttribute('aria-pressed', 'true')
    expect(run).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(swim)
    expect(swim).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(tri)
    expect(tri).toHaveAttribute('aria-pressed', 'true')
  })

  it('GENERATE button is disabled until raceDate + times are filled', () => {
    renderCard()
    const submit = screen.getByRole('button', { name: /GENERATE/i })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.change(screen.getByLabelText(/Target PR time/i), { target: { value: '40:00' } })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-15' } })
    expect(submit).not.toBeDisabled()
  })

  it('rejects invalid MM:SS time and keeps submit disabled', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: 'garbage' } })
    fireEvent.change(screen.getByLabelText(/Target PR time/i), { target: { value: '40:00' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-15' } })
    expect(screen.getByRole('button', { name: /GENERATE/i })).toBeDisabled()
  })
})

describe('EliteProgramCard — plan mode', () => {
  it('switches to plan mode after submit and renders feasibility badge', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const region = screen.getByRole('region', { name: /Elite training program/i })
    const badge = region.querySelector('[data-band]')
    expect(badge).not.toBeNull()
    expect(['comfortable', 'realistic', 'aggressive', 'unrealistic']).toContain(badge.getAttribute('data-band'))
  })

  it('plan mode renders phase split bar (img role) with phase legend entries', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const phaseImg = screen.getByRole('img', { name: /Phase split:/i })
    expect(phaseImg).toBeInTheDocument()
  })

  it('plan mode renders all 4 sample week toggles (Base, Build, Peak, Taper)', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    expect(screen.getByRole('button', { name: /BASE/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /BUILD/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /PEAK/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /TAPER/i })).toBeInTheDocument()
  })

  it('reset button switches back to form mode', () => {
    renderCard()
    fillFormAndSubmit()
    expect(screen.queryByLabelText(/Current PR time/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /RESET/i }))
    expect(screen.getByLabelText(/Current PR time/i)).toBeInTheDocument()
  })

  it('renders EXPORT CSV button in plan mode (bilingual)', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const btn = screen.getByRole('button', { name: /Export program as CSV/i })
    expect(btn).toBeInTheDocument()
    expect(btn.textContent).toMatch(/EXPORT CSV/)
    expect(btn.textContent).toMatch(/CSV İNDİR/)
  })

  it('renders APPLY TO CALENDAR button in plan mode (bilingual)', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const btn = screen.getByRole('button', { name: /Apply program to yearly calendar/i })
    expect(btn).toBeInTheDocument()
    expect(btn.textContent).toMatch(/APPLY TO CALENDAR/)
    expect(btn.textContent).toMatch(/TAKVİME UYGULA/)
  })

  it('APPLY TO CALENDAR writes to sporeus-yearly-plan localStorage', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    expect(localStorage.getItem('sporeus-yearly-plan')).toBeNull()
    const btn = screen.getByRole('button', { name: /Apply program to yearly calendar/i })
    fireEvent.click(btn)
    const stored = localStorage.getItem('sporeus-yearly-plan')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored)
    expect(Array.isArray(parsed.weeks)).toBe(true)
    expect(parsed.weeks).toHaveLength(52)
    const races = JSON.parse(localStorage.getItem('sporeus-plan-races'))
    expect(races[0]).toMatchObject({ priority: 'A', date: '2026-08-15' })
  })

  it('APPLY TO CALENDAR confirms before overwriting non-empty plan', () => {
    localStorage.setItem('sporeus-yearly-plan', JSON.stringify({
      weeks: [{ targetTSS: 250 }, { targetTSS: 300 }],
      model: 'traditional',
    }))
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const btn = screen.getByRole('button', { name: /Apply program to yearly calendar/i })
    fireEvent.click(btn)
    expect(confirmSpy).toHaveBeenCalled()
    const parsed = JSON.parse(localStorage.getItem('sporeus-yearly-plan'))
    expect(parsed.weeks).toHaveLength(2)
    confirmSpy.mockRestore()
  })

  it('renders current → target metric row', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const region = screen.getByRole('region', { name: /Elite training program/i })
    expect(region.textContent).toMatch(/50:00/)
    expect(region.textContent).toMatch(/40:00/)
    expect(region.textContent).toMatch(/IMPROVEMENT/)
    expect(region.textContent).toMatch(/İYİLEŞME/)
  })
})

describe('EliteProgramCard — bilingual', () => {
  it('renders English title in form mode', () => {
    renderCard()
    expect(screen.getByText(/CURRENT PR/)).toBeInTheDocument()
  })

  it('renders Turkish labels when lang=tr', () => {
    renderCard({}, 'tr')
    expect(screen.getByText(/MEVCUT PR/)).toBeInTheDocument()
    expect(screen.getByText(/HEDEF PR/)).toBeInTheDocument()
    expect(screen.getByText(/YARIŞ TARİHİ/)).toBeInTheDocument()
  })

  it('renders bilingual region aria-label (en)', () => {
    renderCard()
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Elite training program/i)
  })

  it('renders TR region aria-label when lang=tr', () => {
    renderCard({}, 'tr')
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Elit antrenman programı/i)
  })
})

describe('EliteProgramCard — weekly TSS chart', () => {
  it('renders TSS curve SVG in plan mode with role=img', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const svg = screen.getByRole('img', { name: /TSS curve/i })
    expect(svg).toBeInTheDocument()
    expect(svg.tagName.toLowerCase()).toBe('svg')
  })

  it('renders TR aria-label on TSS chart when lang=tr', () => {
    // Generate plan in EN so the label-driven form helper works,
    // then re-render the persisted plan in TR to verify localized aria.
    const { unmount } = renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    unmount()
    renderCard({}, 'tr')
    const svg = screen.getByRole('img', { name: /TSS eğrisi/i })
    expect(svg).toBeInTheDocument()
    expect(svg.getAttribute('aria-label')).toMatch(/haftalık TSS eğrisi/i)
  })

  it('renders one phase background rect per phase inside the TSS chart svg', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const svg = screen.getByRole('img', { name: /TSS curve/i })
    const rects = svg.querySelectorAll('rect')
    // Phase split for a long block has Base/Build/Peak/Taper — at least 2 phases
    expect(rects.length).toBeGreaterThanOrEqual(2)
    expect(rects.length).toBeLessThanOrEqual(4)
  })

  it('renders header label and deload legend in EN', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    expect(screen.getByText(/WEEKLY TSS CURVE/i)).toBeInTheDocument()
    expect(screen.getByText(/Blue dot: deload week/i)).toBeInTheDocument()
  })

  it('renders deload-week dots when weeklyTSS pattern includes deload weeks', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const svg = screen.getByRole('img', { name: /TSS curve/i })
    const circles = svg.querySelectorAll('circle')
    // The buildWeeklyTSS uses 3:1 deload pattern, so any plan ≥4 weeks has deload dots
    expect(circles.length).toBeGreaterThan(0)
  })
})

describe('EliteProgramCard — persistence', () => {
  it('plan persists across remount via localStorage', () => {
    const { unmount } = renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    expect(screen.queryByLabelText(/Current PR time/i)).toBeNull()
    unmount()
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    renderCard()
    // Plan mode persisted: form labels absent, RESET present
    expect(screen.queryByLabelText(/Current PR time/i)).toBeNull()
    expect(screen.getByRole('button', { name: /RESET/i })).toBeInTheDocument()
  })
})
