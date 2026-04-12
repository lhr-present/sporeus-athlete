import { describe, it, expect } from 'vitest'
import { generateDigestHTML, getRuleBasedWeekSummary } from './digestEmail.js'

const squad = [
  { display_name: 'Eddy',    training_status: 'Overreaching', today_ctl: 85, today_tsb: -20, acwr_ratio: 1.45 },
  { display_name: 'Fausto',  training_status: 'Detraining',   today_ctl: 60, today_tsb:   5, acwr_ratio: 0.80 },
  { display_name: 'Bernard', training_status: 'Building',     today_ctl: 70, today_tsb:   2, acwr_ratio: 1.10 },
]

// ── getRuleBasedWeekSummary ───────────────────────────────────────────────────
describe('getRuleBasedWeekSummary', () => {
  it('handles empty squad gracefully', () => {
    expect(getRuleBasedWeekSummary([])).toBe('No athlete data available.')
    expect(getRuleBasedWeekSummary(null)).toBe('No athlete data available.')
  })

  it('includes squad size, avg CTL, and status counts', () => {
    const result = getRuleBasedWeekSummary(squad)
    expect(result).toContain('3')                   // total
    expect(result).toContain('overreaching')
    expect(result).toContain('ACWR > 1.3')          // Eddy has 1.45
  })
})

// ── generateDigestHTML ────────────────────────────────────────────────────────
describe('generateDigestHTML', () => {
  it('returns a string containing DOCTYPE and athlete names', () => {
    const html = generateDigestHTML(squad, '2026-04-12')
    expect(typeof html).toBe('string')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Eddy')
    expect(html).toContain('Fausto')
    expect(html).toContain('Bernard')
  })

  it('includes the week date in header', () => {
    const html = generateDigestHTML(squad, '2026-04-12')
    expect(html).toContain('2026-04-12')
  })

  it('escapes HTML special characters in athlete names', () => {
    const xss = [{ display_name: '<script>alert(1)</script>', training_status: 'Building', today_ctl: 50, today_tsb: 0, acwr_ratio: 1.0 }]
    const html = generateDigestHTML(xss, '2026-04-12')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
