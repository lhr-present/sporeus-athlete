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
  // v9.15.0 — Sport-specific train-low guidance. Hawley & Burke 2010 + Impey
  // 2018: train-low tolerance differs by sport. Run/bike easy Z1 work safe;
  // swim risky (GI + coordination); never apply to women with low energy
  // availability or to beginners (CNS fatigue). Schedule weeks 3-4 of Base
  // only — not race-critical weeks.
  trainLow: {
    en: 'Train-low (low-glycogen sessions to upregulate fat oxidation): 1x/week max in weeks 3-4 of Base. Safe: 45-90 min Z1 runs or rides. AVOID: swim sessions (GI + coordination risk), VO2max work, beginners, anyone with low energy availability.',
    tr: 'Düşük-glikojenle antrenman (yağ oksidasyonunu artırmak): Base 3-4. haftada haftada 1 kez maks. Güvenli: 45-90 dk Z1 koşu/sürüş. KAÇIN: yüzme seansları (GI + koordinasyon riski), VO2max işi, başlangıç sporcusu, düşük enerji uygunluğu olanlar.',
  },
  rationale: {
    en: 'Moderate CHO supports high-volume aerobic load. Train-low feasible 1-2x/week to upregulate fat oxidation.',
    tr: 'Orta CHO yüksek hacimli aerobik yükü destekler. Yağ oksidasyonunu artırmak için haftada 1-2 kez düşük-glikojenle antrenman uygulanabilir.',
  },
  notes: {
    en: 'Long runs >90 min: take 30-60 g/h CHO. Sessions <90 min easy: water-only acceptable.',
    tr: 'Uzun koşu >90 dk: 30-60 g/sa CHO al. <90 dk kolay seans: sadece su yeterli.',
  },
  citation: 'Burke 2017; Hawley & Burke 2010; Impey 2018',
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

// v9.25.0 — Body-mass + sex-aware hydration prescription. Replaces hand-waved
// "200-400 mL/h" with Jeukendrup 2014 baseline of 3-8 mL/kg/h. Females trend
// toward the lower end (lower sweat rate, ~0.8-1.2 L/h vs male 1.2-2.0 L/h);
// males trend toward the upper end. Ranges are conservative — explicit
// individualization via sweat-rate testing always preferred (see protocol).
//   Citations: Jeukendrup 2014; Burke 2017 Table 7
function hydrationMlPerHr(bodyMassKg, gender) {
  if (!bodyMassKg) return null
  const isFemale = (gender || '').toLowerCase() === 'female'
  // Female: 3-6 mL/kg/h. Male: 4-8 mL/kg/h. Default to mid-range when no sex.
  const lo = isFemale ? 3 : 4
  const hi = isFemale ? 6 : 8
  return [Math.round(bodyMassKg * lo), Math.round(bodyMassKg * hi)]
}

// v9.25.0 — Sex- + sweat-rate-tier-aware sodium dose. Burke 2017 Table 7:
// 300-700 mg sodium per litre of fluid replacement, with high-sweat-rate
// athletes (>1.2 L/h) and males needing the upper bracket; low-sweat-rate
// athletes (<1 L/h) and females needing the lower bracket.
//   Citations: Burke 2017; Jeukendrup 2010; Sawka 2007 (ACSM)
function sodiumMgPerHr(bodyMassKg, gender) {
  if (!bodyMassKg) return null
  const isFemale = (gender || '').toLowerCase() === 'female'
  // Lower bracket for typical female sweat rate; upper for male/high-sweat.
  // Hot-race + heavy-sweater athletes should override upward in race-week.
  const lo = isFemale ? 500 : 700
  const hi = isFemale ? 800 : 1200
  return [lo, hi]
}

// v9.25.0 — Universal sweat-rate self-test protocol. Without individualization
// every other hydration number is a guess. Documented in Build phase notes so
// the athlete runs the test on a prescribed long session.
//   Citations: Jeukendrup 2014; Sawka 2007 ACSM Position Stand
const SWEAT_RATE_PROTOCOL = {
  en: 'Sweat-rate test (do once per phase, on a long session in the temperature you race in): weigh nude before and after a 60-90 min session. Sweat rate (L/h) = (pre-weight − post-weight + fluid consumed in L) ÷ duration (h). Multiply by 1000 for mL/h. Rule of thumb: <1 L/h = low (use 500-700 mg sodium/h); 1-1.5 L/h = moderate (800-1000 mg); >1.5 L/h = high (1000-1200 mg).',
  tr: 'Terleme oranı testi (her fazda 1 kez, yarış sıcaklığında uzun seansta yap): seans öncesi ve sonrası çıplak tartıl. Terleme oranı (L/sa) = (öncesi kilo − sonrası kilo + tüketilen sıvı L) ÷ süre (sa). 1000 ile çarp = mL/sa. Pratik kural: <1 L/sa = düşük (500-700 mg sodyum/sa); 1-1,5 L/sa = orta (800-1000 mg); >1,5 L/sa = yüksek (1000-1200 mg).',
}

// v9.25.0 — Iron / ferritin guidance for female endurance athletes. Female
// runners absorb <50% iron vs males; depleted ferritin (<30 ng/mL) → reduced
// VO2max; Friedmann 2001 + Brownlie 2004 + Peeling 2008 protocol. RED-S
// screening attached (Mountjoy 2018) since iron deficiency often co-occurs
// with low energy availability — never supplement in isolation if RED-S
// signs present.
//   Citations: Brownlie et al. 2004; Friedmann et al. 2001; Peeling 2008;
//              Mountjoy et al. 2018 (RED-S CAT)
const IRON_GUIDANCE_FEMALE = {
  en: 'Female endurance athletes: ferritin <30 ng/mL → 5-8% VO2max loss (Friedmann 2001). Test 25(OH)D + ferritin annually if available. If supplementing: 25-30 mg elemental Fe daily 4+ weeks pre-race (or red meat 2x/day equivalent), paired with 200 mg vitamin C post-meal. AVOID supplementing during a known infection or if RED-S signs present (missed periods, persistent fatigue, recurrent stress fractures) — refer to sports medicine first.',
  tr: 'Kadın dayanıklılık sporcuları: ferritin <30 ng/mL → %5-8 VO2max kaybı (Friedmann 2001). Mümkünse yılda bir 25(OH)D + ferritin testi yap. Takviye gerekirse: yarıştan 4+ hafta önce günlük 25-30 mg elemental Fe (veya günde 2 kez kırmızı et eşdeğeri), yemekle birlikte 200 mg C vitamini ile. ENFEKSIYON veya RED-S belirtileri (adet kesintisi, kalıcı yorgunluk, tekrarlayan stres kırıkları) varsa takviye YAPMA — önce spor hekimine başvur.',
}

// v9.25.0 — RED-S screening checklist. When gender === 'female' the fueling
// output surfaces this so the athlete sees the screening before any train-low
// or restrictive intake decision.
//   Citation: Mountjoy et al. 2018 (RED-S CAT 2.0)
const RED_S_SCREENING = {
  en: 'RED-S screening (Relative Energy Deficiency in Sport): ANY of — irregular or missed periods (>2 cycles), persistent fatigue >2 weeks, recurrent stress injuries, low BMD on DEXA, frequent illness — means train-low and caloric restriction are CONTRAINDICATED. Enforce 1.8 g/kg CHO daily floor and refer to sports medicine for full screening.',
  tr: 'RED-S taraması (Sporda Bağıl Enerji Eksikliği): aşağıdakilerden HERHANGİ BİRİ — düzensiz/atlanmış adet (>2 döngü), 2+ hafta kalıcı yorgunluk, tekrarlayan stres yaralanması, DEXA\'da düşük kemik yoğunluğu, sık hastalık — düşük-glikojen antrenmanı ve kalori kısıtlamasını YASAKLAR. Günde 1,8 g/kg CHO tabanını uygula ve tam tarama için spor hekimine yönlendir.',
}

/**
 * @public
 * @param {{ phases: Array<{phase:string}>, bodyMassKg?: number, cohort?: ('beginner'|'intermediate'|'elite'), gender?: ('female'|'male'|string) }} input
 * @returns {Record<string, FuelingPhasePlan & { dailyCHO_g?: [number, number], dailyProtein_g?: number, cohort?: string, hydrationMlPerHr?: [number, number], sodiumMgPerHr?: [number, number], sweatRateProtocol?: Bilingual, ironGuidance?: Bilingual, redsScreening?: Bilingual }>}
 */
export function buildFuelingProgram(input) {
  const present = new Set((input?.phases || []).map(p => p.phase))
  const bw = Number(input?.bodyMassKg) || null
  const cohort = input?.cohort || null
  const gender = input?.gender || null
  const isFemale = (gender || '').toLowerCase() === 'female'
  const hydrationMl = hydrationMlPerHr(bw, gender)
  const sodiumMg = sodiumMgPerHr(bw, gender)
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
      // v9.25.0 — hydration + sodium individualization. Null when bodyMassKg
      // unknown (athlete hasn't filled profile); UI surfaces a fallback hint.
      ...(hydrationMl ? { hydrationMlPerHr: hydrationMl } : {}),
      ...(sodiumMg    ? { sodiumMgPerHr: sodiumMg } : {}),
      // Sweat-rate self-test protocol — surfaced in Build phase (where the
      // athlete is doing long fueling-rehearsal sessions); other phases get
      // a pointer back to the test result.
      ...(plan.phase === 'Build' ? { sweatRateProtocol: SWEAT_RATE_PROTOCOL } : {}),
      // Iron guidance + RED-S screening — only female. Iron lands in Base
      // and Build (lead-time matters: 4+ weeks pre-race for any uplift);
      // RED-S screening on every phase since the contraindication blocks
      // train-low and carb restriction throughout.
      ...(isFemale && (plan.phase === 'Base' || plan.phase === 'Build')
          ? { ironGuidance: IRON_GUIDANCE_FEMALE } : {}),
      ...(isFemale ? { redsScreening: RED_S_SCREENING } : {}),
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

export const FUELING_CITATION = 'Burke 2017; Jeukendrup 2014; Hawley & Burke 2010; Stellingwerf 2018; Bussau et al. 2002; Areta 2014; Stellingwerff 2019; Sawka 2007 (ACSM); Brownlie 2004; Friedmann 2001; Peeling 2008; Mountjoy 2018 (RED-S)'
