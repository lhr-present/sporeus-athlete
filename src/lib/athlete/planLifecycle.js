// ─── planLifecycle.js — Elite Program lifecycle classifier (v8.97.0) ─────────
//
// Pure function that classifies an athlete's saved Elite Program into a
// lifecycle state. Surfaces a developer-facing API contract that downstream
// UI (lifecycle pill, coach share payload, etc.) can rely on without
// duplicating the rules.

import { logEntrySport } from './_logSport.js'
//
// State machine:
//   draft         — program saved, not yet applied to calendar
//   applied       — applied to YearlyPlan, but no log entries within
//                   program window yet
//   in-progress   — applied AND log has entries within program window AND
//                   raceDate is in the future
//   complete      — raceDate passed AND log has matching race entry within
//                   ±7 days of raceDate
//   autopsy-ready — raceDate passed within last 14 days AND no matching
//                   race log entry (waiting for athlete to log result)
//   expired       — raceDate passed >14 days ago with no race log entry
//
// Pure, no React, no I/O. Bilingual labels embedded.
// ─────────────────────────────────────────────────────────────────────────────

const STATE_LABELS = {
  draft:           { en: 'DRAFT',         tr: 'TASLAK' },
  applied:         { en: 'APPLIED',       tr: 'UYGULANDI' },
  'in-progress':   { en: 'IN PROGRESS',   tr: 'DEVAM EDİYOR' },
  complete:        { en: 'COMPLETE',      tr: 'TAMAMLANDI' },
  'autopsy-ready': { en: 'AUTOPSY READY', tr: 'OTOPSI HAZIR' },
  expired:         { en: 'EXPIRED',       tr: 'SÜRESİ DOLDU' },
}

const STATE_COLORS = {
  draft:           '#6c757d',
  applied:         '#0064ff',
  'in-progress':   '#ff6600',
  complete:        '#28a745',
  'autopsy-ready': '#ff9500',
  expired:         '#999',
}

function parseUTCDate(s) {
  if (!s || typeof s !== 'string') return null
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return isNaN(d.getTime()) ? null : d
}

function todayUTC() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function daysBetween(a, b) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000)
}

function unreliable(state = 'draft') {
  return {
    state,
    label: STATE_LABELS[state],
    color: STATE_COLORS[state],
    daysToRace: null,
    percentComplete: 0,
    reliable: false,
    coachEdits: { applied: 0, pending: 0, total: 0 },
  }
}

function logEntryDistanceM(e) {
  if (!e || typeof e !== 'object') return null
  if (typeof e.distanceM === 'number' && e.distanceM > 0) return e.distanceM
  if (typeof e.distanceKm === 'number' && e.distanceKm > 0) return e.distanceKm * 1000
  return null
}

// logEntrySport extracted to shared helper at ./_logSport.js (v8.100.0).

/**
 * Compute the lifecycle state of a saved Elite Program.
 *
 * @param {Object} program  The saved buildEliteProgram return value (must
 *   include input.raceDate and input.targetPR — or at least input.sport).
 * @param {Array}  log      training_log entries.
 * @param {Object} options  { today: ISO date, yearlyPlan: object|null,
 *                            programStart: ISO date|null }
 * @returns {{
 *   state: 'draft'|'applied'|'in-progress'|'complete'|'autopsy-ready'|'expired',
 *   label: { en: string, tr: string },
 *   color: string,
 *   daysToRace: number|null,
 *   percentComplete: number,
 *   reliable: boolean,
 *   coachEdits: { applied: number, pending: number, total: number }   // v9.3.0
 * }}
 */
export function getPlanLifecycle(program, log, options) {
  const opts = options || {}
  const today = opts.today ? parseUTCDate(opts.today) : todayUTC()
  if (!today) return unreliable('draft')

  // Must have a program with input + raceDate + programStart for reliable output
  const input = program?.input || null
  const raceDateStr = input?.raceDate
    || program?.feasibility?.effectiveRaceDate
    || null
  const raceDate = parseUTCDate(raceDateStr)
  const programStart = parseUTCDate(opts.programStart || null)

  if (!program || !input || !raceDate || !programStart) {
    return unreliable('draft')
  }

  const daysToRace = daysBetween(today, raceDate)
  const yearlyPlan = opts.yearlyPlan || null
  const safeLog = Array.isArray(log) ? log : []

  // ── Detect "applied" — yearly plan has at least one week with TSS > 0 ────
  let isApplied = false
  if (yearlyPlan && Array.isArray(yearlyPlan.weeks) && yearlyPlan.weeks.length) {
    isApplied = yearlyPlan.weeks.some(w => Number(w?.targetTSS) > 0)
  }

  // ── Find log entries inside the program window [programStart, today] ─────
  const inWindow = safeLog.filter(e => {
    if (!e || typeof e !== 'object') return false
    const d = parseUTCDate(e.date)
    if (!d) return false
    return d.getTime() >= programStart.getTime()
      && d.getTime() <= today.getTime()
  })

  // ── Race-day match window: ±7d of raceDate, sport + distance ±10% match ──
  const targetSport = input.sport || program?.sport || null
  const targetDistanceM = input?.targetPR?.distanceM
    || program?.resolvedTargetPR?.distanceM
    || null
  const sevenDaysMs = 7 * 86400000
  const raceMatch = safeLog.find(e => {
    if (!e || typeof e !== 'object') return false
    const d = parseUTCDate(e.date)
    if (!d) return false
    if (Math.abs(d.getTime() - raceDate.getTime()) > sevenDaysMs) return false
    if (targetSport) {
      const s = logEntrySport(e)
      if (s && s !== targetSport) return false
    }
    if (targetDistanceM && targetDistanceM > 0) {
      const dM = logEntryDistanceM(e)
      if (dM == null) return false
      const lo = targetDistanceM * 0.9
      const hi = targetDistanceM * 1.1
      if (dM < lo || dM > hi) return false
    }
    return true
  })

  // ── Classify state ───────────────────────────────────────────────────────
  let state
  let percentComplete

  if (daysToRace >= 0) {
    // Race in future or today
    if (!isApplied) {
      state = 'draft'
      percentComplete = 0
    } else if (inWindow.length === 0) {
      state = 'applied'
      percentComplete = 5
    } else {
      state = 'in-progress'
      const totalSpan = daysBetween(programStart, raceDate)
      const elapsed = daysBetween(programStart, today)
      const ratio = totalSpan > 0
        ? Math.max(0, Math.min(1, elapsed / totalSpan))
        : 1
      percentComplete = Math.round(ratio * 90 + 5)
      // Clamp to [5, 95] so the "active" band is visually distinct from
      // applied (5) and complete (100).
      if (percentComplete < 5) percentComplete = 5
      if (percentComplete > 95) percentComplete = 95
    }
  } else {
    // Race day passed
    const daysPast = -daysToRace
    if (raceMatch) {
      state = 'complete'
      percentComplete = 100
    } else if (daysPast <= 14) {
      state = 'autopsy-ready'
      percentComplete = 100
    } else {
      state = 'expired'
      percentComplete = 100
    }
  }

  // v9.3.0 — coach-edit summary, additive metadata. UI renders alongside state.
  let coachEdits = { applied: 0, pending: 0, total: 0 }
  if (Array.isArray(opts.coachEdits)) {
    let applied = 0, pending = 0
    for (const e of opts.coachEdits) {
      if (e?.accepted === true) applied++
      else if (e?.accepted !== false) pending++
    }
    coachEdits = { applied, pending, total: opts.coachEdits.length }
  }

  return {
    state,
    label: STATE_LABELS[state],
    color: STATE_COLORS[state],
    daysToRace,
    percentComplete,
    reliable: true,
    coachEdits,
  }
}
