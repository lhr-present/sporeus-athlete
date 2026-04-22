import { useState, useEffect, useContext, useMemo, lazy, Suspense } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useData } from '../contexts/DataContext.jsx'
import { WELLNESS_FIELDS } from '../lib/constants.js'
import { Sparkline } from './ui.jsx'
import InjuryTracker from './InjuryTracker.jsx'
const HRVDashboard = lazy(() => import('./HRVDashboard.jsx'))
import MentalTools from './MentalTools.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import OSTRCQuestionnaire from './OSTRCQuestionnaire.jsx'
import RTPProtocol from './RTPProtocol.jsx'
import CycleTracker from './CycleTracker.jsx'
import { predictInjuryRisk, analyzeRecoveryCorrelation } from '../lib/intelligence.js'
import { findRecoveryPatterns } from '../lib/patterns.js'
import { calcLoad } from '../lib/formulas.js'
import { classifyTSB } from '../lib/trainingLoad.js'

export default function Recovery() {
  const { t } = useContext(LangCtx)
  const { recovery: entries, setRecovery: setEntries, log, profile: profileLS } = useData()
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const isAdvanced = profileLS?.athleteLevel === 'advanced' || profileLS?.athleteLevel === 'elite'
  const today = new Date().toISOString().slice(0,10)
  const todayEntry = entries.find(e=>e.date===today)
  const defVals = { sleep:3, soreness:3, energy:3, mood:3, stress:3, sleepHrs:'', bedtime:'', wake:'', lactate:'', restingHR:'', hrv:'' }
  const [form, setForm] = useState(todayEntry ? { ...defVals, ...todayEntry } : { ...defVals })

  useEffect(() => {
    const e = entries.find(x=>x.date===today)
    setForm(e ? { ...defVals, ...e } : { ...defVals })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on date change only; defVals and entries are stable refs
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

  const patterns  = useMemo(() => findRecoveryPatterns(log, entries), [log, entries])
  const corr      = useMemo(() => analyzeRecoveryCorrelation(log, entries), [log, entries])
  const tsbZone   = useMemo(() => { const { tsb } = calcLoad(log); return classifyTSB(tsb) }, [log])

  // L4 — This-week vs 4-week rolling recovery baseline
  const recoveryBaseline = useMemo(() => {
    const cutoff7  = (() => { const d = new Date(); d.setDate(d.getDate() - 7);  return d.toISOString().slice(0, 10) })()
    const cutoff28 = (() => { const d = new Date(); d.setDate(d.getDate() - 28); return d.toISOString().slice(0, 10) })()
    const week4 = entries.filter(e => e.date >= cutoff28 && typeof e.score === 'number')
    const week1 = entries.filter(e => e.date >= cutoff7  && typeof e.score === 'number')
    if (week1.length < 2 || week4.length < 5) return null
    const avg1 = Math.round(week1.reduce((s, e) => s + e.score, 0) / week1.length)
    const avg4 = Math.round(week4.reduce((s, e) => s + e.score, 0) / week4.length)
    const delta = avg1 - avg4
    const pct   = avg4 > 0 ? Math.round(Math.abs(delta) / avg4 * 100) : 0
    const color = delta >= 0 ? '#5bc25b' : pct > 10 ? '#e03030' : '#f5c542'
    return { avg1, avg4, delta, pct, color }
  }, [entries])

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

        {/* HRV (rMSSD) — available to all */}
        <div style={{ marginTop:'14px' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#888', letterSpacing:'0.06em', marginBottom:'8px' }}>HRV &amp; BIOMETRICS (OPTIONAL)</div>
          <div style={S.row}>
            <div style={{ flex:'1 1 130px' }}>
              <label style={S.label}>HRV rMSSD (ms)</label>
              <input style={S.input} type="number" min="10" max="200" placeholder="65"
                value={form.hrv} onChange={e=>setForm({...form,hrv:e.target.value})}/>
              <div style={{ ...S.mono, fontSize:'9px', color:'#555', marginTop:'2px' }}>
                {lang==='tr' ? 'Sabah, yatakta ölç. Düşük = yorgunluk.' : 'Measure morning, in bed. Low = fatigue.'}
              </div>
            </div>
            <div style={{ flex:'1 1 130px' }}>
              <label style={S.label}>RESTING HR (bpm)</label>
              <input style={S.input} type="number" min="30" max="100" placeholder="48"
                value={form.restingHR} onChange={e=>setForm({...form,restingHR:e.target.value})}/>
            </div>
          </div>
          {/* 7-day HRV sparkline */}
          {entries.length >= 2 && (() => {
            const last7 = [...entries].sort((a,b)=>a.date>b.date?1:-1).slice(-7)
            const vals   = last7.map(e=>parseFloat(e.hrv)||null).filter(Boolean)
            if (vals.length < 2) return null
            const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1
            const W = 200, H = 32, pad = 4
            const pts = vals.map((v,i) => {
              const x = pad + i * (W - 2*pad) / (vals.length - 1)
              const y = H - pad - (v - min) / range * (H - 2*pad)
              return `${x},${y}`
            }).join(' ')
            const avg7 = Math.round(vals.reduce((s,v)=>s+v,0)/vals.length)
            return (
              <div style={{ marginTop:'8px' }}>
                <div style={{ ...S.mono, fontSize:'8px', color:'#555', marginBottom:'4px' }}>
                  7-DAY HRV · AVG {avg7} ms
                </div>
                <svg width={W} height={H} style={{ display:'block', overflow:'visible' }}>
                  <polyline points={pts} fill="none" stroke="#ff6600" strokeWidth="1.5" strokeLinejoin="round"/>
                  {vals.map((v,i) => {
                    const x = pad + i * (W - 2*pad) / (vals.length - 1)
                    const y = H - pad - (v - min) / range * (H - 2*pad)
                    return <circle key={i} cx={x} cy={y} r="2.5" fill="#ff6600"/>
                  })}
                </svg>
              </div>
            )
          })()}
        </div>

        {/* Advanced/Elite only: blood lactate */}
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
            </div>
            <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'4px' }}>
              Resting lactate &lt;2.0 mmol/L = baseline
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
        {log.length >= 7 && (
          <div style={{ ...S.mono, fontSize:'9px', marginTop:'10px', padding:'5px 8px', background:`${tsbZone.color}11`, border:`1px solid ${tsbZone.color}33`, borderRadius:'3px', display:'inline-flex', alignItems:'center', gap:'8px' }}>
            <span style={{ color: tsbZone.color, fontWeight:700 }}>TSB {lang==='tr' ? tsbZone.label.tr : tsbZone.label.en}</span>
            <span style={{ color:'#444' }}>{lang==='tr' ? tsbZone.advice.tr : tsbZone.advice.en}</span>
          </div>
        )}
        {/* L4 — Recovery weekly baseline comparison */}
        {recoveryBaseline && (
          <div style={{ ...S.mono, fontSize:'9px', marginTop:'8px', padding:'5px 8px', background:`${recoveryBaseline.color}11`, border:`1px solid ${recoveryBaseline.color}33`, borderRadius:'3px', display:'inline-flex', alignItems:'center', gap:'8px' }}>
            <span style={{ color: recoveryBaseline.color, fontWeight:700 }}>
              {lang==='tr' ? 'BU HAFTA' : 'THIS WEEK'} {recoveryBaseline.avg1}
            </span>
            <span style={{ color:'#333' }}>·</span>
            <span style={{ color:'#555' }}>4W AVG {recoveryBaseline.avg4}</span>
            <span style={{ color: recoveryBaseline.color, fontWeight:700 }}>
              {recoveryBaseline.delta >= 0 ? '+' : ''}{recoveryBaseline.delta} ({recoveryBaseline.delta >= 0 ? '+' : '-'}{recoveryBaseline.pct}%)
            </span>
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

      {/* N1 — Mood + stress 7-day sparklines */}
      {entries.length >= 3 && (() => {
        const last7 = [...entries].sort((a,b)=>a.date>b.date?1:-1).slice(-7)
        const moodVals   = last7.map(e => e.mood   || 3)
        const stressVals = last7.map(e => e.stress || 3)
        const avgMood    = Math.round(moodVals.reduce((s,v)=>s+v,0)/moodVals.length*10)/10
        const avgStress  = Math.round(stressVals.reduce((s,v)=>s+v,0)/stressVals.length*10)/10
        const W = 130, H = 30, pad = 3
        const line = (vals, color) => {
          const pts = vals.map((v,i) => {
            const x = pad + i * (W - 2*pad) / Math.max(vals.length - 1, 1)
            const y = H - pad - (v - 1) / 4 * (H - 2*pad)
            return `${x},${y}`
          }).join(' ')
          return <polyline key={color} points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
        }
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'85ms' }}>
            <div style={S.cardTitle}>{lang==='tr' ? 'RUH HALİ & STRES — 7 GÜN' : 'MOOD & STRESS — 7 DAYS'}</div>
            <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
              <svg width={W} height={H} style={{ display:'block', overflow:'visible' }}>
                {line(moodVals, '#0064ff')}
                {line(stressVals, '#e03030')}
              </svg>
              <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
                <div style={{ ...S.mono, fontSize:'10px', display:'flex', gap:'6px', alignItems:'center' }}>
                  <span style={{ width:10, height:2, background:'#0064ff', display:'inline-block', borderRadius:1 }}/>
                  <span style={{ color:'#0064ff' }}>{lang==='tr' ? 'RUHHAL' : 'MOOD'} {avgMood}</span>
                </div>
                <div style={{ ...S.mono, fontSize:'10px', display:'flex', gap:'6px', alignItems:'center' }}>
                  <span style={{ width:10, height:2, background:'#e03030', display:'inline-block', borderRadius:1 }}/>
                  <span style={{ color:'#e03030' }}>{lang==='tr' ? 'STRES' : 'STRESS'} {avgStress}</span>
                </div>
              </div>
            </div>
            {avgStress > 3.5 && avgMood < 3 && (
              <div style={{ ...S.mono, fontSize:'9px', color:'#f5c542', marginTop:'6px' }}>
                ⚠ {lang==='tr' ? 'Yüksek stres + düşük ruh hali — yük artışından kaçın.' : 'High stress + low mood — avoid load increase.'}
              </div>
            )}
          </div>
        )
      })()}

      {/* I2 — Recovery patterns (findRecoveryPatterns) */}
      {!patterns.needsMore && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'110ms' }}>
          <div style={S.cardTitle}>{lang==='tr' ? 'KİŞİSEL DESENLER' : 'YOUR PATTERNS'}</div>
          {(patterns.bestDay || patterns.worstDay) && (
            <div style={{ display:'flex', gap:'12px', marginBottom:'10px', flexWrap:'wrap' }}>
              {patterns.bestDay && (
                <div style={{ ...S.mono, fontSize:'10px', color:'#5bc25b', border:'1px solid #5bc25b44', padding:'4px 8px', borderRadius:'3px' }}>
                  ↑ {patterns.bestDay.day}
                </div>
              )}
              {patterns.worstDay && patterns.worstDay.day !== patterns.bestDay?.day && (
                <div style={{ ...S.mono, fontSize:'10px', color:'#e03030', border:'1px solid #e0303044', padding:'4px 8px', borderRadius:'3px' }}>
                  ↓ {patterns.worstDay.day}
                </div>
              )}
            </div>
          )}
          {patterns.optimalReadiness && (
            <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', lineHeight:1.6, marginBottom:'6px' }}>
              {lang==='tr' ? patterns.optimalReadiness.tr : patterns.optimalReadiness.en}
            </div>
          )}
          {patterns.optimalSleep && (
            <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', lineHeight:1.6, marginBottom:'6px' }}>
              {lang==='tr' ? patterns.optimalSleep.tr : patterns.optimalSleep.en}
            </div>
          )}
          {patterns.redFlags.slice(0,2).map(f=>(
            <div key={f.field} style={{ ...S.mono, fontSize:'10px', color:'#f5c542', marginTop:'4px', lineHeight:1.5 }}>
              ⚠ {lang==='tr' ? f.tr : f.en}
            </div>
          ))}
        </div>
      )}

      {/* I4 — Recovery correlation (analyzeRecoveryCorrelation) */}
      {corr.correlation !== null && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'115ms' }}>
          <div style={S.cardTitle}>{lang==='tr' ? 'YÜK → TOPARLANMA ETKİSİ' : 'LOAD → RECOVERY EFFECT'}</div>
          {(corr.avgRecAfterHard !== null && corr.avgRecAfterEasy !== null) && (
            <div style={{ display:'flex', gap:'16px', marginBottom:'10px' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ ...S.mono, fontSize:'20px', fontWeight:700, color:'#e03030' }}>{corr.avgRecAfterHard}</div>
                <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginTop:'2px' }}>{lang==='tr' ? 'ZOR SONRASI' : 'AFTER HARD'}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ ...S.mono, fontSize:'20px', fontWeight:700, color:'#5bc25b' }}>{corr.avgRecAfterEasy}</div>
                <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginTop:'2px' }}>{lang==='tr' ? 'KOLAY SONRASI' : 'AFTER EASY'}</div>
              </div>
            </div>
          )}
          <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', lineHeight:1.6 }}>
            {lang==='tr' ? corr.insight.tr : corr.insight.en}
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

      {/* N2 — Lactate trend (advanced athletes) */}
      {isAdvanced && (() => {
        const lactateData = [...entries].sort((a,b)=>a.date>b.date?1:-1).filter(e=>parseFloat(e.lactate)>0).slice(-10)
        if (lactateData.length < 2) return null
        const vals = lactateData.map(e=>parseFloat(e.lactate))
        const latest = vals[vals.length-1]
        const isHigh = latest > 2.0
        const chartMin = Math.min(Math.min(...vals), 0.5)
        const chartMax = Math.max(Math.max(...vals), 2.5)
        const range = chartMax - chartMin || 1
        const W = 180, H = 36, pad = 4
        const pts = vals.map((v,i) => {
          const x = pad + i*(W-2*pad)/Math.max(vals.length-1,1)
          const y = H - pad - (v-chartMin)/range*(H-2*pad)
          return `${x},${y}`
        }).join(' ')
        const baselineY = H - pad - (2.0-chartMin)/range*(H-2*pad)
        return (
          <div className="sp-card" style={{ ...S.card, animationDelay:'95ms', borderLeft: isHigh?'4px solid #e03030':'4px solid #0064ff44' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ ...S.cardTitle, color:'#4a90d9' }}>BLOOD LACTATE TREND</div>
              <div style={{ ...S.mono, fontSize:'12px', color:isHigh?'#e03030':'#5bc25b', fontWeight:600 }}>{latest.toFixed(1)} mmol/L</div>
            </div>
            <svg width={W} height={H} style={{ display:'block', overflow:'visible' }}>
              <line x1={pad} y1={baselineY} x2={W-pad} y2={baselineY} stroke="#444" strokeWidth="1" strokeDasharray="3 3"/>
              <polyline points={pts} fill="none" stroke={isHigh?'#e03030':'#0064ff'} strokeWidth="1.5" strokeLinejoin="round"/>
              {vals.map((v,i) => {
                const x = pad + i*(W-2*pad)/Math.max(vals.length-1,1)
                const y = H - pad - (v-chartMin)/range*(H-2*pad)
                return <circle key={i} cx={x} cy={y} r="2.5" fill={isHigh?'#e03030':'#0064ff'}/>
              })}
            </svg>
            <div style={{ ...S.mono, fontSize:'9px', color:'#555', marginTop:'4px' }}>
              baseline ≤ 2.0 mmol/L · {lactateData.length} readings
              {isHigh && <span style={{ color:'#e03030', marginLeft:6 }}>⚠ elevated — reduce intensity</span>}
            </div>
          </div>
        )
      })()}

      {entries.length>0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'100ms', overflowX:'auto' }}>
          <div style={S.cardTitle}>{t('hist7Title')}</div>
          {/* P3 — Extended columns: HRV, resting HR, bedtime (advanced only, when data exists) */}
          {(() => {
            const recent = [...entries].slice(-7).reverse()
            const hasHRV  = isAdvanced && recent.some(e => e.hrv)
            const hasRHR  = isAdvanced && recent.some(e => e.restingHR)
            const hasBed  = isAdvanced && recent.some(e => e.bedtime)
            const extraHeaders = [
              hasHRV  && 'HRV',
              hasRHR  && 'RHR',
              hasBed  && 'BED',
            ].filter(Boolean)
            return (
              <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'12px', minWidth: extraHeaders.length ? '520px' : 'auto' }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid var(--border)', color:'#888', fontSize:'10px' }}>
                    {['DATE','SLEEP','SORENESS','ENERGY','MOOD','STRESS','Zzz',...extraHeaders,'SCORE'].map(h=>(
                      <th key={h} style={{ textAlign:h==='SCORE'?'right':'left', padding:'4px 6px 8px 0', fontWeight:600, fontSize:'9px', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e,i)=>{
                    const sc=e.score||0
                    const sc_c=sc>=75?'#5bc25b':sc>=50?'#f5c542':'#e03030'
                    return (
                      <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                        <td style={{ padding:'6px 6px 6px 0', color:'var(--sub)', whiteSpace:'nowrap' }}>{e.date}</td>
                        {['sleep','soreness','energy','mood','stress'].map(k=>(
                          <td key={k} style={{ padding:'6px 6px 6px 0' }}>{WELLNESS_FIELDS.find(f=>f.key===k)?.emoji[(e[k]||3)-1]}</td>
                        ))}
                        <td style={{ padding:'6px 6px 6px 0', color:'#888' }}>{e.sleepHrs ? `${e.sleepHrs}h` : '—'}</td>
                        {hasHRV && <td style={{ padding:'6px 6px 6px 0', color: e.hrv ? '#5bc25b' : '#333', fontSize:'10px' }}>{e.hrv ? `${e.hrv}ms` : '—'}</td>}
                        {hasRHR && <td style={{ padding:'6px 6px 6px 0', color: e.restingHR ? '#4a90d9' : '#333', fontSize:'10px' }}>{e.restingHR ? `${e.restingHR}` : '—'}</td>}
                        {hasBed && <td style={{ padding:'6px 6px 6px 0', color: e.bedtime ? '#888' : '#333', fontSize:'10px' }}>{e.bedtime || '—'}</td>}
                        <td style={{ textAlign:'right', padding:'6px 0', color:sc_c, fontWeight:600 }}>{sc}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          })()}
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
              <div style={{ display:'flex', alignItems:'baseline', gap:'6px' }}>
                <span style={{ ...S.mono, fontSize:'20px', fontWeight:700, color:levelColor, lineHeight:1 }}>{risk.score}</span>
                <span style={{ ...S.mono, fontSize:'11px', fontWeight:600, color:levelColor }}>{levelLabel}</span>
              </div>
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

      <ErrorBoundary inline name="OSTRC"><OSTRCQuestionnaire /></ErrorBoundary>
      <ErrorBoundary inline name="RTP Protocol"><RTPProtocol /></ErrorBoundary>
      <ErrorBoundary inline name="HRV Dashboard"><Suspense fallback={null}><HRVDashboard recovery={entries} setRecovery={setEntries} /></Suspense></ErrorBoundary>
      <ErrorBoundary inline name="Injury Tracker"><InjuryTracker /></ErrorBoundary>
      <ErrorBoundary inline name="Cycle Tracker"><CycleTracker /></ErrorBoundary>
      <ErrorBoundary inline name="Mental Tools"><MentalTools /></ErrorBoundary>
    </div>
  )
}
