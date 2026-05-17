// @vitest-environment jsdom
// ─── HrvAutonomicBalanceCard.test.jsx — render tests for the new card ───────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import HrvAutonomicBalanceCard from '../dashboard/HrvAutonomicBalanceCard.jsx'

const TODAY = '2026-05-15'

function isoMinus(today, days) {
  const ms = new Date(today + 'T00:00:00Z').getTime() - days * 86400000
  return new Date(ms).toISOString().slice(0, 10)
}

// 28 entries ending TODAY, with rmssd produced by `f(i)` where i=0 is oldest.
function makeRecovery(producer, n = 28) {
  const out = []
  for (let i = 0; i < n; i++) {
    out.push({ date: isoMinus(TODAY, n - 1 - i), rmssd: producer(i) })
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
      <HrvAutonomicBalanceCard {...props} />
    </LangCtx.Provider>
  )
}

describe('HrvAutonomicBalanceCard — empty / inadequate', () => {
  it('renders nothing when recovery is empty', () => {
    const { container } = renderCard({ recovery: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when recovery is missing', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when sample is inadequate (< 14 entries in 28d)', () => {
    const sparse = [
      { date: isoMinus(TODAY, 1), rmssd: 50 },
      { date: isoMinus(TODAY, 3), rmssd: 52 },
      { date: isoMinus(TODAY, 5), rmssd: 51 },
      { date: isoMinus(TODAY, 7), rmssd: 49 },
    ]
    const { container } = renderCard({ recovery: sparse })
    expect(container.firstChild).toBeNull()
  })
})

describe('HrvAutonomicBalanceCard — strained render', () => {
  it('renders the strained state with band + citation when 7d mean depressed', () => {
    const recovery = makeRecovery(i => (i < 21 ? 60 : 40))
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /autonomic balance/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-hrv-autonomic-balance-card')).toBe('SYMPATHETIC_STRAINED')
    expect(region.textContent).toMatch(/SYMPATHETIC-STRAINED/)
    expect(region.textContent).toMatch(/Plews & Buchheit 2017/)
  })
})

describe('HrvAutonomicBalanceCard — recovered render', () => {
  it('renders the recovered state when 7d mean elevated with low CV', () => {
    const recovery = makeRecovery(i => (i < 21 ? 45 : 65))
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /autonomic balance/i })
    expect(region.getAttribute('data-hrv-autonomic-balance-card')).toBe('PARASYMPATHETIC_RECOVERED')
    expect(region.textContent).toMatch(/PARASYMPATHETIC-RECOVERED/)
  })
})

describe('HrvAutonomicBalanceCard — data-anchor', () => {
  it('data-hrv-autonomic-balance-card attribute equals the state value', () => {
    // Stable around 55 with mild oscillation → BALANCED
    const recovery = makeRecovery(i => 55 + ((i % 4) - 1.5) * 2)
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /autonomic balance/i })
    expect(region.getAttribute('data-hrv-autonomic-balance-card')).toBe('BALANCED')
    expect(region.textContent).toMatch(/^◈\s*AUTONOMIC BALANCE/)
  })
})

describe('HrvAutonomicBalanceCard — bilingual', () => {
  it('renders Turkish labels when lang=tr', () => {
    const recovery = makeRecovery(i => (i < 21 ? 60 : 40))
    renderCard({ recovery }, 'tr')
    const region = screen.getByRole('region', { name: /otonom denge/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/OTONOM DENGE/)
    expect(region.textContent).toMatch(/SEMPATİK-YORGUN/)
  })
})
