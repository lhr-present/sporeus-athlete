// src/lib/athlete/eliteProgram.js — Elite Program Orchestrator
// Wires existing primitives (raceGoalEngine, running, cycling, swimming, periodization,
// taperEngine) into a single deterministic pipeline:
//   4 inputs (currentPR, targetPR, raceDate, sport) → complete periodized program.
//
// Pure function, no React, no I/O. Bilingual EN+TR output.
//
// References:
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed. Human Kinetics.
//   Bompa T. & Haff G. (2009). Periodization: Theory and Methodology of Training.
//   Mujika I., Padilla S. (2003). Scientific bases for precompetition tapering. MSSE 35:1182.
//   Coggan A. & Allen H. (2010). Training and Racing with a Power Meter, 2nd ed.
//   Wakayoshi K. et al. (1992). Determination of critical velocity in swimming. Eur J Appl Physiol.
//   Seiler S. (2010). What is best practice for training intensity distribution? IJSPP 5:276–291.
//
// ── Public API contract (v8.97.0) ────────────────────────────────────────────
//
// /**
//  * @typedef {Object} EliteProgramFeasibility
//  * @property {'comfortable'|'realistic'|'aggressive'|'unrealistic'} band
//  * @property {number} weeksAvailable
//  * @property {number} weeksNeeded
//  * @property {number} deltaPct
//  * @property {{en:string, tr:string}} note
//  * @property {string} [effectiveRaceDate]   // v8.96 — synthesized when no raceDate
//  */
//
// /**
//  * @typedef {Object} EliteProgramSynthetic
//  * @property {boolean} raceDate
//  * @property {boolean} targetPR
//  * @property {string|null} [raceLabel]
//  */
//
// /**
//  * @typedef {Object} EliteProgramResult
//  * @property {EliteProgramFeasibility} feasibility
//  * @property {string} sport
//  * @property {Object} currentLevel  // {vdot|ftp|css, paces}
//  * @property {Object} targetLevel
//  * @property {Object} resolvedTargetPR  // v8.96 — final target PR (synthesized or explicit)
//  * @property {EliteProgramSynthetic} [synthetic]  // v8.96 — present when target/race auto-derived
//  * @property {Array}  phases
//  * @property {Array<number>} weeklyTSS
//  * @property {Object} sampleWeeks
//  * @property {{en:string, tr:string}} recommendation
//  * @property {string} citation
//  * @property {boolean} reliable
//  *
//  * v9.2.0 BROADER PLAN content layers (all optional but always emitted):
//  * @property {Object} [keySessionLibrary]  // per-phase key workouts (3-5 each, sport-aware)
//  * @property {Object} [strengthProgram]    // per-phase S&C prescription (Rønnestad/Beattie)
//  * @property {Object} [fuelingProgram]     // per-phase CHO/protein/fat targets (Burke/Jeukendrup)
//  * @property {Object} [recoveryProgram]    // per-phase sleep/HRV/deload prescription (Halson/Plews)
//  * @property {Object} [raceWeekProtocol]   // T-7 to T-0 day-by-day + race-day pacing (Mujika)
//  * @property {Object} [substitutionMap]    // indoor/cross/injured/weather/missed alternates
//  */
//
// // ── Coach share envelope (v8.97.0 + v8.101.0) ─────────────────────────────
// /**
//  * @typedef {Object} CoachShareEnvelope_V1
//  * @property {1} v                                 // version — bump on
//  *                                                  // breaking changes
//  * @property {'sporeus-elite-program-share'} kind
//  * @property {Object} athleteSnapshot              // sport, distanceM,
//  *                                                  // currentTime, targetTime,
//  *                                                  // raceDate,
//  *                                                  // weeksAvailable,
//  *                                                  // weeksNeeded,
//  *                                                  // feasibilityBand
//  * @property {Object} [physiology]                 // sport-conditional
//  *                                                  // VDOT/FTP/CSS current
//  *                                                  // and target (nulls
//  *                                                  // allowed)
//  * @property {Array<{phase: string, weeks: number}>} phases
//  * @property {EliteProgramSynthetic|null} synthetic
//  * @property {Object} lifecycle                    // { state,
//  *                                                  // percentComplete,
//  *                                                  // daysToRace }
//  * @property {string} citation
//  * @property {string} generatedAt                  // YYYY-MM-DD
//  *
//  * Stable contract — emitted by EliteProgramCard's SHARE WITH COACH
//  * button (shareWithCoach), parsed by parseCoachShareEnvelope() in
//  * src/lib/athlete/coachShareEnvelope.js, ingested by
//  * CoachAthleteProgramCard. Forward-compat: extra unknown fields
//  * tolerated. Breaking changes must bump v to 2 and the coach ingest
//  * must accept both versions during deprecation.
//  */

import {
  vdotFromRace,
  predictRaceTime,
  trainingPaces,
} from '../sport/running.js'
import {
  getCyclingZones,
} from '../sport/cycling.js'
import {
  tPaceFromTT,
  cssToSecPer100m,
  swimmingZones,
} from '../sport/swimming.js'
// v9.7.0 — rowing parity in Mission #1
import {
  predict2000m,
  fmtSplit,
  rowingZones,
} from '../sport/rowing.js'

// v9.2.0 — broader plan content layers
import { buildKeySessionLibrary }   from './eliteProgramKeySessions.js'
import { selectCohort }              from './eliteProgramCohorts.js'
import { buildStrengthProgram }     from './eliteProgramStrength.js'
import { buildFuelingProgram }      from './eliteProgramFueling.js'
import { buildRecoveryProgram }     from './eliteProgramRecovery.js'
import { buildRaceWeekProtocol }    from './eliteProgramRaceWeek.js'
import { buildSubstitutionMap, buildContingencyMap } from './eliteProgramSubstitutions.js'
import { buildDrillsLibrary }       from './eliteProgramDrills.js'

const CITATION = 'Daniels 2014; Bompa 2009; Mujika 2003; Coggan 2010; Wakayoshi 1992; Seiler 2010'

// ── Scientific model exposition (v8.92.0) ────────────────────────────────────
// Surfaces the periodization model and per-phase physiological rationale so the
// UI can render an "About this model" panel without duplicating citations.
/** @public */
export const MODEL_NAME = {
  en: 'Traditional Linear Periodization (Bompa 2009)',
  tr: 'Geleneksel Doğrusal Periyodizasyon (Bompa 2009)',
}

/** @public */
export const PHASE_RATIONALE = {
  Base: {
    en: 'High-volume low-intensity work drives aerobic enzymatic adaptation, capillary density, and mitochondrial biogenesis. Easy zone-1/zone-2 mileage builds the substrate the later phases depend on.',
    tr: 'Yüksek hacim ve düşük yoğunluklu çalışma aerobik enzim adaptasyonu, kapiller yoğunluk ve mitokondri biyogenezini tetikler. Kolay 1./2. zon hacmi sonraki fazların dayandığı altyapıyı kurar.',
    cite: 'Daniels 2014; Seiler 2010',
  },
  Build: {
    en: 'Threshold and tempo work raise lactate clearance, while VO2max touches lift the aerobic ceiling. Race-specific load now stresses the same systems that the goal event will tax.',
    tr: 'Eşik ve tempo çalışmaları laktat temizleme kapasitesini yükseltir; VO2max dokunuşları aerobik tavanı kaldırır. Yarışa özgü yük artık hedef yarışın zorlayacağı sistemleri çalıştırır.',
    cite: 'Daniels 2014; Coggan & Allen 2010',
  },
  Peak: {
    en: 'Race-pace specificity and neuromuscular sharpening dominate. Volume holds while intensity converges on goal pace so motor patterns and perceived effort match race day demands.',
    tr: 'Yarış-tempo özgüllüğü ve nöromüsküler keskinleşme baskındır. Hacim korunur, yoğunluk hedef tempoya yakınsar; motor örüntüler ve algılanan efor yarış günü taleplerine uyar.',
    cite: 'Bompa 2009; Issurin 2010',
  },
  Taper: {
    en: 'A 14-day exponential reduction drops acute training load (ATL) while preserving chronic training load (CTL). Freshness rises without erosion of fitness, peaking form on race day.',
    tr: '14 günlük üstel azaltma akut antrenman yükünü (ATL) düşürürken kronik yükü (CTL) korur. Form kaybetmeden tazelik yükselir; yarış günü zirveye çıkar.',
    cite: 'Mujika & Padilla 2003',
  },
}

/** @public */
export const DELOAD_NOTE = {
  en: '3:1 deload — every 4th week drops to ~60% of build target to consolidate adaptations and limit overreaching (Issurin 2010; Mujika 2009)',
  tr: '3:1 deload — her 4. hafta yapı hedefinin ~%60\'ına iner; adaptasyonları pekiştirir ve aşırı yüklenmeyi sınırlar (Issurin 2010; Mujika 2009)',
}

// ── Date helpers (UTC-only, no DST drift) ────────────────────────────────────
function parseUTCDate(s) {
  if (!s || typeof s !== 'string') return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return isNaN(d.getTime()) ? null : d
}

function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000)
}

function todayUTC() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

// ── Sport-specific feasibility math ──────────────────────────────────────────

// Daniels VDOT gain rate per 12-week block — mirrors raceGoalEngine private fn.
// v9.18.0 — Calibrated against Daniels Running Formula 4th ed. Ch.2 VDOT
// progression table: trained athletes (VDOT 50+) routinely add 2-3 points
// per 12-week block under structured periodization. Prior 0.8 elite gain was
// 60% too conservative — would systematically project elite athletes short
// of realistic targets.
/** @internal */
export function vdotGainPerBlock(vdot) {
  if (vdot < 35) return 3.5
  if (vdot < 45) return 2.5
  if (vdot < 55) return 2.0
  return 1.5
}

// FTP gain rate (W) per 12-week block (Coggan & Allen 2019: ~3-5% for trained,
// ~8% for novices). v9.18.0 — added 280 W intermediate band so the 240→300
// transition isn't a 7%→5% cliff (was 14.5W gain at 290W vs 9W gain at 305W,
// a 40% step across a 15W spread). Smoother curve matches Coggan's data.
/** @internal */
export function ftpGainPerBlock(ftpW) {
  if (ftpW < 180) return ftpW * 0.10
  if (ftpW < 240) return ftpW * 0.07
  if (ftpW < 280) return ftpW * 0.06
  if (ftpW < 320) return ftpW * 0.05
  return ftpW * 0.03
}

// CSS gain rate (sec/100m faster) per 12-week block.
// Trained swimmers: ~3 s; intermediate: ~5 s; novices (CSS slower than 1:50/100m): ~7 s
/** @internal */
export function cssGainPerBlock(cssSecPer100m) {
  if (cssSecPer100m > 110) return 7
  if (cssSecPer100m > 90)  return 5
  return 3
}

// v9.8.0 — Field-test recalibration helper. Returns actual_gain / expected_gain
// at the time of a field test conducted after `baseWeeks` of training. >1 means
// the athlete is ahead of plan; <1 behind. Sport-aware: VDOT (run/tri),
// FTP-watts (bike), CSS sec/100m (swim), 2k split sec (rowing).
/** @public */
export function fieldTestGainRatio(sport, currentLevel, actualResults, baseWeeks) {
  if (!actualResults || baseWeeks <= 0) return 1
  const blockFraction = baseWeeks / 12
  if (sport === 'run' || sport === 'triathlon') {
    const start = currentLevel?.vdot
    if (!start) return 1
    const expected = vdotGainPerBlock(start) * blockFraction
    const actual = (Number(actualResults.vdot) || start) - start
    return expected > 0 ? actual / expected : 1
  }
  if (sport === 'bike') {
    const start = currentLevel?.ftp
    if (!start) return 1
    const expected = ftpGainPerBlock(start) * blockFraction
    const actual = (Number(actualResults.ftp) || start) - start
    return expected > 0 ? actual / expected : 1
  }
  if (sport === 'swim') {
    const start = currentLevel?.css
    if (!start) return 1
    // CSS in sec/100m: lower = faster. Expected gain is positive sec/100m faster.
    const expected = cssGainPerBlock(start) * blockFraction
    const actual = start - (Number(actualResults.cssSecPer100m) || start)
    return expected > 0 ? actual / expected : 1
  }
  if (sport === 'rowing') {
    const start = currentLevel?.split2kSec
    if (!start) return 1
    const expected = rowingGainPerBlock(start) * blockFraction
    const actual = start - (Number(actualResults.split2kSec) || start)
    return expected > 0 ? actual / expected : 1
  }
  return 1
}

// v9.7.0 — Rowing 2000m time gain (sec faster) per 12-week block.
// Elite/sub-7:00 row: 1-2 s/block. Sub-7:30: 3 s/block. Sub-8:00: 4 s/block.
// Recreational (>8:00): 5+ s/block. Calibrated against Concept2 World Records
// progression and British Rowing development pathway.
/** @internal */
export function rowingGainPerBlock(time2000Sec) {
  if (time2000Sec < 380) return 1   // sub-6:20 — Olympic-level
  if (time2000Sec < 420) return 2   // sub-7:00 — international
  if (time2000Sec < 450) return 3   // sub-7:30 — strong club
  if (time2000Sec < 480) return 4   // sub-8:00 — competitive amateur
  return 5                           // recreational
}

function feasibilityBand(weeksAvailable, weeksNeeded) {
  if (weeksAvailable >= weeksNeeded * 1.25) return 'comfortable'
  if (weeksAvailable >= weeksNeeded * 0.95) return 'realistic'
  if (weeksAvailable >= weeksNeeded * 0.70) return 'aggressive'
  return 'unrealistic'
}

const BAND_NOTES = {
  comfortable: {
    en: 'Goal is comfortable — sustainable progression',
    tr: 'Hedef rahat — sürdürülebilir ilerleme',
  },
  realistic: {
    en: 'Goal is realistic with consistent training',
    tr: 'Hedef tutarlı antrenmanla gerçekçi',
  },
  aggressive: {
    en: 'Goal is aggressive — execution must be near-perfect',
    tr: 'Hedef agresif — uygulama neredeyse kusursuz olmalı',
  },
  unrealistic: {
    en: 'Goal too aggressive for available time — extend race date or moderate target',
    tr: 'Hedef için zaman yetersiz — yarışı ertele veya hedefi yumuşat',
  },
}

// ── Phase split per total available weeks ────────────────────────────────────
// Generic split — distance-agnostic. v9.161.0 (EP-1) wraps this with
// distance-specific redistribution.
function genericPhaseSplit(weeksAvailable) {
  if (weeksAvailable <= 0) {
    return { Base: 0, Build: 0, Peak: 0, Taper: 0 }
  }
  if (weeksAvailable < 4) {
    return { Base: 0, Build: 0, Peak: Math.max(0, weeksAvailable - 1), Taper: Math.min(1, weeksAvailable) }
  }
  if (weeksAvailable <= 7) {
    const taper = Math.max(1, Math.round(weeksAvailable * 0.20))
    const peak  = Math.max(1, Math.round(weeksAvailable * 0.30))
    const build = Math.max(1, weeksAvailable - peak - taper)
    return { Base: 0, Build: build, Peak: peak, Taper: taper }
  }
  if (weeksAvailable <= 15) {
    const taper = Math.max(1, Math.round(weeksAvailable * 0.10))
    const peak  = Math.max(1, Math.round(weeksAvailable * 0.25))
    const build = Math.max(1, Math.round(weeksAvailable * 0.40))
    const base  = Math.max(0, weeksAvailable - peak - taper - build)
    return { Base: base, Build: build, Peak: peak, Taper: taper }
  }
  // 16+ weeks — taper clamped to 2 weeks
  const taper = 2
  const peak  = Math.max(2, Math.round(weeksAvailable * 0.20))
  const build = Math.max(2, Math.round(weeksAvailable * 0.35))
  const base  = Math.max(2, weeksAvailable - peak - taper - build)
  return { Base: base, Build: build, Peak: peak, Taper: taper }
}

// v9.161.0 (EP-1) — Distance-aware phase redistribution. Pre-fix the elite
// program used the same Base/Build/Peak/Taper ratios for every distance —
// a 5K athlete on a 16-week plan got the same Base-heavy distribution as
// a Marathon athlete. Real periodization differs: 5K peaks in 10-12 weeks
// with high-VO2max emphasis; Marathon needs sustained sub-threshold dose.
//
// Multipliers below are applied to the GENERIC split (per phase), then
// Base/Build/Peak re-normalized to fit `weeksAvailable - Taper`. Taper
// count is preserved from the generic split — it's about race-day
// freshness, not aerobic dose, so distance shouldn't change it.
//
// Per-sport namespacing avoids the "Sprint" overload between swim
// (200m) and triathlon (sprint triathlon).
export const DISTANCE_PHASE_MULTIPLIERS = Object.freeze({
  run: {
    '5K':       { Base: 0.65, Build: 0.85, Peak: 1.40 },  // VO2-heavy peak
    '10K':      { Base: 0.85, Build: 1.00, Peak: 1.15 },  // balanced
    'HM':       { Base: 1.00, Build: 1.10, Peak: 1.00 },  // slight build emphasis
    'Marathon': { Base: 1.30, Build: 1.10, Peak: 0.70 },  // base-heavy aerobic
    'Ultra':    { Base: 1.50, Build: 1.00, Peak: 0.60 },  // maximally base-heavy
  },
  swim: {
    'Sprint':   { Base: 0.70, Build: 0.90, Peak: 1.40 },  // 50/100m: speed dominant
    'Mid':      { Base: 0.90, Build: 1.00, Peak: 1.15 },  // 200-800m
    'Distance': { Base: 1.20, Build: 1.10, Peak: 0.80 },  // 1500m+ / OW
  },
  triathlon: {
    'Sprint':   { Base: 0.85, Build: 1.00, Peak: 1.15 },  // ~25km total
    'Olympic':  { Base: 1.00, Build: 1.10, Peak: 1.00 },  // ~52km
    '70.3':     { Base: 1.20, Build: 1.10, Peak: 0.80 },  // ~113km
    'IM':       { Base: 1.40, Build: 1.10, Peak: 0.65 },  // ~226km — maximally aerobic
  },
  bike: {
    'TT':        { Base: 0.85, Build: 1.10, Peak: 1.10 },  // sustained threshold + VO2
    'RoadRace':  { Base: 1.00, Build: 1.10, Peak: 1.00 },  // mixed tactical
    'GranFondo': { Base: 1.30, Build: 1.10, Peak: 0.70 },  // multi-hour aerobic
  },
  rowing: {
    '2k':       { Base: 0.85, Build: 1.00, Peak: 1.20 },  // race-distance VO2/lactate
    'Erg':      { Base: 1.00, Build: 1.10, Peak: 0.95 },  // generic erg training
    '5k':       { Base: 1.20, Build: 1.10, Peak: 0.80 },  // longer / head-of-the-charles
  },
})

/**
 * v9.161.0 (EP-1) — Infer a distance category from sport + race distance.
 * Returns null when distance is missing/zero (caller falls back to the
 * generic phase split).
 *
 * @param {string} sport - internal 3-letter form: 'run'|'bike'|'swim'|'triathlon'|'rowing'
 * @param {number|null} distanceM - race distance in meters
 * @returns {string|null}
 */
export function inferDistanceCategory(sport, distanceM) {
  const d = Number(distanceM)
  if (sport === 'run') {
    if (!Number.isFinite(d) || d <= 0) return null
    if (d <= 5000)   return '5K'
    if (d <= 10000)  return '10K'
    if (d <= 21100)  return 'HM'
    if (d <= 42500)  return 'Marathon'
    return 'Ultra'
  }
  if (sport === 'swim') {
    if (!Number.isFinite(d) || d <= 0) return null
    if (d <= 200)    return 'Sprint'
    if (d <= 800)    return 'Mid'
    return 'Distance'
  }
  if (sport === 'triathlon') {
    if (!Number.isFinite(d) || d <= 0) return null
    if (d <= 35000)  return 'Sprint'
    if (d <= 75000)  return 'Olympic'
    if (d <= 150000) return '70.3'
    return 'IM'
  }
  if (sport === 'bike') {
    // distanceM === 0 || null is the "direct FTP" sentinel — treat as TT
    if (!Number.isFinite(d) || d === 0)  return 'TT'
    if (d <= 50000)   return 'TT'
    if (d <= 200000)  return 'RoadRace'
    return 'GranFondo'
  }
  if (sport === 'rowing') {
    if (!Number.isFinite(d) || d <= 0) return 'Erg'
    if (d <= 2500)   return '2k'
    return '5k'
  }
  return null
}

function phaseSplit(weeksAvailable, sport, distanceCategory) {
  const base = genericPhaseSplit(weeksAvailable)
  if (!distanceCategory || !sport || weeksAvailable < 8) return base
  const mults = DISTANCE_PHASE_MULTIPLIERS[sport]?.[distanceCategory]
  if (!mults) return base

  const taperWeeks = base.Taper
  const remaining = weeksAvailable - taperWeeks
  if (remaining <= 2) return base  // too short to redistribute meaningfully

  const raw = {
    Base:  base.Base  * mults.Base,
    Build: base.Build * mults.Build,
    Peak:  base.Peak  * mults.Peak,
  }
  const rawSum = raw.Base + raw.Build + raw.Peak
  if (rawSum <= 0) return base

  let peakWeeks  = Math.max(1, Math.round(raw.Peak  / rawSum * remaining))
  let buildWeeks = Math.max(1, Math.round(raw.Build / rawSum * remaining))
  let baseWeeks  = remaining - peakWeeks - buildWeeks
  // Handle rounding overflow: if Base goes negative, steal from Build first
  // then Peak; preserve at-least-1-week floors where the generic split had them.
  if (baseWeeks < 0) {
    let overflow = -baseWeeks
    baseWeeks = 0
    const buildSteal = Math.min(overflow, buildWeeks - 1)
    buildWeeks -= buildSteal
    overflow -= buildSteal
    if (overflow > 0) peakWeeks = Math.max(1, peakWeeks - overflow)
  }
  return { Base: baseWeeks, Build: buildWeeks, Peak: peakWeeks, Taper: taperWeeks }
}

const PHASE_COLORS = {
  Base:  '#0064ff',
  Build: '#00aa66',
  Peak:  '#ff6600',
  Taper: '#9966cc',
}

/**
 * Bilingual phase-focus copy. Single source of truth — consumed by both
 * the orchestrator's phase output and by todayProgrammedSession's headline
 * text.
 *
 * @public
 */
export const PHASE_FOCUS = {
  Base:  { en: 'Aerobic base, easy volume, technique',           tr: 'Aerobik temel, kolay hacim, teknik' },
  Build: { en: 'Threshold and tempo, race-specific load',        tr: 'Eşik ve tempo, yarışa özgü yük' },
  Peak:  { en: 'VO2max intervals, race-pace specificity',        tr: 'VO2max interval, yarış-tempo özgüllüğü' },
  Taper: { en: 'Volume reduction, intensity preserved, freshness', tr: 'Hacim azaltma, yoğunluk korunur, tazelik' },
}

// ── Weekly TSS curve ────────────────────────────────────────────────────────
// v9.162.0 (EP-2) — Gabbett 2016 ACWR danger-zone ceiling. Pre-fix the
// elite program had no explicit safety cap on weekly TSS; `buildWeeklyTSS`
// scales with `currentCTL`, so an athlete whose currentCTL is anchored
// correctly stays safe, but a stale/over-aggressive anchor or a high
// field-test recal scaling could push individual weeks above the injury
// danger threshold. Gabbett 2016 review of ACWR research:
//   • 0.8–1.3 = sweet spot (low injury risk + fitness gain)
//   • 1.3–1.5 = elevated but tolerable
//   • > 1.5   = danger zone — injury rate rises sharply
// Cap is set at 1.5 × weekly-CTL: programs that naturally peak at
// ~1.36 × weekly-CTL stay untouched; only outliers get capped.
//
// Floor at currentCTL=10: below that, CTL is too noisy to anchor the
// ceiling and the program legitimately starts from a low base — capping
// would zero out the plan.
const ACWR_DANGER_ZONE_RATIO = 1.5
const ACWR_MIN_CTL_FOR_CAP   = 10

function applyACWRSafetyCap(weeklyTSS, currentCTL) {
  if (!Number.isFinite(+currentCTL) || +currentCTL < ACWR_MIN_CTL_FOR_CAP) {
    return { cappedTSS: weeklyTSS, warning: null }
  }
  const ceiling = Math.round(+currentCTL * 7 * ACWR_DANGER_ZONE_RATIO)
  let weeksCapped = 0
  let maxOriginal = 0
  const cappedTSS = weeklyTSS.map(w => {
    if (w > maxOriginal) maxOriginal = w
    if (w > ceiling) { weeksCapped++; return ceiling }
    return w
  })
  if (weeksCapped === 0) return { cappedTSS, warning: null }
  // > 50% of weeks capped → the goal fundamentally exceeds the athlete's
  // safe accrual velocity. Otherwise it's "aggressive but mostly safe".
  const severity = weeksCapped > weeklyTSS.length * 0.5 ? 'unsafe' : 'aggressive'
  return {
    cappedTSS,
    warning: {
      severity,
      weeksCapped,
      totalWeeks: weeklyTSS.length,
      ceiling,
      maxOriginal,
      ratio: ACWR_DANGER_ZONE_RATIO,
      detail: {
        en: `Plan capped at ACWR danger-zone ceiling (${ceiling} TSS/week, 1.5× weekly-CTL). ${weeksCapped}/${weeklyTSS.length} weeks reduced from peak ${maxOriginal}. Gabbett 2016: ACWR > 1.5 raises injury risk sharply.`,
        tr: `Plan, ACWR tehlike-bölgesi tavanına (${ceiling} TSS/hafta, haftalık-CTL'nin 1.5 katı) sınırlandırıldı. ${weeksCapped}/${weeklyTSS.length} hafta zirveden (${maxOriginal}) azaltıldı. Gabbett 2016: ACWR > 1.5 yaralanma riskini keskin biçimde artırır.`,
      },
    },
  }
}

function buildWeeklyTSS(phasesArr, currentCTL) {
  const baseLow  = currentCTL * 7
  const baseHigh = currentCTL * 8.5
  const buildPk  = currentCTL * 9.5
  const peakHigh = currentCTL * 9.5
  const taperW1  = currentCTL * 6
  const taperW2  = currentCTL * 4
  const raceWk   = currentCTL * 2.5

  const tss = []
  let weekIdx = 0

  for (const ph of phasesArr) {
    const len = ph.weeks.length
    for (let i = 0; i < len; i++) {
      let target
      if (ph.phase === 'Base') {
        target = len > 1 ? baseLow + (baseHigh - baseLow) * (i / (len - 1)) : baseHigh
      } else if (ph.phase === 'Build') {
        target = len > 1 ? baseHigh + (buildPk - baseHigh) * (i / (len - 1)) : buildPk
      } else if (ph.phase === 'Peak') {
        target = peakHigh
      } else { // Taper
        if (i === len - 1) target = raceWk
        else if (i === len - 2 && len >= 2) target = taperW2
        else target = taperW1
      }

      // 3:1 deload — every 4th week of phasesArr position drops to 60% of build target
      const isDeloadCandidate = ph.phase === 'Base' || ph.phase === 'Build'
      if (isDeloadCandidate && (weekIdx + 1) % 4 === 0) {
        target = buildPk * 0.6
      }

      tss.push(Math.round(Math.max(0, target)))
      weekIdx++
    }
  }
  return tss
}

// ── Sample week templates ───────────────────────────────────────────────────
/** @public */
export function fmtPaceStr(secPerKm) {
  if (!secPerKm || secPerKm <= 0) return null
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

/** @public */
export function fmtSwimPace(secPer100) {
  if (!secPer100 || secPer100 <= 0) return null
  const m = Math.floor(secPer100 / 60)
  const s = Math.round(secPer100 % 60)
  return `${m}:${String(s).padStart(2, '0')}/100m`
}

// v9.24.0 — Weave strength sessions into sample-week days as an optional
// `strength` field on existing entries (NOT new array entries — the array is
// indexed positionally Mon=0..Sun=6 by getTodayProgrammedSession). Picks the
// hardest endurance days for stacking (Beattie 2014 / Rønnestad 2014: same-day
// stacking with 6-8h gap consolidates hard load and protects recovery days).
// Frequency per phase mirrors eliteProgramStrength.js (Base/Build 2x, Peak/Taper 1x).
const STRENGTH_FREQ_BY_PHASE = { Base: 2, Build: 2, Peak: 1, Taper: 1 }
const STRENGTH_DUR_BY_PHASE  = { Base: 60, Build: 50, Peak: 35, Taper: 25 }
const STRENGTH_INTENT_BY_PHASE = {
  Base:  { en: 'Strength — heavy lifts + plyo (PM, 6h+ after AM)', tr: 'Kuvvet — ağır kaldırış + plyo (PM, AM sonrası 6+ saat)' },
  Build: { en: 'Strength — power conversion + plyo (PM)',           tr: 'Kuvvet — güç dönüşümü + plyo (PM)' },
  Peak:  { en: 'Strength — maintenance dose (PM)',                  tr: 'Kuvvet — koruma dozu (PM)' },
  Taper: { en: 'Strength — neural priming (low fatigue)',           tr: 'Kuvvet — nöral hazırlık (düşük yorgunluk)' },
}

function hardLoad(d) {
  const z = d?.zones || {}
  return (z.Z4 || 0) + (z.Z5 || 0)
}

function weaveStrengthIntoSampleWeek(weekDays, phase) {
  if (!Array.isArray(weekDays) || weekDays.length === 0) return weekDays
  const freq = STRENGTH_FREQ_BY_PHASE[phase] || 0
  if (freq === 0) return weekDays

  // Rank candidate days: skip rest, prefer hardest. Stable secondary sort by
  // original index so Tue beats Thu when both have the same Z4+Z5 minutes
  // (keeps the canonical Tue+Thu Beattie pattern).
  const candidates = weekDays
    .map((d, idx) => ({ idx, day: d.day, isRest: (d.durationMin || 0) === 0, hard: hardLoad(d) }))
    .filter(c => !c.isRest)
    .sort((a, b) => b.hard - a.hard || a.idx - b.idx)

  // If insufficient hard days, top up with first-available aerobic days.
  const picked = candidates.slice(0, freq).map(c => c.idx)

  const intent = STRENGTH_INTENT_BY_PHASE[phase]
  const durationMin = STRENGTH_DUR_BY_PHASE[phase]

  return weekDays.map((d, i) => {
    if (!picked.includes(i)) return { ...d, strength: null }
    return {
      ...d,
      strength: { intent, durationMin },
    }
  })
}

function runSampleWeek(phase, paces, trainingDays) {
  const days = Math.max(3, Math.min(7, trainingDays || 5))
  const long = Math.min(120, 60 + Math.floor(days * 6))
  const easy = 45
  const tempo = 50
  const interval = 55

  // v9.53.0 — Cadence targets per intensity band. Daniels 2014 (Running
  // Formula 3rd ed.) anchors elite cadence at ~180 spm at any pace; faster
  // paces drift slightly higher (Mercer 2003 found injury-rate reduction at
  // ≥175 spm). Recreational runners often hit 160-170 at easy pace — this
  // band gives them a corrective target without overprescribing.
  const CAD = {
    easy: '170-178 spm',  // Z1 — most cadence-leakage risk for novices
    tempo:'175-183 spm',  // Z2/Z3 marathon/tempo
    thr:  '178-185 spm',  // Z4 threshold
    intr: '180-190 spm',  // Z5 VO2max / race-pace
  }

  const weekByPhase = {
    Base: [
      { day: 'Mon', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null,                     cadenceTarget: null },
      { day: 'Tue', intent: { en: 'Easy run',     tr: 'Kolay koşu' },       durationMin: easy,     zones: { Z1: easy, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: fmtPaceStr(paces?.E),     cadenceTarget: CAD.easy },
      { day: 'Wed', intent: { en: 'Easy + strides', tr: 'Kolay + adımlar' },durationMin: easy,     zones: { Z1: easy - 5, Z2: 0, Z3: 0, Z4: 0, Z5: 5 },    paceTarget: fmtPaceStr(paces?.E),     cadenceTarget: CAD.easy },
      // v9.37.0 — Base polarization fix per coaching audit. Pre-fix had
      // 25min Z3 tempo, pushing Run Base weekly Z3+ to 10.7% (Seiler 2010
      // 80/20 ceiling for Base = ≤5%). Daniels 2014 (Running Formula 3rd
      // ed.) is explicit: true Base has NO tempo; only easy mileage, long
      // run, and short strides. Tempo enters in Build. Replaced with M-pace
      // progression (Z2) — keeps marathon-specific aerobic stimulus without
      // breaking 80/20. Result: Run Base Z3+ = 1.8% (strides only).
      { day: 'Thu', intent: { en: 'Aerobic + M-pace finish', tr: 'Aerobik + M-tempo bitiş' }, durationMin: tempo, zones: { Z1: 30, Z2: 20, Z3: 0, Z4: 0, Z5: 0 }, paceTarget: fmtPaceStr(paces?.M), cadenceTarget: CAD.tempo },
      { day: 'Fri', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null,                     cadenceTarget: null },
      { day: 'Sat', intent: { en: 'Easy run',     tr: 'Kolay koşu' },       durationMin: easy + 5, zones: { Z1: easy + 5, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: fmtPaceStr(paces?.E),     cadenceTarget: CAD.easy },
      { day: 'Sun', intent: { en: 'Long run',     tr: 'Uzun koşu' },        durationMin: long,     zones: { Z1: long - 10, Z2: 10, Z3: 0, Z4: 0, Z5: 0 },  paceTarget: fmtPaceStr(paces?.E),     cadenceTarget: CAD.easy },
    ],
    Build: [
      { day: 'Mon', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null,                     cadenceTarget: null },
      { day: 'Tue', intent: { en: 'Threshold 2x20', tr: 'Eşik 2x20' },      durationMin: tempo + 10, zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 40, Z5: 0 },        paceTarget: fmtPaceStr(paces?.T),     cadenceTarget: CAD.thr },
      { day: 'Wed', intent: { en: 'Easy run',     tr: 'Kolay koşu' },       durationMin: easy,     zones: { Z1: easy, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: fmtPaceStr(paces?.E),     cadenceTarget: CAD.easy },
      // v9.10.2: Build week polarization fix — was 'Cruise intervals' (Z4),
      // creating Tue+Thu Z4 doubling = ~35% high-intensity. Coach review
      // (Seiler 80/20) flagged: spread stimuli, keep Tue threshold, move Thu
      // to VO2max (Z5). Now ~25% hard, properly polarized.
      { day: 'Thu', intent: { en: 'VO2max 5x3', tr: 'VO2max 5x3' }, durationMin: 55, zones: { Z1: 25, Z2: 0, Z3: 0, Z4: 0, Z5: 30 },         paceTarget: fmtPaceStr(paces?.I),                                    cadenceTarget: CAD.intr },
      { day: 'Fri', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null,                     cadenceTarget: null },
      { day: 'Sat', intent: { en: 'Easy + strides', tr: 'Kolay + adımlar' },durationMin: easy,     zones: { Z1: easy - 5, Z2: 0, Z3: 0, Z4: 0, Z5: 5 },    paceTarget: fmtPaceStr(paces?.E),     cadenceTarget: CAD.easy },
      { day: 'Sun', intent: { en: 'Long run + MP', tr: 'Uzun koşu + MP' },  durationMin: long + 10, zones: { Z1: long - 10, Z2: 20, Z3: 0, Z4: 0, Z5: 0 },  paceTarget: fmtPaceStr(paces?.M),     cadenceTarget: CAD.tempo },
    ],
    // v9.20.0 — Run Peak polarization fix per audit. Sun "Tempo + strides"
    // (Z3:25 + Z5:5 = 30 hard min) pushed weekly hard ratio to 28% (Seiler
    // 2010 80/20 ceiling = ~20-25%). Replaced with long easy run (75min Z1)
    // — restores ~22% hard ratio + adds the long-run base mileage that
    // peak phase shouldn't drop entirely (Daniels 2014).
    Peak: [
      { day: 'Mon', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null,                     cadenceTarget: null },
      { day: 'Tue', intent: { en: 'VO2max 6x800m', tr: 'VO2max 6x800m' },   durationMin: interval, zones: { Z1: 25, Z2: 0, Z3: 0, Z4: 0, Z5: 30 },         paceTarget: fmtPaceStr(paces?.I),     cadenceTarget: CAD.intr },
      { day: 'Wed', intent: { en: 'Easy run',     tr: 'Kolay koşu' },       durationMin: easy,     zones: { Z1: easy, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: fmtPaceStr(paces?.E),     cadenceTarget: CAD.easy },
      { day: 'Thu', intent: { en: 'Race-pace 5x1k', tr: 'Yarış-tempo 5x1k' }, durationMin: interval, zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 0, Z5: 35 },        paceTarget: fmtPaceStr(paces?.I),     cadenceTarget: CAD.intr },
      { day: 'Fri', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null,                     cadenceTarget: null },
      { day: 'Sat', intent: { en: 'Easy + strides', tr: 'Kolay + adımlar' },durationMin: easy,     zones: { Z1: easy - 5, Z2: 0, Z3: 0, Z4: 0, Z5: 5 },    paceTarget: fmtPaceStr(paces?.E),     cadenceTarget: CAD.easy },
      { day: 'Sun', intent: { en: 'Long easy run', tr: 'Uzun kolay koşu' }, durationMin: 75,       zones: { Z1: 65, Z2: 10, Z3: 0, Z4: 0, Z5: 0 },         paceTarget: fmtPaceStr(paces?.E),     cadenceTarget: CAD.easy },
    ],
    Taper: [
      { day: 'Mon', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null,                     cadenceTarget: null },
      { day: 'Tue', intent: { en: 'Race-pace 4x400m', tr: 'Yarış-tempo 4x400m' }, durationMin: 35, zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 0, Z5: 15 },         paceTarget: fmtPaceStr(paces?.I),     cadenceTarget: CAD.intr },
      { day: 'Wed', intent: { en: 'Easy run',     tr: 'Kolay koşu' },       durationMin: 30,       zones: { Z1: 30, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },          paceTarget: fmtPaceStr(paces?.E),     cadenceTarget: CAD.easy },
      { day: 'Thu', intent: { en: 'Easy + strides', tr: 'Kolay + adımlar' },durationMin: 30,       zones: { Z1: 25, Z2: 0, Z3: 0, Z4: 0, Z5: 5 },          paceTarget: fmtPaceStr(paces?.E),     cadenceTarget: CAD.easy },
      { day: 'Fri', intent: { en: 'Rest',         tr: 'Dinlenme' },         durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null,                     cadenceTarget: null },
      { day: 'Sat', intent: { en: 'Pre-race shakeout', tr: 'Yarış öncesi açılış' }, durationMin: 20, zones: { Z1: 18, Z2: 0, Z3: 0, Z4: 0, Z5: 2 },         paceTarget: fmtPaceStr(paces?.E),     cadenceTarget: CAD.easy },
      { day: 'Sun', intent: { en: 'Race day',     tr: 'Yarış günü' },       durationMin: 0,        zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },           paceTarget: null,                     cadenceTarget: null },
    ],
  }
  const wk = weekByPhase[phase]
  if (!wk) return []
  return wk.slice(0, days < 7 ? Math.max(5, days + 2) : 7).map(d => ({
    ...d,
    notes: { en: `${phase} phase ${d.intent.en.toLowerCase()}`, tr: `${phase} fazı ${d.intent.tr.toLowerCase()}` },
  }))
}

function bikeSampleWeek(phase, zones) {
  // zones is array from getCyclingZones(ftp)
  const ftp = zones && zones.length ? Math.round((zones[3]?.minWatts + zones[3]?.maxWatts) / 2 / 0.975) : null
  const tag = ftp ? `${ftp}W FTP` : null
  // v9.53.0 — Cadence (rpm) targets per zone. Coggan & Allen 2010 (Training
  // and Racing with a Power Meter, 2nd ed., Ch. 7) + Lucia 2002 (cycling
  // economy at high cadence). Pros pedal 90-100 rpm self-selected; sweet-
  // spot 85-95; threshold 85-95 (slight drop under load); VO2max intervals
  // 95-110 (Lucia: high cadence reduces force-per-stroke, lengthens TTE).
  const RPM = {
    easy:  '85-95 rpm',
    end:   '85-95 rpm',
    ss:    '88-95 rpm',
    thr:   '85-95 rpm',
    vo2:   '95-105 rpm',
  }
  const baseDays = {
    Base: [
      { day: 'Mon', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null,                rpmTarget: null },
      { day: 'Tue', intent: { en: 'Endurance ride', tr: 'Dayanıklılık sürüşü' }, durationMin: 75,  zones: { Z1: 15, Z2: 60, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: tag,                 rpmTarget: RPM.end },
      { day: 'Wed', intent: { en: 'Recovery spin',  tr: 'Toparlanma' },         durationMin: 45,  zones: { Z1: 45, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },      paceTarget: tag,                 rpmTarget: RPM.easy },
      // v9.37.0 — Base polarization fix per coaching audit. Pre-fix had
      // 30min Z3 sweet-spot, pushing Bike Base weekly Z3+ to 8.6% (Seiler
      // 2010 ceiling = ≤5%). Coggan's Base I-III protocol is high-volume
      // Z2 endurance with cadence work — sweet-spot belongs to Build.
      // Replaced with endurance + cadence drills. Result: Bike Base Z3+ =
      // 2.2% (Sat long-ride aerobic top-end only).
      { day: 'Thu', intent: { en: 'Endurance + cadence drills', tr: 'Dayanıklılık + kadans' }, durationMin: 75, zones: { Z1: 25, Z2: 50, Z3: 0, Z4: 0, Z5: 0 }, paceTarget: tag, rpmTarget: '70-110 rpm drills' },
      { day: 'Fri', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null,                rpmTarget: null },
      { day: 'Sat', intent: { en: 'Long ride',      tr: 'Uzun sürüş' },        durationMin: 180, zones: { Z1: 30, Z2: 140, Z3: 10, Z4: 0, Z5: 0 },   paceTarget: tag,                 rpmTarget: RPM.end },
      { day: 'Sun', intent: { en: 'Endurance',      tr: 'Dayanıklılık' },      durationMin: 90,  zones: { Z1: 20, Z2: 70, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: tag,                 rpmTarget: RPM.end },
    ],
    Build: [
      { day: 'Mon', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null,                rpmTarget: null },
      { day: 'Tue', intent: { en: 'Threshold 3x12', tr: 'Eşik 3x12' },         durationMin: 80,  zones: { Z1: 25, Z2: 15, Z3: 0, Z4: 40, Z5: 0 },    paceTarget: tag,                 rpmTarget: RPM.thr },
      { day: 'Wed', intent: { en: 'Endurance',      tr: 'Dayanıklılık' },      durationMin: 75,  zones: { Z1: 15, Z2: 60, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: tag,                 rpmTarget: RPM.end },
      { day: 'Thu', intent: { en: 'Over-unders',    tr: 'Over-under' },        durationMin: 80,  zones: { Z1: 25, Z2: 5, Z3: 20, Z4: 30, Z5: 0 },    paceTarget: tag,                 rpmTarget: RPM.thr },
      { day: 'Fri', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null,                rpmTarget: null },
      { day: 'Sat', intent: { en: 'Long + tempo',   tr: 'Uzun + tempo' },      durationMin: 210, zones: { Z1: 30, Z2: 140, Z3: 40, Z4: 0, Z5: 0 },   paceTarget: tag,                 rpmTarget: RPM.ss },
      { day: 'Sun', intent: { en: 'Endurance',      tr: 'Dayanıklılık' },      durationMin: 90,  zones: { Z1: 15, Z2: 75, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: tag,                 rpmTarget: RPM.end },
    ],
    // v9.20.0 — Bike Peak audit fix. Pre-fix had Tue Z5:40 + Thu Z4:50/Z5:10
    // + Sat Z4:50 = 33% hard with Thu→Sat being a 48h Z4 double (Lambert
    // 1997 violation: no consecutive hard sessions at trained-athlete CTL).
    // Fix: Thu becomes sweet-spot (Z3 only), Sat keeps Z4 race-pace as the
    // single weekly threshold key. Result: ~22% hard, single Z4 day.
    Peak: [
      { day: 'Mon', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null,                rpmTarget: null },
      { day: 'Tue', intent: { en: 'VO2max 5x4',     tr: 'VO2max 5x4' },        durationMin: 70,  zones: { Z1: 25, Z2: 5, Z3: 0, Z4: 0, Z5: 40 },     paceTarget: tag,                 rpmTarget: RPM.vo2 },
      { day: 'Wed', intent: { en: 'Recovery spin',  tr: 'Toparlanma' },        durationMin: 45,  zones: { Z1: 45, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },      paceTarget: tag,                 rpmTarget: RPM.easy },
      { day: 'Thu', intent: { en: 'Sweet spot 2x20', tr: 'Sweet spot 2x20' }, durationMin: 70,  zones: { Z1: 25, Z2: 5, Z3: 40, Z4: 0, Z5: 0 },     paceTarget: tag,                 rpmTarget: RPM.ss },
      { day: 'Fri', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null,                rpmTarget: null },
      { day: 'Sat', intent: { en: 'Long with race-pace', tr: 'Uzun + yarış tempo' }, durationMin: 180, zones: { Z1: 30, Z2: 100, Z3: 0, Z4: 50, Z5: 0 }, paceTarget: tag,            rpmTarget: RPM.thr },
      { day: 'Sun', intent: { en: 'Endurance',      tr: 'Dayanıklılık' },      durationMin: 75,  zones: { Z1: 15, Z2: 60, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: tag,                 rpmTarget: RPM.end },
    ],
    Taper: [
      { day: 'Mon', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null,                rpmTarget: null },
      { day: 'Tue', intent: { en: 'Openers 4x3',    tr: 'Açılış 4x3' },        durationMin: 50,  zones: { Z1: 25, Z2: 5, Z3: 0, Z4: 15, Z5: 5 },     paceTarget: tag,                 rpmTarget: RPM.vo2 },
      { day: 'Wed', intent: { en: 'Easy spin',      tr: 'Kolay sürüş' },       durationMin: 40,  zones: { Z1: 40, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },      paceTarget: tag,                 rpmTarget: RPM.easy },
      { day: 'Thu', intent: { en: 'Short tempo',    tr: 'Kısa tempo' },        durationMin: 45,  zones: { Z1: 20, Z2: 5, Z3: 20, Z4: 0, Z5: 0 },     paceTarget: tag,                 rpmTarget: RPM.ss },
      { day: 'Fri', intent: { en: 'Rest',          tr: 'Dinlenme' },           durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null,                rpmTarget: null },
      { day: 'Sat', intent: { en: 'Pre-race shakeout', tr: 'Yarış öncesi' },   durationMin: 30,  zones: { Z1: 25, Z2: 0, Z3: 0, Z4: 0, Z5: 5 },      paceTarget: tag,                 rpmTarget: RPM.easy },
      { day: 'Sun', intent: { en: 'Race day',       tr: 'Yarış günü' },        durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },        paceTarget: null,                rpmTarget: null },
    ],
  }
  const wk = baseDays[phase]
  if (!wk) return []
  return wk.map(d => ({
    ...d,
    notes: { en: `${phase} phase ${d.intent.en.toLowerCase()}`, tr: `${phase} fazı ${d.intent.tr.toLowerCase()}` },
  }))
}

function swimSampleWeek(phase, cssSec) {
  const tag = fmtSwimPace(cssSec)
  const days = {
    Base: [
      { day: 'Mon', intent: { en: 'Rest',           tr: 'Dinlenme' },           durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Tue', intent: { en: 'Aerobic 2000m',   tr: 'Aerobik 2000m' },     durationMin: 50, zones: { Z1: 30, Z2: 20, Z3: 0, Z4: 0, Z5: 0 },   paceTarget: tag },
      { day: 'Wed', intent: { en: 'Technique 1500m', tr: 'Teknik 1500m' },      durationMin: 40, zones: { Z1: 40, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: tag },
      // v9.37.0 — Base polarization fix per coaching audit. Pre-fix had
      // 30min Z3 CSS, pushing Swim Base weekly Z3+ to 12.8% (Seiler 2010
      // ceiling = ≤5%). Olbrecht 2000 (Complete Conditioning for Swimming)
      // says true Base is EN1+EN2 dominant with minimal CSS. Reduced to
      // 4x100 CSS as a small CSS-feel maintenance dose, rest aerobic.
      // Result: Swim Base Z3+ = 4.3%, within Seiler band.
      { day: 'Thu', intent: { en: 'Aerobic + 4x100 CSS', tr: 'Aerobik + 4x100 CSS' }, durationMin: 45, zones: { Z1: 25, Z2: 10, Z3: 10, Z4: 0, Z5: 0 }, paceTarget: tag },
      { day: 'Fri', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Sat', intent: { en: 'Long aerobic 3000m', tr: 'Uzun aerobik 3000m' }, durationMin: 65, zones: { Z1: 35, Z2: 30, Z3: 0, Z4: 0, Z5: 0 }, paceTarget: tag },
      { day: 'Sun', intent: { en: 'Easy 1500m',      tr: 'Kolay 1500m' },        durationMin: 35, zones: { Z1: 35, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: tag },
    ],
    Build: [
      { day: 'Mon', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Tue', intent: { en: 'CSS 10x200',       tr: 'CSS 10x200' },        durationMin: 60, zones: { Z1: 15, Z2: 0, Z3: 0, Z4: 45, Z5: 0 },   paceTarget: tag },
      { day: 'Wed', intent: { en: 'Aerobic 2500m',   tr: 'Aerobik 2500m' },     durationMin: 55, zones: { Z1: 25, Z2: 30, Z3: 0, Z4: 0, Z5: 0 },   paceTarget: tag },
      { day: 'Thu', intent: { en: 'Threshold 5x300', tr: 'Eşik 5x300' },        durationMin: 60, zones: { Z1: 15, Z2: 0, Z3: 0, Z4: 45, Z5: 0 },   paceTarget: tag },
      { day: 'Fri', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Sat', intent: { en: 'Long aerobic 3500m', tr: 'Uzun aerobik 3500m' }, durationMin: 75, zones: { Z1: 35, Z2: 40, Z3: 0, Z4: 0, Z5: 0 }, paceTarget: tag },
      { day: 'Sun', intent: { en: 'Recovery 1500m',  tr: 'Toparlanma 1500m' },  durationMin: 35, zones: { Z1: 35, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: tag },
    ],
    // v9.20.0 — Swim Peak audit fix. Pre-fix Tue Z5:35 + Thu Z4:35/Z5:15 +
    // Sat Z4:15 = 38% hard (Stöggl 2014 cap ≈30%). Reduced Tue VO2 volume
    // and Thu race-pace volume; Wed recovery extended to active recovery
    // floor (Olbrecht 2000: 45min minimum for trained swimmers). Result:
    // ~28% hard, within polarization band.
    Peak: [
      { day: 'Mon', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Tue', intent: { en: 'VO2max 10x100',   tr: 'VO2max 10x100' },     durationMin: 50, zones: { Z1: 25, Z2: 0, Z3: 0, Z4: 0, Z5: 25 },   paceTarget: tag },
      { day: 'Wed', intent: { en: 'Active recovery 1800m', tr: 'Aktif toparlanma 1800m' }, durationMin: 45, zones: { Z1: 45, Z2: 0, Z3: 0, Z4: 0, Z5: 0 }, paceTarget: tag },
      { day: 'Thu', intent: { en: 'Race-pace 5x400', tr: 'Yarış-tempo 5x400' }, durationMin: 55, zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 25, Z5: 10 },  paceTarget: tag },
      { day: 'Fri', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Sat', intent: { en: 'Long with race-pace', tr: 'Uzun + yarış tempo' }, durationMin: 65, zones: { Z1: 25, Z2: 30, Z3: 0, Z4: 10, Z5: 0 }, paceTarget: tag },
      { day: 'Sun', intent: { en: 'Easy 1500m',      tr: 'Kolay 1500m' },        durationMin: 35, zones: { Z1: 35, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: tag },
    ],
    Taper: [
      { day: 'Mon', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Tue', intent: { en: 'Race-pace 4x200', tr: 'Yarış-tempo 4x200' }, durationMin: 35, zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 10, Z5: 5 },   paceTarget: tag },
      { day: 'Wed', intent: { en: 'Easy 1200m',      tr: 'Kolay 1200m' },        durationMin: 30, zones: { Z1: 30, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: tag },
      { day: 'Thu', intent: { en: 'Sharpener 8x50',  tr: 'Keskinleştirme 8x50' }, durationMin: 25, zones: { Z1: 18, Z2: 0, Z3: 0, Z4: 0, Z5: 7 },   paceTarget: tag },
      { day: 'Fri', intent: { en: 'Rest',            tr: 'Dinlenme' },          durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Sat', intent: { en: 'Pre-race feel',   tr: 'Yarış öncesi his' },  durationMin: 20, zones: { Z1: 18, Z2: 0, Z3: 0, Z4: 0, Z5: 2 },    paceTarget: tag },
      { day: 'Sun', intent: { en: 'Race day',        tr: 'Yarış günü' },         durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
    ],
  }
  const wk = days[phase]
  if (!wk) return []
  return wk.map(d => ({
    ...d,
    notes: { en: `${phase} phase ${d.intent.en.toLowerCase()}`, tr: `${phase} fazı ${d.intent.tr.toLowerCase()}` },
  }))
}

// ── Rowing sample week ──────────────────────────────────────────────────────
//
// v9.7.0. British Rowing 7-zone system mapped to the app's Z1-Z5 (UT2→Z1,
// UT1→Z2, AT→Z3, TR→Z4, 2k/AN/Sprint→Z5). Each phase reflects standard
// Concept2/British Rowing periodization (Paul 1969, Nolte 2005):
//   Base   — high UT2/UT1 volume, AT introduction
//   Build  — AT pieces become the spine, TR work appears
//   Peak   — race-pace (2k) and AN power, fewer long rows
//   Taper  — short race-pace + openers, neural priming

function rowingSampleWeek(phase, split500Sec) {
  const splitTag = split500Sec ? `${fmtSplit(split500Sec)}/500m` : null
  const utTag    = split500Sec ? `${fmtSplit(split500Sec * 1.15)}/500m` : null   // UT1/UT2 ~ +15% slower
  const atTag    = split500Sec ? `${fmtSplit(split500Sec * 1.08)}/500m` : null   // AT ~ +8% slower
  const trTag    = split500Sec ? `${fmtSplit(split500Sec * 1.03)}/500m` : null   // TR ~ +3% slower

  // v9.51.0 — SPM (stroke-rate) targets per zone, per Nolte 2005 "Rowing
  // Faster" + British Rowing Coaching Guidance 2018 + Steinacker 1993.
  // UT2 stays 18-20 across phases (Seiler 2010 polarized — low-intensity
  // SPM does not shift up across phases; Tran 2015 confirmed for elite
  // rowers). Sprint SPM intentionally NOT pinned — race-tactical, not
  // phase-prescribable (Kleshnev 2016).
  const SPM = {
    UT2: '18-20 spm',
    UT1: '20-24 spm',
    AT:  '24-28 spm',
    TR:  '28-32 spm',
    K2:  '32-36 spm',  // 2k race pace
    AN:  '36-40 spm',
  }

  const weekByPhase = {
    Base: [
      { day: 'Mon', intent: { en: 'Rest',                      tr: 'Dinlenme' },                      durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null,    spmTarget: null },
      { day: 'Tue', intent: { en: 'UT2 steady 60min',          tr: 'UT2 sabit 60dk' },                durationMin: 60, zones: { Z1: 60, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: utTag,   spmTarget: SPM.UT2 },
      { day: 'Wed', intent: { en: 'UT1 moderate 50min',        tr: 'UT1 orta 50dk' },                 durationMin: 50, zones: { Z1: 5, Z2: 45, Z3: 0, Z4: 0, Z5: 0 },   paceTarget: utTag,   spmTarget: SPM.UT1 },
      // v9.37.0 — Base polarization fix per coaching audit. Pre-fix had
      // 40min AT (Z3) at 4x2000m, pushing Rowing Base weekly Z3+ to 13.8%
      // (Seiler 2010 ceiling = ≤5%). Nolte 2005 (Rowing Faster) Base
      // distribution is UT2:UT1:AT:TR = 70:25:5:0 → AT should be ~5% of
      // weekly volume in Base. Reduced to 2x10min AT pieces with UT1 ramp.
      // Result: Rowing Base Z3+ = 3.4%, within Nolte/Seiler band.
      { day: 'Thu', intent: { en: 'UT1 + 2x10min AT',          tr: 'UT1 + 2x10dk AT' },               durationMin: 60, zones: { Z1: 30, Z2: 20, Z3: 10, Z4: 0, Z5: 0 },   paceTarget: atTag,   spmTarget: SPM.AT },
      { day: 'Fri', intent: { en: 'Rest',                      tr: 'Dinlenme' },                      durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null,    spmTarget: null },
      { day: 'Sat', intent: { en: 'UT2 long row 75min',        tr: 'UT2 uzun 75dk' },                 durationMin: 75, zones: { Z1: 75, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: utTag,   spmTarget: SPM.UT2 },
      { day: 'Sun', intent: { en: 'Cross-train (run/bike) 45min', tr: 'Çapraz antrenman 45dk' },     durationMin: 45, zones: { Z1: 45, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: null,    spmTarget: null },
    ],
    // v9.20.0 — Rowing Build audit fix. Pre-fix UT1 (Z2) was only 18% of
    // weekly volume vs Nolte 2005 30% target ("UT1 base-building stimulus
    // under-indexed"). TR (Z4) was 14% vs 5% target. Increased Wed UT1
    // 60→90min, reduced Thu TR 6→5 reps (60→50min), restoring proper
    // UT2:UT1:AT:TR = 50:30:15:5 distribution. Sun cross-train clarified
    // as run/ski (rowers benefit from antagonist muscle work, not cycling
    // — Nolte 2005).
    Build: [
      { day: 'Mon', intent: { en: 'Rest',                      tr: 'Dinlenme' },                      durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null,    spmTarget: null },
      { day: 'Tue', intent: { en: 'AT threshold 4x2000m',      tr: 'AT eşik 4x2000m' },               durationMin: 65, zones: { Z1: 20, Z2: 0, Z3: 45, Z4: 0, Z5: 0 },   paceTarget: atTag,   spmTarget: SPM.AT },
      { day: 'Wed', intent: { en: 'UT1 steady 90min',          tr: 'UT1 sabit 90dk' },                durationMin: 90, zones: { Z1: 10, Z2: 80, Z3: 0, Z4: 0, Z5: 0 },   paceTarget: utTag,   spmTarget: SPM.UT1 },
      { day: 'Thu', intent: { en: 'TR pieces 5x1000m',         tr: 'TR parçalar 5x1000m' },           durationMin: 50, zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 30, Z5: 0 },   paceTarget: trTag,   spmTarget: SPM.TR },
      { day: 'Fri', intent: { en: 'Rest',                      tr: 'Dinlenme' },                      durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null,    spmTarget: null },
      { day: 'Sat', intent: { en: 'UT2 long row 90min',        tr: 'UT2 uzun 90dk' },                 durationMin: 90, zones: { Z1: 90, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: utTag,   spmTarget: SPM.UT2 },
      { day: 'Sun', intent: { en: 'Cross-train (run/ski) + strength', tr: 'Çapraz (koşu/ski) + kuvvet' }, durationMin: 50, zones: { Z1: 50, Z2: 0, Z3: 0, Z4: 0, Z5: 0 }, paceTarget: null,    spmTarget: null },
    ],
    Peak: [
      { day: 'Mon', intent: { en: 'Rest',                      tr: 'Dinlenme' },                      durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null,    spmTarget: null },
      { day: 'Tue', intent: { en: '2k pace 8x500m',            tr: 'Yarış-tempo 8x500m' },            durationMin: 55, zones: { Z1: 25, Z2: 0, Z3: 0, Z4: 0, Z5: 30 },   paceTarget: splitTag, spmTarget: SPM.K2 },
      { day: 'Wed', intent: { en: 'UT1 recovery 45min',        tr: 'UT1 toparlanma 45dk' },           durationMin: 45, zones: { Z1: 15, Z2: 30, Z3: 0, Z4: 0, Z5: 0 },   paceTarget: utTag,   spmTarget: SPM.UT1 },
      { day: 'Thu', intent: { en: 'TR race-pace 6x1000m',      tr: 'TR yarış-tempo 6x1000m' },        durationMin: 60, zones: { Z1: 15, Z2: 0, Z3: 0, Z4: 35, Z5: 10 },  paceTarget: trTag,   spmTarget: SPM.TR },
      { day: 'Fri', intent: { en: 'Rest',                      tr: 'Dinlenme' },                      durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null,    spmTarget: null },
      { day: 'Sat', intent: { en: 'AN power 10x250m',          tr: 'AN güç 10x250m' },                durationMin: 50, zones: { Z1: 25, Z2: 0, Z3: 0, Z4: 0, Z5: 25 },   paceTarget: splitTag, spmTarget: SPM.AN },
      { day: 'Sun', intent: { en: 'UT2 maintenance 60min',     tr: 'UT2 koruma 60dk' },               durationMin: 60, zones: { Z1: 60, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: utTag,   spmTarget: SPM.UT2 },
    ],
    Taper: [
      { day: 'Mon', intent: { en: 'Rest',                      tr: 'Dinlenme' },                      durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null,    spmTarget: null },
      { day: 'Tue', intent: { en: 'Race-pace openers 4x500m',  tr: 'Yarış-tempo açılış 4x500m' },     durationMin: 35, zones: { Z1: 18, Z2: 0, Z3: 0, Z4: 5, Z5: 12 },   paceTarget: splitTag, spmTarget: SPM.K2 },
      { day: 'Wed', intent: { en: 'UT2 easy 30min',            tr: 'UT2 kolay 30dk' },                durationMin: 30, zones: { Z1: 30, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: utTag,   spmTarget: SPM.UT2 },
      { day: 'Thu', intent: { en: 'Sharpener 8x250m',          tr: 'Keskinleştirme 8x250m' },         durationMin: 25, zones: { Z1: 18, Z2: 0, Z3: 0, Z4: 0, Z5: 7 },    paceTarget: splitTag, spmTarget: SPM.K2 },
      { day: 'Fri', intent: { en: 'Rest',                      tr: 'Dinlenme' },                      durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null,    spmTarget: null },
      { day: 'Sat', intent: { en: 'Pre-race shakeout 20min',   tr: 'Yarış öncesi açılış 20dk' },      durationMin: 20, zones: { Z1: 18, Z2: 0, Z3: 0, Z4: 0, Z5: 2 },    paceTarget: utTag,   spmTarget: SPM.UT2 },
      { day: 'Sun', intent: { en: 'Race day',                  tr: 'Yarış günü' },                    durationMin: 0,  zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null,    spmTarget: null },
    ],
  }
  const wk = weekByPhase[phase]
  if (!wk) return []
  return wk.map(d => ({
    ...d,
    notes: { en: `${phase} phase ${d.intent.en.toLowerCase()}`, tr: `${phase} fazı ${d.intent.tr.toLowerCase()}` },
  }))
}

// ── Triathlon multi-discipline sample week ──────────────────────────────────
//
// v9.6.0. Triathlon is a 3-discipline sport: swim, bike, run. A weekly
// schedule must spread sessions across all three with brick (bike→run)
// transitions in race-specific phases. Each session is tagged with
// `discipline` so the calendar / quick-log can route it correctly.
//
// Day distribution (Mujika & Padilla 2003; Olbrecht 2000):
//   Mon: rest
//   Tue: swim key
//   Wed: bike key (+ optional brick from Build onwards)
//   Thu: run key
//   Fri: rest or recovery swim
//   Sat: long bike (Base) → brick (Peak/Taper)
//   Sun: long run (Base/Build) → swim race-pace (Peak) → race day (Taper)

function triSampleWeek(phase, paces, _ftp, cssSec) {
  const swimTag = fmtSwimPace(cssSec)
  const easyTag = fmtPaceStr(paces?.E)
  const tTag = fmtPaceStr(paces?.T)
  const iTag = fmtPaceStr(paces?.I)
  const mTag = fmtPaceStr(paces?.M)

  const weekByPhase = {
    Base: [
      { day: 'Mon', discipline: 'rest', intent: { en: 'Rest',                   tr: 'Dinlenme' },                    durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Tue', discipline: 'swim', intent: { en: 'Swim aerobic 2000m',     tr: 'Yüzme aerobik 2000m' },         durationMin: 50,  zones: { Z1: 30, Z2: 20, Z3: 0, Z4: 0, Z5: 0 },   paceTarget: swimTag },
      { day: 'Wed', discipline: 'bike', intent: { en: 'Bike endurance',         tr: 'Bisiklet dayanıklılık' },       durationMin: 75,  zones: { Z1: 15, Z2: 60, Z3: 0, Z4: 0, Z5: 0 },   paceTarget: null },
      { day: 'Thu', discipline: 'run',  intent: { en: 'Run easy + strides',     tr: 'Kolay koşu + adımlar' },        durationMin: 45,  zones: { Z1: 40, Z2: 0, Z3: 0, Z4: 0, Z5: 5 },    paceTarget: easyTag },
      { day: 'Fri', discipline: 'swim', intent: { en: 'Swim technique 1500m',   tr: 'Yüzme teknik 1500m' },          durationMin: 40,  zones: { Z1: 40, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: swimTag },
      { day: 'Sat', discipline: 'bike', intent: { en: 'Long bike',              tr: 'Uzun bisiklet' },               durationMin: 180, zones: { Z1: 30, Z2: 140, Z3: 10, Z4: 0, Z5: 0 }, paceTarget: null },
      { day: 'Sun', discipline: 'run',  intent: { en: 'Long run',               tr: 'Uzun koşu' },                   durationMin: 90,  zones: { Z1: 80, Z2: 10, Z3: 0, Z4: 0, Z5: 0 },   paceTarget: easyTag },
    ],
    // v9.20.0 — Tri Build audit fix. Pre-fix had Tue swim Z4:45 + Wed bike
    // Z4:50 + Thu run Z4:40 = 3 consecutive hard days (Lambert 1997 violation:
    // trained athletes need ≥1 easy day between Z4+ sessions). Wed converted
    // to endurance bike (no Z4) so the week now has 2 hard days (Tue swim,
    // Thu run) with Wed bridge + Sat long ride as the long endurance key.
    Build: [
      { day: 'Mon', discipline: 'rest', intent: { en: 'Rest',                   tr: 'Dinlenme' },                    durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Tue', discipline: 'swim', intent: { en: 'Swim CSS 10x200',        tr: 'Yüzme CSS 10x200' },            durationMin: 60,  zones: { Z1: 15, Z2: 0, Z3: 0, Z4: 45, Z5: 0 },   paceTarget: swimTag },
      { day: 'Wed', discipline: 'bike', intent: { en: 'Bike endurance + brick run', tr: 'Bisiklet dayanıklılık + brick koşu' }, durationMin: 95, zones: { Z1: 30, Z2: 65, Z3: 0, Z4: 0, Z5: 0 }, paceTarget: null },
      { day: 'Thu', discipline: 'run',  intent: { en: 'Run threshold 2x20',     tr: 'Koşu eşik 2x20' },              durationMin: 60,  zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 40, Z5: 0 },   paceTarget: tTag },
      { day: 'Fri', discipline: 'swim', intent: { en: 'Swim aerobic 2500m',     tr: 'Yüzme aerobik 2500m' },         durationMin: 55,  zones: { Z1: 25, Z2: 30, Z3: 0, Z4: 0, Z5: 0 },   paceTarget: swimTag },
      // v9.27.0 — Tri Build bike-quality fix. Sat was "Long bike + tempo"
      // (Z3:40 generic) — bike got NO structured key session in the entire
      // Build week despite being the longest segment of any tri. Replaced
      // with structured sweet-spot 3x15 @88-94% FTP (Coggan & Allen 2019)
      // embedded in long endurance ride. Total time unchanged (210 min);
      // intent now drives true FTP gain. Polarization: weekly Z4 climbs
      // from 85→100 min (≈17.2% — still under Seiler 80/20 ceiling).
      { day: 'Sat', discipline: 'bike', intent: { en: 'Long bike + sweet-spot 3x15',  tr: 'Uzun bisiklet + sweet-spot 3x15' }, durationMin: 210, zones: { Z1: 30, Z2: 135, Z3: 30, Z4: 15, Z5: 0 }, paceTarget: null },
      { day: 'Sun', discipline: 'run',  intent: { en: 'Long run + MP',          tr: 'Uzun koşu + MP' },              durationMin: 100, zones: { Z1: 80, Z2: 20, Z3: 0, Z4: 0, Z5: 0 },   paceTarget: mTag },
    ],
    // v9.20.0 — Tri Peak audit fix. Pre-fix had 6-day work block with only
    // Fri rest (Tue VO2 + Wed VO2+brick + Thu race-pace + Sat brick + Sun
    // race-pace = 34% hard density). Mujika 2003 says taper-approach should
    // be intensity-preserved + volume-reduced, not compacted. Wed converted
    // from Z5 VO2 brick to Z2 endurance + brick run (still race-specific
    // but no Z5 stress). Sun converted to easy swim (Z1) for legs to drain
    // before race-week. Result: 3 hard days (Tue/Thu/Sat) properly spaced.
    Peak: [
      { day: 'Mon', discipline: 'rest', intent: { en: 'Rest',                   tr: 'Dinlenme' },                    durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Tue', discipline: 'swim', intent: { en: 'Swim VO2max 12x100',     tr: 'Yüzme VO2max 12x100' },         durationMin: 55,  zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 0, Z5: 35 },   paceTarget: swimTag },
      { day: 'Wed', discipline: 'bike', intent: { en: 'Bike endurance + brick run', tr: 'Bisiklet dayanıklılık + brick koşu' }, durationMin: 90, zones: { Z1: 30, Z2: 60, Z3: 0, Z4: 0, Z5: 0 }, paceTarget: null },
      { day: 'Thu', discipline: 'run',  intent: { en: 'Run race-pace 5x1k',     tr: 'Koşu yarış-tempo 5x1k' },       durationMin: 55,  zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 0, Z5: 35 },   paceTarget: iTag },
      { day: 'Fri', discipline: 'swim', intent: { en: 'Swim recovery 1500m',    tr: 'Yüzme toparlanma 1500m' },      durationMin: 35,  zones: { Z1: 35, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: swimTag },
      { day: 'Sat', discipline: 'bike', intent: { en: 'Race-pace brick (90+30)', tr: 'Yarış-tempo brick (90+30)' },  durationMin: 120, zones: { Z1: 30, Z2: 0, Z3: 0, Z4: 80, Z5: 10 }, paceTarget: null },
      { day: 'Sun', discipline: 'swim', intent: { en: 'Swim easy 1500m',        tr: 'Yüzme kolay 1500m' },           durationMin: 35,  zones: { Z1: 35, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },    paceTarget: swimTag },
    ],
    Taper: [
      { day: 'Mon', discipline: 'rest', intent: { en: 'Rest',                   tr: 'Dinlenme' },                    durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Tue', discipline: 'bike', intent: { en: 'Bike openers 4x3 + brick', tr: 'Bisiklet açılış 4x3 + brick' }, durationMin: 50, zones: { Z1: 25, Z2: 5, Z3: 0, Z4: 15, Z5: 5 },  paceTarget: null },
      { day: 'Wed', discipline: 'swim', intent: { en: 'Swim race-pace 4x200',   tr: 'Yüzme yarış-tempo 4x200' },     durationMin: 35,  zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 10, Z5: 5 },   paceTarget: swimTag },
      { day: 'Thu', discipline: 'run',  intent: { en: 'Run race-pace 4x400m',   tr: 'Koşu yarış-tempo 4x400m' },     durationMin: 35,  zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 0, Z5: 15 },   paceTarget: iTag },
      { day: 'Fri', discipline: 'rest', intent: { en: 'Rest',                   tr: 'Dinlenme' },                    durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
      { day: 'Sat', discipline: 'bike', intent: { en: 'Pre-race shakeout (bike+run+swim feel)', tr: 'Yarış öncesi açılış' }, durationMin: 30, zones: { Z1: 25, Z2: 0, Z3: 0, Z4: 0, Z5: 5 }, paceTarget: null },
      { day: 'Sun', discipline: 'run',  intent: { en: 'Race day',               tr: 'Yarış günü' },                  durationMin: 0,   zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },     paceTarget: null },
    ],
  }
  const wk = weekByPhase[phase]
  if (!wk) return []
  return wk.map(d => ({
    ...d,
    notes: { en: `${phase} phase ${d.intent.en.toLowerCase()}`, tr: `${phase} fazı ${d.intent.tr.toLowerCase()}` },
  }))
}

// ── Main orchestrator ───────────────────────────────────────────────────────
/**
 * @public
 * @param {Object} input
 * @returns {EliteProgramResult|null}
 */
export function buildEliteProgram(input) {
  if (!input || typeof input !== 'object') return null
  const { currentPR } = input
  let sport = input.sport
  let { targetPR, raceDate } = input
  const profile = input.profile || {}
  const options = input.options || {}
  const weeksOverrideRaw = input.weeksOverride
  const noTarget = !!input.noTarget

  // v8.96.0 — current PR is always required (the floor)
  if (!currentPR || !sport) return null

  // v9.76.0 — normalize sport vocabulary at the boundary. Three vocabularies
  // coexist in the codebase: capitalized ('Running' from Onboarding),
  // full-lowercase ('running' in some lib files), and the 3-letter internal
  // form ('run' used here). Map all into the internal form so any caller works.
  const SPORT_NORM = {
    running:'run', run:'run',
    cycling:'bike', bike:'bike', cycle:'bike',
    swimming:'swim', swim:'swim',
    triathlon:'triathlon', tri:'triathlon',
    rowing:'rowing', row:'rowing',
  }
  sport = SPORT_NORM[String(sport).toLowerCase()] || sport
  if (!['run', 'bike', 'swim', 'triathlon', 'rowing'].includes(sport)) return null

  // v8.96.0 — when neither raceDate nor weeksOverride supplied, no horizon → reject
  const hasWeeksOverride = typeof weeksOverrideRaw === 'number'
    && Number.isFinite(weeksOverrideRaw) && weeksOverrideRaw > 0
  if (!raceDate && !hasWeeksOverride) return null

  // v8.96.0 — when targetPR not provided AND noTarget=false, reject (legacy)
  if (!targetPR && !noTarget) return null

  // Validate currentPR shape.
  // v9.18.0 — tightened bounds per audit: reject zero/negative distances,
  // implausible distances (>1000 km), sub-minute / multi-day times. Prior
  // code accepted distanceM=-100 + timeSec=30 and propagated NaN/Infinity
  // through gain calculations.
  // v9.50.0 — MIN_TIME_SEC lowered 60→15 so legit sub-minute efforts pass
  // (50m swim WR 21s, 1km bike TT WR 55s, 100m swim WR 46s). 15s is still
  // well below any humanly possible race-distance time.
  const MAX_DISTANCE_M = 1_000_000      // 1000 km — absurd ceiling
  const MIN_TIME_SEC   = 15             // sub-15s would be data corruption
  const MAX_TIME_SEC   = 7 * 24 * 3600  // 7 days ceiling (multi-day ultra max)
  const valPR = (pr) => {
    if (!pr || typeof pr.timeSec !== 'number') return false
    if (pr.timeSec < MIN_TIME_SEC || pr.timeSec > MAX_TIME_SEC) return false
    if (pr.distanceM === null || pr.distanceM === undefined) return true
    if (typeof pr.distanceM !== 'number') return false
    // distanceM === 0 is a valid sentinel (bike direct-FTP, rowing direct-2k);
    // negative or >1M km is never valid.
    if (pr.distanceM < 0 || pr.distanceM > MAX_DISTANCE_M) return false
    return true
  }
  if (!valPR(currentPR)) return null
  if (targetPR && !valPR(targetPR)) return null

  // Detect bike direct-FTP mode (distanceM === 0 || null)
  const bikeDirectFtp = sport === 'bike'
    && (currentPR.distanceM === 0 || currentPR.distanceM === null || currentPR.distanceM === undefined)

  // v8.96.0 — Resolve effective race date.
  // If raceDate provided AND in past → reject (only !raceDate triggers weeksOverride).
  // If !raceDate AND weeksOverride → synthesize effectiveRaceDate.
  const synthetic = { raceDate: false, targetPR: false, raceLabel: null }
  const today = options.today ? parseUTCDate(options.today) : todayUTC()
  if (!today) return null

  let effectiveRaceDate = raceDate
  let weeksAvailable = 0

  if (raceDate) {
    const race = parseUTCDate(raceDate)
    if (!race) return null
    const daysAvailable = daysBetween(today, race)
    if (daysAvailable < 0) {
      return {
        _rejected: true,
        reason: 'race-in-past',
        note: {
          en: 'Race date is in the past',
          tr: 'Yarış tarihi geçmişte',
        },
      }
    }
    weeksAvailable = Math.max(0, Math.floor(daysAvailable / 7))
    // v9.28.0 — Sub-week horizons (race today, tomorrow, 6 days out)
    // previously generated a result with weeksAvailable=undefined and empty
    // phases — silent partial output that confused the UI. Reject explicitly.
    // Threshold is < 1 week (not < 4) so the existing 2-3 week degraded
    // Peak+Taper path stays valid for last-minute taper planning.
    if (weeksAvailable < 1) {
      return {
        _rejected: true,
        reason: 'horizon-too-short',
        note: {
          en: 'Race is less than a week away — too short to plan. Use the race-week protocol instead.',
          tr: 'Yarışa bir haftadan az kaldı — plan için çok kısa. Bunun yerine yarış-haftası protokolünü kullan.',
        },
      }
    }
  } else {
    // weeksOverride path — clamp to [4,52]
    const wo = Math.max(4, Math.min(52, Math.floor(weeksOverrideRaw)))
    weeksAvailable = wo
    const synthRace = new Date(today.getTime() + wo * 7 * 86400000)
    effectiveRaceDate = synthRace.toISOString().slice(0, 10)
    synthetic.raceDate = true
    synthetic.raceLabel = 'FINAL WEEK'
  }

  // v8.96.0 — Synthesize target PR per sport when noTarget=true and no targetPR provided.
  if (noTarget && !targetPR) {
    const scale = weeksAvailable / 12
    if (sport === 'run' || sport === 'triathlon') {
      const dist = currentPR.distanceM || 10000
      const cVdot = vdotFromRace(dist, currentPR.timeSec)
      if (!cVdot) return null
      const gain = vdotGainPerBlock(cVdot) * scale
      const cappedGain = Math.min(gain, 6)
      const synthVdot = cVdot + cappedGain
      const synthTime = predictRaceTime(synthVdot, dist)
      if (!synthTime || synthTime >= currentPR.timeSec) return null
      targetPR = { distanceM: dist, timeSec: synthTime }
      synthetic.targetPR = true
    } else if (sport === 'bike') {
      if (bikeDirectFtp) {
        const cFtp = currentPR.timeSec
        const gain = ftpGainPerBlock(cFtp) * scale
        const cappedGain = Math.min(gain, 30)
        const synthFtp = Math.round(cFtp + cappedGain)
        if (synthFtp <= cFtp) return null
        targetPR = { distanceM: 0, timeSec: synthFtp }
      } else {
        // Bike TT mode: derive current FTP via existing speed→FTP heuristic, add gain, then convert back to a faster TT time
        const cSpeed = (currentPR.distanceM / 1000) / (currentPR.timeSec / 3600)
        const cFtp = Math.round(250 * cSpeed / 35)
        if (!cFtp || cFtp <= 0) return null
        const gain = ftpGainPerBlock(cFtp) * scale
        const cappedGain = Math.min(gain, 30)
        const gFtp = Math.round(cFtp + cappedGain)
        if (gFtp <= cFtp) return null
        // Reverse: speed = ftp * 35 / 250 (km/h); timeHr = distanceKm / speed
        const gSpeed = gFtp * 35 / 250
        const synthTime = Math.round((currentPR.distanceM / 1000) / gSpeed * 3600)
        if (!synthTime || synthTime >= currentPR.timeSec) return null
        targetPR = { distanceM: currentPR.distanceM, timeSec: synthTime }
      }
      synthetic.targetPR = true
    } else if (sport === 'swim') {
      const cDist = currentPR.distanceM || 1500
      const cPace = tPaceFromTT(cDist, currentPR.timeSec)
      if (!cPace) return null
      const gain = cssGainPerBlock(cPace) * scale
      const cappedGain = Math.min(gain, 8)
      const gPace = cPace - cappedGain
      if (gPace <= 0 || gPace >= cPace) return null
      const synthTime = Math.round(gPace * (cDist / 100))
      if (!synthTime || synthTime >= currentPR.timeSec) return null
      targetPR = { distanceM: cDist, timeSec: synthTime }
      synthetic.targetPR = true
    } else if (sport === 'rowing') {
      // v9.28.0 — Rowing was missing from the synthesis block. Crash on line
      // 923 when noTarget=true with rowing because targetPR stayed null and
      // the target-faster check accessed `.timeSec` of null.
      // 2k time → split500 gain via rowingGainPerBlock (sec/block).
      const c2kSec = currentPR.timeSec
      const gainSec = rowingGainPerBlock(c2kSec) * scale
      const cappedGain = Math.min(gainSec, 12)
      const synthTime = Math.round(c2kSec - cappedGain)
      if (synthTime <= 0 || synthTime >= c2kSec) return null
      targetPR = { distanceM: 2000, timeSec: synthTime }
      synthetic.targetPR = true
    }
  }

  // v9.28.0 — Defensive null-guard. The synthesis block may not produce a
  // targetPR for sport branches I haven't anticipated (or future sport
  // additions). Without this, line 923 crashes with TypeError. Returning
  // a structured rejection lets the UI render a useful message instead.
  if (!targetPR) {
    return {
      _rejected: true,
      reason: 'target-synthesis-failed',
      note: {
        en: 'Could not synthesize a realistic target for this sport / current level. Please provide an explicit target.',
        tr: 'Bu spor / mevcut seviye için gerçekçi bir hedef üretilemedi. Lütfen açık bir hedef belirt.',
      },
    }
  }

  // Now that targetPR is resolved, validate target-faster rule.
  if (!bikeDirectFtp) {
    if (targetPR.timeSec >= currentPR.timeSec) {
      return {
        _rejected: true,
        reason: 'target-not-faster',
        note: {
          en: 'Target time must be faster than current time',
          tr: 'Hedef süre mevcut süreden daha hızlı olmalı',
        },
      }
    }
  } else {
    if (targetPR.timeSec <= currentPR.timeSec) {
      return {
        _rejected: true,
        reason: 'target-not-faster',
        note: {
          en: 'Target FTP must exceed current FTP',
          tr: 'Hedef FTP mevcut FTP\'yi aşmalı',
        },
      }
    }
  }
  const profileWithDefaults = {
    currentCTL: typeof profile.currentCTL === 'number' && profile.currentCTL > 0 ? profile.currentCTL : 50,
    weeklyHours: typeof profile.weeklyHours === 'number' && profile.weeklyHours > 0 ? profile.weeklyHours : 8,
    trainingDays: typeof profile.trainingDays === 'number' && profile.trainingDays >= 3 ? profile.trainingDays : 5,
    bodyMassKg: typeof profile.bodyMassKg === 'number' && profile.bodyMassKg > 0 ? profile.bodyMassKg : null,
  }

  // Sport-specific levels and weeksNeeded
  let currentLevel = { vdot: null, ftp: null, css: null, paces: null }
  let targetLevel  = { vdot: null, ftp: null, css: null, paces: null }
  let weeksNeeded  = 0
  let deltaPct     = 0

  if (sport === 'run' || sport === 'triathlon') {
    const dist = currentPR.distanceM || 10000
    const tDist = targetPR.distanceM || dist
    const cVdot = vdotFromRace(dist, currentPR.timeSec)
    const gVdot = vdotFromRace(tDist, targetPR.timeSec)
    if (!cVdot || !gVdot) return null
    const gap = Math.max(0, gVdot - cVdot)
    const rate = vdotGainPerBlock(cVdot)
    weeksNeeded = Math.max(4, Math.ceil((gap / rate) * 12))
    deltaPct = ((currentPR.timeSec - targetPR.timeSec) / currentPR.timeSec) * 100
    // v9.11.0 — for triathlon, surface profile FTP + CSS so per-discipline cohort
    // lookup (swim CSS, bike FTP) works in the key-session library flatten step.
    const triFtp = sport === 'triathlon' && Number(profile.ftp) > 0 ? Number(profile.ftp) : null
    const triCss = sport === 'triathlon' && Number(profile.cssSec) > 0 ? Number(profile.cssSec) : null
    currentLevel = {
      vdot: Math.round(cVdot * 10) / 10,
      ftp: triFtp, css: triCss,
      paces: trainingPaces(cVdot),
    }
    targetLevel = {
      vdot: Math.round(gVdot * 10) / 10,
      ftp: triFtp, css: triCss,
      paces: trainingPaces(gVdot),
    }
  } else if (sport === 'bike') {
    // Convention: currentPR.distanceM === 0 → currentPR.timeSec is FTP wattage directly.
    // Otherwise treat as TT and back-derive FTP from a baseline 35km/h-at-FTP heuristic.
    let cFtp = null, gFtp = null
    if (currentPR.distanceM === 0 || currentPR.distanceM === null) {
      cFtp = currentPR.timeSec  // wattage
      gFtp = targetPR.timeSec
    } else {
      // Reverse the predictCyclingTime simplification: baseSpeedKmh=35 → distanceKm/timeHr * (ftp/250)
      // Approximation: ftp ≈ 250 * (distanceKm / timeHr) / 35
      const cSpeed = (currentPR.distanceM / 1000) / (currentPR.timeSec / 3600)
      const gSpeed = (targetPR.distanceM / 1000) / (targetPR.timeSec / 3600)
      cFtp = Math.round(250 * cSpeed / 35)
      gFtp = Math.round(250 * gSpeed / 35)
    }
    if (!cFtp || !gFtp || cFtp <= 0 || gFtp <= 0) return null
    if (gFtp <= cFtp) {
      return {
        _rejected: true,
        reason: 'target-not-faster',
        note: {
          en: 'Target FTP must exceed current FTP',
          tr: 'Hedef FTP mevcut FTP\'yi aşmalı',
        },
      }
    }
    const gap = gFtp - cFtp
    const rate = ftpGainPerBlock(cFtp)
    weeksNeeded = Math.max(4, Math.ceil((gap / rate) * 12))
    deltaPct = ((gFtp - cFtp) / cFtp) * 100
    currentLevel = { vdot: null, ftp: cFtp, css: null, paces: getCyclingZones(cFtp) }
    targetLevel  = { vdot: null, ftp: gFtp, css: null, paces: getCyclingZones(gFtp) }
  } else if (sport === 'swim') {
    const cDist = currentPR.distanceM || 1500
    const gDist = targetPR.distanceM || cDist
    const cPace = tPaceFromTT(cDist, currentPR.timeSec)
    const gPace = tPaceFromTT(gDist, targetPR.timeSec)
    if (!cPace || !gPace) return null
    // sec/100m: lower = faster
    const gap = cPace - gPace
    const rate = cssGainPerBlock(cPace)
    weeksNeeded = Math.max(4, Math.ceil((gap / rate) * 12))
    deltaPct = ((cPace - gPace) / cPace) * 100
    const cMs = 100 / cPace
    const gMs = 100 / gPace
    currentLevel = {
      vdot: null, ftp: null,
      css: cssToSecPer100m(cMs),
      paces: swimmingZones(cPace),
    }
    targetLevel = {
      vdot: null, ftp: null,
      css: cssToSecPer100m(gMs),
      paces: swimmingZones(gPace),
    }
  } else if (sport === 'rowing') {
    // v9.7.0 — Rowing branch.
    // Convention: currentPR.distanceM === 0 (or null) → currentPR.timeSec is total
    // 2000m time in seconds. Otherwise predict 2k from any rowing TT distance via
    // Paul's Law (exponent 1.07, see rowing.js predict2000m).
    let c2kSec = null, g2kSec = null
    if (!currentPR.distanceM) {
      c2kSec = currentPR.timeSec
      g2kSec = targetPR.timeSec
    } else {
      c2kSec = predict2000m(currentPR.timeSec, currentPR.distanceM)
      g2kSec = predict2000m(targetPR.timeSec, targetPR.distanceM)
    }
    if (!c2kSec || !g2kSec || c2kSec <= 0 || g2kSec <= 0) return null
    if (g2kSec >= c2kSec) {
      return {
        _rejected: true,
        reason: 'target-not-faster',
        note: {
          en: 'Target 2000m time must be faster than current',
          tr: 'Hedef 2000m süresi mevcut süreden daha hızlı olmalı',
        },
      }
    }
    const gap = c2kSec - g2kSec  // positive seconds to shave
    const rate = rowingGainPerBlock(c2kSec)
    weeksNeeded = Math.max(4, Math.ceil((gap / rate) * 12))
    deltaPct = ((c2kSec - g2kSec) / c2kSec) * 100
    const cSplit500 = c2kSec / 4   // sec per 500m
    const gSplit500 = g2kSec / 4
    currentLevel = {
      vdot: null, ftp: null, css: null,
      split2kSec: c2kSec,
      split500Sec: Math.round(cSplit500 * 10) / 10,
      paces: rowingZones(cSplit500),
    }
    targetLevel = {
      vdot: null, ftp: null, css: null,
      split2kSec: g2kSec,
      split500Sec: Math.round(gSplit500 * 10) / 10,
      paces: rowingZones(gSplit500),
    }
  }

  const band = feasibilityBand(weeksAvailable, weeksNeeded)

  // v9.161.0 (EP-1) — Distance-aware phase split. Explicit input overrides
  // inference; absent both, falls back to the generic distance-agnostic
  // split via phaseSplit. The race distance read for inference is the
  // TARGET distance (not the current PR distance) since the plan periodizes
  // toward the goal race; for sports without a meaningful distance
  // (bike direct-FTP, rowing erg-only) the inference returns null or 'TT'/'Erg'
  // and the multipliers stay close to neutral.
  const inferredDist = targetPR ? targetPR.distanceM : currentPR.distanceM
  const distanceCategory = input.distanceCategory || inferDistanceCategory(sport, inferredDist)

  // Phase split
  const split = phaseSplit(weeksAvailable, sport, distanceCategory)
  const phases = []
  let weekCounter = 1
  for (const phaseName of ['Base', 'Build', 'Peak', 'Taper']) {
    const len = split[phaseName] || 0
    if (len <= 0) continue
    const weeks = []
    for (let i = 0; i < len; i++) {
      weeks.push(weekCounter++)
    }
    phases.push({
      phase: phaseName,
      weeks,
      focus: PHASE_FOCUS[phaseName],
      color: PHASE_COLORS[phaseName],
    })
  }

  // Weekly TSS curve
  let weeklyTSS = weeksAvailable > 0
    ? buildWeeklyTSS(phases, profileWithDefaults.currentCTL)
    : []
  // Pad if rounding produced shortfall
  while (weeklyTSS.length < weeksAvailable) weeklyTSS.push(0)
  while (weeklyTSS.length > weeksAvailable) weeklyTSS.pop()

  // v9.8.0 — Field-test recalibration. When the athlete records their
  // post-Base field test (VDOT/FTP/CSS/2k-split), compute the actual gain vs
  // expected gain at that point and apply a half-step scaling to remaining
  // Peak + Taper TSS. Conservative: cap at ±30% adjustment, half-step the
  // raw ratio to avoid over-fitting to a single test result.
  let fieldTestRecal = null
  if (input.actualFieldTestResults && typeof input.actualFieldTestResults === 'object') {
    const baseWeeks = phases.find(p => p.phase === 'Base')?.weeks?.length || 0
    const buildWeeks = phases.find(p => p.phase === 'Build')?.weeks?.length || 0
    if (baseWeeks > 0 && weeklyTSS.length > baseWeeks + buildWeeks) {
      const ftRatio = fieldTestGainRatio(sport, currentLevel, input.actualFieldTestResults, baseWeeks)
      // Half-step + clamp [0.7, 1.3] to limit volatility
      const halfStep = 1 + (ftRatio - 1) * 0.5
      const scaling = Math.max(0.7, Math.min(1.3, halfStep))
      // Apply to Peak + Taper weeks only (skip Base, skip Build — already executed)
      const peakStart = baseWeeks + buildWeeks
      let scaledIdx = 0
      for (let i = peakStart; i < weeklyTSS.length; i++) {
        weeklyTSS[i] = Math.round(weeklyTSS[i] * scaling)
        scaledIdx++
      }
      fieldTestRecal = {
        rawRatio: Math.round(ftRatio * 100) / 100,
        scalingApplied: Math.round(scaling * 100) / 100,
        weeksAdjusted: scaledIdx,
        note: scaling > 1.05
          ? { en: 'Ahead of schedule — Peak/Taper TSS increased.', tr: 'Programdan ileride — Peak/Taper TSS artırıldı.' }
          : scaling < 0.95
            ? { en: 'Behind schedule — Peak/Taper TSS reduced.', tr: 'Programdan geride — Peak/Taper TSS azaltıldı.' }
            : { en: 'On schedule — no significant adjustment.', tr: 'Programda — anlamlı ayar yok.' },
      }
    }
  }

  // v9.162.0 (EP-2) — ACWR sweet-spot safety cap. FINAL TSS adjustment,
  // applied after buildWeeklyTSS + fieldTestRecal scaling. Caps absolute
  // weekly TSS at 1.3 × weekly-CTL (Gabbett 2016 sweet-spot upper bound).
  // Kicks in only when CTL ≥ 10 (lower CTL = noisy anchor) AND at least
  // one week exceeds the ceiling — most well-anchored plans stay under it.
  let feasibilityWarning = null
  if (weeklyTSS.length > 0) {
    const cap = applyACWRSafetyCap(weeklyTSS, profileWithDefaults.currentCTL)
    weeklyTSS = cap.cappedTSS
    feasibilityWarning = cap.warning
  }

  // Sample weeks per phase
  const sampleWeeks = { Base: [], Build: [], Peak: [], Taper: [] }
  const phasePresent = new Set(phases.map(p => p.phase))
  for (const phaseName of ['Base', 'Build', 'Peak', 'Taper']) {
    if (!phasePresent.has(phaseName)) {
      sampleWeeks[phaseName] = []
      continue
    }
    if (sport === 'triathlon') {
      sampleWeeks[phaseName] = triSampleWeek(phaseName, currentLevel.paces, currentLevel.ftp, currentLevel.css)
    } else if (sport === 'rowing') {
      sampleWeeks[phaseName] = rowingSampleWeek(phaseName, currentLevel.split500Sec)
    } else if (sport === 'run') {
      sampleWeeks[phaseName] = runSampleWeek(phaseName, currentLevel.paces, profileWithDefaults.trainingDays)
    } else if (sport === 'bike') {
      sampleWeeks[phaseName] = bikeSampleWeek(phaseName, currentLevel.paces)
    } else if (sport === 'swim') {
      sampleWeeks[phaseName] = swimSampleWeek(phaseName, currentLevel.css)
    }
    // v9.24.0 — weave strength sessions into the week (Beattie 2014 stacking)
    sampleWeeks[phaseName] = weaveStrengthIntoSampleWeek(sampleWeeks[phaseName], phaseName)
  }

  // Recommendation — bilingual, with caveats for unrealistic profile params
  const recBaseEn = BAND_NOTES[band].en
  const recBaseTr = BAND_NOTES[band].tr
  const flags = []
  const flagsTr = []
  if (profileWithDefaults.weeklyHours < 3 || profileWithDefaults.weeklyHours > 25) {
    flags.push('Weekly training hours outside the 3-25 h reasonable band')
    flagsTr.push('Haftalık antrenman saatleri 3-25 sa aralığının dışında')
  }
  if (weeksAvailable < 7) {
    flags.push('Race window <7 weeks — degraded mode (no Base, taper-focused)')
    flagsTr.push('Yarış penceresi <7 hafta — sınırlı mod (Base yok, taper odaklı)')
  }
  if (sport === 'triathlon' && !input.triathlonPRs) {
    flags.push('Triathlon mode using run-only feasibility (no per-discipline PRs supplied)')
    flagsTr.push('Triatlon modu sadece koşu fizibilitesi kullanıyor (disiplin başına PR yok)')
  }
  if (synthetic.targetPR || synthetic.raceDate) {
    flags.push('Auto-target derived from current level (Daniels gain rate)')
    flagsTr.push('Hedef mevcut seviyeden türetildi (Daniels gelişim hızı)')
  }
  const recommendation = {
    en: flags.length ? `${recBaseEn}. ${flags.join('; ')}` : recBaseEn,
    tr: flagsTr.length ? `${recBaseTr}. ${flagsTr.join('; ')}` : recBaseTr,
  }

  // v9.2.0 — broader plan content layers (per-phase libraries)
  // v9.11.0 — pass currentLevel so cohort dose tables can specialize sessions.
  const keySessionLibrary = buildKeySessionLibrary({ sport, phases, currentLevel })
  const cohort = selectCohort(sport, currentLevel)
  const strengthProgram   = buildStrengthProgram({ phases, sport })
  const fuelingProgram    = buildFuelingProgram({
    phases,
    bodyMassKg: profileWithDefaults.bodyMassKg,
    cohort,
    gender: profile.gender || null,  // v9.25.0 — sex-aware hydration/sodium/iron
  })
  // v9.13.0 — recovery now scales sleep + modalities by phase weeklyTSS + cohort.
  const recoveryProgram   = buildRecoveryProgram({ phases, weeklyTSS, cohort })
  const raceWeekProtocol  = buildRaceWeekProtocol({
    sport,
    raceDate: effectiveRaceDate,
    // v9.8.0 — pass through optional environmental conditions
    timeZoneShiftHrs: typeof input.timeZoneShiftHrs === 'number' ? input.timeZoneShiftHrs : null,
    raceAltitudeM:    typeof input.raceAltitudeM === 'number'    ? input.raceAltitudeM    : null,
    raceHeatC:        typeof input.raceHeatC === 'number'        ? input.raceHeatC        : null,
    raceTempC:        typeof input.raceTempC === 'number'        ? input.raceTempC        : null,  // v9.31.0 cold
    // v9.16.0 — race distance drives meal/warmup/pacing tier selection
    raceDistanceM:    targetPR?.distanceM || currentPR?.distanceM || null,
  })
  const substitutionMap   = buildSubstitutionMap({ sport })
  const contingencyMap    = buildContingencyMap({ sport })
  const drillsLibrary     = buildDrillsLibrary({ sport, phases })

  const out = {
    feasibility: {
      band,
      weeksAvailable,
      weeksNeeded,
      deltaPct: Math.round(deltaPct * 10) / 10,
      note: BAND_NOTES[band],
      effectiveRaceDate,
    },
    sport,
    distanceCategory,
    currentLevel,
    targetLevel,
    cohort,
    phases,
    weeklyTSS,
    feasibilityWarning,
    sampleWeeks,
    keySessionLibrary,
    strengthProgram,
    fuelingProgram,
    recoveryProgram,
    raceWeekProtocol,
    substitutionMap,
    contingencyMap,
    drillsLibrary,
    recommendation,
    citation: CITATION,
    reliable: band !== 'unrealistic',
    resolvedTargetPR: targetPR,
  }
  if (synthetic.raceDate || synthetic.targetPR) {
    out.synthetic = { ...synthetic }
  }
  if (fieldTestRecal) {
    out.fieldTestRecal = fieldTestRecal
  }
  // v9.18.0 — surface a warning when triathlon program cannot resolve a
  // cohort (because no run/bike/swim baseline data was provided in profile).
  // Prior behavior silently fell back to no-cohort, defeating the ability-
  // matched prescription that's the whole point of the cohort layer.
  if (sport === 'triathlon' && !cohort) {
    out.cohortWarning = {
      en: 'Triathlon program built without a resolvable ability cohort (no VDOT / FTP / CSS baseline). Sessions ship without beginner/intermediate/elite dose tables. Add a 10k run time or recent FTP / 1500m swim time to your profile for ability-matched prescriptions.',
      tr: 'Triatlon programı çözümlenebilir yetenek kohortu olmadan oluşturuldu (VDOT / FTP / CSS taban yok). Seanslar başlangıç/orta/elit doz tabloları olmadan gönderilir. Yetenek-eşleşmiş reçeteler için profilinize 10k koşu süresi, son FTP veya 1500m yüzme süresi ekleyin.',
    }
  }
  return out
}
