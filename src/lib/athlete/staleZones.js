// ─── staleZones.js — E120: Stale Zones Detector (28d window) ─────────────────
// Surfaces zones that have been neglected (stale) or recently dropped relative
// to prior weeks, helping athletes balance training across intensity bands.
// Based on Seiler 2010 (polarized training) + Foster 2001 (session RPE).
// ─────────────────────────────────────────────────────────────────────────────

export const STALE_ZONES_CITATION = 'Seiler 2010 polarized; Foster 2001'

const ZONE_LABELS = {
  Z1: { en: 'Z1 (recovery)', tr: 'Z1 (toparlanma)' },
  Z2: { en: 'Z2 (endurance)', tr: 'Z2 (dayanıklılık)' },
  Z3: { en: 'Z3 (tempo)', tr: 'Z3 (tempo)' },
  Z4: { en: 'Z4 (threshold)', tr: 'Z4 (eşik)' },
  Z5: { en: 'Z5 (VO2max)', tr: 'Z5 (VO2max)' },
}

const ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
/**
 * Add `days` to a 'YYYY-MM-DD' string and return new 'YYYY-MM-DD' (UTC).
 */
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Zone parsing ────────────────────────────────────────────────────────────
/**
 * Extract per-zone contribution (TSS or minutes — caller-defined unit) from a
 * single log entry. Mirrors the pattern in intelligence.js:analyzeZoneBalance.
 *
 * Supports two shapes:
 *   1. entry.zones is an array of 5 numbers [Z1,Z2,Z3,Z4,Z5] — direct mapping
 *   2. entry.zones is an object {Z1, Z2, ...} — read by key
 *
 * If neither shape is present (or zones are all zero), falls back to RPE→zone
 * bucketing using entry.duration (matches analyzeZoneBalance fallback).
 *
 * @param {Object} entry
 * @returns {[number, number, number, number, number]} contributions per zone
 */
function entryZoneContributions(entry) {
  const out = [0, 0, 0, 0, 0]
  const z = entry?.zones
  // Array shape: [z1, z2, z3, z4, z5]
  if (Array.isArray(z) && z.some(v => Number(v) > 0)) {
    for (let i = 0; i < 5; i++) out[i] = Number(z[i]) || 0
    return out
  }
  // Object shape: {Z1, Z2, Z3, Z4, Z5} or {z1, z2, ...}
  if (z && typeof z === 'object') {
    let any = false
    for (let i = 0; i < 5; i++) {
      const key1 = `Z${i + 1}`
      const key2 = `z${i + 1}`
      const v = Number(z[key1] ?? z[key2] ?? 0)
      out[i] = v || 0
      if (v > 0) any = true
    }
    if (any) return out
  }
  // Fallback: RPE-bucketed duration (same mapping as analyzeZoneBalance)
  const dur = Number(entry?.duration) || 0
  if (dur > 0) {
    const r = Number(entry?.rpe) || 5
    const zi = r <= 3 ? 0 : r <= 5 ? 1 : r <= 7 ? 2 : r === 8 ? 3 : 4
    out[zi] = dur
  }
  return out
}

// ─── detectStaleZones ────────────────────────────────────────────────────────
/**
 * Detect stale or dropping training zones over a 28-day window.
 *
 * For each Z1..Z5 zone:
 *   - 'stale'   : 28d share < 5%
 *   - 'dropped' : last-7d share < 50% of prior-21d share
 *   - 'healthy' : otherwise
 *
 * Strict less-than at boundaries (5% and 50%) — exact equality is healthy.
 *
 * @param {Array} log - training_log entries with zones {Z1..Z5} TSS or minutes
 * @param {string} [today] - YYYY-MM-DD reference; defaults to current date
 * @returns {{
 *   zones: Array<{ zone: 'Z1'|'Z2'|'Z3'|'Z4'|'Z5', status: 'stale'|'dropped'|'healthy',
 *                  share28d: number, share7d: number, share21d: number,
 *                  message: { en: string, tr: string } }>,
 *   summary: { stale: number, dropped: number, healthy: number },
 *   reliable: boolean,
 *   citation: string,
 * }}
 */
export function detectStaleZones(log, today = new Date().toISOString().slice(0, 10)) {
  const empty = {
    zones: [],
    summary: { stale: 0, dropped: 0, healthy: 0 },
    reliable: false,
    citation: STALE_ZONES_CITATION,
  }
  if (!Array.isArray(log) || log.length === 0) return empty

  // Window boundaries (UTC, inclusive). All comparisons via 'YYYY-MM-DD' strings.
  const start28 = addDaysStr(today, -27)  // 28-day window: today-27 .. today
  const start7  = addDaysStr(today, -6)   // recent 7-day window: today-6 .. today
  // prior-21d window: start28 .. (start7 - 1)  i.e. today-27 .. today-7

  // Slice log to the 28d window
  const recent = log.filter(e => e?.date && e.date >= start28 && e.date <= today)

  // Determine reliability: need ≥14 distinct days of log data within window.
  // (We still compute on whatever we have, just flag reliable=false.)
  const distinctDays = new Set(recent.map(e => e.date))
  const reliable = distinctDays.size >= 14

  // Accumulate per-zone totals over each sub-window
  const tot28 = [0, 0, 0, 0, 0]
  const tot7  = [0, 0, 0, 0, 0]
  const tot21 = [0, 0, 0, 0, 0]

  for (const entry of recent) {
    const contribs = entryZoneContributions(entry)
    const inLast7 = entry.date >= start7
    for (let i = 0; i < 5; i++) {
      tot28[i] += contribs[i]
      if (inLast7) tot7[i]  += contribs[i]
      else         tot21[i] += contribs[i]
    }
  }

  const sum28 = tot28.reduce((s, v) => s + v, 0)
  const sum7  = tot7.reduce((s, v) => s + v, 0)
  const sum21 = tot21.reduce((s, v) => s + v, 0)

  const zonesOut = []
  let staleCount = 0
  let droppedCount = 0
  let healthyCount = 0

  for (let i = 0; i < 5; i++) {
    const zone = ZONES[i]
    const share28d = sum28 > 0 ? (tot28[i] / sum28) * 100 : 0
    const share7d  = sum7  > 0 ? (tot7[i]  / sum7)  * 100 : 0
    const share21d = sum21 > 0 ? (tot21[i] / sum21) * 100 : 0

    let status = 'healthy'
    let message = { en: '', tr: '' }

    // Stale: 28d share strictly below 5% AND there is some data overall.
    if (sum28 > 0 && share28d < 5) {
      status = 'stale'
      const label = ZONE_LABELS[zone]
      message = {
        en: `${label.en} has been neglected for 28 days.`,
        tr: `${label.tr} 28 gündür ihmal edilmiş.`,
      }
    } else if (
      // Dropped: last-7d share strictly below 50% of prior-21d share.
      // Requires both windows to have data and prior-21d share to be meaningful.
      sum7 > 0 && sum21 > 0 && share21d > 0 && share7d < share21d * 0.5
    ) {
      status = 'dropped'
      const dropPct = Math.round((1 - share7d / share21d) * 100)
      const label = ZONE_LABELS[zone]
      message = {
        en: `${label.en} has dropped ${dropPct}% vs prior weeks.`,
        tr: `${label.tr} önceki haftalara göre %${dropPct} düştü.`,
      }
    }

    if (status === 'stale') staleCount++
    else if (status === 'dropped') droppedCount++
    else healthyCount++

    zonesOut.push({
      zone,
      status,
      share28d: Math.round(share28d * 10) / 10,
      share7d:  Math.round(share7d  * 10) / 10,
      share21d: Math.round(share21d * 10) / 10,
      message,
    })
  }

  return {
    zones: zonesOut,
    summary: { stale: staleCount, dropped: droppedCount, healthy: healthyCount },
    reliable,
    citation: STALE_ZONES_CITATION,
  }
}
