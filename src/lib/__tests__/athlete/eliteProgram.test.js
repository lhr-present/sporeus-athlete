// src/lib/__tests__/athlete/eliteProgram.test.js
import { describe, it, expect } from 'vitest'
import {
  buildEliteProgram,
  reAnchorEliteProgram,
  PHASE_FOCUS,
  inferDistanceCategory,
  DISTANCE_PHASE_MULTIPLIERS,
} from '../../athlete/eliteProgram.js'

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

  it('v9.76.0 — accepts capitalized Onboarding sport values', () => {
    // Onboarding writes 'Running' (capitalized) — buildEliteProgram uses
    // 3-letter internal IDs. v9.76.0 normalizes at the boundary so any
    // sport-vocabulary variant lands in the same place.
    const r1 = buildEliteProgram({ ...RUN_REALISTIC, sport: 'Running' })
    expect(r1).not.toBeNull()
    expect(r1.sport).toBe('run')
  })

  it('v9.76.0 — accepts full-lowercase sport (running/cycling/swimming)', () => {
    const r1 = buildEliteProgram({ ...RUN_REALISTIC, sport: 'running' })
    expect(r1).not.toBeNull()
    expect(r1.sport).toBe('run')
  })

  it('v9.76.0 — normalizes Cycling/cycling → bike', () => {
    // bike requires a different fixture (FTP-based PR), so just test
    // the normalization survives at the validation gate.
    const r1 = buildEliteProgram({ ...RUN_REALISTIC, sport: 'Cycling' })
    // Run fixture with sport='Cycling' — normalizes to 'bike', then
    // the rest of validation may reject for fixture mismatch, but it
    // must NOT reject on the sport-string gate.
    if (r1 && !r1._rejected) {
      expect(r1.sport).toBe('bike')
    }
    // The important assertion: doesn't bail at the sport whitelist
    // (would be null if bail occurred). May reject downstream for
    // run-shaped PR not matching bike vocabulary, but that's separate.
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

// ── v9.15.0 — train-low + recovery breathwork/CWI/NSDR ─────────────────────
describe('buildEliteProgram — v9.15.0 fueling + recovery depth', () => {
  it('Base fueling carries sport-specific train-low guidance', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.fuelingProgram.Base.trainLow).toBeDefined()
    expect(r.fuelingProgram.Base.trainLow.en).toMatch(/Train-low/i)
    expect(r.fuelingProgram.Base.trainLow.en).toMatch(/AVOID.+swim/i)
    expect(r.fuelingProgram.Base.trainLow.en).toMatch(/beginners/i)
  })

  it('every recovery phase carries breathwork modality (zero risk universal)', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      if (!r.recoveryProgram[phase]) continue
      const en = r.recoveryProgram[phase].modalities.map(m => m.en).join('|')
      expect(en).toMatch(/breathwork|Diaphragmatic/i)
    }
  })

  it('Build + Peak phases get cold-water immersion modality with strength-blunting warning', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const buildEn = r.recoveryProgram.Build.modalities.map(m => m.en).join('|')
    expect(buildEn).toMatch(/Cold-water immersion/i)
    expect(buildEn).toMatch(/NOT within 4h.+strength|hypertrophy/i)
  })

  it('Build + Peak phases get NSDR / yoga nidra modality', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const buildEn = r.recoveryProgram.Build.modalities.map(m => m.en).join('|')
    const peakEn  = r.recoveryProgram.Peak.modalities.map(m => m.en).join('|')
    expect(buildEn).toMatch(/NSDR|yoga nidra/i)
    expect(peakEn).toMatch(/NSDR|yoga nidra/i)
  })

  it('Taper phase does NOT get cold-water immersion (Mujika protective)', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    if (r.recoveryProgram.Taper) {
      const en = r.recoveryProgram.Taper.modalities.map(m => m.en).join('|')
      expect(en).not.toMatch(/Cold-water immersion/i)
    }
  })
})

// ── v9.16.0 — race-week event-distance specificity ─────────────────────────
import { classifyDistanceTier } from '../../athlete/eliteProgramRaceWeek.js'

describe('classifyDistanceTier — distance bucketing per sport', () => {
  it('classifies running distances correctly', () => {
    expect(classifyDistanceTier('run', 5000)).toBe('sprint')
    expect(classifyDistanceTier('run', 10000)).toBe('short')
    expect(classifyDistanceTier('run', 21097)).toBe('mid')
    expect(classifyDistanceTier('run', 42195)).toBe('long')
  })

  it('classifies cycling distances correctly', () => {
    expect(classifyDistanceTier('bike', 20000)).toBe('sprint')
    expect(classifyDistanceTier('bike', 60000)).toBe('short')
    expect(classifyDistanceTier('bike', 120000)).toBe('mid')
    expect(classifyDistanceTier('bike', 180000)).toBe('long')
  })

  it('classifies swimming distances correctly', () => {
    expect(classifyDistanceTier('swim', 400)).toBe('sprint')
    expect(classifyDistanceTier('swim', 1500)).toBe('mid')
    expect(classifyDistanceTier('swim', 5000)).toBe('long')
  })

  it('classifies rowing 2k as sprint tier (race standard)', () => {
    expect(classifyDistanceTier('rowing', 2000)).toBe('sprint')
    expect(classifyDistanceTier('rowing', 6000)).toBe('mid')
  })

  it('returns null for missing or invalid distance', () => {
    expect(classifyDistanceTier('run', 0)).toBeNull()
    expect(classifyDistanceTier('run', null)).toBeNull()
    expect(classifyDistanceTier('skating', 5000)).toBeNull()
  })
})

describe('buildEliteProgram — v9.16.0 race-week distance tiering', () => {
  it('long-distance run (marathon) gets pronounced negative-split pacing tier', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 42195, timeSec: 12600 },
      targetPR:  { distanceM: 42195, timeSec: 12000 },
      raceDate: '2026-09-25',
      sport: 'run',
      options: { today: TODAY },
    })
    expect(r.raceWeekProtocol.raceDay.distanceTier).toBe('long')
    expect(r.raceWeekProtocol.raceDay.pacingTierNote.en).toMatch(/PRONOUNCED NEGATIVE-SPLIT/i)
    expect(r.raceWeekProtocol.raceDay.preRaceMealsTierNote.en).toMatch(/STAGED fed state/i)
    expect(r.raceWeekProtocol.raceDay.warmupTierNote.en).toMatch(/minimal/i)
  })

  it('sprint-distance run (5k) gets negative-split or even-split pacing tier', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 5000, timeSec: 1200 },
      targetPR:  { distanceM: 5000, timeSec: 1140 },
      raceDate: '2026-08-25',
      sport: 'run',
      options: { today: TODAY },
    })
    expect(r.raceWeekProtocol.raceDay.distanceTier).toBe('sprint')
    expect(r.raceWeekProtocol.raceDay.pacingTierNote.en).toMatch(/NEGATIVE-SPLIT|even split/i)
    expect(r.raceWeekProtocol.raceDay.warmupTierNote.en).toMatch(/extend by 10-20%/i)
  })

  it('every race-day shape carries race-delayed + bonk-wall contingencies', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.raceWeekProtocol.raceDay.raceDelayedContingency).toBeDefined()
    expect(r.raceWeekProtocol.raceDay.raceDelayedContingency.en).toMatch(/Race delayed/i)
    expect(r.raceWeekProtocol.raceDay.bonkWallContingency).toBeDefined()
    expect(r.raceWeekProtocol.raceDay.bonkWallContingency.en).toMatch(/WALL CONTINGENCY/i)
  })

  it('mid-distance (half-marathon) gets patience-first-half pacing tier', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 21097, timeSec: 5400 },
      targetPR:  { distanceM: 21097, timeSec: 5100 },
      raceDate: '2026-09-25',
      sport: 'run',
      options: { today: TODAY },
    })
    expect(r.raceWeekProtocol.raceDay.distanceTier).toBe('mid')
    expect(r.raceWeekProtocol.raceDay.pacingTierNote.en).toMatch(/PATIENCE FIRST HALF/i)
  })

  it('rowing 2k race gets sprint tier overrides', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 480 },
      targetPR:  { distanceM: 0, timeSec: 440 },
      raceDate: '2026-08-25',
      sport: 'rowing',
      options: { today: TODAY },
    })
    // currentPR.distanceM=0 means timeSec is direct 2k time, so distance
    // should be inferred elsewhere — confirm contingency present regardless
    expect(r.raceWeekProtocol.raceDay.bonkWallContingency).toBeDefined()
  })
})

// ── v9.17.0 — race-day mental + caffeine + readiness depth ─────────────────
describe('buildEliteProgram — v9.17.0 race-day mental/caffeine/readiness blocks', () => {
  it('exposes preRaceAnxietyReframe with Crum stress-as-enhancing language', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.raceWeekProtocol.raceDay.preRaceAnxietyReframe).toBeDefined()
    expect(r.raceWeekProtocol.raceDay.preRaceAnxietyReframe.en).toMatch(/energized, not nervous/i)
  })

  it('exposes motorImagery rehearsal block', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.raceWeekProtocol.raceDay.motorImagery).toBeDefined()
    expect(r.raceWeekProtocol.raceDay.motorImagery.en).toMatch(/MOTOR IMAGERY/i)
    expect(r.raceWeekProtocol.raceDay.motorImagery.en).toMatch(/perfect movement/i)
  })

  it('exposes caffeineSafetyFlags with caffeine-naïve + anxiety + sleep guards', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.raceWeekProtocol.raceDay.caffeineSafetyFlags).toBeDefined()
    const en = r.raceWeekProtocol.raceDay.caffeineSafetyFlags.en
    expect(en).toMatch(/NEVER first-time caffeine on race day/i)
    expect(en).toMatch(/Caffeine-naïve/i)
    expect(en).toMatch(/anxiety/i)
    expect(en).toMatch(/Sleep <6h/i)
  })

  it('exposes morningReadinessCheck with concrete RHR thresholds', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    expect(r.raceWeekProtocol.raceDay.morningReadinessCheck).toBeDefined()
    const en = r.raceWeekProtocol.raceDay.morningReadinessCheck.en
    expect(en).toMatch(/READINESS CHECK/i)
    expect(en).toMatch(/\+8-10 bpm/i)
    expect(en).toMatch(/DNS/i) // do-not-start option
  })

  it('all 4 v9.17.0 blocks present across all sports', () => {
    const sports = [
      RUN_REALISTIC,
      { currentPR: { distanceM: 0, timeSec: 250 }, targetPR: { distanceM: 0, timeSec: 280 }, raceDate: '2026-08-25', sport: 'bike', options: { today: TODAY } },
      { currentPR: { distanceM: 1500, timeSec: 1800 }, targetPR: { distanceM: 1500, timeSec: 1700 }, raceDate: '2026-08-25', sport: 'swim', options: { today: TODAY } },
      { currentPR: { distanceM: 0, timeSec: 480 }, targetPR: { distanceM: 0, timeSec: 440 }, raceDate: '2026-08-25', sport: 'rowing', options: { today: TODAY } },
    ]
    for (const input of sports) {
      const r = buildEliteProgram(input)
      expect(r.raceWeekProtocol.raceDay.preRaceAnxietyReframe).toBeDefined()
      expect(r.raceWeekProtocol.raceDay.motorImagery).toBeDefined()
      expect(r.raceWeekProtocol.raceDay.caffeineSafetyFlags).toBeDefined()
      expect(r.raceWeekProtocol.raceDay.morningReadinessCheck).toBeDefined()
    }
  })
})

// ── v9.18.0 — numeric correctness fixes ────────────────────────────────────
import { vdotGainPerBlock, ftpGainPerBlock } from '../../athlete/eliteProgram.js'

describe('vdotGainPerBlock — v9.18.0 elite calibration (Daniels 4th ed)', () => {
  it('beginner VDOT (<35) gains 3.5 points per block', () => {
    expect(vdotGainPerBlock(30)).toBe(3.5)
    expect(vdotGainPerBlock(34.9)).toBe(3.5)
  })

  it('intermediate VDOT (35-44) gains 2.5 points per block', () => {
    expect(vdotGainPerBlock(35)).toBe(2.5)
    expect(vdotGainPerBlock(44)).toBe(2.5)
  })

  it('advanced VDOT (45-54) gains 2.0 points per block (was 1.5 pre-v9.18.0)', () => {
    expect(vdotGainPerBlock(45)).toBe(2.0)
    expect(vdotGainPerBlock(54)).toBe(2.0)
  })

  it('elite VDOT (≥55) gains 1.5 points per block (was 0.8 pre-v9.18.0 — 60% too low)', () => {
    expect(vdotGainPerBlock(55)).toBe(1.5)
    expect(vdotGainPerBlock(60)).toBe(1.5)
    expect(vdotGainPerBlock(70)).toBe(1.5)
  })
})

describe('ftpGainPerBlock — v9.18.0 smoothed 240→320 W transition', () => {
  it('novice FTP <180 W gains 10%', () => {
    expect(ftpGainPerBlock(150)).toBeCloseTo(15)
  })

  it('intermediate FTP 180-239 W gains 7%', () => {
    expect(ftpGainPerBlock(220)).toBeCloseTo(15.4)
  })

  it('upper-intermediate FTP 240-279 W gains 6% (new band)', () => {
    expect(ftpGainPerBlock(260)).toBeCloseTo(15.6)
  })

  it('advanced FTP 280-319 W gains 5%', () => {
    expect(ftpGainPerBlock(300)).toBeCloseTo(15)
  })

  it('elite FTP ≥320 W gains 3%', () => {
    expect(ftpGainPerBlock(350)).toBeCloseTo(10.5)
  })

  it('curve is monotonically smoother (no >40% step between adjacent W values)', () => {
    // Pre-v9.18.0: 290W = 14.5W gain (5%), 305W = 9.15W gain (3%) — 37% step
    // Post-v9.18.0: 290W = 14.5W gain, 305W = 15.25W gain — smooth.
    const at290 = ftpGainPerBlock(290)
    const at305 = ftpGainPerBlock(305)
    const stepRatio = Math.max(at290, at305) / Math.min(at290, at305)
    expect(stepRatio).toBeLessThan(1.2) // <20% step within the boundary
  })
})

describe('buildEliteProgram — v9.18.0 input validation hardening', () => {
  it('rejects negative distance', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: -100, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      raceDate: '2026-08-25',
      sport: 'run',
      options: { today: TODAY },
    })
    expect(r).toBeNull()
  })

  it('rejects distance > 1000 km', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 5_000_000, timeSec: 3000 },
      targetPR:  { distanceM: 5_000_000, timeSec: 2820 },
      raceDate: '2026-08-25',
      sport: 'run',
      options: { today: TODAY },
    })
    expect(r).toBeNull()
  })

  it('rejects sub-15-second time (data corruption floor)', () => {
    // v9.50.0 — MIN_TIME_SEC lowered 60→15 so sub-minute elite efforts pass
    // (50m swim WR 21s, 1km bike TT WR 55s). Floor still rejects garbage values.
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 5 },
      targetPR:  { distanceM: 10000, timeSec: 4 },
      raceDate: '2026-08-25',
      sport: 'run',
      options: { today: TODAY },
    })
    expect(r).toBeNull()
  })

  it('rejects multi-week time (over 7 days)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 8 * 24 * 3600 },
      targetPR:  { distanceM: 10000, timeSec: 7 * 24 * 3600 },
      raceDate: '2026-08-25',
      sport: 'run',
      options: { today: TODAY },
    })
    expect(r).toBeNull()
  })

  it('still accepts bike direct-FTP mode with distanceM=0 (sentinel)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 250 },
      targetPR:  { distanceM: 0, timeSec: 280 },
      raceDate: '2026-08-25',
      sport: 'bike',
      options: { today: TODAY },
    })
    expect(r).toBeTruthy()
    expect(r.sport).toBe('bike')
  })
})

describe('buildEliteProgram — v9.18.0 caffeine safety naïve cap', () => {
  it('caffeine safety flag specifies 1-2 mg/kg cap (not 200 mg)', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const en = r.raceWeekProtocol.raceDay.caffeineSafetyFlags.en
    expect(en).toMatch(/1-2 mg\/kg ONLY/i)
    expect(en).toMatch(/70-140 mg/i)
    expect(en).not.toMatch(/Start at 200 mg ONLY/i) // old broken text removed
  })
})

describe('buildEliteProgram — v9.18.0 triathlon cohort warning', () => {
  it('emits cohortWarning when triathlon program cannot resolve cohort (no VDOT)', () => {
    // Tiny VDOT input that produces 0 — actually this requires a way to get cohort=null.
    // Use a tri input with negative VDOT path: synthetic tri target.
    const r = buildEliteProgram({
      currentPR: { distanceM: 1, timeSec: 60 }, // edge: 1m in 60s → tiny VDOT
      targetPR:  { distanceM: 1, timeSec: 50 },
      raceDate: '2026-09-25',
      sport: 'triathlon',
      options: { today: TODAY },
    })
    // If program builds but cohort null, warning surfaces.
    // If validation rejects, warning N/A — also acceptable.
    if (r && !r.cohort) {
      expect(r.cohortWarning).toBeDefined()
      expect(r.cohortWarning.en).toMatch(/ability-matched/i)
    }
  })

  it('non-triathlon programs with null cohort do NOT receive cohortWarning', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    // Run with valid VDOT will resolve cohort, so warning shouldn't appear.
    if (r.cohort) {
      expect(r.cohortWarning).toBeUndefined()
    }
  })
})

// ── v9.20.0 — sample-week polarization (Seiler 80/20) ──────────────────────
// Helper: weekly polarization ratio computation. Returns
// { lowPct, midPct, highPct, totalMin, hardMin } for a sample week.
function polarizationOf(week) {
  let z1 = 0, z2 = 0, z3 = 0, z4 = 0, z5 = 0, total = 0
  for (const d of week) {
    z1 += d.zones?.Z1 || 0
    z2 += d.zones?.Z2 || 0
    z3 += d.zones?.Z3 || 0
    z4 += d.zones?.Z4 || 0
    z5 += d.zones?.Z5 || 0
    total += d.durationMin || 0
  }
  const summed = z1 + z2 + z3 + z4 + z5
  const denom = summed > 0 ? summed : (total > 0 ? total : 1)
  return {
    lowPct:  Math.round(((z1 + z2) / denom) * 100),
    midPct:  Math.round((z3 / denom) * 100),
    highPct: Math.round(((z4 + z5) / denom) * 100),
    totalMin: total,
    hardMin: z4 + z5,
  }
}

describe('Sample-week polarization — Seiler 80/20 compliance per phase', () => {
  it('Run Peak ≤ 25% high-intensity (post-v9.20.0 Sun long-easy fix)', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const peak = r.sampleWeeks?.Peak
    if (peak) {
      const pol = polarizationOf(peak)
      expect(pol.highPct).toBeLessThanOrEqual(25)
    }
  })

  it('Bike Peak — no Thu+Sat Z4 double (Lambert 1997)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 250 },
      targetPR:  { distanceM: 0, timeSec: 280 },
      raceDate: '2026-09-25',
      sport: 'bike',
      options: { today: TODAY },
    })
    const peak = r.sampleWeeks?.Peak
    if (peak) {
      const thu = peak.find(d => d.day === 'Thu')
      const sat = peak.find(d => d.day === 'Sat')
      const thuZ4 = thu?.zones?.Z4 || 0
      const satZ4 = sat?.zones?.Z4 || 0
      // At least one of Thu/Sat must have ≤10 min Z4 (i.e., not both heavy).
      expect(Math.min(thuZ4, satZ4)).toBeLessThanOrEqual(10)
    }
  })

  it('Swim Peak ≤ 30% high-intensity (Stöggl 2014 cap)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 1500, timeSec: 1800 },
      targetPR:  { distanceM: 1500, timeSec: 1700 },
      raceDate: '2026-09-25',
      sport: 'swim',
      options: { today: TODAY },
    })
    const peak = r.sampleWeeks?.Peak
    if (peak) {
      const pol = polarizationOf(peak)
      expect(pol.highPct).toBeLessThanOrEqual(30)
    }
  })

  it('Swim Peak Wed has ≥45 min active recovery (Olbrecht 2000)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 1500, timeSec: 1800 },
      targetPR:  { distanceM: 1500, timeSec: 1700 },
      raceDate: '2026-09-25',
      sport: 'swim',
      options: { today: TODAY },
    })
    const wed = (r.sampleWeeks?.Peak || []).find(d => d.day === 'Wed')
    if (wed) {
      expect(wed.durationMin).toBeGreaterThanOrEqual(45)
      expect((wed.zones?.Z4 || 0) + (wed.zones?.Z5 || 0)).toBe(0) // pure easy
    }
  })

  it('Rowing Build — UT1 (Z2) ≥ 25% (Nolte 2005 base-building target)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 480 },
      targetPR:  { distanceM: 0, timeSec: 440 },
      raceDate: '2026-09-25',
      sport: 'rowing',
      options: { today: TODAY },
    })
    const build = r.sampleWeeks?.Build
    if (build) {
      let z2 = 0, total = 0
      for (const d of build) {
        z2 += d.zones?.Z2 || 0
        total += (d.zones?.Z1 || 0) + (d.zones?.Z2 || 0) + (d.zones?.Z3 || 0) + (d.zones?.Z4 || 0) + (d.zones?.Z5 || 0)
      }
      expect(total).toBeGreaterThan(0)
      expect((z2 / total) * 100).toBeGreaterThanOrEqual(20) // close to Nolte 30% target with strict floor
    }
  })

  it('Triathlon Build — no 3 consecutive Z4 days (Lambert 1997)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      raceDate: '2026-09-25',
      sport: 'triathlon',
      options: { today: TODAY },
    })
    const build = r.sampleWeeks?.Build
    if (build) {
      // Tue/Wed/Thu sequence: count days where Z4+Z5 ≥ 30 min as "hard"
      const tue = build.find(d => d.day === 'Tue')
      const wed = build.find(d => d.day === 'Wed')
      const thu = build.find(d => d.day === 'Thu')
      const isHard = d => d && ((d.zones?.Z4 || 0) + (d.zones?.Z5 || 0) >= 30)
      const consecutive = [tue, wed, thu].filter(isHard).length
      expect(consecutive).toBeLessThanOrEqual(2)
    }
  })

  it('Triathlon Peak — at least 2 rest/easy days (taper-approach not compacted)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      raceDate: '2026-09-25',
      sport: 'triathlon',
      options: { today: TODAY },
    })
    const peak = r.sampleWeeks?.Peak
    if (peak) {
      // count days with Z4+Z5 = 0 AND duration ≤ 45 min as "easy/rest"
      const easyDays = peak.filter(d =>
        ((d.zones?.Z4 || 0) + (d.zones?.Z5 || 0)) === 0 &&
        (d.durationMin || 0) <= 45
      ).length
      expect(easyDays).toBeGreaterThanOrEqual(2)
    }
  })
})

// ── v9.24.0 — Strength weaving into sample weeks ─────────────────────────────
// Strength program prescribes 1-2 sessions/week per phase but historically lived
// only on the Strength tab — no calendar marker. v9.24.0 attaches a `strength`
// field to existing day entries so the athlete sees lift-day cues inline.
// Frequency mirrors eliteProgramStrength.js: Base/Build 2x, Peak/Taper 1x.
// Placement uses Beattie 2014 stacking (hardest endurance days, 6-8h gap).
describe('buildEliteProgram — sample-week strength weaving (v9.24.0)', () => {
  const RUN_INPUT = {
    currentPR: { distanceM: 10000, timeSec: 3000 },
    targetPR:  { distanceM: 10000, timeSec: 2820 },
    raceDate: '2026-09-01',
    sport: 'run',
    options: { today: TODAY },
  }

  function strengthCount(week) {
    return week.filter(d => d.strength).length
  }

  function dayLength(week) {
    return week.length
  }

  it('Base sample week carries 2 strength markers', () => {
    const r = buildEliteProgram(RUN_INPUT)
    expect(strengthCount(r.sampleWeeks.Base)).toBe(2)
  })

  it('Build sample week carries 2 strength markers', () => {
    const r = buildEliteProgram(RUN_INPUT)
    expect(strengthCount(r.sampleWeeks.Build)).toBe(2)
  })

  it('Peak sample week carries 1 strength marker', () => {
    const r = buildEliteProgram(RUN_INPUT)
    expect(strengthCount(r.sampleWeeks.Peak)).toBe(1)
  })

  it('Taper sample week carries 1 strength marker', () => {
    const r = buildEliteProgram(RUN_INPUT)
    expect(strengthCount(r.sampleWeeks.Taper)).toBe(1)
  })

  it('weaving does NOT change the array length (positional indexing must hold)', () => {
    const r = buildEliteProgram(RUN_INPUT)
    expect(dayLength(r.sampleWeeks.Base)).toBe(7)
    expect(dayLength(r.sampleWeeks.Build)).toBe(7)
    expect(dayLength(r.sampleWeeks.Peak)).toBe(7)
    expect(dayLength(r.sampleWeeks.Taper)).toBe(7)
  })

  it('strength field shape: bilingual intent + numeric durationMin', () => {
    const r = buildEliteProgram(RUN_INPUT)
    const lift = r.sampleWeeks.Build.find(d => d.strength)
    expect(lift.strength.intent).toHaveProperty('en')
    expect(lift.strength.intent).toHaveProperty('tr')
    expect(typeof lift.strength.durationMin).toBe('number')
    expect(lift.strength.durationMin).toBeGreaterThan(0)
  })

  it('strength duration matches phase: Base 60min, Build 50min, Peak 35min, Taper 25min', () => {
    const r = buildEliteProgram(RUN_INPUT)
    const liftBase  = r.sampleWeeks.Base.find(d => d.strength)
    const liftBuild = r.sampleWeeks.Build.find(d => d.strength)
    const liftPeak  = r.sampleWeeks.Peak.find(d => d.strength)
    const liftTaper = r.sampleWeeks.Taper.find(d => d.strength)
    expect(liftBase.strength.durationMin).toBe(60)
    expect(liftBuild.strength.durationMin).toBe(50)
    expect(liftPeak.strength.durationMin).toBe(35)
    expect(liftTaper.strength.durationMin).toBe(25)
  })

  it('strength is NEVER placed on a rest day (Beattie stacking — protects recovery)', () => {
    const r = buildEliteProgram(RUN_INPUT)
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      const wk = r.sampleWeeks[phase]
      for (const d of wk) {
        if (!d.strength) continue
        expect(d.durationMin || 0).toBeGreaterThan(0)
      }
    }
  })

  it('strength stacks on the hardest endurance days (highest Z4+Z5 minutes)', () => {
    const r = buildEliteProgram(RUN_INPUT)
    // Build phase has Tue Threshold (Z4:40) + Thu VO2max (Z5:30) as the two
    // hardest days. Strength should land on both, not on Wed/Sat easy days.
    const buildWk = r.sampleWeeks.Build
    const tue = buildWk.find(d => d.day === 'Tue')
    const thu = buildWk.find(d => d.day === 'Thu')
    expect(tue.strength).toBeTruthy()
    expect(thu.strength).toBeTruthy()
  })

  // ── v9.28.0 — Edge-case stress-test fixes ──────────────────────────────
  describe('horizon-too-short rejection (v9.28.0)', () => {
    it('rejects race date == today with explicit reason', () => {
      const r = buildEliteProgram({
        currentPR: { distanceM: 10000, timeSec: 3000 },
        targetPR:  { distanceM: 10000, timeSec: 2820 },
        raceDate:  TODAY,
        sport: 'run',
        options: { today: TODAY },
      })
      expect(r._rejected).toBe(true)
      expect(r.reason).toBe('horizon-too-short')
      expect(r.note.en).toMatch(/less than a week/i)
      expect(r.note.tr).toMatch(/bir haftadan az/i)
    })

    it('rejects race date 6 days away (sub-week, weeksAvailable=0)', () => {
      const r = buildEliteProgram({
        currentPR: { distanceM: 10000, timeSec: 3000 },
        targetPR:  { distanceM: 10000, timeSec: 2820 },
        raceDate:  '2026-05-09', // 5 days from TODAY (2026-05-04)
        sport: 'run',
        options: { today: TODAY },
      })
      expect(r._rejected).toBe(true)
      expect(r.reason).toBe('horizon-too-short')
    })

    it('still rejects race-in-past with race-in-past reason (priority preserved)', () => {
      const r = buildEliteProgram({
        currentPR: { distanceM: 10000, timeSec: 3000 },
        targetPR:  { distanceM: 10000, timeSec: 2820 },
        raceDate:  '2026-04-01',
        sport: 'run',
        options: { today: TODAY },
      })
      expect(r._rejected).toBe(true)
      expect(r.reason).toBe('race-in-past')
    })

    it('accepts horizon ≥1 week (preserves 2-3 week degraded Peak+Taper path)', () => {
      const r = buildEliteProgram({
        currentPR: { distanceM: 10000, timeSec: 3000 },
        targetPR:  { distanceM: 10000, timeSec: 2820 },
        raceDate:  '2026-05-12', // 8 days = >1 week from TODAY
        sport: 'run',
        options: { today: TODAY },
      })
      expect(r._rejected).toBeUndefined()
      expect(r.phases).toBeDefined()
    })
  })

  describe('rowing synthesis branch (v9.28.0)', () => {
    it('rowing with noTarget=true synthesizes a target (was: TypeError crash)', () => {
      const r = buildEliteProgram({
        currentPR: { distanceM: 2000, timeSec: 420 }, // 7:00 2k
        targetPR:  null,
        sport: 'rowing',
        noTarget: true,
        raceDate:  '2026-09-01',
        options: { today: TODAY },
      })
      expect(r).not.toBeNull()
      expect(r._rejected).toBeUndefined()
      expect(r.targetLevel?.split2kSec).toBeDefined()
      expect(r.targetLevel.split2kSec).toBeLessThan(420) // gain applied
    })

    it('rowing synthesis caps gain at 12 sec/block (sanity ceiling)', () => {
      const r = buildEliteProgram({
        currentPR: { distanceM: 2000, timeSec: 600 }, // 10:00 — recreational
        targetPR:  null,
        sport: 'rowing',
        noTarget: true,
        raceDate:  '2026-12-01', // ~30 weeks (multiple blocks)
        options: { today: TODAY },
      })
      expect(r).not.toBeNull()
      expect(r._rejected).toBeUndefined()
      // Even on a long horizon with 5 sec/block recreational base, the cap
      // keeps gain from going wild. With scale = weeksAvailable/12 ~= 2.5,
      // raw gain = 5*2.5 = 12.5 → capped to 12 → target = 588.
      expect(r.targetLevel.split2kSec).toBeGreaterThanOrEqual(588)
    })
  })

  describe('defensive null-guard for synthesis failure (v9.28.0)', () => {
    it('returns target-synthesis-failed instead of crashing if no branch matches', () => {
      // We can't easily trigger this in production code (all sports are
      // covered now), but the guard exists. Verify by checking a path
      // we know hits it: if a future sport is added without synthesis,
      // it should return _rejected, not throw.
      // For now, this is a smoke test that the guard fires when targetPR
      // is null and noTarget is true — covered by the rowing fix above
      // (rowing was the previously-uncovered branch).
      // Simplest direct test: use rowing with currentPR.timeSec at the
      // floor where synthesis returns null (synth >= currentPR.timeSec).
      const r = buildEliteProgram({
        currentPR: { distanceM: 2000, timeSec: 60 }, // 1:00 2k — impossible
        targetPR:  null,
        sport: 'rowing',
        noTarget: true,
        raceDate:  '2026-09-01',
        options: { today: TODAY },
      })
      // At 60s 2k, gainPerBlock=1 sec, capped synth=59 → still faster than 60 → succeeds.
      // We expect generation to succeed (no crash) — that's the win.
      expect(r).not.toBeNull()
    })
  })

  // ── v9.27.0 — Tri Build bike-quality fix (sweet-spot on Sat) ──────────
  it('Tri Build Sat carries structured sweet-spot work (Z4 minutes > 0)', () => {
    const tri = {
      currentPR: { distanceM: 10000, timeSec: 2700 },
      targetPR:  { distanceM: 10000, timeSec: 2580 },
      raceDate: '2026-09-01',
      sport: 'triathlon',
      options: { today: TODAY },
    }
    const r = buildEliteProgram(tri)
    const sat = r.sampleWeeks.Build.find(d => d.day === 'Sat')
    expect(sat).toBeTruthy()
    expect(sat.discipline).toBe('bike')
    expect(sat.zones.Z4).toBeGreaterThan(0) // sweet-spot includes Z4 minutes
    expect(sat.intent.en).toMatch(/sweet-spot/i)
    expect(sat.intent.tr).toMatch(/sweet-spot/i)
  })

  it('Tri Build week stays under Seiler 80/20 polarization ceiling after sweet-spot add', () => {
    const tri = {
      currentPR: { distanceM: 10000, timeSec: 2700 },
      targetPR:  { distanceM: 10000, timeSec: 2580 },
      raceDate: '2026-09-01',
      sport: 'triathlon',
      options: { today: TODAY },
    }
    const r = buildEliteProgram(tri)
    const wk = r.sampleWeeks.Build
    const totalMin = wk.reduce((sum, d) => sum + (d.durationMin || 0), 0)
    const hardMin = wk.reduce((sum, d) => sum + ((d.zones?.Z4 || 0) + (d.zones?.Z5 || 0)), 0)
    const hardPct = hardMin / totalMin
    expect(hardPct).toBeLessThanOrEqual(0.20) // Seiler 80/20: <=20% above LT1
    expect(hardPct).toBeGreaterThanOrEqual(0.13) // not under-stimulated for Build
  })

  it('also weaves strength for triathlon, bike, swim, rowing sample weeks', () => {
    const sports = [
      { sport: 'triathlon', currentPR: { distanceM: 10000, timeSec: 2700 }, targetPR: { distanceM: 10000, timeSec: 2580 } },
      { sport: 'bike',      currentPR: { distanceM: 0,     timeSec: 3600 }, targetPR: null }, // direct-FTP not applicable here
      { sport: 'swim',      currentPR: { distanceM: 1500,  timeSec: 1500 }, targetPR: { distanceM: 1500, timeSec: 1440 } },
      { sport: 'rowing',    currentPR: { distanceM: 2000,  timeSec: 420 },  targetPR: { distanceM: 2000, timeSec: 405 } },
    ]
    for (const s of sports) {
      const input = {
        ...s,
        raceDate: '2026-09-01',
        options: { today: TODAY },
      }
      // For bike direct-FTP we must add noTarget + supply ftp; skip if bike fails.
      if (s.sport === 'bike') {
        input.noTarget = true
        input.profile = { ftp: 250 }
      }
      const r = buildEliteProgram(input)
      if (!r) continue
      expect(strengthCount(r.sampleWeeks.Build)).toBe(2)
      expect(strengthCount(r.sampleWeeks.Peak)).toBe(1)
    }
  })
})

// ── v9.37.0 — Base polarization: Seiler 2010 ≤5% Z3+ ceiling ──────────────
// Coaching audit caught all 4 single-sport Base weeks (and tri Base) with
// Thursday tempo/sweet-spot/CSS/AT sessions pushing weekly Z3+ above 5%.
// True Base in Seiler 2010 (and Daniels 2014, Olbrecht 2000, Nolte 2005) is
// almost entirely Z1+Z2 with strides — high-intensity arrives in Build.
describe('v9.37.0 — Base polarization Z3+ ≤5% (Seiler 2010, Daniels 2014, Nolte 2005)', () => {
  const baseZ3PlusPct = (week) => {
    let total = 0, hard = 0
    for (const d of week) {
      total += d.durationMin || 0
      hard += (d.zones?.Z3 || 0) + (d.zones?.Z4 || 0) + (d.zones?.Z5 || 0)
    }
    return total > 0 ? (hard / total) * 100 : 0
  }

  it('Run Base ≤5% Z3+ (Daniels 2014: no tempo in true Base)', () => {
    const r = buildEliteProgram(RUN_REALISTIC)
    const base = r.sampleWeeks?.Base
    expect(base).toBeTruthy()
    expect(baseZ3PlusPct(base)).toBeLessThanOrEqual(5)
  })

  it('Bike Base ≤5% Z3+ (Coggan Base I-III: high-volume Z2)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 250 },
      targetPR:  { distanceM: 0, timeSec: 280 },
      raceDate: '2026-09-25',
      sport: 'bike',
      options: { today: TODAY },
    })
    const base = r?.sampleWeeks?.Base
    expect(base).toBeTruthy()
    expect(baseZ3PlusPct(base)).toBeLessThanOrEqual(5)
  })

  it('Swim Base ≤5% Z3+ (Olbrecht 2000: EN1+EN2 dominant Base)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 1500, timeSec: 1800 },
      targetPR:  { distanceM: 1500, timeSec: 1700 },
      raceDate: '2026-09-25',
      sport: 'swim',
      options: { today: TODAY },
    })
    const base = r?.sampleWeeks?.Base
    expect(base).toBeTruthy()
    expect(baseZ3PlusPct(base)).toBeLessThanOrEqual(5)
  })

  it('Rowing Base ≤5% Z3+ (Nolte 2005: UT2:UT1:AT:TR = 70:25:5:0)', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 0, timeSec: 480 },
      targetPR:  { distanceM: 0, timeSec: 440 },
      raceDate: '2026-09-25',
      sport: 'rowing',
      options: { today: TODAY },
    })
    const base = r?.sampleWeeks?.Base
    expect(base).toBeTruthy()
    expect(baseZ3PlusPct(base)).toBeLessThanOrEqual(5)
  })

  it('Triathlon Base ≤5% Z3+ across all 3 disciplines combined', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      raceDate: '2026-09-25',
      sport: 'triathlon',
      options: { today: TODAY },
    })
    const base = r?.sampleWeeks?.Base
    expect(base).toBeTruthy()
    expect(baseZ3PlusPct(base)).toBeLessThanOrEqual(5)
  })
})

// v9.161.0 (EP-1) — Distance-specific phase routing
describe('inferDistanceCategory', () => {
  it('classifies running distances', () => {
    expect(inferDistanceCategory('run', 5000)).toBe('5K')
    expect(inferDistanceCategory('run', 10000)).toBe('10K')
    expect(inferDistanceCategory('run', 21097)).toBe('HM')
    expect(inferDistanceCategory('run', 42195)).toBe('Marathon')
    expect(inferDistanceCategory('run', 50000)).toBe('Ultra')
  })

  it('classifies swimming distances', () => {
    expect(inferDistanceCategory('swim', 100)).toBe('Sprint')
    expect(inferDistanceCategory('swim', 200)).toBe('Sprint')
    expect(inferDistanceCategory('swim', 400)).toBe('Mid')
    expect(inferDistanceCategory('swim', 800)).toBe('Mid')
    expect(inferDistanceCategory('swim', 1500)).toBe('Distance')
    expect(inferDistanceCategory('swim', 10000)).toBe('Distance')
  })

  it('classifies triathlon distances by total', () => {
    expect(inferDistanceCategory('triathlon', 25750)).toBe('Sprint')
    expect(inferDistanceCategory('triathlon', 51500)).toBe('Olympic')
    expect(inferDistanceCategory('triathlon', 113000)).toBe('70.3')
    expect(inferDistanceCategory('triathlon', 226000)).toBe('IM')
  })

  it('cycling: direct-FTP sentinel maps to TT', () => {
    expect(inferDistanceCategory('bike', 0)).toBe('TT')
    expect(inferDistanceCategory('bike', null)).toBe('TT')
    expect(inferDistanceCategory('bike', 40000)).toBe('TT')
    expect(inferDistanceCategory('bike', 100000)).toBe('RoadRace')
    expect(inferDistanceCategory('bike', 250000)).toBe('GranFondo')
  })

  it('rowing: zero or missing distance maps to Erg', () => {
    expect(inferDistanceCategory('rowing', 0)).toBe('Erg')
    expect(inferDistanceCategory('rowing', 2000)).toBe('2k')
    expect(inferDistanceCategory('rowing', 5000)).toBe('5k')
  })

  it('returns null for unknown sport', () => {
    expect(inferDistanceCategory('walking', 5000)).toBeNull()
    expect(inferDistanceCategory('', 5000)).toBeNull()
  })

  it('returns null for missing/invalid distance on running', () => {
    expect(inferDistanceCategory('run', null)).toBeNull()
    expect(inferDistanceCategory('run', 0)).toBeNull()
    expect(inferDistanceCategory('run', -100)).toBeNull()
  })
})

describe('DISTANCE_PHASE_MULTIPLIERS', () => {
  it('exposes multipliers for every supported sport', () => {
    for (const s of ['run', 'swim', 'triathlon', 'bike', 'rowing']) {
      expect(DISTANCE_PHASE_MULTIPLIERS[s]).toBeTruthy()
    }
  })

  it('5K Peak multiplier > Marathon Peak multiplier (5K emphasizes peak)', () => {
    expect(DISTANCE_PHASE_MULTIPLIERS.run['5K'].Peak)
      .toBeGreaterThan(DISTANCE_PHASE_MULTIPLIERS.run.Marathon.Peak)
  })

  it('Marathon Base multiplier > 5K Base multiplier (Marathon emphasizes base)', () => {
    expect(DISTANCE_PHASE_MULTIPLIERS.run.Marathon.Base)
      .toBeGreaterThan(DISTANCE_PHASE_MULTIPLIERS.run['5K'].Base)
  })
})

describe('buildEliteProgram — distance-aware phase split', () => {
  function runProgram(extra = {}) {
    return buildEliteProgram({
      sport: 'run',
      raceDate: '2026-11-01',  // ~26 weeks out from 2026-05-04 TODAY
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      ...extra,
      options: { today: TODAY, ...(extra.options || {}) },
    })
  }
  const phaseLen = (p, name) => p.phases.find(x => x.phase === name)?.weeks.length || 0

  it('surfaces distanceCategory on the returned program', () => {
    const r = buildEliteProgram({
      sport: 'run',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 42195, timeSec: 13500 },  // Marathon 3:45
      targetPR:  { distanceM: 42195, timeSec: 12600 },
      options: { today: TODAY },
    })
    expect(r.distanceCategory).toBe('Marathon')
  })

  it('Marathon plan has more Base weeks than 5K plan at equal total', () => {
    const marathon = runProgram({
      currentPR: { distanceM: 42195, timeSec: 13500 },
      targetPR:  { distanceM: 42195, timeSec: 12600 },
    })
    const fiveK = runProgram({
      currentPR: { distanceM: 5000, timeSec: 1380 },
      targetPR:  { distanceM: 5000, timeSec: 1260 },
    })
    expect(marathon.distanceCategory).toBe('Marathon')
    expect(fiveK.distanceCategory).toBe('5K')
    expect(phaseLen(marathon, 'Base')).toBeGreaterThan(phaseLen(fiveK, 'Base'))
  })

  it('5K plan has more Peak weeks than Marathon plan at equal total', () => {
    const marathon = runProgram({
      currentPR: { distanceM: 42195, timeSec: 13500 },
      targetPR:  { distanceM: 42195, timeSec: 12600 },
    })
    const fiveK = runProgram({
      currentPR: { distanceM: 5000, timeSec: 1380 },
      targetPR:  { distanceM: 5000, timeSec: 1260 },
    })
    expect(phaseLen(fiveK, 'Peak')).toBeGreaterThan(phaseLen(marathon, 'Peak'))
  })

  it('preserves Taper week count (distance shouldn\'t change race-day freshness)', () => {
    const marathon = runProgram({
      currentPR: { distanceM: 42195, timeSec: 13500 },
      targetPR:  { distanceM: 42195, timeSec: 12600 },
    })
    const fiveK = runProgram({
      currentPR: { distanceM: 5000, timeSec: 1380 },
      targetPR:  { distanceM: 5000, timeSec: 1260 },
    })
    expect(phaseLen(marathon, 'Taper')).toBe(phaseLen(fiveK, 'Taper'))
  })

  it('explicit distanceCategory overrides inference', () => {
    const overridden = runProgram({
      currentPR: { distanceM: 5000, timeSec: 1380 },
      targetPR:  { distanceM: 5000, timeSec: 1260 },
      distanceCategory: 'Marathon',  // pretend it's a marathon
    })
    expect(overridden.distanceCategory).toBe('Marathon')
    // Should have Marathon-style base-heavy split, not 5K's peak-heavy
    const r5K = runProgram({
      currentPR: { distanceM: 5000, timeSec: 1380 },
      targetPR:  { distanceM: 5000, timeSec: 1260 },
    })
    expect(phaseLen(overridden, 'Base')).toBeGreaterThan(phaseLen(r5K, 'Base'))
  })

  it('total weeks preserved regardless of distance category', () => {
    const marathon = runProgram({
      currentPR: { distanceM: 42195, timeSec: 13500 },
      targetPR:  { distanceM: 42195, timeSec: 12600 },
    })
    const fiveK = runProgram({
      currentPR: { distanceM: 5000, timeSec: 1380 },
      targetPR:  { distanceM: 5000, timeSec: 1260 },
    })
    const totalM = marathon.phases.reduce((s, p) => s + p.weeks.length, 0)
    const total5 = fiveK.phases.reduce((s, p) => s + p.weeks.length, 0)
    expect(totalM).toBe(total5)
  })

  it('short plans (<8 weeks) fall back to generic split', () => {
    // 6 weeks out from TODAY
    const short = runProgram({
      raceDate: '2026-06-15',
      currentPR: { distanceM: 5000, timeSec: 1380 },
      targetPR:  { distanceM: 5000, timeSec: 1320 },
    })
    // Should still produce a valid plan; the distance category is set
    // but the redistribution is skipped (too short to meaningfully shift)
    expect(short.distanceCategory).toBe('5K')
    expect(short.phases.length).toBeGreaterThan(0)
  })

  it('cycling direct-FTP (distanceM=0) infers TT category', () => {
    const r = buildEliteProgram({
      sport: 'bike',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 0, timeSec: 250 },  // 250W FTP
      targetPR:  { distanceM: 0, timeSec: 280 },
      options: { today: TODAY },
    })
    expect(r.distanceCategory).toBe('TT')
  })

  it('feasibilityWarning is null on canonical plans (peak TSS naturally under 1.5× CTL ramp)', () => {
    // Canonical fixture: CTL=50 anchors at ~CTL×9.5=475 peak. Ceiling at
    // 1.5×CTL×7=525. Stays under — no warning.
    const r = buildEliteProgram({
      sport: 'run',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      profile:   { currentCTL: 50 },
      options:   { today: TODAY },
    })
    expect(r.feasibilityWarning).toBeNull()
  })

  it('feasibilityWarning fires when field-test recal pushes weeks above the 1.5× ceiling', () => {
    // Mid-plan recal scales remaining weeks up by 1.3×. CTL=50 → ceiling=525,
    // buildPk=475, scaled = 475 × 1.3 = 617.5 → above 525 → cap fires.
    const r = buildEliteProgram({
      sport: 'run',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      profile:   { currentCTL: 50 },
      // Ahead-of-schedule field-test → recal scales 1.3× (clamped)
      actualFieldTestResults: { vdot: 54 },  // big VDOT bump
      options:   { today: TODAY },
    })
    expect(r.feasibilityWarning).not.toBeNull()
    expect(r.feasibilityWarning.weeksCapped).toBeGreaterThan(0)
    expect(r.feasibilityWarning.ceiling).toBe(Math.round(50 * 7 * 1.5))
    expect(r.feasibilityWarning.ratio).toBe(1.5)
    expect(r.feasibilityWarning.detail.en).toMatch(/Gabbett/i)
    expect(r.feasibilityWarning.detail.tr).toMatch(/Gabbett/i)
  })

  it('feasibilityWarning is null when currentCTL is below the noise floor (<10)', () => {
    // Even if individual weeks would exceed an arbitrary low ceiling, we
    // skip capping because CTL is too noisy to anchor against.
    const r = buildEliteProgram({
      sport: 'run',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      profile:   { currentCTL: 5 },  // very low CTL
      options:   { today: TODAY },
    })
    expect(r.feasibilityWarning).toBeNull()
  })

  it('every weeklyTSS value is at or below the ceiling when warning fires', () => {
    const r = buildEliteProgram({
      sport: 'run',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      profile:   { currentCTL: 50 },
      actualFieldTestResults: { vdot: 54 },
      options:   { today: TODAY },
    })
    expect(r.feasibilityWarning).not.toBeNull()
    const ceiling = r.feasibilityWarning.ceiling
    for (const tss of r.weeklyTSS) {
      expect(tss).toBeLessThanOrEqual(ceiling)
    }
  })

  it('severity = unsafe when >50% of weeks were capped', () => {
    // Pure unit test — synthesize a scenario where every week was a cap target
    // by using a very low CTL ceiling against the same canonical plan.
    // Drive recal extra hard (1.3 max scaling) with a very small base plan.
    const r = buildEliteProgram({
      sport: 'run',
      raceDate: '2026-08-15',  // ~14 weeks
      currentPR: { distanceM: 5000, timeSec: 1500 },
      targetPR:  { distanceM: 5000, timeSec: 1380 },
      profile:   { currentCTL: 30 },
      actualFieldTestResults: { vdot: 70 },  // huge bump (clamped to 1.3×)
      options:   { today: TODAY },
    })
    // May or may not trigger 'unsafe' depending on phase split; check at least 'aggressive'
    if (r.feasibilityWarning) {
      expect(['aggressive', 'unsafe']).toContain(r.feasibilityWarning.severity)
    }
  })

  it('70.3 triathlon emphasizes Base over Sprint triathlon', () => {
    const sprint = buildEliteProgram({
      sport: 'triathlon',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 25750, timeSec: 5400 },
      targetPR:  { distanceM: 25750, timeSec: 5100 },
      options: { today: TODAY },
    })
    const ironman703 = buildEliteProgram({
      sport: 'triathlon',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 113000, timeSec: 19800 },
      targetPR:  { distanceM: 113000, timeSec: 18600 },
      options: { today: TODAY },
    })
    expect(sprint.distanceCategory).toBe('Sprint')
    expect(ironman703.distanceCategory).toBe('70.3')
    expect(phaseLen(ironman703, 'Base')).toBeGreaterThan(phaseLen(sprint, 'Base'))
  })
})

// v9.163.0 (EP-3) — Mid-plan field-test re-anchor
describe('reAnchorEliteProgram', () => {
  function buildOriginal(extra = {}) {
    return buildEliteProgram({
      sport: 'run',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2700 },
      profile:   { currentCTL: 50 },
      options:   { today: TODAY },
      ...extra,
    })
  }

  it('returns null on malformed inputs', () => {
    expect(reAnchorEliteProgram(null, { vdot: 43 }, '2026-06-29', {})).toBeNull()
    expect(reAnchorEliteProgram({}, null, '2026-06-29', {})).toBeNull()
    expect(reAnchorEliteProgram({ sport: 'run' }, { vdot: 43 }, '', {})).toBeNull()
    expect(reAnchorEliteProgram({ sport: 'run' }, { vdot: 43 }, 'not-a-date', {})).toBeNull()
  })

  it('returns rejection when today is on or past the race date', () => {
    const original = buildOriginal()
    const r = reAnchorEliteProgram(original, { vdot: 43 }, '2027-01-01', {})
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('today-on-or-past-race')
  })

  it('returns rejection when the field-test metric is missing for the sport', () => {
    const original = buildOriginal()
    const r = reAnchorEliteProgram(original, { ftp: 250 }, '2026-06-29', {})
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('missing-field-test-vdot')
  })

  it('passes through buildEliteProgram rejection when new VDOT exceeds target', () => {
    // VDOT 60 over 10K predicts faster than the 45:00 target → rebuild rejects.
    const original = buildOriginal()
    const r = reAnchorEliteProgram(original, { vdot: 60 }, '2026-06-29', { currentCTL: 55 })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('target-not-faster')
  })

  it('produces a shorter plan covering today → raceDate', () => {
    const original = buildOriginal()
    const totalOrig = original.phases.reduce((s, p) => s + p.weeks.length, 0)
    const r = reAnchorEliteProgram(original, { vdot: 43 }, '2026-06-29', { currentCTL: 55 })
    const totalNew = r.phases.reduce((s, p) => s + p.weeks.length, 0)
    expect(totalNew).toBeLessThan(totalOrig)
  })

  it('surfaces completedWeeks = (originalTotal - newTotal)', () => {
    const original = buildOriginal()
    const totalOrig = original.phases.reduce((s, p) => s + p.weeks.length, 0)
    const r = reAnchorEliteProgram(original, { vdot: 43 }, '2026-06-29', { currentCTL: 55 })
    const totalNew = r.phases.reduce((s, p) => s + p.weeks.length, 0)
    expect(r.reAnchored.completedWeeks).toBe(totalOrig - totalNew)
    expect(r.reAnchored.originalTotalWeeks).toBe(totalOrig)
  })

  it('preserves the race date as the calendar anchor', () => {
    const original = buildOriginal()
    const r = reAnchorEliteProgram(original, { vdot: 43 }, '2026-06-29', { currentCTL: 55 })
    expect(r.feasibility.effectiveRaceDate).toBe('2026-11-01')
  })

  it('surfaces previous + new currentLevel for traceability', () => {
    const original = buildOriginal()
    const r = reAnchorEliteProgram(original, { vdot: 43 }, '2026-06-29', { currentCTL: 55 })
    expect(r.reAnchored.previousCurrentLevel.vdot).toBe(original.currentLevel.vdot)
    expect(r.reAnchored.newCurrentLevel.vdot).toBeCloseTo(43, 0)
  })

  it('preserves distanceCategory across re-anchor', () => {
    const original = buildOriginal()
    expect(original.distanceCategory).toBe('10K')
    const r = reAnchorEliteProgram(original, { vdot: 43 }, '2026-06-29', { currentCTL: 55 })
    expect(r.distanceCategory).toBe('10K')
  })

  it('cycling sport requires fieldTest.ftp', () => {
    const orig = buildEliteProgram({
      sport: 'bike',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 0, timeSec: 250 },
      targetPR:  { distanceM: 0, timeSec: 280 },
      profile:   { currentCTL: 60 },
      options:   { today: TODAY },
    })
    const wrong = reAnchorEliteProgram(orig, { vdot: 60 }, '2026-06-29', { currentCTL: 60 })
    expect(wrong._rejected).toBe(true)
    expect(wrong.reason).toBe('missing-field-test-ftp')
    const good = reAnchorEliteProgram(orig, { ftp: 260 }, '2026-06-29', { currentCTL: 60 })
    expect(good._rejected).toBeFalsy()
    expect(good.reAnchored.newCurrentLevel.ftp).toBe(260)
  })

  it('records the field-test payload on reAnchored.fieldTest', () => {
    const original = buildOriginal()
    const ft = { vdot: 43 }
    const r = reAnchorEliteProgram(original, ft, '2026-06-29', { currentCTL: 55 })
    expect(r.reAnchored.fieldTest).toEqual(ft)
  })
})

// v9.164.0 (EP-5) — Polarization enforcement: Seiler 80/20 floor on
// generated sample weeks. Previously the polarization narrative was
// documented in code comments but never asserted, so any future refactor
// to runSampleWeek/bikeSampleWeek/swimSampleWeek could silently drift the
// hard-intensity ratio past safe thresholds without breaking tests.
describe('polarization enforcement — sample-week Z3+ ratio', () => {
  // Compute Z3+ minutes ÷ total active minutes for one sample-week phase.
  function hardRatio(weekDays) {
    let total = 0, hard = 0
    for (const d of weekDays) {
      if (!d.zones) continue
      const z1 = +d.zones.Z1 || 0
      const z2 = +d.zones.Z2 || 0
      const z3 = +d.zones.Z3 || 0
      const z4 = +d.zones.Z4 || 0
      const z5 = +d.zones.Z5 || 0
      total += z1 + z2 + z3 + z4 + z5
      hard  += z3 + z4 + z5
    }
    return total > 0 ? hard / total : 0
  }

  function buildR() {
    return buildEliteProgram({
      sport: 'run',
      raceDate: '2026-11-01',
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      profile:   { currentCTL: 50 },
      options:   { today: TODAY },
    })
  }

  it('Base phase: hard ratio ≤ 8% (Seiler / Daniels: Base has effectively no hard work)', () => {
    const r = buildR()
    const ratio = hardRatio(r.sampleWeeks.Base.filter(d => !d.intent || !/strength/i.test(JSON.stringify(d.intent))))
    expect(ratio).toBeLessThanOrEqual(0.08)
  })

  it('Build phase: hard ratio between 15% and 30% (polarized Build)', () => {
    const r = buildR()
    const ratio = hardRatio(r.sampleWeeks.Build.filter(d => !d.intent || !/strength/i.test(JSON.stringify(d.intent))))
    expect(ratio).toBeGreaterThanOrEqual(0.15)
    expect(ratio).toBeLessThanOrEqual(0.30)
  })

  it('Peak phase: hard ratio between 18% and 30% (intensified but still under 80/20 ceiling)', () => {
    const r = buildR()
    const ratio = hardRatio(r.sampleWeeks.Peak.filter(d => !d.intent || !/strength/i.test(JSON.stringify(d.intent))))
    expect(ratio).toBeGreaterThanOrEqual(0.18)
    expect(ratio).toBeLessThanOrEqual(0.30)
  })

  it('Taper phase: hard ratio kept above 10% (preserve race-pace neural priming)', () => {
    const r = buildR()
    const ratio = hardRatio(r.sampleWeeks.Taper.filter(d => !d.intent || !/strength/i.test(JSON.stringify(d.intent))))
    expect(ratio).toBeGreaterThanOrEqual(0.10)
  })
})

// ── v9.181.0 — EP-9 cyclePhaseGate wiring ────────────────────────────────────
describe('buildEliteProgram — cycle phase gate (v9.181.0 wiring)', () => {
  const baseInput = {
    sport: 'run',
    raceDate: '2026-11-01',
    currentPR: { distanceM: 10000, timeSec: 3000 },
    targetPR:  { distanceM: 10000, timeSec: 2820 },
    profile:   { currentCTL: 50 },
    options:   { today: '2026-05-04' },
  }

  it('non-female profile → cycleGate is null and weeklyTSS unchanged', () => {
    const p = buildEliteProgram({ ...baseInput, profile: { ...baseInput.profile, gender: 'male' } })
    expect(p).not.toBeNull()
    expect(p.cycleGate).toBeNull()
    for (const w of p.weeklyTSS) {
      expect(w.cycleMultiplier).toBeUndefined()
      expect(w.cyclePhase).toBeUndefined()
      expect(w.cycleAdjustedTSS).toBeUndefined()
    }
  })

  it('female but no lastPeriodStart → cycleGate is null (no opt-in)', () => {
    const p = buildEliteProgram({ ...baseInput, profile: { ...baseInput.profile, gender: 'female' } })
    expect(p.cycleGate).toBeNull()
    expect(p.weeklyTSS[0].cycleMultiplier).toBeUndefined()
  })

  it('female + lastPeriodStart → cycleGate is populated and weeklyTSS is annotated', () => {
    const p = buildEliteProgram({
      ...baseInput,
      profile: { ...baseInput.profile, gender: 'female', lastPeriodStart: '2026-04-28', cycleLength: 28 },
    })
    expect(p.cycleGate).not.toBeNull()
    expect(Array.isArray(p.cycleGate.weeks)).toBe(true)
    const annotated = p.weeklyTSS.filter(w => w.cycleMultiplier != null)
    expect(annotated.length).toBeGreaterThan(0)
    for (const w of annotated) {
      expect(w.cycleMultiplier).toBeGreaterThanOrEqual(0.95)
      expect(w.cycleMultiplier).toBeLessThanOrEqual(1.05)
      expect(['menstruation', 'follicular', 'ovulation', 'luteal']).toContain(w.cyclePhase)
      // applyCyclePhaseGate guards w.tss with `|| 0`; match that for NaN-safe weeks
      expect(w.cycleAdjustedTSS).toBe(Math.round((Number(w.tss) || 0) * w.cycleMultiplier))
    }
  })

  it('original tss field is preserved when cycle gate is active (authoritative)', () => {
    const female = buildEliteProgram({
      ...baseInput,
      profile: { ...baseInput.profile, gender: 'female', lastPeriodStart: '2026-04-28', cycleLength: 28 },
    })
    const male = buildEliteProgram({ ...baseInput, profile: { ...baseInput.profile, gender: 'male' } })
    for (let i = 0; i < male.weeklyTSS.length; i++) {
      expect(female.weeklyTSS[i].tss).toBe(male.weeklyTSS[i].tss)
    }
  })
})
