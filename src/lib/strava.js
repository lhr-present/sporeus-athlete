// src/lib/strava.js — Strava OAuth client helpers (Phase 3.1)
// Server-side token exchange happens in supabase/functions/strava-oauth/index.ts
// STRAVA_CLIENT_SECRET stays server-side only

import { supabase } from './supabase.js'
import { safeFetch } from './fetch.js'

// ── Strava sport_type → sporeus activity type ─────────────────────────────────
const SPORT_TYPE_MAP = {
  Run: 'Run', VirtualRun: 'Run', TrailRun: 'Run',
  Ride: 'Ride', VirtualRide: 'Ride', GravelRide: 'Ride', MountainBikeRide: 'Ride',
  Swim: 'Swim', OpenWaterSwim: 'Swim',
  Walk: 'Walk', Hike: 'Walk',
  WeightTraining: 'Strength', Workout: 'Strength', Yoga: 'Other',
}

// Convert a raw Strava activity object to a sporeus log entry
function stravaToEntry(act) {
  const durationSec = act.moving_time || act.elapsed_time || 0
  const type = SPORT_TYPE_MAP[act.sport_type || act.type] || 'Other'
  // Rough TSS from duration + HR if available
  let tss = null
  if (durationSec > 0) {
    if (act.average_heartrate && act.max_heartrate) {
      // HR-based TSS approximation (normalized effort fraction squared)
      const hrFrac = act.average_heartrate / (act.max_heartrate * 0.9)
      tss = Math.round(hrFrac * hrFrac * (durationSec / 3600) * 100)
    } else {
      // Duration-only default (~60 TSS/h moderate effort)
      tss = Math.round((durationSec / 3600) * 60)
    }
    tss = Math.min(tss, 300)
  }
  const rpe = act.average_heartrate
    ? Math.min(10, Math.max(1, Math.round(act.average_heartrate / 20)))
    : 5

  // Decode Google encoded polyline from summary_polyline → lightweight trackpoints
  const polyline = act.map?.summary_polyline
  const trackpoints = polyline ? decodePolyline(polyline).map(([lat, lon]) => ({ lat, lon, ele: 0 })) : null

  return {
    date:        (act.start_date_local || act.start_date || '').slice(0, 10),
    type,
    tss:         tss ?? 60,
    rpe,
    durationSec,
    distanceM:   act.distance || 0,
    avgHR:       act.average_heartrate || null,
    avgCadence:  act.average_cadence  || null,
    notes:       act.name || '',
    strava_id:   String(act.id),
    source:      'strava',
    ...(trackpoints ? { trackpoints } : {}),
  }
}

// ── Google Encoded Polyline decoder ──────────────────────────────────────────
// Decodes Google's encoded polyline algorithm into [[lat, lon], ...] pairs.
// Ref: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
export function decodePolyline(encoded) {
  if (!encoded) return []
  const result = []
  let index = 0, lat = 0, lon = 0
  while (index < encoded.length) {
    let shift = 0, b, result_ = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result_ |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += (result_ & 1 ? ~(result_ >> 1) : result_ >> 1)

    shift = 0; result_ = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result_ |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lon += (result_ & 1 ? ~(result_ >> 1) : result_ >> 1)

    result.push([lat * 1e-5, lon * 1e-5])
  }
  return result
}

// ── importStravaActivities ────────────────────────────────────────────────────
// Fetches activities from the Strava API and returns sporeus log entries.
// Handles up to 3 pages (max 200/page). Does NOT write to storage.
export async function importStravaActivities(accessToken, daysBack = 30) {
  if (!accessToken) return { entries: [], error: new Error('No access token') }
  const after = Math.floor((Date.now() - daysBack * 86400000) / 1000)
  const entries = []

  for (let page = 1; page <= 3; page++) {
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200&page=${page}`
    const res = await safeFetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText)
      return { entries, error: new Error(`Strava API ${res.status}: ${msg}`) }
    }
    const acts = await res.json()
    if (!Array.isArray(acts) || acts.length === 0) break
    for (const act of acts) entries.push(stravaToEntry(act))
    if (acts.length < 200) break
  }

  return { entries, error: null }
}

// ── deduplicateByStravaId ─────────────────────────────────────────────────────
// Returns only incoming entries whose strava_id is not already in existing[].
export function deduplicateByStravaId(existing, incoming) {
  const knownIds = new Set(
    existing.filter(e => e.strava_id).map(e => String(e.strava_id))
  )
  return incoming.filter(e => e.strava_id && !knownIds.has(String(e.strava_id)))
}

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
  if (error) {
    try {
      const text = await error.context?.text?.()
      return { data: null, error: { message: text || error.message } }
    } catch {
      return { data: null, error: { message: error.message } }
    }
  }
  return { data, error }
}

// Module-level mutex — prevents concurrent sync calls from hitting the edge function twice.
let _syncPromise = null

// Trigger activity sync from Strava (last 30 days)
export async function triggerStravaSync() {
  if (_syncPromise) return _syncPromise
  _syncPromise = supabase.functions.invoke('strava-oauth', { body: { action: 'sync' } })
    .then(({ data, error }) => ({ data, error }))
    .catch(err => ({ data: null, error: err }))
    .finally(() => { _syncPromise = null })
  return _syncPromise
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
    .select('strava_athlete_id, last_sync_at, updated_at, sync_status, last_error, provider_athlete_name')
    .eq('user_id', userId)
    .maybeSingle()
  return { data, error }
}
