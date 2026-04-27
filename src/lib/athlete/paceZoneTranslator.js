// src/lib/athlete/paceZoneTranslator.js — E86
// Multi-modal zone translator: pace + HR + RPE + feel + format for all 5 Daniels zones.
// Every zone is described in 6 dimensions so athletes know HOW it should feel, not just how fast.
//
// HR zones sourced from Friel (2009) & Coggan (2003):
//   E 60–79% maxHR | M 80–87% | T 88–92% | I 93–97% | R >97%
// RPE on CR-10 scale (Borg 1982).
// Sources: Daniels (2014) ch.3, Seiler (2010), Friel (2009), Coggan (2003).

import { trainingPaces } from '../sport/running.js'

// sec/km → "M:SS" string
function fmtPace(secKm) {
  if (!secKm || secKm <= 0) return '--:--'
  const m = Math.floor(secKm / 60)
  const s = Math.round(secKm % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const ZONE_META = {
  E: {
    label:      'Easy',
    labelTR:    'Kolay',
    hrLowPct:   0.60,
    hrHighPct:  0.79,
    rpeRange:   '1–4',
    color:      '#0064ff',
    feelEN:     'Fully conversational. You could sing.',
    feelTR:     'Konuşabilir, nefes normal. Çok rahat.',
    purposeEN:  'Aerobic base, recovery, capillary development (Daniels ch.3)',
    purposeTR:  'Aerobik taban, kapiller gelişim, toparlanma',
    formatEN:   '20–90 min continuous or long run. No HR ceiling anxiety.',
    formatTR:   '20–90 dk sürekli veya uzun koşu. HR tavanı kaygısı yok.',
  },
  M: {
    label:      'Marathon',
    labelTR:    'Maraton',
    hrLowPct:   0.80,
    hrHighPct:  0.87,
    rpeRange:   '5–6',
    color:      '#00cc44',
    feelEN:     'Controlled. Sentences possible but labored.',
    feelTR:     'Kontrollü. Kısa cümleler kurulabilir.',
    purposeEN:  'Marathon-specific endurance, fat oxidation at race intensity',
    purposeTR:  'Maraton dayanıklılığı, yarış yoğunluğunda yağ yakımı',
    formatEN:   '30–45 min continuous at goal marathon pace. Part of long run.',
    formatTR:   '30–45 dk sürekli, hedef maraton hızında. Uzun koşunun parçası.',
  },
  T: {
    label:      'Threshold',
    labelTR:    'Eşik',
    hrLowPct:   0.88,
    hrHighPct:  0.92,
    rpeRange:   '6–7',
    color:      '#ff6600',
    feelEN:     'Comfortably hard. 20-min race effort. Controlled breathing.',
    feelTR:     'Rahatsız edici ama kontrollü. 20 dakikalık yarış hissi.',
    purposeEN:  'Raise lactate threshold — the most time-efficient zone (Daniels 2014)',
    purposeTR:  'Laktat eşiğini yükseltir — en verimli antrenman bölgesi',
    formatEN:   '20 min continuous T-run, OR 3×10 min with 3 min E jog between.',
    formatTR:   '20 dk sürekli VEYA 3×10 dk, aralarında 3 dk kolay koşu.',
  },
  I: {
    label:      'Interval',
    labelTR:    'İnterval',
    hrLowPct:   0.93,
    hrHighPct:  0.97,
    rpeRange:   '8–9',
    color:      '#ff2244',
    feelEN:     'Hard. 5K race effort. Breathing forced. Single words only.',
    feelTR:     'Zor. 5K yarış çabası. Nefes zorunlu. Tek kelimeler.',
    purposeEN:  'VO₂max stimulus — 3–5 min bouts maximize time at VO₂max (Daniels 2014)',
    purposeTR:  'VO₂maks uyarımı — 3–5 dakikalık seriler VO₂maks süresini artırır',
    formatEN:   '4–6 × 1000m at I pace, rest = rep time. Total ≤ 8% weekly vol.',
    formatTR:   '4–6 × 1000m I hızında, dinlenme = tekrar süresi. Toplam ≤ haftalık hacmin %8i.',
  },
  R: {
    label:      'Repetition',
    labelTR:    'Tekrar',
    hrLowPct:   0.97,
    hrHighPct:  1.00,
    rpeRange:   '9–10',
    color:      '#cc44ff',
    feelEN:     'Max sprint. Economy and speed. Full recovery between reps.',
    feelTR:     'Maksimum sprint. Ekonomi ve hız. Tekrarlar arası tam toparlanma.',
    purposeEN:  'Running economy, neuromuscular power, stride mechanics (Daniels ch.3)',
    purposeTR:  'Koşu ekonomisi, nöromüsküler güç, adım mekaniği',
    formatEN:   '200–400m reps at R pace. Rest 2–4× rep time. Total ≤ 5% weekly vol.',
    formatTR:   '200–400m tekrarlar R hızında. Dinlenme = 2–4× tekrar süresi. Toplam ≤ haftalık hacmin %5i.',
  },
}

/**
 * Translate a single Daniels zone with full multi-modal output.
 *
 * @param {'E'|'M'|'T'|'I'|'R'} zone
 * @param {object} paces   Result of trainingPaces(vdot) — { E, M, T, I, R } in sec/km
 * @param {number} [maxHR] Optional. Athlete's max HR (bpm). If omitted, HR ranges show as '%' only.
 * @returns {object}
 */
export function translatePaceZone(zone, paces, maxHR) {
  const meta = ZONE_META[zone]
  if (!meta || !paces?.[zone]) return null

  const secKm = paces[zone]
  const low   = maxHR ? Math.round(maxHR * meta.hrLowPct)  : null
  const high  = maxHR ? Math.round(maxHR * meta.hrHighPct) : null

  const hrRange = {
    lowPct:  Math.round(meta.hrLowPct  * 100),
    highPct: Math.round(meta.hrHighPct * 100),
    low,
    high,
    str: low && high
      ? `${low}–${high} bpm (${Math.round(meta.hrLowPct*100)}–${Math.round(meta.hrHighPct*100)}% HRmax)`
      : `${Math.round(meta.hrLowPct*100)}–${Math.round(meta.hrHighPct*100)}% HRmax`,
  }

  return {
    zone,
    label:      meta.label,
    labelTR:    meta.labelTR,
    pace:       fmtPace(secKm),
    paceSecKm:  secKm,
    hrRange,
    rpeRange:   meta.rpeRange,
    color:      meta.color,
    feelEN:     meta.feelEN,
    feelTR:     meta.feelTR,
    purposeEN:  meta.purposeEN,
    purposeTR:  meta.purposeTR,
    formatEN:   meta.formatEN,
    formatTR:   meta.formatTR,
  }
}

/**
 * Translate all 5 Daniels zones for a given VDOT.
 *
 * @param {number} vdot
 * @param {number} [maxHR]
 * @returns {{ E, M, T, I, R } | null}  Each key holds a translatePaceZone result object.
 */
export function translateAllZones(vdot, maxHR) {
  const paces = trainingPaces(vdot)
  if (!paces) return null

  return {
    E: translatePaceZone('E', paces, maxHR),
    M: translatePaceZone('M', paces, maxHR),
    T: translatePaceZone('T', paces, maxHR),
    I: translatePaceZone('I', paces, maxHR),
    R: translatePaceZone('R', paces, maxHR),
  }
}
