// @vitest-environment jsdom
// ─── WeeklyVolumeIntensityRatioCard.test.jsx — render tests ─────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WeeklyVolumeIntensityRatioCard from '../dashboard/WeeklyVolumeIntensityRatioCard.jsx'

const TODAY = '2026-05-18'   // Monday — ISO week starts on TODAY itself.

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <WeeklyVolumeIntensityRatioCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function weekStartIso(k, today = TODAY) {
  return isoMinusDays(today, k * 7)
}

function buildWeeklyLog(weeklyData, today = TODAY) {
  const log = []
  const weeks = weeklyData.length
  for (let i = 0; i < weeks; i++) {
    const slot = weeklyData[i]
    if (!slot) continue
    const k = weeks - 1 - i
    const monday = weekStartIso(k, today)
    const date = isoMinusDays(monday, -2) // Wednesday of that week
    log.push({ date, durationMin: slot.durationMin, tss: slot.tss })
  }
  return log
}

// ─── Render gating ───────────────────────────────────────────────────────────

describe('WeeklyVolumeIntensityRatioCard — render gating', () => {
  it('renders NOTHING for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders NOTHING when fewer than 5 of 8 weeks have a valid ratio', () => {
    const log = buildWeeklyLog([
      null, null, null, null,
      { durationMin: 60, tss: 50 },
      { durationMin: 60, tss: 50 },
      { durationMin: 60, tss: 50 },
      { durationMin: 60, tss: 50 },
    ])
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── Band rendering ──────────────────────────────────────────────────────────

describe('WeeklyVolumeIntensityRatioCard — band rendering', () => {
  it('renders STABLE band with green color when ratios are flat', () => {
    const log = buildWeeklyLog(
      Array(8).fill({ durationMin: 60, tss: 50 })
    )
    renderCard({ log })
    const card = screen.getByRole('region', {
      name: /Weekly volume-to-intensity ratio/i,
    })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-intensity-band')).toBe('STABLE')
    // Green left border (#5bc25b → rgb(91, 194, 91))
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    expect(card.textContent).toMatch(/STABLE/)
    expect(card.textContent).toMatch(/Foster 2001/)
  })

  it('renders CREEPING_INTENSITY band with orange color when recent TSS/min rises', () => {
    // Early ratio 1.2 → recent 0.8 → delta -33%
    const early  = { durationMin: 60, tss: 50 }
    const recent = { durationMin: 60, tss: 75 }
    const log = buildWeeklyLog([
      early, early, early, early,
      recent, recent, recent, recent,
    ])
    renderCard({ log })
    const card = screen.getByRole('region', {
      name: /Weekly volume-to-intensity ratio/i,
    })
    expect(card.getAttribute('data-intensity-band')).toBe('CREEPING_INTENSITY')
    // Orange left border (#ff6600 → rgb(255, 102, 0))
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
    expect(card.textContent).toMatch(/CREEPING INTENSITY/)
    // EN reco snippet
    expect(card.textContent).toMatch(/intensity is creeping up/i)
  })

  it('renders VOLUME_GROWING band with blue color when recent minutes/TSS rises', () => {
    const early  = { durationMin: 60, tss: 50 }    // 1.2
    const recent = { durationMin: 90, tss: 50 }    // 1.8 → +50%
    const log = buildWeeklyLog([
      early, early, early, early,
      recent, recent, recent, recent,
    ])
    renderCard({ log })
    const card = screen.getByRole('region', {
      name: /Weekly volume-to-intensity ratio/i,
    })
    expect(card.getAttribute('data-intensity-band')).toBe('VOLUME_GROWING')
    // Blue left border (#0064ff → rgb(0, 100, 255))
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
    expect(card.textContent).toMatch(/VOLUME GROWING/)
  })
})

// ─── Bilingual + data anchors ────────────────────────────────────────────────

describe('WeeklyVolumeIntensityRatioCard — bilingual + data anchors', () => {
  it('renders Turkish heading and CREEPING_INTENSITY label "YOĞUNLUK ARTIYOR"', () => {
    const early  = { durationMin: 60, tss: 50 }
    const recent = { durationMin: 60, tss: 75 }
    const log = buildWeeklyLog([
      early, early, early, early,
      recent, recent, recent, recent,
    ])
    renderCard({ log }, 'tr')
    expect(screen.getByText(/HACİM ÷ YOĞUNLUK · 8H/)).toBeInTheDocument()
    expect(screen.getByText(/YOĞUNLUK ARTIYOR/)).toBeInTheDocument()
    // TR reco snippet
    expect(
      screen.getByText(/yoğunluk gizlice artıyor/i)
    ).toBeInTheDocument()
  })

  it('renders Turkish STABLE label "STABİL"', () => {
    const log = buildWeeklyLog(
      Array(8).fill({ durationMin: 60, tss: 50 })
    )
    renderCard({ log }, 'tr')
    expect(screen.getByText(/STABİL/)).toBeInTheDocument()
  })

  it('renders Turkish VOLUME_GROWING label "HACİM ARTIYOR"', () => {
    const early  = { durationMin: 60, tss: 50 }
    const recent = { durationMin: 90, tss: 50 }
    const log = buildWeeklyLog([
      early, early, early, early,
      recent, recent, recent, recent,
    ])
    renderCard({ log }, 'tr')
    // Title (which contains "HACİM") and the band label both match
    // /HACİM ARTIYOR/ — use queryAllByText to assert at least one match.
    const matches = screen.getAllByText(/HACİM ARTIYOR/)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('emits one data-week-bar per week with data-week-start + data-week-ratio', () => {
    const log = buildWeeklyLog(
      Array(8).fill({ durationMin: 60, tss: 50 })
    )
    renderCard({ log })
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars.length).toBe(8)
    // Chronological order: oldest first → newest last.
    expect(bars[0].getAttribute('data-week-start')).toBe('2026-03-30')
    expect(bars[7].getAttribute('data-week-start')).toBe('2026-05-18')
    // Every bar has a numeric ratio attribute when valid.
    for (const b of bars) {
      const r = b.getAttribute('data-week-ratio')
      expect(r).toBeTruthy()
      expect(Number.isFinite(Number(r))).toBe(true)
    }
  })

  it('renders null-ratio weeks as muted thin bars (empty data-week-ratio)', () => {
    // 3 null weeks + 5 valid ratio weeks
    const log = buildWeeklyLog([
      null, null, null,
      { durationMin: 60, tss: 50 },
      { durationMin: 60, tss: 50 },
      { durationMin: 60, tss: 50 },
      { durationMin: 60, tss: 50 },
      { durationMin: 60, tss: 50 },
    ])
    renderCard({ log })
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars.length).toBe(8)
    // First three weeks should have empty data-week-ratio.
    expect(bars[0].getAttribute('data-week-ratio')).toBe('')
    expect(bars[1].getAttribute('data-week-ratio')).toBe('')
    expect(bars[2].getAttribute('data-week-ratio')).toBe('')
    // Remaining have a finite ratio.
    expect(Number(bars[3].getAttribute('data-week-ratio'))).toBeGreaterThan(0)
  })

  it('sets data-delta and data-avg-ratio anchors', () => {
    const log = buildWeeklyLog(
      Array(8).fill({ durationMin: 60, tss: 50 })
    )
    renderCard({ log })
    const card = document.querySelector('[data-weekly-volume-intensity-ratio-card]')
    expect(card).not.toBeNull()
    // STABLE case → delta ≈ 0
    expect(Math.abs(Number(card.getAttribute('data-delta')))).toBeLessThan(1e-6)
    // avgRatio = 1.2
    expect(Number(card.getAttribute('data-avg-ratio'))).toBeCloseTo(1.2, 4)
  })
})
