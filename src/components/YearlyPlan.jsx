// ─── YearlyPlan.jsx — 52-week annual training plan with CTL projection ─────────
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'
import { S } from '../styles.js'
import { calculatePMC } from '../lib/trainingLoad.js'
import {
  buildYearlyPlan,
  validatePlan,
  updateWeekTSS,
  exportPlanCSV,
} from '../lib/periodization.js'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.js'
import WeekBuilder from './WeekBuilder.jsx'

const MONO = "'IBM Plex Mono', monospace"

const PHASE_COLORS = {
  Base:       '#2d6a2d',
  Build:      '#1a3a6b',
  Peak:       '#8b4513',
  Race:       '#8b0000',
  Recovery:   '#2a4a5a',
  Transition: '#3a2a5a',
}

const MODEL_LABELS = { traditional: 'Traditional', polarized: 'Polarized', block: 'Block' }
const COL_W_DESKTOP = 56
const COL_W_MOBILE  = 44
const BAR_MAX_H     = 52
const CTL_H         = 48   // height of CTL overlay strip
const BAND_H        = 8    // phase color band height
const TOTAL_COL_H   = BAND_H + BAR_MAX_H + 22  // band + bar + label

function addWeeks(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

// Derive current week index (0-based) from plan start
function currentWeekIndex(weeks) {
  const today = todayStr()
  for (let i = 0; i < weeks.length; i++) {
    const ws = new Date(weeks[i].weekStart)
    const we = new Date(ws); we.setDate(ws.getDate() + 6)
    const t  = new Date(today)
    if (t >= ws && t <= we) return i
  }
  return 0
}

// ── WeekColumn ─────────────────────────────────────────────────────────────────
function WeekColumn({ week, selected, isCurrent, onClick, colW, maxTSS }) {
  const barH  = maxTSS > 0 ? Math.round((week.targetTSS / maxTSS) * BAR_MAX_H) : 0
  const isRace = week.phase === 'Race'

  const barColor = week.isDeload ? '#3a3a3a'
    : isRace ? '#cc1111'
    : week.phase === 'Recovery' ? '#2a5a6a'
    : '#ff6600'

  return (
    <div
      onClick={onClick}
      title={`W${week.weekNum} ${week.phase} — TSS ${week.targetTSS}${week.raceName ? ' ◉ ' + week.raceName : ''}`}
      style={{
        width:          colW,
        flexShrink:     0,
        cursor:         'pointer',
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        borderRight:    '1px solid #111',
        background:     selected ? '#1a1a2a' : isCurrent ? '#141414' : 'transparent',
        transition:     'background 0.1s',
        position:       'relative',
      }}
    >
      {/* Phase color band */}
      <div style={{
        width: '100%', height: BAND_H,
        background: PHASE_COLORS[week.phase] || '#333',
        flexShrink: 0,
      }} />

      {/* TSS bar (bottom-aligned within fixed area) */}
      <div style={{
        height:    BAR_MAX_H,
        width:     '100%',
        display:   'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding:   '0 4px',
        flexShrink: 0,
      }}>
        {barH > 0 && (
          <div style={{
            width:      colW - 8,
            height:     barH,
            background: barColor,
            opacity:    week.isDeload ? 0.55 : 0.85,
            borderRadius: '2px 2px 0 0',
            backgroundImage: week.isDeload
              ? 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)'
              : 'none',
          }} />
        )}
      </div>

      {/* Week label / trophy */}
      <div style={{
        fontFamily: MONO, fontSize: 9, color: selected ? '#ff6600' : isCurrent ? '#aaa' : '#444',
        marginTop: 2, height: 18, display: 'flex', alignItems: 'center',
        flexShrink: 0,
      }}>
        {isRace ? '◉' : `W${week.weekNum}`}
      </div>

      {/* Current week marker dot */}
      {isCurrent && (
        <div style={{
          position: 'absolute', top: BAND_H + 2, width: 4, height: 4,
          borderRadius: '50%', background: '#ff6600',
        }} />
      )}
    </div>
  )
}

// ── WeekDetailPanel ────────────────────────────────────────────────────────────
function WeekDetailPanel({ week, weekIndex, allWeeks, onUpdateTSS, onOpenBuilder }) {
  const [tssInput, setTssInput] = useState(String(week.targetTSS))
  const [copyN, setCopyN]       = useState(2)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- week.weekNum identifies the row; targetTSS syncs when the user navigates weeks
  useEffect(() => { setTssInput(String(week.targetTSS)) }, [week.weekNum])

  const applyTSS = () => {
    const v = parseInt(tssInput)
    if (!isNaN(v) && v >= 0) onUpdateTSS(weekIndex, v)
  }

  const applyForward = () => {
    const v = parseInt(tssInput)
    if (isNaN(v) || v < 0) return
    let updated = [...allWeeks]
    for (let i = weekIndex; i < Math.min(weekIndex + copyN, updated.length); i++) {
      updated = updateWeekTSS(updated, i, v)
    }
    onUpdateTSS(-1, -1, updated)  // pass full array when index=-1
  }

  const z = week.zoneDistribution || {}
  const ZONE_COLORS = { Z1:'#5bc25b', Z2:'#4a9eff', Z3:'#ff6600', Z4:'#e0a030', Z5:'#e03030' }

  return (
    <div style={{
      background: '#0d0d0d', border: '1px solid #2a2a2a',
      borderRadius: 6, padding: '14px 16px', marginTop: 12,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#ccc', marginBottom: 10 }}>
        WEEK {week.weekNum} — <span style={{ color: PHASE_COLORS[week.phase] || '#888' }}>{week.phase.toUpperCase()}</span>
        {' '}— w/o {week.weekStart}
        {week.isDeload && <span style={{ color: '#555', marginLeft: 8 }}>DELOAD</span>}
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
        {/* TSS editor */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.08em', marginBottom: 4 }}>
            TARGET TSS
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number" min="0"
              value={tssInput}
              onChange={e => setTssInput(e.target.value)}
              onBlur={applyTSS}
              onKeyDown={e => e.key === 'Enter' && applyTSS()}
              style={{ ...S.input, maxWidth: 80, fontWeight: 700, fontSize: 14 }}
            />
            <button onClick={applyTSS} style={{
              fontFamily: MONO, fontSize: 9, padding: '6px 10px',
              background: '#ff6600', border: 'none', color: '#fff',
              borderRadius: 3, cursor: 'pointer',
            }}>APPLY</button>
          </div>
        </div>

        {/* Hours (derived) */}
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.08em', marginBottom: 4 }}>
            PLANNED HOURS
          </div>
          <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: '#888' }}>
            {week.plannedHours}h
          </div>
        </div>

        {/* Race badge */}
        {week.raceName && (
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.08em', marginBottom: 4 }}>
              RACE
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: '#e03030' }}>
              [R] {week.raceName}
              {week.priority && (
                <span style={{
                  marginLeft: 6, padding: '2px 6px', borderRadius: 3,
                  background: week.priority === 'A' ? '#8b0000' : week.priority === 'B' ? '#4a3a00' : '#1a1a3a',
                  color: '#eee', fontSize: 9,
                }}>
                  Priority {week.priority}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Zone bars */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.08em', marginBottom: 6 }}>
          ZONE DISTRIBUTION
        </div>
        {['Z1','Z2','Z3','Z4','Z5'].map(zk => {
          const pct = Math.round((z[zk] || 0) * 100)
          return (
            <div key={zk} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: ZONE_COLORS[zk], width: 18 }}>{zk}</div>
              <div style={{ flex: 1, height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: ZONE_COLORS[zk], opacity: 0.7 }} />
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: '#666', width: 30, textAlign: 'right' }}>{pct}%</div>
            </div>
          )
        })}
      </div>

      {/* Copy forward */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: '#555' }}>Apply this TSS to next</div>
        <select
          value={copyN}
          onChange={e => setCopyN(parseInt(e.target.value))}
          style={{ ...S.select, maxWidth: 60, padding: '4px 6px', fontSize: 10 }}
        >
          {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div style={{ fontFamily: MONO, fontSize: 9, color: '#555' }}>weeks</div>
        <button onClick={applyForward} style={{
          fontFamily: MONO, fontSize: 9, padding: '5px 10px',
          background: 'transparent', border: '1px solid #2a2a2a',
          color: '#888', borderRadius: 3, cursor: 'pointer',
        }}>APPLY</button>
      </div>

      {/* Build sessions button */}
      <button onClick={onOpenBuilder} style={{
        fontFamily: MONO, fontSize: 10, fontWeight: 700,
        padding: '8px 16px', marginTop: 12,
        background: '#0064ff', border: 'none', color: '#fff',
        borderRadius: 4, cursor: 'pointer', letterSpacing: '0.06em',
      }}>
        ⊞ BUILD SESSIONS
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function YearlyPlan() {
  const { log }          = useData()
  const { user: authUser } = useAuth()

  const [plan,  setPlan]  = useLocalStorage('sporeus-yearly-plan',  null)
  const [races, setRaces] = useLocalStorage('sporeus-plan-races',   [])
  const [model, setModel] = useState('traditional')

  const [selectedWeek,    setSelectedWeek]    = useState(null)
  const [showRaceManager, setShowRaceManager] = useState(false)
  const [builderWeek,     setBuilderWeek]     = useState(null)  // Week object or null
  const [warnings,        setWarnings]        = useState([])
  const [dismissedWarns,  setDismissedWarns]  = useState(new Set())
  const [raceForm,        setRaceForm]        = useState({ date: '', name: '', priority: 'B' })

  const scrollRef  = useRef(null)
  const saveTimer  = useRef(null)

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const colW = isMobile ? COL_W_MOBILE : COL_W_DESKTOP

  // ── Auto-generate plan on first render ──────────────────────────────────────
  const generatePlan = useCallback((overrideRaces, overrideModel) => {
    const pmcPoints = calculatePMC(log, 90, 0)
    const currentCTL = pmcPoints.length > 0 ? pmcPoints[pmcPoints.length - 1].ctl : 40
    const today = todayStr()
    const effectiveRaces = overrideRaces ?? races
    const defaultRace = { date: addWeeks(today, 24), name: 'Goal Race', priority: 'A' }
    const planRaces   = effectiveRaces.length > 0 ? effectiveRaces : [defaultRace]

    const result = buildYearlyPlan({
      startDate:       today,
      races:           planRaces,
      currentCTL,
      targetCTL:       currentCTL + 15,
      maxHoursPerWeek: 10,
      trainingDays:    5,
      model:           overrideModel ?? model,
    })
    return result
  }, [log, races, model])

  useEffect(() => {
    if (plan === null) {
      const result = generatePlan()
      setPlan({ weeks: result.weeks, model, projectedCTL: result.projectedCTL })
      setWarnings(result.warnings)
    } else {
      setWarnings(validatePlan(plan.weeks, 0))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- init effect: validates plan once on mount
  }, [])

  // Scroll to current week on mount
  useEffect(() => {
    if (!plan || !scrollRef.current) return
    const idx = currentWeekIndex(plan.weeks)
    scrollRef.current.scrollLeft = Math.max(0, idx * colW - 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- boolean presence check; colW and plan identity intentionally excluded
  }, [!!plan])

  // ── Supabase auto-save (debounced 2s) ───────────────────────────────────────
  useEffect(() => {
    if (!plan) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (supabase && authUser) {
        await supabase.from('training_plans').upsert({
          user_id:   authUser.id,
          plan_json: plan,
          model:     plan.model || model,
        }, { onConflict: 'user_id' }).catch(() => {})
      }
    }, 2000)
    return () => clearTimeout(saveTimer.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-save: react to plan changes; authUser/model stable within session
  }, [plan])

  // ── Load from Supabase on mount (if authenticated) ───────────────────────────
  useEffect(() => {
    if (!supabase || !authUser) return
    supabase.from('training_plans')
      .select('plan_json, model')
      .eq('user_id', authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.plan_json?.weeks?.length > 0) {
          setPlan(data.plan_json)
          if (data.model) setModel(data.model)
        }
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per auth identity; setPlan/setModel are stable setters
  }, [authUser?.id])

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleRegenerate = () => {
    const result = generatePlan(races, model)
    setPlan({ weeks: result.weeks, model, projectedCTL: result.projectedCTL })
    setWarnings(result.warnings)
    setSelectedWeek(null)
  }

  const handleModelChange = (m) => {
    setModel(m)
    if (plan) {
      const result = generatePlan(races, m)
      setPlan({ weeks: result.weeks, model: m, projectedCTL: result.projectedCTL })
      setWarnings(result.warnings)
    }
  }

  const handleExportCSV = () => {
    if (!plan) return
    const csv  = exportPlanCSV(plan.weeks)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `sporeus-yearly-plan-${todayStr()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleUpdateTSS = (weekIndex, newTSS, fullArray) => {
    if (!plan) return
    let newWeeks
    if (fullArray) {
      newWeeks = fullArray
    } else {
      newWeeks = updateWeekTSS(plan.weeks, weekIndex, newTSS)
    }
    const updated = { ...plan, weeks: newWeeks }
    setPlan(updated)
    setWarnings(validatePlan(newWeeks, 0))
    if (weekIndex >= 0) setSelectedWeek(weekIndex)
  }

  const handleAddRace = () => {
    if (!raceForm.date || !raceForm.name.trim()) return
    const newRaces = [...races, { ...raceForm, name: raceForm.name.trim() }]
    setRaces(newRaces)
    setRaceForm({ date: '', name: '', priority: 'B' })
    const result = generatePlan(newRaces, model)
    setPlan({ weeks: result.weeks, model, projectedCTL: result.projectedCTL })
    setWarnings(result.warnings)
  }

  const handleRemoveRace = (idx) => {
    const newRaces = races.filter((_, i) => i !== idx)
    setRaces(newRaces)
    const result = generatePlan(newRaces, model)
    setPlan({ weeks: result.weeks, model, projectedCTL: result.projectedCTL })
    setWarnings(result.warnings)
  }

  // ── Derived values ────────────────────────────────────────────────────────────
  const weeks    = useMemo(() => plan?.weeks || [], [plan?.weeks])
  const maxTSS   = useMemo(() => Math.max(...weeks.map(w => w.targetTSS), 1), [weeks])
  const curWeek  = useMemo(() => currentWeekIndex(weeks), [weeks])

  // CTL projection line points (normalized within CTL_H strip)
  const ctlPoints = useMemo(() => {
    if (weeks.length === 0) return ''
    const ctlValues = []
    const K   = 1 - Math.exp(-1 / 42)
    const DEC = 1 - K
    let _ctl = plan?.projectedCTL ? 0 : 0 // CTL starting value — unused in simplified weekly overlay
    // Simple EWMA per-week for the overlay chart
    let c = 0
    for (const wk of weeks) {
      const dailyTSS = wk.targetTSS / 7
      for (let d = 0; d < 7; d++) c = c * DEC + dailyTSS * K
      ctlValues.push(Math.round(c * 10) / 10)
    }
    const minCTL = Math.min(...ctlValues)
    const maxCTL = Math.max(...ctlValues, minCTL + 1)
    const range  = maxCTL - minCTL
    return ctlValues.map((v, i) => {
      const x = i * colW + colW / 2
      const y = CTL_H - 4 - ((v - minCTL) / range) * (CTL_H - 8)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  // eslint-disable-next-line react-hooks/exhaustive-deps -- plan.projectedCTL is read via plan ref above; weeks/colW cover recompute triggers
  }, [weeks, colW])

  const totalW = weeks.length * colW

  if (!plan) {
    return (
      <div style={{ fontFamily: MONO, padding: '40px 20px', textAlign: 'center', color: '#555' }}>
        BUILDING PLAN...
      </div>
    )
  }

  return (
    <div className="sp-fade">
      {/* WeekBuilder overlay */}
      {builderWeek && (
        <WeekBuilder
          week={builderWeek}
          onClose={() => setBuilderWeek(null)}
        />
      )}

      {/* ── Top controls ── */}
      <div className="sp-card" style={{ ...S.card, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          {/* Model buttons */}
          <div style={{ display: 'flex', gap: 4 }}>
            {Object.entries(MODEL_LABELS).map(([m, label]) => (
              <button key={m} onClick={() => handleModelChange(m)} style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 700, padding: '5px 12px',
                background: model === m ? '#ff6600' : '#1a1a1a',
                color: model === m ? '#fff' : '#666',
                border: 'none', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.06em',
              }}>
                {label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleRegenerate} style={{
              fontFamily: MONO, fontSize: 9, padding: '5px 10px',
              background: 'transparent', border: '1px solid #333',
              color: '#888', borderRadius: 3, cursor: 'pointer',
            }}>↺ REGENERATE</button>
            <button onClick={handleExportCSV} style={{
              fontFamily: MONO, fontSize: 9, padding: '5px 10px',
              background: 'transparent', border: '1px solid #333',
              color: '#888', borderRadius: 3, cursor: 'pointer',
            }}>↓ EXPORT CSV</button>
            <button onClick={() => setShowRaceManager(v => !v)} style={{
              fontFamily: MONO, fontSize: 9, padding: '5px 10px',
              background: showRaceManager ? '#ff6600' : 'transparent',
              border: `1px solid ${showRaceManager ? '#ff6600' : '#333'}`,
              color: showRaceManager ? '#fff' : '#888',
              borderRadius: 3, cursor: 'pointer',
            }}>+ ADD RACE</button>
          </div>
        </div>

        {/* Projected CTL badge */}
        {plan.projectedCTL > 0 && (
          <div style={{ fontFamily: MONO, fontSize: 9, color: '#555' }}>
            Projected peak CTL: <span style={{ color: '#ff6600', fontWeight: 700 }}>{plan.projectedCTL}</span>
          </div>
        )}

        {/* Warning chips */}
        {warnings.filter(w => !dismissedWarns.has(w)).map((warn, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(224,160,48,0.1)', border: '1px solid #e0a03044',
            borderRadius: 4, padding: '6px 10px', marginTop: 8,
            fontFamily: MONO, fontSize: 10, color: '#e0a030',
          }}>
            <span>⚠ {warn}</span>
            <button onClick={() => setDismissedWarns(s => new Set([...s, warn]))} style={{
              fontFamily: MONO, fontSize: 10, background: 'transparent',
              border: 'none', color: '#e0a03088', cursor: 'pointer', marginLeft: 8,
            }}>✕</button>
          </div>
        ))}

        {/* Race manager */}
        {showRaceManager && (
          <div style={{ borderTop: '1px solid #1a1a1a', marginTop: 12, paddingTop: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.1em', marginBottom: 8 }}>
              RACE CALENDAR
            </div>

            {/* Add race row */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
              <div>
                <label style={S.label}>DATE</label>
                <input type="date" value={raceForm.date}
                  onChange={e => setRaceForm(p => ({ ...p, date: e.target.value }))}
                  style={{ ...S.input, maxWidth: 140 }} />
              </div>
              <div>
                <label style={S.label}>NAME</label>
                <input type="text" value={raceForm.name} placeholder="Race name"
                  onChange={e => setRaceForm(p => ({ ...p, name: e.target.value }))}
                  style={{ ...S.input, maxWidth: 160 }} />
              </div>
              <div>
                <label style={S.label}>PRIORITY</label>
                <div style={{ display: 'flex', gap: 3 }}>
                  {['A','B','C'].map(p => (
                    <button key={p} onClick={() => setRaceForm(prev => ({ ...prev, priority: p }))} style={{
                      fontFamily: MONO, fontSize: 10, fontWeight: 700,
                      padding: '5px 8px', border: 'none', borderRadius: 3, cursor: 'pointer',
                      background: raceForm.priority === p ? '#ff6600' : '#1a1a1a',
                      color: raceForm.priority === p ? '#fff' : '#666',
                    }}>{p}</button>
                  ))}
                </div>
              </div>
              <button onClick={handleAddRace} style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 700,
                padding: '7px 14px', background: '#0064ff', border: 'none',
                color: '#fff', borderRadius: 3, cursor: 'pointer', marginBottom: 14,
              }}>ADD</button>
            </div>

            {/* Existing races */}
            {races.length === 0 && (
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#444' }}>No races added yet.</div>
            )}
            {races.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '5px 8px', background: '#0d0d0d', borderRadius: 3, marginBottom: 4,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 10, color: '#ccc', flex: 1 }}>{r.name}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: '#666' }}>{r.date}</span>
                <span style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 2,
                  background: r.priority === 'A' ? '#8b0000' : r.priority === 'B' ? '#4a3a00' : '#1a1a3a',
                  color: '#eee',
                }}>{r.priority}</span>
                <button onClick={() => handleRemoveRace(i)} style={{
                  fontFamily: MONO, fontSize: 10, background: 'transparent',
                  border: 'none', color: '#555', cursor: 'pointer',
                }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 52-week calendar ── */}
      <div className="sp-card" style={{ ...S.card, padding: '12px 0' }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.1em', marginBottom: 8, paddingLeft: 16 }}>
          52-WEEK PLAN — click a week to edit
        </div>

        {/* Phase legend */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingLeft: 16, marginBottom: 8 }}>
          {Object.entries(PHASE_COLORS).map(([phase, color]) => (
            <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, background: color, borderRadius: 1 }} />
              <span style={{ fontFamily: MONO, fontSize: 8, color: '#555' }}>{phase}</span>
            </div>
          ))}
        </div>

        <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'hidden' }}>
          <div style={{ position: 'relative', width: totalW, minHeight: CTL_H + TOTAL_COL_H }}>
            {/* CTL projection SVG */}
            <svg
              style={{
                position: 'absolute', top: 0, left: 0,
                width: totalW, height: CTL_H,
                pointerEvents: 'none', overflow: 'visible',
              }}
              viewBox={`0 0 ${totalW} ${CTL_H}`}
              preserveAspectRatio="none"
            >
              {ctlPoints && (
                <polyline
                  points={ctlPoints}
                  fill="none" stroke="#ff6600" strokeWidth="1.5" opacity="0.7"
                />
              )}
              {/* Today vertical marker */}
              {weeks.length > 0 && (() => {
                const tx = curWeek * colW + colW / 2
                return (
                  <line
                    x1={tx} y1="0" x2={tx} y2={CTL_H}
                    stroke="#ff6600" strokeWidth="1" strokeDasharray="3 3" opacity="0.6"
                  />
                )
              })()}
            </svg>

            {/* Week columns */}
            <div style={{
              position: 'absolute', top: CTL_H, left: 0,
              display: 'flex', height: TOTAL_COL_H,
            }}>
              {weeks.map((wk, i) => (
                <WeekColumn
                  key={wk.weekNum}
                  week={wk}
                  selected={selectedWeek === i}
                  isCurrent={i === curWeek}
                  onClick={() => setSelectedWeek(selectedWeek === i ? null : i)}
                  colW={colW}
                  maxTSS={maxTSS}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Week detail panel ── */}
      {selectedWeek !== null && plan.weeks[selectedWeek] && (
        <WeekDetailPanel
          week={plan.weeks[selectedWeek]}
          weekIndex={selectedWeek}
          allWeeks={plan.weeks}
          onUpdateTSS={handleUpdateTSS}
          onOpenBuilder={() => setBuilderWeek(plan.weeks[selectedWeek])}
        />
      )}
    </div>
  )
}
