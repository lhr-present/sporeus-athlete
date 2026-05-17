// ─── sleepCtlCorrelation.test.js ─────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  computeSleepCtlCorrelation,
  SLEEP_CTL_CITATION,
} from '../../athlete/sleepCtlCorrelation.js'

// ── Date helpers — all anchored on a frozen "today" so the window is
//    deterministic regardless of wall-clock. ─────────────────────────────────
const TODAY = '2026-05-15'

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Build a recovery+log pair where sleep and CTL move together.
 * `pattern` is an array of `{ sleep, tss }` for the most-recent `n`
 * days ending on TODAY (index 0 = TODAY, index n-1 = (n-1) days ago).
 *
 * We also burn ≥ 60 days of constant TSS BEFORE the window starts so
 * CTL is in a sensible steady-state by the time the paired days roll
 * in — this stops the EMA warm-up from dominating the correlation.
 */
function buildPair(pattern, basePreloadTss = 50, preloadDays = 60) {
  const n = pattern.length
  const log = []
  const recovery = []

  // Preload BEFORE the trailing window so CTL is warm.
  const firstWindowDate = addDays(TODAY, -(n - 1))
  for (let i = 1; i <= preloadDays; i++) {
    log.push({
      date: addDays(firstWindowDate, -i),
      tss: basePreloadTss,
    })
  }

  for (let i = 0; i < n; i++) {
    // i=0 → TODAY, i=n-1 → oldest window day
    const date = addDays(TODAY, -(n - 1 - i))
    const { sleep, tss } = pattern[i]
    if (Number.isFinite(tss)) log.push({ date, tss })
    if (Number.isFinite(sleep)) {
      recovery.push({ date, sleepHrs: sleep })
    } else if (sleep === 'missing') {
      recovery.push({ date }) // entry with no sleep field — should be skipped
    }
  }

  return { log, recovery }
}

// Reference Pearson for hand-checking the implementation against numpy.
function pearsonRef(xs, ys) {
  const n = xs.length
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let num = 0, dxs = 0, dys = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dxs += (xs[i] - mx) ** 2
    dys += (ys[i] - my) ** 2
  }
  return num / Math.sqrt(dxs * dys)
}

// ─── 1. Null guards ───────────────────────────────────────────────────────────
describe('computeSleepCtlCorrelation — null guards', () => {
  it('returns null for empty inputs', () => {
    expect(computeSleepCtlCorrelation({})).toBeNull()
    expect(computeSleepCtlCorrelation({ log: [], recovery: [], today: TODAY })).toBeNull()
  })

  it('returns null when n < 7 paired days', () => {
    // 6 valid days — below the threshold
    const pattern = Array.from({ length: 6 }, (_, i) => ({ sleep: 7 + i * 0.1, tss: 80 }))
    const { log, recovery } = buildPair(pattern)
    expect(
      computeSleepCtlCorrelation({ log, recovery, today: TODAY, windowDays: 28 }),
    ).toBeNull()
  })
})

// ─── 2. Hand-crafted numeric check ────────────────────────────────────────────
describe('computeSleepCtlCorrelation — numeric correctness', () => {
  it('matches a hand-computed Pearson r within ±0.01', () => {
    // 10 paired days with co-monotone sleep + TSS. CTL is a heavy EMA
    // of TSS so it lags but stays directionally aligned; with a
    // monotone trend it tracks closely. We verify the implementation
    // produces a r consistent with a numpy-style reference computed on
    // (sleep, CTL) where CTL is the same kC=2/43 EMA the production
    // function uses.
    const sleepSeries = [6.0, 6.3, 6.6, 6.9, 7.2, 7.5, 7.8, 8.1, 8.4, 8.7]
    const tssSeries   = [40,  48,  56,  64,  72,  80,  88,  96, 104, 112]
    const pattern = sleepSeries.map((s, i) => ({ sleep: s, tss: tssSeries[i] }))
    const { log, recovery } = buildPair(pattern)
    const out = computeSleepCtlCorrelation({ log, recovery, today: TODAY, windowDays: 28 })
    expect(out).not.toBeNull()
    expect(out.n).toBe(10)

    // Build a reference CTL series for the 10 paired days using the
    // same EMA the production code uses (kC = 2/43, warm-started from
    // the preload steady-state).
    const kC = 2 / 43
    // Preload (50 TSS x 60 days) brings CTL to ~50 by warm-up — close
    // enough; bootstrap by stepping 60 days of preload TSS first.
    let ctl = 0
    for (let i = 0; i < 60; i++) ctl = 50 * kC + ctl * (1 - kC)
    const ctlSeries = []
    for (const t of tssSeries) {
      ctl = t * kC + ctl * (1 - kC)
      ctlSeries.push(ctl)
    }
    const refR = pearsonRef(sleepSeries, ctlSeries)
    expect(Math.abs(out.r - refR)).toBeLessThan(0.01)
    expect(out.r).toBeGreaterThan(0.9) // monotone → very strong
  })
})

// ─── 3. Bands ─────────────────────────────────────────────────────────────────
describe('computeSleepCtlCorrelation — bands', () => {
  it('strong-positive case → band === "strong"', () => {
    // Sleep and TSS move in lockstep across 14 days.
    const pattern = []
    for (let i = 0; i < 14; i++) {
      pattern.push({ sleep: 6 + (i * 0.2), tss: 40 + i * 8 })
    }
    const { log, recovery } = buildPair(pattern)
    const out = computeSleepCtlCorrelation({ log, recovery, today: TODAY, windowDays: 28 })
    expect(out).not.toBeNull()
    expect(out.band).toBe('strong')
    expect(out.r).toBeGreaterThanOrEqual(0.4)
    expect(out.interpretation.en).toMatch(/Strong positive/i)
    expect(out.interpretation.tr).toMatch(/Güçlü pozitif/i)
  })

  it('weak/none case (uncorrelated noise) → band === "weak"', () => {
    // Sleep oscillates, TSS is constant → CTL also flat → r ≈ 0.
    const pattern = [
      { sleep: 6.5, tss: 60 }, { sleep: 8.5, tss: 60 },
      { sleep: 7.0, tss: 60 }, { sleep: 8.0, tss: 60 },
      { sleep: 6.8, tss: 60 }, { sleep: 7.4, tss: 60 },
      { sleep: 7.7, tss: 60 }, { sleep: 6.9, tss: 60 },
      { sleep: 8.1, tss: 60 }, { sleep: 7.3, tss: 60 },
    ]
    const { log, recovery } = buildPair(pattern, 60)
    const out = computeSleepCtlCorrelation({ log, recovery, today: TODAY, windowDays: 28 })
    expect(out).not.toBeNull()
    expect(out.band).toBe('weak')
    expect(Math.abs(out.r)).toBeLessThan(0.2)
  })

  it('negative r → band === "weak" with NO negative-sleep advice', () => {
    // Sleep goes UP while TSS (and CTL) goes DOWN. r should be
    // negative. The interpretation must NOT suggest sleeping less.
    const pattern = []
    for (let i = 0; i < 14; i++) {
      // sleep ramps up 6 → ~9
      pattern.push({ sleep: 6 + i * 0.2, tss: 120 - i * 7 })
    }
    const { log, recovery } = buildPair(pattern, 100)
    const out = computeSleepCtlCorrelation({ log, recovery, today: TODAY, windowDays: 28 })
    expect(out).not.toBeNull()
    expect(out.r).toBeLessThan(0)
    expect(out.band).toBe('weak')
    expect(out.interpretation.en).not.toMatch(/sleep less|less sleep/i)
    expect(out.interpretation.tr).not.toMatch(/az uyu/i)
    // Should explicitly call out noise / multi-factor framing.
    expect(out.interpretation.en).toMatch(/noise|multiple recovery/i)
  })
})

// ─── 4. Robustness ────────────────────────────────────────────────────────────
describe('computeSleepCtlCorrelation — robustness', () => {
  it('tolerates missing sleepHrs on some days (skips the pair)', () => {
    // 10 days: 3 are missing sleep (recovery row present but no sleepHrs).
    // Remaining 7 pairs must be enough to compute.
    const pattern = [
      { sleep: 6.0, tss: 40 },
      { sleep: 'missing', tss: 50 },
      { sleep: 7.0, tss: 55 },
      { sleep: 7.5, tss: 60 },
      { sleep: 'missing', tss: 70 },
      { sleep: 8.0, tss: 75 },
      { sleep: 8.2, tss: 80 },
      { sleep: 'missing', tss: 85 },
      { sleep: 8.4, tss: 90 },
      { sleep: 8.6, tss: 95 },
    ]
    const { log, recovery } = buildPair(pattern)
    const out = computeSleepCtlCorrelation({ log, recovery, today: TODAY, windowDays: 28 })
    expect(out).not.toBeNull()
    expect(out.n).toBe(7) // exactly the valid pairs
    expect(out.r).toBeGreaterThan(0) // still positive
  })

  it('respects the windowDays bound (cuts older entries)', () => {
    // 14 STRONG-positive pairs in the most-recent 7 days, plus 7 OLDER
    // ANTI-correlated pairs in days 8–14. With windowDays=7 only the
    // recent (strong) pairs are seen; with windowDays=28 both leak in.
    const recent = []
    for (let i = 0; i < 7; i++) {
      recent.push({ sleep: 6 + i * 0.3, tss: 40 + i * 12 })
    }
    const older = []
    for (let i = 0; i < 7; i++) {
      older.push({ sleep: 9 - i * 0.3, tss: 40 + i * 12 })
    }
    // pattern is [oldest ... most-recent], buildPair maps last → TODAY.
    const pattern = [...older, ...recent]
    const { log, recovery } = buildPair(pattern)

    const w7  = computeSleepCtlCorrelation({ log, recovery, today: TODAY, windowDays: 7 })
    const w28 = computeSleepCtlCorrelation({ log, recovery, today: TODAY, windowDays: 28 })
    expect(w7).not.toBeNull()
    expect(w28).not.toBeNull()
    expect(w7.n).toBe(7)
    expect(w28.n).toBe(14)
    // With only the recent strong-positive days, r should clearly
    // exceed the mixed-window r.
    expect(w7.r).toBeGreaterThan(w28.r)
  })
})

// ─── 5. Citation + shape ──────────────────────────────────────────────────────
describe('computeSleepCtlCorrelation — citation + result shape', () => {
  it('exposes the documented citation constant', () => {
    expect(SLEEP_CTL_CITATION).toBe('Halson 2014; Mah 2011; Walker 2017')
  })

  it('result carries citation, mean values, and bilingual interpretation', () => {
    const pattern = Array.from({ length: 10 }, (_, i) => ({ sleep: 7 + i * 0.1, tss: 60 + i * 4 }))
    const { log, recovery } = buildPair(pattern)
    const out = computeSleepCtlCorrelation({ log, recovery, today: TODAY, windowDays: 28 })
    expect(out).not.toBeNull()
    expect(out.citation).toBe(SLEEP_CTL_CITATION)
    expect(typeof out.meanSleep).toBe('number')
    expect(typeof out.meanCtl).toBe('number')
    expect(out.meanSleep).toBeGreaterThan(6)
    expect(out.meanSleep).toBeLessThan(9)
    expect(out.interpretation).toHaveProperty('en')
    expect(out.interpretation).toHaveProperty('tr')
    expect(out.r).toBeGreaterThanOrEqual(-1)
    expect(out.r).toBeLessThanOrEqual(1)
  })
})
