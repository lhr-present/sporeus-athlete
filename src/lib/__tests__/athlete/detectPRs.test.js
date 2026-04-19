// src/lib/__tests__/athlete/detectPRs.test.js — E6
import { describe, it, expect } from 'vitest'
import { detectPRs, computeMaxStreak, weekStart, formatPRSummary } from '../../athlete/detectPRs.js'

// ── weekStart ──────────────────────────────────────────────────────────────

describe('weekStart', () => {
  it('Monday returns self', () => {
    expect(weekStart('2024-04-15')).toBe('2024-04-15')  // Monday
  })
  it('Sunday maps to previous Monday', () => {
    expect(weekStart('2024-04-21')).toBe('2024-04-15')  // Sunday → Mon
  })
  it('Wednesday maps to Monday', () => {
    expect(weekStart('2024-04-17')).toBe('2024-04-15')
  })
  it('Saturday maps to Monday', () => {
    expect(weekStart('2024-04-20')).toBe('2024-04-15')
  })
})

// ── computeMaxStreak ───────────────────────────────────────────────────────

describe('computeMaxStreak', () => {
  it('returns 0 for empty array', () => {
    expect(computeMaxStreak([])).toBe(0)
  })
  it('returns 1 for single date', () => {
    expect(computeMaxStreak(['2024-01-01'])).toBe(1)
  })
  it('counts consecutive days', () => {
    expect(computeMaxStreak(['2024-01-01','2024-01-02','2024-01-03'])).toBe(3)
  })
  it('finds best streak among gaps', () => {
    const dates = ['2024-01-01','2024-01-02','2024-01-05','2024-01-06','2024-01-07','2024-01-08']
    expect(computeMaxStreak(dates)).toBe(4)
  })
  it('deduplicates dates', () => {
    expect(computeMaxStreak(['2024-01-01','2024-01-01','2024-01-02'])).toBe(2)
  })
  it('handles unsorted input', () => {
    expect(computeMaxStreak(['2024-01-03','2024-01-01','2024-01-02'])).toBe(3)
  })
})

// ── detectPRs — no-op guards ───────────────────────────────────────────────

describe('detectPRs guards', () => {
  it('returns [] for null session', () => {
    expect(detectPRs(null, [])).toEqual([])
  })
  it('returns [] for session without date', () => {
    expect(detectPRs({ duration: 60, tss: 100 }, [])).toEqual([])
  })
  it('returns [] when no metrics qualify', () => {
    // duration < 30 min minimum, tss=0
    expect(detectPRs({ date: '2024-06-01', duration: 10, tss: 0 }, [])).toEqual([])
  })
})

// ── longest_session ────────────────────────────────────────────────────────

describe('longest_session PR', () => {
  const base = { date: '2024-06-01', tss: 0 }

  it('29 min does NOT qualify (below 30 min threshold)', () => {
    const prs = detectPRs({ ...base, duration: 29 }, [])
    expect(prs.find(p => p.category === 'longest_session')).toBeUndefined()
  })

  it('30 min qualifies as first session of that length', () => {
    const prs = detectPRs({ ...base, duration: 30 }, [])
    const pr = prs.find(p => p.category === 'longest_session')
    expect(pr).toBeDefined()
    expect(pr.value).toBe(30)
    expect(pr.prev).toBeNull()
    expect(pr.en).toContain('first session')
  })

  it('PR when strictly longer than prior best', () => {
    const prior = [{ date: '2024-05-01', duration: 60, tss: 50 }]
    const prs = detectPRs({ ...base, duration: 90 }, prior)
    const pr = prs.find(p => p.category === 'longest_session')
    expect(pr).toBeDefined()
    expect(pr.value).toBe(90)
    expect(pr.prev).toBe(60)
    expect(pr.en).toContain('previous: 60 min')
  })

  it('no PR when tied with prior best', () => {
    const prior = [{ date: '2024-05-01', duration: 60, tss: 50 }]
    const prs = detectPRs({ ...base, duration: 60 }, prior)
    expect(prs.find(p => p.category === 'longest_session')).toBeUndefined()
  })

  it('no PR when shorter than prior best', () => {
    const prior = [{ date: '2024-05-01', duration: 120, tss: 50 }]
    const prs = detectPRs({ ...base, duration: 90 }, prior)
    expect(prs.find(p => p.category === 'longest_session')).toBeUndefined()
  })

  it('bilingual strings present', () => {
    const prs = detectPRs({ ...base, duration: 45 }, [])
    const pr = prs.find(p => p.category === 'longest_session')
    expect(pr.tr).toContain('45')
  })
})

// ── highest_tss ────────────────────────────────────────────────────────────

describe('highest_tss PR', () => {
  const base = { date: '2024-06-01', duration: 60 }

  it('no PR when tss is 0', () => {
    const prs = detectPRs({ ...base, tss: 0 }, [])
    expect(prs.find(p => p.category === 'highest_tss')).toBeUndefined()
  })

  it('PR on first session with tss > 0', () => {
    const prs = detectPRs({ ...base, tss: 100 }, [])
    const pr = prs.find(p => p.category === 'highest_tss')
    expect(pr).toBeDefined()
    expect(pr.value).toBe(100)
    expect(pr.prev).toBeNull()
  })

  it('PR when strictly higher than prior', () => {
    const prior = [{ date: '2024-05-01', duration: 60, tss: 80 }]
    const prs = detectPRs({ ...base, tss: 120 }, prior)
    const pr = prs.find(p => p.category === 'highest_tss')
    expect(pr).toBeDefined()
    expect(pr.value).toBe(120)
    expect(pr.prev).toBe(80)
  })

  it('no PR when tied', () => {
    const prior = [{ date: '2024-05-01', duration: 60, tss: 100 }]
    const prs = detectPRs({ ...base, tss: 100 }, prior)
    expect(prs.find(p => p.category === 'highest_tss')).toBeUndefined()
  })
})

// ── weekly_tss ─────────────────────────────────────────────────────────────

describe('weekly_tss PR', () => {
  it('not fired when no prior weeks exist', () => {
    // prevWeekMax === 0, so guard `prevWeekMax > 0` blocks it
    const prs = detectPRs({ date: '2024-06-03', duration: 60, tss: 200 }, [])
    expect(prs.find(p => p.category === 'weekly_tss')).toBeUndefined()
  })

  it('PR when this week total exceeds prior best week', () => {
    // Prior week: 2024-05-27 week (Mon) = 300 TSS
    const prior = [
      { date: '2024-05-27', tss: 150 },
      { date: '2024-05-28', tss: 150 },
      // Same week as new session — 2024-06-03 (Mon week)
      { date: '2024-06-03', tss: 100 },
    ]
    // New session adds 250 to same week → total 350 > 300
    const prs = detectPRs({ date: '2024-06-04', duration: 60, tss: 250 }, prior)
    const pr = prs.find(p => p.category === 'weekly_tss')
    expect(pr).toBeDefined()
    expect(pr.value).toBe(350)
    expect(pr.prev).toBe(300)
  })

  it('no PR when this week does not exceed prior best', () => {
    const prior = [{ date: '2024-05-27', tss: 500 }]
    const prs = detectPRs({ date: '2024-06-03', duration: 60, tss: 200 }, prior)
    expect(prs.find(p => p.category === 'weekly_tss')).toBeUndefined()
  })
})

// ── longest_streak ─────────────────────────────────────────────────────────

describe('longest_streak PR', () => {
  it('no PR for streak < 3', () => {
    const prs = detectPRs({ date: '2024-06-02', duration: 60, tss: 50 }, [
      { date: '2024-06-01', tss: 50 },
    ])
    expect(prs.find(p => p.category === 'longest_streak')).toBeUndefined()
  })

  it('PR for 3-day streak when no prior streak', () => {
    const prior = [
      { date: '2024-06-01', tss: 50 },
      { date: '2024-06-02', tss: 50 },
    ]
    const prs = detectPRs({ date: '2024-06-03', duration: 60, tss: 50 }, prior)
    const pr = prs.find(p => p.category === 'longest_streak')
    expect(pr).toBeDefined()
    expect(pr.value).toBe(3)
  })

  it('PR only when strictly exceeds prior best streak', () => {
    // Prior has a 3-day streak; new session extends to 4
    const prior = [
      { date: '2024-05-01', tss: 50 },
      { date: '2024-05-02', tss: 50 },
      { date: '2024-05-03', tss: 50 },
      { date: '2024-06-01', tss: 50 },
      { date: '2024-06-02', tss: 50 },
      { date: '2024-06-03', tss: 50 },
    ]
    const prs = detectPRs({ date: '2024-06-04', duration: 60, tss: 50 }, prior)
    const pr = prs.find(p => p.category === 'longest_streak')
    expect(pr).toBeDefined()
    expect(pr.value).toBe(4)
    expect(pr.prev).toBe(3)
  })

  it('no PR if gap in days breaks the streak', () => {
    const prior = [
      { date: '2024-06-01', tss: 50 },
      { date: '2024-06-02', tss: 50 },
    ]
    // Session on 2024-06-05 — gap, so streak = 1
    const prs = detectPRs({ date: '2024-06-05', duration: 60, tss: 50 }, prior)
    expect(prs.find(p => p.category === 'longest_streak')).toBeUndefined()
  })
})

// ── power peaks ────────────────────────────────────────────────────────────

describe('power_peak PRs', () => {
  const base = { date: '2024-06-01', duration: 60, tss: 80 }

  it('no PR when powerPeaks absent', () => {
    const prs = detectPRs(base, [])
    const powerPRs = prs.filter(p => p.category.startsWith('power_peak'))
    expect(powerPRs).toHaveLength(0)
  })

  it('power_peak_1min PR on first session', () => {
    const session = { ...base, powerPeaks: { 1: 400, 5: 350, 20: 300, 60: 250 } }
    const prs = detectPRs(session, [])
    const pr = prs.find(p => p.category === 'power_peak_1min')
    expect(pr).toBeDefined()
    expect(pr.value).toBe(400)
    expect(pr.prev).toBeNull()
  })

  it('all four peak durations detected', () => {
    const session = { ...base, powerPeaks: { 1: 400, 5: 350, 20: 300, 60: 250 } }
    const prs = detectPRs(session, [])
    const cats = prs.filter(p => p.category.startsWith('power_peak')).map(p => p.category)
    expect(cats).toContain('power_peak_1min')
    expect(cats).toContain('power_peak_5min')
    expect(cats).toContain('power_peak_20min')
    expect(cats).toContain('power_peak_60min')
  })

  it('only beats-previous peaks trigger PR', () => {
    const prior = [{ date: '2024-05-01', tss: 80, powerPeaks: { 1: 500, 5: 300 } }]
    const session = { ...base, powerPeaks: { 1: 450, 5: 350 } }
    const prs = detectPRs(session, prior)
    expect(prs.find(p => p.category === 'power_peak_1min')).toBeUndefined()  // 450 < 500
    expect(prs.find(p => p.category === 'power_peak_5min')).toBeDefined()    // 350 > 300
  })

  it('bilingual power PR strings', () => {
    const session = { ...base, powerPeaks: { 20: 320 } }
    const prs = detectPRs(session, [])
    const pr = prs.find(p => p.category === 'power_peak_20min')
    expect(pr.en).toContain('320W')
    expect(pr.tr).toContain('320W')
  })
})

// ── multiple PRs in one session ────────────────────────────────────────────

describe('multiple PRs', () => {
  it('session can return multiple PR categories at once', () => {
    const session = {
      date: '2024-06-03',
      duration: 120,
      tss: 150,
      powerPeaks: { 1: 400 },
    }
    const prior = [
      { date: '2024-06-01', duration: 60, tss: 80 },
      { date: '2024-06-02', duration: 90, tss: 90 },
    ]
    const prs = detectPRs(session, prior)
    expect(prs.length).toBeGreaterThanOrEqual(3)  // longest_session + highest_tss + power_peak_1min + streak
  })
})

// ── formatPRSummary ────────────────────────────────────────────────────────

describe('formatPRSummary', () => {
  it('returns null for empty array', () => {
    expect(formatPRSummary([])).toBeNull()
  })

  it('returns the PR text when exactly 1 PR', () => {
    const prs = [{ en: 'Longest session: 90 min', tr: 'En uzun: 90 dk' }]
    expect(formatPRSummary(prs, 'en')).toBe('Longest session: 90 min')
    expect(formatPRSummary(prs, 'tr')).toBe('En uzun: 90 dk')
  })

  it('returns count summary for multiple PRs (en)', () => {
    const prs = [
      { en: 'A', tr: 'A' },
      { en: 'B', tr: 'B' },
      { en: 'C', tr: 'C' },
    ]
    expect(formatPRSummary(prs, 'en')).toContain('3 personal records')
  })

  it('returns count summary for multiple PRs (tr)', () => {
    const prs = [{ en: 'A', tr: 'A' }, { en: 'B', tr: 'B' }]
    expect(formatPRSummary(prs, 'tr')).toContain('2')
  })
})
