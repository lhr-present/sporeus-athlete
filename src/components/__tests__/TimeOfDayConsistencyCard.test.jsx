// @vitest-environment jsdom
// ─── TimeOfDayConsistencyCard.test.jsx — render tests ───────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TimeOfDayConsistencyCard from '../dashboard/TimeOfDayConsistencyCard.jsx'

const TODAY = '2026-05-15'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeEntries(times) {
  return times.map((t, i) => ({
    date: addDays(TODAY, -i),
    startTime: t,
  }))
}

function renderCard(log = [], lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <TimeOfDayConsistencyCard log={log} />
    </LangCtx.Provider>
  )
}

describe('TimeOfDayConsistencyCard — empty / insufficient', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when there are fewer than 6 timed entries', () => {
    const log = makeEntries(['07:00', '07:05', '07:10'])
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })
})

describe('TimeOfDayConsistencyCard — band rendering', () => {
  it('renders the TIGHT band with green styling for tightly consistent training', () => {
    const log = makeEntries([
      '07:00', '06:55', '07:05', '07:10', '06:50', '07:00', '07:03', '06:58',
    ])
    renderCard(log)
    const region = screen.getByRole('region', {
      name: /Training time-of-day consistency/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-consistency-band')).toBe('TIGHT')
    const bandLabel = region.querySelector('[data-consistency-band-label]')
    expect(bandLabel).not.toBeNull()
    expect(bandLabel.textContent).toBe('TIGHT')
    // Green color present in the band pill background (jsdom normalises hex → rgb)
    expect(bandLabel.getAttribute('style')).toMatch(/rgb\(91,\s*194,\s*91\)|#5bc25b/i)
    expect(region.textContent).toMatch(/Strong circadian alignment/i)
    // Typical hour rendered as HH:MM with ± min
    const hour = region.querySelector('[data-typical-hour]')
    expect(hour).not.toBeNull()
    expect(hour.textContent).toMatch(/^\d{2}:\d{2}$/)
    const sd = region.querySelector('[data-sd-minutes]')
    expect(sd).not.toBeNull()
    expect(Number(sd.textContent)).toBeGreaterThanOrEqual(0)
    expect(Number(sd.textContent)).toBeLessThan(60)
  })

  it('renders the SCATTERED band with red styling for very scattered training', () => {
    const log = makeEntries([
      '05:00', '12:00', '18:00', '06:00', '20:00', '08:00', '22:00', '07:00',
    ])
    renderCard(log)
    const region = screen.getByRole('region', {
      name: /Training time-of-day consistency/i,
    })
    expect(region.getAttribute('data-consistency-band')).toBe('SCATTERED')
    const bandLabel = region.querySelector('[data-consistency-band-label]')
    expect(bandLabel.textContent).toBe('SCATTERED')
    expect(bandLabel.getAttribute('style')).toMatch(/rgb\(224,\s*48,\s*48\)|#e03030/i)
    expect(region.textContent).toMatch(/anchor training time/i)
  })

  it('data-consistency-band attribute matches the computed band', () => {
    // Moderate spread: ~90 min SD
    const log = makeEntries([
      '05:00', '09:00', '07:30', '05:30', '08:45', '06:00', '08:30', '05:15',
    ])
    renderCard(log)
    const region = screen.getByRole('region', {
      name: /Training time-of-day consistency/i,
    })
    const band = region.getAttribute('data-consistency-band')
    expect(['MODERATE', 'LOOSE']).toContain(band)
    // Color mapping check — MODERATE = blue, LOOSE = orange
    const bandLabel = region.querySelector('[data-consistency-band-label]')
    if (band === 'MODERATE') {
      expect(bandLabel.getAttribute('style')).toMatch(/rgb\(0,\s*100,\s*255\)|#0064ff/i)
    } else {
      expect(bandLabel.getAttribute('style')).toMatch(/rgb\(255,\s*102,\s*0\)|#ff6600/i)
    }
  })
})

describe('TimeOfDayConsistencyCard — bilingual', () => {
  it('renders Turkish heading "ANTRENMAN SAATİ · 4H" when lang=tr', () => {
    const log = makeEntries([
      '07:00', '06:55', '07:05', '07:10', '06:50', '07:00', '07:03', '06:58',
    ])
    renderCard(log, 'tr')
    const region = screen.getByRole('region', {
      name: /Antrenman saati tutarlılığı/i,
    })
    expect(region.textContent).toMatch(/ANTRENMAN SAATİ · 4H/)
    expect(region.textContent).toMatch(/Güçlü sirkadiyen uyum/)
    // Turkish minute unit
    expect(region.textContent).toMatch(/dk/)
  })
})
