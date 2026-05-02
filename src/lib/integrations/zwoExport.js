// ─── zwoExport.js — Zwift .zwo workout XML exporter (E125) ───────────────────
//
// Pure-function library that turns a structured workout description into a
// Zwift .zwo XML string. The .zwo format is also accepted by Wahoo SYSTM,
// TrainerRoad, and other indoor training platforms, so this lets a Sporeus
// athlete plan a workout in the app and execute it on the trainer of choice.
//
// Power values throughout are FTP fractions (0.50 = 50% FTP, 1.00 = FTP,
// 1.20 = 120% FTP). The .zwo spec encodes targets that way natively.
//
// All functions are pure with the single exception of `downloadZwoFile`, which
// triggers a browser download via Blob + URL.createObjectURL — same pattern as
// `downloadCSVTemplate` in src/lib/fileImport.js.

// ── XML escaping ──────────────────────────────────────────────────────────────

/**
 * Escape a string for safe inclusion in XML text/attributes.
 * @param {string} s
 * @returns {string}
 */
function xmlEscape(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Format a power value as an FTP fraction with 2 decimal places.
 * Clamped to [0, 2.0] to keep .zwo files within sane Zwift ranges.
 * @param {number} p
 * @returns {string}
 */
function fmtPower(p) {
  const n = Number(p)
  if (!Number.isFinite(n)) return '0.50'
  const clamped = Math.max(0, Math.min(2, n))
  return clamped.toFixed(2)
}

/**
 * Format a duration value as integer seconds (≥ 0).
 * @param {number} s
 * @returns {string}
 */
function fmtDuration(s) {
  const n = Math.max(0, Math.round(Number(s) || 0))
  return String(n)
}

// ── Block → XML element ───────────────────────────────────────────────────────

/**
 * Render a single block to its .zwo element string. Returns null if the block
 * type is unknown or required fields are missing/invalid.
 * @param {object} b
 * @returns {string|null}
 */
function renderBlock(b) {
  if (!b || typeof b !== 'object' || !b.type) return null
  switch (b.type) {
    case 'warmup':
      return `<Warmup Duration="${fmtDuration(b.durationSec)}" PowerLow="${fmtPower(b.powerLow)}" PowerHigh="${fmtPower(b.powerHigh)}"/>`
    case 'cooldown':
      return `<Cooldown Duration="${fmtDuration(b.durationSec)}" PowerLow="${fmtPower(b.powerLow)}" PowerHigh="${fmtPower(b.powerHigh)}"/>`
    case 'steady':
      return `<SteadyState Duration="${fmtDuration(b.durationSec)}" Power="${fmtPower(b.power)}"/>`
    case 'intervals':
      return `<IntervalsT Repeat="${Math.max(1, Math.round(Number(b.repeat) || 1))}" OnDuration="${fmtDuration(b.onSec)}" OffDuration="${fmtDuration(b.offSec)}" OnPower="${fmtPower(b.onPower)}" OffPower="${fmtPower(b.offPower)}"/>`
    case 'freeride':
      return `<FreeRide Duration="${fmtDuration(b.durationSec)}"/>`
    case 'ramp':
      return `<Ramp Duration="${fmtDuration(b.durationSec)}" PowerLow="${fmtPower(b.powerLow)}" PowerHigh="${fmtPower(b.powerHigh)}"/>`
    default:
      return null
  }
}

// ── Build a .zwo XML string ───────────────────────────────────────────────────

/**
 * Build a Zwift .zwo workout XML string from a structured workout description.
 *
 * @param {object} workout
 * @param {string} workout.name             workout title (required)
 * @param {string} [workout.description]    optional human-readable description
 * @param {string} [workout.author='Sporeus'] author tag
 * @param {string} [workout.sport='bike']   'bike' or 'run'
 * @param {Array<object>} workout.blocks    structured intervals (≥ 1)
 * @returns {{ xml: string, errors: string[] }}
 */
export function buildZwoWorkout(workout) {
  const errors = []

  if (!workout || typeof workout !== 'object') {
    return { xml: '', errors: ['workout must be an object'] }
  }

  const name = workout.name != null ? String(workout.name).trim() : ''
  if (!name) errors.push('name is required')

  const blocks = Array.isArray(workout.blocks) ? workout.blocks : []
  if (blocks.length === 0) errors.push('blocks must be a non-empty array')

  // If hard prerequisites are missing, return errors with no XML.
  if (!name || blocks.length === 0) {
    return { xml: '', errors }
  }

  const author      = workout.author != null && String(workout.author).trim()
    ? String(workout.author).trim()
    : 'Sporeus'
  const description = workout.description != null ? String(workout.description) : ''
  const sport       = workout.sport === 'run' ? 'run' : 'bike'

  // Render blocks; collect errors for unknown / invalid types but keep going.
  const elements = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const el = renderBlock(b)
    if (el == null) {
      errors.push(`Block ${i}: unknown or invalid type "${b && b.type}"`)
      continue
    }
    elements.push('    ' + el)
  }

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<workout_file>',
    `  <author>${xmlEscape(author)}</author>`,
    `  <name>${xmlEscape(name)}</name>`,
    `  <description>${xmlEscape(description)}</description>`,
    `  <sportType>${xmlEscape(sport)}</sportType>`,
    '  <tags></tags>',
    '  <workout>',
    ...elements,
    '  </workout>',
    '</workout_file>',
    '',
  ].join('\n')

  return { xml, errors }
}

// ── Sporeus session → workout shape ───────────────────────────────────────────

const RECOVERY_POWER = 0.50
const LONG_POWER     = 0.65
const STEADY_POWER   = 0.75
const TEMPO_POWER    = 0.85

const WARMUP_SEC   = 600  // 10 min
const COOLDOWN_SEC = 300  // 5 min

/**
 * Convert a Sporeus session intent (from raceWeekProtocol or generatePlan) into
 * a structured Zwift workout. Adds a 10-min warmup and 5-min cooldown for all
 * non-recovery intents; recovery rides emit a single steady block.
 *
 * Power values in the resulting workout are FTP fractions, so the consumer can
 * use them directly with `buildZwoWorkout`. The `ftp` arg is accepted for API
 * symmetry / future use but is not required by the .zwo format itself.
 *
 * @param {object} session  { intent, duration (min), rpeLow, rpeHigh, ... }
 * @param {number} [ftp]    athlete FTP for power scaling (used as 1.0 reference)
 * @returns {object} workout shape compatible with buildZwoWorkout
 */
export function sessionToZwoWorkout(session, ftp) {
  const s = session || {}
  const intent = String(s.intent || '').toLowerCase().trim()
  const durationMin = Math.max(0, Number(s.duration) || 0)
  const totalSec = Math.round(durationMin * 60)

  // Build a generic warmup + main + cooldown workout for non-recovery intents.
  const wuCdSec = WARMUP_SEC + COOLDOWN_SEC
  const mainSec = Math.max(60, totalSec - wuCdSec)  // never negative; minimum 1 min main

  const baseName = s.name || s.title || (intent ? `${intent[0].toUpperCase()}${intent.slice(1)} session` : 'Sporeus session')

  // FTP is recorded in the description for athlete reference but does not
  // affect block math — .zwo encodes targets as FTP fractions natively.
  const ftpNote = Number.isFinite(Number(ftp)) && Number(ftp) > 0
    ? ` (FTP ${Math.round(Number(ftp))}W)`
    : ''
  const description = `Sporeus ${intent || 'session'}${ftpNote}`.trim()

  switch (intent) {
    case 'recovery':
      return {
        name: baseName,
        description,
        author: 'Sporeus',
        sport: 'bike',
        blocks: [
          { type: 'steady', durationSec: totalSec || 1800, power: RECOVERY_POWER },
        ],
      }

    case 'long':
      return {
        name: baseName,
        description,
        author: 'Sporeus',
        sport: 'bike',
        blocks: [
          { type: 'warmup',   durationSec: WARMUP_SEC,   powerLow: 0.50, powerHigh: 0.65 },
          { type: 'steady',   durationSec: mainSec,      power: LONG_POWER },
          { type: 'cooldown', durationSec: COOLDOWN_SEC, powerLow: 0.55, powerHigh: 0.40 },
        ],
      }

    case 'steady':
      return {
        name: baseName,
        description,
        author: 'Sporeus',
        sport: 'bike',
        blocks: [
          { type: 'warmup',   durationSec: WARMUP_SEC,   powerLow: 0.50, powerHigh: 0.70 },
          { type: 'steady',   durationSec: mainSec,      power: STEADY_POWER },
          { type: 'cooldown', durationSec: COOLDOWN_SEC, powerLow: 0.60, powerHigh: 0.40 },
        ],
      }

    case 'tempo':
      return {
        name: baseName,
        description,
        author: 'Sporeus',
        sport: 'bike',
        blocks: [
          { type: 'warmup',   durationSec: WARMUP_SEC,   powerLow: 0.50, powerHigh: 0.75 },
          { type: 'steady',   durationSec: mainSec,      power: TEMPO_POWER },
          { type: 'cooldown', durationSec: COOLDOWN_SEC, powerLow: 0.65, powerHigh: 0.40 },
        ],
      }

    case 'intervals':
      return {
        name: baseName,
        description,
        author: 'Sporeus',
        sport: 'bike',
        blocks: [
          { type: 'warmup',    durationSec: WARMUP_SEC,   powerLow: 0.50, powerHigh: 0.85 },
          { type: 'intervals', repeat: 5, onSec: 180, offSec: 120, onPower: 1.05, offPower: 0.55 },
          { type: 'cooldown',  durationSec: COOLDOWN_SEC, powerLow: 0.65, powerHigh: 0.40 },
        ],
      }

    default:
      // Fallback — treat as a freeride for the requested duration.
      return {
        name: baseName,
        description,
        author: 'Sporeus',
        sport: 'bike',
        blocks: [
          { type: 'freeride', durationSec: totalSec || 1800 },
        ],
      }
  }
}

// ── Browser download (only side-effecting export) ─────────────────────────────

/**
 * Trigger a browser download of a .zwo file.
 * Mirrors the Blob + URL.createObjectURL pattern used by `downloadCSVTemplate`
 * in src/lib/fileImport.js.
 *
 * @param {string} xml      the .zwo XML string from buildZwoWorkout
 * @param {string} [filename='workout.zwo']
 * @returns {void}
 */
export function downloadZwoFile(xml, filename) {
  const safeName = filename && String(filename).trim() ? String(filename).trim() : 'workout.zwo'
  const blob = new Blob([xml || ''], { type: 'application/xml' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = safeName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
