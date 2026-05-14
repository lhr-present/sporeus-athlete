// src/lib/athlete/weeklyBudget.js
//
// v9.127.0 — Weekly TSS budget vs day-of-week pace.
//
// The plan generator emits a weekly TSS target (sum of planned-session
// TSS for the active week). Athletes mid-week have no compact surface
// showing "you're 60% through the week with 45% of TSS spent — slightly
// behind." The existing TSS ring on the Today view (Card 5-ish, way
// below the fold) shows raw numbers; what's missing is the *pace*
// interpretation that makes the numbers actionable.
//
// This function computes:
//   - spent / target percentages
//   - day-of-week position as a percentage of the 7-day week
//   - paceDelta = spentPct - expectedPct (positive = ahead of pace)
//   - status: 'on-pace' (|delta| <= 15) | 'ahead' (>15) | 'behind' (<-15)
//
// Why ±15% tolerance: a single planned session can shift the
// percentage by 10–20% on any given day. Tighter than 15% generates
// false alarms; looser misses meaningful drift.
//
// Pure function. No I/O.

const DOW_PCT = [
  // Mon=0 .. Sun=6 → expected fraction of week completed at end of day
  1 / 7,   // Monday
  2 / 7,
  3 / 7,
  4 / 7,
  5 / 7,
  6 / 7,
  1,       // Sunday
]

const PACE_TOLERANCE_PCT = 15

/**
 * @description Day-of-week index where Monday=0, Sunday=6.
 *   getUTCDay returns Sun=0..Sat=6; convert to ISO Monday-first.
 */
function isoDayIndex(iso) {
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z')
  if (Number.isNaN(d.getTime())) return null
  return (d.getUTCDay() + 6) % 7
}

/**
 * @description Compute weekly TSS budget pace status.
 *
 * @param {Object} args
 * @param {number} args.weekTSS        - TSS logged this week so far
 * @param {number} args.weekTSSTarget  - TSS target for this week (from plan)
 * @param {string} args.today          - 'YYYY-MM-DD'
 * @returns {{
 *   target:        number,
 *   spent:         number,
 *   spentPct:      number,         // % of target spent
 *   expectedPct:   number,         // % of target you'd be at if perfectly on-pace
 *   paceDelta:     number,         // spentPct - expectedPct
 *   status:        'on-pace' | 'ahead' | 'behind' | null,
 *   summary:       { en: string, tr: string } | null,
 * } | null}  null when no target available (no plan) or invalid inputs
 */
export function analyzeWeeklyBudget({ weekTSS, weekTSSTarget, today } = {}) {
  const target = Number(weekTSSTarget) || 0
  const spent  = Number(weekTSS) || 0
  if (target <= 0) return null
  const dayIdx = isoDayIndex(today || new Date().toISOString().slice(0, 10))
  if (dayIdx == null) return null

  const expectedFrac = DOW_PCT[dayIdx]
  const expectedPct  = Math.round(expectedFrac * 100)
  const spentPct     = Math.round((spent / target) * 100)
  const paceDelta    = spentPct - expectedPct

  let status
  if (paceDelta > PACE_TOLERANCE_PCT) status = 'ahead'
  else if (paceDelta < -PACE_TOLERANCE_PCT) status = 'behind'
  else status = 'on-pace'

  // Summary only fires for off-pace status. on-pace is silent in the
  // UI (chip can show raw numbers without an interpretive line).
  let summary = null
  if (status === 'ahead') {
    summary = {
      en: `Ahead of pace: ${spentPct}% spent, ${expectedPct}% expected. Consider easing remaining sessions to land near target.`,
      tr: `Hedef hızının önündesin: %${spentPct} harcandı, beklenen %${expectedPct}. Kalan seansları hafifleterek hedefe yakın kal.`,
    }
  } else if (status === 'behind') {
    summary = {
      en: `Behind pace: ${spentPct}% spent, ${expectedPct}% expected. Catching up with intensity risks overload — stretch volume across remaining easy days instead.`,
      tr: `Hedef hızının gerisindesin: %${spentPct} harcandı, beklenen %${expectedPct}. Yoğunlukla telafi aşırı yük getirir — kalan kolay günlere hacim yay.`,
    }
  }

  return { target, spent, spentPct, expectedPct, paceDelta, status, summary }
}
