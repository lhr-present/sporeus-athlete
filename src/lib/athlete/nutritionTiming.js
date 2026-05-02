// ─── nutritionTiming.js — E126: Pre/During/Post Workout Fueling ──────────────
// Computes carb / fluid / sodium / protein targets for a planned session
// based on intent, duration, intensity (RPE) and athlete body mass.
// Reference: Burke 2014 (Practical Issues in Nutrition for Athletes);
//            Jeukendrup 2014 (Nutrition for Endurance Sports — multi-transportable carbs).
// ─────────────────────────────────────────────────────────────────────────────

export const NUTRITION_TIMING_CITATION = 'Burke 2014; Jeukendrup 2014'

// ─── Intent → default RPE mapping (when caller doesn't supply rpe) ───────────
const INTENT_RPE = {
  recovery: 3,
  long: 5,
  steady: 5,
  tempo: 6,
  intervals: 8,
}

const KNOWN_INTENTS = new Set(Object.keys(INTENT_RPE))

// ─── Pre-workout carb bands (g/kg, 2-3h before session) ──────────────────────
// Burke 2014: 1-4 g/kg of body mass scales with session demand.
const PRE_BANDS = {
  low:  { low: 1, mid: 1.5, high: 2 },  // RPE ≤ 4 OR duration < 60min
  mid:  { low: 2, mid: 2.5, high: 3 },  // RPE 5-6, 60-90min
  high: { low: 3, mid: 3.5, high: 4 },  // RPE 7+, ≥90min
}

// Pre-workout hydration: 5-7 ml/kg, mid value 6 ml/kg.
const PRE_FLUID_ML_PER_KG = 6

// ─── During-session carb bands (g/h) ─────────────────────────────────────────
// Jeukendrup 2014: single-transportable up to ~60 g/h; multi-transportable
// (glucose:fructose 2:1) needed beyond that.
const DURING_BANDS = {
  short:  null,                                // < 30min: water only
  brief:  { low: 0,  mid: 15, high: 30 },      // 30-60min: optional carbs
  medium: { low: 30, mid: 45, high: 60 },      // 60-150min: single source
  long:   { low: 60, mid: 75, high: 90 },      // 150min+: multi source
}

// During-session base fluid (ml/h) and sodium (mg/h).
const DURING_FLUID_BASE_ML_PER_HOUR = 600   // Mid-range of 400-800 ml/h
const DURING_SODIUM_MG_PER_HOUR     = 500   // Mid-range of 300-700 mg/h
const HEAT_FLUID_MULTIPLIER         = 1.25

// ─── Post-workout (within 30 min) ────────────────────────────────────────────
// Burke 2014: 1.0-1.2 g/kg carb + ~0.3 g/kg protein within 30min.
const POST_CARB_G_PER_KG    = 1.1   // mid of 1.0-1.2
const POST_PROTEIN_G_PER_KG = 0.3

// ─── Helpers ─────────────────────────────────────────────────────────────────
function r(n) { return Math.round(n) }

/**
 * Resolve which pre-workout band applies to this session.
 * Priority: explicit RPE > duration thresholds.
 */
function pickPreBand(rpe, durationMin) {
  if (rpe >= 7 || durationMin >= 90) return 'high'
  if (rpe >= 5 || durationMin >= 60) return 'mid'
  return 'low'
}

/**
 * Resolve which during-session band applies based on duration.
 */
function pickDuringBand(durationMin) {
  if (durationMin < 30) return 'short'
  if (durationMin < 60) return 'brief'
  if (durationMin < 150) return 'medium'
  return 'long'
}

// ─── computeNutritionTiming ──────────────────────────────────────────────────
/**
 * Compute pre/during/post-workout nutrition targets.
 *
 * Reference rules (Burke 2014, Jeukendrup 2014):
 *   pre (2-3h before):
 *     - low intensity (RPE ≤ 4 or duration < 60min): 1-2 g/kg carb
 *     - moderate (RPE 5-6, 60-90min): 2-3 g/kg carb
 *     - high (RPE 7+, ≥90min): 3-4 g/kg carb
 *     - hydration: 5-7 ml/kg
 *   during:
 *     - 30-60min: water only / carbs optional (0-30 g/h)
 *     - 60-150min: 30-60 g/h carbs (single-source: glucose/maltodextrin)
 *     - 150min+: 60-90 g/h carbs (multi-source: glucose+fructose 2:1)
 *     - fluid: 400-800 ml/h depending on heat
 *     - sodium: 300-700 mg/h
 *   post (within 30min):
 *     - carb: 1-1.2 g/kg
 *     - protein: 0.3 g/kg (~20-25g for 70kg)
 *
 * @param {Object} input
 * @param {string} input.intent           - 'recovery' | 'long' | 'steady' | 'tempo' | 'intervals'
 * @param {number} input.durationMin
 * @param {number} input.weightKg
 * @param {number} [input.rpe]            - 1-10, optional (otherwise inferred from intent)
 * @param {boolean} [input.heatStress]    - true raises fluid target by 25%
 * @returns {{
 *   pre:     { carbGrams: { low: number, mid: number, high: number }, fluidMl: number,
 *              note: { en: string, tr: string } },
 *   during:  { fluidMlPerHour: number, carbGramsPerHour: { low: number, mid: number, high: number } | null,
 *              sodiumMgPerHour: number, note: { en: string, tr: string } },
 *   post:    { carbGrams: number, proteinGrams: number,
 *              note: { en: string, tr: string } },
 *   total:   { carbGrams: number, fluidMl: number, sodiumMg: number },
 *   citation: string,
 * } | null}
 *
 * Returns null when input is invalid (negative weight, unknown intent, etc.).
 */
export function computeNutritionTiming(input) {
  if (!input || typeof input !== 'object') return null
  const { intent, durationMin, weightKg, rpe, heatStress } = input

  // ─── Validation ──────────────────────────────────────────────────────────
  if (typeof intent !== 'string' || !KNOWN_INTENTS.has(intent)) return null
  if (typeof durationMin !== 'number' || !isFinite(durationMin) || durationMin <= 0) return null
  if (typeof weightKg !== 'number' || !isFinite(weightKg) || weightKg <= 0) return null

  // Resolve RPE: explicit > intent default. Clamp to [1,10].
  let effectiveRpe = (typeof rpe === 'number' && isFinite(rpe))
    ? rpe
    : INTENT_RPE[intent]
  if (effectiveRpe < 1) effectiveRpe = 1
  if (effectiveRpe > 10) effectiveRpe = 10

  // ─── PRE ─────────────────────────────────────────────────────────────────
  const preBandKey = pickPreBand(effectiveRpe, durationMin)
  const preBand = PRE_BANDS[preBandKey]
  const preCarb = {
    low:  r(preBand.low  * weightKg),
    mid:  r(preBand.mid  * weightKg),
    high: r(preBand.high * weightKg),
  }
  const preFluid = r(PRE_FLUID_ML_PER_KG * weightKg)
  const preNote = {
    en: `Eat 2-3h before. Aim for ${preBand.low.toFixed(1)}-${preBand.high.toFixed(1)} g/kg carb, low fat/fiber.`,
    tr: `Antrenmandan 2-3 saat önce ye. Hedef: ${preBand.low.toFixed(1)}-${preBand.high.toFixed(1)} g/kg karb, düşük yağ/lif.`,
  }

  // ─── DURING ──────────────────────────────────────────────────────────────
  const duringBandKey = pickDuringBand(durationMin)
  const duringBand = DURING_BANDS[duringBandKey]
  const carbGramsPerHour = duringBand
    ? { low: r(duringBand.low), mid: r(duringBand.mid), high: r(duringBand.high) }
    : null

  const fluidBase = DURING_FLUID_BASE_ML_PER_HOUR
  const fluidMlPerHour = r(heatStress === true
    ? fluidBase * HEAT_FLUID_MULTIPLIER
    : fluidBase)
  const sodiumMgPerHour = DURING_SODIUM_MG_PER_HOUR

  let duringNote
  if (duringBandKey === 'short') {
    duringNote = {
      en: 'Water only — fueling not required for short sessions.',
      tr: 'Sadece su — kısa seanslarda yakıt gerekmez.',
    }
  } else if (duringBandKey === 'brief') {
    duringNote = {
      en: 'Sip water as desired. Carbs optional.',
      tr: 'İstediğinde su yudumla. Karb opsiyonel.',
    }
  } else if (duringBandKey === 'medium') {
    duringNote = {
      en: '30-60 g/h carbs from gels/sports drink.',
      tr: '30-60 g/saat karb (jel/sporcu içeceği).',
    }
  } else {
    duringNote = {
      en: '60-90 g/h carbs (glucose+fructose mix).',
      tr: '60-90 g/saat karb (glukoz+früktoz karışımı).',
    }
  }

  // ─── POST ────────────────────────────────────────────────────────────────
  const postCarb = r(POST_CARB_G_PER_KG * weightKg)
  const postProtein = r(POST_PROTEIN_G_PER_KG * weightKg)
  const postNote = {
    en: `Eat within 30 min: ~${postCarb}g carb + ~${postProtein}g protein.`,
    tr: `30 dk içinde ye: ~${postCarb}g karb + ~${postProtein}g protein.`,
  }

  // ─── TOTALS ──────────────────────────────────────────────────────────────
  const hours = durationMin / 60
  const duringCarbMid = carbGramsPerHour ? carbGramsPerHour.mid * hours : 0
  const duringFluidTotal = fluidMlPerHour * hours
  const duringSodiumTotal = sodiumMgPerHour * hours

  const total = {
    carbGrams: r(preCarb.mid + duringCarbMid + postCarb),
    fluidMl:   r(preFluid + duringFluidTotal),  // post fluid not separately modelled
    sodiumMg:  r(duringSodiumTotal),            // pre/post sodium not significant
  }

  return {
    pre: {
      carbGrams: preCarb,
      fluidMl: preFluid,
      note: preNote,
    },
    during: {
      fluidMlPerHour,
      carbGramsPerHour,
      sodiumMgPerHour,
      note: duringNote,
    },
    post: {
      carbGrams: postCarb,
      proteinGrams: postProtein,
      note: postNote,
    },
    total,
    citation: NUTRITION_TIMING_CITATION,
  }
}
