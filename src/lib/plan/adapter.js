// src/lib/plan/adapter.js
//
// v9.95.0 — Mission 1 chain: ONBOARDING → TARGET.
//
// Shared adapter that maps the E13 adaptive plan (generatePlan.js output)
// to the legacy week-card shape that the rest of the app reads:
// `{ week, phase, sessions: [{ day, type, duration, rpe, tss, zone, color, ... }],
//    totalHours, tss, zonePct, isDeload }`.
//
// Until v9.95 this lived as duplicate code in PlanGenerator.jsx +
// PlanTemplatePicker.jsx. v9.95 adds a third caller (`useAppState`'s
// finishOnboarding) so this is the right time to consolidate. Pure
// function — no React, no DOM.

import { ZONE_COLORS } from '../constants.js'
import { sportSpecificLabel } from './generatePlan.js'
import { buildSessionTarget } from '../athlete/sessionTargets.js'

const E13_ZONE_INDEX = { Z1: 0, Z2: 1, Z3: 2, Z4: 3, Z5: 4 }
const E13_ZONE_COLOR = (z) => ZONE_COLORS[E13_ZONE_INDEX[z] ?? 1]
const DAY_NAMES_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// v9.158.0 (Prompt D) — Threshold-aware duration scaling baseline.
// Anchor: 5:30/km = 330 sec/km. Athletes at the baseline see no scaling;
// faster threshold → shorter session, slower → longer. Sqrt damping keeps
// the swing modest (~15% at 4:00/km, +9% at 6:30/km) instead of linear.
// Running-only: cycling/swim/row TSS already correctly tracks work in
// athlete-relative units; the adjustment is specifically for the
// per-minute mechanical-impact load of running.
const THRESHOLD_BASELINE_SEC_PER_KM = 330

/**
 * Parse a pace string ("M:SS" / "MM:SS") into total seconds.
 * Returns null on garbage input.
 */
function parsePaceStrSec(s) {
  if (typeof s === 'number') return Number.isFinite(s) && s > 0 ? s : null
  if (typeof s !== 'string') return null
  const m = s.trim().match(/^(\d{1,2}):([0-5]\d)/)
  if (!m) return null
  const sec = Number(m[1]) * 60 + Number(m[2])
  return sec > 0 ? sec : null
}

function isRunningSport(sport) {
  if (typeof sport !== 'string') return false
  return /^running$/i.test(sport.trim())
}

/**
 * @description Map an E13 adaptive plan to the legacy week-card shape.
 *
 * @param {Object|null} adaptivePlan - generatePlan() output
 * @param {'en'|'tr'} [lang='en']
 * @param {string|null} [primarySport=null] - 'Running' | 'Cycling' | ... or null.
 *   Falls back to adaptivePlan.primarySport when omitted.
 * @param {Object} [options] - v9.158.0
 * @param {string|number|null} [options.threshold=null] - Athlete's threshold
 *   pace. Either an "M:SS" string ("4:30") or seconds-per-km (270). Only
 *   applied when the sport is Running. Faster threshold → shorter sessions
 *   for the same TSS; sqrt-damped scaling against a 5:30/km baseline.
 * @returns {Array|null} legacy weeks array, or null when adaptivePlan is empty.
 */
export function adaptE13PlanToLegacy(adaptivePlan, lang = 'en', primarySport = null, options = {}) {
  if (!adaptivePlan || !Array.isArray(adaptivePlan.weeks)) return null
  const sport = primarySport || adaptivePlan.primarySport || null

  // v9.158.0 (Prompt D) — Threshold-aware duration scaling. Pre-fix the
  // adapter computed duration purely from TSS/IF² — athlete-relative for
  // TSS but identical wall-clock duration for fast and slow runners with
  // matching IF. That ignores the impact-load argument: a 4:00/km runner
  // covers more ground per minute, so per-minute mechanical stress is
  // higher. Scale duration by sqrt(thresholdSec / 330) for running only.
  const thresholdSec = isRunningSport(sport) ? parsePaceStrSec(options.threshold) : null
  const durationScale = thresholdSec
    ? Math.sqrt(thresholdSec / THRESHOLD_BASELINE_SEC_PER_KM)
    : 1

  // v9.412 — physiology-driven intensity targets (flag-gated). When on + a profile is
  // supplied, attach athlete-relative pace/power/HR targets to each session via the cited
  // buildSessionTarget engine. Default off → output is byte-identical (no `target` key).
  const profile = options.profile || null
  const withTargets = !!options.physiologyTargets && !!profile

  return adaptivePlan.weeks.map(wk => {
    const sessions = (wk.sessions || []).map((s) => {
      const typeName = sportSpecificLabel(s.intent, sport, lang)
      // s.rpeLow/rpeHigh are on the Borg 6–20 scale (generatePlan RPE_BANDS).
      const rpeMid = (s.rpeLow + s.rpeHigh) / 2
      // v9.358.0 — Convert Borg RPE → a real intensity factor (~0.5–1.05) for
      // the TSS→duration formula (duration = TSS / IF² · 0.6). The old
      // `rpeMid / 10` yielded IF 1.0–1.8 (physically impossible; IF ≤ ~1.05),
      // so duration was divided 1.2–3.6× too much and every low-TSS onboarding
      // session collapsed to the Math.max(20, …) floor. Mapping: 6→0.40,
      // 20→1.10, clamped [0.5, 1.05] → endurance(11)≈0.65, vo2(17)≈0.95.
      const intensityFactor = Math.min(1.05, Math.max(0.5, 0.40 + (rpeMid - 6) / 14 * 0.70))
      const rawDuration = s.intent === 'rest'
        ? 0
        : s.targetTSS / (intensityFactor * intensityFactor) * 0.6
      const duration = s.intent === 'rest'
        ? 0
        : Math.max(20, Math.round(rawDuration * durationScale))
      // Store RPE on the app-wide 1–10 scale (Borg 6→1, 20→10). Logged sessions,
      // TodayView's `rpe >= 7` "hard today" check, the QuickAdd prefill slider
      // (validated 1–10), and the execution comparison all assume 1–10 — storing
      // Borg here mislabeled EVERY session "hard" and overflowed log validation.
      const rpe10 = s.intent === 'rest'
        ? 0
        : Math.min(10, Math.max(1, Math.round(1 + (rpeMid - 6) * 9 / 14)))
      const session = {
        day:         DAY_NAMES_EN[(s.day - 1) % 7] || DAY_NAMES_EN[0],
        type:        typeName,
        duration,
        rpe:         rpe10,
        tss:         s.targetTSS,
        zone:        s.zone === 'Z0' ? '—' : s.zone,
        color:       E13_ZONE_COLOR(s.zone),
        description: '',
      }
      if (withTargets && s.intent !== 'rest') {
        const t = buildSessionTarget({ plannedSession: session, profile })
        if (t && (t.paceTarget || t.powerTarget || t.hrTarget)) {
          session.target = {
            pace:   t.paceTarget  || null,
            power:  t.powerTarget || null,
            hr:     t.hrTarget    || null,
            if:     t.ifTarget ?? null,
            source: t.sourceLabel || null,
          }
        }
      }
      return session
    })
    const zd = wk.zoneDistribution || {}
    const zonePct = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map(z => Math.round((zd[z] || 0) * 100))
    return {
      week:       wk.weekNum,
      phase:      wk.phase,
      sessions,
      totalHours: ((wk.weeklyTSS / 60) * 0.9).toFixed(1),
      tss:        wk.weeklyTSS,
      zonePct,
      isDeload:   wk.isDeload || false,
    }
  })
}
