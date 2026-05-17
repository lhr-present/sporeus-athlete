// ─── weekendVolumeShare.js — Weekend-warrior distribution detector ──────────
// Many recreational athletes (working full-time) jam most of their weekly
// training into Saturday + Sunday. This concentrated load distribution
// elevates illness/injury risk because:
//   - The same total weekly load is delivered in 2 of 7 days, raising
//     per-session stress and fatigue → musculoskeletal injury risk
//     (Soligard 2016 — load distribution among soccer/team-sport athletes).
//   - Hard sessions cluster without 48h aerobic recovery between them,
//     denying the "open-window" repair Lambert 1997 describes.
//
// Methodology:
//   - Bucket the trailing 4 weeks (Mon-Sun) and compute total duration on
//     weekdays (Mon-Fri) vs weekend (Sat-Sun).
//   - sharePct = weekendMin / (weekdayMin + weekendMin) * 100
//   - Rolling 4-week average smooths over single-week noise (a one-off
//     long Saturday ride after a quiet week shouldn't trip the warning).
//   - Gate on >=3 sessions/week — for athletes training <3x/week, the
//     share number is too sparse to mean anything useful.
//
// Bands:
//   <40%  — BALANCED        (silent: no signal to surface)
//   40-55 — WEEKEND_BIASED  (typical for working athletes, OK if intensity also balanced)
//   55-70 — WEEKEND_WARRIOR (warning: load concentration raises injury risk)
//   >70   — SEVERE          (high risk — restructure week)
//
// Citations:
//   Soligard T. et al. (2016). How much is too much? IOC consensus
//     statement on load in sport and risk of injury. Br J Sports Med
//     50(17):1030-1041.
//   Lambert E.V. et al. (1997). Open Window of Susceptibility to Infection
//     during Recovery from Exercise. Exerc Immunol Rev 3:13-25.
// ─────────────────────────────────────────────────────────────────────────────

export const WEEKEND_VOLUME_SHARE_CITATION = 'Soligard 2016; Lambert 1997'

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function parseISO(dateStr) {
  return new Date(dateStr + 'T00:00:00Z')
}

function addDaysStr(dateStr, days) {
  const d = parseISO(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Day-of-week (Mon=1 .. Sun=7) — ISO 8601 numbering.
function isoDow(dateStr) {
  const d = parseISO(dateStr)
  const js = d.getUTCDay() // 0=Sun .. 6=Sat
  return js === 0 ? 7 : js
}

// Monday of the week containing `dateStr` (returns YYYY-MM-DD).
function mondayOf(dateStr) {
  const dow = isoDow(dateStr)
  return addDaysStr(dateStr, -(dow - 1))
}

function entryDurationMin(entry) {
  const d = Number(entry?.duration)
  return Number.isFinite(d) && d > 0 ? d : 0
}

function bandFor(pct) {
  if (pct < 40) return 'BALANCED'
  if (pct < 55) return 'WEEKEND_BIASED'
  if (pct <= 70) return 'WEEKEND_WARRIOR'
  return 'SEVERE'
}

/**
 * Compute weekend-volume share over a trailing N-week window.
 *
 * @param {object} args
 * @param {Array}  args.log    - training_log entries (need `date`, `duration` min)
 * @param {string} args.today  - YYYY-MM-DD reference date
 * @param {number} [args.weeks=4] - number of trailing weeks (Mon-Sun)
 * @returns {{
 *   sharePct: number,
 *   band: 'BALANCED'|'WEEKEND_BIASED'|'WEEKEND_WARRIOR'|'SEVERE',
 *   weekdayMin: number,
 *   weekendMin: number,
 *   sessionsPerWeek: number,
 *   citation: string
 * } | null}
 *
 * Returns null when:
 *   - log is empty or covers <2 weeks of data, OR
 *   - average sessions/week is <3 (too sparse for the share to be meaningful).
 */
export function computeWeekendVolumeShare({ log, today, weeks = 4 } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null
  if (!today || typeof today !== 'string') return null

  // Window: the Monday of the week containing `today` minus (weeks-1) weeks
  // through the Sunday of the week containing `today`.
  const thisMon = mondayOf(today)
  const startMon = addDaysStr(thisMon, -(weeks - 1) * 7)
  const endSun = addDaysStr(thisMon, 6)

  // Filter to in-window entries with a usable duration.
  const inWindow = log.filter(e =>
    e && typeof e.date === 'string' &&
    e.date >= startMon && e.date <= endSun &&
    entryDurationMin(e) > 0
  )

  if (inWindow.length === 0) return null

  // Coverage gate: we need at least 2 distinct weeks represented in the log
  // before we'll compute a share (single-week share is too noisy to surface).
  const weeksRepresented = new Set(inWindow.map(e => mondayOf(e.date)))
  if (weeksRepresented.size < 2) return null

  let weekdayMin = 0
  let weekendMin = 0
  let sessionCount = 0
  for (const e of inWindow) {
    const dur = entryDurationMin(e)
    const dow = isoDow(e.date)
    if (dow >= 6) weekendMin += dur     // Sat (6) + Sun (7)
    else          weekdayMin += dur     // Mon-Fri
    sessionCount += 1
  }

  const totalMin = weekdayMin + weekendMin
  if (totalMin <= 0) return null

  const sessionsPerWeek = sessionCount / weeks

  // Volume gate: <3 sessions/week → share isn't informative for distribution.
  if (sessionsPerWeek < 3) return null

  const sharePct = Math.round((weekendMin / totalMin) * 1000) / 10 // 1 decimal
  const band = bandFor(sharePct)

  return {
    sharePct,
    band,
    weekdayMin: Math.round(weekdayMin),
    weekendMin: Math.round(weekendMin),
    sessionsPerWeek: Math.round(sessionsPerWeek * 10) / 10,
    citation: WEEKEND_VOLUME_SHARE_CITATION,
  }
}
