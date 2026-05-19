// src/lib/athlete/weeklyKmPerSport.js
//
// Per-sport weekly kilometer tracker — reports this week's km versus
// the 12-week average for each sport with any logged sessions. Athletes
// anchor their training narratives around per-sport km ("I ran 60km
// this week", "I biked 220km"), which sport-agnostic TSS or volume
// cards cannot capture. This pure module supplies the data the card
// surfaces.
//
// Refs:
//   - Daniels J. (2014) Daniels' Running Formula, 3rd ed. — km-based
//     weekly volume as the canonical run progression unit.
//   - Bompa T., Buzzichelli C. (2018) Periodization, 6th ed. —
//     per-modality volume tracking across the macrocycle.
//
// Window: 13 ISO weeks ending in the week containing `today` — 12
// fully-elapsed weeks plus the current in-progress week. Weeks are
// Monday-Sunday (ISO). The 12-week average uses the 12 *completed*
// weeks (excludes the current in-progress week so a Monday morning
// doesn't crater the baseline).
//
// Pure function. No I/O, no React.

const MS_PER_DAY = 86400000

/**
 * @description Classify a log entry to a sport bucket. Reads either
 *   the `sport` or `type` field — both string-y. Falls back to
 *   `'other'` when nothing matches. Tests rely on these exact regexes
 *   so they double as the public contract.
 */
export function classifySport(entry) {
  const s = String(entry?.sport || entry?.type || '')
  if (/bike|cycl|ride|spin/i.test(s)) return 'bike'
  if (/swim/i.test(s))                return 'swim'
  if (/run|jog/i.test(s))             return 'run'
  if (/row/i.test(s))                 return 'row'
  return 'other'
}

function dayMs(iso) {
  if (!iso) return null
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

/**
 * @description Return the Monday-anchored start of the ISO week
 *   containing `ms` (a UTC millisecond timestamp at noon-UTC for
 *   deterministic DST-free arithmetic).
 */
function isoWeekStartMs(ms) {
  const d = new Date(ms)
  // UTC day of week: 0=Sun, 1=Mon, ..., 6=Sat. Shift so Mon=0.
  const dow = d.getUTCDay()
  const mondayShift = (dow + 6) % 7
  const start = new Date(ms)
  start.setUTCDate(start.getUTCDate() - mondayShift)
  start.setUTCHours(12, 0, 0, 0)
  return start.getTime()
}

/**
 * @description Per-sport weekly km — this week vs 12-week average.
 *
 * @param {{ log: Array, today?: string, windowWeeks?: number }} input
 * @returns {{
 *   sports: Array<{ key: string, thisWeekKm: number, avg12WeekKm: number, deltaPct: number | null }>,
 *   citation: string,
 * } | null}
 */
export function analyzeWeeklyKmPerSport({ log, today, windowWeeks = 12 } = {}) {
  const tToday = today || new Date().toISOString().slice(0, 10)
  const todayMs = dayMs(tToday)
  if (todayMs == null) return null

  const thisWeekStart = isoWeekStartMs(todayMs)
  const thisWeekEnd = thisWeekStart + 7 * MS_PER_DAY // exclusive

  // Window = `windowWeeks` completed weeks + the current in-progress week.
  const windowStart = thisWeekStart - windowWeeks * 7 * MS_PER_DAY

  // sport -> { thisWeekKm, pastTotalKm }
  const buckets = new Map()

  for (const e of (Array.isArray(log) ? log : [])) {
    const dMs = dayMs(e?.date)
    if (dMs == null) continue
    if (dMs < windowStart || dMs >= thisWeekEnd) continue

    const km = Number(e?.distanceKm)
    if (!Number.isFinite(km) || km <= 0) continue

    const sport = classifySport(e)
    const bucket = buckets.get(sport) || { thisWeekKm: 0, pastTotalKm: 0 }
    if (dMs >= thisWeekStart) {
      bucket.thisWeekKm += km
    } else {
      bucket.pastTotalKm += km
    }
    buckets.set(sport, bucket)
  }

  if (buckets.size === 0) return null

  const sports = []
  for (const [key, b] of buckets.entries()) {
    const avg12WeekKm = b.pastTotalKm / windowWeeks
    // Exclude sports that are zero-zero across the window.
    if (avg12WeekKm === 0 && b.thisWeekKm === 0) continue
    const deltaPct = avg12WeekKm > 0
      ? (b.thisWeekKm - avg12WeekKm) / avg12WeekKm
      : null
    sports.push({
      key,
      thisWeekKm: b.thisWeekKm,
      avg12WeekKm,
      deltaPct,
    })
  }

  if (sports.length === 0) return null

  // Biggest sports first by 12-week average. Ties broken by thisWeekKm
  // desc to keep ordering stable when a brand-new sport ties an old
  // dormant one at avg=0.
  sports.sort((a, b) => {
    if (b.avg12WeekKm !== a.avg12WeekKm) return b.avg12WeekKm - a.avg12WeekKm
    return b.thisWeekKm - a.thisWeekKm
  })

  return {
    sports,
    citation: 'Daniels 2014; Bompa 2018',
  }
}
