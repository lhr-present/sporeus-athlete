// ─── raceMentalRehearsal.js — Race-week mental rehearsal protocol ───────────
//
// Surfaces the 5-component race-week mental rehearsal protocol grounded in:
//   - Williams 2014 "Applied Sport Psychology"
//   - Behncke 2004 (Sport Psychologist) — mental imagery in elite sport
//   - Cumming 2017 — imagery use across sport
//
// The protocol is most effective when initiated 5-7 days before race day
// and practiced daily through race week. Five distinct components:
//   1. Imagery: rehearse race execution mentally 10-15 min/day
//   2. Cue word: short word/phrase to redirect attention in hard moments
//   3. Arousal regulation: pre-race breathing (4-7-8 or box) to dial arousal
//   4. Contingency plan: pre-decided "if X happens, I do Y" responses
//   5. Post-race reflection: brief reflection — wins + refinements
//
// Returns null when there is no race, the race is in the past, or the race
// is more than 7 days out (protocol hasn't started yet).

import { getProfileRaceDate } from '../validate.js'

export const RACE_MENTAL_REHEARSAL_CITATION = 'Williams 2014; Behncke 2004; Cumming 2017'

const PROTOCOL = [
  {
    id: 'imagery',
    label: { en: 'Imagery', tr: 'Zihinsel Canlandırma' },
    hint: {
      en: 'Rehearse race execution mentally — start to finish, vividly, in real time.',
      tr: 'Yarışı baştan sona, canlı ve gerçek zamanlı olarak zihinde canlandır.',
    },
    doseMinutes: 12,
  },
  {
    id: 'cueWord',
    label: { en: 'Cue Word', tr: 'Anahtar Kelime' },
    hint: {
      en: 'Pick a short cue ("smooth", "strong", "patient") to redirect attention in hard moments.',
      tr: 'Zor anlarda dikkati yönlendirecek kısa bir kelime seç ("akıcı", "güçlü", "sabırlı").',
    },
    doseMinutes: 2,
  },
  {
    id: 'arousalRegulation',
    label: { en: 'Arousal Regulation', tr: 'Uyarılma Düzenleme' },
    hint: {
      en: 'Pre-race breathing (4-7-8 or box breathing) to dial arousal into the optimal zone.',
      tr: 'Yarış öncesi nefes (4-7-8 veya kutu nefes) ile uyarılmayı optimal aralığa getir.',
    },
    doseMinutes: 5,
  },
  {
    id: 'contingencyPlan',
    label: { en: 'Contingency Plan', tr: 'Acil Durum Planı' },
    hint: {
      en: '"If X happens, I do Y" — pre-decided responses for cramp, slow split, course confusion.',
      tr: '"X olursa, Y yaparım" — kramp, yavaş tempo, parkur karmaşası için önceden karar ver.',
    },
    doseMinutes: 2,
  },
  {
    id: 'postRaceReflection',
    label: { en: 'Post-Race Reflection', tr: 'Yarış Sonrası Değerlendirme' },
    hint: {
      en: 'After race: brief reflection — what went well, what to refine next time.',
      tr: 'Yarış sonrası kısa değerlendirme — neler iyi gitti, neyi geliştirmeli.',
    },
    doseMinutes: 5,
  },
]

function toISODate(input) {
  if (!input) return null
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input
  try {
    const d = input instanceof Date ? input : new Date(input)
    if (isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  } catch {
    return null
  }
}

function daysBetweenISO(fromISO, toISO) {
  const a = new Date(`${fromISO}T00:00:00Z`).getTime()
  const b = new Date(`${toISO}T00:00:00Z`).getTime()
  if (isNaN(a) || isNaN(b)) return null
  return Math.round((b - a) / 86400000)
}

/**
 * Build the race-week mental rehearsal protocol for an athlete.
 *
 * @param {Object} opts
 * @param {Object} opts.profile - athlete profile (uses getProfileRaceDate)
 * @param {string|Date} [opts.today] - optional "today" override (testing)
 * @returns {{ daysToRace: number, protocol: Array, citation: string } | null}
 *   Returns null when no race, race in past, or race more than 7 days out.
 */
export function buildRaceMentalRehearsal({ profile, today } = {}) {
  const raceISO = getProfileRaceDate(profile)
  if (!raceISO) return null

  const todayISO = toISODate(today) || new Date().toISOString().slice(0, 10)
  const daysToRace = daysBetweenISO(todayISO, raceISO)
  if (daysToRace == null) return null
  if (daysToRace < 0) return null      // race in past
  if (daysToRace > 7) return null      // protocol initiates 5-7d out

  return {
    daysToRace,
    protocol: PROTOCOL.map(c => ({
      id: c.id,
      label: { en: c.label.en, tr: c.label.tr },
      hint: { en: c.hint.en, tr: c.hint.tr },
      doseMinutes: c.doseMinutes,
    })),
    citation: RACE_MENTAL_REHEARSAL_CITATION,
  }
}

export default buildRaceMentalRehearsal
