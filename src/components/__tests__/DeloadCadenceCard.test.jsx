// @vitest-environment jsdom
// ─── DeloadCadenceCard.test.jsx — render tests for v8.86.0 card ────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import DeloadCadenceCard from '../dashboard/DeloadCadenceCard.jsx'

beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

const LAST_SUNDAY = '2026-05-03'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Mirrors makeWeeklyLog from src/lib/__tests__/athlete/deloadCadence.test.js.
// Each weekIdx 0=most-recent → N-1=oldest, anchored to LAST_SUNDAY.
function makeWeeklyLog(numWeeks, weekTssFn) {
  const log = []
  for (let w = 0; w < numWeeks; w++) {
    const weekEnd = addDays(LAST_SUNDAY, -7 * w)
    const weekStart = addDays(weekEnd, -6)
    const weekTSS = weekTssFn(w)
    const perDay = weekTSS / 7
    for (let d = 0; d < 7; d++) {
      log.push({ date: addDays(weekStart, d), type: 'run', tss: perDay })
    }
  }
  return log
}

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <DeloadCadenceCard {...props} />
    </LangCtx.Provider>
  )
}

// Reuse exact deterministic fixtures from the lib test file.
const ON_SCHEDULE_FIXTURE  = makeWeeklyLog(12, (w) => (w % 4 === 0 ? 200 : 400))
const OVERDUE_FIXTURE      = makeWeeklyLog(12, (w) => (w === 8 ? 100 : 400))
const TOO_FREQUENT_FIXTURE = makeWeeklyLog(12, (w) => (w % 2 === 0 ? 150 : 400))
const NO_PATTERN_FIXTURE   = makeWeeklyLog(12, () => 400)
const SHORT_LOG_FIXTURE    = makeWeeklyLog(5, () => 400)

describe('DeloadCadenceCard — insufficient data', () => {
  it('renders insufficient-data notice when log span < 8 weeks', () => {
    renderCard({ log: SHORT_LOG_FIXTURE })
    expect(
      screen.getByText(/Log 8\+ weeks with mean weekly TSS > 50 to track cadence/i)
    ).toBeInTheDocument()
  })

  it('renders TR insufficient-data notice when lang=tr', () => {
    renderCard({ log: SHORT_LOG_FIXTURE }, 'tr')
    expect(
      screen.getByText(/Ritim için 8\+ hafta ve haftalık ortalama TSS > 50 gerekli/i)
    ).toBeInTheDocument()
  })
})

describe('DeloadCadenceCard — band classification', () => {
  it('on-schedule fixture (3:1 cadence) renders ON-SCHEDULE badge', () => {
    renderCard({ log: ON_SCHEDULE_FIXTURE })
    expect(screen.getByText('ON-SCHEDULE')).toBeInTheDocument()
  })

  it('overdue fixture (last deload 8w ago) renders OVERDUE badge', () => {
    renderCard({ log: OVERDUE_FIXTURE })
    expect(screen.getByText('OVERDUE')).toBeInTheDocument()
  })

  it('too-frequent fixture (biweekly deloads) renders TOO FREQUENT badge', () => {
    renderCard({ log: TOO_FREQUENT_FIXTURE })
    expect(screen.getByText('TOO FREQUENT')).toBeInTheDocument()
  })

  it('no-pattern fixture (constant load) renders NO PATTERN badge', () => {
    renderCard({ log: NO_PATTERN_FIXTURE })
    expect(screen.getByText('NO PATTERN')).toBeInTheDocument()
  })
})

describe('DeloadCadenceCard — bilingual', () => {
  it('renders English title when lang=en', () => {
    renderCard({ log: ON_SCHEDULE_FIXTURE })
    expect(screen.getByText('DELOAD CADENCE — 12W')).toBeInTheDocument()
  })

  it('renders Turkish title and band label when lang=tr', () => {
    renderCard({ log: ON_SCHEDULE_FIXTURE }, 'tr')
    expect(screen.getByText('DELOAD RİTMİ — 12H')).toBeInTheDocument()
    expect(screen.getByText('PROGRAMDA')).toBeInTheDocument()
  })
})

describe('DeloadCadenceCard — a11y + structure', () => {
  it('card root has role=region with bilingual aria-label (en)', () => {
    renderCard({ log: ON_SCHEDULE_FIXTURE })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Deload cadence/i)
  })

  it('renders the citation footer', () => {
    renderCard({ log: ON_SCHEDULE_FIXTURE })
    expect(screen.getByText(/Bompa & Haff 2009/)).toBeInTheDocument()
  })
})

describe('DeloadCadenceCard — content rendering', () => {
  it('actualDeloads/expectedDeloads big number renders as X/Y with bilingual label', () => {
    renderCard({ log: ON_SCHEDULE_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/3\/3/)
    expect(region.textContent).toMatch(/DELOADS/)
    expect(region.textContent).toMatch(/DELOADLAR/)
  })

  it('weeksSinceLastDeload renders "—" when null (no-pattern case)', () => {
    renderCard({ log: NO_PATTERN_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/—/)
    expect(region.textContent).toMatch(/WEEKS SINCE/)
    expect(region.textContent).toMatch(/HAFTA GEÇTİ/)
  })

  it('recent deloads inline list renders with TSS values when applicable', () => {
    renderCard({ log: ON_SCHEDULE_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/Recent deloads:/)
    expect(region.textContent).toMatch(/Son deloadlar:/)
    expect(region.textContent).toMatch(/200 TSS/)
  })

  it('mean TSS sub-line renders bilingually with weeks count', () => {
    renderCard({ log: ON_SCHEDULE_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/mean:\s*\d+\.\d\s+TSS\/wk\s+over\s+12w/)
    expect(region.textContent).toMatch(/12h\s+üzerinde\s+ort:\s*\d+\.\d\s+TSS\/h/)
  })

  it('ratio sub-line renders with cap 0.75-1.50 bilingually', () => {
    renderCard({ log: ON_SCHEDULE_FIXTURE })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/ratio:\s*1\.00\s+\(cap 0\.75-1\.50\)/)
    expect(region.textContent).toMatch(/oran:\s*1\.00\s+\(eşik 0\.75-1\.50\)/)
  })
})
