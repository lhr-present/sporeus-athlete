import { useState } from 'react'
import { S } from '../../styles.js'
import { generateCoachId, FREE_ATHLETE_LIMIT } from '../../lib/formulas.js'

// ─── Coach Registration ────────────────────────────────────────────────────────

export default function CoachRegistration({ onDone }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [generatedId, setGeneratedId] = useState(null)
  const [generating, setGenerating] = useState(false)

  async function handleGenerate() {
    if (!name.trim()) return
    setGenerating(true)
    const id = await generateCoachId(name, email)
    setGeneratedId(id)
    setGenerating(false)
  }

  function handleConfirm() {
    if (!generatedId) return
    onDone({ name: name.trim(), email: email.trim(), coachId: generatedId, createdAt: new Date().toISOString(), unlockCode: null, athleteLimit: FREE_ATHLETE_LIMIT })
  }

  return (
    <div className="sp-fade">
      <div style={{ ...S.card, borderLeft:'3px solid #0064ff' }}>
        <div style={{ ...S.cardTitle, color:'#0064ff', borderColor:'#0064ff44' }}>◈ SET UP YOUR COACH PROFILE</div>
        <div style={{ ...S.mono, fontSize:'12px', color:'var(--sub)', lineHeight:1.8, marginBottom:'20px' }}>
          Each coach gets a unique invite code. Athletes connect by opening your link.
          <br/><span style={{ color:'var(--muted)', fontSize:'11px' }}>Your email stays local — used only to generate your unique code.</span>
        </div>
        <div style={S.row}>
          <div style={{ flex:'1 1 200px' }}>
            <label style={S.label}>YOUR NAME *</label>
            <input style={S.input} placeholder="Hüseyin Akbulut" value={name} onChange={e => setName(e.target.value)}/>
          </div>
          <div style={{ flex:'1 1 200px' }}>
            <label style={S.label}>EMAIL (optional, makes code unique)</label>
            <input style={S.input} type="email" placeholder="coach@sporeus.com" value={email} onChange={e => setEmail(e.target.value)}/>
          </div>
        </div>
        <button style={{ ...S.btn, marginTop:'16px' }} onClick={handleGenerate} disabled={!name.trim() || generating}>
          {generating ? 'Generating...' : '◈ Generate My Invite Code'}
        </button>
        {generatedId && (
          <div style={{ marginTop:'20px', padding:'14px 16px', background:'#0064ff11', border:'1px solid #0064ff44', borderRadius:'6px' }}>
            <div style={{ ...S.mono, fontSize:'10px', color:'#888', marginBottom:'6px', letterSpacing:'0.1em' }}>YOUR COACH ID</div>
            <div style={{ ...S.mono, fontSize:'22px', fontWeight:700, color:'#0064ff', letterSpacing:'0.1em', marginBottom:'8px' }}>{generatedId}</div>
            <div style={{ ...S.mono, fontSize:'11px', color:'var(--sub)', lineHeight:1.7, marginBottom:'16px' }}>
              This is your unique invite code. Share the link — athletes auto-connect.<br/>
              <span style={{ color:'var(--muted)', fontSize:'10px' }}>Free tier: {FREE_ATHLETE_LIMIT} connected athletes. Contact sporeus.com to unlock more.</span>
            </div>
            <button style={{ ...S.btn, background:'#0064ff', borderColor:'#0064ff' }} onClick={handleConfirm}>
              ✓ Save &amp; Open Coach Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
