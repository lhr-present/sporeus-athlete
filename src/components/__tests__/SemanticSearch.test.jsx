// @vitest-environment jsdom
// ─── SemanticSearch.test.jsx — Integration tests for semantic session search ──
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

const mocks = vi.hoisted(() => ({
  invoke:  vi.fn(),
  isReady: vi.fn(() => true),
  isGated: vi.fn(() => false),
}))

vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: mocks.isReady,
  supabase: { functions: { invoke: mocks.invoke } },
}))

vi.mock('../../lib/subscription.js', () => ({
  isFeatureGated: mocks.isGated,
}))

// useFocusTrap calls DOM APIs — stub it
vi.mock('../../hooks/useFocusTrap.js', () => ({ useFocusTrap: vi.fn() }))

import SemanticSearch from '../SemanticSearch.jsx'

const SESSIONS = [
  { session_id: 's1', date: '2026-04-10', type: 'run', duration_min: 60, tss: 65, rpe: 7, notes: 'Great lactate run', similarity: 0.91 },
  { session_id: 's2', date: '2026-04-07', type: 'ride', duration_min: 90, tss: 80, rpe: 6, notes: 'Flat legs but solid power', similarity: 0.78 },
]

const authUser = { id: 'user-123' }

function renderPanel(props = {}) {
  return renderWithLang(
    <SemanticSearch
      show={true}
      onClose={vi.fn()}
      onJumpToSession={vi.fn()}
      tier="coach"
      authUser={authUser}
      {...props}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isReady.mockReturnValue(true)
  mocks.isGated.mockReturnValue(false)
})

describe('SemanticSearch', () => {
  it('renders search input when shown', () => {
    renderPanel()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/search sessions by meaning/i)).toBeInTheDocument()
  })

  it('does not render when show=false', () => {
    renderPanel({ show: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows upgrade prompt for free tier users', () => {
    mocks.isGated.mockReturnValue(true)
    renderPanel({ tier: 'free' })
    expect(screen.getByText(/coach or club plan/i)).toBeInTheDocument()
    // Upgrade link present
    expect(screen.getByText(/upgrade/i)).toBeInTheDocument()
  })

  it('calls embed-query after debounce when query is long enough', async () => {
    vi.useFakeTimers()
    mocks.invoke.mockResolvedValue({ data: { sessions: SESSIONS }, error: null })

    renderPanel()
    const input = screen.getByPlaceholderText(/search sessions by meaning/i)

    fireEvent.change(input, { target: { value: 'flat legs good power' } })

    // Before debounce: not called yet
    expect(mocks.invoke).not.toHaveBeenCalled()

    // Fast-forward debounce (350ms)
    await act(async () => { vi.advanceTimersByTime(400) })

    expect(mocks.invoke).toHaveBeenCalledWith('embed-query', {
      body: { query: 'flat legs good power', k: 8 },
    })

    vi.useRealTimers()
  })

  it('displays session results after successful search', async () => {
    vi.useFakeTimers()
    mocks.invoke.mockResolvedValue({ data: { sessions: SESSIONS }, error: null })

    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/search sessions by meaning/i), {
      target: { value: 'flat legs good power' },
    })
    await act(async () => { vi.advanceTimersByTime(400) })
    await act(async () => { await Promise.resolve() })

    expect(screen.getByText('2026-04-10')).toBeInTheDocument()
    expect(screen.getByText('2026-04-07')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('calls onJumpToSession with session_id when result is clicked', async () => {
    vi.useFakeTimers()
    const onJump = vi.fn()
    mocks.invoke.mockResolvedValue({ data: { sessions: SESSIONS }, error: null })

    renderPanel({ onJumpToSession: onJump })
    fireEvent.change(screen.getByPlaceholderText(/search sessions by meaning/i), {
      target: { value: 'flat legs good power' },
    })
    await act(async () => { vi.advanceTimersByTime(400) })
    await act(async () => { await Promise.resolve() })

    fireEvent.click(screen.getByText('2026-04-10'))
    expect(onJump).toHaveBeenCalledWith('s1')

    vi.useRealTimers()
  })

  it('shows error message on search failure', async () => {
    vi.useFakeTimers()
    mocks.invoke.mockResolvedValue({ data: null, error: { message: 'Search failed' } })

    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/search sessions by meaning/i), {
      target: { value: 'negative split long run' },
    })
    await act(async () => { vi.advanceTimersByTime(400) })
    await act(async () => { await Promise.resolve() })

    expect(screen.getByText(/search failed/i)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('does not call embed-query for short queries (<3 chars)', async () => {
    vi.useFakeTimers()
    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/search sessions by meaning/i), {
      target: { value: 'ru' },
    })
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(mocks.invoke).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
