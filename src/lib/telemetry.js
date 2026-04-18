// ─── telemetry.js — In-app event tracking + server-persistent flush ───────────
// Phase 1 (unchanged): localStorage ring buffer (offline-safe, zero deps)
// Phase 2 (new): flush events to ingest-telemetry edge function every 30s
//   and on page unload. Falls back silently if the edge function is unreachable.
//
// Funnel events to instrument conversion steps:
//   trackFunnel('signup_complete') | trackFunnel('first_session') |
//   trackFunnel('strava_connected') | trackFunnel('first_ai_insight') |
//   trackFunnel('tier_upgrade')

const TELEMETRY_KEY  = 'sporeus-telemetry'
const MAX_EVENTS     = 100
const ERROR_LOG_KEY  = 'sporeus-error-log'
const MAX_ERRORS     = 20
const FLUSH_INTERVAL = 30_000  // 30 s
const INGEST_PATH    = '/functions/v1/ingest-telemetry'

// ── Session ID — stable per browser tab ──────────────────────────────────────
let _sessionId = null
function getSessionId() {
  if (_sessionId) return _sessionId
  try {
    let id = sessionStorage.getItem('sporeus-session-id')
    if (!id) {
      id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
      sessionStorage.setItem('sporeus-session-id', id)
    }
    _sessionId = id
    return id
  } catch {
    return 'unknown'
  }
}

// ── Privacy: hash user_id client-side before sending ─────────────────────────
async function hashUserId(userId) {
  try {
    const enc = new TextEncoder()
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(userId))
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16)
  } catch {
    return null
  }
}

// ── Flush: POST buffered events to ingest-telemetry ──────────────────────────
let _flushing       = false
let _flushTimer     = null
let _userId         = null  // set by initTelemetryFlush()
let _userIdHash     = null
let _appVersion     = null

async function doFlush() {
  if (_flushing) return
  const raw = localStorage.getItem(TELEMETRY_KEY)
  if (!raw) return

  let events
  try { events = JSON.parse(raw) } catch { return }
  if (!Array.isArray(events) || events.length === 0) return

  const supabaseUrl = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_SUPABASE_URL ?? '')
    : ''
  const anonKey = typeof import.meta !== 'undefined'
    ? (import.meta.env?.VITE_SUPABASE_ANON_KEY ?? '')
    : ''

  if (!supabaseUrl || !anonKey) return   // not configured — skip flush

  _flushing = true
  try {
    // Take a snapshot and clear the buffer atomically
    const toSend = events.splice(0, 50)       // at most 50 per flush
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(events))

    const body = {
      session_id:   getSessionId(),
      user_id_hash: _userIdHash,
      events:       toSend.map(ev => ({
        event_type:  ev.event_type ?? 'feature',
        category:    ev.category,
        action:      ev.action,
        label:       ev.label ?? null,
        value:       ev.value ?? null,
        page:        ev.page ?? window.location.hash ?? null,
        app_version: _appVersion ?? null,
      })),
    }

    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5_000)

    await fetch(`${supabaseUrl}${INGEST_PATH}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': anonKey },
      body:    JSON.stringify(body),
      signal:  ctrl.signal,
    })
    clearTimeout(timer)
  } catch {
    // Silently swallowed — telemetry must never break the app
  } finally {
    _flushing = false
  }
}

/**
 * Call once on app init to activate server-side flush.
 * @param {{ userId?: string, appVersion?: string }} opts
 */
export async function initTelemetryFlush({ userId, appVersion } = {}) {
  _appVersion = appVersion ?? null

  if (userId) {
    _userId     = userId
    _userIdHash = await hashUserId(userId)
  }

  // 30s periodic flush
  if (_flushTimer) clearInterval(_flushTimer)
  _flushTimer = setInterval(doFlush, FLUSH_INTERVAL)

  // Flush on tab close / navigate away
  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') doFlush()
    }, { once: false })
  }
}

/**
 * Stop the periodic flush (useful in tests).
 */
export function stopTelemetryFlush() {
  if (_flushTimer) clearInterval(_flushTimer)
  _flushTimer = null
}

// ─── trackEvent ──────────────────────────────────────────────────────────────
// Appends an event to the localStorage telemetry buffer.
// Silently ignores any error (quota exceeded, SSR, etc.).
//
// @param {string} category
// @param {string} action
// @param {string} [label='']
export function trackEvent(category, action, label = '', { event_type = 'feature', value = null } = {}) {
  try {
    const raw    = localStorage.getItem(TELEMETRY_KEY)
    const events = raw ? JSON.parse(raw) : []
    events.push({
      ts: new Date().toISOString(),
      event_type,
      category,
      action,
      label,
      value,
      page: typeof window !== 'undefined' ? window.location.hash || null : null,
    })
    if (events.length > MAX_EVENTS) events.shift()
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(events))
  } catch (_) {
    // Silent — telemetry must never break the app
  }
}

// ─── trackFunnel ─────────────────────────────────────────────────────────────
// Records a conversion funnel step. Stored as event_type='funnel' for server
// aggregation via get_funnel_today() RPC.
//
// @param {string} step — 'signup_complete'|'first_session'|'strava_connected'|
//                         'first_ai_insight'|'tier_upgrade'
export function trackFunnel(step) {
  trackEvent('funnel', step, '', { event_type: 'funnel' })
}

// ─── trackPerf ───────────────────────────────────────────────────────────────
// Records a performance mark with duration_ms.
//
// @param {string} label — e.g. 'coach_dashboard_load'
// @param {number} durationMs
export function trackPerf(label, durationMs) {
  trackEvent('perf', label, '', { event_type: 'perf', value: Math.round(durationMs) })
}

// ─── getEventSummary ──────────────────────────────────────────────────────────
// Returns an object keyed by category with event counts.
//
// @returns {{ [category: string]: number }}
export function getEventSummary() {
  try {
    const raw    = localStorage.getItem(TELEMETRY_KEY)
    const events = raw ? JSON.parse(raw) : []
    const summary = {}
    for (const ev of events) {
      summary[ev.category] = (summary[ev.category] ?? 0) + 1
    }
    return summary
  } catch (_) {
    return {}
  }
}

// ─── flushTelemetry ───────────────────────────────────────────────────────────
// Returns all stored events without clearing the buffer.
//
// @returns {Array<{ ts: string, category: string, action: string, label: string }>}
export function flushTelemetry() {
  try {
    const raw = localStorage.getItem(TELEMETRY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {
    return []
  }
}

// ─── logError ────────────────────────────────────────────────────────────────
// Appends an error entry to 'sporeus-error-log'. Caps at MAX_ERRORS (keeps latest).
//
// @param {string} tabName
// @param {string} errorMessage
// @param {string} [stack='']
export function logError(tabName, errorMessage, stack = '') {
  try {
    const raw    = localStorage.getItem(ERROR_LOG_KEY)
    const errors = raw ? JSON.parse(raw) : []
    errors.push({ ts: new Date().toISOString(), tabName, error: errorMessage, stack })
    // Keep only the latest MAX_ERRORS entries
    while (errors.length > MAX_ERRORS) {
      errors.shift()
    }
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(errors))
  } catch (_) {
    // Silent
  }
}

// ─── getErrorLog ──────────────────────────────────────────────────────────────
// Returns the stored error log, or [] on any error.
//
// @returns {Array}
export function getErrorLog() {
  try {
    const raw = localStorage.getItem(ERROR_LOG_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (_) {
    return []
  }
}
