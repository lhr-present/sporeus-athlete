// @vitest-environment jsdom
// ─── SleepDebtCard.test.jsx — render tests for the 7d rolling sleep debt card
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SleepDebtCard from '../dashboard/SleepDebtCard.jsx'

// Lock the system clock so the trailing window is deterministic.
const TODAY = '2026-05-17'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <SleepDebtCard {...props} />
    </LangCtx.Provider>,
  )
}

// Build a recovery array ending at TODAY with the given hours (oldest first).
function buildRecovery(hoursList, endISO = TODAY) {
  const end = new Date(endISO + 'T00:00:00Z')
  const out = []
  const n = hoursList.length
  for (let i = 0; i < n; i++) {
    const d = new Date(end.getTime())
    d.setUTCDate(d.getUTCDate() - (n - 1 - i))
    out.push({
      date: d.toISOString().slice(0, 10),
      sleepHrs: hoursList[i],
    })
  }
  return out
}

describe('SleepDebtCard — null / no-signal states', () => {
  it('renders nothing for empty recovery', () => {
    const { container } = renderCard({ recovery: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when recovery is undefined', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all days are at target (band NONE, debt 0)', () => {
    const recovery = buildRecovery([8, 8, 8, 8, 8, 8, 8])
    const { container } = renderCard({ recovery })
    expect(container.firstChild).toBeNull()
  })
})

describe('SleepDebtCard — visible bands', () => {
  it('renders MODERATE band with orange/amber color', () => {
    // 7d × ~0.85h shortfall ≈ 6h total → MODERATE
    const recovery = buildRecovery([7.1, 7.1, 7.1, 7.1, 7.2, 7.2, 7.2])
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /seven-day rolling sleep debt/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-debt-band')).toBe('MODERATE')
    // Headline label visible
    expect(region.textContent).toMatch(/MODERATE/)
    expect(region.textContent).toMatch(/SLEEP DEBT · 7D/)
    expect(region.textContent).toMatch(/Target: 8h\/night/)
    // Citation footer
    expect(region.textContent).toMatch(/Walker 2017/)
    expect(region.textContent).toMatch(/Milewski 2014/)
  })

  it('renders SEVERE band with red color', () => {
    // 7d × ~1.5h shortfall ≈ 10.5h total → SEVERE
    const recovery = buildRecovery([6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5])
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /seven-day rolling sleep debt/i })
    expect(region.getAttribute('data-debt-band')).toBe('SEVERE')
    expect(region.textContent).toMatch(/SEVERE/)
  })

  it('renders MINOR band when debt is small but non-zero', () => {
    // 7d × 0.3h shortfall ≈ 2.1h total → MINOR (>1, ≤4)
    const recovery = buildRecovery([7.7, 7.7, 7.7, 7.7, 7.7, 7.7, 7.7])
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /seven-day rolling sleep debt/i })
    expect(region.getAttribute('data-debt-band')).toBe('MINOR')
    expect(region.textContent).toMatch(/MINOR/)
  })
})

describe('SleepDebtCard — anchors + a11y', () => {
  it('data-debt-band matches band classification', () => {
    const recovery = buildRecovery([6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5])
    renderCard({ recovery })
    const card = document.querySelector('[data-sleep-debt-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-debt-band')).toBe('SEVERE')
  })

  it('renders the daily-deficit sparkline with one rect per day counted', () => {
    const recovery = buildRecovery([5, 5, 5, 5, 5, 5, 5])
    renderCard({ recovery })
    const svg = document.querySelector('[data-sleep-debt-sparkline]')
    expect(svg).not.toBeNull()
    const rects = svg.querySelectorAll('rect')
    expect(rects.length).toBe(7)
  })
})

describe('SleepDebtCard — bilingual', () => {
  it('renders Turkish heading "UYKU AÇIĞI · 7G" when lang=tr', () => {
    const recovery = buildRecovery([6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5])
    renderCard({ recovery }, 'tr')
    const region = screen.getByRole('region', { name: /yedi günlük uyku açığı/i })
    expect(region.textContent).toMatch(/UYKU AÇIĞI · 7G/)
    // Turkish band label for SEVERE
    expect(region.textContent).toMatch(/AĞIR/)
    // Turkish target line
    expect(region.textContent).toMatch(/Hedef: 8s\/gece/)
  })
})

describe('SleepDebtCard — profile target override', () => {
  it('shows custom target when profile.sleepTargetHours is set', () => {
    // 7h × 7d → 14h debt vs 9h target → SEVERE
    const recovery = buildRecovery([7, 7, 7, 7, 7, 7, 7])
    renderCard({ recovery, profile: { sleepTargetHours: 9 } })
    const region = screen.getByRole('region', { name: /seven-day rolling sleep debt/i })
    expect(region.textContent).toMatch(/Target: 9h\/night/)
    expect(region.getAttribute('data-debt-band')).toBe('SEVERE')
  })
})
