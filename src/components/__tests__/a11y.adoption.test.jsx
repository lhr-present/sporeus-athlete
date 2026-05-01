// @vitest-environment jsdom
// ─── a11y.adoption.test.jsx ──────────────────────────────────────────────────
// Verifies that the announce() helper from src/lib/a11y/announcer.js is wired
// into the key user-action moments: modal open, save success, urgent banners,
// and network/Supabase error paths.
// ────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// ── Mocks ────────────────────────────────────────────────────────────────────
// announce() is the integration boundary — spy on it from every consumer.
const announceMock = vi.fn()
vi.mock('../../lib/a11y/announcer.js', () => ({
  announce: (...args) => announceMock(...args),
  init:     vi.fn(),
  destroy:  vi.fn(),
}))

// Stub focus trap (calls DOM APIs that aren't worth setting up here).
vi.mock('../../hooks/useFocusTrap.js', () => ({ useFocusTrap: vi.fn() }))

// QuickAddModal-specific mocks (mirror src/components/__tests__/QuickAddModal.test.jsx).
vi.mock('../../lib/notificationCenter.js', () => ({ addNotification: vi.fn() }))
vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({ log: [], recovery: [], setRecovery: vi.fn() }),
}))

// SemanticSearch needs a controllable supabase + subscription gate.
const supabaseMocks = vi.hoisted(() => ({
  invoke:  vi.fn(),
  isReady: vi.fn(() => true),
  isGated: vi.fn(() => false),
}))
vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: supabaseMocks.isReady,
  supabase:        { functions: { invoke: supabaseMocks.invoke } },
}))
vi.mock('../../lib/subscription.js', async () => {
  // Keep the real isPastDue/isCancelled/isOnTrial/daysUntilExpiry helpers
  // (PastDueBanner depends on them) and override only the gating predicate.
  const actual = await vi.importActual('../../lib/subscription.js')
  return { ...actual, isFeatureGated: supabaseMocks.isGated }
})
vi.mock('../../lib/telemetry.js', () => ({ trackEvent: vi.fn() }))

// ── Imports under test (after mocks!) ────────────────────────────────────────
import MorningCheckIn from '../MorningCheckIn.jsx'
import QuickAddModal  from '../QuickAddModal.jsx'
import PastDueBanner  from '../PastDueBanner.jsx'
import SemanticSearch from '../SemanticSearch.jsx'

beforeEach(() => {
  vi.clearAllMocks()
  supabaseMocks.isReady.mockReturnValue(true)
  supabaseMocks.isGated.mockReturnValue(false)
  // sessionStorage is shared across tests in jsdom — reset the dismiss flag.
  try { sessionStorage.removeItem('sporeus-pastdue-dismissed') } catch { /* ignore */ }
})

// ─────────────────────────────────────────────────────────────────────────────
describe('a11y adoption — modal open announcements', () => {
  it('announces when MorningCheckIn opens (polite, EN)', () => {
    renderWithLang(<MorningCheckIn onClose={vi.fn()} />)
    expect(announceMock).toHaveBeenCalledWith('Morning check-in opened', 'polite')
  })

  it('does not re-announce on rerender — only on mount', () => {
    const { rerender } = renderWithLang(<MorningCheckIn onClose={vi.fn()} />)
    expect(announceMock).toHaveBeenCalledTimes(1)
    rerender(<MorningCheckIn onClose={vi.fn()} />)
    expect(announceMock).toHaveBeenCalledTimes(1)
  })
})

describe('a11y adoption — save success announcements', () => {
  it('announces "Check-in saved" with polite level after MorningCheckIn save', () => {
    renderWithLang(<MorningCheckIn onClose={vi.fn()} />)
    announceMock.mockClear()  // discard the open-announcement
    fireEvent.click(screen.getByRole('button', { name: /^log$/i }))
    expect(announceMock).toHaveBeenCalledWith('Check-in saved', 'polite')
  })

  it('announces "Session logged" with polite level after QuickAddModal save', () => {
    vi.useFakeTimers()
    renderWithLang(
      <QuickAddModal
        onAdd={vi.fn()}
        onClose={vi.fn()}
        profile={{ sport: 'Running' }}
        isFirst={false}
      />,
    )
    act(() => { fireEvent.submit(document.querySelector('form')) })
    expect(announceMock).toHaveBeenCalledWith('Session logged', 'polite')
    vi.useRealTimers()
  })

  it('uses polite (not assertive) for QuickAddModal save success', () => {
    vi.useFakeTimers()
    renderWithLang(
      <QuickAddModal
        onAdd={vi.fn()}
        onClose={vi.fn()}
        profile={{ sport: 'Running' }}
        isFirst={false}
      />,
    )
    act(() => { fireEvent.submit(document.querySelector('form')) })
    const sessionCalls = announceMock.mock.calls.filter(c => /Session logged/i.test(c[0] ?? ''))
    expect(sessionCalls.length).toBeGreaterThan(0)
    sessionCalls.forEach(call => expect(call[1]).toBe('polite'))
    vi.useRealTimers()
  })
})

describe('a11y adoption — urgent (assertive) announcements', () => {
  it('announces past-due banner with assertive level when payment failed', () => {
    const profile = {
      subscription_status:    'past_due',
      subscription_period_end: new Date(Date.now() + 3 * 86400000).toISOString(),
    }
    renderWithLang(<PastDueBanner profile={profile} lang="en" onUpgrade={vi.fn()} />)
    expect(announceMock).toHaveBeenCalled()
    const lastCall = announceMock.mock.calls[announceMock.mock.calls.length - 1]
    expect(lastCall[1]).toBe('assertive')
    expect(lastCall[0]).toMatch(/payment failed/i)
  })

  it('announces cancellation banner with polite level (not urgent)', () => {
    const profile = {
      subscription_status:   'cancelled',
      subscription_end_date: new Date(Date.now() + 5 * 86400000).toISOString(),
    }
    renderWithLang(<PastDueBanner profile={profile} lang="en" onUpgrade={vi.fn()} />)
    expect(announceMock).toHaveBeenCalled()
    const lastCall = announceMock.mock.calls[announceMock.mock.calls.length - 1]
    expect(lastCall[1]).toBe('polite')
  })

  it('does not announce when there is no banner config', () => {
    renderWithLang(<PastDueBanner profile={{}} lang="en" onUpgrade={vi.fn()} />)
    expect(announceMock).not.toHaveBeenCalled()
  })

  it('announces SemanticSearch failure with assertive level', async () => {
    vi.useFakeTimers()
    supabaseMocks.invoke.mockResolvedValue({ data: null, error: { message: 'Network down' } })

    renderWithLang(
      <SemanticSearch
        show={true}
        onClose={vi.fn()}
        onJumpToSession={vi.fn()}
        tier="coach"
        authUser={{ id: 'u1' }}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText(/search sessions by meaning/i), {
      target: { value: 'long aerobic ride' },
    })
    await act(async () => { vi.advanceTimersByTime(400) })
    await act(async () => { await Promise.resolve() })

    const errorCall = announceMock.mock.calls.find(c => /search error|semantic search/i.test(c[0] ?? ''))
    expect(errorCall).toBeDefined()
    expect(errorCall[1]).toBe('assertive')
    vi.useRealTimers()
  })
})

describe('a11y adoption — coverage smoke', () => {
  it('every announce() call passes a non-empty string and a valid level', () => {
    renderWithLang(<MorningCheckIn onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^log$/i }))
    announceMock.mock.calls.forEach(([msg, level]) => {
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(0)
      expect(['polite', 'assertive']).toContain(level)
    })
  })
})
