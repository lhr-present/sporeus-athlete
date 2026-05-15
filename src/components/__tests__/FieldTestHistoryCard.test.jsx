// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import FieldTestHistoryCard from '../dashboard/FieldTestHistoryCard.jsx'
import { LangCtx } from '../../contexts/LangCtx.jsx'

function withLang(lang, ui) {
  return render(<LangCtx.Provider value={{ lang, t: () => '' }}>{ui}</LangCtx.Provider>)
}

function seed(entries) {
  localStorage.setItem('sporeus-field-test-results', JSON.stringify(entries))
}

beforeEach(() => { localStorage.clear() })

describe('FieldTestHistoryCard — empty / invalid', () => {
  it('renders null when localStorage is empty', () => {
    const { container } = withLang('en', <FieldTestHistoryCard />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when stored value is not an array', () => {
    localStorage.setItem('sporeus-field-test-results', JSON.stringify({}))
    const { container } = withLang('en', <FieldTestHistoryCard />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when all entries have invalid shape', () => {
    seed([
      { field: 'banana', value: 50 },        // unknown field
      { field: 'vdot', value: 'not-a-num' }, // bad value
    ])
    const { container } = withLang('en', <FieldTestHistoryCard />)
    expect(container.firstChild).toBeNull()
  })
})

describe('FieldTestHistoryCard — single entry', () => {
  it('renders the entry with no delta and "single test" hint', () => {
    seed([{ date: '2026-05-17', sport: 'run', field: 'vdot', value: 47 }])
    withLang('en', <FieldTestHistoryCard />)
    expect(screen.getByText(/FIELD TEST HISTORY/i)).toBeInTheDocument()
    expect(screen.getByText('VDOT')).toBeInTheDocument()
    expect(screen.getByText(/Single test/i)).toBeInTheDocument()
    expect(screen.getByText('47.0')).toBeInTheDocument()
  })
})

describe('FieldTestHistoryCard — multi-entry per metric', () => {
  it('sorts newest first and computes delta from previous entry', () => {
    seed([
      { date: '2026-01-15', sport: 'run', field: 'vdot', value: 42 },
      { date: '2026-03-10', sport: 'run', field: 'vdot', value: 45 },
      { date: '2026-05-17', sport: 'run', field: 'vdot', value: 47 },
    ])
    withLang('en', <FieldTestHistoryCard />)

    // Trend summary: 42.0 → 47.0 (+5.0) — these strings appear in both
    // the summary line and table cells, so getAllByText is appropriate.
    expect(screen.getAllByText(/42\.0/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/47\.0/).length).toBeGreaterThan(0)
    expect(screen.getByText(/\+5\.0/)).toBeInTheDocument()
    expect(screen.getByText(/over \d+ weeks/i)).toBeInTheDocument()

    // Newest row first
    const rows = document.querySelectorAll('tbody tr')
    expect(rows[0].textContent).toContain('2026-05-17')
    expect(rows[1].textContent).toContain('2026-03-10')
    expect(rows[2].textContent).toContain('2026-01-15')
  })

  it('delta sign tracks "better direction" — higher VDOT is good (green)', () => {
    seed([
      { date: '2026-01-15', sport: 'run', field: 'vdot', value: 42 },
      { date: '2026-05-17', sport: 'run', field: 'vdot', value: 47 },
    ])
    withLang('en', <FieldTestHistoryCard />)
    // delta cell for newest row
    const deltaCells = document.querySelectorAll('tbody tr:first-child td')
    const deltaCell = deltaCells[2]
    expect(deltaCell.textContent).toContain('+5.0')
    expect(deltaCell.getAttribute('style')).toContain('rgb(91, 194, 91)')  // green
  })

  it('delta sign for CSS — lower is better (negative delta = green)', () => {
    seed([
      { date: '2026-01-15', sport: 'swim', field: 'cssSec', value: 100 },
      { date: '2026-05-17', sport: 'swim', field: 'cssSec', value: 92 },
    ])
    withLang('en', <FieldTestHistoryCard />)
    const deltaCells = document.querySelectorAll('tbody tr:first-child td')
    const deltaCell = deltaCells[2]
    expect(deltaCell.textContent).toContain('-8')
    expect(deltaCell.getAttribute('style')).toContain('rgb(91, 194, 91)')  // green (CSS dropped = faster)
  })

  it('delta sign for FTP regression — lower is bad (red)', () => {
    seed([
      { date: '2026-01-15', sport: 'bike', field: 'ftp', value: 280 },
      { date: '2026-05-17', sport: 'bike', field: 'ftp', value: 270 },
    ])
    withLang('en', <FieldTestHistoryCard />)
    const deltaCells = document.querySelectorAll('tbody tr:first-child td')
    const deltaCell = deltaCells[2]
    expect(deltaCell.textContent).toContain('-10')
    expect(deltaCell.getAttribute('style')).toContain('rgb(224, 48, 48)')  // red
  })
})

describe('FieldTestHistoryCard — multi-metric grouping (triathlete)', () => {
  it('renders separate section per metric, sorted by data presence', () => {
    seed([
      { date: '2026-01-15', sport: 'triathlon', field: 'vdot',   value: 45 },
      { date: '2026-02-10', sport: 'triathlon', field: 'ftp',    value: 260 },
      { date: '2026-03-15', sport: 'triathlon', field: 'cssSec', value: 95 },
      { date: '2026-05-17', sport: 'triathlon', field: 'vdot',   value: 48 },
    ])
    withLang('en', <FieldTestHistoryCard />)
    // Headers include the unit in parens: "VDOT", "FTP (W)", "CSS (s/100m)"
    expect(screen.getByText(/^VDOT$/)).toBeInTheDocument()
    expect(screen.getByText(/^FTP \(W\)$/)).toBeInTheDocument()
    expect(screen.getByText(/^CSS \(s\/100m\)$/)).toBeInTheDocument()

    // VDOT section has 2 rows (45 → 48 trend) — no single-test hint
    // FTP + CSS each have 1 row → 2 single-test hints
    expect(screen.getAllByText(/Single test/i).length).toBe(2)
  })
})

describe('FieldTestHistoryCard — optional fields', () => {
  it('shows RPE when present, "—" when absent', () => {
    seed([
      { date: '2026-05-17', sport: 'run', field: 'vdot', value: 47, rpe: 8 },
      { date: '2026-03-10', sport: 'run', field: 'vdot', value: 45 },
    ])
    withLang('en', <FieldTestHistoryCard />)
    const rpeCells = Array.from(document.querySelectorAll('tbody tr')).map(r => r.children[3].textContent)
    expect(rpeCells[0]).toBe('8')
    expect(rpeCells[1]).toBe('—')
  })

  it('shows notes when present, "—" when absent', () => {
    seed([
      { date: '2026-05-17', sport: 'run', field: 'vdot', value: 47, notes: 'humid track' },
    ])
    withLang('en', <FieldTestHistoryCard />)
    expect(screen.getByText('humid track')).toBeInTheDocument()
  })
})

describe('FieldTestHistoryCard — bilingual', () => {
  it('English UI', () => {
    seed([{ date: '2026-05-17', sport: 'run', field: 'vdot', value: 47 }])
    withLang('en', <FieldTestHistoryCard />)
    expect(screen.getByText('FIELD TEST HISTORY')).toBeInTheDocument()
    expect(screen.getByText('DATE')).toBeInTheDocument()
    expect(screen.getByText('NOTES')).toBeInTheDocument()
  })

  it('Turkish UI', () => {
    seed([{ date: '2026-05-17', sport: 'run', field: 'vdot', value: 47 }])
    withLang('tr', <FieldTestHistoryCard />)
    expect(screen.getByText('SAHA TESTİ GEÇMİŞİ')).toBeInTheDocument()
    expect(screen.getByText('TARİH')).toBeInTheDocument()
    expect(screen.getByText('NOT')).toBeInTheDocument()
  })
})
