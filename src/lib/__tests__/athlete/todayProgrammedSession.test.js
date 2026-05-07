// ─── todayProgrammedSession.test.js — daily-answer surface ───────────────────
import { describe, it, expect } from 'vitest'
import {
  getTodayProgrammedSession,
  TODAY_PROGRAMMED_SESSION_CITATION,
} from '../../athlete/todayProgrammedSession.js'
import { buildEliteProgram } from '../../athlete/eliteProgram.js'

const START = '2026-05-07'

function runProgram(start = START) {
  return buildEliteProgram({
    sport: 'run',
    currentPR: { distanceM: 10000, timeSec: 3000 },   // 50:00
    targetPR:  { distanceM: 10000, timeSec: 2700 },   // 45:00
    raceDate: '2026-09-04',                           // ~17 wk window
    options: { today: start },
  })
}

function bikeProgram(start = START) {
  return buildEliteProgram({
    sport: 'bike',
    currentPR: { distanceM: 0, timeSec: 230 },        // 230W FTP
    targetPR:  { distanceM: 0, timeSec: 260 },
    raceDate: '2026-09-04',
    options: { today: start },
  })
}

function swimProgram(start = START) {
  return buildEliteProgram({
    sport: 'swim',
    currentPR: { distanceM: 1500, timeSec: 1700 },
    targetPR:  { distanceM: 1500, timeSec: 1500 },
    raceDate: '2026-09-04',
    options: { today: start },
  })
}

function dayPlus(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('getTodayProgrammedSession', () => {
  it('returns null when program is null', () => {
    expect(getTodayProgrammedSession(null, '2026-05-07', START)).toBeNull()
  })

  it('returns null when program is missing phases/sampleWeeks', () => {
    expect(getTodayProgrammedSession({}, '2026-05-07', START)).toBeNull()
    expect(getTodayProgrammedSession({ phases: [] }, '2026-05-07', START)).toBeNull()
  })

  it('returns reliable=false reason="before" when today < programStart', () => {
    const p = runProgram()
    const r = getTodayProgrammedSession(p, '2026-05-01', START)
    expect(r.reliable).toBe(false)
    expect(r.reason).toBe('before')
    expect(r.message.en).toMatch(/has not started/i)
    expect(r.message.tr).toMatch(/başlamadı/)
  })

  it('returns reliable=false reason="after" when today is past final week', () => {
    const p = runProgram()
    const r = getTodayProgrammedSession(p, dayPlus(START, 7 * 30), START)
    expect(r.reliable).toBe(false)
    expect(r.reason).toBe('after')
    expect(r.message.en).toMatch(/ended/i)
    expect(r.message.tr).toMatch(/sona erdi/)
  })

  it('today=programStart returns week 1 with day matching weekday', () => {
    // 2026-05-07 is a Thursday → day idx 3 → 'Thu' in Mon-first sample week
    const p = runProgram()
    const r = getTodayProgrammedSession(p, START, START)
    expect(r.reliable).toBe(true)
    expect(r.weekIndex).toBe(1)
    expect(r.day).toBe('Thu')
  })

  it('today=programStart+7 returns week 2', () => {
    const p = runProgram()
    const r = getTodayProgrammedSession(p, dayPlus(START, 7), START)
    expect(r.weekIndex).toBe(2)
  })

  it('today=programStart+22 returns week 4 day 1 (Tue)', () => {
    // Pick a Mon-aligned start: programStart = 2026-05-04 (Mon).
    const monStart = '2026-05-04'
    const p2 = runProgram(monStart)
    const r = getTodayProgrammedSession(p2, dayPlus(monStart, 22), monStart)
    expect(r.weekIndex).toBe(4)
    expect(r.day).toBe('Tue')
  })

  it('phase boundary: last Base week is one phase, next week is Build', () => {
    const p = runProgram()
    const baseCount = p.phases.find(x => x.phase === 'Base')?.weeks.length || 0
    const buildPhase = p.phases.find(x => x.phase === 'Build')
    if (baseCount > 0 && buildPhase) {
      const lastBase = getTodayProgrammedSession(p, dayPlus(START, (baseCount - 1) * 7), START)
      const firstBuild = getTodayProgrammedSession(p, dayPlus(START, baseCount * 7), START)
      expect(lastBase.phase).toBe('Base')
      expect(firstBuild.phase).toBe('Build')
    }
  })

  it('intent rest produces isRest=true and "Rest day" headline', () => {
    // Run sample weeks have rest on Mon (day 0) — verify with a Monday-start program
    const monStart = '2026-05-04'
    const p2 = runProgram(monStart)
    const r = getTodayProgrammedSession(p2, monStart, monStart)
    expect(r.day).toBe('Mon')
    expect(r.isRest).toBe(true)
    expect(r.message.en).toBe('Today: Rest day')
    expect(r.message.tr).toBe('Bugün: Dinlenme günü')
  })

  it('intervals/VO2max produces interval-session headline', () => {
    const p = runProgram()
    // Peak phase, Tuesday is "VO2max 6x800m"
    const baseCount = p.phases.find(x => x.phase === 'Base')?.weeks.length || 0
    const buildCount = p.phases.find(x => x.phase === 'Build')?.weeks.length || 0
    const peakWeek1Day = (baseCount + buildCount) // 0-indexed weeks-from-start
    const monStart = '2026-05-04'   // Monday
    const p2 = runProgram(monStart)
    const peakTueIso = dayPlus(monStart, peakWeek1Day * 7 + 1)
    const r = getTodayProgrammedSession(p2, peakTueIso, monStart)
    expect(r.phase).toBe('Peak')
    expect(r.intentKey).toBe('intervals')
    expect(r.message.en).toMatch(/interval session/i)
    expect(r.message.tr).toMatch(/interval seansı/)
  })

  it('durationMin=0 yields isRest=true even if intent string differs', () => {
    const fakeProgram = {
      sport: 'run',
      phases: [{ phase: 'Taper', weeks: [1] }],
      sampleWeeks: {
        Taper: [
          { day: 'Mon', intent: { en: 'Race day', tr: 'Yarış günü' }, durationMin: 0,
            zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 0 }, paceTarget: null,
            notes: { en: 'race', tr: 'yarış' } },
        ],
      },
    }
    const r = getTodayProgrammedSession(fakeProgram, '2026-05-04', '2026-05-04')
    expect(r.isRest).toBe(true)
    expect(r.durationMin).toBe(0)
  })

  it('zones object is propagated correctly', () => {
    const monStart = '2026-05-04'
    const p = runProgram(monStart)
    const r = getTodayProgrammedSession(p, dayPlus(monStart, 1), monStart) // Tue
    expect(r.zones).toBeDefined()
    expect(typeof r.zones.Z1).toBe('number')
    expect(typeof r.zones.Z5).toBe('number')
  })

  it('paceTarget is propagated when present', () => {
    const monStart = '2026-05-04'
    const p = runProgram(monStart)
    const r = getTodayProgrammedSession(p, dayPlus(monStart, 1), monStart) // Tue Easy → has pace
    expect(r.paceTarget).toMatch(/\/km/)
  })

  it('paceTarget is null on rest days', () => {
    const monStart = '2026-05-04'
    const p = runProgram(monStart)
    const r = getTodayProgrammedSession(p, monStart, monStart) // Mon = rest
    expect(r.paceTarget).toBeNull()
  })

  it('notes EN and TR are present', () => {
    const monStart = '2026-05-04'
    const p = runProgram(monStart)
    const r = getTodayProgrammedSession(p, dayPlus(monStart, 1), monStart)
    expect(r.notes.en).toBeTruthy()
    expect(r.notes.tr).toBeTruthy()
  })

  it('sport=run substitutes "run" / "koşu" in easy headline', () => {
    const monStart = '2026-05-04'
    const p = runProgram(monStart)
    const r = getTodayProgrammedSession(p, dayPlus(monStart, 1), monStart) // Tue Easy run
    expect(r.intentKey).toBe('easy')
    expect(r.message.en).toMatch(/easy run/)
    expect(r.message.tr).toMatch(/kolay koşu/)
  })

  it('sport=bike substitutes "bike" / "bisiklet"', () => {
    const monStart = '2026-05-04'
    const p = bikeProgram(monStart)
    // Tue endurance ride is "easy" classified
    const r = getTodayProgrammedSession(p, dayPlus(monStart, 1), monStart)
    expect(r.intentKey).toBe('easy')
    expect(r.message.en).toMatch(/easy bike/)
    expect(r.message.tr).toMatch(/kolay bisiklet/)
  })

  it('sport=swim returns valid week 1 session', () => {
    const monStart = '2026-05-04'
    const p = swimProgram(monStart)
    const r = getTodayProgrammedSession(p, dayPlus(monStart, 1), monStart)
    expect(r).not.toBeNull()
    expect(r.reliable).toBe(true)
    expect(r.durationMin).toBeGreaterThan(0)
  })

  it('options.today override is deterministic across runs', () => {
    const p1 = runProgram()
    const p2 = runProgram()
    const r1 = getTodayProgrammedSession(p1, '2026-05-12', START)
    const r2 = getTodayProgrammedSession(p2, '2026-05-12', START)
    expect(r1.weekIndex).toBe(r2.weekIndex)
    expect(r1.day).toBe(r2.day)
    expect(r1.message.en).toBe(r2.message.en)
  })

  it('returns bilingual recommendation on training day', () => {
    const monStart = '2026-05-04'
    const p = runProgram(monStart)
    const r = getTodayProgrammedSession(p, dayPlus(monStart, 1), monStart)
    expect(r.recommendation.en).toBeTruthy()
    expect(r.recommendation.tr).toBeTruthy()
  })

  it('returns bilingual recommendation on rest day', () => {
    const monStart = '2026-05-04'
    const p = runProgram(monStart)
    const r = getTodayProgrammedSession(p, monStart, monStart)
    expect(r.recommendation.en).toMatch(/Recovery|sleep/i)
    expect(r.recommendation.tr).toMatch(/Toparlanma|uyku/i)
  })

  it('citation is present and exported as constant', () => {
    expect(TODAY_PROGRAMMED_SESSION_CITATION).toMatch(/Daniels|Bompa|Mujika/)
    const monStart = '2026-05-04'
    const p = runProgram(monStart)
    const r = getTodayProgrammedSession(p, dayPlus(monStart, 1), monStart)
    expect(r.citation).toBe(TODAY_PROGRAMMED_SESSION_CITATION)
  })

  it('phaseColor is propagated when phase has a color', () => {
    const monStart = '2026-05-04'
    const p = runProgram(monStart)
    const r = getTodayProgrammedSession(p, monStart, monStart)
    expect(r.phaseColor).toBeTruthy()
  })

  it('intentColor is provided and matches intent classification', () => {
    const monStart = '2026-05-04'
    const p = runProgram(monStart)
    const rest = getTodayProgrammedSession(p, monStart, monStart)
    const easy = getTodayProgrammedSession(p, dayPlus(monStart, 1), monStart)
    expect(rest.intentColor).toMatch(/^#[0-9a-f]{6}$/i)
    expect(easy.intentColor).not.toBe(rest.intentColor)
  })

  it('weekTotal equals sum of all phase weeks', () => {
    const monStart = '2026-05-04'
    const p = runProgram(monStart)
    const expected = p.phases.reduce((a, ph) => a + ph.weeks.length, 0)
    const r = getTodayProgrammedSession(p, monStart, monStart)
    expect(r.weekTotal).toBe(expected)
  })
})
