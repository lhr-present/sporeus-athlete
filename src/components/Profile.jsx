import { useState, useEffect, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { ACTIVITY_MULTS } from '../lib/constants.js'
import { navyBF, mifflinBMR, calcLoad } from '../lib/formulas.js'
import { exportAllData, importAllData } from '../lib/storage.js'
import { Sparkline } from './ui.jsx'

function WeightHydration({ profile }) {
  const { t } = useContext(LangCtx)
  const [weightLog, setWeightLog] = useLocalStorage('sporeus-weight', [])
  const today = new Date().toISOString().slice(0,10)
  const [wInput, setWInput] = useState('')
  const [sweatPre, setSweatPre] = useState('')
  const [sweatPost, setSweatPost] = useState('')
  const [sweatFluid, setSweatFluid] = useState('')
  const [sweatDur, setSweatDur] = useState('')
  const [sweatResult, setSweatResult] = useState(null)
  const [raceTarget, setRaceTarget] = useState('')
  const [raceWeeks, setRaceWeeks] = useState('')

  const saveWeight = () => {
    const w = parseFloat(wInput)
    if (!w) return
    const updated = weightLog.filter(e=>e.date!==today)
    setWeightLog([...updated, {date:today,weight:w}].slice(-90))
    setWInput('')
  }

  const last30 = weightLog.slice(-30)
  const last7w  = weightLog.slice(-7).map(e=>e.weight)
  const avg7w   = last7w.length ? Math.round(last7w.reduce((s,v)=>s+v,0)/last7w.length*10)/10 : null
  const latest  = weightLog.length ? weightLog[weightLog.length-1] : null
  const prev    = weightLog.length > 1 ? weightLog[weightLog.length-2] : null
  const dehydWarn = latest && prev && ((prev.weight - latest.weight) / prev.weight * 100) > 2

  const calcSweat = () => {
    const pre=parseFloat(sweatPre), post=parseFloat(sweatPost), fl=parseFloat(sweatFluid)||0, dur=parseFloat(sweatDur)||60
    if (!pre||!post) return
    const rate = Math.round(((pre-post) + fl/1000) / (dur/60) * 100) / 100
    const per15 = Math.round(rate * 0.8 / 4 * 1000)
    setSweatResult({rate, per15})
  }

  const raceWeightFeasible = (() => {
    if (!raceTarget || !raceWeeks || !latest) return null
    const target = parseFloat(raceTarget), weeks = parseInt(raceWeeks)
    const diff = latest.weight - target
    if (diff <= 0) return { ok:true, msg:'Already at or below target!' }
    const weeklyLoss = diff / weeks
    const maxSafe = latest.weight * 0.01
    return { ok: weeklyLoss <= maxSafe, weeklyLoss: Math.round(weeklyLoss*100)/100, maxSafe: Math.round(maxSafe*100)/100 }
  })()

  return (
    <div>
      {/* Daily weight */}
      <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', marginBottom:'14px' }}>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>{t('weightL')}</label>
          <input style={S.input} type="number" step="0.1" placeholder="70.5" value={wInput}
            onChange={e=>setWInput(e.target.value)}/>
        </div>
        <button style={S.btn} onClick={saveWeight}>{t('weightSaveBtn')}</button>
      </div>
      {dehydWarn && (
        <div style={{ ...S.mono, fontSize:'11px', color:'#f5c542', padding:'6px 10px', background:'#f5c54211', borderRadius:'4px', marginBottom:'12px' }}>
          ⚠ {t('weightDehydWarn')}
        </div>
      )}
      {last30.length > 0 && (
        <div style={{ marginBottom:'16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
            <div style={{ ...S.mono, fontSize:'10px', color:'#888', letterSpacing:'0.06em' }}>{t('weightTrend')}</div>
            {avg7w && <div style={{ ...S.mono, fontSize:'11px', color:'#0064ff' }}>{t('weight7avg')}: {avg7w} kg</div>}
          </div>
          <Sparkline data={last30.map(e=>e.weight)} w={240} h={36}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'2px' }}>
            <span>{last30[0]?.date?.slice(5)}</span><span>{last30[last30.length-1]?.date?.slice(5)}</span>
          </div>
        </div>
      )}

      {/* Sweat rate */}
      <div style={{ ...S.mono, fontSize:'10px', color:'#888', letterSpacing:'0.06em', marginBottom:'8px' }}>{t('sweatTitle')}</div>
      <div style={S.row}>
        <div style={{ flex:'1 1 100px' }}>
          <label style={S.label}>{t('sweatPre')}</label>
          <input style={S.input} type="number" step="0.1" placeholder="70.5" value={sweatPre} onChange={e=>setSweatPre(e.target.value)}/>
        </div>
        <div style={{ flex:'1 1 100px' }}>
          <label style={S.label}>{t('sweatPost')}</label>
          <input style={S.input} type="number" step="0.1" placeholder="69.8" value={sweatPost} onChange={e=>setSweatPost(e.target.value)}/>
        </div>
        <div style={{ flex:'1 1 100px' }}>
          <label style={S.label}>{t('sweatFluid')}</label>
          <input style={S.input} type="number" placeholder="500" value={sweatFluid} onChange={e=>setSweatFluid(e.target.value)}/>
        </div>
        <div style={{ flex:'1 1 100px' }}>
          <label style={S.label}>{t('sweatDur')}</label>
          <input style={S.input} type="number" placeholder="60" value={sweatDur} onChange={e=>setSweatDur(e.target.value)}/>
        </div>
      </div>
      <button style={{ ...S.btnSec, marginTop:'10px' }} onClick={calcSweat}>{t('sweatCalcBtn')}</button>
      {sweatResult && (
        <div style={{ ...S.mono, fontSize:'12px', marginTop:'10px', lineHeight:1.7 }}>
          <span style={{ color:'#ff6600', fontWeight:600 }}>{t('sweatResult')}: {sweatResult.rate} L/hr</span>
          <br/>
          <span style={{ color:'#888', fontSize:'10px' }}>Aim to {t('sweatReplace')}: {sweatResult.per15} ml every 15min</span>
        </div>
      )}

      {/* Race weight target */}
      {latest && (
        <div style={{ marginTop:'16px' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#888', letterSpacing:'0.06em', marginBottom:'8px' }}>{t('raceWeightTitle')}</div>
          <div style={S.row}>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>{t('raceWeightTarget')}</label>
              <input style={S.input} type="number" step="0.5" placeholder={(latest.weight-2).toFixed(1)} value={raceTarget} onChange={e=>setRaceTarget(e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>{t('raceWeeksTil')}</label>
              <input style={S.input} type="number" placeholder="12" value={raceWeeks} onChange={e=>setRaceWeeks(e.target.value)}/>
            </div>
          </div>
          {raceWeightFeasible && (
            <div style={{ ...S.mono, fontSize:'11px', marginTop:'8px', padding:'6px 10px', borderRadius:'4px',
              background: raceWeightFeasible.ok ? '#5bc25b11' : '#e0303011',
              color: raceWeightFeasible.ok ? '#5bc25b' : '#e03030' }}>
              {raceWeightFeasible.ok
                ? `✓ ${t('raceWeightOk')} — ${raceWeightFeasible.weeklyLoss} kg/week (max safe: ${raceWeightFeasible.maxSafe} kg/week)`
                : `✗ ${t('raceWeightAggressive')} — ${raceWeightFeasible.weeklyLoss} kg/week needed (max safe: ${raceWeightFeasible.maxSafe} kg/week)`}
            </div>
          )}
          <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'6px' }}>Max safe loss: 0.5–1% body weight per week</div>
        </div>
      )}
    </div>
  )
}

function BodyComp({ profile, setProfile }) {
  const { t } = useContext(LangCtx)
  const [gender, setGender] = useState(profile.gender||'male')
  const [neck,   setNeck]   = useState(profile.neck||'')
  const [waist,  setWaist]  = useState(profile.waist||'')
  const [hip,    setHip]    = useState(profile.hip||'')
  const [result, setResult] = useState(null)
  const [compErr, setCompErr] = useState('')

  const calc = () => {
    setCompErr('')
    const h=parseFloat(profile.height||0), w=parseFloat(profile.weight||0)
    const n=parseFloat(neck), wa=parseFloat(waist), hi=parseFloat(hip)
    const missing = []
    if (!h) missing.push('height (in profile)')
    if (!w) missing.push('weight (in profile)')
    if (!n) missing.push('neck')
    if (!wa) missing.push('waist')
    if (gender==='female'&&!hi) missing.push('hip')
    if (missing.length) { setCompErr(`Missing: ${missing.join(', ')}`); return }
    const bf = navyBF(n, wa, hi, h, gender)
    const fat = Math.round(w * bf / 100 * 10) / 10
    const lean = Math.round((w - fat) * 10) / 10
    const bmi = Math.round(w / Math.pow(h/100, 2) * 10) / 10
    setResult({ bf, fat, lean, bmi, leanPct: Math.round(lean/w*100) })
    setProfile(prev => ({ ...prev, gender, neck:String(n), waist:String(wa), hip:String(hi) }))
  }

  return (
    <div>
      <div style={S.row}>
        <div style={{ flex:'1 1 120px' }}>
          <label style={S.label}>{t('genderL')}</label>
          <select style={S.select} value={gender} onChange={e=>setGender(e.target.value)}>
            <option value="male">Male / Erkek</option>
            <option value="female">Female / Kadın</option>
          </select>
        </div>
        <div style={{ flex:'1 1 100px' }}>
          <label style={S.label}>{t('neckL')}</label>
          <input style={S.input} type="number" placeholder="37" value={neck} onChange={e=>setNeck(e.target.value)}/>
        </div>
        <div style={{ flex:'1 1 100px' }}>
          <label style={S.label}>{t('waistL')}</label>
          <input style={S.input} type="number" placeholder="82" value={waist} onChange={e=>setWaist(e.target.value)}/>
        </div>
        {gender==='female' && (
          <div style={{ flex:'1 1 100px' }}>
            <label style={S.label}>{t('hipL')}</label>
            <input style={S.input} type="number" placeholder="98" value={hip} onChange={e=>setHip(e.target.value)}/>
          </div>
        )}
      </div>
      <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'6px', marginBottom:'12px' }}>
        Uses HEIGHT & WEIGHT from profile above.
      </div>
      <button style={S.btn} onClick={calc}>{t('calcCompBtn')}</button>
      {compErr && <div style={{ ...S.mono, fontSize:'11px', color:'#e03030', marginTop:'8px' }}>⚠ {compErr}</div>}
      {result && (
        <div style={{ marginTop:'16px' }}>
          <div style={S.row}>
            {[
              {l:t('bfPctL'), v:`${result.bf}%`, c:'#f08c00'},
              {l:t('leanMassL'), v:`${result.lean} kg`, c:'#5bc25b'},
              {l:t('fatMassL'), v:`${result.fat} kg`, c:'#e03030'},
              {l:t('bmiLbl'), v:result.bmi, c:'#4a90d9'},
            ].map(({l,v,c})=>(
              <div key={l} style={{ ...S.stat, flex:'1 1 90px' }}>
                <span style={{ ...S.statVal, color:c, fontSize:'18px' }}>{v}</span>
                <span style={S.statLbl}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:'12px' }}>
            <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginBottom:'4px' }}>LEAN vs FAT</div>
            <div style={{ display:'flex', height:'10px', borderRadius:'3px', overflow:'hidden', background:'var(--border)' }}>
              <div style={{ width:`${result.leanPct}%`, background:'#5bc25b', transition:'width 400ms ease-out' }}/>
              <div style={{ width:`${100-result.leanPct}%`, background:'#f08c00' }}/>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'3px' }}>
              <span>Lean {result.leanPct}%</span><span>Fat {100-result.leanPct}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NutritionEstimator({ profile }) {
  const { t } = useContext(LangCtx)
  const [actIdx, setActIdx] = useState(2)
  const w = parseFloat(profile.weight||0), h = parseFloat(profile.height||0)
  const a = parseFloat(profile.age||0), g = profile.gender||'male'
  const bmr  = w&&h&&a ? mifflinBMR(w,h,a,g) : null
  const tdee = bmr ? Math.round(bmr * ACTIVITY_MULTS[actIdx].mult) : null
  const protLow = w ? Math.round(w*1.6) : null, protHi = w ? Math.round(w*2.2) : null
  const carbLow = w ? Math.round(w*5)   : null, carbHi  = w ? Math.round(w*7)   : null

  const fuelRows = [
    ['< 60 min', '30 g/hr'],
    ['60–150 min', '60 g/hr'],
    ['> 150 min', '90 g/hr (glucose+fructose mix)'],
  ]

  return (
    <div>
      {!bmr && (
        <div style={{ ...S.mono, fontSize:'11px', color:'#e03030', marginBottom:'12px' }}>
          Missing in profile: {[!w&&'weight',!h&&'height',!a&&'age'].filter(Boolean).join(', ') || 'gender'}. Add them above to see estimates.
        </div>
      )}
      <div style={{ flex:'1 1 220px', marginBottom:'14px' }}>
        <label style={S.label}>{t('activityL')}</label>
        <select style={S.select} value={actIdx} onChange={e=>setActIdx(+e.target.value)}>
          {ACTIVITY_MULTS.map((m,i)=><option key={i} value={i}>{m.label} (×{m.mult})</option>)}
        </select>
      </div>
      {bmr && (
        <>
          <div style={S.row}>
            {[
              {l:t('bmrL'),v:`${bmr} kcal`,c:'#4a90d9'},
              {l:t('tdeeL'),v:`${tdee} kcal`,c:'#ff6600'},
              {l:t('proteinL'),v:`${protLow}–${protHi}g`,c:'#5bc25b'},
              {l:t('carbL'),v:`${carbLow}–${carbHi}g`,c:'#f5c542'},
            ].map(({l,v,c})=>(
              <div key={l} style={{ ...S.stat, flex:'1 1 110px' }}>
                <span style={{ ...S.statVal, color:c, fontSize:'15px' }}>{v}</span>
                <span style={S.statLbl}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'6px', marginBottom:'14px' }}>
            Protein: 1.6–2.2 g/kg · Carbs: 5–7 g/kg (endurance) · Mifflin-St Jeor BMR
          </div>
          <div style={{ ...S.cardTitle, marginBottom:'8px' }}>{t('raceFuelTitle')}</div>
          <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', marginBottom:'8px' }}>
            {t('carbLoadL')}: <strong>8–12 g/kg/day</strong>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'11px' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)', color:'#888', fontSize:'9px' }}>
                <th style={{ textAlign:'left', padding:'4px 0 6px', fontWeight:600 }}>DURATION</th>
                <th style={{ textAlign:'right', padding:'4px 0 6px', fontWeight:600 }}>CARBS</th>
              </tr>
            </thead>
            <tbody>
              {fuelRows.map(([dur,carb])=>(
                <tr key={dur} style={{ borderBottom:'1px solid #f5f5f5' }}>
                  <td style={{ padding:'5px 0', color:'var(--sub)' }}>{dur}</td>
                  <td style={{ textAlign:'right', padding:'5px 0', color:'#ff6600', fontWeight:600 }}>{carb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

function AthleteCard({ profile, log }) {
  const { t } = useContext(LangCtx)
  const [status, setStatus] = useState(null)
  const last28 = log.slice(-28)
  const totalH = Math.round(last28.reduce((s,e)=>s+(e.duration||0),0)/60)
  const sessions28 = last28.length
  const avgRPE28 = sessions28 ? (last28.reduce((s,e)=>s+(e.rpe||0),0)/sessions28).toFixed(1) : '—'
  const { tsb } = calcLoad(log)

  const downloadCard = async () => {
    let fm = 'monospace'
    try {
      const f = new FontFace('IBM Plex Mono','url(https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n5iQ.woff2)')
      await f.load(); document.fonts.add(f); fm = '"IBM Plex Mono"'
    } catch {}
    const c = document.createElement('canvas')
    c.width=400; c.height=580
    const ctx = c.getContext('2d')
    ctx.fillStyle='#0a0a0a'; ctx.fillRect(0,0,400,580)
    ctx.fillStyle='#ff6600'; ctx.fillRect(0,0,400,4)
    ctx.fillStyle='#ff6600'; ctx.font=`bold 22px ${fm}`; ctx.fillText(profile.name||'ATHLETE',24,52)
    ctx.fillStyle='#888'; ctx.font=`12px ${fm}`; ctx.fillText((profile.sport||'ENDURANCE').toUpperCase(),24,72)
    ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(24,85); ctx.lineTo(376,85); ctx.stroke()
    const stats=[
      ['VO₂max',profile.vo2max?`${profile.vo2max} mL/kg/min`:'—'],
      ['FTP',profile.ftp?`${profile.ftp}W`:'—'],
      ['Max HR',profile.maxhr?`${profile.maxhr} bpm`:'—'],
      ['Age',profile.age||'—'],
    ]
    stats.forEach(([l,v],i)=>{
      const x=24+(i%2)*190, y=130+Math.floor(i/2)*70
      ctx.fillStyle='#888'; ctx.font=`10px ${fm}`; ctx.fillText(l.toUpperCase(),x,y-14)
      ctx.fillStyle='#ff6600'; ctx.font=`bold 20px ${fm}`; ctx.fillText(String(v),x,y)
    })
    ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(24,290); ctx.lineTo(376,290); ctx.stroke()
    ctx.fillStyle='#888'; ctx.font=`10px ${fm}`; ctx.fillText('4-WEEK SUMMARY',24,314)
    const sums=[['HOURS',`${totalH}h`],['SESSIONS',sessions28],['AVG RPE',avgRPE28]]
    sums.forEach(([l,v],i)=>{
      const x=24+i*120
      ctx.fillStyle='#e5e5e5'; ctx.font=`bold 18px ${fm}`; ctx.fillText(String(v),x,348)
      ctx.fillStyle='#888'; ctx.font=`9px ${fm}`; ctx.fillText(l,x,366)
    })
    ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(24,390); ctx.lineTo(376,390); ctx.stroke()
    ctx.fillStyle='#888'; ctx.font=`10px ${fm}`; ctx.fillText('CURRENT FORM (TSB)',24,414)
    const tsbColor = tsb>5?'#5bc25b':tsb<-10?'#e03030':'#f5c542'
    ctx.fillStyle=tsbColor; ctx.font=`bold 28px ${fm}`; ctx.fillText((tsb>=0?'+':'')+tsb,24,448)
    ctx.strokeStyle='#333'; ctx.beginPath(); ctx.moveTo(24,490); ctx.lineTo(376,490); ctx.stroke()
    ctx.fillStyle='#555'; ctx.font=`10px ${fm}`; ctx.fillText('SPOREUS ATHLETE CONSOLE — SPOREUS.COM',24,514)
    ctx.fillStyle='#444'; ctx.font=`9px ${fm}`; ctx.fillText('Built on EŞİK / THRESHOLD science — Hüseyin Akbulut 2026',24,534)
    c.toBlob(blob=>{
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a'); a.href=url; a.download='sporeus-athlete-card.png'; a.click()
      URL.revokeObjectURL(url)
    })
  }

  const share = async () => {
    const text=`${profile.name||'Athlete'} | ${profile.sport||'Endurance'} | VO₂max: ${profile.vo2max||'?'} | ${sessions28} sessions / 4 weeks — via Sporeus Athlete Console`
    try {
      if (navigator.share) await navigator.share({ title:'Sporeus Athlete Card', text, url:'https://sporeus.com' })
      else { await navigator.clipboard.writeText(text); setStatus('copied'); setTimeout(()=>setStatus(null),2000) }
    } catch {}
  }

  return (
    <div style={{ ...S.card, background:'#0a0a0a', border:'1px solid #333', borderRadius:'8px', padding:'20px' }}>
      <div style={{ ...S.cardTitle, color:'#ff6600', borderColor:'#333' }}>SHAREABLE ATHLETE CARD</div>
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
        <button style={S.btn} onClick={downloadCard}>↓ Download PNG</button>
        <button style={{ ...S.btnSec, borderColor:'#555', color:'#ccc' }} onClick={share}>
          {status==='copied'?'✓ COPIED':'⬡ Share'}
        </button>
      </div>
      <div style={{ ...S.mono, fontSize:'10px', color:'var(--sub)', marginTop:'10px' }}>
        Card includes: name, sport, VO₂max, FTP, max HR, 4-week summary, form badge.
      </div>
    </div>
  )
}

function NotifReminders() {
  const [reminders, setReminders] = useLocalStorage('sporeus-reminders', { train:false, trainTime:'18:00', recovery:false })
  const supported = typeof window !== 'undefined' && 'Notification' in window

  const toggleTrain = async () => {
    if (!reminders.train) {
      if (supported) await Notification.requestPermission()
    }
    setReminders(r=>({...r, train:!r.train}))
  }
  const toggleRecovery = async () => {
    if (!reminders.recovery) {
      if (supported) await Notification.requestPermission()
    }
    setReminders(r=>({...r, recovery:!r.recovery}))
  }

  useEffect(() => {
    if (!supported) return
    const interval = setInterval(() => {
      if (Notification.permission !== 'granted') return
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      if (reminders.train && hhmm === reminders.trainTime) {
        new Notification('Sporeus — Time to train!', { body: 'Your training reminder is ready. Check your plan.', icon:'/sporeus-athlete/pwa-192x192.png' })
      }
      if (reminders.recovery && hhmm === '08:00') {
        const today = new Date().toISOString().slice(0,10)
        try {
          const rec = JSON.parse(localStorage.getItem('sporeus-recovery')||'[]')
          if (!rec.find(e=>e.date===today)) {
            new Notification('Sporeus — Log your recovery', { body: 'How did you sleep? Fill in your daily wellness check.', icon:'/sporeus-athlete/pwa-192x192.png' })
          }
        } catch {}
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [reminders, supported])

  if (!supported) return (
    <div style={{ ...S.mono, fontSize:'11px', color:'#aaa' }}>Notifications not available in this browser.</div>
  )

  return (
    <div>
      {[
        { label:'Training reminder', key:'train', toggle:toggleTrain, active:reminders.train },
        { label:'Recovery check-in at 08:00', key:'recovery', toggle:toggleRecovery, active:reminders.recovery },
      ].map(({label,key,toggle,active})=>(
        <div key={key} style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
          <button onClick={toggle} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', fontWeight:600, padding:'4px 12px', borderRadius:'3px', border:`1px solid ${active?'#ff6600':'#e0e0e0'}`, background:active?'#ff6600':'transparent', color:active?'#fff':'#888', cursor:'pointer' }}>
            {active?'ON':'OFF'}
          </button>
          <span style={{ ...S.mono, fontSize:'12px', color:'var(--text)' }}>{label}</span>
          {key==='train' && active && (
            <input type="time" value={reminders.trainTime} onChange={e=>setReminders(r=>({...r,trainTime:e.target.value}))}
              style={{ ...S.input, width:'110px', padding:'4px 8px', fontSize:'12px' }}/>
          )}
        </div>
      ))}
    </div>
  )
}

export default function Profile({ profile, setProfile, log }) {
  const { t } = useContext(LangCtx)
  const [local, setLocal] = useState(profile)
  const [status, setStatus] = useState(null)
  const [coachMode, setCoachMode] = useLocalStorage('sporeus-coach-mode', false)

  useEffect(()=>{ setLocal(profile) },[profile])

  const save = () => { setProfile(local); setStatus('saved'); setTimeout(()=>setStatus(null),2000) }

  const share = async () => {
    const text=`${local.name||'Athlete'} | ${local.sport||''} | VO\u2082max: ${local.vo2max||'?'} | FTP: ${local.ftp||'?'}W | Goal: ${local.goal||''} — via Sporeus Athlete Console`
    try {
      if (navigator.share) {
        await navigator.share({ title:'Sporeus Athlete Profile', text, url:'https://sporeus.com' })
      } else {
        await navigator.clipboard.writeText(text)
        setStatus('copied'); setTimeout(()=>setStatus(null),2000)
      }
    } catch {}
  }

  const FIELDS = [
    {k:'name',lk:'nameL',ph:'Athlete name'},{k:'age',lk:'ageL',ph:'32',type:'number'},
    {k:'weight',lk:'weightL',ph:'70',type:'number'},{k:'sport',lk:'sportL',ph:'Running / Triathlon'},
    {k:'maxhr',lk:'maxHRIn',ph:'185',type:'number'},{k:'ftp',lk:'ftpL',ph:'280',type:'number'},
    {k:'vo2max',lk:'vo2L',ph:'55',type:'number'},{k:'threshold',lk:'threshPaceL',ph:'4:30'},
    {k:'goal',lk:'goalL',ph:'Sub-3h marathon Istanbul 2026'},
  ]

  const handleExport = () => {
    const json = exportAllData()
    const blob = new Blob([json], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0,10)
    a.href = url; a.download = `sporeus-backup-${date}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const ok = importAllData(ev.target.result)
      if (ok) window.location.reload()
      else alert('Import failed — invalid file.')
    }
    reader.readAsText(file)
  }

  const handleReset = () => {
    if (confirm('Delete ALL Sporeus data? This cannot be undone.')) {
      Object.keys(localStorage).filter(k=>k.startsWith('sporeus')).forEach(k=>localStorage.removeItem(k))
      window.location.reload()
    }
  }

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('profileTitle')}</div>
        <div style={S.row}>
          {FIELDS.map(f=>(
            <div key={f.k} style={{ flex:'1 1 200px' }}>
              <label style={S.label}>{t(f.lk)}</label>
              <input style={S.input} type={f.type||'text'} placeholder={f.ph}
                value={local[f.k]||''} onChange={e=>setLocal({...local,[f.k]:e.target.value})}/>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:'10px', marginTop:'16px' }}>
          <button style={S.btn} onClick={save}>{status==='saved'?t('savedMsg'):t('saveProfileBtn')}</button>
          <button style={S.btnSec} onClick={share}>{status==='copied'?t('copiedMsg'):t('shareBtn')}</button>
        </div>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
        <div style={S.cardTitle}>{t('aboutTitle')}</div>
        <div style={{ fontSize:'14px', lineHeight:1.8, color:'var(--text)' }}>
          <p style={{ marginTop:0 }}>A Bloomberg Terminal-inspired training tool for endurance athletes. Built on the science behind <strong>E\u015e\u0130K / THRESHOLD</strong> \u2014 Turkey\u2019s first comprehensive endurance science book.</p>
          <p style={{ marginBottom:0 }}>
            <a href="https://sporeus.com/huseyin-akbulut/" target="_blank" rel="noreferrer"
              style={{ color:'#0064ff', textDecoration:'none', fontWeight:600 }}>H\u00fcseyin Akbulut</a>
            {' '}\u2014 BSc &amp; MSc Sport Science, Marmara University \u00b7{' '}
            <a href="https://sporeus.com/esik/" target="_blank" rel="noreferrer" style={{ color:'#ff6600', textDecoration:'none' }}>E\u015e\u0130K Kitab\u0131</a>
          </p>
        </div>
      </div>

      <AthleteCard profile={local} log={log}/>

      <div className="sp-card" style={{ ...S.card, animationDelay:'65ms' }}>
        <div style={S.cardTitle}>REMINDERS / HATIRLATICLAR</div>
        <NotifReminders/>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'75ms' }}>
        <div style={S.cardTitle}>{t('bodyCompTitle')}</div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginBottom:'12px' }}>{t('navyMethodNote')}</div>
        <BodyComp profile={local} setProfile={setLocal}/>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'85ms' }}>
        <div style={S.cardTitle}>{t('nutritionTitle')}</div>
        <NutritionEstimator profile={local}/>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'92ms' }}>
        <div style={S.cardTitle}>{t('weightTitle')}</div>
        <WeightHydration profile={local}/>
      </div>

      <div className="sp-card" style={{ ...S.card, background:'#0a0a0a', animationDelay:'100ms' }}>
        <div style={{ ...S.cardTitle, color:'#ff6600', borderColor:'#333' }}>{t('installTitle')}</div>
        <div style={{ ...S.mono, fontSize:'12px', lineHeight:1.9, color:'#ccc' }}>
          <div>📱 <strong style={{ color:'#fff' }}>iOS:</strong> Safari \u2192 Share \u2192 Add to Home Screen</div>
          <div>🤖 <strong style={{ color:'#fff' }}>Android:</strong> Chrome menu \u2192 Install App</div>
          <div>💻 <strong style={{ color:'#fff' }}>Desktop:</strong> Address bar \u2192 Install icon</div>
          <div style={{ color:'var(--sub)', fontSize:'10px', marginTop:'6px' }}>Works fully offline once installed.</div>
        </div>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'108ms', borderLeft:`3px solid ${coachMode?'#0064ff':'var(--border)'}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={S.cardTitle}>COACH MODE</div>
          <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', ...S.mono, fontSize:'11px', color:coachMode?'#0064ff':'var(--muted)' }}>
            <input type="checkbox" checked={coachMode} onChange={e=>setCoachMode(e.target.checked)} style={{ accentColor:'#0064ff', width:'16px', height:'16px' }}/>
            {coachMode ? '◈ ACTIVE' : 'OFF'}
          </label>
        </div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginTop:'6px', lineHeight:1.6 }}>
          Import athlete JSON exports and view their dashboards, create plans, track compliance.
          <br/>File-based · No server · No API keys · Zero tracking
        </div>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'110ms' }}>
        <div style={S.cardTitle}>DATA MANAGEMENT</div>
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          <button style={S.btn} onClick={handleExport}>↓ Export All Data</button>
          <label style={{ ...S.btnSec, cursor:'pointer', display:'inline-flex', alignItems:'center' }}>
            ↑ Import Data
            <input type="file" accept=".json" onChange={handleImport} style={{ display:'none' }}/>
          </label>
          <button style={{ ...S.btnSec, color:'#e03030', borderColor:'#e03030' }} onClick={handleReset}>✕ Reset All Data</button>
        </div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'10px' }}>
          Export backs up all training data, plans, and settings as JSON. Import restores a previous backup.
        </div>
      </div>
    </div>
  )
}
