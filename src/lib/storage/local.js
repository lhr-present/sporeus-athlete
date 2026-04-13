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
// Removes every known app key from localStorage.
// Called by GDPR deleteAthleteData() and "Reset app" in Profile.
export function clearAllAppData() {
  for (const key of ALL_STATIC_KEYS) {
    removeLocal(key)
  }
}
