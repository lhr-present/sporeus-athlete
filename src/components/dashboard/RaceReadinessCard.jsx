// ─── dashboard/RaceReadinessCard.jsx — Race readiness gauge + taper checklist ──
import { useContext, useState , memo} from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { computeRaceReadiness, predictRacePerformance } from '../../lib/intelligence.js'
import { useData } from '../../contexts/DataContext.jsx'

function RaceReadinessCard({ log, recovery, injuries, profile, plan, planStatus, lang }) {
  const { t: _t } = useContext(LangCtx)
  const { testResults, raceResults: raceResult, setRaceResults: setRaceResult } = useData()
  const [expanded, setExpanded] = useState(false)
  const [showPostRace, setShowPostRace] = useState(false)
  const [resultForm, setResultForm] = useState({ time:'', conditions:'normal', feeling:'3', notes:'' })

  const raceDate = profile?.raceDate
  if (!raceDate && !profile?.goal) return null
  if (log.length < 7) return null

  const rr = computeRaceReadiness(log, recovery, injuries, profile, plan, planStatus)
  const perf = predictRacePerformance(log, testResults, profile)

  const gradeColor = { 'A+':'#f5c542', A:'#5bc25b', B:'#0064ff', C:'#f5c542', D:'#e03030', F:'#e03030' }[rr.grade] || '#888'

  const R = 48, CX = 60, CY = 60, STROKE = 8
  const circumference = 2 * Math.PI * R
  const filled = circumference * rr.score / 100
  const dash   = `${filled} ${circumference - filled}`

  const daysDisp = rr.daysToRace !== null
    ? (rr.daysToRace <= 0 ? (lang==='tr'?'YARIŞ GÜNÜ!':'RACE DAY!') : `${lang==='tr'?'YARIŞA':'RACE IN'} ${rr.daysToRace} ${lang==='tr'?'GÜN':'DAYS'}`)
    : null

  const isRaceWeek = rr.daysToRace !== null && rr.daysToRace >= 0 && rr.daysToRace <= 7
  const sortedFactors = [...rr.factors].sort((a, b) => (a.score * a.weight) - (b.score * b.weight))
  const raceIsPast = raceDate && new Date(raceDate) < new Date()
  const hasResult  = raceResult.some(r => r.raceDate === raceDate)

  const saveResult = () => {
    const entry = { raceDate, ...resultForm, savedAt: new Date().toISOString() }
    const predicted = perf.predictions.find(p => (profile?.goal || '').toLowerCase().includes(p.label.toLowerCase()))
    if (predicted && resultForm.time) {
      const parts = resultForm.time.split(':').map(Number)
      const actualSec = parts.length === 3 ? parts[0]*3600+parts[1]*60+parts[2] : parts.length === 2 ? parts[0]*60+parts[1] : 0
      const predParts = predicted.predicted.split(':').map(Number)
      const predSec   = predParts.length === 3 ? predParts[0]*3600+predParts[1]*60+predParts[2] : predParts[0]*60+predParts[1]
      if (actualSec && predSec) {
        const delta = Math.round((predSec - actualSec) / predSec * 100)
        entry.accuracyDelta = delta
        entry.predictedTime = predicted.predicted
      }
    }
    setRaceResult(prev => [...prev, entry])
    setShowPostRace(false)
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'0ms', borderLeft:`4px solid ${gradeColor}`, ...(isRaceWeek ? { background: '#ff660008', border:`1px solid #ff660044` } : {}) }}>
      {isRaceWeek && (
        <div style={{ background:'#ff6600', margin:'-12px -16px 12px', padding:'10px 16px', borderRadius:'6px 6px 0 0' }}>
          <div style={{ ...S.mono, fontSize:'14px', fontWeight:700, color:'#fff', letterSpacing:'0.12em' }}>⚡ RACE WEEK</div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px', flexWrap:'wrap' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeWidth={STROKE}/>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke={gradeColor} strokeWidth={STROKE}
              strokeDasharray={dash} strokeDashoffset={circumference * 0.25}
              strokeLinecap="round" style={{ transition:'stroke-dasharray 0.5s ease' }}/>
            <text x={CX} y={CY - 6} textAnchor="middle" style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'22px', fontWeight:700, fill:gradeColor }}>{rr.grade}</text>
            <text x={CX} y={CY + 14} textAnchor="middle" style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'13px', fill:'var(--sub)' }}>{rr.score}/100</text>
          </svg>
          <div style={{ ...S.mono, fontSize:'8px', color:'#888' }}>{rr.confidence.toUpperCase()} CONFIDENCE</div>
        </div>

        <div style={{ flex:1, minWidth:'160px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
            <div style={S.cardTitle}>{lang==='tr'?'YARIŞ HAZIRLIĞI':'RACE READINESS'}</div>
            <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 8px' }} onClick={() => setExpanded(e => !e)}>
              {expanded ? '▲' : '▼ DETAILS'}
            </button>
          </div>
          <div style={{ ...S.mono, fontSize:'11px', color:'var(--text)', lineHeight:1.7, marginBottom:'8px' }}>
            {rr.verdict[lang] || rr.verdict.en}
          </div>
          {daysDisp && (
            <div style={{ ...S.mono, fontSize:'10px', fontWeight:600, color:rr.daysToRace <= 7 ? '#ff6600' : '#888', marginBottom:'6px' }}>
              {daysDisp}
            </div>
          )}
          {perf.reliable && perf.predictions.length > 0 && (() => {
            const goalDist = profile?.goal?.toLowerCase() || ''
            const match = perf.predictions.find(p => goalDist.includes(p.label.toLowerCase())) || perf.predictions[1]
            if (!match) return null
            return (
              <div style={{ ...S.mono, fontSize:'10px', color:'#888', lineHeight:1.6 }}>
                Predicted: <strong style={{ color:'#ff6600' }}>{match.predicted}</strong> (best {match.best} — worst {match.worst})<br/>
                <span style={{ fontSize:'9px' }}>via {perf.method}</span>
              </div>
            )
          })()}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop:'12px', borderTop:'1px solid var(--border)', paddingTop:'12px' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#888', letterSpacing:'0.06em', marginBottom:'8px' }}>FACTOR BREAKDOWN (worst first)</div>
          {sortedFactors.map(f => (
            <div key={f.name} style={{ marginBottom:'7px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'2px' }}>
                <span style={{ ...S.mono, fontSize:'9px', color: f.score < 50 ? '#e03030' : f.score < 70 ? '#f5c542' : '#888', letterSpacing:'0.04em' }}>{f.name}</span>
                <span style={{ ...S.mono, fontSize:'10px', fontWeight:600, color: f.score < 50 ? '#e03030' : f.score < 70 ? '#f5c542' : '#5bc25b' }}>{f.score}/100</span>
              </div>
              <div style={{ width:'100%', height:'4px', background:'var(--border)', borderRadius:'2px', overflow:'hidden' }}>
                <div style={{ width:`${f.score}%`, height:'100%', background: f.score < 50 ? '#e03030' : f.score < 70 ? '#f5c542' : '#5bc25b', borderRadius:'2px' }}/>
              </div>
              <div style={{ ...S.mono, fontSize:'9px', color:'var(--sub)', marginTop:'2px' }}>{f[lang] || f.en} (weight {Math.round(f.weight*100)}%)</div>
            </div>
          ))}

          {perf.reliable && perf.predictions.length > 0 && (
            <div style={{ marginTop:'10px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#0064ff', letterSpacing:'0.06em', marginBottom:'6px' }}>RACE PREDICTIONS</div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {perf.predictions.map(p => (
                  <div key={p.label} style={{ flex:'1 1 70px', textAlign:'center' }}>
                    <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>{p.label}</div>
                    <div style={{ ...S.mono, fontSize:'13px', fontWeight:600, color:'#ff6600' }}>{p.predicted}</div>
                    <div style={{ ...S.mono, fontSize:'8px', color:'#888' }}>{p.best}–{p.worst}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...S.mono, fontSize:'8px', color:'#888', marginTop:'4px' }}>{perf.method}</div>
            </div>
          )}

          {perf.trainingPaces && (
            <div style={{ marginTop:'10px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#ff6600', letterSpacing:'0.06em', marginBottom:'6px' }}>
                YOUR TRAINING PACES · VDOT {perf.trainingPaces.vdot}
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {[
                  { lbl:'E  EASY',      val: perf.trainingPaces.easy,      color:'#5bc25b' },
                  { lbl:'M  MARATHON',  val: perf.trainingPaces.marathon,  color:'#0064ff' },
                  { lbl:'T  THRESHOLD', val: perf.trainingPaces.threshold, color:'#ff6600' },
                  { lbl:'I  INTERVAL',  val: perf.trainingPaces.interval,  color:'#f5c542' },
                  { lbl:'R  REPS',      val: perf.trainingPaces.rep,       color:'#e03030' },
                ].map(({ lbl, val, color }) => (
                  <div key={lbl} style={{ flex:'1 1 70px', textAlign:'center' }}>
                    <div style={{ ...S.mono, fontSize:'10px', fontWeight:700, color }}>{val}</div>
                    <div style={{ ...S.mono, fontSize:'7px', color:'#555', letterSpacing:'0.08em', marginTop:'2px' }}>{lbl}</div>
                  </div>
                ))}
              </div>
              <div style={{ ...S.mono, fontSize:'8px', color:'#555', marginTop:'4px' }}>min:sec per km · Daniels 1998</div>
            </div>
          )}
        </div>
      )}

      {isRaceWeek && rr.daysToRace >= 0 && (
        <div style={{ marginTop:'12px', borderTop:'1px solid #ff660033', paddingTop:'12px' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#ff6600', letterSpacing:'0.06em', marginBottom:'8px' }}>TAPER CHECKLIST</div>
          {[
            { day: 6, en:"Last hard session — threshold or race-pace intervals", tr:"Son zorlu seans — eşik veya yarış temposu aralıklar" },
            { day: 5, en:"Easy run only — shakeout pace", tr:"Sadece kolay koşu — hafif tempo" },
            { day: 4, en:"Easy or rest — begin carb loading (8g/kg)", tr:"Kolay ya da dinlenme — karbonhidrat yüklemesi başlat (8g/kg)" },
            { day: 3, en:"Easy 30min — hydration focus — lay out race kit", tr:"30 dak kolay — sıvı alımına odaklan — yarış ekipmanını hazırla" },
            { day: 2, en:"Complete rest or light walk", tr:"Tam dinlenme veya hafif yürüyüş" },
            { day: 1, en:"Rest — pasta dinner — visualize the course — sleep early", tr:"Dinlenme — makarna — güzergahı zihinsel prova et — erken uyu" },
            { day: 0, en:"RACE DAY — trust the training", tr:"YARIŞ GÜNÜ — antrenmanına güven" },
          ].filter(c => c.day >= rr.daysToRace).map(c => {
            const isToday = c.day === rr.daysToRace
            return (
              <div key={c.day} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'5px 0', borderBottom:'1px solid var(--border)', opacity: isToday ? 1 : 0.6 }}>
                <span style={{ ...S.mono, fontSize:'10px', color: isToday ? '#ff6600' : '#888', minWidth:'50px' }}>
                  {c.day === 0 ? '🏁 TODAY' : `D-${c.day}`}
                </span>
                <span style={{ ...S.mono, fontSize:'10px', color: isToday ? 'var(--text)' : 'var(--sub)', lineHeight:1.6 }}>
                  {c[lang] || c.en}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {raceIsPast && !hasResult && (
        <div style={{ marginTop:'12px', borderTop:'1px solid var(--border)', paddingTop:'10px' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#f5c542', marginBottom:'8px' }}>📝 How did it go? Log your result.</div>
          {!showPostRace ? (
            <button style={{ ...S.btn, fontSize:'11px', padding:'6px 14px' }} onClick={() => setShowPostRace(true)}>
              {lang==='tr'?'Yarış Sonucunu Kaydet':'Log Race Result'}
            </button>
          ) : (
            <div>
              <div style={S.row}>
                <div style={{ flex:'1 1 130px' }}>
                  <label style={S.label}>FINISH TIME (hh:mm:ss)</label>
                  <input style={S.input} placeholder="3:28:45" value={resultForm.time} onChange={e=>setResultForm(f=>({...f,time:e.target.value}))}/>
                </div>
                <div style={{ flex:'1 1 130px' }}>
                  <label style={S.label}>CONDITIONS</label>
                  <select style={S.input} value={resultForm.conditions} onChange={e=>setResultForm(f=>({...f,conditions:e.target.value}))}>
                    {['normal','hot','cold','windy','hilly','wet'].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom:'8px' }}>
                <label style={S.label}>OVERALL FEELING</label>
                <div style={{ display:'flex', gap:'8px' }}>
                  {['😞','😕','😐','🙂','😄'].map((em,i)=>(
                    <button key={i} onClick={()=>setResultForm(f=>({...f,feeling:String(i+1)}))}
                      style={{ fontSize:'20px', padding:'4px 8px', borderRadius:'4px', border:`2px solid ${resultForm.feeling===String(i+1)?'#ff6600':'var(--border)'}`, background:resultForm.feeling===String(i+1)?'#ff660022':'transparent', cursor:'pointer' }}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button style={S.btn} onClick={saveResult}>{lang==='tr'?'Kaydet':'Save'}</button>
                <button style={S.btnSec} onClick={()=>setShowPostRace(false)}>{lang==='tr'?'Vazgeç':'Cancel'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {hasResult && (() => {
        const r = raceResult.find(x => x.raceDate === raceDate)
        if (!r || r.accuracyDelta === undefined) return null
        const delta = r.accuracyDelta
        const color = Math.abs(delta) <= 3 ? '#5bc25b' : '#f5c542'
        return (
          <div style={{ marginTop:'10px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px' }}>
            <div style={{ ...S.mono, fontSize:'10px', color:color, fontWeight:600 }}>
              {delta > 0 ? `${delta}% faster than predicted` : delta < 0 ? `${Math.abs(delta)}% slower than predicted` : 'Prediction matched actual.'}
            </div>
            <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginTop:'2px' }}>Predicted: {r.predictedTime} · Actual: {r.time}</div>
          </div>
        )
      })()}
    </div>
  )
}
export default memo(RaceReadinessCard)
