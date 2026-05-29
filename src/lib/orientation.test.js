// orientation.test.js — getOrientationStep decides the next new-athlete nudge.
// Pure logic + localStorage (dismissals, test-results, tab-visited) + a
// 3-day wellness recency window. Node env, so stub localStorage.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getOrientationStep, ORIENTATION_MESSAGES } from './orientation.js'

// run_predictor does `Object.keys(localStorage).filter(...)`. Real localStorage
// returns STORED keys from Object.keys (methods live on the prototype). So the
// stub stores values as own-ENUMERABLE props and defines methods NON-enumerable,
// matching real behavior — otherwise Object.keys would never see stored keys.
const ls = {}
Object.defineProperties(ls, {
  getItem:    { value: k => (Object.prototype.hasOwnProperty.call(ls, k) ? ls[k] : null), enumerable: false },
  setItem:    { value: (k, v) => { ls[k] = String(v) }, enumerable: false },
  removeItem: { value: k => { delete ls[k] }, enumerable: false },
  clear:      { value: () => Object.keys(ls).forEach(k => delete ls[k]), enumerable: false },
})
vi.stubGlobal('localStorage', ls)

const profileWithSport = { sport: 'Running' }
const recentWellness = [{ date: new Date().toISOString().slice(0, 10) }]
function makeLog(n) { return Array.from({ length: n }, (_, i) => ({ date: `2026-05-${String(i + 1).padStart(2, '0')}`, tss: 50 })) }

beforeEach(() => { localStorage.clear() })

describe('getOrientationStep — priority order', () => {
  it('set_profile wins when sport is missing (even if everything else is also incomplete)', () => {
    expect(getOrientationStep([], {}, [])).toBe('set_profile')
  })

  it('log_first_session when sport set but log empty', () => {
    expect(getOrientationStep([], profileWithSport, recentWellness)).toBe('log_first_session')
  })

  it('log_wellness when sport+log present but no recent wellness', () => {
    expect(getOrientationStep(makeLog(2), profileWithSport, [])).toBe('log_wellness')
  })

  it('returns null when fully oriented (sport, log≥7, recent wellness, dashboard visited, test results saved)', () => {
    localStorage.setItem('sporeus-test-results-running', '[]')
    localStorage.setItem('sporeus-tab-visited-dashboard', '1')
    expect(getOrientationStep(makeLog(8), profileWithSport, recentWellness)).toBeNull()
  })
})

describe('getOrientationStep — wellness 3-day window', () => {
  it('recent wellness (today) satisfies the wellness step → moves past it', () => {
    // log≥3, no test results → next unmet is run_predictor
    const r = getOrientationStep(makeLog(3), profileWithSport, recentWellness)
    expect(r).toBe('run_predictor')
  })

  it('wellness older than 3 days does NOT satisfy → log_wellness', () => {
    const old = new Date(); old.setDate(old.getDate() - 5)
    const stale = [{ date: old.toISOString().slice(0, 10) }]
    expect(getOrientationStep(makeLog(3), profileWithSport, stale)).toBe('log_wellness')
  })

  it('accepts created_at as the wellness date field too', () => {
    const r = getOrientationStep(makeLog(3), profileWithSport, [{ created_at: new Date().toISOString() }])
    expect(r).toBe('run_predictor')  // wellness satisfied via created_at
  })
})

describe('getOrientationStep — dismissals', () => {
  it('a dismissed step is skipped and falls through to the next unmet step', () => {
    localStorage.setItem('sporeus-oriented-set_profile', '1')
    // sport still missing, but set_profile dismissed → next unmet is log_first_session
    expect(getOrientationStep([], {}, [])).toBe('log_first_session')
  })

  it('dismissing multiple steps cascades correctly', () => {
    localStorage.setItem('sporeus-oriented-set_profile', '1')
    localStorage.setItem('sporeus-oriented-log_first_session', '1')
    expect(getOrientationStep([], {}, [])).toBe('log_wellness')
  })
})

describe('getOrientationStep — run_predictor & view_load gates', () => {
  it('run_predictor requires log≥3 (not shown at log=2)', () => {
    // log=2, recent wellness → wellness satisfied, run_predictor gated off (log<3) → view_load gated off → null
    expect(getOrientationStep(makeLog(2), profileWithSport, recentWellness)).toBeNull()
  })

  it('view_load when log≥7, test results saved, dashboard NOT visited', () => {
    localStorage.setItem('sporeus-test-results-x', '[]')  // satisfies run_predictor
    expect(getOrientationStep(makeLog(7), profileWithSport, recentWellness)).toBe('view_load')
  })

  it('view_load suppressed once dashboard visited', () => {
    localStorage.setItem('sporeus-test-results-x', '[]')
    localStorage.setItem('sporeus-tab-visited-dashboard', '1')
    expect(getOrientationStep(makeLog(7), profileWithSport, recentWellness)).toBeNull()
  })
})

describe('ORIENTATION_MESSAGES completeness', () => {
  const stepKeys = ['set_profile', 'log_first_session', 'log_wellness', 'run_predictor', 'view_load']
  it('every step key has en, tr, and tab', () => {
    for (const k of stepKeys) {
      expect(ORIENTATION_MESSAGES[k], `missing message for ${k}`).toBeTruthy()
      expect(ORIENTATION_MESSAGES[k].en, `${k}.en`).toBeTruthy()
      expect(ORIENTATION_MESSAGES[k].tr, `${k}.tr`).toBeTruthy()
      expect(ORIENTATION_MESSAGES[k].tab, `${k}.tab`).toBeTruthy()
    }
  })
})
