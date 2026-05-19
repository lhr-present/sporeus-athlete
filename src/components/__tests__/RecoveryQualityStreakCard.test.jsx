// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RecoveryQualityStreakCard from '../dashboard/RecoveryQualityStreakCard.jsx'

const TODAY = '2026-05-17'

function isoOffset(days) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Baseline padding: ≥10 entries with valid RHR so the lib doesn't bail.
// Use low sleep (4h) so these don't accidentally count as quality days.
function baselinePadding(rhr = 60, days = 10, startOffset = -50) {
  const out = []
  for (let i = 0; i < days; i++) {
    out.push({
      date: isoOffset(startOffset - i),
      sleepHrs: 4,
      restingHR: rhr,
    })
  }
  return out
}

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
      <RecoveryQualityStreakCard {...props} />
    </LangCtx.Provider>
  )
}

describe('RecoveryQualityStreakCard', () => {
  it('renders nothing when recovery is empty', () => {
    const { container } = renderCard({ recovery: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when recovery is undefined / null', () => {
    const { container } = renderCard({ recovery: undefined })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 10 valid RHR entries (baseline untrusted)', () => {
    const recovery = []
    for (let i = 0; i < 9; i++) {
      recovery.push({ date: isoOffset(-i), sleepHrs: 9, restingHR: 55 })
    }
    const { container } = renderCard({ recovery })
    expect(container.firstChild).toBeNull()
  })

  it('renders DEEP_RECOVERY status (currentStreak ≥ 5) with green color + label', () => {
    const recovery = []
    for (let i = 0; i < 6; i++) {
      recovery.push({ date: isoOffset(-i), sleepHrs: 9, restingHR: 50 })
    }
    recovery.push(...baselinePadding(60, 10))
    renderCard({ recovery })

    const region = screen.getByRole('region', { name: /Recovery quality streak/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/RECOVERY QUALITY STREAK/)
    expect(region.textContent).toMatch(/DEEP RECOVERY/)
    expect(region.textContent).toMatch(/Walker 2017; Buchheit 2014/)

    const el = document.querySelector('[data-recovery-quality-streak-card]')
    expect(el).not.toBeNull()
    expect(el.getAttribute('data-streak-status')).toBe('DEEP_RECOVERY')
    expect(el.getAttribute('data-current-streak')).toBe('6')
  })

  it('renders STEADY status (2 ≤ currentStreak < 5) with blue label', () => {
    const recovery = [
      { date: TODAY,         sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-2), sleepHrs: 9, restingHR: 50 },
      ...baselinePadding(60, 10),
    ]
    renderCard({ recovery })

    const el = document.querySelector('[data-recovery-quality-streak-card]')
    expect(el.getAttribute('data-streak-status')).toBe('STEADY')
    expect(el.getAttribute('data-current-streak')).toBe('3')
    expect(el.textContent).toMatch(/STEADY/)
  })

  it('renders INCONSISTENT status (currentStreak < 2) with orange label', () => {
    const recovery = [
      { date: TODAY,         sleepHrs: 5, restingHR: 50 }, // bad sleep today
      { date: isoOffset(-1), sleepHrs: 9, restingHR: 50 },
      ...baselinePadding(60, 10),
    ]
    renderCard({ recovery })

    const el = document.querySelector('[data-recovery-quality-streak-card]')
    expect(el.getAttribute('data-streak-status')).toBe('INCONSISTENT')
    expect(el.getAttribute('data-current-streak')).toBe('0')
    expect(el.textContent).toMatch(/INCONSISTENT/)
  })

  it('exposes all required data anchors', () => {
    const recovery = []
    // 3-day current run, 2 older quality days separated by a bad day → longest 3
    for (let i = 0; i < 3; i++) {
      recovery.push({ date: isoOffset(-i), sleepHrs: 9, restingHR: 50 })
    }
    recovery.push({ date: isoOffset(-3), sleepHrs: 4, restingHR: 50 }) // break
    recovery.push({ date: isoOffset(-4), sleepHrs: 9, restingHR: 50 })
    recovery.push({ date: isoOffset(-5), sleepHrs: 9, restingHR: 50 })
    recovery.push(...baselinePadding(60, 10, -60))

    renderCard({ recovery, profile: { sleepTarget: 8 } })
    const el = document.querySelector('[data-recovery-quality-streak-card]')

    expect(el.hasAttribute('data-streak-status')).toBe(true)
    expect(el.hasAttribute('data-current-streak')).toBe(true)
    expect(el.hasAttribute('data-longest-streak')).toBe(true)
    expect(el.hasAttribute('data-total-quality-days-28')).toBe(true)
    expect(el.hasAttribute('data-sleep-target')).toBe(true)
    expect(el.hasAttribute('data-lifetime-baseline-rhr')).toBe(true)

    expect(el.getAttribute('data-current-streak')).toBe('3')
    expect(el.getAttribute('data-longest-streak')).toBe('3')
    expect(el.getAttribute('data-sleep-target')).toBe('8')
    // 5 quality days inside 28-day window
    expect(el.getAttribute('data-total-quality-days-28')).toBe('5')
  })

  it('renders Turkish copy when lang = tr', () => {
    const recovery = []
    for (let i = 0; i < 6; i++) {
      recovery.push({ date: isoOffset(-i), sleepHrs: 9, restingHR: 50 })
    }
    recovery.push(...baselinePadding(60, 10))
    renderCard({ recovery }, 'tr')

    const region = screen.getByRole('region', { name: /Toparlanma kalite serisi/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/TOPARLANMA KALİTE SERİSİ/)
    expect(region.textContent).toMatch(/DERİN TOPARLANMA/)
    expect(region.textContent).toMatch(/gün/)
    expect(region.textContent).toMatch(/en uzun:/)
    expect(region.textContent).toMatch(/kaliteli gün/)
    expect(region.textContent).toMatch(/uyku ≥/)
    expect(region.textContent).toMatch(/KAH ≤/)
  })

  it('renders TR INCONSISTENT label "KARARSIZ" when streak < 2', () => {
    const recovery = [
      { date: TODAY, sleepHrs: 5, restingHR: 50 },
      ...baselinePadding(60, 10),
    ]
    renderCard({ recovery }, 'tr')
    const el = document.querySelector('[data-recovery-quality-streak-card]')
    expect(el.getAttribute('data-streak-status')).toBe('INCONSISTENT')
    expect(el.textContent).toMatch(/KARARSIZ/)
  })

  it('renders TR STEADY label "SABİT" when 2 ≤ streak < 5', () => {
    const recovery = [
      { date: TODAY,         sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 9, restingHR: 50 },
      ...baselinePadding(60, 10),
    ]
    renderCard({ recovery }, 'tr')
    const el = document.querySelector('[data-recovery-quality-streak-card]')
    expect(el.getAttribute('data-streak-status')).toBe('STEADY')
    expect(el.textContent).toMatch(/SABİT/)
  })

  it('uses profile.sleepTarget when provided', () => {
    const recovery = [
      { date: TODAY,         sleepHrs: 7.5, restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 7.6, restingHR: 50 },
      { date: isoOffset(-2), sleepHrs: 7.7, restingHR: 50 },
      ...baselinePadding(60, 10),
    ]
    renderCard({ recovery, profile: { sleepTarget: 7.5 } })
    const el = document.querySelector('[data-recovery-quality-streak-card]')
    expect(el.getAttribute('data-sleep-target')).toBe('7.5')
    expect(el.getAttribute('data-current-streak')).toBe('3')
    expect(el.getAttribute('data-streak-status')).toBe('STEADY')
  })
})
