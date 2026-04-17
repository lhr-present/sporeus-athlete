// ─── src/components/admin/QueueStats.jsx — admin-only queue depth panel ───────
import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { S } from '../../styles.js'

const QUEUE_NAMES = [
  'ai_batch', 'ai_batch_dlq', 'strava_backfill',
  'push_fanout', 'embed_backfill', 'ai-session-analysis',
]

function fmtAge(secs) {
  if (!secs || secs === 0) return '—'
  if (secs < 60)   return `${secs}s`
  if (secs < 3600) return `${Math.round(secs / 60)}m`
  return `${(secs / 3600).toFixed(1)}h`
}

function fmtTime(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString() } catch { return iso }
}

export default function QueueStats({ authProfile, lang = 'en' }) {
  const [metrics, setMetrics]         = useState([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const isAdmin = authProfile?.role === 'admin'
  const tr = (en, tr2) => lang === 'tr' ? tr2 : en

  const loadMetrics = useCallback(async () => {
    if (!isSupabaseReady() || !isAdmin) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbErr } = await supabase
        .from('queue_metrics')
        .select('queue_name, depth, oldest_age_s, captured_at')
        .in('queue_name', QUEUE_NAMES)
        .order('captured_at', { ascending: false })
        .limit(QUEUE_NAMES.length * 5)   // last ~5 snapshots per queue

      if (dbErr) throw dbErr

      // Deduplicate: keep latest snapshot per queue_name
      const latestByQueue = {}
      for (const row of data || []) {
        if (!latestByQueue[row.queue_name]) {
          latestByQueue[row.queue_name] = row
        }
      }

      setMetrics(QUEUE_NAMES.map(q =>
        latestByQueue[q] || { queue_name: q, depth: 0, oldest_age_s: 0, captured_at: null }
      ))
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    loadMetrics()
    const iv = setInterval(loadMetrics, 60_000)   // auto-refresh every minute
    return () => clearInterval(iv)
  }, [loadMetrics])

  if (!isAdmin) {
    return (
      <div style={{ ...S.card, padding: '16px' }}>
        <div style={{ ...S.mono, fontSize: '11px', color: '#555' }}>
          {tr('Admin access required.', 'Yönetici erişimi gerekli.')}
        </div>
      </div>
    )
  }

  const totalDepth = metrics.reduce((s, m) => s + (m.depth || 0), 0)
  const dlqDepth   = metrics.find(m => m.queue_name === 'ai_batch_dlq')?.depth || 0

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ ...S.sectionHeader, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.1em' }}>
            ▦ {tr('QUEUE STATS', 'KUYRUK İSTATİSTİKLERİ')}
          </span>
          <button
            onClick={loadMetrics}
            disabled={loading}
            style={{ ...S.mono, fontSize: '9px', padding: '3px 10px', border: '1px solid #333', background: 'transparent', color: loading ? '#555' : '#888', borderRadius: '3px', cursor: 'pointer' }}
          >
            {loading ? '…' : '↻ ' + tr('Refresh', 'Yenile')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
          <span style={{ ...S.mono, fontSize: '9px', color: '#555' }}>
            {tr('Total depth:', 'Toplam derinlik:')} <span style={{ color: totalDepth > 0 ? '#ff6600' : '#555' }}>{totalDepth}</span>
          </span>
          {dlqDepth > 0 && (
            <span style={{ ...S.mono, fontSize: '9px', color: '#c0392b' }}>
              ⚠ DLQ: {dlqDepth}
            </span>
          )}
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
          {[tr('QUEUE', 'KUYRUK'), tr('DEPTH', 'DERİNLİK'), tr('OLDEST', 'EN ESKİ'), tr('UPDATED', 'GÜNCELLEME')].map((h, i) => (
            <div key={i} style={{ ...S.mono, fontSize: '7px', color: '#555', letterSpacing: '0.1em', flex: i === 0 ? 3 : 1, textAlign: i === 0 ? 'left' : 'right' }}>
              {h}
            </div>
          ))}
        </div>

        {metrics.map(m => {
          const isDlq      = m.queue_name.includes('dlq')
          const depthColor = isDlq && m.depth > 0
            ? '#c0392b'
            : m.depth > 100 ? '#ff9900'
            : m.depth > 10  ? '#ff6600'
            : m.depth > 0   ? 'var(--text)'
            : '#444'

          return (
            <div key={m.queue_name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ ...S.mono, fontSize: '10px', color: 'var(--text)', flex: 3, display: 'flex', alignItems: 'center', gap: '6px' }}>
                {m.queue_name}
                {isDlq && m.depth > 0 && (
                  <span style={{ ...S.mono, fontSize: '7px', color: '#c0392b', border: '1px solid #4a1a1a', borderRadius: '2px', padding: '1px 4px' }}>
                    DLQ
                  </span>
                )}
              </div>
              <div style={{ ...S.mono, fontSize: '11px', fontWeight: m.depth > 0 ? 700 : 400, color: depthColor, flex: 1, textAlign: 'right' }}>
                {m.depth}
              </div>
              <div style={{ ...S.mono, fontSize: '9px', color: m.oldest_age_s > 3600 ? '#ff9900' : '#555', flex: 1, textAlign: 'right' }}>
                {fmtAge(m.oldest_age_s)}
              </div>
              <div style={{ ...S.mono, fontSize: '9px', color: '#444', flex: 1, textAlign: 'right' }}>
                {fmtTime(m.captured_at)}
              </div>
            </div>
          )
        })}

        {metrics.length === 0 && !loading && (
          <div style={{ ...S.mono, fontSize: '10px', color: '#444', padding: '14px 8px' }}>
            {tr('No metrics yet. Refreshed every 5 min by pg_cron.', 'Henüz metrik yok. pg_cron tarafından her 5 dakikada güncellenir.')}
          </div>
        )}
      </div>
    </div>
  )
}
