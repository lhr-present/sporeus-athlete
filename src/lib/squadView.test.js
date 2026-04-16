// ─── squadView.test.js ────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  acwrColor,
  tsbColor,
  trainingStatusColor,
  formatLastSession,
  sortAthletes,
  filterAthletes,
  ACWR_COLORS,
} from './squadView.js'

// ── acwrColor ─────────────────────────────────────────────────────────────────

describe('acwrColor', () => {
  it('returns red for danger', () => {
    expect(acwrColor('danger')).toBe(ACWR_COLORS.danger)
  })

  it('returns yellow for caution', () => {
    expect(acwrColor('caution')).toBe(ACWR_COLORS.caution)
  })

  it('returns green for optimal', () => {
    expect(acwrColor('optimal')).toBe(ACWR_COLORS.optimal)
  })

  it('returns dim for low', () => {
    expect(acwrColor('low')).toBe(ACWR_COLORS.low)
  })

  it('returns dim for unknown status', () => {
    expect(acwrColor('whatever')).toBe('#555')
  })
})

// ── tsbColor ──────────────────────────────────────────────────────────────────

describe('tsbColor', () => {
  it('returns dim for null', () => {
    expect(tsbColor(null)).toBe('#555')
  })

  it('returns dim for undefined', () => {
    expect(tsbColor(undefined)).toBe('#555')
  })

  it('returns yellow for peaking (tsb > 25)', () => {
    expect(tsbColor(30)).toBe('#f5c542')
  })

  it('returns red for overreaching (tsb < -20)', () => {
    expect(tsbColor(-25)).toBe('#e03030')
  })

  it('returns yellow for moderate fatigue (-20 to -10)', () => {
    expect(tsbColor(-15)).toBe('#f5c542')
  })

  it('returns green for fresh / normal range', () => {
    expect(tsbColor(5)).toBe('#5bc25b')
    expect(tsbColor(-9)).toBe('#5bc25b')
    expect(tsbColor(25)).toBe('#5bc25b') // exactly 25 is not > 25
  })
})

// ── trainingStatusColor ───────────────────────────────────────────────────────

describe('trainingStatusColor', () => {
  it('Overreaching → red', () => expect(trainingStatusColor('Overreaching')).toBe('#e03030'))
  it('Detraining → red',   () => expect(trainingStatusColor('Detraining')).toBe('#e03030'))
  it('Building → green',   () => expect(trainingStatusColor('Building')).toBe('#5bc25b'))
  it('Peaking → yellow',   () => expect(trainingStatusColor('Peaking')).toBe('#f5c542'))
  it('Recovering → blue',  () => expect(trainingStatusColor('Recovering')).toBe('#0064ff'))
  it('Maintaining → text', () => expect(trainingStatusColor('Maintaining')).toBe('#e0e0e0'))
  it('unknown → dim',      () => expect(trainingStatusColor('Unknown')).toBe('#555'))
})

// ── formatLastSession ─────────────────────────────────────────────────────────

describe('formatLastSession', () => {
  it('returns — for null/undefined', () => {
    expect(formatLastSession(null)).toBe('—')
    expect(formatLastSession(undefined)).toBe('—')
    expect(formatLastSession('')).toBe('—')
  })

  it('returns Today for today', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(formatLastSession(today)).toBe('Today')
  })

  it('returns 1d ago for yesterday', () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    expect(formatLastSession(d.toISOString().slice(0, 10))).toBe('1d ago')
  })

  it('returns Xd ago for days < 7', () => {
    const d = new Date()
    d.setDate(d.getDate() - 5)
    expect(formatLastSession(d.toISOString().slice(0, 10))).toBe('5d ago')
  })

  it('returns Xw ago for days < 30', () => {
    const d = new Date()
    d.setDate(d.getDate() - 14)
    expect(formatLastSession(d.toISOString().slice(0, 10))).toBe('2w ago')
  })

  it('returns Xmo ago for days >= 30', () => {
    const d = new Date()
    d.setDate(d.getDate() - 60)
    expect(formatLastSession(d.toISOString().slice(0, 10))).toBe('2mo ago')
  })
})

// ── sortAthletes ──────────────────────────────────────────────────────────────

const ATHLETES = [
  { display_name: 'Charlie', today_ctl: 80, today_tsb: -5,  acwr_ratio: 1.2, adherence_pct: 70, last_session_date: '2026-04-15', training_status: 'Building', acwr_status: 'optimal' },
  { display_name: 'Alice',   today_ctl: 55, today_tsb: 10,  acwr_ratio: 0.7, adherence_pct: 50, last_session_date: '2026-04-10', training_status: 'Detraining', acwr_status: 'low' },
  { display_name: 'Bob',     today_ctl: 90, today_tsb: -25, acwr_ratio: 1.6, adherence_pct: 90, last_session_date: '2026-04-16', training_status: 'Overreaching', acwr_status: 'danger' },
]

describe('sortAthletes', () => {
  it('sorts by name asc', () => {
    const r = sortAthletes(ATHLETES, 'name', 'asc')
    expect(r.map(a => a.display_name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('sorts by name desc', () => {
    const r = sortAthletes(ATHLETES, 'name', 'desc')
    expect(r.map(a => a.display_name)).toEqual(['Charlie', 'Bob', 'Alice'])
  })

  it('sorts by ctl desc (highest first)', () => {
    const r = sortAthletes(ATHLETES, 'ctl', 'desc')
    expect(r[0].display_name).toBe('Bob')
    expect(r[2].display_name).toBe('Alice')
  })

  it('sorts by tsb asc (most fatigued first)', () => {
    const r = sortAthletes(ATHLETES, 'tsb', 'asc')
    expect(r[0].today_tsb).toBe(-25)
  })

  it('sorts by adherence desc', () => {
    const r = sortAthletes(ATHLETES, 'adherence', 'desc')
    expect(r[0].adherence_pct).toBe(90)
  })

  it('sorts by lastSession desc (most recent first)', () => {
    const r = sortAthletes(ATHLETES, 'lastSession', 'desc')
    expect(r[0].last_session_date).toBe('2026-04-16')
  })

  it('does not mutate original array', () => {
    const orig = [...ATHLETES]
    sortAthletes(ATHLETES, 'ctl', 'desc')
    expect(ATHLETES).toEqual(orig)
  })

  it('unknown sortBy returns stable order', () => {
    const r = sortAthletes(ATHLETES, 'unknown', 'asc')
    expect(r.length).toBe(ATHLETES.length)
  })
})

// ── filterAthletes ────────────────────────────────────────────────────────────

describe('filterAthletes', () => {
  it('returns all when search is empty and chip is all', () => {
    expect(filterAthletes(ATHLETES, '', 'all')).toHaveLength(ATHLETES.length)
  })

  it('filters by name search (case-insensitive)', () => {
    const r = filterAthletes(ATHLETES, 'ali', 'all')
    expect(r).toHaveLength(1)
    expect(r[0].display_name).toBe('Alice')
  })

  it('chip=danger returns only danger-status athletes', () => {
    const r = filterAthletes(ATHLETES, '', 'danger')
    expect(r.every(a => a.acwr_status === 'danger')).toBe(true)
    expect(r).toHaveLength(1)
  })

  it('chip=caution returns danger + caution athletes', () => {
    const arr = [
      ...ATHLETES,
      { display_name: 'Dave', acwr_status: 'caution', training_status: 'Building' },
    ]
    const r = filterAthletes(arr, '', 'caution')
    expect(r.length).toBe(2) // Bob (danger) + Dave (caution)
  })

  it('chip=detraining returns only Detraining athletes', () => {
    const r = filterAthletes(ATHLETES, '', 'detraining')
    expect(r).toHaveLength(1)
    expect(r[0].display_name).toBe('Alice')
  })

  it('search + chip combined', () => {
    const r = filterAthletes(ATHLETES, 'Bo', 'danger')
    expect(r).toHaveLength(1)
    expect(r[0].display_name).toBe('Bob')
  })

  it('returns empty when nothing matches', () => {
    expect(filterAthletes(ATHLETES, 'zzz', 'all')).toHaveLength(0)
  })
})
