import { describe, it, expect, beforeEach } from 'vitest'
import { getOrientationStep } from './orientation.js'

// Mock localStorage for tests
const store = {}
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v },
  removeItem: (k) => { delete store[k] },
  get length() { return Object.keys(store).length },
  key: (i) => Object.keys(store)[i],
}

describe('getOrientationStep', () => {
  beforeEach(() => { Object.keys(store).forEach(k => delete store[k]) })

  it('returns set_profile when profile.sport is missing', () => {
    expect(getOrientationStep([], {}, [])).toBe('set_profile')
  })

  it('returns log_first_session when log is empty and profile is set', () => {
    expect(getOrientationStep([], { sport: 'Run' }, [])).toBe('log_first_session')
  })

  it('returns log_wellness when log exists but no recent wellness', () => {
    const log = [{ date: '2026-01-01', tss: 50 }, { date: '2026-01-02', tss: 60 }, { date: '2026-01-03', tss: 55 }]
    const result = getOrientationStep(log, { sport: 'Run' }, [])
    expect(result).toBe('log_wellness')
  })

  it('returns null when all steps dismissed', () => {
    store['sporeus-oriented-set_profile'] = '1'
    store['sporeus-oriented-log_first_session'] = '1'
    store['sporeus-oriented-log_wellness'] = '1'
    store['sporeus-oriented-run_predictor'] = '1'
    store['sporeus-oriented-view_load'] = '1'
    expect(getOrientationStep([], {}, [])).toBeNull()
  })

  it('set_profile has higher priority than log_first_session', () => {
    // No sport AND empty log — should return set_profile first
    expect(getOrientationStep([], {}, [])).toBe('set_profile')
  })

  // v9.143 — verify the tab-visit-based dismissal now wired in useAppState.handleTabClick
  describe('view_load step', () => {
    function buildEligibleState() {
      const log = Array.from({ length: 8 }, (_, i) => ({ date: `2026-04-${10 + i}`, tss: 50 }))
      const profile = { sport: 'Run' }
      const wellness = [{ date: new Date().toISOString().slice(0, 10), score: 80 }]
      // Suppress earlier-priority steps so we isolate view_load.
      store['sporeus-oriented-log_wellness'] = '1'
      store['sporeus-oriented-run_predictor'] = '1'
      return { log, profile, wellness }
    }

    it('fires when log has 8 entries, dashboard never visited, and not dismissed', () => {
      const { log, profile, wellness } = buildEligibleState()
      expect(getOrientationStep(log, profile, wellness)).toBe('view_load')
    })

    it('is suppressed once sporeus-tab-visited-dashboard is set (the key handleTabClick now writes)', () => {
      const { log, profile, wellness } = buildEligibleState()
      store['sporeus-tab-visited-dashboard'] = '2026-04-18'
      expect(getOrientationStep(log, profile, wellness)).toBeNull()
    })

    it('is suppressed once sporeus-oriented-view_load is set (manual [done] path)', () => {
      const { log, profile, wellness } = buildEligibleState()
      store['sporeus-oriented-view_load'] = '1'
      expect(getOrientationStep(log, profile, wellness)).toBeNull()
    })
  })
})
