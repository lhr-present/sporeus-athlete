// @vitest-environment jsdom
// ─── RaceEquipmentChecklistCard.test.jsx — Batch 11 card render tests ────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RaceEquipmentChecklistCard from '../dashboard/RaceEquipmentChecklistCard.jsx'

const TODAY = '2026-05-17'
const STORAGE_KEY = 'sporeus-raceEquipmentChecks'

function isoOffset(days) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.setSystemTime(new Date())
})

function renderCard(profile = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <RaceEquipmentChecklistCard profile={profile} />
    </LangCtx.Provider>
  )
}

describe('RaceEquipmentChecklistCard — render gating', () => {
  it('renders nothing when there is no race date on the profile', () => {
    const { container } = renderCard({ primarySport: 'Running' })
    expect(container.querySelector('[data-race-equipment-checklist-card]')).toBeNull()
  })

  it('renders nothing when race is more than 7 days out', () => {
    const { container } = renderCard({
      primarySport: 'Running',
      raceDate: isoOffset(10),
    })
    expect(container.querySelector('[data-race-equipment-checklist-card]')).toBeNull()
  })

  it('renders nothing when race is in the past', () => {
    const { container } = renderCard({
      primarySport: 'Running',
      raceDate: isoOffset(-2),
    })
    expect(container.querySelector('[data-race-equipment-checklist-card]')).toBeNull()
  })
})

describe('RaceEquipmentChecklistCard — sport-specific items', () => {
  it('renders the running checklist when primarySport=Running', () => {
    renderCard({ primarySport: 'Running', raceDate: isoOffset(3) })
    const region = screen.getByRole('region', { name: /Race equipment checklist/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-race-equipment-checklist-card')).toBe('run')
    expect(region.getAttribute('data-days-to-race')).toBe('3')
    // running essentials present
    expect(document.querySelector('[data-item-id="race-singlet"]')).not.toBeNull()
    expect(document.querySelector('[data-item-id="race-shoes"]')).not.toBeNull()
    // cycling / transition absent
    expect(document.querySelector('[data-item-id="helmet"]')).toBeNull()
    expect(document.querySelector('[data-item-id="transitionBag"]')).toBeNull()
  })

  it('renders more items for triathlon than for running (union + transition)', () => {
    const { unmount } = renderCard({ primarySport: 'Running', raceDate: isoOffset(4) })
    const runCount = document.querySelectorAll('[data-item-id]').length
    unmount()
    cleanup()
    renderCard({ primarySport: 'Triathlon', raceDate: isoOffset(4) })
    const triCount = document.querySelectorAll('[data-item-id]').length
    expect(triCount).toBeGreaterThan(runCount)
    // transition-only items present for triathlon
    expect(document.querySelector('[data-item-id="transitionBag"]')).not.toBeNull()
    expect(document.querySelector('[data-item-id="bike"]')).not.toBeNull()
    expect(document.querySelector('[data-item-id="helmet"]')).not.toBeNull()
  })
})

describe('RaceEquipmentChecklistCard — checkbox interaction + persistence', () => {
  it('clicking a checkbox updates data-items-checked + persists to localStorage', () => {
    renderCard({ primarySport: 'Running', raceDate: isoOffset(2) })
    const region = screen.getByRole('region', { name: /Race equipment checklist/i })
    expect(region.getAttribute('data-items-checked')).toBe('0')

    const row = document.querySelector('[data-item-id="race-shoes"]')
    expect(row).not.toBeNull()
    const cb = row.querySelector('input[type="checkbox"]')
    fireEvent.click(cb)

    // anchor updated
    expect(region.getAttribute('data-items-checked')).toBe('1')
    // row marked
    expect(row.getAttribute('data-item-checked')).toBe('true')
    // localStorage persisted
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored['race-shoes']?.checked).toBe(true)
  })

  it('progress bar aria-valuenow tracks the checked count', () => {
    renderCard({ primarySport: 'Cycling', raceDate: isoOffset(5) })
    const region = screen.getByRole('region', { name: /Race equipment checklist/i })
    const total = Number(region.getAttribute('data-items-total'))
    expect(total).toBeGreaterThan(0)

    const progress = screen.getByRole('progressbar')
    expect(progress.getAttribute('aria-valuenow')).toBe('0')
    expect(progress.getAttribute('aria-valuemax')).toBe(String(total))

    // check 2 items
    const helmet = document.querySelector('[data-item-id="helmet"] input[type="checkbox"]')
    const gels = document.querySelector('[data-item-id="gels"] input[type="checkbox"]')
    fireEvent.click(helmet)
    fireEvent.click(gels)

    expect(progress.getAttribute('aria-valuenow')).toBe('2')
    expect(region.getAttribute('data-items-checked')).toBe('2')
  })
})

describe('RaceEquipmentChecklistCard — bilingual labels', () => {
  it('renders Turkish heading when lang=tr', () => {
    renderCard({ primarySport: 'Running', raceDate: isoOffset(3) }, 'tr')
    const region = screen.getByRole('region', { name: /Yarış malzeme listesi/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/YARIŞ MALZEME · T-3 GÜN/)
  })

  it('renders Turkish item labels when lang=tr', () => {
    renderCard({ primarySport: 'Cycling', raceDate: isoOffset(2) }, 'tr')
    const helmetRow = document.querySelector('[data-item-id="helmet"]')
    expect(helmetRow).not.toBeNull()
    expect(helmetRow.textContent).toMatch(/Kask/)
  })
})
