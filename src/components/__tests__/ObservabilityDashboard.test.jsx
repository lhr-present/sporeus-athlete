// @vitest-environment jsdom
// ─── src/components/__tests__/ObservabilityDashboard.test.jsx ─────────────────
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const chainMock = {
    select:  vi.fn(),
    in:      vi.fn(),
    order:   vi.fn(),
    limit:   vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  // Make the chain methods return themselves so calls can be chained
  chainMock.select.mockReturnValue(chainMock)
  chainMock.in.mockReturnValue(chainMock)
  chainMock.order.mockReturnValue(chainMock)

  const fromMock = vi.fn().mockReturnValue(chainMock)
  const rpcMock  = vi.fn().mockResolvedValue({ data: [], error: null })
  const isReady  = vi.fn(() => true)

  return { fromMock, rpcMock, isReady, chainMock }
})

vi.mock('../../lib/supabase.js', () => ({
  supabase:        { from: mocks.fromMock, rpc: mocks.rpcMock },
  isSupabaseReady: mocks.isReady,
}))

import ObservabilityDashboard from '../admin/ObservabilityDashboard.jsx'

// ── Fixtures ──────────────────────────────────────────────────────────────────
const ADMIN_PROFILE = { role: 'admin' }
const COACH_PROFILE = { role: 'coach' }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isReady.mockReturnValue(true)
  mocks.rpcMock.mockResolvedValue({ data: [], error: null })
  mocks.chainMock.select.mockReturnValue(mocks.chainMock)
  mocks.chainMock.in.mockReturnValue(mocks.chainMock)
  mocks.chainMock.order.mockReturnValue(mocks.chainMock)
  mocks.chainMock.limit.mockResolvedValue({ data: [], error: null })
  mocks.fromMock.mockReturnValue(mocks.chainMock)
})

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ObservabilityDashboard', () => {
  it('blocks non-admin users with access-required message', () => {
    renderWithLang(<ObservabilityDashboard authProfile={COACH_PROFILE} />)
    expect(screen.getByText(/admin access required/i)).toBeInTheDocument()
    expect(screen.queryByTestId('observability-dashboard')).not.toBeInTheDocument()
  })

  it('blocks when authProfile is null', () => {
    renderWithLang(<ObservabilityDashboard />)
    expect(screen.getByText(/admin access required/i)).toBeInTheDocument()
  })

  it('renders main wrapper for admin', () => {
    renderWithLang(<ObservabilityDashboard authProfile={ADMIN_PROFILE} />)
    expect(screen.getByTestId('observability-dashboard')).toBeInTheDocument()
  })

  it('renders OBSERVABILITY DASHBOARD header for admin', () => {
    renderWithLang(<ObservabilityDashboard authProfile={ADMIN_PROFILE} />)
    expect(screen.getByText(/OBSERVABILITY DASHBOARD/i)).toBeInTheDocument()
  })

  it('renders SYSTEM STATUS panel section', async () => {
    renderWithLang(<ObservabilityDashboard authProfile={ADMIN_PROFILE} />)
    await waitFor(() => {
      expect(screen.getByText(/SYSTEM STATUS/i)).toBeInTheDocument()
    })
  })

  it('renders QUEUE DEPTHS panel section', () => {
    renderWithLang(<ObservabilityDashboard authProfile={ADMIN_PROFILE} />)
    expect(screen.getByText(/QUEUE DEPTHS/i)).toBeInTheDocument()
  })

  it('calls get_system_status RPC on mount', async () => {
    renderWithLang(<ObservabilityDashboard authProfile={ADMIN_PROFILE} />)
    await waitFor(() => {
      expect(mocks.rpcMock).toHaveBeenCalledWith('get_system_status')
    })
  })

  it('calls get_funnel_today RPC on mount', async () => {
    renderWithLang(<ObservabilityDashboard authProfile={ADMIN_PROFILE} />)
    await waitFor(() => {
      expect(mocks.rpcMock).toHaveBeenCalledWith('get_funnel_today')
    })
  })

  it('queries queue_metrics table on mount', async () => {
    renderWithLang(<ObservabilityDashboard authProfile={ADMIN_PROFILE} />)
    await waitFor(() => {
      expect(mocks.fromMock).toHaveBeenCalledWith('queue_metrics')
    })
  })

  it('renders with TR lang without crashing', () => {
    renderWithLang(<ObservabilityDashboard authProfile={ADMIN_PROFILE} lang="tr" />)
    expect(screen.getByTestId('observability-dashboard')).toBeInTheDocument()
    expect(screen.getByText(/SİSTEM DURUMU/i)).toBeInTheDocument()
  })
})
