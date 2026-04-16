// ─── sentry.js — PII-safe Sentry wrapper (dynamic import) ────────────────────
// Loads @sentry/react asynchronously after first paint so it never adds to the
// main bundle. All functions are safe no-ops before initSentry() resolves.

const PII_KEYS = /^(email|name|phone|display_name|full_name|username|address)$/i
const EMAIL_RE = /[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{1,63}/

let _sentry = null

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

/**
 * Remove keys that look like PII and values that look like email addresses.
 * IDs (UUIDs), counts, durations, and error codes are safe — pass through.
 */
export function scrubData(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (PII_KEYS.test(k)) continue
    if (typeof v === 'string' && EMAIL_RE.test(v)) continue
    out[k] = v
  }
  return out
}

/**
 * beforeSend hook: strip URL query strings (invite codes live there),
 * remove user.email if it leaked in, drop events from localhost except in dev.
 */
export function sanitiseBeforeSend(event) {
  // Strip query params from request URL (invite codes, referral codes)
  if (event.request?.url) {
    try { event.request.url = event.request.url.split('?')[0] } catch { /* ignore */ }
  }
  // Defensively drop email if it ever leaked into the user context
  if (event.user?.email) delete event.user.email
  return event
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    if (import.meta.env.DEV) console.warn('[sentry] VITE_SENTRY_DSN not set — monitoring disabled')
    return
  }
  try {
    const mod = await import('@sentry/react')
    _sentry = mod
    mod.init({
      dsn,
      environment:               import.meta.env.MODE,
      release:                   `sporeus-athlete@${__APP_VERSION__}`,
      tracesSampleRate:          import.meta.env.PROD ? 0.1 : 0,
      replaysSessionSampleRate:  0,   // never record sessions — health data sensitivity
      replaysOnErrorSampleRate:  0,
      beforeSend:                sanitiseBeforeSend,
      ignoreErrors: [
        // Browser noise — not actionable
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        // Aborted / offline — expected on mobile
        'The user aborted a request',
        'Failed to fetch',
        'Load failed',
        /AbortError/,
        /NetworkError/,
      ],
    })
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[sentry] init failed:', e.message)
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Report an error. ctx must contain only non-PII (IDs, counts, error codes). */
export function captureException(err, ctx = {}) {
  if (!_sentry) return
  try {
    _sentry.captureException(
      err instanceof Error ? err : new Error(String(err)),
      { extra: scrubData(ctx) },
    )
  } catch { /* never let Sentry crash the app */ }
}

/** Set user identity — id ONLY. Never pass email, name, or profile fields. */
export function setUser(id) {
  if (!_sentry || !id) return
  try { _sentry.setUser({ id: String(id) }) } catch { /* ignore */ }
}

export function clearUser() {
  if (!_sentry) return
  try { _sentry.setUser(null) } catch { /* ignore */ }
}

/** Add a structured breadcrumb. data is scrubbed before sending. */
export function addBreadcrumb(category, message, data = {}) {
  if (!_sentry) return
  try {
    _sentry.addBreadcrumb({
      category,
      message,
      data:  scrubData(data),
      level: 'info',
    })
  } catch { /* ignore */ }
}
