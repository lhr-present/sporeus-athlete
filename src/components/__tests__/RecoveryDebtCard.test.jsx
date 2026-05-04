// @vitest-environment jsdom
// ─── RecoveryDebtCard.test.jsx — render tests for v8.77.0 recovery-debt card ──
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RecoveryDebtCard from '../dashboard/RecoveryDebtCard.jsx'

// Pin "today" so the lib's default-arg fallback (new Date()) lands on 2026-05-05
beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <RecoveryDebtCard {...props} />
    </LangCtx.Provider>
  )
}

const TODAY = '2026-05-05'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeLog(tssValues, endDate = TODAY) {
  const log = []
  for (let i = 0; i < tssValues.length; i++) {
    const v = tssValues[i]
    if (v > 0) {
      log.push({ date: addDays(endDate, -(tssValues.length - 1 - i)), type: 'run', tss: v })
    }
  }
  return log
}

function repeat(n, v) {
  return Array.from({ length: n }, () => v)
}

// Fixtures lifted from src/lib/__tests__/athlete/recoveryDebt.test.js so band
// classification stays deterministic and aligned with the lib's own coverage.
const FRESH_FIXTURE       = [...repeat(100, 70), ...repeat(28, 15)]
const FATIGUED_FIXTURE    = [...repeat(120, 60), ...repeat(8, 130)]
const OVERREACHED_FIXTURE = repeat(28, 120)

describe('RecoveryDebtCard — insufficient data', () => {
  it('renders insufficient-data notice when log spans <28 days', () => {
    renderCard({ log: makeLog(repeat(10, 60)) })
    expect(
      screen.getByText(/Log 28\+ days to track cumulative recovery debt/i)
    ).toBeInTheDocument()
  })

  it('renders TR insufficient-data notice when lang=tr', () => {
    renderCard({ log: makeLog(repeat(10, 60)) }, 'tr')
    expect(
      screen.getByText(/Toparlanma borcu için 28\+ günlük log gerekli/i)
    ).toBeInTheDocument()
  })

  it('renders insufficient-data notice for empty log', () => {
    renderCard({ log: [] })
    expect(
      screen.getByText(/Log 28\+ days to track cumulative recovery debt/i)
    ).toBeInTheDocument()
  })
})

describe('RecoveryDebtCard — band classification', () => {
  it('renders FRESH band with light taper load', () => {
    renderCard({ log: makeLog(FRESH_FIXTURE) })
    expect(screen.getByText('FRESH')).toBeInTheDocument()
    expect(screen.getByText(/Fresh — full adaptation window/i)).toBeInTheDocument()
  })

  it('renders FATIGUED band with sustained heavy spike', () => {
    renderCard({ log: makeLog(FATIGUED_FIXTURE) })
    expect(screen.getByText('FATIGUED')).toBeInTheDocument()
    expect(screen.getByText(/Fatigued — manage recovery/i)).toBeInTheDocument()
  })

  it('renders OVERREACHED band with 28-day heavy block', () => {
    renderCard({ log: makeLog(OVERREACHED_FIXTURE) })
    expect(screen.getByText('OVERREACHED')).toBeInTheDocument()
    expect(screen.getByText(/Recovery debt high/i)).toBeInTheDocument()
  })
})

describe('RecoveryDebtCard — bilingual', () => {
  it('renders English title when lang=en', () => {
    renderCard({ log: makeLog(FATIGUED_FIXTURE) })
    expect(screen.getByText('RECOVERY DEBT — 28D')).toBeInTheDocument()
  })

  it('renders Turkish title and band label when lang=tr', () => {
    renderCard({ log: makeLog(FATIGUED_FIXTURE) }, 'tr')
    expect(screen.getByText('TOPARLANMA BORCU — 28G')).toBeInTheDocument()
    expect(screen.getByText('YORGUN')).toBeInTheDocument()
    expect(screen.getByText(/Yorgun — toparlanmayı yönet/i)).toBeInTheDocument()
  })
})

describe('RecoveryDebtCard — a11y + structure', () => {
  it('card root has role=region with bilingual aria-label (en)', () => {
    renderCard({ log: makeLog(FATIGUED_FIXTURE) })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Recovery debt/i)
  })

  it('renders the citation footer', () => {
    renderCard({ log: makeLog(FATIGUED_FIXTURE) })
    expect(screen.getByText(/Banister 1991/)).toBeInTheDocument()
  })
})

describe('RecoveryDebtCard — numeric rendering', () => {
  it('CTL/ATL sub-line renders both values', () => {
    renderCard({ log: makeLog(FATIGUED_FIXTURE) })
    expect(screen.getByText(/CTL:\s*\d+\.\d/i)).toBeInTheDocument()
    expect(screen.getByText(/ATL:\s*\d+\.\d/i)).toBeInTheDocument()
  })

  it('debtDays/28 line renders', () => {
    renderCard({ log: makeLog(FATIGUED_FIXTURE) })
    expect(screen.getByText(/\d+\/28 debt days/i)).toBeInTheDocument()
  })

  it('maxConsecutiveNegativeDays line is conditional — present when >0', () => {
    renderCard({ log: makeLog(OVERREACHED_FIXTURE) })
    expect(screen.getByText(/Longest deficit run: \d+ days/i)).toBeInTheDocument()
  })

  it('maxConsecutiveNegativeDays line absent when 0 (fresh)', () => {
    renderCard({ log: makeLog(FRESH_FIXTURE) })
    expect(screen.queryByText(/Longest deficit run/i)).not.toBeInTheDocument()
  })

  it('currentTSB renders signed with 1 decimal', () => {
    renderCard({ log: makeLog(OVERREACHED_FIXTURE) })
    // Heavy block → strongly negative TSB like "-37.4"
    expect(screen.getByText(/^-\d+\.\d$/)).toBeInTheDocument()
  })
})
