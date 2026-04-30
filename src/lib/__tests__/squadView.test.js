// E97
import { describe, it, expect } from 'vitest'
import {
  ACWR_COLORS,
  acwrColor,
  tsbColor,
  trainingStatusColor,
  formatLastSession,
  sortAthletes,
  filterAthletes,
} from '../squadView.js'

// ─── ACWR_COLORS constant ─────────────────────────────────────────────────────
describe('ACWR_COLORS', () => {
  it('has exactly 4 keys', () => {
    expect(Object.keys(ACWR_COLORS)).toHaveLength(4)
  })

  it('danger is red', () => {
    expect(ACWR_COLORS.danger).toBe('#e03030')
  })

  it('caution is yellow', () => {
    expect(ACWR_COLORS.caution).toBe('#f5c542')
  })

  it('optimal is green', () => {
    expect(ACWR_COLORS.optimal).toBe('#5bc25b')
  })

  it('low is dark grey', () => {
    expect(ACWR_COLORS.low).toBe('#555')
  })
})

// ─── acwrColor ────────────────────────────────────────────────────────────────
describe('acwrColor', () => {
  it('returns danger color for danger status', () => {
    expect(acwrColor('danger')).toBe('#e03030')
  })

  it('returns caution color for caution status', () => {
    expect(acwrColor('caution')).toBe('#f5c542')
  })

  it('returns optimal color for optimal status', () => {
    expect(acwrColor('optimal')).toBe('#5bc25b')
  })

  it('returns low color for low status', () => {
    expect(acwrColor('low')).toBe('#555')
  })

  it('returns fallback #555 for unknown status', () => {
    expect(acwrColor('unknown')).toBe('#555')
  })

  it('returns fallback #555 for undefined', () => {
    expect(acwrColor(undefined)).toBe('#555')
  })

  it('returns fallback #555 for null', () => {
    expect(acwrColor(null)).toBe('#555')
  })

  it('returns fallback #555 for empty string', () => {
    expect(acwrColor('')).toBe('#555')
  })
})

// ─── tsbColor ─────────────────────────────────────────────────────────────────
describe('tsbColor', () => {
  it('returns grey for null', () => {
    expect(tsbColor(null)).toBe('#555')
  })

  it('returns grey for undefined', () => {
    expect(tsbColor(undefined)).toBe('#555')
  })

  it('returns yellow when tsb > 25 (peaking)', () => {
    expect(tsbColor(26)).toBe('#f5c542')
    expect(tsbColor(50)).toBe('#f5c542')
  })

  it('returns yellow at exact tsb = 26 boundary', () => {
    expect(tsbColor(26)).toBe('#f5c542')
  })

  it('returns red when tsb < -20 (overreaching)', () => {
    expect(tsbColor(-21)).toBe('#e03030')
    expect(tsbColor(-100)).toBe('#e03030')
  })

  it('returns red at exact tsb = -21 boundary', () => {
    expect(tsbColor(-21)).toBe('#e03030')
  })

  it('returns yellow when tsb is between -20 and -10 (moderate fatigue)', () => {
    expect(tsbColor(-15)).toBe('#f5c542')
    expect(tsbColor(-11)).toBe('#f5c542')
  })

  it('returns yellow at exact tsb = -20 boundary (moderate fatigue, not overreaching)', () => {
    expect(tsbColor(-20)).toBe('#f5c542')
  })

  it('returns green at exact tsb = -10 boundary (not < -10, so falls to normal range)', () => {
    expect(tsbColor(-10)).toBe('#5bc25b')
  })

  it('returns green for tsb in normal range (0)', () => {
    expect(tsbColor(0)).toBe('#5bc25b')
  })

  it('returns green for tsb = 10 (fresh)', () => {
    expect(tsbColor(10)).toBe('#5bc25b')
  })

  it('returns green for tsb = 25 (boundary — not > 25)', () => {
    expect(tsbColor(25)).toBe('#5bc25b')
  })

  it('returns green for small negative tsb (-9)', () => {
    expect(tsbColor(-9)).toBe('#5bc25b')
  })
})

// ─── trainingStatusColor ──────────────────────────────────────────────────────
describe('trainingStatusColor', () => {
  it('Overreaching → red', () => {
    expect(trainingStatusColor('Overreaching')).toBe('#e03030')
  })

  it('Detraining → red', () => {
    expect(trainingStatusColor('Detraining')).toBe('#e03030')
  })

  it('Building → green', () => {
    expect(trainingStatusColor('Building')).toBe('#5bc25b')
  })

  it('Peaking → yellow', () => {
    expect(trainingStatusColor('Peaking')).toBe('#f5c542')
  })

  it('Recovering → blue', () => {
    expect(trainingStatusColor('Recovering')).toBe('#0064ff')
  })

  it('Maintaining → light grey', () => {
    expect(trainingStatusColor('Maintaining')).toBe('#e0e0e0')
  })

  it('unknown status → fallback grey', () => {
    expect(trainingStatusColor('Unknown')).toBe('#555')
  })

  it('empty string → fallback grey', () => {
    expect(trainingStatusColor('')).toBe('#555')
  })

  it('null → fallback grey', () => {
    expect(trainingStatusColor(null)).toBe('#555')
  })

  it('undefined → fallback grey', () => {
    expect(trainingStatusColor(undefined)).toBe('#555')
  })

  it('lowercase building → fallback grey (case-sensitive)', () => {
    expect(trainingStatusColor('building')).toBe('#555')
  })
})

// ─── formatLastSession ────────────────────────────────────────────────────────
describe('formatLastSession', () => {
  it('returns em-dash for null', () => {
    expect(formatLastSession(null)).toBe('—')
  })

  it('returns em-dash for undefined', () => {
    expect(formatLastSession(undefined)).toBe('—')
  })

  it('returns em-dash for empty string', () => {
    expect(formatLastSession('')).toBe('—')
  })

  it('returns Today for a date string from today', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(formatLastSession(today)).toBe('Today')
  })

  it('returns 1d ago for yesterday', () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const str = d.toISOString().slice(0, 10)
    expect(formatLastSession(str)).toBe('1d ago')
  })

  it('returns Nd ago for 2–6 days', () => {
    for (const n of [2, 3, 5, 6]) {
      const d = new Date()
      d.setDate(d.getDate() - n)
      const str = d.toISOString().slice(0, 10)
      expect(formatLastSession(str)).toBe(`${n}d ago`)
    }
  })

  it('returns 1w ago for 7 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    const str = d.toISOString().slice(0, 10)
    expect(formatLastSession(str)).toBe('1w ago')
  })

  it('returns 2w ago for 14 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 14)
    const str = d.toISOString().slice(0, 10)
    expect(formatLastSession(str)).toBe('2w ago')
  })

  it('returns 1mo ago for 30 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    const str = d.toISOString().slice(0, 10)
    expect(formatLastSession(str)).toBe('1mo ago')
  })

  it('returns 3mo ago for 90 days ago', () => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    const str = d.toISOString().slice(0, 10)
    expect(formatLastSession(str)).toBe('3mo ago')
  })
})

// ─── sortAthletes ─────────────────────────────────────────────────────────────
describe('sortAthletes', () => {
  const athletes = [
    { display_name: 'Charlie', today_ctl: 70, today_tsb: 5,  acwr_ratio: 1.1, adherence_pct: 80, last_session_date: '2026-04-20', training_status: 'Building' },
    { display_name: 'Alice',   today_ctl: 90, today_tsb: -5, acwr_ratio: 1.4, adherence_pct: 95, last_session_date: '2026-04-28', training_status: 'Overreaching' },
    { display_name: 'Bob',     today_ctl: 55, today_tsb: 10, acwr_ratio: 0.8, adherence_pct: 60, last_session_date: '2026-04-10', training_status: 'Detraining' },
  ]

  it('does not mutate the original array', () => {
    const original = [...athletes]
    sortAthletes(athletes, 'ctl', 'asc')
    expect(athletes).toEqual(original)
  })

  it('sorts by name asc', () => {
    const result = sortAthletes(athletes, 'name', 'asc')
    expect(result.map(a => a.display_name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('sorts by name desc', () => {
    const result = sortAthletes(athletes, 'name', 'desc')
    expect(result.map(a => a.display_name)).toEqual(['Charlie', 'Bob', 'Alice'])
  })

  it('sorts by ctl asc', () => {
    const result = sortAthletes(athletes, 'ctl', 'asc')
    expect(result.map(a => a.today_ctl)).toEqual([55, 70, 90])
  })

  it('sorts by ctl desc', () => {
    const result = sortAthletes(athletes, 'ctl', 'desc')
    expect(result.map(a => a.today_ctl)).toEqual([90, 70, 55])
  })

  it('sorts by tsb asc', () => {
    const result = sortAthletes(athletes, 'tsb', 'asc')
    expect(result.map(a => a.today_tsb)).toEqual([-5, 5, 10])
  })

  it('sorts by tsb desc', () => {
    const result = sortAthletes(athletes, 'tsb', 'desc')
    expect(result.map(a => a.today_tsb)).toEqual([10, 5, -5])
  })

  it('sorts by acwr asc', () => {
    const result = sortAthletes(athletes, 'acwr', 'asc')
    expect(result.map(a => a.acwr_ratio)).toEqual([0.8, 1.1, 1.4])
  })

  it('sorts by adherence desc', () => {
    const result = sortAthletes(athletes, 'adherence', 'desc')
    expect(result.map(a => a.adherence_pct)).toEqual([95, 80, 60])
  })

  it('sorts by lastSession asc', () => {
    const result = sortAthletes(athletes, 'lastSession', 'asc')
    expect(result.map(a => a.last_session_date)).toEqual(['2026-04-10', '2026-04-20', '2026-04-28'])
  })

  it('sorts by status asc (alphabetical)', () => {
    const result = sortAthletes(athletes, 'status', 'asc')
    expect(result.map(a => a.training_status)).toEqual(['Building', 'Detraining', 'Overreaching'])
  })

  it('unknown sortBy key returns stable (unchanged) copy', () => {
    const result = sortAthletes(athletes, 'xyz', 'asc')
    expect(result).toHaveLength(athletes.length)
  })

  it('handles athletes with missing fields (nulls default to 0)', () => {
    const data = [
      { display_name: 'X', today_ctl: null },
      { display_name: 'Y', today_ctl: 50 },
    ]
    const result = sortAthletes(data, 'ctl', 'asc')
    expect(result[0].today_ctl).toBeNull()
    expect(result[1].today_ctl).toBe(50)
  })

  it('handles empty array', () => {
    expect(sortAthletes([], 'ctl', 'asc')).toEqual([])
  })

  it('handles single athlete', () => {
    const single = [athletes[0]]
    expect(sortAthletes(single, 'name', 'asc')).toHaveLength(1)
  })
})

// ─── filterAthletes ───────────────────────────────────────────────────────────
describe('filterAthletes', () => {
  const athletes = [
    { display_name: 'Alice',   acwr_status: 'danger',   training_status: 'Overreaching' },
    { display_name: 'Bob',     acwr_status: 'caution',  training_status: 'Building' },
    { display_name: 'Charlie', acwr_status: 'optimal',  training_status: 'Detraining' },
    { display_name: 'Diana',   acwr_status: 'low',      training_status: 'Recovering' },
    { display_name: 'Eve',     acwr_status: 'danger',   training_status: 'Detraining' },
  ]

  it('returns all athletes when search is empty and chip is null', () => {
    expect(filterAthletes(athletes, '', null)).toHaveLength(5)
  })

  it('returns all athletes when search is whitespace only', () => {
    expect(filterAthletes(athletes, '   ', null)).toHaveLength(5)
  })

  it('filters by search substring case-insensitively', () => {
    const result = filterAthletes(athletes, 'ali', null)
    expect(result).toHaveLength(1)
    expect(result[0].display_name).toBe('Alice')
  })

  it('returns empty array when search matches nothing', () => {
    expect(filterAthletes(athletes, 'zzz', null)).toHaveLength(0)
  })

  it('chip=danger returns only danger athletes', () => {
    const result = filterAthletes(athletes, '', 'danger')
    expect(result.every(a => a.acwr_status === 'danger')).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('chip=caution returns caution AND danger athletes', () => {
    const result = filterAthletes(athletes, '', 'caution')
    expect(result).toHaveLength(3)
    expect(result.every(a => a.acwr_status === 'danger' || a.acwr_status === 'caution')).toBe(true)
  })

  it('chip=detraining returns only Detraining status athletes', () => {
    const result = filterAthletes(athletes, '', 'detraining')
    expect(result).toHaveLength(2)
    expect(result.every(a => a.training_status === 'Detraining')).toBe(true)
  })

  it('unknown chip returns all athletes unfiltered', () => {
    expect(filterAthletes(athletes, '', 'unknown_chip')).toHaveLength(5)
  })

  it('combines search and chip correctly', () => {
    const result = filterAthletes(athletes, 'eve', 'danger')
    expect(result).toHaveLength(1)
    expect(result[0].display_name).toBe('Eve')
  })

  it('search + chip with no match returns empty array', () => {
    const result = filterAthletes(athletes, 'alice', 'detraining')
    expect(result).toHaveLength(0)
  })

  it('handles empty athletes array', () => {
    expect(filterAthletes([], 'alice', 'danger')).toHaveLength(0)
  })

  it('handles athlete with missing display_name', () => {
    const data = [{ acwr_status: 'danger', training_status: 'Building' }]
    const result = filterAthletes(data, 'ali', null)
    expect(result).toHaveLength(0)
  })
})
