// ─── mmss.js — Mobile-friendly time format helpers (v9.49.0) ────────────
//
// Mobile numeric keyboards expose digits + . + , (no colon), so any time
// input prefixed with `inputMode="numeric"` was previously unfillable on
// phones. This module pairs:
//
//   - autoFormatMmSs(raw, opts) — re-derive a display string from any
//     mixture of digit-only input or already-colon-formatted input.
//   - parseMmSs(str) — lenient parser that accepts BOTH the colon form
//     ("MM:SS", "H:MM:SS") AND digit-only ("50", "5000", "12345") so an
//     athlete who types "50" on a numeric keypad gets parsed as 50 min.
//
// First introduced inline in EliteProgramCard.jsx (v9.19.0). Extracted
// here in v9.49.0 so the same lenient behavior reaches the 9 PR/time
// inputs across Onboarding, ZoneCalc, SportProgramBuilder, etc.
//
// Pure functions, no React. Bilingual-agnostic — display strings are
// language-neutral digit:digit format.

/**
 * Re-derive an MM:SS / H:MM:SS / HH:MM:SS display string from raw input.
 * Strips non-digits, caps at 6 digits, slots colons by length.
 *
 * @param {string|null|undefined} raw  athlete-typed value
 * @param {{ padOnBlur?: boolean }} [opts]  when true, append ":00" to a
 *   1-2 digit value so "50" becomes "50:00" — the input visually
 *   confirms the parser's interpretation.
 * @returns {string}
 */
export function autoFormatMmSs(raw, opts = {}) {
  const { padOnBlur = false } = opts
  if (raw == null) return ''
  const digits = String(raw).replace(/\D/g, '').slice(0, 6)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return padOnBlur ? `${digits}:00` : digits
  if (digits.length === 3) return `${digits[0]}:${digits.slice(1)}`            // M:SS
  if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`   // MM:SS
  if (digits.length === 5) return `${digits[0]}:${digits.slice(1, 3)}:${digits.slice(3)}` // H:MM:SS
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`      // HH:MM:SS
}

/**
 * Parse an athlete-typed time string to total seconds.
 * Lenient: accepts "MM:SS", "H:MM:SS", "HH:MM:SS", AND digit-only forms
 * "M", "MM", "MSS", "MMSS", "HMMSS", "HHMMSS" matching what
 * autoFormatMmSs produces.
 *
 * Validation:
 *   - seconds < 60 (where the parsed string contains seconds)
 *   - minutes < 60 when an hours component is present
 *
 * @param {string|null|undefined} str
 * @returns {number|null} total seconds, or null when input is unparseable
 */
export function parseMmSs(str) {
  if (!str || typeof str !== 'string') return null
  const s = str.trim()
  if (!s) return null
  // Colon form: MM:SS or H:MM:SS or HH:MM:SS
  const colon = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (colon) {
    const hasHrs = colon[3] != null
    const h = hasHrs ? Number(colon[1]) : 0
    const m = hasHrs ? Number(colon[2]) : Number(colon[1])
    const sec = hasHrs ? Number(colon[3]) : Number(colon[2])
    if (sec >= 60) return null
    if (hasHrs && m >= 60) return null
    return h * 3600 + m * 60 + sec
  }
  // Digit-only form: 1-6 digits matching autoFormatMmSs output shape
  if (/^\d+$/.test(s) && s.length >= 1 && s.length <= 6) {
    const d = s
    if (d.length <= 2) return Number(d) * 60                                          // MM (minutes only)
    if (d.length === 3) {
      const sec = Number(d.slice(1))
      if (sec >= 60) return null
      return Number(d[0]) * 60 + sec                                                  // M:SS
    }
    if (d.length === 4) {
      const min = Number(d.slice(0, 2)), sec = Number(d.slice(2))
      if (sec >= 60) return null
      return min * 60 + sec                                                           // MM:SS
    }
    if (d.length === 5) {
      const h = Number(d[0]), min = Number(d.slice(1, 3)), sec = Number(d.slice(3))
      if (sec >= 60 || min >= 60) return null
      return h * 3600 + min * 60 + sec                                                // H:MM:SS
    }
    if (d.length === 6) {
      const h = Number(d.slice(0, 2)), min = Number(d.slice(2, 4)), sec = Number(d.slice(4))
      if (sec >= 60 || min >= 60) return null
      return h * 3600 + min * 60 + sec                                                // HH:MM:SS
    }
  }
  return null
}
