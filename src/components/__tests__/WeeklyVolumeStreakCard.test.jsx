// @vitest-environment jsdom
// ─── WeeklyVolumeStreakCard.test.jsx — render tests ─────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WeeklyVolumeStreakCard from '../dashboard/WeeklyVolumeStreakCard.jsx'

// ─── Anchored time: today = Wed 2026-04-29 → current-week Mon = 2026-04-27 ──
beforeEach(() => { vi.setSystemTime(new Date('2026-04-29T12:00:00Z')) })
afterEach(()  => { vi.setSystemTime(new Date()) })

const CURRENT_WEEK_MONDAY = '2026-04-27'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Last element corresponds to (currentWeekMonday - 7 days). */
function makeWeeklyLog(weeklyTssArray) {
  const lastMonday = addDays(CURRENT_WEEK_MONDAY, -7)
  const firstMonday = addDays(lastMonday, -7 * (weeklyTssArray.length - 1))
  const log = []
  for (let i = 0; i < weeklyTssArray.length; i++) {
    const tss = weeklyTssArray[i]
    if (tss <= 0) continue
    log.push({ date: addDays(firstMonday, i * 7), tss, type: 'run' })
  }
  return log
}

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <WeeklyVolumeStreakCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Fixtures ───────────────────────────────────────────────────────────────
// NO_STREAK: only one above-baseline week → longest = 1.
const NO_STREAK_LOG = (() => {
  const arr = new Array(26).fill(0)
  arr[5] = 500
  return makeWeeklyLog(arr)
})()

// BUILDING: 3 consecutive above-mean weeks.
const BUILDING_LOG = (() => {
  const arr = new Array(26).fill(100)
  arr[10] = 800
  arr[11] = 800
  arr[12] = 800
  return makeWeeklyLog(arr)
})()

// STRONG_MOMENTUM: 5 consecutive above-mean weeks.
const STRONG_LOG = (() => {
  const arr = new Array(26).fill(100)
  for (let i = 10; i <= 14; i++) arr[i] = 800
  return makeWeeklyLog(arr)
})()

// PEAK_BLOCK: 8 consecutive above-mean weeks.
const PEAK_BLOCK_LOG = (() => {
  const arr = new Array(26).fill(100)
  for (let i = 10; i <= 17; i++) arr[i] = 800
  return makeWeeklyLog(arr)
})()

// ─── 1. Null gates ─────────────────────────────────────────────────────────
describe('WeeklyVolumeStreakCard — renders null on insufficient data', () => {
  it('renders nothing for empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when log prop is missing', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for log with only zero TSS', () => {
    const log = [
      { date: '2026-01-01', tss: 0, type: 'run' },
      { date: '2026-01-08', tss: 0, type: 'run' },
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── 2. Band rendering (English) ───────────────────────────────────────────
describe('WeeklyVolumeStreakCard — band rendering (en)', () => {
  it('NO_STREAK: badge + hint', () => {
    renderCard({ log: NO_STREAK_LOG })
    expect(screen.getByText('NO STREAK')).toBeInTheDocument()
    expect(screen.getByText(/No consecutive weeks above your own mean/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-streak-band')).toBe('NO_STREAK')
    expect(region.getAttribute('data-longest-streak-weeks')).toBe('1')
  })

  it('BUILDING: badge + hint', () => {
    renderCard({ log: BUILDING_LOG })
    expect(screen.getByText('BUILDING')).toBeInTheDocument()
    expect(screen.getByText(/short run of weeks/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-streak-band')).toBe('BUILDING')
    expect(region.getAttribute('data-longest-streak-weeks')).toBe('3')
  })

  it('STRONG_MOMENTUM: badge + hint', () => {
    renderCard({ log: STRONG_LOG })
    expect(screen.getByText('STRONG MOMENTUM')).toBeInTheDocument()
    expect(screen.getByText(/genuine training momentum/i.source ? /genuine training momentum/i : /momentum/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-streak-band')).toBe('STRONG_MOMENTUM')
    expect(region.getAttribute('data-longest-streak-weeks')).toBe('5')
  })

  it('PEAK_BLOCK: badge + hint', () => {
    renderCard({ log: PEAK_BLOCK_LOG })
    expect(screen.getByText('PEAK BLOCK')).toBeInTheDocument()
    expect(screen.getByText(/Sustained 6\+ weeks/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-streak-band')).toBe('PEAK_BLOCK')
    expect(region.getAttribute('data-longest-streak-weeks')).toBe('8')
  })
})

// ─── 3. Bilingual (Turkish) ────────────────────────────────────────────────
describe('WeeklyVolumeStreakCard — Turkish', () => {
  it('renders Turkish title', () => {
    renderCard({ log: BUILDING_LOG }, 'tr')
    expect(screen.getByText('HACİM MOMENTUMU')).toBeInTheDocument()
  })

  it('renders English title', () => {
    renderCard({ log: BUILDING_LOG })
    expect(screen.getByText('VOLUME MOMENTUM')).toBeInTheDocument()
  })

  it('renders Turkish band badges', () => {
    renderCard({ log: STRONG_LOG }, 'tr')
    expect(screen.getByText('GÜÇLÜ MOMENTUM')).toBeInTheDocument()
  })

  it('renders Turkish PEAK_BLOCK hint', () => {
    renderCard({ log: PEAK_BLOCK_LOG }, 'tr')
    expect(screen.getByText(/Kendi ortalamanın üzerinde 6\+ haftalık/i)).toBeInTheDocument()
  })

  it('renders Turkish "Right now" line', () => {
    renderCard({ log: PEAK_BLOCK_LOG }, 'tr')
    expect(screen.getByText(/Şu an: \d+ haftalık seri/)).toBeInTheDocument()
  })
})

// ─── 4. Stat lines ─────────────────────────────────────────────────────────
describe('WeeklyVolumeStreakCard — stat lines', () => {
  it('shows current streak line (en)', () => {
    renderCard({ log: BUILDING_LOG })
    expect(screen.getByText(/Right now: \d+-week streak/i)).toBeInTheDocument()
  })

  it('shows baseline line (en)', () => {
    renderCard({ log: BUILDING_LOG })
    expect(screen.getByText(/Baseline: \d/i)).toBeInTheDocument()
    expect(screen.getByText(/TSS\/wk/i)).toBeInTheDocument()
  })

  it('shows total at-or-above weeks line (en)', () => {
    renderCard({ log: BUILDING_LOG })
    expect(screen.getByText(/Total at-or-above:/i)).toBeInTheDocument()
  })
})

// ─── 5. A11y + data anchors ────────────────────────────────────────────────
describe('WeeklyVolumeStreakCard — a11y + data anchors', () => {
  it('exposes role="region" with English aria-label', () => {
    renderCard({ log: BUILDING_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/longest consecutive run/i)
  })

  it('exposes role="region" with Turkish aria-label', () => {
    renderCard({ log: BUILDING_LOG }, 'tr')
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/ortalamanın üzerindeki/i)
  })

  it('exposes data-card="weekly-volume-streak" on root', () => {
    renderCard({ log: BUILDING_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-card')).toBe('weekly-volume-streak')
  })

  it('exposes all numeric data attributes on root', () => {
    renderCard({ log: STRONG_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-streak-band')).toBe('STRONG_MOMENTUM')
    expect(region.getAttribute('data-longest-streak-weeks')).toBe('5')
    expect(region.getAttribute('data-lookback-weeks')).toBe('26')
    expect(region.getAttribute('data-current-streak-weeks')).not.toBeNull()
    expect(region.getAttribute('data-total-at-or-above-weeks')).not.toBeNull()
    expect(region.getAttribute('data-baseline-tss')).not.toBeNull()
  })

  it('renders 26 weekly mini-bars and a baseline line', () => {
    const { container } = renderCard({ log: BUILDING_LOG })
    const rects = container.querySelectorAll('rect[data-week-start]')
    expect(rects.length).toBe(26)
    const line = container.querySelector('line[data-baseline-line]')
    expect(line).not.toBeNull()
  })

  it('renders citation footer', () => {
    renderCard({ log: BUILDING_LOG })
    expect(screen.getByText(/Bompa 2018; Issurin 2010/)).toBeInTheDocument()
  })
})
