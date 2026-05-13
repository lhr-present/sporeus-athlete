// ─── squadView.js — pure helpers for CoachSquadView ──────────────────────────

export const ACWR_COLORS = {
  danger:  '#e03030',
  caution: '#f5c542',
  optimal: '#5bc25b',
  low:     '#555',
}

export function acwrColor(status) {
  return ACWR_COLORS[status] ?? '#555'
}

export function tsbColor(tsb) {
  if (tsb === null || tsb === undefined) return '#555'
  if (tsb > 25)  return '#f5c542'  // peaking — high TSB, carry stored fitness
  if (tsb < -20) return '#e03030'  // overreaching
  if (tsb < -10) return '#f5c542'  // moderate fatigue
  return '#5bc25b'                  // fresh / normal range
}

export function trainingStatusColor(status) {
  switch (status) {
    case 'Overreaching': return '#e03030'
    case 'Detraining':   return '#e03030'
    case 'Building':     return '#5bc25b'
    case 'Peaking':      return '#f5c542'
    case 'Recovering':   return '#0064ff'
    case 'Maintaining':  return '#e0e0e0'
    default:             return '#555'
  }
}

export function formatLastSession(dateStr) {
  if (!dateStr) return '—'
  const d    = new Date(dateStr)
  const now  = new Date()
  const days = Math.floor((now - d) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  if (days < 7)   return `${days}d ago`
  if (days < 30)  return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

// v9.105.0 (Prompt HH) — Aggregated attention signal per athlete.
// Coaches managing 10+ athletes can't open every panel daily. Triaging
// by attention level turns the dashboard into a real ops tool: red dot
// + reason tooltip + sort lets the coach see who needs the next 5
// minutes of attention without clicking anything.
//
// Inputs are the precomputed squad-overview row (get_squad_overview
// RPC) — no per-athlete log fetch needed at list-render time.
export const ATTENTION_COLORS = {
  urgent:    '#e03030',
  attention: '#f5c542',
  ok:        '#5bc25b',
}
export const ATTENTION_RANK = { urgent: 3, attention: 2, ok: 1 }

const REASON_LABELS = {
  acwr_danger:   { en: 'ACWR danger (≥1.5)',           tr: 'ACWR tehlikeli (≥1.5)' },
  acwr_caution:  { en: 'ACWR rising',                  tr: 'ACWR yükseliyor' },
  tsb_deep:      { en: 'Deep fatigue (TSB < −20)',     tr: 'Derin yorgunluk (TSB < −20)' },
  adherence_low: { en: 'Adherence < 30%',              tr: 'Uyum < %30' },
  adherence_mid: { en: 'Adherence < 60%',              tr: 'Uyum < %60' },
  stale_7d:      { en: 'No session 7+ days',           tr: '7+ gün seans yok' },
  detraining:    { en: 'Detraining status',            tr: 'Detraining durumu' },
  overreaching:  { en: 'Overreaching status',          tr: 'Aşırı yüklenme durumu' },
}

function daysSince(dateStr, today) {
  if (!dateStr) return Infinity
  const ref  = today ? new Date(today + 'T12:00:00Z') : new Date()
  const last = new Date(dateStr)
  if (Number.isNaN(last.getTime())) return Infinity
  return Math.floor((ref - last) / 86400000)
}

/**
 * @description Combine multiple squad-row signals into one attention level
 *   with cited reasons. Pure.
 *
 * @param {object} athRow  - squad-overview row
 * @param {string} [today] - 'YYYY-MM-DD' for stable testing
 * @returns {{ level: 'urgent'|'attention'|'ok', reasons: Array<{ key, label: { en, tr } }> }}
 */
export function getAthleteAttentionSignal(athRow, today) {
  if (!athRow) return { level: 'ok', reasons: [] }
  const reasons = []
  const acwrStatus = String(athRow.acwr_status || '').toLowerCase()
  const tsb        = Number(athRow.today_tsb)
  const adherence  = Number(athRow.adherence_pct)
  const status     = String(athRow.training_status || '').toLowerCase()
  const sinceLast  = daysSince(athRow.last_session_date, today)

  // Urgent
  if (acwrStatus === 'danger')          reasons.push({ key: 'acwr_danger',   urgent: true })
  if (Number.isFinite(adherence) && adherence < 30) reasons.push({ key: 'adherence_low', urgent: true })
  if (sinceLast >= 7)                    reasons.push({ key: 'stale_7d',      urgent: true })
  if (status === 'detraining')           reasons.push({ key: 'detraining',    urgent: true })
  if (status === 'overreaching')         reasons.push({ key: 'overreaching',  urgent: true })

  // Attention
  if (acwrStatus === 'caution')          reasons.push({ key: 'acwr_caution',  urgent: false })
  if (Number.isFinite(tsb) && tsb < -20) reasons.push({ key: 'tsb_deep',      urgent: false })
  if (Number.isFinite(adherence) && adherence >= 30 && adherence < 60) {
    reasons.push({ key: 'adherence_mid', urgent: false })
  }

  const hasUrgent = reasons.some(r => r.urgent)
  const level = hasUrgent ? 'urgent' : reasons.length > 0 ? 'attention' : 'ok'
  return {
    level,
    reasons: reasons.map(r => ({ key: r.key, label: REASON_LABELS[r.key] })),
  }
}

export function sortAthletes(athletes, sortBy, sortDir) {
  const dir = sortDir === 'desc' ? -1 : 1
  return [...athletes].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.display_name ?? '').localeCompare(b.display_name ?? '') * dir
      case 'ctl':
        return ((a.today_ctl ?? 0) - (b.today_ctl ?? 0)) * dir
      case 'tsb':
        return ((a.today_tsb ?? 0) - (b.today_tsb ?? 0)) * dir
      case 'acwr':
        return ((a.acwr_ratio ?? 0) - (b.acwr_ratio ?? 0)) * dir
      case 'adherence':
        return ((a.adherence_pct ?? 0) - (b.adherence_pct ?? 0)) * dir
      case 'lastSession':
        return ((a.last_session_date ?? '') < (b.last_session_date ?? '') ? -1 : 1) * dir
      case 'status':
        return (a.training_status ?? '').localeCompare(b.training_status ?? '') * dir
      case 'attention': {
        // v9.105.0 — most-urgent-first when desc, least-urgent-first when asc.
        // Within the same level, tie-break by name so the order is stable.
        const ra = ATTENTION_RANK[getAthleteAttentionSignal(a).level] || 0
        const rb = ATTENTION_RANK[getAthleteAttentionSignal(b).level] || 0
        if (ra !== rb) return (ra - rb) * dir
        return (a.display_name ?? '').localeCompare(b.display_name ?? '')
      }
      default:
        return 0
    }
  })
}

export function filterAthletes(athletes, search, chip) {
  let out = athletes
  if (search.trim()) {
    const q = search.trim().toLowerCase()
    out = out.filter(a => (a.display_name ?? '').toLowerCase().includes(q))
  }
  if (chip === 'danger')     out = out.filter(a => a.acwr_status === 'danger')
  if (chip === 'caution')    out = out.filter(a => a.acwr_status === 'caution' || a.acwr_status === 'danger')
  if (chip === 'detraining') out = out.filter(a => a.training_status === 'Detraining')
  return out
}
