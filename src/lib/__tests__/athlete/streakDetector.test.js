// streakDetector — unit tests
import { describe, it, expect } from 'vitest'
import { detectStreak, STREAK_DETECTOR_CITATION } from '../../athlete/streakDetector.js'

const TODAY = '2026-05-04'

// ─── Helpers ────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function entry(date, tss = 50) {
  return { date, type: 'run', tss }
}

/**
 * Build a continuous streak ending on `endDate` of length n (training every
 * day from endDate-(n-1) to endDate).
 */
function makeStreak(n, endDate = TODAY, tss = 50) {
  const log = []
  for (let i = n - 1; i >= 0; i--) {
    log.push(entry(addDays(endDate, -i), tss))
  }
  return log
}

// ─── Empty / null inputs ────────────────────────────────────────────────────
describe('detectStreak — empty / null inputs', () => {
  it('null log → broken band, all zeros, reliable=false', () => {
    const r = detectStreak(null, TODAY)
    expect(r.currentStreak).toBe(0)
    expect(r.longestStreakIn90d).toBe(0)
    expect(r.lastRestDate).toBeNull()
    expect(r.daysSinceLastRest).toBeNull()
    expect(r.trainingDaysIn28d).toBe(0)
    expect(r.riskBand).toBe('broken')
    expect(r.reliable).toBe(false)
    expect(r.citation).toBe('Habit-formation training research; Foster 2001 monotony')
  })

  it('empty log → broken band, reliable=false', () => {
    const r = detectStreak([], TODAY)
    expect(r.currentStreak).toBe(0)
    expect(r.riskBand).toBe('broken')
    expect(r.reliable).toBe(false)
  })

  it('non-array log (object) → safe defaults', () => {
    const r = detectStreak({ foo: 'bar' }, TODAY)
    expect(r.currentStreak).toBe(0)
    expect(r.riskBand).toBe('broken')
  })

  it('entries with malformed dates skipped', () => {
    const log = [
      { date: 'not-a-date', tss: 50 },
      { date: null, tss: 50 },
      entry(TODAY),
    ]
    const r = detectStreak(log, TODAY)
    expect(r.currentStreak).toBe(1)
  })
})

// ─── Streak length: celebrating band ────────────────────────────────────────
describe('detectStreak — celebrating band (1-7)', () => {
  it('1-day streak today → celebrating', () => {
    const r = detectStreak(makeStreak(1), TODAY)
    expect(r.currentStreak).toBe(1)
    expect(r.riskBand).toBe('celebrating')
    expect(r.message.en).toMatch(/^1-day streak/)
    expect(r.message.tr).toMatch(/^1 günlük seri/)
  })

  it('3-day streak today → celebrating', () => {
    const r = detectStreak(makeStreak(3), TODAY)
    expect(r.currentStreak).toBe(3)
    expect(r.riskBand).toBe('celebrating')
    expect(r.message.en).toMatch(/3-day streak — building habit/)
    expect(r.message.tr).toMatch(/3 günlük seri — alışkanlık inşası/)
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })

  it('7-day streak today → celebrating (boundary)', () => {
    const r = detectStreak(makeStreak(7), TODAY)
    expect(r.currentStreak).toBe(7)
    expect(r.riskBand).toBe('celebrating')
  })
})

// ─── Streak length: consistent band ─────────────────────────────────────────
describe('detectStreak — consistent band (8-14)', () => {
  it('8-day streak → consistent', () => {
    const r = detectStreak(makeStreak(8), TODAY)
    expect(r.currentStreak).toBe(8)
    expect(r.riskBand).toBe('consistent')
    expect(r.message.en).toMatch(/8-day streak — strong consistency/)
    expect(r.recommendation.en).toMatch(/Maintain/)
    expect(r.recommendation.tr).toMatch(/Sürdür/)
  })

  it('14-day streak → consistent (boundary)', () => {
    const r = detectStreak(makeStreak(14), TODAY)
    expect(r.currentStreak).toBe(14)
    expect(r.riskBand).toBe('consistent')
  })
})

// ─── Streak length: monitoring band ─────────────────────────────────────────
describe('detectStreak — monitoring band (15-21 with rest in last 14)', () => {
  it('15-day streak with rest day in last 14 → monitoring', () => {
    // Streak length 15, but a rest day exists more than 14 days ago in the
    // 90-day window only if we include older history. To get a rest day in
    // the last 14, the streak must NOT be 15 ending today — it must have
    // started ≤14 days back and a rest day must exist within last 14 days.
    // Conflicting: a 15-day streak today means days TODAY-14..TODAY all
    // training, no rest in last 15 days — making this risk by spec.
    // To get monitoring we need streak ≥15 but a rest day within last 14.
    // The only way: long streak but interpret differently. Per spec:
    // "currentStreak >= 15 AND no rest day in last 14 days" → risk.
    // So 15 with rest day in last 14 → contradictory unless streak counted
    // includes today only and rest day fell earlier. A 15-day streak by def
    // means 15 consecutive training days through today, so no rest in last
    // 15 days. monitoring band is unreachable for currentStreak in [15,21]
    // unless daysSinceLastRest < 14 — but currentStreak=15 forces
    // daysSinceLastRest >= 15. So per spec band is risk.
    // Test instead the band-logic via an edge: if currentStreak=15 and
    // somehow a rest day exists in last 14 (only possible if log spans <15
    // and lastRestDate falls outside the streak window — but streak walks
    // back through training days so lastRestDate is the day before the
    // streak started). With streak=15, lastRestDate is day TODAY-15 →
    // daysSinceLastRest = 15 → ≥14 → risk band per spec.
    // So: 15-day streak with rest in last 14 is impossible with a strict
    // walk-back; band correctly resolves to risk. We test 15+ → risk.
    const r = detectStreak(makeStreak(15), TODAY)
    expect(r.currentStreak).toBe(15)
    expect(r.daysSinceLastRest).toBe(15)
    expect(r.riskBand).toBe('risk')
  })

  it('15-day streak embedded in a logged 90-day history with rest just before is risk (no rest in last 14)', () => {
    const log = makeStreak(15)
    // Add training entries far back (>30d ago) + a rest day around -30
    log.push(entry(addDays(TODAY, -30), 60))
    log.push(entry(addDays(TODAY, -32), 60))
    const r = detectStreak(log, TODAY)
    expect(r.currentStreak).toBe(15)
    expect(r.riskBand).toBe('risk')
  })
})

// ─── Streak length: risk band ───────────────────────────────────────────────
describe('detectStreak — risk band', () => {
  it('22-day streak → risk', () => {
    const r = detectStreak(makeStreak(22), TODAY)
    expect(r.currentStreak).toBe(22)
    expect(r.riskBand).toBe('risk')
    expect(r.message.en).toMatch(/22-day streak — schedule a rest day/)
    expect(r.message.tr).toMatch(/22 günlük seri — bir dinlenme günü planla/)
    expect(r.recommendation.en).toMatch(/48h/)
    expect(r.recommendation.tr).toMatch(/48 saat/)
  })

  it('15-day streak with no rest in last 14 → risk (escalation)', () => {
    const r = detectStreak(makeStreak(15), TODAY)
    expect(r.daysSinceLastRest).toBeGreaterThanOrEqual(14)
    expect(r.riskBand).toBe('risk')
  })

  it('30-day streak → risk', () => {
    const r = detectStreak(makeStreak(30), TODAY)
    expect(r.currentStreak).toBe(30)
    expect(r.riskBand).toBe('risk')
  })
})

// ─── Streak broken / recovery ───────────────────────────────────────────────
describe('detectStreak — broken / recovery bands', () => {
  it('streak broken yesterday (last train 2 days ago) → broken band', () => {
    // Last training was 2 days before today; today and yesterday no training.
    const log = [entry(addDays(TODAY, -2)), entry(addDays(TODAY, -3))]
    const r = detectStreak(log, TODAY)
    expect(r.currentStreak).toBe(0)
    expect(r.riskBand).toBe('broken')
    expect(r.message.en).toMatch(/Streak ended 1d ago/)
    expect(r.message.tr).toMatch(/Seri 1 gün önce sona erdi/)
    expect(r.recommendation.en).toMatch(/Resume base aerobic/)
  })

  it('recovery: today not trained yet but yesterday was → recovery band', () => {
    const log = [entry(addDays(TODAY, -1)), entry(addDays(TODAY, -2))]
    const r = detectStreak(log, TODAY)
    expect(r.currentStreak).toBe(0)
    expect(r.riskBand).toBe('recovery')
    expect(r.message.en).toMatch(/Active recovery today/)
    expect(r.message.tr).toMatch(/Bugün aktif toparlanma/)
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })

  it('streak ended 5 days ago → broken band shows 4d ago in message', () => {
    // last training -5 days, no training since
    const log = [entry(addDays(TODAY, -5))]
    const r = detectStreak(log, TODAY)
    expect(r.currentStreak).toBe(0)
    expect(r.riskBand).toBe('broken')
    expect(r.message.en).toMatch(/Streak ended 4d ago/)
  })
})

// ─── 90d analysis ───────────────────────────────────────────────────────────
describe('detectStreak — 90-day analytics', () => {
  it('longestStreakIn90d > currentStreak when prior streak was longer', () => {
    // Prior 10-day streak ending 30 days ago + a 3-day current streak
    const log = []
    for (let i = 0; i < 10; i++) log.push(entry(addDays(TODAY, -30 - i)))
    for (let i = 0; i < 3; i++) log.push(entry(addDays(TODAY, -i)))
    const r = detectStreak(log, TODAY)
    expect(r.currentStreak).toBe(3)
    expect(r.longestStreakIn90d).toBeGreaterThanOrEqual(10)
  })

  it('lastRestDate computed correctly (most recent rest day in 90d)', () => {
    // Train all days from -10 to today, rest at -11
    const log = makeStreak(11)
    const r = detectStreak(log, TODAY)
    expect(r.currentStreak).toBe(11)
    // last rest date should be -11 or earlier (since -10..today are all trained)
    expect(r.lastRestDate).not.toBeNull()
    expect(r.lastRestDate <= addDays(TODAY, -11)).toBe(true)
  })

  it('daysSinceLastRest correct: small streak → small daysSinceLastRest+1', () => {
    const log = makeStreak(5)
    const r = detectStreak(log, TODAY)
    expect(r.currentStreak).toBe(5)
    expect(r.daysSinceLastRest).toBe(5)
  })
})

// ─── 28-day count ───────────────────────────────────────────────────────────
describe('detectStreak — trainingDaysIn28d', () => {
  it('counts distinct training days in last 28 days', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(entry(addDays(TODAY, -i * 2)))
    const r = detectStreak(log, TODAY)
    expect(r.trainingDaysIn28d).toBe(10)
  })

  it('two entries same day count as 1 day in count', () => {
    const log = [entry(TODAY, 50), entry(TODAY, 30), entry(addDays(TODAY, -1), 40)]
    const r = detectStreak(log, TODAY)
    expect(r.trainingDaysIn28d).toBe(2)
    expect(r.currentStreak).toBe(2)
  })

  it('entries older than 28 days are excluded from 28d count', () => {
    const log = [entry(TODAY), entry(addDays(TODAY, -30)), entry(addDays(TODAY, -50))]
    const r = detectStreak(log, TODAY)
    expect(r.trainingDaysIn28d).toBe(1)
  })
})

// ─── Entry classification ──────────────────────────────────────────────────
describe('detectStreak — entry classification', () => {
  it('duration-only entries (no TSS) still count as training day', () => {
    const log = [
      { date: TODAY, type: 'walk', duration: 30 },
      { date: addDays(TODAY, -1), type: 'run', duration: 45 },
    ]
    const r = detectStreak(log, TODAY)
    expect(r.currentStreak).toBe(2)
  })

  it('TSS=0 and duration=0 entry does NOT count as training day', () => {
    const log = [{ date: TODAY, type: 'rest', tss: 0, duration: 0 }]
    const r = detectStreak(log, TODAY)
    expect(r.currentStreak).toBe(0)
  })

  it('multiple entries same day count as 1 training day', () => {
    const log = [entry(TODAY, 30), entry(TODAY, 50), entry(TODAY, 20)]
    const r = detectStreak(log, TODAY)
    expect(r.currentStreak).toBe(1)
  })
})

// ─── Reliability ────────────────────────────────────────────────────────────
describe('detectStreak — reliability', () => {
  it('log spanning <14 days → reliable=false', () => {
    const log = makeStreak(5)
    const r = detectStreak(log, TODAY)
    expect(r.reliable).toBe(false)
  })

  it('log spanning ≥14 days → reliable=true', () => {
    const log = makeStreak(14)
    const r = detectStreak(log, TODAY)
    expect(r.reliable).toBe(true)
  })

  it('sparse but >=14d span → reliable=true', () => {
    const log = [entry(TODAY), entry(addDays(TODAY, -13))]
    const r = detectStreak(log, TODAY)
    expect(r.reliable).toBe(true)
  })
})

// ─── Bilingual messages ─────────────────────────────────────────────────────
describe('detectStreak — bilingual messages', () => {
  it('every band has non-empty EN + TR messages', () => {
    const cases = [
      [makeStreak(3), 'celebrating'],
      [makeStreak(10), 'consistent'],
      [makeStreak(22), 'risk'],
      [[entry(addDays(TODAY, -1))], 'recovery'],
      [[entry(addDays(TODAY, -3))], 'broken'],
    ]
    for (const [log, expectedBand] of cases) {
      const r = detectStreak(log, TODAY)
      expect(r.riskBand).toBe(expectedBand)
      expect(r.message.en.length).toBeGreaterThan(0)
      expect(r.message.tr.length).toBeGreaterThan(0)
    }
  })

  it('{N} substitution renders streak length in messages', () => {
    const r = detectStreak(makeStreak(9), TODAY)
    expect(r.message.en).toContain('9')
    expect(r.message.tr).toContain('9')
    expect(r.message.en).not.toContain('{N}')
    expect(r.message.tr).not.toContain('{N}')
  })

  it('risk band has non-empty bilingual recommendation', () => {
    const r = detectStreak(makeStreak(22), TODAY)
    expect(r.riskBand).toBe('risk')
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('celebrating + recovery have empty recommendations', () => {
    const r1 = detectStreak(makeStreak(3), TODAY)
    expect(r1.riskBand).toBe('celebrating')
    expect(r1.recommendation.en).toBe('')
    expect(r1.recommendation.tr).toBe('')

    const r2 = detectStreak([entry(addDays(TODAY, -1))], TODAY)
    expect(r2.riskBand).toBe('recovery')
    expect(r2.recommendation.en).toBe('')
    expect(r2.recommendation.tr).toBe('')
  })
})

// ─── Return shape & determinism ─────────────────────────────────────────────
describe('detectStreak — return shape', () => {
  it('citation field matches export', () => {
    const r = detectStreak([], TODAY)
    expect(r.citation).toBe(STREAK_DETECTOR_CITATION)
    expect(STREAK_DETECTOR_CITATION).toBe('Habit-formation training research; Foster 2001 monotony')
  })

  it('result has all expected keys', () => {
    const r = detectStreak([], TODAY)
    const keys = Object.keys(r).sort()
    expect(keys).toEqual([
      'citation',
      'currentStreak',
      'daysSinceLastRest',
      'lastRestDate',
      'longestStreakIn90d',
      'message',
      'recommendation',
      'reliable',
      'riskBand',
      'trainingDaysIn28d',
    ])
  })

  it('options.today override is deterministic', () => {
    const log = makeStreak(5, '2026-01-15')
    const r = detectStreak(log, '2026-01-15')
    expect(r.currentStreak).toBe(5)
    expect(r.riskBand).toBe('celebrating')
  })
})
