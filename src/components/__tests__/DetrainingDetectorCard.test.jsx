// @vitest-environment jsdom
// ─── DetrainingDetectorCard.test.jsx — render tests for E130 detraining card ─
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import DetrainingDetectorCard from '../dashboard/DetrainingDetectorCard.jsx'

// ─── Render helper with overridable lang ─────────────────────────────────────
function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <DetrainingDetectorCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Date helpers ────────────────────────────────────────────────────────────
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

// ─── Fixture builders ────────────────────────────────────────────────────────

/**
 * Continuous daily log of N entries ending today — no gaps, all reliable.
 */
function makeContinuousLog(n = 28) {
  const today = todayStr()
  const log = []
  for (let i = 0; i < n; i++) {
    log.push({
      date: addDays(today, -(n - 1 - i)),
      type: 'easy',
      rpe: 4,
      duration: 60,
    })
  }
  return log
}

/**
 * Reliable log (≥14 entries) where the trailing edge has a `gapDays`-long
 * gap from today back to the most recent session. Pads earlier dates densely
 * so detector fires `inActiveGap` with the requested severity band.
 */
function makeActiveGapLog(gapDays, totalEntries = 18) {
  const today = todayStr()
  const lastSession = addDays(today, -gapDays)
  const log = []
  for (let i = 0; i < totalEntries; i++) {
    log.push({
      date: addDays(lastSession, -(totalEntries - 1 - i)),
      type: 'easy',
      rpe: 4,
      duration: 60,
    })
  }
  return log
}

/**
 * Reliable log with a CLOSED interior gap: sessions either side of a
 * `gapDays`-day window of no sessions, then sessions resume up to today.
 */
function makeClosedGapLog(gapDays, daysBack = 5, totalEntries = 20) {
  const today = todayStr()
  const log = []
  // Pre-gap dense block (10 sessions ending at start anchor)
  const gapStart = addDays(today, -(daysBack + gapDays + 1)) // last session before gap
  for (let i = 0; i < 10; i++) {
    log.push({ date: addDays(gapStart, -(9 - i)), type: 'easy', rpe: 4, duration: 60 })
  }
  // Post-gap block (resume to today)
  const resume = addDays(today, -daysBack)
  const post = totalEntries - 10
  for (let i = 0; i < post; i++) {
    log.push({ date: addDays(resume, i), type: 'easy', rpe: 4, duration: 60 })
  }
  return log
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DetrainingDetectorCard — insufficient history', () => {
  it('renders insufficient-history notice when log has <14 entries', () => {
    renderCard({ log: makeContinuousLog(5) })
    expect(
      screen.getByText(/Log 14\+ sessions to track detraining/i)
    ).toBeInTheDocument()
  })

  it('renders TR insufficient-history notice when lang=tr', () => {
    renderCard({ log: makeContinuousLog(5) }, 'tr')
    expect(
      screen.getByText(/Form kaybını izlemek için 14\+ seans kaydet/i)
    ).toBeInTheDocument()
  })
})

describe('DetrainingDetectorCard — healthy state', () => {
  it('renders healthy state when no gap >=7 days exists', () => {
    renderCard({ log: makeContinuousLog(28) })
    expect(
      screen.getByText(/No gap longer than 7 days recently/i)
    ).toBeInTheDocument()
  })
})

describe('DetrainingDetectorCard — active gap severity bands', () => {
  it('renders MINOR band when gap is 7-13 days', () => {
    renderCard({ log: makeActiveGapLog(10) })
    expect(screen.getByText('MINOR')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('renders MODERATE band when gap is 14-21 days', () => {
    renderCard({ log: makeActiveGapLog(18) })
    expect(screen.getByText('MODERATE')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
  })

  it('renders MAJOR band when gap is 22-42 days', () => {
    renderCard({ log: makeActiveGapLog(30) })
    expect(screen.getByText('MAJOR')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('renders SEVERE band when gap is >42 days', () => {
    renderCard({ log: makeActiveGapLog(60) })
    expect(screen.getByText('SEVERE')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
  })
})

describe('DetrainingDetectorCard — bilingual', () => {
  it('renders English title and band when lang=en', () => {
    renderCard({ log: makeActiveGapLog(10) })
    expect(screen.getByText('DETRAINING DETECTOR')).toBeInTheDocument()
    expect(screen.getByText('MINOR')).toBeInTheDocument()
    expect(screen.getByText(/Minor gap \(7-13 days\)/i)).toBeInTheDocument()
  })

  it('renders Turkish title and band when lang=tr', () => {
    renderCard({ log: makeActiveGapLog(10) }, 'tr')
    expect(screen.getByText('FORM KAYBI DEDEKTÖRÜ')).toBeInTheDocument()
    expect(screen.getByText('HAFİF')).toBeInTheDocument()
    expect(screen.getByText(/Hafif ara \(7-13 gün\)/i)).toBeInTheDocument()
  })
})

describe('DetrainingDetectorCard — a11y + structure', () => {
  it('card root has role=region with bilingual aria-label (en)', () => {
    renderCard({ log: makeActiveGapLog(10) })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Detraining detector/i)
  })

  it('card root has TR aria-label when lang=tr', () => {
    renderCard({ log: makeActiveGapLog(10) }, 'tr')
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Form kaybı dedektörü/i)
  })

  it('renders the citation footer', () => {
    renderCard({ log: makeActiveGapLog(10) })
    expect(screen.getByText(/Mujika & Padilla 2000/)).toBeInTheDocument()
  })
})

describe('DetrainingDetectorCard — daysSinceReturn', () => {
  it('renders days-back line when athlete has returned from a closed gap', () => {
    renderCard({ log: makeClosedGapLog(10, 2) })
    // gap endDate = today - daysBack - 1, so daysSinceReturn = daysBack + 1 = 3
    expect(screen.getByText(/3 days back/i)).toBeInTheDocument()
  })

  it('renders Turkish days-back line when lang=tr', () => {
    renderCard({ log: makeClosedGapLog(10, 2) }, 'tr')
    expect(screen.getByText(/3 gün döndü/i)).toBeInTheDocument()
  })
})
