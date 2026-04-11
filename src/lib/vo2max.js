// ─── VO₂max + VDOT Engine ────────────────────────────────────────────────────
// Based on Jack Daniels' polynomial (Running Formula, 1998).
// All functions are pure; no external dependencies.

// ── Internal: VO₂ demand at velocity v (m/min) ───────────────────────────────
function vo2AtVelocity(v) {
  return -4.60 + 0.182258 * v + 0.000104 * v * v
}

// ── Internal: % VO₂max maintained at race duration t (minutes) ───────────────
function pctVO2max(t) {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t)
}

// ── 1. vdotFromRace ───────────────────────────────────────────────────────────
// Jack Daniels (1998) polynomial. Valid for durations 3.5–240 min.
// Returns null outside that range.
export function vdotFromRace(distanceM, timeSeconds) {
  const t = timeSeconds / 60
  if (t < 3.5 || t > 240) return null
  const v = distanceM / timeSeconds * 60  // m/min
  return vo2AtVelocity(v) / pctVO2max(t)
}

// ── 2. vdotFromPaceHR ─────────────────────────────────────────────────────────
// Firstbeat-style VO₂max estimate from pace + HR fraction.
// avgPaceMs: seconds per metre (e.g. 0.3 s/m = 5:00/km)
// Returns null if effort < 60% HRmax (not vigorous enough to estimate).
export function vdotFromPaceHR(avgPaceMs, avgHR, maxHR) {
  const hrFrac = avgHR / maxHR
  if (!avgPaceMs || !hrFrac || hrFrac < 0.6) return null
  const speed_m_min = 60 / avgPaceMs
  const vo2 = 3.5 + speed_m_min * 0.2
  return vo2 / hrFrac
}

// ── 3. zonesFromVDOT ─────────────────────────────────────────────────────────
// Solve for vVO₂max (m/min) at given VDOT using Newton iteration, then
// scale to zone percentages. Returns pace ranges in seconds/km.
// Zone low = slower (lower %vVO₂max), high = faster (higher %vVO₂max).

const ZONE_PCTS = {
  E: [0.59, 0.74],
  M: [0.75, 0.84],
  T: [0.83, 0.88],
  I: [0.95, 1.00],
  R: [1.05, 1.15],
}

function solveVelocity(targetVO2, steps = 5) {
  // Newton: f(v) = vo2AtVelocity(v) - target = 0
  // f'(v) = 0.182258 + 0.000208*v
  // Initial guess from linear term only
  let v = (targetVO2 + 4.60) / 0.182258
  for (let i = 0; i < steps; i++) {
    const f  = vo2AtVelocity(v) - targetVO2
    const df = 0.182258 + 0.000208 * v
    v = v - f / df
  }
  return v
}

export function zonesFromVDOT(vdot) {
  const vVO2max = solveVelocity(vdot)
  const zones = {}
  for (const [zone, [lo, hi]] of Object.entries(ZONE_PCTS)) {
    // low% → slower pace → higher sec/km; high% → faster → lower sec/km
    zones[zone] = {
      low:  Math.round(60000 / (lo * vVO2max)),  // sec/km (slower end)
      high: Math.round(60000 / (hi * vVO2max)),  // sec/km (faster end)
    }
  }
  return zones
}

// ── 4. raceEquivalents ────────────────────────────────────────────────────────
// Binary search for time T where vdotFromRace(d, T) ≈ vdot.
// vdotFromRace is monotone decreasing in T → standard bisection.
const EQUIV_RANGES = {
  1500:  [180,   600],
  1609:  [240,   720],
  3000:  [480,  1200],
  5000:  [600,  2400],
  10000: [1200, 4800],
  21097: [3000, 10800],
  42195: [6000, 21600],
}

export function raceEquivalents(vdot) {
  const result = {}
  for (const [dStr, [lo, hi]] of Object.entries(EQUIV_RANGES)) {
    const d = parseInt(dStr)
    const vLo = vdotFromRace(d, lo)
    const vHi = vdotFromRace(d, hi)
    if (vLo === null || vHi === null || vdot > vLo || vdot < vHi) {
      result[d] = null
      continue
    }
    let a = lo, b = hi
    for (let i = 0; i < 60; i++) {
      const mid = (a + b) / 2
      if (b - a < 0.5) break
      const v = vdotFromRace(d, mid)
      if (v === null) break
      if (v > vdot) a = mid   // time too short (pace too fast → VDOT too high)
      else          b = mid
    }
    const time = Math.round((a + b) / 2)
    const paceSecKm = Math.round(time / d * 1000)  // sec/km
    result[d] = { time, pace: paceSecKm }
  }
  return result
}

// ── 5. estimateVO2maxTrend ────────────────────────────────────────────────────
// Extracts VDOT estimates from run log entries.
// Entries with distanceM + duration → vdotFromRace (pace-based, high confidence).
// Entries with avgHR + distance → vdotFromPaceHR (HR-based, medium confidence).
// Groups by ISO week, keeps best per week. Returns ≤ 52 entries.
export function estimateVO2maxTrend(runLog, maxHR = 190) {
  if (!runLog || runLog.length === 0) return []

  function isoWeek(dateStr) {
    const d = new Date(dateStr)
    const day = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - day)
    const y = d.getUTCFullYear()
    const jan1 = new Date(Date.UTC(y, 0, 1))
    return `${y}-W${String(Math.ceil((d - jan1) / 604800000)).padStart(2, '0')}`
  }
  function confRank(c) { return c === 'high' ? 2 : c === 'medium' ? 1 : 0 }

  const weekMap = {}
  for (const e of runLog) {
    if (!e.date) continue
    const type = (e.type || '').toLowerCase()
    if (!type.includes('run')) continue

    const durSec = e.durationSec || ((e.duration || 0) * 60)
    if (durSec < 1200) continue    // < 20 min — skip

    const dist    = e.distanceM || e.distance || 0
    const hr      = e.avgHR || 0
    const hrFrac  = maxHR > 0 ? hr / maxHR : 0

    let vdot = null, method = 'HR-based', confidence = 'low'

    // Prefer pace-based (needs distance + time)
    if (dist > 0 && durSec > 0) {
      const v = vdotFromRace(dist, durSec)
      if (v !== null && v > 20 && v < 90) {
        vdot = v
        method = hrFrac >= 0.75 ? 'race-based' : 'pace-based'
        confidence = hrFrac >= 0.75 ? 'high' : 'medium'
      }
    }

    // Fallback: HR-based (needs avgHR + distance)
    if (vdot === null && hr > 0 && hrFrac >= 0.6 && dist > 0 && durSec > 0) {
      const pace = durSec / dist   // sec/m
      const v = vdotFromPaceHR(pace, hr, maxHR)
      if (v !== null && v > 20 && v < 90) {
        vdot = v
        method = 'HR-based'
        confidence = hrFrac >= 0.7 ? 'medium' : 'low'
      }
    }

    if (vdot === null) continue

    const wk = isoWeek(e.date)
    if (!weekMap[wk] || confRank(confidence) > confRank(weekMap[wk].confidence)) {
      weekMap[wk] = {
        date:       e.date,
        vo2max:     Math.round(vdot * 10) / 10,
        method,
        confidence,
      }
    }
  }

  return Object.values(weekMap)
    .sort((a, b) => a.date > b.date ? 1 : -1)
    .slice(-52)
}

// ── 6. fmtPaceSec ─────────────────────────────────────────────────────────────
export function fmtPaceSec(secPerKm) {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}
