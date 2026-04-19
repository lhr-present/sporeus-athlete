// src/pages/profile/ConsentCenter.jsx — E8: Granular consent management
// Shows per-purpose consent toggles. Each can be granted/revoked independently.
// Revoking ai_processing stops future AI insight generation for this user.

import { useState, useEffect } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'

const PURPOSES = [
  {
    key:      'analytics',
    en_label: 'Usage Analytics',
    tr_label: 'Kullanım Analitiği',
    en_desc:  'Helps improve the app by tracking how features are used. No personal health data included.',
    tr_desc:  'Özelliklerin nasıl kullanıldığını anlamamıza yardımcı olur. Kişisel sağlık verisi içermez.',
    legal:    'legitimate_interest',
  },
  {
    key:      'ai_processing',
    en_label: 'AI Analysis',
    tr_label: 'AI Analizi',
    en_desc:  'Allows Claude AI to analyse your sessions and generate personalised insights. Your data is sent to Anthropic (see Third-Party Disclosures).',
    tr_desc:  'Claude AI\'ın antrenmanlarını analiz ederek kişiselleştirilmiş içgörüler oluşturmasına izin verir.',
    legal:    'consent',
    sensitive: true,
  },
  {
    key:      'strava_sync',
    en_label: 'Strava Sync',
    tr_label: 'Strava Senkronizasyonu',
    en_desc:  'Enables automatic import of Strava activities. Revoking disconnects Strava and stops future syncs.',
    tr_desc:  'Strava aktivitelerinin otomatik içe aktarılmasını sağlar.',
    legal:    'consent',
  },
  {
    key:      'email_communications',
    en_label: 'Email Communications',
    tr_label: 'E-posta İletişimi',
    en_desc:  'Coaching reminders, weekly summaries, and product updates. Transactional account emails are always sent.',
    tr_desc:  'Antrenman hatırlatmaları, haftalık özetler ve ürün güncellemeleri.',
    legal:    'consent',
  },
  {
    key:      'health_data',
    en_label: 'Health Data Processing',
    tr_label: 'Sağlık Verisi İşleme',
    en_desc:  'Required to store and process HRV, injury records, and mental state data. GDPR Art.9 special-category data. Revoking stops collection of new health-specific fields.',
    tr_desc:  'KVK Kanunu Madde 6 kapsamında özel nitelikli kişisel veri. Kalp ritmi (HRV), sakatlanma ve zihinsel durum verilerinin işlenmesi için gereklidir.',
    legal:    'explicit_consent',
    sensitive: true,
  },
]

export default function ConsentCenter({ userId, lang = 'en' }) {
  const [consents, setConsents]   = useState({})   // { purpose: boolean }
  const [changedAt, setChangedAt] = useState({})   // { purpose: isoString }
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(null)  // purpose key being saved
  const [error, setError]         = useState(null)

  const L = lang === 'tr' ? TR : EN

  useEffect(() => {
    if (!isSupabaseReady() || !userId) { setLoading(false); return }
    supabase
      .from('consent_purposes')
      .select('purpose, granted, changed_at')
      .eq('user_id', userId)
      .then(({ data }) => {
        const map: Record<string, boolean> = {}
        const atMap: Record<string, string> = {}
        if (data) {
          for (const row of data) {
            map[row.purpose]   = row.granted
            atMap[row.purpose] = row.changed_at
          }
        }
        // Default to true for purposes not yet set
        for (const p of PURPOSES) {
          if (!(p.key in map)) map[p.key] = true
        }
        setConsents(map)
        setChangedAt(atMap)
        setLoading(false)
      })
  }, [userId])

  async function toggle(key) {
    const newValue = !consents[key]
    setSaving(key)
    setError(null)
    try {
      const { error: upsertErr } = await supabase
        .from('consent_purposes')
        .upsert({ user_id: userId, purpose: key, granted: newValue, changed_at: new Date().toISOString() },
                 { onConflict: 'user_id,purpose' })
      if (upsertErr) throw new Error(upsertErr.message)
      setConsents(prev => ({ ...prev, [key]: newValue }))
      setChangedAt(prev => ({ ...prev, [key]: new Date().toISOString() }))
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading…</p>

  return (
    <section>
      <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px', color: 'var(--text)' }}>
        {L.title}
      </h3>
      <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
        {L.description}
      </p>

      {PURPOSES.map(p => {
        const label    = lang === 'tr' ? p.tr_label : p.en_label
        const desc     = lang === 'tr' ? p.tr_desc  : p.en_desc
        const granted  = consents[p.key] ?? true
        const isSaving = saving === p.key
        const lastChanged = changedAt[p.key]

        return (
          <div key={p.key} style={{
            borderBottom:  '1px solid var(--border)',
            paddingBottom: '14px',
            marginBottom:  '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                {p.sensitive && (
                  <span style={{ fontSize: '10px', background: '#ff660020', color: '#ff6600',
                                 padding: '1px 5px', borderRadius: '3px' }}>
                    {L.sensitiveTag}
                  </span>
                )}
              </div>
              <button
                role="switch"
                aria-checked={granted}
                aria-label={`${granted ? L.revokeBtn : L.grantBtn} ${label}`}
                onClick={() => toggle(p.key)}
                disabled={isSaving}
                style={{
                  width:        '42px',
                  height:       '22px',
                  borderRadius: '11px',
                  background:   granted ? '#00aa55' : 'var(--surface)',
                  border:       '1px solid var(--border)',
                  cursor:       'pointer',
                  position:     'relative',
                  transition:   'background 0.2s',
                  flexShrink:   0,
                }}
              >
                <span style={{
                  position:   'absolute',
                  top:        '2px',
                  left:       granted ? '21px' : '2px',
                  width:      '16px',
                  height:     '16px',
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>{desc}</p>
            {lastChanged && (
              <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                {L.lastChanged}: {new Date(lastChanged).toLocaleDateString()}
              </p>
            )}
          </div>
        )
      })}

      {error && <p style={{ fontSize: '12px', color: '#ff4444', marginTop: '6px' }}>{error}</p>}

      <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '12px' }}>
        {L.legal}
      </p>
    </section>
  )
}

const EN = {
  title:       'Privacy & Consent',
  description: 'Control how your data is used. Changes take effect immediately. Revoking a consent does not delete existing data — use "Export Your Data" to download it or "Delete Account" to remove it.',
  sensitiveTag:'Health data',
  grantBtn:    'Enable',
  revokeBtn:   'Disable',
  lastChanged: 'Last changed',
  legal:       'Your rights: access, correction, portability, erasure (GDPR Art.17 / KVKK Art.11). Contact privacy@sporeus.com for requests.',
}

const TR = {
  title:       'Gizlilik ve Onay',
  description: 'Verilerinin nasıl kullanıldığını kontrol et. Değişiklikler anında geçerli olur.',
  sensitiveTag:'Sağlık verisi',
  grantBtn:    'Etkinleştir',
  revokeBtn:   'Devre dışı bırak',
  lastChanged: 'Son değişiklik',
  legal:       'KVKK Madde 11 kapsamındaki haklarınız için: privacy@sporeus.com',
}
