// @vitest-environment jsdom
// ─── PerfectWeekCard.test.jsx — render tests for the perfect-week UI ────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import PerfectWeekCard from '../dashboard/PerfectWeekCard.jsx'

// 2026-05-17 is a Sunday. 12-week window = Mon 2026-02-23 → Sun 2026-05-17.
const TODAY_ISO = '2026-05-17'

const WEEKS = [
  '2026-02-23', '2026-03-02', '2026-03-09', '2026-03-16',
  '2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13',
  '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11',
]

function entry(weekIdx, dayOffset, durationMin, rpe) {
  const base = new Date(WEEKS[weekIdx] + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() + dayOffset)
  const date = base.toISOString().slice(0, 10)
  return { date, durationMin, rpe, type: 'run' }
}

function perfectWeekEntries(weekIdx) {
  return [
    entry(weekIdx, 0, 60, 5),
    entry(weekIdx, 2, 60, 7),
    entry(weekIdx, 5, 120, 6),
  ]
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <PerfectWeekCard log={log} />
    </LangCtx.Provider>
  )
}

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY_ISO + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

describe('PerfectWeekCard — null render', () => {
  it('renders nothing for empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-perfect-week-card]')).toBeNull()
  })

  it('renders nothing when fewer than 6 active weeks', () => {
    const log = []
    for (let w = 0; w < 5; w++) log.push(entry(w, 0, 60, 5))
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })
})

describe('PerfectWeekCard — HABITUAL_QUALITY pattern', () => {
  function buildHabitualLog() {
    // 8 perfect + 4 imperfect-active = 8/12 = 66.7% → HABITUAL_QUALITY
    const log = []
    for (let w = 0; w < 8; w++) log.push(...perfectWeekEntries(w))
    for (let w = 8; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 5))
      log.push(entry(w, 4, 60, 5))
    }
    return log
  }

  it('renders with HABITUAL_QUALITY pattern and label', () => {
    renderCard(buildHabitualLog())
    const card = document.querySelector('[data-perfect-week-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-perfect-week-pattern')).toBe('HABITUAL_QUALITY')
    expect(card.getAttribute('data-perfect-weeks')).toBe('8')
    expect(card.textContent).toMatch(/HABITUAL/)
    expect(card.textContent).toMatch(/8\/12/)
    expect(card.textContent).toMatch(/67%/)
  })

  it('renders interpretation hint for HABITUAL_QUALITY', () => {
    renderCard(buildHabitualLog())
    const card = document.querySelector('[data-perfect-week-card]')
    expect(card.textContent).toMatch(/Quality structure is your default/i)
  })

  it('renders heading and citation', () => {
    renderCard(buildHabitualLog())
    const card = document.querySelector('[data-perfect-week-card]')
    expect(card.textContent).toMatch(/PERFECT WEEK RATIO · 12W/)
    expect(card.textContent).toMatch(/Hellard 2019/)
    expect(card.textContent).toMatch(/Seiler 2010/)
  })

  it('exposes role=region with accessible label', () => {
    renderCard(buildHabitualLog())
    const region = screen.getByRole('region', { name: /Perfect week ratio card/i })
    expect(region).toBeInTheDocument()
  })
})

describe('PerfectWeekCard — OCCASIONAL pattern', () => {
  it('renders OCCASIONAL pattern + hint when 20% ≤ rate < 50%', () => {
    const log = []
    for (let w = 0; w < 3; w++) log.push(...perfectWeekEntries(w))
    for (let w = 3; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 5))
      log.push(entry(w, 4, 60, 5))
    }
    renderCard(log)
    const card = document.querySelector('[data-perfect-week-card]')
    expect(card.getAttribute('data-perfect-week-pattern')).toBe('OCCASIONAL')
    expect(card.textContent).toMatch(/OCCASIONAL/)
    expect(card.textContent).toMatch(/3\/12/)
    expect(card.textContent).toMatch(/Identify the recurring gap/i)
  })
})

describe('PerfectWeekCard — SPORADIC pattern', () => {
  it('renders SPORADIC pattern + hint when rate < 20%', () => {
    const log = []
    log.push(...perfectWeekEntries(0))
    for (let w = 1; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 5))
      log.push(entry(w, 4, 60, 5))
    }
    renderCard(log)
    const card = document.querySelector('[data-perfect-week-card]')
    expect(card.getAttribute('data-perfect-week-pattern')).toBe('SPORADIC')
    expect(card.textContent).toMatch(/SPORADIC/)
    expect(card.textContent).toMatch(/1\/12/)
    expect(card.textContent).toMatch(/Quality structure rarely lands/i)
  })
})

describe('PerfectWeekCard — Turkish locale', () => {
  it('renders Turkish heading, label, and hint', () => {
    const log = []
    for (let w = 0; w < 8; w++) log.push(...perfectWeekEntries(w))
    for (let w = 8; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 5))
      log.push(entry(w, 4, 60, 5))
    }
    renderCard(log, 'tr')
    const card = document.querySelector('[data-perfect-week-card]')
    expect(card).not.toBeNull()
    expect(card.textContent).toMatch(/MÜKEMMEL HAFTA ORANI · 12H/)
    expect(card.textContent).toMatch(/ALIŞKANLIK/)
    expect(card.textContent).toMatch(/Kaliteli yapı varsayılan/)
  })
})

describe('PerfectWeekCard — per-week block data anchors', () => {
  it('renders 12 week blocks with full data-anchor attributes', () => {
    const log = []
    for (let w = 0; w < 12; w++) log.push(...perfectWeekEntries(w))
    renderCard(log)
    const blocks = document.querySelectorAll('[data-week-block]')
    expect(blocks).toHaveLength(12)

    // First block should match week 0
    const first = blocks[0]
    expect(first.getAttribute('data-week-start')).toBe('2026-02-23')
    expect(first.getAttribute('data-week-perfect')).toBe('true')
    expect(first.getAttribute('data-week-session-count')).toBe('3')
    expect(first.getAttribute('data-week-had-hard')).toBe('true')
    expect(first.getAttribute('data-week-had-long')).toBe('true')
  })

  it('marks imperfect blocks with false/correct counts', () => {
    // Week 0: missing hard
    // Other weeks: filler activity to clear the 6-active gate.
    const log = [
      entry(0, 0, 60, 5),
      entry(0, 2, 60, 5),
      entry(0, 5, 120, 5),
      ...Array.from({ length: 11 }, (_, i) => entry(i + 1, 0, 60, 5)),
    ]
    renderCard(log)
    const blocks = document.querySelectorAll('[data-week-block]')
    const first = blocks[0]
    expect(first.getAttribute('data-week-perfect')).toBe('false')
    expect(first.getAttribute('data-week-session-count')).toBe('3')
    expect(first.getAttribute('data-week-had-hard')).toBe('false')
    expect(first.getAttribute('data-week-had-long')).toBe('true')
  })
})

describe('PerfectWeekCard — mostCommonGap interpolation', () => {
  it('shows English "sessions" gap label and data attribute', () => {
    // All weeks 1-session-only → all gaps maxed → tie-break → sessions.
    const log = []
    for (let w = 0; w < 12; w++) log.push(entry(w, 0, 60, 5))
    renderCard(log)
    const card = document.querySelector('[data-perfect-week-card]')
    expect(card.getAttribute('data-most-common-gap')).toBe('sessions')
    expect(card.textContent).toMatch(/missing most often/i)
    expect(card.textContent).toMatch(/sessions/)
  })

  it('shows "hard" gap label when only hard is missing', () => {
    const log = []
    for (let w = 0; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 120, 5))
      log.push(entry(w, 4, 60, 5))
    }
    renderCard(log)
    const card = document.querySelector('[data-perfect-week-card]')
    expect(card.getAttribute('data-most-common-gap')).toBe('hard')
    expect(card.textContent).toMatch(/hard/i)
  })

  it('shows "long" gap label when only long is missing', () => {
    const log = []
    for (let w = 0; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 7))
      log.push(entry(w, 4, 60, 5))
    }
    renderCard(log)
    const card = document.querySelector('[data-perfect-week-card]')
    expect(card.getAttribute('data-most-common-gap')).toBe('long')
    expect(card.textContent).toMatch(/long/)
  })

  it('uses Turkish gap labels when lang=tr', () => {
    const log = []
    for (let w = 0; w < 12; w++) log.push(entry(w, 0, 60, 5))
    renderCard(log, 'tr')
    const card = document.querySelector('[data-perfect-week-card]')
    expect(card.getAttribute('data-most-common-gap')).toBe('sessions')
    expect(card.textContent).toMatch(/en çok eksik/)
    // Turkish translation of 'sessions' → 'seans'
    expect(card.textContent).toMatch(/seans/)
  })
})
