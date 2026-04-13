// ─── src/lib/sport/athleteDataBridge.js — Pure helpers to extract athlete data
// for the SportProgramBuilder. All functions are pure (no side effects, no imports
// from React or browser APIs) so they can be unit-tested directly.

import { calculatePMC } from '../trainingLoad.js'

// ── Current CTL/ATL from athlete log ─────────────────────────────────────────
// Runs calculatePMC on the log and reads the last non-future entry.
// Returns { ctl: number, atl: number } or { ctl: 0, atl: 0 } for empty log.
export function deriveCtlAtl(log) {
  if (!log || log.length === 0) return { ctl: 0, atl: 0 }
  const pmc = calculatePMC(log, 90, 0)  // no future projection needed
  if (!pmc || pmc.length === 0) return { ctl: 0, atl: 0 }
  const last = pmc[pmc.length - 1]
  return {
    ctl: last.ctl ?? 0,
    atl: last.atl ?? 0,
  }
}

// ── Most recent test/race result ──────────────────────────────────────────────
// Scans log for entries matching type and (optionally) distanceM.
// Returns the most recent entry's { timeSec, distanceM, date } or null.
export function findRecentResult(log, type, distanceM = null) {
  if (!log || log.length === 0) return null
  const matches = log.filter(e => {
    if (!e || !e.type) return false
    const typeMatch = e.type.toLowerCase().includes(type.toLowerCase())
    if (!typeMatch) return false
    if (distanceM != null) {
      const dist = parseFloat(e.distanceM)
      if (isNaN(dist) || Math.abs(dist - distanceM) > 10) return false
    }
    return true
  })
  if (matches.length === 0) return null
  // Sort by date desc, pick most recent
  const sorted = [...matches].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const entry = sorted[0]
  // Derive timeSec: prefer durationSec, fall back to duration×60
  const timeSec = entry.durationSec
    ? parseFloat(entry.durationSec)
    : entry.duration ? parseFloat(entry.duration) * 60 : null
  return { timeSec, distanceM: parseFloat(entry.distanceM) || distanceM, date: entry.date }
}

// ── Average sessions per week over last N weeks ───────────────────────────────
export function sessionFrequencyPerWeek(log, weeks = 4) {
  if (!log || log.length === 0) return 0
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - weeks * 7)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const recent = log.filter(e => e && e.date && e.date >= cutoffStr)
  return Math.round((recent.length / weeks) * 10) / 10
}

// ── Sport from profile ────────────────────────────────────────────────────────
// Maps profile.sport / profile.primarySport to SportProgramBuilder sport IDs.
const SPORT_MAP = {
  rowing:    'rowing',
  row:       'rowing',
  running:   'running',
  run:       'running',
  cycling:   'cycling',
  cycle:     'cycling',
  bike:      'cycling',
  swimming:  'swimming',
  swim:      'swimming',
  triathlon: 'triathlon',
  tri:       'triathlon',
}

export function extractProfileSport(profile) {
  if (!profile) return null
  const raw = (profile.primarySport || profile.sport || '').toLowerCase().trim()
  for (const [key, val] of Object.entries(SPORT_MAP)) {
    if (raw.includes(key)) return val
  }
  return null
}

// ── Format timeSec as mm:ss string ───────────────────────────────────────────
export function fmtTimeInput(totalSec) {
  if (!totalSec || totalSec <= 0) return ''
  const m = Math.floor(totalSec / 60)
  const s = Math.round(totalSec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── Parse mm:ss string to seconds ────────────────────────────────────────────
export function parseTimeInput(str) {
  if (!str) return null
  const parts = str.trim().split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const s = parseInt(parts[1], 10)
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s
  }
  // Try plain seconds
  const n = parseFloat(str)
  return isNaN(n) ? null : n
}
