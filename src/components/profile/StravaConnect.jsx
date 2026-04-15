// ─── StravaConnect — OAuth + sync for Strava (Profile Phase 3.1) ────────────
import { useState, useEffect } from 'react'
import { S } from '../../styles.js'
import { isSupabaseReady } from '../../lib/supabase.js'
import {
  getStravaConnection, initiateStravaOAuth, triggerStravaSync,
  disconnectStrava, importStravaActivities, deduplicateByStravaId,
} from '../../lib/strava.js'

export default function StravaConnect({ userId }) {
  const [conn, setConn]             = useState(null)
  const [busy, setBusy]             = useState(false)
  const [loading, setLoading]       = useState(true)
  const [msg, setMsg]               = useState('')
  const [syncResult, setSyncResult] = useState(null) // { synced, total, recent }

  useEffect(() => {
    if (!userId || !isSupabaseReady()) { setLoading(false); return }
    getStravaConnection(userId).then(({ data }) => {
      setConn(data || null)
      setLoading(false)
    })
  }, [userId])

  const getRecentStravaLocal = () => {
    try {
      const log = JSON.parse(localStorage.getItem('sporeus_log') || '[]')
      return log
        .filter(e => e.source === 'strava')
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3)
    } catch { return [] }
  }

  const flash = (text, ms = 4000) => {
    setMsg(text)
    setTimeout(() => setMsg(''), ms)
  }

  const handleSync = async () => {
    setBusy(true)
    setSyncResult(null)
    const localToken = (() => { try { return localStorage.getItem('sporeus-strava-token') || '' } catch { return '' } })()
    if (localToken) {
      const { entries, error } = await importStravaActivities(localToken, 30)
      if (error) {
        flash(`⚠ Sync failed: ${error.message.slice(0, 200)}`)
        setBusy(false)
        return
      }
      try {
        const existing = JSON.parse(localStorage.getItem('sporeus_log') || '[]')
        const newEntries = deduplicateByStravaId(existing, entries)
        const merged = [...existing, ...newEntries].sort((a, b) => a.date.localeCompare(b.date))
        localStorage.setItem('sporeus_log', JSON.stringify(merged))
        const recent = newEntries.slice(-3).reverse()
        setSyncResult({ synced: newEntries.length, total: entries.length, recent })
        flash(`✓ Imported ${newEntries.length} new activities (${entries.length} fetched)`, 6000)
      } catch (e) {
        flash(`⚠ Could not save activities: ${e.message}`)
      }
      setBusy(false)
      return
    }
    const { data, error } = await triggerStravaSync()
    setBusy(false)
    if (error) {
      flash(`⚠ Sync failed: ${(error.message || 'Unknown error').slice(0, 200)}`)
    } else {
      const recent = getRecentStravaLocal()
      setSyncResult({ synced: data?.synced ?? 0, total: data?.total ?? 0, recent })
      flash(`✓ Synced ${data?.synced ?? 0} of ${data?.total ?? 0} activities`, 6000)
      getStravaConnection(userId).then(({ data: d }) => setConn(d || null))
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Strava? Existing synced activities stay in your training log.')) return
    setBusy(true)
    await disconnectStrava()
    setConn(null)
    setSyncResult(null)
    setBusy(false)
    flash('Strava disconnected')
  }

  if (!isSupabaseReady()) return (
    <div style={{ ...S.mono, fontSize: '11px', color: '#888' }}>
      Strava sync requires Supabase. Configure VITE_SUPABASE_URL to enable.
    </div>
  )

  if (loading) return <div style={{ ...S.mono, fontSize: '11px', color: '#888' }}>Checking connection...</div>

  return (
    <div>
      {conn?.strava_athlete_id ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
            {[
              { lbl: 'STATUS',           val: 'CONNECTED',              color: '#5bc25b' },
              { lbl: 'ATHLETE ID',       val: conn.strava_athlete_id,   color: '#ff6600' },
              { lbl: 'LAST SYNC',        val: conn.last_sync_at
                ? new Date(conn.last_sync_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : 'Never',                                               color: '#e0e0e0' },
              { lbl: 'LOCAL ACTIVITIES', val: (() => {
                  try { return JSON.parse(localStorage.getItem('sporeus_log') || '[]').filter(e => e.source === 'strava').length }
                  catch { return 0 }
                })(),                                                    color: '#e0e0e0' },
            ].map(({ lbl, val, color }) => (
              <div key={lbl} style={{ background: '#0a0a0a', borderRadius: '4px', padding: '8px 10px' }}>
                <div style={{ ...S.mono, fontSize: '8px', color: '#555', letterSpacing: '0.08em', marginBottom: '3px' }}>{lbl}</div>
                <div style={{ ...S.mono, fontSize: '12px', fontWeight: 700, color }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ ...S.mono, fontSize: '10px', color: '#666', marginBottom: '12px', lineHeight: 1.6 }}>
            Syncs last 30 days · runs, rides, swims · distance + HR in notes · auto-deduplicates
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: syncResult ? '12px' : '0' }}>
            <button style={S.btn} onClick={handleSync} disabled={busy}>
              {busy ? 'SYNCING...' : '↻ SYNC NOW'}
            </button>
            <button style={{ ...S.btnSec, borderColor: '#e03030', color: '#e03030' }}
              onClick={handleDisconnect} disabled={busy}>
              DISCONNECT
            </button>
          </div>

          {syncResult && syncResult.recent.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ ...S.mono, fontSize: '9px', color: '#555', letterSpacing: '0.08em', marginBottom: '6px' }}>
                LAST {syncResult.recent.length} STRAVA ACTIVITIES IN LOG
              </div>
              {syncResult.recent.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '5px 8px', background: '#0a0a0a', borderRadius: '3px', marginBottom: '4px',
                  ...S.mono, fontSize: '10px',
                }}>
                  <span style={{ color: '#888' }}>{a.date}</span>
                  <span style={{ color: '#e0e0e0' }}>{a.type}</span>
                  <span style={{ color: '#ff6600' }}>{a.duration} min</span>
                  <span style={{ color: '#888' }}>TSS {a.tss}</span>
                </div>
              ))}
            </div>
          )}
          {syncResult && syncResult.recent.length === 0 && (
            <div style={{ ...S.mono, fontSize: '10px', color: '#888', marginTop: '8px' }}>
              No Strava activities found in last 30 days.
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ ...S.mono, fontSize: '11px', color: '#888', marginBottom: '12px', lineHeight: 1.7 }}>
            Connect your Strava account to automatically import activities.
            Runs and rides sync with distance, HR data, and estimated TSS.
            <br/>Only reads your activity data — never posts on your behalf.
          </div>
          <button style={{ ...S.btn, background: '#fc4c02', borderColor: '#fc4c02' }} onClick={initiateStravaOAuth}>
            Connect Strava
          </button>
        </>
      )}
      {msg && (
        <div style={{ ...S.mono, fontSize: '11px', marginTop: '10px',
          color: msg.startsWith('⚠') ? '#e03030' : '#5bc25b' }}>
          {msg}
        </div>
      )}
    </div>
  )
}
