// @vitest-environment jsdom
// ─── TrainAfterRestCard.test.jsx — Dashboard card surface tests ───────────
//
// Covers: null gating, INSUFFICIENT state, each band (CONSERVATIVE, BALANCED,
// AGGRESSIVE), EN + TR locale, citation footer, accessibility, chip rendering.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TrainAfterRestCard from '../dashboard/TrainAfterRestCard.jsx'

const TODAY = '2026-05-19'
// 60-day window → start = 2026-03-21.
const WINDOW_START = '2026-03-21'

function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <TrainAfterRestCard log={log} />
    </LangCtx.Provider>
  )
}

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

// ─── Fixture builders ───────────────────────────────────────────────────────
// Build a "rest / post / follow" repeating pattern.
function buildPattern(postTss, followTss, cycles = 12) {
  const log = []
  for (let i = 0; i < cycles; i++) {
    const base = i * 3
    log.push({ date: addDaysIso(WINDOW_START, base + 1), tss: postTss })
    log.push({ date: addDaysIso(WINDOW_START, base + 2), tss: followTss })
  }
  return log
}

// ─── Null gating ────────────────────────────────────────────────────────────
describe('TrainAfterRestCard — null gating', () => {
  it('renders SOMETHING when analyzer returns INSUFFICIENT (system clock valid)', () => {
    renderCard([])
    expect(document.querySelector('[data-card="train-after-rest"]')).not.toBeNull()
  })
})

// ─── INSUFFICIENT_REBOUND_DAYS state ───────────────────────────────────────
describe('TrainAfterRestCard — INSUFFICIENT state', () => {
  it('renders the INSUFFICIENT band with — as the ratio when log is empty', () => {
    renderCard([])
    const card = document.querySelector('[data-card="train-after-rest"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-tar-band')).toBe('INSUFFICIENT_REBOUND_DAYS')
    expect(card.textContent).toMatch(/—/)
    expect(card.textContent).toMatch(/INSUFFICIENT/i)
  })
})

// ─── CONSERVATIVE_REBOUND state ────────────────────────────────────────────
describe('TrainAfterRestCard — CONSERVATIVE_REBOUND band', () => {
  it('renders CONSERVATIVE_REBOUND with sub-1× ratio', () => {
    // post-rest=40, follow-up=160 → ratio = 0.4 (CONSERVATIVE)
    renderCard(buildPattern(40, 160))
    const card = document.querySelector('[data-card="train-after-rest"]')
    expect(card.getAttribute('data-tar-band')).toBe('CONSERVATIVE_REBOUND')
    expect(card.textContent).toMatch(/0\.4×/)
    expect(card.textContent).toMatch(/CONSERVATIVE/i)
    expect(card.textContent).toMatch(/restraint|supercompensation/i)
  })
})

// ─── BALANCED state ────────────────────────────────────────────────────────
describe('TrainAfterRestCard — BALANCED band', () => {
  it('renders BALANCED with ratio ≈ 1×', () => {
    // post-rest = follow = 100 → ratio = 1.0
    renderCard(buildPattern(100, 100))
    const card = document.querySelector('[data-card="train-after-rest"]')
    expect(card.getAttribute('data-tar-band')).toBe('BALANCED')
    expect(card.textContent).toMatch(/1×/)
    expect(card.textContent).toMatch(/BALANCED/i)
  })
})

// ─── AGGRESSIVE_REBOUND state ──────────────────────────────────────────────
describe('TrainAfterRestCard — AGGRESSIVE_REBOUND band', () => {
  it('renders AGGRESSIVE_REBOUND with above-1× ratio', () => {
    // post-rest=150, follow=50 → ratio = 1.5
    renderCard(buildPattern(150, 50))
    const card = document.querySelector('[data-card="train-after-rest"]')
    expect(card.getAttribute('data-tar-band')).toBe('AGGRESSIVE_REBOUND')
    expect(card.textContent).toMatch(/1\.5×/)
    expect(card.textContent).toMatch(/AGGRESSIVE/i)
    expect(card.textContent).toMatch(/overcommit|guilt|rebound/i)
  })
})

// ─── Locale: English ───────────────────────────────────────────────────────
describe('TrainAfterRestCard — English locale', () => {
  it('renders English heading + POST-REST label', () => {
    renderCard(buildPattern(150, 50), 'en')
    const card = document.querySelector('[data-card="train-after-rest"]')
    expect(card.textContent).toMatch(/POST-REST REBOUND/)
    expect(card.textContent).toMatch(/POST-REST/)
    expect(card.textContent).toMatch(/TRAINING AVG/)
  })

  it('exposes English aria-label', () => {
    renderCard(buildPattern(100, 100), 'en')
    const region = screen.getByRole('region', { name: /Post-rest rebound/i })
    expect(region).toBeInTheDocument()
  })
})

// ─── Locale: Turkish ───────────────────────────────────────────────────────
describe('TrainAfterRestCard — Turkish locale', () => {
  it('renders Turkish heading + band label + interpretation', () => {
    renderCard(buildPattern(150, 50), 'tr')
    const card = document.querySelector('[data-card="train-after-rest"]')
    expect(card.textContent).toMatch(/DİNLENME SONRASI GERİ DÖNÜŞ/)
    expect(card.textContent).toMatch(/AGRESİF/)
    expect(card.textContent).toMatch(/suçluluk|geri dönüş|aşırılığı/i)
  })

  it('exposes Turkish aria-label', () => {
    renderCard(buildPattern(100, 100), 'tr')
    const region = screen.getByRole('region', { name: /Dinlenme sonrası geri dönüş/i })
    expect(region).toBeInTheDocument()
  })
})

// ─── Citation footer ───────────────────────────────────────────────────────
describe('TrainAfterRestCard — citation', () => {
  it('renders Bompa 2018 + Skorski 2019 citation footer', () => {
    renderCard(buildPattern(100, 100))
    const card = document.querySelector('[data-card="train-after-rest"]')
    expect(card.textContent).toMatch(/Bompa 2018/)
    expect(card.textContent).toMatch(/Skorski 2019/)
  })
})

// ─── Accessibility ─────────────────────────────────────────────────────────
describe('TrainAfterRestCard — accessibility', () => {
  it('exposes role=region on the root card element', () => {
    renderCard(buildPattern(100, 100))
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-card')).toBe('train-after-rest')
  })

  it('chip list has role=list with descriptive aria-label', () => {
    renderCard(buildPattern(100, 100))
    const list = screen.queryByRole('list', { name: /post-rest|Recent/i })
    expect(list).not.toBeNull()
  })
})

// ─── Chip rendering ────────────────────────────────────────────────────────
describe('TrainAfterRestCard — chip rendering', () => {
  it('renders at most 3 chips even when there are 12+ post-rest sessions', () => {
    renderCard(buildPattern(100, 100, 12))
    const chips = document.querySelectorAll('[data-tar-chip-date]')
    expect(chips.length).toBeLessThanOrEqual(3)
    expect(chips.length).toBe(3)
  })

  it('chip data-attributes carry TSS + restDaysBefore + date', () => {
    renderCard(buildPattern(100, 100, 12))
    const chip = document.querySelector('[data-tar-chip-date]')
    expect(chip).not.toBeNull()
    expect(chip.getAttribute('data-tar-chip-tss')).toBe('100')
    expect(chip.getAttribute('data-tar-chip-rest-days')).toBe('1')
  })

  it('chip label includes the rest-day count and TSS', () => {
    renderCard(buildPattern(100, 100, 12))
    const chip = document.querySelector('[data-tar-chip-date]')
    expect(chip.textContent).toMatch(/1d rest/i)
    expect(chip.textContent).toMatch(/100 TSS/)
  })

  it('Turkish chip label uses TR rest unit', () => {
    renderCard(buildPattern(100, 100, 12), 'tr')
    const chip = document.querySelector('[data-tar-chip-date]')
    expect(chip.textContent).toMatch(/1g dinl/i)
    expect(chip.textContent).toMatch(/100 TSS/)
  })
})

// ─── data-attribute surface ────────────────────────────────────────────────
describe('TrainAfterRestCard — data attributes', () => {
  it('exposes all key stats as data-* attributes', () => {
    renderCard(buildPattern(150, 50))
    const card = document.querySelector('[data-card="train-after-rest"]')
    expect(card.getAttribute('data-tar-rebound-ratio')).toBe('1.5')
    expect(card.getAttribute('data-tar-mean-post-rest-tss')).toBe('150')
    expect(card.getAttribute('data-tar-mean-training-day-tss')).toBe('100')
    expect(card.getAttribute('data-tar-post-rest-count')).toBe('12')
  })
})
