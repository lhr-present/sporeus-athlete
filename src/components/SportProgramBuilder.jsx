import { useState, useMemo, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { S } from '../styles.js'
import {
  simulateBanister, scoreTrainingPlan, monteCarloOptimizer, peakFormWindow,
} from '../lib/sport/simulation.js'

const FONT_MONO = { fontFamily: 'IBM Plex Mono, monospace' }
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'
const DIM    = { color: 'var(--muted)', fontSize: '11px', ...FONT_MONO }

const SPORTS = [
  { id: 'rowing',    label: 'Rowing',    icon: '🚣' },
  { id: 'running',   label: 'Running',   icon: '🏃' },
  { id: 'cycling',   label: 'Cycling',   icon: '🚴' },
  { id: 'swimming',  label: 'Swimming',  icon: '🏊' },
  { id: 'triathlon', label: 'Triathlon', icon: '🏅' },
]

const GOALS = [
  { id: 'base',     label: 'Build Base Fitness' },
  { id: 'race',     label: 'Race Preparation' },
  { id: 'peak',     label: 'Peak for Event' },
  { id: 'maintain', label: 'Maintain Current Level' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / 86400000)
}

function exportCSV(bestPlan, actualTSS, raceDate) {
  const header = 'Week,Planned TSS,Actual TSS,Variance'
  const rows = bestPlan.map((tss, i) => {
    const actual = actualTSS[i] != null ? actualTSS[i] : ''
    const variance = actual !== '' ? actual - tss : ''
    return `${i + 1},${tss},${actual},${variance}`
  })
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `sporeus-plan-${raceDate || 'export'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Step indicators ───────────────────────────────────────────────────────────
function StepBar({ step, total = 5 }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: '4px', borderRadius: '2px',
          background: i <= step ? ORANGE : 'var(--border)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  )
}

// ── Week detail modal ─────────────────────────────────────────────────────────
function WeekModal({ week, weekIdx, trace, onClose }) {
  if (!trace) return null
  const startDay = weekIdx * 7
  const days = trace.slice(startDay, startDay + 7)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000a', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px',
    }} onClick={onClose}>
      <div style={{
        ...S.card, maxWidth: '480px', width: '100%', background: 'var(--card-bg)',
        border: `1px solid ${ORANGE}`, padding: '20px',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ ...FONT_MONO, fontWeight: 600, color: ORANGE }}>WEEK {weekIdx + 1} DETAIL</span>
          <button style={{ ...S.ghostBtn, color: ORANGE, fontSize: '16px' }} onClick={onClose}>✕</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ ...DIM, textAlign: 'left' }}>
              <th style={{ paddingBottom: '6px' }}>DAY</th>
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
                <td style={{ ...FONT_MONO, fontSize: '11px', color: d.TSB >= 0 ? '#00c853' : '#ff4444' }}>{d.TSB > 0 ? '+' : ''}{d.TSB}</td>
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
  return (
    <div>
      <div style={S.cardTitle}>SPORT &amp; GOAL</div>
      <div style={{ marginBottom: '16px' }}>
        <div style={DIM}>SELECT SPORT</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {SPORTS.map(s => (
            <button key={s.id} onClick={() => setForm(f => ({ ...f, sport: s.id }))}
              style={{
                ...S.btnSec, padding: '8px 14px',
                background: form.sport === s.id ? ORANGE : 'transparent',
                color: form.sport === s.id ? '#fff' : ORANGE,
              }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <div style={DIM}>PRIMARY GOAL</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {GOALS.map(g => (
            <button key={g.id} onClick={() => setForm(f => ({ ...f, goal: g.id }))}
              style={{
                ...S.btnSec, padding: '8px 14px',
                background: form.goal === g.id ? ORANGE : 'transparent',
                color: form.goal === g.id ? '#fff' : ORANGE,
              }}>
              {g.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <label style={S.label}>RACE DATE (optional)</label>
        <input type="date" style={{ ...S.input, width: '200px' }} value={form.raceDate || ''}
          onChange={e => setForm(f => ({ ...f, raceDate: e.target.value }))} />
        {form.raceDate && daysUntil(form.raceDate) != null && (
          <div style={{ ...DIM, marginTop: '6px', color: ORANGE }}>
            {daysUntil(form.raceDate)} days to race
          </div>
        )}
      </div>
      <button style={S.btn} disabled={!form.sport || !form.goal} onClick={onNext}>
        NEXT →
      </button>
    </div>
  )
}

// ── Step 2: Performance baseline ──────────────────────────────────────────────
function Step2({ form, setForm, onNext, onBack }) {
  const sport = form.sport
  return (
    <div>
      <div style={S.cardTitle}>PERFORMANCE BASELINE</div>
      {sport === 'rowing' && (
        <div style={S.row}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={S.label}>2000m Time (mm:ss)</label>
            <input style={S.input} placeholder="6:30" value={form.baseline?.time2k || ''}
              onChange={e => setForm(f => ({ ...f, baseline: { ...f.baseline, time2k: e.target.value } }))} />
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
        <button style={S.btnSec} onClick={onBack}>← BACK</button>
        <button style={S.btn} onClick={onNext}>NEXT →</button>
      </div>
    </div>
  )
}

// ── Step 3: Constraints ────────────────────────────────────────────────────────
function Step3({ form, setForm, onNext, onBack }) {
  return (
    <div>
      <div style={S.cardTitle}>TRAINING CONSTRAINTS</div>
      <div style={S.row}>
        <div style={{ flex: '1 1 140px' }}>
          <label style={S.label}>Plan Duration (weeks)</label>
          <select style={S.select} value={form.weeks || 8}
            onChange={e => setForm(f => ({ ...f, weeks: +e.target.value }))}>
            {[4, 6, 8, 10, 12, 16, 20, 24].map(w => (
              <option key={w} value={w}>{w} weeks</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={S.label}>Current Weekly TSS</label>
          <input style={S.input} type="number" placeholder="250" value={form.currentTSS || ''}
            onChange={e => setForm(f => ({ ...f, currentTSS: +e.target.value }))} />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label style={S.label}>Peak Weekly TSS Target</label>
          <input style={S.input} type="number" placeholder="500" value={form.peakTSS || ''}
            onChange={e => setForm(f => ({ ...f, peakTSS: +e.target.value }))} />
        </div>
      </div>
      <div style={S.row}>
        <div style={{ flex: '1 1 180px' }}>
          <label style={S.label}>Current CTL (fitness)</label>
          <input style={S.input} type="number" placeholder="45" value={form.startCTL || ''}
            onChange={e => setForm(f => ({ ...f, startCTL: +e.target.value }))} />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <label style={S.label}>Current ATL (fatigue)</label>
          <input style={S.input} type="number" placeholder="55" value={form.startATL || ''}
            onChange={e => setForm(f => ({ ...f, startATL: +e.target.value }))} />
        </div>
      </div>
      <div style={{ ...DIM, marginTop: '8px' }}>Recovery weeks auto-inserted every 4th week.</div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
        <button style={S.btnSec} onClick={onBack}>← BACK</button>
        <button style={S.btn}
          disabled={!(form.currentTSS > 0 && form.peakTSS > 0 && form.peakTSS > form.currentTSS)}
          onClick={onNext}>
          GENERATE PLAN →
        </button>
      </div>
    </div>
  )
}

// ── Step 4: Plan generation ────────────────────────────────────────────────────
function Step4({ form, onResult, onBack }) {
  const [running, setRunning] = useState(false)
  const generate = () => {
    setRunning(true)
    setTimeout(() => {
      const weeks = form.weeks || 8
      const recoveryWeeks = Array.from({ length: Math.floor(weeks / 4) }, (_, i) => (i + 1) * 4 - 1)
      const result = monteCarloOptimizer({
        weeks,
        minWeeklyTSS:  form.currentTSS || 200,
        maxWeeklyTSS:  form.peakTSS    || 500,
        recoveryWeeks,
        startCTL:      form.startCTL   || 0,
        startATL:      form.startATL   || 0,
      }, 500)
      setRunning(false)
      onResult(result)
    }, 50)
  }
  return (
    <div>
      <div style={S.cardTitle}>GENERATE PLAN</div>
      <div style={{ ...S.card, background: 'var(--surface)' }}>
        <div style={{ ...FONT_MONO, fontSize: '12px', lineHeight: '1.8', color: 'var(--text)' }}>
          <div>▸ Sport: <strong>{SPORTS.find(s => s.id === form.sport)?.label || '—'}</strong></div>
          <div>▸ Goal: <strong>{GOALS.find(g => g.id === form.goal)?.label || '—'}</strong></div>
          <div>▸ Duration: <strong>{form.weeks || 8} weeks</strong></div>
          <div>▸ TSS range: <strong>{form.currentTSS || '?'} → {form.peakTSS || '?'} / week</strong></div>
          <div>▸ Start CTL/ATL: <strong>{form.startCTL || 0} / {form.startATL || 0}</strong></div>
          {form.raceDate && <div>▸ Race date: <strong>{form.raceDate}</strong> ({daysUntil(form.raceDate)} days)</div>}
        </div>
      </div>
      <div style={{ ...DIM, marginBottom: '16px' }}>500 Monte Carlo simulations to find highest-scoring plan.</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button style={S.btnSec} onClick={onBack} disabled={running}>← BACK</button>
        <button style={{ ...S.btn, opacity: running ? 0.6 : 1 }} onClick={generate} disabled={running}>
          {running ? 'SIMULATING…' : '⚡ RUN OPTIMIZER'}
        </button>
      </div>
    </div>
  )
}

// ── Step 5: Plan display ───────────────────────────────────────────────────────
function Step5({ form, result, onRestart }) {
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [actualTSS, setActualTSS] = useState({})

  const pfWindow = useMemo(() => {
    if (!result?.bestPlan) return null
    return peakFormWindow(result.bestPlan, form.startCTL || 0, form.startATL || 0)
  }, [result, form.startCTL, form.startATL])

  if (!result) return null
  const { bestPlan, bestScore, meanScore, histogram } = result
  const trace = pfWindow?.trace || []

  // CTL/ATL sparkline (SVG)
  const maxVal = Math.max(...trace.map(d => Math.max(d.CTL, d.ATL)), 1)
  const W = 400; const H = 80
  const toX = i => (i / Math.max(trace.length - 1, 1)) * W
  const toY = v => H - (v / maxVal) * H
  const makePath = key => trace.map((d, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(d[key]).toFixed(1)}`
  ).join(' ')

  // Race countdown
  const daysLeft = form.raceDate ? daysUntil(form.raceDate) : null

  const handleActualChange = (i, val) => {
    setActualTSS(prev => ({ ...prev, [i]: val === '' ? null : +val }))
  }

  return (
    <div>
      {selectedWeek !== null && (
        <WeekModal
          week={bestPlan[selectedWeek]}
          weekIdx={selectedWeek}
          trace={trace}
          onClose={() => setSelectedWeek(null)}
        />
      )}

      <div style={S.cardTitle}>YOUR OPTIMIZED PLAN</div>

      {/* Race countdown */}
      {daysLeft != null && (
        <div style={{
          ...S.card, background: '#ff660011', border: `1px solid ${ORANGE}44`,
          display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px',
        }}>
          <span style={{ ...FONT_MONO, fontSize: '28px', fontWeight: 700, color: ORANGE }}>{daysLeft}</span>
          <div>
            <div style={{ ...FONT_MONO, fontSize: '11px', color: 'var(--muted)' }}>DAYS TO RACE</div>
            <div style={{ ...FONT_MONO, fontSize: '12px' }}>{form.raceDate}</div>
          </div>
        </div>
      )}

      {/* Scores */}
      <div style={{ ...S.row, marginBottom: '16px' }}>
        <div style={S.stat}><span style={S.statVal}>{bestScore}</span><span style={S.statLbl}>PLAN SCORE</span></div>
        <div style={S.stat}><span style={S.statVal}>{meanScore}</span><span style={S.statLbl}>AVG SCORE</span></div>
        <div style={S.stat}><span style={{ ...S.statVal, fontSize: '16px' }}>Day {pfWindow?.peakDay ?? '?'}</span><span style={S.statLbl}>PEAK FORM</span></div>
        <div style={S.stat}>
          <span style={{ ...S.statVal, fontSize: '16px' }}>
            {pfWindow?.peakTSB != null ? (pfWindow.peakTSB > 0 ? '+' : '') + pfWindow.peakTSB : '?'}
          </span>
          <span style={S.statLbl}>PEAK TSB</span>
        </div>
      </div>

      {/* Score distribution histogram */}
      {histogram && (
        <div style={{ ...S.card }}>
          <div style={S.cardTitle}>SCORE DISTRIBUTION (500 simulations)</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={histogram} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="range" tick={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9 }} />
              <YAxis tick={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 9 }} />
              <Tooltip
                contentStyle={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, background: '#111', border: `1px solid ${ORANGE}` }}
                formatter={(v) => [v, 'Plans']}
              />
              <ReferenceLine x={`${Math.floor(bestScore / 10) * 10}–${Math.floor(bestScore / 10) * 10 + 10}`} stroke={ORANGE} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {histogram.map((entry, i) => (
                  <Cell key={i} fill={entry.count === Math.max(...histogram.map(h => h.count)) ? ORANGE : '#0064ff44'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly plan with plan vs actual */}
      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={S.cardTitle}>WEEKLY TSS — PLAN vs ACTUAL</div>
          <button style={{ ...S.btnSec, fontSize: '10px', padding: '4px 10px' }}
            onClick={() => exportCSV(bestPlan, actualTSS, form.raceDate)}>
            ↓ CSV
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', ...FONT_MONO, fontSize: '11px' }}>
            <thead>
              <tr style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '4px 8px', textAlign: 'left' }}>WK</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>PLANNED</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>ACTUAL</th>
                <th style={{ padding: '4px 8px', textAlign: 'right' }}>VARIANCE</th>
                <th style={{ padding: '4px 8px', textAlign: 'center' }}>DETAIL</th>
              </tr>
            </thead>
            <tbody>
              {bestPlan.map((tss, i) => {
                const actual   = actualTSS[i] != null ? actualTSS[i] : null
                const variance = actual != null ? actual - tss : null
                const isRec    = tss < (form.currentTSS || 200) * 1.1
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 8px' }}>
                      <span style={{ color: isRec ? BLUE : ORANGE }}>{i + 1}</span>
                      {isRec && <span style={{ color: BLUE, marginLeft: '4px', fontSize: '9px' }}>REC</span>}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: isRec ? BLUE : 'var(--text)' }}>{tss}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      <input
                        type="number"
                        placeholder="—"
                        value={actualTSS[i] ?? ''}
                        onChange={e => handleActualChange(i, e.target.value)}
                        style={{
                          width: '60px', background: 'var(--input-bg)', border: '1px solid var(--border)',
                          borderRadius: '4px', padding: '2px 4px', color: 'var(--text)', ...FONT_MONO, fontSize: '11px',
                          textAlign: 'right',
                        }}
                      />
                    </td>
                    <td style={{
                      padding: '4px 8px', textAlign: 'right',
                      color: variance == null ? 'var(--muted)' : variance >= 0 ? '#00c853' : '#ff4444',
                    }}>
                      {variance != null ? (variance > 0 ? '+' : '') + variance : '—'}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      <button style={{ ...S.ghostBtn, color: ORANGE, fontSize: '10px' }}
                        onClick={() => setSelectedWeek(i)}>
                        ▶
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CTL/ATL sparkline */}
      {trace.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={S.cardTitle}>FITNESS / FATIGUE TRACE (Banister)</div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
            <path d={makePath('CTL')} fill="none" stroke={BLUE}   strokeWidth="2" />
            <path d={makePath('ATL')} fill="none" stroke={ORANGE} strokeWidth="2" />
            {pfWindow?.peakDay && (
              <line
                x1={toX(pfWindow.peakDay - 1).toFixed(1)} y1="0"
                x2={toX(pfWindow.peakDay - 1).toFixed(1)} y2={H}
                stroke="#00c853" strokeWidth="1.5" strokeDasharray="4 2" />
            )}
          </svg>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <span style={{ ...FONT_MONO, fontSize: '10px', color: BLUE }}>— CTL (Fitness)</span>
            <span style={{ ...FONT_MONO, fontSize: '10px', color: ORANGE }}>— ATL (Fatigue)</span>
            <span style={{ ...FONT_MONO, fontSize: '10px', color: '#00c853' }}>| Peak form day</span>
          </div>
        </div>
      )}

      <button style={S.btn} onClick={onRestart}>BUILD NEW PLAN</button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SportProgramBuilder({ profile }) {
  const [step, setStep]     = useState(0)
  const [form, setForm]     = useState({ weeks: 8 })
  const [result, setResult] = useState(null)

  const handleResult = useCallback((r) => { setResult(r); setStep(4) }, [])
  const restart      = useCallback(() => { setStep(0); setForm({ weeks: 8 }); setResult(null) }, [])

  return (
    <div>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}.spb-step{animation:fadeIn 200ms ease-out both}`}</style>
      <div style={{ ...S.card }}>
        <div style={{ ...S.cardTitle, marginBottom: '6px' }}>SPORT PROGRAM BUILDER</div>
        <div style={{ ...DIM, marginBottom: '16px' }}>Monte Carlo optimizer · Banister impulse-response · 500 simulations</div>
        <StepBar step={step} />
        <div className="spb-step" key={step}>
          {step === 0 && <Step1 form={form} setForm={setForm} onNext={() => setStep(1)} />}
          {step === 1 && <Step2 form={form} setForm={setForm} onNext={() => setStep(2)} onBack={() => setStep(0)} />}
          {step === 2 && <Step3 form={form} setForm={setForm} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <Step4 form={form} onResult={handleResult} onBack={() => setStep(2)} />}
          {step === 4 && <Step5 form={form} result={result} onRestart={restart} />}
        </div>
      </div>
    </div>
  )
}
