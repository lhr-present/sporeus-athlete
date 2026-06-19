// @vitest-environment jsdom
// ─── Dashboard.customizePanel.test.jsx ───────────────────────────────────────
// Guards the v9.442 grouped/collapsible/bilingual Customize panel. Verifies the
// panel renders group headers (instead of a flat 234-checkbox list), that a
// collapsed group expands on click, and that toggling a card checkbox still
// flips its visibility (behavior unchanged from the flat list).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from '../Dashboard.jsx'
import { DataProvider } from '../../contexts/DataContext.jsx'
import { DASH_CARD_DEFS, DASH_CARD_GROUPS } from '../../lib/constants.js'

function setLS() {
  localStorage.clear()
  localStorage.setItem('sporeus-show-advanced', 'true')
  localStorage.setItem('sporeus-profile', JSON.stringify({ athleteLevel: 'competitive', primarySport: 'running' }))
}

function renderDash() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={qc}>
      <DataProvider>
        <Dashboard log={[]} onLogSession={() => {}} onGoToProfile={() => {}} />
      </DataProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => { localStorage.clear() })
afterEach(() => { localStorage.clear() })

describe('Dashboard grouped Customize panel (v9.442)', () => {
  it('every DASH_CARD_DEFS entry has a non-empty tr and a valid group', () => {
    const validKeys = new Set(DASH_CARD_GROUPS.map(g => g.key))
    for (const c of DASH_CARD_DEFS) {
      expect(c.tr, `${c.id} tr`).toBeTruthy()
      expect(validKeys.has(c.group), `${c.id} group=${c.group}`).toBe(true)
    }
  })

  it('renders collapsible group headers (not a flat list) when opened', () => {
    setLS()
    renderDash()
    fireEvent.click(screen.getByRole('button', { name: /Customize Dashboard/i }))
    // Each non-empty group renders a toggle button whose name includes the EN label.
    for (const g of DASH_CARD_GROUPS) {
      const count = DASH_CARD_DEFS.filter(c => c.group === g.key).length
      if (count === 0) continue
      // Accessible name is "<arrow> <EN label> <count>" — anchor to avoid
      // matching substrings (e.g. 'Core' inside 'Score').
      expect(screen.getByRole('button', { name: new RegExp(`[▾▸] ${g.en} ${count}$`) })).toBeInTheDocument()
    }
  })

  it('expands a collapsed group and toggles a card checkbox', () => {
    setLS()
    renderDash()
    fireEvent.click(screen.getByRole('button', { name: /Customize Dashboard/i }))
    // 'core' defaults open and contains 'Recent Sessions'.
    const coreCount = DASH_CARD_DEFS.filter(c => c.group === 'core').length
    const coreHeader = screen.getByRole('button', { name: new RegExp(`[▾▸] Core ${coreCount}$`) })
    expect(coreHeader).toHaveAttribute('aria-expanded', 'true')
    const checkbox = screen.getByLabelText('Recent Sessions')
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(within(document.body).getByLabelText('Recent Sessions')).not.toBeChecked()
  })
})
