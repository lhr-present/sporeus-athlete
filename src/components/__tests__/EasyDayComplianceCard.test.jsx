// @vitest-environment jsdom
// ─── EasyDayComplianceCard.test.jsx — render tests for E127 compliance card ──
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import EasyDayComplianceCard from '../dashboard/EasyDayComplianceCard.jsx'

// ─── Render helper with overridable lang ─────────────────────────────────────
function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <EasyDayComplianceCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Date helpers anchored to today (UTC) ────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build `n` consecutive easy-day entries ending today.
 * Each entry: { date, type, rpe, duration }.
 */
function buildEasy(n, rpe) {
  const today = todayStr()
  const log = []
  for (let i = n - 1; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'recovery',
      rpe,
      duration: 60,
    })
  }
  return log
}

/** Mix N compliant (RPE 3) + M drift (RPE 7) easy sessions, all distinct days. */
function buildMix(compliant, drift) {
  const today = todayStr()
  const log = []
  let i = 0
  for (let k = 0; k < compliant; k++, i++) {
    log.push({ date: addDays(today, -i), type: 'recovery', rpe: 3, duration: 60 })
  }
  for (let k = 0; k < drift; k++, i++) {
    log.push({ date: addDays(today, -i), type: 'recovery', rpe: 7, duration: 60 })
  }
  return log
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('EasyDayComplianceCard — empty / unreliable states', () => {
  it('renders empty state for empty log', () => {
    renderCard({ log: [] })
    expect(screen.getByText(/Log 5\+ easy sessions to see compliance/i))
      .toBeInTheDocument()
  })

  it('renders empty state when fewer than 5 easy sessions logged', () => {
    const log = buildEasy(3, 3)
    renderCard({ log })
    expect(screen.getByText(/Log 5\+ easy sessions to see compliance/i))
      .toBeInTheDocument()
  })

  it('renders TR empty-state copy when lang=tr', () => {
    renderCard({ log: [] }, 'tr')
    expect(screen.getByText(/Uyumu görmek için 5\+ kolay seans kaydet/i))
      .toBeInTheDocument()
  })
})

describe('EasyDayComplianceCard — reliable states', () => {
  it('renders 100% / GOOD band with green color when 10 sessions all RPE 3', () => {
    const log = buildEasy(10, 3)
    renderCard({ log })
    expect(screen.getByLabelText(/GOOD 100% easy-day compliance/i)).toBeInTheDocument()
    expect(screen.getByText('GOOD')).toBeInTheDocument()
    // Color: #5bc25b — verify on the big-% number node
    const pctNode = screen.getByLabelText(/GOOD 100% easy-day compliance/i)
    expect(pctNode.style.color.toLowerCase()).toBe('rgb(91, 194, 91)')
    expect(screen.getByText(/10 \/ 10 easy sessions compliant/i)).toBeInTheDocument()
  })

  it('renders 0% / POOR band with red color when 10 sessions all RPE 7', () => {
    const log = buildEasy(10, 7)
    renderCard({ log })
    expect(screen.getByLabelText(/POOR 0% easy-day compliance/i)).toBeInTheDocument()
    expect(screen.getByText('POOR')).toBeInTheDocument()
    const pctNode = screen.getByLabelText(/POOR 0% easy-day compliance/i)
    expect(pctNode.style.color.toLowerCase()).toBe('rgb(224, 48, 48)')
    expect(screen.getByText(/0 \/ 10 easy sessions compliant/i)).toBeInTheDocument()
  })

  it('renders 60% / MODERATE band with amber color for 6 compliant + 4 drift', () => {
    const log = buildMix(6, 4)
    renderCard({ log })
    expect(screen.getByLabelText(/MODERATE 60% easy-day compliance/i)).toBeInTheDocument()
    expect(screen.getByText('MODERATE')).toBeInTheDocument()
    const pctNode = screen.getByLabelText(/MODERATE 60% easy-day compliance/i)
    expect(pctNode.style.color.toLowerCase()).toBe('rgb(245, 197, 66)')
    expect(screen.getByText(/6 \/ 10 easy sessions compliant/i)).toBeInTheDocument()
  })

  it('renders drift-dates list (capped at 5) when drift sessions exist', () => {
    // 5 compliant + 7 drift → driftDates from lib is capped at 5
    const log = buildMix(5, 7)
    renderCard({ log })
    const driftList = screen.getByRole('list', { name: /Drift dates/i })
    expect(driftList).toBeInTheDocument()
    const items = driftList.querySelectorAll('[role="listitem"]')
    expect(items.length).toBe(5)
  })

  it('does NOT render drift-dates list when driftSessions === 0', () => {
    const log = buildEasy(10, 3) // all compliant
    renderCard({ log })
    expect(screen.queryByRole('list', { name: /Drift dates/i })).toBeNull()
    expect(screen.queryByText(/^DRIFT DAYS$/)).toBeNull()
  })

  it('renders TR labels + band when lang=tr', () => {
    const log = buildMix(6, 4)
    renderCard({ log }, 'tr')
    expect(screen.getByText(/KOLAY-GÜN UYUMU — 28G/i)).toBeInTheDocument()
    expect(screen.getByText('ORTA')).toBeInTheDocument()
    expect(screen.getByText(/6 \/ 10 kolay seans uyumlu/i)).toBeInTheDocument()
  })
})

describe('EasyDayComplianceCard — a11y + citation', () => {
  it('card root has role=region with bilingual aria-label', () => {
    const log = buildEasy(10, 3)
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Easy-day compliance/i)
  })

  it('renders the Seiler / Stöggl & Sperlich citation footer', () => {
    const log = buildEasy(10, 3)
    renderCard({ log })
    expect(screen.getByText(/Seiler 2010; Stöggl & Sperlich 2014/)).toBeInTheDocument()
  })
})
