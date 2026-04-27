// src/lib/athlete/trainingBridge.js — E82
// Generates a week-by-week key session plan from an analyzeRaceGoal result.
// Sessions always use CURRENT VDOT paces (not goal paces) — correct periodization.
// Deload every 4th week (3:1 load:recovery ratio — Bompa 2015).
//
// Reference: Daniels J. (2014). Daniels' Running Formula, 3rd ed. Human Kinetics.
import { trainingPaces } from '../sport/running.js'

function fmtPaceStr(secPerKm) {
  if (!secPerKm || secPerKm <= 0) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

// Session templates per phase — all paces from CURRENT VDOT
const PHASE_SESSIONS = {
  Base: [
    { day: 'Mon', type: 'Rest / Cross-train', tr: 'Dinlenme / Çapraz antrenman', pace: null, zone: 1 },
    { day: 'Tue', type: 'Easy Run 40min',    tr: 'Kolay Koşu 40dk',             pace: 'E', zone: 2 },
    { day: 'Wed', type: 'Rest',              tr: 'Dinlenme',                     pace: null, zone: 1 },
    { day: 'Thu', type: 'Easy Run 50min',    tr: 'Kolay Koşu 50dk',              pace: 'E', zone: 2 },
    { day: 'Fri', type: 'Rest / Strides 4×',tr: 'Dinlenme / Hız açma 4×',       pace: 'R', zone: 1 },
    { day: 'Sat', type: 'Long Run 60–75min', tr: 'Uzun Koşu 60–75dk',            pace: 'E', zone: 2 },
    { day: 'Sun', type: 'Rest',              tr: 'Dinlenme',                     pace: null, zone: 1 },
  ],
  Build: [
    { day: 'Mon', type: 'Rest',                        tr: 'Dinlenme',                           pace: null, zone: 1 },
    { day: 'Tue', type: 'T-pace Tempo 2×20min',        tr: 'T-tempo Koşu 2×20dk',               pace: 'T',  zone: 4 },
    { day: 'Wed', type: 'Easy Run 40min',              tr: 'Kolay Koşu 40dk',                    pace: 'E',  zone: 2 },
    { day: 'Thu', type: 'M-pace Run 50min',            tr: 'M-tempo Koşu 50dk',                  pace: 'M',  zone: 3 },
    { day: 'Fri', type: 'Rest',                        tr: 'Dinlenme',                           pace: null, zone: 1 },
    { day: 'Sat', type: 'Long Run 75–90min w/ M-pace finish', tr: 'Uzun Koşu 75–90dk M-tempo bitiş', pace: 'M', zone: 3 },
    { day: 'Sun', type: 'Easy Recovery 30min',         tr: 'Toparlanma Koşusu 30dk',             pace: 'E',  zone: 2 },
  ],
  Peak: [
    { day: 'Mon', type: 'Rest',                        tr: 'Dinlenme',                           pace: null, zone: 1 },
    { day: 'Tue', type: 'I-pace Intervals 5×1000m',   tr: 'I-tempo Aralıklar 5×1000m',         pace: 'I',  zone: 5 },
    { day: 'Wed', type: 'Easy Run 40min',              tr: 'Kolay Koşu 40dk',                    pace: 'E',  zone: 2 },
    { day: 'Thu', type: 'T-pace Cruise 3×12min',       tr: 'T-tempo Sürekli Koşu 3×12dk',       pace: 'T',  zone: 4 },
    { day: 'Fri', type: 'Rest / Strides 6×',          tr: 'Dinlenme / Hız açma 6×',             pace: 'R',  zone: 1 },
    { day: 'Sat', type: 'Race Simulation 6K at goal', tr: 'Yarış Simülasyonu 6K hedef tempo',   pace: 'I',  zone: 5 },
    { day: 'Sun', type: 'Easy Recovery 40min',         tr: 'Toparlanma Koşusu 40dk',             pace: 'E',  zone: 2 },
  ],
  Taper: [
    { day: 'Mon', type: 'Rest',                        tr: 'Dinlenme',                           pace: null, zone: 1 },
    { day: 'Tue', type: 'Easy Run 30min + Strides',   tr: 'Kolay Koşu 30dk + Hız açmalar',     pace: 'E',  zone: 2 },
    { day: 'Wed', type: 'Rest',                        tr: 'Dinlenme',                           pace: null, zone: 1 },
    { day: 'Thu', type: 'T-pace 2×10min',              tr: 'T-tempo 2×10dk',                     pace: 'T',  zone: 4 },
    { day: 'Fri', type: 'Rest',                        tr: 'Dinlenme',                           pace: null, zone: 1 },
    { day: 'Sat', type: 'Easy 20min + Race Strides',  tr: 'Kolay 20dk + Yarış Hız Açmaları',   pace: 'E',  zone: 2 },
    { day: 'Sun', type: 'RACE DAY',                    tr: 'YARIŞ GÜNÜ',                         pace: null, zone: 5 },
  ],
  Deload: [
    { day: 'Mon', type: 'Rest',                        tr: 'Dinlenme',                           pace: null, zone: 1 },
    { day: 'Tue', type: 'Easy Run 30min',              tr: 'Kolay Koşu 30dk',                    pace: 'E',  zone: 2 },
    { day: 'Wed', type: 'Rest',                        tr: 'Dinlenme',                           pace: null, zone: 1 },
    { day: 'Thu', type: 'Easy Run 30min',              tr: 'Kolay Koşu 30dk',                    pace: 'E',  zone: 2 },
    { day: 'Fri', type: 'Rest',                        tr: 'Dinlenme',                           pace: null, zone: 1 },
    { day: 'Sat', type: 'Easy Long Run 45min',         tr: 'Kolay Uzun Koşu 45dk',               pace: 'E',  zone: 2 },
    { day: 'Sun', type: 'Rest',                        tr: 'Dinlenme',                           pace: null, zone: 1 },
  ],
}

/**
 * Build week-by-week plan from analyzeRaceGoal result.
 * @param {Object} goalAnalysis  — return value of analyzeRaceGoal()
 * @param {string} planStartDate — 'YYYY-MM-DD'
 * @returns {Array<{weekNum, phase, phaseName, isDeload, sessions, weeklyTSS, startDate, endDate}>}
 */
export function buildTrainingPlan(goalAnalysis, planStartDate) {
  if (!goalAnalysis) return []

  const { phases, currentVdot } = goalAnalysis
  const pacesRaw = trainingPaces(currentVdot)

  // Build week sequence: expand each phase into individual weeks (deload every 4th)
  const weeks = []
  let weekNum = 1
  const startDate = planStartDate
    ? new Date(planStartDate + 'T12:00:00Z')
    : new Date()

  for (const phase of phases) {
    for (let w = 1; w <= phase.weeks; w++) {
      const isDeload = w % 4 === 0
      const wdStart = new Date(startDate)
      wdStart.setUTCDate(startDate.getUTCDate() + (weekNum - 1) * 7)
      const wdEnd = new Date(wdStart)
      wdEnd.setUTCDate(wdStart.getUTCDate() + 6)

      const template = PHASE_SESSIONS[isDeload ? 'Deload' : phase.name] || PHASE_SESSIONS.Base

      const sessions = template.map(s => {
        const paceVal = s.pace && pacesRaw ? pacesRaw[s.pace] : null
        const paceStr = paceVal ? fmtPaceStr(paceVal) : null
        return { ...s, paceStr }
      })

      weeks.push({
        weekNum,
        phase:     phase.name,
        phaseName: phase.name,
        phaseTr:   phase.tr,
        isDeload,
        tss:       isDeload ? Math.round(phase.tss * 0.60) : phase.tss,
        sessions,
        startDate: wdStart.toISOString().slice(0, 10),
        endDate:   wdEnd.toISOString().slice(0, 10),
        en:        isDeload ? 'Recovery week — reduce volume 40%, maintain frequency.' : phase.en,
        tr:        isDeload ? 'Toparlanma haftası — hacmi %40 azalt, sıklığı koru.' : phase.tr,
      })
      weekNum++
    }
  }

  return weeks
}

/**
 * Find the current week in the plan based on today's date.
 * @param {Array}  plan         — output of buildTrainingPlan()
 * @param {string} today        — 'YYYY-MM-DD'
 * @returns {{week, weekIdx}|null}
 */
export function getCurrentPlanWeek(plan, today = new Date().toISOString().slice(0, 10)) {
  if (!plan?.length) return null
  const idx = plan.findIndex(w => w.startDate <= today && w.endDate >= today)
  if (idx >= 0) return { week: plan[idx], weekIdx: idx }
  if (today < plan[0].startDate) return { week: plan[0], weekIdx: 0 }
  return { week: plan[plan.length - 1], weekIdx: plan.length - 1 }
}
