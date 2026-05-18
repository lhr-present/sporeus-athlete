// @vitest-environment jsdom
// ─── RowingSplitConsistencyCard.test.jsx — render tests ──────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RowingSplitConsistencyCard from '../dashboard/RowingSplitConsistencyCard.jsx'

beforeEach(() => {
  // Fix "today" so the 28-day window includes the synthesised sessions.
  vi.setSystemTime(new Date('2026-05-17T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard({ log = [], profile = {} } = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <RowingSplitConsistencyCard log={log} profile={profile} />
    </LangCtx.Provider>
  )
}

// Helper — steady-state rowing session. distance metres, duration seconds.
const mkRow = (date, distance, duration, rpe = 5) => ({
  date, type: 'row', sport: 'rowing', distance, duration, rpe,
})

// 4 × 2000 m at very tight splits → ELITE band, ≥1 bucket.
const eliteLog = [
  mkRow('2026-05-10', 2000, 480),
  mkRow('2026-05-12', 2000, 481),
  mkRow('2026-05-14', 2000, 482),
  mkRow('2026-05-16', 2000, 483),
]

describe('RowingSplitConsistencyCard — gating', () => {
  it('(a) renders nothing for a non-rower (no rowing sessions, no rowing primarySport)', () => {
    const { container } = renderCard({
      log: [{ date: '2026-05-10', type: 'bike', sport: 'cycling', distance: 30000, duration: 3600, rpe: 5 }],
      profile: { primarySport: 'Cycling' },
    })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-rowing-split-consistency-card]')).toBeNull()
  })

  it('renders nothing for an empty log without a rowing profile', () => {
    const { container } = renderCard({ log: [], profile: {} })
    expect(container.firstChild).toBeNull()
  })
})

describe('RowingSplitConsistencyCard — empty/insufficient data', () => {
  it('(b) renders nothing for a rower with insufficient data (no qualifying bucket)', () => {
    // Profile flags the user as a rower, but only 2 same-distance pieces exist.
    const { container } = renderCard({
      log: [
        mkRow('2026-05-10', 2000, 480),
        mkRow('2026-05-12', 2000, 481),
      ],
      profile: { primarySport: 'Rowing' },
    })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-rowing-split-consistency-card]')).toBeNull()
  })

  it('renders nothing when all sessions are recovery paddles (RPE 3)', () => {
    const log = [
      mkRow('2026-05-10', 2000, 480, 3),
      mkRow('2026-05-12', 2000, 481, 3),
      mkRow('2026-05-14', 2000, 482, 3),
    ]
    const { container } = renderCard({ log, profile: { primarySport: 'Rowing' } })
    expect(container.firstChild).toBeNull()
  })
})

describe('RowingSplitConsistencyCard — rendering', () => {
  it('(c) renders the ELITE band in green for tight 4 × 2k splits', () => {
    renderCard({ log: eliteLog, profile: { primarySport: 'Rowing' } })
    const region = screen.getByRole('region', { name: /Rowing split consistency/i })
    expect(region).toBeInTheDocument()
    const card = document.querySelector('[data-rowing-split-consistency-card]')
    expect(card).not.toBeNull()
    // Band attribute
    expect(card.getAttribute('data-consistency-band')).toBe('ELITE')
    // ELITE band pill is green (#5bc25b → rgb(91, 194, 91) after the
    // browser/jsdom serialises inline styles).
    const pill = card.querySelector('[data-band-pill]')
    expect(pill).not.toBeNull()
    expect(pill.textContent).toMatch(/ELITE/)
    // Inline-style check: the pill colour matches the ELITE green band.
    expect(pill.style.color).toBe('rgb(91, 194, 91)')
  })

  it('(d) data-consistency-band attribute matches the band string', () => {
    renderCard({ log: eliteLog, profile: { primarySport: 'Rowing' } })
    const card = document.querySelector('[data-rowing-split-consistency-card]')
    expect(card.getAttribute('data-consistency-band')).toBe('ELITE')
  })

  it('renders a bucket row per qualifying piece-distance bucket', () => {
    renderCard({ log: eliteLog, profile: { primarySport: 'Rowing' } })
    const rows = document.querySelectorAll('[data-bucket-row]')
    expect(rows.length).toBe(1)
    expect(rows[0].getAttribute('data-bucket-distance')).toBe('2000')
  })

  it('detects a rower via log entries when primarySport is unset', () => {
    renderCard({ log: eliteLog, profile: {} })
    expect(document.querySelector('[data-rowing-split-consistency-card]')).not.toBeNull()
  })

  it('renders the citation footer', () => {
    renderCard({ log: eliteLog, profile: { primarySport: 'Rowing' } })
    const card = document.querySelector('[data-rowing-split-consistency-card]')
    expect(card.textContent).toMatch(/Foster 2001/)
    expect(card.textContent).toMatch(/Smith 2012/)
    expect(card.textContent).toMatch(/Steinacker 1993/)
  })

  it('(e) renders Turkish heading "ROWING SPLIT CV · 28G" when lang=tr', () => {
    renderCard({ log: eliteLog, profile: { primarySport: 'Rowing' } }, 'tr')
    const card = document.querySelector('[data-rowing-split-consistency-card]')
    expect(card).not.toBeNull()
    expect(card.textContent).toMatch(/KÜREK SPLIT CV · 28G/)
    // ELITE band → Turkish label "ELİT"
    expect(card.textContent).toMatch(/ELİT/)
  })
})
