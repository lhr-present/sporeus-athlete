// @vitest-environment jsdom
// ─── RecoveryAdherenceCard.test.jsx — render tests for v8.84.0 adherence ─────
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RecoveryAdherenceCard from '../dashboard/RecoveryAdherenceCard.jsx'

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <RecoveryAdherenceCard {...props} />
    </LangCtx.Provider>
  )
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Build N rest days, each with given tss + rpe.
function buildRest(n, { tss = 0, rpe = 2, gap = 3 } = {}) {
  const today = todayStr()
  const log = []
  for (let i = 0; i < n; i++) {
    log.push({
      date: addDays(today, -i * gap),
      type: 'recovery',
      intent: 'recovery',
      tss,
      rpe,
      duration: 30,
    })
  }
  return log
}

// Build a mix: A adherent rest days, M mild-drift days, S severe-drift days.
// All on distinct dates spaced by 2 days.
function buildMix({ adherent = 0, mild = 0, severe = 0 } = {}) {
  const today = todayStr()
  const log = []
  let i = 0
  for (let k = 0; k < adherent; k++, i++) {
    log.push({
      date: addDays(today, -i * 2),
      intent: 'recovery',
      type: 'recovery',
      tss: 10,
      rpe: 2,
      duration: 30,
    })
  }
  for (let k = 0; k < mild; k++, i++) {
    log.push({
      date: addDays(today, -i * 2),
      intent: 'recovery',
      type: 'recovery',
      tss: 45,
      rpe: 5,
      duration: 45,
    })
  }
  for (let k = 0; k < severe; k++, i++) {
    log.push({
      date: addDays(today, -i * 2),
      intent: 'recovery',
      type: 'recovery',
      tss: 80,
      rpe: 8,
      duration: 60,
    })
  }
  return log
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('RecoveryAdherenceCard — vacuous good (no rest days)', () => {
  it('renders the no-rest-days notice when log has zero planned rest days', () => {
    renderCard({ log: [] })
    expect(screen.getByText(/No rest days planned/i)).toBeInTheDocument()
    expect(screen.getByText(/Add 1 full rest day per week/i)).toBeInTheDocument()
  })

  it('renders TR vacuous-good copy when lang=tr', () => {
    renderCard({ log: [] }, 'tr')
    expect(screen.getByText(/Planlı dinlenme günü yok/i)).toBeInTheDocument()
    expect(screen.getByText(/Haftaya 1 tam dinlenme günü ekle/i)).toBeInTheDocument()
  })
})

describe('RecoveryAdherenceCard — insufficient data (1–2 planned rest days)', () => {
  it('shows insufficient-data notice when only 2 planned rest days exist', () => {
    const log = buildRest(2, { tss: 10, rpe: 2 })
    renderCard({ log })
    expect(screen.getByText(/Log 3\+ planned rest days to see adherence/i))
      .toBeInTheDocument()
  })
})

describe('RecoveryAdherenceCard — reliable bands', () => {
  it('renders 100% / GOOD band when 5 rest days all adherent', () => {
    const log = buildMix({ adherent: 5 })
    renderCard({ log })
    expect(screen.getByLabelText(/GOOD — 100% rest-day adherence/i)).toBeInTheDocument()
    expect(screen.getByText('GOOD')).toBeInTheDocument()
    expect(screen.getByText(/5\/5 rest days/i)).toBeInTheDocument()
  })

  it('renders 60% / MODERATE band when 3 adherent + 2 mild drift', () => {
    const log = buildMix({ adherent: 3, mild: 2 })
    renderCard({ log })
    expect(screen.getByLabelText(/MODERATE — 60% rest-day adherence/i)).toBeInTheDocument()
    expect(screen.getByText('MODERATE')).toBeInTheDocument()
    expect(screen.getByText(/3\/5 rest days/i)).toBeInTheDocument()
  })

  it('renders 20% / POOR band when 1 adherent + 4 severe drift', () => {
    const log = buildMix({ adherent: 1, severe: 4 })
    renderCard({ log })
    expect(screen.getByLabelText(/POOR — 20% rest-day adherence/i)).toBeInTheDocument()
    expect(screen.getByText('POOR')).toBeInTheDocument()
    expect(screen.getByText(/1\/5 rest days/i)).toBeInTheDocument()
  })
})

describe('RecoveryAdherenceCard — severity counts + drift dates', () => {
  it('renders mild + severe severity counts', () => {
    const log = buildMix({ adherent: 2, mild: 2, severe: 1 })
    renderCard({ log })
    expect(screen.getByText(/2 mild/i)).toBeInTheDocument()
    expect(screen.getByText(/1 severe drift/i)).toBeInTheDocument()
  })

  it('renders the drift-dates list capped at 3 items', () => {
    // 5 severe drifts → driftDates from lib has 5; card shows 3
    const log = buildMix({ severe: 5 })
    renderCard({ log })
    const driftList = screen.getByRole('list', { name: /Recent drift dates/i })
    expect(driftList).toBeInTheDocument()
    const items = driftList.querySelectorAll('[role="listitem"]')
    expect(items.length).toBe(3)
  })
})

describe('RecoveryAdherenceCard — bilingual', () => {
  it('renders EN title and band label', () => {
    const log = buildMix({ adherent: 5 })
    renderCard({ log })
    expect(screen.getByText(/RECOVERY ADHERENCE — 28D/i)).toBeInTheDocument()
    expect(screen.getByText('GOOD')).toBeInTheDocument()
    expect(screen.getByText(/5\/5 rest days/i)).toBeInTheDocument()
  })

  it('renders TR title and band label when lang=tr', () => {
    const log = buildMix({ adherent: 3, mild: 2 })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/DİNLENME UYUMU — 28G/i)).toBeInTheDocument()
    expect(screen.getByText('ORTA')).toBeInTheDocument()
    expect(screen.getByText(/5 dinlenmenin 3'i/i)).toBeInTheDocument()
    expect(screen.getByText(/2 hafif/i)).toBeInTheDocument()
  })
})

describe('RecoveryAdherenceCard — a11y + citation', () => {
  it('card root has role=region with bilingual aria-label', () => {
    const log = buildMix({ adherent: 5 })
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Recovery adherence/i)
  })

  it('renders the Halson / Foster citation footer', () => {
    const log = buildMix({ adherent: 5 })
    renderCard({ log })
    expect(screen.getByText(/Halson 2014 recovery; Foster 2001 monotony/)).toBeInTheDocument()
  })
})
