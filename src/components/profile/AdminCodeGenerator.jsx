// ─── AdminCodeGenerator — generate SPUNLOCK codes (admin only) ───────────────
import { useState } from 'react'
import { S } from '../../styles.js'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { generateUnlockCode, FREE_ATHLETE_LIMIT } from '../../lib/formulas.js'

export default function AdminCodeGenerator() {
  const [adminCoachId, setAdminCoachId] = useState('')
  const [adminLimit, setAdminLimit] = useState('10')
  const [adminResult, setAdminResult] = useState('')
  const [adminLog, setAdminLog] = useLocalStorage('sporeus-admin-codes', [])
  const [copying, setCopying] = useState(false)

  async function handleGenerate() {
    if (!adminCoachId.trim() || !adminLimit) return
    const code = await generateUnlockCode(adminCoachId.trim(), parseInt(adminLimit))
    setAdminResult(code)
    const entry = { coachId: adminCoachId.trim(), limit: parseInt(adminLimit), code, generatedAt: new Date().toISOString().slice(0, 10) }
    setAdminLog(prev => [entry, ...prev].slice(0, 50))
  }

  function copyCode() {
    if (!adminResult) return
    navigator.clipboard.writeText(adminResult).catch(() => {})
    setCopying(true); setTimeout(() => setCopying(false), 1500)
  }

  return (
    <div className="sp-card" style={{ ...S.card, animationDelay:'115ms', borderLeft:'3px solid #ff6600' }}>
      <div style={{ ...S.cardTitle, color:'#ff6600', borderColor:'#ff660044' }}>◈ ADMIN: UNLOCK CODE GENERATOR</div>
      <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginBottom:'14px', lineHeight:1.7 }}>
        Generate SPUNLOCK codes for coaches who need more than {FREE_ATHLETE_LIMIT} athletes.
      </div>
      <div style={S.row}>
        <div style={{ flex:'2 1 200px' }}>
          <label style={S.label}>COACH ID (SP-XXXXXXXX)</label>
          <input style={S.input} placeholder="SP-a3f7b2e1" value={adminCoachId} onChange={e => setAdminCoachId(e.target.value.trim())}/>
        </div>
        <div style={{ flex:'1 1 100px' }}>
          <label style={S.label}>NEW LIMIT</label>
          <input style={S.input} type="number" min="4" max="999" placeholder="10" value={adminLimit} onChange={e => setAdminLimit(e.target.value)}/>
        </div>
      </div>
      <button style={{ ...S.btn, marginTop:'12px' }} onClick={handleGenerate}>Generate Unlock Code</button>
      {adminResult && (
        <div style={{ marginTop:'12px', padding:'12px 14px', background:'#ff660011', border:'1px solid #ff660044', borderRadius:'6px' }}>
          <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginBottom:'6px', letterSpacing:'0.1em' }}>UNLOCK CODE</div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <input readOnly style={{ ...S.input, flex:1, color:'#ff6600', fontSize:'12px', letterSpacing:'0.06em', fontWeight:600 }} value={adminResult} onFocus={e => e.target.select()}/>
            <button style={{ ...S.btnSec, whiteSpace:'nowrap', borderColor:'#ff6600', color: copying ? '#5bc25b' : '#ff6600' }} onClick={copyCode}>
              {copying ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
      {adminLog.length > 0 && (
        <div style={{ marginTop:'14px' }}>
          <div style={{ ...S.mono, fontSize:'9px', color:'#888', letterSpacing:'0.08em', marginBottom:'6px' }}>RECENT CODES</div>
          <div style={{ maxHeight:'180px', overflowY:'auto' }}>
            {adminLog.map((entry, i) => (
              <div key={i} style={{ display:'flex', gap:'8px', flexWrap:'wrap', borderBottom:'1px solid var(--border)', padding:'5px 0', ...S.mono, fontSize:'10px', color:'var(--sub)' }}>
                <span style={{ color:'#888', minWidth:'70px' }}>{entry.generatedAt}</span>
                <span style={{ color:'#0064ff' }}>{entry.coachId}</span>
                <span>→ {entry.limit} athletes</span>
                <span style={{ color:'#ff6600', marginLeft:'auto' }}>{entry.code}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
