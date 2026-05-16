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

  it('reset button switches back to form mode after confirm', () => {
    renderCard()
    fillFormAndSubmit()
    expect(screen.queryByLabelText(/Current PR time/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Reset program/i }))
    // ConfirmModal opens; click the modal's "Reset" confirm button
    fireEvent.click(screen.getByRole('button', { name: /^Reset$/ }))
    expect(screen.getByLabelText(/Current PR time/i)).toBeInTheDocument()
  })

  it('reset button preserves plan when confirm is cancelled', () => {
    renderCard()
    fillFormAndSubmit()
    expect(screen.queryByLabelText(/Current PR time/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Reset program/i }))
    // ConfirmModal opens; click its Cancel button
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }))
    expect(screen.queryByLabelText(/Current PR time/i)).toBeNull()
    expect(screen.getByRole('button', { name: /Reset program/i })).toBeInTheDocument()
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
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const btn = screen.getByRole('button', { name: /Apply program to yearly calendar/i })
    fireEvent.click(btn)
    // ConfirmModal opens; cancel to verify plan is preserved
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }))
    const parsed = JSON.parse(localStorage.getItem('sporeus-yearly-plan'))
    expect(parsed.weeks).toHaveLength(2)
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
    // The race-date <label> uses exact "YARIŞ TARİHİ"; the v8.96.0 toggle uses
    // "YARIŞ TARİHİM YOK". Anchor on whitespace to disambiguate.
    expect(screen.getByText(/^YARIŞ TARİHİ$/)).toBeInTheDocument()
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

describe('EliteProgramCard — v8.91.0 personalization & rejection surface', () => {
  it('writes sporeus-eliteProgramStart on generate', () => {
    renderCard()
    expect(localStorage.getItem('sporeus-eliteProgramStart')).toBeNull()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const stored = localStorage.getItem('sporeus-eliteProgramStart')
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored)).toBe('2026-05-07')
  })

  it('clears sporeus-eliteProgramStart on reset', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    expect(JSON.parse(localStorage.getItem('sporeus-eliteProgramStart'))).toBe('2026-05-07')
    fireEvent.click(screen.getByRole('button', { name: /Reset program/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Reset$/ }))
    // useLocalStorage serializes null as the string "null"
    expect(JSON.parse(localStorage.getItem('sporeus-eliteProgramStart'))).toBeNull()
  })

  it('passes profile.weeklyHours and trainingDays through to the orchestrator input', () => {
    renderCard({ profile: { weeklyHours: 12, trainingDays: 4 } })
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.input.profile.weeklyHours).toBe(12)
    expect(stored.input.profile.trainingDays).toBe(4)
  })

  it('derives currentCTL from log via PMC and passes it through', () => {
    // 30 days of 80 TSS/day ending today produces a non-trivial CTL well above
    // the orchestrator's currentCTL=50 default.
    const log = []
    const today = new Date('2026-05-07T00:00:00Z')
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setUTCDate(d.getUTCDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), tss: 80, type: 'run' })
    }
    renderCard({ log })
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(typeof stored.input.profile.currentCTL).toBe('number')
    expect(stored.input.profile.currentCTL).toBeGreaterThan(20)
  })

  it('omits currentCTL from input.profile when log is empty (lib default applies)', () => {
    renderCard({ log: [] })
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.input.profile.currentCTL).toBeUndefined()
  })

  it('renders rejection banner with bilingual note for target-not-faster', () => {
    renderCard()
    // Slower target → rejected
    fillFormAndSubmit({ curTime: '40:00', tgtTime: '50:00', raceDate: '2026-08-15' })
    const banner = document.querySelector('[data-rejection]')
    expect(banner).not.toBeNull()
    expect(banner.getAttribute('data-rejection')).toBe('target-not-faster')
    expect(banner.textContent).toMatch(/Target time must be faster/i)
    // Form preserved (input fields still visible) so user can correct
    expect(screen.getByLabelText(/Current PR time/i)).toBeInTheDocument()
  })

  it('renders TR rejection note when lang=tr', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '40:00', tgtTime: '50:00', raceDate: '2026-08-15' })
    cleanup()
    renderCard({}, 'tr')
    const banner = document.querySelector('[data-rejection]')
    expect(banner).not.toBeNull()
    expect(banner.textContent).toMatch(/Hedef süre mevcut süreden daha hızlı olmalı/i)
  })

  // v9.26.0 — past race date is now caught CLIENT-SIDE before submission
  // (was: rejected post-submit via banner). Form blocks submit, shows
  // inline alert under the date field. Orchestrator's race-in-past
  // rejection path is still covered at the lib level (eliteProgram.test.js).
  it('shows inline alert for past race date and blocks submit', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.change(screen.getByLabelText(/Target PR time/i), { target: { value: '40:00' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-04-30' } })
    // Inline alert appears with bilingual message (scoped — global a11y
    // live regions also have role="alert")
    expect(screen.getByText(/Race date must be in the future/i)).toBeInTheDocument()
    // Submit is disabled, no rejection banner reached
    const submit = screen.getByRole('button', { name: /GENERATE/i })
    expect(submit).toBeDisabled()
    expect(document.querySelector('[data-rejection]')).toBeNull()
  })

  it('rejection banner uses red border-left accent', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '40:00', tgtTime: '50:00', raceDate: '2026-08-15' })
    const region = screen.getByRole('region', { name: /Elite training program/i })
    expect(region.getAttribute('style')).toMatch(/border-left:\s*4px solid (rgb\(220,\s*53,\s*69\)|#dc3545)/i)
  })
})

describe('EliteProgramCard — v8.92.0 physiology & model rationale', () => {
  it('PhysiologyRow renders VDOT current → target for run sport', () => {
    renderCard()
    fillFormAndSubmit({ sport: 'run', curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const phys = document.querySelector('[data-physiology="run"]')
    expect(phys).not.toBeNull()
    expect(phys.textContent).toMatch(/VDOT/)
    expect(phys.textContent).toMatch(/→/)
  })

  it('PhysiologyRow renders 5 pace rows (E/M/T/I/R) for run', () => {
    renderCard()
    fillFormAndSubmit({ sport: 'run', curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const phys = document.querySelector('[data-physiology="run"]')
    expect(phys).not.toBeNull()
    const text = phys.textContent
    // The 5 pace keys should each appear in the panel
    for (const k of ['E', 'M', 'T', 'I', 'R']) {
      expect(text).toContain(k)
    }
    // At least one M:SS/km pace string
    expect(text).toMatch(/\d:\d{2}\/km/)
    // Five pace strings in /km format (E, M, T, I, R) per side; expect ≥10 occurrences
    const km = text.match(/\d{1,2}:\d{2}\/km/g) || []
    expect(km.length).toBeGreaterThanOrEqual(10)
  })

  it('PhysiologyRow shows FTP for bike with watts and zone rows', () => {
    renderCard()
    fillFormAndSubmit({ sport: 'bike', curTime: '60:00', tgtTime: '55:00', raceDate: '2026-08-15' })
    const phys = document.querySelector('[data-physiology="bike"]')
    expect(phys).not.toBeNull()
    expect(phys.textContent).toMatch(/FTP/)
    expect(phys.textContent).toMatch(/W/)
    // Five zone rows Z1..Z5
    for (const z of ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']) {
      expect(phys.textContent).toContain(z)
    }
  })

  it('PhysiologyRow shows CSS for swim with M:SS/100m formatting', () => {
    renderCard()
    fillFormAndSubmit({ sport: 'swim', curTime: '25:30', tgtTime: '23:45', raceDate: '2026-08-15' })
    const phys = document.querySelector('[data-physiology="swim"]')
    expect(phys).not.toBeNull()
    expect(phys.textContent).toMatch(/CSS/)
    expect(phys.textContent).toMatch(/\d:\d{2}\/100m/)
  })

  it('About-this-model toggle expands and collapses', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const btn = screen.getByRole('button', { name: /About this model/i })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('[data-about-model-panel]')).toBeNull()
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[data-about-model-panel]')).not.toBeNull()
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('[data-about-model-panel]')).toBeNull()
  })

  it('Expanded panel contains all 4 phase rationale paragraphs', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const btn = screen.getByRole('button', { name: /About this model/i })
    fireEvent.click(btn)
    for (const p of ['Base', 'Build', 'Peak', 'Taper']) {
      expect(document.querySelector(`[data-phase-rationale="${p}"]`)).not.toBeNull()
    }
  })

  it('Each phase rationale has a cite= text visible', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    fireEvent.click(screen.getByRole('button', { name: /About this model/i }))
    const panel = document.querySelector('[data-about-model-panel]')
    expect(panel).not.toBeNull()
    expect(panel.textContent).toMatch(/Daniels 2014/)
    expect(panel.textContent).toMatch(/Coggan & Allen 2010/)
    expect(panel.textContent).toMatch(/Bompa 2009/)
    expect(panel.textContent).toMatch(/Mujika & Padilla 2003/)
    // cite attribute carries the citation string
    const cites = panel.querySelectorAll('[data-cite]')
    expect(cites.length).toBe(4)
  })

  it('TR rationale renders when lang=tr', () => {
    const { unmount } = renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    unmount()
    renderCard({}, 'tr')
    fireEvent.click(screen.getByRole('button', { name: /Bu model hakkında/i }))
    const panel = document.querySelector('[data-about-model-panel]')
    expect(panel).not.toBeNull()
    expect(panel.textContent).toMatch(/aerobik enzim adaptasyonu/i)
    expect(panel.textContent).toMatch(/Geleneksel Doğrusal Periyodizasyon/i)
  })

  it('Model name shown in EN includes "Traditional Linear Periodization"', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    fireEvent.click(screen.getByRole('button', { name: /About this model/i }))
    const panel = document.querySelector('[data-about-model-panel]')
    expect(panel.textContent).toMatch(/Traditional Linear Periodization/)
  })

  it('Deload note rendered in expanded panel', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    fireEvent.click(screen.getByRole('button', { name: /About this model/i }))
    const panel = document.querySelector('[data-about-model-panel]')
    const deload = panel.querySelector('[data-deload-note]')
    expect(deload).not.toBeNull()
    expect(deload.textContent).toMatch(/3:1 deload/i)
    expect(deload.textContent).toMatch(/Issurin 2010/)
  })
})

describe('EliteProgramCard — v8.94.0 sport-specific form modes', () => {
  // ── Bike: FTP-direct toggle ────────────────────────────────────────────────
  it('FTP-DIRECT toggle is visible in bike mode and hidden in run/swim/triathlon', () => {
    renderCard()
    // run: hidden
    expect(document.querySelector('[data-toggle="bike-ftp-direct"]')).toBeNull()
    // bike: visible
    fireEvent.click(screen.getByRole('button', { name: 'BIKE' }))
    expect(document.querySelector('[data-toggle="bike-ftp-direct"]')).not.toBeNull()
    // swim: hidden
    fireEvent.click(screen.getByRole('button', { name: 'SWIM' }))
    expect(document.querySelector('[data-toggle="bike-ftp-direct"]')).toBeNull()
    // triathlon: hidden
    fireEvent.click(screen.getByRole('button', { name: 'TRI' }))
    expect(document.querySelector('[data-toggle="bike-ftp-direct"]')).toBeNull()
  })

  it('bike FTP-DIRECT ON: distance dropdowns replaced with watts inputs', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'BIKE' }))
    // OFF: select dropdowns present (current PR distance + target PR distance)
    expect(screen.getByLabelText(/Current PR distance/i)).toBeInTheDocument()
    // Enable toggle
    const cb = screen.getByLabelText(/FTP direct watts entry/i)
    fireEvent.click(cb)
    // After: no current/target PR distance/time selects in form
    expect(screen.queryByLabelText(/Current PR distance/i)).toBeNull()
    expect(screen.queryByLabelText(/Target PR distance/i)).toBeNull()
    expect(screen.queryByLabelText(/Current PR time/i)).toBeNull()
    expect(screen.queryByLabelText(/Target PR time/i)).toBeNull()
    // Watts inputs present
    expect(screen.getByLabelText(/Current FTP \(watts\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Target FTP \(watts\)/i)).toBeInTheDocument()
    // No <select> remains in the bike-ftp-direct mode block
    const block = document.querySelector('[data-mode="bike-ftp-direct"]')
    expect(block).not.toBeNull()
    expect(block.querySelectorAll('select').length).toBe(0)
  })

  it('bike FTP-DIRECT submit persists currentPR.distanceM=0 + timeSec=watts', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'BIKE' }))
    fireEvent.click(screen.getByLabelText(/FTP direct watts entry/i))
    fireEvent.change(screen.getByLabelText(/Current FTP \(watts\)/i), { target: { value: '245' } })
    fireEvent.change(screen.getByLabelText(/Target FTP \(watts\)/i), { target: { value: '275' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-15' } })
    const submit = screen.getByRole('button', { name: /GENERATE/i })
    expect(submit).not.toBeDisabled()
    fireEvent.click(submit)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.input.currentPR.distanceM).toBe(0)
    expect(stored.input.currentPR.timeSec).toBe(245)
    expect(stored.input.targetPR.distanceM).toBe(0)
    expect(stored.input.targetPR.timeSec).toBe(275)
    expect(stored.input.sport).toBe('bike')
  })

  it('bike FTP-DIRECT produces a plan with feasibility band', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'BIKE' }))
    fireEvent.click(screen.getByLabelText(/FTP direct watts entry/i))
    fireEvent.change(screen.getByLabelText(/Current FTP \(watts\)/i), { target: { value: '245' } })
    fireEvent.change(screen.getByLabelText(/Target FTP \(watts\)/i), { target: { value: '275' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-15' } })
    fireEvent.click(screen.getByRole('button', { name: /GENERATE/i }))
    const region = screen.getByRole('region', { name: /Elite training program/i })
    const badge = region.querySelector('[data-band]')
    expect(badge).not.toBeNull()
    expect(['comfortable', 'realistic', 'aggressive', 'unrealistic']).toContain(badge.getAttribute('data-band'))
  })

  it('bike FTP-DIRECT form payload persists across remount', () => {
    const { unmount } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'BIKE' }))
    fireEvent.click(screen.getByLabelText(/FTP direct watts entry/i))
    fireEvent.change(screen.getByLabelText(/Current FTP \(watts\)/i), { target: { value: '245' } })
    fireEvent.change(screen.getByLabelText(/Target FTP \(watts\)/i), { target: { value: '275' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-15' } })
    fireEvent.click(screen.getByRole('button', { name: /GENERATE/i }))
    // Reset back to form mode (form payload preserved alongside input by handleReset wiping persisted)
    // Verify form payload persisted in localStorage at submit time
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.form.bikeFtpDirect).toBe(true)
    expect(stored.form.currentWatts).toBe('245')
    expect(stored.form.targetWatts).toBe('275')
    unmount()
  })

  // ── Swim: Wakayoshi 2-TT toggle ────────────────────────────────────────────
  it('WAKAYOSHI 2-TT toggle is visible in swim mode and hidden in run/bike/triathlon', () => {
    renderCard()
    expect(document.querySelector('[data-toggle="swim-2tt"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'BIKE' }))
    expect(document.querySelector('[data-toggle="swim-2tt"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'SWIM' }))
    expect(document.querySelector('[data-toggle="swim-2tt"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'TRI' }))
    expect(document.querySelector('[data-toggle="swim-2tt"]')).toBeNull()
  })

  it('swim WAKAYOSHI ON: shows 4 (D, T) input groups for current + target', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'SWIM' }))
    fireEvent.click(screen.getByLabelText(/Wakayoshi 2-TT mode/i))
    expect(screen.getByLabelText(/Current TT1 distance/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Current TT1 time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Current TT2 distance/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Current TT2 time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Target TT1 distance/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Target TT1 time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Target TT2 distance/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Target TT2 time/i)).toBeInTheDocument()
    // Original single-TT inputs hidden
    expect(screen.queryByLabelText(/Current PR time \(MM:SS\)/i)).toBeNull()
  })

  it('swim WAKAYOSHI submit synthesizes 200m + sec-per-100m × 2 payload', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'SWIM' }))
    fireEvent.click(screen.getByLabelText(/Wakayoshi 2-TT mode/i))
    // Current: 200m @ 2:40, 400m @ 5:40 → CSS = 200/180 = 1.1111 m/s → 90 sec/100m → synthCurT = 180
    fireEvent.change(screen.getByLabelText(/Current TT1 time/i), { target: { value: '2:40' } })
    fireEvent.change(screen.getByLabelText(/Current TT2 time/i), { target: { value: '5:40' } })
    // Target: 200m @ 2:30, 400m @ 5:20 → CSS = 200/170 ≈ 1.1765 m/s → 85 sec/100m → synthTgtT = 170
    fireEvent.change(screen.getByLabelText(/Target TT1 time/i), { target: { value: '2:30' } })
    fireEvent.change(screen.getByLabelText(/Target TT2 time/i), { target: { value: '5:20' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-15' } })
    const submit = screen.getByRole('button', { name: /GENERATE/i })
    expect(submit).not.toBeDisabled()
    fireEvent.click(submit)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.input.currentPR.distanceM).toBe(200)
    expect(stored.input.currentPR.timeSec).toBeCloseTo(180, 0)
    expect(stored.input.targetPR.distanceM).toBe(200)
    expect(stored.input.targetPR.timeSec).toBeCloseTo(170, 0)
    expect(stored.input.sport).toBe('swim')
    expect(stored.form.swim2TT).toBe(true)
  })

  it('swim WAKAYOSHI: invalid CSS (T2 ≤ T1) keeps GENERATE disabled', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'SWIM' }))
    fireEvent.click(screen.getByLabelText(/Wakayoshi 2-TT mode/i))
    // T2 ≤ T1 on current side: 200m @ 5:00 + 400m @ 4:00 (impossible)
    fireEvent.change(screen.getByLabelText(/Current TT1 time/i), { target: { value: '5:00' } })
    fireEvent.change(screen.getByLabelText(/Current TT2 time/i), { target: { value: '4:00' } })
    fireEvent.change(screen.getByLabelText(/Target TT1 time/i), { target: { value: '2:30' } })
    fireEvent.change(screen.getByLabelText(/Target TT2 time/i), { target: { value: '5:20' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-15' } })
    expect(screen.getByRole('button', { name: /GENERATE/i })).toBeDisabled()
  })

  it('swim WAKAYOSHI submit renders feasibility badge', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'SWIM' }))
    fireEvent.click(screen.getByLabelText(/Wakayoshi 2-TT mode/i))
    fireEvent.change(screen.getByLabelText(/Current TT1 time/i), { target: { value: '2:40' } })
    fireEvent.change(screen.getByLabelText(/Current TT2 time/i), { target: { value: '5:40' } })
    fireEvent.change(screen.getByLabelText(/Target TT1 time/i), { target: { value: '2:30' } })
    fireEvent.change(screen.getByLabelText(/Target TT2 time/i), { target: { value: '5:20' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-15' } })
    fireEvent.click(screen.getByRole('button', { name: /GENERATE/i }))
    const region = screen.getByRole('region', { name: /Elite training program/i })
    const badge = region.querySelector('[data-band]')
    expect(badge).not.toBeNull()
    expect(['comfortable', 'realistic', 'aggressive', 'unrealistic']).toContain(badge.getAttribute('data-band'))
  })

  // ── Dark-mode contrast on phase rects ──────────────────────────────────────
  it('WeeklyTSSChart phase rects use opacity 0.30 for dark-mode legibility', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const svg = screen.getByRole('img', { name: /TSS curve/i })
    const rects = svg.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(0)
    rects.forEach(r => {
      expect(r.getAttribute('opacity')).toBe('0.30')
    })
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

// ─── v8.95.0 — recent-best autofill chip + sport defaulting ──────────────────
function buildLog({ days = 30, sport = 'run', distanceKm = 10, durationMin = 50, today = '2026-05-07', count = 1 } = {}) {
  const typeMap = { run: 'Easy Run', bike: 'Long ride', swim: 'Pool swim' }
  const out = []
  const base = new Date(today + 'T12:00:00Z')
  for (let i = 0; i < count; i++) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - (days + i))
    out.push({
      date: d.toISOString().slice(0, 10),
      type: typeMap[sport] || 'Easy Run',
      distanceKm,
      duration: durationMin,
    })
  }
  return out
}

describe('EliteProgramCard — v8.95.0 recent-best autofill', () => {
  it('chip not rendered when log is empty', () => {
    renderCard({ log: [] })
    expect(document.querySelector('[data-recent-best-chip]')).toBeNull()
  })

  it('chip rendered when log has 1 run @ 10K within 90 days', () => {
    const log = buildLog({ days: 12, sport: 'run', distanceKm: 10, durationMin: 50 })
    renderCard({ log })
    const chip = document.querySelector('[data-recent-best-chip]')
    expect(chip).not.toBeNull()
  })

  it('chip text shows MM:SS, bucket label, and "X days ago"', () => {
    const log = buildLog({ days: 12, sport: 'run', distanceKm: 10, durationMin: 50 })
    renderCard({ log })
    const chip = document.querySelector('[data-recent-best-chip]')
    expect(chip.textContent).toMatch(/USE MY RECENT BEST/)
    expect(chip.textContent).toMatch(/50:00/)
    expect(chip.textContent).toMatch(/10K/)
    expect(chip.textContent).toMatch(/12 days ago/)
  })

  it('click chip fills currentDist + currentTime form fields', () => {
    const log = buildLog({ days: 12, sport: 'run', distanceKm: 10, durationMin: 50 })
    renderCard({ log })
    const chip = document.querySelector('[data-recent-best-chip]')
    fireEvent.click(chip)
    const curInput = screen.getByLabelText(/Current PR time/i)
    expect(curInput.value).toBe('50:00')
    const distSel = screen.getByLabelText(/Current PR distance/i)
    expect(Number(distSel.value)).toBe(10000)
  })

  it('click chip + target + date fills form to ready/enabled state', () => {
    const log = buildLog({ days: 12, sport: 'run', distanceKm: 10, durationMin: 50 })
    renderCard({ log })
    fireEvent.click(document.querySelector('[data-recent-best-chip]'))
    fireEvent.change(screen.getByLabelText(/Target PR time/i), { target: { value: '45:00' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-09-01' } })
    expect(screen.getByRole('button', { name: /GENERATE/i })).not.toBeDisabled()
  })

  it('chip hidden when sport selector flipped to bike (no bike entries in log)', () => {
    const log = buildLog({ days: 12, sport: 'run', distanceKm: 10, durationMin: 50 })
    renderCard({ log })
    expect(document.querySelector('[data-recent-best-chip]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'BIKE' }))
    expect(document.querySelector('[data-recent-best-chip]')).toBeNull()
  })

  it('profile.primarySport=bike + log with rides defaults form sport to bike', () => {
    const log = buildLog({ days: 8, sport: 'bike', distanceKm: 40, durationMin: 75 })
    renderCard({ log, profile: { primarySport: 'bike' } })
    expect(screen.getByRole('button', { name: 'BIKE' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'RUN' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('no primarySport, log mixed sports → defaults to most-trained sport', () => {
    const log = [
      ...buildLog({ days: 30, sport: 'run',  distanceKm: 10, durationMin: 50, count: 3 }),
      ...buildLog({ days: 5,  sport: 'bike', distanceKm: 40, durationMin: 75, count: 1 }),
    ]
    renderCard({ log })
    expect(screen.getByRole('button', { name: 'RUN' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('bilingual TR chip text', () => {
    const log = buildLog({ days: 12, sport: 'run', distanceKm: 10, durationMin: 50 })
    renderCard({ log }, 'tr')
    const chip = document.querySelector('[data-recent-best-chip]')
    expect(chip).not.toBeNull()
    expect(chip.textContent).toMatch(/EN İYİ EFORUMU KULLAN/)
    expect(chip.textContent).toMatch(/12 gün önce/)
  })

  it('chip aria-label exposes the recent-best context for SR users', () => {
    const log = buildLog({ days: 12, sport: 'run', distanceKm: 10, durationMin: 50 })
    renderCard({ log })
    const chip = document.querySelector('[data-recent-best-chip]')
    const aria = chip.getAttribute('aria-label') || ''
    expect(aria).toMatch(/USE MY RECENT BEST/)
    expect(aria).toMatch(/autofill/i)
    expect(aria).toMatch(/50:00/)
  })
})

// ─── v8.96.0 — general-user toggles (NO RACE DATE + NO TARGET TIME) ──────────
describe('EliteProgramCard — v8.96.0 general-user toggles', () => {
  it('NO RACE DATE checkbox renders in form mode', () => {
    renderCard()
    expect(document.querySelector('[data-toggle="no-race-date"]')).not.toBeNull()
    const cb = screen.getByLabelText(/General build mode \(no event\)/i)
    expect(cb).toBeInTheDocument()
    expect(cb.tagName.toLowerCase()).toBe('input')
  })

  it('with NO RACE DATE checked: race-date input hidden + 12/16/24 segments visible', () => {
    renderCard()
    const cb = screen.getByLabelText(/General build mode \(no event\)/i)
    fireEvent.click(cb)
    // race-date input gone
    expect(screen.queryByLabelText(/Race date/i)).toBeNull()
    // weeks selector group visible with 3 segments
    const grp = document.querySelector('[data-weeks-override]')
    expect(grp).not.toBeNull()
    expect(screen.getByRole('button', { name: /Build for 12 weeks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Build for 16 weeks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Build for 24 weeks/i })).toBeInTheDocument()
  })

  it('with NO RACE DATE checked: GENERATE enabled with currentT + targetT only', () => {
    renderCard()
    fireEvent.click(screen.getByLabelText(/General build mode \(no event\)/i))
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.change(screen.getByLabelText(/Target PR time/i), { target: { value: '47:00' } })
    expect(screen.getByRole('button', { name: /GENERATE/i })).not.toBeDisabled()
  })

  it('NO TARGET TIME checkbox renders in form mode', () => {
    renderCard()
    expect(document.querySelector('[data-toggle="no-target"]')).not.toBeNull()
    const cb = screen.getByLabelText(/General build mode \(auto target\)/i)
    expect(cb).toBeInTheDocument()
  })

  it('with NO TARGET TIME checked: target row hidden + GENERATE enabled with currentT + raceDate', () => {
    renderCard()
    fireEvent.click(screen.getByLabelText(/General build mode \(auto target\)/i))
    expect(screen.queryByLabelText(/Target PR time/i)).toBeNull()
    expect(screen.queryByLabelText(/Target PR distance/i)).toBeNull()
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-15' } })
    expect(screen.getByRole('button', { name: /GENERATE/i })).not.toBeDisabled()
  })

  it('both toggles checked: GENERATE enabled with sport + currentT only', () => {
    renderCard()
    fireEvent.click(screen.getByLabelText(/General build mode \(auto target\)/i))
    fireEvent.click(screen.getByLabelText(/General build mode \(no event\)/i))
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    expect(screen.getByRole('button', { name: /GENERATE/i })).not.toBeDisabled()
  })

  it('submit with weeksOverride=16 produces a 16-week plan (phases sum to 16)', () => {
    renderCard()
    fireEvent.click(screen.getByLabelText(/General build mode \(no event\)/i))
    fireEvent.click(screen.getByRole('button', { name: /Build for 16 weeks/i }))
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.change(screen.getByLabelText(/Target PR time/i), { target: { value: '47:00' } })
    fireEvent.click(screen.getByRole('button', { name: /GENERATE/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.input.weeksOverride).toBe(16)
    expect(stored.input.raceDate).toBeNull()
    // Plan view rendered; verify weeks-available count text shows 16
    const region = screen.getByRole('region', { name: /Elite training program/i })
    expect(region.textContent).toMatch(/16w available/)
  })

  it('submit with noTarget=true produces a faster synthetic target than currentPR', () => {
    renderCard()
    fireEvent.click(screen.getByLabelText(/General build mode \(auto target\)/i))
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-15' } })
    fireEvent.click(screen.getByRole('button', { name: /GENERATE/i }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.input.targetPR).toBeNull()
    expect(stored.input.noTarget).toBe(true)
    // The card renders the AUTO-DERIVED badge
    expect(document.querySelector('[data-synthetic-badge]')).not.toBeNull()
  })

  it('AUTO-DERIVED badge renders in plan mode for synthetic', () => {
    renderCard()
    fireEvent.click(screen.getByLabelText(/General build mode \(auto target\)/i))
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-15' } })
    fireEvent.click(screen.getByRole('button', { name: /GENERATE/i }))
    const badge = document.querySelector('[data-synthetic-badge]')
    expect(badge).not.toBeNull()
    expect(badge.textContent).toMatch(/AUTO-DERIVED/)
    expect(badge.textContent).toMatch(/OTOMATİK TÜRETİLMİŞ/)
  })

  it('title appends "· GENERAL BUILD" when both synthetic', () => {
    renderCard()
    fireEvent.click(screen.getByLabelText(/General build mode \(auto target\)/i))
    fireEvent.click(screen.getByLabelText(/General build mode \(no event\)/i))
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.click(screen.getByRole('button', { name: /GENERATE/i }))
    const titleEl = document.querySelector('[data-general-build="true"]')
    expect(titleEl).not.toBeNull()
    expect(titleEl.textContent).toMatch(/GENERAL BUILD/)
  })

  it('reset clears toggles back to default unchecked state', () => {
    renderCard()
    fireEvent.click(screen.getByLabelText(/General build mode \(auto target\)/i))
    fireEvent.click(screen.getByLabelText(/General build mode \(no event\)/i))
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.click(screen.getByRole('button', { name: /GENERATE/i }))
    fireEvent.click(screen.getByRole('button', { name: /Reset program/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Reset$/ }))
    // Form mode again
    const cbTarget = screen.getByLabelText(/General build mode \(auto target\)/i)
    const cbRace = screen.getByLabelText(/General build mode \(no event\)/i)
    expect(cbTarget.checked).toBe(false)
    expect(cbRace.checked).toBe(false)
  })

  it('toggle persists across remount via form payload', () => {
    const { unmount } = renderCard()
    fireEvent.click(screen.getByLabelText(/General build mode \(no event\)/i))
    fireEvent.click(screen.getByRole('button', { name: /Build for 16 weeks/i }))
    fireEvent.click(screen.getByLabelText(/General build mode \(auto target\)/i))
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.click(screen.getByRole('button', { name: /GENERATE/i }))
    unmount()
    // Reset persisted to clear plan but keep form so form mode shows on remount
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.form.noRaceDate).toBe(true)
    expect(stored.form.noTarget).toBe(true)
    expect(stored.form.weeksOverride).toBe(16)
  })

  it('bilingual toggle copy in TR', () => {
    renderCard({}, 'tr')
    expect(screen.getByText(/YARIŞ TARİHİM YOK/)).toBeInTheDocument()
    expect(screen.getByText(/HEDEF SÜRE YOK/)).toBeInTheDocument()
  })

  it('bilingual AUTO-DERIVED badge in TR', () => {
    const { unmount } = renderCard()
    fireEvent.click(screen.getByLabelText(/General build mode \(auto target\)/i))
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-08-15' } })
    fireEvent.click(screen.getByRole('button', { name: /GENERATE/i }))
    unmount()
    renderCard({}, 'tr')
    const badge = document.querySelector('[data-synthetic-badge]')
    expect(badge).not.toBeNull()
    expect(badge.textContent).toMatch(/OTOMATİK TÜRETİLMİŞ/)
    expect(badge.getAttribute('aria-label')).toMatch(/Otomatik türetilmiş/i)
  })

  it('explicit targetPR + noTarget toggle ignored at orchestrator level (not exposed via form)', () => {
    // The form prevents both — when noTarget checked, target inputs hide.
    // Force the orchestrator through a synthetic input shape: noTarget=true with
    // explicit targetPR present (could happen via persisted-input edit). The
    // orchestrator preserves explicit target.
    renderCard()
    // submit normal flow first
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '47:00', raceDate: '2026-08-15' })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(stored.input.targetPR.timeSec).toBe(2820)
    expect(stored.input.noTarget).toBeFalsy()
  })

  it('APPLY TO CALENDAR with synthetic raceDate uses effectiveRaceDate as anchor', () => {
    renderCard()
    fireEvent.click(screen.getByLabelText(/General build mode \(auto target\)/i))
    fireEvent.click(screen.getByLabelText(/General build mode \(no event\)/i))
    fireEvent.click(screen.getByRole('button', { name: /Build for 12 weeks/i }))
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.click(screen.getByRole('button', { name: /GENERATE/i }))
    const btn = screen.getByRole('button', { name: /Apply program to yearly calendar/i })
    fireEvent.click(btn)
    const races = JSON.parse(localStorage.getItem('sporeus-plan-races'))
    expect(races).toHaveLength(1)
    expect(races[0].priority).toBe('C')
    expect(races[0].name).toBe('Final Week')
  })
})

// ─── v8.97.0 — lifecycle pill + SHARE WITH COACH ────────────────────────────
describe('EliteProgramCard — v8.97.0 lifecycle + share', () => {
  it('lifecycle pill renders in plan mode after submit', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const pill = document.querySelector('[data-lifecycle]')
    expect(pill).not.toBeNull()
  })

  it('pill data-lifecycle attribute is "draft" since no yearly plan applied', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const pill = document.querySelector('[data-lifecycle]')
    expect(pill).not.toBeNull()
    expect(pill.getAttribute('data-lifecycle')).toBe('draft')
  })

  it('pill text bilingual EN/TR', () => {
    const { unmount } = renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    let pill = document.querySelector('[data-lifecycle]')
    expect(pill.textContent).toMatch(/DRAFT/)
    unmount()
    renderCard({}, 'tr')
    pill = document.querySelector('[data-lifecycle]')
    expect(pill).not.toBeNull()
    expect(pill.textContent).toMatch(/TASLAK/)
  })

  it('SHARE WITH COACH button renders bilingual', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const btn = screen.getByRole('button', { name: /Share plan summary with coach/i })
    expect(btn).toBeInTheDocument()
    expect(btn.textContent).toMatch(/SHARE WITH COACH/)
    expect(btn.textContent).toMatch(/KOÇLA PAYLAŞ/)
  })

  it('click SHARE writes JSON to clipboard (mocked navigator.clipboard.writeText)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const orig = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    try {
      renderCard()
      fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
      const btn = screen.getByRole('button', { name: /Share plan summary with coach/i })
      fireEvent.click(btn)
      expect(writeText).toHaveBeenCalledTimes(1)
      const json = writeText.mock.calls[0][0]
      const parsed = JSON.parse(json)
      expect(parsed.kind).toBe('sporeus-elite-program-share')
      expect(parsed.v).toBe(1)
    } finally {
      if (orig) Object.defineProperty(navigator, 'clipboard', orig)
      else delete navigator.clipboard
    }
  })

  it('JSON shape includes athleteSnapshot, physiology, phases, citation', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const orig = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    try {
      renderCard()
      fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
      fireEvent.click(screen.getByRole('button', { name: /Share plan summary with coach/i }))
      const parsed = JSON.parse(writeText.mock.calls[0][0])
      expect(parsed.athleteSnapshot).toBeDefined()
      expect(parsed.athleteSnapshot.sport).toBe('run')
      expect(parsed.athleteSnapshot.feasibilityBand).toBeTruthy()
      expect(parsed.physiology).toBeDefined()
      expect(parsed.physiology.currentVDOT).toEqual(expect.any(Number))
      expect(Array.isArray(parsed.phases)).toBe(true)
      expect(parsed.phases.length).toBeGreaterThan(0)
      expect(parsed.citation).toMatch(/Daniels 2014/)
      expect(parsed.lifecycle).toBeDefined()
      expect(parsed.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    } finally {
      if (orig) Object.defineProperty(navigator, 'clipboard', orig)
      else delete navigator.clipboard
    }
  })

  it('clipboard rejection falls back to Blob+download (URL.createObjectURL invoked)', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    const origClip = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const revokeObjectURL = vi.fn()
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    try {
      renderCard()
      fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
      fireEvent.click(screen.getByRole('button', { name: /Share plan summary with coach/i }))
      // Allow rejected promise microtask to resolve
      await Promise.resolve()
      await Promise.resolve()
      expect(writeText).toHaveBeenCalled()
      expect(createObjectURL).toHaveBeenCalled()
    } finally {
      URL.createObjectURL = origCreate
      URL.revokeObjectURL = origRevoke
      if (origClip) Object.defineProperty(navigator, 'clipboard', origClip)
      else delete navigator.clipboard
    }
  })

  it('pill hidden in form mode (no plan yet)', () => {
    renderCard()
    expect(document.querySelector('[data-lifecycle]')).toBeNull()
  })

  it('pill state "applied" when yearly-plan localStorage has weeks with TSS > 0', () => {
    // Pre-seed yearly-plan as if APPLY TO CALENDAR has been clicked
    localStorage.setItem('sporeus-yearly-plan', JSON.stringify({
      weeks: [{ targetTSS: 250 }, { targetTSS: 300 }, { targetTSS: 320 }],
      model: 'traditional',
    }))
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const pill = document.querySelector('[data-lifecycle]')
    expect(pill).not.toBeNull()
    // No log entries supplied → applied state expected
    expect(pill.getAttribute('data-lifecycle')).toBe('applied')
  })

  it('aria-label on pill exposes plan-status semantics', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const pill = document.querySelector('[data-lifecycle]')
    expect(pill).not.toBeNull()
    const aria = pill.getAttribute('aria-label') || ''
    expect(aria).toMatch(/Plan status/i)
    expect(pill.getAttribute('role')).toBe('status')
  })
})

// ─── v8.98.0 + v8.99.0 — adherence section + RE-PROJECT button ───────────────
// Audit (v8.99 deep-dive) found these surfaces had zero React-component
// coverage. Backfilling for launch readiness. Tests mount the card directly
// in plan mode by pre-seeding localStorage (form-submit path overwrites the
// programStart anchor with `today`, which would zero out adherence).
describe('EliteProgramCard — v8.98.0 adherence section', () => {
  function seedPlanModeInProgress({ adherencePct = 100, weeksBack = 4, tssPerWeek = 200, raceDate = '2026-09-20' }) {
    const startStr = (() => {
      const d = new Date('2026-05-07T00:00:00Z')
      d.setUTCDate(d.getUTCDate() - weeksBack * 7)
      return d.toISOString().slice(0, 10)
    })()
    // Pre-seed all three localStorage keys: program input, start anchor,
    // applied yearly plan
    localStorage.setItem('sporeus-eliteProgram', JSON.stringify({
      input: {
        sport: 'run',
        currentPR: { distanceM: 10000, timeSec: 50 * 60 },
        targetPR:  { distanceM: 10000, timeSec: 40 * 60 },
        raceDate,
        // Pin currentCTL low so program's weeklyTSS lands in a tight predictable
        // range (~210-285) that the test seed can hit precisely.
        profile: { currentCTL: 30, weeklyHours: 8, trainingDays: 5 },
      },
      form: { sport: 'run', currentDist: 10000, currentTime: '50:00', targetDist: 10000, targetTime: '40:00', raceDate },
    }))
    localStorage.setItem('sporeus-eliteProgramStart', JSON.stringify(startStr))
    localStorage.setItem('sporeus-yearly-plan', JSON.stringify({
      weeks: Array.from({ length: 16 }, () => ({ targetTSS: tssPerWeek })),
      model: 'traditional',
    }))
    const log = []
    const tssPerEntry = Math.round((tssPerWeek * adherencePct) / 100)
    for (let w = 0; w < weeksBack; w++) {
      const d = new Date(`${startStr}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + w * 7 + 2)
      log.push({ date: d.toISOString().slice(0, 10), tss: tssPerEntry, type: 'run' })
    }
    return log
  }

  it('renders adherence section in in-progress lifecycle with reliable data', () => {
    const log = seedPlanModeInProgress({ adherencePct: 95 })
    renderCard({ log })
    const sec = document.querySelector('[data-adherence-section]')
    expect(sec).not.toBeNull()
    // Trajectory is one of the four valid values; precise classification
    // depends on per-week weeklyTSS which varies by phase split. We just
    // verify the section is wired and a trajectory enum is present.
    const traj = sec.getAttribute('data-trajectory')
    expect(['on-track', 'behind', 'ahead', 'critical']).toContain(traj)
  })

  it('does NOT render adherence section in draft state (no yearly plan applied)', () => {
    renderCard({ log: [] })
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-09-20' })
    expect(document.querySelector('[data-adherence-section]')).toBeNull()
  })

  it('does NOT render adherence section when log is empty (unreliable)', () => {
    localStorage.setItem('sporeus-yearly-plan', JSON.stringify({
      weeks: [{ targetTSS: 300 }, { targetTSS: 300 }],
      model: 'traditional',
    }))
    renderCard({ log: [] })
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-09-20' })
    expect(document.querySelector('[data-adherence-section]')).toBeNull()
  })

  it('shows critical trajectory when athlete is far behind', () => {
    const log = seedPlanModeInProgress({ adherencePct: 40 })
    renderCard({ log })
    const sec = document.querySelector('[data-adherence-section]')
    expect(sec).not.toBeNull()
    expect(sec.getAttribute('data-trajectory')).toBe('critical')
  })

  it('renders bilingual ADHERENCE header', () => {
    const log = seedPlanModeInProgress({ adherencePct: 95 })
    renderCard({ log }, 'tr')
    const sec = document.querySelector('[data-adherence-section]')
    expect(sec).not.toBeNull()
    expect(sec.textContent).toMatch(/UYGULAMA/)
    expect(sec.textContent).toMatch(/ADHERENCE/)
  })

  it('renders the adherence percent as a visible number', () => {
    const log = seedPlanModeInProgress({ adherencePct: 80 })
    renderCard({ log })
    const pct = document.querySelector('[data-adherence-pct]')
    expect(pct).not.toBeNull()
    expect(pct.textContent).toMatch(/\d+%/)
  })
})

describe('EliteProgramCard — v8.99.0 RE-PROJECT button', () => {
  function seedPlanModeBehind({ tssPerEntry = 170, raceDate = '2026-09-20' } = {}) {
    const startStr = (() => {
      const d = new Date('2026-05-07T00:00:00Z')
      d.setUTCDate(d.getUTCDate() - 4 * 7)
      return d.toISOString().slice(0, 10)
    })()
    localStorage.setItem('sporeus-eliteProgram', JSON.stringify({
      input: {
        sport: 'run',
        currentPR: { distanceM: 10000, timeSec: 50 * 60 },
        targetPR:  { distanceM: 10000, timeSec: 40 * 60 },
        raceDate,
        // Pin currentCTL low so program's weeklyTSS lands in a tight predictable
        // range (~210-285) that the test seed can hit precisely.
        profile: { currentCTL: 30, weeklyHours: 8, trainingDays: 5 },
      },
      form: { sport: 'run', currentDist: 10000, currentTime: '50:00', targetDist: 10000, targetTime: '40:00', raceDate },
    }))
    localStorage.setItem('sporeus-eliteProgramStart', JSON.stringify(startStr))
    localStorage.setItem('sporeus-yearly-plan', JSON.stringify({
      weeks: Array.from({ length: 16 }, () => ({ targetTSS: 300 })),
      model: 'traditional',
    }))
    const log = []
    for (let w = 0; w < 4; w++) {
      const d = new Date(`${startStr}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + w * 7 + 2)
      log.push({ date: d.toISOString().slice(0, 10), tss: tssPerEntry, type: 'run' })
    }
    return log
  }

  it('RE-PROJECT button does NOT render when adherence is unreliable (no log)', () => {
    // Pre-seed program but leave log empty → adherence.reliable=false →
    // reprojection=null → button hidden. This is the cleanest gating test
    // since trajectory classification depends on per-phase weeklyTSS values.
    seedPlanModeBehind()
    renderCard({ log: [] })
    expect(document.querySelector('[data-reproject-btn]')).toBeNull()
  })

  it('RE-PROJECT button renders in behind trajectory', () => {
    // Plan averages ~200/wk, actual 170/wk → ~85% adherence → behind.
    const log = seedPlanModeBehind({ tssPerEntry: 170 })
    renderCard({ log })
    const btn = document.querySelector('[data-reproject-btn]')
    expect(btn).not.toBeNull()
    expect(btn.getAttribute('data-reproject-strategy')).toBe('extend')
  })

  it('RE-PROJECT button bilingual copy in EN', () => {
    const log = seedPlanModeBehind()
    renderCard({ log })
    const btn = document.querySelector('[data-reproject-btn]')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toMatch(/RE-PROJECT/)
    expect(btn.textContent).toMatch(/YENİDEN HESAPLA/)
  })

  it('RE-PROJECT button has bilingual aria-label', () => {
    const log = seedPlanModeBehind()
    renderCard({ log })
    const btn = document.querySelector('[data-reproject-btn]')
    expect(btn?.getAttribute('aria-label')).toMatch(/Re-project/i)
  })

  it('RE-PROJECT click confirms and pre-fills form with adjusted race date', () => {
    const log = seedPlanModeBehind()
    renderCard({ log })
    const btn = document.querySelector('[data-reproject-btn]')
    expect(btn).not.toBeNull()
    fireEvent.click(btn)
    // ConfirmModal opens; click its "Pre-fill" confirm button
    fireEvent.click(screen.getByRole('button', { name: /^Pre-fill$/ }))
    expect(screen.getByLabelText(/Current PR time/i)).toBeInTheDocument()
    const dateInput = screen.getByLabelText(/Race date/i)
    expect(dateInput.value).toBe('2026-10-04')
  })

  it('RE-PROJECT click cancellation preserves the existing plan', () => {
    const log = seedPlanModeBehind()
    renderCard({ log })
    const btn = document.querySelector('[data-reproject-btn]')
    expect(btn).not.toBeNull()
    fireEvent.click(btn)
    // ConfirmModal opens; click its Cancel button
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }))
    expect(screen.queryByLabelText(/Current PR time/i)).toBeNull()
  })
})

// ─── v8.103.0 — action-bar horizontal scroll on mobile ───────────────────────
describe('EliteProgramCard — v8.103.0 mobile action-bar layout', () => {
  it('action bar uses nowrap + overflow scroll instead of wrapping', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const bar = document.querySelector('[data-action-bar]')
    expect(bar).not.toBeNull()
    const style = bar.getAttribute('style') || ''
    expect(style).toMatch(/flex-wrap:\s*nowrap/i)
    expect(style).toMatch(/overflow-x:\s*auto/i)
  })

  it('all 4 action buttons are siblings inside the action bar', () => {
    renderCard()
    fillFormAndSubmit({ curTime: '50:00', tgtTime: '40:00', raceDate: '2026-08-15' })
    const bar = document.querySelector('[data-action-bar]')
    expect(bar).not.toBeNull()
    const buttons = bar.querySelectorAll('button')
    expect(buttons.length).toBe(4)
  })
})

// ─── v9.19.0 — mobile MM:SS auto-format (numeric keyboard has no colon) ─────
import { autoFormatMmSs } from '../dashboard/EliteProgramCard.jsx'

describe('autoFormatMmSs — digit-driven MM:SS auto-formatting', () => {
  it('returns empty string for null/empty input', () => {
    expect(autoFormatMmSs('')).toBe('')
    expect(autoFormatMmSs(null)).toBe('')
    expect(autoFormatMmSs(undefined)).toBe('')
  })

  it('passes through 1-2 digit minutes without colon (still typing)', () => {
    expect(autoFormatMmSs('5')).toBe('5')
    expect(autoFormatMmSs('50')).toBe('50')
  })

  it('inserts colon after 3 digits (M:SS for sprint times)', () => {
    expect(autoFormatMmSs('500')).toBe('5:00')
    expect(autoFormatMmSs('547')).toBe('5:47')
  })

  it('inserts colon after 4 digits (MM:SS standard race time)', () => {
    expect(autoFormatMmSs('5000')).toBe('50:00')
    expect(autoFormatMmSs('4230')).toBe('42:30')
  })

  it('inserts both colons after 5 digits (H:MM:SS)', () => {
    expect(autoFormatMmSs('12345')).toBe('1:23:45')
    expect(autoFormatMmSs('30000')).toBe('3:00:00')
  })

  it('inserts both colons after 6 digits (HH:MM:SS marathon/ultra)', () => {
    expect(autoFormatMmSs('123456')).toBe('12:34:56')
    expect(autoFormatMmSs('030000')).toBe('03:00:00')
  })

  it('caps at 6 digits — 7th digit is dropped', () => {
    expect(autoFormatMmSs('1234567')).toBe('12:34:56')
  })

  it('strips non-digit input — pasting "50:00" works', () => {
    expect(autoFormatMmSs('50:00')).toBe('50:00')
    expect(autoFormatMmSs('1:23:45')).toBe('1:23:45')
    expect(autoFormatMmSs('50.00')).toBe('50:00') // mobile period instead of colon
    expect(autoFormatMmSs('50,00')).toBe('50:00') // mobile comma instead of colon
  })

  it('produces parseable MM:SS at 3+ digits', () => {
    // The downstream parser parseMmSs accepts these forms.
    const cases = ['500', '5000', '12345', '030000']
    for (const c of cases) {
      const formatted = autoFormatMmSs(c)
      // basic shape check: must contain colon and end with 2-digit seconds
      expect(formatted).toMatch(/^\d{1,2}(:\d{2}){1,2}$/)
    }
  })
})

// ── v9.26.0 — Form UX hardening: auto-save, inline date validation, disabled reason
describe('EliteProgramCard — form UX hardening (v9.26.0)', () => {
  it('shows specific disabled-reason text when current time is missing', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-09-01' } })
    expect(screen.getByText(/Enter current time as MM:SS/i)).toBeInTheDocument()
  })

  it('disabled-reason text updates as fields fill in', () => {
    renderCard()
    // Empty form: complains about current time first
    expect(screen.getByText(/Enter current time as MM:SS/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    // Now complains about target time
    expect(screen.getByText(/Enter target time/i)).toBeInTheDocument()
  })

  it('renders TR disabled-reason when lang=tr', () => {
    renderCard({}, 'tr')
    expect(screen.getByText(/Mevcut süreyi MM:SS olarak gir/i)).toBeInTheDocument()
  })

  it('inline alert appears immediately when past date is typed (no submit needed)', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2025-01-01' } })
    expect(screen.getByText(/Race date must be in the future/i)).toBeInTheDocument()
  })

  it('inline alert disappears when date is corrected', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2025-01-01' } })
    expect(screen.getByText(/Race date must be in the future/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-09-01' } })
    expect(screen.queryByText(/Race date must be in the future/i)).not.toBeInTheDocument()
  })

  it('date input has min attribute set to today (native browser block)', () => {
    renderCard()
    const dateInput = screen.getByLabelText(/Race date/i)
    expect(dateInput.getAttribute('min')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('auto-saves form state on field change (within 600ms debounce)', async () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Current PR time/i), { target: { value: '50:00' } })
    fireEvent.change(screen.getByLabelText(/Race date/i), { target: { value: '2026-09-01' } })
    // Wait for debounce + slop
    await new Promise(r => setTimeout(r, 800))
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    // Persistence shape varies by mode; the form key carries the latest field values.
    expect(saved.form?.currentTime).toBe('50:00')
    expect(saved.form?.raceDate).toBe('2026-09-01')
  })

  it('does NOT auto-save when no input has been entered (avoids stomping prior state)', async () => {
    // Pre-seed localStorage with previous form state
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      input: null,
      form: { sport: 'run', currentTime: '40:00', raceDate: '2026-08-15' },
    }))
    renderCard()
    // Wait through debounce window without entering anything
    await new Promise(r => setTimeout(r, 800))
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    // Pre-existing data preserved
    expect(saved.form.currentTime).toBe('40:00')
    expect(saved.form.raceDate).toBe('2026-08-15')
  })
})

// ── v9.46.0 — Mark Done button on Elite Program sample weeks ─────────────
describe('EliteProgramCard — Mark Done button on sample-week rows', () => {
  it('renders ✓ DONE button on non-rest sample-week sessions when setLog is wired', () => {
    const setLog = vi.fn()
    render(
      <LangCtx.Provider value={{ t: k => k, lang: 'en', setLang: () => {} }}>
        <EliteProgramCard log={[]} profile={{}} setLog={setLog} />
      </LangCtx.Provider>
    )
    fillFormAndSubmit({ sport: 'run', curTime: '50:00', tgtTime: '47:00', raceDate: '2026-08-15' })
    // Default-open phase is Base; expect at least one DONE button on a non-rest day
    const buttons = screen.getAllByRole('button', { name: /Mark this session done today/i })
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('does NOT render the button when setLog is missing (back-compat)', () => {
    render(
      <LangCtx.Provider value={{ t: k => k, lang: 'en', setLang: () => {} }}>
        <EliteProgramCard log={[]} profile={{}} />
      </LangCtx.Provider>
    )
    fillFormAndSubmit({ sport: 'run', curTime: '50:00', tgtTime: '47:00', raceDate: '2026-08-15' })
    const buttons = screen.queryAllByRole('button', { name: /Mark this session done today/i })
    expect(buttons.length).toBe(0)
  })

  it('clicking ✓ DONE calls setLog with a session entry carrying source=sporeus-plan + doneAt', () => {
    const setLog = vi.fn()
    render(
      <LangCtx.Provider value={{ t: k => k, lang: 'en', setLang: () => {} }}>
        <EliteProgramCard log={[]} profile={{}} setLog={setLog} />
      </LangCtx.Provider>
    )
    fillFormAndSubmit({ sport: 'run', curTime: '50:00', tgtTime: '47:00', raceDate: '2026-08-15' })
    const button = screen.getAllByRole('button', { name: /Mark this session done today/i })[0]
    fireEvent.click(button)
    expect(setLog).toHaveBeenCalledTimes(1)
    const [newLog] = setLog.mock.calls[0]
    expect(Array.isArray(newLog)).toBe(true)
    expect(newLog[0].source).toBe('sporeus-plan')
    expect(newLog[0].doneAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(newLog[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(newLog[0].sport).toBeTruthy()
  })

  it('shows "✓ done" chip instead of button when a sporeus-plan entry exists today', () => {
    const setLog = vi.fn()
    const today = new Date()
    const todayISO = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
    render(
      <LangCtx.Provider value={{ t: k => k, lang: 'en', setLang: () => {} }}>
        <EliteProgramCard
          log={[{ id: 1, date: todayISO, source: 'sporeus-plan', sport: 'run', type: 'easy', duration: 45 }]}
          profile={{}}
          setLog={setLog}
        />
      </LangCtx.Provider>
    )
    fillFormAndSubmit({ sport: 'run', curTime: '50:00', tgtTime: '47:00', raceDate: '2026-08-15' })
    // At least one row shows the done chip (matches at least one of the run sessions today)
    const doneChips = screen.getAllByText(/✓ done/i)
    expect(doneChips.length).toBeGreaterThan(0)
  })

  it('button aria-label is TR-translated when lang=tr (Bu seansı bugün tamamlandı işaretle)', () => {
    const setLog = vi.fn()
    // Pre-seed program persistence + lang as TR; bypass form (which is also bilingual)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      input: {
        sport: 'run',
        currentPR: { distanceM: 10000, timeSec: 3000 },
        targetPR: { distanceM: 10000, timeSec: 2820 },
        raceDate: '2026-08-15',
      },
    }))
    render(
      <LangCtx.Provider value={{ t: k => k, lang: 'tr', setLang: () => {} }}>
        <EliteProgramCard log={[]} profile={{}} setLog={setLog} />
      </LangCtx.Provider>
    )
    const trButtons = screen.queryAllByRole('button', { name: /Bu seansı bugün tamamlandı işaretle/i })
    expect(trButtons.length).toBeGreaterThan(0)
  })
})

// ── v9.182.0 — EP-9 cycle-phase UI surface ───────────────────────────────────
// Privacy contract: non-female / non-opted-in athletes must see ZERO cycle UI.
// The block reads `result.cycleGate` which is populated by buildEliteProgram
// when isCycleGateAvailable(profile) is true. We render the card end-to-end
// (form submit → buildEliteProgram → CyclePhaseBlock) with different profiles
// to verify the privacy gate.
describe('EliteProgramCard — EP-9 cycle phase block (privacy + render)', () => {
  function presetProgram() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      input: {
        sport: 'run',
        currentPR: { distanceM: 10000, timeSec: 3000 },
        targetPR: { distanceM: 10000, timeSec: 2820 },
        raceDate: '2026-08-15',
      },
    }))
  }

  it('renders nothing cycle-related for male profile (privacy)', () => {
    presetProgram()
    renderCard({ profile: { gender: 'male', lastPeriodStart: '2026-05-01', cycleLength: '28' } })
    expect(screen.queryByRole('region', { name: /Cycle phase guidance/i })).toBeNull()
    expect(screen.queryByText(/THIS WEEK/i)).toBeNull()
  })

  it('renders nothing for female who has not entered lastPeriodStart (not opted in)', () => {
    presetProgram()
    renderCard({ profile: { gender: 'female' } })
    expect(screen.queryByRole('region', { name: /Cycle phase guidance/i })).toBeNull()
  })

  it('renders the cycle-phase region when female + lastPeriodStart set', () => {
    presetProgram()
    renderCard({ profile: { gender: 'female', lastPeriodStart: '2026-04-15', cycleLength: '28' } })
    const region = screen.getByRole('region', { name: /Cycle phase guidance/i })
    expect(region).toBeInTheDocument()
    // McNulty citation should appear inside
    expect(region.textContent).toMatch(/McNulty/)
    // Privacy reminder should appear inside (EN: "opt-in and visible only to you")
    expect(region.textContent).toMatch(/opt-in and visible only to you/i)
  })

  it('renders Turkish labels + privacy reminder when lang=tr', () => {
    presetProgram()
    const value = { t: k => k, lang: 'tr', setLang: () => {} }
    render(
      <LangCtx.Provider value={value}>
        <EliteProgramCard
          log={[]}
          profile={{ gender: 'female', lastPeriodStart: '2026-04-15', cycleLength: '28' }}
        />
      </LangCtx.Provider>
    )
    const region = screen.getByRole('region', { name: /Döngü fazı önerisi/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/yalnızca sana görünür/i)
  })
})

// ── v9.183.0 — EP-12 race-strategy UI surface ────────────────────────────────
// Renders only when a program exists (sport derived from program.sport).
// Pre-selection: shows the picker with "select" placeholder + helper text.
// Post-selection: shows pacing/opener/closer/fueling/gear lines + citation.
// Selection persists to localStorage keyed by sport.
describe('EliteProgramCard — EP-12 race strategy block (picker + render)', () => {
  function presetProgram() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      input: {
        sport: 'run',
        currentPR: { distanceM: 10000, timeSec: 3000 },
        targetPR: { distanceM: 10000, timeSec: 2820 },
        raceDate: '2026-08-15',
      },
    }))
  }

  it('renders the strategy region + race-format picker when a program exists', () => {
    presetProgram()
    renderCard()
    const region = screen.getByRole('region', { name: /Race strategy/i })
    expect(region).toBeInTheDocument()
    expect(screen.getByLabelText(/Select race format/i)).toBeInTheDocument()
    // Pre-selection: the helper text appears, output does not
    expect(region.textContent).toMatch(/Select a race format/i)
    expect(document.querySelector('[data-race-strategy-output]')).toBeNull()
  })

  it('shows pacing / opener / closer / fueling / gear when a race format is selected', () => {
    presetProgram()
    renderCard()
    const picker = screen.getByLabelText(/Select race format/i)
    fireEvent.change(picker, { target: { value: 'road' } })
    const output = document.querySelector('[data-race-strategy-output]')
    expect(output).not.toBeNull()
    expect(output.textContent).toMatch(/Pacing:/)
    expect(output.textContent).toMatch(/Opener:/)
    expect(output.textContent).toMatch(/Closer:/)
    expect(output.textContent).toMatch(/Fueling:/)
    expect(output.textContent).toMatch(/Gear:/)
    expect(output.textContent).toMatch(/Foster 1999/)
  })

  it('persists the race-format selection to localStorage keyed by sport', () => {
    presetProgram()
    renderCard()
    const picker = screen.getByLabelText(/Select race format/i)
    fireEvent.change(picker, { target: { value: 'trail' } })
    const stored = JSON.parse(localStorage.getItem('sporeus-eliteProgram-raceStrategy') || '{}')
    expect(stored.run).toBe('trail')
  })

  it('renders Turkish labels + Turkish strategy text when lang=tr', () => {
    presetProgram()
    const value = { t: k => k, lang: 'tr', setLang: () => {} }
    render(
      <LangCtx.Provider value={value}>
        <EliteProgramCard log={[]} profile={{}} />
      </LangCtx.Provider>
    )
    const region = screen.getByRole('region', { name: /Yarış stratejisi/i })
    expect(region).toBeInTheDocument()
    const picker = screen.getByLabelText(/Yarış formatı seç/i)
    fireEvent.change(picker, { target: { value: 'road' } })
    const output = document.querySelector('[data-race-strategy-output]')
    expect(output.textContent).toMatch(/Tempolama:/)
    expect(output.textContent).toMatch(/Açılış:/)
  })

  // v9.191.0 — race-day conditions ported to in-program block
  it('conditions section collapsed by default in the in-program block', () => {
    presetProgram()
    renderCard()
    expect(screen.queryByLabelText(/TEMP \(°C\)/i)).toBeNull()
  })

  it('conditions expand reveals 3 inputs and high temp fires Maughan warning', () => {
    presetProgram()
    renderCard()
    fireEvent.change(screen.getByLabelText(/Select race format/i), { target: { value: 'road' } })
    // Race-day conditions button — there are 2 on screen if RaceStrategyCard
    // is also mounted via Dashboard, but here renderCard only mounts the
    // EliteProgramCard so there's just one.
    fireEvent.click(screen.getByRole('button', { name: /Race-day conditions/i }))
    fireEvent.change(screen.getByLabelText(/TEMP \(°C\)/i), { target: { value: '32' } })
    const output = document.querySelector('[data-race-strategy-output]')
    expect(output.textContent).toMatch(/Race-day temperature 32°C/i)
    expect(output.textContent).toMatch(/Maughan 2010/i)
  })

  it('uses the same conditions localStorage key as the standalone card (cross-surface)', () => {
    // Pre-seed conditions storage as if the standalone card wrote them
    localStorage.setItem('sporeus-raceConditions', JSON.stringify({
      expanded: true, tempC: '30', windKph: '', altitudeM: '',
    }))
    presetProgram()
    renderCard()
    fireEvent.change(screen.getByLabelText(/Select race format/i), { target: { value: 'road' } })
    // Without expanding/touching the conditions UI, the warning should
    // already fire because the storage was pre-seeded.
    const output = document.querySelector('[data-race-strategy-output]')
    expect(output.textContent).toMatch(/Race-day temperature 30°C/i)
  })
})
