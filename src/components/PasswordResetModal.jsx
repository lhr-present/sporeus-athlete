// ─── PasswordResetModal.jsx — v9.493 (publish-readiness F2) ──────────────────
// The app had NO password reset path: AuthGate offered login/signup/magic only,
// and a recovery link (implicit flow → PASSWORD_RECOVERY auth event) had no
// listener — forgot-password users were stranded. This modal subscribes to
// onAuthStateChange itself (multiple subscribers are fine in supabase-js),
// opens on PASSWORD_RECOVERY, and sets the new password via updateUser.
import { useState, useEffect, useContext } from 'react'
import { supabase } from '../lib/supabase.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'

export default function PasswordResetModal() {
  const { lang } = useContext(LangCtx)
  const isTR = lang === 'tr'
  const [open, setOpen] = useState(false)
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (!supabase) return undefined
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setOpen(true)
    })
    return () => subscription?.unsubscribe()
  }, [])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    if (pass.length < 8) {
      setMsg({ type: 'error', text: isTR ? 'Şifre en az 8 karakter olmalı.' : 'Password must be at least 8 characters.' })
      return
    }
    if (pass !== pass2) {
      setMsg({ type: 'error', text: isTR ? 'Şifreler eşleşmiyor.' : 'Passwords do not match.' })
      return
    }
    setBusy(true); setMsg(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: pass })
      if (error) {
        const text = error.code === 'weak_password'
          ? (isTR
              ? 'Şifre çok zayıf ya da bilinen bir sızıntıda bulundu — farklı bir şifre dene.'
              : 'Password is too weak or appeared in a known breach — try a different one.')
          : error.message
        setMsg({ type: 'error', text })
      } else {
        setMsg({ type: 'success', text: isTR ? 'Şifre güncellendi ✓' : 'Password updated ✓' })
        setTimeout(() => setOpen(false), 1500)
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
    setBusy(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={submit} style={{ background: 'var(--card-bg, #111)', border: '1px solid var(--border, #333)', borderRadius: 6, padding: 20, width: '100%', maxWidth: 360 }}>
        <div style={{ ...S.mono, fontSize: 12, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>
          {isTR ? 'YENİ ŞİFRE BELİRLE' : 'SET A NEW PASSWORD'}
        </div>
        <input
          type="password"
          value={pass}
          onChange={e => setPass(e.target.value)}
          placeholder={isTR ? 'Yeni şifre (min. 8)' : 'New password (min. 8)'}
          autoComplete="new-password"
          style={{ ...S.mono, width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '8px 10px', marginBottom: 8, background: 'var(--input-bg, #1a1a1a)', color: 'var(--text)', border: '1px solid var(--border, #333)', borderRadius: 3 }}
        />
        <input
          type="password"
          value={pass2}
          onChange={e => setPass2(e.target.value)}
          placeholder={isTR ? 'Yeni şifre (tekrar)' : 'New password (again)'}
          autoComplete="new-password"
          style={{ ...S.mono, width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '8px 10px', marginBottom: 10, background: 'var(--input-bg, #1a1a1a)', color: 'var(--text)', border: '1px solid var(--border, #333)', borderRadius: 3 }}
        />
        {msg && (
          <div style={{ ...S.mono, fontSize: 11, marginBottom: 10, color: msg.type === 'error' ? '#ff4444' : '#5bc25b' }}>{msg.text}</div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={busy} style={{ ...S.mono, flex: 1, fontSize: 11, fontWeight: 700, padding: '8px 0', background: '#ff6600', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
            {busy ? '...' : (isTR ? 'GÜNCELLE' : 'UPDATE')}
          </button>
          <button type="button" onClick={() => setOpen(false)} style={{ ...S.mono, fontSize: 11, padding: '8px 12px', background: 'transparent', color: '#888', border: '1px solid var(--border, #333)', borderRadius: 3, cursor: 'pointer' }}>
            {isTR ? 'KAPAT' : 'CLOSE'}
          </button>
        </div>
      </form>
    </div>
  )
}
