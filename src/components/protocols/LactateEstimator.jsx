// ─── LactateEstimator — blood lactate threshold estimator ────────────────────
import { useState, useMemo } from 'react'
import { S } from '../../styles.js'
import { estimateLTFromStep, formatLTResult, computeLactateDrift } from '../../lib/sport/lactate.js'
import { logger } from '../../lib/logger.js'

// Translation helper — minimal bilingual map for standalone use
const DRIFT_LABELS = {
  en: {
    lactateTrendImproving: 'Improving',
    lactateTrendStable: 'Stable',
    lactateTrendDeclining: 'Declining',
    lactateTrendLowConf: 'low confidence',
    lactateTrendMedConf: 'medium confidence',
    lactateTrendHighConf: 'high confidence',
  },
  tr: {
    lactateTrendImproving: 'Gelişiyor',
    lactateTrendStable: 'Sabit',
    lactateTrendDeclining: 'Düşüyor',
    lactateTrendLowConf: 'düşük güvenilirlik',
    lactateTrendMedConf: 'orta güvenilirlik',
    lactateTrendHighConf: 'yüksek güvenilirlik',
  },
}

export default function LactateEstimator({ lang = 'en' }) {
  const [sport, setSport]   = useState('bike')
  const [steps, setSteps]   = useState([
    { load:'', lactate:'' }, { load:'', lactate:'' }, { load:'', lactate:'' },
    { load:'', lactate:'' }, { load:'', lactate:'' }, { load:'', lactate:'' },
  ])
  const [result, setResult] = useState(null)
  const [saved,  setSaved]  = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const LOAD_UNIT = { bike:'W', run:'km/h', swim:'min/100m', row:'W' }
  const unit = LOAD_UNIT[sport] || 'W'

  const tl = (key) => (DRIFT_LABELS[lang] || DRIFT_LABELS.en)[key] || key

  // Load LT history from localStorage and compute drift
  const drift = useMemo(() => {
    try {
      const history = JSON.parse(localStorage.getItem('sporeus-lt-history') || '[]')
      const sessions = history
        .filter(r => r && r.date && (r.lt2 != null || r.lt != null))
        .map(r => ({ date: r.date, lt2W: r.lt2 ?? r.lt }))
      return computeLactateDrift(sessions)
    } catch { return null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setStep = (i, field, val) => {
    const next = [...steps]
    next[i] = { ...next[i], [field]: val }
    setSteps(next)
    setResult(null)
  }

  const addRow    = () => setSteps(prev => [...prev, { load:'', lactate:'' }])
  const removeRow = (i) => setSteps(prev => prev.filter((_,j) => j !== i))

  const handleCalculate = () => {
    const parsed = steps
      .map(s => ({ load: parseFloat(s.load), lactate: parseFloat(s.lactate) }))
      .filter(s => !isNaN(s.load) && !isNaN(s.lactate))
    const r = estimateLTFromStep(parsed, { loadUnit: unit })
    setResult(r)
    setSaved(false)
  }

  const handleSave = () => {
    if (!result || result.error) return
    const record = { date: new Date().toISOString().slice(0,10), sport, ...result }
    try {
      const history = JSON.parse(localStorage.getItem('sporeus-lt-history') || '[]')
      history.push(record)
      localStorage.setItem('sporeus-lt-history', JSON.stringify(history))
    } catch (e) { logger.warn('localStorage:', e.message) }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const fmt = result && !result.error ? formatLTResult(result, sport) : null

  // Simple SVG chart for lactate curve + raw points + LT markers
  const LactateSVG = ({ steps: rawSteps, curve, lt1, lt2 }) => {
    const pts = rawSteps.filter(s => !isNaN(parseFloat(s.load)) && !isNaN(parseFloat(s.lactate)))
      .map(s => ({ load: parseFloat(s.load), lactate: parseFloat(s.lactate) }))
    if (!curve || curve.length < 2 || pts.length < 3) return null
    const allLoads  = curve.map(c => c.load)
    const allLacs   = [...curve.map(c => c.lactate), ...pts.map(p => p.lactate)]
    const minX = Math.min(...allLoads), maxX = Math.max(...allLoads)
    const minY = 0, maxY = Math.max(...allLacs) * 1.1 || 8
    const W = 400, H = 160
    const PAD = { l:32, r:12, t:10, b:24 }
    const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b
    const px = x => PAD.l + ((x - minX) / (maxX - minX || 1)) * cW
    const py = y => PAD.t + cH - ((y - minY) / (maxY - minY || 1)) * cH
    const curvePts = curve.map(c => `${px(c.load).toFixed(1)},${py(c.lactate).toFixed(1)}`).join(' ')
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', maxWidth:W, display:'block', overflow:'visible' }}>
        <polyline fill="none" stroke="#0064ff" strokeWidth="1.5" points={curvePts} />
        {pts.map((p,i) => (
          <circle key={i} cx={px(p.load)} cy={py(p.lactate)} r={4} fill="#f5c542" stroke="#000" strokeWidth="0.5" />
        ))}
        {lt1 != null && (
          <line x1={px(lt1)} y1={PAD.t} x2={px(lt1)} y2={PAD.t+cH} stroke="#5bc25b" strokeWidth="1" strokeDasharray="4 3" />
        )}
        {lt2 != null && (
          <line x1={px(lt2)} y1={PAD.t} x2={px(lt2)} y2={PAD.t+cH} stroke="#ff6600" strokeWidth="1.5" strokeDasharray="4 3" />
        )}
        {lt1 != null && <text x={px(lt1)} y={PAD.t-2} fontSize="8" fill="#5bc25b" textAnchor="middle">LT1</text>}
        {lt2 != null && <text x={px(lt2)} y={PAD.t-2} fontSize="8" fill="#ff6600" textAnchor="middle">LT2</text>}
        <text x={PAD.l-2} y={py(0)+3}   fontSize="8" fill="#444" textAnchor="end">0</text>
        <text x={PAD.l-2} y={py(maxY/2)+3} fontSize="8" fill="#444" textAnchor="end">{(maxY/2).toFixed(1)}</text>
        <text x={PAD.l-2} y={py(maxY)+3}  fontSize="8" fill="#444" textAnchor="end">{maxY.toFixed(1)}</text>
        <text x={px(minX)} y={H} fontSize="8" fill="#555" textAnchor="middle">{minX}</text>
        <text x={px(maxX)} y={H} fontSize="8" fill="#555" textAnchor="middle">{maxX}</text>
        <text x={W/2} y={H} fontSize="8" fill="#444" textAnchor="middle">{unit}</text>
      </svg>
    )
  }

  return (
    <div style={{ fontFamily:"'IBM Plex Mono',monospace" }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
        <div>
          <div style={{ fontSize:'11px', fontWeight:700, color:'#ff6600', letterSpacing:'0.1em' }}>
            LACTATE THRESHOLD ESTIMATOR
          </div>
          <div style={{ fontSize:'9px', color:'#555', marginTop:'2px' }}>
            {lang==='tr' ? 'D-max yöntemi (Cheng 1992) — basamaklı test verileri girin' : 'D-max method (Cheng 1992) — enter incremental step-test data'}
          </div>
        </div>
        <button onClick={() => setCollapsed(c=>!c)} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'16px' }}>
          {collapsed ? '▶' : '▼'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:'9px', color:'#555', letterSpacing:'0.08em' }}>{lang==='tr' ? 'SPOR:' : 'SPORT:'}</span>
            {['bike','run','swim','row'].map(sp => (
              <button key={sp} onClick={() => setSport(sp)}
                style={{ ...S.navBtn(sport===sp), borderRadius:'4px', fontSize:'10px', padding:'4px 10px' }}>
                {sp.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ overflowX:'auto', marginBottom:'12px' }}>
            <table style={{ borderCollapse:'collapse', fontSize:'11px', width:'100%' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #2a2a2a', color:'#555', fontSize:'9px', letterSpacing:'0.06em' }}>
                  <th style={{ padding:'4px 8px 6px 0', textAlign:'left', fontWeight:600 }}>LOAD ({unit})</th>
                  <th style={{ padding:'4px 8px 6px 0', textAlign:'left', fontWeight:600 }}>LACTATE (mmol/L)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {steps.map((row, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #1a1a1a' }}>
                    <td style={{ padding:'4px 8px 4px 0' }}>
                      <input type="number" placeholder={unit === 'W' ? '100' : '8'} value={row.load}
                        onChange={e => setStep(i, 'load', e.target.value)}
                        style={{ ...S.input, width:'90px', marginBottom:0 }} />
                    </td>
                    <td style={{ padding:'4px 8px 4px 0' }}>
                      <input type="number" step="0.1" placeholder="1.2" value={row.lactate}
                        onChange={e => setStep(i, 'lactate', e.target.value)}
                        style={{ ...S.input, width:'90px', marginBottom:0 }} />
                    </td>
                    <td>
                      {steps.length > 4 && (
                        <button onClick={() => removeRow(i)}
                          style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'13px' }}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
            <button onClick={addRow} style={{ ...S.btnSec, fontSize:'10px' }}>+ ADD STEP</button>
            <button onClick={handleCalculate} style={S.btn}>
              {lang==='tr' ? '▶ EŞİK HESAPLA' : '▶ ESTIMATE THRESHOLD'}
            </button>
          </div>

          {result?.error && (
            <div style={{ fontSize:'11px', color:'#e03030', marginBottom:'12px' }}>⚠ {result.error}</div>
          )}

          {result && !result.error && fmt && (
            <div style={{ background:'#0a0a0a', borderRadius:'6px', padding:'16px', border:'1px solid #ff660033', marginBottom:'12px' }}>
              <LactateSVG steps={steps} curve={result.curve} lt1={result.lt1} lt2={result.lt2} />
              <div style={{ display:'flex', gap:'10px', marginTop:'14px', flexWrap:'wrap' }}>
                {[
                  { lbl:'LT1 (AEROBIC)', val: result.lt1 != null ? `${result.lt1} ${unit}` : '—', color:'#5bc25b' },
                  { lbl:'LT2 / D-MAX', val: `${result.lt} ${unit}`, color:'#ff6600' },
                  { lbl:'LACTATE @ LT2', val: result.ltLactate != null ? `${result.ltLactate} mmol/L` : '—', color:'#e0e0e0' },
                ].map(({ lbl, val, color }) => (
                  <div key={lbl} style={{ flex:'1 1 100px', textAlign:'center' }}>
                    <div style={{ fontSize:'8px', color:'#555', letterSpacing:'0.08em', marginBottom:'4px' }}>{lbl}</div>
                    <div style={{ fontSize:'16px', fontWeight:700, color }}>{val}</div>
                  </div>
                ))}
              </div>
              {/* ── LT2 Drift Badge ──────────────────────────────────────────── */}
              {drift && drift.confidence !== 'low' && (() => {
                const confKey = drift.confidence === 'high' ? 'lactateTrendHighConf' : 'lactateTrendMedConf'
                const confLabel = tl(confKey)
                if (drift.trend === 'improving') {
                  return (
                    <div style={{ fontSize:'10px', fontWeight:600, color:'#00c853', marginTop:'8px', letterSpacing:'0.04em' }}>
                      ↑ {tl('lactateTrendImproving')} +{drift.deltaPercent}%/mo ({confLabel})
                    </div>
                  )
                }
                if (drift.trend === 'declining') {
                  return (
                    <div style={{ fontSize:'10px', fontWeight:600, color:'#d50000', marginTop:'8px', letterSpacing:'0.04em' }}>
                      ↓ {tl('lactateTrendDeclining')} {drift.deltaPercent}%/mo ({confLabel})
                    </div>
                  )
                }
                return (
                  <div style={{ fontSize:'10px', color:'#555', marginTop:'8px', letterSpacing:'0.04em' }}>
                    → {tl('lactateTrendStable')}
                  </div>
                )
              })()}
              {/* ── end drift badge ──────────────────────────────────────────── */}
              <div style={{ display:'flex', gap:'10px', marginTop:'14px', flexWrap:'wrap' }}>
              </div>
              {fmt.secondary && <div style={{ fontSize:'10px', color:'#5bc25b', marginTop:'8px' }}>{fmt.secondary}</div>}
              {fmt.zoneNote && <div style={{ fontSize:'9px', color:'#555', marginTop:'4px' }}>{fmt.zoneNote}</div>}
              <button onClick={handleSave} disabled={saved}
                style={{ marginTop:'12px', width:'100%', padding:'9px', background: saved ? '#1a1a1a' : '#ff6600', color: saved ? '#5bc25b' : '#fff', border:'none', borderRadius:'4px', fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', fontWeight:700, letterSpacing:'0.1em', cursor: saved ? 'default' : 'pointer' }}>
                {saved ? (lang==='tr' ? '✓ KAYDEDİLDİ' : '✓ SAVED') : (lang==='tr' ? '↓ KAYDET' : '↓ SAVE TO HISTORY')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
