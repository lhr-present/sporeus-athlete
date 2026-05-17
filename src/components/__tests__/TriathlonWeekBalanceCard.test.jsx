// @vitest-environment jsdom
// ─── TriathlonWeekBalanceCard.test.jsx ─────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TriathlonWeekBalanceCard from '../dashboard/TriathlonWeekBalanceCard.jsx'

// Wednesday 2026-05-13 — the Mon-Sun week containing today is
// 2026-05-11 .. 2026-05-17.  Tests build synthetic log entries inside
// that range so the card's currentWeekISO() picks them up.
const WEEK = {
  Mon: '2026-05-11',
  Tue: '2026-05-12',
  Wed: '2026-05-13',
  Thu: '2026-05-14',
  Fri: '2026-05-15',
  Sat: '2026-05-16',
  Sun: '2026-05-17',
}

beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-13T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <TriathlonWeekBalanceCard {...props} />
    </LangCtx.Provider>
  )
}

// A balanced 7-session triathlon week (mirrors the "passes a balanced
// week" fixture in triathlonWeekBalance.test.js, dated into this week).
function balancedWeekLog() {
  return [
    { date: WEEK.Mon, type: 'rest', duration: 0, zones: {} },
    { date: WEEK.Tue, type: 'run',  duration: 60, zones: { Z4: 40 } },           // hard
    { date: WEEK.Wed, type: 'bike', duration: 75, zones: { Z2: 60 } },           // easy
    { date: WEEK.Thu, type: 'swim', duration: 55, zones: { Z5: 30 } },           // hard
    { date: WEEK.Fri, type: 'swim', duration: 35, zones: { Z1: 35 } },           // easy
    { date: WEEK.Sat, type: 'bike', duration: 180, zones: { Z2: 150 } },          // long
    { date: WEEK.Sun, type: 'run',  duration: 120, zones: { Z1: 110 } },          // long
  ]
}

// Unbalanced: hard Tue + hard Wed (R1-hard-adjacent violation).
function unbalancedWeekLog() {
  return [
    { date: WEEK.Mon, type: 'rest', duration: 0, zones: {} },
    { date: WEEK.Tue, type: 'run',  duration: 60, zones: { Z4: 40 } },           // hard
    { date: WEEK.Wed, type: 'swim', duration: 55, zones: { Z5: 30 } },           // hard — adjacent
    { date: WEEK.Thu, type: 'bike', duration: 60, zones: { Z2: 60 } },           // easy
    { date: WEEK.Fri, type: 'rest', duration: 0, zones: {} },
    { date: WEEK.Sat, type: 'bike', duration: 180, zones: { Z2: 150 } },          // long
    { date: WEEK.Sun, type: 'run',  duration: 90, zones: { Z1: 80 } },            // easy
  ]
}

describe('TriathlonWeekBalanceCard — sport gating', () => {
  it('renders nothing for a non-triathlete profile (single-sport runner, no findings)', () => {
    // Pure-runner profile + run-only log (2 distinct → <3) — gate should
    // close even though the log is empty of triathlon content.
    const log = [
      { date: WEEK.Tue, type: 'run', duration: 60, zones: { Z4: 40 } },
      { date: WEEK.Thu, type: 'run', duration: 50, zones: { Z2: 50 } },
    ]
    renderCard({ profile: { primarySport: 'running' }, log })
    expect(screen.queryByRole('region', { name: /Triathlon weekly balance audit/i })).toBeNull()
    expect(document.querySelector('[data-triathlon-week-balance-card]')).toBeNull()
  })

  it('renders nothing for triathlete with empty log', () => {
    renderCard({ profile: { primarySport: 'triathlon' }, log: [] })
    expect(document.querySelector('[data-triathlon-week-balance-card]')).toBeNull()
  })

  it('renders nothing for a triathlete whose current week is balanced', () => {
    renderCard({ profile: { primarySport: 'triathlon' }, log: balancedWeekLog() })
    expect(document.querySelector('[data-triathlon-week-balance-card]')).toBeNull()
  })
})

describe('TriathlonWeekBalanceCard — violations', () => {
  it('renders the card with the R1-hard-adjacent violation for an unbalanced week', () => {
    renderCard({ profile: { primarySport: 'triathlon' }, log: unbalancedWeekLog() })
    const region = screen.getByRole('region', { name: /Triathlon weekly balance audit/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-triathlon-week-balance-card')).not.toBeNull()

    // Violation list present and contains R1
    const list = document.querySelector('[data-triathlon-week-balance-violations]')
    expect(list).not.toBeNull()
    const r1 = list.querySelector('[data-violation-rule="R1-hard-adjacent"]')
    expect(r1).not.toBeNull()
    expect(r1.textContent).toMatch(/Tue/)
    expect(r1.textContent).toMatch(/Wed/)
    expect(r1.textContent).toMatch(/Lambert 1997/)

    // Citation footer
    const cite = document.querySelector('[data-triathlon-week-balance-citation]')
    expect(cite).not.toBeNull()
    expect(cite.textContent).toMatch(/Lambert 1997/)
    expect(cite.textContent).toMatch(/Seiler 2010/)
    expect(cite.textContent).toMatch(/Mujika 2003/)
  })

  it('activates the ≥3-discipline gate even without primarySport=triathlon', () => {
    // No primarySport, but log spans 3 disciplines + has a violation.
    const log = unbalancedWeekLog()
    renderCard({ profile: {}, log })
    expect(document.querySelector('[data-triathlon-week-balance-card]')).not.toBeNull()
  })
})

describe('TriathlonWeekBalanceCard — bilingual', () => {
  it('renders Turkish copy when lang=tr', () => {
    renderCard(
      { profile: { primarySport: 'triathlon' }, log: unbalancedWeekLog() },
      'tr'
    )
    const region = screen.getByRole('region', { name: /Triatlon haftalık denge denetimi/i })
    expect(region).toBeInTheDocument()
    // Title in Turkish
    expect(region.textContent).toMatch(/TRİATLON HAFTA DENGESİ/)
    // Violation message in Turkish (validator returns "Ardışık günlerde sert seans …")
    expect(region.textContent).toMatch(/Ardışık günlerde sert seans/)
  })
})
