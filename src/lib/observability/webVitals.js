// src/lib/observability/webVitals.js
// E15 — Core Web Vitals → Plausible analytics pipe.
// No-ops when window.plausible is absent (respects tracker blockers / DNT users).

import { onCLS, onLCP, onINP, onFCP, onTTFB } from 'web-vitals'

// Rating thresholds (official Google/w3c definitions)
const THRESHOLDS = {
  CLS:  { good: 0.1,  poor: 0.25 },
  LCP:  { good: 2500, poor: 4000 },
  INP:  { good: 200,  poor: 500  },
  FCP:  { good: 1800, poor: 3000 },
  TTFB: { good: 800,  poor: 1800 },
}

function rate(name, value) {
  const t = THRESHOLDS[name]
  if (!t) return 'unknown'
  if (value <= t.good) return 'good'
  if (value <= t.poor) return 'needs-improvement'
  return 'poor'
}

function sendToPlausible(name, rawValue) {
  if (typeof window === 'undefined' || !window.plausible) return
  // CLS is a dimensionless score; multiply ×1000 so integer storage is meaningful.
  const value_ms = name === 'CLS'
    ? Math.round(rawValue * 1000)
    : Math.round(rawValue)
  window.plausible('web_vital', { props: { name, value_ms, rating: rate(name, rawValue) } })
}

let _initialized = false

/**
 * Wire up all CWV listeners. Idempotent — safe to call more than once.
 */
export function initWebVitals() {
  if (_initialized) return
  _initialized = true

  onCLS(({ value })  => sendToPlausible('CLS',  value))
  onLCP(({ value })  => sendToPlausible('LCP',  value))
  onINP(({ value })  => sendToPlausible('INP',  value))
  onFCP(({ value })  => sendToPlausible('FCP',  value))
  onTTFB(({ value }) => sendToPlausible('TTFB', value))
}

// Strip UUIDs and numeric IDs from paths so they don't create unique Plausible events.
const UUID_PATH_RE  = /\/[0-9a-f]{8,}(?:-[0-9a-f]{4,}){2,5}/gi
const NUM_SEGMENT_RE = /\/\d{4,}/g

function scrubbedPath(path) {
  if (!path) return path
  return path.replace(UUID_PATH_RE, '/:id').replace(NUM_SEGMENT_RE, '/:id')
}

/**
 * Track a client-side route change.
 */
export function trackRouteChange(from, to) {
  if (typeof window === 'undefined' || !window.plausible) return
  window.plausible('route_change', { props: { from: scrubbedPath(from), to: scrubbedPath(to) } })
}
