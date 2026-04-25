import { describe, it, expect } from 'vitest'
import { projectCTLAtRace, assessRaceReadiness, avgWeeklyTSSFromLog } from '../sport/raceGoalProjection.js'

describe('raceGoalProjection', () => {
  it('projectCTLAtRace(100, 700, 0) returns 100 (no time = no change)', () => {
    expect(projectCTLAtRace(100, 700, 0)).toBe(100)
  })

  it('projectCTLAtRace(50, 0, 42) < 50 (decay with no load)', () => {
    expect(projectCTLAtRace(50, 0, 42)).toBeLessThan(50)
  })

  it('projectCTLAtRace(0, 700, 42) > 0 (CTL builds from zero)', () => {
    expect(projectCTLAtRace(0, 700, 42)).toBeGreaterThan(0)
  })

  it('assessRaceReadiness(95, 100) returns on_track', () => {
    expect(assessRaceReadiness(95, 100).status).toBe('on_track')
  })

  it('assessRaceReadiness(82, 100) returns at_risk', () => {
    expect(assessRaceReadiness(82, 100).status).toBe('at_risk')
  })

  it('assessRaceReadiness(60, 100) returns needs_attention', () => {
    expect(assessRaceReadiness(60, 100).status).toBe('needs_attention')
  })
})
