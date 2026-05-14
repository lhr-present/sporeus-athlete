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
// - Status thresholds are coarse on purpose. The output is a glance-able
//   summary, not a coaching judgement.
//
// v9.153.0 (Prompt 8) — HR and pace deltas added when FIT-import data is
// available. Both fields are conditional: when the plan carries no
// hrTarget/paceTarget OR the log entry has no avgHR/distance, the
// corresponding block is simply omitted. The status field is unaffected
// — these deltas are pure render-time enrichment, not coaching judgement.
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

// Parse "5:30/km" / "1:30/100m" / "330" → seconds per unit. Returns null on
// malformed input. The unit suffix is dropped — pace comparison is always
// like-for-like since hrTarget/paceTarget come from the same plan generator.
function parsePaceSec(input) {
  if (input == null) return null
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? input : null
  const s = String(input).trim()
  if (!s) return null
  const m = s.match(/^(\d{1,2}):([0-5]?\d)/)
  if (m) {
    const sec = Number(m[1]) * 60 + Number(m[2])
    return sec > 0 ? sec : null
  }
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

// Parse "150-165" → { lo:150, hi:165, mid:157.5 }, "150" → { lo:150, hi:150, mid:150 }.
// Returns null on garbage input. Range targets win when present so a logged
// avgHR inside the band reads "in range" rather than +/-deltas off midpoint.
function parseHrTarget(input) {
  if (input == null) return null
  if (typeof input === 'number') {
    return Number.isFinite(input) && input > 0 ? { lo: input, hi: input, mid: input } : null
  }
  const s = String(input).trim()
  if (!s) return null
  const range = s.match(/^(\d{2,3})\s*[-–—]\s*(\d{2,3})$/)
  if (range) {
    const lo = Number(range[1]); const hi = Number(range[2])
    if (lo > 0 && hi > 0 && hi >= lo) return { lo, hi, mid: (lo + hi) / 2 }
    return null
  }
  const single = Number(s.replace(/[^\d.]/g, ''))
  return Number.isFinite(single) && single > 0 ? { lo: single, hi: single, mid: single } : null
}

// Logged pace from log entry. Prefers explicit avgPaceSecKm (set by fileImport),
// falls back to derive from distanceM + durationSec. Returns sec/km or null.
function deriveLoggedPaceSec(logEntry) {
  const direct = num(logEntry.avgPaceSecKm)
  if (direct != null && direct > 0) return direct
  const distM = num(logEntry.distanceM)
  const durSec = num(logEntry.durationSec) ?? (num(logEntry.duration) != null ? num(logEntry.duration) * 60 : null)
  if (distM == null || distM <= 0 || durSec == null || durSec <= 0) return null
  return durSec / (distM / 1000)
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

  // v9.153.0 (Prompt 8) — HR delta. Range-aware: when plannedRange is set,
  // an avgHR inside [lo, hi] reads as `in-range`; outside surfaces direction
  // ('above' / 'below') plus the gap to the nearest band edge.
  const plannedHr = parseHrTarget(plannedSession.hrTarget)
  const loggedHr  = num(logEntry.avgHR)
  if (plannedHr && loggedHr != null && loggedHr > 0) {
    let hrStatus, gap
    if (loggedHr >= plannedHr.lo && loggedHr <= plannedHr.hi) {
      hrStatus = 'in-range'; gap = 0
    } else if (loggedHr > plannedHr.hi) {
      hrStatus = 'above'; gap = loggedHr - plannedHr.hi
    } else {
      hrStatus = 'below'; gap = loggedHr - plannedHr.lo  // negative
    }
    result.hr = {
      planned:      plannedHr.mid,
      plannedRange: plannedHr.lo === plannedHr.hi ? null : [plannedHr.lo, plannedHr.hi],
      logged:       loggedHr,
      delta:        Math.round(loggedHr - plannedHr.mid),
      gap:          Math.round(gap),
      status:       hrStatus,
    }
  }

  // v9.153.0 (Prompt 8) — Pace delta. Pace is sec/km; lower = faster.
  // `delta = logged - planned`: negative means faster than plan.
  // Status: `fast` (>3% faster), `slow` (>3% slower), else `on-target`.
  // 3% ≈ ~10s/km at 5:30/km — coarser than HR because GPS noise + terrain.
  const plannedPaceSec = parsePaceSec(plannedSession.paceTarget)
  const loggedPaceSec  = deriveLoggedPaceSec(logEntry)
  if (plannedPaceSec != null && loggedPaceSec != null) {
    const paceDelta = loggedPaceSec - plannedPaceSec
    const paceDeltaPct = paceDelta / plannedPaceSec
    let paceStatus = 'on-target'
    if (paceDeltaPct < -0.03) paceStatus = 'fast'
    else if (paceDeltaPct > 0.03) paceStatus = 'slow'
    result.pace = {
      planned:  Math.round(plannedPaceSec),
      logged:   Math.round(loggedPaceSec),
      delta:    Math.round(paceDelta),
      deltaPct: Math.round(paceDeltaPct * 1000) / 1000,
      status:   paceStatus,
    }
  }

  return result
}

// Exported for tests + UI formatters that need consistent parsing.
export const _internal = { parsePaceSec, parseHrTarget, deriveLoggedPaceSec }

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
