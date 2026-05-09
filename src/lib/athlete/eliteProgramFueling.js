// ─── eliteProgramFueling.js — Per-phase fueling prescription ────────────────
//
// Carbohydrate periodisation by phase. Aligned with Burke 2017, Jeukendrup 2014,
// Hawley & Burke 2010, and Stellingwerf 2018. Body-weight-aware: returns
// g/kg/day ranges. Pre/during/post-session intake for key sessions. Race-week
// carb-load protocol embedded in raceWeekProtocol module.
//
// All bilingual EN+TR. Pure data — no React.

/**
 * @typedef {{ en: string, tr: string }} Bilingual
 * @typedef {{
 *   phase: string,
 *   chodailyPerKg: [number, number],
 *   proteindailyPerKg: number,
 *   fatPctOfKcal: [number, number],
 *   duringSession: { easyKeyHr: [number, number], hardSessionGPerHr: [number, number] },
 *   preSession:  { gPerKg: number, timingMin: number },
 *   postSession: { gPerKg: number, proteinG: number, timingMin: number },
 *   proteinPulse?: { gPerKgPerMeal: number, mealsPerDay: number, intervalHours: [number, number], rationale: Bilingual },
 *   rationale: Bilingual,
 *   notes: Bilingual,
 *   citation: string
 * }} FuelingPhasePlan
 */

// v9.12.0 — Areta 2014 protein-pulse distribution. Distributed 4x0.4 g/kg per
// meal across the 12h post-session window outperforms a single large dose for
// muscle protein synthesis (MPS). Applied across all phases since MPS daily
// distribution rules are phase-invariant; only daily total varies.
const ARETA_PULSE = {
  gPerKgPerMeal: 0.4,
  mealsPerDay: 4,
  intervalHours: [3, 4],
  rationale: {
    en: '4×0.4 g/kg every 3-4 h sustains MPS for 12 h post-session; outperforms single 40 g dose (Areta 2014).',
    tr: 'Her 3-4 sa\'de 4×0,4 g/kg, seans sonrası 12 sa boyunca MPS\'i sürdürür; tek 40 g dozdan daha iyi (Areta 2014).',
  },
}

const BASE = {
  phase: 'Base',
  chodailyPerKg: [5, 7],
  proteindailyPerKg: 1.6,
  fatPctOfKcal: [25, 35],
  duringSession: { easyKeyHr: [0, 30], hardSessionGPerHr: [30, 60] },
  preSession:  { gPerKg: 1, timingMin: 90 },
  postSession: { gPerKg: 1, proteinG: 25, timingMin: 60 },
  rationale: {
    en: 'Moderate CHO supports high-volume aerobic load. Train-low feasible 1-2x/week to upregulate fat oxidation.',
    tr: 'Orta CHO yüksek hacimli aerobik yükü destekler. Yağ oksidasyonunu artırmak için haftada 1-2 kez düşük-glikojenle antrenman uygulanabilir.',
  },
  notes: {
    en: 'Long runs >90 min: take 30-60 g/h CHO. Sessions <90 min easy: water-only acceptable.',
    tr: 'Uzun koşu >90 dk: 30-60 g/sa CHO al. <90 dk kolay seans: sadece su yeterli.',
  },
  citation: 'Burke 2017; Hawley & Burke 2010',
}

const BUILD = {
  phase: 'Build',
  chodailyPerKg: [6, 8],
  proteindailyPerKg: 1.7,
  fatPctOfKcal: [25, 30],
  duringSession: { easyKeyHr: [30, 60], hardSessionGPerHr: [60, 90] },
  preSession:  { gPerKg: 1.5, timingMin: 90 },
  postSession: { gPerKg: 1.2, proteinG: 25, timingMin: 30 },
  rationale: {
    en: 'Higher CHO needed for threshold + VO2 quality. Always fuel hard sessions; never train-low here.',
    tr: 'Eşik + VO2 kalite seansları için daha yüksek CHO. Sert seanslar için her zaman beslen; bu fazda düşük-glikojenli antrenman yapma.',
  },
  notes: {
    en: 'Practice race-day fueling on long workouts. Aim 60-90 g/h with multi-transportable CHO (glucose+fructose).',
    tr: 'Uzun antrenmanlarda yarış günü beslenme provası yap. Çoklu-taşınabilir CHO (glikoz+fruktoz) ile 60-90 g/sa hedefle.',
  },
  citation: 'Jeukendrup 2014; Burke 2017',
}

const PEAK = {
  phase: 'Peak',
  chodailyPerKg: [7, 10],
  proteindailyPerKg: 1.7,
  fatPctOfKcal: [20, 30],
  duringSession: { easyKeyHr: [30, 60], hardSessionGPerHr: [60, 90] },
  preSession:  { gPerKg: 2, timingMin: 120 },
  postSession: { gPerKg: 1.2, proteinG: 30, timingMin: 30 },
  rationale: {
    en: 'High CHO supports race-pace and race-specific work; muscle glycogen must be topped up between sessions.',
    tr: 'Yüksek CHO yarış-tempo ve yarışa-özgü çalışmayı destekler; kas glikojeni seanslar arasında doldurulmalı.',
  },
  notes: {
    en: 'Practice exact race-day fueling timing & products you will use on race day.',
    tr: 'Yarış günü kullanacağın beslenme zaman ve ürünlerini birebir prova et.',
  },
  citation: 'Burke 2017; Stellingwerf 2018',
}

const TAPER = {
  phase: 'Taper',
  chodailyPerKg: [8, 12],
  proteindailyPerKg: 1.6,
  fatPctOfKcal: [20, 25],
  duringSession: { easyKeyHr: [0, 30], hardSessionGPerHr: [30, 60] },
  preSession:  { gPerKg: 1, timingMin: 90 },
  postSession: { gPerKg: 1, proteinG: 25, timingMin: 60 },
  rationale: {
    en: 'CHO loading peaks 36-48 h pre-race. Volume drops, calories drop, but CHO % rises sharply.',
    tr: 'CHO yüklemesi yarıştan 36-48 sa önce zirveye çıkar. Hacim ve kalori düşer; CHO oranı keskin yükselir.',
  },
  notes: {
    en: 'Carb-load: 10-12 g/kg/d for 36-48 h pre-race. Cut fiber and high-fat meals 24 h pre-race.',
    tr: 'Karbonhidrat yükleme: yarıştan 36-48 sa önce 10-12 g/kg/gün. Yarıştan 24 sa önce lif ve yağlı yemekleri kes.',
  },
  citation: 'Burke 2017; Bussau et al. 2002',
}

// v9.13.0 — Cohort-aware CHO daily targets. Burke 2017 Table 3 + Stellingwerff
// 2019 show elite endurance athletes >10h/week need 8-10 g/kg in Build (not
// 6-8); recreational athletes max 5-6 g/kg (overfeeding = weight gain).
// Ranges below SHIFT the base ranges per cohort tier; values are not absolute.
const CHO_COHORT_OFFSETS = {
  beginner:     { Base: [-1, -1], Build: [-1, -1], Peak: [-2, -2], Taper: [-2, -2] },
  intermediate: { Base: [ 0,  0], Build: [ 0,  0], Peak: [ 0,  0], Taper: [ 0,  0] },
  elite:        { Base: [ 1,  1], Build: [ 2,  2], Peak: [ 1,  2], Taper: [ 0,  0] },
}

// v9.13.0 — Cohort-aware in-session CHO. Jeukendrup 2014 + Stellingwerff 2019:
// beginners cap at 60 g/h (single-source glucose), intermediates 80-90 g/h
// glucose+fructose 2:1, elites 110-120 g/h with multi-transportable mix.
function gPerHourByCohort(cohort, basePhaseRange) {
  if (cohort === 'beginner')     return [Math.max(30, basePhaseRange[0] - 10), Math.min(60, basePhaseRange[1])]
  if (cohort === 'elite')        return [basePhaseRange[1], Math.max(120, basePhaseRange[1] + 30)]
  return basePhaseRange  // intermediate or null → unchanged
}

/**
 * @public
 * @param {{ phases: Array<{phase:string}>, bodyMassKg?: number, cohort?: ('beginner'|'intermediate'|'elite') }} input
 * @returns {Record<string, FuelingPhasePlan & { dailyCHO_g?: [number, number], dailyProtein_g?: number, cohort?: string }>}
 */
export function buildFuelingProgram(input) {
  const present = new Set((input?.phases || []).map(p => p.phase))
  const bw = Number(input?.bodyMassKg) || null
  const cohort = input?.cohort || null
  const out = {}
  const wrap = (plan) => {
    // v9.13.0 — apply cohort offset to daily CHO range
    const offset = cohort && CHO_COHORT_OFFSETS[cohort] ? CHO_COHORT_OFFSETS[cohort][plan.phase] : [0, 0]
    const adjustedCHO = [
      Math.max(3, plan.chodailyPerKg[0] + offset[0]),
      Math.max(4, plan.chodailyPerKg[1] + offset[1]),
    ]
    const adjustedDuring = {
      ...plan.duringSession,
      hardSessionGPerHr: gPerHourByCohort(cohort, plan.duringSession.hardSessionGPerHr),
    }
    const adjusted = {
      ...plan,
      chodailyPerKg: adjustedCHO,
      duringSession: adjustedDuring,
      proteinPulse: ARETA_PULSE,
      ...(cohort ? { cohort } : {}),
    }
    if (!bw) return adjusted
    return {
      ...adjusted,
      dailyCHO_g: [Math.round(adjustedCHO[0] * bw), Math.round(adjustedCHO[1] * bw)],
      dailyProtein_g: Math.round(plan.proteindailyPerKg * bw),
      proteinPulseGPerMeal: Math.round(ARETA_PULSE.gPerKgPerMeal * bw * 10) / 10,
    }
  }
  if (present.has('Base'))  out.Base  = wrap(BASE)
  if (present.has('Build')) out.Build = wrap(BUILD)
  if (present.has('Peak'))  out.Peak  = wrap(PEAK)
  if (present.has('Taper')) out.Taper = wrap(TAPER)
  return out
}

export const FUELING_CITATION = 'Burke 2017; Jeukendrup 2014; Hawley & Burke 2010; Stellingwerf 2018; Bussau et al. 2002; Areta 2014; Stellingwerff 2019'
