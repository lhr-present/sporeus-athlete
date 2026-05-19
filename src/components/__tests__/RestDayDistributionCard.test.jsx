// @vitest-environment jsdom
// ─── RestDayDistributionCard.test.jsx — render tests ────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RestDayDistributionCard from '../dashboard/RestDayDistributionCard.jsx'

// ─── Anchored time: today = 2026-04-28 → windowStart = 2026-04-01 ──────────
beforeEach(() => { vi.setSystemTime(new Date('2026-04-28T12:00:00Z')) })
afterEach(()  => { vi.setSystemTime(new Date()) })

const WINDOW_START = '2026-04-01'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Build a 28-day log from per-day RPE pattern (null = REST). */
function buildLog(patternRpe) {
  const log = []
  for (let i = 0; i < 28; i++) {
    const rpe = patternRpe[i]
    if (rpe != null) {
      log.push({ date: addDays(WINDOW_START, i), rpe, type: 'run' })
    }
  }
  if (patternRpe[0] == null) {
    log.push({ date: addDays(WINDOW_START, -1), rpe: 5, type: 'easy' })
  }
  return log
}

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <RestDayDistributionCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Fixtures ───────────────────────────────────────────────────────────────
// WELL_PLACED: HARD-REST-EASY-EASY cycle (7 hards, all followed by rest, 7 rest)
function wellPlacedPattern() {
  const pat = new Array(28).fill(null)
  for (let i = 0; i < 28; i++) {
    const m = i % 4
    if (m === 0) pat[i] = 8           // HARD
    else if (m === 1) pat[i] = null   // REST
    else pat[i] = 5                   // EASY
  }
  return pat
}

// MIXED: 4 hards, rest days scattered elsewhere (not after hard)
function mixedPattern() {
  const pat = new Array(28).fill(null)
  for (let i = 0; i < 28; i++) pat[i] = 5
  pat[0] = 8; pat[7] = 8; pat[14] = 8; pat[21] = 8
  pat[4]  = null
  pat[11] = null
  pat[18] = null
  pat[25] = null
  return pat
}

// TOO_FEW_REST: only 3 rest days
function tooFewPattern() {
  const pat = new Array(28).fill(null)
  for (let i = 0; i < 28; i++) pat[i] = 5
  pat[0] = 8; pat[2] = 8
  pat[1] = null
  pat[3] = null
  pat[5] = null
  return pat
}

const WELL_LOG  = buildLog(wellPlacedPattern())
const MIXED_LOG = buildLog(mixedPattern())
const TOO_FEW_LOG = buildLog(tooFewPattern())

// ─── 1. Render-null cases ───────────────────────────────────────────────────
describe('RestDayDistributionCard — renders null on insufficient data', () => {
  it('renders nothing for empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when log prop is missing', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 5 active days', () => {
    const log = [
      { date: addDays(WINDOW_START, -1), rpe: 5 },
      { date: addDays(WINDOW_START, 10), rpe: 8 },
      { date: addDays(WINDOW_START, 15), rpe: 8 },
      { date: addDays(WINDOW_START, 20), rpe: 8 },
      { date: addDays(WINDOW_START, 25), rpe: 8 },
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── 2. Pattern rendering ────────────────────────────────────────────────────
describe('RestDayDistributionCard — renders each pattern', () => {
  it('WELL_PLACED badge + hint (en)', () => {
    renderCard({ log: WELL_LOG })
    expect(screen.getByText('WELL PLACED')).toBeInTheDocument()
    expect(screen.getByText(/Rest days frequently follow hard days/i))
      .toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-rest-pattern')).toBe('WELL_PLACED')
  })

  it('MIXED badge + hint (en)', () => {
    renderCard({ log: MIXED_LOG })
    expect(screen.getByText('MIXED')).toBeInTheDocument()
    expect(screen.getByText(/Enough rest, but scattered/i))
      .toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-rest-pattern')).toBe('MIXED')
  })

  it('TOO_FEW_REST badge + hint (en)', () => {
    renderCard({ log: TOO_FEW_LOG })
    expect(screen.getByText('TOO FEW')).toBeInTheDocument()
    expect(screen.getByText(/Fewer than 1 rest day per week/i))
      .toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-rest-pattern')).toBe('TOO_FEW_REST')
  })
})

// ─── 3. Turkish ─────────────────────────────────────────────────────────────
describe('RestDayDistributionCard — Turkish labels', () => {
  it('renders Turkish title + WELL_PLACED label + hint', () => {
    renderCard({ log: WELL_LOG }, 'tr')
    expect(screen.getByText('DİNLENME GÜNÜ YERLEŞİMİ · 28G')).toBeInTheDocument()
    expect(screen.getByText('İYİ YERLEŞMİŞ')).toBeInTheDocument()
    expect(screen.getByText(/klasik sert-kolay yapı/i)).toBeInTheDocument()
  })

  it('renders Turkish MIXED label + hint', () => {
    renderCard({ log: MIXED_LOG }, 'tr')
    expect(screen.getByText('KARIŞIK')).toBeInTheDocument()
    expect(screen.getByText(/Yeterli dinlenme var ama dağınık/i))
      .toBeInTheDocument()
  })

  it('renders Turkish TOO_FEW_REST label + hint', () => {
    renderCard({ log: TOO_FEW_LOG }, 'tr')
    expect(screen.getByText('AZ DİNLENME')).toBeInTheDocument()
    expect(screen.getByText(/Haftada 1'den az dinlenme/i))
      .toBeInTheDocument()
  })

  it('renders English title in EN mode', () => {
    renderCard({ log: WELL_LOG })
    expect(screen.getByText('REST DAY PLACEMENT · 28D')).toBeInTheDocument()
  })
})

// ─── 4. Data anchors + a11y ─────────────────────────────────────────────────
describe('RestDayDistributionCard — data anchors + a11y', () => {
  it('exposes role="region" with bilingual aria-label (en)', () => {
    renderCard({ log: WELL_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Rest day placement/i)
  })

  it('exposes role="region" with Turkish aria-label (tr)', () => {
    renderCard({ log: WELL_LOG }, 'tr')
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Dinlenme günü yerleşimi/i)
  })

  it('exposes data-rest-day-distribution-card on root', () => {
    renderCard({ log: WELL_LOG })
    const region = screen.getByRole('region')
    expect(region.hasAttribute('data-rest-day-distribution-card')).toBe(true)
  })

  it('exposes all required data-* anchors with correct values (WELL_PLACED)', () => {
    renderCard({ log: WELL_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-rest-pattern')).toBe('WELL_PLACED')
    expect(region.getAttribute('data-rest-day-count')).toBe('7')
    expect(region.getAttribute('data-hard-day-count')).toBe('7')
    expect(region.getAttribute('data-post-hard-rest-count')).toBe('7')
    expect(region.getAttribute('data-post-hard-rest-rate')).toBe('1')
  })

  it('exposes correct values for MIXED', () => {
    renderCard({ log: MIXED_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-rest-pattern')).toBe('MIXED')
    expect(region.getAttribute('data-rest-day-count')).toBe('4')
    expect(region.getAttribute('data-hard-day-count')).toBe('4')
    expect(region.getAttribute('data-post-hard-rest-count')).toBe('0')
    expect(region.getAttribute('data-post-hard-rest-rate')).toBe('0')
  })

  it('renders the big rest-day count and rate percentage', () => {
    renderCard({ log: WELL_LOG })
    // Big number "7" appears as text content somewhere — check the rest-days line
    expect(screen.getByText(/7 rest days \/ 28d/i)).toBeInTheDocument()
    expect(screen.getByText(/100% of hard days followed by rest/i))
      .toBeInTheDocument()
    expect(screen.getByText(/7 hard · 7 hard→rest/i)).toBeInTheDocument()
  })

  it('renders citation footer', () => {
    renderCard({ log: WELL_LOG })
    expect(screen.getByText(/Bompa 2018; Foster 2001/)).toBeInTheDocument()
  })
})
