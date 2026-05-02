// E123 Race-Week Protocol Generator — pure 7-day protocol leading up to race day.
//
// Given a race date + race type + athlete CTL, produce a structured 7-day plan
// covering session intent, sleep, nutrition, mental cues, and gear checklist.
//
// Source: Mujika I., Padilla S. (2003) Med Sci Sports Exerc 35:1182–1187;
//         Bompa T.O. (2005) Periodization Training for Sports.
//
// Pure function — no IO, no React, no Supabase. UTC date math only.

const CITATION = 'Mujika & Padilla 2003; Bompa 2005'

const VALID_RACE_TYPES = new Set([
  '5K',
  '10K',
  'Half Marathon',
  'Marathon',
  '2000m Row',
])

// ── UTC date helpers ────────────────────────────────────────────────────────
function isValidIsoDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return false
  return d.toISOString().slice(0, 10) === s
}

function addUTCDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── per-race-type 7-day session templates (D-6 .. D-0) ──────────────────────
// dayOffset semantics: -6 = 6 days before race, 0 = race day.
// Each session: { intent, duration (min), rpeLow, rpeHigh, description: {en,tr} }
// or null for full rest days.
const SESSION_TEMPLATES = {
  '5K': [
    { // D-6
      intent: 'easy',
      duration: 30,
      rpeLow: 3,
      rpeHigh: 4,
      description: {
        en: 'Easy aerobic 30min',
        tr: 'Kolay aerobik 30dk',
      },
    },
    { // D-5
      intent: 'race-pace intervals',
      duration: 35,
      rpeLow: 7,
      rpeHigh: 8,
      description: {
        en: 'Race-pace 4x2min with 2min easy recovery',
        tr: 'Yarış temposu 4x2dk arası 2dk kolay',
      },
    },
    null, // D-4 rest
    { // D-3
      intent: 'easy + strides',
      duration: 30,
      rpeLow: 3,
      rpeHigh: 6,
      description: {
        en: 'Easy 25min + 4x100m strides',
        tr: 'Kolay 25dk + 4x100m sürat çalışması',
      },
    },
    null, // D-2 rest (Friday)
    { // D-1
      intent: 'shakeout',
      duration: 18,
      rpeLow: 3,
      rpeHigh: 5,
      description: {
        en: 'Shakeout 15min + 2x100m pickups',
        tr: 'Hafif koşu 15dk + 2x100m hızlanma',
      },
    },
    { // D-0 RACE
      intent: 'RACE',
      duration: 25,
      rpeLow: 9,
      rpeHigh: 10,
      description: {
        en: 'RACE: 5K — execute pacing plan',
        tr: 'YARIŞ: 5K — pacing planını uygula',
      },
    },
  ],

  '10K': [
    { // D-6
      intent: 'easy',
      duration: 40,
      rpeLow: 3,
      rpeHigh: 4,
      description: {
        en: 'Easy aerobic 40min',
        tr: 'Kolay aerobik 40dk',
      },
    },
    { // D-5
      intent: 'race-pace intervals',
      duration: 40,
      rpeLow: 7,
      rpeHigh: 8,
      description: {
        en: 'Race-pace 5x3min with 2min easy recovery',
        tr: 'Yarış temposu 5x3dk arası 2dk kolay',
      },
    },
    null, // D-4 rest
    { // D-3
      intent: 'easy + strides',
      duration: 35,
      rpeLow: 3,
      rpeHigh: 6,
      description: {
        en: 'Easy 30min + 4x100m strides',
        tr: 'Kolay 30dk + 4x100m sürat çalışması',
      },
    },
    null, // D-2 rest (Friday)
    { // D-1
      intent: 'shakeout',
      duration: 20,
      rpeLow: 3,
      rpeHigh: 5,
      description: {
        en: 'Shakeout 20min easy',
        tr: 'Hafif koşu 20dk',
      },
    },
    { // D-0 RACE
      intent: 'RACE',
      duration: 50,
      rpeLow: 8,
      rpeHigh: 10,
      description: {
        en: 'RACE: 10K — execute pacing plan',
        tr: 'YARIŞ: 10K — pacing planını uygula',
      },
    },
  ],

  'Half Marathon': [
    { // D-6
      intent: 'easy',
      duration: 50,
      rpeLow: 3,
      rpeHigh: 4,
      description: {
        en: 'Easy aerobic 50min',
        tr: 'Kolay aerobik 50dk',
      },
    },
    { // D-5
      intent: 'tempo',
      duration: 45,
      rpeLow: 6,
      rpeHigh: 7,
      description: {
        en: 'Tempo 4x5min @ Half Marathon pace, 2min easy between',
        tr: 'Tempo 4x5dk yarı maraton temposunda, arası 2dk kolay',
      },
    },
    { // D-4
      intent: 'easy',
      duration: 30,
      rpeLow: 3,
      rpeHigh: 4,
      description: {
        en: 'Easy aerobic 30min',
        tr: 'Kolay aerobik 30dk',
      },
    },
    { // D-3
      intent: 'easy + strides',
      duration: 30,
      rpeLow: 3,
      rpeHigh: 6,
      description: {
        en: 'Easy 25min + 4x100m strides',
        tr: 'Kolay 25dk + 4x100m sürat çalışması',
      },
    },
    null, // D-2 rest (Friday)
    { // D-1
      intent: 'shakeout',
      duration: 25,
      rpeLow: 3,
      rpeHigh: 5,
      description: {
        en: 'Shakeout 25min easy',
        tr: 'Hafif koşu 25dk',
      },
    },
    { // D-0 RACE
      intent: 'RACE',
      duration: 110,
      rpeLow: 7,
      rpeHigh: 9,
      description: {
        en: 'RACE: Half Marathon — execute pacing plan',
        tr: 'YARIŞ: Yarı Maraton — pacing planını uygula',
      },
    },
  ],

  'Marathon': [
    { // D-6
      intent: 'easy',
      duration: 60,
      rpeLow: 3,
      rpeHigh: 4,
      description: {
        en: 'Easy aerobic 60min',
        tr: 'Kolay aerobik 60dk',
      },
    },
    { // D-5
      intent: 'marathon pace',
      duration: 50,
      rpeLow: 5,
      rpeHigh: 7,
      description: {
        en: '30min @ Marathon pace within an easy run',
        tr: 'Kolay koşu içinde 30dk maraton temposu',
      },
    },
    { // D-4
      intent: 'easy',
      duration: 40,
      rpeLow: 3,
      rpeHigh: 4,
      description: {
        en: 'Easy aerobic 40min',
        tr: 'Kolay aerobik 40dk',
      },
    },
    { // D-3
      intent: 'easy + strides',
      duration: 35,
      rpeLow: 3,
      rpeHigh: 6,
      description: {
        en: 'Easy 30min + 4x100m strides',
        tr: 'Kolay 30dk + 4x100m sürat çalışması',
      },
    },
    null, // D-2 rest (Friday)
    { // D-1
      intent: 'shakeout',
      duration: 30,
      rpeLow: 3,
      rpeHigh: 5,
      description: {
        en: 'Shakeout 30min very easy',
        tr: 'Çok hafif koşu 30dk',
      },
    },
    { // D-0 RACE
      intent: 'RACE',
      duration: 240,
      rpeLow: 6,
      rpeHigh: 9,
      description: {
        en: 'RACE: Marathon — execute pacing & fueling plan',
        tr: 'YARIŞ: Maraton — pacing ve beslenme planını uygula',
      },
    },
  ],

  '2000m Row': [
    { // D-6
      intent: 'easy UT2',
      duration: 30,
      rpeLow: 3,
      rpeHigh: 4,
      description: {
        en: 'Easy 30min UT2 steady state',
        tr: 'Kolay 30dk UT2 sürekli kürek',
      },
    },
    { // D-5
      intent: 'race-pace intervals',
      duration: 35,
      rpeLow: 8,
      rpeHigh: 9,
      description: {
        en: '4x500m @ 2K race pace, 3min rest',
        tr: '4x500m 2K yarış temposunda, arası 3dk dinlenme',
      },
    },
    { // D-4
      intent: 'easy UT2',
      duration: 25,
      rpeLow: 3,
      rpeHigh: 4,
      description: {
        en: 'Easy 25min UT2 steady state',
        tr: 'Kolay 25dk UT2 sürekli kürek',
      },
    },
    { // D-3
      intent: 'sharpener',
      duration: 25,
      rpeLow: 7,
      rpeHigh: 9,
      description: {
        en: '2x500m @ race pace + 1x250m sharpener',
        tr: '2x500m yarış temposunda + 1x250m keskinleştirici',
      },
    },
    null, // D-2 rest (Friday)
    { // D-1
      intent: 'activation',
      duration: 10,
      rpeLow: 2,
      rpeHigh: 4,
      description: {
        en: '10min activation: easy paddle + 3x10 strokes building',
        tr: '10dk aktivasyon: kolay kürek + 3x10 çekiş yükselen',
      },
    },
    { // D-0 RACE
      intent: 'RACE',
      duration: 8,
      rpeLow: 9,
      rpeHigh: 10,
      description: {
        en: 'RACE: 2000m Row — execute split plan',
        tr: 'YARIŞ: 2000m Kürek — split planını uygula',
      },
    },
  ],
}

// ── sleep targets (Mah 2011; Fullagar 2015) ─────────────────────────────────
function sleepFor(dayOffset) {
  if (dayOffset === -2) {
    return {
      targetHours: 8.5,
      note: {
        en: 'Most important sleep night (research: 2 nights pre-race matters most)',
        tr: 'En önemli uyku gecesi (araştırma: yarıştan 2 gece önce en önemli)',
      },
    }
  }
  if (dayOffset === -1) {
    return {
      targetHours: 8,
      note: {
        en: "Don't stress if you can't sleep — Friday's sleep matters more",
        tr: 'Uyuyamazsan üzülme — Cuma uykusu daha önemli',
      },
    }
  }
  if (dayOffset === 0) {
    return {
      targetHours: 7,
      note: {
        en: 'Honor recovery',
        tr: 'Toparlanmaya saygı göster',
      },
    }
  }
  // D-6, D-5, D-4, D-3
  return {
    targetHours: 8,
    note: {
      en: 'Build sleep debt buffer',
      tr: 'Uyku rezervi oluştur',
    },
  }
}

// ── nutrition cues per dayOffset ────────────────────────────────────────────
function nutritionFor(dayOffset) {
  if (dayOffset <= -4) {
    return [{ en: 'Normal eating', tr: 'Normal beslenme' }]
  }
  if (dayOffset === -3) {
    return [{
      en: 'Begin carb-load (60-70% carbs)',
      tr: 'Karbo yüklemeye başla (60-70% karbohidrat)',
    }]
  }
  if (dayOffset === -2 || dayOffset === -1) {
    return [{
      en: 'Carb-load + hydration check',
      tr: 'Karbo yükleme + hidrasyon kontrolü',
    }]
  }
  // D-0
  return [{
    en: 'Race morning: carb breakfast 3h pre-race, sip water until 30min before',
    tr: 'Yarış sabahı: 3 saat önce karbohidrat kahvaltısı, yarıştan 30 dk öncesine kadar yudumla',
  }]
}

// ── mental cues per dayOffset ───────────────────────────────────────────────
function mentalFor(dayOffset) {
  switch (dayOffset) {
    case -3:
      return [{
        en: 'Visualize 1 successful race segment',
        tr: '1 başarılı yarış bölümünü canlandır',
      }]
    case -2:
      return [{
        en: 'Review pacing plan',
        tr: 'Pacing planını gözden geçir',
      }]
    case -1:
      return [{
        en: 'Lay out gear, plan timeline',
        tr: 'Kıyafetleri çıkar, zamanı planla',
      }]
    case 0:
      return [{
        en: 'Trust the work — race day is a celebration',
        tr: 'Çalışmana güven — yarış günü bir kutlama',
      }]
    default:
      return []
  }
}

// ── gear checklist (overall, race-type aware) ───────────────────────────────
function gearChecklistFor(raceType) {
  const base = [
    { en: 'Race kit (shorts, top, socks, shoes — all tested)',
      tr: 'Yarış kıyafeti (short, üst, çorap, ayakkabı — hepsi test edilmiş)' },
    { en: 'GPS watch charged + workout uploaded',
      tr: 'GPS saat dolu + antrenman yüklenmiş' },
    { en: 'Race nutrition (gels, salt, drinks)',
      tr: 'Yarış beslenmesi (jeller, tuz, içecekler)' },
    { en: 'Bib + safety pins (or magnets)',
      tr: 'Numara + iğne (veya mıknatıs)' },
    { en: 'Backup transport plan',
      tr: 'Yedek ulaşım planı' },
  ]
  if (raceType === 'Marathon' || raceType === 'Half Marathon') {
    base.push({
      en: 'Body glide / anti-chafe',
      tr: 'Vücut yağı / sürtünme önleyici',
    })
  }
  if (raceType === '2000m Row') {
    base.push({
      en: 'Concept2 PM5 calibration check',
      tr: 'Concept2 PM5 kalibrasyon kontrolü',
    })
  }
  return base
}

// ── TSS distribution across the 7 days ──────────────────────────────────────
// Spec: weekly taper TSS = 0.6 × CTL.
// Distribution (approximate): 30% Mon-Tue, 25% Wed-Thu, 5% Fri, 15% Sat, 25% Sun.
// Map to dayOffset (D-6=Mon … D-0=Sun):
//   D-6 (Mon) 0.15, D-5 (Tue) 0.15,
//   D-4 (Wed) 0.125, D-3 (Thu) 0.125,
//   D-2 (Fri) 0.05,
//   D-1 (Sat) 0.15,
//   D-0 (Sun) 0.25
const TSS_FRACTION_BY_OFFSET = {
  '-6': 0.15,
  '-5': 0.15,
  '-4': 0.125,
  '-3': 0.125,
  '-2': 0.05,
  '-1': 0.15,
  '0':  0.25,
}

function tssTargetFor(dayOffset, sessionTemplate, currentCTL) {
  // Rest day → 0
  if (sessionTemplate === null) return 0
  const weeklyTSS = 0.6 * currentCTL
  const fraction = TSS_FRACTION_BY_OFFSET[String(dayOffset)] ?? 0
  return Math.round(weeklyTSS * fraction)
}

/**
 * Generate a 7-day race-week protocol leading up to race day (D-day).
 *
 * Day index convention:
 *   D-6 .. D-1 = days before race
 *   D-0        = race day
 *
 * @param {Object} input
 * @param {string} input.raceDate          - YYYY-MM-DD
 * @param {string} input.raceType          - '5K' | '10K' | 'Half Marathon' | 'Marathon' | '2000m Row'
 * @param {number} [input.currentCTL]      - athlete CTL going into the week (defaults to 50)
 * @param {string} [input.lang]            - 'en' | 'tr' for output language (default 'en' but messages are always bilingual {en,tr})
 * @returns {Object|null} structured protocol (see file docs) or null on invalid input
 * @source Mujika & Padilla 2003; Bompa 2005
 */
export function generateRaceWeekProtocol(input) {
  if (!input || typeof input !== 'object') return null

  const { raceDate, raceType } = input
  const currentCTL = typeof input.currentCTL === 'number' && Number.isFinite(input.currentCTL) && input.currentCTL > 0
    ? input.currentCTL
    : 50

  if (!isValidIsoDate(raceDate)) return null
  if (!VALID_RACE_TYPES.has(raceType)) return null

  const template = SESSION_TEMPLATES[raceType]
  if (!template || template.length !== 7) return null

  const protocol = []
  for (let i = 0; i < 7; i++) {
    const dayOffset = i - 6                      // -6 .. 0
    const date      = addUTCDays(raceDate, dayOffset)
    const tpl       = template[i]

    let session = null
    if (tpl !== null) {
      session = {
        intent:      tpl.intent,
        duration:    tpl.duration,
        rpeLow:      tpl.rpeLow,
        rpeHigh:     tpl.rpeHigh,
        tssTarget:   tssTargetFor(dayOffset, tpl, currentCTL),
        description: { en: tpl.description.en, tr: tpl.description.tr },
      }
    }

    protocol.push({
      dayOffset,
      date,
      session,
      sleep:     sleepFor(dayOffset),
      nutrition: nutritionFor(dayOffset),
      mental:    mentalFor(dayOffset),
    })
  }

  return {
    raceType,
    raceDate,
    protocol,
    gearChecklist: gearChecklistFor(raceType),
    citation: CITATION,
  }
}
