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
