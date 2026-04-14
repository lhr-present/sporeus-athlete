// ─── telemetry.js — Lightweight in-app event tracking and error logging ───────

const TELEMETRY_KEY = 'sporeus-telemetry'
const MAX_EVENTS    = 100
const ERROR_LOG_KEY = 'sporeus-error-log'
const MAX_ERRORS    = 20

// ─── trackEvent ──────────────────────────────────────────────────────────────
// Appends an event to the localStorage telemetry buffer.
// Silently ignores any error (quota exceeded, SSR, etc.).
//
// @param {string} category
// @param {string} action
// @param {string} [label='']
export function trackEvent(category, action, label = '') {
  try {
    const raw    = localStorage.getItem(TELEMETRY_KEY)
    const events = raw ? JSON.parse(raw) : []
    events.push({ ts: new Date().toISOString(), category, action, label })
    // Roll over: keep only the latest MAX_EVENTS entries
    if (events.length > MAX_EVENTS) {
      events.shift()
    }
    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(events))
  } catch (_) {
    // Silent — telemetry must never break the app
  }
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
