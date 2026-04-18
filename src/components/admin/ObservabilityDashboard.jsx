// ─── src/components/admin/ObservabilityDashboard.jsx — Live observability ─────
// Gated by authProfile.role === 'admin'.
// Panels: system status, queue depths, MV health, today's funnel,
//         recent client errors, operator alerts, deep links to Axiom.
import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { S } from '../../styles.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtRelative(iso) {
  if (!iso) return '—'
  try {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
    if (s < 60)    return `${s}s ago`
    if (s < 3600)  return `${Math.round(s / 60)}m ago`
    if (s < 86400) return `${(s / 3600).toFixed(1)}h ago`
    return `${Math.floor(s / 86400)}d ago`
  } catch { return iso }
}

function StatusDot({ status }) {
  const color = { ok: '#22cc66', degraded: '#ffaa00', down: '#ff4444', unknown: '#555' }[status] ?? '#555'
  return (
    <span
      style={{
        display: 'inline-block', width: '7px', height: '7px',
        borderRadius: '50%', background: color,
        marginRight: '6px', verticalAlign: 'middle',
      }}
      aria-label={status}
    />
  )
}

function SectionHeader({ title, onRefresh, loading }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
      <span style={{ ...S.mono, fontSize: '11px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.12em' }}>
        ◈ {title}
      </span>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{ ...S.mono, fontSize: '9px', padding: '2px 8px', border: '1px solid #333', background: 'transparent', color: loading ? '#555' : '#888', borderRadius: '2px', cursor: 'pointer' }}
        >
          {loading ? '…' : '↻'}
        </button>
      )}
    </div>
  )
}

// ── Panel: System Status ──────────────────────────────────────────────────────
function SystemStatusPanel({ lang }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const tr = (en, tr2) => lang === 'tr' ? tr2 : en

  const load = useCallback(async () => {
    if (!isSupabaseReady()) return
    setLoading(true)
    const { data } = await supabase.rpc('get_system_status')
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv) }, [load])

  return (
    <div style={{ ...S.card, marginBottom: '16px' }}>
      <SectionHeader title={tr('SYSTEM STATUS', 'SİSTEM DURUMU')} onRefresh={load} loading={loading} />
      {rows.map(r => (
        <div key={r.service} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
          <span style={{ ...S.mono, fontSize: '11px', color: '#ccc' }}>
            <StatusDot status={r.status} />{r.service}
          </span>
          <span style={{ ...S.mono, fontSize: '10px', color: r.status === 'ok' ? '#555' : '#ffaa44' }}>
            {r.latency_ms != null ? `${r.latency_ms}ms` : ''} · {fmtRelative(r.checked_at)}
            {r.stale ? ' ⚠ stale' : ''}
          </span>
        </div>
      ))}
      {rows.length === 0 && !loading && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#444' }}>No data</div>
      )}
    </div>
  )
}

// ── Panel: Queue Depths ───────────────────────────────────────────────────────
const QUEUE_SLOS = { ai_batch: 100, strava_backfill: 500, push_fanout: 200, ai_batch_dlq: 1 }
const QUEUES     = ['ai_batch', 'ai_batch_dlq', 'strava_backfill', 'push_fanout', 'embed_backfill']

function QueuePanel({ lang }) {
  const [metrics, setMetrics] = useState([])
  const [loading, setLoading] = useState(false)
  const tr = (en, tr2) => lang === 'tr' ? tr2 : en

  const load = useCallback(async () => {
    if (!isSupabaseReady()) return
    setLoading(true)
    const { data } = await supabase
      .from('queue_metrics')
      .select('queue_name, depth, oldest_age_s, captured_at')
      .in('queue_name', QUEUES)
      .order('captured_at', { ascending: false })
      .limit(QUEUES.length * 3)
    const latest = {}
    for (const r of data ?? []) {
      if (!latest[r.queue_name]) latest[r.queue_name] = r
    }
    setMetrics(QUEUES.map(q => latest[q] ?? { queue_name: q, depth: 0, oldest_age_s: 0, captured_at: null }))
    setLoading(false)
  }, [])

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv) }, [load])

  return (
    <div style={{ ...S.card, marginBottom: '16px' }}>
      <SectionHeader title={tr('QUEUE DEPTHS', 'KUYRUK DERİNLİKLERİ')} onRefresh={load} loading={loading} />
      {metrics.map(m => {
        const slo  = QUEUE_SLOS[m.queue_name]
        const over = slo != null && m.depth >= slo
        return (
          <div key={m.queue_name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
            <span style={{ ...S.mono, fontSize: '11px', color: over ? '#ff6600' : '#ccc' }}>
              {m.queue_name}
            </span>
            <span style={{ ...S.mono, fontSize: '10px', color: over ? '#ff6600' : '#555' }}>
              {m.depth} {slo != null ? `/ SLO ${slo}` : ''}{over ? ' ⚠' : ''} · {fmtRelative(m.captured_at)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Panel: Funnel Metrics ─────────────────────────────────────────────────────
function FunnelPanel({ lang }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const tr = (en, tr2) => lang === 'tr' ? tr2 : en

  const load = useCallback(async () => {
    if (!isSupabaseReady()) return
    setLoading(true)
    const { data } = await supabase.rpc('get_funnel_today')
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ ...S.card, marginBottom: '16px' }}>
      <SectionHeader title={tr("TODAY'S FUNNEL", 'BUGÜNÜN HUNISI')} onRefresh={load} loading={loading} />
      {rows.length === 0 && !loading && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#444' }}>No funnel events today</div>
      )}
      {rows.map(r => (
        <div key={r.step} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #1a1a1a' }}>
          <span style={{ ...S.mono, fontSize: '11px', color: '#ccc' }}>{r.step}</span>
          <span style={{ ...S.mono, fontSize: '11px', color: '#ff6600', fontWeight: 700 }}>{r.count}</span>
        </div>
      ))}
    </div>
  )
}

// ── Panel: Recent Client Errors ───────────────────────────────────────────────
function ErrorsPanel({ lang }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const tr = (en, tr2) => lang === 'tr' ? tr2 : en

  const load = useCallback(async () => {
    if (!isSupabaseReady()) return
    setLoading(true)
    const { data } = await supabase.rpc('get_recent_client_errors', { p_limit: 10 })
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ ...S.card, marginBottom: '16px' }}>
      <SectionHeader title={tr('CLIENT ERRORS (24h)', 'İSTEMCİ HATALARI (24s)')} onRefresh={load} loading={loading} />
      {rows.length === 0 && !loading && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#444' }}>No errors in last 24h ✓</div>
      )}
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #1a1a1a', gap: '8px' }}>
          <span style={{ ...S.mono, fontSize: '10px', color: '#ccc', flex: 1 }}>
            {r.category}/{r.action}
            {r.label ? <span style={{ color: '#555' }}> · {r.label.slice(0, 60)}</span> : null}
          </span>
          <span style={{ ...S.mono, fontSize: '10px', color: '#ff4444', whiteSpace: 'nowrap' }}>
            {r.count}× · {fmtRelative(r.last_at)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Panel: Recent Alerts ──────────────────────────────────────────────────────
function AlertsPanel({ lang }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const tr = (en, tr2) => lang === 'tr' ? tr2 : en

  const load = useCallback(async () => {
    if (!isSupabaseReady()) return
    setLoading(true)
    const { data } = await supabase
      .from('operator_alerts')
      .select('kind, severity, title, fired_at, notified')
      .order('fired_at', { ascending: false })
      .limit(10)
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv) }, [load])

  return (
    <div style={{ ...S.card, marginBottom: '16px' }}>
      <SectionHeader title={tr('RECENT ALERTS', 'SON UYARILAR')} onRefresh={load} loading={loading} />
      {rows.length === 0 && !loading && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#444' }}>No recent alerts ✓</div>
      )}
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a', gap: '8px' }}>
          <span style={{ ...S.mono, fontSize: '10px', flex: 1, color: r.severity === 'critical' ? '#ff4444' : '#ffaa44' }}>
            {r.severity === 'critical' ? '◉' : '◈'} {r.title}
          </span>
          <span style={{ ...S.mono, fontSize: '9px', color: '#555', whiteSpace: 'nowrap' }}>
            {fmtRelative(r.fired_at)}{r.notified ? ' ✓' : ''}
          </span>
        </div>
      ))}
    </div>
  )
}


// ── Main Component ────────────────────────────────────────────────────────────
export default function ObservabilityDashboard({ authProfile, lang = 'en' }) {
  const isAdmin = authProfile?.role === 'admin'
  const tr      = (en, tr2) => lang === 'tr' ? tr2 : en

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
    <div data-testid="observability-dashboard">
      <div style={{ ...S.mono, fontSize: '13px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.12em', marginBottom: '20px' }}>
        ◈ OBSERVABILITY DASHBOARD
      </div>

      <SystemStatusPanel lang={lang} />
      <QueuePanel        lang={lang} />
      <FunnelPanel       lang={lang} />
      <ErrorsPanel       lang={lang} />
      <AlertsPanel       lang={lang} />

      <div style={{ ...S.mono, fontSize: '9px', color: '#333', marginTop: '8px', textAlign: 'center' }}>
        Auto-refreshes every 30–60s
      </div>
    </div>
  )
}
