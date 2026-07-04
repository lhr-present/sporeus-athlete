// src/lib/athlete/maxHrNudge.js
//
// v9.471.0 (E5a) — "New max HR detected" profile nudge detector.
//
// Per-session max_hr is stored + hydrated since the v9.465 Strava enrichment
// (entry.maxHR; FIT imports carry it too), but nothing compared it to
// profile.maxhr — the number every HR zone + TRIMP-TSS calc runs on. An
// athlete whose profile says 185 while their sessions hit 195 has every zone
// and load number skewed low.
//
// Pure detector + localStorage dismissal helpers. The athlete decides — the
// nudge offers a one-tap update, never an automatic overwrite. Dismissal is
// keyed by the observed value, so a NEW higher max re-nudges.

/**
 * @description Detect a session max HR that exceeds the profile max.
 *   Requires the entry to also carry avgHR (a real HR-recorded session — a
 *   maxHR spike without an HR stream context is noise) and a plausible value.
 *
 * @param {Array<Object>} log     - training log entries (entry.maxHR, entry.avgHR)
 * @param {Object}        profile - profile with maxhr
 * @returns {{ observedMax: number, entryDate: string } | null}
 */
export function detectNewMaxHr(log, profile) {
  const profileMax = Number(profile?.maxhr)
  if (!Number.isFinite(profileMax) || profileMax <= 0) return null

  let observedMax = 0
  let entryDate = null
  for (const e of Array.isArray(log) ? log : []) {
    const mhr = Number(e?.maxHR)
    const ahr = Number(e?.avgHR)
    if (!Number.isFinite(mhr) || mhr <= 0) continue
    if (!Number.isFinite(ahr) || ahr <= 0) continue     // real HR session only
    if (mhr < ahr || mhr > 250) continue                // implausible / corrupt
    if (mhr > observedMax) { observedMax = mhr; entryDate = e.date || null }
  }

  // ≥2 bpm above profile: a 1-bpm excursion is within device noise.
  if (observedMax >= profileMax + 2) return { observedMax, entryDate }
  return null
}

const DISMISS_PREFIX = 'sporeus-maxhr-nudge-dismissed-'

/** @description True when the athlete dismissed a nudge for this value or higher. */
export function isMaxHrNudgeDismissed(observedMax) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(DISMISS_PREFIX)) continue
      const dismissed = Number(k.slice(DISMISS_PREFIX.length))
      if (Number.isFinite(dismissed) && dismissed >= observedMax) return true
    }
  } catch { /* localStorage unavailable → never dismissed */ }
  return false
}

/** @description Persist a dismissal for this observed value (higher values re-nudge). */
export function dismissMaxHrNudge(observedMax) {
  try { localStorage.setItem(DISMISS_PREFIX + observedMax, '1') } catch { /* best-effort */ }
}
