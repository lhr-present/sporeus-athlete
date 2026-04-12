// src/lib/coachDigest.test.js — Unit tests for weekly coach digest helpers
import { describe, it, expect } from 'vitest'
import {
  ctlTrend,
  wellnessAvg,
  trendLabel,
  acwrStatusLabel,
  generateAthleteDigestLine,
  generateSquadDigest,
} from './coachDigest.js'

// ── date helpers ──────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// ── ctlTrend ──────────────────────────────────────────────────────────────────
describe('ctlTrend', () => {
  it('returns ~ when no log and TSB near zero', () => {
    expect(ctlTrend({ today_ctl: 50, today_tsb: 0, _log: null })).toBe('~')
  })

  it('returns ~ when no log and TSB between -8 and +8', () => {
    expect(ctlTrend({ today_ctl: 50, today_tsb: 5, _log: [] })).toBe('~')
  })

  it('returns ↑ proxy when no log and TSB < -8', () => {
    expect(ctlTrend({ today_ctl: 50, today_tsb: -15, _log: null })).toBe('↑')
  })

  it('returns ↓ proxy when no log and TSB > 8', () => {
    expect(ctlTrend({ today_ctl: 50, today_tsb: 20, _log: [] })).toBe('↓')
  })

  it('returns ↑N when log shows past CTL below today_ctl', () => {
    // Single old entry → low past CTL; set today_ctl high → delta positive
    const log = [{ date: daysAgo(14), tss: 40 }]
    const ath = { today_ctl: 100, today_tsb: 0, _log: log }
    expect(ctlTrend(ath)).toMatch(/^↑\d+$/)
  })

  it('returns ↓N when log shows past CTL above today_ctl', () => {
    // Multiple old high-TSS entries → high past CTL; today_ctl = 0 → delta negative
    const log = Array.from({ length: 20 }, (_, i) => ({ date: daysAgo(30 - i), tss: 120 }))
    const ath = { today_ctl: 0, today_tsb: 0, _log: log }
    expect(ctlTrend(ath)).toMatch(/^↓\d+$/)
  })

  it('falls back to TSB proxy when log has only recent entries (< 7 days old)', () => {
    // All entries within last 7 days → pastLog empty → TSB proxy
    const log = [{ date: daysAgo(3), tss: 80 }]
    const ath = { today_ctl: 50, today_tsb: -10, _log: log }
    expect(ctlTrend(ath)).toBe('↑')
  })
})

// ── wellnessAvg ───────────────────────────────────────────────────────────────
describe('wellnessAvg', () => {
  it('returns 50 when HRV missing and adherence missing', () => {
    expect(wellnessAvg({ last_hrv_score: null, adherence_pct: undefined })).toBe(50)
  })

  it('blends HRV pct and adherence_pct equally', () => {
    // HRV 7.5 → (7.5-3)/7*100 ≈ 64 → clamped 64; adherence 80 → avg ≈ 72
    const result = wellnessAvg({ last_hrv_score: 7.5, adherence_pct: 80 })
    expect(result).toBeGreaterThan(60)
    expect(result).toBeLessThanOrEqual(100)
  })

  it('clamps low HRV to minimum 30%', () => {
    // HRV 0 → 30%; adherence 30 → avg = 30
    expect(wellnessAvg({ last_hrv_score: 0.1, adherence_pct: 30 })).toBe(30)
  })

  it('clamps high HRV to maximum 100%', () => {
    // HRV 20 (> 10) → clamped 100%; adherence 100 → avg = 100
    expect(wellnessAvg({ last_hrv_score: 20, adherence_pct: 100 })).toBe(100)
  })

  it('uses adherence 50 as default when undefined', () => {
    // HRV 3 → pct = (3-3)/7*100 = 0 → clamped 30; adherence 50 → avg = 40
    expect(wellnessAvg({ last_hrv_score: 3, adherence_pct: undefined })).toBe(40)
  })
})

// ── trendLabel ────────────────────────────────────────────────────────────────
describe('trendLabel', () => {
  it('returns improving for Building', () => {
    expect(trendLabel('Building')).toBe('improving')
  })
  it('returns improving for Peaking', () => {
    expect(trendLabel('Peaking')).toBe('improving')
  })
  it('returns declining for Detraining', () => {
    expect(trendLabel('Detraining')).toBe('declining')
  })
  it('returns declining for Overreaching', () => {
    expect(trendLabel('Overreaching')).toBe('declining')
  })
  it('returns stable for Recovering', () => {
    expect(trendLabel('Recovering')).toBe('stable')
  })
  it('returns stable for Maintaining', () => {
    expect(trendLabel('Maintaining')).toBe('stable')
  })
})

// ── acwrStatusLabel ───────────────────────────────────────────────────────────
describe('acwrStatusLabel', () => {
  it.each([
    ['optimal', 'safe'],
    ['low',     'low'],
    ['caution', 'caution'],
    ['danger',  'danger'],
  ])('%s → %s', (input, expected) => {
    expect(acwrStatusLabel(input)).toBe(expected)
  })

  it('returns status itself for unknown values', () => {
    expect(acwrStatusLabel('unknown')).toBe('unknown')
  })

  it('returns — for undefined', () => {
    expect(acwrStatusLabel(undefined)).toBe('—')
  })
})

// ── generateAthleteDigestLine ─────────────────────────────────────────────────
describe('generateAthleteDigestLine', () => {
  const ath = {
    display_name:    'Ali Yıldız',
    today_ctl:       55,
    today_tsb:       -12,
    last_hrv_score:  7.0,
    adherence_pct:   80,
    training_status: 'Building',
    acwr_ratio:      1.05,
    acwr_status:     'optimal',
    _log:            null,
  }

  it('includes athlete name', () => {
    expect(generateAthleteDigestLine(ath)).toContain('Ali Yıldız')
  })

  it('includes CTL value', () => {
    expect(generateAthleteDigestLine(ath)).toContain('CTL 55')
  })

  it('includes ACWR rounded to 2 dp', () => {
    expect(generateAthleteDigestLine(ath)).toContain('ACWR 1.05')
  })

  it('includes wellness percentage', () => {
    expect(generateAthleteDigestLine(ath)).toMatch(/wellness avg \d+%/)
  })

  it('includes overall trend label', () => {
    expect(generateAthleteDigestLine(ath)).toContain('improving')
  })

  it('shows — for null ACWR ratio', () => {
    const line = generateAthleteDigestLine({ ...ath, acwr_ratio: null })
    expect(line).toContain('ACWR —')
  })

  it('full format matches expected pattern', () => {
    const line = generateAthleteDigestLine(ath)
    expect(line).toMatch(/^.+: CTL \d+ [↑↓~].*, ACWR .+ \(.+\), wellness avg \d+% — \w+\.$/)
  })
})

// ── generateSquadDigest ───────────────────────────────────────────────────────
describe('generateSquadDigest', () => {
  const squad = [
    {
      display_name: 'Ali', today_ctl: 50, today_tsb: -5, today_atl: 55,
      last_hrv_score: 7, adherence_pct: 85, training_status: 'Building',
      acwr_ratio: 1.1, acwr_status: 'optimal', _log: null,
    },
    {
      display_name: 'Bora', today_ctl: 30, today_tsb: 5, today_atl: 25,
      last_hrv_score: 5, adherence_pct: 60, training_status: 'Recovering',
      acwr_ratio: 0.8, acwr_status: 'low', _log: null,
    },
  ]

  it('returns date string matching ISO date', () => {
    const { date } = generateSquadDigest(squad)
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns one line per athlete', () => {
    const { lines } = generateSquadDigest(squad)
    expect(lines).toHaveLength(2)
  })

  it('text starts with Squad Digest header', () => {
    const { text } = generateSquadDigest(squad)
    expect(text).toMatch(/^Squad Digest — \d{4}-\d{2}-\d{2}/)
  })

  it('text contains all athlete names', () => {
    const { text } = generateSquadDigest(squad)
    expect(text).toContain('Ali')
    expect(text).toContain('Bora')
  })

  it('returns empty lines array for empty squad', () => {
    const { lines, text } = generateSquadDigest([])
    expect(lines).toHaveLength(0)
    expect(text).toContain('Squad Digest')
  })
})
