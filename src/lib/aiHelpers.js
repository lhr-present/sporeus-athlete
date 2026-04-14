// ─── aiHelpers.js — AI feature scheduling and prompt helpers ──────────────────

// ── isSunday ──────────────────────────────────────────────────────────────────
// Returns true if the ISO date string (YYYY-MM-DD) falls on a Sunday.
export function isSunday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.getUTCDay() === 0
}

// ── shouldRunWeeklyDigest ──────────────────────────────────────────────────────
// Returns true only if the given date is a Sunday.
export function shouldRunWeeklyDigest(dateStr) {
  return isSunday(dateStr)
}

// ── getWeekStart ───────────────────────────────────────────────────────────────
// Returns the Monday of the ISO week containing dateStr (YYYY-MM-DD).
export function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z')
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diffToMonday)
  return monday.toISOString().slice(0, 10)
}
