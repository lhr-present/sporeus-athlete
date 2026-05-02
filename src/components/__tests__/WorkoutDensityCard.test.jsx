// @vitest-environment jsdom
// ─── WorkoutDensityCard.test.jsx — render tests for the workout-density card ──
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WorkoutDensityCard from '../dashboard/WorkoutDensityCard.jsx'

// ─── Render helper with overridable lang ─────────────────────────────────────
function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <WorkoutDensityCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Synthetic log helpers (anchored relative to "today") ────────────────────
// We build dates relative to today so the card's default `today` (current date)
// always lines up with the synthetic 4-week window.
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function isoWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dow = d.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

function hardEntry(date) {
  return { date, type: 'run', duration: 60, rpe: 8, zones: [0, 10, 10, 60, 20] }
}
function easyEntry(date) {
  return { date, type: 'run', duration: 60, rpe: 4, zones: [10, 70, 10, 5, 5] }
}

/**
 * Build 4 weeks of log: weekly schedule controlled by `hardDaysPerWeek`
 * array (length 4, oldest → newest). Days within a week are Mon..Sun.
 */
function buildWeeksLog(hardDaysPerWeek) {
  const today = todayStr()
  const w4Start = isoWeekStart(today)
  const w1Start = addDays(w4Start, -21)
  const log = []
  for (let w = 0; w < 4; w++) {
    const weekStart = addDays(w1Start, w * 7)
    const hardDays = hardDaysPerWeek[w]
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d)
      log.push(d < hardDays ? hardEntry(date) : easyEntry(date))
    }
  }
  return log
}

/** N most-recent days (one entry per day) using the supplied builder. */
function buildRecentDays(n, builder) {
  const today = todayStr()
  const log = []
  for (let i = n - 1; i >= 0; i--) {
    log.push(builder(addDays(today, -i)))
  }
  return log
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('WorkoutDensityCard — empty / unreliable states', () => {
  it('renders empty state for empty log', () => {
    renderCard({ log: [] })
    expect(screen.getByText(/Log 14\+ days of training to see workout density/i)).toBeInTheDocument()
  })

  it('renders empty state for 7-day log (unreliable < 14 distinct days)', () => {
    const log = buildRecentDays(7, easyEntry)
    renderCard({ log })
    expect(screen.getByText(/Log 14\+ days of training to see workout density/i)).toBeInTheDocument()
  })

  it('renders TR empty-state copy when lang=tr', () => {
    renderCard({ log: [] }, 'tr')
    expect(screen.getByText(/Antrenman yoğunluğunu görmek için 14\+ gün antrenman kaydet/i))
      .toBeInTheDocument()
  })
})

describe('WorkoutDensityCard — low risk', () => {
  it('shows ✓ + healthy message for polarized 80/20 (28d, 1 hard/wk)', () => {
    const log = buildWeeksLog([1, 1, 1, 1])
    renderCard({ log })
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByText(/Workout density healthy\./i)).toBeInTheDocument()
  })

  it('returns low risk when only the OLDEST week is hard (consecutiveFlagged=0)', () => {
    // 1 hard week (W1) + 3 healthy weeks (W2..W4) → consecutiveFlagged = 0
    const log = buildWeeksLog([5, 1, 1, 1])
    renderCard({ log })
    expect(screen.getByText(/Workout density healthy\./i)).toBeInTheDocument()
    expect(screen.getByText('✓')).toBeInTheDocument()
  })
})

describe('WorkoutDensityCard — moderate risk', () => {
  it('shows amber-bordered moderate state when only the most-recent week is hard', () => {
    // 3 healthy weeks then 1 hard week (W4) → consecutiveFlagged = 1 → moderate
    const log = buildWeeksLog([1, 1, 1, 5])
    const { container } = renderCard({ log })
    expect(screen.getByText(/1 week of high density/i)).toBeInTheDocument()
    // Amber border-left present
    const region = container.querySelector('[role="region"]')
    // jsdom normalises hex → rgb(); accept either form
    expect(region.getAttribute('style')).toMatch(/border-left:\s*3px\s+solid\s+(?:#f5c542|rgb\(245,\s*197,\s*66\))/i)
  })
})

describe('WorkoutDensityCard — high risk', () => {
  it('shows red-bordered high state for 4 weeks of 5 hard days each', () => {
    const log = buildWeeksLog([5, 5, 5, 5])
    const { container } = renderCard({ log })
    expect(screen.getByText(/consecutive weeks of 4\+ hard days/i)).toBeInTheDocument()
    expect(screen.getByText(/Take 1-2 easy days/i)).toBeInTheDocument()
    const region = container.querySelector('[role="region"]')
    expect(region.getAttribute('style')).toMatch(/border-left:\s*4px\s+solid\s+(?:#e03030|rgb\(224,\s*48,\s*48\))/i)
  })
})

describe('WorkoutDensityCard — 4-week bar group', () => {
  it('always renders 4 week columns when reliable', () => {
    const log = buildWeeksLog([1, 1, 1, 1])
    renderCard({ log })
    ;['W1', 'W2', 'W3', 'W4'].forEach(lbl => {
      expect(screen.getByText(lbl)).toBeInTheDocument()
    })
  })

  it('exposes a single role=img with aria-label summarizing hiDays', () => {
    const log = buildWeeksLog([1, 1, 1, 1])
    renderCard({ log })
    const bars = screen.getByRole('img')
    expect(bars.getAttribute('aria-label')).toMatch(/4-week density:\s*1,\s*1,\s*1,\s*1\s*hard days/i)
  })

  it('renders a numeric hiDays count for each of the 4 weeks (high-risk case)', () => {
    const log = buildWeeksLog([5, 5, 5, 5])
    renderCard({ log })
    // 4 columns each labeled with "5"
    const fives = screen.getAllByText('5')
    expect(fives.length).toBeGreaterThanOrEqual(4)
  })
})

describe('WorkoutDensityCard — bilingual + a11y + citation', () => {
  it('renders TR strings when lang=tr (high-risk path)', () => {
    const log = buildWeeksLog([5, 5, 5, 5])
    renderCard({ log }, 'tr')
    expect(screen.getByText(/yaralanma riski/i)).toBeInTheDocument()
    expect(screen.getByText(/1-2 kolay gün geçir/i)).toBeInTheDocument()
  })

  it('card root has role=region with bilingual aria-label', () => {
    const log = buildWeeksLog([1, 1, 1, 1])
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Workout density/i)
  })

  it('renders the Gabbett/Hulin citation footer', () => {
    const log = buildWeeksLog([1, 1, 1, 1])
    renderCard({ log })
    expect(screen.getByText(/Gabbett 2016; Hulin 2016/)).toBeInTheDocument()
  })
})
