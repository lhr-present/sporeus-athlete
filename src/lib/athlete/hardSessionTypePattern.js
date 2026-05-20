// ─── hardSessionTypePattern.js — 90-Day Hard-Session Type Variety ───────────
//
// Complementary to sessionVariety.js (which classifies sessions across the
// FULL recovery → intervals intent ladder). This module looks specifically
// AT THE HARD END of training and asks: among the hard sessions an athlete
// performs, how MUCH variety is there in the TYPE of hard session?
//
// Stöggl 2014 + Tønnessen 2015: variety in hard-session structure
// (intervals, tempo, threshold, hill-repeats, race-pace, …) drives
// orthogonal physiological adaptations. Relying on a single hard-session
// type (e.g. "always tempo") produces ceiling effects: one adaptation
// pathway saturates while the others stay untrained.
//
// This file computes the Shannon entropy of the TYPE distribution among
// HARD sessions over the trailing 90 days and surfaces a band classification.
//
// HARD definition (Either-condition):
//   entry.zone matches /^z[3-9]/i  OR  entry.rpe ≥ 7
//
// TYPE normalization:
//   String(entry.type ?? '').trim().toLowerCase()
//   Empty-after-trim entries are skipped.
//
// Bands (checked in this order):
//   INSUFFICIENT_HARD : hardSessions < 8
//   MONOLITHIC        : dominantSharePct ≥ 80
//   NARROW            : dominantSharePct ≥ 60
//   VARIED            : uniqueHardTypes ≥ 5 AND normalizedEntropy ≥ 0.85
//   BALANCED          : otherwise
//
// Pure function. No I/O. No React. No mutation of inputs.
//
// Citations:
//   Stöggl T., Sperlich B. (2014). Polarized training has greater impact on
//     key endurance variables than threshold, high intensity, or high volume
//     training. Front Physiol 5:33.
//   Tønnessen E. et al. (2015). The annual training periodization of 8
//     world champions in orienteering. Int J Sports Physiol Perform 10:29-38.
// ─────────────────────────────────────────────────────────────────────────────

export const HARD_SESSION_TYPE_PATTERN_CITATION = 'Stöggl 2014; Tønnessen 2015'

const HARD_MIN_SESSIONS = 8
const MONOLITHIC_PCT = 80
const NARROW_PCT = 60
const VARIED_MIN_TYPES = 5
const VARIED_MIN_NORM_ENTROPY = 0.85

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────
function resolveTodayIso(today) {
  if (today == null) return null
  if (today instanceof Date) {
    if (Number.isNaN(today.getTime())) return null
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string') {
    const s = today.slice(0, 10)
    const d = new Date(s + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  }
  return null
}

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Hard classification ────────────────────────────────────────────────────
function isHard(entry) {
  if (!entry || typeof entry !== 'object') return false
  const zoneRaw = entry.zone
  if (typeof zoneRaw === 'string' && /^z[3-9]/i.test(zoneRaw.trim())) {
    return true
  }
  const rpe = Number(entry.rpe)
  if (Number.isFinite(rpe) && rpe >= 7) return true
  return false
}

function normalizeType(entry) {
  const raw = entry?.type
  const s = String(raw ?? '').trim().toLowerCase()
  return s.length > 0 ? s : null
}

// ─── Rounding helpers ───────────────────────────────────────────────────────
function round4(x) {
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 10000) / 10000
}

function round2(x) {
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * Analyze the type variety of hard sessions over the trailing `windowDays`
 * ending at `today`.
 *
 * @param {object}      args
 * @param {Array}       args.log               training_log entries
 * @param {string|Date} args.today             reference date
 * @param {number}      [args.windowDays=90]   trailing window length
 *
 * @returns {{
 *   band: 'MONOLITHIC'|'NARROW'|'BALANCED'|'VARIED'|'INSUFFICIENT_HARD',
 *   hardSessions: number,
 *   uniqueHardTypes: number,
 *   typeCounts: Array<{ type: string, count: number, share: number }>,
 *   entropyBits: number,
 *   normalizedEntropy: number,
 *   dominantType: string | null,
 *   dominantSharePct: number,
 *   citation: string,
 * } | null}
 */
export function analyzeHardSessionTypePattern({ log, today, windowDays = 90 } = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const wd = Number(windowDays)
  const effectiveWindow = Number.isFinite(wd) && wd >= 1 ? Math.floor(wd) : 90
  const startIso = addDaysStr(todayIso, -(effectiveWindow - 1))

  const entries = Array.isArray(log) ? log : []

  // ─── Collect hard sessions inside the window with a usable type ───────────
  const counts = new Map()
  let hardSessions = 0

  for (const e of entries) {
    if (!e || typeof e.date !== 'string') continue
    const d = e.date.slice(0, 10)
    if (d < startIso || d > todayIso) continue
    if (!isHard(e)) continue
    const type = normalizeType(e)
    if (!type) continue
    counts.set(type, (counts.get(type) || 0) + 1)
    hardSessions += 1
  }

  // ─── Sort typeCounts (count desc, alphabetical tie-break) ─────────────────
  const typeCounts = Array.from(counts.entries())
    .map(([type, count]) => ({
      type,
      count,
      share: hardSessions > 0 ? round4(count / hardSessions) : 0,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.type < b.type ? -1 : a.type > b.type ? 1 : 0
    })

  const uniqueHardTypes = typeCounts.length

  // ─── Shannon entropy (bits) ───────────────────────────────────────────────
  let entropyBits = 0
  if (hardSessions > 0 && uniqueHardTypes > 1) {
    for (const { count } of typeCounts) {
      if (count <= 0) continue
      const p = count / hardSessions
      entropyBits += -p * Math.log2(p)
    }
  }
  entropyBits = round4(entropyBits)

  // Normalized entropy: 0 when only 1 type (no spread possible).
  let normalizedEntropy = 0
  if (uniqueHardTypes >= 2) {
    const maxEntropy = Math.log2(uniqueHardTypes)
    if (maxEntropy > 0) {
      normalizedEntropy = round4(entropyBits / maxEntropy)
    }
  }

  // ─── Dominant type ─────────────────────────────────────────────────────────
  const dominantType = typeCounts.length > 0 ? typeCounts[0].type : null
  const dominantSharePct =
    typeCounts.length > 0 ? round2(typeCounts[0].share * 100) : 0

  // ─── Band (order matters) ─────────────────────────────────────────────────
  let band
  if (hardSessions < HARD_MIN_SESSIONS) {
    band = 'INSUFFICIENT_HARD'
  } else if (dominantSharePct >= MONOLITHIC_PCT) {
    band = 'MONOLITHIC'
  } else if (dominantSharePct >= NARROW_PCT) {
    band = 'NARROW'
  } else if (
    uniqueHardTypes >= VARIED_MIN_TYPES &&
    normalizedEntropy >= VARIED_MIN_NORM_ENTROPY
  ) {
    band = 'VARIED'
  } else {
    band = 'BALANCED'
  }

  return {
    band,
    hardSessions,
    uniqueHardTypes,
    typeCounts,
    entropyBits,
    normalizedEntropy,
    dominantType,
    dominantSharePct,
    citation: HARD_SESSION_TYPE_PATTERN_CITATION,
  }
}
