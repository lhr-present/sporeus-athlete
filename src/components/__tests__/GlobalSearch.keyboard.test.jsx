// @vitest-environment jsdom
// ─── GlobalSearch.keyboard.test.jsx — keyboard nav + a11y tests ─────────────
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// ── Hoist mocks so they can be used inside vi.mock() factories ─────────────
const mocks = vi.hoisted(() => ({
  rpc:       vi.fn(),
  isReady:   vi.fn(() => true),
  announce:  vi.fn(),
}))

vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: mocks.isReady,
  supabase: { rpc: mocks.rpc },
}))

vi.mock('../../lib/a11y/announcer.js', () => ({
  announce: mocks.announce,
  init: vi.fn(),
  destroy: vi.fn(),
}))

// useFocusTrap calls DOM APIs that are noisy in jsdom — keep behavior but spy
vi.mock('../../hooks/useFocusTrap.js', () => ({ useFocusTrap: vi.fn() }))

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

import GlobalSearch from '../GlobalSearch.jsx'

const RESULTS = [
  { kind: 'session',      record_id: 'aaaaaaaa-1111', rank: 0.9, snippet: 'Morning run 12km', date_hint: '2026-04-10' },
  { kind: 'session',      record_id: 'bbbbbbbb-2222', rank: 0.8, snippet: 'Tempo intervals',  date_hint: '2026-04-08' },
  { kind: 'note',         record_id: 'cccccccc-3333', rank: 0.6, snippet: 'Good recovery',    date_hint: '2026-04-09' },
  { kind: 'announcement', record_id: 'dddddddd-4444', rank: 0.5, snippet: 'Team meeting',     date_hint: '2026-04-11' },
]

function openOverlay() {
  // The component listens on window for Ctrl+Shift+F
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'f', ctrlKey: true, shiftKey: true, bubbles: true,
    }))
  })
}

async function renderWithResults(props = {}) {
  mocks.rpc.mockResolvedValue({ data: RESULTS, error: null })
  const onNavigate = vi.fn()
  const utils = renderWithLang(<GlobalSearch onNavigate={onNavigate} {...props} />)
  openOverlay()
  // Wait for dialog
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  const input = screen.getByRole('combobox')
  fireEvent.change(input, { target: { value: 'run' } })
  // Wait for first result to render
  await waitFor(() => {
    expect(screen.getByText('Morning run 12km')).toBeInTheDocument()
  }, { timeout: 1500 })
  return { ...utils, onNavigate, input }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isReady.mockReturnValue(true)
  localStorage.clear()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GlobalSearch — keyboard navigation', () => {
  it('opens via Ctrl+Shift+F shortcut', async () => {
    renderWithLang(<GlobalSearch onNavigate={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    openOverlay()
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })

  it('selectedIndex resets to 0 when results arrive (first option aria-selected)', async () => {
    await renderWithResults()
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('ArrowDown moves selectedIndex forward', async () => {
    const { input } = await renderWithResults()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const options = screen.getAllByRole('option')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')
  })

  it('ArrowUp moves selectedIndex backward', async () => {
    const { input } = await renderWithResults()
    // First go to index 2
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    let options = screen.getAllByRole('option')
    expect(options[2]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    options = screen.getAllByRole('option')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('ArrowDown wraps from last to first', async () => {
    const { input } = await renderWithResults()
    // 4 results — press ArrowDown 3 times to land on last (index 3)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    let options = screen.getAllByRole('option')
    expect(options[3]).toHaveAttribute('aria-selected', 'true')
    // Wrap to first
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('ArrowUp wraps from first to last', async () => {
    const { input } = await renderWithResults()
    // index 0 → ArrowUp wraps to last (3)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    const options = screen.getAllByRole('option')
    expect(options[3]).toHaveAttribute('aria-selected', 'true')
  })

  it('Home jumps to first index', async () => {
    const { input } = await renderWithResults()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Home' })
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('End jumps to last index', async () => {
    const { input } = await renderWithResults()
    fireEvent.keyDown(input, { key: 'End' })
    const options = screen.getAllByRole('option')
    expect(options[3]).toHaveAttribute('aria-selected', 'true')
  })

  it('Enter triggers the selected result and calls onNavigate', async () => {
    const { input, onNavigate } = await renderWithResults()
    // Default selected is index 0 (a session) → routes to 'log'
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNavigate).toHaveBeenCalled()
    // First call routes to 'log' for session kind
    expect(onNavigate.mock.calls[0][0]).toBe('log')
  })

  it('Escape closes the overlay', async () => {
    const { input } = await renderWithResults()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('Ctrl+K re-focuses the search input', async () => {
    const { input } = await renderWithResults()
    // Move focus elsewhere first
    const semanticBtn = screen.getByRole('button', { name: /semantic/i })
    semanticBtn.focus()
    expect(document.activeElement).toBe(semanticBtn)
    fireEvent.keyDown(semanticBtn, { key: 'k', ctrlKey: true })
    expect(document.activeElement).toBe(input)
  })

  it('aria-expanded is true when results are visible', async () => {
    const { input } = await renderWithResults()
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('aria-expanded is false before any results', async () => {
    renderWithLang(<GlobalSearch onNavigate={vi.fn()} />)
    openOverlay()
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const input = screen.getByRole('combobox')
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('aria-controls on input matches listbox id', async () => {
    const { input } = await renderWithResults()
    const listbox = screen.getByRole('listbox')
    expect(input.getAttribute('aria-controls')).toBe(listbox.id)
    expect(listbox.id).toBeTruthy()
  })

  it('aria-selected reflects the highlighted result and updates with ArrowDown', async () => {
    const { input } = await renderWithResults()
    let options = screen.getAllByRole('option')
    expect(options.filter(o => o.getAttribute('aria-selected') === 'true')).toHaveLength(1)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    options = screen.getAllByRole('option')
    const selected = options.filter(o => o.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toBe(options[1])
  })

  it('announce() called with result count when results change', async () => {
    await renderWithResults()
    // The announce mock should have been called with a string containing the count "4"
    const calls = mocks.announce.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const matchedCall = calls.find(([msg, level]) =>
      typeof msg === 'string' && msg.includes('4') && level === 'polite'
    )
    expect(matchedCall).toBeTruthy()
  })

  it('listbox has role="listbox" and an aria-label', async () => {
    await renderWithResults()
    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()
    expect(listbox.getAttribute('aria-label')).toBeTruthy()
  })
})
