// src/lib/athlete/raceEquipmentChecklist.js
//
// Pure fn: surface a sport-specific canonical race-equipment checklist
// during race week. Athletes already keep their own gear lists in notes
// apps — this card is a *grounded* memory-jogger so nothing essential
// (race bib, helmet for cyclists, transition bag for triathletes…)
// slips through on the morning of.
//
// Window: only renders when the next race is between 0 and 7 days out.
// Outside that window, nothing surfaces.
//
// Items are grouped into categories so the UI can render collapsible
// sections. Each item carries a stable `id` (used as the localStorage
// checkbox key in the card) plus a bilingual EN/TR label.
//
// Sport keys follow the same `SPORT_FROM_PROFILE` map used by the rest
// of the athlete library: run / bike / swim / triathlon. Cycling /
// running / swimming each pull their respective kit; triathlon takes
// the union plus a transition-bag category.
//
// Citations:
//   Burke L.M. 2017. Practical issues in evidence-based use of
//     performance supplements: supplement interactions, repeated use
//     and individual responses. Sports Med 47(Suppl 1):79-100.
//     (general race-day preparation principles)
//   Mujika I. 2010. Intense training: the key to optimal performance
//     before and during the taper. Scand J Med Sci Sports 20(Suppl 2):24-31.
//     (taper-week routine + race-week behavioural prep)

import { getProfileRaceDate } from '../validate.js'

export const RACE_EQUIPMENT_CHECKLIST_CITATION = 'Burke 2017; Mujika 2010'

const MS_PER_DAY = 86400000

const SPORT_FROM_PROFILE = {
  Running: 'run', running: 'run', run: 'run',
  Cycling: 'bike', cycling: 'bike', bike: 'bike',
  Swimming: 'swim', swimming: 'swim', swim: 'swim',
  Triathlon: 'triathlon', triathlon: 'triathlon',
}

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

// ─── canonical item bank ──────────────────────────────────────────────
// Each item: { id, label: {en, tr}, category, sports: Set<sport-key> }
// `sports` controls which sports include the item. Triathlon receives
// any item whose `sports` set includes `'triathlon'` OR the union of
// run / bike / swim. The transition category is triathlon-only.

const ITEM_BANK = [
  // essentials — present for every sport
  { id: 'race-bib',        category: 'essentials', sports: ['run', 'bike', 'swim', 'triathlon'],
    label: { en: 'Race bib / timing chip',  tr: 'Yarış numarası / chip' } },
  { id: 'photo-id',        category: 'essentials', sports: ['run', 'bike', 'swim', 'triathlon'],
    label: { en: 'Photo ID (race registration)', tr: 'Kimlik (yarış kaydı)' } },
  { id: 'race-shoes',      category: 'essentials', sports: ['run', 'triathlon'],
    label: { en: 'Race shoes (tested)',     tr: 'Yarış ayakkabısı (test edilmiş)' } },
  { id: 'cycling-shoes',   category: 'essentials', sports: ['bike', 'triathlon'],
    label: { en: 'Cycling shoes + cleats',  tr: 'Pedal ayakkabısı + klipsi' } },
  { id: 'gps-watch',       category: 'essentials', sports: ['run', 'bike', 'swim', 'triathlon'],
    label: { en: 'GPS watch (charged)',     tr: 'GPS saat (şarjlı)' } },
  { id: 'hr-strap',        category: 'essentials', sports: ['run', 'bike', 'triathlon'],
    label: { en: 'HR strap (tested)',       tr: 'Nabız bandı (test edilmiş)' } },

  // clothing — sport-specific kit
  { id: 'race-singlet',    category: 'clothing', sports: ['run'],
    label: { en: 'Race singlet / vest',     tr: 'Yarış atleti / yeleği' } },
  { id: 'race-shorts',     category: 'clothing', sports: ['run'],
    label: { en: 'Race shorts',             tr: 'Yarış şortu' } },
  { id: 'running-socks',   category: 'clothing', sports: ['run', 'triathlon'],
    label: { en: 'Running socks (no blisters)', tr: 'Koşu çorabı (yara yapmayan)' } },
  { id: 'cycling-kit',     category: 'clothing', sports: ['bike'],
    label: { en: 'Cycling jersey + bib shorts', tr: 'Bisiklet forması + askılı şort' } },
  { id: 'cycling-socks',   category: 'clothing', sports: ['bike'],
    label: { en: 'Cycling socks',           tr: 'Bisiklet çorabı' } },
  { id: 'cycling-gloves',  category: 'clothing', sports: ['bike'],
    label: { en: 'Cycling gloves',          tr: 'Bisiklet eldiveni' } },
  { id: 'swimsuit',        category: 'clothing', sports: ['swim'],
    label: { en: 'Race swimsuit / jammers', tr: 'Yarış mayosu / jammer' } },
  { id: 'swim-cap',        category: 'clothing', sports: ['swim', 'triathlon'],
    label: { en: 'Swim cap (event-issued)', tr: 'Bone (yarış tarafından verilen)' } },
  { id: 'goggles',         category: 'clothing', sports: ['swim', 'triathlon'],
    label: { en: 'Goggles + spare pair',    tr: 'Yüzme gözlüğü + yedek' } },
  { id: 'wetsuit',         category: 'clothing', sports: ['swim', 'triathlon'],
    label: { en: 'Wetsuit (if water < 22 °C)', tr: 'Yüzme mayosu (su < 22 °C ise)' } },
  { id: 'tri-suit',        category: 'clothing', sports: ['triathlon'],
    label: { en: 'Tri-suit (one-piece)',    tr: 'Triatlon takımı (tek parça)' } },

  // nutrition — every sport
  { id: 'gels',            category: 'nutrition', sports: ['run', 'bike', 'triathlon'],
    label: { en: 'Gels / bars (per race plan)', tr: 'Jel / bar (yarış planına göre)' } },
  { id: 'electrolytes',    category: 'nutrition', sports: ['run', 'bike', 'swim', 'triathlon'],
    label: { en: 'Electrolyte tabs / drink mix', tr: 'Elektrolit tablet / içecek tozu' } },
  { id: 'bottles',         category: 'nutrition', sports: ['run', 'bike', 'triathlon'],
    label: { en: 'Filled bottles (race + warm-up)', tr: 'Dolu şişeler (yarış + ısınma)' } },
  { id: 'pre-race-meal',   category: 'nutrition', sports: ['run', 'bike', 'swim', 'triathlon'],
    label: { en: 'Pre-race breakfast (tested)', tr: 'Yarış öncesi kahvaltı (test edilmiş)' } },

  // weather — conditional but always shown so athlete can pre-check
  { id: 'hat-visor',       category: 'weather', sports: ['run', 'triathlon'],
    label: { en: 'Hat / visor',             tr: 'Şapka / siperlik' } },
  { id: 'sunglasses',      category: 'weather', sports: ['run', 'bike', 'triathlon'],
    label: { en: 'Sunglasses',              tr: 'Güneş gözlüğü' } },
  { id: 'sunscreen',       category: 'weather', sports: ['run', 'bike', 'swim', 'triathlon'],
    label: { en: 'Sunscreen (SPF 30+)',     tr: 'Güneş kremi (SPF 30+)' } },
  { id: 'arm-warmers',     category: 'weather', sports: ['run', 'bike', 'triathlon'],
    label: { en: 'Arm warmers / rain jacket', tr: 'Kol ısıtıcı / yağmurluk' } },

  // transition — triathlon only
  { id: 'bike',            category: 'transition', sports: ['triathlon'],
    label: { en: 'Bike (tuned + tires checked)', tr: 'Bisiklet (bakımlı + lastik kontrol)' } },
  { id: 'helmet',          category: 'transition', sports: ['bike', 'triathlon'],
    label: { en: 'Helmet (mandatory)',      tr: 'Kask (zorunlu)' } },
  { id: 'transitionBag',   category: 'transition', sports: ['triathlon'],
    label: { en: 'Transition bag (T1 + T2)', tr: 'Geçiş çantası (T1 + T2)' } },
  { id: 'race-belt',       category: 'transition', sports: ['triathlon'],
    label: { en: 'Race-number belt',        tr: 'Yarış numarası kemeri' } },

  // recovery — every sport
  { id: 'post-race-shoes', category: 'recovery', sports: ['run', 'bike', 'swim', 'triathlon'],
    label: { en: 'Post-race shoes + clean kit', tr: 'Yarış sonrası ayakkabı + temiz kıyafet' } },
  { id: 'foam-roller',     category: 'recovery', sports: ['run', 'bike', 'swim', 'triathlon'],
    label: { en: 'Foam roller / massage stick', tr: 'Foam roller / masaj çubuğu' } },
  { id: 'recovery-drink',  category: 'recovery', sports: ['run', 'bike', 'swim', 'triathlon'],
    label: { en: 'Recovery drink (CHO + protein)', tr: 'Toparlanma içeceği (CHO + protein)' } },
  { id: 'warm-layer',      category: 'recovery', sports: ['run', 'bike', 'swim', 'triathlon'],
    label: { en: 'Warm layer for post-race', tr: 'Yarış sonrası sıcak kıyafet' } },
]

const CATEGORY_ORDER = ['essentials', 'clothing', 'nutrition', 'weather', 'transition', 'recovery']

function filterItemsForSport(sport) {
  return ITEM_BANK
    .filter(item => item.sports.includes(sport))
    .map(({ id, label, category }) => ({ id, label, category }))
}

function groupAndOrder(items) {
  const ordered = []
  for (const cat of CATEGORY_ORDER) {
    for (const item of items) {
      if (item.category === cat) ordered.push(item)
    }
  }
  return ordered
}

/**
 * Build the race-equipment checklist for an athlete whose race is
 * within the next 7 days.
 *
 * @param {{
 *   profile?: { primarySport?: string, sport?: string, raceDate?: string, nextRaceDate?: string } | null,
 *   today?: string | Date
 * }} input
 *
 * @returns {{
 *   daysToRace: number,
 *   sport: 'run'|'bike'|'swim'|'triathlon',
 *   items: Array<{ id: string, label: { en: string, tr: string }, category: string }>,
 *   citation: string
 * } | null}
 */
export function buildRaceEquipmentChecklist(input) {
  const opts = input && typeof input === 'object' ? input : {}
  const profile = opts.profile || null

  const todayDate = todayUTC(opts.today)
  if (!todayDate) return null

  const raceISO = getProfileRaceDate(profile)
  const raceDateD = parseISO(raceISO)
  if (!raceDateD) return null

  const daysToRace = Math.floor((raceDateD.getTime() - todayDate.getTime()) / MS_PER_DAY)
  if (daysToRace < 0) return null
  if (daysToRace > 7) return null

  const rawSport = profile?.primarySport || profile?.sport || ''
  const sport = SPORT_FROM_PROFILE[rawSport] || 'run'

  const items = groupAndOrder(filterItemsForSport(sport))
  if (items.length === 0) return null

  return {
    daysToRace,
    sport,
    items,
    citation: RACE_EQUIPMENT_CHECKLIST_CITATION,
  }
}

export { CATEGORY_ORDER as RACE_EQUIPMENT_CATEGORIES }
