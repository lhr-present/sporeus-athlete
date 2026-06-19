import { useState, useRef, useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { useFocusTrap } from '../../hooks/useFocusTrap.js'
import { S } from '../../styles.js'
import { verifyUnlockCode, FREE_ATHLETE_LIMIT } from '../../lib/formulas.js'

// ─── Gating Overlay ────────────────────────────────────────────────────────────

export default function GatingOverlay({ coachProfile, onUnlock, onCancel }) {
  const { t } = useContext(LangCtx)
  const panelRef = useRef(null)
  useFocusTrap(panelRef, { onEscape: onCancel })
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const limit = coachProfile.athleteLimit || FREE_ATHLETE_LIMIT

  async function handleVerify() {
    if (!code.trim()) return
    setVerifying(true); setError('')
    const result = await verifyUnlockCode(code.trim().toUpperCase(), coachProfile.coachId)
    setVerifying(false)
    if (!result) { setError(t('gating_invalidCode')); return }
    onUnlock(result.limit)
  }

  return (
    <>
      <div aria-hidden="true" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:10200 }} onClick={onCancel}/>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={t('gating_dialogLabel')} style={{ position:'fixed', top:'15vh', left:'50%', transform:'translateX(-50%)', width:'min(480px,92vw)', background:'var(--card-bg)', border:'1px solid #f5c54244', borderRadius:'8px', zIndex:10201, padding:'28px', boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#f5c542', letterSpacing:'0.1em' }}>{t('gating_freeLimitReached')}</div>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'18px' }} aria-label={t('gating_close')}>×</button>
        </div>
        <div style={{ ...S.mono, fontSize:'15px', fontWeight:700, color:'var(--text)', marginBottom:'8px' }}>
          {t('gating_slotsUsed').replaceAll('{n}', limit)}
        </div>
        <div style={{ ...S.mono, fontSize:'12px', color:'var(--sub)', lineHeight:1.8, marginBottom:'20px' }}>
          {t('gating_body').replace('{n}', limit)}
        </div>
        <label style={S.label}>{t('gating_unlockCode')}</label>
        <input
          style={{ ...S.input, marginBottom:'8px', letterSpacing:'0.06em' }}
          placeholder="SPUNLOCK-a3f7b2e1-10-c4d8f2"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleVerify()}
        />
        {error && <div style={{ ...S.mono, fontSize:'11px', color:'#e03030', marginBottom:'10px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
          <button style={{ ...S.btn, background:'#0064ff', borderColor:'#0064ff' }} onClick={handleVerify} disabled={verifying}>
            {verifying ? t('gating_verifying') : t('gating_verifyCode')}
          </button>
          <a href="https://sporeus.com/huseyin-akbulut/" target="_blank" rel="noreferrer" style={{ ...S.btnSec, textDecoration:'none', color:'#ff6600', borderColor:'#ff6600', display:'inline-flex', alignItems:'center' }}>
            {t('gating_contactHuseyin')}
          </a>
          <button style={{ ...S.btnSec, color:'var(--muted)', borderColor:'var(--border)' }} onClick={onCancel}>{t('gating_later')}</button>
        </div>
      </div>
    </>
  )
}
