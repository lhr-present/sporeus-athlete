// ─── src/lib/storage/local.js — Type-safe localStorage wrappers ───────────────
// All reads/writes are JSON-serialized. Errors return the provided default.
// Use these instead of raw localStorage.getItem/setItem everywhere in the app.

import { ALL_STATIC_KEYS } from './keys.js'

// ── getLocal ──────────────────────────────────────────────────────────────────
// Reads and JSON-parses a value from localStorage.
// Returns defaultValue if key is absent, parsing fails, or storage throws.
export function getLocal(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return defaultValue
    return JSON.parse(raw)
  } catch {
    return defaultValue
  }
}

// ── setLocal ──────────────────────────────────────────────────────────────────
// JSON-serializes and writes a value to localStorage.
// Silently swallows QuotaExceededError and other storage errors.
// Returns true on success, false on error.
export function setLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

// ── removeLocal ───────────────────────────────────────────────────────────────
// Removes a key from localStorage. Safe to call even if key doesn't exist.
export function removeLocal(key) {
  try {
    localStorage.removeItem(key)
  } catch { /* noop */ }
}

// ── clearAllAppData ───────────────────────────────────────────────────────────
// Removes app keys from localStorage. Called by GDPR deleteAthleteData(),
// "Reset app" in Profile, and sign-out (shared-device data hygiene).
// v9.359.0 — sweep EVERY `sporeus*` key, not just the static set: dynamic keys
// (sporeus-power-*, sporeus-week-*, sporeus-ai-*, sporeus-plan, consent flags,
// tab-visited/dismissed flags, …) were previously left behind, so GDPR delete
// was incomplete and a signed-out user's data could linger on a shared device.
// `keep` lets callers preserve non-PII UI prefs (e.g. language) on sign-out.
export function clearAllAppData(keep = []) {
  const keepSet = new Set(keep)
  // 1) the known static set (covers any key not `sporeus`-prefixed)
  for (const key of ALL_STATIC_KEYS) if (!keepSet.has(key)) removeLocal(key)
  // 2) plus every dynamic `sporeus*` key (power blobs, week/ai caches, plan,
  //    consent + tab-visited/dismissed flags) the static set doesn't enumerate.
  //    Use length/key(i) (works in browsers AND jsdom, unlike Object.keys);
  //    collect first, then remove (removing mid-iteration shifts indices).
  try {
    const dynamic = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sporeus') && !keepSet.has(key)) dynamic.push(key)
    }
    for (const key of dynamic) removeLocal(key)
  } catch { /* enumeration unavailable — static set above already handled */ }
}
