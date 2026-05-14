// src/lib/athlete/bannerSnooze.js
//
// v9.126.0 — Shared 7-day snooze for dismissible alert banners.
//
// Decoupling (v9.123), polarized (v9.125), and retrospective (v9.120)
// banners each fire whenever the underlying condition is met. Without
// a dismiss affordance, an athlete rebuilding aerobic base sees the
// decoupling alert daily for 3 weeks — long after they've internalized
// the message. Banner fatigue is real.
//
// This module centralizes the snooze pattern so every banner uses the
// same localStorage convention + TTL. Banners check `isSnoozed(key)`
// before rendering; the [×] button calls `snooze(key)`. After 7 days
// the snooze expires and the banner re-fires (assuming the condition
// is still met).
//
// Why 7 days: long enough that re-firing isn't nagging, short enough
// that a still-concerning trend resurfaces within the next training
// week. Same window v9.115's draft-confirm rationale used implicitly.
//
// Pure functions over localStorage. Tests run under jsdom.

const SNOOZE_TTL_MS = 7 * 86400000

function keyFor(slot) {
  return `sporeus-banner-snooze-${slot}`
}

/**
 * @description Check if a banner slot is currently snoozed. Reads
 *   localStorage; returns false on parse errors / missing values.
 *   Safe to call during render — synchronous, no side-effects.
 *
 * @param {string} slot - banner identifier (e.g. 'decoupling', 'polarized', 'retro-2026-05-10')
 * @param {number} [now] - injected epoch ms for testing; defaults to Date.now()
 */
export function isBannerSnoozed(slot, now) {
  if (!slot) return false
  const tNow = Number.isFinite(now) ? now : Date.now()
  try {
    const raw = localStorage.getItem(keyFor(slot))
    if (!raw) return false
    const ts = Number(JSON.parse(raw)?.ts)
    if (!Number.isFinite(ts)) return false
    return (tNow - ts) < SNOOZE_TTL_MS
  } catch {
    return false
  }
}

/**
 * @description Mark a banner slot as snoozed for the next 7 days.
 *   Stores `{ ts: epochMs }`. Idempotent — re-snoozing within the
 *   window resets the timer (acceptable: athlete explicit gesture).
 */
export function snoozeBanner(slot, now) {
  if (!slot) return
  const ts = Number.isFinite(now) ? now : Date.now()
  try {
    localStorage.setItem(keyFor(slot), JSON.stringify({ ts }))
  } catch {
    /* fail open — banner re-renders, no worse than pre-v9.126 */
  }
}

/**
 * @description Clear a snooze. Not used by current UI but exposed for
 *   future "restore alerts" affordance and for test cleanup.
 */
export function clearBannerSnooze(slot) {
  if (!slot) return
  try { localStorage.removeItem(keyFor(slot)) } catch { /* ignore */ }
}

export const BANNER_SNOOZE_TTL_MS = SNOOZE_TTL_MS
