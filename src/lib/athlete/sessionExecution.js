// src/lib/athlete/sessionExecution.js
//
// v9.89.0 — Post-session execution snapshot. Cross-references today's
// logged entry with the planned session to surface plan-vs-actual deltas
// so the athlete sees how the execution landed without having to do
// arithmetic in their head.
//
// Design call (matched the v9.88.0 minimal-additive shape):
// - Compares ONLY fields reliably present in both plan and log:
//   duration (always), RPE (almost always), TSS (when computable).
// - Pace/HR comparison is skipped because those fields are conditional
//   on FIT-import or detailed manual entry — half the user base logs
//   sessions without them. A "missing HR delta" line would create noise.
// - Status thresholds are coarse on purpose. The output is a glance-able
//   summary, not a coaching judgement.
//
// Status semantics:
//   - 'on-target'  : duration within ±15%, RPE within ±1
//   - 'over'       : duration > 115% planned OR RPE > planned + 1
//   - 'under'      : duration < 85% planned (but ≥50%)
//   - 'incomplete' : duration < 50% planned
//
// Pure function. No side effects. Tolerant of nulls / missing fields.

const ON_TARGET_DURATION_TOL_PCT = 0.15
const OVER_DURATION_PCT          = 1.15
const UNDER_DURATION_PCT         = 0.85
const INCOMPLETE_DURATION_PCT    = 0.50
const ON_TARGET_RPE_TOL          = 1
const ON_TARGET_TSS_TOL_PCT      = 0.20  // wider — TSS varies with route/HR

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Compare a planned session against today's actual log entry.
 *
 * @param {object|null} plannedSession - shape from getTodayPlannedSession:
 *   { type, duration, rpe, tss?, ... }. Null when no plan exists.
 * @param {object|null} logEntry - the athlete's logged session for today:
 *   { date, type?, duration, rpe?, tss?, ... }. Null when not logged yet.
 * @returns {{
 *   status: 'on-target' | 'over' | 'under' | 'incomplete',
 *   duration: { planned: number, logged: number, deltaMin: number, deltaPct: number },
 *   rpe?:      { planned: number, logged: number, delta: number },
 *   tss?:      { planned: number, logged: number, delta: number, deltaPct: number },
 * } | null}
 *
 * Returns null when either input is missing, the planned session is rest,
 * or duration cannot be compared.
 */
export function computeSessionExecution(plannedSession, logEntry) {
  if (!plannedSession || !logEntry) return null

  const plannedDur = num(plannedSession.duration)
  const loggedDur  = num(logEntry.duration)
  if (plannedDur == null || plannedDur <= 0) return null  // rest day / unparseable
  if (loggedDur  == null || loggedDur  <= 0) return null  // nothing to compare

  const durDelta    = loggedDur - plannedDur
  const durDeltaPct = durDelta / plannedDur

  const plannedRpe = num(plannedSession.rpe)
  const loggedRpe  = num(logEntry.rpe)
  const rpeAvail   = plannedRpe != null && loggedRpe != null
  const rpeDelta   = rpeAvail ? loggedRpe - plannedRpe : null

  const plannedTss = num(plannedSession.tss) ?? num(plannedSession.targetTSS)
  const loggedTss  = num(logEntry.tss)
  const tssAvail   = plannedTss != null && loggedTss != null && plannedTss > 0
  const tssDelta   = tssAvail ? loggedTss - plannedTss : null

  // Status — duration takes priority; RPE bumps over/under when extreme.
  let status
  if (loggedDur < plannedDur * INCOMPLETE_DURATION_PCT) {
    status = 'incomplete'
  } else if (loggedDur > plannedDur * OVER_DURATION_PCT) {
    status = 'over'
  } else if (loggedDur < plannedDur * UNDER_DURATION_PCT) {
    status = 'under'
  } else if (rpeAvail && rpeDelta > ON_TARGET_RPE_TOL) {
    status = 'over'
  } else if (rpeAvail && rpeDelta < -ON_TARGET_RPE_TOL) {
    // RPE undershoot is generally fine (athlete chose to dial back) — but
    // mark it only when duration is also at-target so we don't double-flag.
    status = Math.abs(durDeltaPct) <= ON_TARGET_DURATION_TOL_PCT ? 'under' : 'on-target'
  } else {
    status = 'on-target'
  }

  const result = {
    status,
    duration: {
      planned:   plannedDur,
      logged:    loggedDur,
      deltaMin:  Math.round(durDelta * 10) / 10,
      deltaPct:  Math.round(durDeltaPct * 1000) / 1000,  // 3 dp
    },
  }
  if (rpeAvail) {
    result.rpe = {
      planned: plannedRpe,
      logged:  loggedRpe,
      delta:   rpeDelta,
    }
  }
  if (tssAvail) {
    result.tss = {
      planned:  plannedTss,
      logged:   loggedTss,
      delta:    Math.round(tssDelta),
      deltaPct: Math.round((tssDelta / plannedTss) * 1000) / 1000,
    }
  }
  return result
}

// Bilingual short label per status. Consumers can format around this.
export const EXECUTION_STATUS_LABEL = {
  'on-target':  { en: 'on target',  tr: 'hedefte' },
  'over':       { en: 'over plan',  tr: 'plan üstü' },
  'under':      { en: 'under plan', tr: 'plan altı' },
  'incomplete': { en: 'incomplete', tr: 'eksik' },
}

export const EXECUTION_STATUS_COLOR = {
  'on-target':  '#5bc25b',
  'over':       '#f5c542',
  'under':      '#f5c542',
  'incomplete': '#e03030',
}

export const EXECUTION_THRESHOLDS = {
  ON_TARGET_DURATION_TOL_PCT,
  OVER_DURATION_PCT,
  UNDER_DURATION_PCT,
  INCOMPLETE_DURATION_PCT,
  ON_TARGET_RPE_TOL,
  ON_TARGET_TSS_TOL_PCT,
}

/**
 * v9.140.0 — One-line next-action implication of today's execution.
 *
 * The EXECUTION snapshot already surfaces deltas (duration, RPE, TSS).
 * What it didn't say: *what should tomorrow look like?* This function
 * maps the status to a single bilingual sentence the UI can render
 * below the deltas, converting passive numbers into an adherence
 * signal. Citations are included where the implication maps to a
 * well-known training principle.
 *
 * Returns null for 'on-target' — green-color status is already its
 * own affirmation; an extra sentence would be noise.
 *
 * @param {object|null} execution - return value of computeSessionExecution
 * @returns {{en: string, tr: string, citation?: string} | null}
 */
export function getExecutionImplication(execution) {
  if (!execution) return null
  switch (execution.status) {
    case 'over':
      return {
        en: 'Recovery debt. Keep tomorrow easy regardless of plan — let CTL absorb the overshoot.',
        tr: 'Toparlanma borcu. Plandan bağımsız olarak yarını kolay tut — CTL fazlalığı emsin.',
        citation: 'Banister 1991 (acute load > chronic load → injury risk)',
      }
    case 'under':
      return {
        en: 'No recovery cost. Tomorrow stays as planned.',
        tr: 'Toparlanma maliyeti yok. Yarın plan değişmez.',
      }
    case 'incomplete':
      return {
        en: 'Adherence over cramming. Tomorrow stays as planned — don\'t double up.',
        tr: 'Toplama değil süreklilik. Yarın plan değişmez — telafi etmeye çalışma.',
      }
    case 'on-target':
    default:
      return null
  }
}
