// @vitest-environment jsdom
// ─── VeryEasyShareCard.test.jsx — Dashboard surface tests ────────────────────
//
// Covers: null gate, INSUFFICIENT_DATA / INSUFFICIENT_BASE / BUILDING_BASE /
// STRONG_BASE / EXCESSIVE_EASY band rendering, bilingual (EN + TR), citation
// footer, accessibility (role=region + aria-label), stacked bar segments,
// and the data-hygiene unrated note.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import VeryEasyShareCard from '../dashboard/VeryEasyShareCard.jsx'

const TODAY = '2026-05-13'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <VeryEasyShareCard log={log} />
    </LangCtx.Provider>
  )
}

function entryOn({ daysAgo, dur, rpe }) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - daysAgo)
  const out = {
    date: d.toISOString().slice(0, 10),
    durationMin: dur,
  }
  if (rpe !== undefined) out.rpe = rpe
  return out
}

// ─── null gate ─────────────────────────────────────────────────────────────

describe('VeryEasyShareCard — null gate', () => {
  it('renders the card (INSUFFICIENT_DATA) when log is empty (not null)', () => {
    const { container } = renderCard([])
    // Pure fn returns populated INSUFFICIENT_DATA, so card renders.
    expect(container.firstChild).not.toBeNull()
    const card = document.querySelector('[data-card="very-easy-share"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
  })
})

// ─── INSUFFICIENT_DATA ─────────────────────────────────────────────────────

describe('VeryEasyShareCard — INSUFFICIENT_DATA', () => {
  it('renders the data-hint placeholder for < 60 min rated', () => {
    renderCard([entryOn({ daysAgo: 1, dur: 30, rpe: 2 })])
    const card = document.querySelector('[data-card="very-easy-share"]')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    expect(card.textContent).toMatch(/NEED MORE DATA/)
    expect(card.textContent).toMatch(/at least 60 minutes/i)
  })

  it('uses em-dash placeholder for the headline share value', () => {
    renderCard([])
    const share = document.querySelector('[data-share-display]')
    expect(share.textContent.trim()).toBe('—')
  })
})

// ─── INSUFFICIENT_BASE ─────────────────────────────────────────────────────

describe('VeryEasyShareCard — INSUFFICIENT_BASE', () => {
  it('renders INSUFFICIENT_BASE band when very-easy share < 30%', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 60, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 60, rpe: 7 }),
      entryOn({ daysAgo: 3, dur: 60, rpe: 7 }),
      entryOn({ daysAgo: 4, dur: 60, rpe: 7 }),
      entryOn({ daysAgo: 5, dur: 60, rpe: 7 }),
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="very-easy-share"]')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_BASE')
    expect(card.textContent).toMatch(/INSUFFICIENT BASE/)
    expect(card.textContent).toMatch(/Aerobic-base adaptations stall/i)
    expect(card.getAttribute('data-very-easy-share')).toBe('0.2')
  })
})

// ─── BUILDING_BASE ─────────────────────────────────────────────────────────

describe('VeryEasyShareCard — BUILDING_BASE', () => {
  it('renders BUILDING_BASE for 45% share', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 90, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 110, rpe: 6 }),
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="very-easy-share"]')
    expect(card.getAttribute('data-band')).toBe('BUILDING_BASE')
    expect(card.textContent).toMatch(/BUILDING BASE/)
    expect(card.textContent).toMatch(/Building aerobic base/i)
  })
})

// ─── STRONG_BASE ───────────────────────────────────────────────────────────

describe('VeryEasyShareCard — STRONG_BASE', () => {
  it('renders STRONG_BASE for 70% share', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 70, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 30, rpe: 7 }),
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="very-easy-share"]')
    expect(card.getAttribute('data-band')).toBe('STRONG_BASE')
    expect(card.textContent).toMatch(/STRONG BASE/)
    expect(card.textContent).toMatch(/Strong aerobic base/i)
  })
})

// ─── EXCESSIVE_EASY ────────────────────────────────────────────────────────

describe('VeryEasyShareCard — EXCESSIVE_EASY', () => {
  it('renders EXCESSIVE_EASY for 100% share', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 60, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 60, rpe: 2 }),
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="very-easy-share"]')
    expect(card.getAttribute('data-band')).toBe('EXCESSIVE_EASY')
    expect(card.textContent).toMatch(/EXCESSIVE EASY/)
    expect(card.textContent).toMatch(/More than 80% very-easy/i)
  })
})

// ─── stacked bar rendering ─────────────────────────────────────────────────

describe('VeryEasyShareCard — stacked bar', () => {
  it('renders all three segments when easy + hard + unrated all present', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 90, rpe: 2 }),   // very-easy
      entryOn({ daysAgo: 2, dur: 90, rpe: 7 }),   // rated hard
      entryOn({ daysAgo: 3, dur: 60 }),           // unrated
    ]
    renderCard(log)
    expect(document.querySelector('[data-seg="very-easy"]')).not.toBeNull()
    expect(document.querySelector('[data-seg="rated-hard"]')).not.toBeNull()
    expect(document.querySelector('[data-seg="unrated"]')).not.toBeNull()
  })

  it('omits unrated segment when unratedSessionCount = 0', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 90, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 90, rpe: 7 }),
    ]
    renderCard(log)
    expect(document.querySelector('[data-seg="very-easy"]')).not.toBeNull()
    expect(document.querySelector('[data-seg="rated-hard"]')).not.toBeNull()
    expect(document.querySelector('[data-seg="unrated"]')).toBeNull()
  })
})

// ─── data hygiene note ─────────────────────────────────────────────────────

describe('VeryEasyShareCard — data hygiene note', () => {
  it('shows the data-hygiene-note when unrated sessions exist', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 90, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 30, rpe: 7 }),
      entryOn({ daysAgo: 3, dur: 60 }), // unrated
    ]
    renderCard(log)
    const note = document.querySelector('[data-hygiene-note]')
    expect(note).not.toBeNull()
    expect(note.textContent).toMatch(/1 unrated session/i)
  })

  it('hides the data-hygiene-note when no unrated sessions', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 90, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 30, rpe: 7 }),
    ]
    renderCard(log)
    expect(document.querySelector('[data-hygiene-note]')).toBeNull()
  })

  it('pluralises "sessions" when >1 unrated', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 90, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 30, rpe: 7 }),
      entryOn({ daysAgo: 3, dur: 30 }), // unrated 1
      entryOn({ daysAgo: 4, dur: 30 }), // unrated 2
    ]
    renderCard(log)
    const note = document.querySelector('[data-hygiene-note]')
    expect(note.textContent).toMatch(/2 unrated sessions/i)
  })
})

// ─── citation footer ───────────────────────────────────────────────────────

describe('VeryEasyShareCard — citation', () => {
  it('renders the Maffetone + Seiler citation footer', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 70, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 30, rpe: 7 }),
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="very-easy-share"]')
    expect(card.textContent).toMatch(/Maffetone 2010/)
    expect(card.textContent).toMatch(/Seiler 2010/)
  })
})

// ─── accessibility ─────────────────────────────────────────────────────────

describe('VeryEasyShareCard — accessibility', () => {
  it('exposes role=region with bilingual aria-label (EN)', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 70, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 30, rpe: 7 }),
    ]
    renderCard(log, 'en')
    const region = screen.getByRole('region', {
      name: /Very-Easy training share card/i,
    })
    expect(region).toBeInTheDocument()
  })

  it('exposes role=region with bilingual aria-label (TR)', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 70, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 30, rpe: 7 }),
    ]
    renderCard(log, 'tr')
    const region = screen.getByRole('region', {
      name: /Çok kolay antrenman payı kartı/i,
    })
    expect(region).toBeInTheDocument()
  })
})

// ─── bilingual (Turkish) ───────────────────────────────────────────────────

describe('VeryEasyShareCard — bilingual (Turkish)', () => {
  it('renders Turkish heading + STRONG_BASE label + Turkish hint', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 70, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 30, rpe: 7 }),
    ]
    renderCard(log, 'tr')
    const card = document.querySelector('[data-card="very-easy-share"]')
    expect(card.textContent).toMatch(/ÇOK KOLAY ANTRENMAN PAYI · 30G/)
    expect(card.textContent).toMatch(/GÜÇLÜ TEMEL/)
    expect(card.textContent).toMatch(/Güçlü aerobik temel/i)
  })

  it('renders Turkish data-hygiene note', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 90, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 30, rpe: 7 }),
      entryOn({ daysAgo: 3, dur: 60 }), // unrated
    ]
    renderCard(log, 'tr')
    const note = document.querySelector('[data-hygiene-note]')
    expect(note.textContent).toMatch(/1 etiketlenmemiş seans/i)
  })

  it('renders Turkish INSUFFICIENT_DATA placeholder', () => {
    renderCard([], 'tr')
    const card = document.querySelector('[data-card="very-easy-share"]')
    expect(card.textContent).toMatch(/YETERSİZ VERİ/)
    expect(card.textContent).toMatch(/en az 60 dakika/i)
  })
})

// ─── data anchors ──────────────────────────────────────────────────────────

describe('VeryEasyShareCard — data anchors', () => {
  it('exposes data-band / data-very-easy-min / data-total-rated-min / data-very-easy-share / data-unrated-session-count', () => {
    const log = [
      entryOn({ daysAgo: 1, dur: 70, rpe: 2 }),
      entryOn({ daysAgo: 2, dur: 30, rpe: 7 }),
      entryOn({ daysAgo: 3, dur: 45 }), // unrated
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="very-easy-share"]')
    expect(card.getAttribute('data-band')).toBe('STRONG_BASE')
    expect(card.getAttribute('data-very-easy-min')).toBe('70')
    expect(card.getAttribute('data-total-rated-min')).toBe('100')
    expect(card.getAttribute('data-very-easy-share')).toBe('0.7')
    expect(card.getAttribute('data-unrated-session-count')).toBe('1')
  })
})
