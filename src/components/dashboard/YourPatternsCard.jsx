// ─── dashboard/YourPatternsCard.jsx — Personalised pattern mining card ────────
import { useContext, useState , memo} from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { correlateTrainingToResults, findRecoveryPatterns, findOptimalWeekStructure, findSeasonalPatterns } from '../../lib/patterns.js'
import { useData } from '../../contexts/DataContext.jsx'

function YourPatternsCard({ log, recovery, injuries: _injuries, profile: _profile, lang }) {
  const { t: _t } = useContext(LangCtx)
  const { testResults } = useData()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  if (log.length < 14) return null

  const trainTest  = correlateTrainingToResults(log, testResults)
  const recPat     = findRecoveryPatterns(log, recovery)
  const seasonal   = findSeasonalPatterns(log, recovery)
  const weekStruct = findOptimalWeekStructure(log, recovery)

  const allPatterns = [
    ...trainTest.patterns.map(p => ({ icon:'🔬', text: p[lang] || p.en, confidence: p.confidence, basis: `${trainTest.dataPoints} test results` })),
    ...(recPat.optimalReadiness ? [{ icon:'💤', text: recPat.optimalReadiness[lang] || recPat.optimalReadiness.en, confidence:'moderate', basis:`${recPat.sampleSize} sessions` }] : []),
    ...(recPat.optimalSleep     ? [{ icon:'💤', text: recPat.optimalSleep[lang]     || recPat.optimalSleep.en,     confidence:'moderate', basis:`${recPat.sampleSize} sessions` }] : []),
    ...(recPat.redFlags.map(rf  => ({ icon:'⚠', text: rf[lang] || rf.en, confidence:'moderate', basis:`${recPat.sampleSize} pairs` }))),
    ...(recPat.bestDay  ? [{ icon:'📅', text: recPat.bestDay[lang]  || recPat.bestDay.en,  confidence:'low', basis:'' }] : []),
    ...(recPat.worstDay ? [{ icon:'📅', text: recPat.worstDay[lang] || recPat.worstDay.en, confidence:'low', basis:'' }] : []),
    ...(seasonal.strongMonths.length ? [{ icon:'🌡️', text: seasonal[lang] || seasonal.en, confidence:'moderate', basis:`${log.length} sessions` }] : []),
    ...(weekStruct.reliable ? [{ icon:'📋', text: weekStruct[lang] || weekStruct.en, confidence:'moderate', basis:`${weekStruct.sampleSize} weeks` }] : []),
  ]

  const hints = [
    ...(testResults.length < 3 ? [{ icon:'🔬', text: lang==='tr' ? `Antrenman→test desenlerini bulmak için ${Math.max(0,3-testResults.length)} test sonucu daha gir.` : `${Math.max(0,3-testResults.length)} more test results needed to find your training→performance patterns.` }] : []),
    ...(recovery.length < 7    ? [{ icon:'💤', text: lang==='tr' ? `Optimal koşullarınızı bulmak için ${Math.max(0,7-recovery.length)} gün daha toparlanma kaydet.` : `Log recovery for ${Math.max(0,7-recovery.length)} more days to discover your optimal conditions.` }] : []),
    ...(!weekStruct.reliable && weekStruct.needMore > 0 ? [{ icon:'📋', text: lang==='tr' ? `Optimal hafta yapınızı bulmak için ${weekStruct.needMore} seans daha gerekiyor.` : `${weekStruct.needMore} more sessions needed to find your optimal week structure.` }] : []),
  ]

  if (allPatterns.length === 0 && hints.length === 0) return null

  const handleCopy = () => {
    const text = ['YOUR PERSONAL PATTERNS', '─'.repeat(30), ...allPatterns.map(p => `${p.icon} ${p.text}`)].join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const confColor = c => c === 'high' ? '#5bc25b' : c === 'moderate' ? '#f5c542' : '#888'

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'56ms' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <div style={S.cardTitle}>{lang==='tr'?'SENİN DESENLERİN':'YOUR PATTERNS'}</div>
        <div style={{ display:'flex', gap:'6px' }}>
          {copied && <span style={{ ...S.mono, fontSize:'10px', color:'#5bc25b' }}>✓</span>}
          {allPatterns.length > 0 && <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 8px' }} onClick={handleCopy}>⎘ Copy</button>}
          <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 8px' }} onClick={() => setOpen(o => !o)}>{open ? '▲' : '▼'}</button>
        </div>
      </div>

      {allPatterns.length === 0 && hints.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {hints.map((h, i) => (
            <div key={i} style={{ ...S.mono, fontSize:'11px', color:'#888', lineHeight:1.6 }}>{h.icon} {h.text}</div>
          ))}
        </div>
      )}

      {allPatterns.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
          {allPatterns.slice(0, open ? undefined : 3).map((p, i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px' }}>
              <span style={{ fontSize:'16px', flexShrink:0 }}>{p.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ ...S.mono, fontSize:'11px', color:'var(--text)', lineHeight:1.7 }}>{p.text}</div>
                {p.basis && <div style={{ ...S.mono, fontSize:'9px', color:'#888', marginTop:'2px' }}>based on {p.basis}</div>}
              </div>
              <span style={{ ...S.mono, fontSize:'9px', fontWeight:600, color:confColor(p.confidence), flexShrink:0, border:`1px solid ${confColor(p.confidence)}44`, padding:'1px 5px', borderRadius:'2px' }}>{p.confidence.toUpperCase()}</span>
            </div>
          ))}
          {!open && allPatterns.length > 3 && (
            <button style={{ ...S.mono, fontSize:'10px', color:'#888', background:'transparent', border:'none', cursor:'pointer', padding:'4px 0' }} onClick={() => setOpen(true)}>
              +{allPatterns.length - 3} more patterns →
            </button>
          )}
          {open && weekStruct.reliable && weekStruct.bestPattern && weekStruct.bestPattern.length > 0 && (
            <div style={{ marginTop:'8px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px', borderLeft:'3px solid #ff660033' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#ff6600', letterSpacing:'0.08em', marginBottom:'6px' }}>
                {lang==='tr' ? '◈ OPTİMAL HAFTA PLANI' : '◈ OPTIMAL WEEK TEMPLATE'}
              </div>
              {weekStruct.bestPattern.map(d => (
                <div key={d.day} style={{ display:'flex', gap:'8px', ...S.mono, fontSize:'10px', color:'var(--sub)', padding:'2px 0', borderBottom:'1px solid #1a1a1a' }}>
                  <span style={{ minWidth:'36px', color:'#555' }}>{d.day.slice(0,3).toUpperCase()}</span>
                  <span style={{ flex:1 }}>{d.type}</span>
                  <span style={{ color:'#444' }}>{d.avgDuration}min</span>
                </div>
              ))}
              {weekStruct.bestWeeklyHours && (
                <div style={{ ...S.mono, fontSize:'9px', color:'#333', marginTop:'6px', letterSpacing:'0.04em' }}>
                  {lang==='tr'
                    ? `HEDEF: ${weekStruct.bestSessionCount} antrenman · ${weekStruct.bestWeeklyHours.min}–${weekStruct.bestWeeklyHours.max}h/hft`
                    : `TARGET: ${weekStruct.bestSessionCount} sessions · ${weekStruct.bestWeeklyHours.min}–${weekStruct.bestWeeklyHours.max}h/wk`}
                </div>
              )}
            </div>
          )}
          {open && hints.length > 0 && (
            <div style={{ marginTop:'4px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px' }}>
              {hints.map((h, i) => <div key={i} style={{ ...S.mono, fontSize:'10px', color:'#888', marginBottom:'4px' }}>{h.icon} {h.text}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
export default memo(YourPatternsCard)
