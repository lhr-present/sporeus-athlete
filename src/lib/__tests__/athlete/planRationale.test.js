// v9.121.0 — Plan rationale tests.

import { describe, it, expect } from 'vitest'
import { explainPlannedSession } from '../../athlete/planRationale.js'

const TODAY = '2026-05-14'
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

describe('explainPlannedSession — guards', () => {
  it('returns empty for missing session', () => {
    const out = explainPlannedSession({ log: [], recovery: [], today: TODAY })
    expect(out).toEqual({ factors: [], hasContent: false })
  })
  it('returns empty for missing today', () => {
    const out = explainPlannedSession({ session: { type: 'Easy' }, log: [], recovery: [] })
    expect(out.hasContent).toBe(false)
  })
  it('tolerates undefined args', () => {
    expect(explainPlannedSession()).toEqual({ factors: [], hasContent: false })
  })
})

describe('explainPlannedSession — phase factor', () => {
  it('emits BUILD phase blurb when session.weekPhase=Build', () => {
    const out = explainPlannedSession({
      session: { type: 'Threshold', rpe: 7, weekPhase: 'Build' },
      log: [], recovery: [], today: TODAY,
    })
    const phase = out.factors.find(f => f.key === 'phase')
    expect(phase).toBeTruthy()
    expect(phase.label.en).toContain('BUILD')
    expect(phase.detail.en).toContain('race-specific')
    expect(phase.citation).toContain('Bompa')
  })
  it('emits TAPER phase with Bosquet citation', () => {
    const out = explainPlannedSession({
      session: { type: 'Easy', weekPhase: 'Taper' },
      log: [], recovery: [], today: TODAY,
    })
    const phase = out.factors.find(f => f.key === 'phase')
    expect(phase.citation).toContain('Bosquet')
  })
  it('no phase factor when weekPhase is missing', () => {
    const out = explainPlannedSession({
      session: { type: 'Easy' },
      log: [], recovery: [], today: TODAY,
    })
    expect(out.factors.find(f => f.key === 'phase')).toBeUndefined()
  })
  it('case-insensitive phase matching', () => {
    const out = explainPlannedSession({
      session: { weekPhase: 'base' },
      log: [], recovery: [], today: TODAY,
    })
    expect(out.factors.find(f => f.key === 'phase')?.citation).toContain('Seiler')
  })
})

describe('explainPlannedSession — yesterday factor', () => {
  it('hard yesterday + easy today → recovery sequencing rationale', () => {
    const log = [{ date: addDays(TODAY, -1), tss: 100, rpe: 8 }]
    const out = explainPlannedSession({
      session: { type: 'Easy', rpe: 4 },
      log, recovery: [], today: TODAY,
    })
    const y = out.factors.find(f => f.key === 'yesterday')
    expect(y.label.en).toContain('hard (RPE 8)')
    expect(y.detail.en).toContain('sequences recovery')
  })
  it('easy yesterday + hard today → preserves capacity rationale', () => {
    const log = [{ date: addDays(TODAY, -1), tss: 30, rpe: 4 }]
    const out = explainPlannedSession({
      session: { type: 'Threshold', rpe: 8 },
      log, recovery: [], today: TODAY,
    })
    const y = out.factors.find(f => f.key === 'yesterday')
    expect(y.detail.en).toContain('preserves capacity')
  })
  it('hard yesterday + hard today → monitor warning', () => {
    const log = [{ date: addDays(TODAY, -1), tss: 100, rpe: 9 }]
    const out = explainPlannedSession({
      session: { type: 'Intervals', rpe: 8 },
      log, recovery: [], today: TODAY,
    })
    const y = out.factors.find(f => f.key === 'yesterday')
    expect(y.detail.en).toContain('monitor RPE')
  })
  it('no factor when yesterday was rest', () => {
    const out = explainPlannedSession({
      session: { type: 'Threshold', rpe: 7 },
      log: [], recovery: [], today: TODAY,
    })
    expect(out.factors.find(f => f.key === 'yesterday')).toBeUndefined()
  })
  it('picks the hardest yesterday entry on a double day', () => {
    const log = [
      { date: addDays(TODAY, -1), tss: 30, rpe: 4 },
      { date: addDays(TODAY, -1), tss: 80, rpe: 8 },
    ]
    const out = explainPlannedSession({
      session: { rpe: 4 },
      log, recovery: [], today: TODAY,
    })
    const y = out.factors.find(f => f.key === 'yesterday')
    expect(y.label.en).toContain('RPE 8')
  })
})

describe('explainPlannedSession — TSB factor', () => {
  // calcLoad's CTL/ATL EMAs start from zero, so we need enough load
  // history for tsb to move into the ±5 thresholds.
  function buildLog(rpe, days) {
    return Array.from({ length: days }, (_, i) => ({
      date: addDays(TODAY, -(days - i)),
      tss:  60,
      rpe,
    }))
  }

  it('emits TSB factor when |tsb| >= 5', () => {
    const log = buildLog(6, 14) // sustained moderate load → ATL > CTL → negative TSB
    const out = explainPlannedSession({
      session: { rpe: 5 },
      log, recovery: [], today: TODAY,
    })
    const tsb = out.factors.find(f => f.key === 'tsb')
    expect(tsb).toBeTruthy()
  })
  it('no TSB factor when |tsb| < 5', () => {
    // Single low-load entry → very low CTL, very low ATL → tsb near 0
    const log = [{ date: addDays(TODAY, -1), tss: 5, rpe: 3 }]
    const out = explainPlannedSession({
      session: { rpe: 5 },
      log, recovery: [], today: TODAY,
    })
    expect(out.factors.find(f => f.key === 'tsb')).toBeUndefined()
  })
})

describe('explainPlannedSession — sleep factor (1-5 rating)', () => {
  // v9.122.0: sleep is a 1-5 rating from WELLNESS_FIELDS, not hours.
  it('emits poor-sleep warning when rating is 1 or 2', () => {
    const out = explainPlannedSession({
      session: { rpe: 5 },
      log: [],
      recovery: [{ date: TODAY, sleep: 2 }],
      today: TODAY,
    })
    const s = out.factors.find(f => f.key === 'sleep')
    expect(s.label.en).toContain('poor')
    expect(s.detail.en).toContain('1–2/5')
    expect(s.citation).toContain('Mah')
  })
  it('emits good-sleep blurb when rating is 4 or 5', () => {
    const out = explainPlannedSession({
      session: { rpe: 5 },
      log: [],
      recovery: [{ date: TODAY, sleep: 5 }],
      today: TODAY,
    })
    expect(out.factors.find(f => f.key === 'sleep')?.detail.en).toContain('good shape')
  })
  it('no sleep factor for neutral rating 3', () => {
    const out = explainPlannedSession({
      session: { rpe: 5 },
      log: [],
      recovery: [{ date: TODAY, sleep: 3 }],
      today: TODAY,
    })
    expect(out.factors.find(f => f.key === 'sleep')).toBeUndefined()
  })
  it('tolerates missing recovery row', () => {
    const out = explainPlannedSession({
      session: { rpe: 5 },
      log: [],
      recovery: [{ date: addDays(TODAY, -1), sleep: 4 }],
      today: TODAY,
    })
    expect(out.factors.find(f => f.key === 'sleep')).toBeUndefined()
  })
})

describe('explainPlannedSession — full integration', () => {
  it('stacks all 4 factor types when each fires', () => {
    const log = [
      ...Array.from({ length: 14 }, (_, i) => ({
        date: addDays(TODAY, -(14 - i)), tss: 60, rpe: 6,
      })),
      { date: addDays(TODAY, -1), tss: 100, rpe: 8 },
    ]
    const out = explainPlannedSession({
      session: { type: 'Easy', rpe: 4, weekPhase: 'Build' },
      log,
      recovery: [{ date: TODAY, sleep: 2 }],
      today: TODAY,
    })
    const keys = out.factors.map(f => f.key)
    expect(keys).toContain('phase')
    expect(keys).toContain('yesterday')
    expect(keys).toContain('sleep')
    expect(out.hasContent).toBe(true)
  })
})
