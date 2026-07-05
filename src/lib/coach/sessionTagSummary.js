// src/lib/coach/sessionTagSummary.js — E4 reader: per-athlete execution profile
//
// v9.472.0 — aggregates session_tag over a window of an athlete's sessions for
// the coach dashboard. Pure — no DB, no network.
//
// Rows may predate the session_tag writer (column null): those are classified
// on the fly with the same pure classifySession (plan-less), so the panel
// works on day one for existing history. DB tags win when present — they were
// stamped at write time by the same rules.
//
// v9.476.0 — plan-aware mode: given the athlete's coach plan, every session is
// reclassified WITH plan context (planned_match / unplanned_low refine the
// plan-less tags) and fully-elapsed plan weeks with no logged sessions count
// as planned_miss.

import { classifySession } from './classifySession.js'

export const TAG_ORDER = [
  'planned_match', 'moderate', 'recovery', 'test',
  'unplanned_high', 'unplanned_low', 'junk', 'planned_miss',
]

// Terminal-style palette per tag (matches the app's status colors)
export const TAG_COLORS = {
  planned_match:  '#5bc25b',
  moderate:       '#0064ff',
  recovery:       '#5bc25b',
  test:           '#f5c542',
  unplanned_high: '#e03030',
  unplanned_low:  '#f5c542',
  junk:           '#888888',
  planned_miss:   '#e03030',
}

/**
 * v9.476 — adapt a coach_plans DB row to classifySession's findPlanWeek
 * contract. generatePlan weeks carry { week, phase, tss } with the plan's
 * start_date TOP-LEVEL — findPlanWeek expects weeks[].startDate + tssEst, so
 * the classifier's plan branch was DEAD against every real coach plan until
 * this adapter existed. Week i starts at start_date + i×7 days.
 *
 * @param {{ start_date: string, weeks: Array<Object> }|null} planRow
 * @returns {{ weeks: Array<{startDate:string,tssEst:number,weekLabel:string}> }|null}
 */
export function adaptCoachPlan(planRow) {
  if (!planRow || !planRow.start_date || !Array.isArray(planRow.weeks) || planRow.weeks.length === 0) return null
  const base = new Date(planRow.start_date + 'T00:00:00Z')
  if (Number.isNaN(base.getTime())) return null
  const weeks = planRow.weeks.map((w, i) => {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + i * 7)
    return {
      startDate: d.toISOString().slice(0, 10),
      tssEst:    Number(w?.tssEst ?? w?.tss) || 0,
      weekLabel: w?.weekLabel || `W${w?.week ?? i + 1}${w?.phase ? ` ${w.phase}` : ''}`,
    }
  })
  return { weeks }
}

/**
 * @description Aggregate an athlete's sessions into a tag distribution.
 *   Accepts rows in either DB shape (duration_min, session_tag) or entry shape
 *   (duration, sessionTag) — the coach fetch returns DB rows, demo data
 *   returns entries.
 *
 *   Plan-aware mode (v9.476): pass `opts.plan` (an adaptCoachPlan result) to
 *   reclassify EVERY session against the plan — stored plan-less tags are
 *   superseded — and `opts.today` ('YYYY-MM-DD') to count `planned_miss`:
 *   fully-elapsed plan weeks inside the miss window with a TSS target but ZERO
 *   logged sessions. Misses appear in counts/flags but NOT in `total`/`share`
 *   (they are absent sessions, not sessions).
 *
 * @param {Array<Object>} rows  - sessions (any mix of shapes)
 * @param {{ plan?: Object|null, today?: string|null, missWindowDays?: number }} [opts]
 * @returns {{
 *   total: number,
 *   counts: Record<string, number>,
 *   share:  Record<string, number>,   // 0–100 integer percents
 *   flags:  Array<{ level: 'warn'|'info', en: string, tr: string }>,
 *   planAware: boolean,
 * }}
 */
export function summarizeSessionTags(rows, { plan = null, today = null, missWindowDays = 28 } = {}) {
  const counts = {}
  for (const t of TAG_ORDER) counts[t] = 0

  const list = Array.isArray(rows) ? rows : []
  let total = 0
  for (const r of list) {
    if (!r || typeof r !== 'object') continue
    const session = {
      date:     r.date,
      type:     r.type,
      tss:      r.tss,
      rpe:      r.rpe,
      duration: r.duration != null ? r.duration : (r.duration_min != null ? Number(r.duration_min) : 0),
    }
    // Plan-aware: always reclassify (plan context refines the tag). Plan-less:
    // the stored tag wins (stamped by the same rules; may reflect athlete-
    // entered Strava RPE the local recompute can't see).
    let tag
    if (plan) {
      tag = classifySession(session, plan).tag
    } else {
      tag = r.session_tag || r.sessionTag || classifySession(session).tag
    }
    if (!(tag in counts)) counts[tag] = 0
    counts[tag]++
    total++
  }

  // planned_miss — elapsed plan weeks (inside the miss window) with a target
  // but no logged sessions at all.
  if (plan && today && Array.isArray(plan.weeks)) {
    const todayD = new Date(today + 'T00:00:00Z')
    if (!Number.isNaN(todayD.getTime())) {
      const cutD = new Date(todayD)
      cutD.setUTCDate(cutD.getUTCDate() - missWindowDays)
      const cutoff = cutD.toISOString().slice(0, 10)
      for (const w of plan.weeks) {
        if (!w?.startDate || !(Number(w.tssEst) > 0)) continue
        const endD = new Date(w.startDate + 'T00:00:00Z')
        endD.setUTCDate(endD.getUTCDate() + 7)
        const weekEnd = endD.toISOString().slice(0, 10)
        if (weekEnd > today) continue          // week not finished yet
        if (w.startDate < cutoff) continue     // outside the window
        const hasSession = list.some(r => r?.date && r.date >= w.startDate && r.date < weekEnd)
        if (!hasSession) counts.planned_miss++
      }
    }
  }

  const share = {}
  for (const [t, c] of Object.entries(counts)) share[t] = total ? Math.round((c / total) * 100) : 0
  // Misses are not sessions — keep them out of the share bar.
  share.planned_miss = 0

  // Coach-attention flags — descriptive, not prescriptive (what the athlete
  // DID, not what they should do — training prescriptions stay founder-domain).
  const flags = []
  if (counts.planned_miss > 0) {
    flags.push({
      level: 'warn',
      en: `${counts.planned_miss} plan week${counts.planned_miss > 1 ? 's' : ''} with no logged sessions`,
      tr: `${counts.planned_miss} plan haftasında hiç seans yok`,
    })
  }
  if (total >= 6 && share.junk >= 25) {
    flags.push({
      level: 'warn',
      en: `${counts.junk} of ${total} sessions below adaptation threshold (junk)`,
      tr: `${total} seansın ${counts.junk} tanesi adaptasyon eşiğinin altında (etkisiz)`,
    })
  }
  if (total >= 6 && share.unplanned_high >= 25) {
    flags.push({
      level: 'warn',
      en: plan
        ? `${counts.unplanned_high} sessions far above the plan target`
        : `${counts.unplanned_high} high-load sessions without plan context`,
      tr: plan
        ? `${counts.unplanned_high} seans plan hedefinin çok üzerinde`
        : `${counts.unplanned_high} plansız yüksek yüklü seans`,
    })
  }
  if (total >= 6 && share.recovery + share.junk >= 70) {
    flags.push({
      level: 'info',
      en: `Mostly easy/short sessions — little overload stimulus in this window`,
      tr: `Çoğunlukla kolay/kısa seanslar — bu pencerede aşırı yüklenme uyaranı az`,
    })
  }

  return { total, counts, share, flags, planAware: !!plan }
}
