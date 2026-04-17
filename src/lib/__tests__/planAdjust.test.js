import { describe, it, expect } from 'vitest'
import { volumeCutPct, applyVolumeReduction, VOLUME_CUT_BY_LEVEL } from '../planAdjust.js'

// ── volumeCutPct ──────────────────────────────────────────────────────────────

describe('volumeCutPct', () => {
  it('maps level 1–2 to 20%', () => {
    expect(volumeCutPct(1)).toBe(20)
    expect(volumeCutPct(2)).toBe(20)
  })

  it('maps level 3 to 30%', () => {
    expect(volumeCutPct(3)).toBe(30)
  })

  it('maps level 4–5 to 40%', () => {
    expect(volumeCutPct(4)).toBe(40)
    expect(volumeCutPct(5)).toBe(40)
  })

  it('defaults to 20% for unknown level', () => {
    expect(volumeCutPct(99)).toBe(20)
    expect(volumeCutPct(0)).toBe(20)
  })

  it('VOLUME_CUT_BY_LEVEL covers all 5 levels', () => {
    expect(Object.keys(VOLUME_CUT_BY_LEVEL).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
  })
})

// ── applyVolumeReduction ──────────────────────────────────────────────────────

describe('applyVolumeReduction', () => {
  function makeWeeks(startDates) {
    return startDates.map(date => ({
      start_date: date,
      sessions: [
        { id: 's1', duration: 60, tss: 80, notes: 'morning run' },
        { id: 's2', duration: 90, tss: 110, notes: '' },
      ],
    }))
  }

  it('reduces duration and tss by 20% in the affected week', () => {
    const weeks  = makeWeeks(['2026-04-21', '2026-04-28'])
    const result = applyVolumeReduction(weeks, '2026-04-21', 7, 20)
    const affected = result[0]
    expect(affected.volume_adjusted).toBe(true)
    expect(affected.volume_cut_pct).toBe(20)
    expect(affected.sessions[0].duration).toBe(48)   // 60 × 0.8
    expect(affected.sessions[0].tss).toBe(64)         // 80 × 0.8
  })

  it('does not modify weeks outside the cut window', () => {
    const weeks  = makeWeeks(['2026-04-21', '2026-04-28'])
    const result = applyVolumeReduction(weeks, '2026-04-21', 7, 30)
    const unaffected = result[1]
    expect(unaffected.volume_adjusted).toBeUndefined()
    expect(unaffected.sessions[0].duration).toBe(60)
  })

  it('adds auto-adjustment annotation to session notes', () => {
    const weeks  = makeWeeks(['2026-04-21'])
    const result = applyVolumeReduction(weeks, '2026-04-21', 7, 40)
    const s = result[0].sessions[0]
    expect(s.notes).toContain('[AUTO-ADJUSTED -40% injury]')
    expect(s.notes).toContain('morning run')
  })

  it('returns input unchanged for empty weeks array', () => {
    expect(applyVolumeReduction([], '2026-04-21', 7, 20)).toEqual([])
  })

  it('handles sessions without duration or tss gracefully', () => {
    const weeks = [{ start_date: '2026-04-21', sessions: [{ id: 'x', notes: 'rest' }] }]
    const result = applyVolumeReduction(weeks, '2026-04-21', 7, 20)
    expect(result[0].sessions[0].duration).toBeUndefined()
    expect(result[0].sessions[0].tss).toBeUndefined()
  })
})
