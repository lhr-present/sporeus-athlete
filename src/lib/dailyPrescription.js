// src/lib/dailyPrescription.js
// The prescription layer: profile + log + plan → what to do today.
// Builds on deriveAllMetrics (zones) + calculatePMC (TSB/CTL/ACWR).
// Closes the logger → coach gap.

import { calculatePMC, computeMonotony } from './trainingLoad.js'
import { getTodayPlannedSession } from './intelligence.js'
import { deriveAllMetrics } from './profileDerivedMetrics.js'

export function dailyPrescription(profile, log = [], plan = null, planStatus = {}, recovery = [], inMetrics = null) {
  const today = new Date().toISOString().slice(0, 10)
  const metrics = inMetrics || deriveAllMetrics(profile, log, [])

  // ── 1. PMC: CTL, ATL, TSB ──────────────────────────────────────────────
  const pmc = calculatePMC(log || [], 90, 0)
  const last = pmc?.length ? pmc[pmc.length - 1] : null
  const ctl  = last?.ctl  ?? 0
  const atl  = last?.atl  ?? 0
  const tsb  = last?.tsb  ?? 0

  // ── 2. ACWR ────────────────────────────────────────────────────────────
  // ACWR = ATL / CTL (if CTL > 0); Gabbett 2016
  const acwr = ctl > 0 ? Math.round((atl / ctl) * 100) / 100 : null

  // ── 3. Monotony ────────────────────────────────────────────────────────
  // computeMonotony exists in trainingLoad.js — try/catch if not
  let monotony = null
  try { monotony = computeMonotony?.(log)?.monotony ?? null } catch { monotony = null }

  // ── 4. Status from TSB ─────────────────────────────────────────────────
  const status =
    tsb > 10  ? 'fresh'         :
    tsb > 5   ? 'optimal'       :
    tsb > -5  ? 'normal'        :
    tsb > -15 ? 'fatigued'      :
                'very-fatigued'

  // ── 5. Today's planned session (from plan) ────────────────────────────
  const planned = plan ? getTodayPlannedSession(plan, today) : null

  // ── 6. Annotate planned session with zone targets from metrics ─────────
  // Map session types to zone numbers (1–5)
  const TYPE_TO_ZONE = {
    'recovery': 1, 'easy': 1, 'rest': 1,
    'aerobic': 2, 'long': 2, 'base': 2, 'endurance': 2,
    'tempo': 3, 'z3': 3, 'moderate': 3,
    'threshold': 4, 'lt': 4, 'lactate': 4, 'interval': 4, 'z4': 4,
    'vo2max': 5, 'z5': 5, 'sprint': 5, 'race': 5, 'hard': 5,
  }
  function sessionTypeToZone(type) {
    if (!type) return null
    const lower = type.toLowerCase()
    for (const [key, zone] of Object.entries(TYPE_TO_ZONE)) {
      if (lower.includes(key)) return zone
    }
    return null
  }

  let todaySession = null
  if (planned && planned.type) {
    const zoneNum = sessionTypeToZone(planned.type)
    const hrZone  = zoneNum && metrics?.hr?.zones?.[zoneNum - 1]
    const hrRange = hrZone ? `${hrZone.min}–${hrZone.max} bpm` : null

    // Pace range: pick from Daniels paces by zone
    const paces = metrics?.running?.paces
    const PACE_BY_ZONE = paces
      ? [paces.easy, paces.easy, paces.marathon, paces.threshold, paces.interval]
      : null
    const paceRange = paces && zoneNum
      ? `${PACE_BY_ZONE[zoneNum - 1] ?? '—'}/km`
      : null

    // Power range: pick Coggan zone
    const pwrZone  = zoneNum && metrics?.power?.zones?.[Math.min(zoneNum - 1, 6)]
    const min = pwrZone?.minWatts ?? pwrZone?.min
    const max = pwrZone?.maxWatts ?? pwrZone?.max
    const powerRange = (min != null && max != null) ? `${min}–${max}W` : null

    todaySession = {
      type: planned.type,
      durationMin: planned.duration ?? null,
      rpe: planned.rpe ?? null,
      description: planned.description ?? null,
      zoneNum,
      hrRange,
      paceRange,
      powerRange,
    }
  } else if (status === 'fresh' || status === 'optimal') {
    // No plan — suggest a session based on status
    const sugType = status === 'fresh' ? (profile?.sport === 'Cycling' ? 'Tempo Ride' : 'Tempo Run') : 'Easy Run'
    const sugZone = status === 'fresh' ? 3 : 2
    const hrZone  = metrics?.hr?.zones?.[sugZone - 1]
    const paces   = metrics?.running?.paces
    const PACE_BY_ZONE = paces ? [paces.easy, paces.easy, paces.marathon, paces.threshold, paces.interval] : null
    todaySession = {
      type: sugType,
      durationMin: 45,
      rpe: status === 'fresh' ? 6 : 4,
      zoneNum: sugZone,
      hrRange: hrZone ? `${hrZone.min}–${hrZone.max} bpm` : null,
      paceRange: paces ? `${PACE_BY_ZONE[sugZone - 1]}/km` : null,
      powerRange: null,
      suggested: true,
    }
  } else if (status === 'fatigued' || status === 'very-fatigued') {
    todaySession = {
      type: 'Rest / Recovery',
      durationMin: 30,
      rpe: 2,
      zoneNum: 1,
      hrRange: metrics?.hr?.zones?.[0] ? `<${metrics.hr.zones[0].max} bpm` : null,
      paceRange: null,
      powerRange: null,
      suggested: true,
    }
  }

  // ── 7. Race countdown ──────────────────────────────────────────────────
  const raceDate = profile?.raceDate || profile?.nextRaceDate
  let raceCountdown = null
  if (raceDate) {
    const diff = Math.round((new Date(raceDate) - new Date(today)) / 86400000)
    raceCountdown = diff >= 0 ? diff : null
  }

  // ── 8. Morning brief (1 line) ─────────────────────────────────────────
  const statusLabels = {
    fresh:         { en: 'FRESH',     tr: 'TAZE'       },
    optimal:       { en: 'OPTIMAL',   tr: 'OPTİMAL'    },
    normal:        { en: 'NORMAL',    tr: 'NORMAL'      },
    fatigued:      { en: 'FATIGUED',  tr: 'YORGUN'      },
    'very-fatigued':{ en: 'TIRED',    tr: 'ÇOK YORGUN' },
  }
  const tsbStr = tsb >= 0 ? `+${Math.round(tsb)}` : `${Math.round(tsb)}`
  const statusLabel = statusLabels[status]
  const sessionPart = todaySession
    ? ` — ${todaySession.type}${todaySession.durationMin ? ` ${todaySession.durationMin}min` : ''}${todaySession.zoneNum ? ` Z${todaySession.zoneNum}` : ''}`
    : ' — Rest day'
  const racePart = raceCountdown != null && raceCountdown <= 30
    ? ` · ${raceCountdown}d to race`
    : ''
  const brief = {
    en: `TSB ${tsbStr} · ${statusLabel.en}${sessionPart}${racePart}`,
    tr: `TSB ${tsbStr} · ${statusLabel.tr}${sessionPart}${racePart}`,
  }

  // ── 9. Tomorrow suggestion ─────────────────────────────────────────────
  // Look at today's planned RPE + current ACWR
  const todayRpe = todaySession?.rpe ?? 5
  let tomorrow = null
  if (todayRpe >= 8 || (acwr && acwr > 1.3)) {
    tomorrow = {
      type: 'reduce',
      suggestion: { en: 'Easy recovery tomorrow', tr: 'Yarın kolay toparlanma' },
      rationale: {
        en: todayRpe >= 8 ? 'Hard session today — allow 24h+ recovery' : `ACWR ${acwr} — reduce load`,
        tr: todayRpe >= 8 ? 'Bugün zorlu seans — 24s+ toparlanma' : `ACWR ${acwr} — yükü azalt`,
      },
    }
  } else if (status === 'fatigued' || status === 'very-fatigued') {
    tomorrow = {
      type: 'rest',
      suggestion: { en: 'Rest or very easy tomorrow', tr: 'Yarın dinlenme veya çok kolay' },
      rationale: {
        en: `TSB ${tsbStr} — accumulated fatigue`,
        tr: `TSB ${tsbStr} — birikmiş yorgunluk`,
      },
    }
  }

  // ── 10. Post-session flag function ────────────────────────────────────
  function sessionFlag(entry) {
    if (!entry || !planned) return null
    const plannedZone = sessionTypeToZone(planned.type)
    const loggedRpe   = entry.rpe ?? 5
    if (plannedZone && plannedZone <= 2 && loggedRpe >= 8) {
      return {
        code: 'rpe-mismatch-high',
        en:  `RPE ${loggedRpe} logged on an easy day — monitor recovery tomorrow`,
        tr:  `Kolay günde RPE ${loggedRpe} — yarın toparlanmayı takip et`,
      }
    }
    if (plannedZone && plannedZone >= 4 && loggedRpe <= 3) {
      return {
        code: 'rpe-mismatch-low',
        en:  `RPE ${loggedRpe} on a hard session — quality may have been low`,
        tr:  `Sert seansta RPE ${loggedRpe} — kalite düşük olabilir`,
      }
    }
    return null
  }

  // ── 11. Warnings ──────────────────────────────────────────────────────
  const warnings = []
  if (acwr != null && acwr > 1.8)
    warnings.push({ code:'high-acwr-danger',  level:'danger',  en:`ACWR ${acwr} — injury risk high (Gabbett 2016)`,    tr:`ACWR ${acwr} — sakatlık riski yüksek (Gabbett 2016)` })
  else if (acwr != null && acwr > 1.5)
    warnings.push({ code:'high-acwr-caution', level:'caution', en:`ACWR ${acwr} — load spike, monitor closely`,         tr:`ACWR ${acwr} — yük artışı, yakından takip et` })
  if (monotony != null && monotony > 2.0)
    warnings.push({ code:'high-monotony',     level:'caution', en:`Monotony ${monotony.toFixed(1)} — vary session types`, tr:`Monotoni ${monotony.toFixed(1)} — seans çeşitliliğini artır` })
  if (tsb < -15)
    warnings.push({ code:'deep-fatigue',      level:'caution', en:`TSB ${tsbStr} — deep fatigue, consider easier week`, tr:`TSB ${tsbStr} — derin yorgunluk, daha kolay hafta düşün` })

  return {
    status, tsb: Math.round(tsb), ctl: Math.round(ctl), acwr,
    today: { session: todaySession, brief, raceCountdown },
    tomorrow,
    sessionFlag,
    warnings,
  }
}
