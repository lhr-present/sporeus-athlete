// src/lib/coach/morningBriefing.js — E5: Morning briefing generator
// Pure function — takes a squad array, returns bilingual flag list + summary.
// Used by both the edge function (server-side email) and the dashboard card.
//
// Flag triggers (ordered by severity):
//   1. ACWR > 1.5  — injury risk
//   2. HRV drop > 20% below 7-day mean — overreach signal
//   3. Missed 3+ consecutive sessions — dropout risk
//   4. New injury logged today
//   5. Test result improved > 3% — celebration
//   6. TSB < -30 — overreaching risk

const ACWR_DANGER   = 1.5
const HRV_DROP_PCT  = 0.20   // 20% below 7d mean
const MISS_STREAK   = 3       // consecutive missed sessions
const TSB_OVERREACH = -30
const TEST_PR_PCT   = 0.03    // 3% improvement

/**
 * @typedef {Object} AthleteSnapshot
 * @property {string} id
 * @property {string} name
 * @property {number} [acwr]           - current ACWR ratio
 * @property {number} [tsb]            - current TSB
 * @property {number} [hrvToday]       - today's HRV
 * @property {number} [hrv7dMean]      - 7-day HRV mean
 * @property {number} [missedStreak]   - consecutive days without session
 * @property {boolean} [newInjury]     - injury logged today
 * @property {number} [testDeltaPct]   - latest test improvement vs previous (e.g. 0.05 = +5%)
 */

/**
 * Generate flags for a single athlete.
 * @param {AthleteSnapshot} athlete
 * @returns {Array<{ level: 'critical'|'warning'|'info', code: string, en: string, tr: string }>}
 */
export function flagAthlete(athlete) {
  const flags = []

  if (athlete.acwr != null && athlete.acwr > ACWR_DANGER) {
    flags.push({
      level: 'critical',
      code: 'acwr_danger',
      en: `ACWR ${athlete.acwr.toFixed(2)} — above 1.5 injury-risk threshold. Reduce load this week.`,
      tr: `AAKÖ ${athlete.acwr.toFixed(2)} — 1.5 sakatlanma riski eşiği üzerinde. Bu hafta yükü azalt.`,
    })
  }

  if (athlete.hrvToday != null && athlete.hrv7dMean != null && athlete.hrv7dMean > 0) {
    const drop = (athlete.hrv7dMean - athlete.hrvToday) / athlete.hrv7dMean
    if (drop >= HRV_DROP_PCT) {
      flags.push({
        level: 'warning',
        code: 'hrv_drop',
        en: `HRV dropped ${Math.round(drop * 100)}% below 7-day mean (${athlete.hrvToday} vs ${Math.round(athlete.hrv7dMean)}). Consider reducing today's intensity.`,
        tr: `KAD ${Math.round(drop * 100)}% düştü — 7 günlük ortalama altında (${athlete.hrvToday} / ${Math.round(athlete.hrv7dMean)}). Bugünkü yoğunluğu azaltmayı düşün.`,
      })
    }
  }

  if (athlete.missedStreak != null && athlete.missedStreak >= MISS_STREAK) {
    flags.push({
      level: 'warning',
      code: 'missed_streak',
      en: `${athlete.missedStreak} consecutive sessions missed. Check in with athlete.`,
      tr: `Art arda ${athlete.missedStreak} antrenman kaçırıldı. Atletle iletişime geç.`,
    })
  }

  if (athlete.newInjury) {
    flags.push({
      level: 'critical',
      code: 'new_injury',
      en: 'New injury logged today. Review training plan.',
      tr: 'Bugün yeni sakatlık kaydedildi. Antrenman planını gözden geçir.',
    })
  }

  if (athlete.tsb != null && athlete.tsb < TSB_OVERREACH) {
    flags.push({
      level: 'warning',
      code: 'tsb_overreach',
      en: `TSB ${athlete.tsb} — below -30 (Coggan overreaching zone). Schedule a recovery week.`,
      tr: `TSF ${athlete.tsb} — -30 altında (Coggan aşırı yüklenme bölgesi). Bir toparlanma haftası planla.`,
    })
  }

  if (athlete.testDeltaPct != null && athlete.testDeltaPct >= TEST_PR_PCT) {
    flags.push({
      level: 'info',
      code: 'test_pr',
      en: `Test result improved ${Math.round(athlete.testDeltaPct * 100)}% — new personal best.`,
      tr: `Test sonucu %${Math.round(athlete.testDeltaPct * 100)} arttı — kişisel rekor.`,
    })
  }

  return flags
}

/**
 * Generate the full morning briefing for a squad.
 * @param {AthleteSnapshot[]} squad
 * @param {string} lang  - 'en' | 'tr'
 * @param {string} [coachName]
 * @returns {{ summary: string, flagged: Array<{ athlete: AthleteSnapshot, flags: Array }>, allGreen: boolean }}
 */
export function generateMorningBriefing(squad, lang = 'en', coachName = '') {
  if (!Array.isArray(squad) || squad.length === 0) {
    return {
      summary: lang === 'tr'
        ? 'Henüz bağlı atlet yok.'
        : 'No athletes connected yet.',
      flagged: [],
      allGreen: true,
    }
  }

  const flagged = []
  for (const athlete of squad) {
    const flags = flagAthlete(athlete)
    if (flags.length > 0) {
      flagged.push({ athlete, flags })
    }
  }

  // Sort: critical first, then warning, then info
  const LEVELS = { critical: 0, warning: 1, info: 2 }
  flagged.sort((a, b) => {
    const aLevel = Math.min(...a.flags.map(f => LEVELS[f.level]))
    const bLevel = Math.min(...b.flags.map(f => LEVELS[f.level]))
    return aLevel - bLevel
  })

  const critCount = flagged.reduce((n, { flags }) => n + flags.filter(f => f.level === 'critical').length, 0)
  const warnCount = flagged.reduce((n, { flags }) => n + flags.filter(f => f.level === 'warning').length, 0)
  const infoCount = flagged.reduce((n, { flags }) => n + flags.filter(f => f.level === 'info').length, 0)

  const allGreen = flagged.length === 0

  let summary
  if (lang === 'tr') {
    if (allGreen) {
      summary = `${coachName ? coachName + ', ' : ''}${squad.length} atletin hepsi normalin içinde. İyi bir gün.`
    } else {
      const parts = []
      if (critCount > 0) parts.push(`${critCount} kritik`)
      if (warnCount > 0) parts.push(`${warnCount} uyarı`)
      if (infoCount > 0) parts.push(`${infoCount} bilgi`)
      summary = `${squad.length} atletten ${flagged.length} tanesi dikkat gerektiriyor: ${parts.join(', ')}.`
    }
  } else {
    if (allGreen) {
      summary = `${coachName ? coachName + ', ' : ''}all ${squad.length} athletes are in normal range. Good day ahead.`
    } else {
      const parts = []
      if (critCount > 0) parts.push(`${critCount} critical`)
      if (warnCount > 0) parts.push(`${warnCount} warning${warnCount > 1 ? 's' : ''}`)
      if (infoCount > 0) parts.push(`${infoCount} update${infoCount > 1 ? 's' : ''}`)
      summary = `${flagged.length} of ${squad.length} athletes need attention: ${parts.join(', ')}.`
    }
  }

  return { summary, flagged, allGreen }
}
