// ─── quickLogFromSession.js — pre-fill log entry from a programmed session ──
//
// v9.5.0. Pure helper. Takes a sample-week session blueprint + a date + the
// program sport and returns a log entry shape compatible with sanitizeLogEntry
// (src/lib/validate.js). The athlete's "✓ DID THIS" button on NextTrainingCard
// and on the calendar's expanded session detail uses this to write a single
// log entry without leaving the surface.

/**
 * @typedef {{ en: string, tr: string }} Bilingual
 *
 * Session shape (from sampleWeeks / sessionsBlueprint):
 *   { day, intent: Bilingual, durationMin, zones, paceTarget, notes }
 */

import { newId } from '../newId.js'

const SPORT_TYPE_PREFIX = {
  run:       'Easy Run',
  bike:      'Easy Bike',
  swim:      'Easy Swim',
  triathlon: 'Easy Run',
}

function intentToType(intent, sport) {
  const fallback = SPORT_TYPE_PREFIX[sport] || 'Easy Run'
  if (!intent) return fallback
  const text = typeof intent === 'string' ? intent : (intent.en || intent.tr || '')
  if (!text) return fallback
  // Map common intents to canonical type strings the rest of the app uses.
  if (/race/i.test(text)) return sport === 'bike' ? 'Race Bike' : sport === 'swim' ? 'Race Swim' : 'Race Run'
  if (/threshold|cruise|@T-pace|sweet[- ]spot|css/i.test(text)) {
    return sport === 'bike' ? 'Threshold Bike' : sport === 'swim' ? 'Threshold Swim' : 'Threshold Run'
  }
  if (/VO2|@I-pace|interval/i.test(text)) {
    return sport === 'bike' ? 'VO2 Bike' : 'VO2 Run'
  }
  if (/tempo|@M-pace/i.test(text)) {
    return sport === 'bike' ? 'Tempo Bike' : 'Tempo Run'
  }
  if (/long/i.test(text)) {
    return sport === 'bike' ? 'Long Bike' : sport === 'swim' ? 'Long Swim' : 'Long Run'
  }
  if (/strength/i.test(text)) return 'Strength'
  if (/easy|recovery|@E-pace/i.test(text)) {
    return sport === 'bike' ? 'Easy Bike' : sport === 'swim' ? 'Easy Swim' : 'Easy Run'
  }
  // Use the intent text directly when we don't recognise it.
  return text.slice(0, 40)
}

function estimateRPE(intent) {
  if (!intent) return 5
  const text = typeof intent === 'string' ? intent : (intent.en || intent.tr || '')
  if (/race|VO2|@I-pace|interval|all-out/i.test(text)) return 9
  if (/threshold|cruise|@T-pace|sweet[- ]spot|css/i.test(text)) return 7
  if (/tempo|@M-pace/i.test(text)) return 6
  if (/long/i.test(text)) return 5
  if (/easy|recovery/i.test(text)) return 4
  return 5
}

/**
 * @public
 * @param {object} session  blueprint session (from sampleWeeks or NextTrainingCard's session)
 * @param {string} dateISO  YYYY-MM-DD
 * @param {string} sport    'run' | 'bike' | 'swim' | 'triathlon'
 * @param {object} [profile] athlete profile (for body mass, currently unused but reserved)
 * @returns {object|null}
 */
export function buildLogEntryFromSession(session, dateISO, sport, _profile = null) {
  if (!session || typeof session !== 'object') return null
  if (typeof dateISO !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null

  // v9.6.0 — when the session blueprint carries a `discipline` (triathlon
  // multi-sport weeks), prefer that over the program sport so a swim session
  // logs as "Easy Swim" rather than the program's primary "Easy Run" type.
  const programSport = (sport || 'run').toLowerCase()
  const discipline = typeof session.discipline === 'string'
    ? session.discipline.toLowerCase()
    : null
  const effectiveSport = discipline === 'rest'
    ? programSport
    : (discipline || programSport)
  const sportLower = effectiveSport
  const intent = session.intent || null
  const type = intentToType(intent, sportLower)
  const durationMin = Number(session.durationMin) || 0
  const rpe = estimateRPE(intent)

  // Estimate TSS via zone-weighted IF² (Coggan), same heuristic as
  // calendarProgress.estimateTSSFromSession but inlined here.
  let tss = 0
  if (durationMin > 0) {
    if (session.zones && typeof session.zones === 'object') {
      const z = session.zones
      const zMin = (Number(z.Z1 || 0) + Number(z.Z2 || 0) + Number(z.Z3 || 0)
        + Number(z.Z4 || 0) + Number(z.Z5 || 0))
      if (zMin > 0) {
        const if2 = (Number(z.Z1 || 0) * 0.25
          + Number(z.Z2 || 0) * 0.42
          + Number(z.Z3 || 0) * 0.64
          + Number(z.Z4 || 0) * 0.90
          + Number(z.Z5 || 0) * 1.21) / zMin
        tss = Math.round((durationMin / 60) * if2 * 100)
      }
    }
    if (tss === 0) {
      const intentText = typeof intent === 'string' ? intent : (intent?.en || '')
      tss = /Threshold|Tempo|VO2|Race|Cruise|Interval/i.test(intentText)
        ? Math.round((durationMin / 60) * 80)
        : Math.round((durationMin / 60) * 50)
    }
  }

  const noteText = session.notes
    ? (session.notes.en || session.notes.tr || '')
    : ''

  const out = {
    id: newId(),
    date: dateISO,
    type,
    sport: sportLower,
    duration: durationMin,
    durationMin,
    rpe,
    tss,
    notes: noteText
      ? `[Sporeus plan] ${noteText}`
      : '[Sporeus plan]',
    source: 'sporeus-plan',
  }
  // Surface zones array if present (sanitizeLogEntry expects array, not object)
  if (session.zones && typeof session.zones === 'object') {
    out.zones = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(k => Number(session.zones[k] || 0))
  }
  return out
}

export const QUICK_LOG_CITATION = 'Coggan 2003 (TSS); Sporeus v9.5.0'
