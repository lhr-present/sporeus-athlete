// src/lib/athlete/aRaceCountdown.js
//
// Pure fn: surface a 28-day A-race countdown + taper-window state for
// TodayView. Reads from either `multiPeakSeason.races` (new multi-race
// users) or `profile.raceDate` (legacy single-race users).
//
// Taper-window bands grounded in Bompa 2009 / Mujika 2003 / Issurin 2010:
//   - BUILD       15-28 d  — final hard block before taper
//   - TAPER        8-14 d  — volume drop, intensity preserved
//   - RACE_WEEK    1- 7 d  — final tune-up week
//   - RACE_DAY        0 d  — race today
//   - OUT_OF_WINDOW > 28 d — no surface (returns null)
//
// Anything past the race date or with no race at all → null.

import { getProfileRaceDate } from '../validate.js'

export const A_RACE_COUNTDOWN_CITATION = 'Bompa 2009; Mujika 2003; Issurin 2010'

const MS_PER_DAY = 86400000

function parseISO(s) {
  if (!s || typeof s !== 'string') return null
  const d = new Date(s + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

function todayUTC(today) {
  if (today instanceof Date) {
    if (Number.isNaN(today.getTime())) return null
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  }
  if (typeof today === 'string' && today) {
    return parseISO(today.slice(0, 10))
  }
  if (today == null) {
    const n = new Date()
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
  }
  return null
}

function bandFor(days) {
  if (days < 0) return null
  if (days === 0) return 'RACE_DAY'
  if (days <= 7) return 'RACE_WEEK'
  if (days <= 14) return 'TAPER'
  if (days <= 28) return 'BUILD'
  return 'OUT_OF_WINDOW'
}

function pickNearestARace(multiPeakSeason, todayDate) {
  if (!multiPeakSeason || typeof multiPeakSeason !== 'object') return null
  const races = Array.isArray(multiPeakSeason.races) ? multiPeakSeason.races : null
  if (!races || races.length === 0) return null
  let best = null
  for (const r of races) {
    if (!r || r.priority !== 'A') continue
    const d = parseISO(r.date)
    if (!d) continue
    if (d.getTime() < todayDate.getTime()) continue
    if (best == null || d.getTime() < best.date.getTime()) {
      best = { date: d, label: typeof r.label === 'string' ? r.label : null, iso: r.date }
    }
  }
  return best
}

/**
 * Compute a 28-day A-race countdown + taper-window state.
 *
 * @param {{
 *   profile?: { raceDate?: string, nextRaceDate?: string } | null,
 *   multiPeakSeason?: { races?: Array<{ date: string, label?: string|null, priority: 'A'|'B'|'C' }> } | null,
 *   today?: string | Date
 * }} input
 *
 * @returns {{
 *   daysToRace: number,
 *   raceDate: string,
 *   raceName: string|null,
 *   taperWindow: 'BUILD'|'TAPER'|'RACE_WEEK'|'RACE_DAY'
 * } | null}
 */
export function computeARaceCountdown(input) {
  const opts = input && typeof input === 'object' ? input : {}
  const today = todayUTC(opts.today)
  if (!today) return null

  // 1) Prefer A-race from multiPeakSeason (multi-race source-of-truth)
  const aRace = pickNearestARace(opts.multiPeakSeason, today)
  let raceDateD = aRace?.date || null
  let raceName = aRace?.label || null
  let raceDateISO = aRace?.iso || null

  // 2) Fallback to profile.raceDate
  if (!raceDateD) {
    const profRD = getProfileRaceDate(opts.profile || null)
    const d = parseISO(profRD)
    if (!d) return null
    if (d.getTime() < today.getTime()) return null
    raceDateD = d
    raceDateISO = profRD
    raceName = null
  }

  const daysToRace = Math.floor((raceDateD.getTime() - today.getTime()) / MS_PER_DAY)
  if (daysToRace < 0) return null
  const taperWindow = bandFor(daysToRace)
  if (!taperWindow || taperWindow === 'OUT_OF_WINDOW') return null

  return {
    daysToRace,
    raceDate: raceDateISO,
    raceName,
    taperWindow,
  }
}
