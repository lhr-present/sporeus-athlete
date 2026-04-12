// src/lib/coachDigest.js — Weekly coach digest generation (pure functions)
// Input: athlete objects from CoachSquadView (squad-sync or generateDemoSquad shape)
// Output: formatted summary strings for clipboard/WhatsApp paste

import { calcLoad } from './formulas.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** CTL from the athlete's log up to 7 days ago (precise delta source). */
function ctlSevenDaysAgo(log) {
  if (!log || !log.length) return null
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const cutStr = cutoff.toISOString().slice(0, 10)
  const pastLog = log.filter(e => e.date < cutStr)
  if (!pastLog.length) return null
  return calcLoad(pastLog).ctl
}

/** CTL trend arrow + delta. Uses log when available; TSB as fallback. */
export function ctlTrend(ath) {
  const past = ctlSevenDaysAgo(ath._log)
  if (past !== null) {
    const d = ath.today_ctl - past
    if (d > 0) return `↑${d}`
    if (d < 0) return `↓${Math.abs(d)}`
    return '~'
  }
  // TSB proxy: negative TSB means ATL > CTL → loading > recovering → CTL building
  if ((ath.today_tsb ?? 0) < -8) return '↑'
  if ((ath.today_tsb ?? 0) > 8)  return '↓'
  return '~'
}

/** Wellness estimate 0–100% from HRV score + adherence blend. */
export function wellnessAvg(ath) {
  const hrv = ath.last_hrv_score
  // HRV scale 4.5–9 → normalize to ~30–100%
  const hrvPct = hrv ? Math.min(100, Math.max(30, Math.round((hrv - 3) / 7 * 100))) : 50
  return Math.round((hrvPct + (ath.adherence_pct ?? 50)) / 2)
}

/** Map training_status to overall trend label. */
export function trendLabel(status) {
  if (status === 'Building' || status === 'Peaking') return 'improving'
  if (status === 'Detraining' || status === 'Overreaching') return 'declining'
  return 'stable'
}

/** Map internal ACWR status to digest label. */
export function acwrStatusLabel(status) {
  return { optimal: 'safe', low: 'low', caution: 'caution', danger: 'danger' }[status] ?? status ?? '—'
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate one digest line per athlete.
 * Format: "[Name]: CTL [n] [↑↓~delta], ACWR [ratio] ([safe|caution|danger]),
 *          wellness avg [pct]% — [improving|stable|declining]."
 */
export function generateAthleteDigestLine(ath) {
  const trend    = ctlTrend(ath)
  const wellness = wellnessAvg(ath)
  const overall  = trendLabel(ath.training_status)
  const acwr     = ath.acwr_ratio !== null && ath.acwr_ratio !== undefined
    ? Number(ath.acwr_ratio).toFixed(2)
    : '—'
  const acwrSt   = acwrStatusLabel(ath.acwr_status)
  return `${ath.display_name}: CTL ${ath.today_ctl} ${trend}, ACWR ${acwr} (${acwrSt}), wellness avg ${wellness}% — ${overall}.`
}

/**
 * Generate full squad digest for clipboard paste.
 * @param {object[]} athletes - sorted athlete array
 * @returns {{ date: string, lines: string[], text: string }}
 */
export function generateSquadDigest(athletes) {
  const date  = new Date().toISOString().slice(0, 10)
  const lines = athletes.map(generateAthleteDigestLine)
  const text  = `Squad Digest — ${date}\n\n${lines.join('\n')}`
  return { date, lines, text }
}
