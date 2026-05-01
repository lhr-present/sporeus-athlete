// ─── runalyzeImport.js — Runalyze CSV import library ─────────────────────────
//
// Pure-function parser for Runalyze workout CSV exports.
// Maps Runalyze rows → Sporeus training_log shape, with dedup against
// existing log.
//
// Standard Runalyze columns (typical export):
//   Date (YYYY-MM-DD or DD.MM.YYYY), Sport (Running/Cycling/Swim/...),
//   Time (seconds OR HH:MM:SS), Distance (kilometers, decimal),
//   TRIMP (Banister score → mapped to tss), RPE (1–10), Notes
//
// Required columns: Date AND (Time OR Distance). Rows missing required
// columns are reported in errors[] with row number + reason.
//
// All exports are pure (no side effects, no async, no I/O).

// ── Workout type mapping ──────────────────────────────────────────────────────

const RUNALYZE_TYPE_MAP = {
  running:        'Running',
  run:            'Running',
  trail_running:  'Running',
  cycling:        'Cycling',
  bike:           'Cycling',
  ride:           'Cycling',
  mtb:            'Cycling',
  road_cycling:   'Cycling',
  indoor_cycling: 'Cycling',
  swim:           'Swimming',
  swimming:       'Swimming',
  open_water:     'Swimming',
  strength:       'Strength',
  weights:        'Strength',
  gym:            'Strength',
  walk:           'Walking',
  walking:        'Walking',
  hike:           'Walking',
  hiking:         'Walking',
  row:            'Rowing',
  rowing:         'Rowing',
  ergometer:      'Rowing',
  yoga:           'Other',
  other:          'Other',
}

/**
 * Map a Runalyze Sport string to a Sporeus type string.
 * @param {string} raw
 * @returns {string} 'Running' | 'Cycling' | 'Swimming' | 'Strength' | 'Walking' | 'Rowing' | 'Other'
 */
export function mapWorkoutType(raw) {
  if (!raw) return 'Other'
  const key = String(raw).trim().toLowerCase().replace(/[-\s]/g, '_')
  return RUNALYZE_TYPE_MAP[key] || 'Other'
}

// ── CSV row parser (handles quoted fields, embedded commas, "" escape) ────────

/**
 * Parse a single CSV line into fields.
 * Handles quoted fields enclosed in `"..."` with `""` as escaped quote.
 * @param {string} line
 * @returns {string[]}
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
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cur += ch
      i++
      continue
    }
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
 * Parse a Runalyze date string into ISO YYYY-MM-DD.
 * Supports YYYY-MM-DD (ISO) and DD.MM.YYYY (Runalyze EU default).
 * @param {string} raw
 * @returns {string|null}
 */
export function parseDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null

  // ISO YYYY-MM-DD (or with time appended)
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    const month = parseInt(m, 10)
    const day = parseInt(d, 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // EU dotted form: DD.MM.YYYY
  const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (dotMatch) {
    const day = parseInt(dotMatch[1], 10)
    const month = parseInt(dotMatch[2], 10)
    const y = dotMatch[3]
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return null
}

// ── Duration parsing ──────────────────────────────────────────────────────────

/**
 * Parse a Runalyze duration value.
 * Accepts:
 *   • Numeric seconds (Runalyze default Time column)
 *   • HH:MM:SS or H:MM:SS or MM:SS
 * Returns minutes (decimal, 2dp).
 * @param {string|number} raw
 * @returns {number|null}
 */
export function parseDuration(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null

  // Colon form HH:MM:SS or MM:SS
  if (/:/.test(s)) {
    const m = s.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/)
    if (m) {
      // Three-part = H:M:S; two-part = M:S
      let h, min, sec
      if (m[3] != null) {
        h = parseInt(m[1], 10) || 0
        min = parseInt(m[2], 10) || 0
        sec = parseInt(m[3], 10) || 0
      } else {
        h = 0
        min = parseInt(m[1], 10) || 0
        sec = parseInt(m[2], 10) || 0
      }
      return Math.round((h * 60 + min + sec / 60) * 100) / 100
    }
    return null
  }

  // Numeric seconds
  const num = parseFloat(s)
  if (!Number.isFinite(num) || num < 0) return null
  return Math.round((num / 60) * 100) / 100
}

// ── Map a parsed Runalyze row → Sporeus training_log session ─────────────────

/**
 * Map a parsed Runalyze row to a Sporeus session shape.
 * Returns null if required fields (date, duration) are missing/invalid.
 * @param {Record<string,string>} row
 * @returns {object|null}
 */
export function mapRowToSession(row) {
  if (!row || typeof row !== 'object') return null

  const date = parseDate(row.Date)
  if (!date) return null

  const duration = parseDuration(row.Time)
  if (duration == null) return null

  const type = mapWorkoutType(row.Sport)

  const session = {
    date,
    type,
    duration,
    source: 'runalyze_csv',
  }

  // TRIMP → tss (Banister TRIMP is conceptually similar to TSS)
  if (row.TRIMP != null && String(row.TRIMP).trim() !== '') {
    const tss = parseFloat(row.TRIMP)
    if (Number.isFinite(tss) && tss >= 0) session.tss = tss
  }

  // RPE — 1–10 scale
  if (row.RPE != null && String(row.RPE).trim() !== '') {
    const rpe = parseFloat(row.RPE)
    if (Number.isFinite(rpe)) session.rpe = rpe
  }

  // Distance: Runalyze exports kilometers — convert to meters
  if (row.Distance != null && String(row.Distance).trim() !== '') {
    const km = parseFloat(row.Distance)
    if (Number.isFinite(km) && km >= 0) session.distanceM = Math.round(km * 1000)
  }

  // Notes
  if (row.Notes && String(row.Notes).trim()) {
    session.notes = String(row.Notes).trim()
  }

  return session
}

// ── CSV parsing → array of rows + errors ──────────────────────────────────────

/**
 * Parse a Runalyze workout CSV export into Sporeus session shape.
 * @param {string} csvText
 * @returns {{ sessions: object[], errors: Array<{row:number, reason:string}>, summary: {total:number, parsed:number, skipped:number} }}
 */
export function parseRunalyzeCSV(csvText) {
  const sessions = []
  const errors = []

  if (csvText == null || typeof csvText !== 'string' || csvText.trim() === '') {
    return { sessions, errors, summary: { total: 0, parsed: 0, skipped: 0 } }
  }

  let text = csvText
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  text = text.replace(/\r\n?/g, '\n')

  const allLines = text.split('\n')

  let headerIdx = -1
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].trim() !== '') { headerIdx = i; break }
  }
  if (headerIdx === -1) {
    return { sessions, errors, summary: { total: 0, parsed: 0, skipped: 0 } }
  }

  const headers = parseCSVLine(allLines[headerIdx]).map(h => h.trim())

  // Required: Date AND (Time OR Distance)
  const hasDate = headers.includes('Date')
  const hasDuration = headers.includes('Time') || headers.includes('Distance')

  if (!hasDate || !hasDuration) {
    errors.push({
      row: headerIdx + 1,
      reason: `Missing required columns. Need Date and (Time or Distance). Found: ${headers.join(', ')}`,
    })
    return { sessions, errors, summary: { total: 0, parsed: 0, skipped: 0 } }
  }

  let total = 0
  let parsed = 0

  for (let i = headerIdx + 1; i < allLines.length; i++) {
    const line = allLines[i]
    if (line.trim() === '') continue
    total++

    const fields = parseCSVLine(line)
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j] != null ? fields[j] : ''
    }

    if (!row.Date || String(row.Date).trim() === '') {
      errors.push({ row: i + 1, reason: 'Missing Date' })
      continue
    }

    const session = mapRowToSession(row)
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
 * @returns {object[]}
 */
export function dedupAgainstLog(newSessions, existingLog) {
  if (!Array.isArray(newSessions)) return []
  if (!Array.isArray(existingLog) || existingLog.length === 0) {
    return newSessions.slice()
  }

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
 * End-to-end Runalyze CSV import pipeline.
 * parse → map → dedup → return
 * @param {string} csvText
 * @param {object[]} existingLog
 * @returns {{ toImport: object[], duplicates: object[], errors: Array<{row:number,reason:string}>, summary: object }}
 */
export function importRunalyzeCSV(csvText, existingLog = []) {
  const { sessions, errors, summary } = parseRunalyzeCSV(csvText)
  const toImport = dedupAgainstLog(sessions, existingLog)
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
