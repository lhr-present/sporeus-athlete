// E130
import { describe, it, expect } from 'vitest'
import { detectDetraining } from '../../athlete/detrainingDetector.js'

const TODAY = '2026-04-30'

// ─── Helpers ────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build a log of `count` consecutive daily entries ending on `endDate`.
 */
function makeDailyLog(count, endDate) {
  const log = []
  for (let i = count - 1; i >= 0; i--) {
    log.push({ date: addDays(endDate, -i), type: 'run', tss: 50, duration: 60 })
  }
  return log
}

/**
 * Build a log split by a gap: `before` consecutive days, then `gap` rest days,
 * then `after` consecutive days, ending on `endDate`.
 */
function makeGappedLog(before, gap, after, endDate) {
  const log = []
  // After block ends on endDate
  for (let i = after - 1; i >= 0; i--) {
    log.push({ date: addDays(endDate, -i), type: 'run', tss: 50, duration: 60 })
  }
  // Last day of "before" block is at endDate - after - gap
  const beforeEnd = addDays(endDate, -(after + gap))
  for (let i = before - 1; i >= 0; i--) {
    log.push({ date: addDays(beforeEnd, -i), type: 'run', tss: 50, duration: 60 })
  }
  return log
}

// ─── Empty / null inputs ────────────────────────────────────────────────────
describe('detectDetraining — empty / null inputs', () => {
  it('null log → safe defaults, reliable: false', () => {
    const r = detectDetraining(null, TODAY)
    expect(r.gaps).toEqual([])
    expect(r.currentGap).toBe(0)
    expect(r.inActiveGap).toBe(false)
    expect(r.activeSeverity).toBe(null)
    expect(r.recommendation).toEqual({ en: '', tr: '' })
    expect(r.reliable).toBe(false)
    expect(r.citation).toBe('Mujika & Padilla 2000')
  })

  it('empty log → safe defaults, reliable: false', () => {
    const r = detectDetraining([], TODAY)
    expect(r.gaps).toEqual([])
    expect(r.currentGap).toBe(0)
    expect(r.inActiveGap).toBe(false)
    expect(r.activeSeverity).toBe(null)
    expect(r.recommendation).toEqual({ en: '', tr: '' })
    expect(r.reliable).toBe(false)
  })

  it('log with < 14 entries → reliable: false', () => {
    const log = makeDailyLog(10, TODAY)
    const r = detectDetraining(log, TODAY)
    expect(r.reliable).toBe(false)
  })

  it('log with exactly 14 entries → reliable: true', () => {
    const log = makeDailyLog(14, TODAY)
    const r = detectDetraining(log, TODAY)
    expect(r.reliable).toBe(true)
  })
})

// ─── No-gap scenarios ───────────────────────────────────────────────────────
describe('detectDetraining — no gaps', () => {
  it('30-day daily log → gaps: [], inActiveGap: false', () => {
    const log = makeDailyLog(30, TODAY)
    const r = detectDetraining(log, TODAY)
    expect(r.gaps).toEqual([])
    expect(r.inActiveGap).toBe(false)
    expect(r.currentGap).toBe(0)
    expect(r.activeSeverity).toBe(null)
  })

  it('inActiveGap=false when last session was today', () => {
    const log = makeDailyLog(20, TODAY)
    const r = detectDetraining(log, TODAY)
    expect(r.currentGap).toBe(0)
    expect(r.inActiveGap).toBe(false)
  })

  it('inActiveGap=false when last session was 5 days ago', () => {
    const log = makeDailyLog(20, addDays(TODAY, -5))
    const r = detectDetraining(log, TODAY)
    expect(r.currentGap).toBe(5)
    expect(r.inActiveGap).toBe(false)
    expect(r.activeSeverity).toBe(null)
  })
})

// ─── Active trailing-edge gap (current gap to today) ────────────────────────
describe('detectDetraining — active trailing-edge gap', () => {
  it('inActiveGap=true when last session was 10 days ago → minor', () => {
    const log = makeDailyLog(20, addDays(TODAY, -10))
    const r = detectDetraining(log, TODAY)
    expect(r.currentGap).toBe(10)
    expect(r.inActiveGap).toBe(true)
    expect(r.activeSeverity).toBe('minor')
  })

  it('14-day current gap → moderate', () => {
    const log = makeDailyLog(20, addDays(TODAY, -14))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('moderate')
  })

  it('30-day current gap → major', () => {
    const log = makeDailyLog(20, addDays(TODAY, -30))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('major')
  })

  it('50-day current gap → severe', () => {
    const log = makeDailyLog(20, addDays(TODAY, -50))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('severe')
  })
})

// ─── Boundary cases ─────────────────────────────────────────────────────────
describe('detectDetraining — severity boundaries', () => {
  it('exact 7-day gap → minor', () => {
    const log = makeDailyLog(20, addDays(TODAY, -7))
    const r = detectDetraining(log, TODAY)
    expect(r.currentGap).toBe(7)
    expect(r.activeSeverity).toBe('minor')
  })

  it('13-day gap → minor', () => {
    const log = makeDailyLog(20, addDays(TODAY, -13))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('minor')
  })

  it('14-day gap → moderate (≥14)', () => {
    const log = makeDailyLog(20, addDays(TODAY, -14))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('moderate')
  })

  it('21-day gap → moderate', () => {
    const log = makeDailyLog(20, addDays(TODAY, -21))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('moderate')
  })

  it('22-day gap → major (≥22)', () => {
    const log = makeDailyLog(20, addDays(TODAY, -22))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('major')
  })

  it('42-day gap → major', () => {
    const log = makeDailyLog(20, addDays(TODAY, -42))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('major')
  })

  it('43-day gap → severe (≥43)', () => {
    const log = makeDailyLog(20, addDays(TODAY, -43))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('severe')
  })
})

// ─── Historical gaps (interior) ─────────────────────────────────────────────
describe('detectDetraining — historical gaps', () => {
  it('detects single 10-day interior gap (minor)', () => {
    // 10 days training, 10 rest days, 10 days training, ending today
    const log = makeGappedLog(10, 10, 10, TODAY)
    const r = detectDetraining(log, TODAY)
    expect(r.inActiveGap).toBe(false)
    expect(r.gaps.length).toBe(1)
    expect(r.gaps[0].durationDays).toBe(10)
    expect(r.gaps[0].severity).toBe('minor')
  })

  it('detects multiple historical gaps', () => {
    // Build log with two distinct gaps:
    //   block A (5 days), gap 8 days, block B (5 days), gap 20 days, block C (5 days) ending today
    const log = []
    // Block C: ends today, 5 days
    for (let i = 4; i >= 0; i--) log.push({ date: addDays(TODAY, -i), type: 'run', tss: 50 })
    // Gap of 20 days before block C
    const blockBEnd = addDays(TODAY, -25)
    for (let i = 4; i >= 0; i--) log.push({ date: addDays(blockBEnd, -i), type: 'run', tss: 50 })
    // Gap of 8 days before block B
    const blockAEnd = addDays(blockBEnd, -(5 + 8))
    for (let i = 4; i >= 0; i--) log.push({ date: addDays(blockAEnd, -i), type: 'run', tss: 50 })

    const r = detectDetraining(log, TODAY)
    expect(r.gaps.length).toBe(2)
    const durations = r.gaps.map(g => g.durationDays).sort((a, b) => a - b)
    expect(durations).toEqual([8, 20])
    const severities = r.gaps.map(g => g.severity)
    expect(severities).toContain('minor')
    expect(severities).toContain('moderate')
    expect(r.inActiveGap).toBe(false)
  })

  it('long historical gap inside log is detected even when current gap is 0', () => {
    // 60-day historical gap inside the log
    const log = makeGappedLog(20, 60, 20, TODAY)
    const r = detectDetraining(log, TODAY)
    expect(r.inActiveGap).toBe(false)
    expect(r.gaps.length).toBe(1)
    expect(r.gaps[0].durationDays).toBe(60)
    expect(r.gaps[0].severity).toBe('severe')
  })
})

// ─── Recommendation behavior ────────────────────────────────────────────────
describe('detectDetraining — recommendation', () => {
  it('recommendation empty when inActiveGap=false', () => {
    const log = makeDailyLog(20, TODAY)
    const r = detectDetraining(log, TODAY)
    expect(r.recommendation).toEqual({ en: '', tr: '' })
  })

  it('recommendation non-empty bilingual when inActiveGap=true', () => {
    const log = makeDailyLog(20, addDays(TODAY, -10))
    const r = detectDetraining(log, TODAY)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('minor active gap recommendation references easy ramp', () => {
    const log = makeDailyLog(20, addDays(TODAY, -10))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('minor')
    expect(r.recommendation.en).toMatch(/ramp|easy/i)
    expect(r.recommendation.tr).toMatch(/rampa|kolay/i)
  })

  it('severe active gap recommendation mentions 50% / restart', () => {
    const log = makeDailyLog(20, addDays(TODAY, -50))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('severe')
    expect(r.recommendation.en).toMatch(/50%/)
    expect(r.recommendation.tr).toMatch(/%50/)
  })
})

// ─── Shape / contract ───────────────────────────────────────────────────────
describe('detectDetraining — return shape', () => {
  it('result has all 7 expected keys', () => {
    const r = detectDetraining([], TODAY)
    const keys = Object.keys(r).sort()
    expect(keys).toEqual([
      'activeSeverity',
      'citation',
      'currentGap',
      'gaps',
      'inActiveGap',
      'recommendation',
      'reliable',
    ])
  })

  it('citation field is "Mujika & Padilla 2000"', () => {
    const r = detectDetraining([], TODAY)
    expect(r.citation).toBe('Mujika & Padilla 2000')
  })

  it('every gap object has required fields', () => {
    const log = makeGappedLog(10, 15, 10, TODAY)
    const r = detectDetraining(log, TODAY)
    expect(r.gaps.length).toBeGreaterThan(0)
    for (const g of r.gaps) {
      expect(typeof g.startDate).toBe('string')
      expect(typeof g.endDate).toBe('string')
      expect(typeof g.durationDays).toBe('number')
      expect(['minor', 'moderate', 'major', 'severe']).toContain(g.severity)
      expect(typeof g.description.en).toBe('string')
      expect(typeof g.description.tr).toBe('string')
      expect(g.description.en.length).toBeGreaterThan(0)
      expect(g.description.tr.length).toBeGreaterThan(0)
    }
  })
})

// ─── Bilingual coverage ─────────────────────────────────────────────────────
describe('detectDetraining — bilingual recommendations per severity', () => {
  it('minor → EN + TR non-empty', () => {
    const log = makeDailyLog(20, addDays(TODAY, -10))
    const r = detectDetraining(log, TODAY)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('moderate → EN + TR non-empty', () => {
    const log = makeDailyLog(20, addDays(TODAY, -18))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('moderate')
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('major → EN + TR non-empty', () => {
    const log = makeDailyLog(20, addDays(TODAY, -30))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('major')
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('severe → EN + TR non-empty', () => {
    const log = makeDailyLog(20, addDays(TODAY, -60))
    const r = detectDetraining(log, TODAY)
    expect(r.activeSeverity).toBe('severe')
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })
})

// ─── Edge cases ─────────────────────────────────────────────────────────────
describe('detectDetraining — edge cases', () => {
  it('same-day duplicate sessions do not create false gaps', () => {
    // 20 daily entries with each date duplicated
    const log = []
    for (let i = 19; i >= 0; i--) {
      const d = addDays(TODAY, -i)
      log.push({ date: d, type: 'run', tss: 50 })
      log.push({ date: d, type: 'bike', tss: 40 })
    }
    const r = detectDetraining(log, TODAY)
    expect(r.gaps).toEqual([])
    expect(r.inActiveGap).toBe(false)
    expect(r.currentGap).toBe(0)
  })

  it('ignores entries dated in the future (after today)', () => {
    const log = makeDailyLog(20, addDays(TODAY, -10))
    // Add a stray future date — should be ignored
    log.push({ date: addDays(TODAY, 5), type: 'run', tss: 50 })
    const r = detectDetraining(log, TODAY)
    expect(r.currentGap).toBe(10)
    expect(r.inActiveGap).toBe(true)
    expect(r.activeSeverity).toBe('minor')
  })

  it('handles unsorted log entries', () => {
    const log = makeDailyLog(20, addDays(TODAY, -10))
    // Shuffle deterministically by reversing
    log.reverse()
    const r = detectDetraining(log, TODAY)
    expect(r.currentGap).toBe(10)
    expect(r.inActiveGap).toBe(true)
  })
})
