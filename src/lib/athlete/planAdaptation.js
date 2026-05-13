// src/lib/athlete/planAdaptation.js
//
// v9.94.0 — Mission 1 chain: EXECUTION → ADAPTATION
//
// The plan generator (v9.92) sets a TSS budget per week. The athlete logs
// actual sessions through QuickAdd / FIT import / etc. Until this module
// existed, nothing closed the loop: the plan never *responded* to actual
// execution. A consistently under-compliant athlete kept seeing the same
// aggressive plan; a consistently over-compliant one got no fatigue warning.
//
// This module:
//   1. Computes per-week plan-vs-actual TSS compliance for completed weeks.
//   2. Aggregates into a drift signal (avg pct over completed weeks).
//   3. Maps drift to a bilingual recommendation + a suggested `action`
//      that TodayView can wire to a button (continue / reduce-next /
//      monitor-fatigue / regenerate).
//
// Pure functions, no I/O.
//
// Why TSS-based and not session-marker-based: intelligence.js:561 already
// has a sessionDoneCount/planStatus compliance score. That tells us how
// many sessions were checked off, but a 30-min easy day logged as a 90-min
// long ride still counts as "done." TSS captures actual *load* delivered
// vs prescribed, which is the metric the plan was budgeted on.

// ── Status threshold constants ───────────────────────────────────────────────
// Within ±30% of planned → "on-track" (matches the v9.89 sessionExecution
// threshold philosophy — coarse on purpose, training is noisy).
const STATUS_THRESHOLDS = {
  missed:   0.30,   // < 30% → "missed-week"
  under:    0.70,   // < 70% → "under"
  onTrack:  1.30,   // 70-130% → "on-track"
  // > 130% → "over"
}

// ── Day-of-week mapping for week alignment ───────────────────────────────────
// plan.generatedAt anchors week 1 day 1. weekIdx = floor((today - start) / 7).
// A "completed" week is any week whose Sunday has passed.
function dateDiffDays(a, b) {
  const aD = new Date(a + 'T12:00:00Z')
  const bD = new Date(b + 'T12:00:00Z')
  return Math.floor((bD - aD) / 86400000)
}

// Build a date-keyed TSS map from log entries (cap at 300/day matching
// intelligence.js — defends against duplicate / monster-day outliers).
function buildTSSMap(log) {
  const map = {}
  for (const e of (log || [])) {
    if (!e?.date) continue
    const d = String(e.date).slice(0, 10)
    const tss = Number(e.tss) || 0
    if (tss <= 0) continue
    map[d] = Math.min((map[d] || 0) + tss, 300)
  }
  return map
}

/**
 * Compute one plan week's compliance from the log.
 *
 * @param {object} planWeek - { sessions: [{ tss, duration, type }, ...] }
 * @param {string} weekStartDate - 'YYYY-MM-DD' Monday of the plan week
 * @param {object} tssMap - date → actual TSS map (from buildTSSMap)
 * @returns {{ plannedTSS:number, actualTSS:number, pct:number, status:string, sessionsPlanned:number, daysLogged:number }}
 */
export function computeWeekCompliance(planWeek, weekStartDate, tssMap) {
  if (!planWeek || !Array.isArray(planWeek.sessions)) {
    return { plannedTSS: 0, actualTSS: 0, pct: 0, status: 'no-data', sessionsPlanned: 0, daysLogged: 0 }
  }
  // Sum planned TSS over non-rest sessions
  let plannedTSS = 0
  let sessionsPlanned = 0
  for (const s of planWeek.sessions) {
    const t = Number(s.tss ?? s.targetTSS ?? 0)
    if (t > 0 && String(s.type || '').toLowerCase() !== 'rest') {
      plannedTSS += t
      sessionsPlanned += 1
    }
  }

  // Sum actual TSS across the 7 days from weekStartDate
  let actualTSS = 0
  let daysLogged = 0
  const start = new Date(weekStartDate + 'T12:00:00Z')
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    const t = tssMap[key] || 0
    if (t > 0) {
      actualTSS += t
      daysLogged += 1
    }
  }

  const pct = plannedTSS > 0 ? actualTSS / plannedTSS : 0
  const status =
    plannedTSS === 0   ? 'rest-week'
    : pct < STATUS_THRESHOLDS.missed   ? 'missed'
    : pct < STATUS_THRESHOLDS.under    ? 'under'
    : pct <= STATUS_THRESHOLDS.onTrack ? 'on-track'
                                       : 'over'

  return {
    plannedTSS:      Math.round(plannedTSS),
    actualTSS:       Math.round(actualTSS),
    pct:             Math.round(pct * 100) / 100,
    status,
    sessionsPlanned,
    daysLogged,
  }
}

// ── Recommendation map ───────────────────────────────────────────────────────
// `action` codes:
//   'continue'         — keep the current plan
//   'reduce-next'      — plan too aggressive; ease the next block
//   'monitor-fatigue'  — running hotter than planned; watch TSB/HRV
//   'regenerate'       — drift too large to absorb; recompute from current CTL
//
// Citations are short references the UI can show alongside the recommendation.
const DRIFT_RULES = {
  // ── 0 completed weeks ─────────────────────────────────────────────────────
  pending: {
    action: 'continue',
    recommendation: {
      en: 'Plan in progress — adaptation review starts after your first complete week.',
      tr: 'Plan devam ediyor — adaptasyon değerlendirmesi ilk tamamlanmış haftadan sonra başlar.',
    },
    citation: '',
  },
  // ── Average compliance >130% over 2+ weeks ───────────────────────────────
  over: {
    action: 'monitor-fatigue',
    recommendation: {
      en: 'You\'re training above plan. Monitor TSB and HRV — adding more volume increases injury risk.',
      tr: 'Plandan fazla antrenman yapıyorsun. TSB ve HRV\'yi izle — daha fazla hacim sakatlık riskini artırır.',
    },
    citation: 'Hulin 2016 (ACWR injury risk)',
  },
  // ── Average 70-130% over 2+ weeks ─────────────────────────────────────────
  onTrack: {
    action: 'continue',
    recommendation: {
      en: 'Execution matches plan. Stay the course.',
      tr: 'Uygulama plan ile örtüşüyor. Aynı yolda devam et.',
    },
    citation: '',
  },
  // ── Average 30-70% over 2+ weeks ──────────────────────────────────────────
  under: {
    action: 'reduce-next',
    recommendation: {
      en: 'Plan is too aggressive — reduce next week\'s TSS by 20%, or accept slower fitness gain.',
      tr: 'Plan çok agresif — sonraki haftanın TSS\'sini %20 azalt veya daha yavaş kondisyon kazanımını kabul et.',
    },
    citation: 'Mujika 2003 (taper compliance)',
  },
  // ── Average <30% OR ≥2 missed weeks ──────────────────────────────────────
  drift: {
    action: 'regenerate',
    recommendation: {
      en: 'Plan-execution gap is large. Regenerate the plan from your current fitness so targets are achievable.',
      tr: 'Plan ile uygulama arasındaki fark büyük. Mevcut kondisyona göre planı yeniden oluştur, hedefler ulaşılabilir olsun.',
    },
    citation: 'Banister 1991 (fitness modeling)',
  },
}

/**
 * Compute plan drift over completed weeks and return a UI-ready recommendation.
 *
 * "Completed week": weekStart + 7 days <= today. Current week and future
 * weeks are excluded so the recommendation doesn't fire on a week mid-flight.
 *
 * @param {object} plan - { weeks, generatedAt }
 * @param {Array}  log  - training log entries (each { date, tss, ... })
 * @param {string} [today=ISO date] - 'YYYY-MM-DD'; defaults to today UTC
 * @returns {{
 *   weeksAnalyzed: number,
 *   weeks: WeekCompliance[],
 *   avgPct: number,
 *   missedWeeks: number,
 *   status: 'pending'|'on-track'|'under'|'over'|'drift',
 *   action: string,
 *   recommendation: { en: string, tr: string },
 *   citation: string,
 * } | null}
 */
export function computePlanDrift(plan, log, today) {
  if (!plan || !Array.isArray(plan.weeks) || !plan.generatedAt) return null
  const todayDate = today || new Date().toISOString().slice(0, 10)
  const tssMap = buildTSSMap(log)
  const planStartISO = String(plan.generatedAt).slice(0, 10)

  const weeks = []
  for (let i = 0; i < plan.weeks.length; i++) {
    const weekStart = new Date(planStartISO + 'T12:00:00Z')
    weekStart.setUTCDate(weekStart.getUTCDate() + i * 7)
    const weekStartISO = weekStart.toISOString().slice(0, 10)
    // "Completed" means the LAST day of the week (weekStart + 6) is in the past
    const lastDayOfWeek = new Date(weekStart)
    lastDayOfWeek.setUTCDate(weekStart.getUTCDate() + 6)
    if (dateDiffDays(lastDayOfWeek.toISOString().slice(0, 10), todayDate) < 1) {
      // Week not yet complete — stop scanning
      break
    }
    const wc = computeWeekCompliance(plan.weeks[i], weekStartISO, tssMap)
    weeks.push({ weekIdx: i, weekStart: weekStartISO, ...wc })
  }

  // Filter to weeks with a real planned load (skip 'rest-week' / 'no-data')
  const scoringWeeks = weeks.filter(w => w.status !== 'rest-week' && w.status !== 'no-data')

  if (scoringWeeks.length === 0) {
    return {
      weeksAnalyzed: 0,
      weeks,
      avgPct:        0,
      missedWeeks:   0,
      status:        'pending',
      action:        DRIFT_RULES.pending.action,
      recommendation: DRIFT_RULES.pending.recommendation,
      citation:      DRIFT_RULES.pending.citation,
    }
  }

  const avgPct = scoringWeeks.reduce((s, w) => s + w.pct, 0) / scoringWeeks.length
  const missedWeeks = scoringWeeks.filter(w => w.status === 'missed').length

  // Rule priority:
  //   1) ≥2 missed weeks OR avgPct < 0.30 → drift (regenerate)
  //   2) avgPct < 0.70 → under (reduce next)
  //   3) avgPct > 1.30 → over (monitor fatigue)
  //   4) otherwise on-track (continue)
  let ruleKey
  if (missedWeeks >= 2 || avgPct < STATUS_THRESHOLDS.missed) {
    ruleKey = 'drift'
  } else if (avgPct < STATUS_THRESHOLDS.under) {
    ruleKey = 'under'
  } else if (avgPct > STATUS_THRESHOLDS.onTrack) {
    ruleKey = 'over'
  } else {
    ruleKey = 'onTrack'
  }
  const rule = DRIFT_RULES[ruleKey]

  return {
    weeksAnalyzed: scoringWeeks.length,
    weeks,
    avgPct:        Math.round(avgPct * 100) / 100,
    missedWeeks,
    status:        ruleKey === 'onTrack' ? 'on-track' : ruleKey,
    action:        rule.action,
    recommendation: rule.recommendation,
    citation:      rule.citation,
  }
}

// ── v9.103.0 (Prompt AA) — Stale plan detector ───────────────────────────────
// computePlanDrift signals execution compliance. It says nothing about whether
// the *anchor* (seedCTL, generatedAt) has gone stale. A plan generated 8 weeks
// ago with seedCTL=25 may still show "on-track" compliance while the athlete's
// actual CTL has climbed to 50 — meaning every "easy day" is genuinely easy
// but every "hard day" no longer loads enough. This detector flags that.
const STALE_THRESHOLDS = {
  ageDaysWarn: 56,    // 8 weeks — covers a typical build block
  ctlDriftPct: 0.40,  // 40% absolute CTL deviation from seed
}

/**
 * @description Detect whether a plan's anchor (age / seedCTL) has drifted
 *   enough to warrant recalibration. Pure function.
 *
 * @param {object} plan      - { generatedAt, seedCTL? }
 * @param {number} currentCTL - calcLoad(log).ctl
 * @param {string} [today]   - 'YYYY-MM-DD'
 * @returns {{
 *   stale: boolean,
 *   ageDays: number,
 *   ctlDriftPct: number | null,
 *   seedCTL: number | null,
 *   reason: 'age' | 'ctl' | 'both' | null,
 *   recommendation: { en, tr },
 * } | null}
 */
export function detectStalePlan(plan, currentCTL, today) {
  if (!plan?.generatedAt) return null
  const todayDate = today || new Date().toISOString().slice(0, 10)
  const ageDays = dateDiffDays(String(plan.generatedAt).slice(0, 10), todayDate)
  if (!Number.isFinite(ageDays) || ageDays < 0) return null

  const seedCTL = Number.isFinite(Number(plan.seedCTL)) ? Number(plan.seedCTL) : null
  const ctl = Number.isFinite(Number(currentCTL)) ? Number(currentCTL) : 0
  // ctlDriftPct only meaningful when both sides are positive
  const ctlDriftPct = (seedCTL > 0 && ctl > 0)
    ? Math.abs(ctl - seedCTL) / seedCTL
    : null

  const ageStale = ageDays >= STALE_THRESHOLDS.ageDaysWarn
  const ctlStale = ctlDriftPct != null && ctlDriftPct > STALE_THRESHOLDS.ctlDriftPct

  if (!ageStale && !ctlStale) {
    return { stale: false, ageDays, ctlDriftPct, seedCTL, reason: null, recommendation: null }
  }

  const reason = ageStale && ctlStale ? 'both' : ageStale ? 'age' : 'ctl'
  const recommendation = reason === 'ctl' ? {
    en: `Your fitness has shifted ${Math.round((ctlDriftPct || 0) * 100)}% since this plan was built. Recalibrating anchors targets to your current CTL.`,
    tr: `Bu plan oluşturulduğundan beri kondisyonun %${Math.round((ctlDriftPct || 0) * 100)} değişti. Yeniden kalibre edersen hedefler güncel CTL'ne göre yeniden hesaplanır.`,
  } : reason === 'age' ? {
    en: `This plan is ${Math.round(ageDays / 7)} weeks old. Recalibrating reseeds it on your current fitness so the remaining weeks scale correctly.`,
    tr: `Bu plan ${Math.round(ageDays / 7)} haftalık. Yeniden kalibre edersen kalan haftalar güncel kondisyonuna göre ölçeklenir.`,
  } : {
    en: `Plan is ${Math.round(ageDays / 7)} weeks old AND fitness has shifted ${Math.round((ctlDriftPct || 0) * 100)}%. Recalibration strongly recommended.`,
    tr: `Plan ${Math.round(ageDays / 7)} haftalık VE kondisyonun %${Math.round((ctlDriftPct || 0) * 100)} değişti. Yeniden kalibrasyon önerilir.`,
  }

  return { stale: true, ageDays, ctlDriftPct, seedCTL, reason, recommendation }
}
