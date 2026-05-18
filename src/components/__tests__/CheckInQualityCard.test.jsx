// @vitest-environment jsdom
// ─── CheckInQualityCard.test.jsx — card render tests ────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CheckInQualityCard from '../dashboard/CheckInQualityCard.jsx'

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
      <CheckInQualityCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function fullSession(daysAgo, overrides = {}) {
  return {
    date: isoMinusDays(TODAY, daysAgo),
    rpe: 6,
    tss: 80,
    durationMin: 60,
    heartRate: 140,
    ...overrides,
  }
}

// ─── Null gating ────────────────────────────────────────────────────────────
describe('CheckInQualityCard — null gating', () => {
  it('renders nothing when log is empty', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when fewer than 3 sessions in window', () => {
    const log = [fullSession(1), fullSession(3)]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── COMPLETE band ──────────────────────────────────────────────────────────
describe('CheckInQualityCard — COMPLETE band', () => {
  it('renders COMPLETE label, 100% score, and strong-hygiene hint', () => {
    const log = [fullSession(1), fullSession(3), fullSession(5), fullSession(7)]
    renderCard({ log })

    const card = screen.getByRole('region', { name: /Check-in quality/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-check-in-quality-card')).not.toBeNull()
    expect(card.getAttribute('data-quality-band')).toBe('COMPLETE')
    expect(card.getAttribute('data-session-count')).toBe('4')
    // Empty weakestField anchor when all fields are 100% filled
    expect(card.getAttribute('data-weakest-field')).toBe('')

    expect(card.textContent).toMatch(/CHECK-IN QUALITY · 14D/)
    expect(card.textContent).toMatch(/COMPLETE/)
    expect(card.textContent).toMatch(/100%/)

    // Strong data hygiene hint
    expect(
      screen.getByText(/Strong data hygiene — your trend insights are well-grounded\./i)
    ).toBeInTheDocument()

    // Citation footer
    expect(card.textContent).toMatch(/Halson 2014/)

    // Per-field anchors
    const bars = card.querySelectorAll('[data-field-bar]')
    expect(bars.length).toBe(4)
    const byField = {}
    bars.forEach((b) => { byField[b.getAttribute('data-field-name')] = b })
    expect(byField.rpe.getAttribute('data-field-fill-rate')).toBe('1.000')
    expect(byField.tss.getAttribute('data-field-fill-rate')).toBe('1.000')
    expect(byField.durationMin.getAttribute('data-field-fill-rate')).toBe('1.000')
    expect(byField.heartRate.getAttribute('data-field-fill-rate')).toBe('1.000')
  })
})

// ─── PARTIAL band ───────────────────────────────────────────────────────────
describe('CheckInQualityCard — PARTIAL band', () => {
  it('renders PARTIAL label and interpolates weakestField (durationMin → DURATION)', () => {
    // RPE always present; TSS always present; durationMin missing on 3 of 4;
    // heartRate missing on 1 of 4 → weakestField = durationMin
    const log = [
      { date: isoMinusDays(TODAY, 1), rpe: 6, tss: 80, durationMin: 60, heartRate: 140 },
      { date: isoMinusDays(TODAY, 3), rpe: 5, tss: 70, heartRate: 138 },
      { date: isoMinusDays(TODAY, 5), rpe: 7, tss: 90, heartRate: 142 },
      { date: isoMinusDays(TODAY, 7), rpe: 6, tss: 75 },
    ]
    renderCard({ log })

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-quality-band')).toBe('PARTIAL')
    expect(card.getAttribute('data-weakest-field')).toBe('durationMin')

    expect(card.textContent).toMatch(/PARTIAL/)

    // Interpolated weakest field name in EN should be 'DURATION'
    expect(
      screen.getByText(/Some fields missing across sessions\. Filling DURATION would tighten insights\./i)
    ).toBeInTheDocument()
  })

  it('renders PARTIAL hint with TSS interpolation when tss is weakest', () => {
    // Half-filled sessions (rpe + durationMin only) → weakestField = tss
    const log = [
      { date: isoMinusDays(TODAY, 1), rpe: 6, durationMin: 60 },
      { date: isoMinusDays(TODAY, 3), rpe: 5, durationMin: 45 },
      { date: isoMinusDays(TODAY, 5), rpe: 7, durationMin: 90 },
      { date: isoMinusDays(TODAY, 7), rpe: 6, durationMin: 50 },
    ]
    renderCard({ log })

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-quality-band')).toBe('PARTIAL')
    expect(card.getAttribute('data-weakest-field')).toBe('tss')

    expect(
      screen.getByText(/Some fields missing across sessions\. Filling TSS would tighten insights\./i)
    ).toBeInTheDocument()
  })
})

// ─── THIN band ──────────────────────────────────────────────────────────────
describe('CheckInQualityCard — THIN band', () => {
  it('renders THIN label, orange band, and Quick Add hint', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), rpe: 6 },
      { date: isoMinusDays(TODAY, 3), rpe: 7 },
      { date: isoMinusDays(TODAY, 5), rpe: 5 },
    ]
    renderCard({ log })

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-quality-band')).toBe('THIN')
    expect(card.getAttribute('data-session-count')).toBe('3')

    expect(card.textContent).toMatch(/THIN/)
    expect(card.textContent).toMatch(/25%/)

    expect(
      screen.getByText(/Many sessions lack core fields\. Use Quick Add to capture at least RPE \+ duration\./i)
    ).toBeInTheDocument()
  })
})

// ─── Turkish ────────────────────────────────────────────────────────────────
describe('CheckInQualityCard — Turkish', () => {
  it('renders Turkish title + EKSİKSİZ band label + TR hint for COMPLETE', () => {
    const log = [fullSession(1), fullSession(3), fullSession(5)]
    renderCard({ log }, 'tr')

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-quality-band')).toBe('COMPLETE')

    expect(card.textContent).toMatch(/KAYIT KALİTESİ · 14G/)
    expect(card.textContent).toMatch(/EKSİKSİZ/)
    expect(
      screen.getByText(/Güçlü veri hijyeni — trend içgörülerin sağlam temelli\./i)
    ).toBeInTheDocument()
  })

  it('renders Turkish field labels (SÜRE / KAH) on the per-field bars', () => {
    const log = [fullSession(1), fullSession(3), fullSession(5)]
    renderCard({ log }, 'tr')

    const card = screen.getByRole('region')
    expect(card.textContent).toMatch(/SÜRE/)
    expect(card.textContent).toMatch(/KAH/)
  })

  it('interpolates the Turkish weakest-field name into the PARTIAL hint', () => {
    // durationMin missing → weakestField = durationMin → TR label = SÜRE
    const log = [
      { date: isoMinusDays(TODAY, 1), rpe: 6, tss: 80, durationMin: 60, heartRate: 140 },
      { date: isoMinusDays(TODAY, 3), rpe: 5, tss: 70, heartRate: 138 },
      { date: isoMinusDays(TODAY, 5), rpe: 7, tss: 90, heartRate: 142 },
      { date: isoMinusDays(TODAY, 7), rpe: 6, tss: 75 },
    ]
    renderCard({ log }, 'tr')

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-quality-band')).toBe('PARTIAL')
    expect(card.getAttribute('data-weakest-field')).toBe('durationMin')

    expect(
      screen.getByText(/Seanslar arası bazı alanlar eksik\. SÜRE doldurmak içgörüleri sağlamlaştırır\./i)
    ).toBeInTheDocument()
  })

  it('renders KISMEN / İNCE band labels in Turkish', () => {
    // THIN
    const thinLog = [
      { date: isoMinusDays(TODAY, 1), rpe: 6 },
      { date: isoMinusDays(TODAY, 3), rpe: 7 },
      { date: isoMinusDays(TODAY, 5), rpe: 5 },
    ]
    const { unmount } = renderCard({ log: thinLog }, 'tr')
    expect(screen.getByRole('region').textContent).toMatch(/İNCE/)
    unmount()

    // PARTIAL — half-filled
    const partialLog = [
      { date: isoMinusDays(TODAY, 1), rpe: 6, durationMin: 60 },
      { date: isoMinusDays(TODAY, 3), rpe: 5, durationMin: 45 },
      { date: isoMinusDays(TODAY, 5), rpe: 7, durationMin: 90 },
    ]
    renderCard({ log: partialLog }, 'tr')
    expect(screen.getByRole('region').textContent).toMatch(/KISMEN/)
  })
})
