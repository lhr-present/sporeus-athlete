// ─── ReportsTab.jsx — PDF reports: generate on-demand + download history ──────
import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { generateReport, deleteReport } from '../lib/reports.js'
import { S } from '../styles.js'
import ConfirmModal from './ui/ConfirmModal.jsx'

const KIND_META = {
  weekly: {
    icon: '◈',
    label: 'Weekly Training Report',
    labelTr: 'Haftalık Antrenman Raporu',
    desc: '4-page PDF: metrics, sessions, AI insights, next week focus',
    descTr: '4 sayfa PDF: metrikler, seanslar, AI içgörüleri, sonraki haftanın odağı',
    tier: 'free',
  },
  monthly_squad: {
    icon: '▦',
    label: 'Monthly Squad Report',
    labelTr: 'Aylık Kadro Raporu',
    desc: 'Coach-only: per-athlete detail + summary table (Club tier)',
    descTr: 'Sadece antrenör: sporcu detayı + özet tablosu (Club seviyesi)',
    tier: 'club',
  },
  race_readiness: {
    icon: '▲',
    label: 'Race Readiness Report',
    labelTr: 'Yarış Hazırlık Raporu',
    desc: 'Single-page: readiness score, predicted time, taper plan',
    descTr: 'Tek sayfa: hazırlık skoru, tahmini süre, form planı',
    tier: 'coach',
  },
}

const KIND_ORDER = ['weekly', 'race_readiness', 'monthly_squad']

function fmtDate(iso) {
  try { return iso.slice(0, 10) } catch { return iso }
}

function kindLabel(kind, lang) {
  const m = KIND_META[kind]
  if (!m) return kind
  return lang === 'tr' ? m.labelTr : m.label
}

function kindIcon(kind) {
  return KIND_META[kind]?.icon || '◻'
}

export default function ReportsTab({ authUser, authProfile, lang = 'en' }) {
  const [reports, setReports]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [generating, setGenerating] = useState(null)   // kind string while generating
  const [error, setError]           = useState(null)
  const [success, setSuccess]       = useState(null)   // { kind, url }
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)  // { id, storagePath }

  const tr = (en, tr2) => lang === 'tr' ? tr2 : en

  const loadReports = useCallback(async () => {
    if (!authUser || !isSupabaseReady()) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('generated_reports')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setReports(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [authUser])

  useEffect(() => { loadReports() }, [loadReports])

  const handleGenerate = async (kind) => {
    setError(null)
    setSuccess(null)
    setGenerating(kind)
    try {
      const params = buildDefaultParams(kind)
      const result = await generateReport(kind, params)
      setSuccess({ kind, url: result.signedUrl })
      await loadReports()
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(null)
    }
  }

  const handleDownload = async (storagePath) => {
    setError(null)
    try {
      const { data, error } = await supabase.storage
        .from('reports')
        .createSignedUrl(storagePath, 3600)
      if (error) throw error
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDelete = (reportId, storagePath) => {
    setConfirmDelete({ id: reportId, storagePath })
  }

  const confirmDeleteReport = async () => {
    if (!confirmDelete) return
    const { id, storagePath } = confirmDelete
    setConfirmDelete(null)
    setDeletingId(id)
    try {
      await deleteReport(id, storagePath)
      setReports(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  const tier = authProfile?.subscription_tier || 'free'
  const isCoach = authProfile?.role === 'coach'

  if (!isSupabaseReady() || !authUser) {
    return (
      <div style={{ ...S.card, padding: '20px' }}>
        <div style={{ ...S.mono, fontSize: '11px', color: '#555' }}>
          {tr('Sign in to access reports.', 'Raporlara erişmek için giriş yapın.')}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ ...S.sectionHeader, marginBottom: '20px' }}>
        <span style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.1em' }}>
          ◈ {tr('PDF REPORTS', 'PDF RAPORLAR')}
        </span>
        <span style={{ ...S.mono, fontSize: '9px', color: '#555', marginTop: '4px', display: 'block' }}>
          {tr('Generate on-demand or scheduled automatically.', 'İsteğe bağlı veya otomatik olarak zamanlanmış oluşturun.')}
        </span>
      </div>

      {error && (
        <div style={{ ...S.mono, fontSize: '11px', color: '#c0392b', background: '#1a0a0a', border: '1px solid #4a1a1a', borderRadius: '4px', padding: '8px 12px', marginBottom: '14px' }}>
          ⚠ {error}
        </div>
      )}

      {success && (
        <div style={{ ...S.mono, fontSize: '11px', color: '#2d8c2d', background: '#0a1a0a', border: '1px solid #1a4a1a', borderRadius: '4px', padding: '8px 12px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✓ {tr(`${kindLabel(success.kind, lang)} generated.`, `${kindLabel(success.kind, 'tr')} oluşturuldu.`)}</span>
          <a href={success.url} target="_blank" rel="noopener noreferrer"
            style={{ color: '#ff6600', fontSize: '10px', textDecoration: 'none', border: '1px solid #ff6600', padding: '3px 10px', borderRadius: '3px' }}>
            {tr('Download →', 'İndir →')}
          </a>
        </div>
      )}

      {/* ── Generate CTAs ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ ...S.mono, fontSize: '9px', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
          {tr('Generate Report', 'Rapor Oluştur')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {KIND_ORDER.map(kind => {
            const meta = KIND_META[kind]
            const locked = (meta.tier === 'club' && tier !== 'club') ||
                           (meta.tier === 'coach' && tier === 'free') ||
                           (kind === 'monthly_squad' && !isCoach)
            const busy = generating === kind

            return (
              <div key={kind} style={{ ...S.card, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', opacity: locked ? 0.5 : 1 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ ...S.mono, fontSize: '13px', color: '#ff6600' }}>{meta.icon}</span>
                    <span style={{ ...S.mono, fontSize: '11px', fontWeight: 700, color: 'var(--text)' }}>
                      {lang === 'tr' ? meta.labelTr : meta.label}
                    </span>
                    {meta.tier !== 'free' && (
                      <span style={{ ...S.mono, fontSize: '7px', color: '#888', border: '1px solid #333', borderRadius: '2px', padding: '1px 4px', textTransform: 'uppercase' }}>
                        {meta.tier}
                      </span>
                    )}
                  </div>
                  <div style={{ ...S.mono, fontSize: '9px', color: '#555' }}>
                    {lang === 'tr' ? meta.descTr : meta.desc}
                  </div>
                </div>
                <button
                  onClick={() => !locked && handleGenerate(kind)}
                  disabled={locked || busy}
                  style={{
                    ...S.mono, fontSize: '10px', padding: '6px 14px', borderRadius: '3px',
                    border: locked ? '1px solid #333' : '1px solid #ff6600',
                    background: 'transparent',
                    color: locked ? '#444' : busy ? '#888' : '#ff6600',
                    cursor: locked ? 'default' : 'pointer',
                    whiteSpace: 'nowrap', flexShrink: 0,
                    letterSpacing: '0.06em',
                  }}
                >
                  {busy ? tr('Generating…', 'Oluşturuluyor…') : locked ? tr('Locked', 'Kilitli') : tr('Generate', 'Oluştur')}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Report History ───────────────────────────────────────────────── */}
      <div>
        <div style={{ ...S.mono, fontSize: '9px', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{tr('Report History', 'Rapor Geçmişi')}</span>
          {loading && <span style={{ color: '#555' }}>{tr('Loading…', 'Yükleniyor…')}</span>}
        </div>

        {!loading && reports.length === 0 && (
          <div style={{ ...S.card, padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ ...S.mono, fontSize: '11px', color: '#555', marginBottom: '6px' }}>
              {tr('No reports generated yet.', 'Henüz rapor oluşturulmadı.')}
            </div>
            <div style={{ ...S.mono, color: '#333', fontSize: '9px', lineHeight: 1.7 }}>
              {tr(
                'Your first Weekly Report becomes available after logging sessions in any full calendar week. Generate one above whenever you\'re ready.',
                'İlk Haftalık Raporunuz, herhangi bir takvim haftasında antrenman kaydettikten sonra kullanılabilir hale gelir. Hazır olduğunuzda yukarıdan oluşturun.',
              )}
            </div>
          </div>
        )}

        {reports.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {KIND_ORDER.filter(k => reports.some(r => r.kind === k)).map(kind => {
              const groupRows = reports.filter(r => r.kind === kind)
              return (
                <div key={kind}>
                  {/* Group header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid #222' }}>
                    <span style={{ ...S.mono, fontSize: '10px', color: '#ff6600' }}>{kindIcon(kind)}</span>
                    <span style={{ ...S.mono, fontSize: '10px', fontWeight: 700, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {kindLabel(kind, lang)}
                    </span>
                  </div>
                  {/* Rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {groupRows.map(r => {
                      const expired = new Date(r.expires_at) < new Date()
                      return (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderBottom: '1px solid #1a1a1a' }}>
                          <div style={{ ...S.mono, fontSize: '9px', color: '#666', flex: 1 }}>
                            {fmtDate(r.created_at)}
                          </div>
                          <div style={{ ...S.mono, fontSize: '9px', color: expired ? '#c0392b' : '#555', flex: 1 }}>
                            {expired ? tr('Expired', 'Süresi doldu') : fmtDate(r.expires_at)}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flex: '0 0 auto', justifyContent: 'flex-end' }}>
                            {!expired && (
                              <button
                                onClick={() => handleDownload(r.storage_path)}
                                title={tr('Download PDF', 'PDF İndir')}
                                style={{ ...S.mono, fontSize: '9px', padding: '3px 10px', border: '1px solid #ff6600', background: 'transparent', color: '#ff6600', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                {tr('Download PDF', 'PDF İndir')}
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(r.id, r.storage_path)}
                              disabled={deletingId === r.id}
                              title={tr('Delete', 'Sil')}
                              style={{ ...S.mono, fontSize: '9px', padding: '3px 8px', border: '1px solid #2a0a0a', background: 'transparent', color: '#c0392b', borderRadius: '3px', cursor: 'pointer' }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <ConfirmModal
        open={!!confirmDelete}
        title={tr('Delete this report?', 'Bu raporu sil?')}
        body={tr('This action cannot be undone. The PDF file will be permanently removed.', 'Bu işlem geri alınamaz. PDF dosyası kalıcı olarak silinecektir.')}
        confirmLabel={tr('Delete', 'Sil')}
        cancelLabel={tr('Cancel', 'İptal')}
        dangerous
        onConfirm={confirmDeleteReport}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

// ── Default params for each kind ──────────────────────────────────────────────

function buildDefaultParams(kind) {
  if (kind === 'weekly') {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(today.getDate() + mondayOffset - 7)   // last full week
    const weekStart = monday.toISOString().slice(0, 10)
    return { week_start: weekStart }
  }
  if (kind === 'monthly_squad') {
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return { month }
  }
  if (kind === 'race_readiness') {
    return {}   // edge function will pick the next upcoming race automatically
  }
  return {}
}
