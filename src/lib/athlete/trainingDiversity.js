// ─── trainingDiversity.js — Multi-Sport Variety Detector (28d window) ───────
// Measures sport-mix diversity (run/bike/swim/strength/other) over 28d.
// Distinct from sessionVariety.js (intent variety): a triathlete may have
// rich intent mix but only train one sport, OR vice versa. This surface
// targets triathletes (balanced run/bike/swim), injury-prone runners
// (cross-training), and strength-work tracking against cardio dominance.
// Bompa & Haff 2009 (multi-sport periodization); Tonnessen 2014 (variety).
// ─────────────────────────────────────────────────────────────────────────────

export const TRAINING_DIVERSITY_CITATION =
  'Bompa & Haff 2009 multi-sport; Tonnessen 2014 polarized + variety'

const SPORTS = ['run', 'bike', 'swim', 'strength', 'other']

const SPORT_LABELS = {
  run: { en: 'run', tr: 'koşu' },
  bike: { en: 'bike', tr: 'bisiklet' },
  swim: { en: 'swim', tr: 'yüzme' },
  strength: { en: 'strength', tr: 'güç' },
  other: { en: 'activity', tr: 'aktivite' },
}

const RUN_RE = /run|jog|trail/i
const BIKE_RE = /bike|cycl|ride|spin/i
const SWIM_RE = /swim/i
const STRENGTH_RE = /strength|gym|weight|lift|resistance/i

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Sport classification ────────────────────────────────────────────────────
function classifySport(entry) {
  const sportRaw = typeof entry?.sport === 'string' ? entry.sport : ''
  const typeRaw = typeof entry?.type === 'string' ? entry.type : ''
  const src = (sportRaw || typeRaw).toLowerCase()
  if (!src) return 'other'
  if (RUN_RE.test(src)) return 'run'
  if (BIKE_RE.test(src)) return 'bike'
  if (SWIM_RE.test(src)) return 'swim'
  if (STRENGTH_RE.test(src)) return 'strength'
  return 'other'
}

function emptyResult(reliable = false) {
  const minutesPerSport = { run: 0, bike: 0, swim: 0, strength: 0, other: 0 }
  const sessionsPerSport = { run: 0, bike: 0, swim: 0, strength: 0, other: 0 }
  const sharesPerSport = { run: 0, bike: 0, swim: 0, strength: 0, other: 0 }
  return {
    totalMinutes: 0,
    totalSessions: 0,
    minutesPerSport,
    sessionsPerSport,
    sharesPerSport,
    sportsActive: 0,
    sportsSubstantial: 0,
    dominantSport: null,
    herfindahlIndex: 0,
    band: 'monotypic',
    message: {
      en: 'Single-sport focus — activity only',
      tr: 'Tek-spor odaklı — sadece aktivite',
    },
    recommendation: {
      en: 'Add 1 weekly cross-training session (cycling, swim, or strength)',
      tr: 'Haftalık 1 çapraz antrenman ekle (bisiklet, yüzme veya güç)',
    },
    reliable,
    citation: TRAINING_DIVERSITY_CITATION,
  }
}

/**
 * Detect multi-sport training diversity in the trailing 28 days.
 *
 * Classifies each entry by SPORT (run, bike, swim, strength, other), then
 * computes minutes and session counts per sport, the Herfindahl concentration
 * index, and a band describing the diversity pattern.
 *
 * @param {Array} log - training_log entries
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 */
export function detectTrainingDiversity(
  log,
  today = new Date().toISOString().slice(0, 10),
) {
  if (!Array.isArray(log) || log.length === 0) {
    return emptyResult(false)
  }

  const start28 = addDaysStr(today, -27)
  const recent = log.filter(e => e?.date && e.date >= start28 && e.date <= today)

  const minutesPerSport = { run: 0, bike: 0, swim: 0, strength: 0, other: 0 }
  const sessionsPerSport = { run: 0, bike: 0, swim: 0, strength: 0, other: 0 }

  for (const entry of recent) {
    const sport = classifySport(entry)
    sessionsPerSport[sport] += 1
    const dur = Number(entry?.duration)
    if (Number.isFinite(dur) && dur > 0) {
      minutesPerSport[sport] += dur
    }
  }

  const totalSessions = SPORTS.reduce((s, k) => s + sessionsPerSport[k], 0)
  const totalMinutes = SPORTS.reduce((s, k) => s + minutesPerSport[k], 0)

  if (totalSessions === 0) {
    return emptyResult(false)
  }

  // Round minutes for display; herfindahl uses raw fractions.
  const minutesRounded = { run: 0, bike: 0, swim: 0, strength: 0, other: 0 }
  for (const k of SPORTS) minutesRounded[k] = Math.round(minutesPerSport[k])

  const sharesPerSport = { run: 0, bike: 0, swim: 0, strength: 0, other: 0 }
  if (totalMinutes > 0) {
    for (const k of SPORTS) {
      sharesPerSport[k] = Math.round((minutesPerSport[k] / totalMinutes) * 10) / 10
    }
  }

  const sportsActive = SPORTS.filter(k => sessionsPerSport[k] > 0).length
  const sportsSubstantial = totalMinutes > 0
    ? SPORTS.filter(k => minutesPerSport[k] / totalMinutes >= 0.10).length
    : 0

  // Dominant sport: max minutes; tiebreak by sessions then SPORTS order.
  let dominantSport = null
  if (totalMinutes > 0) {
    let best = -1
    for (const k of SPORTS) {
      if (minutesPerSport[k] > best) {
        best = minutesPerSport[k]
        dominantSport = k
      }
    }
  } else {
    let best = -1
    for (const k of SPORTS) {
      if (sessionsPerSport[k] > best) {
        best = sessionsPerSport[k]
        dominantSport = k
      }
    }
  }

  let herfindahlIndex = 0
  if (totalMinutes > 0) {
    let hhi = 0
    for (const k of SPORTS) {
      const share = minutesPerSport[k] / totalMinutes
      hhi += share * share
    }
    herfindahlIndex = Math.round(hhi * 1000) / 1000
  }

  const dominantShare = totalMinutes > 0 && dominantSport
    ? minutesPerSport[dominantSport] / totalMinutes
    : 0

  let band
  if (sportsActive <= 1) band = 'monotypic'
  else if (sportsActive >= 4 && dominantShare <= 0.50) band = 'fragmented'
  else if (sportsSubstantial >= 3) band = 'balanced'
  else if (sportsActive === 2) band = 'limited'
  else band = 'limited'

  let message, recommendation
  if (band === 'monotypic') {
    const lbl = SPORT_LABELS[dominantSport || 'other']
    message = {
      en: `Single-sport focus — ${lbl.en} only`,
      tr: `Tek-spor odaklı — sadece ${lbl.tr}`,
    }
    recommendation = {
      en: 'Add 1 weekly cross-training session (cycling, swim, or strength)',
      tr: 'Haftalık 1 çapraz antrenman ekle (bisiklet, yüzme veya güç)',
    }
  } else if (band === 'limited') {
    message = {
      en: 'Two sports active — add cross-training',
      tr: 'İki spor aktif — çapraz antrenman ekle',
    }
    recommendation = {
      en: 'Aim for 3+ active sports for injury resilience',
      tr: 'Yaralanma direnci için en az 3 aktif spor hedefle',
    }
  } else if (band === 'balanced') {
    message = {
      en: 'Balanced multi-sport mix',
      tr: 'Dengeli çoklu-spor karışımı',
    }
    recommendation = { en: '', tr: '' }
  } else {
    message = {
      en: 'Many sports, none dominant — focus needed',
      tr: 'Çok spor, hiçbiri baskın değil — odaklan',
    }
    recommendation = {
      en: 'Pick 2-3 priority sports; reduce dabbling',
      tr: '2-3 öncelikli spor seç; serpmeyi azalt',
    }
  }

  return {
    totalMinutes: Math.round(totalMinutes),
    totalSessions,
    minutesPerSport: minutesRounded,
    sessionsPerSport,
    sharesPerSport,
    sportsActive,
    sportsSubstantial,
    dominantSport,
    herfindahlIndex,
    band,
    message,
    recommendation,
    reliable: totalSessions >= 5,
    citation: TRAINING_DIVERSITY_CITATION,
  }
}
