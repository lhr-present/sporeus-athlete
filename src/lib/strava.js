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

// ─── NOT WIRED — edge is the source of truth ─────────────────────────────────
// The three functions below (stravaToEntry / importStravaActivities /
// deduplicateByStravaId) implemented a CLIENT-SIDE direct-import path that wrote
// activities straight to localStorage. It was DISABLED in v9.90.0 (see the long
// comment in StravaConnect.jsx handleSync): the edge function `strava-oauth`
// (action:'sync') is now the ONLY sync path — it owns server-side token refresh,
// revocation handling, and per-user ownership via JWT, and upserts into
// training_log. These are kept (not deleted) only because strava.test.js still
// exercises the pure transform + dedup logic. DO NOT re-wire them into the app
// without adding token-ownership validation + refresh first.
// ─────────────────────────────────────────────────────────────────────────────

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
// Single source of truth for the OAuth redirect — MUST exactly match the
// "Authorization Callback Domain" + path registered in the Strava app settings.
// Strava rejects the whole flow with redirect_uri mismatch if it differs at all.
const STRAVA_REDIRECT_URI = import.meta.env.VITE_STRAVA_REDIRECT_URI || ''

// Prefer the configured redirect URI; fall back to a normalized current-URL value
// (query/hash stripped, index.html removed, trailing slash forced) so a deep route
// or a stray ?param can't silently change the redirect_uri and break the exchange.
function getRedirectUri() {
  let dynamic = ''
  try {
    const url = new URL(window.location.href)
    url.search = ''; url.hash = ''
    dynamic = url.origin + url.pathname.replace(/\/index\.html$/, '')
    if (!dynamic.endsWith('/')) dynamic += '/'
  } catch { /* non-browser context */ }

  if (!STRAVA_REDIRECT_URI) {
    if (typeof console !== 'undefined') console.warn('[strava] VITE_STRAVA_REDIRECT_URI not set — using current URL; OAuth may fail on redirect_uri mismatch')
    return dynamic
  }
  if (dynamic && dynamic !== STRAVA_REDIRECT_URI && typeof console !== 'undefined') {
    console.warn(`[strava] current URL (${dynamic}) != registered redirect_uri (${STRAVA_REDIRECT_URI}); using the configured value`)
  }
  return STRAVA_REDIRECT_URI
}

// The scope we MUST have to import activities. Strava will silently reuse a
// previously-granted narrower scope (e.g. plain `read`) on approval_prompt:'auto'
// — so a returning user can "reconnect" and end up with an empty import and no
// error. hasActivityReadScope() inspects the `scope` param Strava returns on the
// callback so callers can detect + recover from this.
export const STRAVA_REQUIRED_SCOPE = 'activity:read_all'

// True when the granted scope string (comma-separated, as Strava returns it on
// the OAuth callback) includes activity:read_all. Null/empty scope → false.
export function hasActivityReadScope(scope) {
  if (!scope) return false
  return String(scope).split(',').map(s => s.trim()).includes(STRAVA_REQUIRED_SCOPE)
}

// Redirect user to Strava OAuth authorization page.
// Returns { ok: true } on success / redirect, or { ok: false, error: '...' }
// when misconfigured (so callers can render the message in-app rather than
// using the browser alert dialog).
//
// options.force (default false): sets approval_prompt:'force' so Strava ALWAYS
// re-shows the permission screen. Use it when a prior grant may have been too
// narrow (missing activity:read_all) or on a reconnect after an in-session
// disconnect — otherwise 'auto' silently reuses the old (possibly wrong) scope.
export function initiateStravaOAuth(options = {}) {
  if (!STRAVA_CLIENT_ID) {
    return { ok: false, error: 'Strava integration not configured. Set VITE_STRAVA_CLIENT_ID in .env.' }
  }
  const params = new URLSearchParams({
    client_id:     STRAVA_CLIENT_ID,
    redirect_uri:  getRedirectUri(),
    response_type: 'code',
    approval_prompt: options.force ? 'force' : 'auto',
    scope:         STRAVA_REQUIRED_SCOPE,
    state:         'strava',
  })
  window.location.href = `https://www.strava.com/oauth/authorize?${params}`
  return { ok: true }
}

// ─── Connection self-test ────────────────────────────────────────────────────
// Pure diagnostic over the client-side prerequisites so the user (and support)
// can see EXACTLY which Strava prerequisite is missing without guessing. No
// network calls — reads the build-time config + the passed auth/connection state.
// Returns { checks: [{ key, status, detail }], allReady, redirectUri }.
//   status: 'ok' | 'fail' | 'info' | 'pending'.  The UI owns the bilingual
//   label/hint per `key`; `detail` is the dynamic value to show.
export function buildStravaSelfTest({ supabaseReady = false, userId = null, conn = null } = {}) {
  const clientId    = STRAVA_CLIENT_ID
  const redirectUri = getRedirectUri()
  const checks = []

  checks.push({
    key: 'clientId',
    status: clientId ? 'ok' : 'fail',
    detail: clientId ? `set (…${String(clientId).slice(-4)})` : 'missing',
  })

  // Always shown (info): the exact redirect_uri the client will send — must match
  // the Strava app's Authorization Callback Domain. 'fail' only if we couldn't derive one.
  checks.push({
    key: 'redirectUri',
    status: redirectUri ? 'info' : 'fail',
    detail: redirectUri || '(none)',
  })

  const signedIn = !!(supabaseReady && userId)
  checks.push({ key: 'auth', status: signedIn ? 'ok' : 'fail', detail: signedIn ? 'yes' : 'no' })

  if (conn) {
    const errored = conn.sync_status === 'error'
    const parts = []
    if (conn.provider_athlete_name) parts.push(conn.provider_athlete_name)
    parts.push(conn.last_sync_at ? `last sync ${String(conn.last_sync_at).slice(0, 10)}` : 'not yet synced')
    if (errored && conn.last_error) parts.push(conn.last_error)
    checks.push({ key: 'token', status: errored ? 'fail' : 'ok', detail: parts.join(' · ') })
  } else {
    checks.push({ key: 'token', status: 'pending', detail: 'not connected' })
  }

  const allReady = checks.every(c => c.status === 'ok' || c.status === 'info')
  return { checks, allReady, redirectUri, clientId: !!clientId }
}

// Exchange authorization code for tokens via Supabase edge function.
//
// v9.173.0 — Transient-failure retry (was: manual retry only).
// Strava authorization codes are single-use + 5-min expiry, so 4xx errors
// MUST NOT be retried (Strava returns invalid_grant on second use). We
// retry only on:
//   - network errors (no error.context, i.e. invoke threw before reaching the function)
//   - 5xx responses from the edge function (transient server / DB / Strava-side issue)
// Backoff: 250ms then 750ms (small jitter). Max 3 total attempts.
const EXCHANGE_MAX_ATTEMPTS = 3
const EXCHANGE_BACKOFF_MS = [250, 750]

function isRetryableInvokeError(error) {
  if (!error) return false
  const status = error?.context?.status
  if (typeof status !== 'number') return true  // network / pre-flight: retry
  return status >= 500                          // 5xx: retry; 4xx: do not
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms + Math.floor(Math.random() * 50)))
}

export async function exchangeStravaCode(code, options = {}) {
  const maxAttempts = options.maxAttempts ?? EXCHANGE_MAX_ATTEMPTS
  let lastErr = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await supabase.functions.invoke('strava-oauth', {
      body: { action: 'connect', code, redirectUri: getRedirectUri() },
    })
    if (!error) return { data, error: null }
    lastErr = error

    if (!isRetryableInvokeError(error) || attempt >= maxAttempts) break
    const backoff = EXCHANGE_BACKOFF_MS[attempt - 1] ?? EXCHANGE_BACKOFF_MS[EXCHANGE_BACKOFF_MS.length - 1]
    await sleep(backoff)
  }

  try {
    const text = await lastErr.context?.text?.()
    return { data: null, error: { message: text || lastErr.message } }
  } catch {
    return { data: null, error: { message: lastErr?.message || 'Unknown error' } }
  }
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

// F1 — pure predicate for the self-healing reconcile-on-load. True only when a
// connection exists (strava_athlete_id present) BUT it has never synced
// (last_sync_at null) AND the log has no strava-sourced entries yet — the exact
// "connected but zero activities imported" prod state. Extracted as a pure fn so
// the reconcile decision is unit-testable independent of TodayView. The CALLER
// owns the once-per-session guard (a ref) so the sync can't loop/double-import.
export function shouldReconcileStrava(conn, log) {
  if (!conn || !conn.strava_athlete_id) return false
  if (conn.last_sync_at) return false
  return !(Array.isArray(log) && log.some(e => e && e.source === 'strava'))
}

// Post-connect sync with a small bounded retry for the auth-session race.
// Immediately after the OAuth redirect reload, the Supabase auth session may
// not be committed yet when the sync fires → the edge function 401s. That 401
// was previously swallowed by a fire-and-forget `.catch`, leaving the user
// "Connected" with an empty log (the top prod bug). Here we retry a 401 up to
// `maxAttempts` times with backoff (default ~1s then ~3s), mirroring the
// transient-retry infra exchangeStravaCode already has. Non-401 errors are
// returned immediately (real failures shouldn't be masked by retries).
// Reuses the _syncPromise mutex via triggerStravaSync, so it can't double-fire
// with the Profile / banner "Sync now" buttons.
const POST_CONNECT_SYNC_ATTEMPTS = 3
const POST_CONNECT_BACKOFF_MS = [1000, 3000]

function isUnauthorized(error) {
  if (!error) return false
  const status = error?.context?.status ?? error?.status
  if (status === 401 || status === 403) return true
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('401') || msg.includes('unauthorized') || msg.includes('jwt')
}

export async function triggerStravaSyncWithRetry(options = {}) {
  const maxAttempts = options.maxAttempts ?? POST_CONNECT_SYNC_ATTEMPTS
  let last = { data: null, error: null }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await triggerStravaSync()
    if (!last.error) return last
    if (!isUnauthorized(last.error) || attempt >= maxAttempts) return last
    const backoff = POST_CONNECT_BACKOFF_MS[attempt - 1] ?? POST_CONNECT_BACKOFF_MS[POST_CONNECT_BACKOFF_MS.length - 1]
    await sleep(backoff)
  }
  return last
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

// Count of Strava-sourced activities in training_log (the DB source of truth).
// StravaConnect's "LOCAL ACTIVITIES" tile read localStorage (`sporeus_log`),
// which is 0 for a signed-in user whose imports live in training_log until the
// DB→localStorage hydration runs — showing a misleading "0" right after a good
// import. Returns null on error/no-user so the UI can fall back.
export async function getStravaActivityCount(userId) {
  if (!userId) return null
  const { count, error } = await supabase
    .from('training_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'strava')
  if (error) return null
  return count ?? 0
}

// Most-recent synced Strava activities straight from training_log (the source of
// truth the edge just wrote to). Used by StravaConnect after a sync: reading
// localStorage there showed "no activities" right after a successful sync because
// the DB→localStorage hydration hadn't run yet.
export async function getRecentStravaActivities(userId, limit = 3) {
  if (!userId) return []
  const { data } = await supabase
    .from('training_log')
    .select('date, type, duration_min, tss')
    .eq('user_id', userId)
    .eq('source', 'strava')
    .order('date', { ascending: false })
    .limit(limit)
  return (data || []).map(r => ({ date: r.date, type: r.type, duration: r.duration_min, tss: r.tss }))
}
