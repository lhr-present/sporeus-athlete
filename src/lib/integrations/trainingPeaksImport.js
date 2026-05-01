// ─── trainingPeaksImport.js — TrainingPeaks CSV import library (E20) ─────────
//
// Pure-function parser for TrainingPeaks workout CSV exports.
// Maps TP rows → Sporeus training_log shape, with dedup against existing log.
//
// Standard TP columns:
//   Title, WorkoutType, WorkoutDay (YYYY-MM-DD), Time (HH:MM:SS),
//   TimeTotalInHours (decimal), DistanceInMeters, TSS, IF, Rpe, Feeling,
//   EnergyExpended, Calories, Comments
//
// Required columns: WorkoutDay AND (TimeTotalInHours OR Time).
// Rows missing required columns are reported in errors[] with row number + reason.
//
// All exports are pure (no side effects, no async, no I/O).

// ── Workout type mapping ──────────────────────────────────────────────────────

const TP_TYPE_MAP = {
  run:        'Running',
  running:    'Running',
  bike:       'Cycling',
  cycling:    'Cycling',
  ride:       'Cycling',
  swim:       'Swimming',
  swimming:   'Swimming',
  strength:   'Strength',
  weights:    'Strength',
  walk:       'Walking',
  hike:       'Walking',
  row:        'Rowing',
  rowing:     'Rowing',
  xc_ski:     'Other',
  mtb:        'Cycling',
  brick:      'Other',
  day_off:    'Other',
  other:      'Other',
  custom:     'Other',
}

/**
 * Map a TrainingPeaks WorkoutType string to a Sporeus type string.
 * @param {string} tpType
 * @returns {string} Sporeus type ('Running' | 'Cycling' | ... | 'Other')
 */
export function mapWorkoutType(tpType) {
  if (!tpType) return 'Other'
  const key = String(tpType).trim().toLowerCase().replace(/[-\s]/g, '_')
  return TP_TYPE_MAP[key] || 'Other'
}

// ── CSV row parser (handles quoted fields, embedded commas, "" escape) ────────

/**
 * Parse a single CSV line into fields.
 * Handles quoted fields enclosed in `"..."` with `""` as escaped quote.
 * Embedded commas inside quoted fields are preserved.
 * @param {string} line
 * @returns {string[]} array of field values (with surrounding quotes stripped)
 */
export function parseCSVLine(line) {
  const fields = []
  let cur = ''
  let inQuotes = false
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        // Escaped double-quote: ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"'
          i += 2
          continue
        }
        // End of quoted section
        inQuotes = false
        i++
        continue
      }
      cur += ch
      i++
      continue
    }
    // Not inside quotes
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      fields.push(cur)
      cur = ''
      i++
      continue
    }
    cur += ch
    i++
  }
  fields.push(cur)
  return fields
}

// ── Date parsing ──────────────────────────────────────────────────────────────

/**
 * Parse a date string into ISO YYYY-MM-DD.
 * Heuristic: prefer YYYY-MM-DD (TP default). For slash-separated forms,
 * we treat MM/DD/YYYY as the canonical TP locale (TP exports default to US),
 * UNLESS the first part > 12 (then it must be DD/MM/YYYY).
 * @param {string} raw
 * @returns {string|null} YYYY-MM-DD or null if unparseable
 */
export function parseTPDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null

  // ISO YYYY-MM-DD (or with time appended)
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  // Slash form: a/b/yyyy
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashMatch) {
    const a = parseInt(slashMatch[1], 10)
    const b = parseInt(slashMatch[2], 10)
    const y = slashMatch[3]
    let month, day
    if (a > 12) {
      // Must be DD/MM/YYYY
      day = a; month = b
    } else if (b > 12) {
      // Must be MM/DD/YYYY
      month = a; day = b
    } else {
      // Ambiguous — TP default export is US (MM/DD/YYYY)
      month = a; day = b
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return null
}

/**
 * Parse a duration value from TP CSV.
 * Prefers TimeTotalInHours (decimal hours) and converts to minutes.
 * Falls back to Time (HH:MM:SS or HH:MM).
 * @param {string} timeTotalHours  raw TimeTotalInHours
 * @param {string} timeStr         raw Time (HH:MM[:SS])
 * @returns {number|null}          duration in minutes, or null
 */
export function parseTPDuration(timeTotalHours, timeStr) {
  if (timeTotalHours != null && String(timeTotalHours).trim() !== '') {
    const hrs = parseFloat(timeTotalHours)
    if (Number.isFinite(hrs) && hrs >= 0) {
      return Math.round(hrs * 60 * 100) / 100  // minutes, 2dp
    }
  }
  if (timeStr) {
    const m = String(timeStr).trim().match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/)
    if (m) {
      const h = parseInt(m[1], 10) || 0
      const min = parseInt(m[2], 10) || 0
      const sec = parseInt(m[3] || '0', 10) || 0
      return Math.round((h * 60 + min + sec / 60) * 100) / 100
    }
  }
  return null
}

// ── Map a parsed TP CSV row → Sporeus training_log session ────────────────────

/**
 * Map a parsed TP row (keyed by column header) to a Sporeus session shape.
 * Returns null if required fields (date, duration) are missing/invalid.
 * @param {Record<string,string>} row  parsed row keyed by header name
 * @returns {object|null} { date, type, duration, tss?, rpe?, distanceM?, notes?, source }
 */
export function mapTPRowToSession(row) {
  if (!row || typeof row !== 'object') return null

  const date = parseTPDate(row.WorkoutDay)
  if (!date) return null

  const duration = parseTPDuration(row.TimeTotalInHours, row.Time)
  if (duration == null) return null

  const type = mapWorkoutType(row.WorkoutType)

  const session = {
    date,
    type,
    duration,
    source: 'tp_csv',
  }

  // TSS — parseFloat, leave undefined if empty/null
  if (row.TSS != null && String(row.TSS).trim() !== '') {
    const tss = parseFloat(row.TSS)
    if (Number.isFinite(tss)) session.tss = tss
  }

  // RPE — 1–10 scale
  if (row.Rpe != null && String(row.Rpe).trim() !== '') {
    const rpe = parseFloat(row.Rpe)
    if (Number.isFinite(rpe)) session.rpe = rpe
  }

  // Distance in meters
  if (row.DistanceInMeters != null && String(row.DistanceInMeters).trim() !== '') {
    const d = parseFloat(row.DistanceInMeters)
    if (Number.isFinite(d) && d >= 0) session.distanceM = d
  }

  // Notes — concatenate Comments + Feeling (if present)
  const noteParts = []
  if (row.Title && String(row.Title).trim()) noteParts.push(String(row.Title).trim())
  if (row.Comments && String(row.Comments).trim()) noteParts.push(String(row.Comments).trim())
  if (row.Feeling && String(row.Feeling).trim()) noteParts.push(`Feeling: ${String(row.Feeling).trim()}`)
  if (noteParts.length > 0) session.notes = noteParts.join(' — ')

  return session
}

// ── CSV parsing → array of rows + errors ──────────────────────────────────────

/**
 * Parse a TrainingPeaks workout CSV export into Sporeus session shape.
 * @param {string} csvText
 * @returns {{ sessions: object[], errors: Array<{row:number, reason:string}>, summary: {total:number, parsed:number, skipped:number} }}
 */
export function parseTrainingPeaksCSV(csvText) {
  const sessions = []
  const errors = []

  if (csvText == null || typeof csvText !== 'string' || csvText.trim() === '') {
    return { sessions, errors, summary: { total: 0, parsed: 0, skipped: 0 } }
  }

  // Strip BOM if present
  let text = csvText
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)

  // Normalize line endings (CRLF, CR → LF)
  text = text.replace(/\r\n?/g, '\n')

  // Split into non-empty lines
  const allLines = text.split('\n')
  // Drop trailing empty lines but preserve indices for error reporting
  // (We report 1-based line numbers in the original file.)

  // Find header line: first non-empty line
  let headerIdx = -1
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].trim() !== '') { headerIdx = i; break }
  }
  if (headerIdx === -1) {
    return { sessions, errors, summary: { total: 0, parsed: 0, skipped: 0 } }
  }

  const headers = parseCSVLine(allLines[headerIdx]).map(h => h.trim())

  // Required columns: WorkoutDay AND (TimeTotalInHours OR Time)
  const hasWorkoutDay = headers.includes('WorkoutDay')
  const hasDuration   = headers.includes('TimeTotalInHours') || headers.includes('Time')

  if (!hasWorkoutDay || !hasDuration) {
    errors.push({
      row: headerIdx + 1,
      reason: `Missing required columns. Need WorkoutDay and (TimeTotalInHours or Time). Found: ${headers.join(', ')}`,
    })
    return { sessions, errors, summary: { total: 0, parsed: 0, skipped: 0 } }
  }

  let total = 0
  let parsed = 0

  for (let i = headerIdx + 1; i < allLines.length; i++) {
    const line = allLines[i]
    if (line.trim() === '') continue  // skip empty rows silently
    total++

    const fields = parseCSVLine(line)
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j] != null ? fields[j] : ''
    }

    // Validate required fields
    if (!row.WorkoutDay || String(row.WorkoutDay).trim() === '') {
      errors.push({ row: i + 1, reason: 'Missing WorkoutDay' })
      continue
    }

    const session = mapTPRowToSession(row)
    if (!session) {
      errors.push({ row: i + 1, reason: 'Could not map row to session (invalid date or duration)' })
      continue
    }

    sessions.push(session)
    parsed++
  }

  return {
    sessions,
    errors,
    summary: { total, parsed, skipped: total - parsed },
  }
}

// ── Dedup ─────────────────────────────────────────────────────────────────────

const DEDUP_DURATION_TOLERANCE_MIN = 5

/**
 * Return the subset of newSessions NOT already in existingLog.
 * Match key: same date + same type + duration within ±5 min.
 * @param {object[]} newSessions
 * @param {object[]} existingLog
 * @returns {object[]} newSessions filtered to those not duplicated
 */
export function dedupSessions(newSessions, existingLog) {
  if (!Array.isArray(newSessions)) return []
  if (!Array.isArray(existingLog) || existingLog.length === 0) {
    return newSessions.slice()
  }

  // Index existingLog by date for fast lookup
  const byDate = new Map()
  for (const e of existingLog) {
    if (!e || !e.date) continue
    if (!byDate.has(e.date)) byDate.set(e.date, [])
    byDate.get(e.date).push(e)
  }

  const result = []
  for (const ns of newSessions) {
    if (!ns || !ns.date) { result.push(ns); continue }
    const candidates = byDate.get(ns.date) || []
    const isDup = candidates.some(ex => {
      if ((ex.type || '') !== (ns.type || '')) return false
      const exDur = Number(ex.duration) || 0
      const nsDur = Number(ns.duration) || 0
      return Math.abs(exDur - nsDur) <= DEDUP_DURATION_TOLERANCE_MIN
    })
    if (!isDup) result.push(ns)
  }
  return result
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

/**
 * End-to-end TrainingPeaks CSV import pipeline.
 * parse → map → dedup → return
 * @param {string} csvText
 * @param {object[]} existingLog  current Sporeus training_log
 * @returns {{ toImport: object[], duplicates: object[], errors: Array<{row:number,reason:string}>, summary: object }}
 */
export function importTrainingPeaksCSV(csvText, existingLog = []) {
  const { sessions, errors, summary } = parseTrainingPeaksCSV(csvText)
  const toImport = dedupSessions(sessions, existingLog)
  // duplicates = parsed sessions that were filtered out
  const toImportSet = new Set(toImport)
  const duplicates = sessions.filter(s => !toImportSet.has(s))

  return {
    toImport,
    duplicates,
    errors,
    summary: {
      ...summary,
      duplicates: duplicates.length,
      toImport: toImport.length,
    },
  }
}
