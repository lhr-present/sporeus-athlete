// ─── MyCoach.jsx — Athlete-side coach connection (invite accept + status) ─────
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

const MONO  = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'
const GREEN  = '#5bc25b'
const RED    = '#e03030'

// ── InviteModal ───────────────────────────────────────────────────────────────
// Shown when ?invite=CODE is in the URL. Resolves coach name, lets athlete
// accept or decline.
export function InviteModal({ inviteCode, userId, onDone }) {
  const [invite, setInvite]   = useState(null)  // { coach_id, code, ... }
  const [coach, setCoach]     = useState(null)  // profile row of the coach
  const [status, setStatus]   = useState('loading')  // loading|ready|error|done
  const [msg, setMsg]         = useState('')
  const [busy, setBusy]       = useState(false)

  useEffect(() => {
    if (!supabase || !inviteCode) { setStatus('error'); setMsg('Invalid invite.'); return }
    supabase
      .from('coach_invites')
      .select('*')
      .eq('code', inviteCode)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) { setStatus('error'); setMsg('Invite not found or expired.'); return }
        setInvite(data)
        const { data: coachProfile } = await supabase
          .from('profiles')
          .select('display_name, email')
          .eq('id', data.coach_id)
          .single()
        setCoach(coachProfile)
        setStatus('ready')
      })
  }, [inviteCode])

  const accept = useCallback(async () => {
    if (!invite || !userId || busy) return
    setBusy(true)
    try {
      // Create coach-athlete link
      const { error: linkErr } = await supabase.from('coach_athletes').upsert({
        coach_id:   invite.coach_id,
        athlete_id: userId,
        status:     'active',
      }, { onConflict: 'coach_id,athlete_id' })
      if (linkErr) throw linkErr

      // Mark invite as used
      await supabase.from('coach_invites')
        .update({ used_by: userId })
        .eq('code', invite.code)

      setStatus('done')
      setTimeout(onDone, 2000)
    } catch (e) {
      setMsg(e.message)
      setBusy(false)
    }
  }, [invite, userId, busy, onDone])

  const decline = useCallback(() => {
    onDone()
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 20000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      fontFamily: MONO,
    }}>
      <div style={{
        background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px',
        padding: '36px 32px', width: '100%', maxWidth: '380px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: BLUE, letterSpacing: '0.08em', marginBottom: '8px' }}>
          ◈ COACH INVITE
        </div>

        {status === 'loading' && (
          <div style={{ fontSize: '11px', color: '#555', marginTop: '24px' }}>Looking up invite…</div>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '11px', color: RED, marginTop: '24px', lineHeight: 1.6 }}>{msg}</div>
            <button onClick={decline} style={btnStyle('#333', '#ccc')}>CLOSE</button>
          </>
        )}

        {status === 'ready' && (
          <>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '16px', lineHeight: 1.8 }}>
              <span style={{ color: ORANGE, fontWeight: 700 }}>
                {coach?.display_name || 'A coach'}
              </span>
              {' '}wants to connect with you as your coach.
            </div>
            <div style={{ fontSize: '10px', color: '#555', marginBottom: '28px', marginTop: '4px' }}>
              They will be able to view your training data and send plans.
            </div>
            {msg && <div style={{ fontSize: '11px', color: RED, marginBottom: '12px' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={accept} disabled={busy} style={btnStyle(BLUE, '#fff', busy)}>
                {busy ? '…' : 'ACCEPT'}
              </button>
              <button onClick={decline} disabled={busy} style={btnStyle('#1a1a1a', '#888')}>
                DECLINE
              </button>
            </div>
          </>
        )}

        {status === 'done' && (
          <div style={{ fontSize: '13px', color: GREEN, marginTop: '24px', fontWeight: 700 }}>
            ✓ Connected! Your coach can now see your data.
          </div>
        )}
      </div>
    </div>
  )
}

// ── MyCoachStatus ─────────────────────────────────────────────────────────────
// Shown in Profile tab — current coach connection + disconnect button.
export function MyCoachStatus({ userId }) {
  const [link, setLink]     = useState(null)   // coach_athletes row
  const [coach, setCoach]   = useState(null)   // coach profile
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !userId) { setLoading(false); return }
    const { data } = await supabase
      .from('coach_athletes')
      .select('*')
      .eq('athlete_id', userId)
      .eq('status', 'active')
      .single()
    if (!data) { setLoading(false); return }
    setLink(data)
    const { data: cp } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', data.coach_id)
      .single()
    setCoach(cp)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  async function disconnect() {
    if (!link || busy) return
    setBusy(true)
    await supabase.from('coach_athletes')
      .update({ status: 'revoked' })
      .eq('id', link.id)
    setLink(null); setCoach(null); setBusy(false)
  }

  if (loading) return null
  if (!link)   return null

  return (
    <div style={{
      background: '#0064ff11', border: '1px solid #0064ff33', borderRadius: '6px',
      padding: '12px 16px', marginBottom: '16px', fontFamily: MONO,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
    }}>
      <div>
        <div style={{ fontSize: '9px', color: '#0064ff88', letterSpacing: '0.1em', marginBottom: '2px' }}>MY COACH</div>
        <div style={{ fontSize: '12px', color: '#e0e0e0', fontWeight: 700 }}>
          {coach?.display_name || 'Coach'}
        </div>
        <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{coach?.email || ''}</div>
      </div>
      <button onClick={disconnect} disabled={busy} style={{
        ...btnStyle('#1a1a1a', RED), padding: '5px 12px', fontSize: '9px',
      }}>
        {busy ? '…' : 'DISCONNECT'}
      </button>
    </div>
  )
}

function btnStyle(bg, color, disabled) {
  return {
    flex: 1, padding: '10px', border: 'none', borderRadius: '4px',
    background: bg, color, fontFamily: MONO, fontSize: '11px',
    fontWeight: 700, letterSpacing: '0.1em', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}
