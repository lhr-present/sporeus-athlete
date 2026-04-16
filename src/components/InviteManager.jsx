// ─── InviteManager.jsx — Coach-only invite management ────────────────────────
// Lists active invites, generates new ones with label/limit/expiry options,
// lets coach revoke with 5-second undo toast. Only shown to role coach/both.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'
import { createInvite, listInvites, revokeInvite, buildInviteUrl } from '../lib/inviteUtils.js'
import { logger } from '../lib/logger.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const BLUE   = '#0064ff'
const GREEN  = '#5bc25b'
const RED    = '#e03030'
const DIM    = '#555'

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {})
  } else {
    try {
      const el = document.createElement('textarea')
      el.value = text; document.body.appendChild(el)
      el.select(); document.execCommand('copy')
      document.body.removeChild(el)
    } catch { /* ignore */ }
  }
}

function formatExpiry(isoStr) {
  if (!isoStr) return '∞'
  const d = new Date(isoStr)
  const now = new Date()
  const days = Math.ceil((d - now) / 86400000)
  if (days < 0)  return 'EXPIRED'
  if (days === 0) return 'Today'
  if (days === 1) return '1d'
  if (days < 30)  return `${days}d`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function InviteManager({ coachId }) {
  const [invites, setInvites]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [copied, setCopied]           = useState(null)   // code that was just copied
  const [pendingRevoke, setPendingRevoke] = useState(null) // { id, timer }
  const [toast, setToast]             = useState(null)   // { msg, type }

  // ── Form state ───────────────────────────────────────────────────────────────
  const [label, setLabel]     = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [days, setDays]       = useState('7')

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const load = useCallback(async () => {
    if (!supabase || !coachId) { setLoading(false); return }
    setLoading(true)
    const rows = await listInvites(supabase, coachId)
    setInvites(rows)
    setLoading(false)
  }, [coachId])

  useEffect(() => { load() }, [load])

  // ── Generate new invite ───────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!supabase || !coachId || generating) return
    setGenerating(true)
    const expiresAt = days
      ? new Date(Date.now() + parseInt(days) * 86400000).toISOString()
      : null
    const { code, inviteUrl, error } = await createInvite(supabase, coachId, {
      label:    label.trim() || null,
      maxUses:  maxUses ? parseInt(maxUses) : null,
      expiresAt,
    })
    setGenerating(false)
    if (error) { showToast(`Failed: ${error}`, 'error'); return }
    showToast(`Created ${code}`, 'success')
    copyToClipboard(inviteUrl)
    setLabel(''); setMaxUses('')
    load()
  }

  // ── Copy link ────────────────────────────────────────────────────────────────
  function handleCopy(code) {
    copyToClipboard(buildInviteUrl(code))
    setCopied(code)
    setTimeout(() => setCopied(c => c === code ? null : c), 2000)
  }

  // ── Revoke with 5-sec undo ───────────────────────────────────────────────────
  function handleRevoke(invite) {
    if (pendingRevoke?.id === invite.id) return

    // Optimistically remove from list
    setInvites(prev => prev.filter(i => i.id !== invite.id))

    const timer = setTimeout(async () => {
      setPendingRevoke(null)
      const { success, error } = await revokeInvite(supabase, invite.id)
      if (!success) {
        logger.warn('[InviteManager] revoke failed:', error)
        setInvites(prev => [invite, ...prev].sort((a, b) =>
          new Date(b.created_at) - new Date(a.created_at)))
        showToast('Revoke failed — invite restored', 'error')
      }
    }, 5000)

    setPendingRevoke({ id: invite.id, timer, invite })
    showToast('Invite removed — undo?', 'undo', invite)
  }

  function handleUndo() {
    if (!pendingRevoke) return
    clearTimeout(pendingRevoke.timer)
    setInvites(prev => [pendingRevoke.invite, ...prev].sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)))
    setPendingRevoke(null)
    setToast(null)
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const label_s  = { fontFamily: MONO, fontSize: '9px', color: DIM, letterSpacing: '0.1em', display: 'block', marginBottom: '4px' }
  const input_s  = { fontFamily: MONO, fontSize: '12px', padding: '6px 10px', border: '1px solid #2a2a2a', borderRadius: '4px', background: '#111', color: '#e0e0e0', width: '100%', boxSizing: 'border-box' }
  const btn = (bg, fg, disabled) => ({
    fontFamily: MONO, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
    padding: '7px 14px', borderRadius: '4px', border: 'none',
    background: disabled ? '#222' : bg, color: disabled ? DIM : fg,
    cursor: disabled ? 'not-allowed' : 'pointer',
  })

  return (
    <div style={{ fontFamily: MONO }}>
      {/* ── Header ── */}
      <div style={{ fontSize: '10px', color: ORANGE, letterSpacing: '0.12em', fontWeight: 700, marginBottom: '16px' }}>
        INVITE LINKS
      </div>

      {/* ── Generate form ── */}
      <div style={{ background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'end' }}>
          <div>
            <label style={label_s}>LABEL (optional)</label>
            <input style={input_s} placeholder="e.g. Rowing squad 2026" value={label}
              onChange={e => setLabel(e.target.value)} maxLength={80} />
          </div>
          <div style={{ minWidth: '80px' }}>
            <label style={label_s}>MAX USES</label>
            <input style={input_s} type="number" placeholder="∞" value={maxUses}
              onChange={e => setMaxUses(e.target.value)} min="1" max="999" />
          </div>
          <div style={{ minWidth: '80px' }}>
            <label style={label_s}>EXPIRES (days)</label>
            <input style={input_s} type="number" placeholder="7" value={days}
              onChange={e => setDays(e.target.value)} min="1" max="365" />
          </div>
        </div>
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleGenerate} disabled={generating} style={btn(ORANGE, '#fff', generating)}>
            {generating ? '…' : '+ GENERATE INVITE'}
          </button>
        </div>
      </div>

      {/* ── Invite list ── */}
      {loading ? (
        <div style={{ fontSize: '10px', color: DIM, padding: '12px 0' }}>Loading…</div>
      ) : invites.length === 0 ? (
        <div style={{ fontSize: '10px', color: DIM, padding: '12px 0', lineHeight: 1.8 }}>
          No active invites. Generate one above and share the link.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {invites.map(inv => {
            const url    = buildInviteUrl(inv.code)
            const isUsed = inv.max_uses !== null && inv.uses_count >= inv.max_uses
            const expLabel = formatExpiry(inv.expires_at)
            const expired  = expLabel === 'EXPIRED'

            return (
              <div key={inv.id} style={{
                background: '#0d0d0d', border: `1px solid ${isUsed || expired ? '#1a1a1a' : '#222'}`,
                borderRadius: '6px', padding: '10px 14px',
                opacity: isUsed || expired ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
              }}>
                {/* Code */}
                <div style={{ flex: '0 0 auto' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: ORANGE, letterSpacing: '0.06em' }}>
                    {inv.code}
                  </div>
                  {inv.label && (
                    <div style={{ fontSize: '9px', color: DIM, marginTop: '2px' }}>{inv.label}</div>
                  )}
                </div>

                {/* Stats */}
                <div style={{ flex: '1 1 100px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '9px', color: DIM }}>USES</div>
                    <div style={{ fontSize: '11px', color: '#ccc' }}>
                      {inv.uses_count}{inv.max_uses !== null ? `/${inv.max_uses}` : ''}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '9px', color: DIM }}>EXPIRES</div>
                    <div style={{ fontSize: '11px', color: expired ? RED : '#ccc' }}>{expLabel}</div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', flex: '0 0 auto' }}>
                  <button onClick={() => handleCopy(inv.code)} style={btn(BLUE, '#fff', false)}>
                    {copied === inv.code ? '✓ COPIED' : 'COPY LINK'}
                  </button>
                  <button onClick={() => handleRevoke(inv)} style={btn('#1a1a1a', RED, false)}>
                    REVOKE
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', border: `1px solid ${toast.type === 'error' ? RED : toast.type === 'success' ? GREEN : '#333'}`,
          borderRadius: '6px', padding: '10px 20px', zIndex: 30000,
          display: 'flex', alignItems: 'center', gap: '16px',
          fontFamily: MONO, fontSize: '11px', color: '#e0e0e0',
        }}>
          <span>{toast.msg}</span>
          {toast.type === 'undo' && (
            <button onClick={handleUndo} style={{ ...btn(ORANGE, '#fff', false), padding: '4px 12px' }}>
              UNDO
            </button>
          )}
        </div>
      )}
    </div>
  )
}
