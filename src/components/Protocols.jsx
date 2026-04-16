import { useState, useContext, useMemo } from 'react'
import { logger } from '../lib/logger.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { useData } from '../contexts/DataContext.jsx'
import { cooperVO2, rampFTP, ftpFrom20, epley1RM, astrandVO2, yyir1VO2, wingateStats, normalizedPower, computeWPrime } from '../lib/formulas.js'
import PowerCurve from './PowerCurve.jsx'
import VO2maxCard from './VO2maxCard.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import RESTQScreen from './RESTQScreen.jsx'

import WPrimeChart from './protocols/WPrimeChart.jsx'
import LactateEstimator from './protocols/LactateEstimator.jsx'
import HRVDeepAnalysis from './protocols/HRVDeepAnalysis.jsx'
import TestBatteryPlanner from './protocols/TestBatteryPlanner.jsx'
import TestHistoryGoal from './protocols/TestHistoryGoal.jsx'
import ResultComparison from './protocols/ResultComparison.jsx'

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
  { id:'wprime',  label:"W' BALANCE",      sport:'Bike',      needsCalc:true },
  { id:'cp_test', label:'CP TEST',         sport:'Bike',      needsCalc:true },
]

// ─── Meaningful change thresholds (MDC%) per test ────────────────────────────
// MDC = SEM × 1.96 × √2; SEM derived from published reliability studies.
// Expressed as % of measured value for unit-agnostic comparison.
const MDC_PCT = {
  cooper:5.5,  // VO₂max Cooper: CV ~3.5%, ICC 0.96 → MDC ~5.5%
  ramp:4.0,    // FTP ramp: well-controlled ergometer, CV ~3%
  ftp20:3.5,   // 20-min FTP: highly reproducible when well-paced
  beep:5.0,    // Beep/multistage: motivation-dependent, higher variability
  yyir1:5.5,   // YYIR1: surface/motivation variance ~5%
  wingate:5.0, // Wingate peak power: day-to-day ~4-5% (Coggan 2003)
  oneRM:4.5,   // Epley 1RM estimate: formula ±3% + daily readiness ±2%
  astrand:5.5, // Åstrand submaximal: HR drift sensitive
  cp_test:4.0, // CP 2-point: ergometer reproducibility ~3-4%
}

export default function TestProtocols() {
  const { t, lang } = useContext(LangCtx)
  const [active, setActive] = useState('cooper')
  const [inputs, setInputs] = useState({})
  const [result, setResult] = useState(null)
  const { testResults: testLog, setTestResults: setTestLog } = useData()
  const set = (k,v) => setInputs(prev=>({...prev,[k]:v}))
  const v = k => inputs[k]||''

  // CP test save state
  const [cpSaved, setCpSaved] = useState(false)

  // History for the currently active test, sorted chronologically
  const activeHistory = useMemo(() =>
    testLog.filter(r => r.testId === active).sort((a, b) => a.date.localeCompare(b.date)),
    [testLog, active]
  )

  // W' balance state
  const [wPrimeSeries, setWPrimeSeries]     = useState(null)  // computed balance array
  const [wPrimeStats,  setWPrimeStats]      = useState(null)  // { np, minW, exhausted, tAbove, tBelow }
  const [wPrimeError,  setWPrimeError]      = useState('')
  const [wPrimeCapacity, setWPrimeCapacity] = useState(20000) // J — user's W'

  const loadLastFITPower = () => {
    try {
      const raw = localStorage.getItem('sporeus-last-fit-power')
      if (!raw) { setWPrimeError('No FIT power data found. Import a .fit file in Training Log first.'); return }
      const arr = JSON.parse(raw)
      if (!Array.isArray(arr) || arr.length === 0) { setWPrimeError('Stored power data is empty.'); return }
      set('wPowerPaste', arr.join(','))
      setWPrimeError('')
    } catch { setWPrimeError('Could not read stored power data.') }
  }

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
      setResult(['Blood Lactate Protocol','Equipment: lactate analyzer, finger-prick lancets.','Stages: 5 min each, +0.5 km/h. Sample from earlobe or fingertip.','LT1 (aerobic): ~2 mmol/L \u2014 first rise above baseline \u2192 top of Z2.','LT2 (MLSS): ~4 mmol/L \u2014 last sustainable steady state \u2192 Z4.','Ref: Faude et al. (2009) — Lactate threshold concepts. Sports Med 39(6).'])
    } else if (active==='cp_test') {
      const p3 = parseInt(i.cp3min || 0), p12 = parseInt(i.cp12min || 0)
      if (!p3 || !p12) return
      // 2-point model: CP = (T2×P2 − T1×P1) / (T2 − T1) where T1=180s, T2=720s
      const cp = Math.round((720 * p12 - 180 * p3) / (720 - 180))
      const wPrime = Math.round(180 * (p3 - cp))     // joules
      const wPrimeKj = (wPrime / 1000).toFixed(1)
      const ftpPct = (() => {
        try { const ftp = parseInt(JSON.parse(localStorage.getItem('sporeus_profile') || '{}').ftp || 0); return ftp ? Math.round(cp / ftp * 100) : null } catch { return null }
      })()
      setCpSaved(false)
      saveTestResult('cp_test', cp, 'W CP')
      setResult([
        'Critical Power Test Result',
        `3-min avg: ${p3}W · 12-min avg: ${p12}W`,
        `CP (Critical Power): ${cp}W${ftpPct ? ` — ${ftpPct}% of FTP` : ''}`,
        `W' (Anaerobic Capacity): ${wPrimeKj} kJ (${wPrime.toLocaleString()} J)`,
        wPrime < 8000 ? 'W\' low (<8 kJ) — anaerobic reserve is limited; prioritise base aerobic work.'
          : wPrime > 30000 ? 'W\' high (>30 kJ) — strong sprint/anaerobic capacity.'
          : 'W\' within typical range (8–30 kJ) for trained cyclists.',
        `CP is the mathematical power ceiling above which W' depletes. W' reconstitutes below CP. (Skiba 2012 · Morton 1996)`,
        `__SAVE__${cp}__${wPrime}`,   // sentinel for save buttons below
      ])
    } else if (active==='wprime') {
      const cp = parseInt(i.cp || 0)
      const wCap = parseInt(i.wCap || wPrimeCapacity)
      if (!cp) return
      const raw = (i.wPowerPaste || '').trim()
      if (!raw) { setWPrimeError('Paste power data or load from last FIT file.'); return }
      const powers = raw.split(/[\s,]+/).map(Number).filter(n => !isNaN(n) && n >= 0)
      if (powers.length < 30) { setWPrimeError('Need at least 30 seconds of power data.'); return }
      setWPrimeError('')
      const series = computeWPrime(powers, cp, wCap)
      const np = normalizedPower(powers)
      const minW = Math.min(...series)
      const exhaustIdx = series.findIndex(v => v <= 0)
      const tAbove = powers.filter(p => p > cp).length
      const tBelow = powers.length - tAbove
      setWPrimeSeries(series)
      setWPrimeCapacity(wCap)
      setWPrimeStats({ np, minW, exhausted: exhaustIdx >= 0, exhaustSec: exhaustIdx, tAbove, tBelow, cp, wCap, totalSec: powers.length })
      setResult(null)
    }
  }

  const activeTest = TESTS.find(x=>x.id===active)

  return (
    <div className="sp-fade">
      {/* ── RESTQ-Sport Short Form ─────────────────────────────────────────── */}
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <ErrorBoundary>
          <RESTQScreen lang={lang} />
        </ErrorBoundary>
      </div>

      {/* ── Lactate Threshold Estimator ───────────────────────────────────── */}
      <div className="sp-card" style={{ ...S.card, animationDelay:'15ms' }}>
        <ErrorBoundary>
          <LactateEstimator lang={lang} />
        </ErrorBoundary>
      </div>

      <div className="sp-card" style={{ ...S.card, animationDelay:'30ms' }}>
        <div style={S.cardTitle}>{t('selectProto')}</div>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'16px' }}>
          {TESTS.map(test=>(
            <button key={test.id} onClick={()=>{setActive(test.id);setResult(null);setWPrimeSeries(null);setWPrimeStats(null);setWPrimeError('');setCpSaved(false)}}
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

        {active==='wprime' && (
          <div>
            {(() => {
              try {
                const pr = JSON.parse(localStorage.getItem('sporeus_profile') || '{}')
                const hasCPorFTP = pr.cp || pr.ftp
                if (!hasCPorFTP) return (
                  <div style={{ ...S.card, borderLeft:'3px solid #ff6600', marginBottom:'14px', padding:'12px 14px' }}>
                    <div style={{ ...S.mono, fontSize:'10px', color:'#ff6600', fontWeight:700, marginBottom:'6px' }}>⚠ COMPLETE CP TEST FIRST</div>
                    <div style={{ ...S.mono, fontSize:'10px', color:'#888', lineHeight:1.6, marginBottom:'10px' }}>
                      W' Balance requires your Critical Power (CP). Run the CP Test to establish your threshold baseline, then return here.
                    </div>
                    <button onClick={() => setActive('cp_test')} style={{ ...S.mono, fontSize:'10px', fontWeight:700, padding:'6px 14px', background:'#ff6600', border:'none', color:'#fff', borderRadius:'4px', cursor:'pointer', letterSpacing:'0.06em' }}>
                      → GO TO CP TEST
                    </button>
                  </div>
                )
              } catch (e) { logger.warn('localStorage:', e.message) }
              return null
            })()}
            <div style={{ ...S.mono, fontSize:'10px', color:'#888', lineHeight:1.7, marginBottom:'12px' }}>
              Skiba (2012) differential W' balance model. W' depletes above CP and reconstitutes below CP
              with a time constant τ derived from mean sub-threshold power.
            </div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'10px' }}>
              <div style={{ flex:'1 1 140px' }}>
                <label style={S.label}>CRITICAL POWER (watts)</label>
                <input style={S.input} type="number" placeholder="260" value={v('cp')} onChange={e=>set('cp',e.target.value)}/>
              </div>
              <div style={{ flex:'1 1 160px' }}>
                <label style={S.label}>W' CAPACITY (joules)</label>
                <input style={S.input} type="number" placeholder="20000" value={v('wCap') || wPrimeCapacity} onChange={e=>set('wCap',e.target.value)}/>
              </div>
            </div>
            <div style={{ marginBottom:'8px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                <label style={S.label}>SECOND-BY-SECOND POWER (watts, comma-separated)</label>
                <button
                  onClick={loadLastFITPower}
                  style={{ ...S.mono, fontSize:'9px', padding:'3px 8px', border:'1px solid #0064ff44', background:'transparent', color:'#0064ff', borderRadius:'3px', cursor:'pointer', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>
                  ↓ LOAD LAST FIT
                </button>
              </div>
              <textarea
                style={{ ...S.input, fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', minHeight:'60px', resize:'vertical', width:'100%', boxSizing:'border-box' }}
                placeholder="250,255,248,260,270,265,... (one value per second)"
                value={v('wPowerPaste')}
                onChange={e=>set('wPowerPaste',e.target.value)}
              />
            </div>
            {wPrimeError && (
              <div style={{ ...S.mono, fontSize:'10px', color:'#e03030', marginBottom:'8px' }}>{wPrimeError}</div>
            )}
          </div>
        )}

        {active==='cp_test' && (
          <div>
            <div style={{ ...S.mono, fontSize:'10px', color:'#888', lineHeight:1.7, marginBottom:'12px' }}>
              2-point Critical Power model (Morton 1996). Perform two maximal efforts — the math derives
              your sustainable power limit (CP) and anaerobic work capacity (W').
              Results feed directly into the W' Balance analyser.
            </div>
            <div style={{ ...S.mono, fontSize:'10px', color:'#555', lineHeight:1.7, marginBottom:'12px', borderLeft:'2px solid #333', paddingLeft:'10px' }}>
              Step 1 — 3-min all-out effort on bike/erg. Record average power.<br/>
              Step 2 — Rest 30 min completely.<br/>
              Step 3 — 12-min all-out effort. Record average power.
            </div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              <div style={{ flex:'1 1 160px' }}>
                <label style={S.label}>3-MIN AVG POWER (watts)</label>
                <input style={S.input} type="number" placeholder="420" value={v('cp3min')} onChange={e=>set('cp3min',e.target.value)}/>
              </div>
              <div style={{ flex:'1 1 160px' }}>
                <label style={S.label}>12-MIN AVG POWER (watts)</label>
                <input style={S.input} type="number" placeholder="330" value={v('cp12min')} onChange={e=>set('cp12min',e.target.value)}/>
              </div>
            </div>
          </div>
        )}

        <button style={{ ...S.btn, marginTop:'14px' }} onClick={run}>
          {activeTest?.needsCalc ? t('calcBtn') : t('viewBtn')}
        </button>
      </div>

      {result && (
        <div className="sp-card" style={{ ...S.card, borderLeft:'4px solid #ff6600', animationDelay:'50ms' }}>
          <div style={S.cardTitle}>{result[0]}</div>
          {result.slice(1).map((line,i)=> {
            if (line.startsWith('__SAVE__')) {
              const [,cp,wPrime] = line.split('__')
              const saveBoth = () => {
                try {
                  const profile = JSON.parse(localStorage.getItem('sporeus_profile') || '{}')
                  profile.cp = parseInt(cp)
                  profile.wPrime = parseInt(wPrime)
                  localStorage.setItem('sporeus_profile', JSON.stringify(profile))
                  setCpSaved(true)
                } catch (e) { logger.warn('localStorage:', e.message) }
              }
              const useFTP = () => {
                if (!window.confirm(`Set FTP = ${cp}W (CP)? This replaces your current FTP.`)) return
                try {
                  const profile = JSON.parse(localStorage.getItem('sporeus_profile') || '{}')
                  profile.ftp = parseInt(cp)
                  profile.cp = parseInt(cp)
                  profile.wPrime = parseInt(wPrime)
                  localStorage.setItem('sporeus_profile', JSON.stringify(profile))
                  setCpSaved(true)
                } catch (e) { logger.warn('localStorage:', e.message) }
              }
              return (
                <div key={i} style={{ display:'flex', gap:'8px', marginTop:'12px', flexWrap:'wrap' }}>
                  <button onClick={saveBoth} style={{ ...S.mono, fontSize:'10px', fontWeight:700, padding:'6px 14px', background:'#0064ff', border:'none', color:'#fff', borderRadius:'3px', cursor:'pointer' }}>
                    {cpSaved ? '✓ SAVED TO PROFILE' : '↓ SAVE CP + W\' TO PROFILE'}
                  </button>
                  <button onClick={useFTP} style={{ ...S.mono, fontSize:'10px', padding:'6px 14px', background:'transparent', border:'1px solid #ff660066', color:'#ff6600', borderRadius:'3px', cursor:'pointer' }}>
                    USE CP AS FTP
                  </button>
                </div>
              )
            }
            return (
              <div key={i} style={{ ...S.mono, fontSize:'12px', lineHeight:1.9, color:'var(--sub)', borderBottom: i < result.length-2 ? '1px solid var(--border)' : 'none', padding:'4px 0' }}>{line}</div>
            )
          })}
        </div>
      )}

      {/* W' Balance result card */}
      {wPrimeSeries && wPrimeStats && active === 'wprime' && (
        <div className="sp-card" style={{ ...S.card, borderLeft:'4px solid #ff6600', animationDelay:'50ms' }}>
          <div style={S.cardTitle}>W' BALANCE ANALYSIS</div>

          {/* Key metrics */}
          <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'16px' }}>
            {[
              { label:'NORM POWER', value:`${wPrimeStats.np}W`,   color:'#ff6600' },
              { label:'CRITICAL POWER', value:`${wPrimeStats.cp}W`, color:'#0064ff' },
              { label:'W\' CAPACITY', value:`${(wPrimeStats.wCap/1000).toFixed(1)}kJ`, color:'#888' },
              { label:'MIN W\'', value: wPrimeStats.exhausted ? 'EXHAUSTED' : `${(wPrimeStats.minW/1000).toFixed(1)}kJ`,
                color: wPrimeStats.exhausted ? '#e03030' : wPrimeStats.minW < wPrimeStats.wCap * 0.25 ? '#f5c542' : '#5bc25b' },
              { label:'TIME >CP', value:`${Math.round(wPrimeStats.tAbove/60)}m ${wPrimeStats.tAbove%60}s`, color:'#e03030' },
              { label:'TIME <CP', value:`${Math.round(wPrimeStats.tBelow/60)}m`,  color:'#5bc25b' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign:'center', minWidth:'80px' }}>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'16px', fontWeight:700, color }}>{value}</div>
                <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'8px', color:'#555', marginTop:'2px', letterSpacing:'0.08em' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Exhaustion alert */}
          {wPrimeStats.exhausted && (
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', background:'rgba(224,48,48,0.1)', border:'1px solid #e0303044', borderRadius:'4px', padding:'8px 12px', marginBottom:'12px', color:'#e03030' }}>
              ⚠ W' reached zero at {Math.floor(wPrimeStats.exhaustSec/60)}:{String(wPrimeStats.exhaustSec%60).padStart(2,'0')} — mechanical exhaustion point.
              Actual fatigue likely began ~30–60s earlier (neuromuscular pre-exhaustion).
            </div>
          )}

          {/* SVG Chart */}
          <div style={{ marginBottom:'10px' }}>
            <WPrimeChart series={wPrimeSeries} wPrimeMax={wPrimeStats.wCap}/>
          </div>

          {/* Legend */}
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'#555', lineHeight:1.8 }}>
            <span style={{ color:'#ff6600' }}>━</span> W' balance ·{' '}
            <span style={{ color:'#5bc25b' }}>- -</span> W' max ·{' '}
            <span style={{ color:'#e03030' }}>- -</span> exhaustion threshold (W'=0)
            <br/>
            Skiba 2012 · τ = 546·e^(−0.01·(CP−P̄)) + 316 · J Strength Cond Res 26(8)
          </div>
        </div>
      )}

      <ErrorBoundary inline name="Power Curve"><PowerCurve /></ErrorBoundary>

      <ErrorBoundary inline name="VO₂max Card"><VO2maxCard /></ErrorBoundary>

      {/* ─ HRV Deep Analysis ───────────────────────────────────────────────── */}
      <HRVDeepAnalysis />

      {weeksSinceLast !== null && weeksSinceLast >= 6 && (
        <div style={{ ...S.card, background:'#fffbeb', border:'1px solid #f5c54266', borderRadius:'6px', padding:'12px 16px', marginBottom:'16px', ...S.mono, fontSize:'11px', color:'#92400e' }}>
          ⏰ Last test: {lastTestDate} ({weeksSinceLast} weeks ago). Time to retest!
        </div>
      )}

      {/* ─ Test Battery Planner ──────────────────────────────────────────── */}
      <TestBatteryPlanner />

      {/* ─ Test history chart + benchmark goal ─────────────────────────── */}
      <TestHistoryGoal active={active} activeHistory={activeHistory} />

      {/* ─ Progress comparison + MDC ─────────────────────────────────────── */}
      <ResultComparison testLog={testLog} mdcPct={MDC_PCT} />
    </div>
  )
}
