// src/lib/athlete/detectPRs.js — E6: Personal record detection
// Pure function — checks whether a new session sets any personal record
// against the full training log history.
//
// PR categories:
//   longest_session   — longest single session in minutes
//   highest_tss       — highest single-session TSS
//   weekly_tss        — highest weekly TSS (week of the session)
//   longest_streak    — most consecutive days with at least one session
//   highest_rpe_tss   — highest TSS at a given RPE level (shows fitness gain)
//   power_peak_1min   — highest power (W) averaged over 1 min
//   power_peak_5min   — highest power (W) averaged over 5 min
//   power_peak_20min  — highest power (W) averaged over 20 min
//   power_peak_60min  — highest power (W) averaged over 60 min
//
// Returns only PRs that are genuinely new (strictly better than all prior sessions).
// "Prior" = all sessions in the log BEFORE the current session's date.

const DURATION_PR_MIN = 30   // minimum session length to qualify for longest_session PR

/**
 * Compute the week key (ISO week start, Monday) for a date string 'YYYY-MM-DD'.
 * @param {string} dateStr
 * @returns {string}  YYYY-MM-DD of the Monday of that week
 */
export function weekStart(dateStr) {
  const d = new Date(dateStr)
  const day = d.getDay()  // 0=Sun..6=Sat
  const offset = day === 0 ? -6 : 1 - day   // shift to Monday
  const mon = new Date(d)
  mon.setDate(d.getDate() + offset)
  const y = mon.getFullYear()
  const m = String(mon.getMonth() + 1).padStart(2, '0')
  const dd = String(mon.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/**
 * Compute weekly TSS totals from the log.
 * @param {Array} log  - sorted training_log entries
 * @returns {Object}  { 'YYYY-MM-DD': totalTSS, ... }
 */
function weeklyTSSMap(log) {
  const map = {}
  for (const s of log) {
    if (!s.date) continue
    const key = weekStart(s.date)
    map[key] = (map[key] || 0) + (s.tss || 0)
  }
  return map
}

/**
 * Compute the longest consecutive training streak up to (and including) the given date.
 * @param {Set<string>} dateset  - set of YYYY-MM-DD strings
 * @param {string} upTo  - end date inclusive
 * @returns {number}
 */
function streakUpTo(dateset, upTo) {
  let streak = 0
  const d = new Date(upTo)
  while (dateset.has(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/**
 * Detect personal records set by a new session against prior history.
 *
 * @param {Object} newSession  - the session just logged: { date, type, duration, rpe, tss, powerPeaks? }
 * @param {Array}  priorLog    - all sessions BEFORE this date (sorted oldest-first)
 * @returns {Array<{ category: string, value: number, prev: number|null, en: string, tr: string }>}
 */
export function detectPRs(newSession, priorLog = []) {
  if (!newSession || !newSession.date) return []

  const prs = []
  const prior = priorLog.filter(s => s.date < newSession.date)

  // ── 1. Longest single session ─────────────────────────────────────────────
  const dur = Number(newSession.duration) || 0
  if (dur >= DURATION_PR_MIN) {
    const prevMax = prior.reduce((m, s) => Math.max(m, Number(s.duration) || 0), 0)
    if (dur > prevMax) {
      prs.push({
        category: 'longest_session',
        value: dur,
        prev: prevMax || null,
        en: `Longest session: ${dur} min${prevMax ? ` (previous: ${prevMax} min)` : ' — first session of this length!'}`,
        tr: `En uzun antrenman: ${dur} dk${prevMax ? ` (önceki: ${prevMax} dk)` : ' — bu uzunlukta ilk antrenman!'}`,
      })
    }
  }

  // ── 2. Highest single-session TSS ────────────────────────────────────────
  const tss = Number(newSession.tss) || 0
  if (tss > 0) {
    const prevMax = prior.reduce((m, s) => Math.max(m, Number(s.tss) || 0), 0)
    if (tss > prevMax) {
      prs.push({
        category: 'highest_tss',
        value: tss,
        prev: prevMax || null,
        en: `Highest single-session TSS: ${tss}${prevMax ? ` (previous: ${prevMax})` : ''}`,
        tr: `En yüksek tek antrenman TSS: ${tss}${prevMax ? ` (önceki: ${prevMax})` : ''}`,
      })
    }
  }

  // ── 3. Highest weekly TSS ────────────────────────────────────────────────
  if (tss > 0) {
    const thisWeek = weekStart(newSession.date)
    // Sum TSS for the same week (including this session)
    const weekTotal = tss + (priorLog
      .filter(s => s.date && weekStart(s.date) === thisWeek)
      .reduce((m, s) => m + (Number(s.tss) || 0), 0))

    // Max weekly TSS from all prior weeks
    const priorWeeks = weeklyTSSMap(prior)
    const prevWeekMax = Object.values(priorWeeks).reduce((m, v) => Math.max(m, v), 0)
    if (weekTotal > prevWeekMax && prevWeekMax > 0) {
      prs.push({
        category: 'weekly_tss',
        value: weekTotal,
        prev: prevWeekMax,
        en: `Highest training week: ${Math.round(weekTotal)} TSS (previous: ${Math.round(prevWeekMax)})`,
        tr: `En yüksek antrenman haftası: ${Math.round(weekTotal)} TSS (önceki: ${Math.round(prevWeekMax)})`,
      })
    }
  }

  // ── 4. Longest consecutive streak ────────────────────────────────────────
  const allDates = new Set([...prior.map(s => s.date), newSession.date].filter(Boolean))
  const streak = streakUpTo(allDates, newSession.date)
  const prevBestStreak = computeMaxStreak(prior.map(s => s.date).filter(Boolean))
  if (streak > prevBestStreak && streak >= 3) {
    prs.push({
      category: 'longest_streak',
      value: streak,
      prev: prevBestStreak || null,
      en: `${streak}-day training streak — longest ever!`,
      tr: `${streak} günlük antrenman serisi — en uzun rekor!`,
    })
  }

  // ── 5. Power peaks (if powerPeaks provided) ───────────────────────────────
  const peaks = newSession.powerPeaks  // { 1: W, 5: W, 20: W, 60: W }
  if (peaks && typeof peaks === 'object') {
    for (const [minKey, label] of [['1','1min'],['5','5min'],['20','20min'],['60','60min']]) {
      const val = Number(peaks[minKey]) || 0
      if (val <= 0) continue
      const prevMax = prior
        .map(s => Number(s.powerPeaks?.[minKey]) || 0)
        .reduce((m, v) => Math.max(m, v), 0)
      if (val > prevMax) {
        prs.push({
          category: `power_peak_${label.replace('min','min')}`,
          value: val,
          prev: prevMax || null,
          en: `New ${label} power best: ${val}W${prevMax ? ` (previous: ${prevMax}W)` : ''}`,
          tr: `Yeni ${label} güç rekoru: ${val}W${prevMax ? ` (önceki: ${prevMax}W)` : ''}`,
        })
      }
    }
  }

  return prs
}

/**
 * Compute the all-time longest streak from a list of date strings.
 * Used to check whether the current streak exceeds the historical best.
 * @param {string[]} dates  - array of 'YYYY-MM-DD' strings (need not be sorted)
 * @returns {number}
 */
export function computeMaxStreak(dates) {
  if (!dates.length) return 0
  const sorted = [...new Set(dates)].sort()
  let maxStreak = 1, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diff = Math.round((curr - prev) / 86400000)
    if (diff === 1) {
      cur++
      maxStreak = Math.max(maxStreak, cur)
    } else {
      cur = 1
    }
  }
  return maxStreak
}

/**
 * Format PRs as a short summary line (1 PR → the PR, multiple → count).
 * @param {Array} prs
 * @param {string} lang
 * @returns {string|null}
 */
export function formatPRSummary(prs, lang = 'en') {
  if (!prs.length) return null
  if (prs.length === 1) return prs[0][lang === 'tr' ? 'tr' : 'en']
  return lang === 'tr'
    ? `Bu antrenman ${prs.length} kişisel rekor kırdı.`
    : `This session set ${prs.length} personal records.`
}
