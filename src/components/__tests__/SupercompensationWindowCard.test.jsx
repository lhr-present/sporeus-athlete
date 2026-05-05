// @vitest-environment jsdom
// ─── SupercompensationWindowCard.test.jsx — render tests for v8.79.0 ─────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SupercompensationWindowCard from '../dashboard/SupercompensationWindowCard.jsx'

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
      <SupercompensationWindowCard {...props} />
    </LangCtx.Provider>
  )
}

const TODAY = '2026-05-05'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeLog(tssValues, endDate = TODAY, { includeZeros = false } = {}) {
  const log = []
  for (let i = 0; i < tssValues.length; i++) {
    const v = tssValues[i]
    if (v > 0 || includeZeros) {
      log.push({ date: addDays(endDate, -(tssValues.length - 1 - i)), type: 'run', tss: v })
    }
  }
  return log
}

function repeat(n, v) {
  return Array.from({ length: n }, () => v)
}

// Fixtures lifted from src/lib/__tests__/athlete/supercompensationWindow.test.js
const CLOSED_FIXTURE      = repeat(28, 100)
const AVAILABLE_FIXTURE   = [...repeat(40, 60), ...repeat(28, 30)]
const OPPORTUNITY_FIXTURE = [...repeat(80, 90), ...repeat(7, 10)]
const PEAK_FIXTURE        = [...repeat(80, 90), ...repeat(14, 10)]
const BUILDING_FIXTURE    = [...repeat(40, 100), ...repeat(3, 0)]

describe('SupercompensationWindowCard — insufficient data', () => {
  it('renders insufficient-data notice when reliable=false', () => {
    renderCard({ log: makeLog(repeat(10, 60)) })
    expect(
      screen.getByText(/Log 28\+ days to detect supercompensation windows/i)
    ).toBeInTheDocument()
  })

  it('renders TR insufficient-data notice when lang=tr', () => {
    renderCard({ log: makeLog(repeat(10, 60)) }, 'tr')
    expect(
      screen.getByText(/Pencere tespiti için 28\+ günlük log gerekli/i)
    ).toBeInTheDocument()
  })
})

describe('SupercompensationWindowCard — band classification', () => {
  it('renders muted CLOSED state for sustained heavy load no recovery', () => {
    renderCard({ log: makeLog(CLOSED_FIXTURE) })
    expect(screen.getByText(/No window/i)).toBeInTheDocument()
    expect(screen.getByText(/No supercompensation/i)).toBeInTheDocument()
  })

  it('renders AVAILABLE band for flat low load', () => {
    renderCard({ log: makeLog(AVAILABLE_FIXTURE) })
    expect(screen.getByText('AVAILABLE')).toBeInTheDocument()
    expect(screen.getByText(/Modest freshness window/i)).toBeInTheDocument()
  })

  it('renders OPPORTUNITY or PEAK band after 7d recovery from heavy block', () => {
    renderCard({ log: makeLog(OPPORTUNITY_FIXTURE) })
    const opp = screen.queryByText('OPPORTUNITY')
    const peak = screen.queryByText('PEAK')
    expect(opp || peak).toBeTruthy()
  })

  it('renders PEAK band after 14d recovery — fully cleared ATL', () => {
    renderCard({ log: makeLog(PEAK_FIXTURE) })
    expect(screen.getByText('PEAK')).toBeInTheDocument()
    expect(screen.getByText(/Peak readiness/i)).toBeInTheDocument()
  })

  it('renders BUILDING band when negative TSB rising', () => {
    renderCard({ log: makeLog(BUILDING_FIXTURE, TODAY, { includeZeros: true }) })
    expect(screen.getByText('BUILDING')).toBeInTheDocument()
    expect(screen.getByText(/Window approaching/i)).toBeInTheDocument()
  })
})

describe('SupercompensationWindowCard — bilingual', () => {
  it('renders English title when lang=en', () => {
    renderCard({ log: makeLog(PEAK_FIXTURE) })
    expect(screen.getByText('SUPERCOMPENSATION WINDOW')).toBeInTheDocument()
  })

  it('renders Turkish title and band label when lang=tr', () => {
    renderCard({ log: makeLog(PEAK_FIXTURE) }, 'tr')
    expect(screen.getByText('SÜPERKOMPANSASYON PENCERESİ')).toBeInTheDocument()
    expect(screen.getByText('ZİRVE')).toBeInTheDocument()
    expect(screen.getByText(/Zirve hazırlık/i)).toBeInTheDocument()
  })
})

describe('SupercompensationWindowCard — a11y + structure', () => {
  it('card root has role=region with bilingual aria-label', () => {
    renderCard({ log: makeLog(PEAK_FIXTURE) })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Supercompensation window/i)
  })

  it('renders the citation footer', () => {
    renderCard({ log: makeLog(PEAK_FIXTURE) })
    expect(screen.getByText(/Foster 1996 supercompensation/)).toBeInTheDocument()
  })
})

describe('SupercompensationWindowCard — numeric rendering', () => {
  it('peakDaysRemaining big number renders for peak band', () => {
    renderCard({ log: makeLog(PEAK_FIXTURE) })
    expect(screen.getAllByText(/DAYS LEFT/).length).toBeGreaterThan(0)
    expect(screen.getByText(/GÜN KALDI/)).toBeInTheDocument()
  })

  it('currentTSB renders signed with 1 decimal for peak band', () => {
    renderCard({ log: makeLog(PEAK_FIXTURE) })
    expect(screen.getByText(/^\+\d+\.\d$/)).toBeInTheDocument()
  })

  it('CTL/ATL sub-line renders both values', () => {
    renderCard({ log: makeLog(PEAK_FIXTURE) })
    expect(screen.getByText(/CTL:\s*\d+\.\d/i)).toBeInTheDocument()
    expect(screen.getByText(/ATL:\s*\d+\.\d/i)).toBeInTheDocument()
  })

  it('tsbRise7d sub-line renders when rise positive (peak fixture)', () => {
    renderCard({ log: makeLog(PEAK_FIXTURE) })
    expect(screen.getByText(/TSB rose \+\d+\.\d over last 7d/i)).toBeInTheDocument()
  })

  it('tsbRise7d sub-line absent for closed band (negative or zero rise)', () => {
    renderCard({ log: makeLog(CLOSED_FIXTURE) })
    expect(screen.queryByText(/TSB rose \+/i)).not.toBeInTheDocument()
  })
})
