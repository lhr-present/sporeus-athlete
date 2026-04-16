// ─── ResultComparison — compare two test results with MDC significance ────────
import { useState } from 'react'
import { S } from '../../styles.js'

export default function ResultComparison({ testLog, mdcPct }) {
  const [cmpA, setCmpA] = useState('')
  const [cmpB, setCmpB] = useState('')

  if (testLog.length < 2) return null

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'100ms' }}>
      <div style={S.cardTitle}>COMPARE ANY TWO RESULTS</div>
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
        // Meaningful change detection (MDC = SEM × 1.96 × √2)
        const semPct = mdcPct[a.testId] || 4.0
        const mdcAbs = Math.abs(va) * semPct / 100
        const meaningful = Math.abs(delta) >= mdcAbs
        const mdcLabel = meaningful
          ? (delta > 0 ? '✓ REAL GAIN' : '⚠ REAL DECLINE')
          : '~ WITHIN NOISE'
        const mdcColor = meaningful ? (delta > 0 ? '#5bc25b' : '#e03030') : '#666'
        return (
          <div style={{ marginTop:'14px' }}>
            <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'10px' }}>
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
              <div style={{ flex:'1 1 120px', ...S.stat }}>
                <span style={{ ...S.statVal, fontSize:'13px', color:mdcColor }}>{mdcLabel}</span>
                <span style={S.statLbl}>MDC ±{mdcAbs.toFixed(1)} ({semPct}%)</span>
              </div>
            </div>
            <div style={{ ...S.mono, fontSize:'9px', color:'#444', lineHeight:1.6, borderTop:'1px solid var(--border)', paddingTop:'8px' }}>
              MDC (Minimal Detectable Change) = SEM × 1.96 × √2 — the threshold above which change exceeds measurement error with 95% confidence.
              {!meaningful && ` Δ${Math.abs(delta)} < MDC${mdcAbs.toFixed(1)} — retest before concluding performance changed.`}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
