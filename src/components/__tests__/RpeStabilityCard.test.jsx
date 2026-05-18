// @vitest-environment jsdom
// ─── RpeStabilityCard.test.jsx — card render tests ──────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RpeStabilityCard from '../dashboard/RpeStabilityCard.jsx'

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
      <RpeStabilityCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function session(daysAgo, type, rpe) {
  return { date: isoMinusDays(TODAY, daysAgo), type, rpe }
}

// ─── Null gating ────────────────────────────────────────────────────────────
describe('RpeStabilityCard — null gating', () => {
  it('renders nothing when log is empty', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when only one type has ≥3 sessions', () => {
    const log = [
      session(1, 'easy', 4),
      session(3, 'easy', 4),
      session(5, 'easy', 4),
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── CALIBRATED band ────────────────────────────────────────────────────────
describe('RpeStabilityCard — CALIBRATED band', () => {
  it('renders CALIBRATED label, 0% weighted cv, and reliable-perception hint', () => {
    const log = [
      session(1, 'easy', 4),
      session(3, 'easy', 4),
      session(5, 'easy', 4),
      session(7, 'tempo', 7),
      session(9, 'tempo', 7),
      session(11, 'tempo', 7),
    ]
    renderCard({ log })

    const card = screen.getByRole('region', { name: /RPE stability/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-rpe-stability-card')).not.toBeNull()
    expect(card.getAttribute('data-stability-band')).toBe('CALIBRATED')
    expect(card.getAttribute('data-weighted-cv')).toBe('0.0000')
    expect(card.getAttribute('data-group-count')).toBe('2')
    expect(card.getAttribute('data-total-sessions')).toBe('6')

    expect(card.textContent).toMatch(/RPE STABILITY · 28D/)
    expect(card.textContent).toMatch(/CALIBRATED/)
    expect(card.textContent).toMatch(/0%/)
    expect(card.textContent).toMatch(/6 sessions/)

    expect(
      screen.getByText(/RPE perception is reliable — your subjective effort matches consistently across same-type sessions\./i)
    ).toBeInTheDocument()

    // Citation footer
    expect(card.textContent).toMatch(/Foster 2001; Borg 1982/)

    // Per-row data anchors
    const rows = card.querySelectorAll('[data-rpe-stability-row]')
    expect(rows.length).toBe(2)
    const byType = {}
    rows.forEach((r) => { byType[r.getAttribute('data-row-type')] = r })
    expect(byType.easy.getAttribute('data-row-count')).toBe('3')
    expect(byType.easy.getAttribute('data-row-mean-rpe')).toBe('4.00')
    expect(byType.easy.getAttribute('data-row-cv')).toBe('0.0000')
    expect(byType.tempo.getAttribute('data-row-count')).toBe('3')
    expect(byType.tempo.getAttribute('data-row-mean-rpe')).toBe('7.00')

    // Each row shows uppercase type, count, mean ± stdev
    expect(card.textContent).toMatch(/EASY/)
    expect(card.textContent).toMatch(/TEMPO/)
    expect(card.textContent).toMatch(/3× · RPE 4\.0 ±0\.0/)
    expect(card.textContent).toMatch(/3× · RPE 7\.0 ±0\.0/)
  })
})

// ─── DEVELOPING band ────────────────────────────────────────────────────────
describe('RpeStabilityCard — DEVELOPING band', () => {
  it('renders DEVELOPING label, blue band, and moderate-spread hint', () => {
    const log = [
      session(1, 'easy', 3),
      session(3, 'easy', 4),
      session(5, 'easy', 5),
      session(7, 'tempo', 6),
      session(9, 'tempo', 7),
      session(11, 'tempo', 8),
    ]
    renderCard({ log })

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-stability-band')).toBe('DEVELOPING')

    expect(card.textContent).toMatch(/DEVELOPING/)
    expect(
      screen.getByText(/RPE varies somewhat within session types — keep logging mindfully for cleaner calibration\./i)
    ).toBeInTheDocument()
  })
})

// ─── MISCALIBRATED band ─────────────────────────────────────────────────────
describe('RpeStabilityCard — MISCALIBRATED band', () => {
  it('renders MISCALIBRATED label, orange band, and Borg re-anchor hint', () => {
    const log = [
      session(1, 'easy', 2),
      session(3, 'easy', 5),
      session(5, 'easy', 8),
      session(7, 'tempo', 4),
      session(9, 'tempo', 7),
      session(11, 'tempo', 10),
    ]
    renderCard({ log })

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-stability-band')).toBe('MISCALIBRATED')

    expect(card.textContent).toMatch(/MISCALIBRATED/)
    expect(
      screen.getByText(/Same-type sessions are rated very differently — re-anchor to Borg 1-10 or compare against HR\/power to calibrate\./i)
    ).toBeInTheDocument()
  })
})

// ─── Turkish ────────────────────────────────────────────────────────────────
describe('RpeStabilityCard — Turkish', () => {
  it('renders Turkish title + KALİBRE band label + TR hint for CALIBRATED', () => {
    const log = [
      session(1, 'easy', 4),
      session(3, 'easy', 4),
      session(5, 'easy', 4),
      session(7, 'tempo', 7),
      session(9, 'tempo', 7),
      session(11, 'tempo', 7),
    ]
    renderCard({ log }, 'tr')

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-stability-band')).toBe('CALIBRATED')

    expect(card.textContent).toMatch(/RPE KARARLILIĞI · 28G/)
    expect(card.textContent).toMatch(/KALİBRE/)
    expect(card.textContent).toMatch(/6 seans/)
    expect(
      screen.getByText(/RPE algısı güvenilir — aynı tür seanslarda öznel efor tutarlı\./i)
    ).toBeInTheDocument()
  })

  it('renders GELİŞİYOR / KALİBRESİZ band labels in Turkish', () => {
    // DEVELOPING
    const developingLog = [
      session(1, 'easy', 3),
      session(3, 'easy', 4),
      session(5, 'easy', 5),
      session(7, 'tempo', 6),
      session(9, 'tempo', 7),
      session(11, 'tempo', 8),
    ]
    const { unmount } = renderCard({ log: developingLog }, 'tr')
    const developingCard = screen.getByRole('region')
    expect(developingCard.getAttribute('data-stability-band')).toBe('DEVELOPING')
    expect(developingCard.textContent).toMatch(/GELİŞİYOR/)
    expect(
      screen.getByText(/RPE aynı tür seanslarda biraz değişiyor — daha temiz kalibrasyon için kayıtlara dikkat et\./i)
    ).toBeInTheDocument()
    unmount()

    // MISCALIBRATED
    const miscalLog = [
      session(1, 'easy', 2),
      session(3, 'easy', 5),
      session(5, 'easy', 8),
      session(7, 'tempo', 4),
      session(9, 'tempo', 7),
      session(11, 'tempo', 10),
    ]
    renderCard({ log: miscalLog }, 'tr')
    const miscalCard = screen.getByRole('region')
    expect(miscalCard.getAttribute('data-stability-band')).toBe('MISCALIBRATED')
    expect(miscalCard.textContent).toMatch(/KALİBRESİZ/)
    expect(
      screen.getByText(/Aynı tür seanslar çok farklı puanlanıyor — Borg 1-10'a yeniden bağlan veya KAH\/güç ile karşılaştırarak kalibre et\./i)
    ).toBeInTheDocument()
  })
})

// ─── Per-row data anchors ───────────────────────────────────────────────────
describe('RpeStabilityCard — row anchors', () => {
  it('emits data-rpe-stability-row with type/count/mean-rpe/cv per group', () => {
    const log = [
      session(1, 'easy', 4),
      session(3, 'easy', 4),
      session(5, 'easy', 5),    // stdev > 0 for easy
      session(7, 'tempo', 7),
      session(9, 'tempo', 7),
      session(11, 'tempo', 7),
    ]
    renderCard({ log })

    const card = screen.getByRole('region')
    const rows = card.querySelectorAll('[data-rpe-stability-row]')
    expect(rows.length).toBe(2)

    const byType = {}
    rows.forEach((r) => { byType[r.getAttribute('data-row-type')] = r })

    expect(byType.easy).toBeTruthy()
    expect(byType.easy.getAttribute('data-row-count')).toBe('3')
    // mean = (4+4+5)/3 ≈ 4.33
    expect(parseFloat(byType.easy.getAttribute('data-row-mean-rpe'))).toBeCloseTo(4.33, 1)
    // cv > 0
    expect(parseFloat(byType.easy.getAttribute('data-row-cv'))).toBeGreaterThan(0)

    expect(byType.tempo).toBeTruthy()
    expect(byType.tempo.getAttribute('data-row-count')).toBe('3')
    expect(byType.tempo.getAttribute('data-row-cv')).toBe('0.0000')
  })
})
