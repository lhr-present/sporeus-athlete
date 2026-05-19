// src/lib/athlete/yearOverYear.js
// Year-over-year YTD comparison: this year's progression from Jan 1 to today vs
// the same calendar window of the previous year. Surfaces longitudinal
// progression that monthly/season cards cannot — block periodization (Issurin
// 2010) and elite endurance development (Tønnessen 2014) are long-horizon
// adaptations, so a same-calendar-day YoY view is the right lens.
//
// Pure module. No React, no I/O.
//
// Inputs:
//   log: array of training sessions, each shaped { date, durationMin, tss, ... }
//        — `date` is 'YYYY-MM-DD'.
//   today: ISO 'YYYY-MM-DD' string (defaults to the real today, UTC).
//
// Output: see analyzeYearOverYear() return shape, or `null` when there isn't
// enough data on either side to make a meaningful comparison.

const CITATION = 'Issurin 2010; Tønnessen 2014'

const AHEAD_THRESHOLD = 0.10
const BEHIND_THRESHOLD = -0.10

/**
 * Internal: aggregate a slice of the log into { sessions, minutes, tss }.
 */
function summarize(entries) {
  let sessions = 0
  let minutes = 0
  let tss = 0
  for (const e of entries) {
    sessions += 1
    minutes += Number(e?.durationMin) || 0
    tss += Number(e?.tss) || 0
  }
  return {
    sessions,
    minutes: Math.round(minutes),
    tss: Math.round(tss),
  }
}

/**
 * Internal: ratio delta, null when denominator is 0.
 */
function ratioDelta(thisYear, lastYear) {
  if (!lastYear) return null
  return (thisYear - lastYear) / lastYear
}

/**
 * Internal: aggregate trend = mean of the deltas that are non-null.
 * Returns null when no deltas are available.
 */
function aggregateDeltas(deltas) {
  const valid = deltas.filter(d => d != null && Number.isFinite(d))
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

/**
 * Internal: classify aggregate trend into AHEAD / MATCHING / BEHIND.
 */
function classifyBand(trend) {
  if (trend == null || !Number.isFinite(trend)) return 'MATCHING'
  if (trend >= AHEAD_THRESHOLD) return 'AHEAD'
  if (trend <= BEHIND_THRESHOLD) return 'BEHIND'
  return 'MATCHING'
}

/**
 * analyzeYearOverYear({ log, today })
 *
 * Compares year-to-date training volume against the same calendar window of
 * the previous year. Returns null when either side has too little data to be
 * useful (last year < 10 sessions OR this year 0 sessions).
 */
export function analyzeYearOverYear({ log, today } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const todayStr = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)
    ? today
    : new Date().toISOString().slice(0, 10)

  const year = Number(todayStr.slice(0, 4))
  const mmdd = todayStr.slice(5) // 'MM-DD'

  const thisYearStart = `${year}-01-01`
  const lastYearStart = `${year - 1}-01-01`
  const lastYearSameDay = `${year - 1}-${mmdd}`

  const thisYearYTD = log.filter(e => {
    const d = e?.date
    return typeof d === 'string' && d >= thisYearStart && d <= todayStr
  })
  const lastYearYTD = log.filter(e => {
    const d = e?.date
    return typeof d === 'string' && d >= lastYearStart && d <= lastYearSameDay
  })

  // Gating: need a meaningful baseline + at least one current-year session.
  if (lastYearYTD.length < 10) return null
  if (thisYearYTD.length === 0) return null

  const thisYear = summarize(thisYearYTD)
  const lastYear = summarize(lastYearYTD)

  const deltas = {
    sessions: ratioDelta(thisYear.sessions, lastYear.sessions),
    minutes:  ratioDelta(thisYear.minutes,  lastYear.minutes),
    tss:      ratioDelta(thisYear.tss,      lastYear.tss),
  }

  const aggregateTrend = aggregateDeltas([deltas.sessions, deltas.minutes, deltas.tss])
  const band = classifyBand(aggregateTrend)

  return {
    band,
    aggregateTrend,
    thisYear,
    lastYear,
    deltas,
    citation: CITATION,
  }
}

export default analyzeYearOverYear
