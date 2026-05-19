// @vitest-environment jsdom
// ─── PaceByRpeCard.test.jsx — card render tests ─────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import PaceByRpeCard from '../dashboard/PaceByRpeCard.jsx'

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
      <PaceByRpeCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function run(daysAgo, rpe, distanceKm, durationMin) {
  return {
    date: isoMinusDays(TODAY, daysAgo),
    type: 'run',
    rpe,
    distanceKm,
    durationMin,
  }
}

// ─── Null gating ────────────────────────────────────────────────────────────
describe('PaceByRpeCard — null gating', () => {
  it('renders nothing when log is empty', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when only one band is populated', () => {
    const log = [
      run(1, 3, 10, 60),
      run(3, 3, 10, 60),
      run(5, 3, 10, 60),
      run(7, 4, 8, 48),
      run(9, 4, 8, 48),
      run(11, 4, 8, 48),
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 6 overall samples', () => {
    const log = [
      run(1, 3, 10, 60),
      run(3, 7, 10, 50),
      run(5, 3, 10, 60),
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── Full render — English ──────────────────────────────────────────────────
describe('PaceByRpeCard — render with 4 bands (EN)', () => {
  it('renders title, sample count, all 4 band rows, citation', () => {
    const log = [
      // EASY (RPE 3) at 6:00/km (60 min / 10 km)
      run(1, 3, 10, 60),
      run(3, 3, 10, 60),
      // MODERATE (RPE 6) at 5:30/km
      run(5, 6, 10, 55),
      run(7, 6, 10, 55),
      // HARD (RPE 7) at 5:00/km
      run(9, 7, 10, 50),
      run(11, 7, 10, 50),
      // VERY_HARD (RPE 10) at 4:00/km (sprint)
      run(13, 10, 5, 20),
      run(15, 10, 5, 20),
    ]
    renderCard({ log })

    const card = screen.getByRole('region', { name: /Pace × RPE/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-pace-by-rpe-card')).not.toBeNull()
    expect(card.getAttribute('data-overall-sample-count')).toBe('8')

    expect(card.textContent).toMatch(/PACE × RPE · 90D/)
    expect(card.textContent).toMatch(/8 runs/)
    expect(card.textContent).toMatch(/Daniels 2014; Borg 1982/)

    // All 4 band labels present (EN) — assert via row data-band-name attrs (textContent
    // concatenates "EASYRPE 1-4..." which defeats simple word-boundary regex matching).
    const enRows = card.querySelectorAll('[data-pace-rpe-row]')
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

    // Pace strings
    expect(card.textContent).toMatch(/6:00\/km/)
    expect(card.textContent).toMatch(/5:30\/km/)
    expect(card.textContent).toMatch(/5:00\/km/)
    expect(card.textContent).toMatch(/4:00\/km/)

    // Interpretation hint
    expect(
      screen.getByText(/Your typical pace at each effort level\. If Easy paces are faster than expected vs Tempo, you may be running easy days too hard\./i)
    ).toBeInTheDocument()
  })
})

// ─── Turkish ────────────────────────────────────────────────────────────────
describe('PaceByRpeCard — Turkish', () => {
  it('renders Turkish title, TR band labels, TR hint', () => {
    const log = [
      run(1, 3, 10, 60),
      run(3, 3, 10, 60),
      run(5, 6, 10, 55),
      run(7, 6, 10, 55),
      run(9, 7, 10, 50),
      run(11, 7, 10, 50),
      run(13, 10, 5, 20),
      run(15, 10, 5, 20),
    ]
    renderCard({ log }, 'tr')

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-pace-by-rpe-card')).not.toBeNull()
    expect(card.textContent).toMatch(/TEMPO × RPE · 90G/)
    expect(card.textContent).toMatch(/8 koşu/)

    // TR band labels
    expect(card.textContent).toMatch(/KOLAY/)
    expect(card.textContent).toMatch(/ORTA/)
    expect(card.textContent).toMatch(/ÇOK SERT/)
    // SERT row — verify via the HARD-band row directly (textContent concatenation
    // foils `\b` word boundaries against punctuation-less rendering).
    const sertRow = card.querySelector('[data-band-name="HARD"]')
    expect(sertRow.textContent).toMatch(/SERT/)
    expect(sertRow.textContent).not.toMatch(/ÇOK SERT/)

    // TR hint
    expect(
      screen.getByText(/Her efor seviyesindeki tipik temponu gösterir\. Kolay tempolar Tempo'ya göre beklenenden hızlıysa, kolay günleri çok sert koşuyor olabilirsin\./i)
    ).toBeInTheDocument()
  })
})

// ─── Zero-sample band display ───────────────────────────────────────────────
describe('PaceByRpeCard — zero-sample band display', () => {
  it('renders -- pace and 0 count for unpopulated bands', () => {
    // Populate only EASY + HARD
    const log = [
      run(1, 3, 10, 60),
      run(3, 3, 10, 60),
      run(5, 3, 10, 60),
      run(7, 7, 10, 50),
      run(9, 7, 10, 50),
      run(11, 7, 10, 50),
    ]
    renderCard({ log })

    const card = screen.getByRole('region')

    // 4 rows total (even though only 2 bands have data)
    const rows = card.querySelectorAll('[data-pace-rpe-row]')
    expect(rows.length).toBe(4)

    const byBand = {}
    rows.forEach((r) => { byBand[r.getAttribute('data-band-name')] = r })

    expect(byBand.EASY.getAttribute('data-band-count')).toBe('3')
    expect(byBand.HARD.getAttribute('data-band-count')).toBe('3')

    // Unpopulated bands → count 0 + median '--'
    expect(byBand.MODERATE.getAttribute('data-band-count')).toBe('0')
    expect(byBand.MODERATE.getAttribute('data-band-median-pace')).toBe('0')
    expect(byBand.MODERATE.textContent).toMatch(/0×/)
    expect(byBand.MODERATE.textContent).toMatch(/--/)

    expect(byBand.VERY_HARD.getAttribute('data-band-count')).toBe('0')
    expect(byBand.VERY_HARD.getAttribute('data-band-median-pace')).toBe('0')
    expect(byBand.VERY_HARD.textContent).toMatch(/0×/)
    expect(byBand.VERY_HARD.textContent).toMatch(/--/)
  })
})

// ─── Per-row data anchors ───────────────────────────────────────────────────
describe('PaceByRpeCard — row anchors', () => {
  it('emits data-pace-rpe-row with band-name/band-count/band-median-pace per band', () => {
    // EASY 3 runs at 6:00/km, HARD 3 runs at 5:00/km
    const log = [
      run(1, 3, 10, 60),
      run(3, 3, 10, 60),
      run(5, 3, 10, 60),
      run(7, 7, 10, 50),
      run(9, 7, 10, 50),
      run(11, 7, 10, 50),
    ]
    renderCard({ log })

    const card = screen.getByRole('region')
    const rows = card.querySelectorAll('[data-pace-rpe-row]')
    expect(rows.length).toBe(4)

    const byBand = {}
    rows.forEach((r) => { byBand[r.getAttribute('data-band-name')] = r })

    expect(byBand.EASY).toBeTruthy()
    expect(byBand.EASY.getAttribute('data-band-count')).toBe('3')
    expect(parseFloat(byBand.EASY.getAttribute('data-band-median-pace'))).toBeCloseTo(6.0, 4)

    expect(byBand.HARD).toBeTruthy()
    expect(byBand.HARD.getAttribute('data-band-count')).toBe('3')
    expect(parseFloat(byBand.HARD.getAttribute('data-band-median-pace'))).toBeCloseTo(5.0, 4)

    expect(byBand.MODERATE).toBeTruthy()
    expect(byBand.VERY_HARD).toBeTruthy()
  })

  it('rows appear in canonical order EASY → MODERATE → HARD → VERY_HARD', () => {
    const log = [
      run(1, 3, 10, 60),
      run(3, 3, 10, 60),
      run(5, 10, 5, 20),  // VERY_HARD first by logged date
      run(7, 6, 10, 55),
      run(9, 7, 10, 50),
      run(11, 7, 10, 50),
    ]
    renderCard({ log })
    const card = screen.getByRole('region')
    const rows = Array.from(card.querySelectorAll('[data-pace-rpe-row]'))
    const order = rows.map((r) => r.getAttribute('data-band-name'))
    expect(order).toEqual(['EASY', 'MODERATE', 'HARD', 'VERY_HARD'])
  })
})
