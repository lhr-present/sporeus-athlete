// @vitest-environment jsdom
// ─── HrForRpeCard.test.jsx — card render tests ──────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import HrForRpeCard from '../dashboard/HrForRpeCard.jsx'

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
      <HrForRpeCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function sess(daysAgo, rpe, heartRate) {
  return {
    date: isoMinusDays(TODAY, daysAgo),
    rpe,
    heartRate,
  }
}

// ─── Null gating ────────────────────────────────────────────────────────────
describe('HrForRpeCard — null gating', () => {
  it('renders nothing when log is empty', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when only one band is populated', () => {
    const log = [
      sess(1, 3, 130),
      sess(3, 3, 130),
      sess(5, 3, 130),
      sess(7, 4, 138),
      sess(9, 4, 138),
      sess(11, 4, 138),
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 6 overall samples', () => {
    const log = [
      sess(1, 3, 130),
      sess(3, 7, 162),
      sess(5, 3, 130),
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when heart-rate=0 entries do not satisfy minimum sample count', () => {
    const log = [
      sess(1, 3, 130),
      sess(3, 7, 162),
      sess(5, 3, 0),     // ignored
      sess(7, 7, 0),     // ignored
      sess(9, 4, 138),
      sess(11, 8, 168),
      // 4 valid samples → < 6 → null
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── Full render — English ──────────────────────────────────────────────────
describe('HrForRpeCard — render with 4 bands (EN)', () => {
  it('renders title, sample count, all 4 band rows, citation', () => {
    const log = [
      // EASY (RPE 3) at 130 bpm
      sess(1, 3, 130),
      sess(3, 3, 130),
      // MODERATE (RPE 6) at 150 bpm
      sess(5, 6, 150),
      sess(7, 6, 150),
      // HARD (RPE 7) at 162 bpm
      sess(9, 7, 162),
      sess(11, 7, 162),
      // VERY_HARD (RPE 10) at 185 bpm
      sess(13, 10, 185),
      sess(15, 10, 185),
    ]
    renderCard({ log })

    const card = screen.getByRole('region', { name: /HR × RPE/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-hr-for-rpe-card')).not.toBeNull()
    expect(card.getAttribute('data-overall-sample-count')).toBe('8')

    expect(card.textContent).toMatch(/HR × RPE · 90D/)
    expect(card.textContent).toMatch(/8 sessions/)
    expect(card.textContent).toMatch(/Karvonen 1957; Borg 1982/)

    // All 4 band labels present (EN) — assert via row data-band-name attrs.
    const enRows = card.querySelectorAll('[data-hr-rpe-row]')
    const enNames = Array.from(enRows).map((r) => r.getAttribute('data-band-name'))
    expect(enNames).toEqual(['EASY', 'MODERATE', 'HARD', 'VERY_HARD'])
    expect(card.textContent).toMatch(/EASY/)
    expect(card.textContent).toMatch(/MODERATE/)
    expect(card.textContent).toMatch(/VERY HARD/)
    // HARD without false-match on "VERY HARD" — check the HARD row chip text directly
    const hardRow = card.querySelector('[data-band-name="HARD"]')
    expect(hardRow.textContent).toMatch(/HARD/)

    // RPE range chips
    expect(card.textContent).toMatch(/RPE 1-4/)
    expect(card.textContent).toMatch(/RPE 5-6/)
    expect(card.textContent).toMatch(/RPE 7-8/)
    expect(card.textContent).toMatch(/RPE 9-10/)

    // HR strings with bpm suffix
    expect(card.textContent).toMatch(/130 bpm/)
    expect(card.textContent).toMatch(/150 bpm/)
    expect(card.textContent).toMatch(/162 bpm/)
    expect(card.textContent).toMatch(/185 bpm/)

    // Interpretation hint
    expect(
      screen.getByText(/Your typical heart rate at each effort level\. Pair with PaceByRpe for a complete intensity-anchor picture\./i)
    ).toBeInTheDocument()
  })
})

// ─── Turkish ────────────────────────────────────────────────────────────────
describe('HrForRpeCard — Turkish', () => {
  it('renders Turkish title, TR band labels, TR hint', () => {
    const log = [
      sess(1, 3, 130),
      sess(3, 3, 130),
      sess(5, 6, 150),
      sess(7, 6, 150),
      sess(9, 7, 162),
      sess(11, 7, 162),
      sess(13, 10, 185),
      sess(15, 10, 185),
    ]
    renderCard({ log }, 'tr')

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-hr-for-rpe-card')).not.toBeNull()
    expect(card.textContent).toMatch(/KAH × RPE · 90G/)
    expect(card.textContent).toMatch(/8 seans/)

    // TR band labels
    expect(card.textContent).toMatch(/KOLAY/)
    expect(card.textContent).toMatch(/ORTA/)
    expect(card.textContent).toMatch(/ÇOK SERT/)
    // SERT row — verify via the HARD-band row directly
    const sertRow = card.querySelector('[data-band-name="HARD"]')
    expect(sertRow.textContent).toMatch(/SERT/)
    expect(sertRow.textContent).not.toMatch(/ÇOK SERT/)

    // TR hint
    expect(
      screen.getByText(/Her efor seviyesindeki tipik kalp atış hızın\. Tam yoğunluk-çapası tablosu için PaceByRpe ile birlikte değerlendir\./i)
    ).toBeInTheDocument()
  })
})

// ─── Zero-sample band display ───────────────────────────────────────────────
describe('HrForRpeCard — zero-sample band display', () => {
  it('renders -- HR and 0 count for unpopulated bands', () => {
    // Populate only EASY + HARD
    const log = [
      sess(1, 3, 130),
      sess(3, 3, 130),
      sess(5, 3, 130),
      sess(7, 7, 162),
      sess(9, 7, 162),
      sess(11, 7, 162),
    ]
    renderCard({ log })

    const card = screen.getByRole('region')

    // 4 rows total (even though only 2 bands have data)
    const rows = card.querySelectorAll('[data-hr-rpe-row]')
    expect(rows.length).toBe(4)

    const byBand = {}
    rows.forEach((r) => { byBand[r.getAttribute('data-band-name')] = r })

    expect(byBand.EASY.getAttribute('data-band-count')).toBe('3')
    expect(byBand.HARD.getAttribute('data-band-count')).toBe('3')

    // Unpopulated bands → count 0 + median '--'
    expect(byBand.MODERATE.getAttribute('data-band-count')).toBe('0')
    expect(byBand.MODERATE.getAttribute('data-band-median-hr')).toBe('0')
    expect(byBand.MODERATE.textContent).toMatch(/0×/)
    expect(byBand.MODERATE.textContent).toMatch(/--/)

    expect(byBand.VERY_HARD.getAttribute('data-band-count')).toBe('0')
    expect(byBand.VERY_HARD.getAttribute('data-band-median-hr')).toBe('0')
    expect(byBand.VERY_HARD.textContent).toMatch(/0×/)
    expect(byBand.VERY_HARD.textContent).toMatch(/--/)
  })
})

// ─── Per-row data anchors ───────────────────────────────────────────────────
describe('HrForRpeCard — row anchors', () => {
  it('emits data-hr-rpe-row with band-name/band-count/band-median-hr per band', () => {
    // EASY 3 sessions at 130 bpm, HARD 3 sessions at 162 bpm
    const log = [
      sess(1, 3, 130),
      sess(3, 3, 130),
      sess(5, 3, 130),
      sess(7, 7, 162),
      sess(9, 7, 162),
      sess(11, 7, 162),
    ]
    renderCard({ log })

    const card = screen.getByRole('region')
    const rows = card.querySelectorAll('[data-hr-rpe-row]')
    expect(rows.length).toBe(4)

    const byBand = {}
    rows.forEach((r) => { byBand[r.getAttribute('data-band-name')] = r })

    expect(byBand.EASY).toBeTruthy()
    expect(byBand.EASY.getAttribute('data-band-count')).toBe('3')
    expect(parseFloat(byBand.EASY.getAttribute('data-band-median-hr'))).toBeCloseTo(130, 4)

    expect(byBand.HARD).toBeTruthy()
    expect(byBand.HARD.getAttribute('data-band-count')).toBe('3')
    expect(parseFloat(byBand.HARD.getAttribute('data-band-median-hr'))).toBeCloseTo(162, 4)

    expect(byBand.MODERATE).toBeTruthy()
    expect(byBand.VERY_HARD).toBeTruthy()
  })

  it('rows appear in canonical order EASY → MODERATE → HARD → VERY_HARD', () => {
    const log = [
      sess(1, 3, 130),
      sess(3, 3, 130),
      sess(5, 10, 185),  // VERY_HARD first by logged date
      sess(7, 6, 150),
      sess(9, 7, 162),
      sess(11, 7, 162),
    ]
    renderCard({ log })
    const card = screen.getByRole('region')
    const rows = Array.from(card.querySelectorAll('[data-hr-rpe-row]'))
    const order = rows.map((r) => r.getAttribute('data-band-name'))
    expect(order).toEqual(['EASY', 'MODERATE', 'HARD', 'VERY_HARD'])
  })
})
