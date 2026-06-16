// Tests for overreachWatch — neuromuscular × ACWR load cross-read.
//
// overreachWatch runs the real computeNMFatigue + calculateACWR against a log,
// so these tests build synthetic logs that drive each signal to the target
// classification. calculateACWR always uses the system date, so entries are
// generated relative to "today"; computeNMFatigue is given the same today.

import { describe, it, expect } from 'vitest'
import { overreachWatch } from '../../athlete/overreachWatch.js'

const TODAY = new Date().toISOString().slice(0, 10)

function dateOffset(days) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// One log entry on `daysAgo`, with optional Z4/Z5 minutes (drives NMF) and tss
// (drives ACWR).
function entry(daysAgo, { z4 = 0, z5 = 0, tss = 0 } = {}) {
  const e = { date: dateOffset(-daysAgo), tss }
  if (z4 || z5) e.zones = { Z4: z4, Z5: z5 }
  return e
}

// ── Log builders ──────────────────────────────────────────────────────────────
//
// Chronic base: spread TSS across the 28-day window so ctl > 0 (else ACWR is
// 'insufficient'). Acute load (last few days) governs the ratio.

// Steady moderate base every day → optimal ACWR (ratio ≈ 1.0).
function steadyTss(perDay = 50) {
  const out = []
  for (let i = 0; i < 28; i++) out.push(entry(i, { tss: perDay }))
  return out
}

// Big recent TSS spike on top of a low chronic base → danger ACWR (> 1.5).
function spikeTss() {
  const out = []
  for (let i = 7; i < 28; i++) out.push(entry(i, { tss: 20 })) // low chronic
  for (let i = 0; i < 4; i++) out.push(entry(i, { tss: 280 }))  // acute spike
  return out
}

// Merge NMF-driving Z4/Z5 minutes into an existing-by-date TSS log.
function withNm(tssLog, recent7Hi, baselineWeeklyHi) {
  // baselineWeeklyHi: hi-minutes per week placed in weeks 1..3 (days 7..27) so
  // the 28d weekly mean is non-zero. recent7Hi: hi-minutes in the last 7 days.
  const byDate = {}
  for (const e of tssLog) byDate[e.date] = { ...e }

  function addHi(daysAgo, mins) {
    const key = dateOffset(-daysAgo)
    if (!byDate[key]) byDate[key] = { date: key, tss: 0 }
    byDate[key].zones = byDate[key].zones || { Z4: 0, Z5: 0 }
    byDate[key].zones.Z4 += mins
  }

  // place baseline hi-load in older weeks
  for (let wk = 1; wk <= 3; wk++) addHi(wk * 7, baselineWeeklyHi)
  // place recent hi-load
  if (recent7Hi > 0) addHi(1, recent7Hi)

  return Object.values(byDate)
}

describe('overreachWatch — quadrant cross-reads', () => {
  it('overreached NMF + danger ACWR → systemic_overreach (rest)', () => {
    // spike TSS = danger ACWR. recent7Hi huge vs small baseline = overreached NMF.
    const log = withNm(spikeTss(), 200, 20) // ratio = 200/20 = 10 → overreached
    const r = overreachWatch(log, TODAY)
    expect(r).not.toBeNull()
    expect(r.axis).toBe('systemic_overreach')
    expect(r.nmClass).toBe('overreached')
    expect(r.acwrStatus).toBe('danger')
    expect(r.headline.en).toMatch(/overreach/i)
    expect(r.headline.tr).toMatch(/aşırı yüklenme/i)
    expect(r.detail.en).toMatch(/rest/i)
  })

  it('fresh NMF + danger ACWR → volume_spike (cap volume, keep intensity)', () => {
    // spike TSS = danger ACWR. recent7Hi tiny vs big baseline = fresh NMF.
    const log = withNm(spikeTss(), 5, 80) // ratio = 5/80 = 0.06 → fresh
    const r = overreachWatch(log, TODAY)
    expect(r).not.toBeNull()
    expect(r.axis).toBe('volume_spike')
    expect(r.nmClass).toBe('fresh')
    expect(r.acwrStatus).toBe('danger')
    expect(r.headline.en).toMatch(/volume spike/i)
    expect(r.detail.en).toMatch(/cap total volume|intensity/i)
  })

  it('accumulated NMF + optimal ACWR → hidden_intensity_cost (trim intensity)', () => {
    // steady TSS = optimal ACWR. recent7Hi ~1.2× baseline = accumulated NMF.
    const log = withNm(steadyTss(50), 72, 50) // ratio ≈ 1.30 → accumulated
    const r = overreachWatch(log, TODAY)
    expect(r).not.toBeNull()
    expect(r.acwrStatus).toBe('optimal')
    expect(r.nmClass).toBe('accumulated')
    expect(r.axis).toBe('hidden_intensity_cost')
    expect(r.headline.en).toMatch(/hidden intensity/i)
    expect(r.detail.en).toMatch(/Z4\/Z5/)
  })

  it('normal NMF + optimal ACWR → holding (neutral)', () => {
    // steady TSS = optimal ACWR. recent7Hi ≈ baseline (ratio ~0.85) = normal.
    const log = withNm(steadyTss(50), 42, 50) // ratio = 0.84 → score ~78 normal
    const r = overreachWatch(log, TODAY)
    expect(r).not.toBeNull()
    expect(r.acwrStatus).toBe('optimal')
    expect(r.nmClass).toBe('normal')
    expect(r.axis).toBe('holding')
    expect(r.headline.en).toMatch(/holding/i)
  })
})

describe('overreachWatch — null / insufficient cases', () => {
  it('returns null for an empty log', () => {
    expect(overreachWatch([], TODAY)).toBeNull()
  })

  it('returns null when not an array', () => {
    expect(overreachWatch(null)).toBeNull()
    expect(overreachWatch(undefined)).toBeNull()
  })

  it('returns null when ACWR has no chronic base (insufficient)', () => {
    // High-intensity NMF data present, but zero TSS everywhere → ctl === 0 →
    // ACWR status 'insufficient' → hide.
    const log = [
      entry(1, { z4: 90 }),
      entry(8, { z4: 30 }),
      entry(15, { z4: 30 }),
    ]
    const r = overreachWatch(log, TODAY)
    expect(r).toBeNull()
  })

  it('returns null when NMF has no high-intensity baseline (28d weekly mean = 0)', () => {
    // Plenty of TSS for a valid ACWR, but zero Z4/Z5 + no RPE≥8 anywhere → NMF
    // sits on its zero-baseline default, which is a no-signal state.
    const log = steadyTss(50) // tss only, no zones, no rpe
    const r = overreachWatch(log, TODAY)
    expect(r).toBeNull()
  })
})

describe('overreachWatch — shape', () => {
  it('exposes nmScore and acwrRatio numerics', () => {
    const log = withNm(spikeTss(), 200, 20)
    const r = overreachWatch(log, TODAY)
    expect(typeof r.nmScore).toBe('number')
    expect(typeof r.acwrRatio).toBe('number')
    expect(r.headline).toHaveProperty('en')
    expect(r.headline).toHaveProperty('tr')
    expect(r.detail).toHaveProperty('en')
    expect(r.detail).toHaveProperty('tr')
  })
})
