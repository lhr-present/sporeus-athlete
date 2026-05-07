// @vitest-environment jsdom
// ─── MissionHeadline.test.jsx — render tests for v8.102.0 mission #1 surface
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import MissionHeadline from '../dashboard/MissionHeadline.jsx'

const STORAGE_KEY = 'sporeus-eliteProgram'

beforeEach(() => {
  localStorage.clear()
  // jsdom does not implement scrollIntoView; provide a vi.fn() so click handler is safe.
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderH(lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <MissionHeadline />
    </LangCtx.Provider>
  )
}

describe('MissionHeadline — no-plan state', () => {
  it('renders headline + CTA when localStorage has no elite program', () => {
    renderH()
    expect(screen.getByRole('region', { name: /Mission/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /GET STARTED/i })).toBeInTheDocument()
  })

  it('shows EN headline copy "BUILD YOUR YEARLY PROGRAM"', () => {
    renderH('en')
    expect(screen.getByText(/BUILD YOUR YEARLY PROGRAM/)).toBeInTheDocument()
  })

  it('shows TR headline copy "YILLIK PROGRAMINI OLUŞTUR" when lang=tr', () => {
    renderH('tr')
    expect(screen.getByText(/YILLIK PROGRAMINI OLUŞTUR/)).toBeInTheDocument()
  })

  it('renders the 3-line bilingual science pitch (all 6 strings)', () => {
    renderH()
    expect(screen.getByText(/4 inputs → full scientific yearly program/)).toBeInTheDocument()
    expect(screen.getByText(/4 girdi → tam bilimsel yıllık program/)).toBeInTheDocument()
    expect(screen.getByText(/VDOT\/FTP\/CSS-level paces and zones/)).toBeInTheDocument()
    expect(screen.getByText(/VDOT\/FTP\/CSS seviyesinde tempo ve bölgeler/)).toBeInTheDocument()
    expect(screen.getByText(/Daily prescription · adherence · race autopsy/)).toBeInTheDocument()
    expect(screen.getByText(/Günlük reçete · uygulama · yarış otopsisi/)).toBeInTheDocument()
  })

  it('GET STARTED button has bilingual aria-label', () => {
    renderH('en')
    const btn = screen.getByRole('button', { name: /GET STARTED/i })
    const label = btn.getAttribute('aria-label') || ''
    expect(label).toMatch(/GET STARTED/)
    expect(label).toMatch(/BAŞLA/)
  })

  it('GET STARTED click does not crash (scrollIntoView mocked)', () => {
    renderH()
    const btn = screen.getByRole('button', { name: /GET STARTED/i })
    expect(() => fireEvent.click(btn)).not.toThrow()
    expect(Element.prototype.scrollIntoView).toBeDefined()
  })

  it('region has role="region" with bilingual aria-label "Mission · Görev"', () => {
    renderH()
    const region = screen.getByRole('region', { name: /Mission/i })
    expect(region).toHaveAttribute('aria-label', expect.stringMatching(/Mission/))
    expect(region.getAttribute('aria-label')).toMatch(/Görev/)
  })

  it('renders citation footer with Daniels, Bompa, Mujika', () => {
    renderH()
    const region = screen.getByRole('region', { name: /Mission/i })
    expect(region.textContent).toMatch(/Daniels/)
    expect(region.textContent).toMatch(/Bompa/)
    expect(region.textContent).toMatch(/Mujika/)
  })
})

describe('MissionHeadline — has-plan state', () => {
  it('returns null when localStorage has elite program with input field set', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      input: { sport: 'run', curSec: 3000, tgtSec: 2400, raceDate: '2026-08-15' },
      form: {},
    }))
    renderH()
    expect(screen.queryByText(/BUILD YOUR YEARLY/)).toBeNull()
    expect(screen.queryByRole('region', { name: /Mission/i })).toBeNull()
  })

  it('still renders when persisted has form but null input (not yet generated)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      input: null,
      form: { sport: 'run', curTime: '50:00' },
    }))
    renderH()
    // input is null → defensive: only `input` field signals "plan generated"
    expect(screen.queryByText(/BUILD YOUR YEARLY/)).toBeInTheDocument()
  })
})
