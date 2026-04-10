import { useRef, useState, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)
const MY_COACH_ID = 'huseyin-sporeus'

function isoDate(d) {
  try { return new Date(d).toISOString().slice(0, 10) } catch { return '' }
}

function daysBefore(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function isWithinDays(dateStr, days) {
  return dateStr >= daysBefore(days)
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function computeLoad(log) {
  if (!log || log.length === 0) return { ctl: 0, atl: 0, tsb: 0 }
  const sorted = [...log].sort((a, b) => (a.date > b.date ? 1 : -1))
  let ctl = 0, atl = 0
  for (const s of sorted) {
    const tss = s.tss || 0
    ctl = ctl + (tss - ctl) / 42
    atl = atl + (tss - atl) / 7
  }
  return {
    ctl: Math.round(ctl),
    atl: Math.round(atl),
    tsb: Math.round(ctl - atl),
  }
}

function computeAthleteMetrics(athlete) {
  const log = athlete.log || []
  const recovery = athlete.recovery || []
  const d7 = daysBefore(7)
  const d28 = daysBefore(28)
  const d14 = daysBefore(14)

  const lastSession = log.length
    ? [...log].sort((a, b) => (a.date > b.date ? -1 : 1))[0]?.date || '—'
    : '—'

  const log7 = log.filter(e => e.date >= d7)
  const tss7 = log7.reduce((s, e) => s + (e.tss || 0), 0)
  const sessions7 = log7.length

  const lastRec = recovery.length
    ? [...recovery].sort((a, b) => (a.date > b.date ? -1 : 1))[0]
    : null
  const readiness = lastRec ? lastRec.score || null : null

  const log28 = log.filter(e => e.date >= d28)
  const chronic28Total = log28.reduce((s, e) => s + (e.tss || 0), 0)
  const chronicWeeklyAvg = chronic28Total / 4
  let acwr = null
  let acwrColor = '#888'
  if (chronicWeeklyAvg > 0) {
    acwr = tss7 / chronicWeeklyAvg
    if (acwr < 0.8) acwrColor = '#0064ff'
    else if (acwr <= 1.3) acwrColor = '#5bc25b'
    else if (acwr <= 1.5) acwrColor = '#f5c542'
    else acwrColor = '#e03030'
  }

  const injuryLog = athlete.injuryLog || []
  const hasRecentInjury = injuryLog.some(e => e.date >= d14)

  const needsAttention = (readiness !== null && readiness < 50) || (acwr !== null && acwr > 1.5) || hasRecentInjury

  return { lastSession, tss7, sessions7, readiness, acwr, acwrColor, hasRecentInjury, needsAttention }
}

function getReadinessColor(score) {
  if (score === null || score === undefined) return '#888'
  if (score >= 75) return '#5bc25b'
  if (score >= 50) return '#f5c542'
  return '#e03030'
}

// ─── Plan Generator (sport-aware) ────────────────────────────────────────────

function generateCoachPlan({ goal, weeks, hoursPerWeek, level, athleteName, sport }) {
  const w = parseInt(weeks) || 8
  const h = parseInt(hoursPerWeek) || 8
  const sp = (sport || 'running').toLowerCase()

  const SPORT_SESSIONS = {
    running: [
      { day: 'Monday',    type: 'Easy Run',      rpeBase: 4 },
      { day: 'Wednesday', type: 'Threshold Run',  rpeBase: 7 },
      { day: 'Friday',    type: 'Easy Run',       rpeBase: 4 },
      { day: 'Saturday',  type: 'Long Run',       rpeBase: 6 },
      { day: 'Sunday',    type: 'Rest / Stretch', rpeBase: 1 },
    ],
    cycling: [
      { day: 'Monday',    type: 'Easy Ride',      rpeBase: 4 },
      { day: 'Wednesday', type: 'Sweet Spot',     rpeBase: 7 },
      { day: 'Friday',    type: 'Recovery Ride',  rpeBase: 3 },
      { day: 'Saturday',  type: 'Long Ride',      rpeBase: 6 },
      { day: 'Sunday',    type: 'Rest / Stretch', rpeBase: 1 },
    ],
    swimming: [
      { day: 'Monday',    type: 'Easy Swim',      rpeBase: 4 },
      { day: 'Wednesday', type: 'CSS Intervals',  rpeBase: 7 },
      { day: 'Friday',    type: 'Drills',         rpeBase: 4 },
      { day: 'Saturday',  type: 'Long Swim',      rpeBase: 6 },
      { day: 'Sunday',    type: 'Rest / Stretch', rpeBase: 1 },
    ],
    triathlon: [
      { day: 'Monday',    type: 'Easy Swim',      rpeBase: 4 },
      { day: 'Tuesday',   type: 'Easy Run',       rpeBase: 4 },
      { day: 'Wednesday', type: 'Threshold Ride', rpeBase: 7 },
      { day: 'Friday',    type: 'Brick (Bike+Run)',rpeBase: 7 },
      { day: 'Saturday',  type: 'Long Ride',      rpeBase: 6 },
      { day: 'Sunday',    type: 'Long Run',       rpeBase: 6 },
    ],
    rowing: [
      { day: 'Monday',    type: 'Easy Erg',       rpeBase: 4 },
      { day: 'Wednesday', type: 'Intervals',      rpeBase: 7 },
      { day: 'Friday',    type: 'Technique Erg',  rpeBase: 4 },
      { day: 'Saturday',  type: 'Long Piece',     rpeBase: 6 },
      { day: 'Sunday',    type: 'Rest / Stretch', rpeBase: 1 },
    ],
  }

  const sessions = SPORT_SESSIONS[sp] || SPORT_SESSIONS.running
  const sessionCount = sessions.length
  const durWeights = [0.20, 0.20, 0.15, 0.35, 0.10]

  return {
    generated: TODAY,
    goal,
    sport: sp,
    weeks: w,
    hoursPerWeek: h,
    level,
    athleteName,
    weekPlan: Array(w).fill(null).map((_, wi) => ({
      week: wi + 1,
      phase:
        wi < w * 0.3 ? 'Base'
        : wi < w * 0.6 ? 'Build'
        : wi < w * 0.85 ? 'Peak'
        : 'Taper',
      sessions: sessions.map((s, si) => ({
        day: s.day,
        type: s.type,
        duration: Math.round(h * 60 * (durWeights[si] || 0.15)),
        rpe: s.rpeBase,
      })),
    })),
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ReadinessBadge({ score }) {
  if (score === null || score === undefined) return <span style={{ ...S.mono, fontSize: '11px', color: '#888' }}>—</span>
  const c = getReadinessColor(score)
  return <span style={S.tag(c)}>{score}</span>
}

function AcwrBadge({ acwr, acwrColor }) {
  if (acwr === null) return <span style={{ ...S.mono, fontSize: '11px', color: '#888' }}>—</span>
  const warn = acwr > 1.5
  return (
    <span style={{ ...S.tag(acwrColor), position: 'relative' }}>
      {acwr.toFixed(2)}{warn ? ' ⚠' : ''}
    </span>
  )
}

function ComplianceBar({ pct }) {
  const color = pct >= 75 ? '#5bc25b' : pct >= 50 ? '#f5c542' : '#e03030'
  const filled = Math.round(pct / 5)
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled)
  return (
    <span style={{ ...S.mono, fontSize: '11px', color, letterSpacing: '1px' }}>
      {bar} {pct}%
    </span>
  )
}

// ─── Expanded Athlete Detail ──────────────────────────────────────────────────

function AthleteDetail({ athlete, onUpdate, onClose }) {
  const log = athlete.log || []
  const recovery = athlete.recovery || []
  const { ctl, atl, tsb } = computeLoad(log)
  const tsbColor = tsb > 5 ? '#5bc25b' : tsb < -10 ? '#e03030' : '#f5c542'

  const last5 = [...log].sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 5)

  const recTrend = [...recovery]
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, 7)
    .map(r => r.score || '?')
    .join(', ')

  const injuryLog = athlete.injuryLog || []
  const d14 = daysBefore(14)
  const recentInjuryZones = [...new Set(
    injuryLog.filter(e => e.date >= d14).map(e => e.zone).filter(Boolean)
  )]

  const complianceWeeks = []
  for (let w = 0; w < 4; w++) {
    const wStart = daysBefore(28 - w * 7)
    const wEnd = daysBefore(21 - w * 7)
    const actual = log.filter(e => e.date >= wStart && e.date < wEnd).length
    const pct = Math.min(100, Math.round((actual / 4) * 100))
    complianceWeeks.push({ week: 4 - w, actual, expected: 4, pct })
  }

  const [planGoal, setPlanGoal] = useState('Goal Race')
  const [planWeeks, setPlanWeeks] = useState('8')
  const [planHours, setPlanHours] = useState('8')
  const [planLevel, setPlanLevel] = useState('Intermediate')

  const [noteText, setNoteText] = useState('')
  const [editingNoteIdx, setEditingNoteIdx] = useState(null)
  const [editNoteText, setEditNoteText] = useState('')

  function handleGeneratePlan() {
    const plan = generateCoachPlan({
      goal: planGoal,
      weeks: planWeeks,
      hoursPerWeek: planHours,
      level: planLevel,
      athleteName: athlete.name,
      sport: athlete.sport || athlete.profile?.sport || 'running',
    })
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sporeus-plan-${athlete.name.replace(/\s+/g, '-')}-${TODAY}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleAddNote() {
    if (!noteText.trim()) return
    const newNote = { date: TODAY, text: noteText.trim() }
    onUpdate({ ...athlete, notes: [newNote, ...(athlete.notes || [])] })
    setNoteText('')
  }

  function handleDeleteNote(idx) {
    const notes = [...(athlete.notes || [])]
    notes.splice(idx, 1)
    onUpdate({ ...athlete, notes })
  }

  function handleStartEditNote(idx) {
    setEditingNoteIdx(idx)
    setEditNoteText((athlete.notes || [])[idx]?.text || '')
  }

  function handleSaveEditNote() {
    const notes = [...(athlete.notes || [])]
    notes[editingNoteIdx] = { ...notes[editingNoteIdx], text: editNoteText.trim() }
    onUpdate({ ...athlete, notes })
    setEditingNoteIdx(null)
    setEditNoteText('')
  }

  function handleCancelEditNote() {
    setEditingNoteIdx(null)
    setEditNoteText('')
  }

  function handleCopyReport() {
    const lines = [`COMPLIANCE REPORT — ${athlete.name}`, `Generated: ${TODAY}`, '']
    complianceWeeks.forEach(cw => {
      lines.push(`Week ${cw.week}: ${cw.actual}/${cw.expected} sessions (${cw.pct}%)`)
    })
    const totalActual = complianceWeeks.reduce((s, cw) => s + cw.actual, 0)
    const totalPct = Math.round((totalActual / 16) * 100)
    lines.push('')
    lines.push(`4-Week Total: ${totalActual}/16 sessions (${totalPct}%)`)
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
  }

  function handlePrintReport() {
    const p = athlete.profile || {}
    const load = computeLoad(log)
    const totalActual = complianceWeeks.reduce((s, cw) => s + cw.actual, 0)
    const totalPct = Math.round((totalActual / 16) * 100)
    const avgReadiness = recovery.length
      ? Math.round(recovery.slice(-7).reduce((s, r) => s + (r.score || 0), 0) / Math.min(7, recovery.length))
      : null
    const recentNotes = (athlete.notes || []).slice(0, 5)

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Sporeus Report — ${escHtml(athlete.name)}</title>
<style>
  body { font-family: 'IBM Plex Mono', 'Courier New', monospace; background: #0a0a0a; color: #e0e0e0; margin: 0; padding: 24px; font-size: 12px; }
  .header { border-bottom: 2px solid #ff6600; padding-bottom: 12px; margin-bottom: 20px; }
  .title { font-size: 20px; font-weight: 700; color: #ff6600; letter-spacing: 0.1em; }
  .sub { font-size: 10px; color: #888; letter-spacing: 0.08em; margin-top: 4px; }
  .section { margin-bottom: 20px; border: 1px solid #222; border-radius: 4px; padding: 14px; }
  .section-title { font-size: 10px; font-weight: 700; color: #0064ff; letter-spacing: 0.1em; margin-bottom: 10px; }
  .row { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 8px; }
  .stat { text-align: center; }
  .stat-val { font-size: 24px; font-weight: 700; }
  .stat-lbl { font-size: 9px; color: #888; letter-spacing: 0.06em; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; padding: 4px 8px; color: #888; font-size: 9px; letter-spacing: 0.06em; border-bottom: 1px solid #333; }
  td { padding: 5px 8px; border-bottom: 1px solid #1a1a1a; }
  .orange { color: #ff6600; } .blue { color: #0064ff; } .green { color: #5bc25b; } .red { color: #e03030; } .yellow { color: #f5c542; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: 700; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>

<div class="header">
  <div class="title">◈ SPOREUS ATHLETE REPORT</div>
  <div class="sub">COACH: HÜSEYIN IŞIK · SPOREUS.COM · ${escHtml(TODAY)}</div>
</div>

<!-- 1. Athlete Profile -->
<div class="section">
  <div class="section-title">01 / ATHLETE PROFILE</div>
  <div class="row">
    <div><span style="color:#888;font-size:9px">NAME</span><br/><strong style="font-size:14px">${escHtml(athlete.name)}</strong></div>
    <div><span style="color:#888;font-size:9px">SPORT</span><br/>${escHtml(athlete.sport || '—')}</div>
    <div><span style="color:#888;font-size:9px">AGE</span><br/>${escHtml(p.age || '—')}</div>
    <div><span style="color:#888;font-size:9px">WEIGHT</span><br/>${escHtml(p.weight ? p.weight + ' kg' : '—')}</div>
    <div><span style="color:#888;font-size:9px">FTP</span><br/>${escHtml(p.ftp ? p.ftp + ' W' : '—')}</div>
    <div><span style="color:#888;font-size:9px">VO2MAX</span><br/>${escHtml(p.vo2max ? p.vo2max + ' ml/kg/min' : '—')}</div>
    <div><span style="color:#888;font-size:9px">THRESHOLD PACE</span><br/>${escHtml(p.threshold || '—')}</div>
    <div><span style="color:#888;font-size:9px">GOAL</span><br/>${escHtml(p.goal || '—')}</div>
  </div>
  <div><span style="color:#888;font-size:9px">IMPORTED</span> ${escHtml(athlete.importedAt || '—')}</div>
</div>

<!-- 2. Training Load -->
<div class="section">
  <div class="section-title">02 / TRAINING LOAD (CTL / ATL / TSB)</div>
  <div class="row">
    <div class="stat"><div class="stat-val blue">${load.ctl}</div><div class="stat-lbl">CTL (FITNESS)</div></div>
    <div class="stat"><div class="stat-val red">${load.atl}</div><div class="stat-lbl">ATL (FATIGUE)</div></div>
    <div class="stat"><div class="stat-val ${load.tsb > 5 ? 'green' : load.tsb < -10 ? 'red' : 'yellow'}">${load.tsb >= 0 ? '+' : ''}${load.tsb}</div><div class="stat-lbl">TSB (FORM)</div></div>
    <div class="stat"><div class="stat-val orange">${log.reduce((s,e)=>s+(e.tss||0),0)}</div><div class="stat-lbl">TOTAL TSS</div></div>
    <div class="stat"><div class="stat-val" style="color:#e0e0e0">${log.length}</div><div class="stat-lbl">SESSIONS</div></div>
  </div>
</div>

<!-- 3. Last 5 Sessions -->
<div class="section">
  <div class="section-title">03 / LAST 5 SESSIONS</div>
  ${last5.length === 0 ? '<div style="color:#888">No sessions logged.</div>' : `
  <table>
    <thead><tr><th>DATE</th><th>TYPE</th><th>DURATION</th><th>RPE</th><th>TSS</th><th>NOTES</th></tr></thead>
    <tbody>
      ${last5.map(s => `<tr>
        <td style="color:#888">${escHtml(s.date || '—')}</td>
        <td>${escHtml(s.type || '—')}</td>
        <td class="orange">${s.duration ? s.duration + 'm' : '—'}</td>
        <td>${escHtml(s.rpe || '—')}</td>
        <td class="blue">${escHtml(s.tss || '—')}</td>
        <td style="color:#888;max-width:180px">${escHtml(s.notes || '')}</td>
      </tr>`).join('')}
    </tbody>
  </table>`}
</div>

<!-- 4. Recovery & Readiness -->
<div class="section">
  <div class="section-title">04 / RECOVERY &amp; READINESS</div>
  <div class="row">
    ${avgReadiness !== null ? `<div class="stat"><div class="stat-val ${avgReadiness>=75?'green':avgReadiness>=50?'yellow':'red'}">${avgReadiness}</div><div class="stat-lbl">7-DAY AVG READINESS</div></div>` : ''}
    <div style="flex:1"><span style="color:#888;font-size:9px">READINESS TREND (last 7 scores)</span><br/><span style="font-size:13px;color:#5bc25b">${escHtml(recTrend || '—')}</span></div>
  </div>
</div>

<!-- 5. Injury Flags -->
<div class="section">
  <div class="section-title">05 / INJURY FLAGS (LAST 14 DAYS)</div>
  ${recentInjuryZones.length === 0
    ? '<span class="tag green">✓ None reported</span>'
    : recentInjuryZones.map(z => `<span class="tag red">⚠ ${escHtml(z)}</span> `).join('')
  }
</div>

<!-- 6. 4-Week Compliance -->
<div class="section">
  <div class="section-title">06 / 4-WEEK COMPLIANCE (Expected: 4 sessions/week)</div>
  <table>
    <thead><tr><th>WEEK</th><th>SESSIONS</th><th>COMPLIANCE</th></tr></thead>
    <tbody>
      ${complianceWeeks.map(cw => `<tr>
        <td style="color:#888">Week ${cw.week}</td>
        <td>${cw.actual}/${cw.expected}</td>
        <td class="${cw.pct>=75?'green':cw.pct>=50?'yellow':'red'}">${cw.pct}%</td>
      </tr>`).join('')}
      <tr style="border-top:2px solid #333;font-weight:700">
        <td>TOTAL</td>
        <td>${complianceWeeks.reduce((s,c)=>s+c.actual,0)}/16</td>
        <td class="${totalPct>=75?'green':totalPct>=50?'yellow':'red'}">${totalPct}%</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- 7. Coach Notes -->
<div class="section">
  <div class="section-title">07 / COACH NOTES</div>
  ${recentNotes.length === 0
    ? '<div style="color:#888">No notes recorded.</div>'
    : recentNotes.map(n => `<div style="border-bottom:1px solid #222;padding:6px 0">
        <span style="color:#888;font-size:9px">${escHtml(n.date)}</span>
        <span style="margin-left:12px">${escHtml(n.text)}</span>
      </div>`).join('')
  }
</div>

<div style="text-align:center;color:#444;font-size:9px;margin-top:24px;letter-spacing:0.08em">
  SPOREUS ATHLETE CONSOLE · GENERATED ${escHtml(TODAY)} · SPOREUS.COM
</div>
</body></html>`

    const w = window.open('', '_blank', 'width=820,height=940')
    if (!w) { alert('Pop-up blocked — allow pop-ups to print the report.'); return }
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 600)
  }

  const SPORT_GOALS = {
    running:   ['5K', '10K', 'Half Marathon', 'Full Marathon', 'General Fitness'],
    cycling:   ['Gran Fondo', 'Stage Race', 'Criterium', 'Time Trial', 'General Fitness'],
    swimming:  ['Open Water', '1500m', '5K Open', 'Triathlon Swim', 'General Fitness'],
    triathlon: ['Sprint', 'Olympic', '70.3', 'Full Ironman', 'General Fitness'],
    rowing:    ['2K Erg', '6K Erg', 'Head Race', 'General Fitness'],
  }
  const athleteSport = (athlete.sport || athlete.profile?.sport || 'running').toLowerCase()
  const goalOptions = SPORT_GOALS[athleteSport] || SPORT_GOALS.running

  return (
    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
      {/* Print Report button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button style={{ ...S.btn, background: '#0064ff', fontSize: '11px', padding: '6px 14px' }} onClick={handlePrintReport}>
          ⊞ Print PDF Report
        </button>
      </div>

      {/* CTL / ATL / TSB */}
      <div style={{ ...S.row, marginBottom: '12px' }}>
        {[
          { lbl: 'CTL (Fitness)', val: ctl, color: '#0064ff' },
          { lbl: 'ATL (Fatigue)', val: atl, color: '#e03030' },
          { lbl: 'TSB (Form)',    val: (tsb >= 0 ? '+' : '') + tsb, color: tsbColor },
        ].map(({ lbl, val, color }) => (
          <div key={lbl} style={{ flex: '1 1 90px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
            <div style={{ ...S.mono, fontSize: '20px', fontWeight: 700, color }}>{val}</div>
            <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.08em', marginTop: '4px' }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Last 5 sessions */}
      <div style={S.cardTitle}>LAST 5 SESSIONS</div>
      {last5.length === 0 ? (
        <div style={{ ...S.mono, fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>No sessions logged.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', ...S.mono, fontSize: '11px', marginBottom: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
              {['DATE', 'TYPE', 'DUR', 'RPE', 'TSS'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600, letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {last5.map((s, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '4px 6px', color: 'var(--muted)' }}>{s.date || '—'}</td>
                <td style={{ padding: '4px 6px' }}>{s.type || '—'}</td>
                <td style={{ padding: '4px 6px', color: '#ff6600' }}>{s.duration ? `${s.duration}m` : '—'}</td>
                <td style={{ padding: '4px 6px' }}>{s.rpe || '—'}</td>
                <td style={{ padding: '4px 6px', color: '#0064ff' }}>{s.tss || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Recovery trend */}
      <div style={{ marginBottom: '12px' }}>
        <span style={S.label}>RECOVERY TREND (last 7)</span>
        <div style={{ ...S.mono, fontSize: '13px', color: '#5bc25b' }}>{recTrend || '—'}</div>
      </div>

      {/* Injury flags */}
      <div style={{ marginBottom: '12px' }}>
        <span style={S.label}>INJURY FLAGS (last 14 days)</span>
        {recentInjuryZones.length === 0 ? (
          <div style={{ ...S.mono, fontSize: '12px', color: '#5bc25b' }}>None reported</div>
        ) : (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {recentInjuryZones.map(z => (
              <span key={z} style={S.tag('#e03030')}>⚠ {z}</span>
            ))}
          </div>
        )}
      </div>

      {/* Compliance Report */}
      <div style={{ ...S.card, background: 'var(--surface)', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={S.cardTitle}>COMPLIANCE REPORT</div>
          <button style={{ ...S.btnSec, fontSize: '11px', padding: '5px 10px' }} onClick={handleCopyReport}>
            Copy Report
          </button>
        </div>
        <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '8px' }}>Expected: 4 sessions/week</div>
        {complianceWeeks.map(cw => (
          <div key={cw.week} style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', ...S.mono, fontSize: '11px', marginBottom: '3px' }}>
              <span style={{ color: 'var(--muted)' }}>Week {cw.week}</span>
              <span>{cw.actual}/{cw.expected} sessions</span>
            </div>
            <ComplianceBar pct={cw.pct} />
          </div>
        ))}
      </div>

      {/* Plan Export */}
      <div style={{ ...S.card, background: 'var(--surface)', marginBottom: '12px' }}>
        <div style={S.cardTitle}>CREATE PLAN FOR {athlete.name.toUpperCase()}</div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#0064ff', marginBottom: '8px', letterSpacing: '0.06em' }}>
          SPORT: {athleteSport.toUpperCase()}
        </div>
        <div style={{ ...S.row, marginBottom: '10px' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label style={S.label}>GOAL</label>
            <select style={S.select} value={planGoal} onChange={e => setPlanGoal(e.target.value)}>
              {goalOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 80px' }}>
            <label style={S.label}>WEEKS (4–20)</label>
            <input type="number" min="4" max="20" style={S.input} value={planWeeks}
              onChange={e => setPlanWeeks(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 80px' }}>
            <label style={S.label}>HRS/WEEK</label>
            <input type="number" min="4" max="20" style={S.input} value={planHours}
              onChange={e => setPlanHours(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={S.label}>LEVEL</label>
            <select style={S.select} value={planLevel} onChange={e => setPlanLevel(e.target.value)}>
              {['Beginner', 'Intermediate', 'Advanced'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <button style={S.btn} onClick={handleGeneratePlan}>
          Generate &amp; Export Plan
        </button>
      </div>

      {/* Coach Notes */}
      <div style={{ ...S.card, background: 'var(--surface)', marginBottom: '0' }}>
        <div style={S.cardTitle}>COACH NOTES</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <textarea
            style={{ ...S.input, height: '60px', resize: 'vertical', flex: 1 }}
            placeholder="Add a note..."
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
          />
          <button style={{ ...S.btn, alignSelf: 'flex-end', whiteSpace: 'nowrap' }} onClick={handleAddNote}>
            Add Note
          </button>
        </div>
        {(athlete.notes || []).slice(0, 5).map((note, i) => (
          <div key={i} style={{ borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
            {editingNoteIdx === i ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <textarea
                  style={{ ...S.input, height: '48px', resize: 'vertical', flex: 1, fontSize: '12px' }}
                  value={editNoteText}
                  onChange={e => setEditNoteText(e.target.value)}
                  autoFocus
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button onClick={handleSaveEditNote}
                    style={{ ...S.btn, fontSize: '10px', padding: '4px 10px' }}>✓ Save</button>
                  <button onClick={handleCancelEditNote}
                    style={{ ...S.btnSec, fontSize: '10px', padding: '4px 10px' }}>✕</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginRight: '8px' }}>{note.date}</span>
                  <span style={{ ...S.mono, fontSize: '12px' }}>{note.text}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', flex: '0 0 auto' }}>
                  <button onClick={() => handleStartEditNote(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', ...S.mono, fontSize: '13px', padding: '0 4px', lineHeight: 1 }}
                    title="Edit note">✎</button>
                  <button onClick={() => handleDeleteNote(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e03030', ...S.mono, fontSize: '13px', padding: '0 4px', lineHeight: 1 }}
                    title="Delete note">×</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!(athlete.notes && athlete.notes.length) && (
          <div style={{ ...S.mono, fontSize: '12px', color: 'var(--muted)' }}>No notes yet.</div>
        )}
      </div>
    </div>
  )
}

// ─── Multi-Athlete Comparison ─────────────────────────────────────────────────

function AthleteComparison({ roster }) {
  const [selected, setSelected] = useState([])

  function toggleSelect(id) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 4) return prev
      return [...prev, id]
    })
  }

  const compared = roster.filter(a => selected.includes(a.id))

  const athleteStats = compared.map(a => {
    const metrics = computeAthleteMetrics(a)
    const load = computeLoad(a.log || [])
    return { ...a, ...metrics, ...load }
  })

  const minReadiness = athleteStats.reduce((min, a) =>
    (a.readiness !== null && (min === null || a.readiness < min)) ? a.readiness : min, null)
  const maxAcwr = athleteStats.reduce((max, a) =>
    (a.acwr !== null && (max === null || a.acwr > max)) ? a.acwr : max, null)

  return (
    <div style={S.card}>
      <div style={S.cardTitle}>COMPARE ATHLETES</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        {roster.map(a => (
          <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', ...S.mono, fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={selected.includes(a.id)}
              onChange={() => toggleSelect(a.id)}
              style={{ accentColor: '#0064ff' }}
            />
            {a.name}
          </label>
        ))}
      </div>
      {compared.length >= 2 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', ...S.mono, fontSize: '11px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                {['METRIC', ...compared.map(a => a.name.toUpperCase())].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: 'CTL',
                  vals: athleteStats.map(a => ({ val: a.ctl, color: '#0064ff', warn: false })),
                },
                {
                  label: 'ATL',
                  vals: athleteStats.map(a => ({ val: a.atl, color: '#e03030', warn: false })),
                },
                {
                  label: 'TSB',
                  vals: athleteStats.map(a => {
                    const c = a.tsb > 5 ? '#5bc25b' : a.tsb < -10 ? '#e03030' : '#f5c542'
                    return { val: (a.tsb >= 0 ? '+' : '') + a.tsb, color: c, warn: false }
                  }),
                },
                {
                  label: 'ACWR',
                  vals: athleteStats.map(a => ({
                    val: a.acwr !== null ? a.acwr.toFixed(2) : '—',
                    color: a.acwrColor,
                    warn: a.acwr !== null && a.acwr === maxAcwr && a.acwr > 1.3,
                  })),
                },
                {
                  label: 'READINESS',
                  vals: athleteStats.map(a => ({
                    val: a.readiness !== null ? a.readiness : '—',
                    color: getReadinessColor(a.readiness),
                    warn: a.readiness !== null && a.readiness === minReadiness && a.readiness < 50,
                  })),
                },
              ].map(row => (
                <tr key={row.label} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px', color: 'var(--muted)', fontWeight: 600 }}>{row.label}</td>
                  {row.vals.map((cell, ci) => (
                    <td key={ci} style={{ padding: '6px 8px', color: cell.color, fontWeight: 600 }}>
                      {cell.val}{cell.warn ? ' ⚠' : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {compared.length < 2 && (
        <div style={{ ...S.mono, fontSize: '12px', color: 'var(--muted)' }}>
          Select 2–4 athletes to compare.
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachDashboard() {
  const [roster, setRoster] = useLocalStorage('sporeus-coach-athletes', [])
  const [expanded, setExpanded] = useState(null)
  const [showMyAthletes, setShowMyAthletes] = useState(false)
  const [copyToast, setCopyToast] = useState(false)
  const fileRef = useRef(null)

  const inviteUrl = `${window.location.origin}${window.location.pathname}?coach=${MY_COACH_ID}`

  function handleCopyInvite() {
    navigator.clipboard.writeText(inviteUrl).catch(() => {})
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 2000)
  }

  // Summary stats
  const connected   = roster.filter(a => a.coachId === MY_COACH_ID).length
  const needsAttn   = roster.filter(a => computeAthleteMetrics(a).needsAttention).length
  const injuredCnt  = roster.filter(a => {
    const d14 = daysBefore(14)
    return (a.injuryLog || []).some(e => e.date >= d14)
  }).length

  const filteredRoster = showMyAthletes
    ? roster.filter(a => a.coachId === MY_COACH_ID)
    : roster

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large (max 10MB). Make sure this is a valid Sporeus export.')
      e.target.value = ''; return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target.result
        if (text.length > 10e6) throw new Error('oversized')
        const raw = JSON.parse(text)
        if (typeof raw !== 'object' || Array.isArray(raw) || raw === null) throw new Error('invalid shape')
        const data = raw._export ? (raw.data || {}) : raw
        const sanitizeStr = v => typeof v === 'string' ? v.slice(0, 200) : ''
        const sanitizeNum = v => typeof v === 'number' && isFinite(v) ? v : 0
        const rawProfile = (data['sporeus-profile']?.data) || data.profile || {}
        const profile = {
          name:      sanitizeStr(rawProfile.name),
          sport:     sanitizeStr(rawProfile.sport || rawProfile.primarySport),
          age:       sanitizeStr(rawProfile.age),
          weight:    sanitizeStr(rawProfile.weight),
          ftp:       sanitizeStr(rawProfile.ftp),
          vo2max:    sanitizeStr(rawProfile.vo2max),
          threshold: sanitizeStr(rawProfile.threshold),
          goal:      sanitizeStr(rawProfile.goal),
        }
        const coachId = sanitizeStr(raw.coachId || data.coachId || '')
        const toLogArray = v => Array.isArray(v) ? v.slice(0, 5000).map(e => ({
          id: sanitizeNum(e.id), date: sanitizeStr(e.date), type: sanitizeStr(e.type),
          duration: sanitizeNum(e.duration), rpe: sanitizeNum(e.rpe), tss: sanitizeNum(e.tss),
          notes: sanitizeStr(e.notes),
        })) : []
        const toRecovery = v => Array.isArray(v) ? v.slice(0, 2000).map(e => ({
          date: sanitizeStr(e.date), score: sanitizeNum(e.score),
          sleep: sanitizeNum(e.sleep), sleepHrs: sanitizeStr(e.sleepHrs),
        })) : []
        const log       = toLogArray(data['sporeus_log']?.data || data.log || data.trainingLog)
        const recovery  = toRecovery(data['sporeus-recovery']?.data || data.recovery || data.recoveryLog)
        const testLog   = Array.isArray(data['sporeus-test-results']?.data || data.testLog) ? (data['sporeus-test-results']?.data || data.testLog || []).slice(0, 500) : []
        const injuryLog = Array.isArray(data['sporeus-injuries']?.data || data.injuryLog) ? (data['sporeus-injuries']?.data || data.injuryLog || []).slice(0, 1000) : []
        const entry = {
          id:         Date.now(),
          name:       profile.name || 'Athlete',
          sport:      profile.sport || '—',
          coachId,
          importedAt: TODAY,
          profile,
          log,
          recovery,
          testLog,
          injuryLog,
          notes: [],
        }
        setRoster(prev => [...prev, entry])
      } catch {
        alert('Could not parse JSON file. Make sure it is a valid Sporeus export.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleRemove(id) {
    if (!window.confirm('Remove this athlete from the roster?')) return
    setRoster(prev => prev.filter(a => a.id !== id))
    if (expanded === id) setExpanded(null)
  }

  function handleUpdateAthlete(updated) {
    setRoster(prev => prev.map(a => a.id === updated.id ? updated : a))
  }

  function toggleExpand(id) {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <div className="sp-fade">
      {/* Coach Mode Banner */}
      <div style={{
        background: '#0064ff11',
        border: '1px solid #0064ff44',
        borderRadius: '6px',
        padding: '10px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '6px',
      }}>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '14px', fontWeight: 700, color: '#0064ff', letterSpacing: '0.1em' }}>
          ◈ COACH MODE · HÜSEYIN IŞIK
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
          File-based | No server | No API keys
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ ...S.row, marginBottom: '16px' }}>
        {[
          { lbl: 'TOTAL ATHLETES', val: roster.length, color: '#e0e0e0' },
          { lbl: 'CONNECTED', val: connected, color: '#0064ff' },
          { lbl: 'NEEDS ATTENTION', val: needsAttn, color: needsAttn > 0 ? '#f5c542' : '#5bc25b' },
          { lbl: 'INJURY FLAGS', val: injuredCnt, color: injuredCnt > 0 ? '#e03030' : '#5bc25b' },
        ].map(({ lbl, val, color }) => (
          <div key={lbl} style={{ flex: '1 1 90px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
            <div style={{ ...S.mono, fontSize: '22px', fontWeight: 700, color }}>{val}</div>
            <div style={{ ...S.mono, fontSize: '8px', color: 'var(--muted)', letterSpacing: '0.08em', marginTop: '4px' }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Invite Link */}
      <div style={{ ...S.card, marginBottom: '16px', animationDelay: '30ms' }}>
        <div style={S.cardTitle}>INVITE ATHLETES</div>
        <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginBottom: '8px' }}>
          Share this link — athletes auto-connect to your roster on first open:
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            style={{ ...S.input, flex: '1 1 200px', color: '#0064ff', fontSize: '11px' }}
            readOnly
            value={inviteUrl}
            onFocus={e => e.target.select()}
          />
          <button style={{ ...S.btnSec, whiteSpace: 'nowrap', borderColor: '#0064ff', color: copyToast ? '#5bc25b' : '#0064ff' }}
            onClick={handleCopyInvite}>
            {copyToast ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#888', marginTop: '6px' }}>
          Athlete receives: ?coach=huseyin-sporeus → auto-connects in their Profile tab
        </div>
      </div>

      {/* Athlete Roster */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={S.cardTitle}>
            ATHLETE ROSTER ({filteredRoster.length}{showMyAthletes ? ' connected' : ` of ${roster.length}`})
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowMyAthletes(false)}
              style={{ ...S.mono, fontSize: '9px', fontWeight: 600, padding: '3px 8px', borderRadius: '3px', cursor: 'pointer', border: `1px solid ${!showMyAthletes ? '#0064ff' : 'var(--border)'}`, background: !showMyAthletes ? '#0064ff22' : 'transparent', color: !showMyAthletes ? '#0064ff' : 'var(--muted)' }}>
              ALL
            </button>
            <button
              onClick={() => setShowMyAthletes(true)}
              style={{ ...S.mono, fontSize: '9px', fontWeight: 600, padding: '3px 8px', borderRadius: '3px', cursor: 'pointer', border: `1px solid ${showMyAthletes ? '#0064ff' : 'var(--border)'}`, background: showMyAthletes ? '#0064ff22' : 'transparent', color: showMyAthletes ? '#0064ff' : 'var(--muted)' }}>
              ◉ CONNECTED
            </button>
            <button style={S.btn} onClick={() => fileRef.current?.click()}>+ Import Athlete</button>
          </div>
        </div>

        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelect} />

        {filteredRoster.length === 0 && (
          <div style={{ ...S.mono, fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>
            {showMyAthletes
              ? 'No connected athletes yet. Share your invite link above.'
              : 'No athletes imported yet. Export athlete data as JSON from the Sporeus app, then import here.'}
          </div>
        )}

        {filteredRoster.map(athlete => {
          const metrics = computeAthleteMetrics(athlete)
          const isOpen  = expanded === athlete.id
          const isConnected = athlete.coachId === MY_COACH_ID
          return (
            <div key={athlete.id} style={{
              border: `1px solid ${metrics.needsAttention ? '#f5c54244' : 'var(--border)'}`,
              borderRadius: '6px',
              marginBottom: '10px',
              overflow: 'hidden',
            }}>
              {/* Athlete Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                background: isOpen ? 'var(--surface)' : 'transparent',
                flexWrap: 'wrap',
              }}>
                {/* Name + sport + connected dot */}
                <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isConnected && (
                      <span title="Connected athlete" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#0064ff', display: 'inline-block', flexShrink: 0 }} />
                    )}
                    <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: '#0064ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {athlete.name}
                    </div>
                    {metrics.needsAttention && (
                      <span style={{ ...S.mono, fontSize: '9px', color: '#f5c542' }}>⚠</span>
                    )}
                  </div>
                  <div style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)' }}>{athlete.sport}</div>
                </div>

                {/* Last session */}
                <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
                  <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em' }}>LAST SESSION</div>
                  <div style={{ ...S.mono, fontSize: '11px' }}>{metrics.lastSession}</div>
                </div>

                {/* 7d TSS */}
                <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
                  <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em' }}>7D TSS</div>
                  <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: '#ff6600' }}>{metrics.tss7}</div>
                </div>

                {/* Readiness */}
                <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
                  <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: '3px' }}>READINESS</div>
                  <ReadinessBadge score={metrics.readiness} />
                </div>

                {/* ACWR */}
                <div style={{ flex: '0 0 auto', textAlign: 'center' }}>
                  <div style={{ ...S.mono, fontSize: '9px', color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: '3px' }}>ACWR</div>
                  <AcwrBadge acwr={metrics.acwr} acwrColor={metrics.acwrColor} />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '6px', flex: '0 0 auto' }}>
                  <button
                    style={{
                      ...S.btnSec,
                      fontSize: '11px',
                      padding: '5px 10px',
                      background: isOpen ? '#0064ff' : 'transparent',
                      color: isOpen ? '#fff' : '#0064ff',
                      borderColor: '#0064ff',
                    }}
                    onClick={() => toggleExpand(athlete.id)}
                  >
                    {isOpen ? '▲ Close' : '▼ View'}
                  </button>
                  <button
                    style={{ ...S.btnSec, fontSize: '11px', padding: '5px 10px', color: '#e03030', borderColor: '#e03030' }}
                    onClick={() => handleRemove(athlete.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ padding: '0 14px 14px 14px', background: 'var(--card-bg)' }}>
                  <AthleteDetail
                    athlete={athlete}
                    onUpdate={handleUpdateAthlete}
                    onClose={() => setExpanded(null)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Multi-Athlete Comparison */}
      {roster.length >= 2 && (
        <AthleteComparison roster={roster} />
      )}
    </div>
  )
}
