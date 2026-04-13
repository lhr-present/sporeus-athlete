// ─── dashboard/PerformanceMetrics.jsx — Form / Peak / Consistency tiles ────────
// Extracted from Dashboard.jsx inline PMC block.
import { getFormScore, getPeakWeekLoad, getConsistencyScore } from '../../lib/intelligence.js'

const MONO = "'IBM Plex Mono', monospace"

/**
 * @param {object} props
 * @param {Array}  props.log — full training log entries
 */
export default function PerformanceMetrics({ log }) {
  const form    = getFormScore(log)
  const peakWk  = getPeakWeekLoad(log)
  const consist = getConsistencyScore(log, 28)
  return (
    <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'14px' }}>
      <div style={{ flex:'1 1 120px', background:'var(--surface)', border:`1px solid ${form.color}44`, borderRadius:'6px', padding:'12px', textAlign:'center' }}>
        <div style={{ fontFamily:MONO, fontSize:'22px', fontWeight:600, color:form.color }}>{form.tsb > 0 ? '+' : ''}{form.tsb}</div>
        <div style={{ fontFamily:MONO, fontSize:'9px', color:'#888', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:'4px' }}>Form (TSB)</div>
        <div style={{ fontFamily:MONO, fontSize:'10px', color:form.color, marginTop:'2px' }}>{form.label}</div>
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
