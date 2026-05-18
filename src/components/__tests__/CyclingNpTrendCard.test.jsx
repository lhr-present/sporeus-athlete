// @vitest-environment jsdom
// ─── CyclingNpTrendCard.test.jsx — render tests for the 90d NP trend card ───
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CyclingNpTrendCard from '../dashboard/CyclingNpTrendCard.jsx'

const TODAY = '2026-05-15'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

/** Return YYYY-MM-DD `n` days before TODAY. */
function daysAgo(n) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <CyclingNpTrendCard {...props} />
    </LangCtx.Provider>
  )
}

// Synthetic log with clear rising 60-min NP across the 90d window.
function risingLog() {
  return [
    { date: daysAgo(85), type: 'bike', np: 200, duration: 60 },
    { date: daysAgo(80), type: 'bike', np: 195, duration: 60 },
    { date: daysAgo(55), type: 'bike', np: 205, duration: 60 },
    { date: daysAgo(20), type: 'bike', np: 220, duration: 60 },
    { date: daysAgo(5),  type: 'bike', np: 225, duration: 60 },
  ]
}

describe('CyclingNpTrendCard — sport gating', () => {
  it('renders nothing for a non-cyclist (no FTP, no bike sessions)', () => {
    const { container } = renderCard({
      log:     [{ date: daysAgo(10), type: 'run', np: 250, duration: 60 }],
      profile: { primarySport: 'Running' },
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when athlete is a cyclist but has no NP-tagged data', () => {
    const { container } = renderCard({
      log:     [{ date: daysAgo(10), type: 'bike', duration: 60, tss: 75 }],
      profile: { ftp: 250 },
    })
    expect(container.firstChild).toBeNull()
  })
})

describe('CyclingNpTrendCard — rising trend render', () => {
  it('renders rising trend with green arrow + headline NP', () => {
    renderCard({
      log:     risingLog(),
      profile: { ftp: 250 },
    })
    const region = screen.getByRole('region', { name: /Best NP by duration over 90 days/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-overall-trend')).toBe('rising')
    // Headline shows the recent best at the 60-min bucket (=225W)
    expect(region.textContent).toMatch(/225/)
    expect(region.textContent).toMatch(/rising/i)
    // Citation present
    expect(region.textContent).toMatch(/Coggan/)
  })

  it('exposes data-overall-trend attribute matching the trend', () => {
    renderCard({
      log:     risingLog(),
      profile: { ftp: 250 },
    })
    const card = document.querySelector('[data-cycling-np-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-overall-trend')).toBe('rising')
  })

  it('renders one row per bucket that has data', () => {
    // Provide data across all three buckets (5/20/60 min)
    renderCard({
      log: [
        { date: daysAgo(80), type: 'bike', np: 400, duration: 8 },
        { date: daysAgo(10), type: 'bike', np: 410, duration: 8 },
        { date: daysAgo(70), type: 'bike', np: 300, duration: 25 },
        { date: daysAgo(15), type: 'bike', np: 310, duration: 25 },
        { date: daysAgo(65), type: 'bike', np: 240, duration: 75 },
        { date: daysAgo(20), type: 'bike', np: 250, duration: 75 },
      ],
      profile: { ftp: 250 },
    })
    const rows = document.querySelectorAll('[data-bucket-min]')
    expect(rows.length).toBe(3)
    const mins = Array.from(rows).map(r => r.getAttribute('data-bucket-min'))
    expect(mins).toEqual(expect.arrayContaining(['5', '20', '60']))
  })
})

describe('CyclingNpTrendCard — bilingual', () => {
  it("renders Turkish heading 'NP TRENDİ · 90G' when lang='tr'", () => {
    renderCard({
      log:     risingLog(),
      profile: { ftp: 250 },
    }, 'tr')
    const region = screen.getByRole('region', { name: /90 günlük en iyi NP trendi/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/NP TRENDİ · 90G/)
    expect(region.textContent).toMatch(/yükseliyor/i)
  })
})
