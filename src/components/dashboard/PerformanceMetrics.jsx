// ─── dashboard/PerformanceMetrics.jsx — Form / Peak / Consistency tiles ────────
// Extracted from Dashboard.jsx inline PMC block.
import { useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { getFormScore, getPeakWeekLoad, getConsistencyScore } from '../../lib/intelligence.js'
import { classifyTSB } from '../../lib/trainingLoad.js'

const MONO = "'IBM Plex Mono', monospace"

/**
 * @param {object} props
 * @param {Array}  props.log — full training log entries
 */
export default function PerformanceMetrics({ log }) {
  const { lang } = useContext(LangCtx)
  const form    = getFormScore(log)
  const peakWk  = getPeakWeekLoad(log)
  const consist = getConsistencyScore(log, 28)
  const tsbZone = classifyTSB(form.tsb)
  return (
    <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'14px' }}>
      <div style={{ flex:'1 1 120px', background:'var(--surface)', border:`1px solid ${tsbZone.color}44`, borderRadius:'6px', padding:'12px', textAlign:'center' }}>
        <div style={{ fontFamily:MONO, fontSize:'22px', fontWeight:600, color:tsbZone.color }}>{form.tsb > 0 ? '+' : ''}{form.tsb}</div>
        <div style={{ fontFamily:MONO, fontSize:'9px', color:'#888', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:'4px' }}>Form (TSB)</div>
        <div style={{ fontFamily:MONO, fontSize:'10px', color:tsbZone.color, marginTop:'2px' }}>{lang === 'tr' ? tsbZone.label.tr : tsbZone.label.en}</div>
        <div style={{ fontFamily:MONO, fontSize:'9px', color:'#444', marginTop:'3px', lineHeight:1.4 }}>{lang === 'tr' ? tsbZone.advice.tr : tsbZone.advice.en}</div>
        <div style={{ fontFamily:MONO, fontSize:'8px', color:'#333', marginTop:'4px', letterSpacing:'0.04em' }}>CTL {form.ctl} · ATL {form.atl}</div>
      </div>
      <div style={{ flex:'1 1 120px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'12px', textAlign:'center' }}>
        <div style={{ fontFamily:MONO, fontSize:'22px', fontWeight:600, color:'#ff6600' }}>{peakWk}</div>
        <div style={{ fontFamily:MONO, fontSize:'9px', color:'#888', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:'4px' }}>Peak Week TSS</div>
        <div style={{ fontFamily:MONO, fontSize:'10px', color:'#888', marginTop:'2px' }}>all-time</div>
      </div>
      <div style={{ flex:'1 1 120px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'12px', textAlign:'center' }}>
        <div style={{ fontFamily:MONO, fontSize:'22px', fontWeight:600, color: consist >= 70 ? '#5bc25b' : consist >= 40 ? '#f0a000' : '#e03030' }}>{consist}%</div>
        <div style={{ fontFamily:MONO, fontSize:'9px', color:'#888', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:'4px' }}>Consistency</div>
        <div style={{ fontFamily:MONO, fontSize:'10px', color:'#888', marginTop:'2px' }}>last 28d</div>
      </div>
    </div>
  )
}
