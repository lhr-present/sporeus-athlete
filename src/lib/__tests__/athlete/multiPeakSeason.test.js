// src/lib/__tests__/athlete/multiPeakSeason.test.js
import { describe, it, expect } from 'vitest'
import { buildMultiPeakSeason, MULTI_PEAK_CITATION } from '../../athlete/multiPeakSeason.js'

const TODAY = '2026-05-04'

describe('buildMultiPeakSeason — input validation', () => {
  it('null / non-object → null', () => {
    expect(buildMultiPeakSeason(null)).toBeNull()
    expect(buildMultiPeakSeason(undefined)).toBeNull()
    expect(buildMultiPeakSeason(42)).toBeNull()
  })

  it('missing sport → rejected', () => {
    const r = buildMultiPeakSeason({ races: [{ date: '2026-09-01', priority: 'A' }], options: { today: TODAY } })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('missing-sport')
  })

  it('no races → rejected', () => {
    const r = buildMultiPeakSeason({ sport: 'run', races: [], options: { today: TODAY } })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('no-races')
  })

  it('race in past → rejected', () => {
    const r = buildMultiPeakSeason({
      sport: 'run',
      races: [{ date: '2025-01-01', priority: 'A' }],
      options: { today: TODAY },
    })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('race-in-past')
  })

  it('invalid priority → rejected', () => {
    const r = buildMultiPeakSeason({
      sport: 'run',
      races: [{ date: '2026-09-01', priority: 'X' }],
      options: { today: TODAY },
    })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('invalid-priority')
  })

  it('too many races (>6) → rejected', () => {
    const distinct = [
      { date: '2026-06-01', priority: 'C' },
      { date: '2026-07-01', priority: 'C' },
      { date: '2026-08-01', priority: 'C' },
      { date: '2026-09-01', priority: 'C' },
      { date: '2026-10-01', priority: 'C' },
      { date: '2026-11-01', priority: 'C' },
      { date: '2026-12-01', priority: 'C' },
    ]
    const r = buildMultiPeakSeason({ sport: 'run', races: distinct, options: { today: TODAY } })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('too-many-races')
  })
})

describe('buildMultiPeakSeason — single A-race', () => {
  it('produces phases ending in Taper → Race → Recovery', () => {
    const s = buildMultiPeakSeason({
      sport: 'run',
      races: [{ date: '2026-11-01', priority: 'A', label: 'Istanbul Marathon' }],
      options: { today: TODAY },
    })
    expect(s._rejected).toBeUndefined()
    const phaseSeq = s.weeks.map(w => w.phase)
    expect(phaseSeq).toContain('Base')
    expect(phaseSeq).toContain('Build')
    expect(phaseSeq).toContain('Peak')
    expect(phaseSeq).toContain('Taper')
    expect(phaseSeq).toContain('Race')
    expect(phaseSeq).toContain('Recovery')
    // Race week is followed by recovery
    const raceIdx = phaseSeq.indexOf('Race')
    expect(phaseSeq[raceIdx + 1]).toBe('Recovery')
    expect(phaseSeq[raceIdx + 2]).toBe('Recovery')
  })

  it('races output annotates weekIdx', () => {
    const s = buildMultiPeakSeason({
      sport: 'run',
      races: [{ date: '2026-11-01', priority: 'A', label: 'A' }],
      options: { today: TODAY },
    })
    expect(s.races[0].weekIdx).toBeGreaterThan(0)
    expect(typeof s.races[0].weekIdx).toBe('number')
  })

  it('peakCount = 1', () => {
    const s = buildMultiPeakSeason({
      sport: 'run',
      races: [{ date: '2026-11-01', priority: 'A' }],
      options: { today: TODAY },
    })
    expect(s.peakCount).toBe(1)
  })
})

describe('buildMultiPeakSeason — A + B sequence', () => {
  it('B-race after A-race uses Maintenance instead of Base', () => {
    const s = buildMultiPeakSeason({
      sport: 'bike',
      races: [
        { date: '2026-07-01', priority: 'A', label: 'Goal' },
        { date: '2026-10-15', priority: 'B', label: 'Tune-up' },
      ],
      options: { today: TODAY },
    })
    const legB = s.weeks.filter(w => w.legIdx === 2 && w.phase !== 'Race' && w.phase !== 'Recovery')
    expect(legB.some(w => w.phase === 'Maintenance' || w.phase === 'Build' || w.phase === 'Peak' || w.phase === 'Taper')).toBe(true)
    // The B leg should NOT contain a Base phase
    expect(legB.some(w => w.phase === 'Base')).toBe(false)
  })

  it('A-race recovery = 2 weeks, B-race recovery = 1 week', () => {
    const s = buildMultiPeakSeason({
      sport: 'bike',
      races: [
        { date: '2026-07-01', priority: 'A' },
        { date: '2026-10-15', priority: 'B' },
      ],
      options: { today: TODAY },
    })
    const aLegRecovery = s.weeks.filter(w => w.legIdx === 1 && w.phase === 'Recovery')
    const bLegRecovery = s.weeks.filter(w => w.legIdx === 2 && w.phase === 'Recovery')
    expect(aLegRecovery.length).toBe(2)
    expect(bLegRecovery.length).toBe(1)
  })

  it('B-race taper = 1 week (mini-taper)', () => {
    const s = buildMultiPeakSeason({
      sport: 'bike',
      races: [
        { date: '2026-07-01', priority: 'A' },
        { date: '2026-10-15', priority: 'B' },
      ],
      options: { today: TODAY },
    })
    const bLegTaper = s.weeks.filter(w => w.legIdx === 2 && w.phase === 'Taper')
    expect(bLegTaper.length).toBe(1)
  })
})

describe('buildMultiPeakSeason — C-race (race-as-training)', () => {
  it('C-race has 0 taper, 0 recovery weeks', () => {
    const s = buildMultiPeakSeason({
      sport: 'run',
      races: [
        { date: '2026-08-01', priority: 'A' },
        { date: '2026-09-15', priority: 'C', label: 'Tune-up 5K' },
      ],
      options: { today: TODAY },
    })
    const cLegTaper = s.weeks.filter(w => w.legIdx === 2 && w.phase === 'Taper')
    const cLegRecovery = s.weeks.filter(w => w.legIdx === 2 && w.phase === 'Recovery')
    expect(cLegTaper.length).toBe(0)
    expect(cLegRecovery.length).toBe(0)
  })

  it('peakCount excludes C-races', () => {
    const s = buildMultiPeakSeason({
      sport: 'run',
      races: [
        { date: '2026-07-01', priority: 'A' },
        { date: '2026-08-01', priority: 'C' },
        { date: '2026-10-15', priority: 'B' },
      ],
      options: { today: TODAY },
    })
    expect(s.peakCount).toBe(2)
  })
})

describe('buildMultiPeakSeason — warnings', () => {
  it('warns when >1 A-race', () => {
    const s = buildMultiPeakSeason({
      sport: 'run',
      races: [
        { date: '2026-07-01', priority: 'A' },
        { date: '2026-11-01', priority: 'A' },
      ],
      options: { today: TODAY },
    })
    expect(s.warnings.some(w => w.code === 'multiple-A-races')).toBe(true)
  })

  it('warns when >4 race-peaks', () => {
    const s = buildMultiPeakSeason({
      sport: 'run',
      races: [
        { date: '2026-06-01', priority: 'A' },
        { date: '2026-07-15', priority: 'B' },
        { date: '2026-08-15', priority: 'B' },
        { date: '2026-09-15', priority: 'B' },
        { date: '2026-10-15', priority: 'B' },
      ],
      options: { today: TODAY },
    })
    expect(s.warnings.some(w => w.code === 'too-many-peaks')).toBe(true)
  })

  // v9.204.0 — leg-too-short warnings now expose `raceDate`
  it('leg-too-short warning includes raceDate for UI targeting', () => {
    const TODAY_TEST = '2026-05-07'
    const s = buildMultiPeakSeason({
      sport: 'run',
      races: [
        // Only 1 week until this A-race, well below the 2-week taper minimum
        { date: '2026-05-12', priority: 'A', label: 'too-close A' },
      ],
      options: { today: TODAY_TEST },
    })
    const w = s.warnings.find(x => x.code === 'leg-too-short')
    expect(w).toBeTruthy()
    expect(w.raceDate).toBe('2026-05-12')
    expect(w.en).toMatch(/Only/)
  })
})

describe('buildMultiPeakSeason — week chronology', () => {
  it('weekIdx is monotonically increasing', () => {
    const s = buildMultiPeakSeason({
      sport: 'run',
      races: [
        { date: '2026-07-01', priority: 'A' },
        { date: '2026-10-15', priority: 'B' },
      ],
      options: { today: TODAY },
    })
    for (let i = 1; i < s.weeks.length; i++) {
      expect(s.weeks[i].weekIdx).toBe(s.weeks[i - 1].weekIdx + 1)
    }
  })

  it('startISO advances 7 days each week', () => {
    const s = buildMultiPeakSeason({
      sport: 'run',
      races: [{ date: '2026-08-01', priority: 'A' }],
      options: { today: TODAY },
    })
    for (let i = 1; i < s.weeks.length; i++) {
      const a = new Date(s.weeks[i - 1].startISO + 'T00:00:00Z').getTime()
      const b = new Date(s.weeks[i].startISO + 'T00:00:00Z').getTime()
      expect(b - a).toBe(7 * 86_400_000)
    }
  })

  it('tssMultiplier is in expected ranges per phase', () => {
    const s = buildMultiPeakSeason({
      sport: 'run',
      races: [{ date: '2026-09-01', priority: 'A' }],
      options: { today: TODAY },
    })
    for (const w of s.weeks) {
      expect(w.tssMultiplier).toBeGreaterThan(0)
      expect(w.tssMultiplier).toBeLessThanOrEqual(1.15)
    }
    // Race week always 0.5
    const race = s.weeks.find(w => w.phase === 'Race')
    expect(race.tssMultiplier).toBe(0.5)
    // Recovery week always 0.4
    const rec = s.weeks.find(w => w.phase === 'Recovery')
    expect(rec.tssMultiplier).toBe(0.4)
  })

  it('citation references Issurin / Bompa / Mujika', () => {
    expect(MULTI_PEAK_CITATION).toMatch(/Issurin/)
    expect(MULTI_PEAK_CITATION).toMatch(/Bompa/)
    expect(MULTI_PEAK_CITATION).toMatch(/Mujika/)
  })
})
