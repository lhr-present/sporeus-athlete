// @vitest-environment jsdom
// ─── src/components/__tests__/MVHealth.test.jsx ───────────────────────────────
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'
import MVHealth from '../admin/MVHealth.jsx'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  rpc:     vi.fn(),
  isReady: vi.fn(() => true),
}))

vi.mock('../../lib/supabase.js', () => ({
  supabase:        { rpc: mocks.rpc },
  isSupabaseReady: mocks.isReady,
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────
const ADMIN_PROFILE  = { role: 'admin' }
const COACH_PROFILE  = { role: 'coach' }

const SAMPLE_ROWS = [
  {
    view_name:    'mv_ctl_atl_daily',
    last_refresh: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    duration_ms:  420,
    row_count:    15000,
    size_pretty:  '1280 kB',
  },
  {
    view_name:    'mv_weekly_load_summary',
    last_refresh: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    duration_ms:  210,
    row_count:    3400,
    size_pretty:  '312 kB',
  },
  {
    view_name:    'mv_squad_readiness',
    last_refresh: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    duration_ms:  1200,
    row_count:    88,
    size_pretty:  '64 kB',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isReady.mockReturnValue(true)
  mocks.rpc.mockResolvedValue({ data: [], error: null })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MVHealth', () => {
  it('shows admin-required message for non-admin', () => {
    renderWithLang(<MVHealth authProfile={COACH_PROFILE} />)
    expect(screen.getByText(/admin access required/i)).toBeInTheDocument()
  })

  it('shows admin-required message when no authProfile', () => {
    renderWithLang(<MVHealth />)
    expect(screen.getByText(/admin access required/i)).toBeInTheDocument()
  })

  it('renders header when admin', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    renderWithLang(<MVHealth authProfile={ADMIN_PROFILE} />)
    await waitFor(() => {
      expect(screen.getByText(/MV HEALTH/i)).toBeInTheDocument()
    })
  })

  it('calls get_mv_health RPC on mount', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    renderWithLang(<MVHealth authProfile={ADMIN_PROFILE} />)
    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('get_mv_health')
    })
  })

  it('renders view rows from RPC data', async () => {
    mocks.rpc.mockResolvedValue({ data: SAMPLE_ROWS, error: null })
    renderWithLang(<MVHealth authProfile={ADMIN_PROFILE} />)
    await waitFor(() => {
      expect(screen.getByText('mv_ctl_atl_daily')).toBeInTheDocument()
      expect(screen.getByText('mv_weekly_load_summary')).toBeInTheDocument()
      expect(screen.getByText('mv_squad_readiness')).toBeInTheDocument()
    })
  })

  it('shows error message on RPC failure', async () => {
    mocks.rpc.mockRejectedValue(new Error('connection refused'))
    renderWithLang(<MVHealth authProfile={ADMIN_PROFILE} />)
    await waitFor(() => {
      expect(screen.getByText(/connection refused/i)).toBeInTheDocument()
    })
  })

  it('refresh button re-calls RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    renderWithLang(<MVHealth authProfile={ADMIN_PROFILE} />)

    // Wait for the initial mount call
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1))

    const btn = screen.getByRole('button', { name: /refresh/i })
    fireEvent.click(btn)

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2))
  })
})
