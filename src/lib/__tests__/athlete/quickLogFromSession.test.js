import { describe, it, expect } from 'vitest'
import { buildLogEntryFromSession } from '../../athlete/quickLogFromSession.js'

const RUN_THRESHOLD_SESSION = {
  day: 'Wed',
  intent: { en: 'Threshold 2x20', tr: 'Eşik 2x20' },
  durationMin: 60,
  zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 40, Z5: 0 },
  paceTarget: '4:00/km',
  notes: { en: 'Hold T-pace', tr: 'T-tempoyu koru' },
}

describe('buildLogEntryFromSession', () => {
  it('returns null on null input', () => {
    expect(buildLogEntryFromSession(null, '2026-04-29', 'run')).toBeNull()
  })

  it('returns null on bad date', () => {
    expect(buildLogEntryFromSession(RUN_THRESHOLD_SESSION, 'bad', 'run')).toBeNull()
  })

  it('builds a valid log entry from a run threshold session', () => {
    const e = buildLogEntryFromSession(RUN_THRESHOLD_SESSION, '2026-04-29', 'run')
    expect(e).toBeTruthy()
    expect(e.date).toBe('2026-04-29')
    expect(e.type).toBe('Threshold Run')
    expect(e.sport).toBe('run')
    expect(e.duration).toBe(60)
    expect(e.durationMin).toBe(60)
    expect(e.tss).toBeGreaterThan(60)
    expect(e.rpe).toBe(7)
    expect(e.source).toBe('sporeus-plan')
  })

  it('captures zones array in canonical order', () => {
    const e = buildLogEntryFromSession(RUN_THRESHOLD_SESSION, '2026-04-29', 'run')
    expect(Array.isArray(e.zones)).toBe(true)
    expect(e.zones.length).toBe(5)
    expect(e.zones[0]).toBe(20)  // Z1
    expect(e.zones[3]).toBe(40)  // Z4
  })

  it('TSS computed via zone-weighted IF² formula', () => {
    const e = buildLogEntryFromSession(RUN_THRESHOLD_SESSION, '2026-04-29', 'run')
    // Z1=20 → 0.25, Z4=40 → 0.90; total min=60; IF² = (5+36)/60 = 0.683
    // TSS = 60/60 * 0.683 * 100 = 68 (rounded)
    expect(e.tss).toBe(68)
  })

  it('maps VO2 intent to VO2 Run type', () => {
    const s = { ...RUN_THRESHOLD_SESSION, intent: { en: 'VO2max 5x3', tr: 'VO2 5x3' } }
    const e = buildLogEntryFromSession(s, '2026-04-29', 'run')
    expect(e.type).toBe('VO2 Run')
    expect(e.rpe).toBe(9)
  })

  it('maps Easy intent to Easy Bike for sport=bike', () => {
    const s = { ...RUN_THRESHOLD_SESSION, intent: { en: 'Easy Z2', tr: 'Kolay Z2' } }
    const e = buildLogEntryFromSession(s, '2026-04-29', 'bike')
    expect(e.type).toBe('Easy Bike')
    expect(e.sport).toBe('bike')
    expect(e.rpe).toBe(4)
  })

  it('maps Long intent to Long Run for sport=run', () => {
    const s = { ...RUN_THRESHOLD_SESSION, intent: { en: 'Long aerobic', tr: 'Uzun aerobik' }, durationMin: 120 }
    const e = buildLogEntryFromSession(s, '2026-04-29', 'run')
    expect(e.type).toBe('Long Run')
    expect(e.rpe).toBe(5)
  })

  it('maps Race intent to Race Run', () => {
    const s = { ...RUN_THRESHOLD_SESSION, intent: { en: 'Race day', tr: 'Yarış günü' } }
    const e = buildLogEntryFromSession(s, '2026-04-29', 'run')
    expect(e.type).toBe('Race Run')
  })

  it('falls back to fallback type for unknown intent', () => {
    const s = { ...RUN_THRESHOLD_SESSION, intent: { en: 'Cross-training yoga', tr: 'Yoga' } }
    const e = buildLogEntryFromSession(s, '2026-04-29', 'run')
    expect(e.type).toBe('Cross-training yoga')
  })

  it('strength sessions get Strength type regardless of sport', () => {
    const s = { ...RUN_THRESHOLD_SESSION, intent: { en: 'Strength workout', tr: 'Kuvvet seansı' } }
    const e = buildLogEntryFromSession(s, '2026-04-29', 'run')
    expect(e.type).toBe('Strength')
  })

  it('handles sessions with no zones (fallback heuristic)', () => {
    const s = { day: 'Wed', intent: { en: 'Easy run', tr: 'Kolay' }, durationMin: 60 }
    const e = buildLogEntryFromSession(s, '2026-04-29', 'run')
    expect(e.tss).toBeGreaterThan(0)
    expect(e.tss).toBeLessThanOrEqual(60)  // 60 min easy ≈ 50 TSS
  })

  it('preserves notes from session blueprint', () => {
    const e = buildLogEntryFromSession(RUN_THRESHOLD_SESSION, '2026-04-29', 'run')
    expect(e.notes).toContain('Hold T-pace')
    expect(e.notes).toContain('[Sporeus plan]')
  })

  it('TSS=0 for zero-duration sessions', () => {
    const s = { ...RUN_THRESHOLD_SESSION, durationMin: 0 }
    const e = buildLogEntryFromSession(s, '2026-04-29', 'run')
    expect(e.tss).toBe(0)
  })

  it('lowercases sport', () => {
    const e = buildLogEntryFromSession(RUN_THRESHOLD_SESSION, '2026-04-29', 'RUN')
    expect(e.sport).toBe('run')
  })
})
