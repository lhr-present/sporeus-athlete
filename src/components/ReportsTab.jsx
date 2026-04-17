// ─── ReportsTab.jsx — PDF reports: generate on-demand + download history ──────
import { useState, useEffect, useCallback } from 'react'
import { isSupabaseReady } from '../lib/supabase.js'
import { generateReport, listReports, getSignedUrl, deleteReport } from '../lib/reports.js'
import { S } from '../styles.js'

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

  const tr = (en, tr2) => lang === 'tr' ? tr2 : en

  const loadReports = useCallback(async () => {
    if (!authUser || !isSupabaseReady()) return
    setLoading(true)
    try {
      const rows = await listReports(authUser.id, null, 30)
      setReports(rows)
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

  const handleDownload = async (storagePath, label) => {
    setError(null)
    try {
      const url = await getSignedUrl(storagePath, 3600)
      const a = document.createElement('a')
      a.href = url
      a.download = label + '.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDelete = async (reportId, storagePath) => {
    if (!window.confirm(tr('Delete this report?', 'Bu raporu sil?'))) return
    setDeletingId(reportId)
    try {
      await deleteReport(reportId, storagePath)
      setReports(prev => prev.filter(r => r.id !== reportId))
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
          <div style={{ ...S.mono, fontSize: '10px', color: '#444', padding: '16px 0' }}>
            {tr('No reports generated yet.', 'Henüz rapor oluşturulmadı.')}
          </div>
        )}

        {reports.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Table header */}
            <div style={{ display: 'flex', gap: '8px', padding: '4px 8px', borderBottom: '1px solid #222' }}>
              {['TYPE', 'DATE', 'EXPIRES', ''].map((h, i) => (
                <div key={i} style={{ ...S.mono, fontSize: '7px', color: '#555', letterSpacing: '0.1em', flex: i === 3 ? '0 0 80px' : i === 0 ? 2 : 1, textAlign: i === 3 ? 'right' : 'left' }}>
                  {h}
                </div>
              ))}
            </div>

            {reports.map(r => {
              const expired = new Date(r.expires_at) < new Date()
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderBottom: '1px solid #1a1a1a' }}>
                  <div style={{ ...S.mono, fontSize: '10px', color: expired ? '#444' : 'var(--text)', flex: 2, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#ff6600' }}>{kindIcon(r.kind)}</span>
                    <span>{kindLabel(r.kind, lang)}</span>
                  </div>
                  <div style={{ ...S.mono, fontSize: '9px', color: '#666', flex: 1 }}>
                    {fmtDate(r.created_at)}
                  </div>
                  <div style={{ ...S.mono, fontSize: '9px', color: expired ? '#c0392b' : '#555', flex: 1 }}>
                    {expired ? tr('Expired', 'Süresi doldu') : fmtDate(r.expires_at)}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flex: '0 0 80px', justifyContent: 'flex-end' }}>
                    {!expired && (
                      <button
                        onClick={() => handleDownload(r.storage_path, `sporeus-${r.kind}-${fmtDate(r.created_at)}`)}
                        title={tr('Download', 'İndir')}
                        style={{ ...S.mono, fontSize: '9px', padding: '3px 8px', border: '1px solid #333', background: 'transparent', color: '#888', borderRadius: '3px', cursor: 'pointer' }}
                      >
                        ↓
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
        )}
      </div>
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
