// ─── Input validation / sanitization ──────────────────────────────────────────

/**
 * @typedef {Object} LogEntry
 * @property {string} id
 * @property {string} date - ISO date YYYY-MM-DD
 * @property {string} type - session type key
 * @property {number} duration - minutes
 * @property {number} tss - Training Stress Score
 * @property {number} rpe - Rate of Perceived Exertion 1–10
 * @property {number[]} [zones] - time in each HR zone (minutes)
 * @property {string} [notes]
 * @property {string} source - 'manual' | 'strava' | 'fit'
 */

/**
 * @typedef {Object} ProfileData
 * @property {string} [name]
 * @property {string} [sport]
 * @property {number} [age]
 * @property {number} [weight] - kg
 * @property {number} [height] - cm
 * @property {number} [maxhr] - max heart rate bpm
 * @property {number} [ftp] - Functional Threshold Power watts
 * @property {number} [vo2max] - mL/kg/min
 * @property {string} [threshold] - threshold pace mm:ss/km
 * @property {string} [goal]
 */

/**
 * @param {*} s - value to sanitize
 * @param {number} [maxLen=200] - maximum string length
 * @returns {string} trimmed string within maxLen
 */
export function sanitizeString(s, maxLen = 200) {
  if (typeof s !== 'string') return s != null ? String(s).trim().slice(0, maxLen) : ''
  return s.trim().slice(0, maxLen)
}

/**
 * @param {*} n - value to sanitize
 * @param {number} [min=0] - minimum allowed value
 * @param {number} [max=99999] - maximum allowed value
 * @returns {number} clamped numeric value (0 if invalid)
 */
export function sanitizeNumber(n, min = 0, max = 99999) {
  const v = parseFloat(n)
  if (isNaN(v) || !isFinite(v)) return 0
  return Math.max(min, Math.min(max, v))
}

/**
 * @param {*} d - value to parse as date
 * @returns {string} ISO date YYYY-MM-DD or today's date on parse failure
 */
export function sanitizeDate(d) {
  try {
    const date = new Date(d)
    if (isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
    return date.toISOString().slice(0, 10)
  } catch { return new Date().toISOString().slice(0, 10) }
}

/**
 * @param {Object} e - raw log entry object
 * @returns {LogEntry} sanitized and clamped log entry
 */
export function sanitizeLogEntry(e) {
  const clamp = (v, lo, hi) => { const n = parseFloat(v); return isNaN(n) ? 0 : Math.max(lo, Math.min(hi, n)) }
  const result = {
    id: (typeof e.id === 'number' && e.id > 0) ? e.id : Date.now(),
    date: sanitizeDate(e.date),
    type: sanitizeString(e.type, 50) || 'Easy Run',
    duration: clamp(e.duration, 0, 1440),
    rpe: clamp(e.rpe, 0, 10),
    tss: clamp(e.tss, 0, 2000),
    notes: sanitizeString(e.notes, 500),
  }
  if (Array.isArray(e.zones)) {
    result.zones = e.zones.slice(0, 5).map(v => clamp(v, 0, 1440))
  }
  if (e.wPrimeExhausted === true) result.wPrimeExhausted = true
  if (typeof e.source === 'string' && e.source) result.source = e.source.slice(0, 20)
  if (e.hasPower === true) result.hasPower = true
  // Fields required by vo2max.js estimateVO2maxTrend — must survive sanitization
  const distM = parseFloat(e.distanceM); if (!isNaN(distM) && distM > 0) result.distanceM = distM
  const dist  = parseFloat(e.distance);  if (!isNaN(dist)  && dist  > 0) result.distance  = dist
  const durSec = parseFloat(e.durationSec); if (!isNaN(durSec) && durSec > 0) result.durationSec = durSec
  const avgHR = parseInt(e.avgHR);  if (!isNaN(avgHR) && avgHR > 0) result.avgHR = avgHR
  const cadence = parseInt(e.avgCadence); if (!isNaN(cadence) && cadence > 0) result.avgCadence = cadence
  return result
}

// Profile: keeps numeric fields as strings (form inputs expect strings)
/**
 * @param {Object} p - raw profile object
 * @returns {ProfileData} sanitized profile with numeric fields as strings
 */
export function sanitizeProfile(p) {
  const str = (v, max = 100) => sanitizeString(v, max)
  const numStr = (v, lo, hi) => {
    const n = parseFloat(v)
    if (isNaN(n) || !isFinite(n)) return ''
    return String(Math.max(lo, Math.min(hi, n)))
  }
  return {
    name:          str(p.name),
    sport:         str(p.sport, 50),
    primarySport:  str(p.primarySport, 50),
    triathlonType: str(p.triathlonType, 30),
    secondarySports: Array.isArray(p.secondarySports) ? p.secondarySports.slice(0, 10).map(s => str(s, 30)) : [],
    athleteLevel:  str(p.athleteLevel, 30),
    age:           numStr(p.age, 5, 120),
    weight:        numStr(p.weight, 10, 400),
    height:        numStr(p.height, 50, 280),
    gender:        ['male','female'].includes(p.gender) ? p.gender : 'male',
    ftp:           numStr(p.ftp, 0, 3000),
    vo2max:        numStr(p.vo2max, 0, 100),
    maxhr:         numStr(p.maxhr, 60, 280),
    threshold:     str(p.threshold, 20),
    goal:          str(p.goal, 200),
    neck:          numStr(p.neck, 10, 100),
    waist:         numStr(p.waist, 30, 250),
    hip:           numStr(p.hip, 30, 250),
    email:         str(p.email, 200),
    weeklyTssGoal: numStr(p.weeklyTssGoal, 0, 2000),
  }
}
