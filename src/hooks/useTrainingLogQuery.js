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
import { logger } from '../lib/logger.js'
import { useLocalStorage } from './useLocalStorage.js'
import { logRowToEntry, logEntryToRow, tryWrite } from './useSupabaseData.js'
import { deepEqual } from '../lib/deepEqual.js'
import { enqueuePendingLog, markSyncOffline } from '../lib/offlineQueue.js'

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
      // v9.90.0 — null-safe: Supabase can return rows=null when the query
      // succeeds but the result set is empty (rare; usually returns []).
      // Falling back to [] avoids a TypeError on .map.
      const safeRows = rows ?? []
      const entries = safeRows.map(logRowToEntry)
      // Reset pagination cursor on fresh load
      pageRef.current = 1
      setAllEntries(entries)
      setHasMore(safeRows.length >= pageSize)
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

  // Always-fresh handle on the FULL current list. setLog must diff against this,
  // not the TQ cache (which holds only page 1) — otherwise editing/deleting a
  // row from page 2+ is misclassified and the delete never reaches the server.
  const entriesRef = useRef(entries)
  entriesRef.current = entries

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
      const safeRows = rows ?? []   // Supabase returns null (not []) for an empty page
      const newEntries = safeRows.map(logRowToEntry)
      setAllEntries(prev => {
        const merged = [...(prev ?? []), ...newEntries]
        setLsData(merged)
        return merged
      })
      setHasMore(safeRows.length >= pageSize)
      pageRef.current = page + 1   // advance the cursor only after a successful append
    } catch (err) {
      logger.warn('useTrainingLogQuery: fetchNextPage failed', err)
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
    // Diff against the FULL current list (incl. paginated pages), not the
    // page-1-only TQ cache — see entriesRef above.
    const prev = entriesRef.current ?? []
    const next = typeof fnOrValue === 'function' ? fnOrValue(prev) : fnOrValue

    // Optimistic update — both TQ cache and localStorage update instantly
    qc.setQueryData(qKey, next)
    setAllEntries(next)
    setLsData(next)

    if (!isSupabaseReady() || !userId) return

    // O(n) diff via id-indexed maps (was O(n²) nested .find). deepEqual is
    // order-independent so reordered keys don't fire spurious updates.
    const prevById = new Map(prev.map(o => [o.id, o]))
    const nextById = new Map(next.map(n => [n.id, n]))
    const added   = next.filter(n => !prevById.has(n.id))
    const removed = prev.filter(o => !nextById.has(o.id))
    const changed = next.filter(n => {
      const old = prevById.get(n.id)
      return old && !deepEqual(old, n)
    })

    // Resilient background sync (v9.347.0): per-write error checks, batch never
    // aborts on one failure, failed insert/update rows are queued for retry.
    Promise.resolve().then(async () => {
      let ok = true
      for (const e of added) {
        const row = logEntryToRow(e, userId)
        ok = await tryWrite('training_log insert', supabase.from('training_log').upsert(row),
          () => enqueuePendingLog({ ...row, _table: 'training_log' })) && ok
      }
      for (const e of changed) {
        const row = logEntryToRow(e, userId)
        ok = await tryWrite('training_log update', supabase.from('training_log').update(row).eq('id', e.id).eq('user_id', userId),
          () => enqueuePendingLog({ ...row, _table: 'training_log' })) && ok
      }
      for (const e of removed) {
        // v9.361.0 — tombstone offline deletes so they aren't lost on reconnect.
        ok = await tryWrite('training_log delete', supabase.from('training_log').delete().eq('id', e.id).eq('user_id', userId),
          () => enqueuePendingLog({ _op: 'delete', _table: 'training_log', _key: { id: e.id, user_id: userId } })) && ok
      }
      if (!ok) markSyncOffline()
      // Invalidate so TQ refetches server state, catching any server-side defaults
      qc.invalidateQueries({ queryKey: qKey })
    }).catch(err => logger.warn('[sync] training_log batch:', err?.message))
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
