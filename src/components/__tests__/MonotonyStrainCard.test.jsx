// @vitest-environment jsdom
// ─── MonotonyStrainCard.test.jsx — render tests for v8.71.0 monotony card ────
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import MonotonyStrainCard from '../dashboard/MonotonyStrainCard.jsx'

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <MonotonyStrainCard {...props} />
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

// Build a 7-day log from a TSS-per-day array (index 0 = today-6, last = today).
function makeWeekLog(tssPerDay) {
  const today = todayStr()
  const log = []
  for (let i = 0; i < tssPerDay.length; i++) {
    const date = addDays(today, -(tssPerDay.length - 1 - i))
    log.push({ date, type: 'easy', rpe: 4, duration: 60, tss: tssPerDay[i] })
  }
  return log
}

// Build a sparse log with only the specified (offset, tss) pairs (offset=days back from today).
function makeSparseLog(pairs) {
  const today = todayStr()
  return pairs.map(([offset, tss]) => ({
    date: addDays(today, -offset), type: 'easy', rpe: 4, duration: 60, tss,
  }))
}

// Low band: high variability, monotony < 1.5
const LOW_FIXTURE   = [20, 200, 30, 180, 40, 220, 50]
// Moderate band: monotony in [1.5, 2.0) under population stdev (÷n, Foster 2001)
const MOD_FIXTURE   = [40, 120, 20, 90, 160, 30, 80]
// High band by monotony: near-uniform daily TSS, monotony >> 2
const HIGH_MONO_FIX = [70, 70, 70, 70, 70, 70, 75]
// High band by strain only: strain > 6000 with monotony < 2
const HIGH_STRAIN_FIX = [1200, 0, 1000, 1100, 800, 1100, 0]

describe('MonotonyStrainCard — insufficient data', () => {
  it('renders insufficient-data notice when fewer than 5 distinct days', () => {
    renderCard({ log: makeSparseLog([[0, 100], [2, 80]]) })
    expect(
      screen.getByText(/Log 5\+ distinct days in the 7-day window/i)
    ).toBeInTheDocument()
  })

  it('renders TR insufficient-data notice when lang=tr', () => {
    renderCard({ log: makeSparseLog([[0, 100], [2, 80]]) }, 'tr')
    expect(
      screen.getByText(/Monotonluk için 7 günlük pencerede 5\+ farklı gün kaydet/i)
    ).toBeInTheDocument()
  })

  it('renders insufficient-data notice for empty log', () => {
    renderCard({ log: [] })
    expect(
      screen.getByText(/Log 5\+ distinct days in the 7-day window/i)
    ).toBeInTheDocument()
  })
})

describe('MonotonyStrainCard — band classification', () => {
  it('renders LOW band when monotony < 1.5', () => {
    renderCard({ log: makeWeekLog(LOW_FIXTURE) })
    expect(screen.getByText('LOW')).toBeInTheDocument()
    expect(screen.getByText(/Healthy training variability/i)).toBeInTheDocument()
  })

  it('renders MODERATE band when monotony in [1.5, 2.0)', () => {
    renderCard({ log: makeWeekLog(MOD_FIXTURE) })
    expect(screen.getByText('MODERATE')).toBeInTheDocument()
    expect(screen.getByText(/Monotony rising/i)).toBeInTheDocument()
  })

  it('renders HIGH band when monotony >= 2.0 (uniform TSS)', () => {
    renderCard({ log: makeWeekLog(HIGH_MONO_FIX) })
    expect(screen.getByText('HIGH')).toBeInTheDocument()
    expect(screen.getByText(/Overtraining risk/i)).toBeInTheDocument()
  })

  it('renders HIGH band when strain > 6000 even if monotony < 2', () => {
    renderCard({ log: makeWeekLog(HIGH_STRAIN_FIX) })
    expect(screen.getByText('HIGH')).toBeInTheDocument()
  })
})

describe('MonotonyStrainCard — bilingual', () => {
  it('renders English title when lang=en', () => {
    renderCard({ log: makeWeekLog(MOD_FIXTURE) })
    expect(screen.getByText('MONOTONY & STRAIN — 7D')).toBeInTheDocument()
  })

  it('renders Turkish title and band label when lang=tr', () => {
    renderCard({ log: makeWeekLog(MOD_FIXTURE) }, 'tr')
    expect(screen.getByText('MONOTONLUK & YÜK — 7G')).toBeInTheDocument()
    expect(screen.getByText('ORTA')).toBeInTheDocument()
  })
})

describe('MonotonyStrainCard — a11y + structure', () => {
  it('card root has role=region with bilingual aria-label (en)', () => {
    renderCard({ log: makeWeekLog(MOD_FIXTURE) })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Monotony and strain/i)
  })

  it('card root has TR aria-label when lang=tr', () => {
    renderCard({ log: makeWeekLog(MOD_FIXTURE) }, 'tr')
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Monotonluk ve yük/i)
  })

  it('renders the citation footer', () => {
    renderCard({ log: makeWeekLog(MOD_FIXTURE) })
    expect(screen.getByText(/Foster 2001/)).toBeInTheDocument()
  })
})

describe('MonotonyStrainCard — numeric rendering', () => {
  it('monotony renders to 2 decimals', () => {
    renderCard({ log: makeWeekLog(MOD_FIXTURE) })
    // moderate fixture monotony ≈ 1.63 (population stdev, Foster 2001)
    expect(screen.getByText(/^1\.\d{2}$/)).toBeInTheDocument()
  })

  it('renders weekTotalTSS and daysWithLoad in stats line', () => {
    renderCard({ log: makeWeekLog(MOD_FIXTURE) })
    // sum of MOD_FIXTURE = 540, all 7 days loaded
    expect(screen.getByText(/Week TSS 540 · 7\/7 days loaded/i)).toBeInTheDocument()
  })

  it('renders TR weekTotalTSS line when lang=tr', () => {
    renderCard({ log: makeWeekLog(MOD_FIXTURE) }, 'tr')
    expect(screen.getByText(/Haftalık TSS 540 · 7\/7 gün yüklü/i)).toBeInTheDocument()
  })
})
