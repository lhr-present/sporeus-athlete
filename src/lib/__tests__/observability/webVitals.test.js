// @vitest-environment jsdom
// src/lib/__tests__/observability/webVitals.test.js
// E15 — Web Vitals → Plausible pipe tests.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'

// Mock web-vitals module before import
const mockOnCLS  = vi.fn()
const mockOnLCP  = vi.fn()
const mockOnINP  = vi.fn()
const mockOnFCP  = vi.fn()
const mockOnTTFB = vi.fn()

vi.mock('web-vitals', () => ({
  onCLS:  mockOnCLS,
  onLCP:  mockOnLCP,
  onINP:  mockOnINP,
  onFCP:  mockOnFCP,
  onTTFB: mockOnTTFB,
}))

// Import after mock; call initWebVitals once to register all callbacks
const { initWebVitals, trackRouteChange } = await import('../../observability/webVitals.js')

// Register listeners once — idempotent guard means subsequent calls are no-ops
initWebVitals()

// Helper: get the last-registered callback for a mock
function getCallback(mock) {
  const calls = mock.mock.calls
  return calls.length > 0 ? calls[calls.length - 1][0] : null
}

afterEach(() => {
  delete window.plausible
})

describe('initWebVitals — registers listeners', () => {
  it('registers a callback with onLCP', () => {
    expect(mockOnLCP).toHaveBeenCalled()
  })

  it('registers a callback with onCLS', () => {
    expect(mockOnCLS).toHaveBeenCalled()
  })
})

describe('initWebVitals — no plausible', () => {
  it('does not throw when plausible is absent and LCP fires', () => {
    delete window.plausible
    const cb = getCallback(mockOnLCP)
    if (cb) expect(() => cb({ value: 1200 })).not.toThrow()
  })
})

describe('initWebVitals — with plausible', () => {
  beforeAll(() => {
    window.plausible = vi.fn()
  })

  it('fires plausible event for LCP with rating=good at 1500ms', () => {
    window.plausible = vi.fn()
    const cb = getCallback(mockOnLCP)
    if (!cb) return  // skip if listener wasn't registered
    cb({ value: 1500 })
    expect(window.plausible).toHaveBeenCalledWith('web_vital',
      expect.objectContaining({ props: expect.objectContaining({ name: 'LCP', rating: 'good' }) })
    )
  })

  it('fires plausible event for LCP with rating=poor at 5000ms', () => {
    window.plausible = vi.fn()
    const cb = getCallback(mockOnLCP)
    if (!cb) return
    cb({ value: 5000 })
    expect(window.plausible).toHaveBeenCalledWith('web_vital',
      expect.objectContaining({ props: expect.objectContaining({ name: 'LCP', rating: 'poor' }) })
    )
  })

  it('fires plausible event for CLS with value_ms = value × 1000', () => {
    window.plausible = vi.fn()
    const cb = getCallback(mockOnCLS)
    if (!cb) return
    cb({ value: 0.05 })
    expect(window.plausible).toHaveBeenCalledWith('web_vital',
      expect.objectContaining({ props: expect.objectContaining({ name: 'CLS', value_ms: 50, rating: 'good' }) })
    )
  })
})

describe('trackRouteChange', () => {
  it('does not throw when plausible is absent', () => {
    delete window.plausible
    expect(() => trackRouteChange('/log', '/profile')).not.toThrow()
  })

  it('scrubs UUID from route paths', () => {
    window.plausible = vi.fn()
    trackRouteChange('/session/550e8400-e29b-41d4-a716-446655440000', '/log')
    const call = window.plausible.mock.calls[0]
    expect(call[1].props.from).not.toContain('550e8400')
    expect(call[1].props.from).toContain(':id')
  })

  it('fires plausible route_change event with clean paths', () => {
    window.plausible = vi.fn()
    trackRouteChange('/log', '/profile')
    expect(window.plausible).toHaveBeenCalledWith('route_change', {
      props: { from: '/log', to: '/profile' },
    })
  })
})
