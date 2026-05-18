// @vitest-environment jsdom
// ─── PreRaceSleepBankingCard.test.jsx — render tests for the banking card ────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import PreRaceSleepBankingCard from '../dashboard/PreRaceSleepBankingCard.jsx'

// Anchor "today" to 2026-05-17. Race 3 days out → inside 7-day window.
const TODAY = '2026-05-17'
const RACE_DATE = '2026-05-20'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

// Helper: build a 7-day recovery array ending at TODAY with the given hours.
function buildRecovery(hoursList, endISO = TODAY) {
  const end = new Date(endISO + 'T00:00:00Z')
  const out = []
  const n = hoursList.length
  for (let i = 0; i < n; i++) {
    const d = new Date(end.getTime())
    d.setUTCDate(d.getUTCDate() - (n - 1 - i))
    out.push({
      date: d.toISOString().slice(0, 10),
      sleepHrs: hoursList[i],
    })
  }
  return out
}

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <PreRaceSleepBankingCard {...props} />
    </LangCtx.Provider>,
  )
}

describe('PreRaceSleepBankingCard — null render', () => {
  it('renders nothing when profile has no race date', () => {
    const recovery = buildRecovery([9, 9, 9, 9, 9, 9, 9])
    const { container } = renderCard({ recovery, profile: {} })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-pre-race-sleep-banking-card]')).toBeNull()
  })
})

describe('PreRaceSleepBankingCard — status rendering', () => {
  it('renders BANKED status (green) with banked count + chip strip', () => {
    // 5 of 7 nights at 9h (banked), 2 at 7h → status BANKED
    const recovery = buildRecovery([7, 7, 9, 9, 9, 9, 9])
    renderCard({ recovery, profile: { raceDate: RACE_DATE } })
    const card = document.querySelector('[data-pre-race-sleep-banking-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-banking-status')).toBe('BANKED')
    expect(card.getAttribute('data-days-to-race')).toBe('3')
    // Chip strip rendered with one chip per night
    const chips = document.querySelectorAll('[data-banking-chip]')
    expect(chips.length).toBe(7)
    // BANKED status label is visible
    expect(screen.getByText(/BANKED/)).toBeInTheDocument()
  })

  it('renders NEEDS_FOCUS (orange) with recommendation copy', () => {
    // All nights at 7h → 0 banked → NEEDS_FOCUS
    const recovery = buildRecovery([7, 7, 7, 7, 7, 7, 7])
    renderCard({ recovery, profile: { raceDate: RACE_DATE } })
    const card = document.querySelector('[data-pre-race-sleep-banking-card]')
    expect(card.getAttribute('data-banking-status')).toBe('NEEDS_FOCUS')
    expect(screen.getByText(/NEEDS FOCUS/)).toBeInTheDocument()
    // Recommendation block appears
    const rec = document.querySelector('[data-banking-recommendation]')
    expect(rec).not.toBeNull()
    expect(rec.textContent).toMatch(/8\.5\+ h tonight/i)
  })

  it('data-banking-status reflects the underlying status (PARTIAL)', () => {
    // 3 of 7 nights at 9h → status PARTIAL
    const recovery = buildRecovery([7, 8, 8, 8, 9, 9, 9])
    renderCard({ recovery, profile: { raceDate: RACE_DATE } })
    const card = document.querySelector('[data-pre-race-sleep-banking-card]')
    expect(card.getAttribute('data-banking-status')).toBe('PARTIAL')
    // BANKED chip count must equal 3
    const bankedChips = document.querySelectorAll('[data-banking-chip][data-chip-banked="true"]')
    expect(bankedChips.length).toBe(3)
  })

  it('exposes role=region with bilingual aria-label', () => {
    const recovery = buildRecovery([9, 9, 9, 9, 9, 9, 9])
    renderCard({ recovery, profile: { raceDate: RACE_DATE } })
    const region = screen.getByRole('region', { name: /Pre-race sleep banking protocol/i })
    expect(region).toBeInTheDocument()
  })
})

describe('PreRaceSleepBankingCard — bilingual', () => {
  it('renders Turkish "UYKU BİRİKİMİ" title and status when lang=tr', () => {
    const recovery = buildRecovery([9, 9, 9, 9, 9, 9, 9])
    renderCard({ recovery, profile: { raceDate: RACE_DATE } }, 'tr')
    expect(screen.getByText(/UYKU BİRİKİMİ · T-3 GÜN/)).toBeInTheDocument()
    expect(screen.getByText(/BİRİKTİ/)).toBeInTheDocument()
    // Turkish aria-label
    const region = screen.getByRole('region', { name: /Yarış öncesi uyku biriktirme protokolü/i })
    expect(region).toBeInTheDocument()
  })
})
