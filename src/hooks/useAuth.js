// ─── useAuth.js — Supabase auth state + profile hook ─────────────────────────
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    if (!supabase || !userId) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error && error.code !== 'PGRST116') {
      console.error('[useAuth] profile fetch:', error.message)
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

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    // Implicit flow: Supabase JS auto-detects #access_token in URL hash.
    // onAuthStateChange fires SIGNED_IN immediately on the redirect page.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] event:', event, session?.user?.email ?? '')
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          if (event === 'SIGNED_IN') await upsertProfile(u.id, u.email, u.user_metadata)
          setProfile(await fetchProfile(u.id))
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    // Hydrate from persisted session on mount
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) console.error('[AUTH] getSession error:', error.message)
      const u = session?.user ?? null
      setUser(u)
      if (u) setProfile(await fetchProfile(u.id))
      setLoading(false)
    }).catch(e => {
      console.error('[AUTH] getSession threw:', e.message)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile, upsertProfile])

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
