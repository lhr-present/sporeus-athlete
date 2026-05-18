// @vitest-environment jsdom
// ─── SeasonalLoadDistributionCard.test.jsx ───────────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SeasonalLoadDistributionCard from '../dashboard/SeasonalLoadDistributionCard.jsx'

const TODAY = '2026-05-15'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <SeasonalLoadDistributionCard {...props} />
    </LangCtx.Provider>
  )
}

// Mirror the pure-fn's window builder so tests stay independent.
function build12MonthKeys(todayIso = TODAY) {
  const d = new Date(todayIso + 'T00:00:00Z')
  const endY = d.getUTCFullYear()
  const endM = d.getUTCMonth()
  const out = []
  for (let i = 11; i >= 0; i--) {
    const total = endY * 12 + endM - i
    const y = Math.floor(total / 12)
    const m = total - y * 12
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`)
  }
  return out
}

function buildLogFromMonthly(monthlyTotals, todayIso = TODAY) {
  const keys = build12MonthKeys(todayIso)
  const log = []
  for (let i = 0; i < keys.length; i++) {
    const total = monthlyTotals[i]
    if (!total) continue
    log.push({ date: `${keys[i]}-15`, tss: total })
  }
  return log
}

// ─── Render-null gate ───────────────────────────────────────────────────────

describe('SeasonalLoadDistributionCard — render gating', () => {
  it('renders NOTHING for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders NOTHING when fewer than 6 months are populated', () => {
    const log = buildLogFromMonthly([0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100])
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── Pattern colors + anchors ───────────────────────────────────────────────

describe('SeasonalLoadDistributionCard — patterns', () => {
  it('renders FLAT pattern with muted color when monthly load is even', () => {
    const log = buildLogFromMonthly(new Array(12).fill(120))
    renderCard({ log })
    const card = screen.getByRole('region', { name: /12-month seasonal load/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-load-pattern')).toBe('FLAT')
    // muted grey #888
    expect(card.style.borderLeft).toMatch(/rgb\(136,\s*136,\s*136\)/)
    expect(card.textContent).toMatch(/FLAT/)
    expect(card.textContent).toMatch(/Issurin 2010/)
  })

  it('renders BLOCK pattern (orange) for a single huge peak', () => {
    const totals = [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 800]
    const log = buildLogFromMonthly(totals)
    renderCard({ log })
    const card = screen.getByRole('region', { name: /12-month seasonal load/i })
    expect(card.getAttribute('data-load-pattern')).toBe('BLOCK')
    // #ff6600
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
    expect(card.textContent).toMatch(/BLOCK/)
  })

  it('renders VOLATILE pattern (red) for alternating high/low months', () => {
    const totals = [400, 50, 400, 50, 400, 50, 400, 50, 400, 50, 400, 50]
    const log = buildLogFromMonthly(totals)
    renderCard({ log })
    const card = screen.getByRole('region', { name: /12-month seasonal load/i })
    expect(card.getAttribute('data-load-pattern')).toBe('VOLATILE')
    // #ff4444
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*68,\s*68\)/)
    expect(card.textContent).toMatch(/VOLATILE/)
  })

  it('renders TRADITIONAL pattern (green) for a gradual ramp + taper', () => {
    const totals = [60, 80, 100, 130, 165, 210, 165, 130, 100, 80, 60, 50]
    const log = buildLogFromMonthly(totals)
    renderCard({ log })
    const card = screen.getByRole('region', { name: /12-month seasonal load/i })
    expect(card.getAttribute('data-load-pattern')).toBe('TRADITIONAL')
    // #5bc25b
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    expect(card.textContent).toMatch(/TRADITIONAL/)
  })
})

// ─── Bar histogram anchors ──────────────────────────────────────────────────

describe('SeasonalLoadDistributionCard — bar anchors', () => {
  it('renders 12 month bars with data anchors', () => {
    const totals = new Array(12).fill(100)
    const log = buildLogFromMonthly(totals)
    renderCard({ log })
    const bars = document.querySelectorAll('[data-month-bar]')
    expect(bars.length).toBe(12)
    // Each bar carries label + tss attributes
    const first = bars[0]
    expect(first.getAttribute('data-month-label')).toMatch(/^[A-Z]{3}$/)
    expect(first.getAttribute('data-month-tss')).not.toBeNull()
  })

  it('peak month anchor matches the highest TSS month', () => {
    const totals = [40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 800]
    const log = buildLogFromMonthly(totals)
    renderCard({ log })
    const card = document.querySelector('[data-seasonal-load-card]')
    // Last (12th) key in the window is 2026-05 with value 800.
    expect(card.getAttribute('data-peak-month')).toBe('2026-05')
  })
})

// ─── Bilingual ──────────────────────────────────────────────────────────────

describe('SeasonalLoadDistributionCard — bilingual', () => {
  it('renders Turkish heading "MEVSİMSEL YÜK · 12A" when lang=tr', () => {
    const log = buildLogFromMonthly(new Array(12).fill(120))
    renderCard({ log }, 'tr')
    expect(screen.getByText(/MEVSİMSEL YÜK · 12A/)).toBeInTheDocument()
    // FLAT → DÜZ in TR
    expect(screen.getByText(/DÜZ/)).toBeInTheDocument()
  })

  it('uses Turkish 3-letter month labels in TR mode', () => {
    const log = buildLogFromMonthly(new Array(12).fill(120))
    renderCard({ log }, 'tr')
    // 2026-05 is the last month → MAY in EN, MAY in TR (Mayıs → MAY)
    // But 2026-01 (JAN in EN) should be OCA in TR.
    // Test by inspecting the rendered text directly for OCA.
    const card = document.querySelector('[data-seasonal-load-card]')
    expect(card.textContent).toMatch(/OCA/)
  })

  it('renders English heading by default', () => {
    const log = buildLogFromMonthly(new Array(12).fill(120))
    renderCard({ log })
    expect(screen.getByText(/SEASONAL LOAD · 12M/)).toBeInTheDocument()
  })
})
