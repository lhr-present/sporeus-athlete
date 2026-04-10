import { useRef, useState, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

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
  const today = TODAY
  const d7 = daysBefore(7)
  const d28 = daysBefore(28)

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

  // ACWR: acute (7d) / chronic avg weekly (28d)
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

  return { lastSession, tss7, sessions7, readiness, acwr, acwrColor }
}

function getReadinessColor(score) {
  if (score === null || score === undefined) return '#888'
  if (score >= 75) return '#5bc25b'
  if (score >= 50) return '#f5c542'
  return '#e03030'
}

// ─── Plan Generator (inline) ──────────────────────────────────────────────────

function generateCoachPlan({ goal, weeks, hoursPerWeek, level, athleteName }) {
  const w = parseInt(weeks) || 8
  const h = parseInt(hoursPerWeek) || 8
  return {
    generated: TODAY,
    goal,
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
      sessions: [
        { day: 'Monday',    type: 'Easy Run',   duration: Math.round(h * 60 * 0.20), rpe: 4 },
        { day: 'Wednesday', type: 'Threshold',  duration: Math.round(h * 60 * 0.20), rpe: 7 },
        { day: 'Friday',    type: 'Easy Run',   duration: Math.round(h * 60 * 0.15), rpe: 4 },
        { day: 'Saturday',  type: 'Long Run',   duration: Math.round(h * 60 * 0.35), rpe: 6 },
        { day: 'Sunday',    type: 'Rest',       duration: 0,                          rpe: 0 },
      ],
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

  // Last 5 sessions
  const last5 = [...log].sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 5)

  // Recovery trend: last 7 readiness scores
  const recTrend = [...recovery]
    .sort((a, b) => (a.date > b.date ? -1 : 1))
    .slice(0, 7)
    .map(r => r.score || '?')
    .join(', ')

  // Injury flags: injuryLog field in imported data
  const injuryLog = athlete.injuryLog || []
  const d14 = daysBefore(14)
  const recentInjuryZones = [...new Set(
    injuryLog.filter(e => e.date >= d14).map(e => e.zone).filter(Boolean)
  )]

  // 4-week compliance: expected 4 sessions/week
  const complianceWeeks = []
  for (let w = 0; w < 4; w++) {
    const wStart = daysBefore(28 - w * 7)
    const wEnd = daysBefore(21 - w * 7)
    const actual = log.filter(e => e.date >= wStart && e.date < wEnd).length
    const pct = Math.min(100, Math.round((actual / 4) * 100))
    complianceWeeks.push({ week: 4 - w, actual, expected: 4, pct })
  }

  // Plan state
  const [planGoal, setPlanGoal] = useState('5K')
  const [planWeeks, setPlanWeeks] = useState('8')
  const [planHours, setPlanHours] = useState('8')
  const [planLevel, setPlanLevel] = useState('Intermediate')

  // Notes state
  const [noteText, setNoteText] = useState('')

  function handleGeneratePlan() {
    const plan = generateCoachPlan({
      goal: planGoal,
      weeks: planWeeks,
      hoursPerWeek: planHours,
      level: planLevel,
      athleteName: athlete.name,
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
    const updated = { ...athlete, notes: [newNote, ...(athlete.notes || [])] }
    onUpdate(updated)
    setNoteText('')
  }

  function handleDeleteNote(idx) {
    const notes = [...(athlete.notes || [])]
    notes.splice(idx, 1)
    onUpdate({ ...athlete, notes })
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

  return (
    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
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
        <div style={S.cardTitle}>CREATE PLAN EXPORT FOR {athlete.name.toUpperCase()}</div>
        <div style={{ ...S.row, marginBottom: '10px' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label style={S.label}>GOAL</label>
            <select style={S.select} value={planGoal} onChange={e => setPlanGoal(e.target.value)}>
              {['5K', '10K', 'Half Marathon', 'Full Marathon', 'General Fitness'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: '1 1 80px' }}>
            <label style={S.label}>WEEKS (4–20)</label>
            <input
              type="number" min="4" max="20" style={S.input} value={planWeeks}
              onChange={e => setPlanWeeks(e.target.value)}
            />
          </div>
          <div style={{ flex: '1 1 80px' }}>
            <label style={S.label}>HRS/WEEK (4–20)</label>
            <input
              type="number" min="4" max="20" style={S.input} value={planHours}
              onChange={e => setPlanHours(e.target.value)}
            />
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={S.label}>LEVEL</label>
            <select style={S.select} value={planLevel} onChange={e => setPlanLevel(e.target.value)}>
              {['Beginner', 'Intermediate', 'Advanced'].map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
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
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
            <div>
              <span style={{ ...S.mono, fontSize: '10px', color: 'var(--muted)', marginRight: '8px' }}>{note.date}</span>
              <span style={{ ...S.mono, fontSize: '12px' }}>{note.text}</span>
            </div>
            <button
              onClick={() => handleDeleteNote(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e03030', ...S.mono, fontSize: '13px', padding: '0 4px', lineHeight: 1 }}
              title="Delete note"
            >
              ×
            </button>
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
  const fileRef = useRef(null)

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    // Reject files over 10MB before reading
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
        // Reject prototype-polluting or non-object payloads
        if (typeof raw !== 'object' || Array.isArray(raw) || raw === null) throw new Error('invalid shape')
        // Extract from versioned export wrapper if present
        const data = raw._export ? (raw.data || {}) : raw
        // Whitelist-extract and cap array lengths to prevent memory exhaustion
        const sanitizeStr = v => typeof v === 'string' ? v.slice(0, 200) : ''
        const sanitizeNum = v => typeof v === 'number' && isFinite(v) ? v : 0
        const rawProfile = (data['sporeus-profile']?.data) || data.profile || {}
        const profile = {
          name:      sanitizeStr(rawProfile.name),
          sport:     sanitizeStr(rawProfile.sport),
          age:       sanitizeStr(rawProfile.age),
          weight:    sanitizeStr(rawProfile.weight),
          ftp:       sanitizeStr(rawProfile.ftp),
          vo2max:    sanitizeStr(rawProfile.vo2max),
          threshold: sanitizeStr(rawProfile.threshold),
          goal:      sanitizeStr(rawProfile.goal),
        }
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
          ◈ COACH MODE
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
          File-based | No server | No API keys
        </div>
      </div>

      {/* Athlete Roster */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={S.cardTitle}>ATHLETE ROSTER ({roster.length})</div>
          <button style={S.btn} onClick={() => fileRef.current?.click()}>
            + Import Athlete
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {roster.length === 0 && (
          <div style={{ ...S.mono, fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>
            No athletes imported yet. Export athlete data as JSON from the Sporeus app, then import here.
          </div>
        )}

        {roster.map(athlete => {
          const metrics = computeAthleteMetrics(athlete)
          const isOpen  = expanded === athlete.id
          return (
            <div key={athlete.id} style={{
              border: '1px solid var(--border)',
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
                {/* Name + sport */}
                <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                  <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: '#0064ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {athlete.name}
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
                    ✕ Remove
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
