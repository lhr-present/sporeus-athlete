// ─── icsExport.js — single-session iCalendar (.ics) exporter (v9.350.0) ───────
//
// The plan ZWO export (zwoExport.js) is Zwift/cycling-specific. A .ics file is
// the universal "last mile": any calendar (Google/Apple/Outlook) ingests it and
// syncs to the athlete's phone + watch, with a pre-session alarm — works for
// every sport, not just cycling.
//
// Pure functions (buildSessionIcs builds the text; downloadIcsFile is the only
// side-effecting export). Times are emitted as FLOATING local time (no Z, no
// TZID): the app stores no user timezone, and "06:00 your local time" is the
// correct interpretation for a calendar event. Deterministic — no Date.now /
// Math.random — so the output is testable and stable.

// iCal text escaping: backslash, comma, semicolon, newline (RFC 5545 §3.3.11).
function esc(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

// "2026-05-30" → "20260530". Returns '' for anything that isn't YYYY-MM-DD.
function compactDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || '')) ? String(dateStr).replace(/-/g, '') : ''
}

// minutes-from-midnight → "HHMMSS", clamped to the same day (23:59:00 max).
function hms(minFromMidnight) {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minFromMidnight)))
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${hh}${mm}00`
}

// Tiny stable hash for the UID (avoids Date.now/random; collisions are harmless
// since UID is per (date, summary)).
function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0 }
  return (h >>> 0).toString(36)
}

/**
 * Build an iCalendar string for a single planned session.
 *
 * @param {object} session  - { type, duration (min), zone?, rpe?, description?, structureLines? }
 * @param {string} dateStr  - 'YYYY-MM-DD' (the day to schedule)
 * @param {object} [opts]   - { startHour=6, lang='en' }
 * @returns {string|null}   - .ics text, or null on invalid input
 */
export function buildSessionIcs(session, dateStr, opts = {}) {
  const s = session || {}
  const d = compactDate(dateStr)
  const dur = Math.max(0, Math.round(Number(s.duration) || 0))
  if (!d || dur <= 0 || !s.type) return null

  const startHour = Number.isFinite(Number(opts.startHour)) ? Number(opts.startHour) : 6
  const lang = opts.lang === 'tr' ? 'tr' : 'en'
  const startMin = startHour * 60
  const summary = `${s.type} (${dur}${lang === 'tr' ? ' dk' : ' min'})`

  const descParts = []
  if (s.zone && s.zone !== '—') descParts.push(`${lang === 'tr' ? 'Bölge' : 'Zone'}: ${s.zone}`)
  if (Number(s.rpe) > 0) descParts.push(`RPE: ${Math.round(Number(s.rpe))}/10`)
  if (Array.isArray(s.structureLines) && s.structureLines.length) descParts.push(s.structureLines.join(' · '))
  if (s.description) descParts.push(String(s.description))
  descParts.push(lang === 'tr' ? 'Sporeus ile planlandı' : 'Planned with Sporeus')
  const description = descParts.join('\n')

  const uid = `sporeus-${d}-${hash(summary)}@sporeus.app`
  const alarmLabel = lang === 'tr' ? '30 dk sonra antrenman' : 'Workout in 30 min'

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sporeus//Athlete App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${d}T000000Z`,
    `DTSTART:${d}T${hms(startMin)}`,
    `DTEND:${d}T${hms(startMin + dur)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(alarmLabel)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  // RFC 5545 wants CRLF line endings.
  return lines.join('\r\n') + '\r\n'
}

// ── Browser download (only side-effecting export) ─────────────────────────────
export function downloadIcsFile(ics, filename) {
  if (!ics) return false
  const safeName = filename && String(filename).trim() ? String(filename).trim() : 'session.ics'
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = safeName
  a.click()
  URL.revokeObjectURL(url)
  return true
}
