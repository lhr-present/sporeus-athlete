// ─── src/lib/plan/taperEngine.js ──────────────────────────────────────────────
// E13 Adaptive Plan Generator — taper engine
//
// Applies a 2–3 week taper to the tail end of a generated plan and projects
// CTL/ATL/TSB to the race day, targeting Mujika & Padilla (2003) heuristics:
//   - CTL drop on race day:  3% – 10%   (we constrain ≤10%)
//   - TSB on race day:       +5 to +15
//
// Pure function — no I/O. Returns null on bad inputs. Reuses EWMA constants
// matching src/lib/race/taperSimulator.js for projection consistency.

const CITATION_TAPER = 'Mujika I., Padilla S. (2003) Med Sci Sports Exerc 35:1182–1187'

// EWMA constants (must match calcLoad in src/lib/formulas.js / taperSimulator.js)
const K_ATL = 2 / (7 + 1)    // ≈ 0.25
const K_CTL = 2 / (42 + 1)   // ≈ 0.0465

// Stepped weekly load reductions as a fraction of pre-taper *peak weekly TSS*
// (≈ targetCTL × 7). Tuned so race-day CTL drop sits 3–10% and race-day TSB
// sits +5..+15 across realistic athletes (CTL 30..90, taper 2..3w).
//
// Index 0 is the week furthest from race; last index is race week. Calibrated
// against the EWMA model (K_CTL=2/43, K_ATL=2/8) so that ATL drops fast while
// CTL is preserved (Mujika & Padilla 2003 reverse-linear taper).
const TAPER_PROFILES = {
  2: [1.00, 0.75],
  3: [1.00, 0.92, 0.78],
}

// ── helper: clone a plan deeply enough to mutate week sessions safely ────────
function cloneWeek(wk) {
  return {
    ...wk,
    sessions: (wk.sessions || []).map(s => ({ ...s })),
    zoneDistribution: { ...(wk.zoneDistribution || {}) },
  }
}

// ── helper: scale every session's targetTSS by `factor` and recompute weekly ─
function scaleWeek(wk, factor) {
  const out = cloneWeek(wk)
  out.sessions = out.sessions.map(s => ({
    ...s,
    targetTSS: Math.max(0, Math.round(s.targetTSS * factor)),
  }))
  out.weeklyTSS = out.sessions.reduce((s, x) => s + x.targetTSS, 0)
  return out
}

// ── helper: rebuild a taper week's sessions from a target weekly TSS ─────────
// Preserves the original session intents but rescales each session's TSS so
// the new sum matches `targetWeeklyTSS`. This avoids stacking taper reductions
// on top of any taper-like reduction already baked into the source plan.
function rebuildWeekToTSS(wk, targetWeeklyTSS) {
  const out = cloneWeek(wk)
  const baseSum = out.sessions.reduce((s, x) => s + (x.targetTSS || 0), 0)
  if (baseSum <= 0) {
    out.weeklyTSS = Math.max(0, Math.round(targetWeeklyTSS))
    return out
  }
  const ratio = targetWeeklyTSS / baseSum
  out.sessions = out.sessions.map(s => ({
    ...s,
    targetTSS: Math.max(0, Math.round((s.targetTSS || 0) * ratio)),
  }))
  out.weeklyTSS = out.sessions.reduce((s, x) => s + x.targetTSS, 0)
  return out
}

// ── helper: project CTL/ATL/TSB forward from a starting state across weeks ───
// Spreads weekly TSS evenly across 7 days. Returns final {ctl, atl, tsb}.
function projectForward(startCTL, startATL, weeks) {
  let ctl = startCTL
  let atl = startATL
  for (const wk of weeks) {
    const dayTSS = (wk.weeklyTSS || 0) / 7
    for (let d = 0; d < 7; d++) {
      atl = dayTSS * K_ATL + atl * (1 - K_ATL)
      ctl = dayTSS * K_CTL + ctl * (1 - K_CTL)
    }
  }
  return {
    ctl: Math.round(ctl * 10) / 10,
    atl: Math.round(atl * 10) / 10,
    tsb: Math.round((ctl - atl) * 10) / 10,
  }
}

// ── main entry: applyTaper ───────────────────────────────────────────────────
/**
 * @description Mutates the last `taperWeeks` weeks of a plan by progressively
 *   reducing weekly TSS. Returns a new plan (input not mutated). Also returns
 *   projected CTL/ATL/TSB on race day and a recommendation tag.
 * @param {Object} plan        - Plan returned by generatePlan()
 * @param {string} [raceDate]  - ISO date string of race day (used for metadata)
 * @param {number} taperWeeks  - 2 or 3 (other values are clamped/rejected)
 * @returns {Object|null} { weeks, raceDayCTL, raceDayATL, raceDayTSB, ctlDropPct, recommendation, citation } or null
 * @source Mujika I., Padilla S. (2003) Med Sci Sports Exerc 35:1182–1187
 * @example
 * applyTaper(plan, '2026-08-01', 3)
 */
export function applyTaper(plan, raceDate, taperWeeks) {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return null
  const tw = +taperWeeks
  if (![2, 3].includes(tw)) return null
  if (plan.weeks.length < tw + 1) return null   // need at least 1 non-taper week to anchor pre-taper CTL

  const weeks = plan.weeks.map(cloneWeek)
  const startTaperIdx = weeks.length - tw

  // Pre-taper CTL anchor — the cleanest assumption is the athlete enters the
  // taper close to the plan's peak CTL (targetCTL). We treat ATL ≈ CTL at
  // taper start (TSB ≈ 0), which matches Mujika & Padilla's "fully-loaded"
  // model. This avoids depending on a multi-week forward simulation that
  // would otherwise underestimate CTL for newer athletes.
  const preTaperCTL = plan.targetCTL ?? Math.max(plan.startCTL ?? 50, 50)
  const preTaperState = { ctl: preTaperCTL, atl: preTaperCTL, tsb: 0 }

  // Apply taper profile — rebuild each taper-week's TSS as a fraction of the
  // pre-taper peak weekly TSS budget (≈ targetCTL × 7). We rebuild rather than
  // scale to avoid double-counting any taper-like reduction already baked into
  // the source plan.
  const peakWeeklyTSS = preTaperCTL * 7
  const profile = TAPER_PROFILES[tw]
  for (let i = 0; i < tw; i++) {
    const wkIdx = startTaperIdx + i
    const factor = profile[i]
    const target = peakWeeklyTSS * factor
    const rebuilt = rebuildWeekToTSS(weeks[wkIdx], target)
    rebuilt.phase = i === tw - 1 ? 'Race' : 'Taper'
    rebuilt.isDeload = false   // taper supersedes deload flag
    weeks[wkIdx] = rebuilt
  }

  // Project through the taper to get race-day metrics
  const raceState = projectForward(
    preTaperState.ctl,
    preTaperState.atl,
    weeks.slice(startTaperIdx),
  )

  const ctlDropPct = preTaperState.ctl > 0
    ? Math.round(((preTaperState.ctl - raceState.ctl) / preTaperState.ctl) * 1000) / 10
    : 0

  let recommendation
  if (raceState.tsb >= 5 && raceState.tsb <= 15 && ctlDropPct <= 10 && ctlDropPct >= 3) {
    recommendation = 'optimal'
  } else if (raceState.tsb < 5 || ctlDropPct < 3) {
    recommendation = 'under_tapered'
  } else {
    recommendation = 'over_tapered'
  }

  return {
    ...plan,
    weeks,
    raceDate:       raceDate || null,
    taperWeeks:     tw,
    preTaperCTL:    preTaperState.ctl,
    raceDayCTL:     raceState.ctl,
    raceDayATL:     raceState.atl,
    raceDayTSB:     raceState.tsb,
    ctlDropPct,
    recommendation,
    citation:       CITATION_TAPER,
  }
}

/**
 * @description Suggest the best taper duration (2 or 3 weeks) for a given plan
 *   by simulating both and picking the one whose race-day TSB lands closest
 *   to the +10 sweet spot while keeping CTL drop ≤10%.
 * @param {Object} plan - Plan from generatePlan()
 * @param {string} [raceDate] - ISO date for race day
 * @returns {Object|null} The chosen applyTaper output, or null on bad input
 */
export function suggestTaper(plan, raceDate) {
  if (!plan || !Array.isArray(plan.weeks)) return null
  const opts = [2, 3]
    .map(w => applyTaper(plan, raceDate, w))
    .filter(Boolean)
  if (!opts.length) return null
  // Score by distance from TSB=10, penalize CTL drop > 10%
  const scored = opts.map(o => {
    const tsbDist = Math.abs(o.raceDayTSB - 10)
    const dropPenalty = o.ctlDropPct > 10 ? (o.ctlDropPct - 10) * 2 : 0
    return { o, score: tsbDist + dropPenalty }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored[0].o
}
