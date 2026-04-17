import { useState, useMemo, useCallback, useEffect, useContext } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { S } from '../styles.js'
import { useData } from '../contexts/DataContext.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import {
  simulateBanister, monteCarloOptimizer, peakFormWindow,
  addAdaptivePlanAdjustment,
} from '../lib/sport/simulation.js'
import {
  deriveCtlAtl, findRecentResult, sessionFrequencyPerWeek, extractProfileSport, fmtTimeInput, parseTimeInput,
} from '../lib/sport/athleteDataBridge.js'
import { weeklyTemplatePlan, instantiateTemplate } from '../lib/sport/rowingTemplates.js'
import { weeklyRunPlan, instantiateRunningTemplate } from '../lib/sport/runningTemplates.js'
import { vdotFromRace } from '../lib/sport/running.js'
import { secToSplit } from '../lib/sport/rowing.js'

const FONT_MONO = { fontFamily: 'IBM Plex Mono, monospace' }
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'
const DIM    = { color: 'var(--muted)', fontSize: '11px', ...FONT_MONO }

const SPORTS = [
  { id: 'rowing',    lk: 'spb_sport_rowing',    icon: '🚣' },
  { id: 'running',   lk: 'spb_sport_running',   icon: '🏃' },
  { id: 'cycling',   lk: 'spb_sport_cycling',   icon: '🚴' },
  { id: 'swimming',  lk: 'spb_sport_swimming',  icon: '🏊' },
  { id: 'triathlon', lk: 'spb_sport_triathlon', icon: '🏅' },
]

const GOALS = [
  { id: 'base',     lk: 'spb_goal_base' },
  { id: 'race',     lk: 'spb_goal_race' },
  { id: 'peak',     lk: 'spb_goal_peak' },
  { id: 'maintain', lk: 'spb_goal_maintain' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function exportCSV(bestPlan, actualTSS, raceDate) {
  const header = 'Week,Planned TSS,Actual TSS,Variance'
  const rows = bestPlan.map((tss, i) => {
    const actual   = actualTSS[i] != null ? actualTSS[i] : ''
    const variance = actual !== '' ? actual - tss : ''
    return `${i + 1},${tss},${actual},${variance}`
  })
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `sporeus-plan-${raceDate || 'export'}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ── Step indicators ───────────────────────────────────────────────────────────
function StepBar({ step, total = 5 }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: '4px', borderRadius: '2px',
          background: i <= step ? ORANGE : 'var(--border)', transition: 'background 0.3s',
        }} />
      ))}
    </div>
  )
}

// ── Week detail modal ─────────────────────────────────────────────────────────
function WeekModal({ weekIdx, trace, sport, form, split2k, vdot, onClose }) {
  const { t } = useContext(LangCtx)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const days = trace ? trace.slice(weekIdx * 7, weekIdx * 7 + 7) : []

  // Determine phase for template lookup
  const totalWeeks = form?.weeks || 8
  const pct = weekIdx / totalWeeks
  const phase = pct < 0.25 ? 'base' : pct < 0.55 ? 'build' : pct < 0.80 ? 'peak' : 'taper'

  // Get session descriptions
  let sessions = []
  if (sport === 'rowing' && split2k) {
    const templateIds = weeklyTemplatePlan(phase)
    sessions = templateIds.map(id => {
      const inst = instantiateTemplate(id, split2k)
      return inst ? { name: inst.name, detail: inst.split2000Fmt + ' race split' } : { name: id, detail: '' }
    })
  } else if (sport === 'running' && vdot) {
    const templateIds = weeklyRunPlan(phase)
    sessions = templateIds.map(id => {
      const inst = instantiateRunningTemplate(id, vdot)
      return inst ? { name: inst.name, detail: inst.targetPaceFmt + '/km' } : { name: id, detail: '' }
    })
  }

  const printId = `week-modal-print-${weekIdx}`

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000a', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px',
    }} onClick={onClose}>
      <div id={printId} style={{
        ...S.card, maxWidth: '520px', width: '100%', background: 'var(--card-bg)',
        border: `1px solid ${ORANGE}`, padding: '20px', maxHeight: '80vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ ...FONT_MONO, fontWeight: 600, color: ORANGE }}>WEEK {weekIdx + 1} · {phase.toUpperCase()}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...S.btnSec, fontSize: '10px', padding: '3px 8px' }}
              onClick={() => window.print()}>{t('spb_modalPrint')}</button>
            <button style={{ ...S.ghostBtn, color: ORANGE, fontSize: '16px' }} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {sessions.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ ...DIM, marginBottom: '6px' }}>{t('spb_modalSessions')}</div>
            {sessions.map((s, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '4px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ ...FONT_MONO, fontSize: '12px' }}>{s.name}</span>
                <span style={{ ...DIM }}>{s.detail}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...DIM, marginBottom: '6px' }}>{t('spb_modalTrace')}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ ...DIM, textAlign: 'left' }}>
              <th style={{ paddingBottom: '6px' }}>{t('spb_modalDay')}</th>
              <th>TSS</th>
              <th>CTL</th>
              <th>ATL</th>
              <th>TSB</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...FONT_MONO, fontSize: '11px', padding: '4px 0', color: 'var(--muted)' }}>{dayNames[i]}</td>
                <td style={{ ...FONT_MONO, fontSize: '11px' }}>{d.tss.toFixed(1)}</td>
                <td style={{ ...FONT_MONO, fontSize: '11px', color: BLUE }}>{d.CTL}</td>
                <td style={{ ...FONT_MONO, fontSize: '11px', color: ORANGE }}>{d.ATL}</td>
                <td style={{ ...FONT_MONO, fontSize: '11px', color: d.TSB >= 0 ? '#00c853' : '#ff4444' }}>
                  {d.TSB > 0 ? '+' : ''}{d.TSB}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Step 1: Sport + Goal ──────────────────────────────────────────────────────
function Step1({ form, setForm, onNext }) {
  const { t } = useContext(LangCtx)
  return (
    <div>
      <div style={S.cardTitle}>{t('spb_step1Title')}</div>
      <div style={{ marginBottom: '16px' }}>
        <div style={DIM}>{t('spb_selectSport')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {SPORTS.map(s => (
            <button key={s.id} onClick={() => setForm(f => ({ ...f, sport: s.id }))}
              style={{
                ...S.btnSec, padding: '8px 14px',
                background: form.sport === s.id ? ORANGE : 'transparent',
                color: form.sport === s.id ? '#fff' : ORANGE,
              }}>
              {s.icon} {t(s.lk)}
            </button>
          ))}
        </div>
        {form._sportFromProfile && (
          <div style={{ ...DIM, marginTop: '6px', color: '#00c853' }}>{t('spb_preFilledProfile')}</div>
        )}
      </div>
      <div style={{ marginBottom: '16px' }}>
        <div style={DIM}>{t('spb_primaryGoal')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {GOALS.map(g => (
            <button key={g.id} onClick={() => setForm(f => ({ ...f, goal: g.id }))}
              style={{
                ...S.btnSec, padding: '8px 14px',
                background: form.goal === g.id ? ORANGE : 'transparent',
                color: form.goal === g.id ? '#fff' : ORANGE,
              }}>
              {t(g.lk)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={S.label}>{t('spb_raceDate')}</label>
        <input type="date" style={{ ...S.input, width: '200px' }} value={form.raceDate || ''}
          onChange={e => setForm(f => ({ ...f, raceDate: e.target.value }))} />
        {form.raceDate && daysUntil(form.raceDate) != null && (
          <div style={{ ...DIM, marginTop: '6px', color: ORANGE }}>
            {daysUntil(form.raceDate)} {t('spb_daysToRace')}
          </div>
        )}
      </div>
      <button style={S.btn} disabled={!form.sport || !form.goal} onClick={onNext}>{t('spb_btnNext')}</button>
    </div>
  )
}

// ── Step 2: Performance baseline ──────────────────────────────────────────────
function Step2({ form, setForm, onNext, onBack }) {
  const { t } = useContext(LangCtx)
  const sport = form.sport
  return (
    <div>
      <div style={S.cardTitle}>{t('spb_step2Title')}</div>
      {sport === 'rowing' && (
        <div style={S.row}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={S.label}>2000m Time (mm:ss)</label>
            <input style={S.input} placeholder="6:30" value={form.baseline?.time2k || ''}
              onChange={e => setForm(f => ({ ...f, baseline: { ...f.baseline, time2k: e.target.value } }))} />
            {form.baseline?._time2kFromLog && (
              <div style={{ ...DIM, marginTop: '4px', color: '#00c853' }}>{t('spb_fromTestLog')}</div>
            )}
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={S.label}>Body Weight (kg)</label>
            <input style={S.input} type="number" placeholder="75" value={form.baseline?.weight || ''}
              onChange={e => setForm(f => ({ ...f, baseline: { ...f.baseline, weight: e.target.value } }))} />
          </div>
        </div>
      )}
      {sport === 'running' && (
        <div style={S.row}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={S.label}>Recent Race Distance</label>
            <select style={S.select} value={form.baseline?.raceDist || '5000'}
              onChange={e => setForm(f => ({ ...f, baseline: { ...f.baseline, raceDist: e.target.value } }))}>
              <option value="1500">1500m</option>
              <option value="5000">5K</option>
              <option value="10000">10K</option>
              <option value="21097">Half Marathon</option>
              <option value="42195">Marathon</option>
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={S.label}>Race Time (mm:ss)</label>
            <input style={S.input} placeholder="20:00" value={form.baseline?.raceTime || ''}
              onChange={e => setForm(f => ({ ...f, baseline: { ...f.baseline, raceTime: e.target.value } }))} />
            {form.baseline?._raceFromLog && (
              <div style={{ ...DIM, marginTop: '4px', color: '#00c853' }}>{t('spb_fromLog')}</div>
            )}
          </div>
        </div>
      )}
      {sport === 'cycling' && (
        <div style={S.row}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={S.label}>FTP (watts)</label>
            <input style={S.input} type="number" placeholder="250" value={form.baseline?.ftp || ''}
              onChange={e => setForm(f => ({ ...f, baseline: { ...f.baseline, ftp: e.target.value } }))} />
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={S.label}>Body Weight (kg)</label>
            <input style={S.input} type="number" placeholder="70" value={form.baseline?.weight || ''}
              onChange={e => setForm(f => ({ ...f, baseline: { ...f.baseline, weight: e.target.value } }))} />
          </div>
        </div>
      )}
      {sport === 'swimming' && (
        <div style={S.row}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={S.label}>400m TT Time (mm:ss)</label>
            <input style={S.input} placeholder="5:30" value={form.baseline?.tt400 || ''}
              onChange={e => setForm(f => ({ ...f, baseline: { ...f.baseline, tt400: e.target.value } }))} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={S.label}>200m TT Time (mm:ss)</label>
            <input style={S.input} placeholder="2:30" value={form.baseline?.tt200 || ''}
              onChange={e => setForm(f => ({ ...f, baseline: { ...f.baseline, tt200: e.target.value } }))} />
          </div>
        </div>
      )}
      {sport === 'triathlon' && (
        <div style={S.row}>
          <div style={{ flex: '1 1 140px' }}>
            <label style={S.label}>FTP (watts)</label>
            <input style={S.input} type="number" placeholder="230" value={form.baseline?.ftp || ''}
              onChange={e => setForm(f => ({ ...f, baseline: { ...f.baseline, ftp: e.target.value } }))} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={S.label}>Run HR Threshold</label>
            <input style={S.input} type="number" placeholder="165" value={form.baseline?.hrThresh || ''}
              onChange={e => setForm(f => ({ ...f, baseline: { ...f.baseline, hrThresh: e.target.value } }))} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={S.label}>CSS pace (sec/100m)</label>
            <input style={S.input} type="number" placeholder="85" value={form.baseline?.css || ''}
              onChange={e => setForm(f => ({ ...f, baseline: { ...f.baseline, css: e.target.value } }))} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        <button style={S.btnSec} onClick={onBack}>{t('spb_btnBack')}</button>
        <button style={S.btn} onClick={onNext}>{t('spb_btnNext')}</button>
      </div>
    </div>
  )
}

// ── Step 3: Constraints ────────────────────────────────────────────────────────
function Step3({ form, setForm, onNext, onBack }) {
  const { t } = useContext(LangCtx)
  return (
    <div>
      <div style={S.cardTitle}>{t('spb_step3Title')}</div>
      <div style={S.row}>
        <div style={{ flex: '1 1 140px' }}>
          <label style={S.label}>{t('spb_planDuration')}</label>
          <select style={S.select} value={form.weeks || 8}
            onChange={e => setForm(f => ({ ...f, weeks: +e.target.value }))}>
            {[4, 6, 8, 10, 12, 16, 20, 24].map(w => (
              <option key={w} value={w}>{w} weeks</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={S.label}>{t('spb_currentTSSLabel')}</label>
          <input style={S.input} type="number" placeholder="250" value={form.currentTSS || ''}
            onChange={e => setForm(f => ({ ...f, currentTSS: +e.target.value }))} />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={S.label}>{t('spb_peakTSSLabel')}</label>
          <input style={S.input} type="number" placeholder="500" value={form.peakTSS || ''}
            onChange={e => setForm(f => ({ ...f, peakTSS: +e.target.value }))} />
        </div>
      </div>
      <div style={S.row}>
        <div style={{ flex: '1 1 180px' }}>
          <label style={S.label}>{t('spb_currentCTL')}</label>
          <input style={S.input} type="number" placeholder="45"
            value={form.startCTL !== undefined ? form.startCTL : ''}
            onChange={e => setForm(f => ({ ...f, startCTL: +e.target.value }))} />
          {form._ctlFromLog && <div style={{ ...DIM, marginTop: '4px', color: '#00c853' }}>{t('spb_fromTrainingData')}</div>}
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label style={S.label}>{t('spb_currentATL')}</label>
          <input style={S.input} type="number" placeholder="55"
            value={form.startATL !== undefined ? form.startATL : ''}
            onChange={e => setForm(f => ({ ...f, startATL: +e.target.value }))} />
          {form._ctlFromLog && <div style={{ ...DIM, marginTop: '4px', color: '#00c853' }}>{t('spb_fromTrainingData')}</div>}
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={S.label}>{t('spb_sessionsPerWeek')}</label>
          <input style={S.input} type="number" placeholder="5" value={form.sessionsPerWeek || ''}
            onChange={e => setForm(f => ({ ...f, sessionsPerWeek: +e.target.value }))} />
          {form._sessionsFromLog && <div style={{ ...DIM, marginTop: '4px', color: '#00c853' }}>{t('spb_fromLastWeeks')}</div>}
        </div>
      </div>
      <div style={{ ...DIM, marginTop: '8px' }}>{t('spb_recoveryAuto')}</div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        <button style={S.btnSec} onClick={onBack}>{t('spb_btnBack')}</button>
        <button style={S.btn}
          disabled={!(form.currentTSS > 0 && form.peakTSS > 0 && form.peakTSS > form.currentTSS)}
          onClick={onNext}>
          {t('spb_generatePlan')}
        </button>
      </div>
    </div>
  )
}

// ── Step 4: Plan generation ────────────────────────────────────────────────────
function Step4({ form, onResult, onBack }) {
  const { t } = useContext(LangCtx)
  const [running, setRunning] = useState(false)
  const generate = () => {
    setRunning(true)
    setTimeout(() => {
      const weeks = form.weeks || 8
      const recoveryWeeks = Array.from({ length: Math.floor(weeks / 4) }, (_, i) => (i + 1) * 4 - 1)
      const result = monteCarloOptimizer({
        weeks, minWeeklyTSS: form.currentTSS || 200, maxWeeklyTSS: form.peakTSS || 500,
        recoveryWeeks, startCTL: form.startCTL || 0, startATL: form.startATL || 0,
      }, 500)
      setRunning(false)
      onResult(result)
    }, 50)
  }
  return (
    <div>
      <div style={S.cardTitle}>{t('spb_step4Title')}</div>
      <div style={{ ...S.card, background: 'var(--surface)' }}>
        <div style={{ ...FONT_MONO, fontSize: '12px', lineHeight: '1.8', color: 'var(--text)' }}>
          <div>▸ Sport: <strong>{SPORTS.find(s => s.id === form.sport) ? t(SPORTS.find(s => s.id === form.sport).lk) : '—'}</strong></div>
          <div>▸ Goal: <strong>{GOALS.find(g => g.id === form.goal) ? t(GOALS.find(g => g.id === form.goal).lk) : '—'}</strong></div>
          <div>▸ Duration: <strong>{form.weeks || 8} weeks</strong></div>
          <div>▸ TSS range: <strong>{form.currentTSS || '?'} → {form.peakTSS || '?'} / week</strong></div>
          <div>▸ Start CTL/ATL: <strong>{form.startCTL || 0} / {form.startATL || 0}</strong></div>
          {form.raceDate && <div>▸ Race date: <strong>{form.raceDate}</strong> ({daysUntil(form.raceDate)} days)</div>}
        </div>
      </div>
      <div style={{ ...DIM, marginBottom: '16px' }}>{t('spb_monteCarloSub')}</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button style={S.btnSec} onClick={onBack} disabled={running}>{t('spb_btnBack')}</button>
        <button style={{ ...S.btn, opacity: running ? 0.6 : 1 }} onClick={generate} disabled={running}>
          {running ? t('spb_simulating') : t('spb_runOptimizer')}
        </button>
      </div>
    </div>
  )
}

// ── Step 5: Plan display ───────────────────────────────────────────────────────
function Step5({ form, result, onRestart, log: _log, setLog }) {
  const { t } = useContext(LangCtx)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [actualTSS, setActualTSS]       = useState({})
  const [saved, setSaved]               = useState(false)
  const [showCompare, setShowCompare]   = useState(false)
  const [missedWeek, setMissedWeek]     = useState(null)
  const [missedWeekInput, setMissedWeekInput] = useState('')
  const [adaptedPlan, setAdaptedPlan]   = useState(null)
  const [complianceRun, setComplianceRun] = useState(0)

  // Consecutive compliant weeks: consecutive weeks within 10% of planned TSS
  useEffect(() => {
    if (!result?.bestPlan) return
    const basePlan = adaptedPlan ? adaptedPlan.map(w => (typeof w === 'object' ? w.tss ?? 0 : w)) : result.bestPlan
    const filledIdxs = Object.keys(actualTSS).filter(k => actualTSS[k] != null).map(Number).sort((a, b) => a - b)
    let run = 0
    for (let j = filledIdxs.length - 1; j >= 0; j--) {
      const i = filledIdxs[j]
      const p = basePlan[i] ?? 0
      const a = actualTSS[i] ?? 0
      if (p > 0 && Math.abs(a - p) / p <= 0.10) run++
      else break
    }
    setComplianceRun(run)
  }, [actualTSS, adaptedPlan, result])

  const pfWindow = useMemo(() => {
    if (!result?.bestPlan) return null
    return peakFormWindow(result.bestPlan, form.startCTL || 0, form.startATL || 0)
  }, [result, form.startCTL, form.startATL])

  // Derive baseline values for template lookups
  const split2k = useMemo(() => {
    if (form.sport !== 'rowing' || !form.baseline?.time2k) return null
    const sec = parseTimeInput(form.baseline.time2k)
    return sec ? secToSplit(sec, 2000) : null
  }, [form.sport, form.baseline?.time2k])

  const vdot = useMemo(() => {
    if (form.sport !== 'running' || !form.baseline?.raceTime || !form.baseline?.raceDist) return null
    const sec  = parseTimeInput(form.baseline.raceTime)
    const dist = parseFloat(form.baseline.raceDist)
    return sec && dist ? vdotFromRace(dist, sec) : null
  }, [form.sport, form.baseline?.raceTime, form.baseline?.raceDist])

  // Save plan to training log
  const savePlanToLog = useCallback(() => {
    const bestPlanInner = result?.bestPlan
    if (!setLog || !bestPlanInner) return
    const today = new Date()
    const newEntries = bestPlanInner.map((tss, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() + i * 7)
      return {
        id:       Date.now() + i,
        date:     d.toISOString().slice(0, 10),
        type:     'Planned',
        tss,
        duration: 0,
        rpe:      0,
        notes:    `Sport plan week ${i + 1} — target TSS ${tss}`,
        source:   'sport-plan',
      }
    })
    setLog(prev => [...(prev || []), ...newEntries])
    setSaved(true)
  }, [result, setLog])

  if (!result) return null
  const { bestPlan, bestScore, meanScore, histogram } = result
  const trace = pfWindow?.trace || []

  // Session labels for weekly table
  function sessionLabels(weekIdx) {
    const totalWeeks = form.weeks || 8
    const pct  = weekIdx / totalWeeks
    const phase = pct < 0.25 ? 'base' : pct < 0.55 ? 'build' : pct < 0.80 ? 'peak' : 'taper'
    if (form.sport === 'rowing' && split2k) {
      return weeklyTemplatePlan(phase).map(id => id.replace(/_/g, ' ').toUpperCase().slice(0, 6)).join(', ')
    }
    if (form.sport === 'running' && vdot) {
      return weeklyRunPlan(phase).map(id => id.split('_')[0].toUpperCase().slice(0, 5)).join(', ')
    }
    return null
  }

  // CTL/ATL sparkline
  const maxVal = Math.max(...trace.map(d => Math.max(d.CTL, d.ATL)), 1)
  const W = 400; const H = 80
  const toX = i => (i / Math.max(trace.length - 1, 1)) * W
  const toY = v => H - (v / maxVal) * H
  const makePath = key => trace.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d[key]).toFixed(1)}`
  ).join(' ')

  const daysLeft = form.raceDate ? daysUntil(form.raceDate) : null

  return (
    <div>
      {selectedWeek !== null && (
        <WeekModal
          weekIdx={selectedWeek}
          trace={trace}
          sport={form.sport}
          form={form}
          split2k={split2k}
          vdot={vdot}
          onClose={() => setSelectedWeek(null)}
        />
      )}

      <div style={S.cardTitle}>{t('spb_step5Title')}</div>

      {daysLeft != null && (
        <div style={{
          ...S.card, background: '#ff660011', border: `1px solid ${ORANGE}44`,
          display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px',
        }}>
          <span style={{ ...FONT_MONO, fontSize: '28px', fontWeight: 700, color: ORANGE }}>{daysLeft}</span>
          <div>
            <div style={{ ...FONT_MONO, fontSize: '11px', color: 'var(--muted)' }}>{t('spb_daysToRaceLabel')}</div>
            <div style={{ ...FONT_MONO, fontSize: '12px' }}>{form.raceDate}</div>
          </div>
        </div>
      )}

      <div style={{ ...S.row, marginBottom: '16px' }}>
        <div style={S.stat}><span style={S.statVal}>{bestScore}</span><span style={S.statLbl}>{t('spb_planScore')}</span></div>
        <div style={S.stat}><span style={S.statVal}>{meanScore}</span><span style={S.statLbl}>{t('spb_avgScore')}</span></div>
        <div style={S.stat}><span style={{ ...S.statVal, fontSize: '16px' }}>Day {pfWindow?.peakDay ?? '?'}</span><span style={S.statLbl}>{t('spb_peakForm')}</span></div>
        <div style={S.stat}>
          <span style={{ ...S.statVal, fontSize: '16px' }}>
            {pfWindow?.peakTSB != null ? (pfWindow.peakTSB > 0 ? '+' : '') + pfWindow.peakTSB : '?'}
          </span>
          <span style={S.statLbl}>{t('spb_peakTSBLabel')}</span>
        </div>
      </div>

      {histogram && (
        <div style={{ ...S.card }}>
          <div style={S.cardTitle}>{t('spb_scoreDistTitle')}</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={histogram} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="range" tick={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9 }} />
              <YAxis tick={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9 }} />
              <Tooltip contentStyle={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, background: '#111', border: `1px solid ${ORANGE}` }}
                formatter={v => [v, 'Plans']} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {histogram.map((entry, i) => (
                  <Cell key={i} fill={entry.count === Math.max(...histogram.map(h => h.count)) ? ORANGE : '#0064ff44'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={S.cardTitle}>{t('spb_weeklyPlanTitle')}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...S.btnSec, fontSize: '10px', padding: '4px 10px' }}
              onClick={() => exportCSV(adaptedPlan ? adaptedPlan.map(w => w.tss ?? w) : bestPlan, actualTSS, form.raceDate)}>{t('spb_exportCSV')}</button>
            <button style={{
              ...S.btnSec, fontSize: '10px', padding: '4px 10px',
              background: saved ? '#00c85333' : 'transparent',
              color: saved ? '#00c853' : ORANGE,
            }} onClick={savePlanToLog} disabled={saved}>
              {saved ? t('spb_saved') : t('spb_saveToLog')}
            </button>
          </div>
        </div>

        {complianceRun >= 2 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: '#00c85318', border: '1px solid #00c85355',
            borderRadius: '4px', padding: '4px 10px', marginBottom: '10px',
            ...FONT_MONO, fontSize: '10px', color: '#00c853',
          }}>
            ◈ {complianceRun} {t('spb_consecutiveWeeks')}
          </div>
        )}

        {/* Adapt plan button */}
        {Object.keys(actualTSS).filter(k => actualTSS[k] != null).length >= 2 && (
          <div style={{ marginBottom: '10px' }}>
            <button
              style={{ ...S.btnSec, fontSize: '10px', padding: '4px 10px' }}
              onClick={() => {
                const filledIdxs = Object.keys(actualTSS).filter(k => actualTSS[k] != null).map(Number).sort((a, b) => a - b)
                const currentWeekIdx = filledIdxs.length > 0 ? filledIdxs[filledIdxs.length - 1] + 1 : 0
                const actualArray = bestPlan.map((_, i) => actualTSS[i] != null ? actualTSS[i] : 0)
                setAdaptedPlan(addAdaptivePlanAdjustment(bestPlan, actualArray, currentWeekIdx))
              }}
            >
              {t('spb_adaptPlan')}
            </button>
            {adaptedPlan && (
              <button
                style={{ ...S.ghostBtn, fontSize: '10px', color: 'var(--muted)', marginLeft: '8px' }}
                onClick={() => setAdaptedPlan(null)}
              >
                {t('spb_resetPlan')}
              </button>
            )}
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', ...FONT_MONO, fontSize: '11px' }}>
            <thead>
              <tr style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '4px 8px', textAlign: 'left' }}>{t('spb_colWk')}</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>{t('spb_colPlanned')}</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>{t('spb_colActual')}</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>{t('spb_colVariance')}</th>
                <th style={{ padding: '4px 8px', textAlign: 'left' }}>{t('spb_colSessions')}</th>
                <th style={{ padding: '4px 8px', textAlign: 'center' }}>{t('spb_colDetail')}</th>
              </tr>
            </thead>
            <tbody>
              {bestPlan.map((origTss, i) => {
                const adaptedWeek  = adaptedPlan ? adaptedPlan[i] : null
                const tss          = adaptedWeek ? (adaptedWeek.tss ?? origTss) : origTss
                const isAdjusted   = adaptedWeek?._adjusted === true
                const adjustReason = adaptedWeek?._reason || null
                const isUpward     = isAdjusted && tss > origTss
                const actual       = actualTSS[i] != null ? actualTSS[i] : null
                const variance     = actual != null ? actual - tss : null
                const isRec        = tss < (form.currentTSS || 200) * 1.1
                const labels       = sessionLabels(i)
                const rowBg        = isAdjusted
                  ? (isUpward ? '#001a33' : '#330000')
                  : 'transparent'
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: rowBg }}>
                    <td style={{ padding: '4px 8px' }}>
                      <span style={{ color: isRec ? BLUE : ORANGE }}>{i + 1}</span>
                      {isRec && <span style={{ color: BLUE, marginLeft: '4px', fontSize: '9px' }}>REC</span>}
                      {isAdjusted && <span style={{ color: isUpward ? '#00c853' : '#ff4444', marginLeft: '4px', fontSize: '9px' }}>{isUpward ? '▲' : '▼'}</span>}
                    </td>
                    <td
                      style={{ padding: '4px 8px', textAlign: 'right', color: isRec ? BLUE : 'var(--text)' }}
                      title={adjustReason || undefined}
                    >
                      {tss}
                      {isAdjusted && origTss !== tss && (
                        <span style={{ color: 'var(--muted)', fontSize: '9px', marginLeft: '4px' }}>({origTss})</span>
                      )}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      <input type="number" placeholder="—" value={actualTSS[i] ?? ''}
                        onChange={e => setActualTSS(prev => ({ ...prev, [i]: e.target.value === '' ? null : +e.target.value }))}
                        style={{
                          width: '60px', background: 'var(--input-bg)', border: '1px solid var(--border)',
                          borderRadius: '4px', padding: '2px 4px', color: 'var(--text)', ...FONT_MONO, fontSize: '11px', textAlign: 'right',
                        }} />
                    </td>
                    <td style={{
                      padding: '4px 8px', textAlign: 'right',
                      color: variance == null ? 'var(--muted)' : variance >= 0 ? '#00c853' : '#ff4444',
                    }}>
                      {variance != null ? (variance > 0 ? '+' : '') + variance : '—'}
                    </td>
                    <td style={{ padding: '4px 8px', color: 'var(--muted)', fontSize: '10px', maxWidth: '120px' }}>
                      {labels || '—'}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      <button style={{ ...S.ghostBtn, color: ORANGE, fontSize: '10px' }}
                        onClick={() => setSelectedWeek(i)}>▶</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {trace.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={S.cardTitle}>{t('spb_fitnessTrace')}</div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
            <path d={makePath('CTL')} fill="none" stroke={BLUE}   strokeWidth="2" />
            <path d={makePath('ATL')} fill="none" stroke={ORANGE} strokeWidth="2" />
            {pfWindow?.peakDay && (
              <line x1={toX(pfWindow.peakDay - 1).toFixed(1)} y1="0"
                    x2={toX(pfWindow.peakDay - 1).toFixed(1)} y2={H}
                    stroke="#00c853" strokeWidth="1.5" strokeDasharray="4 2" />
            )}
          </svg>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <span style={{ ...FONT_MONO, fontSize: '10px', color: BLUE }}>{t('spb_ctlLegend')}</span>
            <span style={{ ...FONT_MONO, fontSize: '10px', color: ORANGE }}>{t('spb_atlLegend')}</span>
            <span style={{ ...FONT_MONO, fontSize: '10px', color: '#00c853' }}>{t('spb_peakFormLegend')}</span>
          </div>
        </div>
      )}

      {/* B1 — Compare top 2 plans */}
      <div style={{ ...S.card }}>
        <button style={{ ...S.btnSec, fontSize: '10px', marginTop: 0 }} onClick={() => setShowCompare(s => !s)}>
          {t('spb_comparePlans')}
        </button>
        {showCompare && (() => {
          const planA = bestPlan
          const resultB = monteCarloOptimizer({
            weeks:       form.weeks || 8,
            minTSS:      form.currentTSS || 200,
            maxTSS:      form.peakTSS || 500,
            startCTL:    form.startCTL || 0,
            startATL:    form.startATL || 0,
          }, 100)
          const planB = resultB.bestPlan

          const pfA = peakFormWindow(planA, form.startCTL || 0, form.startATL || 0)
          const pfB = peakFormWindow(planB, form.startCTL || 0, form.startATL || 0)
          const peakDayA = pfA?.peakDay ?? 0
          const peakDayB = pfB?.peakDay ?? 0

          const traceA = simulateBanister(
            planA.flatMap(w => [w/7, w/7, w/7, w/7, w/7, w/7, w/7]),
            form.startCTL || 0, form.startATL || 0
          )
          const ctlA = traceA.length ? traceA[traceA.length - 1].CTL : 0
          const traceB = simulateBanister(
            planB.flatMap(w => [w/7, w/7, w/7, w/7, w/7, w/7, w/7]),
            form.startCTL || 0, form.startATL || 0
          )
          const ctlB = traceB.length ? traceB[traceB.length - 1].CTL : 0

          let verdict
          const dayDiff = peakDayA - peakDayB
          const ctlDiff = Math.round(ctlA - ctlB)
          if (Math.abs(dayDiff) > 2) {
            verdict = dayDiff < 0
              ? `Plan A peaks ${Math.abs(dayDiff)} days earlier — better for a Sunday race.`
              : `Plan B peaks ${Math.abs(dayDiff)} days earlier — better for a Sunday race.`
          } else if (Math.abs(ctlDiff) > 1) {
            verdict = ctlDiff > 0
              ? `Plan A builds more fitness (+${ctlDiff} CTL).`
              : `Plan B builds more fitness (+${Math.abs(ctlDiff)} CTL).`
          } else {
            verdict = 'Plans are near-identical — choose either.'
          }

          return (
            <div style={{ marginTop: '12px' }}>
              <div style={{ ...FONT_MONO, fontSize: '10px', color: 'var(--muted)', marginBottom: '8px' }}>PLAN A (optimized) vs PLAN B (alternate 100-sim)</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', ...FONT_MONO, fontSize: '11px' }}>
                  <thead>
                    <tr style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '3px 8px', textAlign: 'left' }}>WK</th>
                      <th style={{ padding: '3px 8px', textAlign: 'right', color: ORANGE }}>PLAN A</th>
                      <th style={{ padding: '3px 8px', textAlign: 'right', color: BLUE }}>PLAN B</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planA.map((tssA, i) => {
                      const tssB = planB[i] ?? 0
                      const aBetter = tssA > tssB
                      const bBetter = tssB > tssA
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '3px 8px' }}>{i + 1}</td>
                          <td style={{
                            padding: '3px 8px', textAlign: 'right',
                            background: aBetter ? `${ORANGE}22` : 'transparent',
                            color: aBetter ? ORANGE : 'var(--text)',
                          }}>{tssA}</td>
                          <td style={{
                            padding: '3px 8px', textAlign: 'right',
                            background: bBetter ? `${BLUE}22` : 'transparent',
                            color: bBetter ? BLUE : 'var(--text)',
                          }}>{tssB}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '10px', padding: '8px 12px', background: '#ff660011', border: `1px solid ${ORANGE}44`, borderRadius: '4px', ...FONT_MONO, fontSize: '11px' }}>
                {verdict}
              </div>
            </div>
          )
        })()}
      </div>

      {/* B2 — What-if missed week simulation */}
      <div style={{ ...S.card }}>
        <div style={{ ...FONT_MONO, fontSize: '10px', color: 'var(--muted)', marginBottom: '8px' }}>{t('spb_simulateMissed')}</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ ...FONT_MONO, fontSize: '11px' }}>{t('spb_simulateMissed')}:</span>
          <select
            style={{ ...FONT_MONO, fontSize: '11px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '3px 6px', color: 'var(--text)' }}
            value={missedWeekInput}
            onChange={e => setMissedWeekInput(e.target.value)}
          >
            <option value="">{t('spb_missedSelectWeek')}</option>
            {bestPlan.map((_, i) => <option key={i} value={i + 1}>Week {i + 1}</option>)}
          </select>
          <button style={{ ...S.btnSec, fontSize: '10px' }} onClick={() => setMissedWeek(missedWeekInput ? parseInt(missedWeekInput) : null)}>
            {t('spb_missWeekBtn')}
          </button>
          {missedWeek && (
            <button style={{ ...S.ghostBtn, fontSize: '10px', color: 'var(--muted)' }} onClick={() => { setMissedWeek(null); setMissedWeekInput('') }}>✕ clear</button>
          )}
        </div>

        {missedWeek && (() => {
          const altPlan = [...bestPlan]
          altPlan[missedWeek - 1] = 0
          const origTrace = peakFormWindow(bestPlan, form.startCTL || 0, form.startATL || 0)
          const altTrace  = peakFormWindow(altPlan,  form.startCTL || 0, form.startATL || 0)
          const ctlDrop   = Math.round((origTrace?.peakTSB ?? 0) - (altTrace?.peakTSB ?? 0))
          const dayShift  = (origTrace?.peakDay ?? 0) - (altTrace?.peakDay ?? 0)

          // Build TSB traces for SVG overlay (weekly resolution)
          const origTSB = (origTrace?.trace || []).filter((_, i) => i % 7 === 0).map(d => d.TSB ?? 0)
          const altTSB  = (altTrace?.trace  || []).filter((_, i) => i % 7 === 0).map(d => d.TSB ?? 0)
          const allVals = [...origTSB, ...altTSB]
          const minTSB  = Math.min(...allVals, -10)
          const maxTSB  = Math.max(...allVals, 10)
          const tsbRange = maxTSB - minTSB || 1
          const OW = 200; const OH = 50
          const toX2 = i => (i / Math.max(origTSB.length - 1, 1)) * OW
          const toY2 = v => OH - ((v - minTSB) / tsbRange) * OH
          const origPts = origTSB.map((v, i) => `${toX2(i).toFixed(1)},${toY2(v).toFixed(1)}`).join(' ')
          const altPts  = altTSB.map( (v, i) => `${toX2(i).toFixed(1)},${toY2(v).toFixed(1)}`).join(' ')

          return (
            <div style={{ marginTop: '12px' }}>
              <div style={{ ...FONT_MONO, fontSize: '11px', marginBottom: '8px' }}>
                Week {missedWeek}: {t('spb_missedImpact')}{' '}
                <span style={{ color: '#e03030', fontWeight: 700 }}>{Math.abs(ctlDrop)} pts</span>
                {dayShift !== 0 && (
                  <>, {t('spb_peakFormShifts')} <span style={{ color: '#f5c542', fontWeight: 700 }}>{Math.abs(dayShift)} {dayShift > 0 ? t('spb_daysLater') : t('spb_daysEarlier')}</span></>
                )}
              </div>
              <svg viewBox={`0 0 ${OW} ${OH}`} style={{ width: OW, height: OH, display: 'block', overflow: 'visible' }}>
                {origTSB.length > 1 && <polyline fill="none" stroke={ORANGE} strokeWidth="1.5" points={origPts} />}
                {altTSB.length > 1  && <polyline fill="none" stroke={BLUE}   strokeWidth="1.5" strokeDasharray="4 2" points={altPts} />}
                <text x="2" y="10" fontSize="7" fill={ORANGE} fontFamily="IBM Plex Mono, monospace">ORIGINAL</text>
                <text x="2" y="20" fontSize="7" fill={BLUE}   fontFamily="IBM Plex Mono, monospace">MISSED</text>
              </svg>
            </div>
          )
        })()}
      </div>

      <button style={S.btn} onClick={onRestart}>{t('spb_buildNewPlan')}</button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SportProgramBuilder() {
  const { t } = useContext(LangCtx)
  const { log, setLog, profile } = useData()

  const [step, setStep]     = useState(0)
  const [form, setForm]     = useState({ weeks: 8 })
  const [result, setResult] = useState(null)

  // Auto-populate on mount: sport from profile, CTL/ATL from log, test results from log
  useEffect(() => {
    const profileSport = extractProfileSport(profile)
    const { ctl, atl } = deriveCtlAtl(log)
    const freq = sessionFrequencyPerWeek(log, 4)

    setForm(prev => {
      const updated = { ...prev }

      if (profileSport && !prev.sport) {
        updated.sport = profileSport
        updated._sportFromProfile = true
      }

      if (ctl > 0 || atl > 0) {
        if (prev.startCTL === undefined) updated.startCTL = ctl
        if (prev.startATL === undefined) updated.startATL = atl
        updated._ctlFromLog = true
      }

      if (freq > 0 && !prev.sessionsPerWeek) {
        updated.sessionsPerWeek = freq
        updated._sessionsFromLog = true
      }

      // Pre-fill baseline from log
      const rowingTest = findRecentResult(log, 'Test', 2000)
      if (rowingTest?.timeSec && !prev.baseline?.time2k) {
        updated.baseline = {
          ...(prev.baseline || {}),
          time2k: fmtTimeInput(rowingTest.timeSec),
          _time2kFromLog: true,
        }
      }

      const raceResult = findRecentResult(log, 'Race')
      if (raceResult?.timeSec && raceResult?.distanceM && !prev.baseline?.raceTime) {
        updated.baseline = {
          ...(prev.baseline || updated.baseline || {}),
          raceTime: fmtTimeInput(raceResult.timeSec),
          raceDist: String(raceResult.distanceM),
          _raceFromLog: true,
        }
      }

      return updated
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: init effect populates form from profile/log on mount only
  }, [])

  const handleResult = useCallback((r) => { setResult(r); setStep(4) }, [])
  const restart      = useCallback(() => { setStep(0); setForm({ weeks: 8 }); setResult(null) }, [])

  return (
    <div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}.spb-step{animation:fadeIn 200ms ease-out both}`}</style>
      <div style={{ ...S.card }}>
        <div style={{ ...S.cardTitle, marginBottom: '6px' }}>{t('spb_title')}</div>
        <div style={{ ...DIM, marginBottom: '16px' }}>{t('spb_sub')}</div>
        <StepBar step={step} />
        <div className="spb-step" key={step}>
          {step === 0 && <Step1 form={form} setForm={setForm} onNext={() => setStep(1)} />}
          {step === 1 && <Step2 form={form} setForm={setForm} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
          {step === 2 && <Step3 form={form} setForm={setForm} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <Step4 form={form} onResult={handleResult} onBack={() => setStep(2)} />}
          {step === 4 && <Step5 form={form} result={result} onRestart={restart} log={log} setLog={setLog} />}
        </div>
      </div>
    </div>
  )
}
