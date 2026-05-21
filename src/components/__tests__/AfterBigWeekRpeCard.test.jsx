// @vitest-environment jsdom
// ─── AfterBigWeekRpeCard.test.jsx ────────────────────────────────────────
//
// Surface tests for AfterBigWeekRpeCard:
//   - null gate (analyzer returns null) — n/a here because the analyzer
//     only returns null on unresolvable today and the card resolves today
//     internally; instead we check INSUFFICIENT state renders cleanly,
//   - INSUFFICIENT_DATA state renders,
//   - each band (NORMAL_RECOVERY / PROLONGED_ELEVATION / NO_RPE_RESPONSE),
//   - bilingual EN + TR via LangCtx Provider,
//   - citation footer,
//   - role=region + aria-label accessibility,
//   - chip rendering (up to 3, newest first).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import AfterBigWeekRpeCard from '../dashboard/AfterBigWeekRpeCard.jsx'

const TODAY = '2026-05-20' // Wed → ISO Monday = 2026-05-18

const WEEK_MONDAYS = [
  '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23',
  '2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23',
  '2026-03-30', '2026-04-06', '2026-04-13', '2026-04-20',
  '2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18',
]

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})

afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function sessionInWeek(weekIdx, { tss, rpe, dayOffset = 1 }) {
  const monday = WEEK_MONDAYS[weekIdx]
  const d = new Date(monday + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + dayOffset)
  const entry = { date: d.toISOString().slice(0, 10), type: 'Endurance' }
  if (tss != null) entry.tss = tss
  if (rpe != null) entry.rpe = rpe
  return entry
}

function renderCard(log, lang = 'en') {
  const value = { t: (k) => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <AfterBigWeekRpeCard log={log} />
    </LangCtx.Provider>,
  )
}

// ─── Fixtures ─────────────────────────────────────────────────────────────

// NORMAL_RECOVERY: 3 big weeks, each elevated in week+1 and returning week+2.
const NORMAL_LOG = [
  sessionInWeek(0, { tss: 200, rpe: 6 }),
  sessionInWeek(1, { tss: 200, rpe: 6 }),
  sessionInWeek(2, { tss: 200, rpe: 6 }),
  sessionInWeek(3, { tss: 280, rpe: 6.5 }),
  sessionInWeek(4, { tss: 200, rpe: 7.5 }),
  sessionInWeek(5, { tss: 200, rpe: 6.2 }),
  sessionInWeek(6, { tss: 200, rpe: 6 }),
  sessionInWeek(7, { tss: 280, rpe: 6.5 }),
  sessionInWeek(8, { tss: 200, rpe: 7.5 }),
  sessionInWeek(9, { tss: 200, rpe: 6.2 }),
  sessionInWeek(10, { tss: 200, rpe: 6 }),
  sessionInWeek(11, { tss: 280, rpe: 6.5 }),
  sessionInWeek(12, { tss: 200, rpe: 7.5 }),
  sessionInWeek(13, { tss: 200, rpe: 6.2 }),
  sessionInWeek(14, { tss: 200, rpe: 6 }),
]

// PROLONGED_ELEVATION: week+1 elevated AND week+2 still as much elevated.
const PROLONGED_LOG = [
  sessionInWeek(0, { tss: 200, rpe: 6 }),
  sessionInWeek(1, { tss: 200, rpe: 6 }),
  sessionInWeek(2, { tss: 200, rpe: 6 }),
  sessionInWeek(3, { tss: 280, rpe: 6 }),
  sessionInWeek(4, { tss: 200, rpe: 7 }),
  sessionInWeek(5, { tss: 200, rpe: 7.5 }),
  sessionInWeek(6, { tss: 200, rpe: 6 }),
  sessionInWeek(7, { tss: 280, rpe: 6 }),
  sessionInWeek(8, { tss: 200, rpe: 7 }),
  sessionInWeek(9, { tss: 200, rpe: 7.5 }),
  sessionInWeek(10, { tss: 200, rpe: 6 }),
  sessionInWeek(11, { tss: 280, rpe: 6 }),
  sessionInWeek(12, { tss: 200, rpe: 7 }),
  sessionInWeek(13, { tss: 200, rpe: 7.5 }),
  sessionInWeek(14, { tss: 200, rpe: 6 }),
]

// NO_RPE_RESPONSE: 3 big weeks, RPE stays at 6 throughout.
const NO_RESPONSE_LOG = [
  sessionInWeek(0, { tss: 200, rpe: 6 }),
  sessionInWeek(1, { tss: 200, rpe: 6 }),
  sessionInWeek(2, { tss: 200, rpe: 6 }),
  sessionInWeek(3, { tss: 280, rpe: 6 }),
  sessionInWeek(4, { tss: 200, rpe: 6 }),
  sessionInWeek(5, { tss: 200, rpe: 6 }),
  sessionInWeek(6, { tss: 200, rpe: 6 }),
  sessionInWeek(7, { tss: 280, rpe: 6 }),
  sessionInWeek(8, { tss: 200, rpe: 6 }),
  sessionInWeek(9, { tss: 200, rpe: 6 }),
  sessionInWeek(10, { tss: 200, rpe: 6 }),
  sessionInWeek(11, { tss: 280, rpe: 6 }),
  sessionInWeek(12, { tss: 200, rpe: 6 }),
  sessionInWeek(13, { tss: 200, rpe: 6 }),
  sessionInWeek(14, { tss: 200, rpe: 6 }),
]

// ─── INSUFFICIENT_DATA state ──────────────────────────────────────────────

describe('AfterBigWeekRpeCard — INSUFFICIENT_DATA', () => {
  it('renders the INSUFFICIENT_DATA state for an empty log', () => {
    renderCard([])
    const card = document.querySelector('[data-card="after-big-week-rpe"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    expect(card.getAttribute('data-big-week-count')).toBe('0')
  })

  it('renders the INSUFFICIENT_DATA state for a null log', () => {
    renderCard(null)
    const card = document.querySelector('[data-card="after-big-week-rpe"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
  })

  it('renders no chip group when bigWeeks is empty', () => {
    renderCard([])
    expect(document.querySelector('[data-big-week-chips]')).toBeNull()
  })

  it('renders the INSUFFICIENT hint (EN)', () => {
    renderCard([])
    const hint = document.querySelector('[data-band-hint]')
    expect(hint).not.toBeNull()
    expect(hint.textContent).toMatch(/at least 3 big-volume weeks/i)
  })
})

// ─── NORMAL_RECOVERY band ─────────────────────────────────────────────────

describe('AfterBigWeekRpeCard — NORMAL_RECOVERY band', () => {
  it('renders the NORMAL band attr + label', () => {
    renderCard(NORMAL_LOG)
    const card = document.querySelector('[data-card="after-big-week-rpe"]')
    expect(card.getAttribute('data-band')).toBe('NORMAL_RECOVERY')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('NORMAL')
  })

  it('renders the NORMAL hint (EN)', () => {
    renderCard(NORMAL_LOG)
    const hint = document.querySelector('[data-band-hint]')
    expect(hint.textContent).toMatch(/elevates.*returns by week 2/i)
  })

  it('renders chips for big weeks (≤3)', () => {
    renderCard(NORMAL_LOG)
    const chips = document.querySelectorAll('[data-big-week-chip]')
    expect(chips.length).toBeGreaterThanOrEqual(1)
    expect(chips.length).toBeLessThanOrEqual(3)
  })

  it('exposes meaningful data-mean-rpe-elevation', () => {
    renderCard(NORMAL_LOG)
    const card = document.querySelector('[data-card="after-big-week-rpe"]')
    const elev = Number(card.getAttribute('data-mean-rpe-elevation'))
    expect(elev).toBeGreaterThan(0.05)
  })
})

// ─── PROLONGED_ELEVATION band ─────────────────────────────────────────────

describe('AfterBigWeekRpeCard — PROLONGED_ELEVATION band', () => {
  it('renders the PROLONGED band attr + label', () => {
    renderCard(PROLONGED_LOG)
    const card = document.querySelector('[data-card="after-big-week-rpe"]')
    expect(card.getAttribute('data-band')).toBe('PROLONGED_ELEVATION')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('PROLONGED')
  })

  it('renders the PROLONGED hint (EN)', () => {
    renderCard(PROLONGED_LOG)
    const hint = document.querySelector('[data-band-hint]')
    expect(hint.textContent).toMatch(/not returning by week 2/i)
  })

  it('reports meanRpeReturnAtWeek2 >= meanRpeElevationPct', () => {
    renderCard(PROLONGED_LOG)
    const card = document.querySelector('[data-card="after-big-week-rpe"]')
    const elev = Number(card.getAttribute('data-mean-rpe-elevation'))
    const wk2 = Number(card.getAttribute('data-mean-rpe-week2'))
    expect(wk2).toBeGreaterThanOrEqual(elev)
  })
})

// ─── NO_RPE_RESPONSE band ─────────────────────────────────────────────────

describe('AfterBigWeekRpeCard — NO_RPE_RESPONSE band', () => {
  it('renders the NO_RPE_RESPONSE band attr + label', () => {
    renderCard(NO_RESPONSE_LOG)
    const card = document.querySelector('[data-card="after-big-week-rpe"]')
    expect(card.getAttribute('data-band')).toBe('NO_RPE_RESPONSE')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('NO RESPONSE')
  })

  it('renders the NO_RPE_RESPONSE hint (EN)', () => {
    renderCard(NO_RESPONSE_LOG)
    const hint = document.querySelector('[data-band-hint]')
    expect(hint.textContent).toMatch(/RPE does not change/i)
  })
})

// ─── Turkish (TR) ─────────────────────────────────────────────────────────

describe('AfterBigWeekRpeCard — Turkish', () => {
  it('renders the TR heading and band label when lang=tr', () => {
    renderCard(NORMAL_LOG, 'tr')
    const region = screen.getByRole('region', {
      name: /Büyük hacim haftası sonrası ortalama RPE/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/BÜYÜK HAFTA SONRASI EFOR/)
  })

  it('renders the TR INSUFFICIENT hint', () => {
    renderCard([], 'tr')
    const hint = document.querySelector('[data-band-hint]')
    expect(hint.textContent).toMatch(/Son 16 haftada en az 3 büyük hacim/i)
  })

  it('renders the TR PROLONGED band label', () => {
    renderCard(PROLONGED_LOG, 'tr')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('UZAYAN')
  })

  it('renders TR week labels in chips', () => {
    renderCard(NORMAL_LOG, 'tr')
    const chips = document.querySelectorAll('[data-big-week-chip]')
    expect(chips.length).toBeGreaterThanOrEqual(1)
    // Turkish month abbreviation should appear somewhere.
    const txt = Array.from(chips).map((c) => c.textContent).join(' ')
    expect(txt).toMatch(/Şub|Mar|Nis|May/)
  })
})

// ─── citation ─────────────────────────────────────────────────────────────

describe('AfterBigWeekRpeCard — citation', () => {
  it('renders the citation footer', () => {
    renderCard(NORMAL_LOG)
    const cite = document.querySelector('[data-after-big-week-citation]')
    expect(cite).not.toBeNull()
    expect(cite.textContent).toBe('Halson 2014; Foster 2001')
  })

  it('renders the citation in INSUFFICIENT state too', () => {
    renderCard([])
    const cite = document.querySelector('[data-after-big-week-citation]')
    expect(cite.textContent).toBe('Halson 2014; Foster 2001')
  })
})

// ─── accessibility ────────────────────────────────────────────────────────

describe('AfterBigWeekRpeCard — accessibility', () => {
  it('uses role=region with a bilingual aria-label (EN)', () => {
    renderCard(NORMAL_LOG)
    const region = document.querySelector('[role="region"][data-card="after-big-week-rpe"]')
    expect(region).not.toBeNull()
    expect(region.getAttribute('aria-label')).toMatch(/Mean RPE pattern after big-volume weeks/i)
  })

  it('uses role=region with a bilingual aria-label (TR)', () => {
    renderCard(NORMAL_LOG, 'tr')
    const region = document.querySelector('[role="region"][data-card="after-big-week-rpe"]')
    expect(region.getAttribute('aria-label')).toMatch(/Büyük hacim haftası sonrası/i)
  })
})

// ─── data attributes ──────────────────────────────────────────────────────

describe('AfterBigWeekRpeCard — data attributes', () => {
  it('exposes data-big-week-count + data-mean-rpe-elevation + data-mean-rpe-week2', () => {
    renderCard(NORMAL_LOG)
    const card = document.querySelector('[data-card="after-big-week-rpe"]')
    expect(card.getAttribute('data-big-week-count')).toBe('3')
    expect(card.getAttribute('data-mean-rpe-elevation')).not.toBeNull()
    expect(card.getAttribute('data-mean-rpe-week2')).not.toBeNull()
  })
})

// ─── chip rendering ──────────────────────────────────────────────────────

describe('AfterBigWeekRpeCard — chip rendering', () => {
  it('renders chip text in "rpe a → b → c" form', () => {
    renderCard(NORMAL_LOG)
    const chip = document.querySelector('[data-big-week-chip]')
    expect(chip).not.toBeNull()
    expect(chip.textContent).toMatch(/rpe \d/)
    // Two arrows expected.
    const arrowCount = (chip.textContent.match(/→/g) || []).length
    expect(arrowCount).toBe(2)
  })

  it('renders at most 3 chips', () => {
    renderCard(NORMAL_LOG)
    const chips = document.querySelectorAll('[data-big-week-chip]')
    expect(chips.length).toBeLessThanOrEqual(3)
  })
})

// ─── console hygiene ──────────────────────────────────────────────────────

describe('AfterBigWeekRpeCard — console hygiene', () => {
  it('renders without console warnings or errors', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderCard(NORMAL_LOG)
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
    errSpy.mockRestore()
  })
})
