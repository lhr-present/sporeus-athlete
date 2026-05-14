// src/lib/athlete/derivedSessionTargets.js
//
// v9.91.0 — Derive pace / power targets for a planned session at render time
// from the athlete's physiology (threshold pace for running, FTP for cycling).
//
// Why this exists:
// The main Plan generator (src/lib/plan/generatePlan.js → adaptE13PlanToLegacy)
// produces sessions with { type, duration, rpe, tss, zone } but NO paceTarget.
// The elite-program path (src/lib/athlete/eliteProgram.js) sets paceTarget
// from precomputed paces. So users on the standard Plan see no pace target on
// the v9.84 TodayView strip — Mission 1 leak.
//
// Fix: derive at render time from { profile.threshold, profile.ftp } and
// session.zone. Falls back to null when physiology isn't set, leaving the
// existing strip-hidden behaviour.
//
// Pure functions. No side effects.

// ── Running zone → pace offset (seconds per km), anchored on threshold pace ──
// Daniels (2014) / Friel (2012) intensity zones for endurance running.
// Positive = slower than threshold; negative = faster.
const RUN_ZONE_PACE_OFFSET_SEC = {
  Z1: { lo:  90, hi:  60 },  // easy: T + 60–90s/km
  Z2: { lo:  35, hi:  20 },  // marathon: T + 20–35s/km
  Z3: { lo:  15, hi:   8 },  // tempo: T + 8–15s/km
  Z4: { lo:   5, hi:  -5 },  // threshold: T ± 5s
  Z5: { lo:  -8, hi: -15 },  // VO2 / interval: T − 8–15s
  Z6: { lo: -18, hi: -30 },  // rep / neuromuscular: T − 18–30s
}

// ── Cycling zone → % FTP (Coggan) ───────────────────────────────────────────
// Source: Allen & Coggan, "Training and Racing with a Power Meter" (2010).
const BIKE_ZONE_PCT_FTP = {
  Z1: { lo: 0.45, hi: 0.55 },
  Z2: { lo: 0.56, hi: 0.75 },
  Z3: { lo: 0.76, hi: 0.90 },
  Z4: { lo: 0.91, hi: 1.05 },
  Z5: { lo: 1.06, hi: 1.20 },
  Z6: { lo: 1.21, hi: 1.50 },
}

// ── Running zone → % max HR ─────────────────────────────────────────────────
// Karvonen 1957 / Tanaka 2001 / Friel's standard zone breakdown. Bounds are
// nominal — overlap at the edges is intentional so adjacent zones don't pop
// a gap when an athlete drifts. v9.155.0 (Prompt 12): `hrTarget` had zero
// producers across the codebase; HR delta in v9.153 was dead code until now.
const RUN_ZONE_PCT_MAXHR = {
  Z1: { lo: 0.65, hi: 0.75 },  // recovery / easy
  Z2: { lo: 0.75, hi: 0.83 },  // aerobic
  Z3: { lo: 0.83, hi: 0.88 },  // tempo
  Z4: { lo: 0.88, hi: 0.93 },  // threshold
  Z5: { lo: 0.93, hi: 0.98 },  // VO2 / interval
  Z6: { lo: 0.98, hi: 1.00 },  // neuromuscular (degenerate band — at-max)
}

// ── Swimming zone → % CSS pace (Wakayoshi 1992) ─────────────────────────────
// Source: Wakayoshi et al., "Determination and validity of critical velocity
// as swimming fatigue threshold." Pace is sec/100m: HIGHER value = SLOWER.
// `lo` = slower end (paceMax in sec/100m), `hi` = faster end (paceMin).
// Z1/Z6 have practical bounds (130% / 75%) so the displayed range isn't open.
const SWIM_ZONE_PCT_CSS = {
  Z1: { lo: 1.30, hi: 1.20 },  // recovery — slower than CSS+20%
  Z2: { lo: 1.20, hi: 1.10 },  // aerobic
  Z3: { lo: 1.10, hi: 1.00 },  // CSS / threshold pace
  Z4: { lo: 1.00, hi: 0.95 },  // threshold-high
  Z5: { lo: 0.95, hi: 0.85 },  // VO2max
  Z6: { lo: 0.85, hi: 0.75 },  // anaerobic
}

// Parse a pace string in "M:SS" or "MM:SS" form into total seconds.
function parsePaceToSec(s) {
  if (typeof s !== 'string') return null
  const m = s.match(/^(\d{1,2}):([0-5]\d)$/)
  if (!m) return null
  const min = parseInt(m[1], 10)
  const sec = parseInt(m[2], 10)
  if (min < 1 || min > 30) return null
  return min * 60 + sec
}

// Format total seconds back to "M:SS".
function formatSecToPace(totalSec) {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return null
  const min = Math.floor(totalSec / 60)
  const sec = Math.round(totalSec % 60)
  // Handle 59.5 → 60 rollover
  if (sec === 60) return `${min + 1}:00`
  return `${min}:${String(sec).padStart(2, '0')}`
}

// Detect the dominant zone for a session. Sessions can carry an explicit
// `zone` string (e.g. 'Z4'), OR a `zones` object with per-zone minutes.
// For the per-zone form, pick the zone with the most minutes (Z1/Z2 ignored
// when a high-intensity zone is present — that's the SESSION INTENT zone).
function dominantZone(session) {
  if (typeof session?.zone === 'string') {
    const z = session.zone.toUpperCase()
    if (/^Z[1-6]$/.test(z)) return z
  }
  if (session?.zones && typeof session.zones === 'object') {
    // Prefer the highest-intensity zone with >0 minutes (intent-dominant
    // rather than minute-dominant: an interval session is mostly Z1 warm-up
    // by minutes but Z5 is the prescription).
    for (const z of ['Z5', 'Z4', 'Z3', 'Z2', 'Z1']) {
      if (Number(session.zones[z]) > 0) return z
    }
  }
  return null
}

// Detect whether the session is a cycling/bike workout.
function isCyclingSession(session, profile) {
  const sport = String(profile?.primarySport || '').toLowerCase()
  if (sport.includes('cycl') || sport.includes('bike')) return true
  const typeStr = String(session?.type || session?.intent || '').toLowerCase()
  return /bike|cycl|ride|ftp|w'/i.test(typeStr)
}

// v9.98.0 — Detect whether the session is a swim workout.
function isSwimSession(session, profile) {
  const sport = String(profile?.primarySport || '').toLowerCase()
  if (sport.includes('swim')) return true
  const typeStr = String(session?.type || session?.intent || '').toLowerCase()
  return /swim|css/i.test(typeStr)
}

/**
 * Derive a pace-range string ("M:SS–M:SS/km") for the session's zone, from
 * the athlete's threshold running pace. Returns null when no threshold is
 * set or the zone can't be inferred.
 *
 * @param {object} session - planned session: { type, zone, zones, duration, ... }
 * @param {object} profile - athlete profile: { threshold, primarySport, ... }
 * @returns {string|null} e.g. "5:30–5:45" or null
 */
export function deriveSessionPace(session, profile) {
  if (!session || !profile) return null
  if (isCyclingSession(session, profile)) return null  // power, not pace
  if (isSwimSession(session, profile)) return null     // swim CSS handled separately
  const tSec = parsePaceToSec(profile.threshold)
  if (tSec == null) return null
  const zone = dominantZone(session)
  if (!zone) return null
  const offset = RUN_ZONE_PACE_OFFSET_SEC[zone]
  if (!offset) return null
  const fastSec = tSec + offset.hi  // smaller offset → faster (smaller sec/km)
  const slowSec = tSec + offset.lo
  // Pace strings show slower side first by convention: "5:30–5:45/km" means
  // "between 5:30 (fast) and 5:45 (slow)". Order low→hi so fast appears first.
  const fast = formatSecToPace(Math.min(fastSec, slowSec))
  const slow = formatSecToPace(Math.max(fastSec, slowSec))
  if (!fast || !slow) return null
  return fast === slow ? fast : `${fast}–${slow}`
}

/**
 * Derive a power-range string ("190–225W") for the session's zone from FTP.
 * Returns null when no FTP is set or the session isn't cycling.
 *
 * @param {object} session - planned session
 * @param {object} profile - athlete profile: { ftp, ... }
 * @returns {string|null} e.g. "190–225W" or null
 */
export function deriveSessionPower(session, profile) {
  if (!session || !profile) return null
  if (!isCyclingSession(session, profile)) return null
  const ftp = Number(profile.ftp)
  if (!Number.isFinite(ftp) || ftp <= 0) return null
  const zone = dominantZone(session)
  if (!zone) return null
  const pct = BIKE_ZONE_PCT_FTP[zone]
  if (!pct) return null
  const lo = Math.round(ftp * pct.lo)
  const hi = Math.round(ftp * pct.hi)
  return lo === hi ? `${lo}W` : `${lo}–${hi}W`
}

/**
 * v9.98.0 — Derive a swim pace-range string ("M:SS–M:SS/100m") for the
 * session's zone from the athlete's CSS pace (sec/100m). Returns null
 * when no CSS is set or the session isn't a swim.
 *
 * @param {object} session - planned session
 * @param {object} profile - athlete profile: { cssSec, ... }
 * @returns {string|null} e.g. "1:30–1:39/100m" or null
 * @source Wakayoshi 1992 (Critical Swim Speed zones)
 */
export function deriveSessionSwimPace(session, profile) {
  if (!session || !profile) return null
  if (!isSwimSession(session, profile)) return null
  const cssSec = Number(profile.cssSec)
  if (!Number.isFinite(cssSec) || cssSec <= 0) return null
  const zone = dominantZone(session)
  if (!zone) return null
  const pct = SWIM_ZONE_PCT_CSS[zone]
  if (!pct) return null
  const fastSec = cssSec * pct.hi  // lower sec/100m = faster
  const slowSec = cssSec * pct.lo
  const fast = formatSecToPace(Math.min(fastSec, slowSec))
  const slow = formatSecToPace(Math.max(fastSec, slowSec))
  if (!fast || !slow) return null
  return fast === slow ? `${fast}/100m` : `${fast}–${slow}/100m`
}

/**
 * v9.155.0 (Prompt 12) — Derive an HR-range string ("148-168") for the
 * session's zone from the athlete's max HR. Returns null when no maxhr
 * is set, the session can't be zoned, or the sport isn't run-like
 * (cycling uses power; swim uses CSS pace — HR norms shift under-water).
 *
 * Format: hyphen-separated bpm range, no unit suffix — matches what
 * `parseHrTarget` in sessionExecution.js consumes.
 *
 * @param {object} session - planned session
 * @param {object} profile - athlete profile: { maxhr, primarySport, ... }
 * @returns {string|null} e.g. "148-168" or null
 */
export function deriveSessionHr(session, profile) {
  if (!session || !profile) return null
  if (isCyclingSession(session, profile)) return null
  if (isSwimSession(session, profile)) return null
  const maxhr = Number(profile.maxhr)
  if (!Number.isFinite(maxhr) || maxhr < 60 || maxhr > 250) return null
  const zone = dominantZone(session)
  if (!zone) return null
  const pct = RUN_ZONE_PCT_MAXHR[zone]
  if (!pct) return null
  const lo = Math.round(maxhr * pct.lo)
  const hi = Math.round(maxhr * pct.hi)
  return lo === hi ? String(lo) : `${lo}-${hi}`
}

/**
 * One-call convenience that picks pace OR power depending on sport.
 * Returns { paceTarget, powerTarget, hrTarget }. At most one of paceTarget /
 * powerTarget will be non-null; hrTarget can coexist with paceTarget for
 * running sessions.
 * v9.98.0: paceTarget covers BOTH run-pace and swim-pace (the suffix —
 * "/km" implicit for run, "/100m" explicit for swim — disambiguates).
 * v9.155.0: hrTarget added so the v9.153 EXECUTION HR-delta block actually
 * has data to compare against.
 */
export function deriveSessionTargets(session, profile) {
  return {
    paceTarget:  deriveSessionPace(session, profile) || deriveSessionSwimPace(session, profile),
    powerTarget: deriveSessionPower(session, profile),
    hrTarget:    deriveSessionHr(session, profile),
  }
}
