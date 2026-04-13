// ─── dashboard/InsightsPanel.jsx — Training insights card ─────────────────────
// Extracted from Dashboard.jsx. Shows load trend, zone balance, fitness, recovery.
import { useContext, useState, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeLoadTrend, analyzeZoneBalance, analyzeRecoveryCorrelation, predictFitness } from '../../lib/intelligence.js'

/**
 * @param {object} props
 * @param {Array}  props.log      — training log entries
 * @param {Array}  props.recovery — recovery log entries
 * @param {object} props.profile  — athlete profile
 * @param {string} props.lang     — 'en' | 'tr'
 */
export default function InsightsPanel({ log, recovery, profile, lang }) {
  const { t } = useContext(LangCtx)
  const [open, setOpen] = useState(false)
  if (log.length < 4) return null

  const loadTrend   = useMemo(() => analyzeLoadTrend(log),                    [log])
  const zoneBalance = useMemo(() => analyzeZoneBalance(log),                   [log])
  const fitness     = useMemo(() => predictFitness(log),                       [log])
  const recovCorr   = useMemo(() => analyzeRecoveryCorrelation(log, recovery), [log, recovery])

  const insights = [
    { label: t('loadTrendLabel'),  value: loadTrend.trend.toUpperCase(),       color: loadTrend.trend==='building'?'#5bc25b':loadTrend.trend==='recovering'?'#4a90d9':'#f5c542', text: loadTrend.advice[lang] || loadTrend.advice.en },
    { label: t('zoneBalanceLabel'),value: zoneBalance.status.replace('_',' ').toUpperCase(), color: zoneBalance.status==='polarized'?'#5bc25b':zoneBalance.status==='too_hard'?'#e03030':'#f5c542', text: zoneBalance.recommendation[lang] || zoneBalance.recommendation.en },
    { label: t('fitnessLabel'),    value: fitness.trajectory.toUpperCase(),    color: fitness.trajectory==='improving'?'#5bc25b':fitness.trajectory==='declining'?'#e03030':'#f5c542', text: fitness.label[lang] || fitness.label.en },
    { label: t('recovCorrLabel'),  value: recovCorr.correlation !== null ? (recovCorr.correlation > 5 ? 'LINKED' : 'RESILIENT') : 'PENDING', color: recovCorr.correlation !== null ? (recovCorr.correlation > 5 ? '#f5c542' : '#5bc25b') : '#888', text: recovCorr.insight[lang] || recovCorr.insight.en },
  ]

  const smartAdj = []
  if (loadTrend.trend === 'building' && (loadTrend.change || 0) > 20) smartAdj.push({ en: 'Load increasing >20%/week — add a recovery day before next hard session.', tr: 'Yük haftada %20\'den fazla artıyor — bir sonraki zorlu seans öncesine toparlanma günü ekle.' })
  if (zoneBalance.status === 'threshold_heavy') smartAdj.push({ en: 'Too much Z3 — replace 2 moderate sessions with true easy (Z1/Z2) or hard (Z4+) efforts.', tr: 'Fazla Z3 — 2 orta seansı gerçek kolay (Z1/Z2) veya zorlu (Z4+) efora değiştir.' })
  if (fitness.trajectory === 'declining') smartAdj.push({ en: 'CTL declining — add 1 base session (60–90 min Z2) per week to halt decay.', tr: 'KTY düşüyor — azalmayı durdurmak için haftada 1 baz seans (60–90 dak Z2) ekle.' })
  if (fitness.in4w > fitness.current + 8) smartAdj.push({ en: `Fitness projected +${fitness.in4w - fitness.current} CTL in 4 weeks — maintain consistency.`, tr: `Kondisyon 4 haftada +${fitness.in4w - fitness.current} KTY artacak — tutarlılığını sürdür.` })

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'55ms' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <div style={S.cardTitle}>{t('insightsTitle')}</div>
        <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 8px' }} onClick={() => setOpen(o => !o)}>
          {open ? '▲ LESS' : '▼ MORE'}
        </button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {insights.map(ins => (
          <div key={ins.label} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'8px 10px', background:'var(--card-bg)', borderRadius:'4px', borderLeft:`3px solid ${ins.color}` }}>
            <div style={{ minWidth:'120px' }}>
              <div style={{ ...S.mono, fontSize:'9px', color:'#888', letterSpacing:'0.06em' }}>{ins.label}</div>
              <div style={{ ...S.mono, fontSize:'13px', fontWeight:600, color:ins.color }}>{ins.value}</div>
            </div>
            {open && <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', lineHeight:1.6 }}>{ins.text}</div>}
          </div>
        ))}
      </div>
      {open && smartAdj.length > 0 && (
        <div style={{ marginTop:'12px', padding:'10px 12px', background:'#ff660011', borderRadius:'4px', borderLeft:'3px solid #ff6600' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#ff6600', letterSpacing:'0.08em', marginBottom:'6px' }}>◈ {t('smartAdjTitle')}</div>
          {smartAdj.map((adj, i) => (
            <div key={i} style={{ ...S.mono, fontSize:'11px', color:'var(--text)', lineHeight:1.7, marginBottom: i < smartAdj.length-1 ? '6px' : 0 }}>
              → {adj[lang] || adj.en}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
