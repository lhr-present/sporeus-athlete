// ─── coachPlanDedup.js — v9.64.0 — client-side idempotency for coach plan push
//
// The `coach_plans` table currently has no unique constraint / onConflict
// clause, so a network-retry after a lost response can create duplicate
// active plans for the same athlete. Until a DB migration is shipped, we
// gate the client insert behind a localStorage signature ledger with a
// 60-second TTL.
//
// Pure / side-effect-free except for localStorage. Both functions tolerate
// JSON corruption and quota errors so they never block a legitimate send.

const TTL_MS = 60_000

export function planSignature({ coachId, athleteId, planName, planGoal, startDate, weeks, planLevel }) {
  const n = Array.isArray(weeks) ? weeks.length : 0
  return `${coachId}|${athleteId}|${(planName || '').trim()}|${planGoal}|${startDate}|${n}|${planLevel}`
}

export function isDuplicatePlanSend(athleteId, signature, now = Date.now()) {
  if (!athleteId || !signature) return false
  try {
    const raw = localStorage.getItem(`sporeus-coach-plan-last-sig-${athleteId}`)
    if (!raw) return false
    const last = JSON.parse(raw)
    if (!last || typeof last !== 'object') return false
    return last.sig === signature && (now - (last.ts || 0)) < TTL_MS
  } catch (_) {
    return false  // corrupt JSON → let the send proceed
  }
}

export function recordPlanSend(athleteId, signature, now = Date.now()) {
  if (!athleteId || !signature) return
  try {
    localStorage.setItem(
      `sporeus-coach-plan-last-sig-${athleteId}`,
      JSON.stringify({ sig: signature, ts: now }),
    )
  } catch (_) { /* QuotaExceededError or unavailable — non-critical */ }
}

export const COACH_PLAN_DEDUP_TTL_MS = TTL_MS
