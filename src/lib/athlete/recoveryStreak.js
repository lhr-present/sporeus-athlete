// ─── recoveryStreak.js — "Feeling-Good" Recovery Streak Detector ─────────────
//
// Computes the athlete's current consecutive-day streak of GOOD readiness
// scores (≥ threshold, default 70/100) plus the longest such run in the
// last `lookbackDays` (default 90) window.
//
// This is the RECOVERY-LOG analogue to streakDetector.js / trainingStreak.js
// (which operate on the TRAINING log). The data is `recovery` entries of
// shape `{ date, score, source, ... }` from DataContext — quick-tap or
// HRV-derived readiness values on a 0–100 scale.
//
// Scientific grounding:
//   Halson 2014 — subjective wellness ratings predict training tolerance
//     better than objective HRV / performance markers.
//   Foster 1998  — monitoring perceived recovery surfaces over-reaching
//     before a maladaptation cascade.
//   Saw   2016  — meta-analysis: subjective measures > objective measures
//     for monitoring training response and well-being.
//
// Streak break rule (deliberately strict, matches habit-tracker mental
// model): a missing day OR a day with `score < threshold` breaks the
// streak. Today is included if a score is present AND ≥ threshold; if
// today has no entry yet, the streak walks back from yesterday — covering
// the morning-of window before the athlete logs.
//
// Multiple recovery entries on the same calendar date are bucketed: the
// LAST entry by array index wins (mirrors "last write wins" semantics for
// same-day quick-tap edits).
//
// Pure function. No I/O. No side effects.

export const RECOVERY_STREAK_CITATION = 'Halson 2014; Foster 1998; Saw 2016'

const MS_PER_DAY = 86400000

// Stable day-key derivation. We use UTC noon to avoid DST / timezone
// edge cases where a midnight conversion crosses a day boundary in the
// athlete's local zone.
function dayKey(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return null
  const d = new Date(iso.slice(0, 10) + 'T12:00:00Z')
  const t = d.getTime()
  if (Number.isNaN(t)) return null
  return Math.floor(t / MS_PER_DAY)
}

function keyToISO(k) {
  return new Date(k * MS_PER_DAY).toISOString().slice(0, 10)
}

/**
 * @description Compute the athlete's "feeling-good" recovery streak.
 *
 * @param {Object}   args
 * @param {Array}    args.recovery       - recovery entries: `{ date, score, ... }`
 * @param {string}   [args.today]        - 'YYYY-MM-DD'; defaults to today (UTC)
 * @param {number}   [args.threshold=70] - score ≥ this counts as a "good" day
 * @param {number}   [args.lookbackDays=90] - window for longestStreak90d + lastBreakDate
 *
 * @returns {{
 *   currentStreak:     number,
 *   longestStreak90d:  number,
 *   lastBreakDate:     string | null,
 *   threshold:         number,
 *   citation:          string,
 * } | null}
 *
 * Null when no recovery entries are provided.
 */
export function computeRecoveryStreak({
  recovery,
  today,
  threshold = 70,
  lookbackDays = 90,
} = {}) {
  if (!Array.isArray(recovery) || recovery.length === 0) return null

  const thr = Number.isFinite(Number(threshold)) ? Number(threshold) : 70
  const lookback = Number.isFinite(Number(lookbackDays)) && Number(lookbackDays) > 0
    ? Math.floor(Number(lookbackDays))
    : 90

  // ── Bucket per distinct calendar date: latest entry by array index wins.
  // We iterate in order and overwrite, so the LAST encountered entry for a
  // date is the one whose score we evaluate.
  const scoreByKey = new Map()
  for (const e of recovery) {
    const k = dayKey(e?.date)
    if (k === null) continue
    const s = Number(e?.score)
    scoreByKey.set(k, Number.isFinite(s) ? s : null)
  }

  if (scoreByKey.size === 0) return null

  const todayISO = (typeof today === 'string' && today.length >= 10)
    ? today.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const todayKey = dayKey(todayISO)
  if (todayKey === null) return null

  // ── Current streak ─────────────────────────────────────────────────────────
  // Walk back from today. If today has no entry, allow a 1-day grace and
  // start from yesterday (athlete hasn't logged yet today). If today has
  // an entry but its score is < threshold, the streak is 0 immediately.
  let cursor = todayKey
  const todayHas = scoreByKey.has(todayKey)
  if (!todayHas) {
    cursor = todayKey - 1
  }
  let currentStreak = 0
  while (scoreByKey.has(cursor)) {
    const s = scoreByKey.get(cursor)
    if (s === null || s < thr) break
    currentStreak += 1
    cursor -= 1
  }

  // ── Longest streak in lookback window + lastBreakDate ──────────────────────
  // Iterate every calendar day in [today - lookback + 1, today]. Each day
  // either has a good score (extends a run) or breaks the run (missing
  // entry OR score < threshold). `lastBreakDate` is the most recent
  // < threshold day inside the window — explicitly NOT counting missing
  // days (a gap isn't necessarily a "break event" in the athlete's mind;
  // a logged low score IS).
  let longestStreak90d = 0
  let run = 0
  let lastBreakKey = null
  const startKey = todayKey - lookback + 1
  for (let k = startKey; k <= todayKey; k++) {
    if (scoreByKey.has(k)) {
      const s = scoreByKey.get(k)
      if (s !== null && s >= thr) {
        run += 1
        if (run > longestStreak90d) longestStreak90d = run
      } else {
        run = 0
        // Score < threshold counts as a "break event"
        if (lastBreakKey === null || k > lastBreakKey) lastBreakKey = k
      }
    } else {
      // Missing entry breaks any active run but does NOT record a break event
      run = 0
    }
  }

  // currentStreak can exceed the window if the run extends behind it; keep
  // longestStreak90d ≥ currentStreak only when the current streak is fully
  // inside the window. Otherwise leave longest as computed from the window
  // alone so the metric stays bounded by `lookbackDays`.
  // (We intentionally do NOT do `Math.max(longest, current)` here — the
  // contract says "longest 90d window," and a 200-day current streak
  // shouldn't read as "best 90d: 200".)

  return {
    currentStreak,
    longestStreak90d,
    lastBreakDate: lastBreakKey !== null ? keyToISO(lastBreakKey) : null,
    threshold: thr,
    citation: RECOVERY_STREAK_CITATION,
  }
}
