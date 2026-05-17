// ─── src/lib/athlete/restingHrDrift.js — RHR drift / overreaching detector ──
//
// Detects upward drift of recent resting HR vs a rolling baseline — an early
// signal of accumulated fatigue, under-recovery, illness onset, or
// over-reaching. The detector is intentionally separate from the existing
// `sleepRestingHR.js` snapshot card so the warning surfaces only when
// physiologically meaningful (>5% drift held ≥3 consecutive days).
//
// Reference grounding:
//   - Buchheit (2014) — Monitoring training status with HR measures.
//   - Plews & Buchheit (2017) — Day-to-day HRV/RHR fluctuations interpreted
//     against a rolling baseline; drift > noise band signals fatigue.
//   - Bouchard (1995) — Resting HR as a coarse early-overreaching marker.
//
// Downward drift (vagal/parasympathetic dominance) is generally a GOOD sign
// and is NOT flagged. Only the upward drift is treated as a warning.

export const RHR_DRIFT_CITATION = 'Buchheit 2014; Plews & Buchheit 2017; Bouchard 1995'

// ── helpers ──────────────────────────────────────────────────────────────────

// Sanity-checked RHR parser — supports both `restingHR` (existing canonical
// field in this codebase) and `restingHr` (alt spelling). Returns null when
// outside the physiologically plausible 30–120 bpm band.
function pickRHR(entry) {
  if (!entry) return null
  const raw = entry.restingHR ?? entry.restingHr ?? entry.resting_hr
  const v = parseInt(raw, 10)
  if (Number.isNaN(v)) return null
  if (v < 30 || v > 120) return null
  return v
}

function toISODate(d) {
  return d.toISOString().slice(0, 10)
}

function parseISODate(s) {
  // Treat YYYY-MM-DD as UTC midnight so arithmetic is timezone-stable.
  if (!s || typeof s !== 'string') return null
  const [y, m, day] = s.split('-').map(n => parseInt(n, 10))
  if (!y || !m || !day) return null
  return new Date(Date.UTC(y, m - 1, day))
}

function mean(arr) {
  if (!arr.length) return null
  const s = arr.reduce((acc, v) => acc + v, 0)
  return s / arr.length
}

// ── core ─────────────────────────────────────────────────────────────────────
//
// detectRestingHrDrift({ recovery, today, baselineDays, driftThresholdPct,
//                       consecutiveDays })
//
//   recovery            : array of { date: 'YYYY-MM-DD', restingHR, ... }
//   today               : 'YYYY-MM-DD' anchor (defaults to current UTC date)
//   baselineDays = 14   : length of the rolling baseline window
//   driftThresholdPct = 5
//   consecutiveDays = 3 : how many recent days of elevated RHR are required
//
// Returns:
//   {
//     isDrifting          : boolean,
//     baseline            : number (bpm),
//     recent3dMean        : number (bpm),
//     deltaPct            : number (signed, percent),
//     consecutiveDriftDays: number,
//     citation            : string,
//   }
//   OR null when sample sizes are insufficient (baseline < 7, recent < 3).
//
// Definitions:
//   recent3dMean : mean RHR over the most recent 3 entries (ending at `today`).
//   baseline     : mean RHR over the `baselineDays`-day window that ENDS 4
//                  days ago — i.e. it deliberately EXCLUDES the most recent 3
//                  days so drift can't "self-cancel" the baseline it is
//                  being compared against.
//   deltaPct     : (recent3dMean - baseline) / baseline * 100
//   consecutiveDriftDays : count of consecutive recent days (counted from
//                  the most-recent entry walking backwards) whose individual
//                  RHR is >= baseline * (1 + driftThresholdPct/100).
//   isDrifting   : consecutiveDriftDays >= consecutiveDays AND
//                  deltaPct > driftThresholdPct.
//
export function detectRestingHrDrift({
  recovery,
  today,
  baselineDays = 14,
  driftThresholdPct = 5,
  consecutiveDays = 3,
} = {}) {
  if (!Array.isArray(recovery) || recovery.length === 0) return null

  // Build a date -> rhr map (filtered + sanity-checked) and a sorted list.
  const cleaned = recovery
    .map(e => ({ date: e?.date, rhr: pickRHR(e) }))
    .filter(e => typeof e.date === 'string' && e.rhr !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (cleaned.length === 0) return null

  // Anchor date: caller-supplied `today` or system UTC today.
  const anchor = today
    ? parseISODate(today)
    : parseISODate(toISODate(new Date()))
  if (!anchor) return null

  // Only consider entries on or before the anchor.
  const anchorISO = toISODate(anchor)
  const upToAnchor = cleaned.filter(e => e.date <= anchorISO)
  if (upToAnchor.length === 0) return null

  // Recent window: last 3 entries (most recent ending at anchor).
  const recent = upToAnchor.slice(-3)
  if (recent.length < 3) return null

  // Baseline window: entries strictly more than 3 days before the most
  // recent entry, going back `baselineDays` days. We use the most-recent
  // entry's date as the right edge of the recent window so the baseline
  // gap is measured against the data, not against a possibly stale anchor.
  const mostRecentEntryDate = parseISODate(recent[recent.length - 1].date)
  if (!mostRecentEntryDate) return null

  const baselineEnd = new Date(mostRecentEntryDate.getTime())
  baselineEnd.setUTCDate(baselineEnd.getUTCDate() - 3)             // exclude last 3 days
  const baselineStart = new Date(baselineEnd.getTime())
  baselineStart.setUTCDate(baselineStart.getUTCDate() - (baselineDays - 1))

  const baselineEndISO   = toISODate(baselineEnd)
  const baselineStartISO = toISODate(baselineStart)

  const baselineEntries = upToAnchor.filter(
    e => e.date >= baselineStartISO && e.date <= baselineEndISO
  )

  if (baselineEntries.length < 7) return null

  const baseline = mean(baselineEntries.map(e => e.rhr))
  const recent3dMean = mean(recent.map(e => e.rhr))

  const deltaPct = ((recent3dMean - baseline) / baseline) * 100

  // Count consecutive drift days walking backwards from the most recent
  // entry. An entry "counts" when its individual RHR is >= the drift
  // threshold above baseline.
  const threshold = baseline * (1 + driftThresholdPct / 100)
  let consecutiveDriftDays = 0
  for (let i = upToAnchor.length - 1; i >= 0; i--) {
    if (upToAnchor[i].rhr >= threshold) {
      consecutiveDriftDays += 1
    } else {
      break
    }
  }

  const isDrifting =
    consecutiveDriftDays >= consecutiveDays && deltaPct > driftThresholdPct

  return {
    isDrifting,
    baseline: Math.round(baseline * 10) / 10,
    recent3dMean: Math.round(recent3dMean * 10) / 10,
    deltaPct: Math.round(deltaPct * 10) / 10,
    consecutiveDriftDays,
    citation: RHR_DRIFT_CITATION,
  }
}
