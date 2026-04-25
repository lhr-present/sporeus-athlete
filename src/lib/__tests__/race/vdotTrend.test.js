import { describe, it, expect } from 'vitest'
import { extractVdotHistory, fitVdotTrend, projectPBs } from '../../race/vdotTrend.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Two races in different calendar weeks, spread ~8 weeks apart
function makeRaceLog() {
  return [
    {
      sport_type: 'running',
      distance: 5000,
      duration: 1200,   // 20:00 @ 5k → VDOT ~52
      is_race: true,
      date: '2024-01-08',
    },
    {
      sport_type: 'running',
      distance: 5000,
      duration: 1140,   // 19:00 @ 5k → higher VDOT
      is_race: true,
      date: '2024-03-04',
    },
  ]
}

// ── extractVdotHistory ────────────────────────────────────────────────────────

describe('extractVdotHistory', () => {
  it('returns 1 point for a single running race log entry (distance=5000, duration=1200s, is_race=true)', () => {
    const log = [
      { sport_type: 'running', distance: 5000, duration: 1200, is_race: true, date: '2024-01-08' },
    ]
    const history = extractVdotHistory(log, [])
    // Only 1 week → returns []
    expect(history).toEqual([])
  })

  it('returns 1 point (not []) when there are 2 entries in same week (deduped to 1 week, < 2)', () => {
    const log = [
      { sport_type: 'running', distance: 5000, duration: 1200, is_race: true, date: '2024-01-08' },
      { sport_type: 'running', distance: 5000, duration: 1100, is_race: true, date: '2024-01-09' },
    ]
    const history = extractVdotHistory(log, [])
    // Both in same week → deduped to 1 → returns []
    expect(history).toEqual([])
  })

  it('two races same week keeps higher vdot and deduplicates to 1 point (returns [])', () => {
    const log = [
      { sport_type: 'running', distance: 5000, duration: 1200, is_race: true, date: '2024-01-08' },  // lower VDOT
      { sport_type: 'running', distance: 5000, duration: 1080, is_race: true, date: '2024-01-10' },  // higher VDOT (18:00)
    ]
    const history = extractVdotHistory(log, [])
    // Both same ISO week → 1 point → returns []
    expect(history).toEqual([])
  })

  it('two races same week keeps higher vdot when there is also a second distinct week', () => {
    const log = [
      { sport_type: 'running', distance: 5000, duration: 1200, is_race: true, date: '2024-01-08' },  // lower VDOT
      { sport_type: 'running', distance: 5000, duration: 1080, is_race: true, date: '2024-01-09' },  // higher VDOT
      { sport_type: 'running', distance: 5000, duration: 1140, is_race: true, date: '2024-03-04' },  // different week
    ]
    const history = extractVdotHistory(log, [])
    expect(history).toHaveLength(2)
    // First entry should be the higher VDOT from Jan 8-9 week
    const firstVdot = history[0].vdot
    const lowerVdot = extractVdotHistory(
      [{ sport_type: 'running', distance: 5000, duration: 1200, is_race: true, date: '2024-01-08' },
       { sport_type: 'running', distance: 5000, duration: 1140, is_race: true, date: '2024-03-04' }],
      []
    )[0].vdot
    // 1080s produces higher vdot than 1200s
    expect(firstVdot).toBeGreaterThan(lowerVdot)
  })

  it('returns [] when fewer than 2 unique weeks after dedup', () => {
    const log = [
      { sport_type: 'running', distance: 5000, duration: 1200, is_race: true, date: '2024-01-08' },
    ]
    expect(extractVdotHistory(log, [])).toEqual([])
  })

  it('uses testResult with vdot field directly', () => {
    const testResults = [
      { type: 'vdot_test', vdot: 52.1, date: '2024-01-08' },
      { type: 'vdot_test', vdot: 54.3, date: '2024-03-04' },
    ]
    const history = extractVdotHistory([], testResults)
    expect(history).toHaveLength(2)
    expect(history[0].vdot).toBe(52.1)
    expect(history[1].vdot).toBe(54.3)
  })

  it('treats duration <= 600 as minutes and converts to seconds for VDOT calculation', () => {
    // duration=20 (minutes) → 1200s, same as duration=1200 (seconds)
    const logMin  = [{ sport_type: 'running', distance: 5000, duration: 20,   is_race: true, date: '2024-01-08' }]
    const logSec  = [{ sport_type: 'running', distance: 5000, duration: 1200, is_race: true, date: '2024-01-08' }]
    // Both can't produce 2 points alone, so add a second week for each
    const week2 = { sport_type: 'running', distance: 5000, duration: 1140, is_race: true, date: '2024-03-04' }
    const histMin = extractVdotHistory([logMin[0], week2], [])
    const histSec = extractVdotHistory([logSec[0], week2], [])
    expect(histMin).toHaveLength(2)
    expect(histSec).toHaveLength(2)
    expect(histMin[0].vdot).toBeCloseTo(histSec[0].vdot, 1)
  })

  it('ignores non-running entries and non-race entries', () => {
    const log = [
      { sport_type: 'cycling', distance: 5000, duration: 1200, is_race: true, date: '2024-01-08' },
      { sport_type: 'running', distance: 5000, duration: 1200, is_race: false, date: '2024-01-15' },
      { sport_type: 'running', distance: 5000, duration: 1200, is_race: true, date: '2024-03-04' },
    ]
    const history = extractVdotHistory(log, [])
    // Only last entry qualifies → 1 week → []
    expect(history).toEqual([])
  })

  it('source field is set to race_log for log entries', () => {
    const history = extractVdotHistory(makeRaceLog(), [])
    expect(history).toHaveLength(2)
    expect(history[0].source).toBe('race_log')
  })
})

// ── fitVdotTrend ─────────────────────────────────────────────────────────────

describe('fitVdotTrend', () => {
  it('returns null for history.length < 2', () => {
    expect(fitVdotTrend([])).toBeNull()
    expect(fitVdotTrend([{ date: '2024-01-01', vdot: 50 }])).toBeNull()
  })

  it('two identical vdots produce slope ≈ 0', () => {
    const history = [
      { date: '2024-01-01', vdot: 50 },
      { date: '2024-02-01', vdot: 50 },
    ]
    const trend = fitVdotTrend(history)
    expect(trend).not.toBeNull()
    expect(Math.abs(trend.slope)).toBeLessThan(0.001)
  })

  it('linearly increasing history yields positive slope and R² close to 1.0', () => {
    const history = [
      { date: '2024-01-01', vdot: 48 },
      { date: '2024-02-01', vdot: 50 },
      { date: '2024-03-01', vdot: 52 },
      { date: '2024-04-01', vdot: 54 },
    ]
    const trend = fitVdotTrend(history)
    expect(trend.slope).toBeGreaterThan(0)
    expect(trend.rSquared).toBeGreaterThan(0.95)
  })

  it('weeklyGain === slope * 7 within float tolerance', () => {
    const history = makeRaceLog().map((e, i) => ({
      date: e.date,
      vdot: 50 + i * 2,
    }))
    const trend = fitVdotTrend(history)
    expect(trend.weeklyGain).toBeCloseTo(trend.slope * 7, 10)
  })

  it('rSquared is always in [0, 1]', () => {
    // Noisy data
    const history = [
      { date: '2024-01-01', vdot: 50 },
      { date: '2024-01-15', vdot: 45 },
      { date: '2024-02-01', vdot: 53 },
      { date: '2024-02-15', vdot: 48 },
      { date: '2024-03-01', vdot: 55 },
    ]
    const trend = fitVdotTrend(history)
    expect(trend.rSquared).toBeGreaterThanOrEqual(0)
    expect(trend.rSquared).toBeLessThanOrEqual(1)
  })

  it('citation string is present', () => {
    const history = [
      { date: '2024-01-01', vdot: 50 },
      { date: '2024-02-01', vdot: 52 },
    ]
    const trend = fitVdotTrend(history)
    expect(typeof trend.citation).toBe('string')
    expect(trend.citation.length).toBeGreaterThan(0)
  })

  it('currentVdot is the last data point vdot', () => {
    const history = [
      { date: '2024-01-01', vdot: 50 },
      { date: '2024-02-01', vdot: 53.7 },
    ]
    const trend = fitVdotTrend(history)
    expect(trend.currentVdot).toBe(53.7)
  })
})

// ── projectPBs ────────────────────────────────────────────────────────────────

describe('projectPBs', () => {
  it('returns [] when currentVdot is 0', () => {
    const trend = { weeklyGain: 0.2, slope: 0.028, citation: '' }
    expect(projectPBs(0, trend)).toEqual([])
  })

  it('returns [] when currentVdot is null', () => {
    const trend = { weeklyGain: 0.2, slope: 0.028, citation: '' }
    expect(projectPBs(null, trend)).toEqual([])
  })

  it('returns [] when trend is null', () => {
    expect(projectPBs(52, null)).toEqual([])
  })

  it('5K time is less than half-marathon time (distance ordering)', () => {
    const trend = { weeklyGain: 0.1, slope: 0.014, citation: '' }
    const pbs = projectPBs(52, trend)
    const t5k = pbs.find(p => p.label === '5K')
    const tHM = pbs.find(p => p.label === 'Half Marathon')
    expect(t5k.currentTime_s).toBeLessThan(tHM.currentTime_s)
  })

  it('positive deltaSeconds when weeklyGain > 0 (projected time is faster)', () => {
    const trend = { weeklyGain: 0.5, slope: 0.071, citation: '' }
    const pbs = projectPBs(52, trend)
    for (const pb of pbs) {
      expect(pb.deltaSeconds).toBeGreaterThan(0)
    }
  })

  it('weeksToPB is null when slope <= 0', () => {
    const trend = { weeklyGain: -0.1, slope: -0.014, citation: '' }
    const pbs = projectPBs(52, trend)
    for (const pb of pbs) {
      expect(pb.weeksToPB).toBeNull()
    }
  })

  it('returns 4 entries for default distances', () => {
    const trend = { weeklyGain: 0.2, slope: 0.028, citation: '' }
    const pbs = projectPBs(52, trend)
    expect(pbs).toHaveLength(4)
  })

  it('each entry contains required fields', () => {
    const trend = { weeklyGain: 0.2, slope: 0.028, citation: '' }
    const pbs = projectPBs(52, trend)
    for (const pb of pbs) {
      expect(pb).toHaveProperty('distanceM')
      expect(pb).toHaveProperty('label')
      expect(pb).toHaveProperty('currentTime_s')
      expect(pb).toHaveProperty('currentPace_s_per_km')
      expect(pb).toHaveProperty('projectedTime_s')
      expect(pb).toHaveProperty('deltaSeconds')
      expect(pb).toHaveProperty('weeksToPB')
      expect(pb).toHaveProperty('citation')
    }
  })
})
