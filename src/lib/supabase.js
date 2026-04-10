// ─── supabase.js — Supabase client initialization ────────────────────────────
// Env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// Set these in .env.local (git-ignored) before running the app.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('[Supabase] ENV MISSING:', { url: SUPABASE_URL, key: SUPABASE_ANON ? '***set***' : 'MISSING' })
}

export const supabase = (SUPABASE_URL && SUPABASE_ANON)
  ? createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        flowType: 'implicit',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export const isSupabaseReady = () => !!supabase
