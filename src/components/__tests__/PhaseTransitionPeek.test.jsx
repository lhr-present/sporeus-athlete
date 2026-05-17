// @vitest-environment jsdom
// ─── PhaseTransitionPeek.test.jsx — render tests for the TodayView peek ────
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import PhaseTransitionPeek from '../today/PhaseTransitionPeek.jsx'

const DISMISS_KEY = 'sporeus-phaseTransitionDismissed'

beforeEach(() => {
  try { window.localStorage.clear() } catch { /* ignore */ }
})

afterEach(() => {
  cleanup()
  try { window.localStorage.clear() } catch { /* ignore */ }
})

function renderPeek({ multiPeakSeason, today = '2026-05-17', lang = 'en' } = {}) {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <PhaseTransitionPeek multiPeakSeason={multiPeakSeason} today={today} />
    </LangCtx.Provider>
  )
}

describe('PhaseTransitionPeek', () => {
  it('(a) renders nothing when multiPeakSeason is null', () => {
    const { container } = renderPeek({ multiPeakSeason: null })
    expect(container.firstChild).toBeNull()
  })

  it('(b) renders nothing when there is no phase transition (same phase)', () => {
    const { container } = renderPeek({
      multiPeakSeason: {
        weeks: [{ phase: 'Base' }],
        previousWeek: { phase: 'Base' },
      },
    })
    expect(container.firstChild).toBeNull()
  })

  it('(c) renders the EN banner for Base→Build', () => {
    renderPeek({
      multiPeakSeason: {
        weeks: [{ phase: 'Build' }],
        previousWeek: { phase: 'Base' },
      },
    })
    expect(screen.getByText('PHASE TRANSITION')).toBeInTheDocument()
    expect(screen.getByText('+15%')).toBeInTheDocument()
    expect(
      screen.getByText(/expect \+15% TSS, more intensity/i)
    ).toBeInTheDocument()
  })

  it('(d) exposes data-from-phase and data-to-phase matching the transition', () => {
    const { container } = renderPeek({
      multiPeakSeason: {
        weeks: [{ phase: 'Taper' }],
        previousWeek: { phase: 'Peak' },
      },
    })
    const node = container.querySelector('[data-phase-transition-peek]')
    expect(node).not.toBeNull()
    expect(node.getAttribute('data-from-phase')).toBe('Peak')
    expect(node.getAttribute('data-to-phase')).toBe('Taper')
    expect(screen.getByText('-30%')).toBeInTheDocument()
  })

  it('(e) DISMISS click hides the banner', () => {
    const { container } = renderPeek({
      multiPeakSeason: {
        weeks: [{ phase: 'Build' }],
        previousWeek: { phase: 'Base' },
      },
    })
    expect(container.querySelector('[data-phase-transition-peek]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(container.querySelector('[data-phase-transition-peek]')).toBeNull()
    // localStorage now holds the dismissed pair
    expect(JSON.parse(window.localStorage.getItem(DISMISS_KEY))).toBe('Base→Build')
  })

  it('(f) stays hidden on re-render when the dismissed pair is the active pair', () => {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify('Base→Build'))
    const { container } = renderPeek({
      multiPeakSeason: {
        weeks: [{ phase: 'Build' }],
        previousWeek: { phase: 'Base' },
      },
    })
    expect(container.firstChild).toBeNull()
  })

  it('(g) re-appears for a DIFFERENT transition even if a previous pair was dismissed', () => {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify('Base→Build'))
    const { container } = renderPeek({
      multiPeakSeason: {
        weeks: [{ phase: 'Peak' }],
        previousWeek: { phase: 'Build' },
      },
    })
    const node = container.querySelector('[data-phase-transition-peek]')
    expect(node).not.toBeNull()
    expect(node.getAttribute('data-from-phase')).toBe('Build')
    expect(node.getAttribute('data-to-phase')).toBe('Peak')
  })

  it('(h) renders the Turkish "FAZ GEÇİŞİ" prefix when lang="tr"', () => {
    renderPeek({
      multiPeakSeason: {
        weeks: [{ phase: 'Build' }],
        previousWeek: { phase: 'Base' },
      },
      lang: 'tr',
    })
    expect(screen.getByText('FAZ GEÇİŞİ')).toBeInTheDocument()
    expect(screen.queryByText('PHASE TRANSITION')).toBeNull()
    // Turkish phase labels show up
    expect(screen.getByText(/Yapılanma/)).toBeInTheDocument()
    expect(screen.getByText(/İnşa/)).toBeInTheDocument()
  })
})
