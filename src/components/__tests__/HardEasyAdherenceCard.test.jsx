// @vitest-environment jsdom
// ─── HardEasyAdherenceCard.test.jsx — render tests ──────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import HardEasyAdherenceCard from '../dashboard/HardEasyAdherenceCard.jsx'

const TODAY = '2026-04-30'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function entry(date, tss, extra = {}) {
  return { date, tss, ...extra }
}

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <HardEasyAdherenceCard {...props} />
    </LangCtx.Provider>
  )
}

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

// Build a log for each band -------------------------------------------------
function buildStrictLog() {
  // 12 weeks Mon/Wed/Fri all clean
  const log = []
  for (let w = 0; w < 12; w++) {
    const wkMon = addDaysStr('2026-02-09', w * 7)
    log.push(entry(wkMon, 100))
    log.push(entry(addDaysStr(wkMon, 2), 100))
    log.push(entry(addDaysStr(wkMon, 4), 100))
  }
  return log
}

function buildGoodLog() {
  // 12 weeks; first 3 dirty (Mon-Tue adjacency), last 9 clean (Mon/Wed)
  const log = []
  for (let w = 0; w < 12; w++) {
    const wkMon = addDaysStr('2026-02-09', w * 7)
    log.push(entry(wkMon, 100))
    if (w < 3) {
      log.push(entry(addDaysStr(wkMon, 1), 100))
    } else {
      log.push(entry(addDaysStr(wkMon, 2), 100))
    }
  }
  return log
}

function buildOccasionalLog() {
  // 12 weeks; 6 dirty + 6 clean = 50%
  const log = []
  for (let w = 0; w < 12; w++) {
    const wkMon = addDaysStr('2026-02-09', w * 7)
    log.push(entry(wkMon, 100))
    if (w < 6) {
      log.push(entry(addDaysStr(wkMon, 1), 100))
    } else {
      log.push(entry(addDaysStr(wkMon, 2), 100))
    }
  }
  return log
}

function buildChronicLog() {
  // 12 weeks all Mon-Tue adjacency
  const log = []
  for (let w = 0; w < 12; w++) {
    const wkMon = addDaysStr('2026-02-09', w * 7)
    log.push(entry(wkMon, 100))
    log.push(entry(addDaysStr(wkMon, 1), 100))
  }
  return log
}

// ─── Null states ────────────────────────────────────────────────────────────
describe('HardEasyAdherenceCard — null states', () => {
  it('renders nothing when log is empty', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no week has ≥ 2 hard days', () => {
    const { container } = renderCard({
      log: [entry('2026-04-20', 100), entry('2026-04-27', 100)],
    })
    expect(container.firstChild).toBeNull()
  })
})

// ─── Band rendering ─────────────────────────────────────────────────────────
describe('HardEasyAdherenceCard — band rendering', () => {
  it('renders STRICT band when adherence is perfect across 12 weeks', () => {
    renderCard({ log: buildStrictLog() })
    const region = screen.getByRole('region', { name: /Hard\/easy rule adherence/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-hard-easy-band')).toBe('STRICT')
    expect(screen.getByText('STRICT')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('renders GOOD band when 9/12 weeks are clean (75%)', () => {
    renderCard({ log: buildGoodLog() })
    const region = screen.getByRole('region', { name: /Hard\/easy rule adherence/i })
    expect(region.getAttribute('data-hard-easy-band')).toBe('GOOD')
    expect(screen.getByText('GOOD')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders OCCASIONAL_VIOLATIONS band when 50% clean', () => {
    renderCard({ log: buildOccasionalLog() })
    const region = screen.getByRole('region', { name: /Hard\/easy rule adherence/i })
    expect(region.getAttribute('data-hard-easy-band')).toBe('OCCASIONAL_VIOLATIONS')
    expect(screen.getByText('OCCASIONAL')).toBeInTheDocument()
  })

  it('renders CHRONIC_VIOLATIONS band when 0% clean', () => {
    renderCard({ log: buildChronicLog() })
    const region = screen.getByRole('region', { name: /Hard\/easy rule adherence/i })
    expect(region.getAttribute('data-hard-easy-band')).toBe('CHRONIC_VIOLATIONS')
    expect(screen.getByText('CHRONIC')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})

// ─── Violation badge ────────────────────────────────────────────────────────
describe('HardEasyAdherenceCard — violation badge', () => {
  it('shows the violation badge when totalViolations > 0', () => {
    renderCard({ log: buildChronicLog() })
    const badge = document.querySelector('[data-violation-badge]')
    expect(badge).not.toBeNull()
    expect(badge.getAttribute('aria-label')).toMatch(/12 violations/i)
  })

  it('hides the violation badge when totalViolations === 0', () => {
    renderCard({ log: buildStrictLog() })
    const badge = document.querySelector('[data-violation-badge]')
    expect(badge).toBeNull()
  })
})

// ─── Mini bars ──────────────────────────────────────────────────────────────
describe('HardEasyAdherenceCard — weekly mini-bars', () => {
  it('renders 12 weekly bars', () => {
    renderCard({ log: buildStrictLog() })
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars.length).toBe(12)
  })

  it('marks the violation dot red on dirty weeks and green on clean weeks', () => {
    renderCard({ log: buildGoodLog() })
    const dirtyDots = document.querySelectorAll('[data-week-violation-dot="true"]')
    const cleanDots = document.querySelectorAll('[data-week-violation-dot="false"]')
    // 3 dirty weeks, 9 clean weeks.
    expect(dirtyDots.length).toBe(3)
    expect(cleanDots.length).toBe(9)
  })
})

// ─── Citation ───────────────────────────────────────────────────────────────
describe('HardEasyAdherenceCard — citation footer', () => {
  it('renders the citation (Daniels 2014; Foster 2001)', () => {
    renderCard({ log: buildStrictLog() })
    expect(screen.getByText(/Daniels 2014; Foster 2001/)).toBeInTheDocument()
  })
})

// ─── Bilingual ──────────────────────────────────────────────────────────────
describe('HardEasyAdherenceCard — Turkish copy', () => {
  it('renders Turkish title and band when lang=tr', () => {
    renderCard({ log: buildStrictLog() }, 'tr')
    const region = screen.getByRole('region', { name: /Sert-kolay kuralı uyum/i })
    expect(region).toBeInTheDocument()
    expect(screen.getByText(/SERT-KOLAY KURALI · 12H/)).toBeInTheDocument()
    expect(screen.getByText('KATI')).toBeInTheDocument()
  })

  it('renders Turkish chronic-band copy', () => {
    renderCard({ log: buildChronicLog() }, 'tr')
    expect(screen.getByText('KRONİK')).toBeInTheDocument()
    // Hint copy in TR
    expect(
      screen.getByText(/ardışık sert günler|Sert\/kolay kuralı kronik/i)
    ).toBeInTheDocument()
  })
})

// ─── Accessibility ──────────────────────────────────────────────────────────
describe('HardEasyAdherenceCard — accessibility', () => {
  it('exposes role="region" with a bilingual aria-label', () => {
    renderCard({ log: buildStrictLog() })
    const region = screen.getByRole('region', { name: /Hard\/easy rule adherence/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes data-card="hard-easy-adherence" anchor', () => {
    renderCard({ log: buildStrictLog() })
    const node = document.querySelector('[data-card="hard-easy-adherence"]')
    expect(node).not.toBeNull()
  })

  it('exposes data attributes for downstream test hooks', () => {
    renderCard({ log: buildChronicLog() })
    const node = document.querySelector('[data-card="hard-easy-adherence"]')
    expect(node.getAttribute('data-hard-easy-band')).toBe('CHRONIC_VIOLATIONS')
    expect(node.getAttribute('data-total-violations')).toBe('12')
    expect(node.getAttribute('data-clean-week-rate')).toBe('0')
  })
})

// ─── Robustness ─────────────────────────────────────────────────────────────
describe('HardEasyAdherenceCard — robustness', () => {
  it('renders nothing when log prop is omitted', () => {
    const { container } = render(
      <LangCtx.Provider value={{ t: k => k, lang: 'en', setLang: () => {} }}>
        <HardEasyAdherenceCard />
      </LangCtx.Provider>
    )
    expect(container.firstChild).toBeNull()
  })
})
