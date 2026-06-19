// ─── MyCoach.jsx — Athlete-side coach connection (invite accept + status) ─────
import { useState, useEffect, useCallback, useRef, useContext } from 'react'
import { supabase } from '../lib/supabase.js'
import { redeemInvite } from '../lib/inviteUtils.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { LangCtx } from '../contexts/LangCtx.jsx'

// Map a preview_coach_invite RPC reason code to a user-facing message via t().
function inviteReasonMsg(reason, t) {
  switch (reason) {
    case 'INVALID_CODE':     return t('myCoach_reasonInvalidCode')
    case 'REVOKED':          return t('myCoach_reasonRevoked')
    case 'EXPIRED':          return t('myCoach_reasonExpired')
    case 'MAX_USES_REACHED': return t('myCoach_reasonMaxUses')
    case 'SELF_INVITE':      return t('myCoach_reasonSelfInvite')
    case 'MISSING_CODE':     return t('myCoach_reasonMissingCode')
    default:                 return t('myCoach_reasonDefault')
  }
}

const MONO  = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'
const GREEN  = '#5bc25b'
const RED    = '#e03030'

// ── InviteModal ───────────────────────────────────────────────────────────────
// Shown when ?invite=CODE is in the URL. Resolves coach name, lets athlete
// accept or decline.
export function InviteModal({ inviteCode, userId, onDone }) {
  const { t } = useContext(LangCtx)
  const [invite, setInvite]   = useState(null)  // { coach_id, code, ... }
  const [coach, setCoach]     = useState(null)  // profile row of the coach
  const [status, setStatus]   = useState('loading')  // loading|ready|error|done
  const [msg, setMsg]         = useState('')
  const [busy, setBusy]       = useState(false)

  useEffect(() => {
    if (!supabase || !inviteCode) { setStatus('error'); setMsg(t('myCoach_invalidInvite')); return }
    let cancelled = false
    // Preview via SECURITY DEFINER RPC (keyed by the code we already hold) — the
    // coach_invites table is no longer athlete-readable (enumeration leak fix).
    supabase
      .rpc('preview_coach_invite', { p_code: inviteCode })
      .then(({ data, error }) => {
        if (cancelled) return
        const row = Array.isArray(data) ? data[0] : data
        if (error || !row) { setStatus('error'); setMsg(t('myCoach_inviteNotFound')); return }
        if (!row.valid) { setStatus('error'); setMsg(inviteReasonMsg(row.reason, t)); return }
        setInvite({ coach_id: row.coach_id, code: inviteCode })
        setCoach({ display_name: row.coach_name })
        setStatus('ready')
      })
    return () => { cancelled = true }
  }, [inviteCode, t])

  const accept = useCallback(async () => {
    if (!invite || !userId || busy) return
    setBusy(true)
    // Redeem server-side (redeem-invite edge fn): derives athlete_id from the JWT,
    // enforces roster limits / max-uses / already-linked, links + increments uses.
    const res = await redeemInvite(supabase, invite.code)
    if (res.success) {
      if (res.coach_name) setCoach({ display_name: res.coach_name })
      setStatus('done')
      setTimeout(onDone, 2000)
    } else {
      setMsg(res.error || inviteReasonMsg(res.code, t))
      setBusy(false)
    }
  }, [invite, userId, busy, onDone, t])

  const decline = useCallback(() => {
    onDone()
  }, [onDone])

  const panelRef = useRef(null)
  useFocusTrap(panelRef, { onEscape: decline })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('myCoach_inviteDialogAria')}
      style={{
        position: 'fixed', inset: 0, zIndex: 20000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
        fontFamily: MONO,
      }}
    >
      <div ref={panelRef} style={{
        background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px',
        padding: '36px 32px', width: '100%', maxWidth: '380px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: BLUE, letterSpacing: '0.08em', marginBottom: '8px' }}>
          {t('myCoach_inviteHeading')}
        </div>

        {status === 'loading' && (
          <div style={{ fontSize: '11px', color: '#555', marginTop: '24px' }}>{t('myCoach_lookingUp')}</div>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '11px', color: RED, marginTop: '24px', lineHeight: 1.6 }}>{msg}</div>
            <button onClick={decline} style={btnStyle('#333', '#ccc')}>{t('myCoach_close')}</button>
          </>
        )}

        {status === 'ready' && (
          <>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '16px', lineHeight: 1.8 }}>
              <span style={{ color: ORANGE, fontWeight: 700 }}>
                {coach?.display_name || t('myCoach_aCoach')}
              </span>
              {' '}{t('myCoach_wantsToConnect')}
            </div>
            <div style={{ fontSize: '10px', color: '#555', marginBottom: '28px', marginTop: '4px' }}>
              {t('myCoach_canViewSendPlans')}
            </div>
            {msg && <div style={{ fontSize: '11px', color: RED, marginBottom: '12px' }}>{msg}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={accept} disabled={busy} style={btnStyle(BLUE, '#fff', busy)}>
                {busy ? '…' : t('myCoach_accept')}
              </button>
              <button onClick={decline} disabled={busy} style={btnStyle('#1a1a1a', '#888')}>
                {t('myCoach_decline')}
              </button>
            </div>
          </>
        )}

        {status === 'done' && (
          <div style={{ fontSize: '13px', color: GREEN, marginTop: '24px', fontWeight: 700 }}>
            {t('myCoach_connectedDone')}
          </div>
        )}
      </div>
    </div>
  )
}

// ── MyCoachStatus ─────────────────────────────────────────────────────────────
// Shown in Profile tab — current coach connection + disconnect button.
// v9.23.0 — added onDisconnect callback so parent (CoachConnectionPanel) can
// flip back to JoinCoachInput when the athlete severs the link.
export function MyCoachStatus({ userId, onDisconnect }) {
  const { t } = useContext(LangCtx)
  const [link, setLink]     = useState(null)   // coach_athletes row
  const [coach, setCoach]   = useState(null)   // coach profile
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState(false)
  const [err, setErr]       = useState('')

  const load = useCallback(async () => {
    if (!supabase || !userId) { setLoading(false); return }
    const { data } = await supabase
      .from('coach_athletes')
      .select('*')
      .eq('athlete_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    if (!data) { setLoading(false); return }
    setLink(data)
    const { data: cp } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', data.coach_id)
      .maybeSingle()
    setCoach(cp)
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  async function disconnect() {
    if (!link || busy) return
    setBusy(true); setErr('')
    // Inspect the result: on RLS rejection / network failure the row stays
    // 'active' and the coach keeps data access. Only clear the UI on success —
    // otherwise the athlete would believe they're disconnected while they're not.
    const { error } = await supabase.from('coach_athletes')
      .update({ status: 'revoked' })
      .eq('id', link.id)
    if (error) {
      setErr(t('myCoach_disconnectFailed'))
      setBusy(false)
      return
    }
    setLink(null); setCoach(null); setBusy(false)
    if (onDisconnect) onDisconnect()
  }

  if (loading) return null
  if (!link)   return null

  return (
    <div style={{
      background: '#0064ff11', border: '1px solid #0064ff33', borderRadius: '6px',
      padding: '12px 16px', marginBottom: '16px', fontFamily: MONO,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '9px', color: '#0064ff88', letterSpacing: '0.1em', marginBottom: '2px' }}>{t('myCoach_myCoachLabel')}</div>
          <div style={{ fontSize: '12px', color: '#e0e0e0', fontWeight: 700 }}>
            {coach?.display_name || t('myCoach_coachFallback')}
          </div>
          <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>{coach?.email || ''}</div>
        </div>
        <button onClick={disconnect} disabled={busy} style={{
          ...btnStyle('#1a1a1a', RED), padding: '5px 12px', fontSize: '9px',
        }}>
          {busy ? '…' : t('myCoach_disconnect')}
        </button>
      </div>
      {err && (
        <div role="alert" style={{ fontSize: '10px', color: RED, marginTop: '8px' }}>{err}</div>
      )}
    </div>
  )
}

// Render the "Got a coach invite code…" prompt, interleaving the two styled
// <code> samples into the translated template at its {sample} / {link} markers.
function renderJoinPrompt(t, sampleNode, linkNode) {
  const template = t('myCoach_gotCodePrompt')
  // Split into ordered text/placeholder segments, preserving the placeholders.
  const parts = template.split(/(\{sample\}|\{link\})/)
  return parts.map((seg, i) => {
    if (seg === '{sample}') return <span key={i}>{sampleNode}</span>
    if (seg === '{link}')   return <span key={i}>{linkNode}</span>
    return seg
  })
}

function btnStyle(bg, color, disabled) {
  return {
    flex: 1, padding: '10px', border: 'none', borderRadius: '4px',
    background: bg, color, fontFamily: MONO, fontSize: '11px',
    fontWeight: 700, letterSpacing: '0.1em', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

// ── CoachConnectionPanel ──────────────────────────────────────────────────────
// v9.23.0 — Public wrapper that conditionally renders MyCoachStatus (when
// athlete already has an active coach link) or JoinCoachInput (when they don't).
// Single mount-point for the Profile tab. Callers don't need to know which
// branch to render.
export function CoachConnectionPanel({ userId }) {
  const [hasCoach, setHasCoach] = useState(null) // null=loading, true/false
  const refresh = useCallback(async () => {
    if (!supabase || !userId) { setHasCoach(false); return }
    const { data } = await supabase
      .from('coach_athletes')
      .select('id')
      .eq('athlete_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    setHasCoach(!!data)
  }, [userId])
  useEffect(() => { refresh() }, [refresh])
  if (hasCoach === null) return null  // loading: render nothing to avoid flicker
  if (hasCoach) return <MyCoachStatus userId={userId} onDisconnect={refresh} />
  return <JoinCoachInput userId={userId} onJoined={refresh} />
}

// ── JoinCoachInput ────────────────────────────────────────────────────────────
// v9.23.0 — Manual invite-code entry for athletes who got the code via SMS,
// Slack, voice, etc. (rather than clicking the URL). Sits on the Profile tab
// when athlete has no coach connection. On accept, calls the same upsert logic
// as InviteModal so both paths converge on coach_athletes.
export function JoinCoachInput({ userId, onJoined }) {
  const { t } = useContext(LangCtx)
  const [code, setCode]     = useState('')
  const [busy, setBusy]     = useState(false)
  const [msg, setMsg]       = useState('')
  const [coachName, setCoachName] = useState(null)
  const [stage, setStage]   = useState('input') // input | confirm | done

  async function lookup() {
    if (!supabase || !code.trim() || busy) return
    setBusy(true); setMsg('')
    const trimmed = code.trim().toUpperCase()
    try {
      // Preview via SECURITY DEFINER RPC — coach_invites is no longer
      // athlete-readable (enumeration leak fix). Returns coach name for a code
      // the caller already holds; no enumeration.
      const { data, error } = await supabase.rpc('preview_coach_invite', { p_code: trimmed })
      const row = Array.isArray(data) ? data[0] : data
      if (error || !row) { setMsg(t('myCoach_codeNotFound')); setBusy(false); return }
      if (!row.valid) { setMsg(inviteReasonMsg(row.reason, t)); setBusy(false); return }
      setCoachName(row.coach_name || t('myCoach_aCoach'))
      setStage('confirm')
      setBusy(false)
    } catch (e) {
      setMsg(e?.message || t('myCoach_lookupFailed')); setBusy(false)
    }
  }

  async function accept() {
    if (!supabase || !userId || busy) return
    setBusy(true); setMsg('')
    const trimmed = code.trim().toUpperCase()
    // Redeem server-side (redeem-invite edge fn): athlete_id from JWT, enforces
    // roster limits / max-uses / already-linked, links + increments uses.
    const res = await redeemInvite(supabase, trimmed)
    if (res.success) {
      if (res.coach_name) setCoachName(res.coach_name)
      setStage('done')
      setTimeout(() => onJoined && onJoined(), 1500)
    } else {
      setMsg(res.error || inviteReasonMsg(res.code, t)); setBusy(false)
    }
  }

  if (stage === 'done') {
    return (
      <div style={{ background: '#5bc25b11', border: '1px solid #5bc25b33', borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontFamily: MONO, fontSize: 12, color: GREEN, fontWeight: 700 }}>
        {t('myCoach_connectedTo').replace('{name}', coachName)}
      </div>
    )
  }

  return (
    <div style={{
      background: '#0064ff08', border: '1px dashed #0064ff44', borderRadius: 6,
      padding: '14px 16px', marginBottom: 16, fontFamily: MONO,
    }}>
      <div style={{ fontSize: '9px', color: '#0064ff88', letterSpacing: '0.1em', marginBottom: 8 }}>{t('myCoach_joinHeading')}</div>
      {stage === 'input' && (
        <>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 10, lineHeight: 1.5 }}>
            {renderJoinPrompt(t,
              <code style={{ color: '#0064ff' }}>SP-XXXXXXXX</code>,
              <code style={{ color: '#0064ff' }}>app.sporeus.com/?invite=SP-XXXXXXXX</code>,
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder={t('myCoach_codePlaceholder')}
              style={{
                flex: 1, fontFamily: MONO, fontSize: 12, padding: '10px 12px',
                minHeight: 44, border: '1px solid #2a2a2a', borderRadius: 4,
                background: '#0a0a0a', color: '#e0e0e0', letterSpacing: '0.06em',
              }}
              aria-label={t('myCoach_codeInputAria')}
            />
            <button onClick={lookup} disabled={!code.trim() || busy} style={{
              padding: '10px 16px', minHeight: 44, border: 'none', borderRadius: 4,
              background: BLUE, color: '#fff', fontFamily: MONO, fontSize: 11,
              fontWeight: 700, letterSpacing: '0.1em', cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1,
            }}>{busy ? '…' : t('myCoach_lookUp')}</button>
          </div>
        </>
      )}
      {stage === 'confirm' && (
        <>
          <div style={{ fontSize: 12, color: '#e0e0e0', marginBottom: 10, lineHeight: 1.6 }}>
            <span style={{ color: ORANGE, fontWeight: 700 }}>{coachName}</span> {t('myCoach_wantsToBeCoach')}
          </div>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 14, lineHeight: 1.5 }}>
            {t('myCoach_canViewSendEdits')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={accept} disabled={busy} style={btnStyle(BLUE, '#fff', busy)}>
              {busy ? '…' : t('myCoach_accept')}
            </button>
            <button onClick={() => { setStage('input'); setCode(''); setCoachName(null) }} disabled={busy} style={btnStyle('#1a1a1a', '#888')}>
              {t('myCoach_cancel')}
            </button>
          </div>
        </>
      )}
      {msg && <div style={{ fontSize: 10, color: RED, marginTop: 8 }}>{msg}</div>}
    </div>
  )
}
