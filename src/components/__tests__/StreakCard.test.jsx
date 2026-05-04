// @vitest-environment jsdom
// ─── StreakCard.test.jsx — render tests for v8.75.0 streak card ────────────
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import StreakCard from '../dashboard/StreakCard.jsx'

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <StreakCard {...props} />
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

// ─── Fixture builders ────────────────────────────────────────────────────────
function trainingEntry(date) {
  return { date, type: 'easy', duration: 60, tss: 50, rpe: 4 }
}

// Build a log spanning ≥14 days so reliable=true, with explicit training-day set.
// trainingOffsets: array of "days back from today" that count as training entries.
// spanDays: ensures earliest log date is at least spanDays back (for reliability).
function makeLog({ trainingOffsets = [], spanDays = 30 }) {
  const today = todayStr()
  const log = []
  for (const off of trainingOffsets) {
    log.push(trainingEntry(addDays(today, -off)))
  }
  // Ensure span ≥14 days even if no training that far back: add a non-training
  // anchor at the far edge if needed. The lib's reliability uses allDates,
  // which includes any entry with valid date — even with tss=0/duration=0.
  const earliest = trainingOffsets.length ? Math.max(...trainingOffsets) : 0
  if (earliest < spanDays) {
    log.push({ date: addDays(today, -spanDays), type: 'note', duration: 0, tss: 0 })
  }
  return log
}

describe('StreakCard — insufficient data', () => {
  it('renders insufficient-data notice when log span <14 days', () => {
    // Only 2 entries within 5 days → span=5
    const today = todayStr()
    const log = [
      trainingEntry(today),
      trainingEntry(addDays(today, -4)),
    ]
    renderCard({ log })
    expect(screen.getByText(/Log 14\+ days of history/i)).toBeInTheDocument()
  })

  it('renders TR insufficient-data notice when lang=tr', () => {
    const today = todayStr()
    const log = [
      trainingEntry(today),
      trainingEntry(addDays(today, -4)),
    ]
    renderCard({ log }, 'tr')
    expect(screen.getByText(/Seri takibi için 14\+ günlük günlük geçmişi kaydet/i)).toBeInTheDocument()
  })
})

describe('StreakCard — band classification', () => {
  it('renders celebrating band for 3-day streak', () => {
    // streak = today + yesterday + 2d-ago = 3
    const log = makeLog({ trainingOffsets: [0, 1, 2], spanDays: 30 })
    renderCard({ log })
    expect(screen.getByText('BUILDING')).toBeInTheDocument()
  })

  it('renders consistent band for 10-day streak', () => {
    const log = makeLog({ trainingOffsets: [0,1,2,3,4,5,6,7,8,9], spanDays: 30 })
    renderCard({ log })
    expect(screen.getByText('CONSISTENT')).toBeInTheDocument()
  })

  it('renders risk band for 22-day streak', () => {
    const offs = []
    for (let i = 0; i < 22; i++) offs.push(i)
    const log = makeLog({ trainingOffsets: offs, spanDays: 30 })
    renderCard({ log })
    expect(screen.getByText('RISK')).toBeInTheDocument()
  })

  it('renders recovery band when last train was yesterday', () => {
    // No training today, but trained yesterday → currentStreak=0, recovery
    const log = makeLog({ trainingOffsets: [1, 3, 5, 7], spanDays: 30 })
    renderCard({ log })
    expect(screen.getByText('RECOVERY')).toBeInTheDocument()
  })

  it('renders broken band when last train >1 day ago', () => {
    const log = makeLog({ trainingOffsets: [4, 6, 8, 10], spanDays: 30 })
    renderCard({ log })
    expect(screen.getByText('BROKEN')).toBeInTheDocument()
  })
})

describe('StreakCard — bilingual', () => {
  it('renders English title when lang=en', () => {
    const log = makeLog({ trainingOffsets: [0, 1, 2], spanDays: 30 })
    renderCard({ log })
    expect(screen.getByText('TRAINING STREAK — 90D')).toBeInTheDocument()
  })

  it('renders Turkish title and band label when lang=tr', () => {
    const log = makeLog({ trainingOffsets: [0, 1, 2], spanDays: 30 })
    renderCard({ log }, 'tr')
    expect(screen.getByText('GÜNLÜK SERİ — 90G')).toBeInTheDocument()
    expect(screen.getByText('İNŞA')).toBeInTheDocument()
  })
})

describe('StreakCard — a11y + structure', () => {
  it('card root has role=region with bilingual aria-label', () => {
    const log = makeLog({ trainingOffsets: [0, 1, 2], spanDays: 30 })
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Training streak/i)
  })

  it('renders the citation footer', () => {
    const log = makeLog({ trainingOffsets: [0, 1, 2], spanDays: 30 })
    renderCard({ log })
    expect(screen.getByText(/Habit-formation training research; Foster 2001 monotony/)).toBeInTheDocument()
  })
})

describe('StreakCard — numeric rendering', () => {
  it('renders the trainingDaysIn28d sub-line', () => {
    // 5 training days within last 28 → "5/28 training days"
    const log = makeLog({ trainingOffsets: [0, 1, 2, 5, 9], spanDays: 30 })
    renderCard({ log })
    expect(screen.getByText(/5\/28 training days/i)).toBeInTheDocument()
  })

  it('renders longestStreakIn90d big number', () => {
    // current streak 3, but a longer 5-day run earlier (offsets 10..14)
    const log = makeLog({
      trainingOffsets: [0, 1, 2, 10, 11, 12, 13, 14],
      spanDays: 30,
    })
    renderCard({ log })
    // "BEST 90D" label exists, and best=5 should appear as a 32px number.
    expect(screen.getByText(/BEST 90D/i)).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('conditionally shows daysSinceLastRest line when non-null', () => {
    // Streak=3 with rest days in last 90 → daysSinceLastRest non-null
    const log = makeLog({ trainingOffsets: [0, 1, 2], spanDays: 30 })
    renderCard({ log })
    expect(screen.getByText(/Last rest \d+d ago/i)).toBeInTheDocument()
  })
})
