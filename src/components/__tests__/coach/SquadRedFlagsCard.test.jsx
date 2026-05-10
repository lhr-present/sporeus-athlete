// @vitest-environment jsdom
// ─── SquadRedFlagsCard.test.jsx — coach triage card (v9.48.0) ────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../../contexts/LangCtx.jsx'
import SquadRedFlagsCard, { deriveFlags, daysSince } from '../../coach/SquadRedFlagsCard.jsx'

beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-10T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(athletes, lang = 'en') {
  return render(
    <LangCtx.Provider value={{ t: k => k, lang, setLang: () => {} }}>
      <SquadRedFlagsCard athletes={athletes} />
    </LangCtx.Provider>
  )
}

describe('deriveFlags', () => {
  it('flags ACWR > 1.5 as INJURY-RISK (Gabbett 2016)', () => {
    const flags = deriveFlags({ acwr_ratio: 1.7, today_tsb: 0, last_session_date: '2026-05-09' }, false)
    expect(flags.find(f => f.kind === 'injury-risk')).toBeDefined()
  })

  it('does NOT flag ACWR ≤ 1.5 (sweet spot)', () => {
    const flags = deriveFlags({ acwr_ratio: 1.4, today_tsb: 0, last_session_date: '2026-05-09' }, false)
    expect(flags.find(f => f.kind === 'injury-risk')).toBeUndefined()
  })

  it('flags TSB < -20 as DEEPLY-FATIGUED', () => {
    const flags = deriveFlags({ acwr_ratio: 1.0, today_tsb: -25, last_session_date: '2026-05-09' }, false)
    expect(flags.find(f => f.kind === 'fatigued')).toBeDefined()
  })

  it('does NOT flag TSB ≥ -20', () => {
    const flags = deriveFlags({ acwr_ratio: 1.0, today_tsb: -15, last_session_date: '2026-05-09' }, false)
    expect(flags.find(f => f.kind === 'fatigued')).toBeUndefined()
  })

  it('flags last_session_date 5+ days ago as SILENT', () => {
    const flags = deriveFlags({ acwr_ratio: 1.0, today_tsb: 0, last_session_date: '2026-05-04' }, false)
    expect(flags.find(f => f.kind === 'silent')).toBeDefined()
  })

  it('flags missing last_session_date as NEVER-LOGGED', () => {
    const flags = deriveFlags({ acwr_ratio: 1.0, today_tsb: 0, last_session_date: null }, false)
    expect(flags.find(f => f.kind === 'never-logged')).toBeDefined()
  })

  it('returns empty array for fully healthy athlete', () => {
    const flags = deriveFlags({ acwr_ratio: 1.1, today_tsb: -5, last_session_date: '2026-05-09' }, false)
    expect(flags.length).toBe(0)
  })

  it('returns multiple flags when multiple thresholds breach', () => {
    const flags = deriveFlags({ acwr_ratio: 1.8, today_tsb: -25, last_session_date: '2026-05-04' }, false)
    expect(flags.length).toBeGreaterThanOrEqual(3)
  })

  it('TR labels differ from EN labels', () => {
    const en = deriveFlags({ acwr_ratio: 1.7, today_tsb: 0, last_session_date: '2026-05-09' }, false)
    const tr = deriveFlags({ acwr_ratio: 1.7, today_tsb: 0, last_session_date: '2026-05-09' }, true)
    expect(en[0].label).toBe('INJURY-RISK')
    expect(tr[0].label).toBe('YARALANMA RİSKİ')
  })
})

describe('daysSince', () => {
  it('returns Infinity for null or invalid', () => {
    expect(daysSince(null)).toBe(Infinity)
    expect(daysSince('not-a-date')).toBe(Infinity)
  })

  it('returns 0 for today', () => {
    expect(daysSince('2026-05-10')).toBe(0)
  })

  it('returns positive number of days for past dates', () => {
    expect(daysSince('2026-05-05')).toBe(5)
  })
})

describe('SquadRedFlagsCard render', () => {
  it('renders nothing when athletes array is empty', () => {
    const { container } = renderCard([])
    expect(container.querySelector('[data-squad-red-flags]')).toBeNull()
  })

  it('renders "all clear" when no athletes are flagged', () => {
    renderCard([
      { athlete_id: '1', athlete_name: 'Alice', acwr_ratio: 1.1, today_tsb: -5, last_session_date: '2026-05-09' },
    ])
    expect(screen.getByText(/all clear/i)).toBeInTheDocument()
  })

  it('renders flagged athlete with INJURY-RISK badge when ACWR > 1.5', () => {
    renderCard([
      { athlete_id: '2', athlete_name: 'Bob', acwr_ratio: 1.7, today_tsb: 0, last_session_date: '2026-05-09' },
    ])
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('INJURY-RISK')).toBeInTheDocument()
  })

  it('sorts high-severity athletes before moderate', () => {
    renderCard([
      // Carol has only SILENT (moderate)
      { athlete_id: '3', athlete_name: 'Carol', acwr_ratio: 1.0, today_tsb: 0, last_session_date: '2026-05-04' },
      // Bob has INJURY-RISK (high)
      { athlete_id: '2', athlete_name: 'Bob', acwr_ratio: 1.7, today_tsb: 0, last_session_date: '2026-05-09' },
    ])
    const buttons = screen.getAllByRole('button')
    const athleteButtons = buttons.filter(b => /Bob|Carol/.test(b.textContent))
    expect(athleteButtons[0].textContent).toContain('Bob')
    expect(athleteButtons[1].textContent).toContain('Carol')
  })

  it('TR mode renders Turkish title', () => {
    renderCard(
      [{ athlete_id: '1', athlete_name: 'Alice', acwr_ratio: 1.0, today_tsb: 0, last_session_date: '2026-05-09' }],
      'tr'
    )
    expect(screen.getByText(/BUGÜNÜN UYARI BAYRAKLARI/)).toBeInTheDocument()
  })
})
