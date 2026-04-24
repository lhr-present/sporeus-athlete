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

// ── Panel: Queue Health ───────────────────────────────────────────────────────
const QUEUE_HEALTH_NAMES = [
  'ai_batch', 'push_fanout', 'strava_backfill', 'embed_session',
  'embed_insight', 'parse_activity_q', 'device_sync_q', 'report_gen', 'dlq',
]

function fmtAge(sec) {
  if (!sec || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

function QueueDepthBadge({ count }) {
  let bg, color
  if (count < 10)       { bg = '#0d2b1a'; color = '#22cc66' }
  else if (count <= 50) { bg = '#2b2200'; color = '#ffaa00' }
  else                  { bg = '#2b0a0a'; color = '#ff4444' }
  return (
    <span style={{
      ...{fontFamily: 'IBM Plex Mono, monospace'}, fontSize: '9px', fontWeight: 700,
      background: bg, color, borderRadius: '2px',
      padding: '1px 5px', marginLeft: '6px',
    }}>
      {count < 10 ? 'OK' : count <= 50 ? 'WARN' : 'HIGH'}
    </span>
  )
}

function QueueHealthPanel({ lang }) {
  const [rows, setRows]         = useState(null)   // null = not yet loaded
  const [unavailable, setUnavailable] = useState(false)
  const [loading, setLoading]   = useState(false)
  const tr = (en, tr2) => lang === 'tr' ? tr2 : en

  const load = useCallback(async () => {
    if (!isSupabaseReady()) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_queue_metrics')
      if (error || !data) { setUnavailable(true); setRows([]); setLoading(false); return }
      if (data.length === 0) { setUnavailable(true); setRows([]); setLoading(false); return }
      // Build a map keyed by queue_name; fill gaps with zeroes
      const map = {}
      for (const r of data) map[r.queue_name] = r
      setRows(QUEUE_HEALTH_NAMES.map(q => map[q] ?? { queue_name: q, msg_count: 0, oldest_msg_age_sec: 0 }))
      setUnavailable(false)
    } catch {
      setUnavailable(true)
      setRows([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv) }, [load])

  return (
    <div style={{ ...S.card, marginBottom: '16px' }}>
      <SectionHeader title={tr('QUEUE HEALTH', 'KUYRUK SAĞLIĞI')} onRefresh={load} loading={loading} />
      {unavailable && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#444' }}>
          {tr('Queue metrics unavailable', 'Kuyruk metrikleri kullanılamıyor')}
        </div>
      )}
      {!unavailable && rows && rows.length > 0 && (
        <div>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0 4px', borderBottom: '1px solid #222' }}>
            <span style={{ ...S.mono, fontSize: '9px', color: '#444', flex: 2 }}>{tr('QUEUE', 'KUYRUK')}</span>
            <span style={{ ...S.mono, fontSize: '9px', color: '#444', flex: 1, textAlign: 'right' }}>{tr('DEPTH', 'DERİNLİK')}</span>
            <span style={{ ...S.mono, fontSize: '9px', color: '#444', flex: 1, textAlign: 'right' }}>{tr('OLDEST', 'EN ESKİ')}</span>
            <span style={{ ...S.mono, fontSize: '9px', color: '#444', width: '48px', textAlign: 'right' }}>{tr('STATUS', 'DURUM')}</span>
          </div>
          {rows.map(r => {
            const count = Number(r.msg_count ?? 0)
            const age   = Number(r.oldest_msg_age_sec ?? 0)
            const nameColor = count > 50 ? '#ff4444' : count >= 10 ? '#ffaa00' : '#ccc'
            return (
              <div key={r.queue_name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
                <span style={{ ...S.mono, fontSize: '10px', color: nameColor, flex: 2 }}>{r.queue_name}</span>
                <span style={{ ...S.mono, fontSize: '10px', color: count > 0 ? '#ccc' : '#444', flex: 1, textAlign: 'right' }}>{count}</span>
                <span style={{ ...S.mono, fontSize: '10px', color: '#555', flex: 1, textAlign: 'right' }}>{fmtAge(age)}</span>
                <span style={{ width: '48px', textAlign: 'right' }}>
                  <QueueDepthBadge count={count} />
                </span>
              </div>
            )
          })}
        </div>
      )}
      {!unavailable && rows === null && !loading && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#444' }}>No data</div>
      )}
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


// ── Panel: API Keys ───────────────────────────────────────────────────────────
function ApiKeysPanel({ authProfile, lang }) {
  const [keys, setKeys]             = useState([])
  const [loading, setLoading]       = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [label, setLabel]           = useState('')
  const [creating, setCreating]     = useState(false)
  const [createErr, setCreateErr]   = useState(null)
  const [newKey, setNewKey]         = useState(null)
  const [copied, setCopied]         = useState(false)
  const [revokeId, setRevokeId]     = useState(null) // api_key value pending confirm
  const [revoking, setRevoking]     = useState(false)
  const tr = (en, tr2) => lang === 'tr' ? tr2 : en

  const load = useCallback(async () => {
    if (!isSupabaseReady()) return
    setLoading(true)
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false })
    setKeys(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function maskKey(k) {
    if (!k || k.length <= 6) return '••••••'
    return 'sk-••••' + k.slice(-6)
  }

  async function handleCreate() {
    if (!label.trim()) return
    setCreating(true)
    setCreateErr(null)
    const orgId = authProfile?.id
    const { data, error } = await supabase.rpc('generate_api_key', {
      p_label: label.trim(),
      p_org_id: orgId,
    })
    if (error) {
      setCreateErr(error.message)
      setCreating(false)
      return
    }
    setNewKey(data)
    setLabel('')
    setShowForm(false)
    setCreating(false)
    load()
  }

  async function handleRevoke(apiKey) {
    setRevoking(true)
    await supabase.from('api_keys').delete().eq('api_key', apiKey)
    setRevokeId(null)
    setRevoking(false)
    load()
  }

  function handleCopy() {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{ ...S.card, marginBottom: '16px' }}>
      <SectionHeader title={tr('API KEYS', 'API ANAHTARLARI')} onRefresh={load} loading={loading} />

      {/* New key revealed box */}
      {newKey && (
        <div style={{ background: '#0a1a0a', border: '1px solid #22cc66', borderRadius: '3px', padding: '10px', marginBottom: '10px' }}>
          <div style={{ ...S.mono, fontSize: '10px', color: '#22cc66', marginBottom: '4px' }}>
            {tr('This key will not be shown again', 'Bu anahtar bir daha gösterilmeyecek')}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ ...S.mono, fontSize: '11px', color: '#ccc', wordBreak: 'break-all', flex: 1 }}>{newKey}</span>
            <button
              onClick={handleCopy}
              style={{ ...S.mono, fontSize: '9px', padding: '3px 8px', border: '1px solid #22cc66', background: 'transparent', color: copied ? '#22cc66' : '#888', borderRadius: '2px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {copied ? tr('✓ Copied', '✓ Kopyalandı') : tr('Copy', 'Kopyala')}
            </button>
            <button
              onClick={() => setNewKey(null)}
              style={{ ...S.mono, fontSize: '9px', padding: '3px 6px', border: '1px solid #333', background: 'transparent', color: '#555', borderRadius: '2px', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Key list */}
      {keys.length === 0 && !loading && (
        <div style={{ ...S.mono, fontSize: '10px', color: '#444', marginBottom: '10px' }}>
          {tr('No API keys', 'API anahtarı yok')}
        </div>
      )}
      {keys.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: '4px', padding: '2px 0 4px', borderBottom: '1px solid #222' }}>
            <span style={{ ...S.mono, fontSize: '9px', color: '#444', flex: 3 }}>{tr('KEY', 'ANAHTAR')}</span>
            <span style={{ ...S.mono, fontSize: '9px', color: '#444', flex: 2 }}>{tr('LABEL', 'ETİKET')}</span>
            <span style={{ ...S.mono, fontSize: '9px', color: '#444', flex: 1 }}>{tr('TIER', 'KATEGORİ')}</span>
            <span style={{ ...S.mono, fontSize: '9px', color: '#444', flex: 2 }}>{tr('CREATED', 'OLUŞTURULDU')}</span>
            <span style={{ ...S.mono, fontSize: '9px', color: '#444', width: '80px' }}></span>
          </div>
          {keys.map(row => (
            <div key={row.api_key} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 0', borderBottom: '1px solid #1a1a1a' }}>
              <span style={{ ...S.mono, fontSize: '10px', color: '#666', flex: 3, wordBreak: 'break-all' }}>{maskKey(row.api_key)}</span>
              <span style={{ ...S.mono, fontSize: '10px', color: '#aaa', flex: 2 }}>{row.label ?? '—'}</span>
              <span style={{ ...S.mono, fontSize: '10px', color: '#555', flex: 1 }}>{row.tier}</span>
              <span style={{ ...S.mono, fontSize: '10px', color: '#555', flex: 2 }}>{fmtRelative(row.created_at)}</span>
              <span style={{ width: '80px', textAlign: 'right' }}>
                {revokeId === row.api_key ? (
                  <span style={{ display: 'inline-flex', gap: '4px' }}>
                    <button
                      onClick={() => handleRevoke(row.api_key)}
                      disabled={revoking}
                      style={{ ...S.mono, fontSize: '9px', padding: '2px 5px', border: '1px solid #ff4444', background: 'transparent', color: '#ff4444', borderRadius: '2px', cursor: 'pointer' }}
                    >
                      {tr('Yes', 'Evet')}
                    </button>
                    <button
                      onClick={() => setRevokeId(null)}
                      style={{ ...S.mono, fontSize: '9px', padding: '2px 5px', border: '1px solid #333', background: 'transparent', color: '#555', borderRadius: '2px', cursor: 'pointer' }}
                    >
                      {tr('No', 'Hayır')}
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setRevokeId(row.api_key)}
                    style={{ ...S.mono, fontSize: '9px', padding: '2px 8px', border: '1px solid #333', background: 'transparent', color: '#888', borderRadius: '2px', cursor: 'pointer' }}
                  >
                    {tr('Revoke', 'İptal Et')}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Generate button + inline form */}
      {!showForm ? (
        <button
          onClick={() => { setShowForm(true); setCreateErr(null) }}
          style={{ ...S.mono, fontSize: '10px', padding: '4px 12px', border: '1px solid #ff6600', background: 'transparent', color: '#ff6600', borderRadius: '2px', cursor: 'pointer' }}
        >
          + {tr('Generate new key', 'Yeni anahtar oluştur')}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', background: '#111', border: '1px solid #222', borderRadius: '3px' }}>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder={tr('Key label (e.g. mobile-app)', 'Anahtar etiketi (ör. mobil-uygulama)')}
            style={{ ...S.mono, fontSize: '11px', padding: '5px 8px', background: '#0a0a0a', border: '1px solid #333', color: '#ccc', borderRadius: '2px', outline: 'none' }}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          />
          {createErr && (
            <div style={{ ...S.mono, fontSize: '10px', color: '#ff4444' }}>{createErr}</div>
          )}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={handleCreate}
              disabled={creating || !label.trim()}
              style={{ ...S.mono, fontSize: '10px', padding: '4px 12px', border: '1px solid #ff6600', background: creating ? '#1a0a00' : 'transparent', color: creating ? '#555' : '#ff6600', borderRadius: '2px', cursor: creating ? 'default' : 'pointer' }}
            >
              {creating ? '…' : tr('Create', 'Oluştur')}
            </button>
            <button
              onClick={() => { setShowForm(false); setLabel(''); setCreateErr(null) }}
              style={{ ...S.mono, fontSize: '10px', padding: '4px 10px', border: '1px solid #333', background: 'transparent', color: '#555', borderRadius: '2px', cursor: 'pointer' }}
            >
              {tr('Cancel', 'İptal')}
            </button>
          </div>
        </div>
      )}
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
      <QueueHealthPanel  lang={lang} />
      <FunnelPanel       lang={lang} />
      <ErrorsPanel       lang={lang} />
      <AlertsPanel       lang={lang} />
      <ApiKeysPanel      lang={lang} authProfile={authProfile} />

      <div style={{ ...S.mono, fontSize: '9px', color: '#333', marginTop: '8px', textAlign: 'center' }}>
        Auto-refreshes every 30–60s
      </div>
    </div>
  )
}
