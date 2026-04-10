import { useState, useEffect, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { WELLNESS_FIELDS } from '../lib/constants.js'
import { Sparkline } from './ui.jsx'
import InjuryTracker from './InjuryTracker.jsx'
import MentalTools from './MentalTools.jsx'
import { predictInjuryRisk } from '../lib/intelligence.js'

export default function Recovery() {
  const { t } = useContext(LangCtx)
  const [entries, setEntries] = useLocalStorage('sporeus-recovery', [])
  const [profileLS] = useLocalStorage('sporeus_profile', {})
  const [log] = useLocalStorage('sporeus_log', [])
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const isAdvanced = profileLS?.athleteLevel === 'advanced' || profileLS?.athleteLevel === 'elite'
  const today = new Date().toISOString().slice(0,10)
  const todayEntry = entries.find(e=>e.date===today)
  const defVals = { sleep:3, soreness:3, energy:3, mood:3, stress:3, sleepHrs:'', bedtime:'', wake:'', lactate:'', restingHR:'' }
  const [form, setForm] = useState(todayEntry ? { ...defVals, ...todayEntry } : { ...defVals })

  useEffect(() => {
    const e = entries.find(x=>x.date===today)
    setForm(e ? { ...defVals, ...e } : { ...defVals })
  }, [today])

  // Auto-calculate sleep hours from bed/wake times
  const calcSleepHrs = (bed, wk) => {
    if (!bed || !wk) return ''
    const [bh,bm] = bed.split(':').map(Number)
    const [wh,wm] = wk.split(':').map(Number)
    let mins = (wh*60+wm) - (bh*60+bm)
    if (mins < 0) mins += 1440
    return String(Math.round(mins/60*2)/2)
  }

  const handleBedWake = (field, val) => {
    const newForm = { ...form, [field]: val }
    const bed = field==='bedtime' ? val : form.bedtime
    const wk  = field==='wake'    ? val : form.wake
    const auto = calcSleepHrs(bed, wk)
    if (auto) newForm.sleepHrs = auto
    setForm(newForm)
  }

  const score = Math.round(Object.values({sleep:form.sleep,soreness:form.soreness,energy:form.energy,mood:form.mood,stress:form.stress}).reduce((s,v)=>s+v,0)/5*20)
  const readiness = score>=75?{label:t('goLabel'),color:'#5bc25b'}:score>=50?{label:t('monitorLabel'),color:'#f5c542'}:{label:t('restLabel'),color:'#e03030'}

  const save = () => {
    const entry = { date:today, ...form, score }
    const updated = entries.filter(e=>e.date!==today)
    setEntries([...updated, entry].slice(-90))
  }

  const last7scores = entries.slice(-7).map(e=>e.score)
  const last7sleep  = entries.slice(-7).map(e=>parseFloat(e.sleepHrs)||0)
  const avg7sleep   = last7sleep.length ? Math.round(last7sleep.reduce((s,v)=>s+v,0)/last7sleep.length*10)/10 : 0
  const showSleepWarn = avg7sleep > 0 && avg7sleep < 7 && score < 60

  return (
    <div className="sp-fade">
      {todayEntry && (
        <div className="sp-card" style={{ ...S.card, borderLeft:`4px solid ${readiness.color}`, animationDelay:'0ms', ...S.mono, fontSize:'12px', color:'#888' }}>
          {t('alreadyLoggedMsg')}
        </div>
      )}

      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('wellnessTitle')} — {today}</div>
        {WELLNESS_FIELDS.map(field=>(
          <div key={field.key} style={{ marginBottom:'16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <label style={{ ...S.label, marginBottom:0 }}>{t(field.lk)}</label>
              <span style={{ ...S.mono, fontSize:'11px', color:'#888' }}>{form[field.key]}/5</span>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              {field.emoji.map((em,i)=>(
                <button key={i} onClick={()=>setForm({...form,[field.key]:i+1})}
                  style={{ fontSize:'20px', padding:'6px 10px', borderRadius:'6px', border:`2px solid ${form[field.key]===i+1?'#ff6600':'#e0e0e0'}`, background:form[field.key]===i+1?'#fff3eb':'#fff', cursor:'pointer', transition:'all 0.15s', lineHeight:1 }}>
                  {em}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Sleep details */}
        <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginBottom:'8px', marginTop:'4px', letterSpacing:'0.06em' }}>SLEEP DETAILS (OPTIONAL)</div>
        <div style={S.row}>
          <div style={{ flex:'1 1 110px' }}>
            <label style={S.label}>{t('sleepHrsL')}</label>
            <input style={S.input} type="number" step="0.5" min="0" max="12" placeholder="7.5"
              value={form.sleepHrs} onChange={e=>setForm({...form,sleepHrs:e.target.value})}/>
          </div>
          <div style={{ flex:'1 1 110px' }}>
            <label style={S.label}>{t('bedtimeL')}</label>
            <input style={S.input} type="time" value={form.bedtime}
              onChange={e=>handleBedWake('bedtime',e.target.value)}/>
          </div>
          <div style={{ flex:'1 1 110px' }}>
            <label style={S.label}>{t('wakeL')}</label>
            <input style={S.input} type="time" value={form.wake}
              onChange={e=>handleBedWake('wake',e.target.value)}/>
          </div>
        </div>
        {form.bedtime && form.wake && (
          <div style={{ ...S.mono, fontSize:'10px', color:'#5bc25b', marginTop:'4px' }}>
            {t('sleepAutoNote')}: {form.sleepHrs}h
          </div>
        )}

        {/* Advanced/Elite only: blood lactate + resting HR */}
        {isAdvanced && (
          <div style={{ marginTop:'14px' }}>
            <div style={{ ...S.mono, fontSize:'10px', color:'#4a90d9', letterSpacing:'0.06em', marginBottom:'8px' }}>
              ◈ ADVANCED METRICS
            </div>
            <div style={S.row}>
              <div style={{ flex:'1 1 130px' }}>
                <label style={S.label}>BLOOD LACTATE (mmol/L)</label>
                <input style={S.input} type="number" step="0.1" min="0" max="20" placeholder="1.8"
                  value={form.lactate} onChange={e=>setForm({...form,lactate:e.target.value})}/>
              </div>
              <div style={{ flex:'1 1 130px' }}>
                <label style={S.label}>RESTING HR (bpm)</label>
                <input style={S.input} type="number" min="30" max="100" placeholder="48"
                  value={form.restingHR} onChange={e=>setForm({...form,restingHR:e.target.value})}/>
              </div>
            </div>
            <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'4px' }}>
              Resting lactate &lt;2.0 mmol/L = baseline · HR trend: lower = better recovery
            </div>
          </div>
        )}

        <button style={{ ...S.btn, marginTop:'14px' }} onClick={save}>{t('saveEntryBtn')}</button>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
        <div style={S.cardTitle}>{t('readScoreTitle')}</div>
        <div style={{ display:'flex', alignItems:'center', gap:'24px', flexWrap:'wrap' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ ...S.mono, fontSize:'48px', fontWeight:600, color:readiness.color, lineHeight:1 }}>{score}</div>
            <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginTop:'4px' }}>/100</div>
          </div>
          <div>
            <span style={{ ...S.tag(readiness.color), fontSize:'14px', padding:'6px 16px' }}>{readiness.label}</span>
            <div style={{ ...S.mono, fontSize:'11px', color:'#888', marginTop:'8px' }}>
              ≥75: {t('goLabel')} · 50–74: {t('monitorLabel')} · &lt;50: {t('restLabel')}
            </div>
          </div>
          <div style={{ marginLeft:'auto' }}>
            <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginBottom:'4px' }}>7-DAY</div>
            <Sparkline data={last7scores}/>
          </div>
        </div>
        {showSleepWarn && (
          <div style={{ ...S.mono, fontSize:'10px', color:'#f5c542', marginTop:'10px', padding:'6px 10px', background:'#f5c54211', borderRadius:'4px' }}>
            ⚠ {t('sleepLowWarning')}
          </div>
        )}
      </div>

      {avg7sleep > 0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'80ms' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={S.cardTitle}>{t('sleepTrendTitle')}</div>
            <div style={{ ...S.mono, fontSize:'12px', color:'#0064ff', fontWeight:600 }}>{t('weight7avg')}: {avg7sleep}h</div>
          </div>
          <Sparkline data={last7sleep} w={200} h={36}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'4px' }}>
            {entries.slice(-7).map(e=><span key={e.date}>{e.date.slice(5)}</span>)}
          </div>
        </div>
      )}

      {/* Advanced/Elite: resting HR trend */}
      {isAdvanced && entries.some(e=>e.restingHR) && (() => {
        const hrData = entries.slice(-14).map(e=>parseFloat(e.restingHR)||0).filter(v=>v>0)
        const avgHR = hrData.length ? Math.round(hrData.reduce((s,v)=>s+v,0)/hrData.length) : 0
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'90ms' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ ...S.cardTitle, color:'#4a90d9' }}>RESTING HR TREND</div>
              <div style={{ ...S.mono, fontSize:'12px', color:'#4a90d9', fontWeight:600 }}>14-day avg: {avgHR} bpm</div>
            </div>
            <Sparkline data={hrData} w={200} h={36}/>
            <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'4px' }}>Lower = better recovery. Track for overtraining signals.</div>
          </div>
        )
      })()}

      {entries.length>0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
          <div style={S.cardTitle}>{t('hist7Title')}</div>
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'12px' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', color:'#888', fontSize:'10px' }}>
                {['DATE','SLEEP','SORENESS','ENERGY','MOOD','STRESS','Zzz','SCORE'].map(h=>(
                  <th key={h} style={{ textAlign:h==='SCORE'?'right':'left', padding:'4px 6px 8px 0', fontWeight:600, fontSize:'9px', letterSpacing:'0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...entries].slice(-7).reverse().map((e,i)=>{
                const sc=e.score||0
                const sc_c=sc>=75?'#5bc25b':sc>=50?'#f5c542':'#e03030'
                return (
                  <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'6px 6px 6px 0', color:'var(--sub)' }}>{e.date}</td>
                    {['sleep','soreness','energy','mood','stress'].map(k=>(
                      <td key={k} style={{ padding:'6px 6px 6px 0' }}>{WELLNESS_FIELDS.find(f=>f.key===k)?.emoji[(e[k]||3)-1]}</td>
                    ))}
                    <td style={{ padding:'6px 6px 6px 0', color:'#888' }}>{e.sleepHrs ? `${e.sleepHrs}h` : '—'}</td>
                    <td style={{ textAlign:'right', padding:'6px 0', color:sc_c, fontWeight:600 }}>{sc}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Injury Risk Widget (v4.3) */}
      {(() => {
        if (!log.length) return null
        const risk = predictInjuryRisk(log, entries)
        const levelColor = { low:'#5bc25b', moderate:'#f5c542', high:'#e03030', unknown:'#888' }[risk.level]
        const levelLabel = { low:'LOW RISK', moderate:'MODERATE RISK', high:'HIGH RISK', unknown:'UNKNOWN' }[risk.level]
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'90ms', borderLeft:`4px solid ${levelColor}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
              <div style={S.cardTitle}>{t('injuryRiskTitle')}</div>
              <span style={{ ...S.mono, fontSize:'11px', fontWeight:600, color:levelColor }}>{levelLabel}</span>
            </div>
            {risk.factors.length > 0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginBottom:'8px' }}>
                {risk.factors.map((f, i) => {
                  const fc = { high:'#e03030', moderate:'#f5c542', low:'#888' }[f.severity]
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      <div style={{ width:'70px', height:'5px', background:'var(--border)', borderRadius:'3px', overflow:'hidden' }}>
                        <div style={{ width:f.severity==='high'?'100%':f.severity==='moderate'?'60%':'30%', height:'100%', background:fc, borderRadius:'3px' }}/>
                      </div>
                      <span style={{ ...S.mono, fontSize:'10px', color:fc }}>{f.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', lineHeight:1.6 }}>
              {risk.advice[lang] || risk.advice.en}
            </div>
          </div>
        )
      })()}

      <InjuryTracker />
      <MentalTools />
    </div>
  )
}
