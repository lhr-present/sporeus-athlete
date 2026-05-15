// src/lib/athlete/triathlonWeekBalance.js
//
// v9.166.0 (EP-11) — Triathlon daily-balance validator + best-effort balancer.
//
// `triSampleWeek` in eliteProgram.js hand-curates 4 phase weeks for triathletes.
// The v9.20.0 + v9.27.0 audits previously caught "3 consecutive hard days"
// (Lambert 1997 violation) by hand. This module codifies the same rules so
// future edits to the hardcoded week arrays — or any caller that
// programmatically composes a tri week — gets a machine-checkable invariant.
//
// Rules enforced:
//   R1. No two HARD sessions on consecutive days (Lambert 1997 recovery window).
//   R2. Long session (run ≥120, bike ≥150) anchored on Sat or Sun.
//   R3. Strength sessions (if present) precede the next HARD session by ≥24h.
//
// (Earlier drafts had a 4th "no 3 consecutive non-rest days with hard content"
// rule, but it false-fires on the canonical Tue-hard / Wed-easy / Thu-hard
// pattern which is exactly what Lambert/Seiler prescribe. R1 already covers
// the actual physiology risk.)
//
// Classification (per-session, mutually exclusive in order):
//   REST  = discipline === 'rest' OR durationMin === 0
//   HARD  = (Z4 + Z5 minutes) ≥ 25
//   LONG  = (discipline = bike AND durationMin ≥ 150) OR
//           (discipline = run  AND durationMin ≥ 120)
//   EASY  = otherwise non-rest
//
// Citations:
//   Lambert E.V. et al. 1997. Open Window of Susceptibility to Infection
//     during Recovery from Exercise. Exerc Immunol Rev 3:13-25.
//   Seiler S. 2010. What is best practice for training intensity distribution
//     in endurance athletes? Int J Sports Physiol Perform 5(3).
//   Mujika I. & Padilla S. 2003. Scientific bases for precompetition tapering
//     strategies. Med Sci Sports Exerc 35(7):1182-1187.

export const TRI_WEEK_BALANCE_CITATION = 'Lambert 1997; Seiler 2010; Mujika 2003'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKEND = new Set(['Sat', 'Sun'])
const HARD_Z_MIN = 25
const LONG_BIKE_MIN = 150
const LONG_RUN_MIN = 120

/**
 * Classify a single triathlon session.
 * @param {object} s - { day, discipline, zones, durationMin, intent }
 * @returns {'rest'|'hard'|'long'|'easy'}
 */
export function classifyTriSession(s) {
  if (!s) return 'rest'
  const dur = Number(s.durationMin) || 0
  const disc = String(s.discipline || '').toLowerCase()
  if (disc === 'rest' || dur === 0) return 'rest'
  const z = s.zones || {}
  const hardMin = (Number(z.Z4) || 0) + (Number(z.Z5) || 0)
  if (hardMin >= HARD_Z_MIN) return 'hard'
  if (disc === 'bike' && dur >= LONG_BIKE_MIN) return 'long'
  if (disc === 'run'  && dur >= LONG_RUN_MIN)  return 'long'
  return 'easy'
}

function dayIndex(day) {
  return DAYS.indexOf(day)
}

function sortByDay(week) {
  return [...week].sort((a, b) => dayIndex(a.day) - dayIndex(b.day))
}

/**
 * Validate a triathlon week against R1–R4.
 *
 * @param {Array} week - 7-day session array (any order; sorted internally)
 * @returns {{
 *   valid: boolean,
 *   violations: Array<{ rule: string, day?: string, days?: string[], msg: { en: string, tr: string } }>,
 *   classes: Array<{ day: string, kind: 'rest'|'hard'|'long'|'easy', discipline: string }>,
 *   hardDays: string[],
 *   longDays: string[],
 * }}
 */
export function validateTriathlonWeek(week) {
  if (!Array.isArray(week) || week.length === 0) {
    return { valid: false, violations: [{ rule: 'shape', msg: { en: 'Empty or invalid week', tr: 'Boş veya geçersiz hafta' } }], classes: [], hardDays: [], longDays: [] }
  }
  const sorted = sortByDay(week)
  const classes = sorted.map(s => ({ day: s.day, kind: classifyTriSession(s), discipline: String(s.discipline || '').toLowerCase() }))
  const violations = []

  // R1 — no two HARD on consecutive days
  for (let i = 0; i < classes.length - 1; i++) {
    const a = classes[i], b = classes[i + 1]
    if (a.kind === 'hard' && b.kind === 'hard') {
      violations.push({
        rule: 'R1-hard-adjacent',
        days: [a.day, b.day],
        msg: {
          en: `Hard sessions on consecutive days (${a.day} → ${b.day}) — Lambert 1997 needs ≥1 easy day between.`,
          tr: `Ardışık günlerde sert seans (${a.day} → ${b.day}) — Lambert 1997 araya ≥1 kolay gün ister.`,
        },
      })
    }
  }

  // R2 — long session on weekend
  const longSessions = classes.filter(c => c.kind === 'long')
  const longDays = longSessions.map(c => c.day)
  for (const c of longSessions) {
    if (!WEEKEND.has(c.day)) {
      violations.push({
        rule: 'R2-long-not-weekend',
        day: c.day,
        msg: {
          en: `Long ${c.discipline} on ${c.day} — anchor on Sat/Sun for weekly rhythm.`,
          tr: `${c.day} günü uzun ${c.discipline} — haftalık ritim için Cmt/Pzr'a yerleştir.`,
        },
      })
    }
  }

  // R3 — strength precedes next HARD by ≥24h
  // discipline === 'strength' is the marker (none today, but future-proof).
  for (let i = 0; i < classes.length; i++) {
    if (classes[i].discipline !== 'strength') continue
    const next = classes[i + 1]
    if (next && next.kind === 'hard') {
      violations.push({
        rule: 'R3-strength-before-hard',
        days: [classes[i].day, next.day],
        msg: {
          en: `Strength on ${classes[i].day} directly before hard ${next.day} — leave ≥24h of non-hard.`,
          tr: `${classes[i].day} kuvvet doğrudan ${next.day} sert seansın önünde — ≥24s sertsiz ara bırak.`,
        },
      })
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    classes,
    hardDays: classes.filter(c => c.kind === 'hard').map(c => c.day),
    longDays,
  }
}

/**
 * Best-effort rebalancer: swaps day labels (preserves session content)
 * to resolve R1 hard-adjacent violations. Long-day weekend violations
 * are NOT auto-resolved (would need content choice, not just day shuffle).
 *
 * @param {Array} week
 * @returns {{ week: Array, swaps: Array<{ from: string, to: string }>, residualViolations: number }}
 */
export function balanceTriathlonWeek(week) {
  if (!Array.isArray(week) || week.length === 0) {
    return { week: [], swaps: [], residualViolations: 0 }
  }
  let sorted = sortByDay(week)
  const swaps = []
  // Re-classify each iteration; cap at 3 swap passes (a 7-day week with
  // ≤3 hard sessions can always be resolved in ≤3 swaps if a rest/easy
  // partner exists).
  for (let pass = 0; pass < 3; pass++) {
    const v = validateTriathlonWeek(sorted)
    const adj = v.violations.find(x => x.rule === 'R1-hard-adjacent')
    if (!adj) break
    const [d1, d2] = adj.days
    // Move the second hard to the nearest non-adjacent rest/easy day.
    const targetIdx = sorted.findIndex(s => s.day === d2)
    if (targetIdx < 0) break
    let bestSwapIdx = -1
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i]
      const kind = classifyTriSession(c)
      if (kind === 'rest' || kind === 'easy') {
        // Ensure the swap-in day won't re-create adjacency: check d1 isn't a neighbour.
        const di = dayIndex(c.day)
        const d1i = dayIndex(d1)
        if (Math.abs(di - d1i) >= 2) { bestSwapIdx = i; break }
      }
    }
    if (bestSwapIdx < 0) break
    const swapDay = sorted[bestSwapIdx].day
    sorted = sorted.map(s => {
      if (s.day === d2) return { ...s, day: swapDay }
      if (s.day === swapDay) return { ...s, day: d2 }
      return s
    })
    swaps.push({ from: d2, to: swapDay })
  }
  const final = validateTriathlonWeek(sorted)
  return { week: sortByDay(sorted), swaps, residualViolations: final.violations.length }
}
