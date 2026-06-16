// ─── src/lib/plan/planValidators.js ───────────────────────────────────────────
// E13 Adaptive Plan Generator — pure validators
//
// Sanity checks for plans returned by generatePlan() / applyTaper():
//   1. No week-over-week TSS jump > 10% (ACWR safe)
//   2. ≥ 1 recovery (or rest) day per week
//   3. No back-to-back Z5 (VO2 / test) days
//   4. Taper → Race is a monotonic load REDUCTION (Mujika & Padilla 2003)
//
// Returns { valid: bool, errors: [{code, message: {en,tr}, weekNum?}] }
// Pure — never throws, never logs, never mutates input.

const CODES = {
  EMPTY_PLAN:      'EMPTY_PLAN',
  INVALID_PLAN:    'INVALID_PLAN',
  TSS_SPIKE:       'TSS_SPIKE',
  NO_RECOVERY:     'NO_RECOVERY',
  BACK_TO_BACK_Z5: 'BACK_TO_BACK_Z5',
  NEGATIVE_TSS:    'NEGATIVE_TSS',
  EMPTY_WEEK:      'EMPTY_WEEK',
  TAPER_RAMP_UP:   'TAPER_RAMP_UP',
}

// ── helper: bilingual message factory ────────────────────────────────────────
function msg(en, tr) { return { en, tr } }

// ── helper: identify a recovery / rest day ───────────────────────────────────
function isRecoveryDay(session) {
  if (!session) return false
  return session.intent === 'recovery' || session.intent === 'rest'
}

// ── helper: identify a Z5 / VO2 day ──────────────────────────────────────────
function isZ5Day(session) {
  if (!session) return false
  return session.intent === 'vo2' || session.zone === 'Z5'
}

/**
 * @description Validate an adaptive plan against ACWR + recovery + intensity
 *   sequencing rules. Pure function; never throws; returns structured errors.
 * @param {Object} plan - Plan returned by generatePlan() or applyTaper()
 * @returns {{ valid: boolean, errors: Array<{code:string,message:{en:string,tr:string},weekNum?:number}> }}
 * @example
 * validatePlan(generatePlan({...})) // => { valid: true, errors: [] }
 */
export function validatePlan(plan) {
  const errors = []

  if (!plan || typeof plan !== 'object') {
    errors.push({
      code: CODES.INVALID_PLAN,
      message: msg('Plan is missing or not an object.', 'Plan eksik veya nesne değil.'),
    })
    return { valid: false, errors }
  }

  const weeks = plan.weeks
  if (!Array.isArray(weeks) || weeks.length === 0) {
    errors.push({
      code: CODES.EMPTY_PLAN,
      message: msg('Plan contains no weeks.', 'Plan hafta içermiyor.'),
    })
    return { valid: false, errors }
  }

  // ── Per-week structural checks ──────────────────────────────────────────
  for (const wk of weeks) {
    if (!wk || typeof wk !== 'object') {
      errors.push({
        code: CODES.EMPTY_WEEK,
        message: msg('Week object is malformed.', 'Hafta nesnesi bozuk.'),
        weekNum: wk?.weekNum,
      })
      continue
    }
    if (!Array.isArray(wk.sessions) || wk.sessions.length === 0) {
      errors.push({
        code: CODES.EMPTY_WEEK,
        message: msg(`Week ${wk.weekNum} has no sessions.`, `Hafta ${wk.weekNum} antrenman içermiyor.`),
        weekNum: wk.weekNum,
      })
      continue
    }
    if (typeof wk.weeklyTSS === 'number' && wk.weeklyTSS < 0) {
      errors.push({
        code: CODES.NEGATIVE_TSS,
        message: msg(`Week ${wk.weekNum} has negative TSS.`, `Hafta ${wk.weekNum} negatif TSS içeriyor.`),
        weekNum: wk.weekNum,
      })
    }

    // ── Rule 2: ≥ 1 recovery / rest day per week ──────────────────────────
    const hasRecovery = wk.sessions.some(isRecoveryDay)
    // Race week is allowed to skip recovery (taper preceded it).
    if (!hasRecovery && wk.phase !== 'Race') {
      errors.push({
        code: CODES.NO_RECOVERY,
        message: msg(
          `Week ${wk.weekNum} has no recovery / rest day.`,
          `Hafta ${wk.weekNum} toparlanma günü içermiyor.`,
        ),
        weekNum: wk.weekNum,
      })
    }

    // ── Rule 3: no back-to-back Z5 days ───────────────────────────────────
    const sortedDays = [...wk.sessions].sort((a, b) => (a.day ?? 0) - (b.day ?? 0))
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = sortedDays[i - 1]
      const curr = sortedDays[i]
      if (isZ5Day(prev) && isZ5Day(curr) && (curr.day ?? 0) - (prev.day ?? 0) === 1) {
        errors.push({
          code: CODES.BACK_TO_BACK_Z5,
          message: msg(
            `Week ${wk.weekNum} has back-to-back Z5 sessions on days ${prev.day} → ${curr.day}.`,
            `Hafta ${wk.weekNum} ardışık Z5 günleri içeriyor (${prev.day} → ${curr.day}).`,
          ),
          weekNum: wk.weekNum,
        })
        break  // one BTB per week is enough
      }
    }
  }

  // ── Rule 1: TSS week-over-week jump > 10% (ACWR safe) ──────────────────
  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i - 1]
    const curr = weeks[i]
    const prevTSS = prev?.weeklyTSS ?? 0
    const currTSS = curr?.weeklyTSS ?? 0
    if (prevTSS <= 0) continue
    // Skip checks across phase boundaries that intentionally re-load:
    //  - prior week was a deload (curr is rebound, expected to jump)
    //  - prior or current week is Race/Taper (taper rebuilds load to peak)
    if (prev.isDeload) continue
    if (prev.phase === 'Race' || prev.phase === 'Taper') continue
    if (curr.phase === 'Race' || curr.phase === 'Taper') continue
    if (currTSS > prevTSS * 1.10 + 0.5) {  // +0.5 absorbs rounding
      const pctJump = Math.round(((currTSS - prevTSS) / prevTSS) * 1000) / 10
      errors.push({
        code: CODES.TSS_SPIKE,
        message: msg(
          `Week ${curr.weekNum}: TSS jumps ${pctJump}% vs prior week (>10% — ACWR risk).`,
          `Hafta ${curr.weekNum}: Önceki haftaya göre TSS %${pctJump} arttı (>%10 — ACWR riski).`,
        ),
        weekNum: curr.weekNum,
      })
    }
  }

  // ── Rule 4: Taper → Race monotonic descent (Mujika & Padilla 2003) ──────
  // The taper is a load REDUCTION. Each Taper/Race week must be ≤ the previous
  // Taper/Race week (strict-or-equal monotonic descent) AND must not exceed the
  // load the athlete enters the taper carrying — i.e. the achieved peak-week TSS
  // OR, for standalone taper models (applyTaper, which rebuilds the tail from a
  // "fully-loaded" pre-taper anchor), the first taper week's own value. Tiny
  // per-session rounding is absorbed with +0.5. Pre-v9.422 the taper was exempt
  // from WoW checks entirely and could ramp UP / exceed the peak; now asserted.
  const peakWeeks = weeks
    .filter(w => w && w.phase === 'Peak' && !w.isDeload && typeof w.weeklyTSS === 'number')
    .map(w => w.weeklyTSS)
  const taperRun = weeks.filter(w => w && (w.phase === 'Taper' || w.phase === 'Race'))
  const firstTaperTSS = taperRun.length ? (taperRun[0].weeklyTSS ?? 0) : 0
  // Ceiling: the higher of the achieved peak and the taper's own loaded start.
  const peakCeil = Math.max(peakWeeks.length ? Math.max(...peakWeeks) : 0, firstTaperTSS)
  let prevTaperTSS = Infinity
  for (const wk of taperRun) {
    const tss = wk.weeklyTSS ?? 0
    if (tss > prevTaperTSS + 0.5) {
      errors.push({
        code: CODES.TAPER_RAMP_UP,
        message: msg(
          `Week ${wk.weekNum}: taper TSS rises vs prior taper week (must monotonically reduce).`,
          `Hafta ${wk.weekNum}: azaltma haftası TSS önceki haftaya göre arttı (azalmalı).`,
        ),
        weekNum: wk.weekNum,
      })
    }
    if (tss > peakCeil + 0.5) {
      errors.push({
        code: CODES.TAPER_RAMP_UP,
        message: msg(
          `Week ${wk.weekNum}: taper TSS (${tss}) exceeds the peak week (${peakCeil}).`,
          `Hafta ${wk.weekNum}: azaltma haftası TSS (${tss}) zirve haftasını (${peakCeil}) aşıyor.`,
        ),
        weekNum: wk.weekNum,
      })
    }
    prevTaperTSS = tss
  }

  return { valid: errors.length === 0, errors }
}

/**
 * @description Quick boolean check — returns true if validatePlan finds no errors.
 * @param {Object} plan
 * @returns {boolean}
 */
export function isPlanValid(plan) {
  return validatePlan(plan).valid
}

// ── Exposed code constants for consumer assertions ───────────────────────────
export const VALIDATION_CODES = { ...CODES }
