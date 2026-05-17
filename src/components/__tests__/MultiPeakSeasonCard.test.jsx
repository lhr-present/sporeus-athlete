// @vitest-environment jsdom
// ─── MultiPeakSeasonCard.test.jsx — render tests for the EP-4 UI surface ────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import MultiPeakSeasonCard from '../dashboard/MultiPeakSeasonCard.jsx'

const STORAGE_KEY = 'sporeus-multiPeakSeason'

beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <MultiPeakSeasonCard profile={{ primarySport: 'Running' }} {...props} />
    </LangCtx.Provider>
  )
}

describe('MultiPeakSeasonCard — collapsed state', () => {
  it('renders the toggle entry point collapsed by default', () => {
    renderCard()
    const region = screen.getByRole('region', { name: /Multi-race season planner/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-multi-peak-card')).toBe('collapsed')
    expect(screen.getByRole('button', { name: /Plan a multi-race season/i })).toBeInTheDocument()
  })

  it('does NOT render race inputs while collapsed', () => {
    renderCard()
    expect(screen.queryByRole('button', { name: /ADD RACE/i })).toBeNull()
  })
})

describe('MultiPeakSeasonCard — race entry', () => {
  it('clicking expand → ADD RACE adds a draft race row', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Plan a multi-race season/i }))
    expect(screen.getByRole('button', { name: /ADD RACE/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ADD RACE/i }))
    expect(screen.getByLabelText(/Race 1 date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Race 1 label/i)).toBeInTheDocument()
  })

  it('default priority is B', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Plan a multi-race season/i }))
    fireEvent.click(screen.getByRole('button', { name: /ADD RACE/i }))
    const bBtn = screen.getByRole('button', { name: /^B$/ })
    expect(bBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('removing a race drops the row', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Plan a multi-race season/i }))
    fireEvent.click(screen.getByRole('button', { name: /ADD RACE/i }))
    expect(screen.getByLabelText(/Race 1 date/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Remove race 1/i }))
    expect(screen.queryByLabelText(/Race 1 date/i)).toBeNull()
  })
})

describe('MultiPeakSeasonCard — season output', () => {
  it('renders the season skeleton once at least one race has a date + priority', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Plan a multi-race season/i }))
    fireEvent.click(screen.getByRole('button', { name: /ADD RACE/i }))
    fireEvent.change(screen.getByLabelText(/Race 1 date/i), { target: { value: '2026-09-20' } })
    fireEvent.change(screen.getByLabelText(/Race 1 label/i), { target: { value: 'Istanbul Half' } })
    // priority defaults to B
    const output = document.querySelector('[data-multi-peak-output]')
    expect(output).not.toBeNull()
    expect(output.textContent).toMatch(/Istanbul Half/)
    expect(output.textContent).toMatch(/B/)
    expect(output.textContent).toMatch(/Issurin 2010/)
  })

  it('multiple A-races emit the Bompa 2009 warning', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Plan a multi-race season/i }))
    fireEvent.click(screen.getByRole('button', { name: /ADD RACE/i }))
    fireEvent.click(screen.getByRole('button', { name: /ADD RACE/i }))
    fireEvent.change(screen.getByLabelText(/Race 1 date/i), { target: { value: '2026-08-15' } })
    fireEvent.change(screen.getByLabelText(/Race 2 date/i), { target: { value: '2026-10-15' } })
    // Promote both to A
    const aBtns = screen.getAllByRole('button', { name: /^A$/ })
    fireEvent.click(aBtns[0])
    fireEvent.click(aBtns[1])
    const output = document.querySelector('[data-multi-peak-output]')
    expect(output.textContent).toMatch(/dilutes peak performance/i)
  })

  it('renders a phase cell for every week (Race week present)', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Plan a multi-race season/i }))
    fireEvent.click(screen.getByRole('button', { name: /ADD RACE/i }))
    fireEvent.change(screen.getByLabelText(/Race 1 date/i), { target: { value: '2026-08-15' } })
    const raceCells = document.querySelectorAll('[data-week-phase="Race"]')
    expect(raceCells.length).toBeGreaterThan(0)
  })
})

describe('MultiPeakSeasonCard — persistence + bilingual', () => {
  it('persists expanded + races to localStorage', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Plan a multi-race season/i }))
    fireEvent.click(screen.getByRole('button', { name: /ADD RACE/i }))
    fireEvent.change(screen.getByLabelText(/Race 1 date/i), { target: { value: '2026-09-20' } })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.expanded).toBe(true)
    expect(Array.isArray(stored.races)).toBe(true)
    expect(stored.races[0]?.date).toBe('2026-09-20')
    expect(stored.races[0]?.priority).toBe('B')
  })

  it('renders Turkish labels when lang=tr', () => {
    renderCard({}, 'tr')
    const region = screen.getByRole('region', { name: /Çoklu yarış sezon planlayıcısı/i })
    expect(region).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Çoklu yarış sezonu planla/i }))
    expect(screen.getByRole('button', { name: /YARIŞ EKLE/i })).toBeInTheDocument()
  })
})

// v9.195.0 — One-time auto-seed from profile.raceDate
describe('MultiPeakSeasonCard — auto-seed from profile.raceDate', () => {
  it('seeds the first race row with profile.raceDate when expanded with no races', () => {
    renderCard({ profile: { primarySport: 'Running', raceDate: '2026-08-15' } })
    fireEvent.click(screen.getByRole('button', { name: /Plan a multi-race season/i }))
    // Auto-seed runs in a useEffect on expand
    expect(screen.getByLabelText(/Race 1 date/i)).toHaveValue('2026-08-15')
    // Priority defaults to A for the seeded row
    const aBtn = screen.getByRole('button', { name: /^A$/ })
    expect(aBtn.getAttribute('aria-pressed')).toBe('true')
  })

  it('accepts nextRaceDate as a fallback (canonical raceDate getter)', () => {
    renderCard({ profile: { primarySport: 'Running', nextRaceDate: '2026-09-20' } })
    fireEvent.click(screen.getByRole('button', { name: /Plan a multi-race season/i }))
    expect(screen.getByLabelText(/Race 1 date/i)).toHaveValue('2026-09-20')
  })

  it('does NOT seed when profile has no race date', () => {
    renderCard({ profile: { primarySport: 'Running' } })
    fireEvent.click(screen.getByRole('button', { name: /Plan a multi-race season/i }))
    expect(screen.queryByLabelText(/Race 1 date/i)).toBeNull()
  })

  it('persists seededFromProfile flag — does not re-seed after athlete removes the row', () => {
    const profile = { primarySport: 'Running', raceDate: '2026-08-15' }
    const { unmount } = renderCard({ profile })
    fireEvent.click(screen.getByRole('button', { name: /Plan a multi-race season/i }))
    // Seeded row appears
    expect(screen.getByLabelText(/Race 1 date/i)).toHaveValue('2026-08-15')
    // Athlete removes it
    fireEvent.click(screen.getByRole('button', { name: /Remove race 1/i }))
    expect(screen.queryByLabelText(/Race 1 date/i)).toBeNull()
    // Re-render — seed must NOT fire again
    unmount()
    renderCard({ profile })
    // Card stays expanded (persisted) but races stays empty
    expect(screen.queryByLabelText(/Race 1 date/i)).toBeNull()
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.seededFromProfile).toBe(true)
    expect(stored.races).toEqual([])
  })

  it('does NOT seed when athlete already has manually-added races', () => {
    // Pre-seed localStorage as if the athlete already added a race manually
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      expanded: true,
      seededFromProfile: false,
      races: [{ date: '2026-10-01', label: 'manual', priority: 'B' }],
    }))
    renderCard({ profile: { primarySport: 'Running', raceDate: '2026-08-15' } })
    // The athlete's existing race is intact; no profile-seed prepended
    expect(screen.getByLabelText(/Race 1 date/i)).toHaveValue('2026-10-01')
    expect(screen.queryByLabelText(/Race 2 date/i)).toBeNull()
  })
})

// v9.202.0 — Bompa demote action
describe('MultiPeakSeasonCard — Bompa demote action', () => {
  it('demote button is absent when only one A-race exists', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      expanded: true,
      seededFromProfile: true,
      races: [
        { date: '2026-08-15', label: 'A', priority: 'A' },
        { date: '2026-09-15', label: 'B', priority: 'B' },
      ],
    }))
    renderCard()
    expect(document.querySelector('[data-bompa-demote-action]')).toBeNull()
  })

  it('demote button appears when ≥2 A-races trigger the Bompa warning', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      expanded: true,
      seededFromProfile: true,
      races: [
        { date: '2026-08-15', label: 'spring',  priority: 'A' },
        { date: '2026-10-15', label: 'fall',    priority: 'A' },
      ],
    }))
    renderCard()
    const btn = document.querySelector('[data-bompa-demote-action]')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toMatch(/DEMOTE EARLIER A-RACES TO B/i)
  })

  it('clicking demote keeps the chronologically latest A and turns earlier A-races to B', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      expanded: true,
      seededFromProfile: true,
      races: [
        { date: '2026-08-15', label: 'spring', priority: 'A' },
        { date: '2026-10-15', label: 'fall',   priority: 'A' },
        { date: '2026-09-20', label: 'mid',    priority: 'A' },
      ],
    }))
    renderCard()
    fireEvent.click(document.querySelector('[data-bompa-demote-action]'))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    // The 'fall' race (latest = 2026-10-15) keeps priority A
    const fall   = stored.races.find(r => r.label === 'fall')
    const spring = stored.races.find(r => r.label === 'spring')
    const mid    = stored.races.find(r => r.label === 'mid')
    expect(fall.priority).toBe('A')
    expect(spring.priority).toBe('B')
    expect(mid.priority).toBe('B')
  })

  it('demote action removes the warning + button after one click', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      expanded: true,
      seededFromProfile: true,
      races: [
        { date: '2026-08-15', label: 'spring', priority: 'A' },
        { date: '2026-10-15', label: 'fall',   priority: 'A' },
      ],
    }))
    renderCard()
    expect(document.querySelector('[data-bompa-demote-action]')).not.toBeNull()
    fireEvent.click(document.querySelector('[data-bompa-demote-action]'))
    // After demote, only 1 A-race remains → warning + button gone
    expect(document.querySelector('[data-bompa-demote-action]')).toBeNull()
  })

  it('demote button renders Turkish label when lang=tr', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      expanded: true,
      seededFromProfile: true,
      races: [
        { date: '2026-08-15', label: 'spring', priority: 'A' },
        { date: '2026-10-15', label: 'fall',   priority: 'A' },
      ],
    }))
    renderCard({}, 'tr')
    const btn = document.querySelector('[data-bompa-demote-action]')
    expect(btn).not.toBeNull()
    expect(btn.textContent).toMatch(/EN SON A DIŞINDAKİLERİ B YAP/i)
  })
})
