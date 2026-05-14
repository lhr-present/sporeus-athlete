// src/lib/mission2/missionTwo.js
//
// v9.113.0 (Prompt DDD) — Mission 2 framework.
//
// Mission 1 is the onboarding chain: signup → starter plan → first
// session → first week. v9.99.0 (Prompt J) gave it a personal funnel
// timeline. v9.103.0 (Prompt CC) added a completion celebration that
// said "next: set a Mission 2 goal" — but until now there was no
// Mission 2 to set. The deep-link scrolled to the goal editor and
// stranded the athlete there. They edited a goal, nothing changed,
// and the loop closed on itself.
//
// Mission 2 is the *consolidation* chain. Where Mission 1 proves the
// system works for you, Mission 2 proves you're committing to it as
// a training discipline. The chain is:
//
//   mission_1_complete   (entry — already emitted in v9.103.0)
//   race_committed       (athlete sets a future-dated target ≥7d out)
//   first_month_completed (≥30-day span + ≥12 sessions logged)
//   pr_logged            (any session beats a prior best on duration)
//
// Each event is derived from existing state (attribution events,
// profile, log) so Mission 2 doesn't require new emissions to show
// progress. Future versions can add explicit emissions for funnel
// telemetry, but the framework itself is purely derivational.
//
// Pure functions. No I/O.

import { categorizeLogEntry } from '../athlete/goalActivityMismatch.js'

/**
 * @description Canonical Mission 2 event order. Used by the timeline UI
 *   to render rows in sequence. Same convention as MISSION_1_EVENTS
 *   in lib/db/attributionEvents.js.
 */
export const MISSION_2_EVENTS = [
  'mission_1_complete',
  'race_committed',
  'first_month_completed',
  'pr_logged',
]

/**
 * @description Bilingual labels for each Mission 2 event. Kept here
 *   alongside the event list so the data and its presentation aren't
 *   coupled to the timeline component — other surfaces (coach view,
 *   summary cards) can reuse them.
 */
export const MISSION_2_LABELS = {
  mission_1_complete: {
    en: { title: 'Mission 1 complete',       note: 'Foundation chain finished' },
    tr: { title: 'Mission 1 tamamlandı',     note: 'Temel zincir tamam' },
  },
  race_committed: {
    en: { title: 'Race committed',           note: 'Target date set ≥7 days out' },
    tr: { title: 'Yarış belirlendi',         note: '≥7 gün ileri tarihli hedef' },
  },
  first_month_completed: {
    en: { title: 'First month complete',     note: '30+ days, 12+ sessions logged' },
    tr: { title: 'İlk ay tamam',             note: '30+ gün, 12+ antrenman' },
  },
  pr_logged: {
    en: { title: 'First PR logged',          note: 'Beat a prior best duration' },
    tr: { title: 'İlk PR kaydedildi',        note: 'Öncekini geçen en uzun seans' },
  },
}

const MS_PER_DAY = 86400000

function toDayMs(iso) {
  if (!iso) return null
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

function todayISO(today) {
  return today || new Date().toISOString().slice(0, 10)
}

/**
 * @description Detect the earliest log entry whose `duration` exceeded
 *   any prior best within the same SPORT BUCKET. v9.117.0 (Prompt III)
 *   replaced the raw lowercased `type` bucketing with canonical sport
 *   buckets via categorizeLogEntry — so "Long Run", "Long run", "Easy
 *   Run", and "Run" all compete in the same 'run' bucket. Pre-v9.117
 *   they each had independent best-so-far counters, so real PRs across
 *   overlapping session labels were missed and meaningless label
 *   variations falsely flagged.
 *
 *   Defends against:
 *   - non-array log
 *   - entries with missing/invalid date or duration
 *   - empty / single-entry log (no prior best to beat)
 *
 *   Returns null when no PR is detected.
 *
 * @param {Array} log
 * @returns {{ date: string, bucket: string, duration: number } | null}
 */
function findFirstPRSession(log) {
  if (!Array.isArray(log) || log.length < 2) return null
  const sorted = log
    .filter(e => e?.date && Number(e?.duration) > 0)
    .map(e => ({
      date:     String(e.date).slice(0, 10),
      bucket:   categorizeLogEntry(e),
      duration: Number(e.duration),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
  const maxByBucket = {}
  for (const e of sorted) {
    const prior = maxByBucket[e.bucket]
    if (prior != null && e.duration > prior) {
      return e
    }
    if (prior == null || e.duration > prior) {
      maxByBucket[e.bucket] = e.duration
    }
  }
  return null
}

/**
 * @description Detect whether the log spans at least 30 days AND
 *   contains at least 12 distinct training sessions (tss>0 or
 *   duration>0). Returns the date the 12th qualifying session was
 *   logged once both conditions are met, otherwise null.
 *
 *   12 sessions in 30 days is the 3/week pace the v9.106+ habit
 *   detectors treat as "training discipline" rather than "exploring."
 *
 * @param {Array} log
 * @returns {string | null}  ISO date the milestone was crossed
 */
function findFirstMonthCompletedDate(log) {
  if (!Array.isArray(log)) return null
  const sessions = log
    .filter(e => e?.date && (Number(e?.tss) > 0 || Number(e?.duration) > 0))
    .map(e => String(e.date).slice(0, 10))
    .sort()
  if (sessions.length < 12) return null
  const first = toDayMs(sessions[0])
  if (first == null) return null
  // Earliest date the athlete had ≥12 sessions AND ≥30 days elapsed since the first.
  for (let i = 11; i < sessions.length; i++) {
    const cur = toDayMs(sessions[i])
    if (cur == null) continue
    if (cur - first >= 30 * MS_PER_DAY) return sessions[i]
  }
  return null
}

/**
 * @description Derive Mission 2 status from existing state. Pure
 *   function so it can be tested without mocking attribution fetch.
 *   `attributionEvents` is the list returned by getUserAttributionEvents
 *   (oldest→newest), filtered or unfiltered — only mission_1_complete
 *   rows are read here.
 *
 *   `entered` is true once the athlete has finished Mission 1.
 *   `complete` is true once every Mission 2 milestone is hit.
 *
 * @param {Object} args
 * @param {Array}  args.attributionEvents
 * @param {Object} args.profile
 * @param {Array}  args.log
 * @param {string} [args.today]
 * @returns {{
 *   entered: boolean,
 *   complete: boolean,
 *   completedCount: number,
 *   totalCount: number,
 *   events: Array<{ key: string, done: boolean, at: string | null }>,
 * }}
 */
export function getMission2Status({ attributionEvents, profile, log, today } = {}) {
  const events = Array.isArray(attributionEvents) ? attributionEvents : []
  const safeLog = Array.isArray(log) ? log : []
  const tToday = todayISO(today)
  const todayMs = toDayMs(tToday)

  // ── mission_1_complete (attribution event) ────────────────────────────
  const m1 = events.find(e => e?.event_name === 'mission_1_complete')
  const m1Done = !!m1
  const m1At = m1?.created_at ? String(m1.created_at).slice(0, 10) : null

  // ── race_committed (profile.raceDate at least 7 days in the future) ───
  const raceDate = profile?.raceDate ? String(profile.raceDate).slice(0, 10) : null
  let raceDone = false
  let raceAt = null
  if (raceDate && todayMs != null) {
    const raceMs = toDayMs(raceDate)
    if (raceMs != null && (raceMs - todayMs) / MS_PER_DAY >= 7) {
      raceDone = true
      raceAt = raceDate
    }
  }

  // ── first_month_completed (derived from log) ──────────────────────────
  const firstMonthAt = findFirstMonthCompletedDate(safeLog)
  const firstMonthDone = !!firstMonthAt

  // ── pr_logged (derived from log) ──────────────────────────────────────
  const prSession = findFirstPRSession(safeLog)
  const prDone = !!prSession
  const prAt = prSession?.date || null

  const statusList = [
    { key: 'mission_1_complete',    done: m1Done,         at: m1At },
    { key: 'race_committed',        done: raceDone,       at: raceAt },
    { key: 'first_month_completed', done: firstMonthDone, at: firstMonthAt },
    { key: 'pr_logged',             done: prDone,         at: prAt },
  ]
  const completedCount = statusList.filter(s => s.done).length
  const totalCount = statusList.length
  return {
    entered:        m1Done,
    complete:       completedCount === totalCount,
    completedCount,
    totalCount,
    events:         statusList,
  }
}
