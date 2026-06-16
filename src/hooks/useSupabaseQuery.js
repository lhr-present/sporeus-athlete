// ─── useSupabaseQuery.js — Stale-while-revalidate Supabase query hook ────────
// Wraps useAsync with:
//   • Auto-retry once on network error (ERR_NETWORK, TypeError, fetch failed)
//   • Stale-while-revalidate: returns cached data while refetching (staleTimeMs)
//   • Returns +{ refetch } in addition to useAsync's return value
//
// queryFn: async (signal) => data  — should call supabase and return data
// deps:    dependency array; changes trigger refetch
// options: { staleTimeMs = 30000, onError }
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useRef, useEffect } from 'react'
import { useAsync } from './useAsync.js'

export const NETWORK_PATTERNS = ['networkerror', 'failed to fetch', 'err_network', 'load failed']

export function isNetworkError(err) {
  const msg = (err?.message || '').toLowerCase()
  return err instanceof TypeError || NETWORK_PATTERNS.some(p => msg.includes(p))
}

// Default backoff before the single network-error retry (ms). Exported so tests
// can override it (e.g. 0) without faking timers.
export const RETRY_DELAY_MS = 800

/**
 * Run `queryFn(signal)`, retrying ONCE on a network error after `delayMs`.
 * This is the real wrapper used by useSupabaseQuery (wrappedFn) — extracted so
 * its retry semantics are tested against the real implementation, not a replica.
 *  • non-network errors: rethrow immediately (no retry)
 *  • network errors: wait delayMs, bail if the signal aborted, else retry once
 */
export async function withNetworkRetry(queryFn, signal, delayMs = RETRY_DELAY_MS) {
  try {
    return await queryFn(signal)
  } catch (err) {
    if (isNetworkError(err)) {
      if (delayMs > 0) await new Promise(res => setTimeout(res, delayMs))
      if (signal?.aborted) throw err
      return await queryFn(signal)
    }
    throw err
  }
}

export function useSupabaseQuery(queryFn, deps = [], options = {}) {
  const { staleTimeMs = 30000, onError } = options

  const cacheRef    = useRef(null) // { data, timestamp }
  const [stale, setStale] = useState(null) // stale data shown during refetch

  // Auto-retry once on network error (real wrapper extracted as withNetworkRetry)
  const wrappedFn = useCallback(
    (signal) => withNetworkRetry(queryFn, signal),
    deps,
  ) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading, error, execute, reset } = useAsync(wrappedFn, deps, { immediate: false, onError })

  // Prime from cache on mount / dep change
  useEffect(() => {
    const now = Date.now()
    if (cacheRef.current && now - cacheRef.current.timestamp < staleTimeMs) {
      setStale(cacheRef.current.data)
    }
    execute()
  }, [execute]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update cache on fresh data
  useEffect(() => {
    if (data != null) {
      cacheRef.current = { data, timestamp: Date.now() }
      setStale(null)
    }
  }, [data])

  const refetch = useCallback(() => execute(), [execute])

  return {
    data: data ?? stale,  // return stale while refetching
    loading,
    error,
    refetch,
    reset,
    isStale: stale != null && data == null,
  }
}
