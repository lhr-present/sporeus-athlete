// @vitest-environment jsdom
// ─── NewSessionTypeIntroCard.test.jsx — render tests for the novel-type card ─
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import NewSessionTypeIntroCard from '../dashboard/NewSessionTypeIntroCard.jsx'

const TODAY = '2026-05-19'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: (k) => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <NewSessionTypeIntroCard {...props} />
    </LangCtx.Provider>
  )
}

function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeEntry(daysAgo, type) {
  return { date: addDaysIso(TODAY, -daysAgo), type }
}

/** Build N baseline sessions all of the same type. */
function baselineRuns(n) {
  const log = []
  for (let i = 0; i < n; i++) log.push(makeEntry(20 + i, 'easy run'))
  return log
}

describe('NewSessionTypeIntroCard — null gating', () => {
  it('renders nothing when log is empty', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when baseline coverage is too thin', () => {
    const log = []
    for (let i = 0; i < 5; i++) log.push(makeEntry(20 + i, 'easy run'))
    log.push(makeEntry(3, 'plyometrics'))
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

describe('NewSessionTypeIntroCard — band rendering', () => {
  it('renders NO_NOVEL band when no new types appear', () => {
    const log = baselineRuns(12)
    log.push(makeEntry(3, 'easy run'))
    renderCard({ log })
    const card = screen.getByRole('region', { name: /New session types/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-card')).toBe('new-session-type-intro')
    expect(card.querySelector('[data-band]').getAttribute('data-band')).toBe('NO_NOVEL')
    expect(card.textContent).toMatch(/NO NEW TYPES/)
  })

  it('renders SINGLE_NOVEL band when one new type appears', () => {
    const log = baselineRuns(12)
    log.push(makeEntry(3, 'hill repeats'))
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.querySelector('[data-band]').getAttribute('data-band')).toBe('SINGLE_NOVEL')
    expect(card.textContent).toMatch(/1 NEW TYPE/)
  })

  it('renders MULTIPLE_NOVEL band when 2+ new types appear', () => {
    const log = baselineRuns(12)
    log.push(makeEntry(2, 'plyometrics'))
    log.push(makeEntry(5, 'strength'))
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.querySelector('[data-band]').getAttribute('data-band')).toBe('MULTIPLE_NOVEL')
    expect(card.textContent).toMatch(/MULTIPLE NEW/)
  })
})

describe('NewSessionTypeIntroCard — novel-type list', () => {
  it('lists each novel type as a list item with the type name', () => {
    const log = baselineRuns(12)
    log.push(makeEntry(2, 'hill repeats'))
    log.push(makeEntry(5, 'strength'))
    renderCard({ log })

    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(2)
    const keys = items.map((el) => el.getAttribute('data-novel-type'))
    expect(keys).toEqual(['hill repeats', 'strength'])
  })

  it('shows session count + days-ago for each novel type', () => {
    const log = baselineRuns(12)
    log.push(makeEntry(3, 'hill repeats'))
    log.push(makeEntry(7, 'hill repeats'))
    renderCard({ log })

    const card = screen.getByRole('region')
    // 2 sessions
    expect(card.textContent).toMatch(/2 sessions/)
    // first-seen date (7 days ago)
    expect(card.textContent).toMatch(/7 days ago/)
  })

  it('omits the list section when no novel types are present', () => {
    const log = baselineRuns(12)
    log.push(makeEntry(3, 'easy run'))
    renderCard({ log })
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})

describe('NewSessionTypeIntroCard — Turkish', () => {
  it('renders Turkish title + band label + hint', () => {
    const log = baselineRuns(12)
    log.push(makeEntry(3, 'hill repeats'))
    renderCard({ log }, 'tr')

    expect(screen.getByText(/YENİ ANTRENMAN TÜRLERİ/)).toBeInTheDocument()
    expect(screen.getByText(/1 YENİ TÜR/)).toBeInTheDocument()
    expect(
      screen.getByText(/Antrenmana yeni bir seans türü girdi/i)
    ).toBeInTheDocument()
  })

  it('uses Turkish session/days suffixes in list items', () => {
    const log = baselineRuns(12)
    log.push(makeEntry(2, 'tempo'))
    log.push(makeEntry(2, 'tempo'))
    renderCard({ log }, 'tr')
    const card = screen.getByRole('region')
    expect(card.textContent).toMatch(/2 seans/)
    expect(card.textContent).toMatch(/2 gün önce/)
  })
})

describe('NewSessionTypeIntroCard — accessibility + citation', () => {
  it('has region role and bilingual aria-label (EN)', () => {
    const log = baselineRuns(12)
    log.push(makeEntry(3, 'hill repeats'))
    renderCard({ log })
    const card = screen.getByRole('region', { name: 'New session types' })
    expect(card).toBeInTheDocument()
  })

  it('has region role and bilingual aria-label (TR)', () => {
    const log = baselineRuns(12)
    log.push(makeEntry(3, 'hill repeats'))
    renderCard({ log }, 'tr')
    const card = screen.getByRole('region', { name: 'Yeni antrenman türleri' })
    expect(card).toBeInTheDocument()
  })

  it('renders Gabbett 2016; Hulin 2014 citation footer', () => {
    const log = baselineRuns(12)
    log.push(makeEntry(3, 'hill repeats'))
    renderCard({ log })
    expect(screen.getByText(/Gabbett 2016; Hulin 2014/)).toBeInTheDocument()
  })
})
