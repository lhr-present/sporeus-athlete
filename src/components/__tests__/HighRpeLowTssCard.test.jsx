// @vitest-environment jsdom
// ─── HighRpeLowTssCard.test.jsx — card render tests ─────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import HighRpeLowTssCard from '../dashboard/HighRpeLowTssCard.jsx'

const TODAY = '2026-05-19'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function entry(daysAgo, rpe, tss) {
  return { date: isoMinusDays(TODAY, daysAgo), rpe, tss }
}

// 24 baseline sessions on the line tss = 10 × rpe (rpe 4..8)
function linearBaseline(startDaysAgo = 100) {
  const out = []
  const rpes = [4, 5, 6, 7, 8]
  for (let i = 0; i < 24; i++) {
    const r = rpes[i % rpes.length]
    out.push(entry(startDaysAgo + i, r, r * 10))
  }
  return out
}

function renderCard(props = {}, lang = 'en') {
  const value = { t: (k) => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <HighRpeLowTssCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Null gate ──────────────────────────────────────────────────────────────
describe('HighRpeLowTssCard — null gate', () => {
  it('renders nothing when pure-fn returns null (today unresolvable would be impossible here, but log=undefined → empty defaults render INSUFFICIENT)', () => {
    // The component renders INSUFFICIENT_DATA when log is empty (pure fn never
    // returns null with system clock, only on bad explicit today). We assert
    // the card still renders a region in that case.
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).not.toBeNull()
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
  })
})

// ─── INSUFFICIENT_DATA band ─────────────────────────────────────────────────
describe('HighRpeLowTssCard — INSUFFICIENT_DATA', () => {
  it('renders INSUFFICIENT_DATA chip + baseline progress for empty log', () => {
    renderCard({ log: [] })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-card')).toBe('high-rpe-low-tss')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    expect(card.getAttribute('data-baseline-sessions')).toBe('0')
    expect(card.textContent).toMatch(/EFFORT-LOAD MISMATCH/)
    expect(card.textContent).toMatch(/INSUFFICIENT DATA/)
    expect(card.textContent).toMatch(/Baseline sessions: 0 \/ 20/)
    expect(card.textContent).toMatch(/Foster 2017; Halson 2014/)
  })

  it('shows baseline progress when partial baseline is available', () => {
    const log = []
    for (let i = 0; i < 12; i++) log.push(entry(100 + i, 5, 50))
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    expect(card.getAttribute('data-baseline-sessions')).toBe('12')
    expect(card.textContent).toMatch(/Baseline sessions: 12 \/ 20/)
  })
})

// ─── WELL_MATCHED band ──────────────────────────────────────────────────────
describe('HighRpeLowTssCard — WELL_MATCHED', () => {
  it('renders WELL MATCHED chip + 0 mismatches + reassurance hint', () => {
    const log = [
      ...linearBaseline(100),
      entry(5, 5, 50),
      entry(10, 6, 60),
      entry(15, 7, 70),
    ]
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-band')).toBe('WELL_MATCHED')
    expect(card.getAttribute('data-mismatch-count')).toBe('0')
    expect(card.getAttribute('data-total-sessions')).toBe('3')
    expect(card.textContent).toMatch(/WELL MATCHED/)
    expect(card.textContent).toMatch(/0 of 3 sessions/)
    expect(
      screen.getByText(/Effort and objective load track together — no fatigue signal in the recent window\./i)
    ).toBeInTheDocument()
  })
})

// ─── OCCASIONAL_MISMATCH band ───────────────────────────────────────────────
describe('HighRpeLowTssCard — OCCASIONAL_MISMATCH', () => {
  it('renders OCCASIONAL MISMATCH chip + mismatch chips + sleep/fueling hint', () => {
    const log = [...linearBaseline(100)]
    for (let i = 0; i < 8; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(20, 8, 5))
    log.push(entry(25, 7, 5))
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-band')).toBe('OCCASIONAL_MISMATCH')
    expect(card.getAttribute('data-mismatch-count')).toBe('2')
    expect(card.textContent).toMatch(/OCCASIONAL MISMATCH/)
    expect(
      screen.getByText(/Some sessions are feeling harder than the load explains — watch for sleep, fueling, illness\./i)
    ).toBeInTheDocument()
  })
})

// ─── PERSISTENT_FATIGUE band ────────────────────────────────────────────────
describe('HighRpeLowTssCard — PERSISTENT_FATIGUE', () => {
  it('renders PERSISTENT FATIGUE chip + recovery hint', () => {
    const log = [...linearBaseline(100)]
    for (let i = 0; i < 6; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(20, 8, 5))
    log.push(entry(25, 7, 5))
    log.push(entry(30, 6, 5))
    log.push(entry(35, 8, 10))
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-band')).toBe('PERSISTENT_FATIGUE')
    expect(card.getAttribute('data-mismatch-count')).toBe('4')
    expect(card.textContent).toMatch(/PERSISTENT FATIGUE/)
    expect(
      screen.getByText(/Recurring effort-load mismatch — back off intensity and review recovery factors\./i)
    ).toBeInTheDocument()
  })
})

// ─── Recent mismatch chips ──────────────────────────────────────────────────
describe('HighRpeLowTssCard — mismatch chips', () => {
  it('renders at most 3 chips, newest-first, when there are >3 mismatches', () => {
    const log = [...linearBaseline(100)]
    // 4 mismatches at recent days: 35, 30, 25, 20, 15
    for (let i = 0; i < 5; i++) {
      log.push(entry(15 + i * 5, 8, 5))
    }
    renderCard({ log })
    const card = screen.getByRole('region')
    const chips = card.querySelectorAll('[data-mismatch-chip]')
    expect(chips.length).toBe(3)
    // Newest first → first chip is daysAgo 15, then 20, then 25
    expect(chips[0].getAttribute('data-chip-date')).toBe(isoMinusDays(TODAY, 15))
    expect(chips[1].getAttribute('data-chip-date')).toBe(isoMinusDays(TODAY, 20))
    expect(chips[2].getAttribute('data-chip-date')).toBe(isoMinusDays(TODAY, 25))
  })

  it('renders no chip container when there are zero mismatches', () => {
    const log = [...linearBaseline(100), entry(5, 5, 50)]
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.querySelector('[data-mismatch-chips]')).toBeNull()
  })
})

// ─── Turkish ────────────────────────────────────────────────────────────────
describe('HighRpeLowTssCard — Turkish', () => {
  it('renders Turkish title + UYUMLU band + TR hint for WELL_MATCHED', () => {
    const log = [...linearBaseline(100), entry(5, 5, 50)]
    renderCard({ log }, 'tr')
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-band')).toBe('WELL_MATCHED')
    expect(card.textContent).toMatch(/EFOR-YÜK UYUMSUZLUĞU/)
    expect(card.textContent).toMatch(/UYUMLU/)
    expect(
      screen.getByText(/Efor ve objektif yük birlikte hareket ediyor — son pencerede yorgunluk sinyali yok\./i)
    ).toBeInTheDocument()
  })

  it('renders Turkish chip labels for OCCASIONAL_MISMATCH', () => {
    const log = [...linearBaseline(100)]
    for (let i = 0; i < 8; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(20, 8, 5))
    log.push(entry(25, 7, 5))
    renderCard({ log }, 'tr')
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-band')).toBe('OCCASIONAL_MISMATCH')
    expect(card.textContent).toMatch(/ARA SIRA UYUMSUZ/)
    expect(card.textContent).toMatch(/UYUMSUZ/) // big-stat label
    expect(
      screen.getByText(/Bazı seanslar yükün açıkladığından zor geliyor — uyku, beslenme, hastalığa dikkat\./i)
    ).toBeInTheDocument()
    // TR "X of Y" wording
    expect(card.textContent).toMatch(/10 seansın 2'i/)
  })

  it('renders YETERSİZ VERİ for INSUFFICIENT_DATA in Turkish', () => {
    renderCard({ log: [] }, 'tr')
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    expect(card.textContent).toMatch(/YETERSİZ VERİ/)
    expect(card.textContent).toMatch(/Temel seans: 0 \/ 20/)
  })

  it('renders KALICI YORGUNLUK for PERSISTENT_FATIGUE in Turkish', () => {
    const log = [...linearBaseline(100)]
    for (let i = 0; i < 6; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(20, 8, 5))
    log.push(entry(25, 7, 5))
    log.push(entry(30, 6, 5))
    log.push(entry(35, 8, 10))
    renderCard({ log }, 'tr')
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-band')).toBe('PERSISTENT_FATIGUE')
    expect(card.textContent).toMatch(/KALICI YORGUNLUK/)
    expect(
      screen.getByText(/Tekrarlayan efor-yük uyumsuzluğu — yoğunluğu düşür ve toparlanma etkenlerini gözden geçir\./i)
    ).toBeInTheDocument()
  })
})

// ─── Citation footer ────────────────────────────────────────────────────────
describe('HighRpeLowTssCard — citation', () => {
  it('renders the Foster 2017 / Halson 2014 citation in every band', () => {
    // INSUFFICIENT
    const r1 = renderCard({ log: [] })
    expect(r1.container.textContent).toMatch(/Foster 2017; Halson 2014/)
    cleanup()

    // WELL_MATCHED
    const r2 = renderCard({ log: [...linearBaseline(100), entry(5, 5, 50)] })
    expect(r2.container.textContent).toMatch(/Foster 2017; Halson 2014/)
  })
})

// ─── Accessibility ──────────────────────────────────────────────────────────
describe('HighRpeLowTssCard — accessibility', () => {
  it('exposes role=region with bilingual aria-label (EN)', () => {
    renderCard({ log: [] })
    const card = screen.getByRole('region')
    expect(card.getAttribute('aria-label')).toMatch(
      /Effort-load mismatch — high-RPE low-TSS fatigue detector/
    )
  })

  it('exposes role=region with bilingual aria-label (TR)', () => {
    renderCard({ log: [] }, 'tr')
    const card = screen.getByRole('region')
    expect(card.getAttribute('aria-label')).toMatch(
      /Efor-yük uyumsuzluğu — yüksek RPE düşük TSS yorgunluk dedektörü/
    )
  })

  it('exposes data-card anchor for cross-test targeting', () => {
    renderCard({ log: [] })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-card')).toBe('high-rpe-low-tss')
  })

  it('big stat has aria-live polite for dynamic updates', () => {
    const log = [...linearBaseline(100), entry(5, 5, 50)]
    renderCard({ log })
    const card = screen.getByRole('region')
    const live = card.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
  })

  it('exposes per-chip aria-label with rpe / tss / expected detail', () => {
    const log = [...linearBaseline(100)]
    for (let i = 0; i < 8; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(20, 8, 5))
    renderCard({ log })
    const card = screen.getByRole('region')
    const chip = card.querySelector('[data-mismatch-chip]')
    expect(chip).not.toBeNull()
    expect(chip.getAttribute('aria-label')).toMatch(/RPE 8/)
    expect(chip.getAttribute('aria-label')).toMatch(/TSS 5/)
    expect(chip.getAttribute('aria-label')).toMatch(/expected/)
  })
})
