// ─── supabase.js — Supabase client initialization ────────────────────────────
// Env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// Set these in .env.local (git-ignored) before running the app.

import { createClient } from '@supabase/supabase-js'
import { ENV } from './env.js'

const SUPABASE_URL  = ENV.supabaseUrl
const SUPABASE_ANON = ENV.supabaseAnon

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
