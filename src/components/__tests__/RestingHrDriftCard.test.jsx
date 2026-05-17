// @vitest-environment jsdom
// ─── RestingHrDriftCard.test.jsx — render tests for the drift warning ───────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RestingHrDriftCard from '../dashboard/RestingHrDriftCard.jsx'

// ── helpers ──────────────────────────────────────────────────────────────────

function daysBefore(todayISO, n) {
  const [y, m, d] = todayISO.split('-').map(v => parseInt(v, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - n)
  return dt.toISOString().slice(0, 10)
}

function buildRecovery(today, values) {
  const total = values.length
  return values.map((v, i) => ({
    date: daysBefore(today, total - 1 - i),
    restingHR: v,
  }))
}

const TODAY = '2026-05-17'

function renderWithLang(ui, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>{ui}</LangCtx.Provider>
  )
}

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})

afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

// ── tests ────────────────────────────────────────────────────────────────────

describe('RestingHrDriftCard — silent states', () => {
  it('(a) renders nothing for empty / missing recovery', () => {
    const { container } = renderWithLang(<RestingHrDriftCard recovery={[]} />)
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-resting-hr-drift-card]')).toBeNull()
  })

  it('(b) renders nothing when recovery is non-drifting (stable RHR)', () => {
    const values = Array.from({ length: 17 }, () => 50)
    const recovery = buildRecovery(TODAY, values)
    const { container } = renderWithLang(<RestingHrDriftCard recovery={recovery} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when sample size is too small', () => {
    const recovery = [
      { date: daysBefore(TODAY, 1), restingHR: 50 },
      { date: daysBefore(TODAY, 0), restingHR: 60 },
    ]
    const { container } = renderWithLang(<RestingHrDriftCard recovery={recovery} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('RestingHrDriftCard — drifting state', () => {
  // 14 days at 50 bpm baseline + 3 days at 55 bpm recent → +10% delta drift.
  function drift10pctRecovery() {
    return buildRecovery(TODAY, [
      ...Array.from({ length: 14 }, () => 50),
      55, 55, 55,
    ])
  }

  it('(c) renders the warning banner with expected delta value', () => {
    renderWithLang(<RestingHrDriftCard recovery={drift10pctRecovery()} />)
    const card = document.querySelector('[data-resting-hr-drift-card]')
    expect(card).not.toBeNull()
    // Title surfaces
    expect(card.textContent).toMatch(/RESTING HR DRIFTING/i)
    // Baseline, recent, delta show up
    expect(card.textContent).toMatch(/50 bpm/)
    expect(card.textContent).toMatch(/55 bpm/)
    // Delta string starts with "+" and shows ~10%
    const deltaEl = card.querySelector('[data-rhr-drift-delta]')
    expect(deltaEl).not.toBeNull()
    expect(deltaEl.textContent).toMatch(/\+10\.0%/)
    // Consecutive days = 3
    const daysEl = card.querySelector('[data-rhr-drift-days]')
    expect(daysEl).not.toBeNull()
    expect(daysEl.textContent).toMatch(/3/)
  })

  it('(d) data-drifting="true" anchor is present when drifting', () => {
    renderWithLang(<RestingHrDriftCard recovery={drift10pctRecovery()} />)
    const card = document.querySelector('[data-resting-hr-drift-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-drifting')).toBe('true')
  })

  it('renders citation reference (Buchheit + Plews + Bouchard)', () => {
    renderWithLang(<RestingHrDriftCard recovery={drift10pctRecovery()} />)
    const card = document.querySelector('[data-resting-hr-drift-card]')
    expect(card.textContent).toMatch(/Buchheit/)
    expect(card.textContent).toMatch(/Plews/)
    expect(card.textContent).toMatch(/Bouchard/)
  })

  it('renders the EN recommendation by default', () => {
    renderWithLang(<RestingHrDriftCard recovery={drift10pctRecovery()} />)
    expect(screen.getByText(/Easy days \+ extra sleep; reassess in 3 days\./i))
      .toBeInTheDocument()
  })

  it('(e) renders TR copy when lang = "tr"', () => {
    renderWithLang(
      <RestingHrDriftCard recovery={drift10pctRecovery()} />,
      'tr'
    )
    // Turkish title
    expect(screen.getByText(/İSTİRAHAT KALBİ KAYIYOR/i)).toBeInTheDocument()
    // Turkish recommendation
    expect(
      screen.getByText(/Hafif günler \+ ekstra uyku; 3 gün sonra tekrar bak\./i)
    ).toBeInTheDocument()
    // Region label is Turkish
    const region = screen.getByRole('region', {
      name: /İstirahat kalp atış hızı kayma uyarısı/i,
    })
    expect(region).toBeInTheDocument()
  })

  it('wraps content in role="region" with accessible name (EN)', () => {
    renderWithLang(<RestingHrDriftCard recovery={drift10pctRecovery()} />)
    const region = screen.getByRole('region', {
      name: /Resting heart rate drift warning/i,
    })
    expect(region).toBeInTheDocument()
  })
})
