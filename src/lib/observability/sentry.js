// src/lib/observability/sentry.js
// E15 — Enhanced Sentry wrapper with full PII scrubbing pipeline.
// Drop-in upgrade for src/lib/sentry.js. Loaded async after first paint.

import { scrubPII } from './piiScrubber.js'
import { createHash } from '../ai/prompts/hash.js'

let _sentry = null

// ── Internal: scrub a Sentry event before sending ────────────────────────────
export function _scrubSentryEvent(event) {
  // Drop debug / internal routes — they contain sensitive diagnostic data
  if (event.request?.url && /\/(debug|internal)\//.test(event.request.url)) return null

  if (event.message) {
    event.message = scrubPII(event.message)
  }
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubPII(ex.value)
    }
  }
  if (event.breadcrumbs?.values) {
    for (const bc of event.breadcrumbs.values) {
      if (bc.message) bc.message = scrubPII(bc.message)
      if (bc.data)    bc.data    = scrubPII(bc.data)
    }
  }
  if (event.request?.url) {
    event.request.url = scrubPII(event.request.url)
  }
  if (event.extra)    event.extra    = scrubPII(event.extra)
  if (event.contexts) event.contexts = scrubPII(event.contexts)

  return event
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/**
 * Initialise Sentry. No-op when VITE_SENTRY_DSN is absent (safe for local dev).
 * Loaded asynchronously so it never blocks the main bundle.
 */
export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    if (import.meta.env.DEV) console.warn('[sentry] VITE_SENTRY_DSN not set — monitoring disabled')
    return
  }
  try {
    const mod = await import('@sentry/react')
    _sentry = mod

    const integrations = []
    if (mod.browserTracingIntegration)   integrations.push(mod.browserTracingIntegration())
    if (mod.browserProfilingIntegration) integrations.push(mod.browserProfilingIntegration())

    mod.init({
      dsn,
      environment:              import.meta.env.MODE,
      release:                  import.meta.env.VITE_APP_VERSION ?? 'unknown',
      tracesSampleRate:         import.meta.env.PROD ? 0.1 : 1.0,
      replaysSessionSampleRate: 0,  // privacy — no session replay
      replaysOnErrorSampleRate: 0,
      integrations,
      beforeSend: _scrubSentryEvent,
      beforeBreadcrumb(bc) {
        if (bc.level === 'debug') return null       // drop noisy debug breadcrumbs
        if (bc.message) bc.message = scrubPII(bc.message)
        if (bc.data)    bc.data    = scrubPII(bc.data)
        return bc
      },
    })
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[sentry] init failed:', e.message)
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Set user context. Hashes userId via djb2 — raw user_id never leaves the browser.
 */
export function setUserContext({ userId, tier, lang }) {
  if (!_sentry || !userId) return
  try {
    const user_hash = createHash(String(userId))
    _sentry.setUser({ id: user_hash })
    _sentry.setTag('user_hash', user_hash)
    if (tier) _sentry.setTag('tier', tier)
    if (lang) _sentry.setTag('lang', lang)
  } catch { /* ignore */ }
}

/**
 * Report an error. Context is PII-scrubbed before sending.
 */
export function captureError(error, context = {}) {
  if (!_sentry) return
  try {
    _sentry.captureException(
      error instanceof Error ? error : new Error(String(error)),
      { extra: scrubPII(context) },
    )
  } catch { /* never let Sentry crash the app */ }
}

// Legacy alias — ErrorBoundary calls captureException
export { captureError as captureException }

/**
 * Add a breadcrumb. Data is PII-scrubbed.
 */
export function addBreadcrumb(message, category, data) {
  if (!_sentry) return
  try {
    _sentry.addBreadcrumb({
      message:  typeof message === 'string' ? scrubPII(message) : message,
      category,
      data:     data ? scrubPII(data) : undefined,
      level:    'info',
    })
  } catch { /* ignore */ }
}

/** @deprecated Use setUserContext */
export function setUser(id) {
  if (id) setUserContext({ userId: id })
}

/** @deprecated */
export function clearUser() {
  if (!_sentry) return
  try { _sentry.setUser(null) } catch { /* ignore */ }
}
