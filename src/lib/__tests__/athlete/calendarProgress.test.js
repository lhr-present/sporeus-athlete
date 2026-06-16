import { describe, it, expect } from 'vitest'
import { buildCalendarProgress, CALENDAR_PROGRESS_CITATION } from '../../athlete/calendarProgress.js'
import { sanitizeLogEntry } from '../../validate.js'

const SIMPLE_WEEKS = [
  {
    weekStart: '2026-04-27',
    weekNum: 1,
    targetTSS: 300,
    sessionsBlueprint: [
      { day: 'Mon', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
      { day: 'Tue', intent: { en: 'Easy', tr: 'Kolay' }, durationMin: 45,
        zones: { Z1: 45, Z2: 0, Z3: 0, Z4: 0, Z5: 0 } },
      { day: 'Wed', intent: { en: 'Threshold', tr: 'Eşik' }, durationMin: 60,
        zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 40, Z5: 0 } },
      { day: 'Thu', intent: { en: 'Easy', tr: 'Kolay' }, durationMin: 45,
        zones: { Z1: 45, Z2: 0, Z3: 0, Z4: 0, Z5: 0 } },
      { day: 'Fri', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
      { day: 'Sat', intent: { en: 'Easy', tr: 'Kolay' }, durationMin: 50,
        zones: { Z1: 50, Z2: 0, Z3: 0, Z4: 0, Z5: 0 } },
      { day: 'Sun', intent: { en: 'Long', tr: 'Uzun' }, durationMin: 90,
        zones: { Z1: 75, Z2: 15, Z3: 0, Z4: 0, Z5: 0 } },
    ],
  },
]

describe('calendarProgress', () => {
  it('exports citation', () => {
    expect(CALENDAR_PROGRESS_CITATION).toMatch(/Coggan|TSS/)
  })

  it('returns empty progress for empty weeks', () => {
    const p = buildCalendarProgress([], [])
    expect(p.byDay).toEqual({})
    expect(p.byWeek).toEqual({})
    expect(p.overall.adherencePct).toBe(0)
  })

  it('builds per-day map for every day in every week', () => {
    const p = buildCalendarProgress(SIMPLE_WEEKS, [])
    const expectedDates = ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30',
                           '2026-05-01', '2026-05-02', '2026-05-03']
    for (const d of expectedDates) {
      expect(p.byDay[d]).toBeTruthy()
      expect(p.byDay[d].dateISO).toBe(d)
    }
  })

  it('plannedDuration matches session durationMin', () => {
    const p = buildCalendarProgress(SIMPLE_WEEKS, [])
    expect(p.byDay['2026-04-28'].plannedDuration).toBe(45) // Tue Easy
    expect(p.byDay['2026-04-29'].plannedDuration).toBe(60) // Wed Threshold
    expect(p.byDay['2026-04-27'].plannedDuration).toBe(0)  // Mon Rest
  })

  it('plannedTSS uses zone-weighted IF² estimate', () => {
    const p = buildCalendarProgress(SIMPLE_WEEKS, [])
    // Wed: 60 min, Z1=20 + Z4=40
    // IF² = (20*0.25 + 40*0.90)/60 = (5 + 36)/60 = 0.683
    // TSS = 60/60 * 0.683 * 100 = 68.3 → rounded 68
    expect(p.byDay['2026-04-29'].plannedTSS).toBe(68)
  })

  it('logged=true and actual TSS match when log entry on date', () => {
    const log = [{
      date: '2026-04-29',
      type: 'Threshold Run',
      sport: 'run',
      tss: 80,
      durationMin: 65,
    }]
    const p = buildCalendarProgress(SIMPLE_WEEKS, log, { sport: 'run' })
    expect(p.byDay['2026-04-29'].logged).toBe(true)
    expect(p.byDay['2026-04-29'].actualTSS).toBe(80)
    expect(p.byDay['2026-04-29'].actualDuration).toBe(65)
  })

  it('logged=false on date with no log entries', () => {
    const p = buildCalendarProgress(SIMPLE_WEEKS, [])
    expect(p.byDay['2026-04-29'].logged).toBe(false)
    expect(p.byDay['2026-04-29'].actualTSS).toBe(0)
  })

  it('filters log entries by program sport when sport supplied', () => {
    // bike entry should be excluded when sport='run'
    const log = [
      { date: '2026-04-29', type: 'Easy Bike', sport: 'bike', tss: 50, durationMin: 60 },
    ]
    const p = buildCalendarProgress(SIMPLE_WEEKS, log, { sport: 'run' })
    expect(p.byDay['2026-04-29'].logged).toBe(false)
  })

  it('counts daysLogged and daysPlanned per week', () => {
    const log = [
      { date: '2026-04-28', type: 'Easy Run', sport: 'run', tss: 40, durationMin: 45 },
      { date: '2026-04-29', type: 'Threshold Run', sport: 'run', tss: 70, durationMin: 60 },
    ]
    const p = buildCalendarProgress(SIMPLE_WEEKS, log, { sport: 'run' })
    const wp = p.byWeek['2026-04-27']
    expect(wp).toBeTruthy()
    expect(wp.daysLogged).toBe(2)
    expect(wp.daysPlanned).toBe(5) // Tue Wed Thu Sat Sun
  })

  it('week adherencePct rounds correctly', () => {
    const log = [
      { date: '2026-04-29', type: 'Threshold Run', sport: 'run', tss: 100, durationMin: 60 },
    ]
    const p = buildCalendarProgress(SIMPLE_WEEKS, log, { sport: 'run' })
    const wp = p.byWeek['2026-04-27']
    expect(wp.adherencePct).toBeGreaterThan(0)
    expect(wp.adherencePct).toBeLessThan(100)
  })

  it('overall adherence only counts past weeks', () => {
    // today set to inside the week → week not yet "past"
    const p = buildCalendarProgress(SIMPLE_WEEKS, [], { sport: 'run', today: '2026-04-30' })
    expect(p.overall.plannedTSS).toBe(0)
    expect(p.overall.actualTSS).toBe(0)
  })

  it('overall adherence counts a week once it ends', () => {
    const p = buildCalendarProgress(SIMPLE_WEEKS, [
      { date: '2026-04-29', type: 'Threshold Run', sport: 'run', tss: 70, durationMin: 60 },
    ], { sport: 'run', today: '2026-05-04' })  // after week ends
    expect(p.overall.plannedTSS).toBeGreaterThan(0)
    expect(p.overall.actualTSS).toBe(70)
  })

  it('handles invalid log entries gracefully', () => {
    const log = [
      null,
      'not-an-object',
      { date: 'invalid-date' },
      { date: '2026-04-29', type: 'Threshold Run', sport: 'run', tss: 70, durationMin: 60 },
    ]
    const p = buildCalendarProgress(SIMPLE_WEEKS, log, { sport: 'run' })
    expect(p.byDay['2026-04-29'].logged).toBe(true)
  })

  it('complianceRatio capped at 2', () => {
    const log = [
      { date: '2026-04-29', type: 'Threshold Run', sport: 'run', tss: 999, durationMin: 60 },
    ]
    const p = buildCalendarProgress(SIMPLE_WEEKS, log, { sport: 'run' })
    expect(p.byDay['2026-04-29'].complianceRatio).toBe(2)
  })

  // ─── Round-trip through sanitizeLogEntry (dead-card regression guard) ──────
  // The sanitizer renames `durationMin` → `duration` (and strips `sport`).
  // Pre-fix actualDuration summed `e.durationMin || e.durationMinutes`, so it
  // was 0 on every real (sanitized) entry while raw-field tests passed. Sport
  // matching still works via `type` (logEntrySport falls back to it). This
  // proves the card reports the logged minutes it gets from a stored entry.
  it('actualDuration comes from sanitizer-emitted `duration` (not raw durationMin)', () => {
    const entry = sanitizeLogEntry(
      { date: '2026-04-29', type: 'Threshold Run', sport: 'run', tss: 70, duration: 60 }
    )
    expect(entry.durationMin).toBeUndefined()
    expect(entry.duration).toBe(60)
    const p = buildCalendarProgress(SIMPLE_WEEKS, [entry], { sport: 'run' })
    expect(p.byDay['2026-04-29'].logged).toBe(true)
    expect(p.byDay['2026-04-29'].actualDuration).toBe(60)
  })
})
