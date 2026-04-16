// ─── useAuth.js — Supabase auth state + profile hook ─────────────────────────
import { useEffect, useState, useCallback } from 'react'
import { supabase, sbQuery } from '../lib/supabase.js'
import { logger } from '../lib/logger.js'
import { setUser as sentrySetUser, clearUser as sentryClearUser } from '../lib/sentry.js'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [needsUpsert, setNeedsUpsert] = useState(false)

  const fetchProfile = useCallback(async (userId) => {
    if (!supabase || !userId) return null
    const { data, error } = await sbQuery('profiles:fetch', () =>
      supabase.from('profiles').select('*').eq('id', userId).single()
    )
    if (error && error.code !== 'PGRST116') {
      logger.error(new Error(`[useAuth] profile fetch: ${error.message}`), { code: error.code })
      return null
    }
    return data || null
  }, [])

  const upsertProfile = useCallback(async (userId, email, meta) => {
    if (!supabase) return
    await supabase.from('profiles').upsert({
      id:           userId,
      email:        email,
      display_name: meta?.full_name || meta?.name || email?.split('@')[0] || 'Athlete',
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'id' })
  }, [])

  // ── Auth state listener ────────────────────────────────────────────────────
  // Synchronous only — no Supabase calls here.
  // The auth lock is held while this callback runs; any nested Supabase
  // request (fetchProfile, upsertProfile) would deadlock against it.
  // TOKEN_REFRESHED fires periodically — we deliberately ignore it for profile
  // work to avoid requesting data while the lock is busy refreshing the token.
  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      setUser(u)
      // Sentry user context — id only, never email or profile data
      if (u) sentrySetUser(u.id)
      else   sentryClearUser()
      if (event === 'SIGNED_IN') setNeedsUpsert(true)
      if (!u) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])  // empty deps — one listener, never recreated

  // ── Profile upsert — only on first sign-in ────────────────────────────────
  // Runs outside the auth lock, triggered by SIGNED_IN setting needsUpsert.
  useEffect(() => {
    if (!user || !needsUpsert) return
    upsertProfile(user.id, user.email, user.user_metadata)
      .then(() => setNeedsUpsert(false))
  }, [user, needsUpsert, upsertProfile])

  // ── Profile fetch — runs when user identity changes ───────────────────────
  // Keyed on user.id only, so TOKEN_REFRESHED (same user, same id) does NOT
  // retrigger this — avoids fetching while the refresh lock is still held.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    fetchProfile(user.id).then(p => {
      if (!cancelled) {
        setProfile(p)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [user?.id, fetchProfile])  // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    setProfile(await fetchProfile(user.id))
  }, [user, fetchProfile])

  return { user, profile, loading, signOut, refreshProfile }
}
