// ─── dashboard/MilestonesList.jsx — Milestone achievement overlay ─────────────
// Auto-fires when new milestones are detected; dismisses after 3.5s or on tap.
import { useContext, useState, useEffect } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { detectMilestones } from '../../lib/intelligence.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'

/**
 * @param {object} props
 * @param {Array}  props.log     — training log entries
 * @param {object} props.profile — athlete profile
 */
export default function MilestonesList({ log, profile }) {
  const { t } = useContext(LangCtx)
  const [lang] = useLocalStorage('sporeus-lang', 'en')
  const [seenMilestones, setSeenMilestones] = useLocalStorage('sporeus-milestones', [])
  const [current, setCurrent] = useState(null)

  useEffect(() => {
    if (!log.length) return
    const newOnes = detectMilestones(log, profile, seenMilestones)
    if (newOnes.length > 0) {
      setCurrent(newOnes[0])
      setSeenMilestones(prev => [...new Set([...prev, ...newOnes.map(m => m.id)])])
      const timer = setTimeout(() => setCurrent(null), 3500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- log.length is change signal; stable closure over setters
  }, [log.length])

  if (!current) return null

  return (
    <div
      style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'#000000cc', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={() => setCurrent(null)}
    >
      <div style={{ background:'var(--card-bg)', border:'2px solid #ff6600', borderRadius:'12px', padding:'32px 40px', textAlign:'center', maxWidth:'320px', animation:'sp-fade-in 0.3s ease' }}>
        <div style={{ fontSize:'48px', marginBottom:'12px' }}>{current.emoji}</div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#ff6600', letterSpacing:'0.12em', marginBottom:'8px' }}>{t('milestoneTitle')}</div>
        <div style={{ ...S.mono, fontSize:'16px', fontWeight:600, color:'var(--text)', lineHeight:1.5 }}>{current[lang] || current.en}</div>
        <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginTop:'12px' }}>tap to dismiss</div>
      </div>
    </div>
  )
}
