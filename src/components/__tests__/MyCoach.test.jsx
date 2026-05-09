// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// ── Supabase mock — chainable query builder ───────────────────────────────────
// Each call to supabase.from(table) returns a fresh builder; tests configure
// outcomes by overriding `mockOutcomes` per (table, method) before render.

const { mockOutcomes, supabaseMock } = vi.hoisted(() => {
  const mockOutcomes = {
    // table: { select: () => Promise<{data,error}>, upsert: ..., update: ... }
  }

  function buildBuilder(table, method, payload) {
    const state = { table, method, payload, filters: {} }
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn((col, val) => { state.filters[col] = val; return chain }),
      single: vi.fn(() => Promise.resolve(resolveOutcome(state))),
      maybeSingle: vi.fn(() => Promise.resolve(resolveOutcome(state))),
    }
    return chain
  }

  function resolveOutcome(state) {
    const fn = mockOutcomes[state.table]?.[state.method]
    if (typeof fn === 'function') return fn(state)
    return { data: null, error: null }
  }

  const supabaseMock = {
    from: vi.fn(table => ({
      select: vi.fn(() => buildBuilder(table, 'select')),
      upsert: vi.fn((payload, opts) => {
        const outcome = mockOutcomes[table]?.upsert?.({ payload, opts }) ?? { data: null, error: null }
        return Promise.resolve(outcome)
      }),
      update: vi.fn(payload => ({
        eq: vi.fn(() => Promise.resolve(
          mockOutcomes[table]?.update?.({ payload }) ?? { data: null, error: null },
        )),
      })),
    })),
  }

  return { mockOutcomes, supabaseMock }
})

vi.mock('../../lib/supabase.js', () => ({ supabase: supabaseMock }))

// SUT imports — must come after mocks
import { CoachConnectionPanel, JoinCoachInput, MyCoachStatus } from '../MyCoach.jsx'

// Helper — reset outcomes between tests
function resetOutcomes() {
  for (const k of Object.keys(mockOutcomes)) delete mockOutcomes[k]
}

// ─────────────────────────────────────────────────────────────────────────────

describe('MyCoach connection components', () => {
  beforeEach(() => {
    resetOutcomes()
    vi.clearAllMocks()
  })

  // ── CoachConnectionPanel routing ───────────────────────────────────────────

  it('CoachConnectionPanel renders JoinCoachInput when athlete has no active coach link', async () => {
    mockOutcomes.coach_athletes = {
      select: () => ({ data: null, error: null }), // no row → no coach
    }
    renderWithLang(<CoachConnectionPanel userId="athlete-1" />)
    await waitFor(() => {
      expect(screen.getByText(/JOIN A COACH/i)).toBeInTheDocument()
    })
    expect(screen.getByPlaceholderText(/SP-/)).toBeInTheDocument()
  })

  it('CoachConnectionPanel renders MyCoachStatus when athlete has an active coach link', async () => {
    mockOutcomes.coach_athletes = {
      select: ({ filters }) => {
        // First call (CoachConnectionPanel): filtering on athlete_id + status
        if (filters.athlete_id && filters.status === 'active') {
          return { data: { id: 'link-1', coach_id: 'coach-1', athlete_id: 'athlete-1', status: 'active' }, error: null }
        }
        return { data: null, error: null }
      },
    }
    mockOutcomes.profiles = {
      select: () => ({ data: { display_name: 'Coach Linus', email: 'l@x.io' }, error: null }),
    }
    renderWithLang(<CoachConnectionPanel userId="athlete-1" />)
    await waitFor(() => {
      expect(screen.getByText(/MY COACH/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Coach Linus/)).toBeInTheDocument()
  })

  // ── MyCoachStatus disconnect path ──────────────────────────────────────────

  it('MyCoachStatus calls onDisconnect after revoking the link', async () => {
    mockOutcomes.coach_athletes = {
      select: () => ({ data: { id: 'link-1', coach_id: 'coach-1', athlete_id: 'a-1', status: 'active' }, error: null }),
      update: () => ({ data: null, error: null }),
    }
    mockOutcomes.profiles = {
      select: () => ({ data: { display_name: 'Coach Linus' }, error: null }),
    }
    const onDisconnect = vi.fn()
    renderWithLang(<MyCoachStatus userId="a-1" onDisconnect={onDisconnect} />)
    const btn = await screen.findByText(/DISCONNECT/i)
    await act(async () => { fireEvent.click(btn) })
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledTimes(1))
  })

  // ── JoinCoachInput input → confirm → done flow ─────────────────────────────

  it('JoinCoachInput rejects when invite code is not found', async () => {
    mockOutcomes.coach_invites = {
      select: () => ({ data: null, error: { message: 'no rows' } }),
    }
    renderWithLang(<JoinCoachInput userId="a-1" onJoined={vi.fn()} />)
    const input = screen.getByPlaceholderText(/SP-/)
    fireEvent.change(input, { target: { value: 'SP-BADCODE1' } })
    const btn = screen.getByText(/LOOK UP/i)
    await act(async () => { fireEvent.click(btn) })
    await waitFor(() => {
      expect(screen.getByText(/Invite code not found/i)).toBeInTheDocument()
    })
  })

  it('JoinCoachInput rejects when invite is revoked', async () => {
    mockOutcomes.coach_invites = {
      select: () => ({
        data: { coach_id: 'coach-1', code: 'SP-REVOKED1', revoked_at: '2026-01-01T00:00:00Z', expires_at: null },
        error: null,
      }),
    }
    renderWithLang(<JoinCoachInput userId="a-1" onJoined={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/SP-/), { target: { value: 'sp-revoked1' } })
    await act(async () => { fireEvent.click(screen.getByText(/LOOK UP/i)) })
    await waitFor(() => {
      expect(screen.getByText(/Invite revoked/i)).toBeInTheDocument()
    })
  })

  it('JoinCoachInput rejects when invite has expired', async () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    mockOutcomes.coach_invites = {
      select: () => ({
        data: { coach_id: 'coach-1', code: 'SP-EXPIRED1', revoked_at: null, expires_at: past },
        error: null,
      }),
    }
    renderWithLang(<JoinCoachInput userId="a-1" onJoined={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/SP-/), { target: { value: 'SP-EXPIRED1' } })
    await act(async () => { fireEvent.click(screen.getByText(/LOOK UP/i)) })
    await waitFor(() => {
      expect(screen.getByText(/Invite expired/i)).toBeInTheDocument()
    })
  })

  it('JoinCoachInput shows confirm stage with coach name on valid lookup', async () => {
    mockOutcomes.coach_invites = {
      select: () => ({
        data: { coach_id: 'coach-1', code: 'SP-VALID0001', revoked_at: null, expires_at: null },
        error: null,
      }),
    }
    mockOutcomes.profiles = {
      select: () => ({ data: { display_name: 'Coach Anna' }, error: null }),
    }
    renderWithLang(<JoinCoachInput userId="a-1" onJoined={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/SP-/), { target: { value: 'SP-VALID0001' } })
    await act(async () => { fireEvent.click(screen.getByText(/LOOK UP/i)) })
    await waitFor(() => {
      expect(screen.getByText(/Coach Anna/)).toBeInTheDocument()
    })
    expect(screen.getByText(/wants to be your coach/i)).toBeInTheDocument()
    expect(screen.getByText(/ACCEPT/i)).toBeInTheDocument()
    expect(screen.getByText(/CANCEL/i)).toBeInTheDocument()
  })

  it('JoinCoachInput accepts → upserts coach_athletes → reaches done stage', async () => {
    mockOutcomes.coach_invites = {
      select: () => ({
        data: { coach_id: 'coach-1', code: 'SP-VALID0002', revoked_at: null, expires_at: null },
        error: null,
      }),
      update: () => ({ data: null, error: null }),
    }
    mockOutcomes.profiles = {
      select: () => ({ data: { display_name: 'Coach Anna' }, error: null }),
    }
    let upsertCalled = false
    mockOutcomes.coach_athletes = {
      upsert: ({ payload }) => {
        upsertCalled = true
        expect(payload.coach_id).toBe('coach-1')
        expect(payload.athlete_id).toBe('athlete-7')
        expect(payload.status).toBe('active')
        return { data: null, error: null }
      },
    }
    const onJoined = vi.fn()
    renderWithLang(<JoinCoachInput userId="athlete-7" onJoined={onJoined} />)
    fireEvent.change(screen.getByPlaceholderText(/SP-/), { target: { value: 'SP-VALID0002' } })
    await act(async () => { fireEvent.click(screen.getByText(/LOOK UP/i)) })
    await screen.findByText(/ACCEPT/i)
    await act(async () => { fireEvent.click(screen.getByText(/ACCEPT/i)) })
    await waitFor(() => {
      expect(screen.getByText(/Connected to Coach Anna/i)).toBeInTheDocument()
    })
    expect(upsertCalled).toBe(true)
  })

  // ── Touch target compliance (Apple HIG 44pt) ───────────────────────────────

  it('JoinCoachInput input + LOOK UP button meet 44pt minimum touch target', () => {
    mockOutcomes.coach_invites = { select: () => ({ data: null, error: null }) }
    renderWithLang(<JoinCoachInput userId="a-1" onJoined={vi.fn()} />)
    const input = screen.getByPlaceholderText(/SP-/)
    const btn = screen.getByText(/LOOK UP/i)
    expect(input.style.minHeight).toBe('44px')
    expect(btn.style.minHeight).toBe('44px')
  })
})
