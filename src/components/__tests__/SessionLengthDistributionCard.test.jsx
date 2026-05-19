// @vitest-environment jsdom
// ─── SessionLengthDistributionCard.test.jsx — render coverage ───────────────
//
// Covers: INSUFFICIENT renders interpretation message, each band renders,
// mode-highlight rendered, EN + TR, citation, accessibility.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SessionLengthDistributionCard from '../dashboard/SessionLengthDistributionCard.jsx'

const TODAY = '2026-05-18'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function daysAgo(n) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <SessionLengthDistributionCard log={log} />
    </LangCtx.Provider>
  )
}

function buildLog(durations) {
  return durations.map((d, i) => ({ date: daysAgo(i), durationMin: d, type: 'Easy' }))
}

describe('SessionLengthDistributionCard — INSUFFICIENT_DATA', () => {
  it('renders the INSUFFICIENT_DATA strip with bilingual hint (EN)', () => {
    renderCard([])
    const card = document.querySelector('[data-card="session-length-distribution"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    expect(card.textContent).toMatch(/NOT ENOUGH DATA/)
    expect(card.textContent).toMatch(/Log at least 15 sessions/i)
    expect(card.textContent).toMatch(/Issurin 2010/)
    expect(card.textContent).toMatch(/Bompa 2018/)
  })

  it('renders the INSUFFICIENT_DATA strip with Turkish hint', () => {
    renderCard([], 'tr')
    const card = document.querySelector('[data-card="session-length-distribution"]')
    expect(card).not.toBeNull()
    expect(card.textContent).toMatch(/YETERSİZ VERİ/)
    expect(card.textContent).toMatch(/en az 15 seans/i)
  })

  it('hides the median/IQR stats row when totalSessions=0', () => {
    renderCard([])
    const stats = document.querySelector('[data-stats]')
    expect(stats).toBeNull()
  })
})

describe('SessionLengthDistributionCard — band rendering', () => {
  it('renders NARROW_SHORT band (orange) when ≥80% of sessions are <45 min', () => {
    const durations = [
      ...Array(10).fill(25),
      ...Array(6).fill(35),
      ...Array(4).fill(65),
    ]
    renderCard(buildLog(durations))
    const card = document.querySelector('[data-card="session-length-distribution"]')
    expect(card.getAttribute('data-band')).toBe('NARROW_SHORT')
    expect(card.textContent).toMatch(/NARROW · SHORT/)
    expect(card.textContent).toMatch(/under 45 min/i)
    // Orange stripe.
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
  })

  it('renders NARROW_LONG band (orange) when ≥60% of sessions are ≥90 min', () => {
    const durations = [
      ...Array(8).fill(95),
      ...Array(4).fill(130),
      ...Array(8).fill(60),
    ]
    renderCard(buildLog(durations))
    const card = document.querySelector('[data-card="session-length-distribution"]')
    expect(card.getAttribute('data-band')).toBe('NARROW_LONG')
    expect(card.textContent).toMatch(/NARROW · LONG/)
    expect(card.textContent).toMatch(/90 min\+/i)
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
  })

  it('renders WIDE_RANGE band (green) when 5+ bins populated', () => {
    const durations = [
      25, 25, 25,
      35, 35,
      50, 50, 50,
      75, 75, 75, 75,
      100, 100, 100,
    ]
    renderCard(buildLog(durations))
    const card = document.querySelector('[data-card="session-length-distribution"]')
    expect(card.getAttribute('data-band')).toBe('WIDE_RANGE')
    expect(card.textContent).toMatch(/WIDE RANGE/)
    expect(card.textContent).toMatch(/Healthy duration variety/i)
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
  })

  it('renders BALANCED band (blue) when 3-4 bins populated and not skewed', () => {
    const durations = [
      ...Array(4).fill(50),
      ...Array(8).fill(75),
      ...Array(4).fill(100),
      ...Array(4).fill(130),
    ]
    renderCard(buildLog(durations))
    const card = document.querySelector('[data-card="session-length-distribution"]')
    expect(card.getAttribute('data-band')).toBe('BALANCED')
    expect(card.textContent).toMatch(/BALANCED/)
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
  })
})

describe('SessionLengthDistributionCard — mode highlight & stats', () => {
  it('highlights the modal bin row with orange', () => {
    // Heaviest bin = 60-89 with 10 sessions.
    const durations = [
      ...Array(10).fill(70),
      ...Array(3).fill(100),
      ...Array(2).fill(40),
    ]
    renderCard(buildLog(durations))
    const card = document.querySelector('[data-card="session-length-distribution"]')
    expect(card.getAttribute('data-mode-bin')).toBe('s60to89')
    const modeRow = card.querySelector('[data-bin="s60to89"]')
    expect(modeRow).not.toBeNull()
    expect(modeRow.getAttribute('data-mode')).toBe('true')
    const otherRow = card.querySelector('[data-bin="s90to119"]')
    expect(otherRow.getAttribute('data-mode')).toBe('false')
  })

  it('renders median + IQR stats with bilingual labels (EN)', () => {
    // Sorted: 25,25,25,30,30,30,60,60,60,60,60,75,75,75,75
    // median ≈ 60.
    const durations = [
      25, 25, 25, 30, 30, 30, 60, 60, 60, 60, 60, 75, 75, 75, 75,
    ]
    renderCard(buildLog(durations))
    const stats = document.querySelector('[data-stats]')
    expect(stats).not.toBeNull()
    expect(stats.textContent).toMatch(/median/i)
    expect(stats.textContent).toMatch(/IQR/)
    expect(stats.textContent).toMatch(/min/)
  })

  it('renders median + IQR stats with Turkish labels', () => {
    const durations = Array(15).fill(60)
    renderCard(buildLog(durations), 'tr')
    const stats = document.querySelector('[data-stats]')
    expect(stats).not.toBeNull()
    expect(stats.textContent).toMatch(/medyan/i)
    expect(stats.textContent).toMatch(/IQR/)
  })

  it('exposes total-sessions count anchor', () => {
    const durations = Array(20).fill(60)
    renderCard(buildLog(durations))
    const card = document.querySelector('[data-card="session-length-distribution"]')
    expect(card.getAttribute('data-total-sessions')).toBe('20')
    const total = card.querySelector('[data-total]')
    expect(total).not.toBeNull()
    expect(total.textContent).toMatch(/20 sessions/i)
  })

  it('renders all 7 histogram bins with labels and count anchors', () => {
    const durations = [
      ...Array(5).fill(25),
      ...Array(5).fill(35),
      ...Array(5).fill(75),
    ]
    renderCard(buildLog(durations))
    const card = document.querySelector('[data-card="session-length-distribution"]')
    const bins = card.querySelectorAll('[data-bin]')
    expect(bins.length).toBe(7)
    const sub30 = card.querySelector('[data-bin="sub30"]')
    expect(sub30.getAttribute('data-bin-count')).toBe('5')
    const s30 = card.querySelector('[data-bin="s30to44"]')
    expect(s30.getAttribute('data-bin-count')).toBe('5')
    const s60 = card.querySelector('[data-bin="s60to89"]')
    expect(s60.getAttribute('data-bin-count')).toBe('5')
    const sup180 = card.querySelector('[data-bin="sup180"]')
    expect(sup180.getAttribute('data-bin-count')).toBe('0')
  })
})

describe('SessionLengthDistributionCard — accessibility', () => {
  it('has role=region with bilingual aria-label (EN)', () => {
    renderCard([])
    const region = screen.getByRole('region', { name: /Session length distribution/i })
    expect(region).toBeInTheDocument()
  })

  it('has role=region with bilingual aria-label (TR)', () => {
    renderCard([], 'tr')
    const region = screen.getByRole('region', { name: /Antrenman süreleri dağılımı/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes the histogram as a role=list with per-row role=listitem', () => {
    const durations = Array(15).fill(60)
    renderCard(buildLog(durations))
    const list = screen.getByRole('list', { name: /Duration bins/i })
    expect(list).toBeInTheDocument()
    const items = list.querySelectorAll('[role="listitem"]')
    expect(items.length).toBe(7)
  })

  it('renders the citation in the footer', () => {
    renderCard([])
    const citation = document.querySelector('[data-citation]')
    expect(citation).not.toBeNull()
    expect(citation.textContent).toMatch(/Issurin 2010; Bompa 2018/)
  })

  it('renders bilingual band-coloured hint strip with aria-live="polite"', () => {
    renderCard([])
    const hint = document.querySelector('[data-hint]')
    expect(hint).not.toBeNull()
    expect(hint.getAttribute('aria-live')).toBe('polite')
  })
})
