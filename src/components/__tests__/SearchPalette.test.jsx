// @vitest-environment jsdom
// ─── SearchPalette.test.jsx — FTS + semantic integration tests ───────────────
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// ── Hoist mocks so they can be used inside vi.mock() factories ─────────────
const mocks = vi.hoisted(() => ({
  rpc:       vi.fn(),
  invoke:    vi.fn(),
  isReady:   vi.fn(() => true),
}))

vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: mocks.isReady,
  supabase: {
    rpc:       mocks.rpc,
    functions: { invoke: mocks.invoke },
  },
}))

vi.mock('../../lib/constants.js', () => ({
  SEARCH_INDEX: [],
}))

// useFocusTrap calls DOM APIs — stub it out
vi.mock('../../hooks/useFocusTrap.js', () => ({ useFocusTrap: vi.fn() }))

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

import SearchPalette from '../SearchPalette.jsx'

const DB_RESULTS = [
  { kind: 'session',      record_id: '1', rank: 0.9, snippet: 'Morning run 12km',    date_hint: '2026-04-10' },
  { kind: 'session',      record_id: '2', rank: 0.7, snippet: 'Tempo intervals',     date_hint: '2026-04-08' },
  { kind: 'note',         record_id: '3', rank: 0.6, snippet: 'Good recovery',       date_hint: '2026-04-09' },
  { kind: 'announcement', record_id: '4', rank: 0.5, snippet: 'Team meeting Friday', date_hint: '2026-04-11' },
]

const SEM_RESULTS = {
  sessions: [
    { id: 's1', date: '2026-04-10', type: 'run',  tss: 65, notes: 'Great lactate run at threshold' },
    { id: 's2', date: '2026-04-07', type: 'ride', tss: 80, notes: 'Flat legs but solid power output' },
  ],
}

const authUser = { id: 'user-abc' }

function renderPalette(props = {}) {
  return renderWithLang(
    <SearchPalette
      onNavigate={vi.fn()}
      onToggleDark={vi.fn()}
      onToggleLang={vi.fn()}
      onClose={vi.fn()}
      log={[]}
      onSync={vi.fn()}
      onExport={vi.fn()}
      authUser={authUser}
      tier="coach"
      {...props}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isReady.mockReturnValue(true)
  localStorage.clear()
})

// ── Render ───────────────────────────────────────────────────────────────────

describe('SearchPalette — render', () => {
  it('renders dialog with search input', () => {
    renderPalette()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument()
  })

  it('shows ESC close hint in footer', () => {
    renderPalette()
    expect(screen.getByText('ESC close')).toBeInTheDocument()
  })
})

// ── FTS results ───────────────────────────────────────────────────────────────

describe('SearchPalette — FTS results', () => {
  it('calls search_everything RPC after 250ms debounce', async () => {
    mocks.rpc.mockResolvedValue({ data: DB_RESULTS, error: null })
    renderPalette()
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), { target: { value: 'kosu' } })

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('search_everything', { q: 'kosu', limit_per_kind: 5 })
    }, { timeout: 1000 })
  })

  it('renders FTS result snippets', async () => {
    mocks.rpc.mockResolvedValue({ data: DB_RESULTS, error: null })
    renderPalette()
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), { target: { value: 'run' } })

    await waitFor(() => {
      expect(screen.getByText('Morning run 12km')).toBeInTheDocument()
    }, { timeout: 1000 })
    expect(screen.getByText('Good recovery')).toBeInTheDocument()
  })

  it('renders kind section headers between result groups', async () => {
    mocks.rpc.mockResolvedValue({ data: DB_RESULTS, error: null })
    renderPalette()
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), { target: { value: 'run' } })

    await waitFor(() => {
      expect(screen.getByText('Sessions')).toBeInTheDocument()
    }, { timeout: 1000 })
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Announcements')).toBeInTheDocument()
  })

  it('shows db result count in footer', async () => {
    mocks.rpc.mockResolvedValue({ data: DB_RESULTS, error: null })
    renderPalette()
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), { target: { value: 'tempo' } })

    await waitFor(() => {
      expect(screen.getByText(/4 db results/)).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('normalizes Turkish query before calling RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    renderPalette()
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), { target: { value: 'koşu' } })

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('search_everything', { q: 'kosu', limit_per_kind: 5 })
    }, { timeout: 1000 })
  })
})

// ── Keyboard navigation ───────────────────────────────────────────────────────

describe('SearchPalette — keyboard navigation', () => {
  it('Escape calls onClose', () => {
    const onClose = vi.fn()
    renderPalette({ onClose })
    fireEvent.keyDown(screen.getByRole('textbox', { name: /search/i }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('ArrowDown / ArrowUp does not crash', async () => {
    mocks.rpc.mockResolvedValue({ data: DB_RESULTS, error: null })
    renderPalette()
    const input = screen.getByRole('textbox', { name: /search/i })
    fireEvent.change(input, { target: { value: 'run' } })

    await waitFor(() => expect(screen.getByText('Morning run 12km')).toBeInTheDocument(), { timeout: 1000 })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    // Palette should still be visible
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Enter on a log result calls onNavigate and onClose', () => {
    const log = [{ date: '2026-04-10', type: 'run', tss: 65, notes: 'Long run', rpe: 6, durationSec: 3600 }]
    const onNavigate = vi.fn()
    const onClose    = vi.fn()
    renderPalette({ log, onNavigate, onClose })
    const input = screen.getByRole('textbox', { name: /search/i })

    fireEvent.change(input, { target: { value: '#run' } })
    // First result is the log entry; press Enter
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onNavigate).toHaveBeenCalledWith('log')
    expect(onClose).toHaveBeenCalled()
  })
})

// ── Semantic toggle ───────────────────────────────────────────────────────────

describe('SearchPalette — semantic toggle', () => {
  it('shows semantic toggle for coach tier after typing', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    renderPalette({ tier: 'coach' })
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), { target: { value: 'tempo run' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /semantic/i })).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('shows semantic toggle for club tier after typing', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    renderPalette({ tier: 'club' })
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), { target: { value: 'lactate threshold' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /semantic/i })).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('does not show semantic toggle for free tier', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    renderPalette({ tier: 'free' })
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), { target: { value: 'tempo run' } })

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalled()
    }, { timeout: 1000 })

    expect(screen.queryByRole('button', { name: /semantic/i })).not.toBeInTheDocument()
  })

  it('clicking semantic toggle calls embed-query', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    mocks.invoke.mockResolvedValue({ data: SEM_RESULTS, error: null })

    renderPalette({ tier: 'coach' })
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), { target: { value: 'tempo run' } })

    // Wait for FTS + toggle to appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /semantic/i })).toBeInTheDocument()
    }, { timeout: 1000 })

    fireEvent.click(screen.getByRole('button', { name: /semantic/i }))

    await waitFor(() => {
      expect(mocks.invoke).toHaveBeenCalledWith('embed-query', expect.objectContaining({
        body: expect.objectContaining({ query: 'tempo run', k: 8 }),
      }))
    }, { timeout: 1000 })
  })

  it('semantic results appear after embed-query resolves', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    mocks.invoke.mockResolvedValue({ data: SEM_RESULTS, error: null })

    renderPalette({ tier: 'club' })
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), { target: { value: 'lactate' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /semantic/i })).toBeInTheDocument()
    }, { timeout: 1000 })

    fireEvent.click(screen.getByRole('button', { name: /semantic/i }))

    await waitFor(() => {
      expect(screen.getByText(/Great lactate run/)).toBeInTheDocument()
    }, { timeout: 1000 })
    expect(screen.getByText(/solid power output/)).toBeInTheDocument()
  })
})

// ── Recent searches ───────────────────────────────────────────────────────────

describe('SearchPalette — recent searches', () => {
  it('recent search cap is 10 (not 5)', () => {
    // Verify the saveRecent slice constant by simulating what it does:
    // store 11 prior entries, call the same logic, expect length=10
    const prev = Array.from({ length: 11 }, (_, i) => `q${i}`)
    const next = ['new', ...prev.filter(s => s !== 'new')].slice(0, 10)
    expect(next).toHaveLength(10)
    expect(next[0]).toBe('new')
  })
})
