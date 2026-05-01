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

// ── helper: weekly session intent template ───────────────────────────────────
// Returns an array (length = availableDays) of intent strings for the week,
// based on phase and periodization model. Day 0 = Monday.
function weeklyIntents(phase, model, availableDays) {
  const days = Math.max(2, Math.min(7, availableDays | 0))

  // Base templates by phase & model — long enough for 7d, sliced down.
  // Templates are designed so Z5 (vo2) days never sit adjacent after compression.
  let template
  if (phase === 'Race') {
    template = ['rest', 'recovery', 'tempo', 'rest', 'recovery', 'rest', 'test']
  } else if (phase === 'Taper') {
    template = ['recovery', 'tempo', 'endurance', 'rest', 'recovery', 'vo2', 'rest']
  } else if (phase === 'Peak') {
    if (model === 'polarized') {
      template = ['vo2', 'endurance', 'recovery', 'vo2', 'endurance', 'tempo', 'rest']
    } else if (model === 'block') {
      template = ['vo2', 'recovery', 'tempo', 'endurance', 'vo2', 'tempo', 'rest']
    } else {
      template = ['vo2', 'endurance', 'tempo', 'recovery', 'tempo', 'endurance', 'rest']
    }
  } else if (phase === 'Build') {
    if (model === 'polarized') {
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

// ── helper: insert a deload every 4 weeks (drops weekly TSS to 60%) ──────────
function applyDeloads(weeks) {
  for (let i = 0; i < weeks.length; i++) {
    if ((i + 1) % 4 !== 0) continue
    const phase = weeks[i].phase
    if (phase === 'Race' || phase === 'Taper') continue
    const factor = 0.60
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
 * @returns {Object|null} { weeks, model, totalWeeks, generatedAt } — null on bad input
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
  } = params

  // ── Input validation — return null on insufficient inputs ─────────────────
  if (currentCTL == null || !Number.isFinite(+currentCTL) || +currentCTL < 0) return null
  if (!Number.isFinite(+weeksToRace) || +weeksToRace < 3 || +weeksToRace > 52) return null
  if (!Number.isFinite(+availableDays) || +availableDays < 2 || +availableDays > 7) return null
  if (!VALID_MODELS.has(model)) return null

  const totalWeeks = Math.floor(+weeksToRace)
  const lvlFactor  = LEVEL_FACTOR[level]  ?? 1.00
  const goalFactor = GOAL_FACTOR[goal]    ?? 1.00

  // Base & peak weekly TSS — derived from currentCTL with goal/level scaling
  const baseTSS = Math.max(150, Math.round(+currentCTL * 7 * lvlFactor))
  const peakTSS = Math.max(baseTSS + 80, Math.round(+currentCTL * 8.5 * lvlFactor * goalFactor))

  const weeks = []
  for (let w = 0; w < totalWeeks; w++) {
    const phase   = phaseForWeek(w, totalWeeks)
    const intents = weeklyIntents(phase, model, +availableDays)
    const tssBud  = weeklyTSS({ weekIdx: w, totalWeeks, phase, baseTSS, peakTSS })
    const sessions = distributeSessionTSS(tssBud, intents)
    weeks.push({
      weekNum:          w + 1,
      phase,
      isDeload:         false,
      weeklyTSS:        tssBud,
      sessions,
      zoneDistribution: getZoneDistribution(model, phase, w + 1),
    })
  }

  // Insert deloads every 4 weeks (skip Race/Taper)
  applyDeloads(weeks)

  // Clamp week-over-week growth ≤10% (ACWR safe)
  clampWoWGrowth(weeks)

  return {
    model,
    goal,
    level,
    totalWeeks,
    startCTL:    +currentCTL,
    targetCTL:   Math.round(peakTSS / 7 * 10) / 10,
    weeks,
    generatedAt: new Date().toISOString(),
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
