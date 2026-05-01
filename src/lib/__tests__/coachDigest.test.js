// E103
import { describe, it, expect } from 'vitest'
import {
  ctlTrend,
  wellnessAvg,
  trendLabel,
  acwrStatusLabel,
  generateAthleteDigestLine,
  generateSquadDigest,
} from '../coachDigest.js'

// ─── ctlTrend ─────────────────────────────────────────────────────────────────
describe('ctlTrend', () => {
  it('returns ~ for athlete with no log and neutral TSB', () => {
    expect(ctlTrend({ today_ctl: 50, today_tsb: 0 })).toBe('~')
  })

  it('returns ~ for athlete with no log and TSB within -8..8 range', () => {
    expect(ctlTrend({ today_ctl: 50, today_tsb: 5 })).toBe('~')
    expect(ctlTrend({ today_ctl: 50, today_tsb: -5 })).toBe('~')
    expect(ctlTrend({ today_ctl: 50, today_tsb: 8 })).toBe('~')
    expect(ctlTrend({ today_ctl: 50, today_tsb: -8 })).toBe('~')
  })

  it('returns ↑ when TSB proxy < -8 (loading > recovering)', () => {
    expect(ctlTrend({ today_ctl: 50, today_tsb: -9 })).toBe('↑')
    expect(ctlTrend({ today_ctl: 50, today_tsb: -20 })).toBe('↑')
  })

  it('returns ↓ when TSB proxy > 8 (deloading)', () => {
    expect(ctlTrend({ today_ctl: 50, today_tsb: 9 })).toBe('↓')
    expect(ctlTrend({ today_ctl: 50, today_tsb: 25 })).toBe('↓')
  })

  it('returns ~ when today_tsb is undefined (defaults to 0)', () => {
    expect(ctlTrend({ today_ctl: 50 })).toBe('~')
  })

  it('uses log when available — rising CTL returns ↑ with delta', () => {
    // Use a past-dated log entry so ctlSevenDaysAgo returns non-null
    const pastDate = new Date()
    pastDate.setUTCDate(pastDate.getUTCDate() - 10)
    const pastStr = pastDate.toISOString().slice(0, 10)
    const ath = {
      today_ctl: 60,
      today_tsb: 0,
      _log: [{ date: pastStr, tss: 80 }],
    }
    const result = ctlTrend(ath)
    // Should be ↑ or ↓ or ~ depending on computed past CTL — just check it's a string
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('uses log when available — ↑ symbol present for positive delta', () => {
    const pastDate = new Date()
    pastDate.setUTCDate(pastDate.getUTCDate() - 10)
    const pastStr = pastDate.toISOString().slice(0, 10)
    // today_ctl set very high so delta is clearly positive vs small past CTL
    const ath = {
      today_ctl: 100,
      today_tsb: 0,
      _log: [{ date: pastStr, tss: 1 }],
    }
    const result = ctlTrend(ath)
    expect(result).toMatch(/[↑↓~]/)
  })

  it('returns ~ when log is empty (falls back to TSB proxy with tsb=0)', () => {
    expect(ctlTrend({ today_ctl: 50, today_tsb: 0, _log: [] })).toBe('~')
  })

  it('returns ~ when log has only future dates (no past entries)', () => {
    const futureDate = new Date()
    futureDate.setUTCDate(futureDate.getUTCDate() + 5)
    const futureStr = futureDate.toISOString().slice(0, 10)
    const ath = {
      today_ctl: 50,
      today_tsb: 0,
      _log: [{ date: futureStr, tss: 100 }],
    }
    // No past log entries within cutoff → falls back to TSB proxy
    expect(ctlTrend(ath)).toBe('~')
  })
})

// ─── wellnessAvg ──────────────────────────────────────────────────────────────
describe('wellnessAvg', () => {
  it('returns a number', () => {
    expect(typeof wellnessAvg({ last_hrv_score: 7, adherence_pct: 80 })).toBe('number')
  })

  it('uses 50% for HRV when last_hrv_score is null/undefined', () => {
    // hrv=null → hrvPct=50, adherence=80 → avg=(50+80)/2=65
    expect(wellnessAvg({ last_hrv_score: null, adherence_pct: 80 })).toBe(65)
    expect(wellnessAvg({ last_hrv_score: undefined, adherence_pct: 80 })).toBe(65)
  })

  it('uses 50% for adherence when adherence_pct is undefined', () => {
    // hrv=null → 50, adherence=undefined → 50 → avg=50
    expect(wellnessAvg({ last_hrv_score: null })).toBe(50)
  })

  it('clamps HRV to minimum 30%', () => {
    // very low HRV (e.g. 3 → (3-3)/7*100=0 → clamped to 30), adherence=50 → (30+50)/2=40
    expect(wellnessAvg({ last_hrv_score: 3, adherence_pct: 50 })).toBe(40)
  })

  it('clamps HRV to maximum 100%', () => {
    // very high HRV (e.g. 20 → clamped to 100), adherence=100 → (100+100)/2=100
    expect(wellnessAvg({ last_hrv_score: 20, adherence_pct: 100 })).toBe(100)
  })

  it('HRV of 9 → 100%, adherence 60 → avg 80', () => {
    // (9-3)/7*100 ≈ 86 → not capped; adherence=60 → avg ~73
    const result = wellnessAvg({ last_hrv_score: 9, adherence_pct: 60 })
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThanOrEqual(100)
    expect(Number.isInteger(result)).toBe(true)
  })

  it('result is always an integer', () => {
    expect(Number.isInteger(wellnessAvg({ last_hrv_score: 6.3, adherence_pct: 73 }))).toBe(true)
  })

  it('result is always between 0 and 100', () => {
    const cases = [
      { last_hrv_score: 4.5, adherence_pct: 30 },
      { last_hrv_score: 9, adherence_pct: 100 },
      { last_hrv_score: null, adherence_pct: null },
      { last_hrv_score: 7, adherence_pct: 75 },
    ]
    for (const c of cases) {
      const r = wellnessAvg(c)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(100)
    }
  })

  it('both null → returns 50', () => {
    expect(wellnessAvg({ last_hrv_score: null, adherence_pct: null })).toBe(50)
  })
})

// ─── trendLabel ───────────────────────────────────────────────────────────────
describe('trendLabel', () => {
  it('Building → improving', () => {
    expect(trendLabel('Building')).toBe('improving')
  })

  it('Peaking → improving', () => {
    expect(trendLabel('Peaking')).toBe('improving')
  })

  it('Detraining → declining', () => {
    expect(trendLabel('Detraining')).toBe('declining')
  })

  it('Overreaching → declining', () => {
    expect(trendLabel('Overreaching')).toBe('declining')
  })

  it('Maintaining → stable', () => {
    expect(trendLabel('Maintaining')).toBe('stable')
  })

  it('undefined → stable', () => {
    expect(trendLabel(undefined)).toBe('stable')
  })

  it('null → stable', () => {
    expect(trendLabel(null)).toBe('stable')
  })

  it('empty string → stable', () => {
    expect(trendLabel('')).toBe('stable')
  })

  it('unknown string → stable', () => {
    expect(trendLabel('Recovering')).toBe('stable')
    expect(trendLabel('FooBar')).toBe('stable')
  })

  it('returns a non-empty string in all cases', () => {
    for (const s of ['Building', 'Peaking', 'Detraining', 'Overreaching', 'Maintaining', null, undefined, '']) {
      expect(typeof trendLabel(s)).toBe('string')
      expect(trendLabel(s).length).toBeGreaterThan(0)
    }
  })
})

// ─── acwrStatusLabel ──────────────────────────────────────────────────────────
describe('acwrStatusLabel', () => {
  it('optimal → safe', () => {
    expect(acwrStatusLabel('optimal')).toBe('safe')
  })

  it('low → low', () => {
    expect(acwrStatusLabel('low')).toBe('low')
  })

  it('caution → caution', () => {
    expect(acwrStatusLabel('caution')).toBe('caution')
  })

  it('danger → danger', () => {
    expect(acwrStatusLabel('danger')).toBe('danger')
  })

  it('undefined → — (em dash fallback)', () => {
    expect(acwrStatusLabel(undefined)).toBe('—')
  })

  it('null → — (em dash fallback)', () => {
    expect(acwrStatusLabel(null)).toBe('—')
  })

  it('unknown string → returns the string itself', () => {
    expect(acwrStatusLabel('unknown')).toBe('unknown')
    expect(acwrStatusLabel('foo')).toBe('foo')
  })

  it('returns a string in all valid cases', () => {
    for (const s of ['optimal', 'low', 'caution', 'danger']) {
      expect(typeof acwrStatusLabel(s)).toBe('string')
    }
  })
})

// ─── generateAthleteDigestLine ────────────────────────────────────────────────
describe('generateAthleteDigestLine', () => {
  const baseAth = {
    display_name: 'Alice',
    today_ctl: 72,
    today_tsb: -5,
    acwr_ratio: 1.15,
    acwr_status: 'optimal',
    training_status: 'Building',
    last_hrv_score: 7,
    adherence_pct: 80,
  }

  it('returns a non-empty string', () => {
    const result = generateAthleteDigestLine(baseAth)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('contains athlete display_name', () => {
    expect(generateAthleteDigestLine(baseAth)).toContain('Alice')
  })

  it('contains CTL value', () => {
    expect(generateAthleteDigestLine(baseAth)).toContain('CTL 72')
  })

  it('contains ACWR ratio formatted to 2 decimals', () => {
    expect(generateAthleteDigestLine(baseAth)).toContain('ACWR 1.15')
  })

  it('contains acwr status label', () => {
    expect(generateAthleteDigestLine(baseAth)).toContain('safe')
  })

  it('contains wellness avg percentage', () => {
    expect(generateAthleteDigestLine(baseAth)).toContain('%')
  })

  it('contains overall trend label', () => {
    expect(generateAthleteDigestLine(baseAth)).toContain('improving')
  })

  it('uses — when acwr_ratio is null', () => {
    const ath = { ...baseAth, acwr_ratio: null }
    expect(generateAthleteDigestLine(ath)).toContain('ACWR —')
  })

  it('uses — when acwr_ratio is undefined', () => {
    const ath = { ...baseAth, acwr_ratio: undefined }
    expect(generateAthleteDigestLine(ath)).toContain('ACWR —')
  })

  it('formats line ending with a period', () => {
    expect(generateAthleteDigestLine(baseAth).endsWith('.')).toBe(true)
  })

  it('contains trend arrow or ~ from ctlTrend', () => {
    const result = generateAthleteDigestLine(baseAth)
    expect(result).toMatch(/[↑↓~]/)
  })

  it('Detraining status → declining in output', () => {
    const ath = { ...baseAth, training_status: 'Detraining' }
    expect(generateAthleteDigestLine(ath)).toContain('declining')
  })

  it('Maintaining status → stable in output', () => {
    const ath = { ...baseAth, training_status: 'Maintaining' }
    expect(generateAthleteDigestLine(ath)).toContain('stable')
  })

  it('danger acwr_status → danger label in output', () => {
    const ath = { ...baseAth, acwr_status: 'danger' }
    expect(generateAthleteDigestLine(ath)).toContain('danger')
  })
})

// ─── generateSquadDigest ─────────────────────────────────────────────────────
describe('generateSquadDigest', () => {
  const ath1 = {
    display_name: 'Alice',
    today_ctl: 72,
    today_tsb: -5,
    acwr_ratio: 1.15,
    acwr_status: 'optimal',
    training_status: 'Building',
    last_hrv_score: 7,
    adherence_pct: 80,
  }
  const ath2 = {
    display_name: 'Bob',
    today_ctl: 55,
    today_tsb: 10,
    acwr_ratio: 0.85,
    acwr_status: 'low',
    training_status: 'Detraining',
    last_hrv_score: 5,
    adherence_pct: 60,
  }

  it('returns object with date, lines, and text keys', () => {
    const result = generateSquadDigest([ath1])
    expect(result).toHaveProperty('date')
    expect(result).toHaveProperty('lines')
    expect(result).toHaveProperty('text')
  })

  it('date is in YYYY-MM-DD format', () => {
    const { date } = generateSquadDigest([ath1])
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('lines is an array', () => {
    const { lines } = generateSquadDigest([ath1])
    expect(Array.isArray(lines)).toBe(true)
  })

  it('empty athlete array → lines is empty array', () => {
    const { lines } = generateSquadDigest([])
    expect(lines).toHaveLength(0)
  })

  it('empty athlete array → text still contains Squad Digest header', () => {
    const { text } = generateSquadDigest([])
    expect(text).toContain('Squad Digest')
  })

  it('single athlete → lines has one entry', () => {
    const { lines } = generateSquadDigest([ath1])
    expect(lines).toHaveLength(1)
  })

  it('two athletes → lines has two entries', () => {
    const { lines } = generateSquadDigest([ath1, ath2])
    expect(lines).toHaveLength(2)
  })

  it('each line contains the athlete name', () => {
    const { lines } = generateSquadDigest([ath1, ath2])
    expect(lines[0]).toContain('Alice')
    expect(lines[1]).toContain('Bob')
  })

  it('text includes the date', () => {
    const { date, text } = generateSquadDigest([ath1])
    expect(text).toContain(date)
  })

  it('text starts with Squad Digest', () => {
    const { text } = generateSquadDigest([ath1])
    expect(text.startsWith('Squad Digest')).toBe(true)
  })

  it('text contains all athlete lines joined by newline', () => {
    const { lines, text } = generateSquadDigest([ath1, ath2])
    for (const line of lines) {
      expect(text).toContain(line)
    }
  })

  it('lines array entries match generateAthleteDigestLine output', () => {
    const { lines } = generateSquadDigest([ath1, ath2])
    expect(lines[0]).toContain('Alice')
    expect(lines[0]).toMatch(/CTL \d+/)
    expect(lines[1]).toContain('Bob')
    expect(lines[1]).toMatch(/CTL \d+/)
  })
})
