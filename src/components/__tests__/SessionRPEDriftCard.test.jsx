// @vitest-environment jsdom
// ─── SessionRPEDriftCard.test.jsx — render tests for v8.77.0 RPE drift card ─
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SessionRPEDriftCard from '../dashboard/SessionRPEDriftCard.jsx'

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <SessionRPEDriftCard {...props} />
    </LangCtx.Provider>
  )
}

function todayStr() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// type → planned-max RPE: easy=4, long=5, steady=7, threshold=8, intervals=10
function entry(offset, type, rpe) {
  return { date: addDays(todayStr(), -offset), type, rpe, duration: 60 }
}

// ─── 1. Insufficient data (totalSessions < 8) ────────────────────────────────
describe('SessionRPEDriftCard — insufficient data', () => {
  it('renders insufficient-data notice when reliable=false', () => {
    const log = [
      entry(0, 'easy', 4),
      entry(1, 'easy', 4),
      entry(2, 'long', 5),
    ]
    renderCard({ log })
    expect(screen.getByText(/Log 8\+ typed sessions/i)).toBeInTheDocument()
  })

  it('renders TR insufficient-data notice', () => {
    const log = [entry(0, 'easy', 4)]
    renderCard({ log }, 'tr')
    expect(screen.getByText(/8\+ tipli seans kaydet/i)).toBeInTheDocument()
  })
})

// ─── 2. Healthy good band (driftPct < 20%) ───────────────────────────────────
describe('SessionRPEDriftCard — good band', () => {
  it('renders healthy on-plan state when driftPct=0', () => {
    // 8 perfectly compliant sessions, mix of types
    const log = [
      entry(0, 'easy', 4),
      entry(1, 'easy', 3),
      entry(2, 'long', 5),
      entry(3, 'long', 4),
      entry(4, 'steady', 6),
      entry(5, 'steady', 7),
      entry(6, 'threshold', 8),
      entry(7, 'easy', 4),
    ]
    renderCard({ log })
    expect(screen.getByText(/Sessions on plan/i)).toBeInTheDocument()
    expect(screen.getByText('ON PLAN')).toBeInTheDocument()
  })

  it('renders TR good-band copy', () => {
    const log = [
      entry(0, 'easy', 4),
      entry(1, 'easy', 3),
      entry(2, 'long', 5),
      entry(3, 'long', 4),
      entry(4, 'steady', 6),
      entry(5, 'steady', 7),
      entry(6, 'threshold', 8),
      entry(7, 'easy', 4),
    ]
    renderCard({ log }, 'tr')
    expect(screen.getByText(/Seanslar planda/i)).toBeInTheDocument()
    expect(screen.getByText('PLANDA')).toBeInTheDocument()
  })
})

// ─── 3. Moderate band (20% ≤ driftPct < 40%) ─────────────────────────────────
describe('SessionRPEDriftCard — moderate band', () => {
  it('renders moderate band with 3/10 drift = 30%', () => {
    // 10 sessions, 3 drift (mild +1, moderate +2, severe +3)
    const log = [
      entry(0, 'easy', 5),       // drift +1 mild
      entry(1, 'long', 7),       // drift +2 moderate
      entry(2, 'steady', 10),    // drift +3 severe
      entry(3, 'easy', 4),
      entry(4, 'easy', 4),
      entry(5, 'long', 5),
      entry(6, 'long', 5),
      entry(7, 'steady', 7),
      entry(8, 'steady', 6),
      entry(9, 'threshold', 8),
    ]
    renderCard({ log })
    expect(screen.getByText('MODERATE')).toBeInTheDocument()
    // driftPct = 30
    expect(screen.getByText('30')).toBeInTheDocument()
  })
})

// ─── 4. High band (driftPct ≥ 40%) ───────────────────────────────────────────
describe('SessionRPEDriftCard — high band', () => {
  it('renders high band with ≥40% drift', () => {
    // 10 sessions, 5 drift = 50%
    const log = [
      entry(0, 'easy', 6),      // drift +2
      entry(1, 'easy', 5),      // drift +1
      entry(2, 'long', 7),      // drift +2
      entry(3, 'long', 6),      // drift +1
      entry(4, 'steady', 8),    // drift +1
      entry(5, 'easy', 4),
      entry(6, 'easy', 4),
      entry(7, 'long', 5),
      entry(8, 'steady', 7),
      entry(9, 'threshold', 8),
    ]
    renderCard({ log })
    expect(screen.getByText('HIGH')).toBeInTheDocument()
  })
})

// ─── 5. Bilingual EN+TR (band labels) ────────────────────────────────────────
describe('SessionRPEDriftCard — bilingual', () => {
  it('renders English title in EN', () => {
    const log = makeReliableGoodLog()
    renderCard({ log })
    expect(screen.getByText('SESSION RPE DRIFT — 28D')).toBeInTheDocument()
  })

  it('renders Turkish title in TR', () => {
    const log = makeReliableGoodLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText('SEANS RPE SAPMASI — 28G')).toBeInTheDocument()
  })
})

// ─── 6. role=region ──────────────────────────────────────────────────────────
describe('SessionRPEDriftCard — a11y', () => {
  it('renders role=region with bilingual aria-label', () => {
    const log = makeReliableGoodLog()
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Session RPE drift/i)
  })
})

// ─── 7. Citation footer ──────────────────────────────────────────────────────
describe('SessionRPEDriftCard — citation', () => {
  it('renders citation footer', () => {
    const log = makeReliableGoodLog()
    renderCard({ log })
    expect(screen.getByText(/Foster 2001 session RPE; Seiler 2010 polarized/)).toBeInTheDocument()
  })

  it('renders citation footer in moderate band too', () => {
    const log = makeModerateBandLog()
    renderCard({ log })
    expect(screen.getByText(/Foster 2001 session RPE; Seiler 2010 polarized/)).toBeInTheDocument()
  })
})

// ─── 8. byType row renders with ≥2 types ─────────────────────────────────────
describe('SessionRPEDriftCard — byType breakdown', () => {
  it('renders type breakdown with at least 2 types when in drift band', () => {
    const log = makeModerateBandLog()
    renderCard({ log })
    // Should mention Easy and Long type drift counts
    // moderate fixture has drift in easy + long + steady, all show
    expect(screen.getByText(/Easy 1\/3/)).toBeInTheDocument()
    expect(screen.getByText(/Long 1\/3/)).toBeInTheDocument()
  })
})

// ─── 9. worstType callout when set ───────────────────────────────────────────
describe('SessionRPEDriftCard — worstType callout', () => {
  it('renders worst-type callout when worstType non-null', () => {
    const log = makeWorstTypeLog()
    renderCard({ log })
    expect(screen.getByText(/Worst:/i)).toBeInTheDocument()
  })
})

// ─── 10. Severity counts ─────────────────────────────────────────────────────
describe('SessionRPEDriftCard — severity counts', () => {
  it('renders severity row with mild/mod/severe counts', () => {
    const log = makeModerateBandLog()
    renderCard({ log })
    expect(screen.getByText(/mild/i)).toBeInTheDocument()
    expect(screen.getByText(/severe/i)).toBeInTheDocument()
  })
})

// ─── 11. driftSessions/totalSessions sub-line ────────────────────────────────
describe('SessionRPEDriftCard — sub-line', () => {
  it('renders the drift/total sub-line', () => {
    const log = makeModerateBandLog()
    renderCard({ log })
    expect(screen.getByText(/3\/10 sessions/)).toBeInTheDocument()
  })
})

// ─── Fixture helpers ─────────────────────────────────────────────────────────
function makeReliableGoodLog() {
  return [
    entry(0, 'easy', 4),
    entry(1, 'easy', 3),
    entry(2, 'long', 5),
    entry(3, 'long', 4),
    entry(4, 'steady', 6),
    entry(5, 'steady', 7),
    entry(6, 'threshold', 8),
    entry(7, 'easy', 4),
  ]
}

function makeModerateBandLog() {
  // 10 sessions, exactly 3 drift = 30% → moderate band
  // Easy: 1/3 drift, Long: 1/3 drift, Steady: 1/3 drift, Threshold: 0/1
  return [
    entry(0, 'easy', 5),       // drift +1 mild
    entry(1, 'long', 7),       // drift +2 moderate
    entry(2, 'steady', 10),    // drift +3 severe
    entry(3, 'easy', 4),
    entry(4, 'easy', 4),
    entry(5, 'long', 5),
    entry(6, 'long', 5),
    entry(7, 'steady', 7),
    entry(8, 'steady', 6),
    entry(9, 'threshold', 8),
  ]
}

function makeWorstTypeLog() {
  // Easy 3/3 all drift, Long 0/3, Steady 0/3 → worstType=easy, total drift 3/9
  // need totalSessions ≥ 8 reliable. 9 sessions, 3 drift = 33% → moderate band.
  // worstType requires total≥3 in a collapsed type.
  return [
    entry(0, 'easy', 5),
    entry(1, 'easy', 6),
    entry(2, 'easy', 7),
    entry(3, 'long', 5),
    entry(4, 'long', 4),
    entry(5, 'long', 5),
    entry(6, 'steady', 7),
    entry(7, 'steady', 6),
    entry(8, 'steady', 7),
  ]
}
