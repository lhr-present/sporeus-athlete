// @vitest-environment jsdom
// ─── CoachingInsightsDigest.test.jsx — render tests for the digest card ──────
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CoachingInsightsDigest from '../dashboard/CoachingInsightsDigest.jsx'

// ─── Render helper with overridable lang ─────────────────────────────────────
function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <CoachingInsightsDigest {...props} />
    </LangCtx.Provider>
  )
}

// ─── Date helpers (anchored to "today") ──────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function isoWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dow = d.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

// ─── Synthetic log builders ──────────────────────────────────────────────────
// Healthy mix: covers all 5 zones AND all 5 session intents AND ≤1 hard day/wk.
// Cycle through 7-day templates that include recovery, long, steady, tempo, intervals.
function buildHealthyLog() {
  const today = todayStr()
  const w4Start = isoWeekStart(today)
  const w1Start = addDays(w4Start, -21)
  const log = []
  // Per-week template (Mon..Sun): recovery, steady, recovery, steady, long, tempo, intervals
  // Hard days (RPE>=6): Sat (tempo) + Sun (intervals) → 2 hard/wk → flagged.
  // We need ≤1 hard day/wk to keep density low. Move tempo to RPE 5 steady.
  // Keep one intervals/wk → 1 hard day/wk → unflagged.
  // Zones tuned to polarized template (28/56/7/7/4) so timeInZone band='good'.
  const templates = [
    // Mon: recovery (RPE 3, 60min, Z1-heavy)
    { rpe: 3, duration: 60, zones: [70, 28, 1, 1, 0] },
    // Tue: steady (RPE 5, 75min)
    { rpe: 5, duration: 75, zones: [25, 65, 4, 4, 2] },
    // Wed: recovery (RPE 2, 40min, Z1-heavy)
    { rpe: 2, duration: 40, zones: [70, 25, 3, 1, 1] },
    // Thu: steady (RPE 5, 75min)
    { rpe: 5, duration: 75, zones: [25, 65, 4, 4, 2] },
    // Fri: long (RPE 5, 120min)
    { rpe: 5, duration: 120, zones: [25, 70, 3, 1, 1] },
    // Sat: tempo (RPE 6, 50min, Z3-dominant) — counts as hard
    { rpe: 6, duration: 50, zones: [5, 15, 50, 20, 10] },
    // Sun: easy (RPE 4) — keep total hard days/wk = 1 (just Sat)
    { rpe: 4, duration: 50, zones: [25, 65, 4, 4, 2] },
  ]
  for (let w = 0; w < 4; w++) {
    const weekStart = addDays(w1Start, w * 7)
    for (let d = 0; d < 7; d++) {
      // Skip Wednesday (d=2) so each week has one full rest day. This keeps
      // streakDetector's currentStreak < 7 → 'celebrating' band but below the
      // 7-day positive headline threshold, so the all-green path stays clean.
      if (d === 2) continue
      const date = addDays(weekStart, d)
      const t = templates[d]
      log.push({
        date,
        type: 'run',
        rpe: t.rpe,
        duration: t.duration,
        zones: t.zones.slice(),
      })
    }
  }
  // Add an intervals session each week to ensure all 5 intents present.
  // Replace each week's Sun easy entry with an intervals session.
  // intervals: RPE 8, duration 45min. Z5 share targets ≥5% over 28 days so
  // staleZones stays healthy. Note: this lifts Z5 minutes above the polarized
  // 4% target, so timeInZone band may register 'moderate' with worstZone=Z5
  // (over) — that case is silent in the digest synthesis (rule 18 only fires
  // for Z2-under), so the all-green path is preserved.
  for (let w = 0; w < 4; w++) {
    const weekStart = addDays(w1Start, w * 7)
    const sun = addDays(weekStart, 6)
    const idx = log.findIndex(e => e.date === sun)
    if (idx >= 0) {
      log[idx] = {
        date: sun,
        type: 'run',
        rpe: 8,
        duration: 45,
        zones: [5, 15, 25, 25, 30],
      }
    }
  }
  // Now there are 2 hard days/wk (Sat tempo RPE 6 + Sun intervals RPE 8) → flagged.
  // Drop the tempo to RPE 5 with Z2-heavy to keep it under hard-threshold but still
  // maintain "tempo" intent? No — tempo classification needs RPE 6-7. We need
  // tempo present somewhere across the 28 days. Keep ONE tempo session (week 4
  // only) and downgrade the rest to steady. That gives 28d intents = all 5,
  // but only 1 hard day/wk in weeks 1-3 and 2 hard/wk in week 4 → not consecutive
  // flagged → still low risk.
  for (let w = 0; w < 3; w++) {
    const weekStart = addDays(w1Start, w * 7)
    const sat = addDays(weekStart, 5)
    const idx = log.findIndex(e => e.date === sat)
    if (idx >= 0) {
      log[idx] = {
        date: sat,
        type: 'run',
        rpe: 5,
        duration: 60,
        zones: [25, 65, 4, 4, 2],
      }
    }
  }
  return log
}

function buildHighDensityLog() {
  // 4 hard days/wk for 4 weeks → consecutiveFlagged ≥ 2 → high risk.
  const today = todayStr()
  const w4Start = isoWeekStart(today)
  const w1Start = addDays(w4Start, -21)
  const log = []
  for (let w = 0; w < 4; w++) {
    const weekStart = addDays(w1Start, w * 7)
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d)
      // 5 hard days (Mon..Fri), 2 easy days (Sat..Sun)
      const hard = d < 5
      log.push({
        date,
        type: 'run',
        rpe: hard ? 8 : 4,
        duration: 60,
        zones: hard ? [0, 10, 10, 60, 20] : [10, 70, 10, 5, 5],
      })
    }
  }
  return log
}

function buildStaleZ5Log() {
  // 28 days of Z2-only → Z5 stale, density low (RPE 4), variety low.
  const today = todayStr()
  const log = []
  for (let i = 27; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      zones: [10, 80, 5, 3, 2],
    })
  }
  return log
}

function buildLowVarietyOnlyLog() {
  // Mostly steady-only sessions, every zone present (>=5%) but density low.
  // Z2-dominant with a small slice of every other zone so no zone is stale,
  // RPE 5 → not hard → density low, only "steady" intent → variety low.
  const today = todayStr()
  const log = []
  for (let i = 27; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      zones: [10, 60, 10, 10, 10],
    })
  }
  return log
}

// ─── New-detector synthetic logs ─────────────────────────────────────────────

// Spiking fitness: long flat history at low TSS, then a sharp 28-day TSS ramp
// pushes CTL slope > +2.0/week. Otherwise healthy (all 5 zones, ≤1 hard/wk,
// easy days compliant) so the digest surfaces fitness-spiking, not density.
function buildSpikingFitnessLog() {
  const today = todayStr()
  const log = []
  // 180-day prime at flat low load → CTL ~10
  for (let i = 207; i >= 28; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 4,
      duration: 60,
      tss: 30,
      zones: [10, 80, 5, 3, 2],
    })
  }
  // 28-day spike: ramp TSS aggressively (200 → 400) so CTL/week > +2
  for (let i = 27; i >= 0; i--) {
    const dayIdx = 27 - i
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 90,
      tss: 200 + dayIdx * 8, // 200..416
      zones: [10, 80, 5, 3, 2],
    })
  }
  return log
}

// Detraining fitness: long flat-high history then 28 days of zero-TSS / no
// activity in the window so CTL slope < -1.0/week. Trailing-window zones are
// tuned so all 5 zones have ≥5% share (no staleZones flag) and timeInZone
// produces 'moderate' worstZone Z5-over (silent — rule 18 fires only on
// Z2-under) — preserving the fitness-detraining headline in the rotation.
function buildDetrainingFitnessLog() {
  const today = todayStr()
  const log = []
  // 180 days of high TSS pre-window → CTL ~150
  for (let i = 207; i >= 28; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 90,
      tss: 200,
      zones: [10, 80, 5, 3, 2],
    })
  }
  // Trailing 28 days: keep daily logs (so reliable=true) but tss=0 → CTL decays
  for (let i = 27; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 3,
      duration: 30,
      tss: 0,
      zones: [25, 55, 8, 7, 5],
    })
  }
  return log
}

// Poor easy-day compliance: enough easy-labeled sessions but most drift via
// zone share (Z3+Z4+Z5 = 25% > 20% drift threshold, but < 40% so density
// does NOT flag those days as hard). Density stays low (only 1 hard day/wk
// via the Sun intervals), variety covers multiple intents.
function buildPoorEasyComplianceLog() {
  const today = todayStr()
  const w4Start = isoWeekStart(today)
  const w1Start = addDays(w4Start, -21)
  const log = []
  // Drift template: labeled-easy via type/intent, RPE 5 (not >5 so RPE alone
  // isn't drift), but Z3+Z4+Z5 share = 25% → drift via zones.
  // 25% < 40% so workoutDensity does NOT consider them hard.
  const driftEasy = { type: 'recovery', intent: 'recovery', rpe: 5, duration: 45,
                      zones: [10, 65, 15, 5, 5] }
  const longEasy  = { type: 'long',     intent: 'long',     rpe: 5, duration: 120,
                      zones: [10, 75, 10, 3, 2] }
  // Sun: intervals → not labeled easy, 1 hard day/wk only.
  const intervals = { type: 'intervals', rpe: 8, duration: 45,
                      zones: [0, 10, 20, 40, 30] }
  const templates = [
    driftEasy, driftEasy, driftEasy, driftEasy, driftEasy, longEasy, intervals,
  ]
  for (let w = 0; w < 4; w++) {
    const weekStart = addDays(w1Start, w * 7)
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d)
      const t = templates[d]
      log.push({
        date,
        type: t.type,
        intent: t.intent,
        rpe: t.rpe,
        duration: t.duration,
        zones: t.zones.slice(),
      })
    }
  }
  return log
}

// ─── Fixtures for new detectors (detraining / monotony / vo2 / streak) ───────

// Detraining inActiveGap (major): 25 days of training spanning days -60..-25,
// then NO entries for the trailing 25 days → currentGap = 25 → 'major' band.
function buildDetrainingGapLog() {
  const today = todayStr()
  const log = []
  // 25 entries from day -60 to day -36 (one per day)
  for (let i = 60; i >= 36; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      zones: [10, 80, 5, 3, 2],
    })
  }
  return log
}

// Monotony high: 7 daily entries, near-uniform TSS → very high monotony.
// Plus older sparse entries so stale/density/variety/etc don't surface as
// "moderate" in a way that would crowd out the monotony headline. Setting all
// 7 days near the same TSS keeps monotony >> 2.0 and strain comfortably above
// the 6000 threshold to be safe.
function buildMonotonyHighLog() {
  const today = todayStr()
  const log = []
  // 7 daily entries with near-identical TSS (one slight perturbation so stdev
  // is non-zero — required by detector's `if (stdev > 0)` guard).
  const tssDaily = [600, 600, 600, 600, 600, 600, 590]
  for (let i = 6; i >= 0; i--) {
    const dayIdx = 6 - i
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 7,
      duration: 90,
      tss: tssDaily[dayIdx],
      zones: [10, 50, 20, 15, 5],
    })
  }
  return log
}

// VO2 gap severe: 28-day window with last Z5 session 24 days ago → severe band
// (recency > 21). Entries every day so vo2Gap is reliable (≥14 distinct days).
function buildVO2GapSevereLog() {
  const today = todayStr()
  const log = []
  for (let i = 27; i >= 0; i--) {
    const isLastZ5 = i === 24
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      // Day -24 has Z5; all other days are Z2-heavy with no Z5
      zones: isLastZ5 ? [5, 50, 20, 15, 10] : [10, 80, 8, 2, 0],
    })
  }
  return log
}

// Streak risk: 25 consecutive training days ending today → currentStreak ≥ 22
// → 'risk' band. Span = 25 days → reliable. Zones tuned so all 5 zones have
// ≥5% share (no staleZones flag) and timeInZone produces 'moderate' worstZone
// Z5-over (silent in synthesis — only Z2-under fires rule 18) — keeping the
// streak-risk headline in the top-3 rotation.
function buildStreakRiskLog() {
  const today = todayStr()
  const log = []
  for (let i = 24; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 50,
      zones: [25, 55, 8, 7, 5],
    })
  }
  return log
}

// Streak celebrating ≥7d: build a 7-day streak ending today, with older
// entries spread across day -20..-8 (every-other-day) so allDates span ≥14
// (reliable=true), but those older entries are NOT consecutive with the recent
// 7-day streak (so currentStreak = 7, not larger).
function buildStreakCelebrating7Log() {
  const today = todayStr()
  const log = []
  // Older sparse entries so reliable=true (span ≥ 14d) but no recent streak.
  for (let i = 20; i >= 8; i -= 2) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 50,
      zones: [10, 70, 10, 5, 5],
    })
  }
  // Recent 7-day streak: today, today-1, ..., today-6 (all training)
  for (let i = 6; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 50,
      zones: [10, 70, 10, 5, 5],
    })
  }
  return log
}

// Insufficient-data log: 4 entries spread over 4 days. Each new detector
// returns reliable=false, so none of the new detectors should surface a
// headline (even if their bands would otherwise qualify).
//   - detraining: log.length=4 < 14         → unreliable
//   - monotony:   distinctLoggedDays=4 < 5  → unreliable
//   - vo2Gap:     distinctDays=4 < 14       → unreliable
//   - streak:     span=4 < 14               → unreliable
function buildShortLog() {
  const today = todayStr()
  const log = []
  for (let i = 3; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 50,
      zones: [10, 70, 10, 5, 5],
    })
  }
  return log
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('CoachingInsightsDigest — empty state', () => {
  it('renders empty state when log is empty (no detector reliable)', () => {
    renderCard({ log: [] })
    expect(
      screen.getByText(/Log 14\+ days of training to unlock coaching insights/i)
    ).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — all-green state', () => {
  it('shows ✓ + healthy message when all detectors are green', () => {
    const log = buildHealthyLog()
    renderCard({ log })
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(screen.getByText(/All training metrics healthy/i)).toBeInTheDocument()
  })

  it('all-green state has role=status', () => {
    const log = buildHealthyLog()
    renderCard({ log })
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — high density risk', () => {
  it('surfaces a density insight at the top with red bullet for high risk', () => {
    const log = buildHighDensityLog()
    renderCard({ log })
    // Density insight present
    expect(screen.getByText(/consecutive weeks of 4\+ hard days/i)).toBeInTheDocument()
    // Red bullet visible
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('🔴')
    // DENSITY badge
    expect(screen.getByText('DENSITY')).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — stale zones', () => {
  it('surfaces a stale-zone insight when Z5 (and others) are stale', () => {
    const log = buildStaleZ5Log()
    renderCard({ log })
    // Stale message visible — Z1, Z3, Z4, Z5 are all stale; surface the first
    expect(screen.getByText(/has been neglected for 28 days/i)).toBeInTheDocument()
    expect(screen.getByText('STALE')).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — low variety', () => {
  it('surfaces a variety insight when only steady sessions are logged', () => {
    const log = buildLowVarietyOnlyLog()
    renderCard({ log })
    expect(screen.getByText(/session types in last 28 days/i)).toBeInTheDocument()
    expect(screen.getByText('VARIETY')).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — capping', () => {
  it('caps insights at 3 rows maximum', () => {
    // High-density log triggers density-high + stale zones (4 zones stale) +
    // variety-low (only intervals intent classified). Total raw insights ≥ 3.
    const log = buildHighDensityLog()
    renderCard({ log })
    const rows = screen.getAllByRole('listitem')
    expect(rows.length).toBeLessThanOrEqual(3)
  })
})

describe('CoachingInsightsDigest — bilingual', () => {
  it('renders TR labels and copy when lang=tr', () => {
    const log = buildHighDensityLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText('YOĞUNLUK')).toBeInTheDocument()
    // TR card title
    expect(screen.getByText('ANTRENÖR İÇGÖRÜLERİ')).toBeInTheDocument()
  })

  it('renders TR empty-state copy when lang=tr', () => {
    renderCard({ log: [] }, 'tr')
    expect(
      screen.getByText(/Antrenman içgörüleri için 14\+ gün antrenman kaydet/i)
    ).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — a11y', () => {
  it('card root has role=region with bilingual aria-label', () => {
    const log = buildHighDensityLog()
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Coaching insights/i)
  })

  it('each insight row exposes its own aria-label with severity + source + message', () => {
    const log = buildHighDensityLog()
    renderCard({ log })
    const rows = screen.getAllByRole('listitem')
    expect(rows.length).toBeGreaterThan(0)
    rows.forEach(r => {
      const label = r.getAttribute('aria-label')
      expect(label).toBeTruthy()
      expect(label).toMatch(/priority/i)
    })
  })
})

describe('CoachingInsightsDigest — citation', () => {
  it('renders the combined citation footer (all 5 detector sources)', () => {
    const log = buildHighDensityLog()
    renderCard({ log })
    expect(
      screen.getByText(
        /Seiler 2010; Foster 2001; Gabbett 2016; Banister 1991; Stöggl & Sperlich 2014/
      )
    ).toBeInTheDocument()
  })
})

// ─── New-detector tests (fitnessGainRate + easyDayCompliance) ────────────────
describe('CoachingInsightsDigest — fitness gain rate', () => {
  it('surfaces a high-priority fitness insight when CTL is spiking', () => {
    const log = buildSpikingFitnessLog()
    renderCard({ log })
    // Spiking message visible
    expect(screen.getByText(/Fitness spiking:/i)).toBeInTheDocument()
    // FITNESS source badge visible
    expect(screen.getByText('FITNESS')).toBeInTheDocument()
    // Red bullet (high severity) somewhere in the region
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('🔴')
  })

  it('surfaces a moderate fitness insight when detraining', () => {
    const log = buildDetrainingFitnessLog()
    renderCard({ log })
    expect(screen.getByText(/Fitness declining:/i)).toBeInTheDocument()
    expect(screen.getByText('FITNESS')).toBeInTheDocument()
    // Moderate severity → yellow bullet
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('🟡')
  })
})

describe('CoachingInsightsDigest — easy-day compliance', () => {
  it('surfaces a moderate-priority insight when easy-day compliance is poor', () => {
    const log = buildPoorEasyComplianceLog()
    renderCard({ log })
    expect(screen.getByText(/easy-day compliance — too hard too often/i)).toBeInTheDocument()
    expect(screen.getByText('EASY DAYS')).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — capping (multi-detector)', () => {
  it('caps total rows at 3 even when many detectors fire', () => {
    // Spiking fitness + tempo-only (low variety) + zones unbalanced.
    // Should still show ≤ 3 rows.
    const log = buildSpikingFitnessLog()
    renderCard({ log })
    const rows = screen.getAllByRole('listitem')
    expect(rows.length).toBeLessThanOrEqual(3)
  })
})

describe('CoachingInsightsDigest — bilingual new badges', () => {
  it('renders FORM (TR) for the FITNESS source badge', () => {
    const log = buildSpikingFitnessLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText('FORM')).toBeInTheDocument()
  })

  it('renders KOLAY GÜNLER (TR) for the EASY DAYS source badge', () => {
    const log = buildPoorEasyComplianceLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText('KOLAY GÜNLER')).toBeInTheDocument()
  })
})

// ─── New-detector tests (detraining / monotony / vo2Gap / streak) ────────────
describe('CoachingInsightsDigest — detraining gap', () => {
  it('surfaces a high-priority GAP headline when athlete is in an active major gap', () => {
    const log = buildDetrainingGapLog()
    renderCard({ log })
    // GAP source badge present
    expect(screen.getByText('GAP')).toBeInTheDocument()
    // Detector recommendation copy for major gap mentions a 2-week base block
    expect(screen.getByText(/2-week aerobic base block/i)).toBeInTheDocument()
    // Red bullet (high severity) for severe/major
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('🔴')
  })

  it('renders ARA (TR) and Turkish recommendation copy when lang=tr', () => {
    const log = buildDetrainingGapLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText('ARA')).toBeInTheDocument()
    expect(screen.getByText(/2 hafta aerobik temel bloku/i)).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — monotony high', () => {
  it('surfaces a high-priority MONOTONY headline when 7-day monotony band is high', () => {
    const log = buildMonotonyHighLog()
    renderCard({ log })
    expect(screen.getByText('MONOTONY')).toBeInTheDocument()
    expect(screen.getByText(/Overtraining risk — add a recovery day/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('🔴')
  })

  it('renders MONOTONLUK (TR) for the Turkish locale', () => {
    const log = buildMonotonyHighLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText('MONOTONLUK')).toBeInTheDocument()
    expect(screen.getByText(/Aşırı antrenman riski/i)).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — vo2 gap', () => {
  it('surfaces a high-priority VO2 headline when Z5 work has been absent for >21 days', () => {
    const log = buildVO2GapSevereLog()
    renderCard({ log })
    expect(screen.getByText('VO2')).toBeInTheDocument()
    // Severe band copy mentions VO2max gap / top-end fitness
    expect(screen.getByText(/Prolonged VO2max gap/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('🔴')
  })

  it('renders the VO2 source badge unchanged in TR locale (acronym)', () => {
    const log = buildVO2GapSevereLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText('VO2')).toBeInTheDocument()
    expect(screen.getByText(/Uzun süreli VO2max boşluğu/i)).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — streak risk', () => {
  it('surfaces a STREAK headline urging a rest day when streak ≥ 22 with no rest', () => {
    const log = buildStreakRiskLog()
    renderCard({ log })
    expect(screen.getByText('STREAK')).toBeInTheDocument()
    // Detector message mentions scheduling a rest day (N-day streak — schedule a rest day)
    expect(screen.getByText(/streak — schedule a rest day/i)).toBeInTheDocument()
  })

  it('renders SERİ (TR) for the Turkish streak-risk headline', () => {
    const log = buildStreakRiskLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText('SERİ')).toBeInTheDocument()
    expect(screen.getByText(/dinlenme günü planla/i)).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — streak celebrating (positive)', () => {
  it('surfaces a positive STREAK headline when currentStreak is exactly 7 days', () => {
    const log = buildStreakCelebrating7Log()
    renderCard({ log })
    expect(screen.getByText('STREAK')).toBeInTheDocument()
    expect(screen.getByText(/7-day streak — building habit/i)).toBeInTheDocument()
    // Positive headline uses the green bullet
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('🟢')
  })
})

describe('CoachingInsightsDigest — reliability gating', () => {
  it('does not surface any new-detector headlines when all 4 are unreliable', () => {
    const log = buildShortLog()
    renderCard({ log })
    // None of the new source badges should appear
    expect(screen.queryByText('GAP')).not.toBeInTheDocument()
    expect(screen.queryByText('MONOTONY')).not.toBeInTheDocument()
    expect(screen.queryByText('VO2')).not.toBeInTheDocument()
    expect(screen.queryByText('STREAK')).not.toBeInTheDocument()
  })
})

// ─── v8.77.0 fixtures: sessionRPEDrift + recoveryDebt ───────────────────────

// recoveryDebt overreached: requires cumulativeDeficit ≥ 400 OR
// maxConsecutiveNegativeDays ≥ 14. Build 60 days of moderate base load (so
// CTL warms up) then 28 days of high daily TSS (180/day) so ATL ramps far
// above CTL → TSB strongly negative every day in the window.
function buildRecoveryDebtOverreachedLog() {
  const today = todayStr()
  const log = []
  // Pre-window seed: 60 days of moderate load to warm CTL ~50
  for (let i = 87; i >= 28; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 50,
      zones: [10, 70, 10, 5, 5],
    })
  }
  // 28-day window: very high daily TSS so ATL >> CTL → TSB deeply negative
  for (let i = 27; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 6,
      duration: 90,
      tss: 180,
      zones: [10, 60, 15, 10, 5],
    })
  }
  return log
}

// recoveryDebt fatigued: currentTSB ≤ -25 OR cumulativeDeficit ≥ 250 (and
// not overreached → deficit < 400 AND maxConsecutiveNegDays < 14).
// 60-day pre-window seed at moderate TSS, then 23 in-window days at the same
// load (TSB ≈ 0), then a 5-day tail at elevated TSS so ATL spikes past CTL
// → currentTSB ~ -38, deficit ~ 350, maxConsecutiveNegDays ~ 7 → fatigued.
function buildRecoveryDebtFatiguedLog() {
  const today = todayStr()
  const log = []
  // Pre-window seed: 60 days of moderate load → CTL warms ~50
  for (let i = 87; i >= 28; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 50,
      zones: [10, 75, 10, 3, 2],
    })
  }
  // First 23 in-window days: same moderate load → TSB stays near 0
  for (let i = 27; i >= 5; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 50,
      zones: [10, 75, 10, 3, 2],
    })
  }
  // Last 5 days: elevated load → ATL spikes, TSB drops into fatigued band
  for (let i = 4; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 6,
      duration: 75,
      tss: 130,
      zones: [10, 65, 15, 7, 3],
    })
  }
  return log
}

// sessionRPEDrift high: ≥40% of typed sessions execute above plan.
// Use a per-week template with 3 tempo@RPE8 (plan max 7 → drift), 1 long@RPE5,
// 1 recovery@RPE3 — total 5 typed sessions/wk, 3 drift → 60% → band='high'.
// 'tempo' intent is NOT in easyDayCompliance's labeled-easy set so it doesn't
// trip easy-poor. Pre-window seed phase keeps fitness/recoveryDebt stable.
// vo2 stays healthy because tempo zones include Z5 share. 3 hard days/wk
// (RPE>=6) keeps density low (needs 4+/wk to flag).
function buildRPEDriftHighLog() {
  const today = todayStr()
  const w4Start = isoWeekStart(today)
  const w1Start = addDays(w4Start, -21)
  const log = []
  // 60-day seed phase to warm CTL/ATL → keeps fitness 'maintaining' and
  // recoveryDebt 'fresh' so they don't crowd RPE high.
  for (let i = 87; i >= 28; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 55,
      zones: [10, 70, 10, 5, 5],
    })
  }
  const templates = [
    null, // Mon: rest
    { type: 'tempo', intent: 'tempo', rpe: 8, duration: 45, tss: 60, zones: [5, 15, 30, 35, 15] }, // Tue tempo (drift, has Z5)
    null, // Wed: rest
    { type: 'long', intent: 'long', rpe: 5, duration: 100, tss: 70, zones: [10, 80, 5, 3, 2] }, // Thu long (no drift)
    { type: 'tempo', intent: 'tempo', rpe: 8, duration: 45, tss: 60, zones: [5, 15, 30, 35, 15] }, // Fri tempo (drift)
    { type: 'recovery', intent: 'recovery', rpe: 3, duration: 40, tss: 25, zones: [70, 25, 3, 1, 1] }, // Sat recovery (no drift)
    { type: 'tempo', intent: 'tempo', rpe: 8, duration: 45, tss: 60, zones: [5, 15, 30, 35, 15] }, // Sun tempo (drift)
  ]
  for (let w = 0; w < 4; w++) {
    const ws = addDays(w1Start, w * 7)
    for (let d = 0; d < 7; d++) {
      const t = templates[d]
      if (!t) continue
      log.push({ date: addDays(ws, d), ...t })
    }
  }
  return log
}

// sessionRPEDrift moderate with worstType: 20-39% drift, with one collapsed
// type reaching ≥3 sessions so worstType !== null.
// Per week: 1 tempo@RPE8 (drift, collapsed='steady') + 1 steady@RPE5 +
// 1 long@RPE5 + 1 recovery@RPE3 + 1 intervals@RPE8 = 5 typed/wk over 4 weeks.
// Drift: 4/20 = 20% → band='moderate'. byType.steady = 6 total / 3 drift,
// total≥3 so worstType='steady' (set). All other detectors stay quiet:
// 2 hard days/wk → density low; all 5 intents → variety good; all 5 zones
// covered → no stale; pre-window seed keeps fitness/recoveryDebt stable.
function buildRPEDriftModerateWithTypeLog() {
  const today = todayStr()
  const w4Start = isoWeekStart(today)
  const w1Start = addDays(w4Start, -21)
  const log = []
  // Seed: 60 days of moderate load → CTL warmed, recoveryDebt fresh
  for (let i = 87; i >= 28; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 55,
      zones: [10, 70, 10, 5, 5],
    })
  }
  const templates = [
    null, // Mon rest
    { type: 'tempo', intent: 'tempo', rpe: 8, duration: 45, tss: 60, zones: [5, 15, 35, 30, 15] }, // Tue tempo (drift)
    { type: 'recovery', intent: 'recovery', rpe: 3, duration: 40, tss: 25, zones: [70, 25, 3, 1, 1] }, // Wed recovery
    { type: 'long', intent: 'long', rpe: 5, duration: 100, tss: 70, zones: [10, 80, 5, 3, 2] }, // Thu long
    null, // Fri rest
    { type: 'steady', intent: 'steady', rpe: 5, duration: 60, tss: 50, zones: [10, 70, 10, 5, 5] }, // Sat steady
    { type: 'intervals', intent: 'intervals', rpe: 8, duration: 45, tss: 60, zones: [0, 10, 20, 40, 30] }, // Sun intervals
  ]
  for (let w = 0; w < 4; w++) {
    const ws = addDays(w1Start, w * 7)
    for (let d = 0; d < 7; d++) {
      const t = templates[d]
      if (!t) continue
      log.push({ date: addDays(ws, d), ...t })
    }
  }
  return log
}

// sessionRPEDrift moderate WITHOUT worstType: drift ratio in moderate band
// but no collapsed type reaches ≥3 sessions, so worstType stays null.
// Build 8 sessions across many distinct types so each bucket is < 3:
//   - 2 easy + 2 long + 2 steady + 2 threshold = 8 total
//   - Drift on 2 of them (e.g. one easy + one long) → 25% drift → moderate
//   - No bucket has 3+ → worstType=null
function buildRPEDriftModerateWithoutTypeLog() {
  const today = todayStr()
  const log = []
  // 14-day pad of generic untyped runs (no plan match → ignored by rpeDrift)
  for (let i = 27; i >= 14; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 50,
      zones: [10, 70, 10, 5, 5],
    })
  }
  // Trailing 14 days: 8 typed sessions split across 4 collapsed buckets
  // (2 each), with drift on exactly 2 (25% → moderate), each bucket < 3.
  log.push({ date: addDays(today, -13), type: 'easy', intent: 'easy', rpe: 6, duration: 45, tss: 50, zones: [10, 70, 10, 5, 5] }) // drift
  log.push({ date: addDays(today, -12), type: 'easy', intent: 'easy', rpe: 4, duration: 45, tss: 50, zones: [10, 70, 10, 5, 5] }) // ok
  log.push({ date: addDays(today, -11), type: 'long', intent: 'long', rpe: 7, duration: 90, tss: 80, zones: [10, 70, 10, 5, 5] }) // drift
  log.push({ date: addDays(today, -10), type: 'long', intent: 'long', rpe: 5, duration: 90, tss: 80, zones: [10, 70, 10, 5, 5] }) // ok
  log.push({ date: addDays(today, -9),  type: 'steady', intent: 'steady', rpe: 5, duration: 60, tss: 50, zones: [10, 70, 10, 5, 5] })
  log.push({ date: addDays(today, -8),  type: 'steady', intent: 'steady', rpe: 5, duration: 60, tss: 50, zones: [10, 70, 10, 5, 5] })
  log.push({ date: addDays(today, -7),  type: 'threshold', intent: 'threshold', rpe: 7, duration: 50, tss: 60, zones: [10, 30, 30, 25, 5] })
  log.push({ date: addDays(today, -6),  type: 'threshold', intent: 'threshold', rpe: 8, duration: 50, tss: 60, zones: [10, 30, 30, 25, 5] })
  // Fill the rest of trailing days with generic untyped runs
  for (const d of [5, 4, 3, 2, 1, 0]) {
    log.push({ date: addDays(today, -d), type: 'run', rpe: 5, duration: 60, tss: 50, zones: [10, 70, 10, 5, 5] })
  }
  return log
}

// ─── v8.77.0 tests ──────────────────────────────────────────────────────────
describe('CoachingInsightsDigest — recoveryDebt overreached', () => {
  it('surfaces a high-priority DEBT headline when band is overreached', () => {
    const log = buildRecoveryDebtOverreachedLog()
    renderCard({ log })
    expect(screen.getByText('DEBT')).toBeInTheDocument()
    expect(screen.getByText(/Recovery debt high — taper or rest/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('🔴')
  })

  it('renders BORÇ (TR) for the Turkish recoveryDebt headline', () => {
    const log = buildRecoveryDebtOverreachedLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText('BORÇ')).toBeInTheDocument()
    expect(screen.getByText(/Toparlanma borcu yüksek/i)).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — recoveryDebt fatigued', () => {
  it('surfaces a moderate DEBT headline when band is fatigued', () => {
    const log = buildRecoveryDebtFatiguedLog()
    renderCard({ log })
    expect(screen.getByText('DEBT')).toBeInTheDocument()
    expect(screen.getByText(/Fatigued — manage recovery/i)).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — recoveryDebt fresh (no false positive)', () => {
  it('does not surface DEBT headline when athlete is fresh on a healthy log', () => {
    const log = buildHealthyLog()
    renderCard({ log })
    // Healthy path stays green; DEBT badge must not appear
    expect(screen.queryByText('DEBT')).not.toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — sessionRPEDrift high', () => {
  it('surfaces a high-priority RPE headline when drift band is high', () => {
    const log = buildRPEDriftHighLog()
    renderCard({ log })
    expect(screen.getByText('RPE')).toBeInTheDocument()
    expect(screen.getByText(/execution discipline issue/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('🔴')
  })
})

describe('CoachingInsightsDigest — sessionRPEDrift moderate (with worstType)', () => {
  it('surfaces a moderate RPE headline when drift band is moderate and worstType is set', () => {
    const log = buildRPEDriftModerateWithTypeLog()
    renderCard({ log })
    expect(screen.getByText('RPE')).toBeInTheDocument()
    expect(screen.getByText(/drift above plan/i)).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — sessionRPEDrift moderate (no worstType, silent)', () => {
  it('does not surface RPE headline when band is moderate but no worstType identified', () => {
    const log = buildRPEDriftModerateWithoutTypeLog()
    renderCard({ log })
    // RPE source badge must not appear when worstType is null at moderate band
    expect(screen.queryByText('RPE')).not.toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — v8.77.0 reliability gating', () => {
  it('does not surface RPE or DEBT headlines when both detectors are unreliable', () => {
    const log = buildShortLog()
    renderCard({ log })
    expect(screen.queryByText('RPE')).not.toBeInTheDocument()
    expect(screen.queryByText('DEBT')).not.toBeInTheDocument()
  })
})

// ─── v8.79.0 fixtures: timeInZone + supercompensationWindow ─────────────────

// timeInZone 'poor': Z2-only-heavy (28 days at [10, 80, 5, 3, 2]). Multiple
// zones off polarized target → band='poor'. Other detectors stay quiet enough
// that the time-in-zone-poor headline is the most actionable surface.
function buildTimeInZonePoorLog() {
  const today = todayStr()
  const log = []
  for (let i = 27; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 50,
      zones: [10, 80, 5, 3, 2],
    })
  }
  return log
}

// timeInZone 'moderate' worstZone Z5-over (NOT Z2-under): zones include extra
// Z5 vs polarized target so only Z5 is off-target. Rule 18 only fires for
// Z2-under, so this fixture should NOT surface a ZONES headline from
// timeInZone (stale Z5 will not appear because Z5 share is well above 5%).
function buildTimeInZoneModerateZ5OverLog() {
  const today = todayStr()
  const log = []
  for (let i = 27; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 50,
      // Z5=8 (twice polarized 4%) → Z5 over; others on-target
      zones: [28, 56, 7, 7, 8],
    })
  }
  return log
}

// timeInZone 'good': polarized template per day [28, 56, 7, 7, 4].
// All zones in [0.8, 1.2] of target → band='good' → silent in synthesis.
function buildTimeInZoneGoodLog() {
  const today = todayStr()
  const log = []
  for (let i = 27; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 50,
      zones: [28, 56, 7, 7, 4],
    })
  }
  return log
}

// Supercompensation 'peak': 80-day buildup at TSS=70 with rest every 3rd day,
// then 8-day complete rest gap → CTL holds, ATL drops sharply → TSB > 15.
// Other detectors are mostly unreliable (insufficient recent data) so the
// supercomp peak headline rotates into the top-3.
function buildSupercompPeakLog() {
  const today = todayStr()
  const log = []
  for (let i = 84; i >= 8; i--) {
    if (i % 3 === 0) continue
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 70,
      zones: [28, 56, 7, 7, 4],
    })
  }
  return log
}

// Supercompensation 'opportunity': lower buildup + 6-day rest → TSB in (5, 15]
// AND 7-day TSB rise ≥ 15.
function buildSupercompOpportunityLog() {
  const today = todayStr()
  const log = []
  for (let i = 84; i >= 6; i--) {
    if (i % 3 === 0) continue
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 60,
      tss: 60,
      zones: [28, 56, 7, 7, 4],
    })
  }
  return log
}

// Supercompensation 'building': sparse low-load buildup, brief 4-day load
// spike ending 5 days ago, then complete rest → TSB still slightly negative
// today but tsbRise7d ≥ 10 → 'building' band. Sparse pre-window keeps
// recoveryDebt cumulativeDeficit < 250 (no 'fatigued' headline) and
// monotony/density/variety unreliable (insufficient daily entries).
function buildSupercompBuildingLog() {
  const today = todayStr()
  const log = []
  // Sparse pre-window: every-other-day low TSS to seed CTL while keeping
  // cumulative deficit modest.
  for (let i = 84; i >= 9; i -= 2) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 4,
      duration: 50,
      tss: 40,
      zones: [28, 56, 7, 7, 4],
    })
  }
  // 4-day load spike (days -8..-5) — enough to push ATL above CTL but not
  // enough to trip recoveryDebt overreached.
  for (let i = 8; i >= 5; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 6,
      duration: 70,
      tss: 95,
      zones: [20, 50, 15, 10, 5],
    })
  }
  // Days -4..0: complete rest (no entries) → ATL decays sharply.
  return log
}

// Supercompensation 'available': very modest TSB > 0 (in [0, 5]) — no rise
// signature strong enough for opportunity. Light buildup + short rest.
function buildSupercompAvailableLog() {
  const today = todayStr()
  const log = []
  for (let i = 84; i >= 4; i--) {
    if (i % 3 === 0) continue
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 4,
      duration: 50,
      tss: 40,
      zones: [28, 56, 7, 7, 4],
    })
  }
  return log
}

// Supercompensation 'closed': sustained high load every single day → TSB
// deeply negative, no rise → 'closed' band (silent in synthesis).
function buildSupercompClosedLog() {
  const today = todayStr()
  const log = []
  for (let i = 84; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 7,
      duration: 60,
      tss: 90,
      zones: [28, 56, 7, 7, 4],
    })
  }
  return log
}

// ─── v8.79.0 tests ──────────────────────────────────────────────────────────
describe('CoachingInsightsDigest — timeInZone poor', () => {
  it('surfaces a moderate ZONES headline when band is poor (multiple zones off-target)', () => {
    const log = buildTimeInZonePoorLog()
    renderCard({ log })
    expect(screen.getByText('ZONES')).toBeInTheDocument()
    expect(screen.getByText(/Multiple zones off-target/i)).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — timeInZone moderate Z5-over', () => {
  it('does NOT surface a ZONES headline when band is moderate but worstZone is not Z2-under', () => {
    const log = buildTimeInZoneModerateZ5OverLog()
    renderCard({ log })
    // Rule 18 (timeInZone moderate Z2-under) is the only moderate-band gate;
    // Z5-over is silent.
    expect(screen.queryByText('ZONES')).not.toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — timeInZone good', () => {
  it('does NOT surface a ZONES headline when band is good (polarized template hit)', () => {
    const log = buildTimeInZoneGoodLog()
    renderCard({ log })
    expect(screen.queryByText('ZONES')).not.toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — supercompensation peak', () => {
  it('surfaces a positive WINDOW headline when supercomp band is peak', () => {
    const log = buildSupercompPeakLog()
    renderCard({ log })
    expect(screen.getByText('WINDOW')).toBeInTheDocument()
    expect(screen.getByText(/Peak readiness/i)).toBeInTheDocument()
    // Positive headline uses the green bullet
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('🟢')
  })

  it('renders PENCERE (TR) for the Turkish supercomp peak headline', () => {
    const log = buildSupercompPeakLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText('PENCERE')).toBeInTheDocument()
    expect(screen.getByText(/Zirve hazırlık/i)).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — supercompensation opportunity', () => {
  it('surfaces a positive WINDOW headline when supercomp band is opportunity', () => {
    const log = buildSupercompOpportunityLog()
    renderCard({ log })
    expect(screen.getByText('WINDOW')).toBeInTheDocument()
    expect(screen.getByText(/Opportunity window opening/i)).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — supercompensation building', () => {
  it('surfaces a WINDOW headline when supercomp band is building', () => {
    const log = buildSupercompBuildingLog()
    renderCard({ log })
    expect(screen.getByText('WINDOW')).toBeInTheDocument()
    expect(screen.getByText(/Window approaching/i)).toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — supercompensation available', () => {
  it('does NOT surface a WINDOW headline when band is available (modest, not noteworthy)', () => {
    const log = buildSupercompAvailableLog()
    renderCard({ log })
    expect(screen.queryByText('WINDOW')).not.toBeInTheDocument()
  })
})

describe('CoachingInsightsDigest — supercompensation closed', () => {
  it('does NOT surface a WINDOW headline when band is closed (silent)', () => {
    const log = buildSupercompClosedLog()
    renderCard({ log })
    expect(screen.queryByText('WINDOW')).not.toBeInTheDocument()
  })
})

// Very short log (3 entries × ~50 zone-minutes each = 150 totalMinutes) so
// timeInZone is unreliable (<200 minute threshold) AND supercompensationWindow
// is unreliable (<28 day span). All other detectors are also unreliable.
function buildVeryShortLog() {
  const today = todayStr()
  const log = []
  for (let i = 2; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      rpe: 5,
      duration: 30,
      tss: 25,
      // Zone array values are interpreted as raw minutes (not percentages)
      // by timeInZone — keep total under 200 minutes across the log.
      zones: [10, 30, 5, 3, 2],
    })
  }
  return log
}

describe('CoachingInsightsDigest — v8.79.0 reliability gating', () => {
  it('does not surface ZONES (timeInZone) or WINDOW headlines when both detectors are unreliable', () => {
    const log = buildVeryShortLog()
    renderCard({ log })
    // timeInZone reliable requires totalMinutes ≥ 200 (this log has 90).
    // supercomp reliable requires span ≥ 28 days (this log has 3).
    // Neither headline should appear; the empty-state copy renders instead.
    expect(screen.queryByText('ZONES')).not.toBeInTheDocument()
    expect(screen.queryByText('WINDOW')).not.toBeInTheDocument()
  })
})
