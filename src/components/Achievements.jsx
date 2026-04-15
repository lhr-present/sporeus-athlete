import { useState, useEffect, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'

const BADGE_DEFS = [
  { id:'first_step',      icon:'👣', name:'First Step',       desc:'Log your first session' },
  { id:'week_warrior',    icon:'⚔️', name:'Week Warrior',      desc:'5+ sessions in one week' },
  { id:'month_master',    icon:'📅', name:'Month Master',      desc:'20+ sessions in one month' },
  { id:'century_club',    icon:'💯', name:'Century Club',      desc:'100 total sessions logged' },
  { id:'zone_hunter',     icon:'🎯', name:'Zone Hunter',       desc:'Log time in all 5 zones in one session' },
  { id:'iron_will',       icon:'🔩', name:'Iron Will',         desc:'7-day training block' },
  { id:'threshold_breaker',icon:'🧪',name:'Threshold Breaker', desc:'Complete any test protocol' },
  { id:'recovery_champ',  icon:'🛌', name:'Recovery Champ',    desc:'7 consecutive recovery logs' },
  { id:'dark_side',       icon:'🌙', name:'Dark Side',         desc:'Enable dark mode' },
  { id:'polyglot',        icon:'🌍', name:'Polyglot',          desc:'Switch interface language' },
  { id:'plan_compliant',  icon:'📋', name:'Plan Compliant',    desc:'80%+ plan compliance for 4 weeks' },
  { id:'heat_adapted',    icon:'◈',  name:'Heat Adapted',      desc:'Use the heat acclimatization calculator' },
]

export function checkAchievements({ log, recovery, testLog, dark, lang, planStatus, plan }) {
  const unlocked = {}
  const today = new Date().toISOString().slice(0,10)

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

  return unlocked
}

export default function Achievements({ log, dark, lang }) {
  const { t } = useContext(LangCtx)
  const [achievements, setAchievements] = useLocalStorage('sporeus-achievements', {})
  const [toast, setToast] = useState(null)
  const { recovery, testResults: testLog } = useData()
  const [plan] = useLocalStorage('sporeus-plan', null)
  const [planStatus] = useLocalStorage('sporeus-plan-status', {})
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const current = checkAchievements({ log, recovery, testLog, dark, lang, planStatus, plan })
    const newUnlocks = []
    Object.keys(current).forEach(id => {
      if (current[id] && !achievements[id]) newUnlocks.push(id)
    })
    if (newUnlocks.length > 0) {
      const updated = { ...achievements }
      newUnlocks.forEach(id => { updated[id] = new Date().toISOString().slice(0,10) })
      setAchievements(updated)
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

      <div className="sp-card" style={{ ...S.card, animationDelay:'192ms' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }} onClick={()=>setExpanded(!expanded)}>
          <div style={S.cardTitle}>🏅 ACHIEVEMENTS — {unlockedCount}/{total}</div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'100px', height:'5px', background:'var(--border)', borderRadius:'2px', overflow:'hidden' }}>
              <div style={{ width:`${unlockedCount/total*100}%`, height:'100%', background:'#f5c542', borderRadius:'2px' }}/>
            </div>
            <span style={{ ...S.mono, fontSize:'10px', color:'var(--muted)' }}>{expanded?'▲':'▼'}</span>
          </div>
        </div>
        {expanded && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:'8px', marginTop:'8px' }}>
            {BADGE_DEFS.map(b => {
              const date = achievements[b.id]
              return (
                <div key={b.id} style={{ padding:'10px', borderRadius:'5px', background:date?'var(--surface)':'var(--card-bg)', border:`1px solid ${date?'#f5c54244':'var(--border)'}`, opacity:date?1:0.45, textAlign:'center' }}>
                  <div style={{ fontSize:'22px', marginBottom:'4px' }}>{b.icon}</div>
                  <div style={{ ...S.mono, fontSize:'10px', fontWeight:600, color:date?'var(--text)':'var(--muted)', marginBottom:'2px' }}>{b.name}</div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'var(--muted)', lineHeight:1.4 }}>{b.desc}</div>
                  {date && <div style={{ ...S.mono, fontSize:'8px', color:'#f5c542', marginTop:'4px' }}>{date}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
