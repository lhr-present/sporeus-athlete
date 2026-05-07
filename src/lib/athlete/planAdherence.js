// ─── lib/athlete/planAdherence.js — E32: Plan Adherence Tracker ──────────────
// Compute week-by-week planned vs actual TSS for last `weeks` plan weeks.
//
// Plan schema (from localStorage 'sporeus-plan'):
//   { generatedAt: 'YYYY-MM-DD', weeks: [{ week, phase, sessions, tss, ... }] }
//
// Week start dates are computed as: new Date(plan.generatedAt) + weekIndex * 7 days
//
// planStatus (from localStorage 'sporeus-plan-status') is keyed as `${weekIdx}-${dayIdx}`
// with values 'done' | 'modified' — it does NOT store TSS; actual TSS comes from log.

/**
 * Compute week-by-week planned vs actual TSS for last `weeks` plan weeks.
 *
 * @param {Object|null} plan        - plan object from localStorage (may be null)
 * @param {Object}      planStatus  - planStatus object from localStorage (may be {})
 * @param {Array}       log         - training log entries [{ date, tss }]
 * @param {number}      weeks       - how many recent plan weeks to return (default 8)
 * @param {string}      today       - 'YYYY-MM-DD' (default: current date)
 *
 * @returns {Array} [] if plan is null or plan.weeks is empty.
 *   Otherwise [{ weekStart, plannedTSS, actualTSS, compliance, status }] sorted oldest→newest.
 *   - compliance: (actualTSS / plannedTSS * 100) clamped [0, 150], or null if plannedTSS === 0
 *   - status: 'on_track' (80–115%), 'over' (>115%), 'under' (<80%), 'unknown' if compliance null
 */
export function computePlanAdherence(
  plan,
  planStatus,
  log = [],
  weeks = 8,
  today = new Date().toISOString().slice(0, 10),
) {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return []

  const generatedAt = plan.generatedAt || plan.start_date
  if (!generatedAt) return []

  const planStart = new Date(generatedAt + 'T00:00:00Z')
  const todayMs   = new Date(today + 'T00:00:00Z').getTime()
  const totalPlanWeeks = plan.weeks.length

  // Determine which week index today falls in (0-based)
  const _currentWeekIdx = Math.floor((todayMs - planStart.getTime()) / (7 * 86400000))

  // Collect all weeks that have started (weekIdx <= currentWeekIdx) and exist in plan
  const completedWeekIndices = []
  for (let wi = 0; wi < totalPlanWeeks; wi++) {
    const wStartMs = planStart.getTime() + wi * 7 * 86400000
    if (wStartMs <= todayMs) {
      completedWeekIndices.push(wi)
    }
  }

  // Take the last `weeks` of those
  const sliceStart = Math.max(0, completedWeekIndices.length - weeks)
  const selectedIndices = completedWeekIndices.slice(sliceStart)

  return selectedIndices.map(wi => {
    const weekStartDate = new Date(planStart.getTime() + wi * 7 * 86400000)
    const weekEndDate   = new Date(weekStartDate.getTime() + 7 * 86400000)
    const weekStartStr  = weekStartDate.toISOString().slice(0, 10)
    const weekEndStr    = weekEndDate.toISOString().slice(0, 10)

    const planWeek     = plan.weeks[wi]
    const plannedTSS   = planWeek?.tss || planWeek?.TSS || 0

    // Sum log TSS for dates in [weekStart, weekEnd)
    const actualTSS = (log || []).reduce((sum, e) => {
      const d = (e.date || '').slice(0, 10)
      if (d >= weekStartStr && d < weekEndStr) return sum + (e.tss || 0)
      return sum
    }, 0)

    let compliance = null
    let status     = 'unknown'

    if (plannedTSS > 0) {
      compliance = Math.min(150, Math.max(0, Math.round(actualTSS / plannedTSS * 100)))
      if      (compliance > 115) status = 'over'
      else if (compliance >= 80) status = 'on_track'
      else                       status = 'under'
    }

    return { weekStart: weekStartStr, plannedTSS, actualTSS: Math.round(actualTSS), compliance, status }
  })
}

/**
 * Returns a summary object, or null if no plan data.
 *
 * @returns {{ adherenceWeeks, avgCompliance, overallStatus, weeksOnTrack, weeksOver, weeksUnder } | null}
 *   - overallStatus: 'on_track' | 'over' | 'under' | null (if no data with compliance)
 */
export function computeAdherenceSummary(
  plan,
  planStatus,
  log = [],
  weeks = 8,
  today = new Date().toISOString().slice(0, 10),
) {
  const adherenceWeeks = computePlanAdherence(plan, planStatus, log, weeks, today)
  if (adherenceWeeks.length === 0) return null

  const withCompliance = adherenceWeeks.filter(w => w.compliance !== null)
  const avgCompliance  = withCompliance.length
    ? Math.round(withCompliance.reduce((s, w) => s + w.compliance, 0) / withCompliance.length)
    : null

  let overallStatus = null
  if (avgCompliance !== null) {
    if      (avgCompliance > 115) overallStatus = 'over'
    else if (avgCompliance >= 80) overallStatus = 'on_track'
    else                          overallStatus = 'under'
  }

  const weeksOnTrack = adherenceWeeks.filter(w => w.status === 'on_track').length
  const weeksOver    = adherenceWeeks.filter(w => w.status === 'over').length
  const weeksUnder   = adherenceWeeks.filter(w => w.status === 'under').length

  return { adherenceWeeks, avgCompliance, overallStatus, weeksOnTrack, weeksOver, weeksUnder }
}

// ─── v8.98.0 — buildPlanAdherence (Elite Program reconciliation) ─────────────
// Compares the prescribed Elite Program (weeklyTSS + sampleWeeks intents) to
// the athlete's actual training_log entries within the program window.
// Surfaces a developer-facing API contract that downstream UI (adherence
// section, make-up suggestion, coach share payload, etc.) can rely on
// without duplicating the rules.
//
// Pure, no React, no I/O. Bilingual messages embedded.
// References: Banister 1991 fitness-fatigue model; Bompa 2009 periodization;
// Mujika 2009 — adherence and CTL coupling.
// ─────────────────────────────────────────────────────────────────────────────

import { entryMatchesProgramSport } from './_logSport.js'

const ADHERENCE_CITATION = 'Banister 1991; Bompa 2009; Mujika 2009 adherence-CTL coupling'

const TRAJECTORY_LABELS = {
  'on-track': {
    en: 'On track — actual training matches the plan',
    tr: 'Yolda — gerçek antrenman planla uyumlu',
  },
  behind: {
    en: 'Behind — consider easing this week or extending race date',
    tr: 'Geride — bu hafta hafifle veya yarışı ertele',
  },
  ahead: {
    en: 'Ahead of plan — verify recovery to avoid overreach',
    tr: 'Plandan ileride — aşırı yüklenmeyi önlemek için toparlanmayı doğrula',
  },
  critical: {
    en: 'Critically behind — re-project or adjust target',
    tr: 'Kritik geride — yeniden hesapla veya hedefi ayarla',
  },
}

const TRAJECTORY_RECS = {
  'on-track': {
    en: 'Hold the cadence and protect easy days.',
    tr: 'Tempoyu koru ve kolay günleri kollamayı sürdür.',
  },
  behind: {
    en: 'Drop a key session this week, then resume next week.',
    tr: 'Bu hafta bir anahtar seansı bırak, gelecek hafta devam et.',
  },
  ahead: {
    en: 'Add a deload day; sustained over-volume erodes adaptation.',
    tr: 'Bir deload günü ekle; sürekli aşırı hacim adaptasyonu bozar.',
  },
  critical: {
    en: 'Re-run the program with realistic weekly hours, or push the race date.',
    tr: 'Programı gerçekçi haftalık saatlerle yeniden oluştur veya yarış tarihini ileri al.',
  },
}

function adhParseUTC(s) {
  if (!s || typeof s !== 'string') return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return isNaN(d.getTime()) ? null : d
}

function adhTodayUTC() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function adhAddDays(d, n) {
  return new Date(d.getTime() + n * 86400000)
}

function adhIso(d) {
  return d.toISOString().slice(0, 10)
}

// Map a sample-week intent label to a coarse intent key used for matching the
// athlete's log. Returns one of: 'long' | 'threshold' | 'intervals' | null.
function adhKeyIntent(intentLabel) {
  if (!intentLabel) return null
  const txt = (typeof intentLabel === 'string'
    ? intentLabel
    : (intentLabel.en || '')
  ).toLowerCase()
  if (/long/.test(txt)) return 'long'
  if (/threshold|tempo|cruise/.test(txt)) return 'threshold'
  if (/interval|vo2|race-pace/.test(txt)) return 'intervals'
  return null
}

// Detect a coarse intent key from a log entry's free-text fields.
function adhLogIntent(entry) {
  if (!entry || typeof entry !== 'object') return null
  const blob = `${entry.type || ''} ${entry.intent || ''} ${entry.notes || ''} ${entry.session || ''}`.toLowerCase()
  if (!blob.trim()) return null
  if (/long/.test(blob)) return 'long'
  if (/threshold|tempo|cruise/.test(blob)) return 'threshold'
  if (/interval|vo2|race-pace|repetition/.test(blob)) return 'intervals'
  return null
}

function unreliableAdherence(extra = {}) {
  return {
    adherencePct: 0,
    weeklyComparison: [],
    missedKeySessions: [],
    trajectory: 'on-track',
    message: { en: '', tr: '' },
    recommendation: { en: '', tr: '' },
    weeksAnalyzed: 0,
    reliable: false,
    citation: ADHERENCE_CITATION,
    ...extra,
  }
}

/**
 * Reconcile a prescribed Elite Program with the athlete's actual training log.
 *
 * @param {Object|null} program  The buildEliteProgram result (must expose
 *   weeklyTSS array, optional sampleWeeks, optional resolvedTargetPR).
 * @param {Array}       log     Training log entries [{ date, tss, type, ... }].
 * @param {Object}      options { programStart: ISO date|null,
 *                                today: ISO date|null,
 *                                raceDate: ISO date|null }
 * @returns {{
 *   adherencePct: number,
 *   weeklyComparison: Array<{
 *     weekIndex: number,
 *     plannedTSS: number,
 *     actualTSS: number,
 *     pctOfPlanned: number,
 *     status: 'matched'|'short'|'over'|'missing',
 *   }>,
 *   missedKeySessions: Array<{ date: string, intent: 'long'|'threshold'|'intervals', durationMin: number }>,
 *   trajectory: 'on-track'|'behind'|'ahead'|'critical',
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   weeksAnalyzed: number,
 *   reliable: boolean,
 *   citation: string,
 * }}
 *
 * @public
 */
export function buildPlanAdherence(program, log, options = {}) {
  const opts = options || {}
  if (!program || typeof program !== 'object') return unreliableAdherence()
  const weeklyTSS = Array.isArray(program.weeklyTSS) ? program.weeklyTSS : []
  if (weeklyTSS.length === 0) return unreliableAdherence()
  const programSport = program.sport || program.input?.sport || null

  const today = opts.today ? adhParseUTC(opts.today) : adhTodayUTC()
  if (!today) return unreliableAdherence()

  // Resolve race date (clamp window). May be null.
  const raceDateStr = opts.raceDate
    || program?.input?.raceDate
    || program?.feasibility?.effectiveRaceDate
    || null
  const raceDate = adhParseUTC(raceDateStr)

  // Resolve program start. Fallback: today - weeksAvailable * 7.
  let programStart = adhParseUTC(opts.programStart || null)
  if (!programStart) {
    const weeksAvail = weeklyTSS.length
    programStart = adhAddDays(today, -weeksAvail * 7)
  }

  // weeksAvailable=0 (race today / nothing to analyze)
  if (weeklyTSS.length === 0) return unreliableAdherence()

  // Effective end of analysis window: clamp today to raceDate if past.
  let windowEnd = today
  if (raceDate && raceDate.getTime() < today.getTime()) {
    windowEnd = raceDate
  }

  const safeLog = Array.isArray(log) ? log : []
  // Filter log to in-window entries with valid date + numeric tss + sport
  // matching the program. Cross-training entries (e.g. cycling on a run plan)
  // would otherwise inflate adherence — see entryMatchesProgramSport for the
  // null-tag passthrough rule.
  const inWindow = safeLog.filter(e => {
    if (!e || typeof e !== 'object') return false
    const d = adhParseUTC((e.date || '').slice(0, 10))
    if (!d) return false
    if (!entryMatchesProgramSport(e, programSport)) return false
    if (typeof e.tss !== 'number' || !Number.isFinite(e.tss)) {
      // allow entries with intent matching even when tss missing — but only
      // count tss=0 toward weekly volume
    }
    return d.getTime() >= programStart.getTime() && d.getTime() <= windowEnd.getTime()
  })

  // Bucket log entries by week index relative to programStart.
  const weeksElapsedFloor = Math.floor((windowEnd.getTime() - programStart.getTime()) / (7 * 86400000))
  const weeksToCompare = Math.max(0, Math.min(weeklyTSS.length, weeksElapsedFloor + 1))

  // weeksAnalyzed excludes the partial (current) week.
  const weeksAnalyzed = Math.max(0, weeksElapsedFloor)

  // For each week, sum actualTSS within [weekStart, weekStart+7).
  const weeklyComparison = []
  for (let wi = 0; wi < weeksToCompare; wi++) {
    const wStart = adhAddDays(programStart, wi * 7)
    const wEnd   = adhAddDays(programStart, (wi + 1) * 7)
    const wStartMs = wStart.getTime()
    const wEndMs   = wEnd.getTime()
    const plannedTSS = Number(weeklyTSS[wi]) || 0
    let actualTSS = 0
    for (const e of inWindow) {
      const d = adhParseUTC((e.date || '').slice(0, 10))
      if (!d) continue
      const t = d.getTime()
      if (t >= wStartMs && t < wEndMs) {
        const tss = Number(e.tss)
        if (Number.isFinite(tss)) actualTSS += tss
      }
    }
    const pctOfPlanned = plannedTSS > 0
      ? Math.round((actualTSS / plannedTSS) * 100)
      : 0
    let status
    if (plannedTSS > 50 && actualTSS === 0) status = 'missing'
    else if (plannedTSS > 0 && actualTSS > plannedTSS * 1.15) status = 'over'
    else if (plannedTSS > 0 && actualTSS < plannedTSS * 0.85) status = 'short'
    else status = 'matched'
    weeklyComparison.push({
      weekIndex: wi,
      plannedTSS,
      actualTSS: Math.round(actualTSS),
      pctOfPlanned,
      status,
    })
  }

  // adherencePct: Σ(min(actual, planned)) / Σ(planned) over completed weeks.
  // Excludes today's incomplete week (i.e., uses weeksAnalyzed as the cap).
  const completed = weeklyComparison.slice(0, weeksAnalyzed)
  let plannedSum = 0
  let cappedSum = 0
  for (const w of completed) {
    plannedSum += w.plannedTSS
    cappedSum  += Math.min(w.actualTSS, w.plannedTSS)
  }
  const adherencePct = plannedSum > 0
    ? Math.round((cappedSum / plannedSum) * 100)
    : 0

  // Reliable when: program present, log non-empty within window, AND ≥2 complete weeks.
  if (weeksAnalyzed < 2 || inWindow.length === 0) {
    return unreliableAdherence({
      weeklyComparison,
      weeksAnalyzed,
    })
  }

  // Missed key sessions: walk completed weeks, look at sampleWeeks for the
  // phase that the week falls in, flag prescribed key intents that don't
  // appear (±2 days) in the log within the corresponding week.
  const missedKeySessions = []
  const phaseForWeek = (weekIndex) => {
    const phases = Array.isArray(program.phases) ? program.phases : []
    for (const p of phases) {
      const ws = Array.isArray(p.weeks) ? p.weeks : []
      // p.weeks is 1-based [1,2,3...]; weekIndex here is 0-based.
      if (ws.includes(weekIndex + 1)) return p.phase
    }
    return null
  }
  const dayOffsets = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }
  for (let wi = 0; wi < completed.length; wi++) {
    const phase = phaseForWeek(wi)
    if (!phase) continue
    const sample = program.sampleWeeks?.[phase]
    if (!Array.isArray(sample)) continue
    const wStart = adhAddDays(programStart, wi * 7)
    for (const day of sample) {
      const ki = adhKeyIntent(day?.intent)
      if (!ki) continue
      const off = dayOffsets[day.day] ?? 0
      const target = adhAddDays(wStart, off)
      const targetMs = target.getTime()
      // Look for log entry within ±2 days of target with matching key intent
      const tolMs = 2 * 86400000
      const matched = inWindow.some(e => {
        const d = adhParseUTC((e.date || '').slice(0, 10))
        if (!d) return false
        if (Math.abs(d.getTime() - targetMs) > tolMs) return false
        const lk = adhLogIntent(e)
        return lk === ki
      })
      if (!matched) {
        missedKeySessions.push({
          date: adhIso(target),
          intent: ki,
          durationMin: Number(day.durationMin) || 0,
        })
      }
    }
  }

  // Trajectory classification.
  let trajectory
  if (adherencePct > 110) trajectory = 'ahead'
  else if (adherencePct >= 90 && missedKeySessions.length === 0) trajectory = 'on-track'
  else if (adherencePct >= 75) trajectory = 'behind'
  else trajectory = 'critical'

  // Patch the "behind" message with the actual gap percent.
  let message = { ...TRAJECTORY_LABELS[trajectory] }
  if (trajectory === 'behind') {
    const gap = Math.max(0, 100 - adherencePct)
    message = {
      en: `Behind ${gap}% — consider easing this week or extending race date`,
      tr: `${gap}% geride — bu hafta hafifle veya yarışı ertele`,
    }
  }

  return {
    adherencePct,
    weeklyComparison,
    missedKeySessions,
    trajectory,
    message,
    recommendation: { ...TRAJECTORY_RECS[trajectory] },
    weeksAnalyzed,
    reliable: true,
    citation: ADHERENCE_CITATION,
  }
}

// ─── Reprojection (v8.99.0) ──────────────────────────────────────────────────
// When adherence detects the athlete behind the plan, suggest a concrete
// adjustment: extend the race date OR soften the target. Pure helper that
// computes the suggested deltas so the UI can render a confirm dialog and
// pre-fill the regenerate-form path.

/**
 * Compute a reprojection suggestion given an in-flight program and its
 * adherence telemetry. Returns null when no adjustment is warranted
 * (trajectory on-track or ahead) or when inputs are missing.
 *
 * Strategy:
 *   trajectory='behind'   → extend race date by 2 weeks, keep target
 *   trajectory='critical' → extend race date by 4 weeks AND soften
 *                            target by 5% (run/tri: VDOT-anchored;
 *                            bike: FTP-anchored; swim: pace-anchored)
 *
 * @param {Object} program   buildEliteProgram() result with input + feasibility
 * @param {Object} adherence buildPlanAdherence() result
 * @param {Object} options   { today: ISO date|null }
 * @returns {{
 *   strategy: 'extend' | 'extend-and-soften',
 *   addWeeks: number,
 *   newRaceDate: string,
 *   adjustedTargetTimeSec: number | null,   // null when no softening
 *   originalTargetTimeSec: number,
 *   targetSoftenPct: number,                // 0 when extend-only
 *   reasoning: { en: string, tr: string },
 *   reliable: boolean,
 * } | null}
 *
 * @public
 */
export function buildReprojectionSuggestion(program, adherence, options = {}) {
  if (!program || !adherence || !adherence.reliable) return null
  if (adherence.trajectory !== 'behind' && adherence.trajectory !== 'critical') return null

  const input = program.input || {}
  const targetPR = program.resolvedTargetPR || input.targetPR
  if (!targetPR || typeof targetPR.timeSec !== 'number' || targetPR.timeSec <= 0) return null

  const raceDateStr = input.raceDate || program.feasibility?.effectiveRaceDate
  if (!raceDateStr) return null

  const today = options.today || new Date().toISOString().slice(0, 10)
  const todayD = adhParseUTC(today)
  const raceD = adhParseUTC(raceDateStr)
  if (!todayD || !raceD) return null

  const isCritical = adherence.trajectory === 'critical'
  const addWeeks = isCritical ? 4 : 2
  const targetSoftenPct = isCritical ? 5 : 0

  const newRaceD = adhAddDays(raceD, addWeeks * 7)
  const newRaceDate = adhIso(newRaceD)

  let adjustedTargetTimeSec = null
  if (isCritical && targetPR.timeSec > 0) {
    // Bike-direct convention: timeSec is wattage and bigger = better.
    const bikeDirectFtp = input.sport === 'bike'
      && (targetPR.distanceM === 0 || targetPR.distanceM == null)
    if (bikeDirectFtp) {
      // Soften = lower wattage target.
      adjustedTargetTimeSec = Math.round(targetPR.timeSec * (1 - targetSoftenPct / 100))
    } else {
      // Soften = slower (larger) time target.
      adjustedTargetTimeSec = Math.round(targetPR.timeSec * (1 + targetSoftenPct / 100))
    }
  }

  const gap = Math.max(0, 100 - adherence.adherencePct)
  const reasoning = isCritical
    ? {
      en: `${gap}% behind. Extend race date by ${addWeeks} weeks AND soften target by ${targetSoftenPct}% to restore feasibility.`,
      tr: `${gap}% geride. Yarış tarihini ${addWeeks} hafta ertele VE hedefi ${targetSoftenPct}% yumuşat — fizibilite geri kazanılır.`,
    }
    : {
      en: `${gap}% behind. Extending race date by ${addWeeks} weeks restores feasibility while keeping the target.`,
      tr: `${gap}% geride. Yarış tarihini ${addWeeks} hafta ertelemek hedef korunarak fizibiliteyi geri getirir.`,
    }

  return {
    strategy: isCritical ? 'extend-and-soften' : 'extend',
    addWeeks,
    newRaceDate,
    adjustedTargetTimeSec,
    originalTargetTimeSec: targetPR.timeSec,
    targetSoftenPct,
    reasoning,
    reliable: true,
  }
}
