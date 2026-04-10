import { useState, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { cooperVO2, rampFTP, ftpFrom20, epley1RM, astrandVO2, yyir1VO2, wingateStats } from '../lib/formulas.js'

const TESTS = [
  { id:'cooper',  label:'COOPER 12-MIN',   sport:'Run',       needsCalc:true },
  { id:'ramp',    label:'RAMP TEST',       sport:'Bike',      needsCalc:true },
  { id:'ftp20',   label:'20-MIN FTP',      sport:'Bike',      needsCalc:true },
  { id:'beep',    label:'BEEP TEST',       sport:'Run',       needsCalc:true },
  { id:'yyir1',   label:'YYIR1',           sport:'Run',       needsCalc:true },
  { id:'wingate', label:'WINGATE 30s',     sport:'Bike/Lab',  needsCalc:true },
  { id:'oneRM',   label:'1RM EPLEY',       sport:'Strength',  needsCalc:true },
  { id:'astrand', label:'ÅSTRAND BIKE',    sport:'Bike/Lab',  needsCalc:true },
  { id:'conconi', label:'CONCONI',         sport:'Run/Bike',  needsCalc:false },
  { id:'lactate', label:'BLOOD LACTATE',   sport:'Lab',       needsCalc:false },
]

export default function TestProtocols() {
  const { t } = useContext(LangCtx)
  const [active, setActive] = useState('cooper')
  const [inputs, setInputs] = useState({})
  const [result, setResult] = useState(null)
  const [testLog, setTestLog] = useLocalStorage('sporeus-test-results', [])
  const [cmpA, setCmpA] = useState('')
  const [cmpB, setCmpB] = useState('')
  const set = (k,v) => setInputs(prev=>({...prev,[k]:v}))
  const v = k => inputs[k]||''

  const saveTestResult = (testId, value, unit) => {
    const today = new Date().toISOString().slice(0,10)
    setTestLog(prev => [...prev, { id:Date.now(), date:today, testId, value:String(value), unit }])
  }

  const lastTestDate = testLog.length ? testLog[testLog.length-1].date : null
  const weeksSinceLast = lastTestDate ? Math.floor((new Date() - new Date(lastTestDate)) / (7*864e5)) : null

  const run = () => {
    setResult(null)
    const i = inputs
    if (active==='cooper') {
      const d=parseInt(i.dist||0); if(!d) return
      const vo2=cooperVO2(d)
      setResult(['Cooper Test Result',`Distance: ${d}m`,`Estimated VO\u2082max: ${vo2} mL/kg/min`,`${parseFloat(vo2)>=52?'Excellent':parseFloat(vo2)>=46?'Good':parseFloat(vo2)>=40?'Average':'Below Average'}`,`Run at maximum effort on flat surface.`])
      saveTestResult('cooper', vo2, 'mL/kg/min VO₂max')
    } else if (active==='ramp') {
      const w=parseInt(i.watts||0); if(!w) return
      const ftp=rampFTP(w)
      setResult(['Ramp Test Result',`Final step: ${w}W`,`Estimated FTP: ${ftp}W (75% of peak)`,`Recommended Z4: ${Math.round(ftp*.91)}\u2013${Math.round(ftp*1.05)}W`])
    } else if (active==='ftp20') {
      const w=parseInt(i.avg20||0); if(!w) return
      const ftp=ftpFrom20(w)
      setResult(['20-Min FTP Result',`20-min average: ${w}W`,`FTP = ${w} \u00d7 0.95 = ${ftp}W`,`Recommended to do after 5-min all-out opener.`])
    } else if (active==='beep') {
      const lv=parseFloat(i.beepLevel||0); if(!lv) return
      const vo2=(lv*3.46+12.2).toFixed(1)
      setResult(['Beep Test Result',`Level: ${i.beepLevel}`,`Estimated VO\u2082max: ${vo2} mL/kg/min`,`${parseFloat(vo2)>=55?'Excellent':parseFloat(vo2)>=48?'Good':parseFloat(vo2)>=40?'Average':'Below Average'}`])
    } else if (active==='yyir1') {
      const lv=parseInt(i.yyLevel||0), sh=parseInt(i.yyShuttle||0); if(!lv) return
      const vo2=yyir1VO2(lv,sh)
      setResult(['YYIR1 Result',`Level ${lv}, Shuttle ${sh}`,`Estimated VO\u2082max: ${vo2} mL/kg/min`,`YYIR1 range: Level 1 (~35 mL/kg/min) to Level 23 (~63 mL/kg/min)`])
    } else if (active==='wingate') {
      const peak=parseInt(i.peak||0), mean=parseInt(i.mean||0), low=parseInt(i.lowPow||0), bw=parseFloat(i.bw||0)
      if(!peak||!bw) return
      const r=wingateStats(peak,mean||peak,low||Math.round(peak*.6),bw)
      setResult(['Wingate Result',`Peak power: ${peak}W \u2192 ${r.relPeak} W/kg`,`Mean power: ${mean||'\u2014'}W \u2192 ${r.relMean} W/kg`,`Fatigue index: ${r.fatigue}%  (lower = better anaerobic endurance)`,`Elite sprinters: <30% fatigue index`])
    } else if (active==='oneRM') {
      const w=parseFloat(i.liftWeight||0), reps=parseInt(i.reps||0); if(!w||!reps) return
      const rm=epley1RM(w,reps)
      setResult(['1RM Estimate (Epley)',`${w}kg \u00d7 ${reps} reps`,`1RM = ${w} \u00d7 (1 + ${reps}/30) = ${rm} kg`,`Training percentages: 85%=${Math.round(rm*0.85)}kg, 70%=${Math.round(rm*0.70)}kg, 60%=${Math.round(rm*0.60)}kg`])
    } else if (active==='astrand') {
      const watts=parseInt(i.astWatts||0), hr=parseInt(i.steadyHR||0), bw=parseFloat(i.astBW||70), gender=i.gender||'male'
      if(!watts||!hr) return
      const vo2=astrandVO2(watts,bw,gender)
      setResult(['\u00c5strand Bike Result',`Steady-state HR: ${hr} bpm, Workload: ${watts}W`,`VO\u2082max \u2248 ${vo2} mL/kg/min (${gender})`,`Formula: (workload \u00d7 ${gender==='female'?'5.88':'6.12'} / BW) + 3.5`,`For greater accuracy use Åstrand nomogram HR correction.`])
    } else if (active==='conconi') {
      setResult(['Conconi Protocol','1. Run on 400m track. Start at 8 km/h.','2. Increase 0.5 km/h every 200m.','3. Record HR at each stage.','4. Plot HR vs speed \u2014 deflection point = anaerobic threshold.','5. Threshold HR \u2248 HR at deflection; threshold speed = deflection speed.'])
    } else if (active==='lactate') {
      setResult(['Blood Lactate Protocol','Equipment: lactate analyzer, finger-prick lancets.','Stages: 5 min each, +0.5 km/h. Sample from earlobe or fingertip.','LT1 (aerobic): ~2 mmol/L \u2014 first rise above baseline \u2192 top of Z2.','LT2 (MLSS): ~4 mmol/L \u2014 last sustainable steady state \u2192 Z4.','Ref: E\u015e\u0130K / THRESHOLD, Chapter 4 \u2014 Laktat Fizyolojisi.'])
    }
  }

  const activeTest = TESTS.find(x=>x.id===active)

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('selectProto')}</div>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'16px' }}>
          {TESTS.map(test=>(
            <button key={test.id} onClick={()=>{setActive(test.id);setResult(null)}}
              style={{ ...S.navBtn(active===test.id), borderRadius:'4px', display:'flex', flexDirection:'column', gap:'1px', fontSize:'10px' }}>
              {test.label}
              <span style={{ fontSize:'9px', opacity:0.7 }}>{test.sport}</span>
            </button>
          ))}
        </div>

        {active==='cooper' && <>
          <label style={S.label}>DISTANCE COVERED IN 12 MIN (meters)</label>
          <input style={{ ...S.input, maxWidth:'200px' }} type="number" placeholder="3200" value={v('dist')} onChange={e=>set('dist',e.target.value)}/>
        </>}
        {active==='ramp' && <>
          <label style={S.label}>FINAL COMPLETED STEP (watts, 25W increments/min)</label>
          <input style={{ ...S.input, maxWidth:'200px' }} type="number" placeholder="350" value={v('watts')} onChange={e=>set('watts',e.target.value)}/>
        </>}
        {active==='ftp20' && <>
          <label style={S.label}>20-MIN AVERAGE POWER (watts)</label>
          <input style={{ ...S.input, maxWidth:'200px' }} type="number" placeholder="300" value={v('avg20')} onChange={e=>set('avg20',e.target.value)}/>
        </>}
        {active==='beep' && <>
          <label style={S.label}>LEVEL REACHED (e.g. 11.5)</label>
          <input style={{ ...S.input, maxWidth:'200px' }} type="text" placeholder="11.5" value={v('beepLevel')} onChange={e=>set('beepLevel',e.target.value)}/>
        </>}
        {active==='yyir1' && (
          <div style={S.row}>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>LEVEL (1\u201323)</label>
              <input style={S.input} type="number" placeholder="16" value={v('yyLevel')} onChange={e=>set('yyLevel',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>SHUTTLE IN LEVEL (1\u20138)</label>
              <input style={S.input} type="number" placeholder="4" value={v('yyShuttle')} onChange={e=>set('yyShuttle',e.target.value)}/>
            </div>
          </div>
        )}
        {active==='wingate' && (
          <div style={S.row}>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>PEAK POWER (W)</label>
              <input style={S.input} type="number" placeholder="900" value={v('peak')} onChange={e=>set('peak',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>MEAN POWER (W)</label>
              <input style={S.input} type="number" placeholder="650" value={v('mean')} onChange={e=>set('mean',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>LOWEST POWER (W)</label>
              <input style={S.input} type="number" placeholder="500" value={v('lowPow')} onChange={e=>set('lowPow',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>BODY WEIGHT (kg)</label>
              <input style={S.input} type="number" placeholder="75" value={v('bw')} onChange={e=>set('bw',e.target.value)}/>
            </div>
          </div>
        )}
        {active==='oneRM' && (
          <div style={S.row}>
            <div style={{ flex:'1 1 140px' }}>
              <label style={S.label}>WEIGHT LIFTED (kg)</label>
              <input style={S.input} type="number" placeholder="100" value={v('liftWeight')} onChange={e=>set('liftWeight',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 120px' }}>
              <label style={S.label}>REPS COMPLETED</label>
              <input style={S.input} type="number" placeholder="6" value={v('reps')} onChange={e=>set('reps',e.target.value)}/>
            </div>
          </div>
        )}
        {active==='astrand' && (
          <div style={S.row}>
            <div style={{ flex:'1 1 130px' }}>
              <label style={S.label}>STEADY-STATE HR (bpm)</label>
              <input style={S.input} type="number" placeholder="155" value={v('steadyHR')} onChange={e=>set('steadyHR',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 130px' }}>
              <label style={S.label}>WORKLOAD (watts)</label>
              <input style={S.input} type="number" placeholder="150" value={v('astWatts')} onChange={e=>set('astWatts',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 110px' }}>
              <label style={S.label}>BODY WEIGHT (kg)</label>
              <input style={S.input} type="number" placeholder="70" value={v('astBW')} onChange={e=>set('astBW',e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 110px' }}>
              <label style={S.label}>GENDER</label>
              <select style={S.select} value={v('gender')||'male'} onChange={e=>set('gender',e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
        )}
        {(active==='conconi'||active==='lactate') && (
          <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', marginBottom:'8px' }}>Click below to view the full protocol.</div>
        )}

        <button style={{ ...S.btn, marginTop:'14px' }} onClick={run}>
          {activeTest?.needsCalc ? t('calcBtn') : t('viewBtn')}
        </button>
      </div>

      {result && (
        <div className="sp-card" style={{ ...S.card, borderLeft:'4px solid #ff6600', animationDelay:'50ms' }}>
          <div style={S.cardTitle}>{result[0]}</div>
          {result.slice(1).map((line,i)=>(
            <div key={i} style={{ ...S.mono, fontSize:'13px', lineHeight:1.9, color:i===0?'#1a1a1a':'#555', borderBottom:i<result.length-2?'1px solid #f0f0f0':'none', padding:'4px 0' }}>{line}</div>
          ))}
        </div>
      )}

      {weeksSinceLast !== null && weeksSinceLast >= 6 && (
        <div style={{ ...S.card, background:'#fffbeb', border:'1px solid #f5c54266', borderRadius:'6px', padding:'12px 16px', marginBottom:'16px', ...S.mono, fontSize:'11px', color:'#92400e' }}>
          ⏰ Last test: {lastTestDate} ({weeksSinceLast} weeks ago). Time to retest!
        </div>
      )}

      {testLog.length >= 2 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
          <div style={S.cardTitle}>PROGRESS COMPARISON</div>
          <div style={S.row}>
            <div style={{ flex:'1 1 180px' }}>
              <label style={S.label}>RESULT A</label>
              <select style={S.select} value={cmpA} onChange={e=>setCmpA(e.target.value)}>
                <option value="">Select…</option>
                {testLog.map((r)=><option key={r.id||r.date} value={r.id||r.date}>{r.date} — {r.testId} — {r.value} {r.unit}</option>)}
              </select>
            </div>
            <div style={{ flex:'1 1 180px' }}>
              <label style={S.label}>RESULT B</label>
              <select style={S.select} value={cmpB} onChange={e=>setCmpB(e.target.value)}>
                <option value="">Select…</option>
                {testLog.map((r)=><option key={r.id||r.date} value={r.id||r.date}>{r.date} — {r.testId} — {r.value} {r.unit}</option>)}
              </select>
            </div>
          </div>
          {cmpA!==''&&cmpB!==''&&cmpA!==cmpB&&(()=>{
            const a=testLog.find(r=>(r.id||r.date)===cmpA||String(r.id||r.date)===String(cmpA))
            const b=testLog.find(r=>(r.id||r.date)===cmpB||String(r.id||r.date)===String(cmpB))
            if (!a||!b) return null
            const va=parseFloat(a.value), vb=parseFloat(b.value)
            const delta=Math.round((vb-va)*10)/10
            const pct=Math.round((vb-va)/Math.abs(va)*100)
            const up=delta>=0
            return (
              <div style={{ marginTop:'14px', display:'flex', gap:'16px', flexWrap:'wrap' }}>
                {[{label:'A',r:a},{label:'B',r:b}].map(({label,r})=>(
                  <div key={label} style={{ flex:'1 1 150px', ...S.stat }}>
                    <span style={{ ...S.statVal, fontSize:'18px' }}>{r.value}</span>
                    <span style={S.statLbl}>{r.unit}</span>
                    <div style={{ ...S.mono, fontSize:'9px', color:'var(--sub)', marginTop:'3px' }}>{r.date}</div>
                  </div>
                ))}
                <div style={{ flex:'1 1 120px', ...S.stat }}>
                  <span style={{ ...S.statVal, fontSize:'22px', color:up?'#5bc25b':'#e03030' }}>{up?'↑':'↓'} {Math.abs(delta)}</span>
                  <span style={S.statLbl}>{up?'+':''}{pct}% change</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
