// ─── RoleSelector.jsx — First-login role selection (athlete / coach) ──────────
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

const MONO  = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'

export default function RoleSelector({ userId, onComplete, lang }) {
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState(null)
  const isTR = lang === 'tr'

  async function choose(role) {
    if (!supabase || busy) return
    setBusy(true); setErr(null)
    const { error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) { setErr(error.message); setBusy(false); return }
    onComplete(role)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: MONO,
    }}>
      <div style={{
        background: '#111',
        border: '1px solid #2a2a2a',
        borderRadius: '8px',
        padding: '40px 36px',
        width: '100%',
        maxWidth: '420px',
        boxSizing: 'border-box',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: ORANGE, letterSpacing: '0.08em', marginBottom: '8px' }}>
          ◈ {isTR ? 'Rolünüzü Seçin' : 'Choose Your Role'}
        </div>
        <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.12em', marginBottom: '32px' }}>
          {isTR
            ? 'Bu tercih hesabınızın özelliklerini belirler. Daha sonra değiştirilebilir.'
            : 'This determines which features you see. Can be changed later in Profile.'}
        </div>

        <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
          {/* Both */}
          <button onClick={() => choose('both')} disabled={busy} style={{
            background: '#1a1a1a',
            border: '2px solid #333',
            borderRadius: '8px',
            padding: '24px 20px',
            cursor: busy ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            fontFamily: MONO,
            transition: 'border-color 0.15s',
            opacity: busy ? 0.5 : 1,
          }}
            onMouseOver={e => !busy && (e.currentTarget.style.borderColor = '#9933ff')}
            onMouseOut={e => !busy && (e.currentTarget.style.borderColor = '#333')}
          >
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>🏃📋</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#eee', letterSpacing: '0.08em', marginBottom: '6px' }}>
              {isTR ? 'İKİSİ DE' : "I'M BOTH"}
            </div>
            <div style={{ fontSize: '10px', color: '#666', lineHeight: 1.6 }}>
              {isTR
                ? 'Hem antrenman takip et hem de sporcu yönet.'
                : 'Log your own training and manage athletes as a coach.'}
            </div>
          </button>

          {/* Athlete */}
          <button onClick={() => choose('athlete')} disabled={busy} style={{
            background: '#1a1a1a',
            border: '2px solid #333',
            borderRadius: '8px',
            padding: '24px 20px',
            cursor: busy ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            fontFamily: MONO,
            transition: 'border-color 0.15s',
            opacity: busy ? 0.5 : 1,
          }}
            onMouseOver={e => !busy && (e.currentTarget.style.borderColor = ORANGE)}
            onMouseOut={e => !busy && (e.currentTarget.style.borderColor = '#333')}
          >
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>🏃</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#eee', letterSpacing: '0.08em', marginBottom: '6px' }}>
              {isTR ? 'SPORCU' : "I'M AN ATHLETE"}
            </div>
            <div style={{ fontSize: '10px', color: '#666', lineHeight: 1.6 }}>
              {isTR
                ? 'Antrenman kaydet, toparlanmayı izle, yarış hazırlığını ölç.'
                : 'Log training, track recovery, measure race readiness.'}
            </div>
          </button>

          {/* Coach */}
          <button onClick={() => choose('coach')} disabled={busy} style={{
            background: '#1a1a1a',
            border: '2px solid #333',
            borderRadius: '8px',
            padding: '24px 20px',
            cursor: busy ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            fontFamily: MONO,
            transition: 'border-color 0.15s',
            opacity: busy ? 0.5 : 1,
          }}
            onMouseOver={e => !busy && (e.currentTarget.style.borderColor = BLUE)}
            onMouseOut={e => !busy && (e.currentTarget.style.borderColor = '#333')}
          >
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>📋</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#eee', letterSpacing: '0.08em', marginBottom: '6px' }}>
              {isTR ? 'ANTRENÖR' : "I'M A COACH"}
            </div>
            <div style={{ fontSize: '10px', color: '#666', lineHeight: 1.6 }}>
              {isTR
                ? 'Birden fazla sporcuyu takip et, zeka analizleri ve yarış brifinglari al.'
                : 'Monitor multiple athletes, get intelligence reports and race briefs.'}
            </div>
          </button>
        </div>

        {err && (
          <div style={{ marginTop: '16px', fontSize: '11px', color: '#e03030', fontFamily: MONO }}>
            {err}
          </div>
        )}

        <div style={{ marginTop: '24px', fontSize: '9px', color: '#333', letterSpacing: '0.08em' }}>
          {isTR ? 'Her iki rol da ücretsiz başlar.' : 'Both roles start free.'}
        </div>
      </div>
    </div>
  )
}
