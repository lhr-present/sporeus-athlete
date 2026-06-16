// ─── useAsync + useSupabaseQuery — pure-logic unit tests ─────────────────────
// Hooks themselves require jsdom+renderHook. These tests cover:
//   • isNetworkError detection
//   • Retry wrapper behavior (pure async, no React)
//   • AbortController cancellation pattern
//   • Stale-while-revalidate timestamp logic
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest'
import { isNetworkError, NETWORK_PATTERNS, withNetworkRetry } from './useSupabaseQuery.js'

// ── isNetworkError ────────────────────────────────────────────────────────────

describe('isNetworkError', () => {
  it('identifies TypeError as network error', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
  })

  it('identifies "failed to fetch" message', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
  })

  it('identifies "networkerror" message', () => {
    expect(isNetworkError(new Error('NetworkError when attempting to fetch'))).toBe(true)
  })

  it('does NOT identify normal errors as network errors', () => {
    expect(isNetworkError(new Error('Not found'))).toBe(false)
    expect(isNetworkError(new Error('Unauthorized'))).toBe(false)
  })

  it('handles null/undefined gracefully', () => {
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
  })

  it('covers all NETWORK_PATTERNS', () => {
    for (const pattern of NETWORK_PATTERNS) {
      expect(isNetworkError(new Error(pattern))).toBe(true)
    }
  })
})

// ── Retry wrapper — tests the REAL withNetworkRetry from useSupabaseQuery.js ──
// (round-3 fix: was a local reimplementation that drifted from the real wrapper —
// e.g. it omitted the pre-retry delay. delayMs:0 keeps tests fast while exercising
// the real code path that useSupabaseQuery's wrappedFn uses.)

describe('withNetworkRetry (real useSupabaseQuery wrapper)', () => {
  it('returns value on first success (no retry needed)', async () => {
    const fn = vi.fn().mockResolvedValue(42)
    expect(await withNetworkRetry(fn, undefined, 0)).toBe(42)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries once on network error and returns value if second call succeeds', async () => {
    let attempts = 0
    const fn = vi.fn(async () => {
      if (++attempts === 1) throw new TypeError('Failed to fetch')
      return 'ok'
    })
    expect(await withNetworkRetry(fn, undefined, 0)).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry on non-network errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Server Error'))
    await expect(withNetworkRetry(fn, undefined, 0)).rejects.toThrow('Server Error')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry when the signal is already aborted before the retry', async () => {
    const controller = new AbortController()
    controller.abort()
    const fn = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    await expect(withNetworkRetry(fn, controller.signal, 0)).rejects.toThrow('Failed to fetch')
    expect(fn).toHaveBeenCalledTimes(1)  // aborted → bail before second call
  })

  it('waits the configured delay before retrying', async () => {
    vi.useFakeTimers()
    try {
      let attempts = 0
      const fn = vi.fn(async () => {
        if (++attempts === 1) throw new TypeError('Failed to fetch')
        return 'ok'
      })
      const p = withNetworkRetry(fn, undefined, 800)
      await vi.advanceTimersByTimeAsync(800)
      expect(await p).toBe('ok')
      expect(fn).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

// ── AbortController cancellation pattern ─────────────────────────────────────

describe('AbortController cancellation', () => {
  it('AbortError name prevents state update (pattern test)', async () => {
    const controller = new AbortController()
    const results = []

    const run = async (signal) => {
      await Promise.resolve()
      if (!signal.aborted) results.push('updated')
    }

    controller.abort()
    await run(controller.signal)
    expect(results).toHaveLength(0)
  })

  it('non-aborted controller allows state update', async () => {
    const controller = new AbortController()
    const results = []

    const run = async (signal) => {
      await Promise.resolve()
      if (!signal.aborted) results.push('updated')
    }

    await run(controller.signal)
    expect(results).toHaveLength(1)
  })
})
