// src/lib/__tests__/athlete/eliteProgram.test.js
import { describe, it, expect } from 'vitest'
import { buildEliteProgram, PHASE_FOCUS } from '../../athlete/eliteProgram.js'

const TODAY = '2026-05-04'

// ── canonical fixtures ──
const RUN_REALISTIC = {
  currentPR: { distanceM: 10000, timeSec: 3000 },  // 50:00
  targetPR:  { distanceM: 10000, timeSec: 2820 },  // 47:00
  raceDate: '2026-08-25',                           // ~16w
  sport: 'run',
  options: { today: TODAY },
}

const RUN_COMFORTABLE = {
  currentPR: { distanceM: 10000, timeSec: 3000 },  // 50:00
  targetPR:  { distanceM: 10000, timeSec: 2940 },  // 49:00
  raceDate: '2026-06-30',                           // ~8w
  sport: 'run',
  options: { today: TODAY },
}

const RUN_AGGRESSIVE = {
  currentPR: { distanceM: 10000, timeSec: 3000 },  // 50:00
  targetPR:  { distanceM: 10000, timeSec: 2880 },  // 48:00
  raceDate: '2026-06-09',                           // ~5w
  sport: 'run',
  options: { today: TODAY },
}

const RUN_UNREALISTIC = {
  currentPR: { distanceM: 10000, timeSec: 3000 },  // 50:00
  targetPR:  { distanceM: 10000, timeSec: 2100 },  // 35:00 — huge gap
  raceDate: '2026-06-02',                           // ~4w
  sport: 'run',
  options: { today: TODAY },
}

describe('buildEliteProgram — input validation', () => {
  it('returns null for missing input', () => {
    expect(buildEliteProgram(null)).toBeNull()
    expect(buildEliteProgram(undefined)).toBeNull()
    expect(buildEliteProgram({})).toBeNull()
  })

  it('returns null when currentPR is missing', () => {
    expect(buildEliteProgram({ targetPR: { distanceM: 10000, timeSec: 2820 }, raceDate: '2026-08-25', sport: 'run' })).toBeNull()
  })

  it('returns null when targetPR is missing', () => {
    expect(buildEliteProgram({ currentPR: { distanceM: 10000, timeSec: 3000 }, raceDate: '2026-08-25', sport: 'run' })).toBeNull()
  })

  it('returns null when raceDate is missing', () => {
    expect(buildEliteProgram({ ...RUN_REALISTIC, raceDate: undefined })).toBeNull()
  })

  it('returns null when sport is invalid', () => {
    expect(buildEliteProgram({ ...RUN_REALISTIC, sport: 'walking' })).toBeNull()
  })

  it('returns null when raceDate is malformed', () => {
    expect(buildEliteProgram({ ...RUN_REALISTIC, raceDate: 'not-a-date' })).toBeNull()
  })

  it('returns null when timeSec is non-numeric or zero', () => {
    expect(buildEliteProgram({ ...RUN_REALISTIC, currentPR: { distanceM: 10000, timeSec: 0 } })).toBeNull()
    expect(buildEliteProgram({ ...RUN_REALISTIC, currentPR: { distanceM: 10000, timeSec: 'fast' } })).toBeNull()
  })
})

describe('buildEliteProgram — rejection paths', () => {
  it('rejects targetPR slower than currentPR for run', () => {
    const r = buildEliteProgram({
      ...RUN_REALISTIC,
      targetPR: { distanceM: 10000, timeSec: 3300 },  // slower
    })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('target-not-faster')
    expect(r.note.en).toMatch(/faster|FTP/i)
    expect(r.note.tr.length).toBeGreaterThan(0)
  })

  it('rejects equal target and current times', () => {
    const r = buildEliteProgram({
      ...RUN_REALISTIC,
      targetPR: { distanceM: 10000, timeSec: 3000 },
    })
    expect(r._rejected).toBe(true)
  })

  it('rejects raceDate in the past', () => {
    const r = buildEliteProgram({
      ...RUN_REALISTIC,
      raceDate: '2026-04-01',
    })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('race-in-past')
    expect(r.note.tr).toMatch(/geçmiş/i)
  })
})

describe('buildEliteProgram — feasibility bands (run)', () => {
  it('classifies 50:00 → 47:00 in 16w as realistic', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.feasibility.band).toBe('realistic')
    expect(r.reliable).toBe(true)
  })

  it('classifies 50:00 → 49:00 in 8w as comfortable', () => {
    const r = buildEliteProgram(RUN_COMFORTABLE)
    expect(r.feasibility.band).toBe('comfortable')
    expect(r.reliable).toBe(true)
  })

  it('classifies a tight near-fit run as aggressive', () => {
    const r = buildEliteProgram(RUN_AGGRESSIVE)
    expect(['aggressive', 'unrealistic']).toContain(r.feasibility.band)
  })

  it('classifies 50:00 → 35:00 in 4w as unrealistic', () => {
    const r = buildEliteProgram(RUN_UNREALISTIC)
    expect(r.feasibility.band).toBe('unrealistic')
    expect(r.reliable).toBe(false)
  })

  it('feasibility note bilingual messages match band', () => {
    const r = buildEliteProgram(RUN_COMFORTABLE)
    expect(r.feasibility.note.en).toMatch(/comfortable/i)
    expect(r.feasibility.note.tr).toMatch(/rahat/i)
  })
})

describe('buildEliteProgram — weeksAvailable computation', () => {
  it('computes weeksAvailable from today→raceDate', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.feasibility.weeksAvailable).toBe(16)
  })

  it('weeksAvailable matches weeklyTSS length', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.weeklyTSS.length).toBe(r.feasibility.weeksAvailable)
  })

  it('honors options.today override deterministically', () => {
    const a = buildEliteProgram({ ...RUN_REALISTIC, options: { today: '2026-05-04' } })
    const b = buildEliteProgram({ ...RUN_REALISTIC, options: { today: '2026-05-04' } })
    expect(a.feasibility.weeksAvailable).toBe(b.feasibility.weeksAvailable)
    expect(a.weeklyTSS).toEqual(b.weeklyTSS)
  })
})

describe('buildEliteProgram — phase split', () => {
  it('16+ weeks: includes Base, Build, Peak, Taper with Taper clamped to 2', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const taper = r.phases.find(p => p.phase === 'Taper')
    expect(taper.weeks.length).toBe(2)
    expect(r.phases.map(p => p.phase)).toEqual(['Base', 'Build', 'Peak', 'Taper'])
  })

  it('8-15 weeks: Base, Build, Peak, Taper present', () => {
    const r = buildEliteProgram({
      ...RUN_REALISTIC,
      raceDate: '2026-07-21',  // ~11w
    })
    const phaseNames = r.phases.map(p => p.phase)
    expect(phaseNames).toContain('Build')
    expect(phaseNames).toContain('Peak')
    expect(phaseNames).toContain('Taper')
  })

  it('4-7 weeks: no Base, only Build/Peak/Taper', () => {
    const r = buildEliteProgram({
      ...RUN_COMFORTABLE,
      raceDate: '2026-06-09',  // ~5w
    })
    const phaseNames = r.phases.map(p => p.phase)
    expect(phaseNames).not.toContain('Base')
    expect(phaseNames).toContain('Peak')
    expect(phaseNames).toContain('Taper')
  })

  it('<4 weeks: degraded mode — Peak + Taper only', () => {
    const r = buildEliteProgram({
      ...RUN_COMFORTABLE,
      raceDate: '2026-05-26',  // ~3w
    })
    const phaseNames = r.phases.map(p => p.phase)
    expect(phaseNames).not.toContain('Base')
    expect(phaseNames).not.toContain('Build')
    expect(r.recommendation.en).toMatch(/<7 weeks|degraded/i)
  })

  it('phase week sums equal weeksAvailable', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const sum = r.phases.reduce((s, p) => s + p.weeks.length, 0)
    expect(sum).toBe(r.feasibility.weeksAvailable)
  })

  it('each phase has color and bilingual focus', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    for (const p of r.phases) {
      expect(typeof p.color).toBe('string')
      expect(p.color).toMatch(/^#/)
      // v8.103.0: phase.focus is now a bilingual object {en, tr}
      expect(typeof p.focus).toBe('object')
      expect(typeof p.focus.en).toBe('string')
      expect(typeof p.focus.tr).toBe('string')
      expect(p.focus.en.length).toBeGreaterThan(0)
    }
  })
})

describe('buildEliteProgram — weeklyTSS curve and deload', () => {
  it('weeklyTSS length matches weeksAvailable', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.weeklyTSS.length).toBe(r.feasibility.weeksAvailable)
  })

  it('TSS values are non-negative integers', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    for (const t of r.weeklyTSS) {
      expect(Number.isInteger(t)).toBe(true)
      expect(t).toBeGreaterThanOrEqual(0)
    }
  })

  it('contains a 3:1 deload pattern (week 4 lower than week 3)', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.weeklyTSS[3]).toBeLessThan(r.weeklyTSS[2])
  })

  it('peak phase TSS exceeds base phase TSS (excluding deloads)', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const basePhase = r.phases.find(p => p.phase === 'Base')
    const peakPhase = r.phases.find(p => p.phase === 'Peak')
    const baseAvg = basePhase.weeks.reduce((s, w) => s + r.weeklyTSS[w - 1], 0) / basePhase.weeks.length
    const peakAvg = peakPhase.weeks.reduce((s, w) => s + r.weeklyTSS[w - 1], 0) / peakPhase.weeks.length
    expect(peakAvg).toBeGreaterThan(baseAvg)
  })

  it('race week TSS is the lowest', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const last = r.weeklyTSS[r.weeklyTSS.length - 1]
    expect(last).toBeLessThanOrEqual(Math.min(...r.weeklyTSS))
  })
})

describe('buildEliteProgram — sample weeks structure', () => {
  it('returns sample weeks for present phases', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(Array.isArray(r.sampleWeeks.Base)).toBe(true)
    expect(r.sampleWeeks.Base.length).toBeGreaterThanOrEqual(5)
    expect(r.sampleWeeks.Base.length).toBeLessThanOrEqual(7)
  })

  it('each day has required fields', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    for (const d of r.sampleWeeks.Build) {
      expect(d).toHaveProperty('day')
      expect(d).toHaveProperty('intent')
      expect(d.intent).toHaveProperty('en')
      expect(d.intent).toHaveProperty('tr')
      expect(d).toHaveProperty('durationMin')
      expect(d).toHaveProperty('zones')
      expect(d.zones).toHaveProperty('Z1')
      expect(d).toHaveProperty('notes')
      expect(d.notes).toHaveProperty('en')
      expect(d.notes).toHaveProperty('tr')
    }
  })

  it('sample weeks empty for absent phases', () => {
    const r = buildEliteProgram({
      ...RUN_COMFORTABLE,
      raceDate: '2026-06-09',  // ~5w, no Base
    })
    expect(r.sampleWeeks.Base).toEqual([])
    expect(r.sampleWeeks.Peak.length).toBeGreaterThan(0)
  })
})

describe('buildEliteProgram — bike sport', () => {
  it('handles direct FTP wattage (distanceM=0)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 230 },
      targetPR:  { distanceM: 0, timeSec: 250 },
      raceDate: '2026-07-28',
      sport: 'bike',
      options: { today: TODAY },
    })
    expect(r.currentLevel.ftp).toBe(230)
    expect(r.targetLevel.ftp).toBe(250)
    expect(r.currentLevel.vdot).toBeNull()
  })

  it('rejects bike target FTP below current (direct mode)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 250 },
      targetPR:  { distanceM: 0, timeSec: 230 },
      raceDate: '2026-07-28',
      sport: 'bike',
      options: { today: TODAY },
    })
    expect(r._rejected).toBe(true)
  })

  it('handles bike TT mode (distance > 0, derives FTP)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 40000, timeSec: 3600 },
      targetPR:  { distanceM: 40000, timeSec: 3360 },
      raceDate: '2026-08-25',
      sport: 'bike',
      options: { today: TODAY },
    })
    expect(r.currentLevel.ftp).toBeGreaterThan(0)
    expect(r.targetLevel.ftp).toBeGreaterThan(r.currentLevel.ftp)
    expect(Array.isArray(r.currentLevel.paces)).toBe(true)  // cycling zones array
  })
})

describe('buildEliteProgram — swim sport', () => {
  it('classifies 1500m 22:00 → 21:00 in 12w (aggressive or realistic)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 1500, timeSec: 1320 },  // 22:00
      targetPR:  { distanceM: 1500, timeSec: 1260 },  // 21:00
      raceDate: '2026-07-28',
      sport: 'swim',
      options: { today: TODAY },
    })
    expect(['realistic', 'aggressive', 'comfortable']).toContain(r.feasibility.band)
    expect(r.currentLevel.css).toBeGreaterThan(0)
    expect(r.targetLevel.css).toBeGreaterThan(0)
    expect(r.targetLevel.css).toBeLessThan(r.currentLevel.css)
  })

  it('swim sample weeks have swim-style intents', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 1500, timeSec: 1320 },
      targetPR:  { distanceM: 1500, timeSec: 1260 },
      raceDate: '2026-09-15',
      sport: 'swim',
      options: { today: TODAY },
    })
    const intentTexts = r.sampleWeeks.Build.map(d => d.intent.en).join(' ')
    expect(intentTexts).toMatch(/CSS|aerobic|threshold/i)
  })
})

describe('buildEliteProgram — triathlon sport', () => {
  it('returns valid shape using run-only feasibility math', () => {
    const r = buildEliteProgram({
      ...RUN_REALISTIC,
      sport: 'triathlon',
    })
    expect(r.sport).toBe('triathlon')
    expect(r.currentLevel.vdot).toBeGreaterThan(0)
    expect(r.feasibility.band).toBeTruthy()
    expect(r.recommendation.en).toMatch(/run-only|Triathlon mode/i)
    expect(r.recommendation.tr).toMatch(/koşu/i)
  })

  // v9.6.0 — multi-discipline sample weeks + key sessions.
  it('sampleWeeks.Base spans swim, bike, and run disciplines', () => {
    const r = buildEliteProgram({ ...RUN_REALISTIC, sport: 'triathlon' })
    const disciplines = new Set(r.sampleWeeks.Base.map(d => d.discipline))
    expect(disciplines.has('swim')).toBe(true)
    expect(disciplines.has('bike')).toBe(true)
    expect(disciplines.has('run')).toBe(true)
  })

  it('every triathlon sample-week day has a discipline tag', () => {
    const r = buildEliteProgram({ ...RUN_REALISTIC, sport: 'triathlon' })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      for (const day of r.sampleWeeks[phase] || []) {
        expect(typeof day.discipline).toBe('string')
        expect(['swim', 'bike', 'run', 'rest']).toContain(day.discipline)
      }
    }
  })

  it('keySessionLibrary flattens all 3 disciplines with discipline tags', () => {
    const r = buildEliteProgram({ ...RUN_REALISTIC, sport: 'triathlon' })
    const baseLib = r.keySessionLibrary.Base
    expect(baseLib.length).toBeGreaterThan(3)  // swim+bike+run > single sport
    const disciplines = new Set(baseLib.map(s => s.discipline))
    expect(disciplines.has('swim')).toBe(true)
    expect(disciplines.has('bike')).toBe(true)
    expect(disciplines.has('run')).toBe(true)
  })

  it('triathlon Peak phase includes brick sessions', () => {
    const r = buildEliteProgram({ ...RUN_REALISTIC, sport: 'triathlon' })
    const intentTexts = r.sampleWeeks.Peak.map(d => d.intent.en).join(' ')
    expect(intentTexts).toMatch(/brick/i)
  })

  it('non-triathlon sports still get untagged sessions', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    for (const day of r.sampleWeeks.Base) {
      expect(day.discipline).toBeUndefined()
    }
  })
})

describe('buildEliteProgram — rowing sport (v9.7.0)', () => {
  const ROWING_REALISTIC = {
    sport: 'rowing',
    currentPR: { distanceM: 0, timeSec: 420 },  // 7:00 2k
    targetPR:  { distanceM: 0, timeSec: 405 },  // 6:45 2k (15-sec drop)
    raceDate: '2026-09-15',
    options: { today: TODAY },
    profile: { bodyMassKg: 80, weeklyHours: 8 },
  }

  it('returns valid program shape for rowing', () => {
    const r = buildEliteProgram(ROWING_REALISTIC)
    expect(r).toBeTruthy()
    expect(r.sport).toBe('rowing')
    expect(r.feasibility?.band).toBeTruthy()
  })

  it('currentLevel exposes 2k split fields', () => {
    const r = buildEliteProgram(ROWING_REALISTIC)
    expect(r.currentLevel.split2kSec).toBe(420)
    expect(r.currentLevel.split500Sec).toBe(105)  // 420/4
    expect(r.currentLevel.vdot).toBeNull()
    expect(r.currentLevel.ftp).toBeNull()
    expect(r.currentLevel.css).toBeNull()
  })

  it('rejects target slower than current', () => {
    const r = buildEliteProgram({
      ...ROWING_REALISTIC,
      targetPR: { distanceM: 0, timeSec: 450 },  // 7:30 (slower)
    })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('target-not-faster')
  })

  it('predicts 2k from non-2k race time via Paul law', () => {
    const r = buildEliteProgram({
      ...ROWING_REALISTIC,
      currentPR: { distanceM: 5000, timeSec: 1110 },  // 18:30 5k row
      targetPR:  { distanceM: 5000, timeSec: 1080 },  // 18:00
    })
    expect(r).toBeTruthy()
    expect(r.currentLevel.split2kSec).toBeGreaterThan(0)
    expect(r.currentLevel.split2kSec).toBeLessThan(450)
  })

  it('sample weeks span all 4 phases with rowing-specific content', () => {
    const r = buildEliteProgram(ROWING_REALISTIC)
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      const wk = r.sampleWeeks[phase]
      expect(Array.isArray(wk)).toBe(true)
      expect(wk.length).toBe(7)  // 7 days
      const intentTexts = wk.map(d => d.intent.en).join(' ').toLowerCase()
      expect(/ut2|ut1|at|tr|2k|race-pace|sharpener/.test(intentTexts)).toBe(true)
    }
  })

  it('keySessionLibrary populated with rowing sessions per phase', () => {
    const r = buildEliteProgram(ROWING_REALISTIC)
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      const lib = r.keySessionLibrary[phase]
      expect(Array.isArray(lib)).toBe(true)
      expect(lib.length).toBeGreaterThan(0)
      for (const s of lib) {
        expect(s.key).toMatch(/^row-/)
        expect(s.citation).toBeTruthy()
      }
    }
  })

  it('raceWeekProtocol includes rowing-specific T-2 sharpener', () => {
    const r = buildEliteProgram(ROWING_REALISTIC)
    const t2 = r.raceWeekProtocol.schedule.find(d => d.tMinus === 2)
    expect(t2).toBeTruthy()
    expect(t2.session.en.toLowerCase()).toMatch(/sharpener|250m|an/i)
  })

  it('raceWeekProtocol day-of mentions short-race fueling', () => {
    const r = buildEliteProgram(ROWING_REALISTIC)
    expect(r.raceWeekProtocol.raceDay.fueling.en).toMatch(/no mid-race|<8 min|race <8/i)
  })

  it('substitutionMap has rowing-specific keys (Easy/Threshold/RacePace/Race)', () => {
    const r = buildEliteProgram(ROWING_REALISTIC)
    expect(Object.keys(r.substitutionMap)).toContain('Threshold')
    expect(Object.keys(r.substitutionMap)).toContain('RacePace')
    expect(r.substitutionMap.Easy.indoor.en).toMatch(/erg/i)
  })

  it('paceTarget on UT2 days uses split format (M:SS/500m)', () => {
    const r = buildEliteProgram(ROWING_REALISTIC)
    const utDay = r.sampleWeeks.Base.find(d => /ut2/i.test(d.intent.en) && d.durationMin > 0)
    expect(utDay.paceTarget).toMatch(/^\d+:\d{2}\/500m$/)
  })
})

describe('buildEliteProgram — v9.8.0 coaching maturity', () => {
  // Race simulation in Peak (B1)
  describe('race simulation Peak workout', () => {
    it('run Peak library includes race-simulation session', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      const keys = r.keySessionLibrary.Peak.map(s => s.key)
      expect(keys).toContain('run-peak-race-simulation')
    })
    it('bike Peak library includes race-simulation session', () => {
      const r = buildEliteProgram({
        sport: 'bike',
        currentPR: { distanceM: 0, timeSec: 250 },
        targetPR:  { distanceM: 0, timeSec: 280 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const keys = r.keySessionLibrary.Peak.map(s => s.key)
      expect(keys).toContain('bike-peak-race-simulation')
    })
    it('swim Peak library includes race-simulation session', () => {
      const r = buildEliteProgram({
        sport: 'swim',
        currentPR: { distanceM: 1500, timeSec: 1500 },
        targetPR:  { distanceM: 1500, timeSec: 1380 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const keys = r.keySessionLibrary.Peak.map(s => s.key)
      expect(keys).toContain('swim-peak-race-simulation')
    })
    it('rowing Peak library includes race-simulation session', () => {
      const r = buildEliteProgram({
        sport: 'rowing',
        currentPR: { distanceM: 0, timeSec: 420 },
        targetPR:  { distanceM: 0, timeSec: 405 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const keys = r.keySessionLibrary.Peak.map(s => s.key)
      expect(keys).toContain('row-peak-race-simulation')
    })
    it('triathlon flattened library inherits race-simulation from all 3 disciplines', () => {
      const r = buildEliteProgram({
        ...RUN_REALISTIC,
        sport: 'triathlon',
      })
      const keys = r.keySessionLibrary.Peak.map(s => s.key)
      expect(keys).toContain('run-peak-race-simulation')
      expect(keys).toContain('bike-peak-race-simulation')
      expect(keys).toContain('swim-peak-race-simulation')
    })
  })

  // OW transitions for tri (B3)
  describe('open-water swim session', () => {
    it('swim Peak includes open-water sighting session', () => {
      const r = buildEliteProgram({
        sport: 'swim',
        currentPR: { distanceM: 1500, timeSec: 1500 },
        targetPR:  { distanceM: 1500, timeSec: 1380 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const keys = r.keySessionLibrary.Peak.map(s => s.key)
      expect(keys).toContain('swim-peak-open-water')
    })
    it('triathlon Peak inherits open-water session', () => {
      const r = buildEliteProgram({ ...RUN_REALISTIC, sport: 'triathlon' })
      const keys = r.keySessionLibrary.Peak.map(s => s.key)
      expect(keys).toContain('swim-peak-open-water')
    })
  })

  // Pre-race meal library (B4)
  describe('pre-race meal library', () => {
    it('run race-day surface preRaceMeals array (≥4 entries)', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      const meals = r.raceWeekProtocol.raceDay.preRaceMeals
      expect(Array.isArray(meals.en)).toBe(true)
      expect(meals.en.length).toBeGreaterThanOrEqual(4)
      expect(Array.isArray(meals.tr)).toBe(true)
      expect(meals.tr.length).toBe(meals.en.length)
    })
    it('rowing race-day notes no mid-race fueling', () => {
      const r = buildEliteProgram({
        sport: 'rowing',
        currentPR: { distanceM: 0, timeSec: 420 },
        targetPR:  { distanceM: 0, timeSec: 405 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const meals = r.raceWeekProtocol.raceDay.preRaceMeals.en.join(' ')
      expect(meals).toMatch(/no mid-race|race <8/i)
    })
  })

  // Travel / altitude / heat (B5)
  describe('environmental conditional protocols', () => {
    it('no travel/altitude/heat blocks when conditions unset', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      expect(r.raceWeekProtocol.travel).toBeUndefined()
      expect(r.raceWeekProtocol.altitude).toBeUndefined()
      expect(r.raceWeekProtocol.heat).toBeUndefined()
    })
    it('travel protocol surfaces for ≥3h timezone shift', () => {
      const r = buildEliteProgram({ ...RUN_REALISTIC, timeZoneShiftHrs: 8 })
      expect(r.raceWeekProtocol.travel).toBeTruthy()
      expect(r.raceWeekProtocol.travel.summary.en).toMatch(/8h eastward/i)
    })
    it('travel protocol omitted for sub-3h shift', () => {
      const r = buildEliteProgram({ ...RUN_REALISTIC, timeZoneShiftHrs: 2 })
      expect(r.raceWeekProtocol.travel).toBeUndefined()
    })
    it('altitude block surfaces for ≥1500m race', () => {
      const r = buildEliteProgram({ ...RUN_REALISTIC, raceAltitudeM: 2400 })
      expect(r.raceWeekProtocol.altitude).toBeTruthy()
      expect(r.raceWeekProtocol.altitude.summary.en).toMatch(/2400m.*high/i)
    })
    it('altitude omitted at sea level', () => {
      const r = buildEliteProgram({ ...RUN_REALISTIC, raceAltitudeM: 50 })
      expect(r.raceWeekProtocol.altitude).toBeUndefined()
    })
    it('heat block surfaces for ≥25°C race-day forecast', () => {
      const r = buildEliteProgram({ ...RUN_REALISTIC, raceHeatC: 33 })
      expect(r.raceWeekProtocol.heat).toBeTruthy()
      expect(r.raceWeekProtocol.heat.summary.en).toMatch(/33.C.*extreme/i)
    })
    it('heat omitted for cool race-day', () => {
      const r = buildEliteProgram({ ...RUN_REALISTIC, raceHeatC: 18 })
      expect(r.raceWeekProtocol.heat).toBeUndefined()
    })
  })

  // Field-test recalibration (B2)
  describe('field-test recalibration', () => {
    it('no fieldTestRecal when actualFieldTestResults absent', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      expect(r.fieldTestRecal).toBeUndefined()
    })
    it('ahead-of-plan athlete gets Peak/Taper TSS scaled UP', () => {
      const baseline = buildEliteProgram(RUN_REALISTIC)
      const ahead = buildEliteProgram({
        ...RUN_REALISTIC,
        actualFieldTestResults: { vdot: baseline.currentLevel.vdot + 3 },
      })
      expect(ahead.fieldTestRecal).toBeTruthy()
      expect(ahead.fieldTestRecal.scalingApplied).toBeGreaterThan(1)
      // Last week (Taper W2) should be higher
      expect(ahead.weeklyTSS[ahead.weeklyTSS.length - 1])
        .toBeGreaterThan(baseline.weeklyTSS[baseline.weeklyTSS.length - 1])
    })
    it('behind-plan athlete gets Peak/Taper TSS scaled DOWN', () => {
      const baseline = buildEliteProgram(RUN_REALISTIC)
      const behind = buildEliteProgram({
        ...RUN_REALISTIC,
        actualFieldTestResults: { vdot: baseline.currentLevel.vdot - 0.5 },  // regressed
      })
      expect(behind.fieldTestRecal).toBeTruthy()
      expect(behind.fieldTestRecal.scalingApplied).toBeLessThan(1)
    })
    it('clamps scaling to [0.7, 1.3] range', () => {
      const baseline = buildEliteProgram(RUN_REALISTIC)
      const wayAhead = buildEliteProgram({
        ...RUN_REALISTIC,
        actualFieldTestResults: { vdot: baseline.currentLevel.vdot + 10 },  // wildly ahead
      })
      expect(wayAhead.fieldTestRecal.scalingApplied).toBeLessThanOrEqual(1.3)
    })
    it('Base + Build TSS unaffected — only Peak/Taper rescaled', () => {
      const baseline = buildEliteProgram(RUN_REALISTIC)
      const recal = buildEliteProgram({
        ...RUN_REALISTIC,
        actualFieldTestResults: { vdot: baseline.currentLevel.vdot + 3 },
      })
      // Base weeks (first phase) should match
      expect(recal.weeklyTSS[0]).toBe(baseline.weeklyTSS[0])
    })
    it('rowing field-test uses split2kSec', () => {
      const base = buildEliteProgram({
        sport: 'rowing',
        currentPR: { distanceM: 0, timeSec: 450 },  // 7:30 2k
        targetPR:  { distanceM: 0, timeSec: 420 },  // 7:00 2k
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const recal = buildEliteProgram({
        sport: 'rowing',
        currentPR: { distanceM: 0, timeSec: 450 },
        targetPR:  { distanceM: 0, timeSec: 420 },
        raceDate: '2026-08-25', options: { today: TODAY },
        actualFieldTestResults: { split2kSec: 442 },  // 8 sec faster than start
      })
      expect(recal.fieldTestRecal).toBeTruthy()
      expect(recal.fieldTestRecal.scalingApplied).toBeGreaterThan(1)
      void base
    })
  })
})

describe('buildEliteProgram — output shape and metadata', () => {
  it('citation includes Daniels, Coggan, Wakayoshi', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.citation).toMatch(/Daniels/)
    expect(r.citation).toMatch(/Coggan/)
    expect(r.citation).toMatch(/Wakayoshi/)
  })

  it('includes run-specific paces in currentLevel.paces', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.currentLevel.paces).toBeTruthy()
    expect(typeof r.currentLevel.paces.E).toBe('number')
    expect(typeof r.currentLevel.paces.T).toBe('number')
  })

  it('recommendation is bilingual', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(typeof r.recommendation.en).toBe('string')
    expect(typeof r.recommendation.tr).toBe('string')
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('flags weeklyHours outside reasonable band', () => {
    const r = buildEliteProgram({
      ...RUN_REALISTIC,
      profile: { currentCTL: 50, weeklyHours: 30, trainingDays: 5 },
    })
    expect(r.recommendation.en).toMatch(/Weekly training hours|3-25/i)
  })

  it('reliable=false when band is unrealistic', () => {
    const r = buildEliteProgram(RUN_UNREALISTIC)
    expect(r.reliable).toBe(false)
  })

  it('deltaPct reflects requested improvement percent', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    // 50:00→47:00 → 6% improvement
    expect(r.feasibility.deltaPct).toBeCloseTo(6, 1)
  })
})

// ─── v8.96.0 — general-user paths (weeksOverride, noTarget, both) ────────────
describe('buildEliteProgram — v8.96.0 weeksOverride (no race date)', () => {
  it('weeksOverride=16, no raceDate → weeksAvailable=16 + synthetic raceDate marker', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      sport: 'run',
      weeksOverride: 16,
      options: { today: TODAY },
    })
    expect(r).toBeTruthy()
    expect(r.feasibility.weeksAvailable).toBe(16)
    expect(r.synthetic).toBeTruthy()
    expect(r.synthetic.raceDate).toBe(true)
    expect(r.synthetic.raceLabel).toBe('FINAL WEEK')
    expect(typeof r.feasibility.effectiveRaceDate).toBe('string')
    // effectiveRaceDate = today + 16w = 2026-08-24
    expect(r.feasibility.effectiveRaceDate).toBe('2026-08-24')
  })

  it('weeksOverride=100 → clamped to 52', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      sport: 'run',
      weeksOverride: 100,
      options: { today: TODAY },
    })
    expect(r.feasibility.weeksAvailable).toBe(52)
  })

  it('weeksOverride=2 → clamped to 4', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2940 },
      sport: 'run',
      weeksOverride: 2,
      options: { today: TODAY },
    })
    expect(r.feasibility.weeksAvailable).toBe(4)
  })

  it('explicit raceDate AND weeksOverride → raceDate wins', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      sport: 'run',
      raceDate: '2026-08-25',     // ~16w
      weeksOverride: 24,           // would otherwise force 24w
      options: { today: TODAY },
    })
    expect(r.feasibility.weeksAvailable).toBe(16)
    expect(r.synthetic).toBeUndefined()
  })

  it('raceDate=null AND weeksOverride=null AND noTarget=true → still rejects (no horizon)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      sport: 'run',
      noTarget: true,
      options: { today: TODAY },
    })
    expect(r).toBeNull()
  })
})

describe('buildEliteProgram — v8.96.0 noTarget synthetic target', () => {
  it('run noTarget=true, 10K@50:00 over 16w → target VDOT ~ +1.7 from cVdot, deltaPct > 0', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      sport: 'run',
      raceDate: '2026-08-25',  // ~16w
      noTarget: true,
      options: { today: TODAY },
    })
    expect(r).toBeTruthy()
    expect(r.synthetic).toBeTruthy()
    expect(r.synthetic.targetPR).toBe(true)
    expect(r.feasibility.deltaPct).toBeGreaterThan(0)
    // VDOT for 10K@50:00 ≈ 41.6; gain rate at <45 is 2.5 per 12w; 16w scale = 16/12 ≈ 1.33; gain ≈ 3.3
    expect(r.targetLevel.vdot).toBeGreaterThan(r.currentLevel.vdot)
    expect(r.targetLevel.vdot - r.currentLevel.vdot).toBeLessThanOrEqual(6 + 0.001) // cap
  })

  it('bike noTarget + FTP-direct (distanceM=0) synthesizes target watts', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 230 },  // 230W FTP
      sport: 'bike',
      raceDate: '2026-07-28',  // ~12w
      noTarget: true,
      options: { today: TODAY },
    })
    expect(r).toBeTruthy()
    expect(r.synthetic.targetPR).toBe(true)
    expect(r.targetLevel.ftp).toBeGreaterThan(r.currentLevel.ftp)
    // Cap: target FTP - current FTP <= 30W
    expect(r.targetLevel.ftp - r.currentLevel.ftp).toBeLessThanOrEqual(30)
  })

  it('bike noTarget + TT mode synthesizes faster TT time', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 40000, timeSec: 3600 },
      sport: 'bike',
      raceDate: '2026-08-25',
      noTarget: true,
      options: { today: TODAY },
    })
    expect(r).toBeTruthy()
    expect(r.synthetic.targetPR).toBe(true)
    expect(r.targetLevel.ftp).toBeGreaterThan(r.currentLevel.ftp)
  })

  it('swim noTarget synthesizes faster CSS pace', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 1500, timeSec: 1320 },  // 22:00
      sport: 'swim',
      raceDate: '2026-08-25',
      noTarget: true,
      options: { today: TODAY },
    })
    expect(r).toBeTruthy()
    expect(r.synthetic.targetPR).toBe(true)
    expect(r.targetLevel.css).toBeLessThan(r.currentLevel.css)
  })

  it('triathlon noTarget uses run formula for synthetic VDOT', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      sport: 'triathlon',
      raceDate: '2026-08-25',
      noTarget: true,
      options: { today: TODAY },
    })
    expect(r).toBeTruthy()
    expect(r.synthetic.targetPR).toBe(true)
    expect(r.targetLevel.vdot).toBeGreaterThan(r.currentLevel.vdot)
  })

  it('explicit targetPR provided → noTarget flag ignored (explicit wins)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },  // explicit 47:00
      sport: 'run',
      raceDate: '2026-08-25',
      noTarget: true,
      options: { today: TODAY },
    })
    expect(r).toBeTruthy()
    expect(r.synthetic).toBeUndefined()
    expect(r.resolvedTargetPR.timeSec).toBe(2820)
  })

  it('combined noTarget + weeksOverride (general-user mode) synthesizes both anchors', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      sport: 'run',
      noTarget: true,
      weeksOverride: 12,
      options: { today: TODAY },
    })
    expect(r).toBeTruthy()
    expect(r.synthetic).toBeTruthy()
    expect(r.synthetic.targetPR).toBe(true)
    expect(r.synthetic.raceDate).toBe(true)
    expect(r.feasibility.weeksAvailable).toBe(12)
    expect(r.recommendation.en).toMatch(/Auto-target derived/i)
    expect(r.recommendation.tr).toMatch(/türetildi/i)
  })

  it('synthetic recommendation copy is bilingual', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      sport: 'run',
      noTarget: true,
      weeksOverride: 16,
      options: { today: TODAY },
    })
    expect(r.recommendation.en).toMatch(/Daniels gain rate/i)
    expect(r.recommendation.tr).toMatch(/Daniels gelişim hızı/i)
  })

  it('target-faster validation still applies post-synthesis (sanity)', () => {
    // For very high VDOT, the gain may approach 0; the orchestrator still
    // returns a synthetic target faster than current via cap math.
    const r = buildEliteProgram({
      currentPR: { distanceM: 5000, timeSec: 900 },  // 15:00 5K
      sport: 'run',
      noTarget: true,
      weeksOverride: 12,
      options: { today: TODAY },
    })
    expect(r).toBeTruthy()
    expect(r.targetLevel.vdot).toBeGreaterThan(r.currentLevel.vdot)
  })
})

// ─── PHASE_FOCUS export contract (v8.103.0) ─────────────────────────────────
// Single source of truth — eliteProgram.js owns it; todayProgrammedSession.js
// imports from here. Lock the bilingual shape so downstream consumers can
// rely on it.
describe('PHASE_FOCUS export — single source of truth', () => {
  it('exports a public bilingual PHASE_FOCUS object', () => {
    expect(PHASE_FOCUS).toBeDefined()
    expect(typeof PHASE_FOCUS).toBe('object')
  })

  it('covers all 4 phases', () => {
    expect(PHASE_FOCUS.Base).toBeDefined()
    expect(PHASE_FOCUS.Build).toBeDefined()
    expect(PHASE_FOCUS.Peak).toBeDefined()
    expect(PHASE_FOCUS.Taper).toBeDefined()
  })

  it('each phase has both en and tr keys with non-empty strings', () => {
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      expect(typeof PHASE_FOCUS[phase].en).toBe('string')
      expect(typeof PHASE_FOCUS[phase].tr).toBe('string')
      expect(PHASE_FOCUS[phase].en.length).toBeGreaterThan(0)
      expect(PHASE_FOCUS[phase].tr.length).toBeGreaterThan(0)
    }
  })

  it('emits the bilingual focus object onto each phase in build output', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 50 * 60 },
      targetPR:  { distanceM: 10000, timeSec: 47 * 60 },
      sport: 'run',
      raceDate: '2026-08-15',
      options: { today: TODAY },
    })
    expect(r).toBeTruthy()
    const baseP = r.phases.find(p => p.phase === 'Base')
    expect(baseP).toBeDefined()
    expect(baseP.focus).toEqual(PHASE_FOCUS.Base)
  })
})

// ── v9.2.0 BROADER PLAN content layers ───────────────────────────────────────
describe('buildEliteProgram — v9.2.0 broader content layers', () => {
  const baseInput = {
    currentPR: { distanceM: 10000, timeSec: 50 * 60 },
    targetPR:  { distanceM: 10000, timeSec: 47 * 60 },
    sport: 'run',
    raceDate: '2026-08-15',
    options: { today: TODAY },
  }

  it('emits keySessionLibrary keyed by phase', () => {
    const r = buildEliteProgram(baseInput)
    expect(r.keySessionLibrary).toBeTruthy()
    expect(Array.isArray(r.keySessionLibrary.Base)).toBe(true)
    expect(Array.isArray(r.keySessionLibrary.Build)).toBe(true)
    expect(Array.isArray(r.keySessionLibrary.Peak)).toBe(true)
    expect(Array.isArray(r.keySessionLibrary.Taper)).toBe(true)
  })

  it('keySessionLibrary surfaces 3+ workouts per present phase', () => {
    const r = buildEliteProgram(baseInput)
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      if (r.keySessionLibrary[phase].length > 0) {
        expect(r.keySessionLibrary[phase].length).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('emits strengthProgram with per-phase prescriptions', () => {
    const r = buildEliteProgram(baseInput)
    expect(r.strengthProgram).toBeTruthy()
    expect(r.strengthProgram.Base).toBeTruthy()
    expect(r.strengthProgram.Base.frequencyPerWeek).toBeGreaterThan(0)
    expect(r.strengthProgram.Base.movements.length).toBeGreaterThan(0)
  })

  it('emits fuelingProgram with per-phase CHO/protein targets', () => {
    const r = buildEliteProgram(baseInput)
    expect(r.fuelingProgram).toBeTruthy()
    expect(r.fuelingProgram.Base.chodailyPerKg).toBeTruthy()
    expect(r.fuelingProgram.Taper.chodailyPerKg[1]).toBeGreaterThanOrEqual(10)
  })

  it('fueling absolute g/day computed when bodyMassKg present', () => {
    const r = buildEliteProgram({ ...baseInput, profile: { bodyMassKg: 70 } })
    expect(r.fuelingProgram.Base.dailyCHO_g).toBeTruthy()
    expect(r.fuelingProgram.Base.dailyProtein_g).toBeTruthy()
  })

  it('emits recoveryProgram with sleep + HRV trigger per phase', () => {
    const r = buildEliteProgram(baseInput)
    expect(r.recoveryProgram).toBeTruthy()
    expect(r.recoveryProgram.Base.sleepHoursTarget).toBeTruthy()
    expect(r.recoveryProgram.Build.hrvDropTriggerPct).toBeLessThanOrEqual(7)
  })

  it('emits raceWeekProtocol with 8-day schedule (T-7 to T-0)', () => {
    const r = buildEliteProgram(baseInput)
    expect(r.raceWeekProtocol).toBeTruthy()
    expect(r.raceWeekProtocol.schedule.length).toBe(8)
    expect(r.raceWeekProtocol.raceDay).toBeTruthy()
  })

  it('emits substitutionMap keyed by session intent', () => {
    const r = buildEliteProgram(baseInput)
    expect(r.substitutionMap).toBeTruthy()
    expect(r.substitutionMap.Easy).toBeTruthy()
    expect(r.substitutionMap.VO2).toBeTruthy()
  })

  it('substitutionMap is sport-aware (bike vs run)', () => {
    const r1 = buildEliteProgram(baseInput)
    const r2 = buildEliteProgram({
      ...baseInput,
      sport: 'bike',
      currentPR: { distanceM: 40000, timeSec: 70 * 60 },
      targetPR:  { distanceM: 40000, timeSec: 65 * 60 },
      profile: { ftp: 250 },
    })
    expect(JSON.stringify(r1.substitutionMap)).not.toBe(JSON.stringify(r2.substitutionMap))
  })

  it('all 6 broader content fields are present on minimal input', () => {
    const r = buildEliteProgram(baseInput)
    expect(r.keySessionLibrary).toBeDefined()
    expect(r.strengthProgram).toBeDefined()
    expect(r.fuelingProgram).toBeDefined()
    expect(r.recoveryProgram).toBeDefined()
    expect(r.raceWeekProtocol).toBeDefined()
    expect(r.substitutionMap).toBeDefined()
  })
})
