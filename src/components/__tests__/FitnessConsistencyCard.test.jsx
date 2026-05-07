// @vitest-environment jsdom
// ─── FitnessConsistencyCard.test.jsx — render tests for v8.84.0 card ────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import FitnessConsistencyCard from '../dashboard/FitnessConsistencyCard.jsx'

beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

const TODAY = '2026-05-07'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeLog(count, endDate, tss) {
  const log = []
  for (let i = 0; i < count; i++) {
    const v = typeof tss === 'function' ? tss(i) : tss
    log.push({ date: addDays(endDate, -(count - 1 - i)), type: 'run', tss: v })
  }
  return log
}

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <FitnessConsistencyCard {...props} />
    </LangCtx.Provider>
  )
}

// Mirrors deterministic fixtures from src/lib/__tests__/athlete/fitnessConsistency.test.js
const ROCK_SOLID_FIXTURE = makeLog(280, TODAY, 80)
const STABLE_FIXTURE = makeLog(280, TODAY, (i) => 60 + i * 0.05)
const OSCILLATING_FIXTURE = (() => {
  const prime = 200
  const test = 90
  return makeLog(prime + test, TODAY, (i) => {
    if (i < prime) return 70
    const w = Math.floor((i - prime) / 7)
    return w % 2 === 0 ? 200 : 0
  })
})()
const CHAOTIC_FIXTURE = (() => {
  const prime = 30
  const test = 90
  return makeLog(prime + test, TODAY, (i) => {
    if (i < prime) return 0
    const w = Math.floor((i - prime) / 7)
    return w % 2 === 0 ? 200 : 0
  })
})()

describe('FitnessConsistencyCard — insufficient data', () => {
  it('renders insufficient-data notice when log span < 90d', () => {
    renderCard({ log: makeLog(60, TODAY, 80) })
    expect(
      screen.getByText(/Log 90\+ days with mean CTL > 5 to track consistency/i)
    ).toBeInTheDocument()
  })

  it('renders TR insufficient-data notice when lang=tr', () => {
    renderCard({ log: makeLog(60, TODAY, 80) }, 'tr')
    expect(
      screen.getByText(/Tutarlılık için 90\+ gün ve ortalama CTL > 5 gerekli/i)
    ).toBeInTheDocument()
  })
})

describe('FitnessConsistencyCard — band classification', () => {
  it('rock-solid fixture (flat constant load 280d) renders ROCK-SOLID badge', () => {
    renderCard({ log: ROCK_SOLID_FIXTURE })
    expect(screen.getByText('ROCK-SOLID')).toBeInTheDocument()
  })

  it('stable/gradually rising fixture renders a non-chaotic badge', () => {
    renderCard({ log: STABLE_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/ROCK-SOLID|STABLE|OSCILLATING/)
    expect(region.textContent).not.toMatch(/CHAOTIC/)
  })

  it('oscillating fixture (alternating heavy/easy weeks) renders non-rock-solid band', () => {
    renderCard({ log: OSCILLATING_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/STABLE|OSCILLATING|CHAOTIC/)
    expect(region.textContent).not.toMatch(/ROCK-SOLID/)
  })

  it('chaotic fixture (200 vs 0 from low base) renders OSCILLATING or CHAOTIC band', () => {
    renderCard({ log: CHAOTIC_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/OSCILLATING|CHAOTIC/)
  })
})

describe('FitnessConsistencyCard — bilingual', () => {
  it('renders English title when lang=en', () => {
    renderCard({ log: ROCK_SOLID_FIXTURE })
    expect(screen.getByText('FITNESS CONSISTENCY — 90D')).toBeInTheDocument()
  })

  it('renders Turkish title and band label when lang=tr', () => {
    renderCard({ log: ROCK_SOLID_FIXTURE }, 'tr')
    expect(screen.getByText('CTL TUTARLILIĞI — 90G')).toBeInTheDocument()
    expect(screen.getByText('ÇOK STABİL')).toBeInTheDocument()
  })
})

describe('FitnessConsistencyCard — a11y + structure', () => {
  it('card root has role=region with bilingual aria-label (en)', () => {
    renderCard({ log: ROCK_SOLID_FIXTURE })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Fitness consistency/i)
  })

  it('renders the citation footer', () => {
    renderCard({ log: ROCK_SOLID_FIXTURE })
    expect(screen.getByText(/Banister 1991/)).toBeInTheDocument()
  })
})

describe('FitnessConsistencyCard — content rendering', () => {
  it('mean CTL big number renders with 1 decimal and MEAN CTL · ORT CTL label', () => {
    renderCard({ log: ROCK_SOLID_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/\d+\.\d/)
    expect(region.textContent).toMatch(/MEAN CTL/)
    expect(region.textContent).toMatch(/ORT CTL/)
  })

  it('range percentage big number renders with X.X% and RANGE · ARALIK label', () => {
    renderCard({ log: ROCK_SOLID_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/\d+\.\d%/)
    expect(region.textContent).toMatch(/RANGE/)
    expect(region.textContent).toMatch(/ARALIK/)
  })

  it('min/max sub-line renders both values with 1 decimal each', () => {
    renderCard({ log: ROCK_SOLID_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/min:\s*\d+\.\d/)
    expect(region.textContent).toMatch(/max:\s*\d+\.\d/)
  })

  it('stdev / weeksAnalyzed sub-line renders bilingually', () => {
    renderCard({ log: ROCK_SOLID_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/stdev:\s*\d+\.\d\s+over\s+\d+\s+weeks/)
    expect(region.textContent).toMatch(/\d+\s+hafta üzerinden std \d+\.\d/)
  })
})
