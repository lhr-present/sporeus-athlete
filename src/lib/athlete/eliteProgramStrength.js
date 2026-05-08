// ─── eliteProgramStrength.js — Per-phase S&C prescription ───────────────────
//
// Endurance-specific strength programming aligned with Rønnestad & Mujika 2014
// and Beattie 2014 systematic reviews: heavy strength in Base, power conversion
// in Build, maintenance in Peak, neural prep in Taper.
//
// All bilingual EN+TR. Pure data — no React.

/**
 * @typedef {{ en: string, tr: string }} Bilingual
 * @typedef {{
 *   name: Bilingual,
 *   sets: number,
 *   reps: string,
 *   intensity: Bilingual,
 *   notes: Bilingual
 * }} StrengthMovement
 * @typedef {{
 *   phase: string,
 *   emphasis: Bilingual,
 *   frequencyPerWeek: number,
 *   sessionDurationMin: number,
 *   movements: StrengthMovement[],
 *   warning: Bilingual,
 *   citation: string
 * }} StrengthPhasePlan
 */

const BASE = {
  phase: 'Base',
  emphasis: {
    en: 'Heavy max-strength: low-rep, high-load lifts to develop force capacity without bulking.',
    tr: 'Ağır maksimal-kuvvet: düşük tekrar, yüksek yük; hacim eklemeden kuvvet kapasitesi geliştirir.',
  },
  frequencyPerWeek: 2,
  sessionDurationMin: 50,
  movements: [
    {
      name: { en: 'Back squat', tr: 'Arka skuat' },
      sets: 4,
      reps: '4-6',
      intensity: { en: '80-85% 1RM', tr: '%80-85 1RM' },
      notes: { en: 'Explosive concentric, 2s eccentric. Belt OK above 80%.', tr: 'Patlayıcı konsantrik, 2s eksantrik. %80 üzerinde kemer serbest.' },
    },
    {
      name: { en: 'Romanian deadlift', tr: 'Romen ölü kaldırma' },
      sets: 4,
      reps: '5-6',
      intensity: { en: '75-80% 1RM', tr: '%75-80 1RM' },
      notes: { en: 'Hinge, neutral spine, controlled eccentric.', tr: 'Kalçadan kır, nötr omurga, kontrollü eksantrik.' },
    },
    {
      name: { en: 'Single-leg press or split squat', tr: 'Tek-bacak press veya split squat' },
      sets: 3,
      reps: '6-8 each leg',
      intensity: { en: '70-75% 1RM', tr: '%70-75 1RM' },
      notes: { en: 'Addresses asymmetry critical for endurance sports.', tr: 'Dayanıklılık sporlarında kritik asimetriyi giderir.' },
    },
    {
      name: { en: 'Calf raise (bent + straight knee)', tr: 'Buzağı kaldırma (bükük + düz diz)' },
      sets: 3,
      reps: '8-10',
      intensity: { en: 'Body weight + dumbbells', tr: 'Vücut ağırlığı + dumbell' },
      notes: { en: 'Both gastroc and soleus; 2s pause at top.', tr: 'Hem gastrok hem soleus; tepede 2s bekleme.' },
    },
    {
      name: { en: 'Plank + side plank', tr: 'Plank + yan plank' },
      sets: 3,
      reps: '30-45s each',
      intensity: { en: 'Body weight', tr: 'Vücut ağırlığı' },
      notes: { en: 'Core stability, not flexion.', tr: 'Core stabilitesi, fleksiyon değil.' },
    },
  ],
  warning: {
    en: 'Schedule on a non-key-quality endurance day. Allow 6-8h before next aerobic session.',
    tr: 'Anahtar kaliteli aerobik günden farklı bir günde planla. Sonraki aerobik seansa 6-8 saat bırak.',
  },
  citation: 'Rønnestad & Mujika 2014; Beattie et al. 2014',
}

const BUILD = {
  phase: 'Build',
  emphasis: {
    en: 'Power conversion: same lifts at lower load with explosive intent + plyometrics added.',
    tr: 'Güç dönüşümü: aynı hareketler düşük yükle patlayıcı niyetle + plyometrik eklenir.',
  },
  frequencyPerWeek: 2,
  sessionDurationMin: 45,
  movements: [
    {
      name: { en: 'Back squat (explosive)', tr: 'Arka skuat (patlayıcı)' },
      sets: 4,
      reps: '4-5',
      intensity: { en: '50-60% 1RM with maximal bar speed', tr: '%50-60 1RM, maksimal bar hızı' },
      notes: { en: 'Bar speed is the metric, not load.', tr: 'Yük değil, bar hızı ana metrik.' },
    },
    {
      name: { en: 'Trap-bar deadlift', tr: 'Trap-bar ölü kaldırma' },
      sets: 4,
      reps: '4-5',
      intensity: { en: '60-70% 1RM explosive', tr: '%60-70 1RM patlayıcı' },
      notes: { en: 'Lower-injury alternative to conventional DL.', tr: 'Klasik DL\'ye göre düşük sakatlanma riski.' },
    },
    {
      name: { en: 'Box jumps', tr: 'Kutu atlama' },
      sets: 4,
      reps: '5',
      intensity: { en: 'Max height controlled landing', tr: 'Maks yükseklik, kontrollü iniş' },
      notes: { en: 'Step down between reps; never jump down.', tr: 'Tekrarlar arasında in; asla atlama.' },
    },
    {
      name: { en: 'Single-leg hop drills', tr: 'Tek-bacak sıçrama drilleri' },
      sets: 3,
      reps: '6 each leg',
      intensity: { en: 'Body weight, max effort', tr: 'Vücut ağırlığı, maks efor' },
      notes: { en: 'Builds rate of force development.', tr: 'Güç gelişim oranını artırır.' },
    },
    {
      name: { en: 'Med-ball slams', tr: 'Sağlık topu vurma' },
      sets: 3,
      reps: '8',
      intensity: { en: '4-6kg ball, max velocity', tr: '4-6kg top, maks hız' },
      notes: { en: 'Trunk power transfer.', tr: 'Gövde güç aktarımı.' },
    },
  ],
  warning: {
    en: 'Plyometrics need 48h between sessions and dry surfaces. Skip if fatigued.',
    tr: 'Plyometrik 48s ara ve kuru zemin gerektirir. Yorgunsa atla.',
  },
  citation: 'Rønnestad & Mujika 2014; Sáez de Villarreal et al. 2010',
}

const PEAK = {
  phase: 'Peak',
  emphasis: {
    en: 'Maintenance: minimum effective dose to preserve gains while race-specific work dominates.',
    tr: 'Koruma: yarışa-özel çalışma ağır basarken kazanımları korumaya yetecek minimum doz.',
  },
  frequencyPerWeek: 1,
  sessionDurationMin: 30,
  movements: [
    {
      name: { en: 'Back squat', tr: 'Arka skuat' },
      sets: 2,
      reps: '4-5',
      intensity: { en: '70-75% 1RM', tr: '%70-75 1RM' },
      notes: { en: 'Quality over quantity.', tr: 'Nicelikten çok nitelik.' },
    },
    {
      name: { en: 'Romanian deadlift', tr: 'Romen ölü kaldırma' },
      sets: 2,
      reps: '5',
      intensity: { en: '70% 1RM', tr: '%70 1RM' },
      notes: { en: 'Maintain pattern.', tr: 'Hareket kalıbını koru.' },
    },
    {
      name: { en: 'Single-leg work (split squat or step-up)', tr: 'Tek-bacak (split squat veya step-up)' },
      sets: 2,
      reps: '6 each leg',
      intensity: { en: 'Body weight + light dumbbells', tr: 'Vücut ağırlığı + hafif dumbell' },
      notes: { en: 'Asymmetry check.', tr: 'Asimetri kontrolü.' },
    },
    {
      name: { en: 'Plank variations', tr: 'Plank varyasyonları' },
      sets: 2,
      reps: '30s each',
      intensity: { en: 'Body weight', tr: 'Vücut ağırlığı' },
      notes: { en: 'Quick maintenance.', tr: 'Hızlı koruma.' },
    },
  ],
  warning: {
    en: 'Drop strength entirely if endurance load high or feeling overreached.',
    tr: 'Dayanıklılık yükü çoksa veya overreach hissediyorsan kuvveti tamamen bırak.',
  },
  citation: 'Rønnestad & Mujika 2014',
}

const TAPER = {
  phase: 'Taper',
  emphasis: {
    en: 'Neural priming only — short, fast, low fatigue. Optional in race week.',
    tr: 'Sadece nöral hazırlık — kısa, hızlı, düşük yorgunluk. Yarış haftasında opsiyonel.',
  },
  frequencyPerWeek: 1,
  sessionDurationMin: 20,
  movements: [
    {
      name: { en: 'Box jumps (low height)', tr: 'Kutu atlama (düşük)' },
      sets: 2,
      reps: '3',
      intensity: { en: 'Body weight, knee-height box', tr: 'Vücut ağırlığı, diz yüksekliğinde kutu' },
      notes: { en: 'Wake the system without fatigue.', tr: 'Sistemi yorgunluk yaratmadan uyandır.' },
    },
    {
      name: { en: 'Bodyweight squat with jump', tr: 'Sıçramalı vücut-ağırlığı skuat' },
      sets: 2,
      reps: '5',
      intensity: { en: 'Body weight, max velocity', tr: 'Vücut ağırlığı, maks hız' },
      notes: { en: 'Concentric-focused, no eccentric overload.', tr: 'Konsantrik odaklı, eksantrik yüklenme yok.' },
    },
    {
      name: { en: 'Light core (plank, dead bug)', tr: 'Hafif core (plank, dead bug)' },
      sets: 1,
      reps: '30s each',
      intensity: { en: 'Body weight', tr: 'Vücut ağırlığı' },
      notes: { en: 'Activation only.', tr: 'Sadece aktivasyon.' },
    },
  ],
  warning: {
    en: 'Skip strength entirely in the final 5-7 days before race day.',
    tr: 'Yarış gününden önceki son 5-7 günde kuvveti tamamen atla.',
  },
  citation: 'Mujika 2003; Rønnestad & Mujika 2014',
}

/**
 * @public
 * @param {{ phases: Array<{phase:string}> }} input
 * @returns {Record<string, StrengthPhasePlan>}
 */
export function buildStrengthProgram(input) {
  const present = new Set((input?.phases || []).map(p => p.phase))
  const out = {}
  if (present.has('Base'))  out.Base  = BASE
  if (present.has('Build')) out.Build = BUILD
  if (present.has('Peak'))  out.Peak  = PEAK
  if (present.has('Taper')) out.Taper = TAPER
  return out
}

export const STRENGTH_CITATION = 'Rønnestad & Mujika 2014; Beattie et al. 2014; Sáez de Villarreal et al. 2010'
