// ─── sessionVariety.js — E122: Session Variety Detector (28d window) ────────
// Classifies each logged session into one of 5 intents (recovery, long, steady,
// tempo, intervals) based on RPE, duration and zone distribution, and surfaces
// athletes whose training mix is too narrow.
// Complements staleZones.js (intensity gaps) and workoutDensity.js (load
// density) — those detect WHERE the volume goes; this one detects WHAT KIND
// of sessions are being trained.
// Based on Seiler 2010 (polarized training) + Foster 2001 (session RPE).
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_VARIETY_CITATION = 'Seiler 2010; Foster 2001'

const ALL_INTENTS = ['recovery', 'long', 'steady', 'tempo', 'intervals']

const INTENT_LABELS_TR = {
  recovery: 'toparlanma',
  long: 'uzun',
  steady: 'sabit',
  tempo: 'tempo',
  intervals: 'intervaller',
}

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
/**
 * Add `days` to a 'YYYY-MM-DD' string and return new 'YYYY-MM-DD' (UTC).
 */
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Zone parsing ────────────────────────────────────────────────────────────
/**
 * Extract zone shares (Z1..Z5 each as a fraction of total, sums to 1 when any
 * data is present, otherwise all zeros). Mirrors the parsing pattern used in
 * staleZones.js / workoutDensity.js.
 *
 * Supports two zone shapes:
 *   1. entry.zones is an array of 5 numbers [Z1,Z2,Z3,Z4,Z5]
 *   2. entry.zones is an object {Z1,..,Z5} or {z1,..,z5}
 *
 * @param {Object} entry
 * @returns {{ shares: [number,number,number,number,number], hasZones: boolean }}
 */
function entryZoneShares(entry) {
  const z = entry?.zones
  let z1 = 0, z2 = 0, z3 = 0, z4 = 0, z5 = 0
  let hasZones = false

  if (Array.isArray(z) && z.some(v => Number(v) > 0)) {
    z1 = Number(z[0]) || 0
    z2 = Number(z[1]) || 0
    z3 = Number(z[2]) || 0
    z4 = Number(z[3]) || 0
    z5 = Number(z[4]) || 0
    hasZones = true
  } else if (z && typeof z === 'object') {
    z1 = Number(z.Z1 ?? z.z1 ?? 0) || 0
    z2 = Number(z.Z2 ?? z.z2 ?? 0) || 0
    z3 = Number(z.Z3 ?? z.z3 ?? 0) || 0
    z4 = Number(z.Z4 ?? z.z4 ?? 0) || 0
    z5 = Number(z.Z5 ?? z.z5 ?? 0) || 0
    hasZones = (z1 + z2 + z3 + z4 + z5) > 0
  }

  const total = z1 + z2 + z3 + z4 + z5
  if (total <= 0) return { shares: [0, 0, 0, 0, 0], hasZones: false }
  return {
    shares: [z1 / total, z2 / total, z3 / total, z4 / total, z5 / total],
    hasZones,
  }
}

// ─── Session intent classifier ───────────────────────────────────────────────
/**
 * Classify a single session into one of:
 *   - 'recovery'  : RPE <= 3 AND duration <= 60 min
 *   - 'long'      : duration >= 90 min AND RPE <= 5  (precedence over steady)
 *   - 'steady'    : RPE 4-5, duration 30-90 min, Z2-dominant
 *   - 'tempo'     : RPE 6-7, duration 30-75 min, Z3+ dominant
 *   - 'intervals' : RPE >= 7, duration < 60 min, Z4+Z5 share > 30%
 *   - null        : doesn't match any rule (e.g. NaN RPE, strength session…)
 *
 * Ordering matters — recovery first (low-RPE short), then long (precedence),
 * then intervals (RPE >= 7 requires zone evidence), then tempo, then steady.
 */
function classifyIntent(entry) {
  const rpeRaw = Number(entry?.rpe)
  const dur = Number(entry?.duration)
  if (!Number.isFinite(rpeRaw) || !Number.isFinite(dur) || dur <= 0) return null

  const rpe = rpeRaw
  const { shares, hasZones } = entryZoneShares(entry)
  const [, z2Share, z3Share, z4Share, z5Share] = shares
  const hiShare = z4Share + z5Share          // Z4+Z5
  const tempoPlus = z3Share + z4Share + z5Share

  // 1. recovery: RPE ≤ 3 AND duration ≤ 60 min
  if (rpe <= 3 && dur <= 60) return 'recovery'

  // 2. long: duration ≥ 90 AND RPE ≤ 5 (takes precedence over steady)
  if (dur >= 90 && rpe <= 5) return 'long'

  // 3. intervals: RPE ≥ 7 AND duration < 60 AND Z4+Z5 share > 30%
  //    (zone evidence required — otherwise hard short sessions stay unclassified)
  if (rpe >= 7 && dur < 60 && hasZones && hiShare > 0.30) return 'intervals'

  // 4. tempo: RPE 6-7, duration 30-75, Z3+ dominant (Z3+Z4+Z5 > Z2)
  if (rpe >= 6 && rpe <= 7 && dur >= 30 && dur <= 75) {
    if (!hasZones || tempoPlus > z2Share) return 'tempo'
  }

  // 5. steady: RPE 4-5, duration 30-90, Z2-dominant (or no zones recorded)
  if (rpe >= 4 && rpe <= 5 && dur >= 30 && dur <= 90) {
    if (!hasZones || z2Share >= z3Share + z4Share + z5Share) return 'steady'
  }

  return null
}

// ─── detectSessionVariety ────────────────────────────────────────────────────
/**
 * Detect lack of session-type variety in the last 28 days.
 *
 * Classifies each entry into one of 5 intents based on RPE + duration + zones:
 *   - recovery:  RPE <= 3 AND duration <= 60 min
 *   - long:      duration >= 90 min AND RPE <= 5
 *   - steady:    RPE 4-5, duration 30-90 min, Z2-dominant
 *   - tempo:     RPE 6-7, duration 30-75 min, Z3+ dominant
 *   - intervals: RPE >= 7 with sub-60 min duration AND Z4/Z5 share > 30%
 *
 * Variety thresholds (Seiler-inspired polarized template):
 *   - mix score = number of intents present in last 28 days (0-5)
 *   - "low variety" = mix score <= 2
 *   - "moderate variety" = mix score = 3
 *   - "good variety" = mix score >= 4
 *
 * @param {Array} log - training_log entries
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @returns {{
 *   intents: { recovery: number, long: number, steady: number, tempo: number, intervals: number },
 *   mixScore: number,
 *   variety: 'low'|'moderate'|'good',
 *   missing: Array<'recovery'|'long'|'steady'|'tempo'|'intervals'>,
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectSessionVariety(log, today = new Date().toISOString().slice(0, 10)) {
  const intents = { recovery: 0, long: 0, steady: 0, tempo: 0, intervals: 0 }

  // Empty / non-array path: classify-able with safe defaults.
  if (!Array.isArray(log) || log.length === 0) {
    return {
      intents,
      mixScore: 0,
      variety: 'low',
      missing: [...ALL_INTENTS],
      message: {
        en: 'Only 0 session types in last 28 days.',
        tr: 'Son 28 günde yalnızca 0 seans tipi.',
      },
      recommendation: {
        en: `Add a missing intent: ${ALL_INTENTS[0]}.`,
        tr: `Eksik bir tipi ekle: ${INTENT_LABELS_TR[ALL_INTENTS[0]]}.`,
      },
      reliable: false,
      citation: SESSION_VARIETY_CITATION,
    }
  }

  // ─── 28d window (UTC, inclusive). ──────────────────────────────────────────
  const start28 = addDaysStr(today, -27)
  const recent = log.filter(e => e?.date && e.date >= start28 && e.date <= today)

  // Reliability: ≥14 distinct days of any logged data in window.
  const distinctDays = new Set(recent.map(e => e.date))
  const reliable = distinctDays.size >= 14

  // ─── Classify each entry (multiple sessions per day all count separately) ─
  for (const entry of recent) {
    const intent = classifyIntent(entry)
    if (intent) intents[intent]++
  }

  const present = ALL_INTENTS.filter(k => intents[k] > 0)
  const missing = ALL_INTENTS.filter(k => intents[k] === 0)
  const mixScore = present.length

  // ─── Variety classification (strict boundaries) ───────────────────────────
  let variety
  if (mixScore <= 2) variety = 'low'
  else if (mixScore === 3) variety = 'moderate'
  else variety = 'good'

  // ─── Bilingual messages ───────────────────────────────────────────────────
  let message, recommendation
  if (variety === 'low') {
    message = {
      en: `Only ${mixScore} session types in last 28 days.`,
      tr: `Son 28 günde yalnızca ${mixScore} seans tipi.`,
    }
    const first = missing[0]
    recommendation = {
      en: `Add a missing intent: ${first}.`,
      tr: `Eksik bir tipi ekle: ${INTENT_LABELS_TR[first]}.`,
    }
  } else if (variety === 'moderate') {
    message = {
      en: '3 session types present — could broaden mix.',
      tr: '3 seans tipi mevcut — karışım genişletilebilir.',
    }
    const first = missing[0]
    recommendation = {
      en: `Try adding ${first} this week.`,
      tr: `Bu hafta ${INTENT_LABELS_TR[first]} ekle.`,
    }
  } else {
    message = {
      en: 'Good session variety.',
      tr: 'İyi seans çeşitliliği.',
    }
    recommendation = { en: '', tr: '' }
  }

  return {
    intents,
    mixScore,
    variety,
    missing,
    message,
    recommendation,
    reliable,
    citation: SESSION_VARIETY_CITATION,
  }
}
