// ─── useAsync.js — Cancellable async operation hook ──────────────────────────
// useAsync(asyncFn, deps, options?)
//   asyncFn — async function; receives signal (AbortSignal) as first arg
//   deps    — dependency array (like useEffect)
//   options.immediate — run immediately on mount (default: true)
//   options.onError   — optional error handler
// Returns { data, loading, error, execute, reset }
//
// AbortController cancels in-flight requests on unmount or dep change.
// Concurrent invocations are guarded by a "stale" flag so only the latest
// resolution updates state (no race conditions even without AbortSignal support).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react'

export function useAsync(asyncFn, deps = [], options = {}) {
  const { immediate = true, onError } = options

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error,   setError]   = useState(null)

  // Tracks the current "generation" — used to discard stale resolutions
  const genRef        = useRef(0)
  const controllerRef = useRef(null)

  const execute = useCallback(async (...args) => {
    // Cancel any in-flight request from previous invocation
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    const gen = ++genRef.current

    setLoading(true)
    setError(null)

    try {
      const result = await asyncFn(controller.signal, ...args)
      if (gen === genRef.current && !controller.signal.aborted) {
        setData(result)
        setLoading(false)
      }
    } catch (err) {
      if (gen === genRef.current && !controller.signal.aborted && err.name !== 'AbortError') {
        setError(err)
        setLoading(false)
        onError?.(err)
      }
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (immediate) execute()
    return () => {
      controllerRef.current?.abort()
    }
  }, [execute, immediate])

  const reset = useCallback(() => {
    controllerRef.current?.abort()
    setData(null)
    setLoading(false)
    setError(null)
  }, [])

  return { data, loading, error, execute, reset }
}
