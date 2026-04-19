// src/lib/observability/piiScrubber.js
// E15 — Load-bearing PII scrubber for Sentry events.
// Pure function, zero dependencies, browser + Node compatible.
// Never lets personal data leave the browser via error telemetry.

// ── Patterns (ordered: JWT before bearer, both before generic tokens) ─────────
const JWT_RE         = /[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_.+/=]{10,}/g
const BEARER_RE      = /Bearer\s+[A-Za-z0-9\-_=+/.]{10,}/g
const APIKEY_RE      = /(?:sk-ant-|pk_live_|sk_live_)[A-Za-z0-9\-_]{8,}/g
const SUPABASE_TKN   = /[?&](?:access_token|refresh_token)=[^&\s#]*/g
const UUID_RE        = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi
const EMAIL_RE       = /[^\s@,;()<>[\]]{1,64}@[^\s@,;()<>[\]]{1,255}\.[^\s@,;()<>[\]]{2,63}/g
const PHONE_RE       = /\+[1-9]\d{6,14}\b/g
// 32+ hex but NOT preceded by # (color codes like #ff6600 are only 6 chars anyway, but guard anyway)
const HEX32_RE       = /(?<!#)\b([0-9a-f]{32,})\b/gi

function scrubString(s) {
  return s
    .replace(JWT_RE,        '[jwt]')
    .replace(BEARER_RE,     'Bearer [token]')
    .replace(APIKEY_RE,     '[api_key]')
    .replace(SUPABASE_TKN,  '')
    .replace(UUID_RE,       '[uuid]')
    .replace(EMAIL_RE,      '[email]')
    .replace(PHONE_RE,      '[phone]')
    .replace(HEX32_RE,      '[hash]')
}

/**
 * Recursively scrub PII from any value.
 * - Strings: redact emails, JWTs, API keys, UUIDs, phone numbers, hex hashes
 * - Plain objects: recurse into values
 * - Arrays: recurse into elements
 * - Date / Map / Set / Function: pass through unchanged
 * - depth cap = 3 prevents blowup on deep or circular structures
 *
 * @param {*} input
 * @param {number} [depth=3]
 * @returns {*} scrubbed copy (same type)
 */
export function scrubPII(input, depth = 3) {
  if (input === null || input === undefined) return input
  if (typeof input === 'string') return scrubString(input)
  if (typeof input !== 'object' && typeof input !== 'function') return input // number, boolean, etc.
  if (typeof input === 'function') return input
  if (input instanceof Date) return input
  if (input instanceof Map || input instanceof Set) return input

  if (depth <= 0) return '[depth limit]'

  if (Array.isArray(input)) {
    return input.map(item => scrubPII(item, depth - 1))
  }

  // Plain object
  const out = {}
  for (const [k, v] of Object.entries(input)) {
    out[k] = scrubPII(v, depth - 1)
  }
  return out
}
