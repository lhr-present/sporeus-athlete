// @vitest-environment jsdom
// ─── WeekendVolumeShareCard.test.jsx — render tests for the weekend-warrior UI
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WeekendVolumeShareCard from '../dashboard/WeekendVolumeShareCard.jsx'

// 2026-05-17 is a Sunday. 4-week window = Mon 2026-04-20 → Sun 2026-05-17.
const TODAY_ISO = '2026-05-17'
const WEEKS = ['2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11']

function entry(weekIdx, dayOffset, durationMin) {
  const base = new Date(WEEKS[weekIdx] + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() + dayOffset)
  const date = base.toISOString().slice(0, 10)
  return { date, duration: durationMin, type: 'run' }
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <WeekendVolumeShareCard log={log} />
    </LangCtx.Provider>
  )
}

beforeEach(() => {
  // Today is 2026-05-17 (Sunday) for all tests
  vi.setSystemTime(new Date(TODAY_ISO + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

describe('WeekendVolumeShareCard — null render cases', () => {
  it('(a) renders nothing for empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-weekend-volume-share-card]')).toBeNull()
  })

  it('(b) renders nothing for BALANCED distribution', () => {
    // 60 Mon + 60 Wed + 60 Fri (weekday 180), 60 Sun (weekend 60) per week
    // share = 60 / 240 = 25% → BALANCED → card returns null
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(entry(w, 0, 60)) // Mon
      log.push(entry(w, 2, 60)) // Wed
      log.push(entry(w, 4, 60)) // Fri
      log.push(entry(w, 6, 60)) // Sun
    }
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-weekend-volume-share-card]')).toBeNull()
  })

  it('renders nothing when fewer than 3 sessions/week', () => {
    const log = [
      entry(0, 0, 60), entry(0, 5, 60),
      entry(1, 0, 60), entry(1, 5, 60),
      entry(2, 0, 60), entry(2, 5, 60),
      entry(3, 0, 60), entry(3, 5, 60),
    ]
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })
})

describe('WeekendVolumeShareCard — SEVERE pattern', () => {
  function buildSevereLog() {
    // 10 Mon + 10 Wed + 10 Fri (weekday 30), 60 Sat + 60 Sun (weekend 120)
    // share = 120 / 150 = 80% → SEVERE
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(entry(w, 0, 10))
      log.push(entry(w, 2, 10))
      log.push(entry(w, 4, 10))
      log.push(entry(w, 5, 60))
      log.push(entry(w, 6, 60))
    }
    return log
  }

  it('(c) renders SEVERE warning with red color', () => {
    renderCard(buildSevereLog())
    const card = document.querySelector('[data-weekend-volume-share-card]')
    expect(card).not.toBeNull()
    // Red is #e03030 — border-left uses it. We just verify the band attr is SEVERE.
    expect(card.getAttribute('data-share-band')).toBe('SEVERE')
    // The big sharePct number should render (80%).
    expect(card.textContent).toMatch(/80/)
    // The English band label.
    expect(card.textContent).toMatch(/SEVERE/)
    // Recommendation text.
    expect(card.textContent).toMatch(/Move 1-2 sessions to mid-week/i)
    // Citation.
    expect(card.textContent).toMatch(/Soligard 2016/)
    expect(card.textContent).toMatch(/Lambert 1997/)
  })

  it('(d) data-share-band matches the computed band exactly', () => {
    renderCard(buildSevereLog())
    const card = document.querySelector('[data-weekend-volume-share-card]')
    expect(card.getAttribute('data-share-band')).toBe('SEVERE')
  })

  it('renders heading "WEEKEND SHARE · 4W" in English', () => {
    renderCard(buildSevereLog())
    const card = document.querySelector('[data-weekend-volume-share-card]')
    expect(card.textContent).toMatch(/WEEKEND SHARE · 4W/)
  })

  it('exposes role=region with accessible label', () => {
    renderCard(buildSevereLog())
    const region = screen.getByRole('region', { name: /Weekend volume share card/i })
    expect(region).toBeInTheDocument()
  })
})

describe('WeekendVolumeShareCard — WEEKEND_WARRIOR pattern', () => {
  it('renders WEEKEND_WARRIOR band with orange treatment', () => {
    // 20 Mon + 20 Wed + 20 Fri (weekday 60), 45 Sat + 45 Sun (weekend 90)
    // share = 90 / 150 = 60% → WEEKEND_WARRIOR
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(entry(w, 0, 20))
      log.push(entry(w, 2, 20))
      log.push(entry(w, 4, 20))
      log.push(entry(w, 5, 45))
      log.push(entry(w, 6, 45))
    }
    renderCard(log)
    const card = document.querySelector('[data-weekend-volume-share-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-share-band')).toBe('WEEKEND_WARRIOR')
    expect(card.textContent).toMatch(/WEEKEND WARRIOR/)
    expect(card.textContent).toMatch(/60/)
  })
})

describe('WeekendVolumeShareCard — Turkish locale', () => {
  it('(e) renders Turkish heading "HAFTASONU PAYI · 4H" when lang=tr', () => {
    // SEVERE-band log so the card actually renders
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(entry(w, 0, 10))
      log.push(entry(w, 2, 10))
      log.push(entry(w, 4, 10))
      log.push(entry(w, 5, 60))
      log.push(entry(w, 6, 60))
    }
    renderCard(log, 'tr')
    const card = document.querySelector('[data-weekend-volume-share-card]')
    expect(card).not.toBeNull()
    expect(card.textContent).toMatch(/HAFTASONU PAYI · 4H/)
    // Turkish band label for SEVERE
    expect(card.textContent).toMatch(/AĞIR/)
    // Turkish recommendation snippet
    expect(card.textContent).toMatch(/hafta ortasına taşı/)
  })
})
