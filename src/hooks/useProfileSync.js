// ─── useProfileSync.js — Supabase-backed profile with localStorage cache ──────
// Same interface as useLocalStorage: returns [profile, setProfile].
// When userId is set: hydrates from profiles.profile_data on login,
// writes back on every mutation. localStorage is the write-through cache.
// Falls back to localStorage-only when Supabase is unavailable.

import { useEffect, useCallback, useRef } from 'react'
import { logger } from '../lib/logger.js'
import { supabase, isSupabaseReady, sbQuery } from '../lib/supabase.js'
import { useLocalStorage } from './useLocalStorage.js'

const LS_KEY = 'sporeus_profile'
const SYNCED_KEY = 'sporeus-profile-synced'

export function useProfileSync(userId) {
  const [profile, setProfileLS] = useLocalStorage(LS_KEY, {})
  const hydrated = useRef(false)
  const useSupabase = isSupabaseReady() && !!userId

  // ── Hydrate from Supabase once per login ────────────────────────────────────
  useEffect(() => {
    if (!useSupabase) return
    hydrated.current = false

    sbQuery('profiles:hydrate', () =>
      supabase.from('profiles').select('profile_data').eq('id', userId).maybeSingle()
    ).then(({ data: row, error }) => {
        if (error) {
          logger.error(new Error(`[useProfileSync] hydrate: ${error.message}`), { code: error.code })
          hydrated.current = true
          return
        }

        const remote = row?.profile_data || {}
        const hasRemoteData = Object.keys(remote).length > 0

        if (hasRemoteData) {
          // Remote has data → merge (remote wins, but keep any local-only keys)
          setProfileLS(local => ({ ...local, ...remote }))
        } else {
          // Remote is empty → this is a new/first login; push local data up
          const local = (() => {
            try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
          })()
          const hasLocalData = Object.keys(local).length > 0
          if (hasLocalData && localStorage.getItem(SYNCED_KEY) !== userId) {
            // One-time migration of existing local profile → Supabase
            supabase
              .from('profiles')
              .update({ profile_data: local, updated_at: new Date().toISOString() })
              .eq('id', userId)
              .then(({ error: e }) => {
                if (e) {
                  logger.warn('[useProfileSync] initial push error:', e.message)
                } else {
                  try { localStorage.setItem(SYNCED_KEY, userId) } catch (le) { logger.warn('localStorage:', le.message) }
                }
              })
          }
        }

        hydrated.current = true
      })
      .catch(err => {
        logger.warn('[useProfileSync] hydrate catch:', err.message)
        hydrated.current = true
      })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Setter: update localStorage + fire background Supabase upsert ──────────
  const setProfile = useCallback((fnOrValue) => {
    setProfileLS(prev => {
      const next = typeof fnOrValue === 'function' ? fnOrValue(prev) : fnOrValue

      if (useSupabase && hydrated.current) {
        Promise.resolve().then(() => {
          supabase
            .from('profiles')
            .update({ profile_data: next, updated_at: new Date().toISOString() })
            .eq('id', userId)
            .then(({ error }) => {
              if (error) logger.warn('[useProfileSync] save error:', error.message)
            })
        })
      }

      return next
    })
  }, [useSupabase, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  return [profile, setProfile]
}
