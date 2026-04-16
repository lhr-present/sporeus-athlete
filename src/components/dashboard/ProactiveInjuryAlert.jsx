// ─── dashboard/ProactiveInjuryAlert.jsx — Proactive injury risk alert ─────────
import { S } from '../../styles.js'
import { mineInjuryPatterns } from '../../lib/patterns.js'

export default function ProactiveInjuryAlert({ log, injuries, lang }) {
  const injPatterns = mineInjuryPatterns(log, injuries, [])
  const highConf    = injPatterns.patterns.filter(p => p.confidence === 'high')
  if (!highConf.length) return null

  const _now = new Date().toISOString().slice(0, 10)
  const w1   = (() => { const d = new Date(); d.setDate(d.getDate()-7);  return d.toISOString().slice(0,10) })()
  const w2   = (() => { const d = new Date(); d.setDate(d.getDate()-14); return d.toISOString().slice(0,10) })()
  const recent7  = log.filter(e => e.date >= w1)
  const recent14 = log.filter(e => e.date >= w2)

  const tss7  = recent7.reduce((s, e) => s + (e.tss || 0), 0)
  const _tss14 = recent14.reduce((s, e) => s + (e.tss || 0), 0) / 2
  const prevTSS = log.filter(e => e.date >= w2 && e.date < w1).reduce((s, e) => s + (e.tss || 0), 0)
  const spikeP  = prevTSS > 0 ? (tss7 - prevTSS) / prevTSS * 100 : 0
  const longRun = Math.max(...recent7.map(e => e.duration || 0), 0)
  const consec  = (() => { let c = 0; for (const e of [...recent7].sort((a,b) => b.date>a.date?1:-1)) { if((e.rpe||0)>=7)c++;else break }; return c })()

  const active = highConf.filter(p => {
    if (p.triggers.includes('volume_spike') && spikeP > 20) return true
    if (p.triggers.includes('long_run_duration') && longRun > 90) return true
    if (p.triggers.includes('consecutive_hard_days') && consec >= 3) return true
    return false
  })
  if (!active.length) return null

  const zoneStr = active.map(p => p.zone).join(', ')
  return (
    <div className="sp-card" style={{ ...S.card, borderLeft:'4px solid #e03030', animationDelay:'0ms', background:'#e0303011' }}>
      <div style={{ ...S.mono, fontSize:'10px', color:'#e03030', letterSpacing:'0.08em', fontWeight:600, marginBottom:'6px' }}>
        ⚠ {lang==='tr'?'PROAKTİF YARALANMA UYARISI':'PROACTIVE INJURY RISK'}
      </div>
      <div style={{ ...S.mono, fontSize:'12px', color:'var(--text)', lineHeight:1.7, marginBottom:'8px' }}>
        {lang==='tr'
          ? `Bu haftaki antrenman deseni önceki ${zoneStr} sorunlarından önce gelen koşullarla eşleşiyor.`
          : `Current week matches conditions that preceded your previous ${zoneStr} injury issues.`}
      </div>
      {spikeP > 20 && <div style={{ ...S.mono, fontSize:'10px', color:'#e03030' }}>→ Volume spike: +{Math.round(spikeP)}% this week</div>}
      {longRun > 90 && <div style={{ ...S.mono, fontSize:'10px', color:'#e03030' }}>→ Long session: {longRun} min</div>}
      {consec >= 3  && <div style={{ ...S.mono, fontSize:'10px', color:'#e03030' }}>→ {consec} consecutive hard days</div>}
      <div style={{ ...S.mono, fontSize:'10px', color:'#f5c542', marginTop:'8px', lineHeight:1.6 }}>
        Suggestion: {lang==='tr'?'Yarınki seansı kolay çalışma ile değiştirin veya dinlenme günü ekleyin.':'Replace tomorrow\'s session with easy work or add a rest day.'}
      </div>
    </div>
  )
}
