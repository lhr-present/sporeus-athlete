// ─── whiteLabel.js — White-label config for Club-tier orgs ───────────────────
// Loads branding from Supabase org_branding table on init.
// Falls back to Sporeus defaults.

import { supabase, isSupabaseReady } from './supabase.js'

const DEFAULTS = {
  primaryColor: '#ff6600',
  appName:      'Sporeus Athlete',
  logoUrl:      '',
}

let _theme = { ...DEFAULTS }
let _loaded = false

// ── applyTheme(theme) — sets CSS vars + document title ────────────────────────
export function applyTheme(theme) {
  _theme = { ...DEFAULTS, ...theme }
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--brand-primary', _theme.primaryColor)
  root.style.setProperty('--brand-name',    _theme.appName)
  document.title = _theme.appName
}

// ── getTheme() → { primaryColor, appName, logoUrl } ──────────────────────────
export function getTheme() {
  return { ..._theme }
}

// ── isWhiteLabel() → boolean ──────────────────────────────────────────────────
export function isWhiteLabel() {
  return _theme.primaryColor !== DEFAULTS.primaryColor ||
         _theme.appName      !== DEFAULTS.appName      ||
         !!_theme.logoUrl
}

// ── loadOrgBranding(orgId) — fetch from Supabase, apply, return theme ─────────
export async function loadOrgBranding(orgId) {
  // Apply defaults first (instant)
  applyTheme(DEFAULTS)

  if (!orgId || !isSupabaseReady()) return _theme

  try {
    const { data, error } = await supabase
      .from('org_branding')
      .select('primary_color, logo_url, app_name')
      .eq('org_id', orgId)
      .maybeSingle()

    if (error || !data) return _theme

    applyTheme({
      primaryColor: data.primary_color || DEFAULTS.primaryColor,
      appName:      data.app_name      || DEFAULTS.appName,
      logoUrl:      data.logo_url      || '',
    })
    _loaded = true
  } catch {}

  return _theme
}

// ── initWhiteLabel(authUser) — call on app load after auth resolves ────────────
export async function initWhiteLabel(authUser) {
  if (_loaded) return _theme
  if (!authUser) { applyTheme(DEFAULTS); return _theme }
  return loadOrgBranding(authUser.id)
}
