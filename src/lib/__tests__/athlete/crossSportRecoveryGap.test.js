// ─── crossSportRecoveryGap.test.js — pure-fn coverage ──────────────────────
import { describe, it, expect } from 'vitest'
import {
  analyzeCrossSportRecoveryGap,
  classifySport,
  CROSS_SPORT_RECOVERY_GAP_CITATION,
  SPORT_RECOVERY_WINDOWS,
} from '../../athlete/crossSportRecoveryGap.js'

const TODAY = '2026-05-18'

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ─── classifySport ──────────────────────────────────────────────────────────
describe('classifySport', () => {
  it('maps bike-ish keywords (bike, cycle, ride, spin) → bike', () => {
    expect(classifySport({ type: 'Bike Endurance' })).toBe('bike')
    expect(classifySport({ type: 'Indoor cycling' })).toBe('bike')
    expect(classifySport({ type: 'Long ride' })).toBe('bike')
    expect(classifySport({ type: 'Spin class' })).toBe('bike')
    expect(classifySport({ sport: 'cycling' })).toBe('bike')
  })

  it('maps swim → swim', () => {
    expect(classifySport({ type: 'Open water swim' })).toBe('swim')
    expect(classifySport({ sport: 'swimming' })).toBe('swim')
  })

  it('maps strength keywords (strength, lift, gym) → strength', () => {
    expect(classifySport({ type: 'Strength: Squat 5x5' })).toBe('strength')
    expect(classifySport({ type: 'Heavy lifts' })).toBe('strength')
    expect(classifySport({ type: 'Gym A session' })).toBe('strength')
  })

  it('maps run/jog → run', () => {
    expect(classifySport({ type: 'Easy run' })).toBe('run')
    expect(classifySport({ type: 'Morning jog' })).toBe('run')
  })

  it('maps unknown sessions → other', () => {
    expect(classifySport({ type: 'Yoga flow' })).toBe('other')
    expect(classifySport({ type: 'Mobility' })).toBe('other')
    expect(classifySport(null)).toBe('other')
    expect(classifySport(undefined)).toBe('other')
  })

  it('prefers bike over run when both keywords present (bike checked first)', () => {
    // contrived mixed string — confirms classifier precedence
    expect(classifySport({ type: 'Brick: bike + run' })).toBe('bike')
  })
})

// ─── analyzeCrossSportRecoveryGap — gating ──────────────────────────────────
describe('analyzeCrossSportRecoveryGap — empty/null gating', () => {
  it('returns null for null log', () => {
    expect(analyzeCrossSportRecoveryGap({ log: null, today: TODAY })).toBe(null)
  })

  it('returns null for empty log', () => {
    expect(analyzeCrossSportRecoveryGap({ log: [], today: TODAY })).toBe(null)
  })

  it('returns null when only "other" sessions exist (no tracked sport ever logged)', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'Yoga' },
      { date: isoMinusDays(TODAY, 4), type: 'Mobility' },
    ]
    expect(analyzeCrossSportRecoveryGap({ log, today: TODAY })).toBe(null)
  })

  it('skips entries with invalid dates', () => {
    const log = [
      { date: 'not-a-date', type: 'run' },
      { date: '', type: 'bike' },
    ]
    expect(analyzeCrossSportRecoveryGap({ log, today: TODAY })).toBe(null)
  })

  it('ignores future-dated entries', () => {
    const log = [
      { date: isoMinusDays(TODAY, -5), type: 'run' }, // 5d in the future
    ]
    expect(analyzeCrossSportRecoveryGap({ log, today: TODAY })).toBe(null)
  })
})

// ─── analyzeCrossSportRecoveryGap — status classification ───────────────────
describe('analyzeCrossSportRecoveryGap — status per sport', () => {
  it('classifies FRESH when daysSince ≤ idealMaxDays', () => {
    // run: ideal-max = 3 → daysSince = 2 → FRESH
    // bike: ideal-max = 2 → daysSince = 1 → FRESH
    const log = [
      { date: isoMinusDays(TODAY, 2), type: 'Easy run' },
      { date: isoMinusDays(TODAY, 1), type: 'Bike Z2' },
    ]
    const r = analyzeCrossSportRecoveryGap({ log, today: TODAY })
    expect(r).not.toBeNull()
    const run  = r.sports.find((s) => s.key === 'run')
    const bike = r.sports.find((s) => s.key === 'bike')
    expect(run.status).toBe('FRESH')
    expect(run.daysSince).toBe(2)
    expect(bike.status).toBe('FRESH')
    expect(bike.daysSince).toBe(1)
  })

  it('classifies OK when ideal-max < daysSince ≤ warn', () => {
    // swim: ideal-max=4, warn=14 → daysSince=10 → OK
    // strength: ideal-max=4, warn=14 → daysSince=7 → OK
    const log = [
      { date: isoMinusDays(TODAY, 10), type: 'Swim drills' },
      { date: isoMinusDays(TODAY, 7),  type: 'Gym squats' },
    ]
    const r = analyzeCrossSportRecoveryGap({ log, today: TODAY })
    const swim     = r.sports.find((s) => s.key === 'swim')
    const strength = r.sports.find((s) => s.key === 'strength')
    expect(swim.status).toBe('OK')
    expect(swim.daysSince).toBe(10)
    expect(strength.status).toBe('OK')
    expect(strength.daysSince).toBe(7)
  })

  it('classifies STALE when daysSince > warn', () => {
    // run: warn=14 → daysSince=30 → STALE
    // bike: warn=21 → daysSince=40 → STALE
    const log = [
      { date: isoMinusDays(TODAY, 30), type: 'run' },
      { date: isoMinusDays(TODAY, 40), type: 'bike' },
    ]
    const r = analyzeCrossSportRecoveryGap({ log, today: TODAY })
    const run  = r.sports.find((s) => s.key === 'run')
    const bike = r.sports.find((s) => s.key === 'bike')
    expect(run.status).toBe('STALE')
    expect(run.daysSince).toBe(30)
    expect(bike.status).toBe('STALE')
    expect(bike.daysSince).toBe(40)
  })

  it('omits NEVER sports from the displayed list (run-only log → only run row)', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'Easy run' },
      { date: isoMinusDays(TODAY, 5), type: 'Long run' },
    ]
    const r = analyzeCrossSportRecoveryGap({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.sports.map((s) => s.key)).toEqual(['run'])
    // run is FRESH (daysSince=1 ≤ idealMax=3) … and no NEVER rows leak through
    expect(r.sports.every((s) => s.status !== 'NEVER')).toBe(true)
  })

  it('keeps the most recent session date per sport when duplicates exist', () => {
    const log = [
      { date: isoMinusDays(TODAY, 8),  type: 'run' }, // older
      { date: isoMinusDays(TODAY, 2),  type: 'run' }, // most recent
      { date: isoMinusDays(TODAY, 15), type: 'run' }, // oldest
    ]
    const r = analyzeCrossSportRecoveryGap({ log, today: TODAY })
    const run = r.sports.find((s) => s.key === 'run')
    expect(run.daysSince).toBe(2)
    expect(run.lastDate).toBe(isoMinusDays(TODAY, 2))
  })

  it('mixes sports correctly — classifier maps each entry to the right bucket', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1),  type: 'Easy run' },       // run FRESH
      { date: isoMinusDays(TODAY, 1),  type: 'Indoor cycling' }, // bike FRESH
      { date: isoMinusDays(TODAY, 8),  type: 'Open water swim' },// swim OK
      { date: isoMinusDays(TODAY, 30), type: 'Gym A' },          // strength STALE
      { date: isoMinusDays(TODAY, 2),  type: 'Yoga flow' },      // other — ignored
    ]
    const r = analyzeCrossSportRecoveryGap({ log, today: TODAY })
    expect(r).not.toBeNull()
    const byKey = Object.fromEntries(r.sports.map((s) => [s.key, s]))
    expect(byKey.run.status).toBe('FRESH')
    expect(byKey.bike.status).toBe('FRESH')
    expect(byKey.swim.status).toBe('OK')
    expect(byKey.strength.status).toBe('STALE')
  })

  it('exposes idealMaxDays + warnDays per row, matching SPORT_RECOVERY_WINDOWS', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'run' },
      { date: isoMinusDays(TODAY, 1), type: 'bike' },
    ]
    const r = analyzeCrossSportRecoveryGap({ log, today: TODAY })
    for (const row of r.sports) {
      const spec = SPORT_RECOVERY_WINDOWS[row.key]
      expect(row.idealMaxDays).toBe(spec.idealMaxDays)
      expect(row.warnDays).toBe(spec.warnDays)
    }
  })

  it('returns the citation string verbatim', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'run' },
      { date: isoMinusDays(TODAY, 1), type: 'bike' },
    ]
    const r = analyzeCrossSportRecoveryGap({ log, today: TODAY })
    expect(r.citation).toBe(CROSS_SPORT_RECOVERY_GAP_CITATION)
    expect(r.citation).toMatch(/Bompa 2018/)
    expect(r.citation).toMatch(/Hreljac 2004/)
  })
})

// ─── analyzeCrossSportRecoveryGap — boundary cases ──────────────────────────
describe('analyzeCrossSportRecoveryGap — boundary cases', () => {
  it('today-dated session yields daysSince = 0 → FRESH', () => {
    const log = [
      { date: TODAY, type: 'run' },
      { date: isoMinusDays(TODAY, 2), type: 'bike' },
    ]
    const r = analyzeCrossSportRecoveryGap({ log, today: TODAY })
    const run = r.sports.find((s) => s.key === 'run')
    expect(run.daysSince).toBe(0)
    expect(run.status).toBe('FRESH')
  })

  it('right at ideal-max → FRESH; one day past → OK', () => {
    // run idealMaxDays = 3
    const log1 = [
      { date: isoMinusDays(TODAY, 3), type: 'run' },
      { date: isoMinusDays(TODAY, 1), type: 'bike' },
    ]
    const r1 = analyzeCrossSportRecoveryGap({ log: log1, today: TODAY })
    expect(r1.sports.find((s) => s.key === 'run').status).toBe('FRESH')

    const log2 = [
      { date: isoMinusDays(TODAY, 4), type: 'run' },
      { date: isoMinusDays(TODAY, 1), type: 'bike' },
    ]
    const r2 = analyzeCrossSportRecoveryGap({ log: log2, today: TODAY })
    expect(r2.sports.find((s) => s.key === 'run').status).toBe('OK')
  })

  it('right at warn boundary → OK; one day past → STALE', () => {
    // run warnDays = 14
    const log1 = [
      { date: isoMinusDays(TODAY, 14), type: 'run' },
      { date: isoMinusDays(TODAY, 1),  type: 'bike' },
    ]
    expect(
      analyzeCrossSportRecoveryGap({ log: log1, today: TODAY })
        .sports.find((s) => s.key === 'run').status
    ).toBe('OK')

    const log2 = [
      { date: isoMinusDays(TODAY, 15), type: 'run' },
      { date: isoMinusDays(TODAY, 1),  type: 'bike' },
    ]
    expect(
      analyzeCrossSportRecoveryGap({ log: log2, today: TODAY })
        .sports.find((s) => s.key === 'run').status
    ).toBe('STALE')
  })
})
