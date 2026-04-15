import { useState, useEffect, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'
import { calcLoad } from '../lib/formulas.js'

const BADGE_DEFS = [
  { id:'first_step',        icon:'👣', name:'First Step',          desc:'Log your first session' },
  { id:'week_warrior',      icon:'⚔️', name:'Week Warrior',         desc:'5+ sessions in one week' },
  { id:'month_master',      icon:'📅', name:'Month Master',         desc:'20+ sessions in one month' },
  { id:'century_club',      icon:'💯', name:'Century Club',         desc:'100 total sessions logged' },
  { id:'zone_hunter',       icon:'🎯', name:'Zone Hunter',          desc:'Log time in all 5 zones in one session' },
  { id:'iron_will',         icon:'🔩', name:'Iron Will',            desc:'7-day training block' },
  { id:'threshold_breaker', icon:'🧪', name:'Threshold Breaker',    desc:'Complete any test protocol' },
  { id:'recovery_champ',    icon:'🛌', name:'Recovery Champ',       desc:'7 consecutive recovery logs' },
  { id:'dark_side',         icon:'🌙', name:'Dark Side',            desc:'Enable dark mode' },
  { id:'polyglot',          icon:'🌍', name:'Polyglot',             desc:'Switch interface language' },
  { id:'plan_compliant',    icon:'📋', name:'Plan Compliant',       desc:'80%+ plan compliance for 4 weeks' },
  { id:'heat_adapted',      icon:'◈',  name:'Heat Adapted',         desc:'Use the heat acclimatization calculator' },
  { id:'ctl_80',            icon:'🔥', name:'High Fitness',         desc:'CTL reached 80 — trained athlete territory' },
]

export function checkAchievements({ log, recovery, testLog, dark, lang, planStatus, plan }) {
  const unlocked = {}

  if (log.length >= 1)   unlocked.first_step = true

  // Week warrior
  const weekMap = {}
  log.forEach(e => {
    const d = new Date(e.date); d.setDate(d.getDate() - d.getDay())
    const wk = d.toISOString().slice(0,10)
    weekMap[wk] = (weekMap[wk]||0) + 1
  })
  if (Object.values(weekMap).some(v=>v>=5)) unlocked.week_warrior = true

  // Month master
  const monthMap = {}
  log.forEach(e => { const m=e.date.slice(0,7); monthMap[m]=(monthMap[m]||0)+1 })
  if (Object.values(monthMap).some(v=>v>=20)) unlocked.month_master = true

  if (log.length >= 100) unlocked.century_club = true

  // Zone hunter
  if (log.some(e=>e.zones && e.zones.length===5 && e.zones.every(z=>z>0))) unlocked.zone_hunter = true

  // Iron will — 7-day training block
  const dates = [...new Set(log.map(e=>e.date))].sort()
  let longestBlock=0, cur=1
  for (let i=1;i<dates.length;i++) {
    const diff=(new Date(dates[i])-new Date(dates[i-1]))/864e5
    cur = diff===1?cur+1:1; if(cur>longestBlock) longestBlock=cur
  }
  if (longestBlock>=7) unlocked.iron_will = true

  if (testLog && testLog.length>0) unlocked.threshold_breaker = true

  // Recovery champ — 7 consecutive days
  if (recovery && recovery.length>=7) {
    const rdates = recovery.map(e=>e.date).sort().slice(-7)
    let consec = true
    for (let i=1;i<rdates.length;i++) {
      if ((new Date(rdates[i])-new Date(rdates[i-1]))/864e5 !== 1) { consec=false; break }
    }
    if (consec && rdates.length>=7) unlocked.recovery_champ = true
  }

  if (dark) unlocked.dark_side = true
  if (lang !== 'en') unlocked.polyglot = true

  // Plan compliant
  if (plan && planStatus) {
    const weekScores = plan.weeks?.slice(0,4).map((w,wi)=>{
      let total=0,done=0
      w.sessions.forEach((s,di)=>{
        if(s.type!=='Rest'&&s.duration>0){total++;const st=planStatus[`${wi}-${di}`];if(st==='done'||st==='modified')done++}
      })
      return total ? done/total : 0
    }) || []
    if (weekScores.length>=4 && weekScores.every(s=>s>=0.8)) unlocked.plan_compliant = true
  }

  // Heat adapted — check via localStorage flag
  try { if (localStorage.getItem('sporeus-heat-used')==='1') unlocked.heat_adapted = true } catch {}

  // CTL 80 — trained athlete territory
  if (log.length >= 7) {
    const { ctl } = calcLoad(log)
    if (ctl >= 80) unlocked.ctl_80 = true
  }

  return unlocked
}

// Format achievement unlock date as "Apr 2026"
function fmtAchDate(isoDate) {
  if (!isoDate) return ''
  const d = new Date(isoDate + 'T12:00:00')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[d.getMonth()]} ${d.getFullYear()}`
}

export default function Achievements({ log, dark, lang }) {
  const { t } = useContext(LangCtx)
  const [achievements, setAchievements] = useLocalStorage('sporeus-achievements', {})
  const [achievementTs, setAchievementTs] = useLocalStorage('sporeus-achievements-ts', {})
  const [toast, setToast] = useState(null)
  const { recovery, testResults: testLog } = useData()
  const [plan] = useLocalStorage('sporeus-plan', null)
  const [planStatus] = useLocalStorage('sporeus-plan-status', {})

  useEffect(() => {
    const current = checkAchievements({ log, recovery, testLog, dark, lang, planStatus, plan })
    const newUnlocks = []
    Object.keys(current).forEach(id => {
      if (current[id] && !achievements[id]) newUnlocks.push(id)
    })
    if (newUnlocks.length > 0) {
      const today = new Date().toISOString().slice(0,10)
      const updated = { ...achievements }
      const updatedTs = { ...achievementTs }
      newUnlocks.forEach(id => {
        updated[id] = today
        // Only write timestamp on first unlock — never overwrite
        if (!updatedTs[id]) updatedTs[id] = new Date().toISOString()
      })
      setAchievements(updated)
      setAchievementTs(updatedTs)
      const last = BADGE_DEFS.find(b=>b.id===newUnlocks[newUnlocks.length-1])
      if (last) { setToast(last); setTimeout(()=>setToast(null), 3500) }
    }
  }, [log.length, dark, lang, recovery.length, testLog.length])

  const unlockedCount = Object.keys(achievements).length
  const total = BADGE_DEFS.length

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div style={{ position:'fixed', top:'60px', right:'16px', zIndex:10002, background:'#0a0a0a', border:'1px solid #ff6600', borderRadius:'6px', padding:'12px 16px', fontFamily:"'IBM Plex Mono',monospace", maxWidth:'260px', animation:'slideUp 300ms ease-out' }}>
          <div style={{ fontSize:'10px', color:'#ff6600', fontWeight:600, marginBottom:'4px' }}>◈ ACHIEVEMENT UNLOCKED</div>
          <div style={{ fontSize:'18px', marginBottom:'2px' }}>{toast.icon}</div>
          <div style={{ fontSize:'12px', color:'#e5e5e5', fontWeight:600 }}>{toast.name}</div>
          <div style={{ fontSize:'10px', color:'#888' }}>{toast.desc}</div>
        </div>
      )}

      {/* Milestones grid — compact, logbook style */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', color:'#555', letterSpacing:'0.1em', marginBottom:'8px' }}>
          TRAINING MILESTONES — {unlockedCount}/{total}
        </div>
        <div style={{ width:'100%', height:'4px', background:'var(--border)', borderRadius:'2px', overflow:'hidden', marginBottom:'12px' }}>
          <div style={{ width:`${unlockedCount/total*100}%`, height:'100%', background:'#f5c542', borderRadius:'2px' }}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:'6px' }}>
          {BADGE_DEFS.map(b => {
            const date = achievements[b.id]
            const ts   = achievementTs[b.id]
            return (
              <div key={b.id} title={b.desc} style={{ padding:'8px 10px', borderRadius:'4px', background: date ? 'var(--surface)' : 'transparent', border:`1px solid ${date ? '#f5c54233' : 'var(--border)'}`, opacity: date ? 1 : 0.3, display:'flex', alignItems:'center', gap:'8px' }}>
                <span style={{ fontSize:'16px', flexShrink:0 }}>{b.icon}</span>
                {date ? (
                  <div>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'9px', fontWeight:600, color:'var(--text)', lineHeight:1.3 }}>{b.name}</div>
                    <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'8px', color:'#f5c542', marginTop:'1px' }}>{fmtAchDate(ts || date)}</div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// Returns the most recently unlocked achievement if within the last N days, else null
export function getRecentAchievement(days = 7) {
  try {
    const achievements = JSON.parse(localStorage.getItem('sporeus-achievements') || '{}')
    const ts = JSON.parse(localStorage.getItem('sporeus-achievements-ts') || '{}')
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0,10)
    // Find entries unlocked within the window
    const recent = Object.entries(achievements)
      .filter(([, date]) => date >= cutoffStr)
      .sort(([,a],[,b]) => b.localeCompare(a))
    if (!recent.length) return null
    const [id] = recent[0]
    const badge = BADGE_DEFS.find(b => b.id === id)
    if (!badge) return null
    return { ...badge, date: achievements[id] }
  } catch { return null }
}
