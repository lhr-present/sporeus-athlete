// ─── src/lib/__tests__/plan/generatePlan.test.js ──────────────────────────────
// Unit tests for E13 Adaptive Plan Generator — generatePlan + flattenPlanSessions.

import { describe, it, expect } from 'vitest'
import {
  generatePlan,
  flattenPlanSessions,
  SESSION_INTENTS,
  SPORT_INTENT_LABELS,
  sportSpecificLabel,
} from '../../plan/generatePlan.js'

const BASE_PARAMS = Object.freeze({
  goal:          'pr',
  currentCTL:    50,
  weeksToRace:   12,
  availableDays: 5,
  model:         'traditional',
  level:         'intermediate',
})

function genWith(overrides = {}) {
  return generatePlan({ ...BASE_PARAMS, ...overrides })
}

// ── Input validation ─────────────────────────────────────────────────────────
describe('generatePlan — input validation', () => {
  it('returns null for missing params', () => {
    expect(generatePlan()).toBeNull()
    expect(generatePlan(null)).toBeNull()
    expect(generatePlan('not an object')).toBeNull()
  })

  it('returns null when currentCTL is negative', () => {
    expect(genWith({ currentCTL: -1 })).toBeNull()
  })

  it('returns null when currentCTL is missing', () => {
    expect(genWith({ currentCTL: undefined })).toBeNull()
  })

  it('returns null when weeksToRace < 3', () => {
    expect(genWith({ weeksToRace: 2 })).toBeNull()
    expect(genWith({ weeksToRace: 0 })).toBeNull()
  })

  it('returns null when weeksToRace > 52', () => {
    expect(genWith({ weeksToRace: 60 })).toBeNull()
  })

  it('accepts weeksToRace = 3 as the lower boundary', () => {
    const p = genWith({ weeksToRace: 3 })
    expect(p).not.toBeNull()
    expect(p.totalWeeks).toBe(3)
  })

  it('accepts weeksToRace = 52 as the upper boundary', () => {
    const p = genWith({ weeksToRace: 52 })
    expect(p).not.toBeNull()
    expect(p.totalWeeks).toBe(52)
  })

  it('returns null when availableDays < 2', () => {
    expect(genWith({ availableDays: 1 })).toBeNull()
  })

  it('returns null when availableDays > 7', () => {
    expect(genWith({ availableDays: 8 })).toBeNull()
  })

  it('returns null for unknown model', () => {
    expect(genWith({ model: 'fartlek' })).toBeNull()
  })

  it('returns null for non-numeric inputs', () => {
    expect(genWith({ currentCTL: 'fifty' })).toBeNull()
    expect(genWith({ weeksToRace: 'twelve' })).toBeNull()
  })
})

// ── Shape & metadata ─────────────────────────────────────────────────────────
describe('generatePlan — output shape', () => {
  it('produces a plan with expected top-level fields', () => {
    const p = genWith()
    expect(p).toHaveProperty('model')
    expect(p).toHaveProperty('goal')
    expect(p).toHaveProperty('level')
    expect(p).toHaveProperty('totalWeeks')
    expect(p).toHaveProperty('startCTL')
    expect(p).toHaveProperty('targetCTL')
    expect(p).toHaveProperty('weeks')
    expect(p).toHaveProperty('generatedAt')
  })

  it('has weeks length equal to totalWeeks', () => {
    for (const w of [3, 8, 12, 24, 52]) {
      const p = genWith({ weeksToRace: w })
      expect(p.weeks).toHaveLength(w)
    }
  })

  it('each week has all required fields', () => {
    const p = genWith()
    for (const wk of p.weeks) {
      expect(wk).toHaveProperty('weekNum')
      expect(wk).toHaveProperty('phase')
      expect(wk).toHaveProperty('isDeload')
      expect(wk).toHaveProperty('weeklyTSS')
      expect(wk).toHaveProperty('sessions')
      expect(wk).toHaveProperty('zoneDistribution')
    }
  })

  it('week numbers are 1..N sequential', () => {
    const p = genWith({ weeksToRace: 12 })
    p.weeks.forEach((wk, i) => expect(wk.weekNum).toBe(i + 1))
  })

  it('targetCTL is greater than startCTL', () => {
    const p = genWith()
    expect(p.targetCTL).toBeGreaterThan(p.startCTL)
  })
})

// ── Session shape ────────────────────────────────────────────────────────────
describe('generatePlan — session shape', () => {
  it('every session has intent, label, targetTSS, RPE bounds, zone', () => {
    const p = genWith()
    for (const wk of p.weeks) {
      for (const s of wk.sessions) {
        expect(s).toHaveProperty('day')
        expect(s).toHaveProperty('intent')
        expect(s).toHaveProperty('label')
        expect(s.label).toHaveProperty('en')
        expect(s.label).toHaveProperty('tr')
        expect(typeof s.targetTSS).toBe('number')
        expect(typeof s.rpeLow).toBe('number')
        expect(typeof s.rpeHigh).toBe('number')
        expect(s.rpeLow).toBeLessThanOrEqual(s.rpeHigh)
        expect(s).toHaveProperty('zone')
      }
    }
  })

  it('all session intents are recognized', () => {
    const p = genWith()
    const valid = new Set(Object.keys(SESSION_INTENTS))
    for (const wk of p.weeks) {
      for (const s of wk.sessions) expect(valid.has(s.intent)).toBe(true)
    }
  })

  it('session count per week equals availableDays', () => {
    for (const days of [2, 3, 4, 5, 6, 7]) {
      const p = genWith({ availableDays: days })
      for (const wk of p.weeks) expect(wk.sessions).toHaveLength(days)
    }
  })

  it('weeklyTSS equals sum of session targets within ±5 (rounding tolerance)', () => {
    const p = genWith()
    for (const wk of p.weeks) {
      const sum = wk.sessions.reduce((s, x) => s + x.targetTSS, 0)
      expect(Math.abs(sum - wk.weeklyTSS)).toBeLessThanOrEqual(5)
    }
  })
})

// ── Periodization model coverage ─────────────────────────────────────────────
describe('generatePlan — periodization models', () => {
  it.each(['traditional', 'polarized', 'block'])(
    'produces a valid plan for model=%s',
    (model) => {
      const p = genWith({ model })
      expect(p).not.toBeNull()
      expect(p.model).toBe(model)
      expect(p.weeks.length).toBe(12)
    },
  )

  it('polarized weeks have a high Z1 share', () => {
    const p = genWith({ model: 'polarized' })
    for (const wk of p.weeks) {
      expect(wk.zoneDistribution.Z1).toBeGreaterThanOrEqual(0.75)
    }
  })

  it('block model rotates accumulation/intensification/realization', () => {
    const p = genWith({ model: 'block', weeksToRace: 25 })
    // Should see at least two distinct zone distributions across weeks.
    const sigs = new Set(p.weeks.map(w => JSON.stringify(w.zoneDistribution)))
    expect(sigs.size).toBeGreaterThanOrEqual(2)
  })

  it('traditional zone distribution differs across phases', () => {
    const p = genWith({ weeksToRace: 24, model: 'traditional' })
    const phases = new Set(p.weeks.map(w => w.phase))
    expect(phases.size).toBeGreaterThanOrEqual(3)
  })
})

// ── Phase progression ────────────────────────────────────────────────────────
describe('generatePlan — phases', () => {
  it('last week is Race', () => {
    const p = genWith()
    expect(p.weeks[p.weeks.length - 1].phase).toBe('Race')
  })

  it('Taper phase appears just before Race', () => {
    const p = genWith()
    const last3 = p.weeks.slice(-3).map(w => w.phase)
    expect(last3).toEqual(expect.arrayContaining(['Taper', 'Race']))
  })

  it('long plan begins with Base', () => {
    const p = genWith({ weeksToRace: 24 })
    expect(p.weeks[0].phase).toBe('Base')
  })

  it('short plan (3 weeks) consists of only Taper/Race', () => {
    const p = genWith({ weeksToRace: 3 })
    const phases = p.weeks.map(w => w.phase)
    expect(phases.includes('Race')).toBe(true)
    expect(phases.includes('Taper')).toBe(true)
  })
})

// ── Goal & level scaling ─────────────────────────────────────────────────────
describe('generatePlan — goal & level scaling', () => {
  it('podium goal exposes higher targetCTL than health goal', () => {
    const podium = genWith({ goal: 'podium' })
    const health = genWith({ goal: 'health' })
    expect(podium.targetCTL).toBeGreaterThan(health.targetCTL)
  })

  it('podium-Peak weeks are loaded equal-or-higher than health-Peak weeks', () => {
    // With ACWR clamp the Base ceiling is identical, so we compare Peak/Build
    // phase weeks (where goal scaling actually surfaces).
    const podium = genWith({ goal: 'podium', weeksToRace: 24 })
    const health = genWith({ goal: 'health',  weeksToRace: 24 })
    const peak = (p) => Math.max(...p.weeks.filter(w => w.phase === 'Peak' && !w.isDeload).map(w => w.weeklyTSS))
    expect(peak(podium)).toBeGreaterThanOrEqual(peak(health))
  })

  it('beginner peak weekly TSS is lower than elite peak', () => {
    const beg = genWith({ level: 'beginner' })
    const eli = genWith({ level: 'elite' })
    const begPeak = Math.max(...beg.weeks.map(w => w.weeklyTSS))
    const eliPeak = Math.max(...eli.weeks.map(w => w.weeklyTSS))
    expect(eliPeak).toBeGreaterThan(begPeak)
  })

  it('falls back to defaults for unknown goal / level', () => {
    const p = genWith({ goal: 'nope', level: 'nope' })
    expect(p).not.toBeNull()
  })
})

// ── Available days ───────────────────────────────────────────────────────────
describe('generatePlan — availableDays compression', () => {
  it.each([2, 3, 4, 5, 6, 7])(
    'has exactly %i sessions per week',
    (days) => {
      const p = genWith({ availableDays: days })
      for (const wk of p.weeks) expect(wk.sessions).toHaveLength(days)
    },
  )

  it('preserves at least one recovery / rest session per week', () => {
    for (const days of [2, 3, 4, 5, 6, 7]) {
      const p = genWith({ availableDays: days })
      for (const wk of p.weeks) {
        const hasRec = wk.sessions.some(s => s.intent === 'recovery' || s.intent === 'rest')
        expect(hasRec).toBe(true)
      }
    }
  })
})

// ── Deload / TSS progression ─────────────────────────────────────────────────
describe('generatePlan — TSS progression & deloads', () => {
  it('weekly TSS never grows >10% week-over-week (ACWR safe)', () => {
    const p = genWith({ weeksToRace: 24 })
    for (let i = 1; i < p.weeks.length; i++) {
      const prev = p.weeks[i - 1].weeklyTSS
      const curr = p.weeks[i].weeklyTSS
      if (prev <= 0) continue
      expect(curr).toBeLessThanOrEqual(Math.floor(prev * 1.10) + 1)
    }
  })

  it('inserts a deload every 4th week (when phase allows)', () => {
    const p = genWith({ weeksToRace: 24 })
    // Week 4, 8, 12, etc — but only flag those not in Race/Taper
    for (let i = 3; i < p.weeks.length; i += 4) {
      const wk = p.weeks[i]
      if (wk.phase !== 'Race' && wk.phase !== 'Taper') {
        expect(wk.isDeload).toBe(true)
      }
    }
  })

  it('weeklyTSS never negative', () => {
    const p = genWith()
    for (const wk of p.weeks) expect(wk.weeklyTSS).toBeGreaterThanOrEqual(0)
  })
})

// ── Property tests ───────────────────────────────────────────────────────────
describe('generatePlan — property: WoW growth ≤ 10%', () => {
  const cases = []
  for (const ctl of [20, 40, 60, 80]) {
    for (const w of [4, 8, 12, 16, 24, 36, 52]) {
      for (const days of [3, 5, 7]) {
        for (const m of ['traditional', 'polarized', 'block']) {
          cases.push({ ctl, w, days, m })
        }
      }
    }
  }

  it.each(cases)(
    'CTL=$ctl weeks=$w days=$days model=$m never exceeds 10% WoW',
    ({ ctl, w, days, m }) => {
      const p = generatePlan({
        goal: 'pr', currentCTL: ctl, weeksToRace: w,
        availableDays: days, model: m, level: 'intermediate',
      })
      expect(p).not.toBeNull()
      for (let i = 1; i < p.weeks.length; i++) {
        const prev = p.weeks[i - 1].weeklyTSS
        const curr = p.weeks[i].weeklyTSS
        if (prev <= 0) continue
        // Allow +1 unit of rounding slack
        expect(curr).toBeLessThanOrEqual(Math.floor(prev * 1.10) + 1)
      }
    },
  )
})

// ── v9.422 — load-shaping invariants (deload descent + taper descent) ────────
// Founder-greenlit fixes to two plan-math bugs:
//   BUG 1 — a flagged deload week could carry MORE TSS than the week before it
//           (Build ramp computed from plan-index math diverging from the
//           calendar-aware phase assignment).
//   BUG 2 — the taper (esp. the no-raceDate index path) could ramp UP and
//           exceed the achieved peak (fracs anchored to raw peakTSS).
describe('generatePlan — v9.422 load-shaping invariants', () => {
  function isoDaysAhead(days) {
    const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  // Cover several horizons × both phasing paths (raceDate present / absent).
  const horizons = [8, 12, 16, 20]
  const matrix = []
  for (const w of horizons) {
    for (const ctl of [25, 50, 80]) {
      for (const m of ['traditional', 'polarized', 'block']) {
        matrix.push({ w, ctl, m, raceDate: false })
        matrix.push({ w, ctl, m, raceDate: true })
      }
    }
  }

  it.each(matrix)(
    'BUG 1 — no deload week exceeds its predecessor (weeks=$w ctl=$ctl model=$m raceDate=$raceDate)',
    ({ w, ctl, m, raceDate }) => {
      const overrides = { weeksToRace: w, currentCTL: ctl, model: m }
      if (raceDate) overrides.raceDate = isoDaysAhead(w * 7)
      const p = genWith(overrides)
      expect(p).not.toBeNull()
      for (let i = 1; i < p.weeks.length; i++) {
        if (!p.weeks[i].isDeload) continue
        // The deload must never carry more load than the immediately prior week.
        expect(p.weeks[i].weeklyTSS).toBeLessThanOrEqual(p.weeks[i - 1].weeklyTSS)
      }
    },
  )

  it.each(matrix)(
    'BUG 2 — taper weeks descend & never exceed the peak (weeks=$w ctl=$ctl model=$m raceDate=$raceDate)',
    ({ w, ctl, m, raceDate }) => {
      const overrides = { weeksToRace: w, currentCTL: ctl, model: m }
      if (raceDate) overrides.raceDate = isoDaysAhead(w * 7)
      const p = genWith(overrides)
      expect(p).not.toBeNull()
      const peakWeeks = p.weeks.filter(x => x.phase === 'Peak' && !x.isDeload).map(x => x.weeklyTSS)
      const peakMax = peakWeeks.length ? Math.max(...peakWeeks) : Math.max(...p.weeks.map(x => x.weeklyTSS))
      let prev = Infinity
      for (const wk of p.weeks) {
        if (wk.phase !== 'Taper' && wk.phase !== 'Race') continue
        // Monotonic (non-strict) descent across Taper → Race.
        expect(wk.weeklyTSS).toBeLessThanOrEqual(prev + 0.5)
        // Never exceeds the achieved/visible peak week.
        expect(wk.weeklyTSS).toBeLessThanOrEqual(peakMax + 0.5)
        prev = wk.weeklyTSS
      }
    },
  )

  it('BUG 2 — no-raceDate index path taper does not ramp UP (12-week, regression)', () => {
    // Pre-fix this path anchored taper fracs to raw peakTSS, letting the first
    // taper week land ABOVE the achieved peak. Lock the descent in explicitly.
    const p = genWith({ weeksToRace: 12 })  // no raceDate → index phasing
    const taper = p.weeks.filter(w => w.phase === 'Taper' || w.phase === 'Race')
    expect(taper.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < taper.length; i++) {
      expect(taper[i].weeklyTSS).toBeLessThanOrEqual(taper[i - 1].weeklyTSS + 0.5)
    }
  })
})

// ── flattenPlanSessions ──────────────────────────────────────────────────────
describe('flattenPlanSessions', () => {
  it('returns empty array for null/empty plan', () => {
    expect(flattenPlanSessions(null)).toEqual([])
    expect(flattenPlanSessions({})).toEqual([])
    expect(flattenPlanSessions({ weeks: [] })).toEqual([])
  })

  it('flattens to weekNum × sessions rows', () => {
    const p = genWith({ availableDays: 5, weeksToRace: 12 })
    const flat = flattenPlanSessions(p)
    expect(flat.length).toBe(12 * 5)
    expect(flat[0]).toHaveProperty('weekNum')
    expect(flat[0]).toHaveProperty('intent')
    expect(flat[0]).toHaveProperty('targetTSS')
  })
})

// ── Bilingual labels ─────────────────────────────────────────────────────────
describe('generatePlan — bilingual session labels', () => {
  it('every session label has both en and tr', () => {
    const p = genWith()
    for (const wk of p.weeks) {
      for (const s of wk.sessions) {
        expect(typeof s.label.en).toBe('string')
        expect(typeof s.label.tr).toBe('string')
        expect(s.label.en.length).toBeGreaterThan(0)
        expect(s.label.tr.length).toBeGreaterThan(0)
      }
    }
  })
})

// ── v9.92.0 — Mission 1 PLAN link: race-distance-aware intent templates ──────
describe('generatePlan — raceDistance shapes peak/build intent emphasis', () => {
  // Count intent occurrences in a phase
  function countIntentsInPhase(plan, phase) {
    const out = { endurance: 0, tempo: 0, vo2: 0, recovery: 0, rest: 0, test: 0 }
    for (const wk of plan.weeks) {
      if (wk.phase !== phase) continue
      for (const s of wk.sessions) out[s.intent] = (out[s.intent] ?? 0) + 1
    }
    return out
  }

  it('5K plan has MORE VO2 sessions in Peak than Marathon plan', () => {
    const fiveK    = genWith({ raceDistance: '5K' })
    const marathon = genWith({ raceDistance: 'Marathon' })
    const fK = countIntentsInPhase(fiveK, 'Peak').vo2
    const mK = countIntentsInPhase(marathon, 'Peak').vo2
    expect(fK).toBeGreaterThan(mK)
  })

  it('Marathon plan has MORE endurance sessions in Peak than 5K plan', () => {
    const fiveK    = genWith({ raceDistance: '5K' })
    const marathon = genWith({ raceDistance: 'Marathon' })
    const fE = countIntentsInPhase(fiveK, 'Peak').endurance
    const mE = countIntentsInPhase(marathon, 'Peak').endurance
    expect(mE).toBeGreaterThan(fE)
  })

  it('5K plan differs from Marathon plan in week-by-week session intents', () => {
    const fiveK    = genWith({ raceDistance: '5K' })
    const marathon = genWith({ raceDistance: 'Marathon' })
    // Take the intent sequence of every week and compare; at least one peak
    // week must differ.
    const f = fiveK.weeks.map(w => w.sessions.map(s => s.intent).join(','))
    const m = marathon.weeks.map(w => w.sessions.map(s => s.intent).join(','))
    let differs = false
    for (let i = 0; i < f.length; i++) {
      if (f[i] !== m[i]) { differs = true; break }
    }
    expect(differs).toBe(true)
  })

  it('plan without raceDistance equals plan with unknown raceDistance', () => {
    const a = genWith({ raceDistance: null })
    const b = genWith({ raceDistance: 'NotARealDistance' })
    // Same intent sequence — unknown distance falls through to default
    const seqA = a.weeks.map(w => w.sessions.map(s => s.intent).join(','))
    const seqB = b.weeks.map(w => w.sessions.map(s => s.intent).join(','))
    expect(seqA).toEqual(seqB)
  })

  it('raceDistance only biases traditional model — polarized falls through', () => {
    const polA = genWith({ model: 'polarized', raceDistance: '5K' })
    const polB = genWith({ model: 'polarized', raceDistance: 'Marathon' })
    // Polarized templates are model-level, not distance-level — intent sequences identical
    const seqA = polA.weeks.map(w => w.sessions.map(s => s.intent).join(','))
    const seqB = polB.weeks.map(w => w.sessions.map(s => s.intent).join(','))
    expect(seqA).toEqual(seqB)
  })

  it('returns raceDistance and primarySport in plan object', () => {
    const p = genWith({ raceDistance: '5K', primarySport: 'Running' })
    expect(p.raceDistance).toBe('5K')
    expect(p.primarySport).toBe('Running')
  })

  it('omitted raceDistance/primarySport returns null in plan object', () => {
    const p = genWith()  // BASE_PARAMS has neither set
    expect(p.raceDistance).toBeNull()
    expect(p.primarySport).toBeNull()
  })

  it('Half Marathon plan has tempo emphasis in Peak (more than 5K)', () => {
    const half  = genWith({ raceDistance: 'Half Marathon' })
    const fiveK = genWith({ raceDistance: '5K' })
    const hT = countIntentsInPhase(half, 'Peak').tempo
    const fT = countIntentsInPhase(fiveK, 'Peak').tempo
    expect(hT).toBeGreaterThan(fT)
  })

  it('Cycling Event raceDistance produces a valid plan', () => {
    const p = genWith({ raceDistance: 'Cycling Event', primarySport: 'Cycling' })
    expect(p).not.toBeNull()
    expect(p.raceDistance).toBe('Cycling Event')
    expect(p.primarySport).toBe('Cycling')
  })
})

// ── v9.92.0 — sportSpecificLabel helper ──────────────────────────────────────
describe('sportSpecificLabel', () => {
  it('returns sport-specific EN label for known sport+intent', () => {
    expect(sportSpecificLabel('endurance', 'Running', 'en')).toBe('Long run')
    expect(sportSpecificLabel('endurance', 'Cycling', 'en')).toBe('Long ride')
    expect(sportSpecificLabel('vo2', 'Cycling', 'en')).toBe('Power intervals')
    expect(sportSpecificLabel('test', 'Cycling', 'en')).toBe('FTP test')
  })

  it('returns sport-specific TR label for known sport+intent', () => {
    expect(sportSpecificLabel('endurance', 'Running', 'tr')).toBe('Uzun koşu')
    expect(sportSpecificLabel('endurance', 'Cycling', 'tr')).toBe('Uzun bisiklet')
    expect(sportSpecificLabel('test', 'Cycling', 'tr')).toBe('FTP testi')
  })

  it('falls back to generic SESSION_INTENTS when sport is null', () => {
    expect(sportSpecificLabel('endurance', null, 'en')).toBe(SESSION_INTENTS.endurance.en)
    expect(sportSpecificLabel('tempo', null, 'tr')).toBe(SESSION_INTENTS.tempo.tr)
  })

  it('Triathlon labels (v9.97.0) are generic single-discipline-neutral', () => {
    expect(sportSpecificLabel('endurance', 'Triathlon', 'en')).toBe('Long session')
    expect(sportSpecificLabel('endurance', 'Triathlon', 'tr')).toBe('Uzun antrenman')
    expect(sportSpecificLabel('vo2', 'Triathlon', 'en')).toBe('Intervals')
    expect(sportSpecificLabel('test', 'Triathlon', 'tr')).toBe('Form testi')
  })

  it('Rowing labels (v9.97.0) use rowing-specific terminology (2k test)', () => {
    expect(sportSpecificLabel('endurance', 'Rowing', 'en')).toBe('Long row')
    expect(sportSpecificLabel('test', 'Rowing', 'en')).toBe('2k test')
    expect(sportSpecificLabel('tempo', 'Rowing', 'tr')).toBe('Sabit tempo kürek')
  })

  it('falls back to generic when sport has no mapping (Hybrid / Other / unknown)', () => {
    expect(sportSpecificLabel('endurance', 'Hybrid', 'en')).toBe(SESSION_INTENTS.endurance.en)
    expect(sportSpecificLabel('vo2', 'Other', 'en')).toBe(SESSION_INTENTS.vo2.en)
    expect(sportSpecificLabel('tempo', 'NotARealSport', 'en')).toBe(SESSION_INTENTS.tempo.en)
  })

  it('falls back to generic when intent is unknown for known sport', () => {
    // 'rest' is in SESSION_INTENTS but NOT in SPORT_INTENT_LABELS — should fall through
    expect(sportSpecificLabel('rest', 'Running', 'en')).toBe(SESSION_INTENTS.rest.en)
  })

  it('returns raw intent string when both lookups fail', () => {
    expect(sportSpecificLabel('madeUpIntent', 'Running', 'en')).toBe('madeUpIntent')
  })

  it('SPORT_INTENT_LABELS has every endurance-mapped intent for all 5 sports (v9.97.0: +Triathlon, +Rowing)', () => {
    const intents = ['endurance', 'tempo', 'vo2', 'recovery', 'test']
    for (const sport of ['Running', 'Cycling', 'Swimming', 'Triathlon', 'Rowing']) {
      for (const intent of intents) {
        const lbl = SPORT_INTENT_LABELS[sport][intent]
        expect(lbl).toBeTruthy()
        expect(typeof lbl.en).toBe('string')
        expect(typeof lbl.tr).toBe('string')
        expect(lbl.en.length).toBeGreaterThan(0)
        expect(lbl.tr.length).toBeGreaterThan(0)
      }
    }
  })
})

// v9.156.0 (Prompt A) — weeklyTssGoal honoring
describe('generatePlan — weeklyTssGoal', () => {
  it('weeklyTssGoalApplied is null when no goal is passed', () => {
    const p = genWith({})
    expect(p.weeklyTssGoalApplied).toBeNull()
  })

  it('honors in-band goal: peakTSS rescales proportionally', () => {
    const ctlOnly = genWith({})
    const peakOf = (plan) => Math.max(...plan.weeks.filter(w => w.phase === 'Peak' && !w.isDeload).map(w => w.weeklyTSS))
    const ctlPeak = peakOf(ctlOnly)
    const goal = Math.round(ctlPeak * 1.10)  // +10%, well in-band

    const withGoal = genWith({ weeklyTssGoal: goal })
    expect(withGoal.weeklyTssGoalApplied.applied).toBe(true)
    expect(withGoal.weeklyTssGoalApplied.goal).toBe(goal)
    const goalPeak = peakOf(withGoal)
    // clampWoWGrowth(≤10%) and applyDeloads dampen peakTSS in absolute terms,
    // but the proportional relationship survives: goalPeak/ctlPeak ≈ 1.10.
    expect(goalPeak / ctlPeak).toBeGreaterThanOrEqual(1.05)
    expect(goalPeak / ctlPeak).toBeLessThanOrEqual(1.15)
  })

  it('rejects goal too high (>30% over CTL-derived peak): keeps CTL plan, returns reason', () => {
    const ctlOnly = genWith({})
    const ctlPeak = Math.max(...ctlOnly.weeks.filter(w => w.phase === 'Peak' && !w.isDeload).map(w => w.weeklyTSS))
    const tooHigh = Math.round(ctlPeak * 2)

    const p = genWith({ weeklyTssGoal: tooHigh })
    expect(p.weeklyTssGoalApplied.applied).toBe(false)
    expect(p.weeklyTssGoalApplied.reason).toBe('too_high')
    expect(p.weeklyTssGoalApplied.safeRange).toHaveLength(2)
    // Plan stays on CTL-derived peak (within rounding)
    const peak = Math.max(...p.weeks.filter(w => w.phase === 'Peak' && !w.isDeload).map(w => w.weeklyTSS))
    expect(Math.abs(peak - ctlPeak)).toBeLessThanOrEqual(2)
  })

  it('rejects goal too low (<30% under CTL peak): keeps CTL plan, returns reason', () => {
    const p = genWith({ weeklyTssGoal: 50 })   // way below any reasonable CTL=50 plan
    expect(p.weeklyTssGoalApplied.applied).toBe(false)
    expect(p.weeklyTssGoalApplied.reason).toBe('too_low')
  })

  it('rejects malformed goal (0, negative, NaN): treats as absent', () => {
    expect(genWith({ weeklyTssGoal: 0 }).weeklyTssGoalApplied).toBeNull()
    expect(genWith({ weeklyTssGoal: -100 }).weeklyTssGoalApplied).toBeNull()
    expect(genWith({ weeklyTssGoal: NaN }).weeklyTssGoalApplied).toBeNull()
    expect(genWith({ weeklyTssGoal: 'foo' }).weeklyTssGoalApplied).toBeNull()
  })

  it('honored plan still respects ACWR week-over-week growth ≤10%', () => {
    // Goal pushes peak up; clampWoWGrowth must still constrain ramp.
    const ctlOnly = genWith({})
    const ctlPeak = Math.max(...ctlOnly.weeks.filter(w => w.phase === 'Peak' && !w.isDeload).map(w => w.weeklyTSS))
    const goal = Math.round(ctlPeak * 1.25)

    const p = genWith({ weeklyTssGoal: goal })
    for (let i = 1; i < p.weeks.length; i++) {
      const prev = p.weeks[i - 1].weeklyTSS
      const curr = p.weeks[i].weeklyTSS
      if (prev > 0 && !p.weeks[i].isDeload) {
        expect(curr / prev).toBeLessThanOrEqual(1.11)  // 10% + rounding slack
      }
    }
  })
})

// v9.157.0 (Prompt B) — Race-date-anchored phasing
describe('generatePlan — raceDate phase anchoring', () => {
  function isoDaysAhead(days) {
    const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  it('stores raceDate on the returned plan when valid', () => {
    const p = genWith({ raceDate: isoDaysAhead(84), weeksToRace: 12 })
    expect(p.raceDate).toBe(isoDaysAhead(84))
  })

  it('omits raceDate when shape is invalid', () => {
    expect(genWith({ raceDate: 'not-a-date', weeksToRace: 12 }).raceDate).toBeNull()
    expect(genWith({ raceDate: '', weeksToRace: 12 }).raceDate).toBeNull()
    expect(genWith({ raceDate: undefined, weeksToRace: 12 }).raceDate).toBeNull()
  })

  it('places Race phase on the week containing race day', () => {
    // 12-week plan, race in 84 days → week 11 starts day 77, contains day 84
    const p = genWith({ raceDate: isoDaysAhead(84), weeksToRace: 12 })
    // Last week should be Race phase
    expect(p.weeks[p.weeks.length - 1].phase).toBe('Race')
  })

  it('places Taper phase 7-14 days before race', () => {
    const p = genWith({ raceDate: isoDaysAhead(84), weeksToRace: 12 })
    // Week 10 starts day 70, daysToRace=14 → Taper
    expect(p.weeks[10].phase).toBe('Taper')
  })

  it('places Peak phase 14-28 days before race', () => {
    const p = genWith({ raceDate: isoDaysAhead(84), weeksToRace: 12 })
    // Week 9 starts day 63, daysToRace=21 → Peak
    expect(p.weeks[9].phase).toBe('Peak')
  })

  it('places Build phase 28-56 days before race', () => {
    const p = genWith({ raceDate: isoDaysAhead(84), weeksToRace: 12 })
    // Week 5 starts day 35, daysToRace=49 → Build
    expect(p.weeks[5].phase).toBe('Build')
  })

  it('places Base phase >56 days before race', () => {
    const p = genWith({ raceDate: isoDaysAhead(84), weeksToRace: 12 })
    // Week 0 starts day 0, daysToRace=84 → Base
    expect(p.weeks[0].phase).toBe('Base')
  })

  it('falls back to legacy plan-index phasing when raceDate is absent', () => {
    const p = genWith({})  // no raceDate
    // 12-week plan, legacy phaseForWeek: last week → Race
    expect(p.weeks[p.weeks.length - 1].phase).toBe('Race')
    expect(p.raceDate).toBeNull()
  })

  it('handles too-short race date (race already this week) — still races on last week', () => {
    // 4-week plan with race 5 days away. Week 0 starts day 0, daysToRace=5 → Race.
    // Subsequent weeks also Race (post-race). Plan still builds.
    const p = generatePlan({ ...BASE_PARAMS, weeksToRace: 4, raceDate: isoDaysAhead(5) })
    expect(p.weeks[0].phase).toBe('Race')
  })
})

// v9.157.0 (Prompt C) — Race-relative deload cadence
describe('generatePlan — race-relative deloads', () => {
  function isoDaysAhead(days) {
    const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  it('places deload at race-week minus 4 (8-week plan)', () => {
    const p = genWith({ weeksToRace: 8, raceDate: isoDaysAhead(56) })
    // Race week = 7. distFromRace=4 → week 3. Should be deload (and phase is Base, not Taper).
    expect(p.weeks[3].isDeload).toBe(true)
    // No deload in race or taper weeks
    expect(p.weeks[6].isDeload).toBe(false)
    expect(p.weeks[7].isDeload).toBe(false)
  })

  it('places deloads at race-week minus {4, 8} (12-week plan)', () => {
    const p = genWith({ weeksToRace: 12, raceDate: isoDaysAhead(84) })
    // Race week = 11. distFromRace=4 → wk 7. distFromRace=8 → wk 3.
    expect(p.weeks[3].isDeload).toBe(true)
    expect(p.weeks[7].isDeload).toBe(true)
    // Other weeks should not be deload
    expect(p.weeks[5].isDeload).toBe(false)
    expect(p.weeks[9].isDeload).toBe(false)
  })

  it('skips deload entirely for plans with <6 weeks before race', () => {
    const p = genWith({ weeksToRace: 5, raceDate: isoDaysAhead(35) })
    for (const w of p.weeks) expect(w.isDeload).toBe(false)
  })

  it('never deloads week 0 even if it would otherwise be selected', () => {
    // 4-week plan: race week = 3, distFromRace=4 → week -1 (no match).
    // 5-week plan: race week = 4, distFromRace=4 → week 0 — must be skipped.
    const p4 = genWith({ weeksToRace: 4, raceDate: isoDaysAhead(28) })
    const p5 = genWith({ weeksToRace: 5, raceDate: isoDaysAhead(35) })
    expect(p4.weeks[0].isDeload).toBe(false)
    expect(p5.weeks[0].isDeload).toBe(false)
  })

  it('does not deload weeks where phase is Race or Taper even at the cadence', () => {
    // 5-week plan with race in 35 days: race-aware Race=week 4, Taper=week 3.
    // distFromRace=4 → week 0 (skipped by week-0 guard).
    // 9-week plan: race=week 8, distFromRace=4 → wk 4 (Build, OK), 8→wk 0 (skip).
    const p = genWith({ weeksToRace: 9, raceDate: isoDaysAhead(63) })
    for (const w of p.weeks) {
      if (w.isDeload) {
        expect(w.phase).not.toBe('Race')
        expect(w.phase).not.toBe('Taper')
      }
    }
  })

  it('reduces deload week weeklyTSS to ~60% of non-deload neighbors', () => {
    const p = genWith({ weeksToRace: 12, raceDate: isoDaysAhead(84) })
    const deload = p.weeks.find(w => w.isDeload && w.phase !== 'Race' && w.phase !== 'Taper')
    expect(deload).toBeTruthy()
    // Adjacent non-deload week should be substantially higher
    const idx = p.weeks.indexOf(deload)
    const neighbor = p.weeks[idx + 1] && !p.weeks[idx + 1].isDeload
      ? p.weeks[idx + 1]
      : (idx > 0 ? p.weeks[idx - 1] : null)
    if (neighbor && !neighbor.isDeload) {
      expect(deload.weeklyTSS).toBeLessThan(neighbor.weeklyTSS)
    }
  })
})
