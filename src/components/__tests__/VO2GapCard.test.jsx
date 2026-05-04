// @vitest-environment jsdom
// ─── VO2GapCard.test.jsx — render tests for v8.73.0 VO2 gap card ────────────
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import VO2GapCard from '../dashboard/VO2GapCard.jsx'

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <VO2GapCard {...props} />
    </LangCtx.Provider>
  )
}

function todayStr() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Fixture builders ────────────────────────────────────────────────────────
// Build a log spanning 28d with ≥14 distinct days. Each entry uses zones array:
// zones = [Z1, Z2, Z3, Z4, Z5] minutes.
function makeLog({ z5DaysAgo = null, sharePct = 0, distinctDays = 18, totalLoadPerDay = 60 }) {
  const today = todayStr()
  const log = []
  // Spread distinctDays evenly across 0..27 days back
  const offsets = []
  for (let i = 0; i < distinctDays; i++) {
    offsets.push(Math.floor((i * 27) / Math.max(1, distinctDays - 1)))
  }
  for (const off of offsets) {
    log.push({
      date: addDays(today, -off),
      type: 'easy',
      zones: [totalLoadPerDay, 0, 0, 0, 0],
      duration: totalLoadPerDay,
      rpe: 4,
    })
  }
  if (z5DaysAgo !== null) {
    // Replace/add a Z5 session at z5DaysAgo. share = z5 / (z5 + total easy load)
    // Total non-Z5 load = distinctDays * totalLoadPerDay. We add z5 minutes to hit sharePct.
    const baseLoad = distinctDays * totalLoadPerDay
    // share = z5 / (baseLoad + z5)  →  z5 = share * baseLoad / (1 - share)
    const s = sharePct / 100
    const z5 = s > 0 && s < 1 ? (s * baseLoad) / (1 - s) : 0
    log.push({
      date: addDays(today, -z5DaysAgo),
      type: 'intervals',
      zones: [0, 0, 0, 0, z5],
      duration: z5,
      rpe: 9,
    })
  }
  return log
}

describe('VO2GapCard — insufficient data', () => {
  it('renders insufficient-data notice when fewer than 14 distinct days', () => {
    const log = makeLog({ distinctDays: 5 })
    renderCard({ log })
    expect(screen.getByText(/Log 14\+ distinct days in the 28-day window/i)).toBeInTheDocument()
  })

  it('renders TR insufficient-data notice when lang=tr', () => {
    const log = makeLog({ distinctDays: 5 })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/VO2max boşluğunu izlemek için 28 günde 14\+ farklı gün kaydet/i)).toBeInTheDocument()
  })
})

describe('VO2GapCard — band classification', () => {
  it('renders ok band brief healthy state when Z5 fresh and share ≥5%', () => {
    // Z5 done 2 days ago, share ~10% → ok
    const log = makeLog({ z5DaysAgo: 2, sharePct: 10, distinctDays: 18 })
    renderCard({ log })
    expect(screen.getByText(/Z5 within range — stimulus fresh\./i)).toBeInTheDocument()
  })

  it('renders WARNING band when daysSince in (10, 14]', () => {
    // Z5 done 12 days ago, share = 10% (high enough to not trigger share warning) → warning by recency
    const log = makeLog({ z5DaysAgo: 12, sharePct: 10, distinctDays: 18 })
    renderCard({ log })
    expect(screen.getByText('WARNING')).toBeInTheDocument()
  })

  it('renders CRITICAL band when daysSince in (14, 21]', () => {
    // Z5 done 18 days ago, share ≥2% so not severe; daysSince > 14, ≤ 21 → critical
    const log = makeLog({ z5DaysAgo: 18, sharePct: 4, distinctDays: 18 })
    renderCard({ log })
    expect(screen.getByText('CRITICAL')).toBeInTheDocument()
  })

  it('renders SEVERE band when daysSince > 21', () => {
    // Z5 done 25 days ago → severe
    const log = makeLog({ z5DaysAgo: 25, sharePct: 5, distinctDays: 18 })
    renderCard({ log })
    expect(screen.getByText('SEVERE')).toBeInTheDocument()
  })

  it('renders NEVER band when no Z5 in window but load exists', () => {
    const log = makeLog({ z5DaysAgo: null, distinctDays: 18 })
    renderCard({ log })
    // 'NEVER' appears in band badge AND big-number slot
    expect(screen.getAllByText('NEVER').length).toBeGreaterThanOrEqual(1)
  })
})

describe('VO2GapCard — bilingual', () => {
  it('renders English title when lang=en', () => {
    const log = makeLog({ z5DaysAgo: 18, sharePct: 4, distinctDays: 18 })
    renderCard({ log })
    expect(screen.getByText('VO2MAX GAP — 28D')).toBeInTheDocument()
  })

  it('renders Turkish title and band label when lang=tr', () => {
    const log = makeLog({ z5DaysAgo: 18, sharePct: 4, distinctDays: 18 })
    renderCard({ log }, 'tr')
    expect(screen.getByText('VO2MAX BOŞLUĞU — 28G')).toBeInTheDocument()
    expect(screen.getByText('KRİTİK')).toBeInTheDocument()
  })
})

describe('VO2GapCard — a11y + structure', () => {
  it('card root has role=region with bilingual aria-label (en)', () => {
    const log = makeLog({ z5DaysAgo: 18, sharePct: 4, distinctDays: 18 })
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/VO2max gap/i)
  })

  it('renders the citation footer', () => {
    const log = makeLog({ z5DaysAgo: 18, sharePct: 4, distinctDays: 18 })
    renderCard({ log })
    expect(screen.getByText(/Stöggl & Sperlich 2014/)).toBeInTheDocument()
  })
})

describe('VO2GapCard — numeric rendering', () => {
  it('share28d renders with % suffix', () => {
    const log = makeLog({ z5DaysAgo: 18, sharePct: 4, distinctDays: 18 })
    renderCard({ log })
    // share ≈ 4.0% — match a number followed by %
    expect(screen.getByText(/^\d+\.\d%$/)).toBeInTheDocument()
  })

  it('daysSince renders as number for non-never bands', () => {
    const log = makeLog({ z5DaysAgo: 18, sharePct: 4, distinctDays: 18 })
    renderCard({ log })
    expect(screen.getByText('18')).toBeInTheDocument()
  })

  it('renders NEVER placeholder when band==="never"', () => {
    const log = makeLog({ z5DaysAgo: null, distinctDays: 18 })
    renderCard({ log })
    // NEVER appears both in band badge and in the big-number slot
    const matches = screen.getAllByText('NEVER')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })
})
