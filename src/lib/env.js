// ─── env.js — Typed environment variable access ──────────────────────────────
import { logger } from './logger.js'

const requireInProd = (key) => {
  const value = import.meta.env[key]
  if (!value && import.meta.env.PROD) logger.error(`Missing required env var: ${key}`)
  return value || ''
}

export const ENV = Object.freeze({
  supabaseUrl:    requireInProd('VITE_SUPABASE_URL'),
  supabaseAnon:   requireInProd('VITE_SUPABASE_ANON_KEY'),
  stravaClientId: import.meta.env.VITE_STRAVA_CLIENT_ID    || '',
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY    || '',
  isDev:  import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  base:   import.meta.env.BASE_URL,
})
