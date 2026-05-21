// ─── overlookedSessionType.js — Dropped Session-Type Detector ───────────────
// Inverse of newSessionTypeIntro: flag session types that USED to be part of
// the athlete's training repertoire 30–180 days ago but have DISAPPEARED from
// the last 30 days. Bompa 2018 / Issurin 2010 periodization principle —
// macrocycles intentionally rotate stimuli in and out, but athletes can
// unconsciously drop entire modalities (e.g. no strength session for 3 months
// without realising). Surfaces silently abandoned stimuli so the coach/athlete
// can decide whether the drop is purposeful (block-periodised) or accidental.
//
// Pure module, no React, fully deterministic on `today`.
// ─────────────────────────────────────────────────────────────────────────────

export const OVERLOOKED_SESSION_TYPE_CITATION = 'Bompa 2018; Issurin 2010'

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────
function toIsoDate(value) {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    if (value.length < 10) return null
    const slice = value.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(slice)) return null
    const t = new Date(slice + 'T00:00:00Z').getTime()
    if (!Number.isFinite(t)) return null
    return slice
  }
  return null
}

function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(fromIso, toIso) {
  const a = new Date(fromIso + 'T00:00:00Z').getTime()
  const b = new Date(toIso + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86_400_000)
}

function normalizeType(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim().toLowerCase()
}

// ─── analyzeOverlookedSessionType ───────────────────────────────────────────
/**
 * Detect session types present in the baseline window but absent from the
 * recent window.
 *
 * Logic:
 *   - Normalize `entry.type` via lowercased trim.
 *   - recentStart   = today - (recentDays - 1); recent = [recentStart..today].
 *   - baselineEnd   = today - recentDays.
 *   - baselineStart = today - (recentDays + baselineDays - 1);
 *     baseline = [baselineStart..baselineEnd].
 *   - For each type, baselineCount = occurrences in the baseline window;
 *     keep types with baselineCount ≥ minBaselineCount.
 *   - Overlooked = type ∈ baselineCount AND NOT ∈ recentTypes.
 *   - lastSeen = most-recent date in the WHOLE log for that type;
 *     daysSinceLastSeen = today − lastSeen.
 *   - Sort overlooked by daysSinceLastSeen ascending (most-recently-missed
 *     first), tiebreak alphabetically.
 *   - Require ≥10 total sessions in the baseline window — else
 *     INSUFFICIENT_HISTORY with overlookedTypes = [].
 *   - Bands: COMPLETE_REPERTOIRE (0), MINOR_DROPS (1–2), MULTIPLE_DROPS (≥3).
 *   - Return null when `today` is unresolvable.
 *
 * @param {{
 *   log: Array<{ date?: string, type?: string }>,
 *   today?: string | Date,
 *   recentDays?: number,
 *   baselineDays?: number,
 *   minBaselineCount?: number,
 * }} args
 * @returns {{
 *   band: 'COMPLETE_REPERTOIRE' | 'MINOR_DROPS' | 'MULTIPLE_DROPS' | 'INSUFFICIENT_HISTORY',
 *   overlookedTypes: Array<{
 *     type: string,
 *     baselineCount: number,
 *     lastSeen: string,
 *     daysSinceLastSeen: number,
 *   }>,
 *   recentTypesTotal: number,
 *   baselineTypesTotal: number,
 *   citation: string,
 * } | null}
 */
export function analyzeOverlookedSessionType({
  log,
  today,
  recentDays = 30,
  baselineDays = 180,
  minBaselineCount = 3,
} = {}) {
  if (!Array.isArray(log)) return null
  if (!Number.isFinite(recentDays) || recentDays <= 0) return null
  if (!Number.isFinite(baselineDays) || baselineDays <= 0) return null
  if (!Number.isFinite(minBaselineCount) || minBaselineCount <= 0) return null

  // Resolve `today` — null only when an explicit invalid arg was supplied.
  let todayIso
  if (today === undefined) {
    todayIso = new Date().toISOString().slice(0, 10)
  } else {
    todayIso = toIsoDate(today)
    if (!todayIso) {
      // Fall back to system today rather than null per spec ambiguity? Spec
      // says "Return null when `today` unresolvable" — honour that.
      return null
    }
  }

  const recentStart = addDaysIso(todayIso, -(recentDays - 1))
  const baselineEnd = addDaysIso(todayIso, -recentDays)
  const baselineStart = addDaysIso(todayIso, -(recentDays + baselineDays - 1))

  /** Map<normalizedType, number> — counts within baseline window */
  const baselineCountByType = new Map()
  /** Set<normalizedType> — appearing in recent window */
  const recentTypes = new Set()
  /** Map<normalizedType, string> — most-recent date for type anywhere in log */
  const lastSeenByType = new Map()

  let baselineSessionCount = 0

  for (const entry of log) {
    if (!entry || typeof entry !== 'object') continue
    const dateIso = toIsoDate(entry.date)
    if (!dateIso) continue
    const type = normalizeType(entry.type)
    if (!type) continue

    // Track last-seen across the whole log (not just baseline/recent windows).
    const prevLast = lastSeenByType.get(type)
    if (!prevLast || dateIso > prevLast) {
      lastSeenByType.set(type, dateIso)
    }

    if (dateIso >= baselineStart && dateIso <= baselineEnd) {
      baselineCountByType.set(type, (baselineCountByType.get(type) || 0) + 1)
      baselineSessionCount++
    } else if (dateIso >= recentStart && dateIso <= todayIso) {
      recentTypes.add(type)
    }
  }

  const baselineTypesTotal = baselineCountByType.size
  const recentTypesTotal = recentTypes.size

  if (baselineSessionCount < 10) {
    return {
      band: 'INSUFFICIENT_HISTORY',
      overlookedTypes: [],
      recentTypesTotal,
      baselineTypesTotal,
      citation: OVERLOOKED_SESSION_TYPE_CITATION,
    }
  }

  const overlookedTypes = []
  for (const [type, count] of baselineCountByType.entries()) {
    if (count < minBaselineCount) continue
    if (recentTypes.has(type)) continue
    const lastSeen = lastSeenByType.get(type) || baselineEnd
    overlookedTypes.push({
      type,
      baselineCount: count,
      lastSeen,
      daysSinceLastSeen: Math.max(0, daysBetween(lastSeen, todayIso)),
    })
  }

  overlookedTypes.sort((a, b) => {
    if (a.daysSinceLastSeen !== b.daysSinceLastSeen) {
      return a.daysSinceLastSeen - b.daysSinceLastSeen
    }
    return a.type.localeCompare(b.type)
  })

  let band
  if (overlookedTypes.length === 0) band = 'COMPLETE_REPERTOIRE'
  else if (overlookedTypes.length <= 2) band = 'MINOR_DROPS'
  else band = 'MULTIPLE_DROPS'

  return {
    band,
    overlookedTypes,
    recentTypesTotal,
    baselineTypesTotal,
    citation: OVERLOOKED_SESSION_TYPE_CITATION,
  }
}

export default analyzeOverlookedSessionType
