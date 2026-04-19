// src/pages/profile/DeleteAccount.jsx — E8: Account deletion with 30-day grace period
// Typed confirmation required. Creates deletion_request row.
// During grace period: shows cancellation option.

import { useState } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'

const REQUIRED_PHRASE = 'DELETE my account'

export default function DeleteAccount({ userId, lang = 'en' }) {
  const [phase, setPhase]     = useState('idle')    // idle | confirm | grace | cancelled | error
  const [typed, setTyped]     = useState('')
  const [loading, setLoading] = useState(false)
  const [graceUntil, setGraceUntil] = useState(null)
  const [error, setError]     = useState(null)

  const L = lang === 'tr' ? TR : EN

  async function checkExistingRequest() {
    if (!isSupabaseReady()) return
    const { data } = await supabase
      .from('deletion_requests')
      .select('status, grace_until')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()
    if (data) {
      setGraceUntil(data.grace_until)
      setPhase('grace')
    } else {
      setPhase('confirm')
    }
  }

  async function submitDeletion() {
    if (typed !== REQUIRED_PHRASE) return
    setLoading(true)
    setError(null)
    try {
      const grace = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const { error: insertErr } = await supabase
        .from('deletion_requests')
        .insert({ user_id: userId, status: 'pending', grace_until: grace })
      if (insertErr) throw new Error(insertErr.message)
      // Sign out — all sessions ended during grace period
      await supabase.auth.signOut()
      setGraceUntil(grace)
      setPhase('grace')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function cancelDeletion() {
    setLoading(true)
    try {
      const { error: upErr } = await supabase
        .from('deletion_requests')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('status', 'pending')
      if (upErr) throw new Error(upErr.message)
      setPhase('cancelled')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (phase === 'idle') {
    return (
      <section>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#ff4444', marginBottom: '8px' }}>
          {L.title}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
          {L.description}
        </p>
        <button
          onClick={checkExistingRequest}
          style={{ padding: '8px 16px', background: 'transparent', color: '#ff4444',
                   border: '1px solid #ff4444', borderRadius: '4px', cursor: 'pointer',
                   fontSize: '13px', fontFamily: 'inherit' }}
        >
          {L.initiateBtn}
        </button>
      </section>
    )
  }

  if (phase === 'confirm') {
    return (
      <section>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#ff4444', marginBottom: '8px' }}>
          {L.confirmTitle}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
          {L.confirmDescription}
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '8px' }}>
          {L.typePrompt} <code style={{ color: '#ff6600' }}>{REQUIRED_PHRASE}</code>
        </p>
        <input
          type="text"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={REQUIRED_PHRASE}
          style={{
            width:          '100%',
            padding:        '8px 10px',
            background:     'var(--input-bg)',
            border:         '1px solid var(--border)',
            borderRadius:   '4px',
            color:          'var(--text)',
            fontFamily:     'inherit',
            fontSize:       'max(16px, 13px)',
            marginBottom:   '10px',
            boxSizing:      'border-box',
          }}
          aria-label={L.typePrompt}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={submitDeletion}
            disabled={typed !== REQUIRED_PHRASE || loading}
            style={{
              padding:    '8px 16px',
              background: typed === REQUIRED_PHRASE ? '#ff4444' : 'var(--surface)',
              color:      typed === REQUIRED_PHRASE ? '#fff' : 'var(--muted)',
              border:     'none',
              borderRadius: '4px',
              cursor:     typed === REQUIRED_PHRASE ? 'pointer' : 'not-allowed',
              fontSize:   '13px',
              fontFamily: 'inherit',
            }}
          >
            {loading ? L.deleting : L.confirmBtn}
          </button>
          <button
            onClick={() => setPhase('idle')}
            style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--border)',
                     borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
                     color: 'var(--muted)' }}
          >
            {L.cancelBtn}
          </button>
        </div>
        {error && <p style={{ fontSize: '12px', color: '#ff4444', marginTop: '6px' }}>{error}</p>}
      </section>
    )
  }

  if (phase === 'grace') {
    const until = graceUntil ? new Date(graceUntil).toLocaleDateString() : '30 days'
    return (
      <section>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#ff6600', marginBottom: '8px' }}>
          {L.graceTitle}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
          {L.graceDescription.replace('{date}', until)}
        </p>
        <button
          onClick={cancelDeletion}
          disabled={loading}
          style={{ padding: '8px 16px', background: '#00aa55', color: '#fff', border: 'none',
                   borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}
        >
          {loading ? '…' : L.cancelDeletionBtn}
        </button>
        {error && <p style={{ fontSize: '12px', color: '#ff4444', marginTop: '6px' }}>{error}</p>}
      </section>
    )
  }

  if (phase === 'cancelled') {
    return (
      <section>
        <p style={{ fontSize: '13px', color: '#00aa55' }}>{L.cancelledMsg}</p>
      </section>
    )
  }

  return null
}

const EN = {
  title:            'Delete Account',
  description:      'Permanently delete your account and all associated data. This cannot be undone after the 30-day grace period.',
  initiateBtn:      'Delete my account',
  confirmTitle:     'Confirm Account Deletion',
  confirmDescription: 'Your account will enter a 30-day grace period. All sessions will be ended. Data will be permanently deleted after 30 days. You can cancel at any time during the grace period.',
  typePrompt:       'Type exactly to confirm:',
  confirmBtn:       'Start deletion — 30 day grace period',
  cancelBtn:        'Cancel',
  deleting:         'Processing…',
  graceTitle:       'Account Pending Deletion',
  graceDescription: 'Your account is scheduled for permanent deletion on {date}. You can cancel until then.',
  cancelDeletionBtn: 'Cancel deletion — keep my account',
  cancelledMsg:     'Deletion cancelled. Your account is fully restored.',
}

const TR = {
  title:            'Hesabı Sil',
  description:      '30 günlük bekleme süresinden sonra hesabın ve tüm verilerin kalıcı olarak silinir. Bu işlem geri alınamaz.',
  initiateBtn:      'Hesabımı sil',
  confirmTitle:     'Hesap Silmeyi Onayla',
  confirmDescription: 'Hesabın 30 günlük bekleme süresine girecek. Tüm oturumlar sonlandırılacak. 30 gün sonra veriler kalıcı olarak silinir.',
  typePrompt:       'Onaylamak için aynen yaz:',
  confirmBtn:       'Silmeyi başlat — 30 günlük bekleme süresi',
  cancelBtn:        'Vazgeç',
  deleting:         'İşleniyor…',
  graceTitle:       'Hesap Silme Bekleniyor',
  graceDescription: 'Hesabın {date} tarihinde kalıcı olarak silinecek. Bu tarihe kadar iptal edebilirsin.',
  cancelDeletionBtn: 'Silmeyi iptal et — hesabımı koru',
  cancelledMsg:     'Silme işlemi iptal edildi. Hesabın tamamen geri yüklendi.',
}
