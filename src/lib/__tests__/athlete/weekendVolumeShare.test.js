// ─── weekendVolumeShare.test.js — pure-fn tests for weekend-warrior detector ─
import { describe, it, expect } from 'vitest'
import {
  computeWeekendVolumeShare,
  WEEKEND_VOLUME_SHARE_CITATION,
} from '../../athlete/weekendVolumeShare.js'

// 2026-05-17 is a Sunday (verified). 4-week window = Mon 2026-04-20 → Sun 2026-05-17.
const TODAY = '2026-05-17'

// Week start (Mon) date strings inside the trailing 4-week window.
const WEEKS = [
  '2026-04-20', // Mon week 1 (oldest)
  '2026-04-27', // Mon week 2
  '2026-05-04', // Mon week 3
  '2026-05-11', // Mon week 4 (current)
]

// Helper to build an entry on a specific weekday offset (0=Mon..6=Sun) of a given week.
function entry(weekIdx, dayOffset, durationMin, extra = {}) {
  const base = new Date(WEEKS[weekIdx] + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() + dayOffset)
  const date = base.toISOString().slice(0, 10)
  return { date, duration: durationMin, type: 'run', ...extra }
}

describe('computeWeekendVolumeShare — citation', () => {
  it('exports a Soligard 2016 + Lambert 1997 citation string', () => {
    expect(WEEKEND_VOLUME_SHARE_CITATION).toMatch(/Soligard 2016/)
    expect(WEEKEND_VOLUME_SHARE_CITATION).toMatch(/Lambert 1997/)
  })
})

describe('computeWeekendVolumeShare — null gates', () => {
  it('(a) empty log → null', () => {
    expect(computeWeekendVolumeShare({ log: [], today: TODAY })).toBeNull()
    expect(computeWeekendVolumeShare({ log: null, today: TODAY })).toBeNull()
    expect(computeWeekendVolumeShare({ log: undefined, today: TODAY })).toBeNull()
  })

  it('(b) less than 2 weeks of data → null', () => {
    // 4 sessions all on week 4 → only 1 distinct week
    const log = [
      entry(3, 0, 60), entry(3, 2, 60),
      entry(3, 5, 90), entry(3, 6, 90),
    ]
    expect(computeWeekendVolumeShare({ log, today: TODAY })).toBeNull()
  })

  it('(c) fewer than 3 sessions per week (avg) → null', () => {
    // 2 sessions/week across 4 weeks across multiple weeks = 8 sessions / 4 = 2 per week
    const log = [
      entry(0, 0, 60), entry(0, 5, 60),
      entry(1, 0, 60), entry(1, 5, 60),
      entry(2, 0, 60), entry(2, 5, 60),
      entry(3, 0, 60), entry(3, 5, 60),
    ]
    expect(computeWeekendVolumeShare({ log, today: TODAY })).toBeNull()
  })

  it('non-string today → null', () => {
    const log = [entry(0, 0, 60), entry(0, 5, 60), entry(0, 6, 60)]
    expect(computeWeekendVolumeShare({ log, today: null })).toBeNull()
  })

  it('all out-of-window entries → null', () => {
    const log = [
      { date: '2026-01-01', duration: 60, type: 'run' },
      { date: '2026-01-08', duration: 60, type: 'run' },
    ]
    expect(computeWeekendVolumeShare({ log, today: TODAY })).toBeNull()
  })
})

describe('computeWeekendVolumeShare — band classification', () => {
  it('(d) balanced distribution (~36% weekend) → band=BALANCED', () => {
    // Per week: 60 Mon + 60 Wed + 60 Fri (weekday 180), 60 Sun (weekend 60)
    // share = 60 / 240 = 25% — well below 40 → BALANCED
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(entry(w, 0, 60))    // Mon
      log.push(entry(w, 2, 60))    // Wed
      log.push(entry(w, 4, 60))    // Fri
      log.push(entry(w, 6, 60))    // Sun
    }
    const r = computeWeekendVolumeShare({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('BALANCED')
    expect(r.sharePct).toBeLessThan(40)
    expect(r.weekdayMin).toBe(720)
    expect(r.weekendMin).toBe(240)
  })

  it('(e) ~50% weekend share → band=WEEKEND_BIASED', () => {
    // Per week: 30 Mon + 30 Wed + 30 Fri (weekday 90), 45 Sat + 45 Sun (weekend 90)
    // share = 90 / 180 = 50%
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(entry(w, 0, 30))    // Mon
      log.push(entry(w, 2, 30))    // Wed
      log.push(entry(w, 4, 30))    // Fri
      log.push(entry(w, 5, 45))    // Sat
      log.push(entry(w, 6, 45))    // Sun
    }
    const r = computeWeekendVolumeShare({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('WEEKEND_BIASED')
    expect(r.sharePct).toBeGreaterThanOrEqual(40)
    expect(r.sharePct).toBeLessThan(55)
  })

  it('(f) ~60% weekend share → band=WEEKEND_WARRIOR', () => {
    // Per week: 20 Mon + 20 Wed + 20 Fri (weekday 60), 45 Sat + 45 Sun (weekend 90)
    // share = 90 / 150 = 60%
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(entry(w, 0, 20))    // Mon
      log.push(entry(w, 2, 20))    // Wed
      log.push(entry(w, 4, 20))    // Fri
      log.push(entry(w, 5, 45))    // Sat
      log.push(entry(w, 6, 45))    // Sun
    }
    const r = computeWeekendVolumeShare({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('WEEKEND_WARRIOR')
    expect(r.sharePct).toBeGreaterThanOrEqual(55)
    expect(r.sharePct).toBeLessThanOrEqual(70)
  })

  it('(g) ~80% weekend share → band=SEVERE', () => {
    // Per week: 10 Mon + 10 Wed + 10 Fri (weekday 30), 60 Sat + 60 Sun (weekend 120)
    // share = 120 / 150 = 80%
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(entry(w, 0, 10))    // Mon
      log.push(entry(w, 2, 10))    // Wed
      log.push(entry(w, 4, 10))    // Fri
      log.push(entry(w, 5, 60))    // Sat
      log.push(entry(w, 6, 60))    // Sun
    }
    const r = computeWeekendVolumeShare({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('SEVERE')
    expect(r.sharePct).toBeGreaterThan(70)
  })
})

describe('computeWeekendVolumeShare — sessionsPerWeek', () => {
  it('(h) sessionsPerWeek correctly averages across the window', () => {
    // 4 sessions/week × 4 weeks = 16 sessions → 4.0/week
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(entry(w, 0, 45))
      log.push(entry(w, 2, 45))
      log.push(entry(w, 4, 45))
      log.push(entry(w, 6, 75))
    }
    const r = computeWeekendVolumeShare({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.sessionsPerWeek).toBeCloseTo(4.0, 1)
  })

  it('returned shape includes weekdayMin, weekendMin, citation', () => {
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(entry(w, 0, 60))    // Mon
      log.push(entry(w, 2, 60))    // Wed
      log.push(entry(w, 5, 120))   // Sat
    }
    const r = computeWeekendVolumeShare({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(typeof r.sharePct).toBe('number')
    expect(typeof r.weekdayMin).toBe('number')
    expect(typeof r.weekendMin).toBe('number')
    expect(typeof r.sessionsPerWeek).toBe('number')
    expect(r.citation).toBe(WEEKEND_VOLUME_SHARE_CITATION)
  })

  it('honors a custom `weeks` parameter (2-week window)', () => {
    // Only put data in weeks 2 & 3 (last 2 weeks). 4 entries / 2 weeks = 2/week → null.
    // Bump to 3+/week to pass the gate.
    const log = []
    for (let w = 2; w < 4; w++) {
      log.push(entry(w, 0, 30))
      log.push(entry(w, 2, 30))
      log.push(entry(w, 5, 60))
      log.push(entry(w, 6, 60))
    }
    const r = computeWeekendVolumeShare({ log, today: TODAY, weeks: 2 })
    expect(r).not.toBeNull()
    expect(r.sessionsPerWeek).toBeCloseTo(4.0, 1)
  })
})
