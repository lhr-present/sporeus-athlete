// ─── src/lib/attribution.js — First-touch attribution capture ────────────────
// Zero deps. Adds < 1 KB gzipped to the main bundle.
//
// Flow:
//   1. On app mount: parseUtmFromLocation() + getOrCreateAnonId()
//   2. recordFirstTouch() — persists UTM context in localStorage (30d TTL)
//   3. emitEvent('landing', ...) — fire-and-forget POST to attribution-log fn
//   4. On signup: emitEvent('signup_completed') — fn stamps profiles.first_touch
//   5. On first session: emitEvent('first_session_logged')
//
// Attribution context travels:
//   URL params → localStorage(spa_first_touch, 30d TTL) → edge fn → DB row
//   On first auth event: DB stamps profiles.first_touch (never overwritten)

const ANON_KEY         = 'spa_anon'
const FIRST_TOUCH_KEY  = 'spa_first_touch'
const FIRST_TOUCH_TTL  = 30 * 24 * 60 * 60 * 1000  // 30 days ms
const SIGNUP_FIRED_KEY = 'spa_signup_fired'

// ── UUID v4 (browser crypto, no deps) ─────────────────────────────────────────
function uuidv4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ── getOrCreateAnonId — stable anonymous visitor ID ───────────────────────────
export function getOrCreateAnonId() {
  try {
    let id = localStorage.getItem(ANON_KEY)
    if (!id) {
      id = uuidv4()
      localStorage.setItem(ANON_KEY, id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

// ── parseUtmFromLocation — reads UTM params from current URL ──────────────────
// Returns only what's present; undefined keys are omitted.
export function parseUtmFromLocation(search = window.location.search) {
  const p = new URLSearchParams(search)
  const result = {}
  const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
  for (const k of keys) {
    const v = p.get(k)
    if (v) result[k] = v
  }
  // Strip known Supabase / OAuth noise from referrer
  const ref = (typeof document !== 'undefined' ? document.referrer : '') || ''
  if (ref && !ref.includes('supabase') && !ref.includes(window?.location?.hostname)) {
    result.referrer = ref
  }
  result.landing_path = window?.location?.pathname ?? '/'
  return result
}

// ── recordFirstTouch — saves UTM context in localStorage (no-op if present) ──
// Returns the stored first-touch object (new or existing).
export function recordFirstTouch(utmContext = {}) {
  try {
    const stored = localStorage.getItem(FIRST_TOUCH_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed && parsed.expires_at > Date.now()) return parsed.data
      // Expired — let it be overwritten below
    }
    const data = {
      ...utmContext,
      anon_id:     getOrCreateAnonId(),
      captured_at: new Date().toISOString(),
    }
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify({
      data,
      expires_at: Date.now() + FIRST_TOUCH_TTL,
    }))
    return data
  } catch {
    return utmContext
  }
}

// ── getFirstTouch — read stored first-touch (may be expired) ─────────────────
export function getFirstTouch() {
  try {
    const stored = localStorage.getItem(FIRST_TOUCH_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    return parsed?.data ?? null
  } catch {
    return null
  }
}

// ── classifyUserAgent — coarse UA class for segmentation ─────────────────────
function classifyUserAgent() {
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/Mobile/i.test(ua)) return 'mobile_other'
  return 'desktop'
}

// ── emitEvent — fire-and-forget POST to attribution-log edge function ─────────
// Never throws. Non-blocking.
export function emitEvent(eventName, extraProps = {}, supabaseUrl = null) {
  try {
    const firstTouch = getFirstTouch() || {}
    const payload = {
      anon_id:    getOrCreateAnonId(),
      event_name: eventName,
      utm_source:     firstTouch.utm_source,
      utm_medium:     firstTouch.utm_medium,
      utm_campaign:   firstTouch.utm_campaign,
      utm_content:    firstTouch.utm_content,
      utm_term:       firstTouch.utm_term,
      referrer:       firstTouch.referrer,
      landing_path:   firstTouch.landing_path,
      user_agent_class: classifyUserAgent(),
      first_touch:    firstTouch,
      props: extraProps,
    }

    const base = supabaseUrl
      || (typeof window !== 'undefined' && window.__SUPABASE_URL__)
      || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL)

    if (!base) return  // local-only / no Supabase config — skip silently

    const url = `${base}/functions/v1/attribution-log`
    const anonKey = typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_SUPABASE_ANON_KEY
      : null

    // fire-and-forget — we don't care about the response
    fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(anonKey ? { 'apikey': anonKey } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,  // survives page unload
    }).catch(() => { /* intentionally swallowed */ })
  } catch {
    // Attribution must never break the app
  }
}

// ── hasSignupFired — prevent duplicate signup events ─────────────────────────
export function hasSignupFired() {
  try { return localStorage.getItem(SIGNUP_FIRED_KEY) === '1' } catch { return false }
}
export function markSignupFired() {
  try { localStorage.setItem(SIGNUP_FIRED_KEY, '1') } catch { /* ignore */ }
}
