// src/lib/athlete/trainingStreak.js
//
// v9.107.0 (Prompt LL) — Daily training-day streak computation.
//
// Behavioural psychology: visible streaks are one of the strongest
// retention levers in habit-tracking apps. Sporeus has all the data
// (every logged session has a date) but never surfaced "you trained
// 12 days in a row" — athletes who were on a streak didn't know.
//
// "Streak day" definition: a calendar day with at least one log entry
// whose tss > 0. Rest days, recovery, walks-with-tss are all counted
// because the user explicitly logged them — the act of logging is the
// habit. Zero-TSS entries (placeholder notes) do NOT count.
//
// Streak break: a calendar day with no qualifying entry. One missed
// day breaks the streak — no grace window. The athlete's mental model
// is "trained today or didn't," not a rolling-window proxy.
//
// `current` counts back from today (or yesterday if today has no entry
// but yesterday does — so the streak survives the period of the day
// before the athlete logs their session).
//
// Pure function. No I/O.

const MS_PER_DAY = 86400000

/**
 * @description Convert a YYYY-MM-DD string to a day-key (number of days
 *   since epoch). Stable comparison anchor; avoids timezone issues.
 */
function dayKey(iso) {
  if (!iso) return null
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z')
  if (Number.isNaN(d.getTime())) return null
  return Math.floor(d.getTime() / MS_PER_DAY)
}

// v9.108.0 (Prompt OO) — Milestone tiers. Tiered intentionally:
// - 7  = one week (habit forming)
// - 14 = two weeks (consolidating)
// - 30 = one month (entrenched)
// - 60 = two months (lifestyle)
// - 100 = a hundred days (rare)
// - 365 = a year (extraordinary)
// `getStreakMilestone` returns the tier hit (or null) so callers can render
// a one-shot celebration without re-firing on every render.
const MILESTONE_TIERS = [365, 100, 60, 30, 14, 7]

const MILESTONE_LABELS = {
  7:   { en: 'ONE WEEK',    tr: 'BİR HAFTA' },
  14:  { en: 'TWO WEEKS',   tr: 'İKİ HAFTA' },
  30:  { en: 'ONE MONTH',   tr: 'BİR AY' },
  60:  { en: 'TWO MONTHS',  tr: 'İKİ AY' },
  100: { en: '100 DAYS',    tr: '100 GÜN' },
  365: { en: 'ONE YEAR',    tr: 'BİR YIL' },
}

/**
 * @description Return the milestone tier the current streak exactly hits,
 *   or null. Only fires ON the milestone day — not before, not after.
 *
 * @param {number} currentStreak
 * @returns {{ tier: number, label: { en, tr } } | null}
 */
export function getStreakMilestone(currentStreak) {
  if (!Number.isFinite(currentStreak) || currentStreak <= 0) return null
  for (const tier of MILESTONE_TIERS) {
    if (currentStreak === tier) {
      return { tier, label: MILESTONE_LABELS[tier] }
    }
  }
  return null
}

/**
 * @description Compute current and longest training streaks.
 *
 * @param {Array}  log     - training log entries (each { date, tss? })
 * @param {string} [today] - 'YYYY-MM-DD'; defaults to today UTC
 * @returns {{ current: number, longest: number, lastDate: string | null }}
 */
export function computeTrainingStreak(log, today) {
  // Build a Set of day-keys that have at least one tss>0 entry.
  // Defends against malformed entries (missing date, NaN tss).
  const trainedDays = new Set()
  let lastDate = null
  for (const e of (Array.isArray(log) ? log : [])) {
    const k = dayKey(e?.date)
    if (k === null) continue
    const tss = Number(e?.tss)
    if (!Number.isFinite(tss) || tss <= 0) continue
    trainedDays.add(k)
    if (!lastDate || String(e.date) > lastDate) lastDate = String(e.date).slice(0, 10)
  }

  if (trainedDays.size === 0) {
    return { current: 0, longest: 0, lastDate: null }
  }

  const todayKey = dayKey(today || new Date().toISOString().slice(0, 10))

  // ── Current streak ────────────────────────────────────────────────────────
  // Walk back from today. If today has no entry, allow a 1-day grace by
  // starting from yesterday — covers the morning-of-the-day window where
  // the athlete hasn't trained yet.
  let cursor = todayKey
  if (!trainedDays.has(cursor)) cursor -= 1
  let current = 0
  while (trainedDays.has(cursor)) {
    current += 1
    cursor -= 1
  }

  // ── Longest streak ────────────────────────────────────────────────────────
  // Iterate sorted day-keys, counting consecutive runs.
  const sorted = [...trainedDays].sort((a, b) => a - b)
  let longest = 0
  let run = 0
  let prev = -Infinity
  for (const k of sorted) {
    if (k === prev + 1) run += 1
    else run = 1
    if (run > longest) longest = run
    prev = k
  }

  return { current, longest, lastDate }
}
