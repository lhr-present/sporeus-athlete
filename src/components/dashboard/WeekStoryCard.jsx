// ─── dashboard/WeekStoryCard.jsx — This Week's Story Card ─────────────────────
import { useContext, useState } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { generateWeeklyNarrative } from '../../lib/intelligence.js'

export default function WeekStoryCard({ log, recovery, profile, lang }) {
  const { t } = useContext(LangCtx)
  const [copied, setCopied] = useState(false)
  if (log.length < 2) return null

  const narrative = generateWeeklyNarrative(log, recovery, profile, lang)
  const text = narrative[lang] || narrative.en

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'My Training Week — Sporeus', text })
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'57ms', borderLeft:'4px solid #0064ff' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
        <div style={S.cardTitle}>{t('weekStoryTitle')}</div>
        <div style={{ display:'flex', gap:'6px' }}>
          {copied && <span style={{ ...S.mono, fontSize:'10px', color:'#5bc25b' }}>✓</span>}
          <button style={{ ...S.btnSec, fontSize:'10px', padding:'3px 8px' }} onClick={handleShare}>
            {navigator.share ? t('shareStoryBtn') : t('copyStoryBtn')}
          </button>
        </div>
      </div>
      <div style={{ ...S.mono, fontSize:'12px', color:'var(--text)', lineHeight:1.8 }}>{text}</div>
    </div>
  )
}
