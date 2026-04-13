import { S } from '../../styles.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const TODAY = new Date().toISOString().slice(0, 10)
// Coach ID is now generated dynamically per-coach via registration

export function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function daysBefore(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export function daysAgo(dateStr) {
  if (!dateStr || dateStr === '—') return null
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return '1d ago'
  return `${diff}d ago`
}

export function computeLoad(log) {
  if (!log || !log.length) return { ctl: 0, atl: 0, tsb: 0 }
  const sorted = [...log].sort((a, b) => (a.date > b.date ? 1 : -1))
  let ctl = 0, atl = 0
  for (const s of sorted) {
    const tss = s.tss || 0
    ctl = ctl + (tss - ctl) / 42
    atl = atl + (tss - atl) / 7
  }
  return { ctl: Math.round(ctl), atl: Math.round(atl), tsb: Math.round(ctl - atl) }
}

export function computeAthleteMetrics(athlete) {
  const log = athlete.log || []
  const recovery = athlete.recovery || []
  const d7 = daysBefore(7), d28 = daysBefore(28), d14 = daysBefore(14)
  const sorted = [...log].sort((a, b) => (a.date > b.date ? -1 : 1))
  const lastSession = sorted[0]?.date || '—'
  const log7 = log.filter(e => e.date >= d7)
  const tss7 = log7.reduce((s, e) => s + (e.tss || 0), 0)
  const log28 = log.filter(e => e.date >= d28)
  const chronic28 = log28.reduce((s, e) => s + (e.tss || 0), 0) / 4
  let acwr = null, acwrColor = '#888'
  if (chronic28 > 0) {
    acwr = Math.round(tss7 / chronic28 * 100) / 100
    if (acwr < 0.8) acwrColor = '#0064ff'
    else if (acwr <= 1.3) acwrColor = '#5bc25b'
    else if (acwr <= 1.5) acwrColor = '#f5c542'
    else acwrColor = '#e03030'
  }
  const lastRec = [...recovery].sort((a, b) => (a.date > b.date ? -1 : 1))[0]
  const readiness = lastRec?.score || null
  const hasRecentInjury = (athlete.injuryLog || []).some(e => e.date >= d14)
  const needsAttention = (readiness !== null && readiness < 50) || (acwr !== null && acwr > 1.5) || hasRecentInjury
  const statusColor = needsAttention ? '#e03030'
    : ((acwr !== null && acwr > 1.3) || (readiness !== null && readiness < 60)) ? '#f5c542'
    : '#5bc25b'
  return { lastSession, tss7, acwr, acwrColor, readiness, hasRecentInjury, needsAttention, statusColor }
}

export function getReadinessColor(score) {
  if (score === null || score === undefined) return '#888'
  return score >= 75 ? '#5bc25b' : score >= 50 ? '#f5c542' : '#e03030'
}

// ─── Plan compliance — compares coach_plan weeks to athlete's training_log ────
export function computeCompliance(plan, athleteLog) {
  if (!plan || !plan.weeks || !plan.start_date || !athleteLog?.length) return null
  const start = new Date(plan.start_date)
  const today = new Date().toISOString().slice(0, 10)
  const weeks = Array.isArray(plan.weeks) ? plan.weeks : []

  let totalPlanned = 0, totalLogged = 0
  const weekBreakdown = []

  weeks.forEach((wk, idx) => {
    const wkStart = new Date(start.getTime() + idx * 7 * 86400000).toISOString().slice(0, 10)
    const wkEnd   = new Date(start.getTime() + (idx + 1) * 7 * 86400000).toISOString().slice(0, 10)
    if (wkStart > today) return  // future weeks don't count yet
    const sessions = Array.isArray(wk.sessions) ? wk.sessions : []
    const planned  = sessions.filter(s => s.type !== 'Rest' && s.duration > 0).length
    const logged   = athleteLog.filter(e => e.date >= wkStart && e.date < wkEnd).length
    totalPlanned  += planned
    totalLogged   += Math.min(logged, planned)  // cap at planned to avoid >100%
    weekBreakdown.push({ week: wk.week ?? idx + 1, phase: wk.phase, planned, logged, wkStart, wkEnd })
  })

  if (totalPlanned === 0) return null
  const pct = Math.round(totalLogged / totalPlanned * 100)
  const color = pct >= 80 ? '#5bc25b' : pct >= 60 ? '#f5c542' : '#e03030'
  return { pct, color, weekBreakdown, totalPlanned, totalLogged }
}

// ─── Sport-aware plan generator ───────────────────────────────────────────────

export const SPORT_SESSION_TEMPLATES = {
  running:   [['Monday','Easy Run',0.20,4],['Wednesday','Threshold Run',0.20,7],['Friday','Easy Run',0.15,4],['Saturday','Long Run',0.35,6],['Sunday','Rest',0,1]],
  cycling:   [['Monday','Easy Ride',0.20,4],['Wednesday','Sweet Spot',0.20,7],['Friday','Recovery Ride',0.15,3],['Saturday','Long Ride',0.35,6],['Sunday','Rest',0,1]],
  swimming:  [['Monday','Easy Swim',0.20,4],['Wednesday','CSS Intervals',0.20,7],['Friday','Drills',0.15,4],['Saturday','Long Swim',0.35,6],['Sunday','Rest',0,1]],
  triathlon: [['Monday','Easy Swim',0.15,4],['Tuesday','Easy Run',0.12,4],['Wednesday','Threshold Ride',0.18,7],['Friday','Brick (Bike+Run)',0.20,7],['Saturday','Long Ride',0.22,6],['Sunday','Long Run',0.13,6]],
  rowing:    [['Monday','Easy Erg',0.20,4],['Wednesday','Intervals',0.20,7],['Friday','Technique Erg',0.15,4],['Saturday','Long Piece',0.35,6],['Sunday','Rest',0,1]],
}
export const SPORT_GOALS = {
  running:   ['5K','10K','Half Marathon','Full Marathon','General Fitness'],
  cycling:   ['Gran Fondo','Stage Race','Criterium','Time Trial','General Fitness'],
  swimming:  ['Open Water','1500m','5K Open','Triathlon Swim','General Fitness'],
  triathlon: ['Sprint','Olympic','70.3','Full Ironman','General Fitness'],
  rowing:    ['2K Erg','6K Erg','Head Race','General Fitness'],
}

export function generateCoachPlan({ goal, weeks, hoursPerWeek, level, athleteName, sport }) {
  const w = parseInt(weeks) || 8
  const h = parseInt(hoursPerWeek) || 8
  const sp = (sport || 'running').toLowerCase()
  const sessions = SPORT_SESSION_TEMPLATES[sp] || SPORT_SESSION_TEMPLATES.running
  return {
    generated: TODAY, goal, sport: sp, weeks: w, hoursPerWeek: h, level, athleteName,
    weekPlan: Array(w).fill(null).map((_, wi) => ({
      week: wi + 1,
      phase: wi < w * 0.3 ? 'Base' : wi < w * 0.6 ? 'Build' : wi < w * 0.85 ? 'Peak' : 'Taper',
      sessions: sessions.map(([day, type, frac, rpe]) => ({
        day, type, duration: Math.round(h * 60 * frac), rpe,
      })),
    })),
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

export function ReadinessBadge({ score }) {
  if (score === null || score === undefined) return <span style={{ ...S.mono, fontSize:'11px', color:'#888' }}>—</span>
  return <span style={S.tag(getReadinessColor(score))}>{score}</span>
}

export function AcwrBadge({ acwr, acwrColor }) {
  if (acwr === null) return <span style={{ ...S.mono, fontSize:'11px', color:'#888' }}>—</span>
  return <span style={S.tag(acwrColor)}>{acwr.toFixed(2)}{acwr > 1.5 ? ' ⚠' : ''}</span>
}

export function ComplianceBar({ pct }) {
  const color = pct >= 75 ? '#5bc25b' : pct >= 50 ? '#f5c542' : '#e03030'
  const filled = Math.round(pct / 5)
  return <span style={{ ...S.mono, fontSize:'11px', color, letterSpacing:'1px' }}>{'█'.repeat(filled)}{'░'.repeat(20-filled)} {pct}%</span>
}
