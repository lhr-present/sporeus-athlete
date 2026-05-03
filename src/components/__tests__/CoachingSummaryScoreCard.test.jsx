// @vitest-environment jsdom
// ─── CoachingSummaryScoreCard.test.jsx — render tests for E129 score card ────
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CoachingSummaryScoreCard from '../dashboard/CoachingSummaryScoreCard.jsx'

// ─── Render helper with overridable lang ─────────────────────────────────────
function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <CoachingSummaryScoreCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Date helpers ────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Synthetic logs (mirrored from coachingSummaryScore lib tests) ───────────

/**
 * 28-day healthy log: variety of session types, healthy density, polarized.
 */
function makeHealthyLog() {
  const today = todayStr()
  const log = []
  for (let i = 0; i < 28; i++) {
    const date = addDays(today, -(27 - i))
    const dow = i % 7
    let entry
    if (dow === 0) {
      entry = { date, type: 'recovery', rpe: 3, duration: 45, tss: 25, zones: [10, 35, 0, 0, 0] }
    } else if (dow === 1) {
      entry = { date, type: 'intervals', rpe: 8, duration: 45, tss: 70, zones: [5, 5, 5, 15, 15] }
    } else if (dow === 2) {
      entry = { date, type: 'easy', rpe: 3, duration: 50, tss: 30, zones: [10, 40, 0, 0, 0] }
    } else if (dow === 3) {
      entry = { date, type: 'tempo', rpe: 6, duration: 60, tss: 70, zones: [5, 10, 30, 15, 0] }
    } else if (dow === 4) {
      entry = { date, type: 'recovery', rpe: 3, duration: 45, tss: 25, zones: [10, 35, 0, 0, 0] }
    } else if (dow === 5) {
      entry = { date, type: 'long', rpe: 4, duration: 120, tss: 90, zones: [20, 90, 10, 0, 0] }
    } else {
      entry = { date, type: 'steady', rpe: 5, duration: 60, tss: 50, zones: [5, 50, 5, 0, 0] }
    }
    log.push(entry)
  }
  return log
}

/**
 * 28-day "bad" log: high density, low variety, stale zones, drifted easy days.
 */
function makeBadLog() {
  const today = todayStr()
  const log = []
  for (let i = 0; i < 28; i++) {
    const date = addDays(today, -(27 - i))
    const dow = i % 7
    if (dow === 0) continue // skip Sundays
    log.push({
      date,
      type: 'recovery',
      rpe: 7,
      duration: 60,
      tss: 60,
      zones: [0, 0, 60, 0, 0],
    })
  }
  return log
}

/**
 * 3-day log → unreliable (no detector reliable).
 */
function make3DayLog() {
  const today = todayStr()
  return [
    { date: addDays(today, -2), type: 'easy',  rpe: 4, duration: 60, tss: 50, zones: [0, 60, 0, 0, 0] },
    { date: addDays(today, -1), type: 'tempo', rpe: 6, duration: 60, tss: 70, zones: [0, 10, 50, 0, 0] },
    { date: today,              type: 'easy',  rpe: 4, duration: 60, tss: 50, zones: [0, 60, 0, 0, 0] },
  ]
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CoachingSummaryScoreCard — empty / unreliable state', () => {
  it('renders empty state when log is empty', () => {
    renderCard({ log: [] })
    expect(
      screen.getByText(/Log 14\+ days of training to see your coaching score/i)
    ).toBeInTheDocument()
  })

  it('renders empty state for a 3-day log (unreliable, <3 detectors)', () => {
    renderCard({ log: make3DayLog() })
    expect(
      screen.getByText(/Log 14\+ days of training to see your coaching score/i)
    ).toBeInTheDocument()
  })
})

describe('CoachingSummaryScoreCard — healthy log', () => {
  it('renders score ≥ 80 with EXCELLENT band when all detectors healthy', () => {
    const log = makeHealthyLog()
    renderCard({ log })
    expect(screen.getByText('EXCELLENT')).toBeInTheDocument()
    // Score should be ≥80 and visible somewhere
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/\b(8[0-9]|9[0-9]|100)\b/)
  })

  it('uses excellent band aria-label on the score block', () => {
    const log = makeHealthyLog()
    renderCard({ log })
    // The combined score+band element has the bilingual aria-label
    const scoreBlock = screen.getByLabelText(/excellent score \d+ of 100/i)
    expect(scoreBlock).toBeInTheDocument()
  })
})

describe('CoachingSummaryScoreCard — bad log', () => {
  it('renders score < 40 with POOR band when all detectors unhealthy', () => {
    const log = makeBadLog()
    renderCard({ log })
    expect(screen.getByText('POOR')).toBeInTheDocument()
    // Find the big score number — match a small number (<40) on the screen
    const scoreBlock = screen.getByLabelText(/poor score \d+ of 100/i)
    expect(scoreBlock).toBeInTheDocument()
    const m = scoreBlock.getAttribute('aria-label').match(/(\d+) of 100/)
    expect(m).toBeTruthy()
    expect(parseInt(m[1], 10)).toBeLessThan(40)
  })
})

describe('CoachingSummaryScoreCard — component dots', () => {
  it('renders all 5 component dots when reliable', () => {
    const log = makeHealthyLog()
    renderCard({ log })
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(5)
  })

  it('every dot has a non-empty bilingual aria-label', () => {
    const log = makeHealthyLog()
    renderCard({ log })
    const items = screen.getAllByRole('listitem')
    items.forEach(it => {
      const label = it.getAttribute('aria-label')
      expect(label).toBeTruthy()
      expect(label.length).toBeGreaterThan(3)
    })
  })
})

describe('CoachingSummaryScoreCard — weakest callout', () => {
  it('renders the weakest component callout when present', () => {
    const log = makeBadLog()
    renderCard({ log })
    // English: "Weakest: <name> (score)"
    expect(screen.getByText(/Weakest:/i)).toBeInTheDocument()
  })
})

describe('CoachingSummaryScoreCard — bilingual', () => {
  it('renders TR title and band label when lang=tr', () => {
    const log = makeHealthyLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText('ANTRENÖR SKORU — 28G')).toBeInTheDocument()
    expect(screen.getByText('MÜKEMMEL')).toBeInTheDocument()
  })

  it('renders TR empty-state copy when lang=tr', () => {
    renderCard({ log: [] }, 'tr')
    expect(
      screen.getByText(/Antrenör skorunu görmek için 14\+ gün antrenman kaydet/i)
    ).toBeInTheDocument()
  })

  it('renders TR weakest callout when lang=tr', () => {
    const log = makeBadLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText(/En zayıf:/i)).toBeInTheDocument()
  })
})

describe('CoachingSummaryScoreCard — a11y', () => {
  it('card root has role=region with bilingual aria-label (en)', () => {
    const log = makeHealthyLog()
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Coaching summary score/i)
  })

  it('card root has TR aria-label when lang=tr', () => {
    const log = makeHealthyLog()
    renderCard({ log }, 'tr')
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Antrenör özet skoru/i)
  })
})

describe('CoachingSummaryScoreCard — citation', () => {
  it('renders the combined citation footer', () => {
    const log = makeHealthyLog()
    renderCard({ log })
    expect(
      screen.getByText(
        /Seiler 2010; Foster 2001; Gabbett 2016; Banister 1991; Stöggl & Sperlich 2014/
      )
    ).toBeInTheDocument()
  })

  it('renders the see-details affordance', () => {
    const log = makeHealthyLog()
    renderCard({ log })
    expect(screen.getByText(/See details/i)).toBeInTheDocument()
  })
})
