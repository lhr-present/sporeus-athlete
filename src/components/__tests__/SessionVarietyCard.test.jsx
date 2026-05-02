// @vitest-environment jsdom
// ─── SessionVarietyCard.test.jsx — render tests for the session-variety card ──
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SessionVarietyCard from '../dashboard/SessionVarietyCard.jsx'

// ─── Render helper with overridable lang ─────────────────────────────────────
function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <SessionVarietyCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Build N most-recent days, one entry per day, via a builder. */
function buildRecentDays(n, builder) {
  const today = todayStr()
  const log = []
  for (let i = n - 1; i >= 0; i--) {
    log.push(builder(addDays(today, -i), i))
  }
  return log
}

// ─── Synthetic intent entry helpers (match classifyIntent rules) ─────────────
const recoveryEntry  = (d) => ({ date: d, type: 'run', duration: 45,  rpe: 2 })
const longEntry      = (d) => ({ date: d, type: 'run', duration: 120, rpe: 4 })
const steadyEntry    = (d) => ({ date: d, type: 'run', duration: 60,  rpe: 5, zones: [10, 70, 10, 5, 5] })
const tempoEntry     = (d) => ({ date: d, type: 'run', duration: 45,  rpe: 6, zones: [5, 10, 60, 20, 5] })
const intervalsEntry = (d) => ({ date: d, type: 'run', duration: 40,  rpe: 8, zones: [0, 10, 10, 50, 30] })

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('SessionVarietyCard — empty / unreliable states', () => {
  it('renders empty state for empty log', () => {
    renderCard({ log: [] })
    expect(
      screen.getByText(/Log 14\+ days of training to see session variety/i)
    ).toBeInTheDocument()
  })

  it('renders empty state for 7-day log (unreliable < 14 distinct days)', () => {
    const log = buildRecentDays(7, recoveryEntry)
    renderCard({ log })
    expect(
      screen.getByText(/Log 14\+ days of training to see session variety/i)
    ).toBeInTheDocument()
  })

  it('renders TR empty-state copy when lang=tr', () => {
    renderCard({ log: [] }, 'tr')
    expect(
      screen.getByText(/Seans çeşitliliğini görmek için 14\+ gün antrenman kaydet/i)
    ).toBeInTheDocument()
  })
})

describe('SessionVarietyCard — low variety', () => {
  it('shows red border + score 1/5 + recommendation for all-recovery 28d', () => {
    const log = buildRecentDays(28, recoveryEntry)
    const { container } = renderCard({ log })

    // Mix score badge
    expect(screen.getByText(/Mix score:\s*1\/5/i)).toBeInTheDocument()
    // Low-variety message
    expect(screen.getByText(/Only 1 session types in last 28 days/i)).toBeInTheDocument()
    // Recommendation surfaces a missing intent
    expect(screen.getByText(/Add a missing intent:/i)).toBeInTheDocument()
    // Red border-left (4px for low)
    const region = container.querySelector('[role="region"]')
    expect(region.getAttribute('style'))
      .toMatch(/border-left:\s*4px\s+solid\s+(?:#e03030|rgb\(224,\s*48,\s*48\))/i)
  })
})

describe('SessionVarietyCard — moderate variety', () => {
  it('shows amber border + score 3/5 for 3-intent mix', () => {
    const log = buildRecentDays(28, (d, i) => {
      const m = i % 3
      if (m === 0) return recoveryEntry(d)
      if (m === 1) return longEntry(d)
      return steadyEntry(d)
    })
    const { container } = renderCard({ log })

    expect(screen.getByText(/Mix score:\s*3\/5/i)).toBeInTheDocument()
    expect(screen.getByText(/3 session types present/i)).toBeInTheDocument()
    const region = container.querySelector('[role="region"]')
    expect(region.getAttribute('style'))
      .toMatch(/border-left:\s*3px\s+solid\s+(?:#f5c542|rgb\(245,\s*197,\s*66\))/i)
  })
})

describe('SessionVarietyCard — good variety', () => {
  it('shows green tint + ✓ + score 5/5 for 5-intent mix', () => {
    const log = buildRecentDays(28, (d, i) => {
      const m = i % 5
      if (m === 0) return recoveryEntry(d)
      if (m === 1) return longEntry(d)
      if (m === 2) return steadyEntry(d)
      if (m === 3) return tempoEntry(d)
      return intervalsEntry(d)
    })
    const { container } = renderCard({ log })

    expect(screen.getByText(/Mix score:\s*5\/5/i)).toBeInTheDocument()
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByText(/Good session variety/i)).toBeInTheDocument()
    const region = container.querySelector('[role="region"]')
    expect(region.getAttribute('style'))
      .toMatch(/border-left:\s*3px\s+solid\s+(?:#5bc25b|rgb\(91,\s*194,\s*91\))/i)
  })
})

describe('SessionVarietyCard — 5-tile legend', () => {
  it('always renders 5 tiles when reliable (good-variety case)', () => {
    const log = buildRecentDays(28, (d, i) => {
      const m = i % 5
      if (m === 0) return recoveryEntry(d)
      if (m === 1) return longEntry(d)
      if (m === 2) return steadyEntry(d)
      if (m === 3) return tempoEntry(d)
      return intervalsEntry(d)
    })
    renderCard({ log })

    const list = screen.getByRole('list')
    expect(list).toBeInTheDocument()
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    // Each label visible (EN)
    ;['Recovery', 'Long', 'Steady', 'Tempo', 'Intervals'].forEach(lbl => {
      expect(within(list).getByText(lbl)).toBeInTheDocument()
    })
  })

  it('color-codes tiles: present (>0) green, missing (=0) grey — all-recovery case', () => {
    const log = buildRecentDays(28, recoveryEntry)
    renderCard({ log })

    const list = screen.getByRole('list')
    const tiles = within(list).getAllByRole('listitem')
    // First tile = recovery, present (count > 0) → green border
    // jsdom expands 8-hex colors (#RRGGBBAA) to rgba(); accept hex or rgb/rgba
    expect(tiles[0].getAttribute('style'))
      .toMatch(/border:\s*1px\s+solid\s+(?:#5bc25b\w*|rgba?\(91,\s*194,\s*91[^)]*\))/i)
    // Tiles 1..4 = long/steady/tempo/intervals, all missing (count 0) → grey border
    for (let i = 1; i < 5; i++) {
      expect(tiles[i].getAttribute('style'))
        .toMatch(/border:\s*1px\s+solid\s+(?:#555\w*|rgba?\(85,\s*85,\s*85[^)]*\))/i)
    }
  })

  it('each tile has aria-label with intent + count (EN)', () => {
    const log = buildRecentDays(28, recoveryEntry)
    renderCard({ log })
    const list = screen.getByRole('list')
    const tiles = within(list).getAllByRole('listitem')
    expect(tiles[0].getAttribute('aria-label')).toMatch(/Recovery:\s*28\s*sessions/i)
    expect(tiles[1].getAttribute('aria-label')).toMatch(/Long:\s*0\s*sessions/i)
  })
})

describe('SessionVarietyCard — bilingual + a11y + citation', () => {
  it('renders TR labels in tiles when lang=tr (good-variety)', () => {
    const log = buildRecentDays(28, (d, i) => {
      const m = i % 5
      if (m === 0) return recoveryEntry(d)
      if (m === 1) return longEntry(d)
      if (m === 2) return steadyEntry(d)
      if (m === 3) return tempoEntry(d)
      return intervalsEntry(d)
    })
    renderCard({ log }, 'tr')

    expect(screen.getByText(/Skor:\s*5\/5/i)).toBeInTheDocument()
    expect(screen.getByText('Toparlanma')).toBeInTheDocument()
    expect(screen.getByText('Uzun')).toBeInTheDocument()
    expect(screen.getByText('Sabit')).toBeInTheDocument()
    expect(screen.getByText('İntervaller')).toBeInTheDocument()
    expect(screen.getByText(/İyi seans çeşitliliği/i)).toBeInTheDocument()
  })

  it('card root has role=region with bilingual aria-label', () => {
    const log = buildRecentDays(28, recoveryEntry)
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Session variety/i)
  })

  it('renders the Seiler/Foster citation footer in all reliable states', () => {
    const log = buildRecentDays(28, recoveryEntry)
    renderCard({ log })
    expect(screen.getByText(/Seiler 2010; Foster 2001/)).toBeInTheDocument()
  })
})
