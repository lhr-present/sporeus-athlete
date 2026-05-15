// ─── src/lib/plan/generatePlan.js ─────────────────────────────────────────────
// E13 Adaptive Plan Generator — pure function library
//
// Builds a 12-week (default) weekly plan that progresses an athlete from
// `currentCTL` toward race fitness using the chosen periodization `model`
// (traditional / polarized / block). Each week contains per-session targets
// (TSS, RPE band, intent) that respect availableDays and the athlete's level.
//
// Pure JS — no React, no DOM, no Supabase. Returns null on insufficient input.
// Reuses zone distributions and CTL math conceptually from src/lib/periodization.js.
// Strings appearing user-facing are { en, tr } bilingual.

// ── Zone distributions per model + phase (mirrors periodization.js) ──────────
const TRAD_ZONES = {
  Base:     { Z1: 0.70, Z2: 0.20, Z3: 0.08, Z4: 0.02, Z5: 0.00 },
  Build:    { Z1: 0.55, Z2: 0.20, Z3: 0.12, Z4: 0.10, Z5: 0.03 },
  Peak:     { Z1: 0.50, Z2: 0.15, Z3: 0.10, Z4: 0.18, Z5: 0.07 },
  Taper:    { Z1: 0.55, Z2: 0.15, Z3: 0.10, Z4: 0.15, Z5: 0.05 },
  Race:     { Z1: 0.40, Z2: 0.20, Z3: 0.10, Z4: 0.20, Z5: 0.10 },
  Recovery: { Z1: 0.85, Z2: 0.12, Z3: 0.03, Z4: 0.00, Z5: 0.00 },
}
const POL_ZONES   = { Z1: 0.80, Z2: 0.00, Z3: 0.00, Z4: 0.15, Z5: 0.05 }
const BLOCK_ACCUM = { Z1: 0.60, Z2: 0.25, Z3: 0.10, Z4: 0.05, Z5: 0.00 }
const BLOCK_INTEN = { Z1: 0.50, Z2: 0.10, Z3: 0.05, Z4: 0.25, Z5: 0.10 }
const BLOCK_REAL  = { Z1: 0.45, Z2: 0.10, Z3: 0.05, Z4: 0.25, Z5: 0.15 }

// ── Bilingual session intent labels ──────────────────────────────────────────
export const SESSION_INTENTS = {
  endurance: { en: 'Endurance',     tr: 'Dayanıklılık' },
  tempo:     { en: 'Tempo',         tr: 'Tempo' },
  vo2:       { en: 'VO2max',        tr: 'VO2max' },
  recovery:  { en: 'Recovery',      tr: 'Toparlanma' },
  test:      { en: 'Field Test',    tr: 'Saha Testi' },
  rest:      { en: 'Rest',          tr: 'Dinlenme' },
}

// v9.92.0 — sport-specific session labels (intent × sport × lang)
// Lets adaptE13PlanToLegacy emit "Long ride" for cyclists vs "Long run" for
// runners instead of the generic "Endurance". Falls back to SESSION_INTENTS
// when sport is unknown.
export const SPORT_INTENT_LABELS = {
  Running: {
    endurance: { en: 'Long run',        tr: 'Uzun koşu' },
    tempo:     { en: 'Tempo run',       tr: 'Tempo koşu' },
    vo2:       { en: 'Interval run',    tr: 'İnterval koşu' },
    recovery:  { en: 'Recovery jog',    tr: 'Toparlanma koşusu' },
    test:      { en: 'Run test',        tr: 'Koşu testi' },
  },
  Cycling: {
    endurance: { en: 'Long ride',       tr: 'Uzun bisiklet' },
    tempo:     { en: 'Tempo ride',      tr: 'Tempo bisiklet' },
    vo2:       { en: 'Power intervals', tr: 'Güç intervalleri' },
    recovery:  { en: 'Recovery spin',   tr: 'Toparlanma sürüşü' },
    test:      { en: 'FTP test',        tr: 'FTP testi' },
  },
  Swimming: {
    endurance: { en: 'Long swim',       tr: 'Uzun yüzme' },
    tempo:     { en: 'Threshold swim',  tr: 'Eşik yüzme' },
    vo2:       { en: 'Interval swim',   tr: 'İnterval yüzme' },
    recovery:  { en: 'Recovery swim',   tr: 'Toparlanma yüzme' },
    test:      { en: 'CSS test',        tr: 'CSS testi' },
  },
  // v9.97.0 — Triathlon labels lean generic (the dominant discipline varies
  // day-to-day for a triathlete; pinning a label to "brick" or "swim" would
  // misrepresent most sessions). Brick-specific phrasing belongs in a future
  // ride-then-run subtype, not here.
  Triathlon: {
    endurance: { en: 'Long session',    tr: 'Uzun antrenman' },
    tempo:     { en: 'Tempo session',   tr: 'Tempo antrenmanı' },
    vo2:       { en: 'Intervals',       tr: 'İntervaller' },
    recovery:  { en: 'Recovery session',tr: 'Toparlanma seansı' },
    test:      { en: 'Fitness test',    tr: 'Form testi' },
  },
  // v9.97.0 — Rowing labels. Used by the PLAN_TEMPLATE_PRESETS '2000m Row'
  // and 'Endurance Block' presets (rowing sport). 2k test is the canonical
  // rowing performance metric (Concept2 standard).
  Rowing: {
    endurance: { en: 'Long row',        tr: 'Uzun kürek' },
    tempo:     { en: 'Steady-state row',tr: 'Sabit tempo kürek' },
    vo2:       { en: 'AT pieces',       tr: 'AT parçaları' },
    recovery:  { en: 'Recovery row',    tr: 'Toparlanma kürek' },
    test:      { en: '2k test',         tr: '2k testi' },
  },
}

/**
 * Resolve a session label for the (intent, sport, lang) tuple. Falls back to
 * SESSION_INTENTS when sport has no mapping (Triathlon, unknown sports, null).
 *
 * @param {string} intent      - 'endurance' | 'tempo' | 'vo2' | 'recovery' | 'test' | 'rest'
 * @param {string|null} sport  - canonical sport ('Running' | 'Cycling' | 'Swimming') or null
 * @param {string} lang        - 'en' | 'tr'
 * @returns {string} a human-readable session label
 */
export function sportSpecificLabel(intent, sport, lang = 'en') {
  const sportTbl = SPORT_INTENT_LABELS[sport]
  const lbl = sportTbl?.[intent]
  if (lbl) return lang === 'tr' ? lbl.tr : lbl.en
  const generic = SESSION_INTENTS[intent]
  return generic ? (lang === 'tr' ? generic.tr : generic.en) : intent
}

// ── Per-intent RPE bands (Borg 6–20) ─────────────────────────────────────────
const RPE_BANDS = {
  endurance: [10, 12],
  tempo:     [13, 15],
  vo2:       [16, 18],
  recovery:  [ 8, 10],
  test:      [17, 19],
  rest:      [ 6,  6],
}

// ── Per-intent zone tag (primary zone target) ────────────────────────────────
const INTENT_ZONE = {
  endurance: 'Z1',
  tempo:     'Z3',
  vo2:       'Z5',
  recovery:  'Z1',
  test:      'Z4',
  rest:      'Z0',
}

// ── Per-intent TSS share weight (relative effort multiplier) ─────────────────
const INTENT_TSS_WEIGHT = {
  endurance: 1.0,
  tempo:     1.4,
  vo2:       1.6,
  recovery:  0.5,
  test:      1.5,
  rest:      0.0,
}

// ── Level scaler — clamps weekly TSS / progression for newer athletes ────────
const LEVEL_FACTOR = {
  beginner:     0.75,
  intermediate: 1.00,
  advanced:     1.10,
  elite:        1.20,
}

// ── Goal scaler — multiplies peak target ─────────────────────────────────────
const GOAL_FACTOR = {
  health:        0.85,
  finish:        0.95,
  pr:            1.05,
  podium:        1.15,
  fitness:       0.90,
  general:       0.95,
}

const VALID_MODELS = new Set(['traditional', 'polarized', 'block'])

// ── Race-distance peak/build intent profile (v9.92.0) ────────────────────────
// Daniels (2014) / Magness (2014): different race distances need different
// peak-phase intent emphasis. Earlier versions collapsed every distance to a
// single 'pr' goal, so a 5K and a Marathon plan looked identical.
//
// Each entry overrides the (phase × model) template in weeklyIntents for the
// distance-sensitive phases (Build + Peak). 'traditional' is the default;
// 'polarized' and 'block' templates fall through to the legacy weeklyIntents
// templates (which already encode the model's intent mix).
const DISTANCE_INTENT_TEMPLATES = {
  // 5K: VO2max-dominant peak; threshold + VO2 in build
  '5K': {
    Build: ['vo2', 'endurance', 'tempo', 'recovery', 'vo2', 'endurance', 'rest'],
    Peak:  ['vo2', 'endurance', 'tempo', 'recovery', 'vo2', 'endurance', 'rest'],
  },
  // 10K: balanced VO2 + threshold
  '10K': {
    Build: ['tempo', 'endurance', 'recovery', 'vo2', 'endurance', 'vo2', 'rest'],
    Peak:  ['vo2', 'endurance', 'tempo', 'recovery', 'vo2', 'tempo', 'rest'],
  },
  // Half Marathon: threshold + tempo, lighter VO2
  'Half Marathon': {
    Build: ['tempo', 'endurance', 'recovery', 'tempo', 'endurance', 'vo2', 'rest'],
    Peak:  ['tempo', 'endurance', 'tempo', 'recovery', 'vo2', 'endurance', 'rest'],
  },
  // Marathon: endurance-dominant, tempo + threshold, minimal VO2
  'Marathon': {
    Build: ['tempo', 'endurance', 'recovery', 'endurance', 'endurance', 'tempo', 'rest'],
    Peak:  ['tempo', 'endurance', 'endurance', 'recovery', 'tempo', 'endurance', 'rest'],
  },
  // Cycling Event: sweet-spot/threshold pattern (similar to Half)
  'Cycling Event': {
    Build: ['tempo', 'endurance', 'recovery', 'tempo', 'endurance', 'vo2', 'rest'],
    Peak:  ['tempo', 'endurance', 'tempo', 'recovery', 'vo2', 'endurance', 'rest'],
  },
}

// ── helper: zone distribution for a (model, phase, weekNum) tuple ────────────
function getZoneDistribution(model, phase, weekNum) {
  if (model === 'polarized') return { ...POL_ZONES }
  if (model === 'block') {
    const cycle = (weekNum - 1) % 5
    if (cycle <= 2) return { ...BLOCK_ACCUM }
    if (cycle === 3) return { ...BLOCK_INTEN }
    return { ...BLOCK_REAL }
  }
  return { ...(TRAD_ZONES[phase] || TRAD_ZONES.Base) }
}

// ── helper: phase by week, given total weeks to race ─────────────────────────
function phaseForWeek(weekIdx, totalWeeks) {
  const remaining = totalWeeks - weekIdx     // weeks left including this one
  if (remaining <= 1) return 'Race'
  if (remaining <= 3) return 'Taper'
  if (remaining <= 6) return 'Peak'
  // Build phase covers ~40% of plan length
  const buildLen = Math.max(2, Math.floor(totalWeeks * 0.40))
  if (remaining <= 6 + buildLen) return 'Build'
  return 'Base'
}

// v9.157.0 (Prompt B) — Race-date-aware phasing. Computes phase from the
// calendar days between week-start and race date, not from the plan-index
// position. Falls back to the legacy `phaseForWeek` when raceDate or
// generatedAt is unavailable. Thresholds match standard endurance
// periodization (Bompa 2009 / Daniels 2014):
//   > 56 days → Base
//   > 28 days → Build
//   > 14 days → Peak
//   > 7 days  → Taper
//   ≤ 7 days  → Race
function raceAwarePhaseForWeek(weekIdx, totalWeeks, raceDate, generatedAt) {
  if (!raceDate || !generatedAt) return phaseForWeek(weekIdx, totalWeeks)
  const start = new Date(generatedAt + 'T12:00:00Z')
  const race  = new Date(raceDate    + 'T12:00:00Z')
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(race.getTime())) {
    return phaseForWeek(weekIdx, totalWeeks)
  }
  // Days from start-of-this-week to race day. Week i starts 7*i days after
  // generatedAt. Use the START of the week to phase it — the athlete enters
  // the week in this state.
  const weekStartMs = start.getTime() + weekIdx * 7 * 86400000
  const daysToRace = Math.floor((race.getTime() - weekStartMs) / 86400000)
  if (daysToRace > 56) return 'Base'
  if (daysToRace > 28) return 'Build'
  if (daysToRace > 14) return 'Peak'
  if (daysToRace > 7)  return 'Taper'
  return 'Race'
}

// ── helper: weekly session intent template ───────────────────────────────────
// Returns an array (length = availableDays) of intent strings for the week,
// based on phase, periodization model, and (v9.92.0) race distance. Day 0 = Mon.
function weeklyIntents(phase, model, availableDays, raceDistance) {
  const days = Math.max(2, Math.min(7, availableDays | 0))

  // Base templates by phase & model — long enough for 7d, sliced down.
  // Templates are designed so Z5 (vo2) days never sit adjacent after compression.
  let template
  if (phase === 'Race') {
    template = ['rest', 'recovery', 'tempo', 'rest', 'recovery', 'rest', 'test']
  } else if (phase === 'Taper') {
    template = ['recovery', 'tempo', 'endurance', 'rest', 'recovery', 'vo2', 'rest']
  } else if (phase === 'Peak') {
    // v9.92.0 — distance-specific template wins for 'traditional' model;
    // 'polarized' and 'block' keep their model-specific intent mix.
    const distTpl = model === 'traditional' && DISTANCE_INTENT_TEMPLATES[raceDistance]?.Peak
    if (distTpl) {
      template = distTpl.slice()
    } else if (model === 'polarized') {
      template = ['vo2', 'endurance', 'recovery', 'vo2', 'endurance', 'tempo', 'rest']
    } else if (model === 'block') {
      template = ['vo2', 'recovery', 'tempo', 'endurance', 'vo2', 'tempo', 'rest']
    } else {
      template = ['vo2', 'endurance', 'tempo', 'recovery', 'tempo', 'endurance', 'rest']
    }
  } else if (phase === 'Build') {
    const distTpl = model === 'traditional' && DISTANCE_INTENT_TEMPLATES[raceDistance]?.Build
    if (distTpl) {
      template = distTpl.slice()
    } else if (model === 'polarized') {
      template = ['vo2', 'endurance', 'recovery', 'tempo', 'endurance', 'endurance', 'rest']
    } else if (model === 'block') {
      template = ['tempo', 'endurance', 'tempo', 'recovery', 'vo2', 'endurance', 'rest']
    } else {
      template = ['tempo', 'endurance', 'recovery', 'vo2', 'endurance', 'tempo', 'rest']
    }
  } else {
    // Base
    if (model === 'polarized') {
      template = ['endurance', 'endurance', 'recovery', 'endurance', 'tempo', 'endurance', 'rest']
    } else if (model === 'block') {
      template = ['endurance', 'endurance', 'tempo', 'recovery', 'endurance', 'tempo', 'rest']
    } else {
      template = ['endurance', 'tempo', 'endurance', 'recovery', 'endurance', 'endurance', 'rest']
    }
  }

  // Compress to N days by dropping low-priority slots first. We always preserve
  // at least one recovery (or rest) day to satisfy validatePlan rule 2.
  const dropOrder = ['rest', 'endurance', 'tempo', 'vo2', 'test']
  const out = template.slice()
  while (out.length > days) {
    let removed = false
    // Count recovery+rest in current template; never drop the last recovery slot.
    const recoveryCount = out.filter(x => x === 'recovery' || x === 'rest').length
    for (const k of dropOrder) {
      const idx = out.lastIndexOf(k)
      if (idx >= 0) { out.splice(idx, 1); removed = true; break }
    }
    if (!removed) {
      // Only recovery+rest left → drop one recovery if we still have >=2
      if (recoveryCount > 1) {
        const idx = out.lastIndexOf('recovery')
        if (idx >= 0) out.splice(idx, 1)
        else out.pop()
      } else {
        out.pop()
      }
    }
  }
  // Edge case: if compression removed all recovery, force the last slot to recovery.
  if (!out.some(x => x === 'recovery' || x === 'rest')) {
    out[out.length - 1] = 'recovery'
  }
  // Separate any back-to-back Z5 sessions (vo2 / test) by swapping with a
  // non-Z5 neighbour. If we can't, demote the second one to tempo.
  const isZ5 = (k) => k === 'vo2' || k === 'test'
  for (let i = 1; i < out.length; i++) {
    if (isZ5(out[i - 1]) && isZ5(out[i])) {
      let swapped = false
      for (let j = i + 1; j < out.length; j++) {
        if (!isZ5(out[j])) {
          [out[i], out[j]] = [out[j], out[i]]
          swapped = true
          break
        }
      }
      if (!swapped) {
        for (let j = i - 2; j >= 0; j--) {
          if (!isZ5(out[j])) {
            [out[i - 1], out[j]] = [out[j], out[i - 1]]
            swapped = true
            break
          }
        }
      }
      if (!swapped) out[i] = 'tempo'
    }
  }
  return out
}

// ── helper: TSS budget for a week (Phase × goal × level) ─────────────────────
function weeklyTSS({ weekIdx, totalWeeks, phase, baseTSS, peakTSS }) {
  if (phase === 'Race')     return Math.round(peakTSS * 0.40)
  if (phase === 'Taper') {
    // Linear ramp-down across taper weeks (≤3)
    const taperRemaining = totalWeeks - weekIdx - 1   // 0..2
    const fracs = [0.50, 0.65, 0.80]
    return Math.round(peakTSS * (fracs[Math.max(0, Math.min(2, taperRemaining))] || 0.65))
  }
  if (phase === 'Peak') return Math.round(peakTSS * 0.92)
  if (phase === 'Build') {
    // Build progression from baseTSS toward peakTSS over ~weekIdx slot
    // Find normalized position in build phase
    const buildEnd = totalWeeks - 6
    const buildLen = Math.max(2, Math.floor(totalWeeks * 0.40))
    const buildStart = Math.max(0, buildEnd - buildLen)
    const denom = Math.max(1, buildEnd - buildStart - 1)
    const frac = Math.max(0, Math.min(1, (weekIdx - buildStart) / denom))
    return Math.round(baseTSS + (peakTSS - baseTSS) * frac)
  }
  // Base — slight ramp from baseTSS to baseTSS*1.05
  return Math.round(baseTSS)
}

// ── helper: distribute weekly TSS across session intents ─────────────────────
function distributeSessionTSS(weeklyTotal, intents) {
  const weights = intents.map(i => INTENT_TSS_WEIGHT[i] ?? 0)
  const sum = weights.reduce((s, w) => s + w, 0) || 1
  return intents.map((intent, i) => {
    const tss = Math.round((weights[i] / sum) * weeklyTotal)
    const [rpeLo, rpeHi] = RPE_BANDS[intent] || [10, 12]
    return {
      day:        i + 1,           // 1-based day offset from Monday
      intent,
      label:      SESSION_INTENTS[intent],
      targetTSS:  tss,
      rpeLow:     rpeLo,
      rpeHigh:    rpeHi,
      zone:       INTENT_ZONE[intent],
    }
  })
}

// ── helper: clamp WoW growth to ≤10% (ACWR-safe) ─────────────────────────────
function clampWoWGrowth(weeks) {
  for (let i = 1; i < weeks.length; i++) {
    const prev = weeks[i - 1].weeklyTSS
    const curr = weeks[i].weeklyTSS
    if (prev > 0 && curr > prev * 1.10) {
      // Use floor so per-session rounding can never push us back over 10%.
      const cap = Math.floor(prev * 1.10)
      const ratio = cap / curr
      weeks[i].sessions = weeks[i].sessions.map(s => ({
        ...s,
        targetTSS: Math.floor(s.targetTSS * ratio),
      }))
      // Sum the floored sessions for the authoritative weeklyTSS.
      weeks[i].weeklyTSS = weeks[i].sessions.reduce((s, x) => s + x.targetTSS, 0)
    }
  }
}

// ── helper: insert deload weeks (drops weekly TSS to 60%) ────────────────────
// v9.157.0 (Prompt C) — Race-relative cadence. Pre-fix this was hardcoded
// to plan-index `(i+1) % 4 === 0`, which deloaded "every 4 weeks from plan
// start" — fine when plan length is divisible by 4, but a 5-week plan
// deloaded week 4 (one week before race day) and a 9-week plan never
// deloaded at all. Now walks backwards from the race-phase week, skipping
// Race + Taper, and places a deload every 4 weeks behind the race. Also
// guards against deloading the very first week (no preceding training to
// recover from) and any plan with <6 weeks before race (too short to
// safely deload pre-race).
function applyDeloads(weeks) {
  // Find the race week — preferred: last week with phase==='Race'.
  // Fallback: last week of the plan when no Race phase exists (legacy
  // index-based phasing on >6-week plans always lands Race in the final week).
  let raceWeekIdx = -1
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].phase === 'Race') { raceWeekIdx = i; break }
  }
  if (raceWeekIdx === -1) raceWeekIdx = weeks.length - 1

  // Plans with <6 weeks before race: skip deload entirely.
  if (raceWeekIdx < 5) return

  const factor = 0.60
  for (let i = raceWeekIdx - 1; i > 0; i--) {
    const distFromRace = raceWeekIdx - i
    if (distFromRace % 4 !== 0) continue
    const phase = weeks[i].phase
    if (phase === 'Race' || phase === 'Taper') continue
    weeks[i].isDeload  = true
    weeks[i].weeklyTSS = Math.round(weeks[i].weeklyTSS * factor)
    weeks[i].sessions  = weeks[i].sessions.map(s => ({
      ...s,
      targetTSS: Math.round(s.targetTSS * factor),
    }))
  }
}

// ── main entry: generatePlan ─────────────────────────────────────────────────
/**
 * @description Build an N-week adaptive training plan from athlete inputs.
 *   Returns one entry per week with phase, weekly TSS budget, and per-session
 *   intent / TSS / RPE targets. Pure function — no I/O, no exceptions thrown.
 * @param {Object} params
 * @param {string} [params.goal='pr']            - 'health' | 'finish' | 'pr' | 'podium' | 'fitness' | 'general'
 * @param {number} params.currentCTL             - Current Chronic Training Load (>=0)
 * @param {number} params.weeksToRace            - Weeks until target race (3..52)
 * @param {number} params.availableDays          - Training days/week (2..7)
 * @param {string} [params.model='traditional']  - 'traditional' | 'polarized' | 'block'
 * @param {string} [params.level='intermediate'] - 'beginner' | 'intermediate' | 'advanced' | 'elite'
 * @param {string} [params.raceDistance]         - '5K' | '10K' | 'Half Marathon' | 'Marathon' | 'Cycling Event' | 'General Fitness' (v9.92.0 — biases peak/build intent emphasis)
 * @param {string} [params.primarySport]         - 'Running' | 'Cycling' | 'Swimming' | 'Triathlon' (v9.92.0 — pass-through for renderers; does not alter intent math)
 * @param {number} [params.weeklyTssGoal]        - Athlete's self-stated weekly TSS target. When within ±30% of the CTL-derived peakTSS, rescales the plan to honor it. Outside that band, ignored with a reason returned on the plan. (v9.156.0)
 * @param {string} [params.raceDate]             - ISO date 'YYYY-MM-DD' of target race. When provided, phase placement is calendar-aware: Build/Peak/Taper/Race land relative to days-to-race, not plan index. Deload weeks walk backwards from the race week. (v9.157.0)
 * @returns {Object|null} { weeks, model, totalWeeks, generatedAt, weeklyTssGoalApplied, raceDate } — null on bad input
 * @source Daniels (2014), Seiler (2010), Issurin (2010), Mujika & Padilla (2003)
 * @example
 * generatePlan({ goal:'pr', currentCTL:50, weeksToRace:12, availableDays:5, model:'polarized', level:'intermediate' })
 */
export function generatePlan(params) {
  if (!params || typeof params !== 'object') return null
  const {
    goal           = 'pr',
    currentCTL,
    weeksToRace,
    availableDays,
    model          = 'traditional',
    level          = 'intermediate',
    raceDistance   = null,
    primarySport   = null,
    weeklyTssGoal  = null,
    raceDate       = null,
  } = params

  // ── Input validation — return null on insufficient inputs ─────────────────
  if (currentCTL == null || !Number.isFinite(+currentCTL) || +currentCTL < 0) return null
  if (!Number.isFinite(+weeksToRace) || +weeksToRace < 3 || +weeksToRace > 52) return null
  if (!Number.isFinite(+availableDays) || +availableDays < 2 || +availableDays > 7) return null
  if (!VALID_MODELS.has(model)) return null

  const totalWeeks = Math.floor(+weeksToRace)
  const lvlFactor  = LEVEL_FACTOR[level]  ?? 1.00
  const goalFactor = GOAL_FACTOR[goal]    ?? 1.00

  // v9.157.0 — Compute generatedAt up-front so race-aware phase placement
  // and the returned plan agree on the calendar anchor. Validate raceDate
  // shape; invalid input falls back to legacy plan-index phasing rather
  // than rejecting the plan.
  const generatedAtISO = new Date().toISOString()
  const generatedAtDate = generatedAtISO.slice(0, 10)
  const validRaceDate = typeof raceDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raceDate)
    ? raceDate : null

  // Base & peak weekly TSS — derived from currentCTL with goal/level scaling
  let baseTSS = Math.max(150, Math.round(+currentCTL * 7 * lvlFactor))
  let peakTSS = Math.max(baseTSS + 80, Math.round(+currentCTL * 8.5 * lvlFactor * goalFactor))

  // Build a full set of weeks (with deload + ACWR clamp post-processing) for
  // a given base/peak pair. Extracted as an inner helper so the v9.156 goal
  // path can build once, measure the visible peak, then optionally rescale
  // and rebuild — without that two-pass the goal would compare against the
  // raw peakTSS anchor instead of the weekly TSS the athlete actually sees.
  const buildWeeks = (baseT, peakT) => {
    const ws = []
    for (let w = 0; w < totalWeeks; w++) {
      const phase   = raceAwarePhaseForWeek(w, totalWeeks, validRaceDate, generatedAtDate)
      const intents = weeklyIntents(phase, model, +availableDays, raceDistance)
      const tssBud  = weeklyTSS({ weekIdx: w, totalWeeks, phase, baseTSS: baseT, peakTSS: peakT })
      const sessions = distributeSessionTSS(tssBud, intents)
      ws.push({
        weekNum:          w + 1,
        phase,
        isDeload:         false,
        weeklyTSS:        tssBud,
        sessions,
        zoneDistribution: getZoneDistribution(model, phase, w + 1),
      })
    }
    applyDeloads(ws)
    clampWoWGrowth(ws)
    return ws
  }

  const visiblePeak = (ws) => {
    const peakWeeks = ws.filter(w => w.phase === 'Peak' && !w.isDeload).map(w => w.weeklyTSS)
    return peakWeeks.length ? Math.max(...peakWeeks) : Math.max(...ws.map(w => w.weeklyTSS))
  }

  let weeks = buildWeeks(baseTSS, peakTSS)

  // v9.156.0 (Prompt A) — Honor athlete's self-stated weeklyTssGoal when
  // within ±30% of the visible CTL-derived peak weekly TSS. Outside the
  // band the goal is ignored: above invites ACWR / injury risk, below
  // would degrade fitness. The ±30% window matches the ACWR-safe ramp
  // ceiling used in clampWoWGrowth — staying inside keeps the plan
  // physiologically defensible. Pre-fix this field was collected on the
  // Profile form but had zero consumers; the plan ignored what the
  // athlete explicitly asked for. The semantic the athlete expects is
  // "my hardest week should land near this number" — i.e. visible Peak
  // weeklyTSS, not the raw peakTSS internal anchor.
  let weeklyTssGoalApplied = null
  const goalTss = Number(weeklyTssGoal)
  if (Number.isFinite(goalTss) && goalTss > 0) {
    const ctlPeak = visiblePeak(weeks)
    const lower = Math.round(ctlPeak * 0.70)
    const upper = Math.round(ctlPeak * 1.30)
    if (goalTss >= lower && goalTss <= upper) {
      const scale = goalTss / ctlPeak
      baseTSS = Math.max(150, Math.round(baseTSS * scale))
      peakTSS = Math.round(peakTSS * scale)
      weeks = buildWeeks(baseTSS, peakTSS)
      weeklyTssGoalApplied = { goal: goalTss, applied: true, ctlDerivedPeak: ctlPeak }
    } else {
      weeklyTssGoalApplied = {
        goal: goalTss,
        applied: false,
        reason: goalTss < lower ? 'too_low' : 'too_high',
        ctlDerivedPeak: ctlPeak,
        safeRange: [lower, upper],
      }
    }
  }

  return {
    model,
    goal,
    level,
    raceDistance,
    primarySport,
    totalWeeks,
    startCTL:    +currentCTL,
    targetCTL:   Math.round(peakTSS / 7 * 10) / 10,
    weeks,
    generatedAt: generatedAtISO,
    raceDate:    validRaceDate,
    weeklyTssGoalApplied,
  }
}

/**
 * @description Compact getter — flattens generatePlan output into a list of
 *   { weekNum, day, intent, targetTSS, rpe } rows. Useful for table renderers.
 * @param {Object} plan - Output of generatePlan()
 * @returns {Array} flat session rows; empty array on null/empty plan
 */
export function flattenPlanSessions(plan) {
  if (!plan || !Array.isArray(plan.weeks)) return []
  const out = []
  for (const wk of plan.weeks) {
    for (const s of (wk.sessions || [])) {
      out.push({
        weekNum:   wk.weekNum,
        phase:     wk.phase,
        day:       s.day,
        intent:    s.intent,
        targetTSS: s.targetTSS,
        rpeLow:    s.rpeLow,
        rpeHigh:   s.rpeHigh,
        zone:      s.zone,
      })
    }
  }
  return out
}
