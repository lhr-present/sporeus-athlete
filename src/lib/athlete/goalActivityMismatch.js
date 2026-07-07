// src/lib/athlete/goalActivityMismatch.js
//
// v9.104.0 (Prompt DD) — Detect when an athlete's training history is
// dominated by activities that don't match their stated goal sport.
//
// Mission 1 fails silently when the athlete sets a goal in one sport but
// trains another. The plan generator faithfully prescribes running sessions
// to a "5K" goal; the athlete logs strength sessions; the drift card stays
// "on-track" because TSS-compliance is fine; nothing surfaces the mismatch.
//
// This detector compares the goal sport (from profile.primarySport / sport)
// against the rolling sport mix in the log and flags when the dominant
// logged sport doesn't match the goal AND that dominance is strong (>=60%
// of sessions).
//
// Pure function. No I/O.

// ── Sport bucket detection ────────────────────────────────────────────────────
// Map free-form sport / type strings to canonical buckets. The order of
// checks matters: 'cycling' contains 'cycl' but also 'cy' alone; we put the
// most specific patterns first, fallback last.
const SPORT_PATTERNS = [
  { bucket: 'swim',     re: /swim/i },
  { bucket: 'bike',     re: /cycl|bike|ride|spin/i },
  // v9.487 (F14): 'row' must precede 'run' — the run bucket's generic words
  // (tempo/interval/track) shadowed free-form names like "Tempo row".
  { bucket: 'row',      re: /row|erg/i },
  { bucket: 'run',      re: /run|jog|tempo|interval|track/i },
  { bucket: 'strength', re: /strength|lift|weight|gym|squat|deadlift|press/i },
  { bucket: 'walk',     re: /walk|hike/i },
]

/**
 * @description Categorize one log entry into a sport bucket.
 * @returns {string} bucket name, or 'other' when nothing matches
 */
export function categorizeLogEntry(entry) {
  const raw = String(entry?.sport || entry?.type || '').toLowerCase()
  if (!raw) return 'other'
  for (const { bucket, re } of SPORT_PATTERNS) {
    if (re.test(raw)) return bucket
  }
  return 'other'
}

// ── Goal-sport extraction ────────────────────────────────────────────────────
// The goal sport lives on profile.primarySport / profile.sport. Map to the
// same bucket vocabulary the log uses so the comparison is apples-to-apples.
function goalSportBucket(profile) {
  const raw = String(profile?.primarySport || profile?.sport || '').toLowerCase()
  if (!raw) return null
  for (const { bucket, re } of SPORT_PATTERNS) {
    if (re.test(raw)) return bucket
  }
  // Triathlon is multi-sport — return null so we don't flag against any single
  // discipline. Triathletes logging 60% bike is expected, not a mismatch.
  if (raw.includes('tri')) return null
  return null
}

// ── Threshold constants ──────────────────────────────────────────────────────
const DEFAULTS = {
  lookbackDays:      28,    // 4-week rolling window
  dominanceFloor:    0.60,  // logged sport must hit 60% to count as "dominant"
  minSessions:       6,     // need at least 6 sessions in window before flagging
  goalShareCeiling:  0.15,  // goal sport must be ≤ 15% to count as "neglected"
}

/**
 * @description Detect whether the athlete's logged sport mix conflicts with
 *   their stated goal sport.
 *
 * @param {object} profile
 * @param {Array}  log     - training log entries (each { date, sport?, type? })
 * @param {object} [opts]
 * @param {number} [opts.lookbackDays]
 * @param {string} [opts.today]
 *
 * @returns {{
 *   mismatched: boolean,
 *   goalSport:  string | null,
 *   loggedSports: Record<string, number>,  // share 0-1 by bucket
 *   dominantSport: string | null,
 *   dominantShare: number,
 *   sessionsInWindow: number,
 *   recommendation: { en, tr } | null,
 * }}
 */
export function detectGoalActivityMismatch(profile, log, opts = {}) {
  const lookbackDays = Number(opts.lookbackDays) || DEFAULTS.lookbackDays
  const today = opts.today || new Date().toISOString().slice(0, 10)

  const goalSport = goalSportBucket(profile)

  // Build window cutoff
  const cutoff = (() => {
    const d = new Date(today + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - lookbackDays)
    return d.toISOString().slice(0, 10)
  })()
  const windowed = (Array.isArray(log) ? log : [])
    .filter(e => e?.date && String(e.date) >= cutoff)

  // Count sessions per bucket
  const counts = {}
  for (const e of windowed) {
    const b = categorizeLogEntry(e)
    counts[b] = (counts[b] || 0) + 1
  }
  const total = windowed.length

  // Share map (only buckets present)
  const loggedSports = {}
  for (const k of Object.keys(counts)) {
    loggedSports[k] = total > 0 ? Math.round((counts[k] / total) * 100) / 100 : 0
  }

  // Identify dominant bucket
  let dominantSport = null
  let dominantShare = 0
  for (const k of Object.keys(counts)) {
    const share = counts[k] / total
    if (share > dominantShare) { dominantShare = share; dominantSport = k }
  }

  // Base shape for "not mismatched" returns — kept consistent so callers
  // can read loggedSports without branching
  const baseOutput = {
    mismatched: false,
    goalSport,
    loggedSports,
    dominantSport,
    dominantShare: Math.round(dominantShare * 100) / 100,
    sessionsInWindow: total,
    recommendation: null,
  }

  // Guard rails: need a goal sport, enough sessions, and a clearly dominant
  // non-goal bucket.
  if (!goalSport) return baseOutput
  if (total < DEFAULTS.minSessions) return baseOutput
  if (!dominantSport || dominantShare < DEFAULTS.dominanceFloor) return baseOutput
  if (dominantSport === goalSport) return baseOutput

  // Also require the goal sport itself is being neglected — if the athlete
  // is doing 60% strength but ALSO 30% run for a 5K goal, the run is still
  // happening enough not to flag.
  const goalShare = loggedSports[goalSport] || 0
  if (goalShare > DEFAULTS.goalShareCeiling) return baseOutput

  const goalLabel = goalSport.toUpperCase()
  const domLabel  = dominantSport.toUpperCase()
  const domPct    = Math.round(dominantShare * 100)
  const goalPct   = Math.round(goalShare * 100)

  return {
    ...baseOutput,
    mismatched: true,
    recommendation: {
      en: `Your goal targets ${goalLabel}, but ${domPct}% of your last ${lookbackDays} days have been ${domLabel} (only ${goalPct}% ${goalLabel}). Either change the goal to match what you train, or shift the training to match the goal.`,
      tr: `Hedefin ${goalLabel}, ama son ${lookbackDays} günün %${domPct} ${domLabel} (sadece %${goalPct} ${goalLabel}). Ya hedefini antrenmana göre güncelle, ya da antrenmanı hedefe göre.`,
    },
  }
}
