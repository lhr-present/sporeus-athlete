// @vitest-environment jsdom
// ─── StaleZonesCard.test.jsx — render tests for the zone-balance card ────────
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import StaleZonesCard from '../dashboard/StaleZonesCard.jsx'

// ─── Render helper with overridable lang ─────────────────────────────────────
function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <StaleZonesCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Synthetic log builders ──────────────────────────────────────────────────
function buildLog(days, zonesArr, today = '2026-04-30') {
  const log = []
  const base = new Date(today + 'T00:00:00Z')
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - i)
    log.push({
      date: d.toISOString().slice(0, 10),
      zones: zonesArr.slice(),
      duration: zonesArr.reduce((s, v) => s + v, 0),
      type: 'run',
    })
  }
  return log
}

function buildSplitLog(totalDays, recentDays, oldZones, recentZones, today = '2026-04-30') {
  const log = []
  const base = new Date(today + 'T00:00:00Z')
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - i)
    const zones = i < recentDays ? recentZones : oldZones
    log.push({
      date: d.toISOString().slice(0, 10),
      zones: zones.slice(),
      duration: zones.reduce((s, v) => s + v, 0),
      type: 'run',
    })
  }
  return log
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('StaleZonesCard — empty / unreliable states', () => {
  it('renders empty state for empty log', () => {
    renderCard({ log: [] })
    expect(screen.getByText(/Log 14\+ days of training/i)).toBeInTheDocument()
  })

  it('renders empty state when log spans < 14 distinct days (unreliable)', () => {
    const log = buildLog(7, [10, 30, 5, 3, 2])
    renderCard({ log })
    expect(screen.getByText(/Log 14\+ days of training/i)).toBeInTheDocument()
  })

  it('renders TR empty-state copy when lang=tr', () => {
    renderCard({ log: [] }, 'tr')
    expect(screen.getByText(/14\+ gün antrenman kaydet/i)).toBeInTheDocument()
  })
})

describe('StaleZonesCard — healthy state', () => {
  it('shows green healthy message when no zones flagged', () => {
    // Distribution where every zone gets ≥5% share AND last-7d matches prior-21d
    // (identical zones array each day → share7 == share21, no drops)
    const log = buildLog(28, [20, 30, 20, 15, 15])
    renderCard({ log })
    expect(screen.getByText(/Zone balance is healthy/i)).toBeInTheDocument()
    // Verify per-zone breakdown is skipped (no Z1..Z5 tiles)
    expect(screen.queryByText('Z1')).not.toBeInTheDocument()
  })
})

describe('StaleZonesCard — flagged state', () => {
  it('renders all 5 zone tiles when at least one zone is flagged', () => {
    // Z1=0%, Z2=100%, Z3=0%, Z4=0%, Z5=0% → multiple stale zones
    const log = buildLog(28, [0, 100, 0, 0, 0])
    renderCard({ log })
    ;['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].forEach(z => {
      expect(screen.getByText(z)).toBeInTheDocument()
    })
  })

  it('shows stale message for Z5 when log has only Z2 sessions', () => {
    const log = buildLog(28, [0, 100, 0, 0, 0])
    renderCard({ log })
    // Stale messages: "Z5 (VO2max) has been neglected for 28 days."
    expect(screen.getByText(/Z5 \(VO2max\) has been neglected/i)).toBeInTheDocument()
  })

  it('shows dropped message when recent week drops Z2 share vs prior weeks', () => {
    // 21 days Z2-heavy, last 7 days only Z3 → Z2 share7=0, share21=high → dropped
    const log = buildSplitLog(28, 7, [0, 80, 10, 5, 5], [0, 0, 100, 0, 0])
    renderCard({ log })
    // Dropped message: "Z2 (endurance) has dropped X% vs prior weeks."
    expect(screen.getByText(/Z2 \(endurance\) has dropped/i)).toBeInTheDocument()
  })

  it('renders TR flagged copy when lang=tr', () => {
    const log = buildLog(28, [0, 100, 0, 0, 0])
    renderCard({ log }, 'tr')
    // Turkish stale message: "Z5 (VO2max) 28 gündür ihmal edilmiş."
    expect(screen.getByText(/Z5 \(VO2max\) 28 gündür ihmal edilmiş/i)).toBeInTheDocument()
  })
})

describe('StaleZonesCard — a11y', () => {
  it('card root has role=region with bilingual aria-label', () => {
    const log = buildLog(28, [0, 100, 0, 0, 0])
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Zone balance/i)
  })

  it('each zone tile has its own aria-label with zone, status, share %', () => {
    const log = buildLog(28, [0, 100, 0, 0, 0])
    renderCard({ log })
    // Z2 should be healthy at 100% share; Z1, Z3, Z4, Z5 stale at 0%
    expect(screen.getByLabelText(/Z2 healthy, share 100 percent/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Z5 stale, share 0 percent/i)).toBeInTheDocument()
  })
})

describe('StaleZonesCard — citation', () => {
  it('renders the Seiler/Foster citation footer', () => {
    const log = buildLog(28, [0, 100, 0, 0, 0])
    renderCard({ log })
    expect(screen.getByText(/Seiler 2010 polarized; Foster 2001/)).toBeInTheDocument()
  })
})
