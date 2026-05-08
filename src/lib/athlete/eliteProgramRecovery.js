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

/**
 * @public
 * @param {{ phases: Array<{phase:string}> }} input
 * @returns {Record<string, RecoveryPhasePlan>}
 */
export function buildRecoveryProgram(input) {
  const present = new Set((input?.phases || []).map(p => p.phase))
  const out = {}
  if (present.has('Base'))  out.Base  = BASE
  if (present.has('Build')) out.Build = BUILD
  if (present.has('Peak'))  out.Peak  = PEAK
  if (present.has('Taper')) out.Taper = TAPER
  return out
}

export const RECOVERY_CITATION = 'Halson 2019; Kellmann 2018; Plews & Buchheit 2017; Bompa 2009; Mujika 2003'
