// ─── useTrainingLogQuery.js — TanStack Query v5 wrapper for training_log ──────
// Replaces useTrainingLog (useSupabaseData.js) in DataContext.
// Returns [entries, setLog] — identical interface to the old hook.
// Also exposes pagination: fetchNextPage, hasMore, isLoadingMore via array props.
//
// Key behaviours:
//  • initialData from localStorage → no loading flash
//  • Background refetch on window focus / staleTime expiry (30s)
//  • setLog() applies optimistic update to TQ cache + localStorage, then
//    syncs to Supabase and invalidates the query for a server-round-trip
//  • On network failure the TQ cache stays warm and localStorage persists
//  • Pagination: initial load fetches first pageSize rows; fetchNextPage
//    appends next page; hasMore tracks whether more rows exist

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { useLocalStorage } from './useLocalStorage.js'
import { logRowToEntry, logEntryToRow } from './useSupabaseData.js'

export const trainingLogKey = (userId) => ['training_log', userId ?? 'guest']

// Accepts either:
//   useTrainingLogQuery(userId)                   — legacy positional form
//   useTrainingLogQuery({ userId, pageSize })     — new object form
export function useTrainingLogQuery(arg) {
  // Resolve userId and pageSize from either call signature
  let userId, pageSize
  if (arg !== null && typeof arg === 'object') {
    userId   = arg.userId
    pageSize = arg.pageSize ?? 50
  } else {
    userId   = arg         // string | null | undefined
    pageSize = 50
  }

  const [lsData, setLsData] = useLocalStorage('sporeus_log', [])
  const qc = useQueryClient()

  // Pagination state — page index starts at 1 after the initial load
  const pageRef = useRef(1)
  const [allEntries, setAllEntries] = useState(null)  // null = not yet initialised from server
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const { data, isLoading, error, refetch: refetchQuery } = useQuery({
    queryKey: trainingLogKey(userId),
    queryFn: async () => {
      if (!isSupabaseReady() || !userId) return lsData
      const { data: rows, error: qErr } = await supabase
        .from('training_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(0, pageSize - 1)
      if (qErr) throw qErr
      const entries = rows.map(logRowToEntry)
      // Reset pagination cursor on fresh load
      pageRef.current = 1
      setAllEntries(entries)
      setHasMore(rows.length >= pageSize)
      setLsData(entries)
      return entries
    },
    initialData: lsData,
    initialDataUpdatedAt: 0,   // treat localStorage data as stale → fetch immediately
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  })

  // The entries visible to consumers: server-paginated allEntries (when loaded)
  // or the TQ cache / localStorage fallback
  const entries = allEntries ?? data ?? lsData

  const fetchNextPage = useCallback(async () => {
    if (!isSupabaseReady() || !userId || isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const page = pageRef.current
      const from = page * pageSize
      const to   = (page + 1) * pageSize - 1
      const { data: rows, error: qErr } = await supabase
        .from('training_log')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to)
      if (qErr) throw qErr
      const newEntries = rows.map(logRowToEntry)
      pageRef.current = page + 1
      setAllEntries(prev => {
        const merged = [...(prev ?? []), ...newEntries]
        setLsData(merged)
        return merged
      })
      setHasMore(rows.length >= pageSize)
    } catch (_) {
      // Network failure — keep current state, user can retry
    } finally {
      setIsLoadingMore(false)
    }
  }, [userId, pageSize, isLoadingMore, hasMore, setLsData])

  const refetch = useCallback(() => {
    pageRef.current = 1
    setAllEntries(null)
    setHasMore(true)
    return refetchQuery()
  }, [refetchQuery])

  const setLog = useCallback((fnOrValue) => {
    const qKey = trainingLogKey(userId)
    const prev = qc.getQueryData(qKey) ?? []
    const next = typeof fnOrValue === 'function' ? fnOrValue(prev) : fnOrValue

    // Optimistic update — both TQ cache and localStorage update instantly
    qc.setQueryData(qKey, next)
    setAllEntries(next)
    setLsData(next)

    if (!isSupabaseReady() || !userId) return

    const added   = next.filter(n => !prev.find(o => o.id === n.id))
    const removed = prev.filter(o => !next.find(n => n.id === o.id))
    const changed = next.filter(n => {
      const old = prev.find(o => o.id === n.id)
      return old && JSON.stringify(old) !== JSON.stringify(n)
    })

    Promise.resolve().then(async () => {
      try {
        for (const e of added)   await supabase.from('training_log').upsert(logEntryToRow(e, userId))
        for (const e of removed) await supabase.from('training_log').delete().eq('id', e.id).eq('user_id', userId)
        for (const e of changed) await supabase.from('training_log').update(logEntryToRow(e, userId)).eq('id', e.id).eq('user_id', userId)
        // Invalidate so TQ refetches server state, catching any server-side defaults
        qc.invalidateQueries({ queryKey: qKey })
      } catch (_) {
        // Sync failure — optimistic state is retained; will sync on next refetch
      }
    })
  }, [userId, qc, setLsData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Return a 2-element array for backward compat [entries, setLog]
  // Also attach named pagination properties so callers can destructure them
  const result = [entries, setLog]
  result.entries       = entries
  result.allEntries    = entries
  result.fetchNextPage = fetchNextPage
  result.hasMore       = hasMore
  result.isLoadingMore = isLoadingMore
  result.isLoading     = isLoading
  result.error         = error
  result.refetch       = refetch

  return result
}
