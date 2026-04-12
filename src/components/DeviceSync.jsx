// ─── DeviceSync.jsx — Open Wearables device management UI (v5.12.0) ──────────
import { useState, useEffect, useCallback } from 'react'
import { getDevices, addDevice, removeDevice, triggerSync } from '../lib/deviceSync.js'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const RED    = '#e03030'

const PROVIDERS = [
  { value: 'garmin',  label: 'Garmin' },
  { value: 'polar',   label: 'Polar' },
  { value: 'suunto',  label: 'Suunto' },
  { value: 'coros',   label: 'COROS' },
  { value: 'wahoo',   label: 'Wahoo' },
  { value: 'oura',    label: 'Oura' },
  { value: 'whoop',   label: 'Whoop' },
  { value: 'other',   label: 'Other' },
]

export default function DeviceSync({ userId }) {
  const [devices, setDevices]     = useState([])
  const [syncing, setSyncing]     = useState(false)
  const [syncMsg, setSyncMsg]     = useState(null)   // { type: 'ok'|'err', text }
  const [showAdd, setShowAdd]     = useState(false)
  const [loading, setLoading]     = useState(true)

  // Add form state
  const [form, setForm] = useState({ provider: 'garmin', label: '', baseUrl: '', token: '' })
  const [formErr, setFormErr] = useState('')
  const [adding, setAdding]   = useState(false)

  const loadDevices = useCallback(async () => {
    setLoading(true)
    const { devices: d } = await getDevices(userId)
    setDevices(d)
    setLoading(false)
  }, [userId])

  useEffect(() => { loadDevices() }, [loadDevices])

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    const { results, synced, error } = await triggerSync()
    setSyncing(false)
    if (error) {
      setSyncMsg({ type: 'err', text: `Sync failed: ${error.message}` })
    } else {
      const safeResults = Array.isArray(results) ? results : []
      const failed = safeResults.filter(r => r.status === 'error')
      if (failed.length > 0) {
        setSyncMsg({ type: 'err', text: `${synced} activities synced. ${failed.length} device(s) failed.` })
      } else {
        setSyncMsg({ type: 'ok', text: `Synced ${synced} activities from ${safeResults.length} device(s).` })
      }
      loadDevices()
    }
    setTimeout(() => setSyncMsg(null), 5000)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setFormErr('')
    if (!form.baseUrl) { setFormErr('Instance URL is required.'); return }
    try {
      const u = new URL(form.baseUrl)
      if (!['https:', 'http:'].includes(u.protocol)) { setFormErr('URL must start with https:// or http://'); return }
    } catch {
      setFormErr('Invalid URL.'); return
    }
    setAdding(true)
    const { error } = await addDevice({ userId, ...form })
    setAdding(false)
    if (error) { setFormErr(error.message); return }
    setForm({ provider: 'garmin', label: '', baseUrl: '', token: '' })
    setShowAdd(false)
    loadDevices()
  }

  async function handleRemove(deviceId) {
    if (!confirm('Remove this device? Existing synced data is kept.')) return
    await removeDevice(deviceId)
    loadDevices()
  }

  function fmtDate(iso) {
    if (!iso) return 'never'
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ fontFamily: MONO, background: '#0f0f0f', border: '1px solid #222', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#ccc', letterSpacing: '0.08em' }}>
          WEARABLE DEVICES <span style={{ color: '#444', fontWeight: 400 }}>(open-wearables)</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSync}
            disabled={syncing || devices.length === 0}
            style={{ fontSize: '10px', padding: '5px 12px', background: ORANGE, border: 'none', borderRadius: '3px', color: '#fff', fontFamily: MONO, fontWeight: 700, cursor: devices.length === 0 ? 'not-allowed' : 'pointer', opacity: syncing ? 0.6 : 1 }}>
            {syncing ? 'SYNCING...' : '↓ SYNC NOW'}
          </button>
          <button
            onClick={() => setShowAdd(v => !v)}
            style={{ fontSize: '10px', padding: '5px 12px', background: 'transparent', border: `1px solid ${ORANGE}`, borderRadius: '3px', color: ORANGE, fontFamily: MONO, cursor: 'pointer' }}>
            {showAdd ? '✕ Cancel' : '+ Add Device'}
          </button>
        </div>
      </div>

      {/* Sync status banner */}
      {syncMsg && (
        <div style={{ fontSize: '10px', padding: '7px 10px', borderRadius: '3px', marginBottom: '12px', background: syncMsg.type === 'ok' ? 'rgba(91,194,91,0.12)' : 'rgba(224,48,48,0.12)', border: `1px solid ${syncMsg.type === 'ok' ? GREEN : RED}`, color: syncMsg.type === 'ok' ? GREEN : RED }}>
          {syncMsg.text}
        </div>
      )}

      {/* Add device form */}
      {showAdd && (
        <form onSubmit={handleAdd} style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '14px', marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', color: '#888', marginBottom: '10px', letterSpacing: '0.06em' }}>ADD OPEN-WEARABLES DEVICE</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>PROVIDER</div>
              <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: '3px', color: '#ccc', fontFamily: MONO, fontSize: '11px', padding: '6px 8px' }}>
                {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>NICKNAME</div>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="My Garmin"
                style={{ width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '1px solid #333', borderRadius: '3px', color: '#ccc', fontFamily: MONO, fontSize: '11px', padding: '6px 8px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>OPEN-WEARABLES INSTANCE URL</div>
            <input value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
              placeholder="https://ow.yourdomain.com"
              required
              style={{ width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '1px solid #333', borderRadius: '3px', color: '#ccc', fontFamily: MONO, fontSize: '11px', padding: '6px 8px' }} />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>API TOKEN (optional)</div>
            <input type="password" value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
              placeholder="Leave blank if no auth required"
              style={{ width: '100%', boxSizing: 'border-box', background: '#1a1a1a', border: '1px solid #333', borderRadius: '3px', color: '#ccc', fontFamily: MONO, fontSize: '11px', padding: '6px 8px' }} />
            <div style={{ fontSize: '9px', color: '#444', marginTop: '4px' }}>Token is encrypted before storage and never returned.</div>
          </div>

          {formErr && <div style={{ fontSize: '10px', color: RED, marginBottom: '8px' }}>{formErr}</div>}

          <button type="submit" disabled={adding}
            style={{ padding: '8px 20px', background: ORANGE, border: 'none', borderRadius: '3px', color: '#fff', fontFamily: MONO, fontSize: '11px', fontWeight: 700, cursor: 'pointer', opacity: adding ? 0.6 : 1 }}>
            {adding ? 'ADDING...' : 'ADD DEVICE'}
          </button>
        </form>
      )}

      {/* Device list */}
      {loading ? (
        <div style={{ fontSize: '10px', color: '#444' }}>Loading devices...</div>
      ) : devices.length === 0 ? (
        <div style={{ fontSize: '10px', color: '#444', lineHeight: 1.6 }}>
          No devices connected. Add a self-hosted{' '}
          <span style={{ color: '#666' }}>open-wearables</span> instance to sync activities automatically.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {devices.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#141414', border: '1px solid #222', borderRadius: '4px', padding: '10px 12px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#ccc', fontWeight: 700 }}>
                  {d.label || d.provider} <span style={{ fontSize: '9px', color: '#555', fontWeight: 400 }}>{d.provider}</span>
                </div>
                <div style={{ fontSize: '9px', color: '#444', marginTop: '3px' }}>
                  {d.base_url} · last sync: {fmtDate(d.last_sync_at)}
                </div>
              </div>
              <button onClick={() => handleRemove(d.id)}
                style={{ background: 'transparent', border: '1px solid #333', borderRadius: '3px', color: '#555', fontFamily: MONO, fontSize: '10px', padding: '4px 8px', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
