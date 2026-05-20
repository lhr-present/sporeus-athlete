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

// ── v9.105.0 (Prompt HH) — getAthleteAttentionSignal ─────────────────────────
import { getAthleteAttentionSignal, ATTENTION_COLORS, ATTENTION_RANK } from '../squadView.js'

const TODAY = '2026-05-14'

describe('getAthleteAttentionSignal', () => {
  it('returns ok for a clean row', () => {
    const row = {
      acwr_status: 'optimal', today_tsb: 5, adherence_pct: 85,
      training_status: 'Building', last_session_date: '2026-05-13',
    }
    const out = getAthleteAttentionSignal(row, TODAY)
    expect(out.level).toBe('ok')
    expect(out.reasons).toEqual([])
  })

  it('flags urgent on ACWR danger', () => {
    const row = { acwr_status: 'danger', last_session_date: '2026-05-13' }
    const out = getAthleteAttentionSignal(row, TODAY)
    expect(out.level).toBe('urgent')
    expect(out.reasons.find(r => r.key === 'acwr_danger')).toBeTruthy()
  })

  it('flags urgent on adherence < 30%', () => {
    const row = { acwr_status: 'optimal', adherence_pct: 18, last_session_date: '2026-05-13' }
    const out = getAthleteAttentionSignal(row, TODAY)
    expect(out.level).toBe('urgent')
    expect(out.reasons.find(r => r.key === 'adherence_low')).toBeTruthy()
  })

  it('flags urgent when last session is 7+ days stale', () => {
    const row = { acwr_status: 'optimal', adherence_pct: 80, last_session_date: '2026-05-01' }
    const out = getAthleteAttentionSignal(row, TODAY)
    expect(out.level).toBe('urgent')
    expect(out.reasons.find(r => r.key === 'stale_7d')).toBeTruthy()
  })

  it('flags urgent on Detraining status', () => {
    const row = { training_status: 'Detraining', last_session_date: '2026-05-13', adherence_pct: 80 }
    const out = getAthleteAttentionSignal(row, TODAY)
    expect(out.level).toBe('urgent')
  })

  it('flags attention (not urgent) on caution ACWR + good adherence', () => {
    const row = { acwr_status: 'caution', adherence_pct: 80, last_session_date: '2026-05-13' }
    const out = getAthleteAttentionSignal(row, TODAY)
    expect(out.level).toBe('attention')
    expect(out.reasons.find(r => r.key === 'acwr_caution')).toBeTruthy()
  })

  it('flags attention on deep TSB fatigue', () => {
    const row = { today_tsb: -25, adherence_pct: 80, last_session_date: '2026-05-13' }
    const out = getAthleteAttentionSignal(row, TODAY)
    expect(out.level).toBe('attention')
    expect(out.reasons.find(r => r.key === 'tsb_deep')).toBeTruthy()
  })

  it('flags attention for adherence 30-60', () => {
    const row = { acwr_status: 'optimal', adherence_pct: 45, last_session_date: '2026-05-13' }
    const out = getAthleteAttentionSignal(row, TODAY)
    expect(out.level).toBe('attention')
    expect(out.reasons.find(r => r.key === 'adherence_mid')).toBeTruthy()
  })

  it('escalates to urgent when any urgent reason is set (overrides attention reasons)', () => {
    const row = { acwr_status: 'caution', adherence_pct: 18, last_session_date: '2026-05-13' }
    const out = getAthleteAttentionSignal(row, TODAY)
    expect(out.level).toBe('urgent')
    // both reasons surface — coach sees the full picture
    expect(out.reasons.length).toBeGreaterThanOrEqual(2)
  })

  it('tolerates missing fields', () => {
    expect(getAthleteAttentionSignal(null, TODAY).level).toBe('ok')
    expect(getAthleteAttentionSignal({}, TODAY).level).toBe('urgent')   // stale_7d fires because last_session_date is missing
  })

  it('emits bilingual labels with both en + tr', () => {
    const row = { acwr_status: 'danger', last_session_date: '2026-05-13' }
    const out = getAthleteAttentionSignal(row, TODAY)
    const r = out.reasons[0]
    expect(r.label.en).toBeTruthy()
    expect(r.label.tr).toBeTruthy()
  })

  it('ATTENTION_RANK orders urgent > attention > ok', () => {
    expect(ATTENTION_RANK.urgent).toBeGreaterThan(ATTENTION_RANK.attention)
    expect(ATTENTION_RANK.attention).toBeGreaterThan(ATTENTION_RANK.ok)
  })

  it('ATTENTION_COLORS exposes red / amber / green', () => {
    expect(ATTENTION_COLORS.urgent).toMatch(/^#/)
    expect(ATTENTION_COLORS.attention).toMatch(/^#/)
    expect(ATTENTION_COLORS.ok).toMatch(/^#/)
  })
})

describe('sortAthletes attention', () => {
  it('sorts urgent rows to the bottom when asc, top when desc', () => {
    const recent = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
    const urgentRow    = { display_name: 'A', acwr_status: 'danger',   last_session_date: recent }
    const attentionRow = { display_name: 'B', acwr_status: 'caution',  last_session_date: recent, adherence_pct: 80 }
    const okRow        = { display_name: 'C', acwr_status: 'optimal',  last_session_date: recent, adherence_pct: 90 }
    const asc  = sortAthletes([urgentRow, attentionRow, okRow], 'attention', 'asc')
    expect(asc.map(r => r.display_name)).toEqual(['C', 'B', 'A'])
    const desc = sortAthletes([urgentRow, attentionRow, okRow], 'attention', 'desc')
    expect(desc.map(r => r.display_name)).toEqual(['A', 'B', 'C'])
  })
})
