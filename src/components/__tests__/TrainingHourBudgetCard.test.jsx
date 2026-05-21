// @vitest-environment jsdom
// ─── TrainingHourBudgetCard.test.jsx — Dashboard surface tests ───────────────
//
// Covers: null/INSUFFICIENT_DATA states, each of LIGHT / AMATEUR / COMMITTED /
// NEAR_PRO bands, bilingual (EN + TR), citation footer, accessibility, and
// the 12-bar chart with a band-target reference line.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TrainingHourBudgetCard from '../dashboard/TrainingHourBudgetCard.jsx'

// Wednesday — mondayOf('2026-05-13') = '2026-05-11'.
const TODAY = '2026-05-13'

const WEEK_MONDAYS = [
  '2026-02-23', '2026-03-02', '2026-03-09', '2026-03-16',
  '2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13',
  '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11',
]

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
      <TrainingHourBudgetCard log={log} />
    </LangCtx.Provider>
  )
}

// Place a single session on the Saturday of each week with the given duration
// in minutes. 0/null skips the week.
function logFromDurations(durations) {
  const log = []
  for (let i = 0; i < WEEK_MONDAYS.length; i++) {
    const dur = durations[i]
    if (!dur || dur <= 0) continue
    const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
    mon.setUTCDate(mon.getUTCDate() + 5) // Saturday
    log.push({
      date: mon.toISOString().slice(0, 10),
      durationMin: dur,
    })
  }
  return log
}

// ─── null gate ─────────────────────────────────────────────────────────────

describe('TrainingHourBudgetCard — null gate (today resolvable)', () => {
  it('renders SOMETHING (INSUFFICIENT_DATA card) on empty log', () => {
    const { container } = renderCard([])
    // The pure-fn returns INSUFFICIENT_DATA when today is valid and log is
    // empty — so the card should still render.
    expect(container.firstChild).not.toBeNull()
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
  })

  it('renders INSUFFICIENT_DATA on null log', () => {
    renderCard(null)
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
  })
})

// ─── INSUFFICIENT_DATA state ───────────────────────────────────────────────

describe('TrainingHourBudgetCard — INSUFFICIENT_DATA state', () => {
  it('renders INSUFFICIENT_DATA when fewer than 6 weeks have any hours', () => {
    renderCard(logFromDurations([0, 0, 0, 0, 0, 0, 0, 60, 60, 60, 60, 60]))
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    expect(card.textContent).toMatch(/INSUFFICIENT DATA/)
    expect(card.textContent).toMatch(/at least 6 weeks/i)
  })

  it('renders INSUFFICIENT_DATA in Turkish', () => {
    renderCard(logFromDurations([0, 0, 0, 0, 0, 0, 0, 60, 60, 60, 60, 60]), 'tr')
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    expect(card.textContent).toMatch(/YETERSİZ VERİ/)
    expect(card.textContent).toMatch(/en az 6 hafta/i)
  })
})

// ─── LIGHT band ────────────────────────────────────────────────────────────

describe('TrainingHourBudgetCard — LIGHT band', () => {
  it('renders LIGHT when mean < 4h/wk', () => {
    renderCard(logFromDurations(Array(12).fill(120))) // 2h/wk
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card.getAttribute('data-band')).toBe('LIGHT')
    expect(card.getAttribute('data-mean-hours-per-week')).toBe('2')
    expect(card.textContent).toMatch(/LIGHT/)
    expect(card.textContent).toMatch(/recreational pace/i)
  })
})

// ─── AMATEUR band ──────────────────────────────────────────────────────────

describe('TrainingHourBudgetCard — AMATEUR band', () => {
  it('renders AMATEUR for 6h/wk mean', () => {
    renderCard(logFromDurations(Array(12).fill(360))) // 6h/wk
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card.getAttribute('data-band')).toBe('AMATEUR')
    expect(card.getAttribute('data-mean-hours-per-week')).toBe('6')
    expect(card.textContent).toMatch(/AMATEUR/)
    expect(card.textContent).toMatch(/Typical recreational athlete/i)
  })
})

// ─── COMMITTED band ────────────────────────────────────────────────────────

describe('TrainingHourBudgetCard — COMMITTED band', () => {
  it('renders COMMITTED for 10h/wk mean', () => {
    renderCard(logFromDurations(Array(12).fill(600))) // 10h/wk
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card.getAttribute('data-band')).toBe('COMMITTED')
    expect(card.getAttribute('data-mean-hours-per-week')).toBe('10')
    expect(card.textContent).toMatch(/COMMITTED/)
    expect(card.textContent).toMatch(/serious amateur load/i)
  })
})

// ─── NEAR_PRO band ─────────────────────────────────────────────────────────

describe('TrainingHourBudgetCard — NEAR_PRO band', () => {
  it('renders NEAR_PRO for 15h/wk mean', () => {
    renderCard(logFromDurations(Array(12).fill(900))) // 15h/wk
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card.getAttribute('data-band')).toBe('NEAR_PRO')
    expect(card.getAttribute('data-mean-hours-per-week')).toBe('15')
    expect(card.textContent).toMatch(/NEAR-PRO/)
    expect(card.textContent).toMatch(/extraordinary commitment/i)
  })
})

// ─── per-bar data anchors + target line ────────────────────────────────────

describe('TrainingHourBudgetCard — chart + target line', () => {
  it('renders exactly 12 week bars Monday oldest-first', () => {
    renderCard(logFromDurations(Array(12).fill(360)))
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars.length).toBe(12)
    const weekStarts = Array.from(bars).map(b => b.getAttribute('data-week-start'))
    expect(weekStarts).toEqual(WEEK_MONDAYS)
    for (const bar of bars) {
      expect(bar.getAttribute('data-week-hours')).toBe('6')
    }
  })

  it('renders a target-line element with the next-band-floor in data-target-hours', () => {
    renderCard(logFromDurations(Array(12).fill(360))) // AMATEUR
    const line = document.querySelector('[data-target-line]')
    expect(line).not.toBeNull()
    // AMATEUR band → next floor = COMMITTED = 8 h/wk
    expect(line.getAttribute('data-target-hours')).toBe('8')
  })

  it('target line moves to NEAR_PRO floor (12) for COMMITTED users', () => {
    renderCard(logFromDurations(Array(12).fill(600))) // COMMITTED
    const line = document.querySelector('[data-target-line]')
    expect(line.getAttribute('data-target-hours')).toBe('12')
  })
})

// ─── citation footer ──────────────────────────────────────────────────────

describe('TrainingHourBudgetCard — citation', () => {
  it('renders the Hellard 2019; Mujika 2014 citation', () => {
    renderCard(logFromDurations(Array(12).fill(360)))
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card.textContent).toMatch(/Hellard 2019/)
    expect(card.textContent).toMatch(/Mujika 2014/)
  })
})

// ─── accessibility ────────────────────────────────────────────────────────

describe('TrainingHourBudgetCard — accessibility', () => {
  it('exposes role=region with bilingual aria-label (EN)', () => {
    renderCard(logFromDurations(Array(12).fill(360)), 'en')
    const region = screen.getByRole('region', { name: /Weekly hour budget card/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes role=region with bilingual aria-label (TR)', () => {
    renderCard(logFromDurations(Array(12).fill(360)), 'tr')
    const region = screen.getByRole('region', { name: /Haftalık saat bütçesi kartı/i })
    expect(region).toBeInTheDocument()
  })
})

// ─── bilingual (Turkish) ──────────────────────────────────────────────────

describe('TrainingHourBudgetCard — bilingual (Turkish)', () => {
  it('renders Turkish heading + AMATEUR label + Turkish hint', () => {
    renderCard(logFromDurations(Array(12).fill(360)), 'tr')
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card.textContent).toMatch(/HAFTALIK SAAT BÜTÇESİ · 12H/)
    expect(card.textContent).toMatch(/AMATÖR/)
    expect(card.textContent).toMatch(/Tipik rekreasyonel sporcu/i)
  })

  it('renders Turkish label + hint for NEAR_PRO band', () => {
    renderCard(logFromDurations(Array(12).fill(900)), 'tr')
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card.getAttribute('data-band')).toBe('NEAR_PRO')
    expect(card.textContent).toMatch(/PROFESYONELE YAKIN/)
    expect(card.textContent).toMatch(/olağanüstü adanmışlık/i)
  })

  it('renders Turkish label + hint for COMMITTED band', () => {
    renderCard(logFromDurations(Array(12).fill(600)), 'tr')
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card.getAttribute('data-band')).toBe('COMMITTED')
    expect(card.textContent).toMatch(/ADANMIŞ/)
    expect(card.textContent).toMatch(/Ciddi amatör yük/i)
  })
})

// ─── headline numbers ─────────────────────────────────────────────────────

describe('TrainingHourBudgetCard — headline numbers', () => {
  it('shows mean / peak / total / trend in the header row', () => {
    renderCard(logFromDurations(Array(12).fill(360)))
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card.getAttribute('data-mean-hours-per-week')).toBe('6')
    expect(card.getAttribute('data-max-hours-per-week')).toBe('6')
    expect(card.getAttribute('data-total-hours')).toBe('72')
    expect(card.getAttribute('data-trend-delta-per-week')).toBe('0')
    expect(card.textContent).toMatch(/6\.0h/)
    expect(card.textContent).toMatch(/72\.0h/)
    expect(card.textContent).toMatch(/0\.00h\/wk/)
  })

  it('shows a positive trend arrow when hours ramp up', () => {
    const durations = []
    for (let i = 1; i <= 12; i++) durations.push(i * 60)
    renderCard(logFromDurations(durations))
    const card = document.querySelector('[data-card="training-hour-budget"]')
    // slope ≈ +1.0 h/wk
    expect(card.textContent).toMatch(/↑/)
    expect(card.textContent).toMatch(/\+1\.00h\/wk/)
  })

  it('shows a negative trend arrow when hours decline', () => {
    const durations = []
    for (let i = 12; i >= 1; i--) durations.push(i * 60)
    renderCard(logFromDurations(durations))
    const card = document.querySelector('[data-card="training-hour-budget"]')
    expect(card.textContent).toMatch(/↓/)
    expect(card.textContent).toMatch(/-1\.00h\/wk/)
  })
})
