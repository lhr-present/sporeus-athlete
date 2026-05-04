// ─── raceWeekProtocol.js — Race-Week Taper Protocol Generator ───────────────
// Given an upcoming race date, generates a day-by-day taper plan for the
// final 7 days (D-7..D-0). Per Mujika & Padilla 2003: an exponential taper
// with 50-60% volume reduction while preserving intensity maximises pre-race
// performance. Bosquet 2007 meta-analysis confirms 8-14 day taper window.
// Cite: Mujika & Padilla 2003 (taper science); Bosquet 2007 (meta-analysis)
// ─────────────────────────────────────────────────────────────────────────────

export const RACE_WEEK_PROTOCOL_CITATION = 'Mujika & Padilla 2003; Bosquet 2007'

const DEFAULT_CTL = 50
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function diffDays(a, b) {
  const da = new Date(a + 'T00:00:00Z')
  const db = new Date(b + 'T00:00:00Z')
  return Math.round((da - db) / 86400000)
}

function todayStr() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function isValidDateStr(s) {
  if (typeof s !== 'string' || !ISO_DATE_RE.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  if (Number.isNaN(d.getTime())) return false
  return d.toISOString().slice(0, 10) === s
}

// ─── Taper template (Mujika & Padilla 2003 exponential taper) ────────────────
// Each entry: daysToRace -> { volPct of CTL, intensity, duration min, label, session, notes }
const TEMPLATE = {
  7: {
    volPct: 0.60,
    intensity: 'easy',
    durationMin: 50,
    label: { en: 'Day -7', tr: '-7. Gün' },
    session: {
      en: '60% volume base aerobic · %60 hacim aerobik temel',
      tr: '%60 hacim aerobik temel · 60% volume base aerobic',
    },
    notes: {
      en: 'Longest of the taper week — Z2 only.',
      tr: 'Taper haftasının en uzun günü — sadece Z2.',
    },
  },
  6: {
    volPct: 0.50,
    intensity: 'moderate',
    durationMin: 45,
    label: { en: 'Day -6', tr: '-6. Gün' },
    session: {
      en: 'Threshold-pace strides · Eşik tempo strides',
      tr: 'Eşik tempo strides · Threshold-pace strides',
    },
    notes: {
      en: '3-4 × 20 s strides @ race-pace; full recovery.',
      tr: '3-4 × 20 sn strides yarış-tempoda; tam toparlanma.',
    },
  },
  5: {
    volPct: 0.40,
    intensity: 'easy',
    durationMin: 35,
    label: { en: 'Day -5', tr: '-5. Gün' },
    session: {
      en: 'Easy aerobic · Kolay aerobik',
      tr: 'Kolay aerobik · Easy aerobic',
    },
    notes: {
      en: 'Conversational pace; legs should feel light.',
      tr: 'Sohbet tempo; bacaklar hafif hissetmeli.',
    },
  },
  4: {
    volPct: 0.10,
    intensity: 'rest',
    durationMin: 20,
    label: { en: 'Day -4', tr: '-4. Gün' },
    session: {
      en: 'Active recovery · Aktif toparlanma',
      tr: 'Aktif toparlanma · Active recovery',
    },
    notes: {
      en: 'Rest or 20 min walk/mobility. No load.',
      tr: 'Dinlenme veya 20 dk yürüyüş/mobilite. Yüklenme yok.',
    },
  },
  3: {
    volPct: 0.30,
    intensity: 'race-pace',
    durationMin: 30,
    label: { en: 'Day -3', tr: '-3. Gün' },
    session: {
      en: 'Race-pace activation · Yarış tempo aktivasyonu',
      tr: 'Yarış tempo aktivasyonu · Race-pace activation',
    },
    notes: {
      en: '3 × 3 min @ goal race-pace + 3 min easy between.',
      tr: '3 × 3 dk hedef yarış-tempoda + 3 dk kolay aralarda.',
    },
  },
  2: {
    volPct: 0.20,
    intensity: 'easy',
    durationMin: 20,
    label: { en: 'Day -2', tr: '-2. Gün' },
    session: {
      en: 'Sharpening shakeout · Keskinleştirici shake-out',
      tr: 'Keskinleştirici shake-out · Sharpening shakeout',
    },
    notes: {
      en: 'Easy 20 min + 4 × 20 s strides.',
      tr: 'Kolay 20 dk + 4 × 20 sn strides.',
    },
  },
  1: {
    volPct: 0.05,
    intensity: 'rest',
    durationMin: 15,
    label: { en: 'Day -1', tr: '-1. Gün' },
    session: {
      en: 'Rest or pre-race shakeout · Dinlenme veya yarış öncesi shake-out',
      tr: 'Dinlenme veya yarış öncesi shake-out · Rest or pre-race shakeout',
    },
    notes: {
      en: 'Optional 15 min very easy. Hydrate and sleep.',
      tr: 'İsteğe bağlı 15 dk çok kolay. Hidrasyon ve uyku.',
    },
  },
  0: {
    volPct: 0,
    intensity: 'race',
    durationMin: 0,
    label: { en: 'Race Day · Yarış Günü', tr: 'Yarış Günü · Race Day' },
    session: {
      en: 'Race day · Yarış günü',
      tr: 'Yarış günü · Race day',
    },
    notes: {
      en: 'Execute pacing plan. Trust the taper.',
      tr: 'Tempo planını uygula. Tapere güven.',
    },
  },
}

// ─── Top-line copy ───────────────────────────────────────────────────────────
function buildMessage(daysToRace) {
  if (daysToRace > 7) {
    return { en: 'Taper not yet started · Taper henüz başlamadı', tr: 'Taper henüz başlamadı · Taper not yet started' }
  }
  if (daysToRace === 0) {
    return { en: 'Race day · Yarış günü', tr: 'Yarış günü · Race day' }
  }
  if (daysToRace < 0) {
    return { en: 'Race complete · Yarış tamamlandı', tr: 'Yarış tamamlandı · Race complete' }
  }
  return {
    en: `Day -${daysToRace} of taper · Taper -${daysToRace}. günü`,
    tr: `Taper -${daysToRace}. günü · Day -${daysToRace} of taper`,
  }
}

function buildRecommendation(daysToRace) {
  const inWeek = daysToRace >= 0 && daysToRace <= 7
  if (inWeek) {
    return {
      en: 'Hold the taper. Sleep, hydration, race-pace cues only.',
      tr: 'Taperi koru. Uyku, hidrasyon, sadece yarış-tempo nüansları.',
    }
  }
  if (daysToRace < 0) {
    return {
      en: 'Recovery week ahead.',
      tr: 'Önümüzdeki hafta toparlanma.',
    }
  }
  return {
    en: 'Continue base build.',
    tr: 'Temel yapımına devam.',
  }
}

// ─── generateRaceWeekProtocol ────────────────────────────────────────────────
/**
 * Generate a Mujika-Padilla 2003 8-day taper plan (D-7..D-0) for a race.
 *
 * Volume reduces exponentially across the week (60→50→40→rest→30→20→rest→0)
 * while intensity is preserved via short race-pace touches (D-6 strides,
 * D-3 race-pace activation, D-2 sharpening). This matches the meta-analytic
 * sweet spot identified by Bosquet 2007 (8-14d taper, ~50% volume reduction).
 *
 * @param {Object} [profile] - optional; { recentCTL, primarySport }
 * @param {string} raceDate - 'YYYY-MM-DD' race date (required)
 * @param {Object} [options] - { today: 'YYYY-MM-DD' } override
 * @returns {{
 *   raceDate: string,
 *   daysToRace: number,
 *   inRaceWeek: boolean,
 *   days: Array<{
 *     date: string,
 *     daysToRace: number,
 *     label: { en: string, tr: string },
 *     session: { en: string, tr: string },
 *     tssTarget: number,
 *     durationMin: number,
 *     intensity: 'rest'|'easy'|'moderate'|'race-pace'|'race',
 *     notes: { en: string, tr: string },
 *   }>,
 *   totalTaperTSS: number,
 *   loadReductionPct: number,
 *   message: { en: string, tr: string },
 *   recommendation: { en: string, tr: string },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function generateRaceWeekProtocol(profile, raceDate, options = {}) {
  const today = options?.today || todayStr()

  const empty = {
    raceDate: typeof raceDate === 'string' ? raceDate : '',
    daysToRace: 0,
    inRaceWeek: false,
    days: [],
    totalTaperTSS: 0,
    loadReductionPct: 0,
    message: { en: 'Set a race date · Bir yarış tarihi belirle', tr: 'Bir yarış tarihi belirle · Set a race date' },
    recommendation: { en: 'Continue base build.', tr: 'Temel yapımına devam.' },
    reliable: false,
    citation: RACE_WEEK_PROTOCOL_CITATION,
  }

  if (!isValidDateStr(raceDate) || !isValidDateStr(today)) return empty

  const ctlRaw = Number(profile?.recentCTL)
  const haveCTL = Number.isFinite(ctlRaw) && ctlRaw > 0
  const ctl = haveCTL ? ctlRaw : DEFAULT_CTL

  const daysToRace = diffDays(raceDate, today)
  const inRaceWeek = daysToRace >= 0 && daysToRace <= 7

  // Build the 8-day plan D-7..D-0 regardless of where today falls.
  const days = []
  for (let d = 7; d >= 0; d--) {
    const tmpl = TEMPLATE[d]
    const tssTarget = Math.round(ctl * tmpl.volPct)
    days.push({
      date: addDaysStr(raceDate, -d),
      daysToRace: d,
      label: { ...tmpl.label },
      session: { ...tmpl.session },
      tssTarget,
      durationMin: tmpl.durationMin,
      intensity: tmpl.intensity,
      notes: { ...tmpl.notes },
    })
  }

  const totalTaperTSS = days.reduce((s, day) => s + day.tssTarget, 0)
  // Normal week ≈ 7 × CTL TSS. Reduction = 1 - (totalTaper / (7 × CTL))
  const baselineWeekTSS = 7 * ctl
  const loadReductionPct = baselineWeekTSS > 0
    ? Math.round((1 - totalTaperTSS / baselineWeekTSS) * 100)
    : 0

  return {
    raceDate,
    daysToRace,
    inRaceWeek,
    days,
    totalTaperTSS,
    loadReductionPct,
    message: buildMessage(daysToRace),
    recommendation: buildRecommendation(daysToRace),
    reliable: haveCTL,
    citation: RACE_WEEK_PROTOCOL_CITATION,
  }
}
