// src/lib/__tests__/plan/starterPlan.test.js
//
// v9.95.0 — tests for the onboarding → plan seed.

import { describe, it, expect } from 'vitest'
import { buildStarterPlan, canSeedStarterPlan } from '../../plan/starterPlan.js'

const TODAY = '2026-05-13'

describe('canSeedStarterPlan', () => {
  it('returns false for null/empty/missing-goal inputs', () => {
    expect(canSeedStarterPlan(null)).toBe(false)
    expect(canSeedStarterPlan(undefined)).toBe(false)
    expect(canSeedStarterPlan({})).toBe(false)
    expect(canSeedStarterPlan({ name: 'A', sport: 'Running' })).toBe(false)  // no goal
  })

  it('returns true once goal is set', () => {
    expect(canSeedStarterPlan({ goal: '5K' })).toBe(true)
    expect(canSeedStarterPlan({ goal: 'General Fitness' })).toBe(true)
    expect(canSeedStarterPlan({ goal: 'Marathon', name: 'A' })).toBe(true)
  })
})

describe('buildStarterPlan', () => {
  it('returns null when goal is missing (fast-track exit)', () => {
    const out = buildStarterPlan({ name: 'A', sport: 'Running' }, TODAY)
    expect(out).toBeNull()
  })

  it('returns a complete plan when goal is provided', () => {
    const data = {
      name: 'A', sport: 'Running', goal: 'Half Marathon',
      athleteLevel: 'competitive', maxhr: 185, ftp: 0, ltpace: '4:30',
    }
    const out = buildStarterPlan(data, TODAY)
    expect(out).not.toBeNull()
    expect(out.goal).toBe('Half Marathon')
    expect(out.raceDistance).toBe('Half Marathon')
    expect(out.primarySport).toBe('Running')
    expect(Array.isArray(out.weeks)).toBe(true)
    expect(out.weeks.length).toBeGreaterThan(0)
    expect(out.fromOnboarding).toBe(true)
    expect(out.isAdaptive).toBe(true)
    expect(out.generatedAt).toBe(TODAY)
  })

  it('uses explicit weeks when provided', () => {
    const data = { goal: '5K', sport: 'Running', weeks: 8 }
    const out = buildStarterPlan(data, TODAY)
    expect(out.weeks.length).toBe(8)
  })

  it('derives weeks from raceDate when weeks is missing', () => {
    // Race date ~9 weeks from today
    const raceDate = '2026-07-15'
    const data = { goal: 'Marathon', sport: 'Running', raceDate }
    const out = buildStarterPlan(data, TODAY)
    expect(out.weeks.length).toBeGreaterThanOrEqual(8)
    expect(out.weeks.length).toBeLessThanOrEqual(10)
  })

  it('defaults to 12 weeks when both weeks and raceDate are missing', () => {
    const data = { goal: '10K', sport: 'Running' }
    const out = buildStarterPlan(data, TODAY)
    expect(out.weeks.length).toBe(12)
  })

  it('rejects out-of-range explicit weeks (< 3 → default)', () => {
    const data = { goal: '5K', sport: 'Running', weeks: 2 }
    const out = buildStarterPlan(data, TODAY)
    expect(out.weeks.length).toBe(12)  // falls back to default
  })

  it('rejects out-of-range explicit weeks (> 52 → default)', () => {
    const data = { goal: 'Marathon', sport: 'Running', weeks: 100 }
    const out = buildStarterPlan(data, TODAY)
    expect(out.weeks.length).toBe(12)  // falls back to default
  })

  it('Cycling sport routes through distance-aware generator', () => {
    const data = { goal: 'Cycling Event', sport: 'Cycling', ftp: 250 }
    const out = buildStarterPlan(data, TODAY)
    expect(out.primarySport).toBe('Cycling')
    expect(out.raceDistance).toBe('Cycling Event')
    // Cycling labels should appear somewhere in the plan
    const allTypes = out.weeks.flatMap(w => w.sessions.map(s => s.type))
    const cyclingLabels = ['Long ride', 'Tempo ride', 'Power intervals', 'Recovery spin', 'FTP test']
    expect(cyclingLabels.some(l => allTypes.includes(l))).toBe(true)
  })

  it('Turkish lang emits Turkish session labels', () => {
    const data = { goal: '10K', sport: 'Running' }
    const out = buildStarterPlan(data, TODAY, 'tr')
    const allTypes = out.weeks.flatMap(w => w.sessions.map(s => s.type))
    const trLabels = ['Uzun koşu', 'Tempo koşu', 'İnterval koşu', 'Toparlanma koşusu']
    expect(trLabels.some(l => allTypes.includes(l))).toBe(true)
  })

  it('uses data.athleteLevel when present', () => {
    const data = { goal: '5K', sport: 'Running', athleteLevel: 'advanced' }
    const out = buildStarterPlan(data, TODAY)
    expect(out.level).toBe('advanced')
  })

  it('falls back to data.level for backwards-compat', () => {
    const data = { goal: '5K', sport: 'Running', level: 'Beginner' }
    const out = buildStarterPlan(data, TODAY)
    expect(out.level).toBe('Beginner')
  })

  it('hoursPerWeek scales with availableDays (default 5 → 8)', () => {
    const data = { goal: '5K', sport: 'Running' }
    const out = buildStarterPlan(data, TODAY)
    // availableDays default = 5; hoursPerWeek = max(3, round(5*1.5)) = 8
    expect(out.hoursPerWeek).toBe(8)
  })

  it('honors data.trainDays when in [2, 7] range', () => {
    const data = { goal: '5K', sport: 'Running', trainDays: 6 }
    const out = buildStarterPlan(data, TODAY)
    expect(out.hoursPerWeek).toBe(9)  // round(6*1.5) = 9
  })

  it('plan includes a Base phase early (sanity)', () => {
    const data = { goal: '10K', sport: 'Running' }
    const out = buildStarterPlan(data, TODAY)
    const earlyPhases = out.weeks.slice(0, 3).map(w => w.phase)
    expect(earlyPhases).toContain('Base')
  })

  it('plan includes Taper or Race phase at the end (sanity)', () => {
    const data = { goal: '10K', sport: 'Running' }
    const out = buildStarterPlan(data, TODAY)
    const latePhases = out.weeks.slice(-2).map(w => w.phase)
    expect(['Taper', 'Race'].some(p => latePhases.includes(p))).toBe(true)
  })

  it('General Fitness goal still produces a valid plan', () => {
    const data = { goal: 'General Fitness', sport: 'Running' }
    const out = buildStarterPlan(data, TODAY)
    expect(out).not.toBeNull()
    expect(out.weeks.length).toBe(12)
  })

  it('respects data.primarySport when sport is absent (mirror)', () => {
    const data = { goal: '5K', primarySport: 'Cycling' }
    const out = buildStarterPlan(data, TODAY)
    expect(out.primarySport).toBe('Cycling')
  })

  // ── v9.97.0 (Prompt I) — currentCTL anchored on log when available ──────
  it('empty log → currentCTL floors at 20 (matches v9.95 behavior)', () => {
    const data = { goal: '5K', sport: 'Running' }
    // We can't observe currentCTL directly from the plan output (it's internal
    // to generatePlan), but the plan's first-week weeklyTSS should match the
    // 20-CTL baseline. Compare against a no-log call to ensure they match.
    const noLog = buildStarterPlan(data, TODAY)
    const emptyLog = buildStarterPlan(data, TODAY, 'en', [])
    expect(emptyLog.weeks[0].tss).toBe(noLog.weeks[0].tss)
  })

  it('log with recent training raises weekly TSS baseline above 20-CTL plan', () => {
    // 14 days of 80 TSS → CTL settles ~30-35. Should produce a plan with
    // strictly higher week-1 weeklyTSS than the empty-log baseline.
    const data = { goal: '10K', sport: 'Running' }
    const log = []
    for (let i = 1; i <= 14; i++) {
      const d = new Date(TODAY + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), type: 'Easy run', tss: 80 })
    }
    const baseline = buildStarterPlan(data, TODAY, 'en', [])
    const withLog  = buildStarterPlan(data, TODAY, 'en', log)
    expect(withLog.weeks[0].tss).toBeGreaterThan(baseline.weeks[0].tss)
  })

  it('log arg is optional (back-compat with pre-v9.97 callers)', () => {
    // Calls without the log arg must still work
    const out = buildStarterPlan({ goal: '5K', sport: 'Running' }, TODAY, 'en')
    expect(out).not.toBeNull()
    expect(out.weeks.length).toBeGreaterThan(0)
  })

  it('log array with non-numeric tss entries is handled (calcLoad-safe)', () => {
    const data = { goal: '5K', sport: 'Running' }
    const log = [
      { date: '2026-05-12', type: 'Walk' },  // no tss
      { date: '2026-05-11', tss: 'invalid' },
    ]
    const out = buildStarterPlan(data, TODAY, 'en', log)
    expect(out).not.toBeNull()
    // Should still produce a valid plan with the 20-CTL floor
  })

  // ── v9.98.0 (Prompt L) — Page-refresh survival via JSON round-trip ───────
  describe('localStorage round-trip survival', () => {
    function roundTrip(plan) {
      return JSON.parse(JSON.stringify(plan))
    }

    it('weeks.length survives round-trip', () => {
      const plan = buildStarterPlan({ goal: '10K', sport: 'Running' }, TODAY)
      const restored = roundTrip(plan)
      expect(restored.weeks.length).toBe(plan.weeks.length)
    })

    it('generatedAt survives round-trip as ISO string', () => {
      const plan = buildStarterPlan({ goal: '10K', sport: 'Running' }, TODAY)
      const restored = roundTrip(plan)
      expect(restored.generatedAt).toBe(plan.generatedAt)
      expect(restored.generatedAt).toBe(TODAY)
    })

    it('primarySport survives round-trip', () => {
      const plan = buildStarterPlan({ goal: 'Cycling Event', sport: 'Cycling' }, TODAY)
      const restored = roundTrip(plan)
      expect(restored.primarySport).toBe('Cycling')
    })

    it('raceDistance + level + hoursPerWeek survive round-trip', () => {
      const plan = buildStarterPlan(
        { goal: 'Marathon', sport: 'Running', athleteLevel: 'advanced', trainDays: 6 },
        TODAY,
      )
      const restored = roundTrip(plan)
      expect(restored.raceDistance).toBe('Marathon')
      expect(restored.level).toBe('advanced')
      expect(restored.hoursPerWeek).toBe(9)  // round(6 * 1.5)
    })

    it('isAdaptive + fromOnboarding survive round-trip', () => {
      const plan = buildStarterPlan({ goal: '5K', sport: 'Running' }, TODAY)
      const restored = roundTrip(plan)
      expect(restored.isAdaptive).toBe(true)
      expect(restored.fromOnboarding).toBe(true)
    })

    it('weeks[].sessions[].tss field name survives (planAdaptation depends on it)', () => {
      const plan = buildStarterPlan({ goal: '10K', sport: 'Running' }, TODAY)
      const restored = roundTrip(plan)
      let hasTss = false
      for (const wk of restored.weeks) {
        for (const s of wk.sessions) {
          if (s.type !== 'Rest' && typeof s.tss === 'number') { hasTss = true; break }
        }
      }
      expect(hasTss).toBe(true)
    })

    it('serialized plan is < 100KB (localStorage quota safety)', () => {
      // localStorage typical limit is 5-10MB; we want plans under 100KB so
      // 50+ plans fit comfortably. 12-week plan is the typical worst case.
      const plan = buildStarterPlan(
        { goal: 'Marathon', sport: 'Running', weeks: 52 },  // largest reasonable
        TODAY,
      )
      const serialized = JSON.stringify(plan)
      expect(serialized.length).toBeLessThan(100_000)
    })
  })
})
