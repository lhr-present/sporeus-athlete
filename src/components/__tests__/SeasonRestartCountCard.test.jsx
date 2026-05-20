// @vitest-environment jsdom
// ─── SeasonRestartCountCard.test.jsx — Card surface tests ────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SeasonRestartCountCard from '../dashboard/SeasonRestartCountCard.jsx'

const TODAY = '2026-05-19'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function activeLog(days = 365) {
  const out = []
  for (let i = 0; i < days; i++) {
    out.push({ date: addDays(TODAY, -i), duration_min: 30, tss: 40 })
  }
  return out
}

function dropDays(log, offsets) {
  const drops = new Set(offsets.map(n => addDays(TODAY, -n)))
  return log.filter(e => !drops.has(e.date))
}

function logWithGaps(starts, length = 8) {
  let log = activeLog()
  for (const s of starts) {
    log = dropDays(log, Array.from({ length }, (_, i) => s + i))
  }
  return log
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
      <SeasonRestartCountCard log={log} />
    </LangCtx.Provider>
  )
}

describe('SeasonRestartCountCard — CONSISTENT band', () => {
  it('renders the CONSISTENT band on a fully-active 365-day log', () => {
    renderCard(activeLog())
    const card = document.querySelector('[data-card="season-restart-count"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-restart-band')).toBe('CONSISTENT')
    expect(card.textContent).toMatch(/CONSISTENT/)
    expect(card.textContent).toMatch(/SEASON RESTARTS/i)
    expect(card.textContent).toMatch(/Year-long consistency/i)
  })

  it('shows 0 restarts in the big stat', () => {
    renderCard(activeLog())
    const card = document.querySelector('[data-card="season-restart-count"]')
    expect(card.getAttribute('data-restart-total')).toBe('0')
    expect(card.textContent).toMatch(/restarts in last 365d/i)
  })

  it('does NOT render restart chips when totalRestarts=0', () => {
    renderCard(activeLog())
    expect(document.querySelector('[data-restart-chip]')).toBeNull()
  })
})

describe('SeasonRestartCountCard — OCCASIONAL_BREAKS band', () => {
  it('renders OCCASIONAL_BREAKS with 2 restarts', () => {
    renderCard(logWithGaps([30, 100]))
    const card = document.querySelector('[data-card="season-restart-count"]')
    expect(card.getAttribute('data-restart-band')).toBe('OCCASIONAL_BREAKS')
    expect(card.textContent).toMatch(/OCCASIONAL BREAKS/)
    expect(card.textContent).toMatch(/manageable/i)
  })

  it('renders restart chips with gap + streak detail', () => {
    renderCard(logWithGaps([30, 100]))
    const chips = document.querySelectorAll('[data-restart-chip]')
    expect(chips.length).toBe(2)
    for (const chip of chips) {
      expect(chip.textContent).toMatch(/after \d+-day gap/i)
      expect(chip.textContent).toMatch(/lasted \d+d/i)
    }
  })
})

describe('SeasonRestartCountCard — FRAGMENTED band', () => {
  it('renders FRAGMENTED with 4 restarts', () => {
    renderCard(logWithGaps([30, 80, 150, 250]))
    const card = document.querySelector('[data-card="season-restart-count"]')
    expect(card.getAttribute('data-restart-band')).toBe('FRAGMENTED')
    expect(card.textContent).toMatch(/FRAGMENTED/)
    expect(card.textContent).toMatch(/keeps fragmenting/i)
  })

  it('caps the recent-restart chip list at 4', () => {
    renderCard(logWithGaps([20, 60, 100, 140, 200, 260]))
    const chips = document.querySelectorAll('[data-restart-chip]')
    expect(chips.length).toBe(4)
  })
})

describe('SeasonRestartCountCard — CHRONIC_RESTART band', () => {
  it('renders CHRONIC_RESTART when totalRestarts > 6', () => {
    renderCard(logWithGaps([20, 50, 80, 110, 140, 200, 260]))
    const card = document.querySelector('[data-card="season-restart-count"]')
    expect(card.getAttribute('data-restart-band')).toBe('CHRONIC_RESTART')
    expect(card.textContent).toMatch(/CHRONIC RESTART/)
    expect(card.textContent).toMatch(/root cause/i)
  })
})

describe('SeasonRestartCountCard — accessibility + citation', () => {
  it('exposes role=region with English aria-label', () => {
    renderCard(activeLog())
    const region = screen.getByRole('region', { name: /Season Restarts/i })
    expect(region).toBeInTheDocument()
  })

  it('uses Turkish aria-label when lang=tr', () => {
    renderCard(activeLog(), 'tr')
    const region = screen.getByRole('region', { name: /Sezon Yeniden Başlangıçları/i })
    expect(region).toBeInTheDocument()
  })

  it('renders the citation footer with both authorities', () => {
    renderCard(activeLog())
    const card = document.querySelector('[data-card="season-restart-count"]')
    expect(card.textContent).toMatch(/Hägglund/)
    expect(card.textContent).toMatch(/Gabbett/)
  })

  it('renders the SVG strip labelled for screen readers', () => {
    renderCard(activeLog())
    const strip = document.querySelector('[data-restart-strip]')
    expect(strip).not.toBeNull()
    expect(strip.getAttribute('aria-label')).toMatch(/12-month/i)
  })
})

describe('SeasonRestartCountCard — Turkish locale', () => {
  it('renders Turkish heading + band label for CONSISTENT', () => {
    renderCard(activeLog(), 'tr')
    const card = document.querySelector('[data-card="season-restart-count"]')
    expect(card.textContent).toMatch(/SEZON YENİDEN BAŞLANGIÇLARI/)
    expect(card.textContent).toMatch(/TUTARLI/)
    expect(card.textContent).toMatch(/Yıl boyu tutarlı/)
  })

  it('renders Turkish FRAGMENTED band + interpretation', () => {
    renderCard(logWithGaps([30, 80, 150, 250]), 'tr')
    const card = document.querySelector('[data-card="season-restart-count"]')
    expect(card.getAttribute('data-restart-band')).toBe('FRAGMENTED')
    expect(card.textContent).toMatch(/PARÇALI/)
    expect(card.textContent).toMatch(/parçalanıyor/i)
  })

  it('renders Turkish restart chip detail', () => {
    renderCard(logWithGaps([30]), 'tr')
    const chip = document.querySelector('[data-restart-chip]')
    expect(chip).not.toBeNull()
    expect(chip.textContent).toMatch(/ara sonrası/)
    expect(chip.textContent).toMatch(/sürdü/)
  })
})

describe('SeasonRestartCountCard — strip rendering', () => {
  it('renders 365 cells in the activity strip', () => {
    renderCard(activeLog())
    const cells = document.querySelectorAll('[data-strip-kind]')
    expect(cells.length).toBe(365)
  })

  it('marks restart days with data-strip-kind="restart"', () => {
    renderCard(logWithGaps([30]))
    const restartCells = document.querySelectorAll('[data-strip-kind="restart"]')
    expect(restartCells.length).toBe(1)
  })
})

describe('SeasonRestartCountCard — best-streak badge', () => {
  it('shows the best-streak-after-restart number', () => {
    renderCard(logWithGaps([100])) // single gap 100..107, restart at -99, ~100 days streak
    const card = document.querySelector('[data-card="season-restart-count"]')
    expect(card.getAttribute('data-restart-longest-streak')).toBe('100')
    expect(card.textContent).toMatch(/Best streak after restart: 100 days/i)
  })

  it('hides the longest-gap chip when longestGap=0', () => {
    renderCard(activeLog())
    expect(document.querySelector('[data-longest-gap]')).toBeNull()
  })

  it('shows the longest-gap chip when there are gaps', () => {
    renderCard(logWithGaps([30, 100]))
    const longest = document.querySelector('[data-longest-gap]')
    expect(longest).not.toBeNull()
    expect(longest.textContent).toMatch(/Longest gap/i)
  })
})
