// src/lib/__tests__/integrations/icsExport.test.js — v9.350.0
import { describe, it, expect } from 'vitest'
import { buildSessionIcs } from '../../integrations/icsExport.js'

describe('buildSessionIcs', () => {
  const base = { type: 'Interval run', duration: 45, zone: 'Z5', rpe: 8 }

  it('returns null on invalid input', () => {
    expect(buildSessionIcs(null, '2026-05-30')).toBeNull()
    expect(buildSessionIcs(base, 'not-a-date')).toBeNull()
    expect(buildSessionIcs({ type: 'Run', duration: 0 }, '2026-05-30')).toBeNull()
    expect(buildSessionIcs({ duration: 45 }, '2026-05-30')).toBeNull()  // no type
  })

  it('wraps a single VEVENT in a VCALENDAR with a VALARM', () => {
    const ics = buildSessionIcs(base, '2026-05-30')
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER:-PT30M')
  })

  it('schedules a floating-time event at the default 06:00 start for the duration', () => {
    const ics = buildSessionIcs(base, '2026-05-30')
    expect(ics).toContain('DTSTART:20260530T060000')   // floating (no Z)
    expect(ics).toContain('DTEND:20260530T064500')     // +45 min
  })

  it('honors a custom start hour', () => {
    const ics = buildSessionIcs({ type: 'Long ride', duration: 120 }, '2026-05-30', { startHour: 7 })
    expect(ics).toContain('DTSTART:20260530T070000')
    expect(ics).toContain('DTEND:20260530T090000')     // 07:00 + 120 min
  })

  it('clamps DTEND to the same day for an absurdly long session', () => {
    const ics = buildSessionIcs({ type: 'Epic', duration: 5000 }, '2026-05-30', { startHour: 6 })
    expect(ics).toContain('DTEND:20260530T235900')
  })

  it('summary includes type and duration; description carries zone + rpe', () => {
    const ics = buildSessionIcs(base, '2026-05-30')
    expect(ics).toContain('SUMMARY:Interval run (45 min)')
    expect(ics).toContain('Zone: Z5')
    expect(ics).toContain('RPE: 8/10')
  })

  it('escapes commas, semicolons and newlines in text per RFC 5545', () => {
    const ics = buildSessionIcs({ type: 'Tempo, hard; go', duration: 30, description: 'line1\nline2' }, '2026-05-30')
    expect(ics).toContain('SUMMARY:Tempo\\, hard\\; go (30 min)')
    expect(ics).toContain('line1\\nline2')
  })

  it('is deterministic — same input yields identical output (no Date.now/random)', () => {
    expect(buildSessionIcs(base, '2026-05-30')).toBe(buildSessionIcs(base, '2026-05-30'))
  })

  it('uses CRLF line endings', () => {
    const ics = buildSessionIcs(base, '2026-05-30')
    expect(ics).toContain('\r\n')
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('renders Turkish labels when lang=tr', () => {
    const ics = buildSessionIcs(base, '2026-05-30', { lang: 'tr' })
    expect(ics).toContain('(45 dk)')
    expect(ics).toContain('Bölge: Z5')
    expect(ics).toContain('Sporeus ile planlandı')
  })
})
