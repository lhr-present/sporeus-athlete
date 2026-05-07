// @vitest-environment jsdom
// ─── TrainingDiversityCard.test.jsx — render tests for v8.86.0 diversity ─────
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TrainingDiversityCard from '../dashboard/TrainingDiversityCard.jsx'

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <TrainingDiversityCard {...props} />
    </LangCtx.Provider>
  )
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const TODAY = todayStr()

const entry = (type, daysAgo, duration = 60) => ({
  date: addDays(TODAY, -daysAgo),
  type,
  duration,
})

function buildMonotypic() {
  const log = []
  for (let i = 0; i < 10; i++) log.push(entry('run', i))
  return log
}
function buildLimited() {
  const log = []
  for (let i = 0; i < 5; i++) log.push(entry('run', i))
  for (let i = 0; i < 5; i++) log.push(entry('bike', i + 5))
  return log
}
function buildBalanced() {
  const log = []
  for (let i = 0; i < 4; i++) log.push(entry('run', i))
  for (let i = 0; i < 4; i++) log.push(entry('bike', i + 4))
  for (let i = 0; i < 4; i++) log.push(entry('swim', i + 8))
  return log
}
function buildFragmented() {
  const log = []
  for (let i = 0; i < 3; i++) log.push(entry('run', i))
  for (let i = 0; i < 3; i++) log.push(entry('bike', i + 3))
  for (let i = 0; i < 3; i++) log.push(entry('swim', i + 6))
  for (let i = 0; i < 3; i++) log.push(entry('strength', i + 9))
  for (let i = 0; i < 3; i++) log.push(entry('yoga', i + 12))
  return log
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('TrainingDiversityCard — insufficient data', () => {
  it('renders insufficient-data notice when <5 sessions (reliable=false)', () => {
    const log = [entry('run', 1), entry('bike', 2)]
    renderCard({ log })
    expect(screen.getByText(/Log 5\+ sessions to see diversity/i)).toBeInTheDocument()
  })

  it('renders TR insufficient-data copy', () => {
    renderCard({ log: [] }, 'tr')
    expect(screen.getByText(/Çeşitliliği görmek için 5\+ seans kaydet/i)).toBeInTheDocument()
  })
})

describe('TrainingDiversityCard — band classification', () => {
  it('monotypic band — 10 run-only sessions', () => {
    renderCard({ log: buildMonotypic() })
    expect(screen.getByText('MONOTYPIC')).toBeInTheDocument()
    expect(screen.getByText(/Single-sport focus/i)).toBeInTheDocument()
  })

  it('limited band — 5 run + 5 bike', () => {
    renderCard({ log: buildLimited() })
    expect(screen.getByText('LIMITED')).toBeInTheDocument()
    expect(screen.getByText(/Two sports active/i)).toBeInTheDocument()
  })

  it('balanced band — 4 run + 4 bike + 4 swim', () => {
    renderCard({ log: buildBalanced() })
    expect(screen.getByText('BALANCED')).toBeInTheDocument()
    expect(screen.getByText(/Balanced multi-sport mix/i)).toBeInTheDocument()
  })

  it('fragmented band — 5 sports equal', () => {
    renderCard({ log: buildFragmented() })
    expect(screen.getByText('FRAGMENTED')).toBeInTheDocument()
    expect(screen.getByText(/Many sports, none dominant/i)).toBeInTheDocument()
  })
})

describe('TrainingDiversityCard — bilingual', () => {
  it('renders EN title', () => {
    renderCard({ log: buildBalanced() })
    expect(screen.getByText(/TRAINING DIVERSITY — 28D/i)).toBeInTheDocument()
  })

  it('renders TR title and band label when lang=tr', () => {
    renderCard({ log: buildLimited() }, 'tr')
    expect(screen.getByText(/ANTRENMAN ÇEŞİTLİLİĞİ — 28G/i)).toBeInTheDocument()
    expect(screen.getByText('SINIRLI')).toBeInTheDocument()
    expect(screen.getByText(/İki spor aktif/i)).toBeInTheDocument()
  })
})

describe('TrainingDiversityCard — a11y + visuals', () => {
  it('card root has role=region with bilingual aria-label', () => {
    renderCard({ log: buildBalanced() })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Training diversity/i)
  })

  it('renders role=img stacked bar with aria-label', () => {
    renderCard({ log: buildBalanced() })
    const bar = screen.getByRole('img')
    expect(bar).toBeInTheDocument()
    expect(bar.getAttribute('aria-label')).toMatch(/Sport mix/i)
  })

  it('renders citation footer', () => {
    renderCard({ log: buildBalanced() })
    expect(screen.getByText(/Bompa & Haff 2009 multi-sport/)).toBeInTheDocument()
  })

  it('renders SPORTS and HHI big numbers', () => {
    renderCard({ log: buildBalanced() })
    expect(screen.getByText(/SPORTS/)).toBeInTheDocument()
    expect(screen.getByText(/HHI/)).toBeInTheDocument()
    expect(screen.getByText(/\/5/)).toBeInTheDocument()
  })
})

describe('TrainingDiversityCard — breakdown + dominant callout', () => {
  it('renders per-sport breakdown rows', () => {
    renderCard({ log: buildBalanced() })
    const list = screen.getByRole('list', { name: /Per-sport breakdown/i })
    expect(list).toBeInTheDocument()
    const items = list.querySelectorAll('[role="listitem"]')
    expect(items.length).toBe(3)
    expect(screen.getByText(/Run: 4 sessions/i)).toBeInTheDocument()
    expect(screen.getByText(/Bike: 4 sessions/i)).toBeInTheDocument()
    expect(screen.getByText(/Swim: 4 sessions/i)).toBeInTheDocument()
  })

  it('renders dominant callout when band !== balanced', () => {
    renderCard({ log: buildMonotypic() })
    expect(screen.getByText(/Dominant: Run/i)).toBeInTheDocument()
  })

  it('omits dominant callout for balanced band', () => {
    renderCard({ log: buildBalanced() })
    expect(screen.queryByText(/Dominant:/i)).not.toBeInTheDocument()
  })
})
