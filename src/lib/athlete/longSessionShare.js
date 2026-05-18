// ─── longSessionShare.js — Long-Session Share Distribution Detector ──────────
//
// The "long session" (longest single workout of a given week) carries the
// week's durability stimulus. Daniels 2014 + Coggan & Allen 2010 converge on
// a healthy band: the long session should be ~25-35% of weekly training
// volume. Outside that band:
//   - <20% → no real long session — durability stays underdeveloped.
//   - 20-25% → moderate — acceptable for sprint/middle-distance athletes
//     whose weekly base is intentionally flat, but suboptimal for endurance.
//   - 25-35% → TARGET — the canonical long-session share.
//   - 35-45% → overweighted — one big session vs a small base; recovery hit.
//   - >45% → isolated long session — base is too thin; injury risk and
//     detraining of the other days.
//
// Methodology:
//   - For each of the last `weeks` calendar weeks (Mon-Sun, ISO), find the
//     longest single session duration AND the total weekly duration.
//   - Per-week share = longest / total × 100.
//   - Average the per-week shares across the window (mean of percentages).
//   - Return null when fewer than 2 weeks of data exist OR any week in the
//     window has 0 total duration (the share is undefined for an empty week
//     and one zero-week would mis-represent the rolling average).
//
// Complements:
//   weekendVolumeShare.js (Mon-Fri vs Sat-Sun share — different cut),
//   hardDaySpacing.js     (hard-easy spacing violations),
//   monotonyTrend.js      (Foster monotony).
//
// Citations:
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed. Human Kinetics.
//   Coggan A.R., Allen H. (2010). Training and Racing with a Power Meter,
//     2nd ed. VeloPress.
//   Magness S. (2017). The Science of Running. Origin Press — long-run
//     durability and aerobic-window stimulus.
// ─────────────────────────────────────────────────────────────────────────────

export const LONG_SESSION_SHARE_CITATION = 'Daniels 2014; Coggan & Allen 2010; Magness 2017'

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
  if (pct < 20) return 'TOO_SHORT'
  if (pct < 25) return 'MODERATE'
  if (pct <= 35) return 'TARGET'
  if (pct <= 45) return 'OVERWEIGHTED'
  return 'ISOLATED'
}

/**
 * Compute long-session share averaged over a trailing N-week window.
 *
 * For each Mon-Sun week in the window, finds the longest single session and
 * the total weekly duration, then computes per-week share = longest / total.
 * Returns the mean of those shares across the window plus the per-week
 * breakdown.
 *
 * @param {object} args
 * @param {Array}  args.log    - training_log entries (need `date`, `duration` min)
 * @param {string} args.today  - YYYY-MM-DD reference date
 * @param {number} [args.weeks=4] - number of trailing weeks (Mon-Sun)
 * @returns {{
 *   avgSharePct: number,
 *   longestPerWeek: Array<{ weekStart: string, longestMin: number, totalMin: number, sharePct: number }>,
 *   band: 'TOO_SHORT'|'MODERATE'|'TARGET'|'OVERWEIGHTED'|'ISOLATED',
 *   citation: string
 * } | null}
 *
 * Returns null when:
 *   - log is empty/missing, OR
 *   - today is missing/invalid, OR
 *   - fewer than 2 weeks of data are represented in the window, OR
 *   - any week in the window has 0 total duration (avg is undefined).
 */
export function computeLongSessionShare({ log, today, weeks = 4 } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null
  if (!today || typeof today !== 'string') return null
  if (!Number.isFinite(weeks) || weeks < 1) return null

  // Build the per-week buckets (Mon-Sun) for the trailing `weeks` window.
  const thisMon = mondayOf(today)
  const weekStarts = []
  for (let i = weeks - 1; i >= 0; i--) {
    weekStarts.push(addDaysStr(thisMon, -i * 7))
  }
  const startMon = weekStarts[0]
  const endSun = addDaysStr(thisMon, 6)

  // Bucket entries by week-start. Only keep entries with usable duration.
  const buckets = new Map() // weekStart → { longest, total }
  for (const ws of weekStarts) buckets.set(ws, { longest: 0, total: 0 })

  for (const e of log) {
    if (!e || typeof e.date !== 'string') continue
    if (e.date < startMon || e.date > endSun) continue
    const dur = entryDurationMin(e)
    if (dur <= 0) continue
    const ws = mondayOf(e.date)
    const b = buckets.get(ws)
    if (!b) continue
    b.total += dur
    if (dur > b.longest) b.longest = dur
  }

  // Compute per-week share. Require ALL weeks in window to have non-zero
  // total — a zero week makes the average misleading (we'd silently treat
  // it as 0% contribution).
  const longestPerWeek = []
  let weeksWithData = 0
  for (const ws of weekStarts) {
    const b = buckets.get(ws)
    if (b.total <= 0) {
      // Zero week → cannot compute share; abort.
      return null
    }
    const sharePct = (b.longest / b.total) * 100
    longestPerWeek.push({
      weekStart: ws,
      longestMin: Math.round(b.longest),
      totalMin: Math.round(b.total),
      sharePct: Math.round(sharePct * 10) / 10, // 1 decimal
    })
    weeksWithData += 1
  }

  // Coverage gate: need ≥2 weeks of actual data (the zero-week return above
  // already handles weeks with no entries; this guards against weeks=1).
  if (weeksWithData < 2) return null

  // Mean of per-week shares (not pooled long/total — Daniels' rule is about
  // each week's distribution, so we average week-level percentages).
  const sumPct = longestPerWeek.reduce((s, w) => s + w.sharePct, 0)
  const avgSharePct = Math.round((sumPct / longestPerWeek.length) * 10) / 10

  return {
    avgSharePct,
    longestPerWeek,
    band: bandFor(avgSharePct),
    citation: LONG_SESSION_SHARE_CITATION,
  }
}
