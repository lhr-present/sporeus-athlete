// ─── highRpeBlock.js — Consecutive high-RPE day block detector ──────────────
// Foster 2001 (session-RPE training load) + Halson 2014 (monitoring training
// load → overreaching). Back-to-back high-RPE days accumulate strain without
// recovery. Three or more consecutive high-RPE days begin to approach
// unintended overreaching — distinct from intentional "loading blocks"
// (which are followed by deliberate deload).
//
// This card focuses on CONSECUTIVE-day streaks, complementary to:
//   - RpeStabilityCard (within-type rpe variability)
//   - HardDaySpacingCard (mean spacing between hard sessions)
//
// Window: trailing 60 days inclusive.
// High-RPE day  = any day where max(entry.rpe) across that date's entries ≥ 8.
// Block         = maximal consecutive run of high-RPE days, length ≥ 3.
//
// Citations:
//   Foster C. (2001). Monitoring training in athletes with reference to
//     overtraining syndrome. Med Sci Sports Exerc 33(1):164-168.
//   Halson SL. (2014). Monitoring training load to understand fatigue in
//     athletes. Sports Med 44 Suppl 2:S139-47.
// ─────────────────────────────────────────────────────────────────────────────

export const HIGH_RPE_BLOCK_CITATION = 'Foster 2001; Halson 2014'

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function toIso(value) {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    if (
      !Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d) ||
      mo < 1 || mo > 12 || d < 1 || d > 31
    ) return null
    const dt = new Date(Date.UTC(y, mo - 1, d))
    if (Number.isNaN(dt.getTime())) return null
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== mo - 1 ||
      dt.getUTCDate() !== d
    ) return null
    return dt.toISOString().slice(0, 10)
  }
  return null
}

function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Band classification ─────────────────────────────────────────────────────
// CHRONIC_STRAIN takes precedence — it can co-occur with REPEAT_BLOCKS counts.
function classifyBand(totalBlocks, longestBlockDays, minBlockDays) {
  if (totalBlocks >= 4 || longestBlockDays >= 6) return 'CHRONIC_STRAIN'
  if (totalBlocks === 0 && longestBlockDays < minBlockDays) return 'CLEAN'
  if (totalBlocks <= 1) return 'OCCASIONAL_BLOCK'
  if (totalBlocks <= 3) return 'REPEAT_BLOCKS'
  // Fallback (shouldn't be reachable given the rules above).
  return 'CHRONIC_STRAIN'
}

// ─── analyzeHighRpeBlock ─────────────────────────────────────────────────────
/**
 * Detect consecutive-high-RPE blocks in a trailing window.
 *
 * @param {object} options
 * @param {Array}  options.log         - training log entries
 * @param {Date|string} options.today  - reference "today"
 * @param {number} [options.windowDays=60]
 * @param {number} [options.highRpeThreshold=8]
 * @param {number} [options.minBlockDays=3]
 * @returns {{
 *   band: 'CLEAN'|'OCCASIONAL_BLOCK'|'REPEAT_BLOCKS'|'CHRONIC_STRAIN',
 *   blocks: Array<{ startDate, endDate, lengthDays, peakRpe }>,
 *   totalBlocks: number,
 *   longestBlockDays: number,
 *   totalHighRpeDays: number,
 *   citation: string,
 * } | null}
 */
export function analyzeHighRpeBlock({
  log,
  today,
  windowDays = 60,
  highRpeThreshold = 8,
  minBlockDays = 3,
} = {}) {
  const todayIso = toIso(today)
  if (!todayIso) return null
  if (!Number.isFinite(windowDays) || windowDays <= 0) return null
  if (!Number.isFinite(highRpeThreshold)) return null
  if (!Number.isFinite(minBlockDays) || minBlockDays < 1) return null

  const logArr = Array.isArray(log) ? log : []
  const windowStart = addDaysIso(todayIso, -(windowDays - 1))

  // Bucket entries by ISO date — store max finite RPE per day.
  // NaN / missing → not contributing (day with no high signal stays non-high).
  const dayMaxRpe = new Map() // date → number
  for (const e of logArr) {
    if (!e || typeof e !== 'object') continue
    const dIso = toIso(e.date)
    if (!dIso) continue
    if (dIso < windowStart || dIso > todayIso) continue
    const r = Number(e.rpe)
    if (!Number.isFinite(r)) continue
    const prev = dayMaxRpe.get(dIso)
    if (prev === undefined || r > prev) dayMaxRpe.set(dIso, r)
  }

  // Build per-day arrays for the window in chronological order.
  const dates = []
  const high  = []   // boolean per day
  const rpes  = []   // dayMaxRpe per day or null
  for (let i = 0; i < windowDays; i++) {
    const iso = addDaysIso(windowStart, i)
    dates.push(iso)
    const r = dayMaxRpe.has(iso) ? dayMaxRpe.get(iso) : null
    rpes.push(r)
    high.push(r !== null && Number.isFinite(r) && r >= highRpeThreshold)
  }

  // Total raw high-RPE days (every high day, in or out of a block).
  let totalHighRpeDays = 0
  for (let i = 0; i < high.length; i++) if (high[i]) totalHighRpeDays += 1

  // Find maximal consecutive high-RPE runs and keep those with length ≥ minBlockDays.
  const blocks = []
  let runStart = -1
  for (let i = 0; i < high.length; i++) {
    if (high[i]) {
      if (runStart === -1) runStart = i
      if (i === high.length - 1 || !high[i + 1]) {
        const length = i - runStart + 1
        if (length >= minBlockDays) {
          let peak = -Infinity
          for (let k = runStart; k <= i; k++) {
            const r = rpes[k]
            if (Number.isFinite(r) && r > peak) peak = r
          }
          blocks.push({
            startDate: dates[runStart],
            endDate: dates[i],
            lengthDays: length,
            peakRpe: Number.isFinite(peak) ? peak : 0,
          })
        }
        runStart = -1
      }
    }
  }

  // Already in chronological order from the linear scan; be explicit.
  blocks.sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))

  const totalBlocks      = blocks.length
  const longestBlockDays = blocks.reduce((m, b) => Math.max(m, b.lengthDays), 0)
  const band             = classifyBand(totalBlocks, longestBlockDays, minBlockDays)

  return {
    band,
    blocks,
    totalBlocks,
    longestBlockDays,
    totalHighRpeDays,
    citation: HIGH_RPE_BLOCK_CITATION,
  }
}
