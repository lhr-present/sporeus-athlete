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

const E13_ZONE_INDEX = { Z1: 0, Z2: 1, Z3: 2, Z4: 3, Z5: 4 }
const E13_ZONE_COLOR = (z) => ZONE_COLORS[E13_ZONE_INDEX[z] ?? 1]
const DAY_NAMES_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * @description Map an E13 adaptive plan to the legacy week-card shape.
 *
 * @param {Object|null} adaptivePlan - generatePlan() output
 * @param {'en'|'tr'} [lang='en']
 * @param {string|null} [primarySport=null] - 'Running' | 'Cycling' | ... or null.
 *   Falls back to adaptivePlan.primarySport when omitted.
 * @returns {Array|null} legacy weeks array, or null when adaptivePlan is empty.
 */
export function adaptE13PlanToLegacy(adaptivePlan, lang = 'en', primarySport = null) {
  if (!adaptivePlan || !Array.isArray(adaptivePlan.weeks)) return null
  const sport = primarySport || adaptivePlan.primarySport || null
  return adaptivePlan.weeks.map(wk => {
    const sessions = (wk.sessions || []).map((s) => {
      const typeName = sportSpecificLabel(s.intent, sport, lang)
      // Approximate duration from targetTSS using the RPE midpoint (Banister-like)
      const rpeMid = (s.rpeLow + s.rpeHigh) / 2
      const intensityFactor = Math.max(0.5, rpeMid / 10)
      const duration = s.intent === 'rest'
        ? 0
        : Math.max(20, Math.round(s.targetTSS / (intensityFactor * intensityFactor) * 0.6))
      return {
        day:         DAY_NAMES_EN[(s.day - 1) % 7] || DAY_NAMES_EN[0],
        type:        typeName,
        duration,
        rpe:         rpeMid,
        tss:         s.targetTSS,
        zone:        s.zone === 'Z0' ? '—' : s.zone,
        color:       E13_ZONE_COLOR(s.zone),
        description: '',
      }
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
