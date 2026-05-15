// src/lib/athlete/injuryReturnRamp.js
//
// v9.169.0 (EP-10) — Prescriptive return-to-sport ramp after an injury layoff.
//
// `comebackDetector.js` already flags an inactivity gap and suggests easing
// CTL back ~50% of prior load. That's reactive ("you stopped, here's a
// hint"). EP-10 is the prescriptive counterpart: given a known injury,
// days off, pre-injury CTL, and body-region awareness, emit a week-by-
// week ramp with intensity caps, volume targets, red flags, and
// return-to-sport criteria.
//
// Protocol grounding:
//
//   Base ramp (Soligard 2016 BJSM consensus + Gabbett 2016 ACWR):
//     Week 1 — 30% pre-injury TSS, Z1-Z2 only
//     Week 2 — 50% pre-injury TSS, +Z2-Z3 endurance allowed
//     Week 3 — 70%, +threshold (cap one quality session)
//     Week 4 — 90%, +Z4 intervals allowed
//     Week 5 — 100%, full phase-appropriate prescription
//
//   Modifiers:
//     - Impact injury (stress fracture, achilles, plantar fasciitis,
//       shin splints) to load-bearing tissue (lower-leg, knee, hip):
//       prepend 2 weeks of NON-impact cross-training (swim/bike) before
//       sport-specific impact loading. Total ramp 7 weeks.
//     - Severe layoff (>30 days off): stretch ramp to 6 weeks (Mujika
//       2010 detraining curves — VO2max drops 7-14% in 2-3 weeks; full
//       restoration takes ≥4 weeks of progressive load).
//     - Short layoff (<14 days): compress ramp to 3 weeks (50 → 75 →
//       100%, intensity cap lifted week 2).
//
//   Volume target: each week's TSS goal = preInjuryCTL × 7 × volumePct/100
//     (approximation of typical weekly load at that fitness level).
//
//   ACWR cap: weeks 1-2 hold acute:chronic at 1.0 (no spike above
//     re-built baseline). Weeks 3+ relax to 1.3 standard.
//
//   Return-to-sport criteria (per Ardern 2016 RTS framework):
//     1. Pain-free during sport-specific movements
//     2. Full pain-free range of motion
//     3. Strength ≥90% of contralateral side (or pre-injury baseline)
//     4. No swelling / inflammation signs in last 48h
//     5. Psychological readiness (TSK-11 < 17 or equivalent confidence)
//
// Citations:
//   Soligard T. et al. 2016. How much is too much? (Part 1) Consensus
//     statement on load in sport and risk of injury. BJSM 50(17):1030-41.
//   Gabbett T.J. 2016. The training-injury prevention paradox. BJSM 50:273-280.
//   Mujika I., Padilla S. 2000. Detraining: loss of training-induced
//     physiological and performance adaptations. Sports Med 30(2):79-87.
//   Ardern C.L. et al. 2016. 2016 Consensus statement on return to sport
//     from the First World Congress in Sports Physical Therapy. BJSM 50:853-864.
//   Bertelsen M.L. et al. 2017. A framework for the etiology of running-
//     related injuries. Scand J Med Sci Sports 27(11):1170-1180.

export const INJURY_RAMP_CITATION = 'Soligard 2016; Gabbett 2016; Mujika 2000; Ardern 2016; Bertelsen 2017'

const VALID_INJURY_TYPES = new Set(['impact', 'soft-tissue', 'overuse', 'illness', 'other'])
const VALID_BODY_REGIONS = new Set(['lower-leg', 'knee', 'hip', 'lumbar', 'upper-body', null])

const LOAD_BEARING_REGIONS = new Set(['lower-leg', 'knee', 'hip'])

// Base 5-week ramp template — Soligard 2016
const RAMP_5 = [
  { volumePct: 30, intensityCap: 'Z2', maxQualitySessions: 0 },
  { volumePct: 50, intensityCap: 'Z3', maxQualitySessions: 0 },
  { volumePct: 70, intensityCap: 'Z4', maxQualitySessions: 1 },
  { volumePct: 90, intensityCap: 'Z4', maxQualitySessions: 2 },
  { volumePct: 100, intensityCap: 'Z5', maxQualitySessions: 3 },
]

// Compressed 3-week ramp (<14 days off)
const RAMP_3 = [
  { volumePct: 50, intensityCap: 'Z3', maxQualitySessions: 0 },
  { volumePct: 75, intensityCap: 'Z4', maxQualitySessions: 1 },
  { volumePct: 100, intensityCap: 'Z5', maxQualitySessions: 2 },
]

// Stretched 6-week ramp (>30 days off, severe detraining)
const RAMP_6 = [
  { volumePct: 25, intensityCap: 'Z2', maxQualitySessions: 0 },
  { volumePct: 40, intensityCap: 'Z2', maxQualitySessions: 0 },
  { volumePct: 60, intensityCap: 'Z3', maxQualitySessions: 0 },
  { volumePct: 75, intensityCap: 'Z4', maxQualitySessions: 1 },
  { volumePct: 90, intensityCap: 'Z4', maxQualitySessions: 2 },
  { volumePct: 100, intensityCap: 'Z5', maxQualitySessions: 3 },
]

// Impact-injury preamble: 2 weeks of non-impact cross-training
const IMPACT_PREAMBLE = [
  {
    volumePct: 30,
    intensityCap: 'Z2',
    maxQualitySessions: 0,
    crossTrainingOnly: true,
    note: {
      en: 'Non-impact only: swim, aqua-jog, or stationary bike. NO running / on-water rowing.',
      tr: 'Sadece düşük-etki: yüzme, aqua-jog veya sabit bisiklet. Koşu / suda kürek YOK.',
    },
  },
  {
    volumePct: 50,
    intensityCap: 'Z3',
    maxQualitySessions: 0,
    crossTrainingOnly: true,
    note: {
      en: 'Continue non-impact cross-training. Add one Z3 effort if pain-free at end of week 1.',
      tr: 'Düşük-etki çapraz antrenmana devam. Hafta 1 sonunda ağrısız ise bir Z3 efor ekle.',
    },
  },
]

const RTS_CRITERIA = [
  { en: 'Pain-free during sport-specific movements',                          tr: 'Spora özgü hareketlerde ağrısız' },
  { en: 'Full pain-free range of motion in affected joint',                   tr: 'Etkilenen eklemde tam ağrısız hareket açıklığı' },
  { en: 'Strength ≥90% of contralateral side (or pre-injury baseline)',       tr: 'Kuvvet karşı taraf (veya yaralanma-öncesi taban) ≥%90' },
  { en: 'No swelling / inflammation signs in last 48h',                       tr: 'Son 48 saatte şişlik / iltihap belirtisi yok' },
  { en: 'Psychological readiness (TSK-11 < 17 or equivalent confidence)',     tr: 'Psikolojik hazır olma (TSK-11 < 17 veya eşdeğer özgüven)' },
]

const RED_FLAGS = [
  { en: 'Pain returns or escalates during a ramp session — drop volume 25% next session.',
    tr: 'Rampa seansında ağrı geri gelir veya artarsa — sonraki seansta hacmi %25 düşür.' },
  { en: 'Sharp, localized pain (not general muscle soreness) — STOP, see clinician.',
    tr: 'Keskin, yerel ağrı (genel kas ağrısı değil) — DUR, klinisyen gör.' },
  { en: 'Swelling, warmth, or visible inflammation post-session — extend current ramp week, do NOT progress.',
    tr: 'Seans sonrası şişlik, sıcaklık veya gözle görülür iltihap — mevcut rampa haftasını uzat, İLERLETME.' },
  { en: 'Compensatory pain (opposite side, adjacent joint) — RTS criteria not met, ramp too aggressive.',
    tr: 'Telafi ağrısı (karşı taraf, komşu eklem) — RTS kriterleri karşılanmadı, rampa çok agresif.' },
]

function pickBaseRamp(daysOff) {
  if (!Number.isFinite(daysOff) || daysOff < 0) return RAMP_5
  if (daysOff < 14)  return RAMP_3
  if (daysOff > 30)  return RAMP_6
  return RAMP_5
}

function isImpactInjury(injuryType, bodyRegion) {
  if (injuryType !== 'impact') return false
  return LOAD_BEARING_REGIONS.has(bodyRegion)
}

function acwrTargetForWeek(weekIdx, totalWeeks) {
  // Weeks 1-2: ACWR = 1.0 (no spike). Week 3+: relax to 1.3 standard.
  if (weekIdx < 2) return 1.0
  if (weekIdx >= totalWeeks - 1) return 1.3
  return 1.15
}

/**
 * Build a return-to-sport ramp protocol.
 *
 * @param {{
 *   sport: 'run'|'bike'|'swim'|'triathlon'|'rowing',
 *   injuryType: 'impact'|'soft-tissue'|'overuse'|'illness'|'other',
 *   bodyRegion?: 'lower-leg'|'knee'|'hip'|'lumbar'|'upper-body'|null,
 *   daysOff: number,
 *   preInjuryCTL: number,
 *   returnDate?: string,  // ISO 'YYYY-MM-DD' — date athlete is cleared
 * }} input
 * @returns {{
 *   sport: string,
 *   totalRampWeeks: number,
 *   daysOff: number,
 *   weeks: Array<{
 *     week: number,
 *     phase: 'preamble'|'ramp',
 *     volumePct: number,
 *     weeklyTSS: number,
 *     intensityCap: string,
 *     maxQualitySessions: number,
 *     acwrTarget: number,
 *     crossTrainingOnly: boolean,
 *     note: { en: string, tr: string },
 *   }>,
 *   criteria: Array<{ en: string, tr: string }>,
 *   redFlags: Array<{ en: string, tr: string }>,
 *   citation: string,
 *   _rejected?: true,
 *   reason?: string,
 * } | null}
 */
export function buildReturnToSportRamp(input) {
  if (!input || typeof input !== 'object') return null
  const { sport, injuryType, bodyRegion = null, daysOff, preInjuryCTL, returnDate = null } = input

  if (!sport || typeof sport !== 'string') {
    return { _rejected: true, reason: 'missing-sport' }
  }
  if (!VALID_INJURY_TYPES.has(injuryType)) {
    return { _rejected: true, reason: 'invalid-injury-type' }
  }
  if (!VALID_BODY_REGIONS.has(bodyRegion)) {
    return { _rejected: true, reason: 'invalid-body-region' }
  }
  if (!Number.isFinite(daysOff) || daysOff < 0) {
    return { _rejected: true, reason: 'invalid-days-off' }
  }
  if (!Number.isFinite(preInjuryCTL) || preInjuryCTL <= 0) {
    return { _rejected: true, reason: 'invalid-pre-injury-ctl' }
  }

  const base = pickBaseRamp(daysOff)
  const preamble = isImpactInjury(injuryType, bodyRegion) ? IMPACT_PREAMBLE : []

  const targetWeeklyTSS = preInjuryCTL * 7
  const totalWeeks = preamble.length + base.length

  const weeks = []
  let weekNum = 1

  for (const p of preamble) {
    weeks.push({
      week: weekNum,
      phase: 'preamble',
      volumePct: p.volumePct,
      weeklyTSS: Math.round(targetWeeklyTSS * p.volumePct / 100),
      intensityCap: p.intensityCap,
      maxQualitySessions: p.maxQualitySessions,
      acwrTarget: acwrTargetForWeek(weekNum - 1, totalWeeks),
      crossTrainingOnly: !!p.crossTrainingOnly,
      note: p.note,
    })
    weekNum += 1
  }

  for (const r of base) {
    weeks.push({
      week: weekNum,
      phase: 'ramp',
      volumePct: r.volumePct,
      weeklyTSS: Math.round(targetWeeklyTSS * r.volumePct / 100),
      intensityCap: r.intensityCap,
      maxQualitySessions: r.maxQualitySessions,
      acwrTarget: acwrTargetForWeek(weekNum - 1, totalWeeks),
      crossTrainingOnly: false,
      note: rampWeekNote(r, sport),
    })
    weekNum += 1
  }

  return {
    sport,
    injuryType,
    bodyRegion,
    daysOff,
    preInjuryCTL,
    returnDate,
    totalRampWeeks: totalWeeks,
    weeks,
    criteria: RTS_CRITERIA,
    redFlags: RED_FLAGS,
    citation: INJURY_RAMP_CITATION,
  }
}

function rampWeekNote(r, sport) {
  const sportLabel = { run: 'running', bike: 'cycling', swim: 'swimming', triathlon: 'triathlon', rowing: 'rowing' }[sport] || sport
  const sportLabelTR = { run: 'koşu', bike: 'bisiklet', swim: 'yüzme', triathlon: 'triatlon', rowing: 'kürek' }[sport] || sport
  if (r.maxQualitySessions === 0) {
    return {
      en: `${r.volumePct}% volume, ${r.intensityCap}-capped ${sportLabel}. No quality / intervals this week.`,
      tr: `%${r.volumePct} hacim, ${r.intensityCap}-sınırlı ${sportLabelTR}. Bu hafta kalite / interval yok.`,
    }
  }
  return {
    en: `${r.volumePct}% volume, ${r.intensityCap}-capped. Up to ${r.maxQualitySessions} quality session(s) allowed.`,
    tr: `%${r.volumePct} hacim, ${r.intensityCap}-sınırlı. ${r.maxQualitySessions} kalite seansa kadar izin.`,
  }
}
