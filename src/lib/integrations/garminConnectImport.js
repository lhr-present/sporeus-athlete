// ─── garminConnectImport.js — Garmin Connect CSV import library ──────────────
//
// Pure-function parser for Garmin Connect "Activities" CSV exports.
// Maps Garmin rows → Sporeus training_log shape, with dedup against
// existing log.
//
// Standard Garmin Connect columns:
//   Activity Type, Date (YYYY-MM-DD HH:MM:SS), Time (HH:MM:SS duration),
//   Distance ("X km" or "X mi"), Avg HR, Max HR,
//   Aerobic TE (training-effect score — NOT TSS), Calories, Title
//
// Required columns: Date AND Time. Garmin does not export TSS natively, so
// `tss` is left undefined. Distance strings carry units that must be
// converted (miles × 1609.344).
//
// All exports are pure (no side effects, no async, no I/O).

// ── Workout type mapping ──────────────────────────────────────────────────────

const GARMIN_TYPE_MAP = {
  running:                  'Running',
  run:                      'Running',
  treadmill_running:        'Running',
  trail_running:            'Running',
  track_running:            'Running',
  street_running:           'Running',
  cycling:                  'Cycling',
  bike:                     'Cycling',
  ride:                     'Cycling',
  road_cycling:             'Cycling',
  mountain_biking:          'Cycling',
  mtb:                      'Cycling',
  gravel_cycling:           'Cycling',
  indoor_cycling:           'Cycling',
  virtual_ride:             'Cycling',
  swim:                     'Swimming',
  swimming:                 'Swimming',
  pool_swimming:            'Swimming',
  open_water_swimming:      'Swimming',
  strength_training:        'Strength',
  strength:                 'Strength',
  weights:                  'Strength',
  cardio:                   'Strength',
  walking:                  'Walking',
  walk:                     'Walking',
  hike:                     'Walking',
  hiking:                   'Walking',
  rowing:                   'Rowing',
  row:                      'Rowing',
  indoor_rowing:            'Rowing',
  yoga:                     'Other',
  pilates:                  'Other',
  other:                    'Other',
  multisport:               'Other',
  triathlon:                'Other',
}

/**
 * Map a Garmin Connect Activity Type string to a Sporeus type string.
 * @param {string} raw
 * @returns {string} 'Running' | 'Cycling' | 'Swimming' | 'Strength' | 'Walking' | 'Rowing' | 'Other'
 */
export function mapWorkoutType(raw) {
  if (!raw) return 'Other'
  const key = String(raw).trim().toLowerCase().replace(/[-\s]/g, '_')
  return GARMIN_TYPE_MAP[key] || 'Other'
}

// ── CSV row parser (handles quoted fields, embedded commas, "" escape) ────────

/**
 * Parse a single CSV line into fields.
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
 * Parse a Garmin date string into ISO YYYY-MM-DD.
 * Garmin Connect formats observed:
 *   • YYYY-MM-DD HH:MM:SS
 *   • YYYY-MM-DD
 *   • YYYY-MM-DDTHH:MM:SS
 * @param {string} raw
 * @returns {string|null}
 */
export function parseDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null

  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    const month = parseInt(m, 10)
    const day = parseInt(d, 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return null
}

// ── Duration parsing ──────────────────────────────────────────────────────────

/**
 * Parse a Garmin Time duration value.
 * Garmin Connect exports HH:MM:SS or MM:SS or H:MM:SS.
 * Returns minutes (decimal, 2dp).
 * @param {string} raw
 * @returns {number|null}
 */
export function parseDuration(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null

  // Colon form
  if (/:/.test(s)) {
    const m = s.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?$/)
    if (m) {
      let h, min, sec
      if (m[3] != null) {
        h = parseInt(m[1], 10) || 0
        min = parseInt(m[2], 10) || 0
        sec = parseFloat(m[3]) || 0
      } else {
        h = 0
        min = parseInt(m[1], 10) || 0
        sec = parseInt(m[2], 10) || 0
      }
      return Math.round((h * 60 + min + sec / 60) * 100) / 100
    }
    return null
  }

  // Plain numeric — interpret as seconds (some Garmin exports use raw seconds)
  const num = parseFloat(s)
  if (!Number.isFinite(num) || num < 0) return null
  return Math.round((num / 60) * 100) / 100
}

// ── Distance parsing (handles unit suffix) ────────────────────────────────────

const MI_TO_M = 1609.344

/**
 * Parse a Garmin distance string into meters.
 * Accepts:
 *   • "10.5 km"  → 10500
 *   • "10.5km"   → 10500
 *   • "5.2 mi"   → 8368.59
 *   • "5,500 m"  → 5500 (comma thousands)
 *   • "10.5"     → 10500 (assume km when no unit)
 * @param {string} raw
 * @returns {number|null} meters, rounded to 2dp, or null
 */
export function parseDistance(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (s === '--') return null

  // Strip thousands commas (Garmin sometimes formats "1,234.5 km")
  const cleaned = s.replace(/,/g, '')

  const m = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/)
  if (!m) return null

  const num = parseFloat(m[1])
  if (!Number.isFinite(num) || num < 0) return null

  const unit = (m[2] || '').toLowerCase()

  let meters
  if (unit === 'mi' || unit === 'mile' || unit === 'miles') {
    meters = num * MI_TO_M
  } else if (unit === 'm' || unit === 'meter' || unit === 'meters') {
    meters = num
  } else {
    // Default & 'km' → kilometers
    meters = num * 1000
  }

  return Math.round(meters * 100) / 100
}

// ── Map a parsed Garmin row → Sporeus training_log session ───────────────────

/**
 * Map a parsed Garmin Connect row to a Sporeus session shape.
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

  const type = mapWorkoutType(row['Activity Type'])

  const session = {
    date,
    type,
    duration,
    source: 'garmin_csv',
  }

  // Garmin doesn't export TSS — leave undefined intentionally.
  // Aerobic TE (Training Effect 0.0–5.0) is a different metric.

  // Distance: parse "X km" / "X mi" / etc.
  if (row.Distance != null && String(row.Distance).trim() !== '') {
    const meters = parseDistance(row.Distance)
    if (meters != null) session.distanceM = meters
  }

  // Notes — concatenate Title + Activity Type info if useful
  const noteParts = []
  if (row.Title && String(row.Title).trim()) noteParts.push(String(row.Title).trim())
  if (row['Avg HR'] && String(row['Avg HR']).trim() && String(row['Avg HR']).trim() !== '--') {
    noteParts.push(`Avg HR: ${String(row['Avg HR']).trim()}`)
  }
  if (row.Calories && String(row.Calories).trim() && String(row.Calories).trim() !== '--') {
    noteParts.push(`${String(row.Calories).trim()} kcal`)
  }
  if (noteParts.length > 0) session.notes = noteParts.join(' — ')

  return session
}

// ── CSV parsing → array of rows + errors ──────────────────────────────────────

/**
 * Parse a Garmin Connect Activities CSV export into Sporeus session shape.
 * @param {string} csvText
 * @returns {{ sessions: object[], errors: Array<{row:number, reason:string}>, summary: {total:number, parsed:number, skipped:number} }}
 */
export function parseGarminConnectCSV(csvText) {
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

  // Required: Date AND Time
  const hasDate = headers.includes('Date')
  const hasTime = headers.includes('Time')

  if (!hasDate || !hasTime) {
    errors.push({
      row: headerIdx + 1,
      reason: `Missing required columns. Need Date and Time. Found: ${headers.join(', ')}`,
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
 * End-to-end Garmin Connect CSV import pipeline.
 * @param {string} csvText
 * @param {object[]} existingLog
 * @returns {{ toImport: object[], duplicates: object[], errors: Array<{row:number,reason:string}>, summary: object }}
 */
export function importGarminConnectCSV(csvText, existingLog = []) {
  const { sessions, errors, summary } = parseGarminConnectCSV(csvText)
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
