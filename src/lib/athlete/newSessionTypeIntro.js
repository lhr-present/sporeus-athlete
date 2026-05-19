// ─── newSessionTypeIntro.js — Novel Session-Type Introduction Detector ──────
// Flag session types introduced in the last 14 days that weren't part of the
// athlete's training repertoire in the prior 90 days. Gabbett 2016 / Hulin
// 2014 novel-stimulus injury risk: introducing an unfamiliar movement pattern
// (e.g. a runner starting strength sessions, a cyclist starting hill repeats)
// creates short-term tissue load the body hasn't adapted to. Surfaces an
// elevated-risk window so the athlete can manage volume + recovery during
// the adaptation period.
//
// Pure module, no React, fully deterministic on `today`.
// ─────────────────────────────────────────────────────────────────────────────

export const NEW_SESSION_TYPE_INTRO_CITATION = 'Gabbett 2016; Hulin 2014'

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
    // Validate format YYYY-MM-DD
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

// ─── analyzeNewSessionTypeIntro ─────────────────────────────────────────────
/**
 * Detect novel session types introduced in the recent window vs a longer
 * baseline window.
 *
 * Logic:
 *   - Normalize `entry.type` via lowercased trim.
 *   - recentStart = today - (recentDays - 1); window = [recentStart..today].
 *   - baselineEnd = today - recentDays; baselineStart = baselineEnd - (baselineDays - 1).
 *   - A "novel type" appears in recent window but NOT in baseline window.
 *   - Require ≥10 sessions in baseline window — otherwise return null
 *     (insufficient signal to know what's truly novel).
 *
 * @param {{
 *   log: Array<{ date?: string, type?: string }>,
 *   today?: string | Date,
 *   recentDays?: number,
 *   baselineDays?: number,
 * }} args
 * @returns {{
 *   band: 'NO_NOVEL' | 'SINGLE_NOVEL' | 'MULTIPLE_NOVEL',
 *   novelTypes: Array<{
 *     type: string,
 *     firstSeen: string,
 *     countInRecent: number,
 *     daysSinceFirst: number,
 *   }>,
 *   recentTypesTotal: number,
 *   baselineTypesTotal: number,
 *   citation: string,
 * } | null}
 */
export function analyzeNewSessionTypeIntro({
  log,
  today,
  recentDays = 14,
  baselineDays = 90,
} = {}) {
  if (!Array.isArray(log) || log.length === 0) return null
  if (!Number.isFinite(recentDays) || recentDays <= 0) return null
  if (!Number.isFinite(baselineDays) || baselineDays <= 0) return null

  const todayIso = toIsoDate(today) || new Date().toISOString().slice(0, 10)

  const recentStart = addDaysIso(todayIso, -(recentDays - 1))
  const baselineEnd = addDaysIso(todayIso, -recentDays)
  const baselineStart = addDaysIso(todayIso, -(recentDays + baselineDays - 1))

  // Walk log once: bucket entries into baseline vs recent and accumulate.
  const baselineTypes = new Set()
  let baselineSessionCount = 0
  /** Map<normalizedType, Array<dateIso>> */
  const recentDatesByType = new Map()

  for (const entry of log) {
    if (!entry || typeof entry !== 'object') continue
    const dateIso = toIsoDate(entry.date)
    if (!dateIso) continue
    const type = normalizeType(entry.type)
    if (!type) continue

    if (dateIso >= baselineStart && dateIso <= baselineEnd) {
      baselineTypes.add(type)
      baselineSessionCount++
    } else if (dateIso >= recentStart && dateIso <= todayIso) {
      let bucket = recentDatesByType.get(type)
      if (!bucket) {
        bucket = []
        recentDatesByType.set(type, bucket)
      }
      bucket.push(dateIso)
    }
  }

  // Coverage gate: need at least 10 sessions in the baseline window to know
  // what's truly novel.
  if (baselineSessionCount < 10) return null

  // Build novel-type list: in recent, absent from baseline.
  const novelTypes = []
  for (const [type, dates] of recentDatesByType.entries()) {
    if (baselineTypes.has(type)) continue
    // firstSeen = earliest date for this type in recent window
    let firstSeen = dates[0]
    for (const d of dates) {
      if (d < firstSeen) firstSeen = d
    }
    novelTypes.push({
      type,
      firstSeen,
      countInRecent: dates.length,
      daysSinceFirst: Math.max(0, daysBetween(firstSeen, todayIso)),
    })
  }

  novelTypes.sort((a, b) => a.type.localeCompare(b.type))

  let band
  if (novelTypes.length === 0) band = 'NO_NOVEL'
  else if (novelTypes.length === 1) band = 'SINGLE_NOVEL'
  else band = 'MULTIPLE_NOVEL'

  return {
    band,
    novelTypes,
    recentTypesTotal: recentDatesByType.size,
    baselineTypesTotal: baselineTypes.size,
    citation: NEW_SESSION_TYPE_INTRO_CITATION,
  }
}

export default analyzeNewSessionTypeIntro
