// @vitest-environment jsdom
// ─── PostHardSessionResponseCard.test.jsx — Dashboard surface tests ──────────
//
// Covers: empty/null inputs → null, each band (STRONG / NORMAL / WEAK),
// the data anchors (data-post-hard-response-card, data-response-band,
// data-pair-count, data-sleep-delta, data-rhr-delta, data-hrv-delta),
// and bilingual heading.
//
// System clock is frozen so the analyzer's window math is deterministic.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import PostHardSessionResponseCard from '../dashboard/PostHardSessionResponseCard.jsx'

const TODAY = '2026-05-18'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function daysAgo(n) {
  const d = new Date(`${TODAY}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function session(d, rpe = 8) {
  return { date: daysAgo(d), rpe, tss: 80, type: 'Threshold' }
}

function recovery(d, sleepHrs, restingHR, hrv) {
  return { date: daysAgo(d), sleepHrs, restingHR, hrv }
}

function renderCard(log, recovery, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <PostHardSessionResponseCard log={log} recovery={recovery} />
    </LangCtx.Provider>
  )
}

describe('PostHardSessionResponseCard — guards', () => {
  it('renders nothing when log + recovery are empty', () => {
    const { container } = renderCard([], [])
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 3 pairs', () => {
    const log = [session(5), session(7)]
    const rec = [
      recovery(4, 7.5, 52, 60),
      recovery(6, 7.2, 53, 59),
    ]
    const { container } = renderCard(log, rec)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for null inputs', () => {
    const { container } = renderCard(null, null)
    expect(container.firstChild).toBeNull()
  })
})

describe('PostHardSessionResponseCard — STRONG band', () => {
  it('renders STRONG band with green color and proper anchors', () => {
    const log = [session(10), session(14), session(18)]
    const rec = [
      // baseline
      recovery(2, 7.0, 55, 60),
      recovery(4, 7.0, 55, 60),
      recovery(6, 7.0, 55, 60),
      recovery(8, 7.0, 55, 60),
      recovery(12, 7.0, 55, 60),
      recovery(16, 7.0, 55, 60),
      // post-hard
      recovery(9, 7.6, 52, 68),
      recovery(13, 7.5, 53, 67),
      recovery(17, 7.7, 52, 69),
    ]
    renderCard(log, rec)
    const card = document.querySelector('[data-post-hard-response-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-response-band')).toBe('STRONG')
    expect(card.getAttribute('data-pair-count')).toBe('3')
    expect(card.getAttribute('data-sleep-delta')).toBeTruthy()
    expect(card.getAttribute('data-rhr-delta')).toBeTruthy()
    expect(card.getAttribute('data-hrv-delta')).toBeTruthy()

    const region = screen.getByRole('region', {
      name: /Post-hard session recovery response/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/POST-HARD RESPONSE · 28D/)
    expect(region.textContent).toMatch(/STRONG/)
    expect(region.textContent).toMatch(/Plews 2013/)
    expect(region.textContent).toMatch(/Buchheit 2014/)
    // Hint
    expect(region.textContent).toMatch(/bounces back/i)
  })
})

describe('PostHardSessionResponseCard — NORMAL band', () => {
  it('renders NORMAL band when markers near baseline', () => {
    const log = [session(10), session(14), session(18)]
    const rec = [
      recovery(2, 7.0, 55, 60),
      recovery(4, 7.0, 55, 60),
      recovery(6, 7.0, 55, 60),
      recovery(8, 7.0, 55, 60),
      recovery(9, 7.0, 55, 60),
      recovery(13, 7.1, 55, 61),
      recovery(17, 6.9, 56, 59),
    ]
    renderCard(log, rec)
    const card = document.querySelector('[data-post-hard-response-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-response-band')).toBe('NORMAL')
    expect(card.textContent).toMatch(/typical adaptation/i)
  })
})

describe('PostHardSessionResponseCard — WEAK band', () => {
  it('renders WEAK band when RHR is elevated post-hard', () => {
    const log = [session(10), session(14), session(18)]
    const rec = [
      recovery(2, 7.0, 55, 60),
      recovery(4, 7.0, 55, 60),
      recovery(6, 7.0, 55, 60),
      recovery(8, 7.0, 55, 60),
      recovery(9, 6.8, 60, 50),
      recovery(13, 6.5, 61, 48),
      recovery(17, 6.7, 59, 49),
    ]
    renderCard(log, rec)
    const card = document.querySelector('[data-post-hard-response-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-response-band')).toBe('WEAK')
    expect(card.textContent).toMatch(/rest day|reduce intensity/i)
  })
})

describe('PostHardSessionResponseCard — bilingual', () => {
  it('renders the Turkish heading when lang=tr', () => {
    const log = [session(10), session(14), session(18)]
    const rec = [
      recovery(2, 7.0, 55, 60),
      recovery(4, 7.0, 55, 60),
      recovery(6, 7.0, 55, 60),
      recovery(8, 7.0, 55, 60),
      recovery(9, 6.8, 60, 50),
      recovery(13, 6.5, 61, 48),
      recovery(17, 6.7, 59, 49),
    ]
    renderCard(log, rec, 'tr')
    const region = screen.getByRole('region', {
      name: /Sert seans sonrası toparlanma yanıtı/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/SERT SONRASI YANIT · 28G/)
    // WEAK → Turkish band label "ZAYIF"
    expect(region.textContent).toMatch(/ZAYIF/)
    // Turkish interpretation hint for WEAK band
    expect(region.textContent).toMatch(/dinlenme günü/i)
  })
})
