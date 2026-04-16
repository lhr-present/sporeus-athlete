// ─── supabase.js — Supabase client initialization ────────────────────────────
// Env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// Set these in .env.local (git-ignored) before running the app.

import { createClient } from '@supabase/supabase-js'
import { ENV } from './env.js'
import { captureException } from './sentry.js'

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

/**
 * Wrap a Supabase query with Sentry error capture for high-stakes call sites.
 * Usage: const { data, error } = await sbQuery('profiles:fetch', () =>
 *   supabase.from('profiles').select('*').eq('id', userId).single())
 *
 * Only use this on the 5-10 highest-stakes calls — not everywhere.
 * Supabase errors are non-throwing; this catches both thrown exceptions and
 * result.error objects.
 */
export async function sbQuery(operation, queryFn) {
  try {
    const result = await queryFn()
    if (result?.error) {
      captureException(new Error(result.error.message), {
        operation,
        code: result.error.code,
      })
    }
    return result
  } catch (err) {
    captureException(err, { operation })
    throw err
  }
}
