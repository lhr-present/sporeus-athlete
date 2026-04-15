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
})
