// src/lib/athlete/dailyRecommendation.js
//
// v9.93.0 — Mission 1 chain: PLAN → DAILY ANSWER, no-plan branch.
//
// The legacy TodayView "no plan" branch was a dead end: an athlete without
// a generated plan saw "No plan active — generate one" and a button to the
// PLAN tab. Nothing else. The whole chain stalled.
//
// This module wraps the existing `getSingleSuggestion` heuristic (wellness +
// ACWR + TSB rules, intelligence.js) and shapes its output into a renderable
// session object — same shape TodayView already consumes when a plan exists.
// It plugs into the rest of the Mission 1 chain:
//   - v9.92 sportSpecificLabel → sport-aware title (Long ride vs Long run)
//   - v9.91 deriveSessionTargets → pace/power from threshold/FTP
//
// So an athlete with no plan still gets:
//   1. A specific session intent + zone + duration
//   2. Sport-specific title
//   3. Pace or power target (if physiology is set)
//   4. Rationale that cites WHICH signal triggered the recommendation
//
// Pure function. No side effects.

import { getSingleSuggestion } from '../intelligence.js'
import { sportSpecificLabel } from '../plan/generatePlan.js'

// ── getSingleSuggestion `source` → plan-shape session attributes ─────────────
// `source` values are produced by intelligence.js:732 — see that function for
// the rule order. We map each source to a normalized intent/zone/RPE so
// downstream consumers (sportSpecificLabel, deriveSessionTargets) work without
// any source-awareness of their own.
const SOURCE_TO_INTENT = {
  wellness_poor: 'recovery',  // wellness ≤2/5 — autonomic recovery first
  acwr_high:     'recovery',  // ACWR >1.3 — injury-risk zone
  tsb_high:      'vo2',       // TSB >+15 — freshness window for hard session
  acwr_low:      'tempo',     // ACWR <0.8 — base drifting, increase density
  tsb_low:       'recovery',  // TSB <-15 — fatigue, reduce intensity
  default:       'endurance', // normal range — aerobic
}

const SOURCE_TO_ZONE = {
  wellness_poor: 'Z1',
  acwr_high:     'Z1',
  tsb_high:      'Z5',
  acwr_low:      'Z3',
  tsb_low:       'Z1',
  default:       'Z2',
}

const SOURCE_TO_RPE = {
  wellness_poor: 4,
  acwr_high:     4,
  tsb_high:      8,
  acwr_low:      6,
  tsb_low:       4,
  default:       5,
}

// Turkish rationales (English is what getSingleSuggestion already returns).
// Keeping them short — the citation/source is shown alongside.
const RATIONALE_TR = {
  wellness_poor: 'İyilik düşük — otonom toparlanma önceliklidir',
  acwr_high:     'ACWR yüksek — sakatlık riski bölgesi',
  tsb_high:      'TSB yüksek — sert antrenman için tazelik penceresi',
  acwr_low:      'ACWR düşük — kronik temel düşüyor, yoğunluk ekle',
  tsb_low:       'TSB düşük — yorgunluk birikmiş, yoğunluğu düşür',
  default:       'Normal antrenman aralığında',
}

/**
 * Build a session-shape recommendation for an athlete without a generated
 * plan. Returns the same shape TodayView expects from plan sessions.
 *
 * @param {object}   args
 * @param {Array}    args.log       - training log entries
 * @param {Array}    args.recovery  - recovery / wellness entries
 * @param {object}   args.profile   - athlete profile (threshold, ftp, primarySport)
 * @param {string}   [args.lang='en'] - 'en' | 'tr'
 * @param {boolean}  [args.forceEasy=false] - SAFETY INV-1: when this rec is
 *                   consumed as a DOWNGRADE (the swap path floors a hard
 *                   planned session to recovery), a derived `hard` rec must
 *                   never slip through. `getSingleSuggestion`'s tsb_high rule
 *                   returns load:'hard'/Z5/RPE8 whenever TSB >15 (e.g. an
 *                   injury/HRV swap on a fresh-but-tapered athlete), which would
 *                   render a HARDER session under a "downgrade to easy" banner.
 *                   With forceEasy, any `hard` rec is replaced by an easy
 *                   Z1–Z2 recovery target (RPE 4) before shaping.
 * @returns {object|null} renderable session OR null if heuristic returns null
 *
 * Shape:
 *   {
 *     intent:    'endurance' | 'tempo' | 'vo2' | 'recovery' | ...
 *     type:      string                — sport-specific title (e.g. "Long ride")
 *     zone:      'Z1' | 'Z2' | ... | 'Z5'
 *     duration:  number                — minutes
 *     rpe:       number                — midpoint RPE for the zone
 *     rationale: string                — why this session (bilingual)
 *     load:      'none' | 'easy' | 'moderate' | 'hard'
 *     source:    string                — getSingleSuggestion rule id
 *   }
 */
export function buildDailyRecommendation({ log, recovery, profile, lang = 'en', forceEasy = false } = {}) {
  const sug = getSingleSuggestion(log, recovery, profile)
  if (!sug) return null

  let source = sug.source || 'default'
  let intent = SOURCE_TO_INTENT[source] || 'endurance'
  let zone   = SOURCE_TO_ZONE[source]   || 'Z2'
  let rpe    = SOURCE_TO_RPE[source]    || 5
  let load   = sug.load
  let baseDuration = Number(sug.duration) > 0
    ? Math.round(sug.duration)
    : (source === 'wellness_poor' ? 0 : 45)
  let baseRationale = lang === 'tr'
    ? (RATIONALE_TR[source] || sug.rationale)
    : sug.rationale

  // ── SAFETY INV-1: downgrade floor ─────────────────────────────────────────
  // When this rec is being used as a downgrade (forceEasy), a `hard` load is a
  // contradiction — it would prescribe a harder session under an
  // "auto-downgraded · evidence-based" banner. Floor it to an easy Z1–Z2
  // recovery target. We keep the underlying source for telemetry but override
  // the prescribed load/zone/intent/RPE and shorten the duration.
  if (forceEasy && load === 'hard') {
    intent = 'recovery'
    zone   = 'Z2'
    rpe    = 4
    load   = 'easy'
    baseDuration = Math.min(baseDuration || 45, 45)
    baseRationale = lang === 'tr'
      ? 'İndirgeme: tazelik var ama bugün sert seans önerilmiyor — kolay Z1–Z2 toparlanma'
      : 'Downgrade: freshness is present, but a hard session is not advised here — easy Z1–Z2 recovery'
  }

  const sport = profile?.primarySport || null
  const title = sportSpecificLabel(intent, sport, lang)

  return {
    intent,
    type:      title,
    zone,
    duration:  baseDuration,
    rpe,
    rationale: baseRationale,
    load,
    source,
  }
}
