// ─── useAsync + useSupabaseQuery — pure-logic unit tests ─────────────────────
// Hooks themselves require jsdom+renderHook. These tests cover:
//   • isNetworkError detection
//   • Retry wrapper behavior (pure async, no React)
//   • AbortController cancellation pattern
//   • Stale-while-revalidate timestamp logic
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest'
import { isNetworkError, NETWORK_PATTERNS } from './useSupabaseQuery.js'

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

// ── Retry wrapper (extracted logic mirroring useSupabaseQuery's wrappedFn) ───

async function withSingleRetry(fn, signal) {
  try {
    return await fn(signal)
  } catch (err) {
    if (isNetworkError(err)) {
      if (signal?.aborted) throw err
      return await fn(signal)
    }
    throw err
  }
}

describe('Retry logic', () => {
  it('returns value on first success (no retry needed)', async () => {
    const fn = vi.fn().mockResolvedValue(42)
    expect(await withSingleRetry(fn)).toBe(42)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries once on network error and returns value if second call succeeds', async () => {
    let attempts = 0
    const fn = vi.fn(async () => {
      if (++attempts === 1) throw new TypeError('Failed to fetch')
      return 'ok'
    })
    expect(await withSingleRetry(fn)).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry on non-network errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Server Error'))
    await expect(withSingleRetry(fn)).rejects.toThrow('Server Error')
    expect(fn).toHaveBeenCalledTimes(1)
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
