// @vitest-environment jsdom
// ─── AnnualTssTargetCard.test.jsx — render tests ───────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import AnnualTssTargetCard from '../dashboard/AnnualTssTargetCard.jsx'

const TODAY = '2026-05-19'

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
      <AnnualTssTargetCard {...props} />
    </LangCtx.Provider>
  )
}

/**
 * Build a log with a known YTD total TSS spread across early 2026.
 */
function buildLog(totalTss, count = 8) {
  const each = totalTss / count
  const out = []
  const baseDates = [
    '2026-01-05', '2026-01-20',
    '2026-02-05', '2026-02-20',
    '2026-03-05', '2026-03-20',
    '2026-04-05', '2026-05-01',
  ]
  for (let i = 0; i < count; i++) {
    out.push({ date: baseDates[i % baseDates.length], tss: each })
  }
  return out
}

describe('AnnualTssTargetCard — null gating', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when no log prop is provided', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when ytdTss is zero', () => {
    const log = [
      { date: '2026-01-05', tss: 0 },
      { date: '2026-02-10' }, // no tss
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no current-year sessions exist', () => {
    const log = [
      { date: '2025-06-01', tss: 500 },
      { date: '2024-08-15', tss: 200 },
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

describe('AnnualTssTargetCard — band rendering', () => {
  it('renders ELITE_ENDURANCE band with orange stripe + EN label + EN hint', () => {
    // YTD 2000 → projection ~5252 → ELITE_ENDURANCE
    renderCard({ log: buildLog(2000) })
    const card = screen.getByRole('region', { name: /annual tss projection/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-projection-band')).toBe('ELITE_ENDURANCE')
    // Orange left border (#ff6600)
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
    expect(card.textContent).toMatch(/ELITE/)
    expect(card.textContent).toMatch(/Elite-endurance annual load/)
    expect(card.textContent).toMatch(/Hellard 2019; Tønnessen 2014/)
  })

  it('renders COMPETITIVE band with green stripe', () => {
    // YTD 1400 → projection ~3677 → COMPETITIVE
    renderCard({ log: buildLog(1400) })
    const card = screen.getByRole('region', { name: /annual tss projection/i })
    expect(card.getAttribute('data-projection-band')).toBe('COMPETITIVE')
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    expect(card.textContent).toMatch(/COMPETITIVE/)
    expect(card.textContent).toMatch(/Sub-elite annual volume/)
  })

  it('renders CONSISTENT band with blue stripe', () => {
    // YTD 800 → projection ~2101 → CONSISTENT
    renderCard({ log: buildLog(800) })
    const card = screen.getByRole('region', { name: /annual tss projection/i })
    expect(card.getAttribute('data-projection-band')).toBe('CONSISTENT')
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
    expect(card.textContent).toMatch(/CONSISTENT/)
    expect(card.textContent).toMatch(/committed-amateur volume/)
  })

  it('renders DEVELOPING band with muted stripe', () => {
    // YTD 300 → projection ~788 → DEVELOPING
    renderCard({ log: buildLog(300) })
    const card = screen.getByRole('region', { name: /annual tss projection/i })
    expect(card.getAttribute('data-projection-band')).toBe('DEVELOPING')
    expect(card.textContent).toMatch(/DEVELOPING/)
    expect(card.textContent).toMatch(/Recreational regular volume/)
  })

  it('renders CASUAL band with muted dark stripe', () => {
    // YTD 100 → projection ~263 → CASUAL
    renderCard({ log: buildLog(100) })
    const card = screen.getByRole('region', { name: /annual tss projection/i })
    expect(card.getAttribute('data-projection-band')).toBe('CASUAL')
    expect(card.textContent).toMatch(/CASUAL/)
    expect(card.textContent).toMatch(/Casual training volume/)
  })
})

describe('AnnualTssTargetCard — Turkish', () => {
  it('renders Turkish title + Turkish band label (ELİT) when lang=tr', () => {
    renderCard({ log: buildLog(2000) }, 'tr')
    expect(screen.getByText(/YILLIK TSS PROJEKSİYONU/)).toBeInTheDocument()
    expect(screen.getByText('ELİT')).toBeInTheDocument()
    expect(screen.getByText(/Elit dayanıklılık yıllık yükü/)).toBeInTheDocument()
  })

  it('renders Turkish band labels for the other 4 bands', () => {
    // COMPETITIVE → YARIŞMACI
    let { unmount } = renderCard({ log: buildLog(1400) }, 'tr')
    expect(screen.getByText('YARIŞMACI')).toBeInTheDocument()
    unmount()

    // CONSISTENT → İSTİKRARLI
    ;({ unmount } = renderCard({ log: buildLog(800) }, 'tr'))
    expect(screen.getByText('İSTİKRARLI')).toBeInTheDocument()
    unmount()

    // DEVELOPING → GELİŞEN
    ;({ unmount } = renderCard({ log: buildLog(300) }, 'tr'))
    expect(screen.getByText('GELİŞEN')).toBeInTheDocument()
    unmount()

    // CASUAL → KASUAL
    renderCard({ log: buildLog(100) }, 'tr')
    expect(screen.getByText('KASUAL')).toBeInTheDocument()
  })
})

describe('AnnualTssTargetCard — data anchors', () => {
  it('exposes all required data-* anchors with rounded values', () => {
    // YTD = 1000 → projection 1000 * 365/139 ≈ 2625.9 → rounded to 2630
    // Weekly avg = 1000 / (139/7) ≈ 50.36 → rounded to 50
    const log = [
      { date: '2026-01-10', tss: 250 },
      { date: '2026-02-15', tss: 250 },
      { date: '2026-03-20', tss: 250 },
      { date: '2026-05-01', tss: 250 },
    ]
    renderCard({ log })

    const card = document.querySelector('[data-annual-tss-target-card]')
    expect(card).not.toBeNull()

    expect(card.getAttribute('data-projection-band')).toBe('CONSISTENT')
    expect(card.getAttribute('data-ytd-tss')).toBe('1000')
    expect(card.getAttribute('data-projected-annual-tss')).toBe('2630')
    expect(card.getAttribute('data-weekly-avg-pace')).toBe('50')
    expect(card.getAttribute('data-days-into-year')).toBe('139')
  })

  it('displays progress fraction (e.g. "139/365 (38%)")', () => {
    renderCard({ log: buildLog(800) })
    const card = screen.getByRole('region', { name: /annual tss projection/i })
    // 139 / 365 ≈ 0.3808 → 38%
    expect(card.textContent).toMatch(/139\/365 \(38%\)/)
  })
})
