// src/lib/athlete/comebackDetector.js
//
// v9.109.0 (Prompt TT) — Detect athletes returning after a long gap.
//
// Pre-v9.109 the app treated a 14-day gap and a 1-day gap identically:
// same suggestions, same plan execution. But returning athletes who jump
// back to their prior load risk injury (de-trained connective tissue +
// elevated relative intensity at recovered CTL). Sports science recommends
// easing back at ~50% of last CTL for 1–2 weeks.
//
// This detector flags the comeback condition + offers an evidence-based
// load suggestion. Pure function. No I/O.

const MS_PER_DAY = 86400000

const COMEBACK_DAYS_MIN  = 14   // 2 weeks of silence triggers
const COMEBACK_DAYS_MAX  = 180  // beyond 6 months we treat as fresh start, not comeback
const PRIOR_CTL_FLOOR    = 10   // need at least this much prior CTL to call it a comeback
                                // (else they were barely training before — not a comeback)
const EASED_CTL_FRAC     = 0.5  // suggest restarting at 50% of last CTL

/**
 * @description Latest log date as ISO 'YYYY-MM-DD', or null when log is empty.
 *   Defensive against missing dates / non-array input.
 */
function latestLogDate(log) {
  let latest = null
  for (const e of (Array.isArray(log) ? log : [])) {
    const d = e?.date
    if (!d) continue
    const iso = String(d).slice(0, 10)
    if (!latest || iso > latest) latest = iso
  }
  return latest
}

/**
 * @description CTL on a target date (or latest), using a simple 42-day EMA
 *   matching calcLoad. Inlined here so this module is self-contained.
 */
function ctlAtDate(log, dateISO) {
  if (!Array.isArray(log) || log.length === 0) return 0
  const cutoff = new Date(dateISO + 'T12:00:00Z')
  if (Number.isNaN(cutoff.getTime())) return 0
  const k = 1 - Math.exp(-1 / 42)
  // Walk forward in date order; only entries on/before cutoff contribute
  const sorted = [...log]
    .filter(e => e?.date && String(e.date).slice(0, 10) <= dateISO)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
  let ctl = 0
  let lastDate = null
  for (const e of sorted) {
    const d = String(e.date).slice(0, 10)
    if (lastDate) {
      const days = Math.round((new Date(d) - new Date(lastDate)) / MS_PER_DAY)
      for (let i = 0; i < days; i++) ctl = ctl * (1 - k)
    }
    ctl = ctl + k * (Number(e.tss) || 0)
    lastDate = d
  }
  return ctl
}

/**
 * @description Detect comeback condition from log gap + prior fitness.
 *
 * @param {Array}  log     - training log entries
 * @param {string} [today] - 'YYYY-MM-DD'; defaults to today UTC
 * @returns {{
 *   isComeback: boolean,
 *   gapDays:    number,        // days since most recent log entry (0 if never trained)
 *   priorCTL:   number,        // CTL at the last logged date
 *   easedCTL:   number,        // 50% of priorCTL — suggested re-entry load
 *   lastDate:   string | null, // ISO date of most recent log entry
 * }}
 */
export function detectComebackGap(log, today) {
  const todayISO = today || new Date().toISOString().slice(0, 10)
  const lastDate = latestLogDate(log)

  if (!lastDate) {
    return { isComeback: false, gapDays: 0, priorCTL: 0, easedCTL: 0, lastDate: null }
  }

  const ms = new Date(todayISO + 'T12:00:00Z') - new Date(lastDate + 'T12:00:00Z')
  const gapDays = Math.max(0, Math.floor(ms / MS_PER_DAY))

  // Out of window: too recent to flag, OR so old we treat as fresh start
  if (gapDays < COMEBACK_DAYS_MIN || gapDays > COMEBACK_DAYS_MAX) {
    return { isComeback: false, gapDays, priorCTL: 0, easedCTL: 0, lastDate }
  }

  // Prior CTL: read at the last training date so de-detraining decay doesn't
  // factor in. If priorCTL was below the floor (10), the athlete wasn't
  // really training — not a comeback, just a fresh start with a low log.
  const priorCTL = ctlAtDate(log, lastDate)
  if (priorCTL < PRIOR_CTL_FLOOR) {
    return { isComeback: false, gapDays, priorCTL: Math.round(priorCTL), easedCTL: 0, lastDate }
  }

  return {
    isComeback: true,
    gapDays,
    priorCTL:  Math.round(priorCTL),
    easedCTL:  Math.round(priorCTL * EASED_CTL_FRAC),
    lastDate,
  }
}
