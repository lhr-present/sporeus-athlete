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

    // Debug: log PKCE state when returning from OAuth
    const params = new URLSearchParams(window.location.search)
    const oauthCode = params.get('code')
    if (oauthCode) {
      const lsKeys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('pkce') || k.includes('verifier'))
      console.log('[AUTH] OAuth code in URL:', oauthCode.slice(0, 8) + '...')
      console.log('[AUTH] supabase localStorage keys:', lsKeys)
    }

    // Nuclear option: explicitly exchange ?code= if detectSessionInUrl missed it
    if (oauthCode && supabase) {
      supabase.auth.exchangeCodeForSession(oauthCode)
        .then(({ data, error }) => {
          if (error) console.error('[AUTH] exchangeCodeForSession failed:', error.message)
          else console.log('[AUTH] session established via explicit exchange')
          window.history.replaceState({}, '', window.location.pathname)
        })
      // Fall through to normal init — onAuthStateChange will pick up the session
    }

    // Hydrate from existing session
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH] event:', event)
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
