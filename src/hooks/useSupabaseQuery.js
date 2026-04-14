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

export function useSupabaseQuery(queryFn, deps = [], options = {}) {
  const { staleTimeMs = 30000, onError } = options

  const cacheRef    = useRef(null) // { data, timestamp }
  const [stale, setStale] = useState(null) // stale data shown during refetch

  const wrappedFn = useCallback(async (signal) => {
    try {
      return await queryFn(signal)
    } catch (err) {
      // Auto-retry once on network error
      if (isNetworkError(err)) {
        await new Promise(res => setTimeout(res, 800))
        if (signal.aborted) throw err
        return await queryFn(signal)
      }
      throw err
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

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
