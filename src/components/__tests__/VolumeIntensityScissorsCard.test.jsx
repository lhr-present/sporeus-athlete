// @vitest-environment jsdom
// ─── VolumeIntensityScissorsCard.test.jsx ────────────────────────────────
// Render tests for the Volume × Intensity Scissors card.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import VolumeIntensityScissorsCard from '../dashboard/VolumeIntensityScissorsCard.jsx'

const TODAY = '2026-05-17'

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
      <VolumeIntensityScissorsCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function buildLog(weekly) {
  const monday = mondayOf(TODAY)
  const log = []
  for (let i = 0; i < weekly.length; i++) {
    const wkStart = isoMinusDays(monday, (weekly.length - 1 - i) * 7)
    const { dur, tss } = weekly[i] || {}
    if (dur != null) {
      const e = { date: isoMinusDays(wkStart, -2), duration_min: dur }
      if (tss != null) e.tss = tss
      log.push(e)
    }
  }
  return log
}

const PROPER_SCISSORS_WEEKLY = [
  { dur: 600, tss: 600 }, { dur: 600, tss: 600 },
  { dur: 600, tss: 600 }, { dur: 600, tss: 600 },
  { dur: 300, tss: 450 }, { dur: 300, tss: 450 },
  { dur: 300, tss: 450 }, { dur: 300, tss: 450 },
]
const INVERTED_WEEKLY = [
  { dur: 300, tss: 450 }, { dur: 300, tss: 450 },
  { dur: 300, tss: 450 }, { dur: 300, tss: 450 },
  { dur: 600, tss: 600 }, { dur: 600, tss: 600 },
  { dur: 600, tss: 600 }, { dur: 600, tss: 600 },
]
const BOTH_UP_WEEKLY = [
  { dur: 300, tss: 300 }, { dur: 300, tss: 300 },
  { dur: 300, tss: 300 }, { dur: 300, tss: 300 },
  { dur: 600, tss: 900 }, { dur: 600, tss: 900 },
  { dur: 600, tss: 900 }, { dur: 600, tss: 900 },
]
const BOTH_DOWN_WEEKLY = [
  { dur: 600, tss: 900 }, { dur: 600, tss: 900 },
  { dur: 600, tss: 900 }, { dur: 600, tss: 900 },
  { dur: 300, tss: 300 }, { dur: 300, tss: 300 },
  { dur: 300, tss: 300 }, { dur: 300, tss: 300 },
]
const NO_CHANGE_WEEKLY = new Array(8).fill({ dur: 400, tss: 400 })

// ─── null gate ───────────────────────────────────────────────────────────

describe('VolumeIntensityScissorsCard — render gating', () => {
  it('renders NOTHING for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders NOTHING with insufficient history (fewer than 6 volume weeks)', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, -1), duration_min: 60, tss: 60 },
      { date: isoMinusDays(monday, -8), duration_min: 60, tss: 60 },
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders NOTHING when log prop is omitted entirely', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })
})

// ─── band rendering ──────────────────────────────────────────────────────

describe('VolumeIntensityScissorsCard — band rendering', () => {
  it('renders PROPER_SCISSORS band with green stripe', () => {
    renderCard({ log: buildLog(PROPER_SCISSORS_WEEKLY) })
    const card = screen.getByRole('region', { name: /Volume × Intensity Scissors/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-scissors-band')).toBe('PROPER_SCISSORS')
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    expect(card.textContent).toMatch(/PROPER SCISSORS/)
  })

  it('renders INVERTED band with orange stripe', () => {
    renderCard({ log: buildLog(INVERTED_WEEKLY) })
    const card = screen.getByRole('region', { name: /Volume × Intensity Scissors/i })
    expect(card.getAttribute('data-scissors-band')).toBe('INVERTED')
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
    expect(card.textContent).toMatch(/INVERTED/)
  })

  it('renders BOTH_UP band with red stripe', () => {
    renderCard({ log: buildLog(BOTH_UP_WEEKLY) })
    const card = screen.getByRole('region', { name: /Volume × Intensity Scissors/i })
    expect(card.getAttribute('data-scissors-band')).toBe('BOTH_UP')
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*51,\s*51\)/)
    expect(card.textContent).toMatch(/BOTH UP/)
  })

  it('renders BOTH_DOWN band with muted stripe', () => {
    renderCard({ log: buildLog(BOTH_DOWN_WEEKLY) })
    const card = screen.getByRole('region', { name: /Volume × Intensity Scissors/i })
    expect(card.getAttribute('data-scissors-band')).toBe('BOTH_DOWN')
    expect(card.style.borderLeft).toMatch(/rgb\(136,\s*136,\s*136\)/)
    expect(card.textContent).toMatch(/BOTH DOWN/)
  })

  it('renders NO_CHANGE band with blue stripe', () => {
    renderCard({ log: buildLog(NO_CHANGE_WEEKLY) })
    const card = screen.getByRole('region', { name: /Volume × Intensity Scissors/i })
    expect(card.getAttribute('data-scissors-band')).toBe('NO_CHANGE')
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
    expect(card.textContent).toMatch(/NO CHANGE/)
  })
})

// ─── data anchors ────────────────────────────────────────────────────────

describe('VolumeIntensityScissorsCard — data anchors', () => {
  it('exposes data-card, data-scissors-band, data-volume-trend, data-intensity-trend', () => {
    renderCard({ log: buildLog(PROPER_SCISSORS_WEEKLY) })
    const card = document.querySelector('[data-card="volume-intensity-scissors"]')
    expect(card).not.toBeNull()
    expect(card.hasAttribute('data-scissors-band')).toBe(true)
    expect(card.hasAttribute('data-volume-trend')).toBe(true)
    expect(card.hasAttribute('data-intensity-trend')).toBe(true)
    // Trends should parse as finite numbers.
    expect(Number.isFinite(parseFloat(card.getAttribute('data-volume-trend')))).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-intensity-trend')))).toBe(true)
  })

  it('renders two sparklines (volume + intensity)', () => {
    renderCard({ log: buildLog(PROPER_SCISSORS_WEEKLY) })
    const sparkVol = document.querySelector('[data-spark="volume"]')
    const sparkInt = document.querySelector('[data-spark="intensity"]')
    expect(sparkVol).not.toBeNull()
    expect(sparkInt).not.toBeNull()
  })

  it('renders signed percent labels for each trend', () => {
    renderCard({ log: buildLog(PROPER_SCISSORS_WEEKLY) })
    const volLabel = document.querySelector('[data-volume-trend-label]')
    const intLabel = document.querySelector('[data-intensity-trend-label]')
    expect(volLabel).not.toBeNull()
    expect(intLabel).not.toBeNull()
    // Volume should be negative, intensity positive.
    expect(volLabel.textContent).toMatch(/-/)
    expect(intLabel.textContent).toMatch(/\+/)
  })
})

// ─── bilingual ───────────────────────────────────────────────────────────

describe('VolumeIntensityScissorsCard — bilingual', () => {
  it('renders English title when lang=en', () => {
    renderCard({ log: buildLog(PROPER_SCISSORS_WEEKLY) }, 'en')
    expect(screen.getByText('VOLUME × INTENSITY SCISSORS · 8W')).toBeInTheDocument()
    expect(screen.getByText(/PROPER SCISSORS/)).toBeInTheDocument()
  })

  it('renders Turkish title when lang=tr', () => {
    renderCard({ log: buildLog(PROPER_SCISSORS_WEEKLY) }, 'tr')
    expect(screen.getByText('HACİM × ŞİDDET MAKAS · 8H')).toBeInTheDocument()
    expect(screen.getByText(/UYGUN MAKAS/)).toBeInTheDocument()
  })

  it('renders Turkish band label for INVERTED (TERS)', () => {
    renderCard({ log: buildLog(INVERTED_WEEKLY) }, 'tr')
    expect(screen.getByText(/TERS/)).toBeInTheDocument()
  })

  it('renders Turkish band label for BOTH_UP (İKİSİ DE ARTIYOR)', () => {
    renderCard({ log: buildLog(BOTH_UP_WEEKLY) }, 'tr')
    expect(screen.getByText(/İKİSİ DE ARTIYOR/)).toBeInTheDocument()
  })

  it('renders Turkish band label for NO_CHANGE (DEĞİŞİM YOK)', () => {
    renderCard({ log: buildLog(NO_CHANGE_WEEKLY) }, 'tr')
    expect(screen.getByText(/DEĞİŞİM YOK/)).toBeInTheDocument()
  })

  it('renders Turkish axis labels', () => {
    renderCard({ log: buildLog(PROPER_SCISSORS_WEEKLY) }, 'tr')
    // Per-axis labels (distinct from the card title).
    expect(screen.getByText('HACİM (dk)')).toBeInTheDocument()
    expect(screen.getByText('ŞİDDET (IF×60)')).toBeInTheDocument()
  })
})

// ─── citation + accessibility ────────────────────────────────────────────

describe('VolumeIntensityScissorsCard — citation + a11y', () => {
  it('renders the Issurin 2010 + Stöggl 2014 citation', () => {
    renderCard({ log: buildLog(PROPER_SCISSORS_WEEKLY) })
    const card = screen.getByRole('region', { name: /Volume × Intensity Scissors/i })
    expect(card.textContent).toMatch(/Issurin 2010/)
    expect(card.textContent).toMatch(/Stöggl 2014/)
  })

  it('has role="region" and aria-label set', () => {
    renderCard({ log: buildLog(PROPER_SCISSORS_WEEKLY) })
    const card = screen.getByRole('region')
    expect(card).toHaveAttribute('aria-label')
    expect(card.getAttribute('aria-label')).toMatch(/Volume × Intensity Scissors/i)
  })

  it('uses Turkish aria-label when lang=tr', () => {
    renderCard({ log: buildLog(PROPER_SCISSORS_WEEKLY) }, 'tr')
    const card = screen.getByRole('region')
    expect(card.getAttribute('aria-label')).toMatch(/Hacim × Şiddet Makas/i)
  })

  it('sparklines carry role=img with descriptive aria-labels', () => {
    renderCard({ log: buildLog(PROPER_SCISSORS_WEEKLY) })
    const imgs = document.querySelectorAll('svg[role="img"]')
    expect(imgs.length).toBeGreaterThanOrEqual(2)
    for (const img of imgs) {
      expect(img.hasAttribute('aria-label')).toBe(true)
    }
  })
})
