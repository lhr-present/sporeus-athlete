// ─── coachShareEnvelope.js — coach-side ingestion of v=1 SHARE envelope ─────
//
// Pure helper that parses + validates the v=1 envelope emitted by
// EliteProgramCard.shareWithCoach (`src/components/dashboard/EliteProgramCard.jsx`).
// Single source of truth for the contract — `CoachAthleteProgramCard.jsx`
// depends on this module for both happy-path render and error reporting.
//
// Envelope shape (from athlete side):
// {
//   v: 1,
//   kind: 'sporeus-elite-program-share',
//   athleteSnapshot: { sport, distanceM, currentTime, targetTime, raceDate,
//                      weeksAvailable, weeksNeeded, feasibilityBand },
//   physiology: { currentVDOT, targetVDOT, currentFTP, targetFTP,
//                 currentCSS, targetCSS },        // sport-conditional, nulls allowed
//   phases: [{ phase, weeks }],
//   synthetic: null | { raceDate?: bool, targetPR?: bool, raceLabel?: string },
//   lifecycle: { state, percentComplete, daysToRace } | null,
//   citation: string | null,
//   generatedAt: 'YYYY-MM-DD',
// }
//
// Pure, no React, no I/O. Bilingual error code lookup for the UI.
// ─────────────────────────────────────────────────────────────────────────────

const KIND = 'sporeus-elite-program-share'
const SUPPORTED_VERSION = 1

/**
 * Bilingual error code → message lookup.
 *
 * @public
 */
export const COACH_SHARE_ERRORS = {
  'invalid-json': {
    en: 'Could not parse — not valid JSON',
    tr: 'Ayrıştırılamadı — geçerli JSON değil',
  },
  'wrong-kind': {
    en: 'Not a Sporeus elite program share',
    tr: 'Sporeus elit program paylaşımı değil',
  },
  'unsupported-version': {
    en: 'Unsupported version (expected v=1)',
    tr: 'Desteklenmeyen sürüm (v=1 bekleniyor)',
  },
  'missing-required-fields': {
    en: 'Missing required fields (athleteSnapshot or phases)',
    tr: 'Gerekli alanlar eksik (athleteSnapshot veya phases)',
  },
}

function safeNum(v) {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function safeStr(v) {
  return typeof v === 'string' ? v : null
}

function normalizePhysiology(p) {
  const src = (p && typeof p === 'object') ? p : {}
  return {
    currentVDOT: safeNum(src.currentVDOT),
    targetVDOT:  safeNum(src.targetVDOT),
    currentFTP:  safeNum(src.currentFTP),
    targetFTP:   safeNum(src.targetFTP),
    currentCSS:  safeNum(src.currentCSS),
    targetCSS:   safeNum(src.targetCSS),
  }
}

function normalizeSnapshot(s) {
  if (!s || typeof s !== 'object') return null
  return {
    sport:           safeStr(s.sport),
    distanceM:       safeNum(s.distanceM),
    currentTime:     safeNum(s.currentTime),
    targetTime:      safeNum(s.targetTime),
    raceDate:        safeStr(s.raceDate),
    weeksAvailable:  safeNum(s.weeksAvailable),
    weeksNeeded:     safeNum(s.weeksNeeded),
    feasibilityBand: safeStr(s.feasibilityBand),
  }
}

function normalizePhases(arr) {
  if (!Array.isArray(arr)) return null
  return arr.map(p => ({
    phase: safeStr(p?.phase),
    weeks: safeNum(p?.weeks) ?? 0,
  }))
}

function normalizeSynthetic(s) {
  if (s == null) return null
  if (typeof s !== 'object') return null
  const out = {}
  if (s.raceDate != null) out.raceDate = !!s.raceDate
  if (s.targetPR != null) out.targetPR = !!s.targetPR
  if (typeof s.raceLabel === 'string') out.raceLabel = s.raceLabel
  return out
}

function normalizeLifecycle(lc) {
  if (!lc || typeof lc !== 'object') return null
  return {
    state:           safeStr(lc.state),
    percentComplete: safeNum(lc.percentComplete) ?? 0,
    daysToRace:      safeNum(lc.daysToRace),
  }
}

/**
 * Validate a parsed envelope object's shape (for tests + UI defenses).
 * Returns { ok, error } — error is one of the COACH_SHARE_ERRORS keys.
 *
 * Strict floor: athleteSnapshot AND phases must be present. physiology,
 * synthetic, lifecycle are optional. Extra unknown fields are tolerated
 * (forward-compat).
 *
 * @public
 */
export function validateCoachShareEnvelope(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: 'invalid-json' }
  }
  if (obj.kind !== KIND) {
    return { ok: false, error: 'wrong-kind' }
  }
  if (obj.v !== SUPPORTED_VERSION) {
    return { ok: false, error: 'unsupported-version' }
  }
  if (!obj.athleteSnapshot || typeof obj.athleteSnapshot !== 'object' || Array.isArray(obj.athleteSnapshot)) {
    return { ok: false, error: 'missing-required-fields' }
  }
  if (!Array.isArray(obj.phases)) {
    return { ok: false, error: 'missing-required-fields' }
  }
  return { ok: true, error: null }
}

/**
 * Parse a coach-share envelope JSON string and validate its shape.
 *
 * @param {string} jsonStr  Raw paste from the athlete (clipboard or file)
 * @returns {{
 *   ok: boolean,
 *   error: string | null,           // bilingual-keyed error code
 *   envelope: object | null,
 * }}
 *
 * Error codes (used for bilingual lookup in the UI):
 *   'invalid-json'            — could not parse as JSON
 *   'wrong-kind'              — kind !== 'sporeus-elite-program-share'
 *   'unsupported-version'     — v !== 1
 *   'missing-required-fields' — athleteSnapshot or phases missing
 *
 * @public
 */
export function parseCoachShareEnvelope(jsonStr) {
  if (typeof jsonStr !== 'string' || jsonStr.trim() === '') {
    return { ok: false, error: 'invalid-json', envelope: null }
  }
  let raw
  try {
    raw = JSON.parse(jsonStr)
  } catch {
    return { ok: false, error: 'invalid-json', envelope: null }
  }
  const v = validateCoachShareEnvelope(raw)
  if (!v.ok) {
    return { ok: false, error: v.error, envelope: null }
  }
  // Coerce + return defensive copy. Preserve unknown fields for forward-compat.
  const envelope = {
    ...raw,
    v: SUPPORTED_VERSION,
    kind: KIND,
    athleteSnapshot: normalizeSnapshot(raw.athleteSnapshot),
    physiology: normalizePhysiology(raw.physiology),
    phases: normalizePhases(raw.phases) || [],
    synthetic: normalizeSynthetic(raw.synthetic),
    lifecycle: normalizeLifecycle(raw.lifecycle),
    citation: safeStr(raw.citation),
    generatedAt: safeStr(raw.generatedAt),
  }
  return { ok: true, error: null, envelope }
}
