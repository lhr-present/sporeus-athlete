// ─── eliteProgramRecovery.js — Per-phase recovery prescription ──────────────
//
// Sleep targets, easy-day pace cap, HRV trigger thresholds, deload cadence,
// and modality recommendations. Per Halson 2019 (sleep), Kellmann 2018
// (recovery science), Plews & Buchheit 2017 (HRV), Bompa 2009 (deload).
//
// All bilingual EN+TR. Pure data — no React.

/**
 * @typedef {{ en: string, tr: string }} Bilingual
 * @typedef {{
 *   phase: string,
 *   sleepHoursTarget: [number, number],
 *   easyDayPaceCapPctOfHRmax: number,
 *   hrvDropTriggerPct: number,
 *   deloadEvery: number,
 *   modalities: Bilingual[],
 *   warningSigns: Bilingual[],
 *   citation: string
 * }} RecoveryPhasePlan
 */

const BASE = {
  phase: 'Base',
  sleepHoursTarget: [7, 9],
  easyDayPaceCapPctOfHRmax: 75,
  hrvDropTriggerPct: 7,
  deloadEvery: 4,
  modalities: [
    { en: 'Easy walks 20-30 min on rest days.', tr: 'Dinlenme günlerinde 20-30 dk kolay yürüyüş.' },
    { en: 'Foam rolling 10 min daily; focus calves, glutes, IT band.', tr: 'Günlük 10 dk foam roller; baldır, kalça, IT bandı odaklı.' },
    { en: 'Mobility 2x/week (10-15 min): hips, ankles, thoracic spine.', tr: 'Haftada 2x mobilite (10-15 dk): kalça, ayak bileği, torasik omurga.' },
  ],
  warningSigns: [
    { en: 'HRV drop >7% from 7-day baseline.', tr: '7 günlük baz değerden HRV >%7 düşüş.' },
    { en: 'Resting HR up >5 bpm sustained 3+ days.', tr: 'Dinlenme HR 5+ atım yüksek, 3+ gün sürekli.' },
    { en: 'Persistent leg heaviness despite easy days.', tr: 'Kolay günlere rağmen ısrarlı bacak ağırlığı.' },
  ],
  citation: 'Halson 2019; Plews & Buchheit 2017; Bompa 2009',
}

const BUILD = {
  phase: 'Build',
  sleepHoursTarget: [8, 9],
  easyDayPaceCapPctOfHRmax: 72,
  hrvDropTriggerPct: 5,
  deloadEvery: 4,
  modalities: [
    { en: 'Easy walks or 20 min Z1 spin on rest days.', tr: 'Dinlenme günleri kolay yürüyüş veya 20 dk Z1 dönüş.' },
    { en: 'Foam rolling daily; +contrast shower post-key sessions.', tr: 'Günlük foam roller; anahtar seans sonrası kontrastlı duş.' },
    { en: 'Mobility 3x/week (15 min). Add hip-flexor work for desk workers.', tr: 'Haftada 3x mobilite (15 dk). Masa başı çalışanlar için kalça-fleksör eklensin.' },
    { en: 'Sports massage every 2-3 weeks if available.', tr: 'Mümkünse 2-3 haftada bir spor masajı.' },
  ],
  warningSigns: [
    { en: 'HRV drop >5% sustained 3+ days = drop intensity.', tr: 'HRV >%5 düşüş 3+ gün sürerse şiddeti azalt.' },
    { en: 'Sleep efficiency <85% multiple nights.', tr: 'Birden fazla gece uyku verimliliği <%85.' },
    { en: 'Mood disturbance or motivation drop on key sessions.', tr: 'Anahtar seanslarda motivasyon düşüşü veya ruh hali değişimi.' },
  ],
  citation: 'Halson 2019; Plews & Buchheit 2017; Kellmann 2018',
}

const PEAK = {
  phase: 'Peak',
  sleepHoursTarget: [8.5, 9.5],
  easyDayPaceCapPctOfHRmax: 70,
  hrvDropTriggerPct: 5,
  deloadEvery: 3,
  modalities: [
    { en: '20 min Z1 spin or walk on rest days; never bed-rest.', tr: 'Dinlenme günleri 20 dk Z1 dönüş veya yürüyüş; yatakta dinlenme değil.' },
    { en: 'Daily foam rolling + contrast shower post-key sessions.', tr: 'Günlük foam roller + anahtar seans sonrası kontrastlı duş.' },
    { en: 'Mobility 3-4x/week.', tr: 'Haftada 3-4x mobilite.' },
    { en: 'Pre-bed routine: dim lights 60 min before sleep, no screens.', tr: 'Uyku öncesi rutin: 60 dk önce ışıkları kıs, ekran yok.' },
  ],
  warningSigns: [
    { en: 'HRV drop >5% = mandatory easy day, pull next intensity.', tr: 'HRV >%5 düşüş = zorunlu kolay gün, sonraki şiddet seansını ileri al.' },
    { en: 'Inability to hit pace targets on consecutive sessions.', tr: 'Ardışık seanslarda tempo hedeflerine ulaşamamak.' },
    { en: 'Sleep <7 h on >2 nights/week = adjust schedule.', tr: 'Haftada 2+ gece <7 sa uyku = programı ayarla.' },
  ],
  citation: 'Halson 2019; Plews & Buchheit 2017; Kellmann 2018',
}

const TAPER = {
  phase: 'Taper',
  sleepHoursTarget: [9, 10],
  easyDayPaceCapPctOfHRmax: 70,
  hrvDropTriggerPct: 5,
  deloadEvery: 0,
  modalities: [
    { en: 'Sleep is the #1 priority; protect 9+ hours.', tr: 'Uyku 1 numaralı öncelik; 9+ saati koru.' },
    { en: 'No new modalities. No deep-tissue massage <72h pre-race.', tr: 'Yeni modalite ekleme. Yarıştan <72 sa önce derin doku masajı yapma.' },
    { en: 'Mobility/stretching short and gentle.', tr: 'Mobilite/esneme kısa ve nazik.' },
    { en: 'Mental rehearsal 5-10 min/day.', tr: 'Günde 5-10 dk zihinsel prova.' },
  ],
  warningSigns: [
    { en: 'HRV swings are normal in taper; do not over-react.', tr: 'Taper\'da HRV salınımları normaldir; aşırı tepki verme.' },
    { en: 'Phantom symptoms common — only act on objective data.', tr: 'Hayali belirtiler yaygın — sadece nesnel veriye göre hareket et.' },
  ],
  citation: 'Mujika 2003; Halson 2019',
}

// v9.13.0 — TSS-scaled sleep target. Walker 2017 + Mah 2011: each ~10% CTL
// increase warrants ~30 min additional sleep. Base TSS ~250-350 → 8-9.5h;
// elite blocks at 400-500 → 9-10.5h. Floor at phase baseline; ceiling +1.5h.
function computeRecoverySleepTarget(phase, weeklyTSS) {
  const base = phase === 'Base' ? [7, 9] : phase === 'Build' ? [8, 9] : phase === 'Peak' ? [8.5, 9.5] : [9, 10]
  const peakTSS = Math.max(0, ...((weeklyTSS || []).filter(n => Number.isFinite(n))))
  if (!peakTSS || peakTSS <= 0) return base
  // Each 100 TSS over 250 adds 0.5h; capped at +1.5h.
  const extra = Math.min(1.5, Math.max(0, (peakTSS - 250) / 100) * 0.5)
  return [
    Math.round((base[0] + extra) * 10) / 10,
    Math.round((base[1] + extra) * 10) / 10,
  ]
}

// v9.13.0 — Contrast bath + compression modalities. Halson 2014 meta-analysis:
// 38°C/10°C × 5 min × 5 cycles reduces DOMS 20-40% post-hard work. Hill 2014:
// graduated compression sleeves accelerate recovery between sessions.
const CONTRAST_BATH = {
  en: 'Contrast bath/shower (40°C / 15°C × 3 min warm / 1 min cold × 5 cycles) post-hard sessions, 2x/week.',
  tr: 'Kontrast banyo/duş (40°C / 15°C × 3 dk sıcak / 1 dk soğuk × 5 döngü) sert seans sonrası, haftada 2x.',
}
const COMPRESSION = {
  en: 'Graduated compression sleeves/socks during recovery walks + 2-4h post-key-session window.',
  tr: 'Toparlanma yürüyüşlerinde + anahtar seans sonrası 2-4 sa boyunca kademeli kompresyon manşon/çorap.',
}
const SAUNA_BUILD = {
  en: 'Sauna 15-20 min × 3x/week post-easy days (Scoon 2007: heat acclimation + recovery).',
  tr: 'Sauna 15-20 dk × haftada 3x kolay gün sonrası (Scoon 2007: sıcaklık adaptasyonu + toparlanma).',
}

/**
 * @public
 * @param {{ phases: Array<{phase:string}>, weeklyTSS?: number[], cohort?: ('beginner'|'intermediate'|'elite') }} input
 * @returns {Record<string, RecoveryPhasePlan>}
 */
export function buildRecoveryProgram(input) {
  const present = new Set((input?.phases || []).map(p => p.phase))
  const weeklyTSS = input?.weeklyTSS || []
  const cohort = input?.cohort || null
  const out = {}
  // v9.13.0 — augment phase plans with TSS-scaled sleep + contrast/compression.
  // Cohort gates sauna (intermediate+) and sets compression frequency.
  const augment = (plan) => {
    const sleep = computeRecoverySleepTarget(plan.phase, weeklyTSS)
    const modalities = [...plan.modalities]
    // Add contrast bath + compression to Build/Peak by default.
    if (plan.phase === 'Build' || plan.phase === 'Peak') {
      modalities.push(CONTRAST_BATH, COMPRESSION)
      if (cohort === 'intermediate' || cohort === 'elite') {
        modalities.push(SAUNA_BUILD)
      }
    } else if (plan.phase === 'Base' && (cohort === 'intermediate' || cohort === 'elite')) {
      // Elite/intermediate athletes already train hard enough in Base to benefit.
      modalities.push(COMPRESSION)
    }
    return {
      ...plan,
      sleepHoursTarget: sleep,
      modalities,
      ...(cohort ? { cohort } : {}),
    }
  }
  if (present.has('Base'))  out.Base  = augment(BASE)
  if (present.has('Build')) out.Build = augment(BUILD)
  if (present.has('Peak'))  out.Peak  = augment(PEAK)
  if (present.has('Taper')) out.Taper = augment(TAPER)
  return out
}

export { computeRecoverySleepTarget }

export const RECOVERY_CITATION = 'Halson 2019; Kellmann 2018; Plews & Buchheit 2017; Bompa 2009; Mujika 2003; Walker 2017; Mah 2011; Halson 2014; Hill 2014; Scoon 2007'
