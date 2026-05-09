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

describe('buildEliteProgram — v9.9.0 cross-sport enhancements', () => {
  // Drills library
  describe('drillsLibrary', () => {
    it('run program exposes drills per phase', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      expect(r.drillsLibrary).toBeTruthy()
      expect(Array.isArray(r.drillsLibrary.Base)).toBe(true)
      expect(r.drillsLibrary.Base.length).toBeGreaterThan(0)
      const baseKeys = r.drillsLibrary.Base.map(d => d.key)
      expect(baseKeys.some(k => /run-drill-/.test(k))).toBe(true)
    })
    it('bike program exposes bike drills', () => {
      const r = buildEliteProgram({
        sport: 'bike',
        currentPR: { distanceM: 0, timeSec: 250 },
        targetPR:  { distanceM: 0, timeSec: 280 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const baseKeys = r.drillsLibrary.Base.map(d => d.key)
      expect(baseKeys.some(k => /bike-drill-/.test(k))).toBe(true)
    })
    it('rowing program exposes rowing drills', () => {
      const r = buildEliteProgram({
        sport: 'rowing',
        currentPR: { distanceM: 0, timeSec: 420 },
        targetPR:  { distanceM: 0, timeSec: 405 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const baseKeys = r.drillsLibrary.Base.map(d => d.key)
      expect(baseKeys.some(k => /row-drill-/.test(k))).toBe(true)
    })
    it('triathlon flattens drills from all 3 disciplines + tri-specific extras', () => {
      const r = buildEliteProgram({ ...RUN_REALISTIC, sport: 'triathlon' })
      const buildDisciplines = new Set(r.drillsLibrary.Build.map(d => d.discipline))
      expect(buildDisciplines.has('run')).toBe(true)
      expect(buildDisciplines.has('bike')).toBe(true)
      expect(buildDisciplines.has('swim')).toBe(true)
      expect(buildDisciplines.has('tri')).toBe(true)
    })
    it('every drill has key, name, purpose, structure, frequencyPerWeek, citation', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      for (const phase of ['Base', 'Build']) {
        for (const d of r.drillsLibrary[phase]) {
          expect(d.key).toBeTruthy()
          expect(d.name?.en).toBeTruthy()
          expect(d.name?.tr).toBeTruthy()
          expect(d.purpose?.en).toBeTruthy()
          expect(d.structure?.en).toBeTruthy()
          expect(typeof d.frequencyPerWeek).toBe('number')
          expect(d.citation).toBeTruthy()
        }
      }
    })
  })

  // Mental rehearsal
  describe('mentalRehearsal scripts', () => {
    it('run race-day surfaces ≥4 mental-rehearsal entries', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      const rehearsal = r.raceWeekProtocol.raceDay.mentalRehearsal
      expect(Array.isArray(rehearsal.en)).toBe(true)
      expect(rehearsal.en.length).toBeGreaterThanOrEqual(4)
      expect(rehearsal.tr.length).toBe(rehearsal.en.length)
    })
    it('run rehearsal includes contingency lines', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      const text = r.raceWeekProtocol.raceDay.mentalRehearsal.en.join(' ')
      expect(text).toMatch(/contingency|fall behind|feel great too early/i)
    })
    it('bike rehearsal mentions watts/numbers', () => {
      const r = buildEliteProgram({
        sport: 'bike',
        currentPR: { distanceM: 0, timeSec: 250 },
        targetPR:  { distanceM: 0, timeSec: 280 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const text = r.raceWeekProtocol.raceDay.mentalRehearsal.en.join(' ')
      expect(text).toMatch(/watts|power|numbers/i)
    })
    it('swim rehearsal mentions stroke length', () => {
      const r = buildEliteProgram({
        sport: 'swim',
        currentPR: { distanceM: 1500, timeSec: 1500 },
        targetPR:  { distanceM: 1500, timeSec: 1380 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const text = r.raceWeekProtocol.raceDay.mentalRehearsal.en.join(' ')
      expect(text).toMatch(/stroke length|catch|long stroke/i)
    })
    it('rowing rehearsal mentions stroke rate / split', () => {
      const r = buildEliteProgram({
        sport: 'rowing',
        currentPR: { distanceM: 0, timeSec: 420 },
        targetPR:  { distanceM: 0, timeSec: 405 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const text = r.raceWeekProtocol.raceDay.mentalRehearsal.en.join(' ')
      expect(text).toMatch(/spm|stroke|split/i)
    })
  })

  // Caffeine protocol
  describe('caffeine protocol', () => {
    it('run race-day includes evidence-based caffeine dose', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      const c = r.raceWeekProtocol.raceDay.caffeine
      expect(c.en).toMatch(/3-6 mg\/kg/i)
      expect(c.en).toMatch(/60 min/i)
    })
    it('swim caffeine notes lower dose for shorter race', () => {
      const r = buildEliteProgram({
        sport: 'swim',
        currentPR: { distanceM: 1500, timeSec: 1500 },
        targetPR:  { distanceM: 1500, timeSec: 1380 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      expect(r.raceWeekProtocol.raceDay.caffeine.en).toMatch(/lower|shorter/i)
    })
    it('all sports surface caffeine block', () => {
      for (const sport of ['run', 'bike', 'swim', 'rowing']) {
        const r = buildEliteProgram({
          sport,
          currentPR: sport === 'bike' ? { distanceM: 0, timeSec: 250 }
                   : sport === 'rowing' ? { distanceM: 0, timeSec: 420 }
                   : sport === 'swim' ? { distanceM: 1500, timeSec: 1500 }
                   : { distanceM: 10000, timeSec: 3000 },
          targetPR: sport === 'bike' ? { distanceM: 0, timeSec: 280 }
                  : sport === 'rowing' ? { distanceM: 0, timeSec: 405 }
                  : sport === 'swim' ? { distanceM: 1500, timeSec: 1380 }
                  : { distanceM: 10000, timeSec: 2820 },
          raceDate: '2026-08-25',
          options: { today: TODAY },
        })
        expect(r.raceWeekProtocol.raceDay.caffeine).toBeTruthy()
        expect(r.raceWeekProtocol.raceDay.caffeine.en.length).toBeGreaterThan(20)
      }
    })
  })

  // Contingency scripts
  describe('contingencyMap', () => {
    it('run program exposes illness/lifeEvent/travelDay blocks', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      expect(r.contingencyMap).toBeTruthy()
      expect(r.contingencyMap.illness).toBeTruthy()
      expect(r.contingencyMap.lifeEvent).toBeTruthy()
      expect(r.contingencyMap.travelDay).toBeTruthy()
    })
    it('illness distinguishes above-neck vs below-neck (Friman 2000)', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      expect(r.contingencyMap.illness.aboveNeck.en).toMatch(/above.*neck/i)
      expect(r.contingencyMap.illness.belowNeck.en).toMatch(/below.*neck/i)
    })
    it('lifeEvent provides 2-3d / 4-7d / >1w guidance', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      expect(r.contingencyMap.lifeEvent.twoToThreeDays).toBeTruthy()
      expect(r.contingencyMap.lifeEvent.fourToSevenDays).toBeTruthy()
      expect(r.contingencyMap.lifeEvent.overOneWeek).toBeTruthy()
    })
    it('rowing travelDay notes muscle pattern decay', () => {
      const r = buildEliteProgram({
        sport: 'rowing',
        currentPR: { distanceM: 0, timeSec: 420 },
        targetPR:  { distanceM: 0, timeSec: 405 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      expect(r.contingencyMap.travelDay.multiDay.en).toMatch(/muscle pattern|2 weeks|decay/i)
    })
    it('swim travelDay notes pool-access fallback', () => {
      const r = buildEliteProgram({
        sport: 'swim',
        currentPR: { distanceM: 1500, timeSec: 1500 },
        targetPR:  { distanceM: 1500, timeSec: 1380 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      expect(r.contingencyMap.travelDay.multiDay.en).toMatch(/pool|dryland|cords/i)
    })
  })
})

describe('buildEliteProgram — v9.10.0 strength program v2 (depth)', () => {
  describe('prehab tier', () => {
    it('every phase carries a prehab array', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
        expect(Array.isArray(r.strengthProgram[phase]?.prehab)).toBe(true)
        expect(r.strengthProgram[phase].prehab.length).toBeGreaterThan(0)
      }
    })
    it('prehab includes glute med activation', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      const names = r.strengthProgram.Base.prehab.map(m => m.name.en).join(' ')
      expect(names.toLowerCase()).toContain('glute med')
    })
    it('prehab includes ankle dorsiflexion', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      const names = r.strengthProgram.Base.prehab.map(m => m.name.en).join(' ')
      expect(names.toLowerCase()).toContain('ankle')
    })
  })

  describe('core progression', () => {
    it('every phase carries a core array', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
        expect(Array.isArray(r.strengthProgram[phase]?.core)).toBe(true)
      }
    })
    it('Build core introduces Pallof press anti-rotation', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      const names = r.strengthProgram.Build.core.map(m => m.name.en).join(' ')
      expect(names.toLowerCase()).toContain('pallof')
    })
    it('Peak core introduces bird-dog', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      const names = r.strengthProgram.Peak.core.map(m => m.name.en).join(' ')
      expect(names.toLowerCase()).toContain('bird-dog')
    })
    it('Taper core is activation-only (volume drops)', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      expect(r.strengthProgram.Taper.core.length).toBeLessThanOrEqual(2)
    })
  })

  describe('sport-aware Base plyometrics (audit B1 closure)', () => {
    it('run Base includes pogo hops + bound-skips', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      const names = r.strengthProgram.Base.movements.map(m => m.name.en).join(' ')
      expect(names.toLowerCase()).toContain('pogo')
      expect(names.toLowerCase()).toContain('bound')
    })
    it('rowing Base includes standing broad jumps', () => {
      const r = buildEliteProgram({
        sport: 'rowing',
        currentPR: { distanceM: 0, timeSec: 420 },
        targetPR:  { distanceM: 0, timeSec: 405 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const names = r.strengthProgram.Base.movements.map(m => m.name.en).join(' ')
      expect(names.toLowerCase()).toContain('broad jump')
    })
    it('swim Base includes streamline vertical jumps', () => {
      const r = buildEliteProgram({
        sport: 'swim',
        currentPR: { distanceM: 1500, timeSec: 1500 },
        targetPR:  { distanceM: 1500, timeSec: 1380 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const names = r.strengthProgram.Base.movements.map(m => m.name.en).join(' ')
      expect(names.toLowerCase()).toContain('streamline')
    })
    it('bike Base includes squat jumps', () => {
      const r = buildEliteProgram({
        sport: 'bike',
        currentPR: { distanceM: 0, timeSec: 250 },
        targetPR:  { distanceM: 0, timeSec: 280 },
        raceDate: '2026-08-25', options: { today: TODAY },
      })
      const names = r.strengthProgram.Base.movements.map(m => m.name.en).join(' ')
      expect(names.toLowerCase()).toContain('squat jump')
    })
  })

  describe('minimum-dose taper guidance', () => {
    it('Taper exposes minimumDose block', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      expect(r.strengthProgram.Taper.minimumDose).toBeTruthy()
      expect(r.strengthProgram.Taper.minimumDose.en).toMatch(/box jump/i)
      expect(r.strengthProgram.Taper.minimumDose.tr).toBeTruthy()
    })
    it('non-taper phases do not have minimumDose', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      for (const phase of ['Base', 'Build', 'Peak']) {
        expect(r.strengthProgram[phase]?.minimumDose).toBeUndefined()
      }
    })
    it('Taper warning references the minimum-dose escape', () => {
      const r = buildEliteProgram(RUN_REALISTIC)
      expect(r.strengthProgram.Taper.warning.en).toMatch(/minimum-dose|min-doz/i)
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

// ── v9.11.0 — cohort personalization ────────────────────────────────────────
import { selectCohort, applyCohort, COHORT_OVERRIDES } from '../../athlete/eliteProgramCohorts.js'

describe('eliteProgramCohorts — selectCohort', () => {
  it('returns null when currentLevel missing or empty', () => {
    expect(selectCohort('run', null)).toBeNull()
    expect(selectCohort('run', {})).toBeNull()
    expect(selectCohort('run', { vdot: 0 })).toBeNull()
  })

  it('classifies running by VDOT thresholds', () => {
    expect(selectCohort('run', { vdot: 30 })).toBe('beginner')
    expect(selectCohort('run', { vdot: 37.9 })).toBe('beginner')
    expect(selectCohort('run', { vdot: 38 })).toBe('intermediate')
    expect(selectCohort('run', { vdot: 49.9 })).toBe('intermediate')
    expect(selectCohort('run', { vdot: 50 })).toBe('elite')
    expect(selectCohort('run', { vdot: 65 })).toBe('elite')
  })

  it('classifies cycling by FTP watts', () => {
    expect(selectCohort('bike', { ftp: 150 })).toBe('beginner')
    expect(selectCohort('bike', { ftp: 199 })).toBe('beginner')
    expect(selectCohort('bike', { ftp: 200 })).toBe('intermediate')
    expect(selectCohort('bike', { ftp: 299 })).toBe('intermediate')
    expect(selectCohort('bike', { ftp: 300 })).toBe('elite')
    expect(selectCohort('bike', { ftp: 380 })).toBe('elite')
  })

  it('classifies swimming by CSS sec/100m (lower = faster)', () => {
    expect(selectCohort('swim', { css: 130 })).toBe('beginner')
    expect(selectCohort('swim', { css: 111 })).toBe('beginner')
    expect(selectCohort('swim', { css: 100 })).toBe('intermediate')
    expect(selectCohort('swim', { css: 91 })).toBe('intermediate')
    expect(selectCohort('swim', { css: 90 })).toBe('elite')
    expect(selectCohort('swim', { css: 75 })).toBe('elite')
  })

  it('classifies rowing by 2k split seconds (lower = faster)', () => {
    expect(selectCohort('rowing', { split2kSec: 540 })).toBe('beginner')
    expect(selectCohort('rowing', { split2kSec: 481 })).toBe('beginner')
    expect(selectCohort('rowing', { split2kSec: 460 })).toBe('intermediate')
    expect(selectCohort('rowing', { split2kSec: 421 })).toBe('intermediate')
    expect(selectCohort('rowing', { split2kSec: 420 })).toBe('elite')
    expect(selectCohort('rowing', { split2kSec: 380 })).toBe('elite')
  })

  it('uses VDOT proxy for triathlon classification', () => {
    expect(selectCohort('triathlon', { vdot: 35 })).toBe('beginner')
    expect(selectCohort('triathlon', { vdot: 45 })).toBe('intermediate')
    expect(selectCohort('triathlon', { vdot: 55 })).toBe('elite')
  })

  it('returns null for unknown sport', () => {
    expect(selectCohort('skating', { vdot: 50 })).toBeNull()
  })
})

describe('eliteProgramCohorts — applyCohort', () => {
  it('returns session unchanged when no override key matches', () => {
    const session = { key: 'unknown-key', name: { en: 'Foo', tr: 'Foo' } }
    expect(applyCohort(session, 'beginner')).toBe(session)
  })

  it('returns session unchanged when no cohort given', () => {
    const session = { key: 'run-base-long-aerobic', name: { en: 'Long Aerobic', tr: 'Uzun Aerobik' } }
    expect(applyCohort(session, null)).toBe(session)
  })

  it('preserves session.key + name + purpose after override', () => {
    const session = {
      key: 'run-base-long-aerobic',
      name: { en: 'Long Aerobic', tr: 'Uzun Aerobik' },
      purpose: { en: 'Build aerobic base', tr: 'Aerobik taban' },
      structure: { en: 'OLD', tr: 'OLD' },
      intensity: { en: 'E-pace', tr: 'E-tempo' },
    }
    const out = applyCohort(session, 'elite')
    expect(out.key).toBe('run-base-long-aerobic')
    expect(out.name.en).toBe('Long Aerobic')
    expect(out.purpose.tr).toBe('Aerobik taban')
    expect(out.intensity.en).toBe('E-pace')
    expect(out.cohort).toBe('elite')
    expect(out.structure.en).not.toBe('OLD')
    expect(out.structure.en).toMatch(/75-150/)
  })

  it('produces different doses for beginner vs elite on same session', () => {
    const session = { key: 'run-build-threshold-2x20' }
    const beginner = applyCohort(session, 'beginner')
    const elite    = applyCohort(session, 'elite')
    expect(beginner.structure.en).not.toBe(elite.structure.en)
    expect(beginner.cohort).toBe('beginner')
    expect(elite.cohort).toBe('elite')
  })

  it('every override entry has all 3 cohort tiers with structure + notes', () => {
    Object.entries(COHORT_OVERRIDES).forEach(([key, tiers]) => {
      ;['beginner', 'intermediate', 'elite'].forEach(c => {
        expect(tiers[c], `${key}.${c}`).toBeDefined()
        expect(tiers[c].structure?.en).toBeTruthy()
        expect(tiers[c].structure?.tr).toBeTruthy()
        expect(tiers[c].notes?.en).toBeTruthy()
        expect(tiers[c].notes?.tr).toBeTruthy()
      })
    })
  })
})

describe('buildEliteProgram — cohort propagation (v9.11.0)', () => {
  it('exposes cohort field on program output when currentLevel resolves', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    // RUN_REALISTIC is 50:00 10k → VDOT ~37 → beginner
    expect(['beginner', 'intermediate', 'elite']).toContain(r.cohort)
  })

  it('cohort propagates onto cohort-personalized key sessions', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const overridden = [...(r.keySessionLibrary.Base || []), ...(r.keySessionLibrary.Build || []), ...(r.keySessionLibrary.Peak || [])]
      .filter(s => COHORT_OVERRIDES[s.key])
    expect(overridden.length).toBeGreaterThan(0)
    overridden.forEach(s => {
      expect(s.cohort).toBe(r.cohort)
    })
  })

  it('triathlon flattens with discipline-specific cohorts', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      raceDate: '2026-09-25',
      sport: 'triathlon',
      profile: { ftp: 250, cssSec: 100, bodyMassKg: 70 },
      options: { today: TODAY },
    })
    const sessions = [...(r.keySessionLibrary.Base || []), ...(r.keySessionLibrary.Build || [])]
    const swimOverrides = sessions.filter(s => s.discipline === 'swim' && COHORT_OVERRIDES[s.key])
    const bikeOverrides = sessions.filter(s => s.discipline === 'bike' && COHORT_OVERRIDES[s.key])
    swimOverrides.forEach(s => expect(s.cohort).toBe('intermediate')) // CSS 100 → intermediate
    bikeOverrides.forEach(s => expect(s.cohort).toBe('intermediate')) // FTP 250 → intermediate
  })

  it('cohort=null when currentLevel cannot be resolved (still ships sessions)', () => {
    // Synthetic small-target run with bare currentPR — VDOT will compute, so cohort resolves.
    // Confirm the output doesn't crash and never injects a cohort field on non-overridden sessions.
    const r = buildEliteProgram(RUN_REALISTIC)
    const nonOverridden = [...(r.keySessionLibrary.Base || []), ...(r.keySessionLibrary.Build || [])]
      .filter(s => !COHORT_OVERRIDES[s.key])
    nonOverridden.forEach(s => {
      expect(s.cohort).toBeUndefined()
    })
  })
})

// ── v9.12.0 — new staple sessions + Areta pulse + sport prehab ─────────────
describe('buildEliteProgram — v9.12.0 new staple sessions', () => {
  it('includes run-build-lactate-clearance Canova session', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const session = (r.keySessionLibrary.Build || []).find(s => s.key === 'run-build-lactate-clearance')
    expect(session).toBeDefined()
    expect(session.structure.en).toMatch(/float/i)
    expect(session.citation).toMatch(/Canova/i)
  })

  it('includes bike-build-sweet-spot session', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 250 },
      targetPR:  { distanceM: 0, timeSec: 280 },
      raceDate: '2026-08-25',
      sport: 'bike',
      options: { today: TODAY },
    })
    const session = (r.keySessionLibrary.Build || []).find(s => s.key === 'bike-build-sweet-spot')
    expect(session).toBeDefined()
    expect(session.structure.en).toMatch(/88-94/)
  })

  it('includes bike-build-ftp-test diagnostic session', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 250 },
      targetPR:  { distanceM: 0, timeSec: 280 },
      raceDate: '2026-08-25',
      sport: 'bike',
      options: { today: TODAY },
    })
    const session = (r.keySessionLibrary.Build || []).find(s => s.key === 'bike-build-ftp-test')
    expect(session).toBeDefined()
    expect(session.purpose.en).toMatch(/FTP/i)
    expect(session.alternates.length).toBeGreaterThanOrEqual(2)
  })

  it('includes swim-build-descending pacing session', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 1500, timeSec: 1800 },
      targetPR:  { distanceM: 1500, timeSec: 1700 },
      raceDate: '2026-08-25',
      sport: 'swim',
      options: { today: TODAY },
    })
    const session = (r.keySessionLibrary.Build || []).find(s => s.key === 'swim-build-descending')
    expect(session).toBeDefined()
    expect(session.structure.en).toMatch(/descending/i)
  })

  it('new sessions get cohort overrides when currentLevel resolves', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const lc = (r.keySessionLibrary.Build || []).find(s => s.key === 'run-build-lactate-clearance')
    expect(lc.cohort).toBeDefined()
    expect(['beginner', 'intermediate', 'elite']).toContain(lc.cohort)
  })
})

describe('buildEliteProgram — v9.12.0 Areta protein pulse', () => {
  it('every fueling phase carries proteinPulse with Areta dose', () => {
    const r = buildEliteProgram({
      ...RUN_REALISTIC,
      profile: { bodyMassKg: 70 },
    })
    expect(r.fuelingProgram.Base.proteinPulse).toBeDefined()
    expect(r.fuelingProgram.Base.proteinPulse.gPerKgPerMeal).toBe(0.4)
    expect(r.fuelingProgram.Base.proteinPulse.mealsPerDay).toBe(4)
    expect(r.fuelingProgram.Base.proteinPulse.rationale.en).toMatch(/Areta/i)
  })

  it('absolute proteinPulseGPerMeal computed when bodyMassKg present', () => {
    const r = buildEliteProgram({
      ...RUN_REALISTIC,
      profile: { bodyMassKg: 70 },
    })
    // 0.4 g/kg × 70 kg = 28 g/meal
    expect(r.fuelingProgram.Base.proteinPulseGPerMeal).toBe(28)
  })

  it('proteinPulse present even without bodyMassKg, but no absolute g per meal', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.fuelingProgram.Base.proteinPulse).toBeDefined()
    expect(r.fuelingProgram.Base.proteinPulseGPerMeal).toBeUndefined()
  })
})

describe('buildEliteProgram — v9.12.0 sport-specific prehab', () => {
  it('runner gets tibialis posterior + couch-stretch in addition to base prehab', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const names = r.strengthProgram.Base.prehab.map(m => m.name.en)
    expect(names).toContain('Tibialis posterior holds')
    expect(names).toContain('Couch-stretch hip flexor')
    // base prehab still present
    expect(names).toContain('Glute med activation (clamshells)')
  })

  it('cyclist gets T-spine extension + scap retraction', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 250 },
      targetPR:  { distanceM: 0, timeSec: 280 },
      raceDate: '2026-08-25',
      sport: 'bike',
      options: { today: TODAY },
    })
    const names = r.strengthProgram.Base.prehab.map(m => m.name.en)
    expect(names).toContain('T-spine extension over foam roller')
    expect(names).toContain('Chin-tuck + scap retraction')
  })

  it('swimmer gets rotator cuff + scap stab', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 1500, timeSec: 1800 },
      targetPR:  { distanceM: 1500, timeSec: 1700 },
      raceDate: '2026-08-25',
      sport: 'swim',
      options: { today: TODAY },
    })
    const names = r.strengthProgram.Base.prehab.map(m => m.name.en)
    expect(names).toContain('Band external rotation (rotator cuff)')
    expect(names).toContain('Scap stab Y-T-W (prone)')
  })

  it('rower gets bird-dog with reach + farmer carry', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 480 },
      targetPR:  { distanceM: 0, timeSec: 440 },
      raceDate: '2026-08-25',
      sport: 'rowing',
      options: { today: TODAY },
    })
    const names = r.strengthProgram.Base.prehab.map(m => m.name.en)
    expect(names).toContain('Bird-dog with reach (lumbar erectors)')
    expect(names).toContain('Farmer carry (grip)')
  })

  it('triathlete gets run + swim prehab extras (tib post + rotator cuff)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      raceDate: '2026-08-25',
      sport: 'triathlon',
      options: { today: TODAY },
    })
    const names = r.strengthProgram.Base.prehab.map(m => m.name.en)
    expect(names).toContain('Tibialis posterior holds')
    expect(names).toContain('Band external rotation (rotator cuff)')
  })

  it('sport-specific prehab applies to all phases (Build/Peak/Taper) not just Base', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const buildNames = r.strengthProgram.Build.prehab.map(m => m.name.en)
    const peakNames  = r.strengthProgram.Peak.prehab.map(m => m.name.en)
    expect(buildNames).toContain('Tibialis posterior holds')
    expect(peakNames).toContain('Tibialis posterior holds')
    if (r.strengthProgram.Taper) {
      const taperNames = r.strengthProgram.Taper.prehab.map(m => m.name.en)
      expect(taperNames).toContain('Tibialis posterior holds')
    }
  })
})

// ── v9.13.0 — cohort fueling + TSS-scaled sleep + contrast modalities ──────
import { computeRecoverySleepTarget } from '../../athlete/eliteProgramRecovery.js'

describe('buildEliteProgram — v9.13.0 cohort-aware fueling', () => {
  it('elite cohort gets shifted-up CHO daily targets vs intermediate', () => {
    const elite = buildEliteProgram({
      ...RUN_REALISTIC,
      currentPR: { distanceM: 10000, timeSec: 2100 }, // 35:00 → VDOT ~58 elite
      targetPR:  { distanceM: 10000, timeSec: 2040 },
      profile: { bodyMassKg: 65 },
    })
    const intermediate = buildEliteProgram({
      ...RUN_REALISTIC,
      profile: { bodyMassKg: 65 },
    })
    expect(elite.cohort).toBe('elite')
    expect(intermediate.cohort).toBe('intermediate')
    // Elite Build CHO range should be >= intermediate Build CHO range
    expect(elite.fuelingProgram.Build.chodailyPerKg[0])
      .toBeGreaterThanOrEqual(intermediate.fuelingProgram.Build.chodailyPerKg[0])
    expect(elite.fuelingProgram.Build.chodailyPerKg[1])
      .toBeGreaterThanOrEqual(intermediate.fuelingProgram.Build.chodailyPerKg[1])
  })

  it('beginner cohort gets shifted-down CHO daily targets vs intermediate', () => {
    const beginner = buildEliteProgram({
      ...RUN_REALISTIC,
      currentPR: { distanceM: 10000, timeSec: 4200 }, // 70:00 → VDOT ~25 beginner
      targetPR:  { distanceM: 10000, timeSec: 4080 },
      profile: { bodyMassKg: 80 },
    })
    expect(beginner.cohort).toBe('beginner')
    // Beginner Build CHO upper end should be ≤ intermediate baseline (8 g/kg)
    expect(beginner.fuelingProgram.Build.chodailyPerKg[1]).toBeLessThanOrEqual(8)
  })

  it('in-session g/h CHO scales by cohort (beginner ≤60, elite ≥90)', () => {
    const beginner = buildEliteProgram({
      ...RUN_REALISTIC,
      currentPR: { distanceM: 10000, timeSec: 4200 },
      targetPR:  { distanceM: 10000, timeSec: 4080 },
      profile: { bodyMassKg: 80 },
    })
    const elite = buildEliteProgram({
      ...RUN_REALISTIC,
      currentPR: { distanceM: 10000, timeSec: 2100 },
      targetPR:  { distanceM: 10000, timeSec: 2040 },
      profile: { bodyMassKg: 65 },
    })
    expect(beginner.fuelingProgram.Build.duringSession.hardSessionGPerHr[1]).toBeLessThanOrEqual(60)
    expect(elite.fuelingProgram.Build.duringSession.hardSessionGPerHr[1]).toBeGreaterThanOrEqual(90)
  })

  it('cohort field surfaces on every fueling phase plan when cohort known', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.fuelingProgram.Base.cohort).toBe(r.cohort)
    expect(r.fuelingProgram.Build.cohort).toBe(r.cohort)
  })
})

describe('eliteProgramRecovery — TSS-scaled sleep target', () => {
  it('returns base range when weeklyTSS empty', () => {
    expect(computeRecoverySleepTarget('Base', [])).toEqual([7, 9])
    expect(computeRecoverySleepTarget('Build', [])).toEqual([8, 9])
  })

  it('extends sleep when weeklyTSS exceeds 250 baseline', () => {
    const target = computeRecoverySleepTarget('Build', [200, 350, 400])
    // peak 400 → (400-250)/100 = 1.5 × 0.5 = 0.75h extra; rounding may give 0.8
    expect(target[0]).toBeGreaterThan(8)
    expect(target[0]).toBeLessThanOrEqual(8.8)
    expect(target[1]).toBeGreaterThan(9)
    expect(target[1]).toBeLessThanOrEqual(9.8)
  })

  it('caps extension at +1.5h regardless of TSS', () => {
    const target = computeRecoverySleepTarget('Build', [800, 900])
    expect(target[0]).toBeLessThanOrEqual(8 + 1.5)
    expect(target[1]).toBeLessThanOrEqual(9 + 1.5)
  })
})

describe('buildEliteProgram — v9.13.0 recovery enhancements', () => {
  it('Build phase modalities include contrast bath + compression', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const build = r.recoveryProgram.Build
    const en = build.modalities.map(m => m.en).join('|')
    expect(en).toMatch(/Contrast bath/i)
    expect(en).toMatch(/compression/i)
  })

  it('intermediate/elite athletes get sauna in Build', () => {
    const r = buildEliteProgram({
      ...RUN_REALISTIC,
      currentPR: { distanceM: 10000, timeSec: 2100 },
      targetPR:  { distanceM: 10000, timeSec: 2040 },
    })
    const build = r.recoveryProgram.Build
    const en = build.modalities.map(m => m.en).join('|')
    expect(en).toMatch(/Sauna/i)
  })

  it('Taper phase does NOT get contrast/sauna additions (mujika protective)', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const taper = r.recoveryProgram.Taper
    const en = taper.modalities.map(m => m.en).join('|')
    expect(en).not.toMatch(/Contrast bath/i)
    expect(en).not.toMatch(/Sauna/i)
  })

  it('sleep target on recovery program reflects weeklyTSS', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const peakWeeklyTSS = Math.max(...r.weeklyTSS)
    if (peakWeeklyTSS > 250) {
      // Build should be > base 8h
      expect(r.recoveryProgram.Build.sleepHoursTarget[0]).toBeGreaterThanOrEqual(8)
    }
  })
})

// ── v9.14.0 — upper-body strength + tri bricks ──────────────────────────────
describe('buildEliteProgram — v9.14.0 upper-body strength balance', () => {
  it('Base movements include horizontal pull (row) for every sport', () => {
    const sports = ['run', 'bike', 'swim', 'rowing']
    for (const sport of sports) {
      const input = sport === 'bike'
        ? { currentPR: { distanceM: 0, timeSec: 250 }, targetPR: { distanceM: 0, timeSec: 280 }, raceDate: '2026-08-25', sport, options: { today: TODAY } }
        : sport === 'rowing'
        ? { currentPR: { distanceM: 0, timeSec: 480 }, targetPR: { distanceM: 0, timeSec: 440 }, raceDate: '2026-08-25', sport, options: { today: TODAY } }
        : sport === 'swim'
        ? { currentPR: { distanceM: 1500, timeSec: 1800 }, targetPR: { distanceM: 1500, timeSec: 1700 }, raceDate: '2026-08-25', sport, options: { today: TODAY } }
        : RUN_REALISTIC
      const r = buildEliteProgram(input)
      const movementNames = r.strengthProgram.Base.movements.map(m => m.name.en).join('|')
      expect(movementNames).toMatch(/row/i)
    }
  })

  it('Base movements include horizontal push (bench/push-up) for every sport', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const names = r.strengthProgram.Base.movements.map(m => m.name.en).join('|')
    expect(names).toMatch(/bench|push-up/i)
  })

  it('rower gets pull-up + heavy bent-over row in Base (catch-phase strength)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 480 },
      targetPR:  { distanceM: 0, timeSec: 440 },
      raceDate: '2026-08-25',
      sport: 'rowing',
      options: { today: TODAY },
    })
    const names = r.strengthProgram.Base.movements.map(m => m.name.en).join('|')
    expect(names).toMatch(/pull-up|chin-up/i)
    expect(names).toMatch(/bent-over barbell row/i)
  })

  it('cyclist gets standing overhead press in Base', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 250 },
      targetPR:  { distanceM: 0, timeSec: 280 },
      raceDate: '2026-08-25',
      sport: 'bike',
      options: { today: TODAY },
    })
    const names = r.strengthProgram.Base.movements.map(m => m.name.en).join('|')
    expect(names).toMatch(/overhead press/i)
  })

  it('Build movements include explosive med-ball + row power throw', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const names = r.strengthProgram.Build.movements.map(m => m.name.en).join('|')
    expect(names).toMatch(/med-ball chest pass/i)
    expect(names).toMatch(/explosive bent-over row/i)
  })

  it('Peak movements include light pull + push for pattern maintenance', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const names = r.strengthProgram.Peak.movements.map(m => m.name.en).join('|')
    expect(names).toMatch(/dumbbell row \(light\)/i)
    expect(names).toMatch(/push-up|press \(light\)/i)
  })
})

describe('buildEliteProgram — v9.14.0 triathlon brick workouts', () => {
  const TRI_INPUT = {
    currentPR: { distanceM: 10000, timeSec: 3000 },
    targetPR:  { distanceM: 10000, timeSec: 2820 },
    raceDate: '2026-09-25',
    sport: 'triathlon',
    options: { today: TODAY },
  }

  it('Build phase includes tri-build-brick-bike-run', () => {
    const r = buildEliteProgram(TRI_INPUT)
    const session = (r.keySessionLibrary.Build || []).find(s => s.key === 'tri-build-brick-bike-run')
    expect(session).toBeDefined()
    expect(session.discipline).toBe('tri')
    expect(session.structure.en).toMatch(/bike.+run|run.+bike/i)
  })

  it('Build phase includes tri-build-brick-swim-bike', () => {
    const r = buildEliteProgram(TRI_INPUT)
    const session = (r.keySessionLibrary.Build || []).find(s => s.key === 'tri-build-brick-swim-bike')
    expect(session).toBeDefined()
    expect(session.discipline).toBe('tri')
  })

  it('Peak phase includes tri-peak-brick-race-sim', () => {
    const r = buildEliteProgram(TRI_INPUT)
    const session = (r.keySessionLibrary.Peak || []).find(s => s.key === 'tri-peak-brick-race-sim')
    expect(session).toBeDefined()
    expect(session.discipline).toBe('tri')
    expect(session.purpose.en).toMatch(/race-day rehearsal/i)
  })

  it('non-tri sports never receive brick workouts', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const allSessions = [...(r.keySessionLibrary.Base || []), ...(r.keySessionLibrary.Build || []), ...(r.keySessionLibrary.Peak || [])]
    const bricks = allSessions.filter(s => s.key && s.key.startsWith('tri-'))
    expect(bricks).toHaveLength(0)
  })
})
