// ─── src/components/admin/MVHealth.jsx — MV refresh health panel ──────────────
import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { S } from '../../styles.js'

function fmtRelative(iso) {
  if (!iso) return '—'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const secs = Math.floor(diff / 1000)
    if (secs < 60)   return `${secs}s ago`
    if (secs < 3600) return `${Math.round(secs / 60)}m ago`
    if (secs < 86400) return `${(secs / 3600).toFixed(1)}h ago`
    return `${Math.floor(secs / 86400)}d ago`
  } catch {
    return iso
  }
}

function fmtTime(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString() } catch { return iso }
}

export default function MVHealth({ authProfile, lang = 'en' }) {
  const [rows, setRows]               = useState([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const isAdmin = authProfile?.role === 'admin'
  const tr = (en, tr2) => lang === 'tr' ? tr2 : en

  const loadHealth = useCallback(async () => {
    if (!isSupabaseReady() || !isAdmin) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbErr } = await supabase.rpc('get_mv_health')
      if (dbErr) throw dbErr
      setRows(data || [])
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    loadHealth()
    const iv = setInterval(loadHealth, 60_000)
    return () => clearInterval(iv)
  }, [loadHealth])

  if (!isAdmin) {
    return (
      <div style={{ ...S.card, padding: '16px' }}>
        <div style={{ ...S.mono, fontSize: '11px', color: '#555' }}>
          {tr('Admin access required.', 'Yönetici erişimi gerekli.')}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ ...S.sectionHeader, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.1em' }}>
            ◈ {tr('MV HEALTH', 'MV SAĞLIĞI')}
          </span>
          <button
            onClick={loadHealth}
            disabled={loading}
            style={{ ...S.mono, fontSize: '9px', padding: '3px 10px', border: '1px solid #333', background: 'transparent', color: loading ? '#555' : '#888', borderRadius: '3px', cursor: 'pointer' }}
          >
            {loading ? '…' : '↻ ' + tr('Refresh', 'Yenile')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
          <span style={{ ...S.mono, fontSize: '9px', color: '#444' }}>
            {lastRefresh ? fmtTime(lastRefresh.toISOString()) : tr('Not loaded', 'Yüklenmedi')}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ ...S.mono, fontSize: '11px', color: '#c0392b', background: '#1a0a0a', border: '1px solid #4a1a1a', borderRadius: '4px', padding: '8px 12px', marginBottom: '12px' }}>
          ⚠ {error}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', gap: '8px', padding: '4px 8px', borderBottom: '1px solid #222' }}>
          {[
            tr('VIEW', 'GÖRÜNÜM'),
            tr('LAST REFRESH', 'SON YENILEME'),
            tr('DURATION', 'SÜRE'),
            tr('ROWS', 'SATIR'),
            tr('SIZE', 'BOYUT'),
          ].map((h, i) => (
            <div
              key={i}
              style={{
                ...S.mono,
                fontSize: '7px',
                color: '#555',
                letterSpacing: '0.1em',
                flex: i === 0 ? 3 : i === 1 ? 2 : 1,
                textAlign: i === 0 ? 'left' : 'right',
              }}
            >
              {h}
            </div>
          ))}
        </div>

        {rows.map(row => {
          const durColor = row.duration_ms == null
            ? '#555'
            : row.duration_ms < 1000 ? '#27ae60' : '#ff9900'

          return (
            <div
              key={row.view_name}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderBottom: '1px solid #1a1a1a' }}
            >
              {/* view_name — orange */}
              <div style={{ ...S.mono, fontSize: '10px', color: '#ff6600', flex: 3 }}>
                {row.view_name}
              </div>
              {/* last_refresh — relative time */}
              <div style={{ ...S.mono, fontSize: '9px', color: '#888', flex: 2, textAlign: 'right' }}>
                {fmtRelative(row.last_refresh)}
              </div>
              {/* duration_ms */}
              <div style={{ ...S.mono, fontSize: '11px', color: durColor, flex: 1, textAlign: 'right' }}>
                {row.duration_ms != null ? `${row.duration_ms}ms` : '—'}
              </div>
              {/* row_count */}
              <div style={{ ...S.mono, fontSize: '9px', color: 'var(--text)', flex: 1, textAlign: 'right' }}>
                {row.row_count != null ? Number(row.row_count).toLocaleString() : '—'}
              </div>
              {/* size_pretty */}
              <div style={{ ...S.mono, fontSize: '9px', color: '#555', flex: 1, textAlign: 'right' }}>
                {row.size_pretty || '—'}
              </div>
            </div>
          )
        })}

        {rows.length === 0 && !loading && (
          <div style={{ ...S.mono, fontSize: '10px', color: '#444', padding: '14px 8px' }}>
            {tr('No health data yet. Run SELECT refresh_mv_load(); to seed.', 'Henüz sağlık verisi yok. Başlatmak için SELECT refresh_mv_load(); çalıştırın.')}
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      {lastRefresh && (
        <div style={{ ...S.mono, fontSize: '8px', color: '#333', marginTop: '10px', textAlign: 'right' }}>
          {tr('Loaded', 'Yüklendi')}: {fmtTime(lastRefresh.toISOString())}
        </div>
      )}
    </div>
  )
}
