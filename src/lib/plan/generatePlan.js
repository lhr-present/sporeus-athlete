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
  // Race already passed (stale raceDate): don't collapse every week to 'Race' —
  // fall back to index-based phasing.
  if (daysToRace < 0) return phaseForWeek(weekIdx, totalWeeks)
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

// Fraction of peakTSS rendered on a (non-deloaded) Peak week. The achieved
// visible peak the athlete actually sees is peakTSS * PEAK_FRAC (before any
// clampWoWGrowth dampening). The taper anchors to this — not the raw peakTSS —
// so taper weeks can never ramp ABOVE the week the plan calls its peak.
const PEAK_FRAC = 0.92
// Base phase ramps from BASE_FLOOR_FRAC×baseTSS (first Base week) up to baseTSS
// (last Base week), so Base is genuinely the lowest TRAINING phase — progressive
// overload, not a flat ceiling. Tunable.
const BASE_FLOOR_FRAC = 0.85

// ── helper: TSS budget for a week (Phase × goal × level) ─────────────────────
// v9.422 (founder decision) — `phaseCtx` carries phase-derived position info so
// the Build ramp and Taper descent are anchored to the SAME phase source the
// plan actually uses (raceAwarePhaseForWeek), not a standalone plan-index window.
//   phaseCtx.buildIdx   — 0-based ordinal of this week within the Build run
//   phaseCtx.buildCount — total number of Build weeks in the plan
//   phaseCtx.taperIdx   — 0-based ordinal within the Taper run (0 = first taper week)
//   phaseCtx.taperCount — total number of Taper weeks in the plan
function weeklyTSS({ phase, baseTSS, peakTSS, phaseCtx }) {
  if (phase === 'Race')     return Math.round(peakTSS * 0.40)
  if (phase === 'Taper') {
    // Monotonic load REDUCTION across the taper (Mujika & Padilla 2003): each
    // taper week sheds load relative to the achieved peak. The first taper week
    // (taperIdx 0, furthest from race) carries the most; the last carries the
    // least. Anchored to the VISIBLE peak (peakTSS * PEAK_FRAC) so taper can
    // never exceed the peak week. clampWoWGrowth + enforceTaperDescent below
    // guarantee the final monotonic descent after per-session rounding.
    const visiblePeak = peakTSS * PEAK_FRAC
    const taperCount  = Math.max(1, phaseCtx?.taperCount ?? 1)
    const taperIdx    = Math.max(0, Math.min(taperCount - 1, phaseCtx?.taperIdx ?? 0))
    // Descending fracs of the visible peak: first taper week ≈ 0.80, ramping
    // down to ≈ 0.55 at the last taper week before Race. Single-week taper → 0.65.
    const TAPER_TOP = 0.80
    const TAPER_BOT = 0.55
    const frac = taperCount === 1
      ? 0.65
      : TAPER_TOP - (TAPER_TOP - TAPER_BOT) * (taperIdx / (taperCount - 1))
    return Math.round(visiblePeak * frac)
  }
  if (phase === 'Peak') return Math.round(peakTSS * PEAK_FRAC)
  if (phase === 'Build') {
    // Build progression from baseTSS toward peakTSS across the Build run.
    // Position is the ordinal WITHIN the assigned Build phase (phaseCtx), which
    // comes from the same phase function the plan uses — so the ramp can never
    // diverge from the calendar-aware phase placement (the v9.422 deload fix).
    const buildCount = Math.max(1, phaseCtx?.buildCount ?? 1)
    const buildIdx   = Math.max(0, Math.min(buildCount - 1, phaseCtx?.buildIdx ?? 0))
    const denom = Math.max(1, buildCount - 1)
    const frac  = buildIdx / denom
    return Math.round(baseTSS + (peakTSS - baseTSS) * frac)
  }
  // Base — ramp from BASE_FLOOR_FRAC×baseTSS up to baseTSS across the Base run so
  // Base is the lowest training phase (was a flat baseTSS, which — being near
  // peakTSS — made week 1 the hardest week and left "Peak" below the start).
  const baseCount = Math.max(1, phaseCtx?.baseCount ?? 1)
  const baseIdx   = Math.max(0, Math.min(baseCount - 1, phaseCtx?.baseIdx ?? 0))
  const baseFrac  = baseCount > 1 ? baseIdx / (baseCount - 1) : 1
  return Math.round(baseTSS * (BASE_FLOOR_FRAC + (1 - BASE_FLOOR_FRAC) * baseFrac))
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

// ── helper: build per-week phase context (ordinals within Build/Taper runs) ──
// v9.422 — derives Build/Taper position from the ACTUAL assigned phase array so
// weeklyTSS's ramp/descent never diverges from raceAwarePhaseForWeek. Returns a
// parallel array of { buildIdx, buildCount, taperIdx, taperCount } per week.
function buildPhaseContext(phases) {
  const buildCount = phases.filter(p => p === 'Build').length
  const taperCount = phases.filter(p => p === 'Taper').length
  const baseCount  = phases.filter(p => p === 'Base').length
  let bSeen = 0
  let tSeen = 0
  let baseSeen = 0
  return phases.map(p => {
    const ctx = { buildIdx: 0, buildCount, taperIdx: 0, taperCount, baseIdx: 0, baseCount }
    if (p === 'Build') ctx.buildIdx = bSeen++
    if (p === 'Taper') ctx.taperIdx = tSeen++
    if (p === 'Base')  ctx.baseIdx  = baseSeen++
    return ctx
  })
}

// ── helper: guarantee no deload week exceeds the immediately preceding week ───
// v9.422 (founder decision, BUG 1) — a flagged deload must never carry MORE TSS
// than the week before it. Calendar-aware phasing + the Build ramp can otherwise
// hand a deload a budget above its (non-deloaded) predecessor. Floor the deload
// (and its sessions) down to the prior week's TSS when it would exceed it.
function enforceDeloadDescent(weeks) {
  for (let i = 1; i < weeks.length; i++) {
    if (!weeks[i].isDeload) continue
    const prev = weeks[i - 1].weeklyTSS
    const curr = weeks[i].weeklyTSS
    if (prev > 0 && curr > prev) {
      const ratio = prev / curr
      weeks[i].sessions = weeks[i].sessions.map(s => ({
        ...s,
        targetTSS: Math.floor(s.targetTSS * ratio),
      }))
      weeks[i].weeklyTSS = weeks[i].sessions.reduce((s, x) => s + x.targetTSS, 0)
    }
  }
}

// ── helper: enforce monotonic taper descent (Mujika & Padilla 2003) ──────────
// v9.422 (founder decision, BUG 2) — the taper is a monotonic load REDUCTION.
// Each Taper week (and the Race week) must be ≤ the previous week AND ≤ the
// achieved peak-week TSS. Per-session rounding or an upstream deload can leave a
// taper week fractionally above its predecessor; clamp it down here so the
// descent is strict-or-equal across Taper → Race.
function enforceTaperDescent(weeks) {
  // Ceiling = the highest non-deloaded Peak-week TSS (the achieved/visible peak).
  // Falls back to the global max when no Peak phase exists (short plans).
  const peakWeeks = weeks.filter(w => w.phase === 'Peak' && !w.isDeload).map(w => w.weeklyTSS)
  const peakCeil  = peakWeeks.length ? Math.max(...peakWeeks) : Math.max(...weeks.map(w => w.weeklyTSS))
  let cap = peakCeil
  let started = false
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i]
    if (w.phase !== 'Taper' && w.phase !== 'Race') continue
    if (!started) {
      // The FIRST taper week must also not exceed the immediately preceding training
      // week (a taper is a reduction from where you actually were, not from the peak
      // ceiling — which a preceding deload could have left below that ceiling).
      const prevTSS = i > 0 ? weeks[i - 1].weeklyTSS : cap
      cap = Math.min(cap, prevTSS)
      started = true
    }
    if (w.weeklyTSS > cap && cap >= 0 && w.weeklyTSS > 0) {
      const ratio = cap / w.weeklyTSS
      w.sessions = w.sessions.map(s => ({
        ...s,
        targetTSS: Math.floor(s.targetTSS * ratio),
      }))
      w.weeklyTSS = w.sessions.reduce((s, x) => s + x.targetTSS, 0)
    }
    // Next taper/race week can be no higher than this one (monotonic descent).
    cap = w.weeklyTSS
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
    // Never deload the Race, Taper, or PEAK phase — you don't recover-week your
    // apex. Deloading a Peak week + the ≤10%/wk rebound clamp previously capped the
    // achieved peak BELOW the Base weeks (inverted periodization).
    if (phase === 'Race' || phase === 'Taper' || phase === 'Peak') continue
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
    vo2max         = null,    // v9.412 — measured VO2max (ml/kg/min); informs trainable ceiling
    physiologyTargets = false, // v9.412 — feature flag: physiology-driven intensity + ramp (default off)
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
  // v9.412 — VO2max trainability nudge (founder-approved 2026-06-15; behind the
  // physiologyTargets flag, default OFF → peak volume is byte-identical otherwise).
  // Principle: higher relative VO2max supports a higher trainable ceiling
  // (Midgley et al. 2007, Sports Med; Billat 2001 vVO2max). The bound below is a
  // CONSERVATIVE product parameter (ref VO2max 50, ±, capped 0.97–1.10), not a
  // published coefficient — gated + approved, never applied without the flag.
  if (physiologyTargets && Number.isFinite(+vo2max) && +vo2max > 0) {
    const vo2Trainability = Math.max(0.97, Math.min(1.10, 1 + ((+vo2max) - 50) / 50 * 0.12))
    peakTSS = Math.max(baseTSS + 80, Math.round(peakTSS * vo2Trainability))
  }

  // Build a full set of weeks (with deload + ACWR clamp post-processing) for
  // a given base/peak pair. Extracted as an inner helper so the v9.156 goal
  // path can build once, measure the visible peak, then optionally rescale
  // and rebuild — without that two-pass the goal would compare against the
  // raw peakTSS anchor instead of the weekly TSS the athlete actually sees.
  const buildWeeks = (baseT, peakT) => {
    // Pass 1 — assign the calendar-aware phase for every week, then derive each
    // week's ordinal position within its Build/Taper run. weeklyTSS reads this
    // context so the Build ramp and Taper descent stay locked to the SAME phase
    // source the plan uses (the v9.422 deload/taper fixes).
    const phases  = []
    for (let w = 0; w < totalWeeks; w++) {
      phases.push(raceAwarePhaseForWeek(w, totalWeeks, validRaceDate, generatedAtDate))
    }
    const phaseCtxs = buildPhaseContext(phases)

    const ws = []
    for (let w = 0; w < totalWeeks; w++) {
      const phase   = phases[w]
      const intents = weeklyIntents(phase, model, +availableDays, raceDistance)
      const tssBud  = weeklyTSS({ phase, baseTSS: baseT, peakTSS: peakT, phaseCtx: phaseCtxs[w] })
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
    // Finalize the load shape. clampWoWGrowth (caps ≤10% rebound) and the two
    // descent enforcers (taper ≤ peak & monotonic; deload ≤ predecessor) all
    // only ever LOWER weeks, but they constrain different neighbours, so a single
    // ordering can leave one freshly violated (e.g. clamp lowers a deload's
    // predecessor below the deload). Iterate to a fixpoint — converges in a few
    // passes since every pass is monotone-decreasing and bounded below by 0.
    for (let pass = 0; pass < 8; pass++) {
      const before = ws.map(w => w.weeklyTSS)
      clampWoWGrowth(ws)
      enforceTaperDescent(ws)
      enforceDeloadDescent(ws)
      if (ws.every((w, i) => w.weeklyTSS === before[i])) break
    }
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
    // Reflect the ACHIEVED peak (max non-deload Peak week after clamps/descents),
    // not the raw internal peakTSS the plan may never reach — so the promised CTL
    // is one the plan can actually deliver.
    targetCTL:   Math.round(visiblePeak(weeks) / 7 * 10) / 10,
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
