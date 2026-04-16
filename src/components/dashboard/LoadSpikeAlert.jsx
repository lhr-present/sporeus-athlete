// ─── dashboard/LoadSpikeAlert.jsx — week-on-week load spike warning ───────────
import { useMemo } from 'react'
import { S } from '../../styles.js'
import { useData } from '../../contexts/DataContext.jsx'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'

export default function LoadSpikeAlert() {
  const { log } = useData()
  const [lang]  = useLocalStorage('sporeus-lang', 'en')

  const loadSpikeP = useMemo(() => {
    const w7Start  = (() => { const d = new Date(); d.setDate(d.getDate() - 7);  return d.toISOString().slice(0, 10) })()
    const w14Start = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10) })()
    const thisWeekTSS = log.filter(e => e.date >= w7Start).reduce((s, e) => s + (e.tss || 0), 0)
    const prevWeekTSS = log.filter(e => e.date >= w14Start && e.date < w7Start).reduce((s, e) => s + (e.tss || 0), 0)
    return prevWeekTSS > 10 ? Math.round((thisWeekTSS - prevWeekTSS) / prevWeekTSS * 100) : 0
  }, [log])

  if (loadSpikeP < 10) return null

  return (
    <div className="sp-card" style={{ ...S.card, borderLeft: '4px solid #f5c542', background: '#f5c54209', animationDelay: '0ms' }}>
      <div style={{ ...S.mono, fontSize: '10px', color: '#f5c542', fontWeight: 600, letterSpacing: '0.08em', marginBottom: '4px' }}>
        ⚠ LOAD SPIKE DETECTED
      </div>
      <div style={{ ...S.mono, fontSize: '12px', color: 'var(--text)', lineHeight: 1.7 }}>
        {lang === 'tr'
          ? `Bu haftanın yükü geçen haftaya göre +%${loadSpikeP} arttı.`
          : `This week's load is +${loadSpikeP}% higher than last week.`}
      </div>
      <div style={{ ...S.mono, fontSize: '10px', color: '#888', marginTop: '4px' }}>
        {loadSpikeP >= 30
          ? (lang === 'tr' ? '→ Yüksek artış — bu haftaki tempo seansını kolay antrenmanla değiştirin.' : '→ Large spike — swap this week\'s intensity session for easy aerobic work.')
          : (lang === 'tr' ? '→ Yükü takip edin; hafif bir seans ekleyebilirsiniz.' : '→ Monitor closely; consider adding one extra easy session.')}
      </div>
    </div>
  )
}
