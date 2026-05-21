// @vitest-environment jsdom
// ─── PostHardSessionSorenessCard.test.jsx ────────────────────────────────
//
// Surface tests for PostHardSessionSorenessCard:
//   - null gate (analyzer returns null when today unresolvable — n/a here
//     because the card resolves today internally; instead we verify
//     INSUFFICIENT state renders cleanly),
//   - INSUFFICIENT_HARD_DATA state renders,
//   - each band (FAST_RECOVERY / NORMAL / PROLONGED_SORENESS),
//   - bilingual EN + TR via LangCtx Provider,
//   - citation footer,
//   - role=region + aria-label accessibility,
//   - chip rendering (up to 3, newest first).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import PostHardSessionSorenessCard from '../dashboard/PostHardSessionSorenessCard.jsx'

const TODAY = '2026-05-20'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})

afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function dateMinus(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function renderCard(log, recovery, lang = 'en') {
  const value = { t: (k) => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <PostHardSessionSorenessCard log={log} recovery={recovery} />
    </LangCtx.Provider>,
  )
}

// ─── Fixtures ─────────────────────────────────────────────────────────────

function buildPairs(pairs) {
  const log = []
  const recovery = []
  for (const p of pairs) {
    const hardDate = dateMinus(TODAY, p.daysAgo)
    log.push({ date: hardDate, tss: p.tss })
    if (p.soreness != null) {
      const nextDate = dateMinus(TODAY, p.daysAgo - 1)
      recovery.push({ date: nextDate, soreness: p.soreness })
    }
  }
  return { log, recovery }
}

// FAST_RECOVERY: 5 hard events, post-hard soreness ≈ baseline (no elevation)
function fastFixture() {
  const pairs = [
    { daysAgo: 2, tss: 100, soreness: 4 },
    { daysAgo: 8, tss: 100, soreness: 4 },
    { daysAgo: 14, tss: 100, soreness: 4 },
    { daysAgo: 20, tss: 100, soreness: 4 },
    { daysAgo: 26, tss: 100, soreness: 4 },
  ]
  return buildPairs(pairs)
}

// NORMAL: post-hard mean 5 vs baseline 4 → +1.0 elevation
function normalFixture() {
  const { log, recovery } = buildPairs([
    { daysAgo: 2, tss: 100, soreness: 5 },
    { daysAgo: 8, tss: 100, soreness: 5 },
    { daysAgo: 14, tss: 100, soreness: 5 },
    { daysAgo: 20, tss: 100, soreness: 5 },
    { daysAgo: 26, tss: 100, soreness: 5 },
  ])
  for (let i = 0; i < 10; i++) {
    recovery.push({ date: dateMinus(TODAY, 30 + i), soreness: 4 })
  }
  return { log, recovery }
}

// PROLONGED_SORENESS: post-hard mean 7 vs baseline 4 → +3.0 elevation
function prolongedFixture() {
  const { log, recovery } = buildPairs([
    { daysAgo: 2, tss: 100, soreness: 7 },
    { daysAgo: 8, tss: 100, soreness: 7 },
    { daysAgo: 14, tss: 100, soreness: 7 },
    { daysAgo: 20, tss: 100, soreness: 7 },
    { daysAgo: 26, tss: 100, soreness: 7 },
  ])
  for (let i = 0; i < 10; i++) {
    recovery.push({ date: dateMinus(TODAY, 30 + i), soreness: 4 })
  }
  return { log, recovery }
}

// ─── INSUFFICIENT_HARD_DATA state ─────────────────────────────────────────

describe('PostHardSessionSorenessCard — INSUFFICIENT_HARD_DATA', () => {
  it('renders the INSUFFICIENT state for empty inputs', () => {
    renderCard([], [])
    const card = document.querySelector('[data-card="post-hard-session-soreness"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_HARD_DATA')
    expect(card.getAttribute('data-hard-event-count')).toBe('0')
  })

  it('renders INSUFFICIENT hint (EN)', () => {
    renderCard([], [])
    const hint = document.querySelector('[data-band-hint]')
    expect(hint).not.toBeNull()
    expect(hint.textContent).toMatch(/at least 5 hard sessions/i)
  })
})

// ─── FAST_RECOVERY band ───────────────────────────────────────────────────

describe('PostHardSessionSorenessCard — FAST_RECOVERY band', () => {
  it('renders the FAST band attr + label', () => {
    const { log, recovery } = fastFixture()
    renderCard(log, recovery)
    const card = document.querySelector('[data-card="post-hard-session-soreness"]')
    expect(card.getAttribute('data-band')).toBe('FAST_RECOVERY')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('FAST')
  })

  it('renders the FAST hint (EN)', () => {
    const { log, recovery } = fastFixture()
    renderCard(log, recovery)
    const hint = document.querySelector('[data-band-hint]')
    expect(hint.textContent).toMatch(/barely above baseline/i)
  })
})

// ─── NORMAL band ──────────────────────────────────────────────────────────

describe('PostHardSessionSorenessCard — NORMAL band', () => {
  it('renders the NORMAL band attr + label', () => {
    const { log, recovery } = normalFixture()
    renderCard(log, recovery)
    const card = document.querySelector('[data-card="post-hard-session-soreness"]')
    expect(card.getAttribute('data-band')).toBe('NORMAL')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('NORMAL')
  })

  it('exposes a non-zero soreness elevation', () => {
    const { log, recovery } = normalFixture()
    renderCard(log, recovery)
    const card = document.querySelector('[data-card="post-hard-session-soreness"]')
    const elev = Number(card.getAttribute('data-soreness-elevation'))
    expect(elev).toBeGreaterThan(0)
  })

  it('renders chips for events (≤3)', () => {
    const { log, recovery } = normalFixture()
    renderCard(log, recovery)
    const chips = document.querySelectorAll('[data-event-chip]')
    expect(chips.length).toBeGreaterThanOrEqual(1)
    expect(chips.length).toBeLessThanOrEqual(3)
  })
})

// ─── PROLONGED_SORENESS band ──────────────────────────────────────────────

describe('PostHardSessionSorenessCard — PROLONGED_SORENESS band', () => {
  it('renders the PROLONGED band attr + label', () => {
    const { log, recovery } = prolongedFixture()
    renderCard(log, recovery)
    const card = document.querySelector('[data-card="post-hard-session-soreness"]')
    expect(card.getAttribute('data-band')).toBe('PROLONGED_SORENESS')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('PROLONGED')
  })

  it('renders the PROLONGED hint (EN)', () => {
    const { log, recovery } = prolongedFixture()
    renderCard(log, recovery)
    const hint = document.querySelector('[data-band-hint]')
    expect(hint.textContent).toMatch(/markedly elevated soreness/i)
  })

  it('reports sorenessElevation >= 1.5', () => {
    const { log, recovery } = prolongedFixture()
    renderCard(log, recovery)
    const card = document.querySelector('[data-card="post-hard-session-soreness"]')
    expect(Number(card.getAttribute('data-soreness-elevation')))
      .toBeGreaterThanOrEqual(1.5)
  })
})

// ─── Turkish ──────────────────────────────────────────────────────────────

describe('PostHardSessionSorenessCard — Turkish', () => {
  it('renders TR heading and band label when lang=tr (NORMAL band)', () => {
    const { log, recovery } = normalFixture()
    renderCard(log, recovery, 'tr')
    const region = screen.getByRole('region', {
      name: /Sert seans sonrası ağrı/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/SERT SONRASI AĞRI/)
  })

  it('renders TR INSUFFICIENT hint', () => {
    renderCard([], [], 'tr')
    const hint = document.querySelector('[data-band-hint]')
    expect(hint.textContent).toMatch(/en az 5 sert seans/i)
  })

  it('renders TR PROLONGED label', () => {
    const { log, recovery } = prolongedFixture()
    renderCard(log, recovery, 'tr')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('UZAYAN')
  })

  it('renders TR month abbreviations in chips', () => {
    const { log, recovery } = normalFixture()
    renderCard(log, recovery, 'tr')
    const chips = document.querySelectorAll('[data-event-chip]')
    expect(chips.length).toBeGreaterThanOrEqual(1)
    const txt = Array.from(chips).map((c) => c.textContent).join(' ')
    expect(txt).toMatch(/Şub|Mar|Nis|May/)
  })
})

// ─── citation ─────────────────────────────────────────────────────────────

describe('PostHardSessionSorenessCard — citation', () => {
  it('renders the citation footer', () => {
    const { log, recovery } = normalFixture()
    renderCard(log, recovery)
    const cite = document.querySelector('[data-post-hard-soreness-citation]')
    expect(cite).not.toBeNull()
    expect(cite.textContent).toBe('Kellmann 2018; Lemyre 2007')
  })

  it('renders citation in INSUFFICIENT state too', () => {
    renderCard([], [])
    const cite = document.querySelector('[data-post-hard-soreness-citation]')
    expect(cite.textContent).toBe('Kellmann 2018; Lemyre 2007')
  })
})

// ─── accessibility ────────────────────────────────────────────────────────

describe('PostHardSessionSorenessCard — accessibility', () => {
  it('uses role=region with bilingual aria-label (EN)', () => {
    const { log, recovery } = normalFixture()
    renderCard(log, recovery)
    const region = document.querySelector(
      '[role="region"][data-card="post-hard-session-soreness"]',
    )
    expect(region).not.toBeNull()
    expect(region.getAttribute('aria-label'))
      .toMatch(/Day-after-hard soreness pattern/i)
  })

  it('uses role=region with bilingual aria-label (TR)', () => {
    const { log, recovery } = normalFixture()
    renderCard(log, recovery, 'tr')
    const region = document.querySelector(
      '[role="region"][data-card="post-hard-session-soreness"]',
    )
    expect(region.getAttribute('aria-label'))
      .toMatch(/Sert seans sonrası ağrı deseni/i)
  })
})

// ─── data attributes ──────────────────────────────────────────────────────

describe('PostHardSessionSorenessCard — data attributes', () => {
  it('exposes all expected data attributes', () => {
    const { log, recovery } = normalFixture()
    renderCard(log, recovery)
    const card = document.querySelector('[data-card="post-hard-session-soreness"]')
    expect(card.getAttribute('data-hard-event-count')).toBe('5')
    expect(card.getAttribute('data-mean-next-day-soreness')).not.toBeNull()
    expect(card.getAttribute('data-baseline-mean-soreness')).not.toBeNull()
    expect(card.getAttribute('data-soreness-elevation')).not.toBeNull()
  })
})

// ─── chip rendering ──────────────────────────────────────────────────────

describe('PostHardSessionSorenessCard — chip rendering', () => {
  it('renders chip text including TSS and soreness fraction', () => {
    const { log, recovery } = normalFixture()
    renderCard(log, recovery)
    const chip = document.querySelector('[data-event-chip]')
    expect(chip).not.toBeNull()
    expect(chip.textContent).toMatch(/TSS/)
    expect(chip.textContent).toMatch(/\d+\/10/)
  })

  it('renders at most 3 chips', () => {
    const { log, recovery } = normalFixture()
    renderCard(log, recovery)
    const chips = document.querySelectorAll('[data-event-chip]')
    expect(chips.length).toBeLessThanOrEqual(3)
  })

  it('renders no chip group when no events', () => {
    renderCard([], [])
    expect(document.querySelector('[data-event-chips]')).toBeNull()
  })
})

// ─── console hygiene ──────────────────────────────────────────────────────

describe('PostHardSessionSorenessCard — console hygiene', () => {
  it('renders without console warnings or errors', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { log, recovery } = normalFixture()
    renderCard(log, recovery)
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
    errSpy.mockRestore()
  })
})
