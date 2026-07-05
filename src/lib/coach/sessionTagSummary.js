// src/lib/coach/sessionTagSummary.js — E4 reader: per-athlete execution profile
//
// v9.472.0 — aggregates session_tag over a window of an athlete's sessions for
// the coach dashboard. Pure — no DB, no network.
//
// Rows may predate the session_tag writer (column null): those are classified
// on the fly with the same pure classifySession (plan-less), so the panel
// works on day one for existing history. DB tags win when present — they were
// stamped at write time by the same rules.

import { classifySession } from './classifySession.js'

export const TAG_ORDER = [
  'planned_match', 'moderate', 'recovery', 'test',
  'unplanned_high', 'unplanned_low', 'junk', 'planned_miss',
]

// Terminal-style palette per tag (matches the app's status colors)
export const TAG_COLORS = {
  planned_match:  '#5bc25b',
  moderate:       '#0064ff',
  recovery:       '#5bc25b',
  test:           '#f5c542',
  unplanned_high: '#e03030',
  unplanned_low:  '#f5c542',
  junk:           '#888888',
  planned_miss:   '#e03030',
}

/**
 * @description Aggregate an athlete's sessions into a tag distribution.
 *   Accepts rows in either DB shape (duration_min, session_tag) or entry shape
 *   (duration, sessionTag) — the coach fetch returns DB rows, demo data
 *   returns entries.
 *
 * @param {Array<Object>} rows  - sessions (any mix of shapes)
 * @returns {{
 *   total: number,
 *   counts: Record<string, number>,
 *   share:  Record<string, number>,   // 0–100 integer percents
 *   flags:  Array<{ level: 'warn'|'info', en: string, tr: string }>,
 * }}
 */
export function summarizeSessionTags(rows) {
  const counts = {}
  for (const t of TAG_ORDER) counts[t] = 0

  const list = Array.isArray(rows) ? rows : []
  let total = 0
  for (const r of list) {
    if (!r || typeof r !== 'object') continue
    let tag = r.session_tag || r.sessionTag || null
    if (!tag) {
      // Pre-wiring history: classify on the fly with the same rules.
      const session = {
        date:     r.date,
        type:     r.type,
        tss:      r.tss,
        rpe:      r.rpe,
        duration: r.duration != null ? r.duration : (r.duration_min != null ? Number(r.duration_min) : 0),
      }
      tag = classifySession(session).tag
    }
    if (!(tag in counts)) counts[tag] = 0
    counts[tag]++
    total++
  }

  const share = {}
  for (const [t, c] of Object.entries(counts)) share[t] = total ? Math.round((c / total) * 100) : 0

  // Coach-attention flags — descriptive, not prescriptive (what the athlete
  // DID, not what they should do — training prescriptions stay founder-domain).
  const flags = []
  if (total >= 6 && share.junk >= 25) {
    flags.push({
      level: 'warn',
      en: `${counts.junk} of ${total} sessions below adaptation threshold (junk)`,
      tr: `${total} seansın ${counts.junk} tanesi adaptasyon eşiğinin altında (etkisiz)`,
    })
  }
  if (total >= 6 && share.unplanned_high >= 25) {
    flags.push({
      level: 'warn',
      en: `${counts.unplanned_high} high-load sessions without plan context`,
      tr: `${counts.unplanned_high} plansız yüksek yüklü seans`,
    })
  }
  if (total >= 6 && share.recovery + share.junk >= 70) {
    flags.push({
      level: 'info',
      en: `Mostly easy/short sessions — little overload stimulus in this window`,
      tr: `Çoğunlukla kolay/kısa seanslar — bu pencerede aşırı yüklenme uyaranı az`,
    })
  }

  return { total, counts, share, flags }
}
