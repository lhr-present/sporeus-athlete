// ─── dashboard/DidYouKnowCard.jsx — Science trivia card ───────────────────────
import { useContext, useState , memo} from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { getTriggeredNotes } from '../../lib/scienceNotes.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'

function DidYouKnowCard({ log, recovery, profile, lang }) {
  const { t } = useContext(LangCtx)
  const [shownIds, setShownIds] = useLocalStorage('sporeus-shown-notes', [])
  const [noteIdx, setNoteIdx] = useState(0)

  const triggered = getTriggeredNotes(log, recovery, profile, shownIds)
  if (!triggered.length) return null

  const note = triggered[noteIdx % triggered.length]

  const handleNext = () => {
    setShownIds(prev => {
      const updated = [...new Set([...prev, note.id])]
      return updated.length > 20 ? updated.slice(-7) : updated
    })
    setNoteIdx(i => i + 1)
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'59ms', borderLeft:'3px solid #f5c542' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
        <div style={{ ...S.mono, fontSize:'10px', fontWeight:600, color:'#f5c542', letterSpacing:'0.08em' }}>◈ {t('didYouKnowTitle')}</div>
        <button style={{ ...S.mono, fontSize:'10px', color:'#888', background:'transparent', border:'1px solid var(--border)', borderRadius:'3px', padding:'2px 8px', cursor:'pointer' }} onClick={handleNext}>
          {t('nextNoteBtn')}
        </button>
      </div>
      <div style={{ ...S.mono, fontSize:'12px', color:'var(--text)', lineHeight:1.8, marginBottom:'6px' }}>
        {note[lang] || note.en}
      </div>
      <div style={{ ...S.mono, fontSize:'9px', color:'#888' }}>{note.source}</div>
    </div>
  )
}
export default memo(DidYouKnowCard)
