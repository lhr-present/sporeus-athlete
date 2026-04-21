// ─── useProfileQuery.js — TanStack Query v5 wrapper for profiles ──────────────
// Replaces useProfileSync in DataContext.
// Returns [profile, setProfile] — identical interface to the old hook.
//
// Key behaviours:
//  • initialData from localStorage → zero-flash on mount
//  • Remote wins on hydrate (merged, not replaced): remote keys override local
//  • New-user push: if remote is empty and local has data, one-time migration up
//  • setProfile() applies optimistic update + background Supabase upsert + invalidate

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { logger } from '../lib/logger.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { useLocalStorage } from './useLocalStorage.js'

const LS_KEY     = 'sporeus_profile'
const SYNCED_KEY = 'sporeus-profile-synced'

export const profileKey = (userId) => ['profile', userId ?? 'guest']

export function useProfileQuery(userId) {
  const [lsData, setLsData] = useLocalStorage(LS_KEY, {})
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: profileKey(userId),
    queryFn: async () => {
      if (!isSupabaseReady() || !userId) return lsData

      const { data: row, error } = await supabase
        .from('profiles')
        .select('profile_data')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        logger.error(new Error(`[useProfileQuery] hydrate: ${error.message}`))
        return lsData
      }

      const remote = row?.profile_data || {}
      const hasRemote = Object.keys(remote).length > 0

      if (hasRemote) {
        const merged = { ...lsData, ...remote }
        setLsData(merged)
        return merged
      }

      // Remote empty → push local data up (new user, first login)
      const localRaw = (() => {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
      })()
      if (Object.keys(localRaw).length > 0 && localStorage.getItem(SYNCED_KEY) !== userId) {
        supabase
          .from('profiles')
          .update({ profile_data: localRaw, updated_at: new Date().toISOString() })
          .eq('id', userId)
          .then(({ error: e }) => {
            if (e) logger.warn('[useProfileQuery] initial push error:', e.message)
            else try { localStorage.setItem(SYNCED_KEY, userId) } catch (_) {}
          })
      }

      return lsData
    },
    initialData: lsData,
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  })

  const setProfile = useCallback((fnOrValue) => {
    const qKey = profileKey(userId)
    const prev = qc.getQueryData(qKey) ?? {}
    const next = typeof fnOrValue === 'function' ? fnOrValue(prev) : fnOrValue

    // Optimistic update
    qc.setQueryData(qKey, next)
    setLsData(next)

    if (!isSupabaseReady() || !userId) return

    Promise.resolve().then(async () => {
      try {
        await supabase
          .from('profiles')
          .update({ profile_data: next, updated_at: new Date().toISOString() })
          .eq('id', userId)
        qc.invalidateQueries({ queryKey: qKey })
      } catch (e) {
        logger.warn('[useProfileQuery] save error:', e.message)
      }
    })
  }, [userId, qc, setLsData]) // eslint-disable-line react-hooks/exhaustive-deps

  return [data ?? lsData, setProfile]
}
