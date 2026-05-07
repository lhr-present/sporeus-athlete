// src/lib/athlete/todayProgrammedSession.js — Daily-answer surface for an
// elite program. Given a built program (buildEliteProgram return) and a
// date, resolve TODAY'S planned session: phase, week index, intent, duration,
// zones, paceTarget, bilingual headline.
//
// Pure function, no React, no I/O. Bilingual EN+TR output.
//
// References:
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed.
//   Bompa T. & Haff G. (2009). Periodization: Theory and Methodology of Training.
//   Mujika I., Padilla S. (2003). Scientific bases for precompetition tapering.

// PHASE_FOCUS lifted to single source of truth in eliteProgram.js (v8.103.0).
import { PHASE_FOCUS } from './eliteProgram.js'

export const TODAY_PROGRAMMED_SESSION_CITATION = 'Daniels 2014; Bompa 2009; Mujika 2003'

const SPORT_LABEL = {
  run:       { en: 'run',  tr: 'koşu' },
  bike:      { en: 'bike', tr: 'bisiklet' },
  swim:      { en: 'swim', tr: 'yüzme' },
  triathlon: { en: 'triathlon', tr: 'triatlon' },
}

function parseUTC(iso) {
  if (!iso || typeof iso !== 'string') return null
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return isNaN(d.getTime()) ? null : d
}

function utcDayDelta(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000)
}

// 0=Mon..6=Sun (matches sampleWeeks ordering)
function dowMonFirst(dateUTC) {
  const js = dateUTC.getUTCDay() // 0=Sun..6=Sat
  return (js + 6) % 7
}

function pickIntentKey(intent) {
  const en = (intent?.en || (typeof intent === 'string' ? intent : '') || '').toLowerCase()
  if (!en) return 'other'
  if (en.includes('rest')) return 'rest'
  if (en.includes('race day')) return 'race'
  if (en.includes('long')) return 'long'
  if (en.includes('threshold') || en.includes('cruise') || en.includes('over-under') || en.includes('css')) return 'threshold'
  if (en.includes('vo2') || en.includes('interval') || en.includes('race-pace') || en.includes('sharpen')) return 'intervals'
  if (en.includes('tempo') || en.includes('sweet spot')) return 'tempo'
  if (en.includes('recovery') || en.includes('shakeout') || en.includes('opener') || en.includes('feel')) return 'easy'
  if (en.includes('easy') || en.includes('endurance') || en.includes('aerobic') || en.includes('technique') || en.includes('spin')) return 'easy'
  return 'other'
}

const INTENT_COLOR = {
  rest:      '#6c757d',
  easy:      '#28a745',
  tempo:     '#ff9500',
  threshold: '#ff6600',
  intervals: '#ff6600',
  long:      '#0064ff',
  race:      '#dc3545',
  other:     '#0064ff',
}

function bilingualHeadline(key, durationMin, sport) {
  const sp = SPORT_LABEL[sport] || SPORT_LABEL.run
  if (key === 'rest') {
    return { en: 'Today: Rest day', tr: 'Bugün: Dinlenme günü' }
  }
  if (key === 'race') {
    return { en: 'Today: Race day', tr: 'Bugün: Yarış günü' }
  }
  if (key === 'intervals') {
    return {
      en: `Today: ${durationMin} min interval session`,
      tr: `Bugün: ${durationMin} dk interval seansı`,
    }
  }
  if (key === 'tempo') {
    return {
      en: `Today: ${durationMin} min tempo`,
      tr: `Bugün: ${durationMin} dk tempo`,
    }
  }
  if (key === 'threshold') {
    return {
      en: `Today: ${durationMin} min threshold`,
      tr: `Bugün: ${durationMin} dk eşik`,
    }
  }
  if (key === 'long') {
    return {
      en: `Today: ${durationMin} min long`,
      tr: `Bugün: ${durationMin} dk uzun`,
    }
  }
  if (key === 'easy') {
    return {
      en: `Today: ${durationMin} min easy ${sp.en}`,
      tr: `Bugün: ${durationMin} dk kolay ${sp.tr}`,
    }
  }
  return {
    en: `Today: ${durationMin} min ${sp.en} session`,
    tr: `Bugün: ${durationMin} dk ${sp.tr} seansı`,
  }
}

function todayUTCISO() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function getTodayProgrammedSession(program, today, programStart) {
  if (!program || typeof program !== 'object') return null
  if (!Array.isArray(program.phases) || !program.sampleWeeks) return null

  const todayIso = today || todayUTCISO()
  const startIso = programStart || program?.options?.today || program?.programStart || null

  const todayDt = parseUTC(todayIso)
  const startDt = parseUTC(startIso)
  if (!todayDt || !startDt) return null

  const totalWeeks = program.phases.reduce((a, p) => a + (p.weeks?.length || 0), 0)
  if (totalWeeks <= 0) return null

  const daysFromStart = utcDayDelta(startDt, todayDt)
  const weeksFromStart = Math.floor(daysFromStart / 7)

  if (daysFromStart < 0) {
    return {
      reliable: false,
      reason: 'before',
      message: {
        en: 'Program has not started yet',
        tr: 'Program henüz başlamadı',
      },
      recommendation: {
        en: 'Wait for the program start date or regenerate with today as start',
        tr: 'Program başlangıç tarihini bekle veya bugünü başlangıç olarak yeniden oluştur',
      },
      citation: TODAY_PROGRAMMED_SESSION_CITATION,
    }
  }

  if (weeksFromStart >= totalWeeks) {
    return {
      reliable: false,
      reason: 'after',
      message: {
        en: 'Program window has ended',
        tr: 'Program süresi sona erdi',
      },
      recommendation: {
        en: 'Generate a new program for your next race',
        tr: 'Bir sonraki yarış için yeni bir program oluştur',
      },
      citation: TODAY_PROGRAMMED_SESSION_CITATION,
    }
  }

  // Find phase: weekNumber is 1-indexed; program.phases[].weeks contains week numbers
  const weekNumber = weeksFromStart + 1
  let phase = null
  for (const p of program.phases) {
    if (Array.isArray(p.weeks) && p.weeks.includes(weekNumber)) {
      phase = p
      break
    }
  }
  if (!phase) return null

  const sampleDays = program.sampleWeeks[phase.phase]
  if (!Array.isArray(sampleDays) || sampleDays.length === 0) return null

  let dayIdx = dowMonFirst(todayDt)
  if (dayIdx >= sampleDays.length) dayIdx = sampleDays.length - 1
  if (dayIdx < 0) dayIdx = 0

  const sess = sampleDays[dayIdx]
  if (!sess) return null

  const durationMin = Number(sess.durationMin || 0)
  const intentKey = pickIntentKey(sess.intent)
  const isRest = intentKey === 'rest' || durationMin === 0

  const message = bilingualHeadline(isRest ? 'rest' : intentKey, durationMin, program.sport)

  const phaseFocusObj = PHASE_FOCUS[phase.phase] || { en: phase.focus || phase.phase, tr: phase.focus || phase.phase }

  const recommendation = isRest
    ? {
        en: 'Recovery is training — keep movement light, prioritize sleep',
        tr: 'Toparlanma da antrenmandır — hafif hareket, uyku önceliği',
      }
    : {
        en: `Phase: ${phase.phase} — ${phaseFocusObj.en}`,
        tr: `Faz: ${phase.phase} — ${phaseFocusObj.tr}`,
      }

  return {
    weekIndex: weekNumber,
    weekTotal: totalWeeks,
    phase: phase.phase,
    phaseFocus: phaseFocusObj.en,
    phaseFocusBilingual: phaseFocusObj,
    phaseColor: phase.color || null,
    day: sess.day,
    intent: sess.intent,
    intentKey,
    intentColor: INTENT_COLOR[intentKey] || INTENT_COLOR.other,
    durationMin,
    zones: sess.zones || { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },
    paceTarget: sess.paceTarget || null,
    notes: sess.notes || { en: '', tr: '' },
    isRest,
    message,
    recommendation,
    reliable: true,
    citation: TODAY_PROGRAMMED_SESSION_CITATION,
  }
}
