// @vitest-environment jsdom
// ─── TwoADaysCard.test.jsx — card render tests ─────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TwoADaysCard from '../dashboard/TwoADaysCard.jsx'

const TODAY = '2026-05-18'

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
      <TwoADaysCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function buildDoubleDays(n, startOffset = 1) {
  const log = []
  for (let i = 0; i < n; i++) {
    const d = isoMinusDays(TODAY, startOffset + i * 2)
    log.push({ date: d, type: 'run',  durationMin: 30, tss: 40 })
    log.push({ date: d, type: 'bike', durationMin: 30, tss: 60 })
  }
  return log
}

// ─── Render NONE state ──────────────────────────────────────────────────────
describe('TwoADaysCard — NONE state', () => {
  it('renders the card even when log is empty (populated NONE)', () => {
    renderCard({ log: [] })
    const card = screen.getByRole('region', { name: /Two-a-day sessions/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-card')).toBe('two-a-days')
    expect(card.getAttribute('data-band')).toBe('NONE')
    expect(card.getAttribute('data-total-double-days')).toBe('0')
  })

  it('shows the NONE hint and zero stat', () => {
    renderCard({ log: [] })
    expect(screen.getByText(/No double-session days/i)).toBeInTheDocument()
    const stat = document.querySelector('[data-large-stat]')
    expect(stat).not.toBeNull()
    expect(stat.textContent).toBe('0')
  })

  it('omits the cross-sport badge in NONE state', () => {
    renderCard({ log: [] })
    expect(document.querySelector('[data-cross-sport-badge]')).toBeNull()
  })

  it('omits the recent-doubles list in NONE state', () => {
    renderCard({ log: [] })
    expect(document.querySelector('[data-recent-doubles]')).toBeNull()
  })
})

// ─── Render OCCASIONAL ──────────────────────────────────────────────────────
describe('TwoADaysCard — OCCASIONAL state', () => {
  it('renders OCCASIONAL band + 3 double days', () => {
    renderCard({ log: buildDoubleDays(3) })
    const card = screen.getByRole('region', { name: /Two-a-day sessions/i })
    expect(card.getAttribute('data-band')).toBe('OCCASIONAL')
    expect(card.getAttribute('data-total-double-days')).toBe('3')
    expect(screen.getByText(/handful of doubles/i)).toBeInTheDocument()
  })

  it('shows cross-sport badge when crossSportDoubleDays > 0', () => {
    renderCard({ log: buildDoubleDays(3) })
    const badge = document.querySelector('[data-cross-sport-badge]')
    expect(badge).not.toBeNull()
    expect(badge.textContent).toMatch(/3/)
    expect(badge.textContent).toMatch(/cross-sport/)
  })

  it('renders mean TSS per double day with 2 decimals', () => {
    renderCard({ log: buildDoubleDays(3) })
    // Each double-day = 100 TSS → mean = 100.00.
    expect(screen.getByText(/100\.00/)).toBeInTheDocument()
  })
})

// ─── Render ROUTINE ─────────────────────────────────────────────────────────
describe('TwoADaysCard — ROUTINE state', () => {
  it('renders ROUTINE band + 10 double days', () => {
    renderCard({ log: buildDoubleDays(10) })
    const card = screen.getByRole('region', { name: /Two-a-day sessions/i })
    expect(card.getAttribute('data-band')).toBe('ROUTINE')
    expect(card.getAttribute('data-total-double-days')).toBe('10')
    expect(screen.getByText(/block-style accumulation/i)).toBeInTheDocument()
  })
})

// ─── Render EXCESSIVE ───────────────────────────────────────────────────────
describe('TwoADaysCard — EXCESSIVE state', () => {
  it('renders EXCESSIVE band + 20 double days', () => {
    renderCard({ log: buildDoubleDays(20) })
    const card = screen.getByRole('region', { name: /Two-a-day sessions/i })
    expect(card.getAttribute('data-band')).toBe('EXCESSIVE')
    expect(card.getAttribute('data-total-double-days')).toBe('20')
    expect(screen.getByText(/overreaching territory/i)).toBeInTheDocument()
  })
})

// ─── Recent doubles list rendering ──────────────────────────────────────────
describe('TwoADaysCard — recent doubles list', () => {
  it('renders up to 5 most recent double days, newest first', () => {
    renderCard({ log: buildDoubleDays(8) })
    const rows = document.querySelectorAll('[data-double-day-row]')
    expect(rows.length).toBe(5)
    // First row should be the most-recent double (smallest day-offset).
    const firstDate = rows[0].getAttribute('data-date')
    const lastDate  = rows[4].getAttribute('data-date')
    expect(firstDate > lastDate).toBe(true)
  })

  it('renders session count and sports inline per row', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'run',  durationMin: 30, tss: 80 },
      { date: isoMinusDays(TODAY, 1), type: 'bike', durationMin: 30, tss: 100 },
      { date: isoMinusDays(TODAY, 1), type: 'swim', durationMin: 30, tss: 0 },
    ]
    renderCard({ log })
    const row = document.querySelector('[data-double-day-row]')
    expect(row).not.toBeNull()
    expect(row.getAttribute('data-session-count')).toBe('3')
    expect(row.getAttribute('data-cross-sport')).toBe('1')
    // Date label "May 17" present + sessions+sports+TSS.
    expect(row.textContent).toMatch(/3 sessions/)
    expect(row.textContent).toMatch(/run\+bike\+swim/)
    expect(row.textContent).toMatch(/180 TSS/)
  })
})

// ─── Bilingual ──────────────────────────────────────────────────────────────
describe('TwoADaysCard — bilingual', () => {
  it('renders English title + band label + hint when lang=en', () => {
    renderCard({ log: buildDoubleDays(3) }, 'en')
    expect(screen.getByText(/TWO-A-DAY SESSIONS · 60D/)).toBeInTheDocument()
    expect(screen.getByText(/^OCCASIONAL$/)).toBeInTheDocument()
    expect(screen.getByText(/Mean TSS \/ double day/i)).toBeInTheDocument()
    expect(screen.getByText(/RECENT DOUBLE DAYS/)).toBeInTheDocument()
  })

  it('renders Turkish title + band label + hint when lang=tr', () => {
    renderCard({ log: buildDoubleDays(3) }, 'tr')
    expect(screen.getByText(/ÇİFT ANTRENMANLI GÜNLER · 60G/)).toBeInTheDocument()
    expect(screen.getByText(/^ARA SIRA$/)).toBeInTheDocument()
    expect(screen.getByText(/Birkaç çift seanslı gün/i)).toBeInTheDocument()
    expect(screen.getByText(/SON ÇİFT GÜNLER/)).toBeInTheDocument()
    expect(screen.getByText(/sporlar-arası/i)).toBeInTheDocument()
  })

  it('sets a Turkish aria-label when lang=tr', () => {
    renderCard({ log: [] }, 'tr')
    expect(
      screen.getByRole('region', { name: /Çift antrenmanlı günler/i })
    ).toBeInTheDocument()
  })
})

// ─── Citation footer ────────────────────────────────────────────────────────
describe('TwoADaysCard — citation footer', () => {
  it('renders the Cejuela / Issurin / Skorski citation', () => {
    renderCard({ log: buildDoubleDays(3) })
    const cite = document.querySelector('[data-citation]')
    expect(cite).not.toBeNull()
    expect(cite.textContent).toMatch(/Cejuela 2013/)
    expect(cite.textContent).toMatch(/Issurin 2010/)
    expect(cite.textContent).toMatch(/Skorski 2019/)
  })
})

// ─── Accessibility ──────────────────────────────────────────────────────────
describe('TwoADaysCard — accessibility', () => {
  it('exposes role="region" with bilingual aria-label and data-card hook', () => {
    renderCard({ log: buildDoubleDays(2) })
    const card = screen.getByRole('region', { name: /Two-a-day sessions/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('aria-label')).toMatch(/OCCASIONAL/i)
    expect(card.getAttribute('data-card')).toBe('two-a-days')
  })
})

// ─── Cross-sport badge gating ───────────────────────────────────────────────
describe('TwoADaysCard — cross-sport badge gating', () => {
  it('omits the cross-sport badge when all doubles are same-sport', () => {
    const log = [
      // single same-sport double day
      { date: isoMinusDays(TODAY, 1), type: 'run', durationMin: 30, tss: 40 },
      { date: isoMinusDays(TODAY, 1), type: 'run', durationMin: 30, tss: 40 },
    ]
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Two-a-day sessions/i })
    expect(card.getAttribute('data-band')).toBe('OCCASIONAL')
    expect(card.getAttribute('data-cross-sport-double-days')).toBe('0')
    expect(document.querySelector('[data-cross-sport-badge]')).toBeNull()
  })
})
