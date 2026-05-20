// @vitest-environment jsdom
// ─── HighRpeBlockCard.test.jsx — Dashboard card surface tests ───────────────
// Covers: CLEAN / OCCASIONAL_BLOCK / REPEAT_BLOCKS / CHRONIC_STRAIN bands,
// EN+TR locale, citation footer, accessibility, block-chip rendering,
// data-attribute anchors.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import HighRpeBlockCard from '../dashboard/HighRpeBlockCard.jsx'

const TODAY = '2026-05-19'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Build a 60-day log; highOffsets is the set of day-offsets (from today) that
// should have RPE >= threshold.
function buildLog({ highOffsets = [], lowRpe = 5, highRpe = 9, windowDays = 60 } = {}) {
  const set = new Set(highOffsets)
  const out = []
  for (let i = 0; i < windowDays; i++) {
    out.push({ date: addDaysStr(TODAY, -i), rpe: set.has(i) ? highRpe : lowRpe })
  }
  return out
}

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <HighRpeBlockCard log={log} />
    </LangCtx.Provider>
  )
}

describe('HighRpeBlockCard — CLEAN state', () => {
  it('renders CLEAN band on a log with no high days', () => {
    renderCard(buildLog())
    const card = document.querySelector('[data-card="high-rpe-block"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-high-rpe-block-band')).toBe('CLEAN')
    expect(card.textContent).toMatch(/CLEAN/)
    expect(card.textContent).toMatch(/HIGH-RPE BLOCKS/i)
  })

  it('shows 0 blocks and 0 high days on a clean log', () => {
    renderCard(buildLog())
    const card = document.querySelector('[data-card="high-rpe-block"]')
    expect(card.getAttribute('data-high-rpe-block-total')).toBe('0')
    expect(card.getAttribute('data-high-rpe-block-longest')).toBe('0')
    expect(card.getAttribute('data-high-rpe-block-total-high-days')).toBe('0')
  })

  it('does NOT render any block chips when blocks.length=0', () => {
    renderCard(buildLog())
    expect(document.querySelector('[data-block-chip]')).toBeNull()
  })
})

describe('HighRpeBlockCard — OCCASIONAL_BLOCK band', () => {
  it('renders OCCASIONAL_BLOCK when there is one 3-day block', () => {
    renderCard(buildLog({ highOffsets: [5, 6, 7] }))
    const card = document.querySelector('[data-card="high-rpe-block"]')
    expect(card.getAttribute('data-high-rpe-block-band')).toBe('OCCASIONAL_BLOCK')
    expect(card.textContent).toMatch(/OCCASIONAL BLOCK/)
  })

  it('renders one block chip with the block details', () => {
    renderCard(buildLog({ highOffsets: [5, 6, 7] }))
    const chips = document.querySelectorAll('[data-block-chip]')
    expect(chips.length).toBe(1)
    expect(chips[0].getAttribute('data-block-length')).toBe('3')
    expect(chips[0].getAttribute('data-block-peak-rpe')).toBe('9')
  })
})

describe('HighRpeBlockCard — REPEAT_BLOCKS band', () => {
  it('renders REPEAT_BLOCKS when there are 2 blocks', () => {
    renderCard(buildLog({ highOffsets: [3, 4, 5, 20, 21, 22] }))
    const card = document.querySelector('[data-card="high-rpe-block"]')
    expect(card.getAttribute('data-high-rpe-block-band')).toBe('REPEAT_BLOCKS')
    expect(card.textContent).toMatch(/REPEAT BLOCKS/)
  })

  it('shows the most-recent block first in the chips list', () => {
    renderCard(buildLog({ highOffsets: [3, 4, 5, 20, 21, 22] }))
    const chips = document.querySelectorAll('[data-block-chip]')
    expect(chips.length).toBe(2)
    // Most-recent block (end = -3) appears first because of .reverse() in render.
    expect(chips[0].getAttribute('data-block-end')).toBe(addDaysStr(TODAY, -3))
    expect(chips[1].getAttribute('data-block-end')).toBe(addDaysStr(TODAY, -20))
  })
})

describe('HighRpeBlockCard — CHRONIC_STRAIN band', () => {
  it('renders CHRONIC_STRAIN with ≥4 blocks', () => {
    renderCard(buildLog({ highOffsets: [
      3, 4, 5,
      15, 16, 17,
      25, 26, 27,
      40, 41, 42,
    ] }))
    const card = document.querySelector('[data-card="high-rpe-block"]')
    expect(card.getAttribute('data-high-rpe-block-band')).toBe('CHRONIC_STRAIN')
    expect(card.textContent).toMatch(/CHRONIC STRAIN/)
  })

  it('renders CHRONIC_STRAIN on a single 6-day block', () => {
    renderCard(buildLog({ highOffsets: [10, 11, 12, 13, 14, 15] }))
    const card = document.querySelector('[data-card="high-rpe-block"]')
    expect(card.getAttribute('data-high-rpe-block-band')).toBe('CHRONIC_STRAIN')
    expect(card.getAttribute('data-high-rpe-block-longest')).toBe('6')
  })

  it('caps the recent-blocks chip list at 3', () => {
    renderCard(buildLog({ highOffsets: [
      3, 4, 5,
      15, 16, 17,
      25, 26, 27,
      40, 41, 42,
    ] }))
    const chips = document.querySelectorAll('[data-block-chip]')
    expect(chips.length).toBeLessThanOrEqual(3)
    expect(chips.length).toBe(3)
  })
})

describe('HighRpeBlockCard — accessibility + citation', () => {
  it('exposes role=region with the English aria-label', () => {
    renderCard(buildLog())
    const region = screen.getByRole('region', { name: /High-RPE Blocks/i })
    expect(region).toBeInTheDocument()
  })

  it('renders the citation footer (Foster + Halson)', () => {
    renderCard(buildLog())
    const card = document.querySelector('[data-card="high-rpe-block"]')
    expect(card.textContent).toMatch(/Foster 2001/)
    expect(card.textContent).toMatch(/Halson 2014/)
  })

  it('renders the 60-day SVG strip with a labelled aria-label', () => {
    renderCard(buildLog())
    const strip = document.querySelector('[data-high-rpe-block-strip]')
    expect(strip).not.toBeNull()
    expect(strip.getAttribute('aria-label')).toMatch(/60-day high-RPE strip/i)
  })

  it('strip has exactly 60 cells', () => {
    renderCard(buildLog())
    const cells = document.querySelectorAll('[data-strip-kind]')
    expect(cells.length).toBe(60)
  })

  it('cells inside a block are marked data-strip-kind="block"', () => {
    renderCard(buildLog({ highOffsets: [5, 6, 7] }))
    const blockCells = document.querySelectorAll('[data-strip-kind="block"]')
    expect(blockCells.length).toBe(3)
  })

  it('isolated high days are marked data-strip-kind="isolated"', () => {
    renderCard(buildLog({ highOffsets: [10] }))
    const iso = document.querySelectorAll('[data-strip-kind="isolated"]')
    expect(iso.length).toBe(1)
  })
})

describe('HighRpeBlockCard — Turkish locale', () => {
  it('renders the Turkish heading + band label', () => {
    renderCard(buildLog(), 'tr')
    const card = document.querySelector('[data-card="high-rpe-block"]')
    expect(card.textContent).toMatch(/YÜKSEK EFOR BLOKLARI/)
    expect(card.textContent).toMatch(/TEMİZ/)
  })

  it('uses Turkish aria-label when lang=tr', () => {
    renderCard(buildLog(), 'tr')
    const region = screen.getByRole('region', { name: /Yüksek Efor Blokları/i })
    expect(region).toBeInTheDocument()
  })

  it('renders Turkish interpretation for CHRONIC_STRAIN', () => {
    renderCard(buildLog({ highOffsets: [10, 11, 12, 13, 14, 15] }), 'tr')
    const card = document.querySelector('[data-card="high-rpe-block"]')
    expect(card.textContent).toMatch(/KRONİK YÜK/)
    expect(card.textContent).toMatch(/aşırı yüklenme|kronik/i)
  })
})

describe('HighRpeBlockCard — stats row', () => {
  it('reports the high-RPE day count in English', () => {
    renderCard(buildLog({ highOffsets: [5, 6, 7] }))
    const card = document.querySelector('[data-card="high-rpe-block"]')
    expect(card.textContent).toMatch(/3 high-RPE days in last 60/i)
  })

  it('reports the block count text in English', () => {
    renderCard(buildLog({ highOffsets: [5, 6, 7] }))
    const card = document.querySelector('[data-card="high-rpe-block"]')
    expect(card.textContent).toMatch(/1 block/)
  })

  it('uses plural "blocks" for >1 block', () => {
    renderCard(buildLog({ highOffsets: [3, 4, 5, 20, 21, 22] }))
    const card = document.querySelector('[data-card="high-rpe-block"]')
    expect(card.textContent).toMatch(/2 blocks/)
  })
})
