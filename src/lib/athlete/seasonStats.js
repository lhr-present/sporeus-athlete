// Annual training summary: totals, sport breakdown, best week, streaks.
// No external citations needed — pure aggregation.

/**
 * weekMonday(dateStr): returns the ISO Monday date (YYYY-MM-DD) for a given date string.
 */
export function weekMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = (day === 0 ? -6 : 1 - day)
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  return monday.toISOString().slice(0, 10)
}

/**
 * computeSeasonStats: aggregates a training log for a given year.
 */
export function computeSeasonStats(log = [], year = new Date().getFullYear()) {
  const yearStr = String(year)
  const entries = log.filter(e => e.date && String(e.date).startsWith(yearStr))

  const skeleton = {
    year,
    totalSessions: 0,
    totalDistanceKm: 0,
    totalDurationMin: 0,
    totalTSS: 0,
    avgSessionsPerWeek: 0,
    sportBreakdown: [],
    bestWeek: null,
    longestSession: null,
    currentStreak: 0,
    maxStreak: 0,
    activeWeeks: 0,
    totalWeeks: 0,
  }

  if (entries.length === 0) {
    skeleton.totalWeeks = _totalWeeksForYear(year)
    return skeleton
  }

  // Normalize entries
  const normalized = entries.map(e => {
    const sport = e.sport_type || e.sport || 'general'
    const distanceKm = e.distance > 0 ? e.distance / 1000 : 0
    const raw = e.duration || 0
    const durationMin = raw > 600 ? raw / 60 : raw
    const tss = e.tss || 0
    return { ...e, sport, distanceKm, durationMin, tss, date: e.date }
  })

  const totalSessions = normalized.length
  const totalDistanceKm = parseFloat(normalized.reduce((s, e) => s + e.distanceKm, 0).toFixed(1))
  const totalDurationMin = Math.round(normalized.reduce((s, e) => s + e.durationMin, 0))
  const totalTSS = Math.round(normalized.reduce((s, e) => s + e.tss, 0))

  // Sport breakdown
  const sportMap = {}
  for (const e of normalized) {
    if (!sportMap[e.sport]) {
      sportMap[e.sport] = { sport: e.sport, sessions: 0, distanceKm: 0, durationMin: 0 }
    }
    sportMap[e.sport].sessions += 1
    sportMap[e.sport].distanceKm += e.distanceKm
    sportMap[e.sport].durationMin += e.durationMin
  }
  const sportBreakdown = Object.values(sportMap)
    .sort((a, b) => b.sessions - a.sessions)
    .map(s => ({
      sport: s.sport,
      sessions: s.sessions,
      distanceKm: parseFloat(s.distanceKm.toFixed(1)),
      durationMin: Math.round(s.durationMin),
      pct: parseFloat((s.sessions / totalSessions * 100).toFixed(1)),
    }))

  // Best week (highest TSS)
  const weekMap = {}
  for (const e of normalized) {
    const wk = weekMonday(e.date)
    if (!weekMap[wk]) {
      weekMap[wk] = { weekStart: wk, tss: 0, sessions: 0, distanceKm: 0 }
    }
    weekMap[wk].tss += e.tss
    weekMap[wk].sessions += 1
    weekMap[wk].distanceKm += e.distanceKm
  }
  const weeks = Object.values(weekMap)
  let bestWeek = null
  if (weeks.length > 0) {
    const bw = weeks.reduce((best, w) => w.tss > best.tss ? w : best, weeks[0])
    bestWeek = {
      weekStart: bw.weekStart,
      tss: Math.round(bw.tss),
      sessions: bw.sessions,
      distanceKm: parseFloat(bw.distanceKm.toFixed(1)),
    }
  }

  // Longest session
  let longestSession = null
  if (normalized.length > 0) {
    const ls = normalized.reduce((best, e) => e.durationMin > best.durationMin ? e : best, normalized[0])
    longestSession = {
      date: ls.date,
      durationMin: Math.round(ls.durationMin),
      sport: ls.sport,
      distanceKm: parseFloat(ls.distanceKm.toFixed(1)),
    }
  }

  // Streak computation
  const sessionDates = new Set(normalized.map(e => e.date.slice(0, 10)))
  const today = new Date().toISOString().slice(0, 10)

  // currentStreak: count backward from today; break when no session on a day
  let currentStreak = 0
  let cursor = new Date(today + 'T00:00:00Z')
  // start from today; if no session today, try yesterday
  if (!sessionDates.has(today)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  while (true) {
    const ds = cursor.toISOString().slice(0, 10)
    if (!ds.startsWith(yearStr)) break
    if (sessionDates.has(ds)) {
      currentStreak++
      cursor.setUTCDate(cursor.getUTCDate() - 1)
    } else {
      break
    }
  }

  // maxStreak: longest consecutive-day streak in the year
  const allDates = [...sessionDates].filter(d => d.startsWith(yearStr)).sort()
  let maxStreak = 0
  let runStreak = 0
  let prevDate = null
  for (const d of allDates) {
    if (prevDate === null) {
      runStreak = 1
    } else {
      const prev = new Date(prevDate + 'T00:00:00Z')
      const curr = new Date(d + 'T00:00:00Z')
      const diffDays = Math.round((curr - prev) / 86400000)
      if (diffDays === 1) {
        runStreak++
      } else {
        runStreak = 1
      }
    }
    if (runStreak > maxStreak) maxStreak = runStreak
    prevDate = d
  }

  // activeWeeks
  const activeWeeks = Object.keys(weekMap).length

  // totalWeeks
  const totalWeeks = _totalWeeksForYear(year)

  // avgSessionsPerWeek
  const divisor = totalWeeks > 0 ? totalWeeks : 1
  const avgSessionsPerWeek = parseFloat((totalSessions / divisor).toFixed(1))

  return {
    year,
    totalSessions,
    totalDistanceKm,
    totalDurationMin,
    totalTSS,
    avgSessionsPerWeek,
    sportBreakdown,
    bestWeek,
    longestSession,
    currentStreak,
    maxStreak,
    activeWeeks,
    totalWeeks,
  }
}

function _totalWeeksForYear(year) {
  const now = new Date()
  const currentYear = now.getFullYear()
  if (year < currentYear) return 52
  // weeks from Jan 1 to today
  const jan1 = new Date(year + '-01-01T00:00:00Z')
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z')
  const diffMs = today - jan1
  const diffDays = Math.floor(diffMs / 86400000)
  return Math.max(1, Math.ceil((diffDays + 1) / 7))
}

/**
 * topSportByVolume: returns sport with highest distanceKm.
 * Falls back to highest sessions if all distanceKm === 0.
 * Returns 'general' if sportBreakdown is empty.
 */
export function topSportByVolume(seasonStats) {
  const bd = seasonStats?.sportBreakdown
  if (!bd || bd.length === 0) return 'general'
  const hasDistance = bd.some(s => s.distanceKm > 0)
  if (hasDistance) {
    return bd.reduce((best, s) => s.distanceKm > best.distanceKm ? s : best, bd[0]).sport
  }
  // fallback to highest sessions (already sorted desc by sessions)
  return bd[0].sport
}
