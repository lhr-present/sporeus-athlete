// ─── dateKeys.js — canonical ISO week helpers (pure, no React) ───────────────
// One place for week-Monday / week-key math. ~20 ad-hoc implementations exist
// across the lib; this is the canonical, UTC-anchored, year-boundary-safe version
// new code should use (and old sites can migrate to incrementally). All inputs are
// accepted as a 'YYYY-MM-DD' string or a Date; date-only strings parse as UTC per
// spec, so the math is timezone-stable.

function toUtcMidnight(dateOrStr) {
  // Date-only 'YYYY-MM-DD' already parses as UTC; for a Date or full timestamp,
  // take the date portion and re-anchor at UTC midnight so the week math can't
  // drift with local time.
  if (dateOrStr instanceof Date) {
    return new Date(Date.UTC(dateOrStr.getUTCFullYear(), dateOrStr.getUTCMonth(), dateOrStr.getUTCDate()))
  }
  const s = String(dateOrStr).slice(0, 10)
  const d = new Date(s + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * ISO 'YYYY-MM-DD' for the Monday of the ISO week containing the input.
 * Monday = start of week (ISO 8601). Returns null on unparseable input.
 */
export function isoMondayOf(dateOrStr) {
  const d = toUtcMidnight(dateOrStr)
  if (!d) return null
  const dow = (d.getUTCDay() + 6) % 7  // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

/**
 * ISO 8601 week key, e.g. '2026-W15', for the input date. Year-boundary safe
 * (the Thursday of the week decides the year). Returns null on bad input.
 */
export function weekKey(dateOrStr) {
  const d = toUtcMidnight(dateOrStr)
  if (!d) return null
  // Shift to the Thursday of this week (ISO: the week's year = that Thursday's year)
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const weekNum = 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7
  )
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
