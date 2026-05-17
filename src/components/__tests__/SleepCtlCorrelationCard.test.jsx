// @vitest-environment jsdom
// ─── SleepCtlCorrelationCard.test.jsx ────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SleepCtlCorrelationCard from '../dashboard/SleepCtlCorrelationCard.jsx'

const TODAY = '2026-05-15'

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <SleepCtlCorrelationCard {...props} />
    </LangCtx.Provider>,
  )
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Build a paired log+recovery dataset where sleep + tss covary
 * (`direction = 'up'` → strong positive; `'flat'` → noise / weak).
 */
function buildDataset(n, direction = 'up', preloadDays = 60) {
  const log = []
  const recovery = []
  const firstWindowDate = addDays(TODAY, -(n - 1))

  // Preload BEFORE window starts so CTL is warm.
  for (let i = 1; i <= preloadDays; i++) {
    log.push({ date: addDays(firstWindowDate, -i), tss: 50 })
  }

  for (let i = 0; i < n; i++) {
    const date = addDays(TODAY, -(n - 1 - i))
    let sleep, tss
    if (direction === 'up') {
      sleep = 6 + i * 0.2
      tss   = 40 + i * 10
    } else if (direction === 'flat') {
      sleep = 7 + ((i % 2) ? 0.3 : -0.3)
      tss   = 60
    }
    log.push({ date, tss })
    recovery.push({ date, sleepHrs: sleep })
  }
  return { log, recovery }
}

// Freeze the clock so the trailing 28-day window is deterministic
// (the pure-fn defaults to `new Date()` when no `today` is passed).
beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

// ─── 1. Empty / null states ──────────────────────────────────────────────────
describe('SleepCtlCorrelationCard — null state', () => {
  it('renders nothing without data', () => {
    const { container } = renderCard({ log: [], recovery: [] })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-sleep-ctl-correlation-card]')).toBeNull()
  })
})

// ─── 2. Strong-positive case ─────────────────────────────────────────────────
describe('SleepCtlCorrelationCard — strong-positive band', () => {
  it('renders r value, n, and band=strong for monotonically co-varying data', () => {
    const { log, recovery } = buildDataset(14, 'up')
    renderCard({ log, recovery })

    const region = screen.getByRole('region', {
      name: /Sleep and chronic training load correlation card/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-correlation-band')).toBe('strong')

    // r is shown prominently as a +X.XX figure.
    const rEl = document.querySelector('[data-correlation-r]')
    expect(rEl).not.toBeNull()
    expect(rEl.textContent).toMatch(/^\+0\.[89]\d|^\+1\.00/)

    // n appears in the header strip.
    expect(region.textContent).toMatch(/n = 14/)

    // Interpretation copy reflects strong-positive band.
    const interp = document.querySelector('[data-correlation-interpretation]')
    expect(interp.textContent).toMatch(/Strong positive/i)

    // Citation footer.
    expect(region.textContent).toMatch(/Halson 2014/i)
    expect(region.textContent).toMatch(/Mah 2011/i)
    expect(region.textContent).toMatch(/Walker 2017/i)
  })
})

// ─── 3. Weak / no-signal band ────────────────────────────────────────────────
describe('SleepCtlCorrelationCard — weak band', () => {
  it('renders the weak interpretation and band attribute for uncorrelated data', () => {
    const { log, recovery } = buildDataset(14, 'flat')
    renderCard({ log, recovery })

    const region = screen.getByRole('region', {
      name: /Sleep and chronic training load correlation card/i,
    })
    expect(region.getAttribute('data-correlation-band')).toBe('weak')

    const interp = document.querySelector('[data-correlation-interpretation]')
    expect(interp.textContent).toMatch(/Weak \/ no signal/i)
  })
})

// ─── 4. data-correlation-band test anchor ────────────────────────────────────
describe('SleepCtlCorrelationCard — test anchors', () => {
  it('data-correlation-band matches the computed band', () => {
    const { log, recovery } = buildDataset(14, 'up')
    renderCard({ log, recovery })
    const card = document.querySelector('[data-sleep-ctl-correlation-card]')
    expect(card).not.toBeNull()
    expect(['strong', 'moderate', 'weak'])
      .toContain(card.getAttribute('data-correlation-band'))
    expect(card.getAttribute('data-correlation-band')).toBe('strong')
  })
})

// ─── 5. TR copy ──────────────────────────────────────────────────────────────
describe('SleepCtlCorrelationCard — bilingual', () => {
  it('renders Turkish interpretation copy when lang=tr', () => {
    const { log, recovery } = buildDataset(14, 'up')
    renderCard({ log, recovery }, 'tr')
    const region = screen.getByRole('region', {
      name: /Uyku ve kronik antrenman yükü/i,
    })
    expect(region).toBeInTheDocument()
    const interp = document.querySelector('[data-correlation-interpretation]')
    expect(interp.textContent).toMatch(/Güçlü pozitif/i)
    // Header chrome should also use Turkish "eşli gün" not "paired days".
    expect(region.textContent).toMatch(/eşli gün/i)
  })
})
