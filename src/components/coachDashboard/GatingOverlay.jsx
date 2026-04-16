import { useState, useRef } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap.js'
import { S } from '../../styles.js'
import { verifyUnlockCode, FREE_ATHLETE_LIMIT } from '../../lib/formulas.js'

// ─── Gating Overlay ────────────────────────────────────────────────────────────

export default function GatingOverlay({ coachProfile, onUnlock, onCancel }) {
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
    if (!result) { setError('Invalid code. Contact sporeus.com/huseyin-akbulut/ to get your unlock code.'); return }
    onUnlock(result.limit)
  }

  return (
    <>
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:10200 }} onClick={onCancel}/>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Free limit reached" style={{ position:'fixed', top:'15vh', left:'50%', transform:'translateX(-50%)', width:'min(480px,92vw)', background:'var(--card-bg)', border:'1px solid #f5c54244', borderRadius:'8px', zIndex:10201, padding:'28px', boxShadow:'0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#f5c542', letterSpacing:'0.1em' }}>◈ FREE LIMIT REACHED</div>
          <button onClick={onCancel} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:'18px' }} aria-label="Close">×</button>
        </div>
        <div style={{ ...S.mono, fontSize:'15px', fontWeight:700, color:'var(--text)', marginBottom:'8px' }}>
          {limit}/{limit} Athlete Slots Used
        </div>
        <div style={{ ...S.mono, fontSize:'12px', color:'var(--sub)', lineHeight:1.8, marginBottom:'20px' }}>
          You've reached the free limit ({limit} connected athletes). To add more, contact Hüseyin for an unlock code.
        </div>
        <label style={S.label}>UNLOCK CODE</label>
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
            {verifying ? 'Verifying...' : 'Verify Code'}
          </button>
          <a href="https://sporeus.com/huseyin-akbulut/" target="_blank" rel="noreferrer" style={{ ...S.btnSec, textDecoration:'none', color:'#ff6600', borderColor:'#ff6600', display:'inline-flex', alignItems:'center' }}>
            Contact Hüseyin →
          </a>
          <button style={{ ...S.btnSec, color:'var(--muted)', borderColor:'var(--border)' }} onClick={onCancel}>Later</button>
        </div>
      </div>
    </>
  )
}
