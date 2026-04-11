// src/lib/strava.js — Strava OAuth client helpers (Phase 3.1)
// Server-side token exchange happens in supabase/functions/strava-oauth/index.ts
// STRAVA_CLIENT_SECRET stays server-side only

import { supabase } from './supabase.js'

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID || ''

// Redirect URI must match exactly what's registered in Strava app settings
// For GitHub Pages: https://lhr-present.github.io/sporeus-athlete/
function getRedirectUri() {
  return window.location.origin + window.location.pathname.replace(/\/$/, '') + '/'
}

// Redirect user to Strava OAuth authorization page
export function initiateStravaOAuth() {
  if (!STRAVA_CLIENT_ID) {
    alert('Strava integration not configured. Set VITE_STRAVA_CLIENT_ID in .env.')
    return
  }
  const params = new URLSearchParams({
    client_id:     STRAVA_CLIENT_ID,
    redirect_uri:  getRedirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope:         'activity:read_all',
    state:         'strava',
  })
  window.location.href = `https://www.strava.com/oauth/authorize?${params}`
}

// Exchange authorization code for tokens via Supabase edge function
export async function exchangeStravaCode(code) {
  const { data, error } = await supabase.functions.invoke('strava-oauth', {
    body: { action: 'connect', code, redirectUri: getRedirectUri() },
  })
  return { data, error }
}

// Trigger activity sync from Strava (last 30 days)
export async function triggerStravaSync() {
  const { data, error } = await supabase.functions.invoke('strava-oauth', {
    body: { action: 'sync' },
  })
  return { data, error }
}

// Disconnect Strava (removes tokens, keeps synced activities)
export async function disconnectStrava() {
  const { data, error } = await supabase.functions.invoke('strava-oauth', {
    body: { action: 'disconnect' },
  })
  return { data, error }
}

// Get current Strava connection info for a user
export async function getStravaConnection(userId) {
  if (!userId) return { data: null, error: null }
  const { data, error } = await supabase
    .from('strava_tokens')
    .select('strava_athlete_id, last_sync_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  return { data, error }
}
