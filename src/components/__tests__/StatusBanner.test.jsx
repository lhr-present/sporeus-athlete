// @vitest-environment jsdom
// ─── src/components/__tests__/StatusBanner.test.jsx ───────────────────────────
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  rpc:     vi.fn(),
  isReady: vi.fn(() => true),
}))

vi.mock('../../lib/supabase.js', () => ({
  supabase:        { rpc: mocks.rpc },
  isSupabaseReady: mocks.isReady,
}))

import StatusBanner from '../StatusBanner.jsx'

// ── Fixtures ──────────────────────────────────────────────────────────────────
const ALL_OK = [
  { service: 'supabase_api',  status: 'ok',      latency_ms: 42,  checked_at: new Date().toISOString(), stale: false },
  { service: 'strava_api',    status: 'ok',      latency_ms: 80,  checked_at: new Date().toISOString(), stale: false },
  { service: 'anthropic_api', status: 'ok',      latency_ms: 120, checked_at: new Date().toISOString(), stale: false },
]

const ONE_DEGRADED = [
  { service: 'supabase_api',  status: 'ok',       latency_ms: 42,  checked_at: new Date().toISOString(), stale: false },
  { service: 'anthropic_api', status: 'degraded',  latency_ms: 900, checked_at: new Date().toISOString(), stale: false },
]

const ONE_DOWN = [
  { service: 'supabase_api',  status: 'ok',   latency_ms: 42, checked_at: new Date().toISOString(), stale: false },
  { service: 'strava_api',    status: 'down',  latency_ms: null, checked_at: new Date().toISOString(), stale: false },
]

const WITH_STALE = [
  { service: 'strava_api', status: 'degraded', latency_ms: 500, checked_at: new Date().toISOString(), stale: true },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isReady.mockReturnValue(true)
})

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('StatusBanner', () => {
  it('renders nothing when all services are ok', async () => {
    mocks.rpc.mockResolvedValue({ data: ALL_OK, error: null })
    const { container } = renderWithLang(<StatusBanner />)
    // Optimistically null — no banner until RPC resolves
    expect(container.firstChild).toBeNull()
    // Even after RPC resolves, should still be null
    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('get_system_status')
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when Supabase is not ready', async () => {
    mocks.isReady.mockReturnValue(false)
    const { container } = renderWithLang(<StatusBanner />)
    expect(container.firstChild).toBeNull()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('shows banner for a degraded service', async () => {
    mocks.rpc.mockResolvedValue({ data: ONE_DEGRADED, error: null })
    renderWithLang(<StatusBanner />)

    await waitFor(() => {
      expect(screen.getByTestId('status-banner')).toBeInTheDocument()
    })

    const banner = screen.getByTestId('status-banner')
    expect(banner).toHaveAttribute('data-status', 'degraded')
    expect(banner.textContent).toMatch(/ai features/i)
  })

  it('shows banner for a down service', async () => {
    mocks.rpc.mockResolvedValue({ data: ONE_DOWN, error: null })
    renderWithLang(<StatusBanner />)

    await waitFor(() => {
      expect(screen.getByTestId('status-banner')).toBeInTheDocument()
    })

    const banner = screen.getByTestId('status-banner')
    expect(banner).toHaveAttribute('data-status', 'down')
    expect(banner.textContent).toMatch(/strava/i)
  })

  it('marks data-status="down" when any service is down, even alongside degraded', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { service: 'strava_api',    status: 'down',     latency_ms: null, checked_at: new Date().toISOString(), stale: false },
        { service: 'anthropic_api', status: 'degraded', latency_ms: 800,  checked_at: new Date().toISOString(), stale: false },
      ],
      error: null,
    })
    renderWithLang(<StatusBanner />)

    await waitFor(() => {
      expect(screen.getByTestId('status-banner')).toHaveAttribute('data-status', 'down')
    })
  })

  it('shows stale indicator when a row has stale=true', async () => {
    mocks.rpc.mockResolvedValue({ data: WITH_STALE, error: null })
    renderWithLang(<StatusBanner />)

    await waitFor(() => {
      expect(screen.getByTestId('status-banner')).toBeInTheDocument()
    })

    expect(screen.getByTestId('status-banner').textContent).toMatch(/stale/i)
  })

  it('silently hides banner on RPC error (non-fatal)', async () => {
    mocks.rpc.mockRejectedValue(new Error('network error'))
    const { container } = renderWithLang(<StatusBanner />)

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalled()
    })
    // Should not throw or show a banner
    expect(container.firstChild).toBeNull()
  })

  it('has role="alert" and aria-live="polite" on the banner element', async () => {
    mocks.rpc.mockResolvedValue({ data: ONE_DOWN, error: null })
    renderWithLang(<StatusBanner />)

    await waitFor(() => {
      const banner = screen.getByTestId('status-banner')
      expect(banner).toHaveAttribute('role', 'alert')
      expect(banner).toHaveAttribute('aria-live', 'polite')
    })
  })
})
