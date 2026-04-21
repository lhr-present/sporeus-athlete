// ─── useTrainingLogQuery.js — TanStack Query v5 wrapper for training_log ──────
// Replaces useTrainingLog (useSupabaseData.js) in DataContext.
// Returns [log, setLog] — identical interface to the old hook.
//
// Key behaviours:
//  • initialData from localStorage → no loading flash
//  • Background refetch on window focus / staleTime expiry (30s)
//  • setLog() applies optimistic update to TQ cache + localStorage, then
//    syncs to Supabase and invalidates the query for a server-round-trip
//  • On network failure the TQ cache stays warm and localStorage persists

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { useLocalStorage } from './useLocalStorage.js'
import { logRowToEntry, logEntryToRow } from './useSupabaseData.js'

export const trainingLogKey = (userId) => ['training_log', userId ?? 'guest']

export function useTrainingLogQuery(userId) {
  const [lsData, setLsData] = useLocalStorage('sporeus_log', [])
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: trainingLogKey(userId),
    queryFn: async () => {
      if (!isSupabaseReady() || !userId) return lsData
      const { data: rows, error } = await supabase
        .from('training_log')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
      if (error) throw error
      const entries = rows.map(logRowToEntry)
      setLsData(entries)
      return entries
    },
    initialData: lsData,
    initialDataUpdatedAt: 0,   // treat localStorage data as stale → fetch immediately
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  })

  const setLog = useCallback((fnOrValue) => {
    const qKey = trainingLogKey(userId)
    const prev = qc.getQueryData(qKey) ?? []
    const next = typeof fnOrValue === 'function' ? fnOrValue(prev) : fnOrValue

    // Optimistic update — both TQ cache and localStorage update instantly
    qc.setQueryData(qKey, next)
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

  return [data ?? lsData, setLog]
}
