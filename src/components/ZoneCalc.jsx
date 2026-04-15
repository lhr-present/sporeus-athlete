import { useState, useEffect, useContext } from 'react'
import { logger } from '../lib/logger.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { RACE_DISTANCES, ZONE_COLORS, ZONE_NAMES, SPORT_CONFIG, ATHLETE_LEVELS } from '../lib/constants.js'
import { hrZones, powerZones, paceZones, parseTimeSec, fmtSec, fmtPace, riegel } from '../lib/formulas.js'
import { ZoneBar } from './ui.jsx'
import { useLocalStorage } from '../hooks/useLocalStorage.js'

function HeatModule() {
  const [temp, setTemp] = useState('25')
  const [humid, setHumid] = useState('50')
  const [days, setDays] = useState('0')
  useEffect(() => { try { localStorage.setItem('sporeus-heat-used','1') } catch (e) { logger.warn('localStorage:', e.message) } }, [])

  const T = parseFloat(temp)||25, H = parseFloat(humid)||50
  const D = parseInt(days)||0
  const hi = T < 27 ? T : Math.round((-8.78469475556 + 1.61139411*T + 2.3385248*H - 0.14611605*T*H - 0.012308094*T*T - 0.016424828*H*H + 0.002211732*T*T*H + 0.00072546*T*H*H - 0.000003582*T*T*H*H)*10)/10
  const accFactor = Math.min(1, D / 14)
  const rawAdj = Math.max(0, (hi - 15) * 0.3)
  const adj = Math.round(rawAdj * (1 - accFactor * 0.6) * 10) / 10
  const risk = hi >= 40 ? { label:'DANGER — Cancel/Shorten', color:'#e03030' } : hi >= 33 ? { label:'HIGH RISK — Major slow-down', color:'#e05030' } : hi >= 28 ? { label:'MODERATE — Reduce pace', color:'#f5c542' } : { label:'LOW — Normal training', color:'#5bc25b' }
  const accPct = Math.round(accFactor * 100)
  const phases = [
    { d:'Day 1–3',   desc:'Plasma volume ↑, sweat onset earlier' },
    { d:'Day 4–7',   desc:'Sweat rate ↑, salt conservation improves' },
    { d:'Day 8–12',  desc:'Cardiac output stabilises, HR lowers at pace' },
    { d:'Day 12–14', desc:'Full acclimatization (~60% benefit maintained)' },
  ]

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'200ms' }}>
      <div style={S.cardTitle}>HEAT ACCLIMATIZATION CALCULATOR</div>
      <div style={S.row}>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>TEMPERATURE (°C): <strong>{temp}</strong></label>
          <input type="range" min="10" max="45" value={temp} onChange={e=>setTemp(e.target.value)} style={{ width:'100%', accentColor:'#ff6600' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>10°C</span><span>45°C</span></div>
        </div>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>HUMIDITY (%): <strong>{humid}</strong></label>
          <input type="range" min="10" max="100" value={humid} onChange={e=>setHumid(e.target.value)} style={{ width:'100%', accentColor:'#ff6600' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>10%</span><span>100%</span></div>
        </div>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>ACCLIMATIZATION DAYS: <strong>{days}</strong></label>
          <input type="range" min="0" max="14" value={days} onChange={e=>setDays(e.target.value)} style={{ width:'100%', accentColor:'#5bc25b' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>0</span><span>14d</span></div>
        </div>
      </div>
      <div style={{ display:'flex', gap:'12px', marginTop:'14px', flexWrap:'wrap' }}>
        <div style={{ flex:'1 1 100px', background:'var(--card-bg)', border:`1px solid ${risk.color}44`, borderLeft:`3px solid ${risk.color}`, borderRadius:'5px', padding:'10px 12px' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>HEAT INDEX</div>
          <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:risk.color }}>{hi}°C</div>
          <div style={{ ...S.mono, fontSize:'10px', color:risk.color, fontWeight:600 }}>{risk.label}</div>
        </div>
        <div style={{ flex:'1 1 100px', background:'var(--card-bg)', border:'1px solid var(--border)', borderLeft:'3px solid #f5c542', borderRadius:'5px', padding:'10px 12px' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>PACE PENALTY</div>
          <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:'#f5c542' }}>+{adj}%</div>
          <div style={{ ...S.mono, fontSize:'9px', color:'#aaa' }}>{D>0?`Acclim. ${accPct}% ↓ penalty`:'No acclimatization'}</div>
        </div>
        <div style={{ flex:'1 1 100px', background:'var(--card-bg)', border:'1px solid var(--border)', borderLeft:'3px solid #5bc25b', borderRadius:'5px', padding:'10px 12px' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>ACCLIMATIZATION</div>
          <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:'#5bc25b' }}>{accPct}%</div>
          <div style={{ ...S.mono, fontSize:'9px', color:'#aaa' }}>of max adaptation</div>
        </div>
      </div>
      <div style={{ marginTop:'12px' }}>
        {phases.map((p,i)=>(
          <div key={i} style={{ display:'flex', gap:'8px', padding:'4px 0', borderBottom:'1px solid var(--border)', ...S.mono, fontSize:'11px' }}>
            <span style={{ color:D>=[0,3,7,12][i]?'#5bc25b':'var(--muted)', width:'72px', fontWeight:600 }}>{p.d}</span>
            <span style={{ color:'var(--sub)' }}>{p.desc}</span>
          </div>
        ))}
      </div>
      <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'8px' }}>Steadman heat index · ACSM pace guidelines · Armstrong & Maresh acclimatization model</div>
    </div>
  )
}

function AltitudeModule() {
  const [alt, setAlt] = useState('2000')
  const [days, setDays] = useState('0')
  const [vo2max, setVo2max] = useState('55')

  const A = parseInt(alt)||2000, D = parseInt(days)||0, V = parseFloat(vo2max)||55
  const baseline = 1500
  const decPct = A > baseline ? Math.round((A - baseline) / 300 * 3 * 10) / 10 : 0
  const accFactor = Math.min(1, D / 21)
  const netDecPct = Math.round(decPct * (1 - accFactor * 0.5) * 10) / 10
  const adjVO2 = Math.round((V * (1 - netDecPct / 100)) * 10) / 10
  const paceAdj = netDecPct
  const seaReturn = D > 21 ? 'Up to +3% VO2max benefit above baseline (polycythemia)' : D > 7 ? 'EPO response begun — partial benefit on return' : 'Minimal EPO adaptation yet'
  const alts = [
    { label:'Low (<1500m)',    color:'#5bc25b', desc:'No significant effect' },
    { label:'Moderate (1500–2500m)', color:'#f5c542', desc:'Ideal LHTL zone' },
    { label:'High (2500–4000m)',     color:'#e05030', desc:'Training quality ↓, acclimatize first' },
    { label:'Extreme (>4000m)',      color:'#e03030', desc:'O2 availability critical' },
  ]
  const zone = A < 1500 ? alts[0] : A < 2500 ? alts[1] : A < 4000 ? alts[2] : alts[3]

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'220ms' }}>
      <div style={S.cardTitle}>ALTITUDE TRAINING CALCULATOR</div>
      <div style={S.row}>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>ALTITUDE (m): <strong>{alt}</strong></label>
          <input type="range" min="0" max="5000" step="100" value={alt} onChange={e=>setAlt(e.target.value)} style={{ width:'100%', accentColor:'#ff6600' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>0m</span><span>5000m</span></div>
        </div>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>DAYS AT ALTITUDE: <strong>{days}</strong></label>
          <input type="range" min="0" max="28" value={days} onChange={e=>setDays(e.target.value)} style={{ width:'100%', accentColor:'#5bc25b' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>0</span><span>28d</span></div>
        </div>
        <div style={{ flex:'1 1 140px' }}>
          <label style={S.label}>YOUR VO2MAX: <strong>{vo2max}</strong></label>
          <input type="range" min="30" max="90" value={vo2max} onChange={e=>setVo2max(e.target.value)} style={{ width:'100%', accentColor:'#4a90d9' }}/>
          <div style={{ display:'flex', justifyContent:'space-between', ...S.mono, fontSize:'9px', color:'#aaa' }}><span>30</span><span>90</span></div>
        </div>
      </div>
      <div style={{ display:'flex', gap:'12px', marginTop:'14px', flexWrap:'wrap' }}>
        <div style={{ flex:'1 1 100px', background:'var(--card-bg)', border:`1px solid ${zone.color}44`, borderLeft:`3px solid ${zone.color}`, borderRadius:'5px', padding:'10px 12px' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>ALTITUDE ZONE</div>
          <div style={{ ...S.mono, fontSize:'13px', fontWeight:600, color:zone.color }}>{zone.label}</div>
          <div style={{ ...S.mono, fontSize:'9px', color:'#aaa' }}>{zone.desc}</div>
        </div>
        <div style={{ flex:'1 1 100px', background:'var(--card-bg)', border:'1px solid var(--border)', borderLeft:'3px solid #e03030', borderRadius:'5px', padding:'10px 12px' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>VO2MAX IMPACT</div>
          <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:'#e03030' }}>-{netDecPct}%</div>
          <div style={{ ...S.mono, fontSize:'9px', color:'#aaa' }}>Adj VO2max: {adjVO2} ml/kg/min</div>
        </div>
        <div style={{ flex:'1 1 100px', background:'var(--card-bg)', border:'1px solid var(--border)', borderLeft:'3px solid #f5c542', borderRadius:'5px', padding:'10px 12px' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>PACE PENALTY</div>
          <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:'#f5c542' }}>+{paceAdj}%</div>
          <div style={{ ...S.mono, fontSize:'9px', color:'#aaa' }}>Slow down at altitude</div>
        </div>
      </div>
      <div style={{ ...S.mono, fontSize:'11px', color:'#5bc25b', marginTop:'12px', padding:'8px 10px', background:'#5bc25b11', borderRadius:'4px', lineHeight:1.6 }}>
        ↑ Sea-level return benefit: {seaReturn}
      </div>
      <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'8px' }}>Chapman (1998) VO2max model · LHTL protocol (Levine &amp; Stray-Gundersen, 1997) · Woorons acclimatization</div>
    </div>
  )
}

export default function ZoneCalc() {
  const { t } = useContext(LangCtx)
  const [profileLS] = useLocalStorage('sporeus_profile', {})
  const isElite = profileLS?.athleteLevel === 'elite' || profileLS?.athleteLevel === 'advanced'
  const [mode, setMode] = useState(() => {
    const sc = SPORT_CONFIG[profileLS?.primarySport]
    return sc?.defaultZoneMode === 'power' ? 'power' : sc?.defaultZoneMode === 'pace' ? 'pace' : 'hr'
  })
  const [maxHR, setMaxHR] = useState('')
  const [ftp, setFtp] = useState('')
  const [threshPace, setThreshPace] = useState('')
  const [age, setAge] = useState('')
  const [zones, setZones] = useState([])
  const [swimT400, setSwimT400] = useState('')
  const [swimT200, setSwimT200] = useState('')
  const [rowT2k, setRowT2k] = useState('')
  const [rDist, setRDist] = useState('5000')
  const [rDistCustom, setRDistCustom] = useState('')
  const [rTime, setRTime] = useState('')
  const [preds, setPreds] = useState(null)
  // Pacing plan state
  const [paceDist, setPaceDist] = useState('42195')
  const [paceTime, setPaceTime] = useState('')
  const [paceStrat, setPaceStrat] = useState('even')
  const [pacePlan, setPacePlan] = useState(null)
  const [paceCopied, setPaceCopied] = useState(false)

  const estHR = age ? Math.round(208-0.7*parseInt(age)) : null

  // Swimming CSS: (400m_time - 200m_time) / 2 = CSS pace per 100m
  const cssZones = (t400str, t200str) => {
    const t4=parseTimeSec(t400str), t2=parseTimeSec(t200str)
    if(isNaN(t4)||isNaN(t2)) return []
    const css=(t4-t2)/2 // sec/100m
    const offsets=[15,8,3,0,-3]
    return ZONE_NAMES.map((name,i)=>{
      const pace=css+offsets[i], m=Math.floor(pace/60), s=Math.round(pace%60)
      return { name, pace:`${m}:${String(s).padStart(2,'0')} /100m`, color:ZONE_COLORS[i] }
    })
  }
  // Rowing: 2K split + 5s = threshold split per 500m
  const rowZones = (t2kStr) => {
    const t2k=parseTimeSec(t2kStr)
    if(isNaN(t2k)) return []
    const split=t2k/4 // split per 500m
    const offsets=[25,15,5,0,-5]
    const rateLabels=['UT2','UT1','AT','TR','Race']
    return ZONE_NAMES.map((name,i)=>{
      const s=split+offsets[i]+5, m=Math.floor(s/60), sec=Math.round(s%60)
      return { name:`${name} (${rateLabels[i]})`, pace:`${m}:${String(sec).padStart(2,'0')} /500m`, color:ZONE_COLORS[i] }
    })
  }

  const calcZones = () => {
    if (mode==='hr') {
      const hr=parseInt(maxHR)||estHR; if(hr) setZones(hrZones(hr))
    } else if (mode==='power') {
      const f=parseInt(ftp); if(f) setZones(powerZones(f))
    } else if (mode==='swim') {
      setZones(cssZones(swimT400, swimT200))
    } else if (mode==='row') {
      setZones(rowZones(rowT2k))
    } else {
      const [m,s]=threshPace.split(':').map(Number)
      if (!isNaN(m)) setZones(paceZones(m+(s||0)/60))
    }
  }

  const genPacePlan = () => {
    const distM = parseInt(paceDist)||42195
    const totalSec = parseTimeSec(paceTime)
    if (isNaN(totalSec)||totalSec<=0) return
    const kmCount = Math.ceil(distM/1000)
    const avgSecPerKm = totalSec / (distM/1000)
    const rows = []
    let cumSec = 0
    for (let k=1; k<=kmCount; k++) {
      const isLast = k===kmCount
      const segDist = isLast ? distM-(kmCount-1)*1000 : 1000
      let factor = 1
      if (paceStrat==='negative') {
        factor = k <= Math.floor(kmCount/2) ? 1.03 : 0.97
      } else if (paceStrat==='positive') {
        const q = Math.ceil(k / (kmCount/4))
        factor = q===1 ? 0.98 : q===2 ? 1.0 : q===3 ? 1.01 : 1.02
      }
      const splitSec = avgSecPerKm * factor * (segDist/1000)
      cumSec += splitSec
      const fuelNote = cumSec >= 45*60 && Math.floor((cumSec-splitSec)/45/60) < Math.floor(cumSec/45/60)
        ? 'GEL' : cumSec >= 20*60 && Math.floor((cumSec-splitSec)/20/60) < Math.floor(cumSec/20/60)
        ? 'Water' : ''
      const mm=m=>Math.floor(m/60), ss=m=>Math.round(m%60)
      rows.push({ km:k, split:`${mm(splitSec)}:${String(ss(splitSec)).padStart(2,'0')}`, cumul:`${mm(cumSec)}:${String(ss(cumSec)).padStart(2,'0')}`, fuel:fuelNote })
    }
    setPacePlan({ rows, strat:paceStrat, dist:distM, totalSec })
  }

  const copyPacePlan = () => {
    if (!pacePlan) return
    const lines = [`Race Pacing Plan — ${paceStrat} split — ${pacePlan.dist}m`, 'KM\tSPLIT\tCUMUL.\tFUEL',
      ...pacePlan.rows.map(r=>`${r.km}\t${r.split}\t${r.cumul}\t${r.fuel}`)]
    navigator.clipboard?.writeText(lines.join('\n'))
    setPaceCopied(true); setTimeout(()=>setPaceCopied(false), 2000)
  }

  const printPacePlan = () => {
    if (!pacePlan) return
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    const w=window.open('','_blank')
    if (!w) return
    w.document.write(`<html><head><title>Race Pacing Plan</title><style>body{font-family:'Courier New',monospace;padding:20px;font-size:12px}table{border-collapse:collapse;width:100%}td,th{padding:4px 10px;border:1px solid #ccc;text-align:left}th{background:#f5f5f5}</style></head><body>
    <h2>Race Pacing Plan</h2><p>Strategy: ${esc(pacePlan.strat)} | Distance: ${esc(pacePlan.dist)}m | Target: ${esc(fmtSec(pacePlan.totalSec))}</p>
    <table><tr><th>KM</th><th>SPLIT</th><th>CUMUL.</th><th>FUELING</th></tr>
    ${pacePlan.rows.map(r=>`<tr><td>${esc(r.km)}</td><td>${esc(r.split)}</td><td>${esc(r.cumul)}</td><td style="color:${r.fuel?'#cc5500':''}">${esc(r.fuel||'—')}</td></tr>`).join('')}
    </table><p style="font-size:10px;color:#888">sporeus.com — Race Pacing Calculator</p>
    </body></html>`)
    w.document.close(); w.onload=()=>w.print()
  }

  const predict = () => {
    const d1=rDist==='custom'?parseInt(rDistCustom):parseInt(rDist)
    const t1=parseTimeSec(rTime)
    if (!d1||isNaN(t1)) return
    const targets=[{label:'5 km',m:5000},{label:'10 km',m:10000},{label:'Half Marathon',m:21097},{label:'Marathon',m:42195}]
    setPreds(targets.map(({label,m})=>({ label, time:fmtSec(riegel(t1,d1,m)), pace:fmtPace(riegel(t1,d1,m),m) })))
  }

  return (
    <div className="sp-fade">
      <div className="sp-card" style={{ ...S.card, animationDelay:'0ms' }}>
        <div style={S.cardTitle}>{t('zoneCalcTitle')}</div>
        <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
          {[['hr',t('hrMode')],['power',t('pwrMode')],['pace',t('paceMode')],['swim','SWIM (CSS)'],['row','ROWING (2K)']].map(([id,lbl])=>(
            <button key={id} onClick={()=>{setMode(id);setZones([])}} style={{ ...S.navBtn(mode===id), borderRadius:'4px', fontSize:'10px' }}>{lbl}</button>
          ))}
        </div>
        {mode==='hr' && (
          <div style={S.row}>
            <div style={{ flex:'1 1 160px' }}>
              <label style={S.label}>{t('maxHRIn')}</label>
              <input style={S.input} type="number" placeholder="185" value={maxHR} onChange={e=>setMaxHR(e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 140px' }}>
              <label style={S.label}>{t('ageIn')}</label>
              <input style={S.input} type="number" placeholder="32" value={age} onChange={e=>setAge(e.target.value)}/>
              {estHR&&!maxHR&&<div style={{ ...S.mono, fontSize:'11px', color:'#888', marginTop:'4px' }}>{t('estMaxHR')} {estHR}</div>}
            </div>
          </div>
        )}
        {mode==='power' && (
          <div style={{ flex:'1 1 200px' }}>
            <label style={S.label}>{t('ftpIn')}</label>
            <input style={S.input} type="number" placeholder="280" value={ftp} onChange={e=>setFtp(e.target.value)}/>
          </div>
        )}
        {mode==='pace' && (
          <div style={{ flex:'1 1 200px' }}>
            <label style={S.label}>{t('threshPaceIn')}</label>
            <input style={S.input} type="text" placeholder="4:45" value={threshPace} onChange={e=>setThreshPace(e.target.value)}/>
          </div>
        )}
        {mode==='swim' && (
          <div style={S.row}>
            <div style={{ flex:'1 1 160px' }}>
              <label style={S.label}>400m TIME (mm:ss)</label>
              <input style={S.input} type="text" placeholder="6:30" value={swimT400} onChange={e=>setSwimT400(e.target.value)}/>
            </div>
            <div style={{ flex:'1 1 160px' }}>
              <label style={S.label}>200m TIME (mm:ss)</label>
              <input style={S.input} type="text" placeholder="3:00" value={swimT200} onChange={e=>setSwimT200(e.target.value)}/>
            </div>
          </div>
        )}
        {mode==='row' && (
          <div style={{ flex:'1 1 200px' }}>
            <label style={S.label}>2K ERG TIME (mm:ss)</label>
            <input style={S.input} type="text" placeholder="6:45" value={rowT2k} onChange={e=>setRowT2k(e.target.value)}/>
          </div>
        )}
        <button style={{ ...S.btn, marginTop:'14px' }} onClick={calcZones}>{t('calcZonesBtn')}</button>
      </div>

      {zones.length>0 && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'50ms' }}>
          <div style={S.cardTitle}>{mode==='hr'?t('hrMode'):mode==='power'?t('pwrMode'):t('paceMode')} ZONES</div>
          {zones.map((z,i)=>(
            <div key={i} style={{ marginBottom:'14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                <span style={{ ...S.mono, fontSize:'12px', fontWeight:600, color:z.color }}>{z.name}</span>
                <span style={{ ...S.mono, fontSize:'13px', fontWeight:600 }}>{z.pace||`${z.low}\u2013${z.high} ${mode==='hr'?'bpm':'W'}`}</span>
              </div>
              <ZoneBar pct={(i+1)*20} color={z.color}/>
            </div>
          ))}
          {/* Elite: W/kg display */}
          {isElite && mode==='power' && (() => {
            const ftpVal = parseFloat(ftp)
            const wt = parseFloat(profileLS?.weight||0)
            if (!ftpVal || !wt) return null
            const wkg = Math.round(ftpVal/wt*100)/100
            const wkgColor = wkg>=5?'#f5c542':wkg>=4?'#5bc25b':wkg>=3.5?'#4a90d9':'#888'
            const wkgLabel = wkg>=5?'World class':wkg>=4?'Elite / Cat 1':wkg>=3.5?'Competitive':wkg>=3?'Recreational':'Beginner'
            return (
              <div style={{ display:'flex', gap:'12px', marginTop:'12px', padding:'8px 10px', background:'var(--surface)', borderRadius:'4px', border:'1px solid var(--border)' }}>
                <div>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>W/KG</div>
                  <div style={{ ...S.mono, fontSize:'22px', fontWeight:600, color:wkgColor }}>{wkg}</div>
                  <div style={{ ...S.mono, fontSize:'9px', color:wkgColor }}>{wkgLabel}</div>
                </div>
                <div style={{ borderLeft:'1px solid var(--border)', paddingLeft:'12px' }}>
                  <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>W/KG BENCHMARKS</div>
                  {[['5.0+','World class'],['4.0–5.0','Elite / Cat 1'],['3.5–4.0','Competitive'],['3.0–3.5','Recreational']].map(([r,l])=>(
                    <div key={r} style={{ ...S.mono, fontSize:'10px', color:'var(--sub)' }}>{r} — {l}</div>
                  ))}
                </div>
              </div>
            )
          })()}
          {/* Elite: Pace at VO2max */}
          {isElite && mode==='pace' && (() => {
            const vo2 = parseFloat(profileLS?.vo2max||0)
            if (!vo2) return null
            const paceSecKm = Math.round(12600/vo2)
            const pm = Math.floor(paceSecKm/60), ps = paceSecKm%60
            return (
              <div style={{ ...S.mono, fontSize:'11px', color:'#4a90d9', marginTop:'10px', padding:'7px 10px', background:'#4a90d911', borderRadius:'4px' }}>
                ◈ Pace at VO2max (vVO2max): <strong>{pm}:{String(ps).padStart(2,'0')} /km</strong>
                <span style={{ fontSize:'9px', color:'#888', marginLeft:'8px' }}>Formula: 12600 / VO2max</span>
              </div>
            )
          })()}
          <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'8px' }}>
            Coggan (power) · Tanaka/Karvonen (HR) · McMillan (pace) · CSS/T-pace (swim) · 2K split model (row)
          </div>
        </div>
      )}

      <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
        <div style={S.cardTitle}>{t('racePredTitle')}</div>
        <div style={S.row}>
          <div style={{ flex:'1 1 180px' }}>
            <label style={S.label}>{t('raceDistLabel')}</label>
            <select style={S.select} value={rDist} onChange={e=>setRDist(e.target.value)}>
              {RACE_DISTANCES.map(d=>(
                <option key={d.label} value={d.m===0?'custom':String(d.m)}>{d.label}</option>
              ))}
            </select>
          </div>
          {rDist==='custom' && (
            <div style={{ flex:'1 1 130px' }}>
              <label style={S.label}>CUSTOM (meters)</label>
              <input style={S.input} type="number" placeholder="8000" value={rDistCustom} onChange={e=>setRDistCustom(e.target.value)}/>
            </div>
          )}
          <div style={{ flex:'1 1 180px' }}>
            <label style={S.label}>{t('raceTimeLabel')}</label>
            <input style={S.input} type="text" placeholder="22:30" value={rTime} onChange={e=>setRTime(e.target.value)}/>
          </div>
        </div>
        <button style={{ ...S.btn, marginTop:'14px' }} onClick={predict}>{t('predictBtn')}</button>
      </div>

      {preds && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'150ms' }}>
          <div style={S.cardTitle}>{t('predsTitle')}</div>
          <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'13px' }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', color:'#888', fontSize:'10px', letterSpacing:'0.08em' }}>
                <th style={{ textAlign:'left', padding:'4px 0 8px', fontWeight:600 }}>{t('distCol')}</th>
                <th style={{ textAlign:'right', padding:'4px 0 8px', fontWeight:600 }}>{t('timeCol')}</th>
                <th style={{ textAlign:'right', padding:'4px 0 8px', fontWeight:600 }}>{t('paceCol')}</th>
              </tr>
            </thead>
            <tbody>
              {preds.map(p=>(
                <tr key={p.label} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'8px 0', fontWeight:600 }}>{p.label}</td>
                  <td style={{ textAlign:'right', padding:'8px 0', color:'#ff6600', fontWeight:600 }}>{p.time}</td>
                  <td style={{ textAlign:'right', padding:'8px 0', color:'var(--sub)' }}>{p.pace}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...S.mono, fontSize:'10px', color:'#aaa', marginTop:'8px' }}>Riegel (1977): T2 = T1 \u00d7 (D2/D1)^1.06</div>
        </div>
      )}

      {/* Race Pacing Strategy */}
      <div className="sp-card" style={{ ...S.card, animationDelay:'160ms' }}>
        <div style={S.cardTitle}>{t('pacingTitle')}</div>
        <div style={S.row}>
          <div style={{ flex:'1 1 160px' }}>
            <label style={S.label}>{t('pacingDistL')}</label>
            <select style={S.select} value={paceDist} onChange={e=>setPaceDist(e.target.value)}>
              <option value="5000">5 km</option>
              <option value="10000">10 km</option>
              <option value="21097">Half Marathon</option>
              <option value="42195">Marathon</option>
            </select>
          </div>
          <div style={{ flex:'1 1 160px' }}>
            <label style={S.label}>{t('pacingTimeL')}</label>
            <input style={S.input} type="text" placeholder="3:30:00" value={paceTime} onChange={e=>setPaceTime(e.target.value)}/>
          </div>
          <div style={{ flex:'1 1 160px' }}>
            <label style={S.label}>{t('pacingStratL')}</label>
            <select style={S.select} value={paceStrat} onChange={e=>setPaceStrat(e.target.value)}>
              <option value="even">{t('pacingEvenSplit')}</option>
              <option value="negative">{t('pacingNegSplit')}</option>
              <option value="positive">{t('pacingPosSplit')}</option>
            </select>
          </div>
        </div>
        <button style={{ ...S.btn, marginTop:'14px' }} onClick={genPacePlan}>{t('pacingGenBtn')}</button>
      </div>

      {pacePlan && (
        <div className="sp-card" style={{ ...S.card, animationDelay:'170ms' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
            <div style={S.cardTitle}>{pacePlan.strat.toUpperCase()} SPLIT PLAN — {fmtSec(pacePlan.totalSec)}</div>
            <div style={{ display:'flex', gap:'6px' }}>
              {paceCopied && <span style={{ ...S.mono, fontSize:'10px', color:'#5bc25b' }}>✓</span>}
              <button onClick={copyPacePlan} style={{ ...S.btnSec, fontSize:'10px', padding:'3px 8px' }}>{t('pacingCopyBtn')}</button>
              <button onClick={printPacePlan} style={{ ...S.btnSec, fontSize:'10px', padding:'3px 8px' }}>{t('pacingPrintBtn')}</button>
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', ...S.mono, fontSize:'11px' }}>
              <thead>
                <tr style={{ borderBottom:'2px solid var(--border)', color:'#888', fontSize:'9px', letterSpacing:'0.08em' }}>
                  <th style={{ textAlign:'left', padding:'3px 6px 6px 0', fontWeight:600 }}>{t('pacingKm')}</th>
                  <th style={{ textAlign:'right', padding:'3px 6px 6px 0', fontWeight:600 }}>{t('pacingSplit')}</th>
                  <th style={{ textAlign:'right', padding:'3px 6px 6px 0', fontWeight:600 }}>{t('pacingCumul')}</th>
                  <th style={{ textAlign:'right', padding:'3px 0 6px 0', fontWeight:600 }}>{t('pacingFuel')}</th>
                </tr>
              </thead>
              <tbody>
                {pacePlan.rows.map(r=>(
                  <tr key={r.km} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'4px 6px 4px 0', color:'var(--sub)' }}>{r.km}</td>
                    <td style={{ textAlign:'right', padding:'4px 6px 4px 0', color:'#ff6600', fontWeight:600 }}>{r.split}</td>
                    <td style={{ textAlign:'right', padding:'4px 6px 4px 0' }}>{r.cumul}</td>
                    <td style={{ textAlign:'right', padding:'4px 0', color:r.fuel?'#f5c542':'#aaa', fontWeight:r.fuel?600:400 }}>{r.fuel||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ ...S.mono, fontSize:'9px', color:'#aaa', marginTop:'8px' }}>Gel at 45/90/135min · Water every 20min</div>
        </div>
      )}

      <HeatModule />
      <AltitudeModule />
    </div>
  )
}
