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
