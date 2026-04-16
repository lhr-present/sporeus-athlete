// ─── TestHistoryGoal — test history sparkline + benchmark goal ────────────────
import { useState } from 'react'
import { S } from '../../styles.js'
import TestHistoryChart from './TestHistoryChart.jsx'

export default function TestHistoryGoal({ active, activeHistory }) {
  const [goals, setGoals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sporeus-test-goals') || '{}') } catch { return {} }
  })
  const [editGoal, setEditGoal] = useState('')
  const [showGoalEdit, setShowGoalEdit] = useState(false)

  const saveGoal = () => {
    const val = parseFloat(editGoal)
    if (!val) return
    const next = { ...goals, [active]: val }
    setGoals(next)
    localStorage.setItem('sporeus-test-goals', JSON.stringify(next))
    setEditGoal('')
    setShowGoalEdit(false)
  }

  const clearGoal = () => {
    const next = { ...goals }
    delete next[active]
    setGoals(next)
    localStorage.setItem('sporeus-test-goals', JSON.stringify(next))
    setShowGoalEdit(false)
  }

  if (activeHistory.length < 2) return null

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'90ms' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
        <div style={S.cardTitle}>TEST HISTORY — {active.toUpperCase().replace('_',' ')}</div>
        <button
          onClick={() => { setShowGoalEdit(g => !g); setEditGoal(goals[active] ? String(goals[active]) : '') }}
          style={{ ...S.mono, fontSize:'9px', padding:'3px 10px', border:'1px solid #0064ff44', background:'transparent', color:'#0064ff', borderRadius:'3px', cursor:'pointer', letterSpacing:'0.06em' }}>
          {goals[active] ? `GOAL: ${goals[active]}` : '+ SET GOAL'}
        </button>
      </div>

      {showGoalEdit && (
        <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'12px' }}>
          <input
            style={{ ...S.input, maxWidth:'120px' }}
            type="number"
            placeholder="Target value"
            value={editGoal}
            onChange={e => setEditGoal(e.target.value)}
          />
          <button onClick={saveGoal}
            style={{ ...S.mono, fontSize:'9px', padding:'4px 10px', background:'#0064ff', border:'none', color:'#fff', borderRadius:'3px', cursor:'pointer' }}>
            SAVE
          </button>
          {goals[active] && (
            <button onClick={clearGoal}
              style={{ ...S.mono, fontSize:'9px', padding:'4px 10px', background:'transparent', border:'1px solid #e0303044', color:'#e03030', borderRadius:'3px', cursor:'pointer' }}>
              CLEAR
            </button>
          )}
        </div>
      )}

      {/* Progress-to-goal bar */}
      {goals[active] && (() => {
        const current = parseFloat(activeHistory[activeHistory.length - 1].value)
        const goal    = parseFloat(goals[active])
        const first   = parseFloat(activeHistory[0].value)
        const gap     = ((goal - current) / Math.abs(goal) * 100).toFixed(1)
        const span    = goal - first
        const progress = span === 0 ? 100 : Math.min(100, Math.max(0, ((current - first) / span) * 100))
        const reached = current >= goal
        return (
          <div style={{ marginBottom:'12px', padding:'8px 10px', background:'rgba(0,0,0,0.3)', border:'1px solid var(--border)', borderRadius:'4px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
              <span style={{ ...S.mono, fontSize:'9px', color:'#888' }}>PROGRESS TO GOAL</span>
              <span style={{ ...S.mono, fontSize:'9px', color: reached ? '#5bc25b' : '#0064ff' }}>
                {reached ? '✓ GOAL REACHED' : `${Math.abs(parseFloat(gap))}% gap`}
              </span>
            </div>
            <div style={{ height:'5px', background:'#1e1e1e', borderRadius:'3px' }}>
              <div style={{ height:'100%', width:`${progress}%`, background: reached ? '#5bc25b' : '#0064ff', borderRadius:'3px', transition:'width 0.4s' }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:'4px' }}>
              <span style={{ ...S.mono, fontSize:'8px', color:'#444' }}>Start {first.toFixed(1)}</span>
              <span style={{ ...S.mono, fontSize:'8px', color:'#888' }}>Current {current.toFixed(1)}</span>
              <span style={{ ...S.mono, fontSize:'8px', color:'#f5c542' }}>Goal {goal}</span>
            </div>
          </div>
        )
      })()}

      <TestHistoryChart data={activeHistory} goal={goals[active]} />
      <div style={{ ...S.mono, fontSize:'8px', color:'#444', marginTop:'5px', textAlign:'right' }}>
        {activeHistory.length} results · {activeHistory[0].date} → {activeHistory[activeHistory.length-1].date}
      </div>
    </div>
  )
}
