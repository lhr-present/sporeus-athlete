// ─── raceDayFuelingTimeline.js — Pre-race hourly fueling timeline ──────────
//
// Hour-by-hour fueling schedule for race week (T-72h carb-load → T-3h
// pre-race meal → T-60min gel → T-15min final sip → T-0 in-race start).
//
// Existing surfaces: FuelingCard renders per-phase daily targets;
// RaceStrategyCard renders in-race fueling RATES (g/hr). Neither surfaces
// the HOURLY pre-race countdown — that's this card's job.
//
// Grounded in:
//   - Burke L. 2017 — Pre-event fueling guidance (Br J Sports Med).
//   - Jeukendrup A. 2014 — Sports Nutrition: A practical manual.
//   - Hawley J & Burke L. 2010 — Carb-loading + race-day fueling.
//
// Pure data. No React. Bilingual EN+TR hints.

import { getProfileRaceDate } from '../validate.js'

export const RACE_DAY_FUELING_TIMELINE_CITATION =
  'Burke 2017; Jeukendrup 2014; Hawley & Burke 2010'

/**
 * @typedef {{ en: string, tr: string }} Bilingual
 * @typedef {{
 *   tMinus: string,
 *   label: Bilingual,
 *   hint:  Bilingual,
 *   choTargetG: number | null,
 *   fluidMl:    number | null
 * }} TimelineRow
 */

/**
 * Build the pre-race fueling timeline.
 *
 * @param {Object} args
 * @param {Object} args.profile          - athlete profile (reads .weight kg, .raceDate)
 * @param {string} [args.today]          - ISO date YYYY-MM-DD (defaults to today)
 * @param {string} [args.raceStartTime]  - optional HH:MM (consumed by UI only)
 * @returns {{ timeline: TimelineRow[], citation: string } | null}
 *
 * Returns null when:
 *   - profile.weight is missing / non-positive
 *   - no future race date is set on the profile
 *   - the race is more than 7 days away (only surfaces during race week)
 *   - the race is in the past
 */
export function buildRaceDayFuelingTimeline({ profile, today, raceStartTime } = {}) {
  // raceStartTime is purely informational for the UI layer; we don't
  // emit clock times from the pure fn. Reference it so eslint no-unused-vars
  // doesn't trip on the public API contract.
  void raceStartTime

  const weight = parseFloat(profile?.weight)
  if (!Number.isFinite(weight) || weight <= 0) return null

  const raceDate = getProfileRaceDate(profile)
  if (!raceDate) return null

  const todayISO = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)
    ? today
    : new Date().toISOString().slice(0, 10)

  const daysToRace = daysBetween(todayISO, raceDate)
  if (daysToRace == null) return null
  if (daysToRace < 0) return null          // race in the past
  if (daysToRace > 7) return null          // only surface during race week

  // Targets (Burke 2017 / Jeukendrup 2014 / Hawley & Burke 2010).
  //   T-72h → T-24h: 8 g/kg/day carb-load (single collapsed row).
  //   T-3h pre-race meal: 2 g/kg CHO + 500 mL fluid.
  //   T-60min: 30 g CHO (banana or gel) + 250 mL fluid.
  //   T-15min: 150 mL fluid (mid of 100-200 mL band).
  //   T-0 start: begin in-race fueling, aim 60-90 g/hr for >90 min races.
  const carbLoadGPerDay  = Math.round(weight * 8)
  const preRaceMealG     = Math.round(weight * 2)

  const timeline = [
    {
      tMinus: 'T-72h → T-24h',
      label: {
        en: 'Carb load',
        tr: 'Karbonhidrat yükleme',
      },
      hint: {
        en: `${carbLoadGPerDay} g CHO/day (8 g/kg). Hydrate. Reduce fiber in the last 24h. No new foods.`,
        tr: `${carbLoadGPerDay} g KH/gün (8 g/kg). Sıvı al. Son 24 saatte lifi azalt. Yeni yiyecek deneme.`,
      },
      choTargetG: carbLoadGPerDay,
      fluidMl:    null,
    },
    {
      tMinus: 'T-3h',
      label: {
        en: 'Pre-race meal',
        tr: 'Yarış öncesi öğün',
      },
      hint: {
        en: `${preRaceMealG} g CHO (2 g/kg) + 500 mL fluid. Familiar low-fiber breakfast.`,
        tr: `${preRaceMealG} g KH (2 g/kg) + 500 mL sıvı. Tanıdık, az lifli kahvaltı.`,
      },
      choTargetG: preRaceMealG,
      fluidMl:    500,
    },
    {
      tMinus: 'T-60min',
      label: {
        en: 'Final gel',
        tr: 'Son jel',
      },
      hint: {
        en: '30 g CHO (a banana or gel) + 250 mL fluid.',
        tr: '30 g KH (muz ya da jel) + 250 mL sıvı.',
      },
      choTargetG: 30,
      fluidMl:    250,
    },
    {
      tMinus: 'T-15min',
      label: {
        en: 'Final sip',
        tr: 'Son yudum',
      },
      hint: {
        en: '150 mL fluid (100-200 mL). Optional caffeine — see Caffeine Dose card.',
        tr: '150 mL sıvı (100-200 mL). İsteğe bağlı kafein — Kafein Dozu kartına bak.',
      },
      choTargetG: null,
      fluidMl:    150,
    },
    {
      tMinus: 'T-0',
      label: {
        en: 'In-race',
        tr: 'Yarış esnasında',
      },
      hint: {
        en: 'Begin in-race fueling per duration; aim 60-90 g/hr CHO for >90 min races.',
        tr: 'Süreye göre yarış içi beslenmeye başla; >90 dk yarışlarda 60-90 g/saat KH hedefle.',
      },
      choTargetG: null,
      fluidMl:    null,
    },
  ]

  return {
    timeline,
    citation: RACE_DAY_FUELING_TIMELINE_CITATION,
  }
}

/**
 * Whole-day difference between two ISO YYYY-MM-DD dates (b - a).
 * Returns null on invalid input.
 */
function daysBetween(aISO, bISO) {
  const a = Date.parse(`${aISO}T00:00:00Z`)
  const b = Date.parse(`${bISO}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round((b - a) / 86400000)
}
