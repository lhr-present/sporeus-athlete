// src/pages/profile/DataExport.jsx — E8: GDPR/KVKK self-serve data export
// Requests all user data as a JSON + CSV bundle via export-user-data edge function.
// Delivers a 7-day signed download URL.

import { useState } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'

const STATUS_LABELS = {
  idle:    null,
  pending: 'Preparing your export…',
  running: 'Building export package…',
  ready:   'Your export is ready.',
  failed:  'Export failed. Please try again.',
  rateLimited: 'An export was already requested in the last 24 hours.',
}

export default function DataExport({ lang = 'en' }) {
  const [status, setStatus]     = useState('idle')
  const [signedUrl, setSignedUrl] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [error, setError]       = useState(null)

  async function requestExport() {
    if (status === 'pending' || status === 'running') return
    setStatus('pending')
    setError(null)
    setSignedUrl(null)

    try {
      if (!isSupabaseReady()) throw new Error('Not connected')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await supabase.functions.invoke('export-user-data', {
        method: 'POST',
      })

      if (res.error) throw new Error(res.error.message)
      const body = res.data

      if (body.status === 'ready') {
        setSignedUrl(body.signed_url)
        setExpiresAt(body.expires_at)
        setStatus('ready')
      } else if (['pending', 'running'].includes(body.status)) {
        setStatus('rateLimited')
        if (body.signed_url) {
          setSignedUrl(body.signed_url)
          setStatus('ready')
        }
      } else {
        setStatus('failed')
        setError(body.message || 'Unknown error')
      }
    } catch (e) {
      setStatus('failed')
      setError(e.message)
    }
  }

  const L = lang === 'tr' ? TR : EN

  return (
    <section style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>
        {L.title}
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
        {L.description}
      </p>

      <ul style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px', paddingLeft: '16px' }}>
        {L.includes.map(item => <li key={item}>{item}</li>)}
      </ul>

      {status === 'idle' || status === 'failed' ? (
        <button
          onClick={requestExport}
          style={{
            padding:         '8px 16px',
            background:      '#0064ff',
            color:           '#fff',
            border:          'none',
            borderRadius:    '4px',
            cursor:          'pointer',
            fontSize:        '13px',
            fontFamily:      'inherit',
          }}
        >
          {L.requestBtn}
        </button>
      ) : null}

      {status === 'pending' || status === 'running' ? (
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{STATUS_LABELS[status]}</p>
      ) : null}

      {status === 'rateLimited' ? (
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{STATUS_LABELS.rateLimited}</p>
      ) : null}

      {status === 'ready' && signedUrl ? (
        <div>
          <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '8px' }}>
            {L.readyMsg}
          </p>
          <a
            href={signedUrl}
            download
            style={{
              display:       'inline-block',
              padding:       '8px 16px',
              background:    '#00aa55',
              color:         '#fff',
              borderRadius:  '4px',
              fontSize:      '13px',
              textDecoration:'none',
              marginBottom:  '6px',
            }}
          >
            {L.downloadBtn}
          </a>
          {expiresAt ? (
            <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {L.expires} {new Date(expiresAt).toLocaleDateString()}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p style={{ fontSize: '12px', color: '#ff4444', marginTop: '6px' }}>{error}</p>
      ) : null}

      <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '12px' }}>
        {L.legal}
      </p>
    </section>
  )
}

const EN = {
  title:       'Export Your Data',
  description: 'Download a complete copy of all your data from Sporeus, including training sessions, AI insights, goals, and more.',
  includes:    [
    'Training log (JSON + CSV)',
    'AI insights and analysis history',
    'Coach messages and plans',
    'Test results and race history',
    'Consent records',
  ],
  requestBtn:  'Request Data Export',
  readyMsg:    'Your export package is ready. The link expires in 7 days.',
  downloadBtn: 'Download Export (.json)',
  expires:     'Link expires:',
  legal:       'This is your right under GDPR Article 20 (data portability) and KVKK Article 11. One export per 24 hours.',
}

const TR = {
  title:       'Verilerini İndir',
  description: 'Sporeus\'taki tüm verilerinin — antrenman kayıtları, AI analizleri, hedefler — eksiksiz bir kopyasını indir.',
  includes:    [
    'Antrenman günlüğü (JSON + CSV)',
    'AI analiz geçmişi',
    'Koç mesajları ve planlar',
    'Test sonuçları ve yarış geçmişi',
    'Onay kayıtları',
  ],
  requestBtn:  'Veri İndirme Talebi Oluştur',
  readyMsg:    'Veri paketi hazır. Bağlantı 7 gün geçerlidir.',
  downloadBtn: 'İndir (.json)',
  expires:     'Bağlantı geçerlilik tarihi:',
  legal:       'Bu hak, KVKK Madde 11 ve GDPR Madde 20 kapsamındadır. 24 saatte bir indirme talebi oluşturulabilir.',
}
