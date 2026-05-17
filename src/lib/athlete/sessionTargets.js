// src/lib/athlete/sessionTargets.js
//
// Pure-fn target preview for a planned session.
//
// Goal: given today's planned session + the athlete's physiology inputs,
// emit a sport-aware target preview consumed by the TodayView peek:
//   - Run sessions  → pace window  "4:35–4:45 /km"   (Daniels 2014)
//   - Bike sessions → power window "220–245 W"        (Coggan & Allen 2010)
//   - Swim sessions → pace window  "1:38–1:45 /100m"  (Wakayoshi 1992)
//   - HR window (secondary)        "145–155 BPM"      (Karvonen 1957 / Tanaka 2001)
//   - Target IF (single number)    0.85 (rpe-anchored, Coggan 2003)
//
// This module is a thin formatter over `derivedSessionTargets`, which already
// owns the zone math (Z1–Z6 offsets, % FTP, % CSS, % maxHR). We keep that
// single source of truth and only add:
//   1) display-unit suffixes ("/km", " W", "/100m", " BPM"), and
//   2) VDOT fallback for runners whose profile doesn't carry threshold pace
//      but does carry VDOT (via Daniels' table in vdot.js).
//
// Pure functions, no React, no side effects.
//
// Citations:
//   - Daniels, J. (2014). Daniels' Running Formula (3rd ed.).
//   - Allen, H. & Coggan, A. (2010). Training and Racing with a Power Meter.
//   - Wakayoshi, K. et al. (1992). Determination and validity of critical
//     velocity as swimming fatigue threshold.

import {
  deriveSessionPace,
  deriveSessionPower,
  deriveSessionSwimPace,
  deriveSessionHr,
} from './derivedSessionTargets.js'
import { getTrainingPaces } from '../vdot.js'

export const CITATION = {
  run:  'Daniels 2014 — Daniels’ Running Formula',
  bike: 'Coggan & Allen 2010 — Training and Racing with a Power Meter',
  swim: 'Wakayoshi 1992 — Critical Swimming Speed',
}

// ── Sport detection ─────────────────────────────────────────────────────────
//
// Detect the sport in this order:
//   1) `plannedSession.sport` (explicit field, e.g. 'run')
//   2) `plannedSession.type` keyword match (e.g. 'Tempo run', 'Bike intervals')
//   3) `profile.primarySport` (fallback when session text is ambiguous)
//
// Returns one of: 'run' | 'bike' | 'swim' | null.
function detectSport(plannedSession, profile) {
  const explicit = String(plannedSession?.sport || '').toLowerCase()
  if (explicit.includes('run'))                                return 'run'
  if (/cycl|bike|ride/.test(explicit))                          return 'bike'
  if (explicit.includes('swim'))                                return 'swim'

  // Sport-specific keywords on the session type. We intentionally keep this
  // list tight — generic intensity words ("tempo", "threshold", "intervals")
  // don't disambiguate (a cyclist can do threshold intervals too). Only
  // unambiguous sport tokens trigger a match before we fall through to
  // profile.primarySport.
  const typeStr = String(plannedSession?.type || plannedSession?.intent || '').toLowerCase()
  if (/swim|css/.test(typeStr))                                 return 'swim'
  if (/bike|cycl|ride|ftp/.test(typeStr))                       return 'bike'
  if (/\brun\b|jog/.test(typeStr))                              return 'run'

  const primary = String(profile?.primarySport || profile?.sport || '').toLowerCase()
  if (primary.includes('run'))                                  return 'run'
  if (/cycl|bike/.test(primary))                                return 'bike'
  if (primary.includes('swim'))                                 return 'swim'
  return null
}

// Build a sport-coherent profile clone so the inner `derivedSessionTargets`
// helpers (which key on `profile.primarySport`) agree with the outer sport
// decision. This matters for cross-training cases — e.g. a cyclist whose
// session.type explicitly says "Easy run" should compute run pace, not be
// short-circuited by `isCyclingSession` returning true on primarySport.
function profileForSport(profile, sport) {
  if (!profile) return profile
  const SPORT_TO_PRIMARY = { run: 'running', bike: 'cycling', swim: 'swimming' }
  const next = SPORT_TO_PRIMARY[sport]
  if (!next) return profile
  return { ...profile, primarySport: next }
}

// ── Zone inference (matches derivedSessionTargets) ──────────────────────────
function zoneOf(session) {
  if (typeof session?.zone === 'string') {
    const z = session.zone.toUpperCase()
    if (/^Z[1-6]$/.test(z)) return z
  }
  if (session?.zones && typeof session.zones === 'object') {
    for (const z of ['Z5', 'Z4', 'Z3', 'Z2', 'Z1']) {
      if (Number(session.zones[z]) > 0) return z
    }
  }
  return null
}

// ── Format seconds-per-km into "M:SS" ───────────────────────────────────────
function secToPace(totalSec) {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return null
  const min = Math.floor(totalSec / 60)
  const sec = Math.round(totalSec % 60)
  if (sec === 60) return `${min + 1}:00`
  return `${min}:${String(sec).padStart(2, '0')}`
}

// ── VDOT fallback for runners with no threshold pace ────────────────────────
//
// `derivedSessionTargets` keys on `profile.threshold` (mm:ss). When the
// athlete has only `profile.vdot` set, we derive the same per-zone window
// from Daniels' training paces table. Pace values are sec/km.
//
// Daniels' zone → training-pace anchor mapping:
//   Z1 (easy)       → easy        ± 0           (single pace band)
//   Z2 (marathon)   → marathon    ± 5           (small band)
//   Z3 (tempo)      → threshold   + 8..15 (slower than T)
//   Z4 (threshold)  → threshold   ± 5
//   Z5 (interval)   → interval    ± 5
//   Z6 (rep)        → rep         ± 5
//
// Returns a pace-range string (e.g. "4:25–4:35") or null.
function paceFromVdot(zone, vdot) {
  const v = Number(vdot)
  if (!Number.isFinite(v) || v < 30 || v > 85) return null
  if (!zone) return null
  const paces = getTrainingPaces(v)
  if (!paces) return null
  let loSec, hiSec
  switch (zone) {
    case 'Z1':
      loSec = paces.easy
      hiSec = paces.easy
      break
    case 'Z2':
      loSec = paces.marathon - 5
      hiSec = paces.marathon + 5
      break
    case 'Z3':
      loSec = paces.threshold + 8
      hiSec = paces.threshold + 15
      break
    case 'Z4':
      loSec = paces.threshold - 5
      hiSec = paces.threshold + 5
      break
    case 'Z5':
      loSec = paces.interval - 5
      hiSec = paces.interval + 5
      break
    case 'Z6':
      loSec = paces.rep - 5
      hiSec = paces.rep + 5
      break
    default:
      return null
  }
  const fast = secToPace(Math.min(loSec, hiSec))
  const slow = secToPace(Math.max(loSec, hiSec))
  if (!fast || !slow) return null
  return fast === slow ? fast : `${fast}–${slow}`
}

// ── IF target derivation ────────────────────────────────────────────────────
//
// Two signals feed the IF target:
//   1) An explicit `intensityFactor` on the session (rare but authoritative).
//   2) The RPE-to-IF mapping (Foster 1998 session-RPE → Coggan IF).
//   3) Zone-based fallback when RPE is missing (Z1=0.55, Z4=0.95, etc.).
//
// Returns a number rounded to 2 dp, or null when no signal is available.
const RPE_TO_IF = {
  1: 0.50, 2: 0.55, 3: 0.60, 4: 0.65, 5: 0.70,
  6: 0.80, 7: 0.85, 8: 0.92, 9: 0.98, 10: 1.05,
}
const ZONE_TO_IF = {
  Z1: 0.55, Z2: 0.70, Z3: 0.83, Z4: 0.95, Z5: 1.05, Z6: 1.15,
}
function deriveIfTarget(session) {
  if (!session) return null
  const explicit = Number(session.intensityFactor)
  if (Number.isFinite(explicit) && explicit > 0 && explicit < 2) {
    return Math.round(explicit * 100) / 100
  }
  const rpeRaw = Number(session.rpe)
  if (Number.isFinite(rpeRaw) && rpeRaw >= 1 && rpeRaw <= 10) {
    const rpeKey = Math.round(rpeRaw)
    const mapped = RPE_TO_IF[rpeKey]
    if (mapped != null) return mapped
  }
  const zone = zoneOf(session)
  if (zone && ZONE_TO_IF[zone] != null) return ZONE_TO_IF[zone]
  return null
}

// ── Public API ──────────────────────────────────────────────────────────────
/**
 * Build a sport-aware target preview for the planned session.
 *
 * Returns null when:
 *   - no planned session, or
 *   - sport can't be inferred, or
 *   - the athlete's physiology inputs (VDOT/threshold for run, FTP for bike,
 *     CSS for swim) are not set so no target can be computed.
 *
 * @param {object} args
 * @param {object|null} args.plannedSession - { type, zone, zones, rpe, intent, ... }
 * @param {object|null} args.profile - { vdot, threshold, thresholdDerived, ftp,
 *                                       cssSec, maxhr, primarySport, ... }
 * @returns {{
 *   paceTarget:  string|null,
 *   powerTarget: string|null,
 *   hrTarget:    string|null,
 *   ifTarget:    number|null,
 *   sport:       'run'|'bike'|'swim',
 *   sourceLabel: string,
 * } | null}
 */
export function buildSessionTarget({ plannedSession, profile } = {}) {
  if (!plannedSession || !profile) return null
  const sport = detectSport(plannedSession, profile)
  if (!sport) return null

  let paceTarget = null
  let powerTarget = null
  let hrTarget = null

  // Inner helpers read profile.primarySport for their own sport gate. When we
  // disagree with primarySport (cross-training session), pass a coherent
  // clone so the helper doesn't short-circuit.
  const inner = profileForSport(profile, sport)

  if (sport === 'run') {
    // Prefer threshold-pace path (derivedSessionTargets handles
    // thresholdDerived fallback already). Fall back to VDOT when threshold
    // isn't set but VDOT is.
    const rawPace = deriveSessionPace(plannedSession, inner)
    if (rawPace) {
      paceTarget = `${rawPace} /km`
    } else {
      const zone = zoneOf(plannedSession)
      const vdotPace = paceFromVdot(zone, profile.vdot)
      if (vdotPace) paceTarget = `${vdotPace} /km`
    }
    const rawHr = deriveSessionHr(plannedSession, inner)
    if (rawHr) hrTarget = `${rawHr} BPM`
  } else if (sport === 'bike') {
    const rawPower = deriveSessionPower(plannedSession, inner)
    if (rawPower) {
      // derivedSessionTargets emits "228–263W" (no space). Spec wants "220–245 W".
      powerTarget = rawPower.replace(/W$/, ' W')
    }
  } else if (sport === 'swim') {
    const rawSwim = deriveSessionSwimPace(plannedSession, inner)
    if (rawSwim) {
      // derivedSessionTargets emits "1:30–1:39/100m". Spec wants "1:38–1:45 /100m".
      paceTarget = rawSwim.replace(/\/100m$/, ' /100m')
    }
  }

  const ifTarget = deriveIfTarget(plannedSession)

  // If no signal at all, return null so the peek can collapse.
  if (paceTarget == null && powerTarget == null && hrTarget == null && ifTarget == null) {
    return null
  }

  return {
    paceTarget,
    powerTarget,
    hrTarget,
    ifTarget,
    sport,
    sourceLabel: CITATION[sport],
  }
}
