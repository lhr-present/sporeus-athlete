// ─── StravaConnect — OAuth + sync for Strava (Profile Phase 3.1) ────────────
import { useState, useEffect, useContext } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { isSupabaseReady } from '../../lib/supabase.js'
import {
  getStravaConnection, initiateStravaOAuth, triggerStravaSync,
  disconnectStrava, getRecentStravaActivities, buildStravaSelfTest,
  // v9.90.0 — importStravaActivities + deduplicateByStravaId imports removed
  // alongside the localStorage-token-fallback disable in handleSync. The
  // functions still live in src/lib/strava.js for future revival.
} from '../../lib/strava.js'
import { classifyStravaSync } from '../../lib/athlete/stravaSyncHealth.js'

const SYNC_COLOR = { idle: '#5bc25b', syncing: '#0064ff', error: '#e03030', paused: '#ffa500' }
const SYNC_LABEL = { idle: 'CONNECTED', syncing: 'SYNCING', error: 'ERROR', paused: 'PAUSED' }

export default function StravaConnect({ userId }) {
  const { lang } = useContext(LangCtx)
  const [conn, setConn]             = useState(null)
  const [busy, setBusy]             = useState(false)
  const [loading, setLoading]       = useState(true)
  const [msg, setMsg]               = useState('')
  const [syncResult, setSyncResult] = useState(null) // { synced, total, recent }
  const [confirmDisc, setConfirmDisc] = useState(false)

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
    // v9.90.0 — Local-token fallback DISABLED. The previous branch read
    // `sporeus-strava-token` from localStorage and made direct Strava API
    // calls via importStravaActivities(). Audit (v9.90 auth pass) flagged
    // this as bypassing the edge function's server-side token-refresh logic:
    // if the local token had expired or been revoked, the call silently
    // 401-ed with only "Sync failed" surfaced to the user. Worse, on a
    // shared device a previous user's stale token could trigger a sync the
    // current user didn't intend. The code below is preserved so the
    // direct-import path can be revived later if we add proper token
    // ownership validation and refresh — for now every sync routes through
    // the edge function (which already handles refresh, revocation, and
    // per-user ownership via JWT).
    //
    // const localToken = (() => { try { return localStorage.getItem('sporeus-strava-token') || '' } catch { return '' } })()
    // if (localToken) {
    //   const { entries, error } = await importStravaActivities(localToken, 30)
    //   if (error) { flash(`⚠ Sync failed: ${error.message.slice(0, 200)}`); setBusy(false); return }
    //   try {
    //     const existing = JSON.parse(localStorage.getItem('sporeus_log') || '[]')
    //     const newEntries = deduplicateByStravaId(existing, entries)
    //     const merged = [...existing, ...newEntries].sort((a, b) => a.date.localeCompare(b.date))
    //     localStorage.setItem('sporeus_log', JSON.stringify(merged))
    //     const recent = newEntries.slice(-3).reverse()
    //     setSyncResult({ synced: newEntries.length, total: entries.length, recent })
    //     flash(`✓ Imported ${newEntries.length} new activities (${entries.length} fetched)`, 6000)
    //   } catch (e) { flash(`⚠ Could not save activities: ${e.message}`) }
    //   setBusy(false); return
    // }
    const { data, error } = await triggerStravaSync()
    setBusy(false)
    if (error) {
      flash(`⚠ Sync failed: ${(error.message || 'Unknown error').slice(0, 200)}`)
    } else {
      // Read from training_log (what the edge just wrote) rather than localStorage,
      // which hasn't been re-hydrated yet — otherwise a successful sync showed
      // "No Strava activities found". Falls back to the local read on query error.
      let recent = await getRecentStravaActivities(userId).catch(() => [])
      if (!recent.length) recent = getRecentStravaLocal()
      setSyncResult({ synced: data?.synced ?? 0, total: data?.total ?? 0, recent })
      flash(`✓ Synced ${data?.synced ?? 0} of ${data?.total ?? 0} activities`, 6000)
      getStravaConnection(userId).then(({ data: d }) => setConn(d || null))
    }
  }

  const handleDisconnect = async () => {
    setBusy(true)
    setConfirmDisc(false)
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

  const displayStatus = busy ? 'syncing' : (conn?.sync_status || 'idle')
  // Surface a STALE badge (idle but not synced in days) and a RECONNECT CTA when
  // the connection is failing (e.g. the edge wrote "authorization revoked").
  const health    = conn ? classifyStravaSync(conn) : null
  const isStale   = health?.state === 'stale' && displayStatus !== 'syncing' && displayStatus !== 'error'
  const isFailing = health?.state === 'failing' || displayStatus === 'error'
  const statusLabel = isStale ? 'STALE' : (SYNC_LABEL[displayStatus] || 'CONNECTED')
  const statusColor = isStale ? '#ffa500' : (SYNC_COLOR[displayStatus] || '#5bc25b')

  return (
    <div>
      {conn?.strava_athlete_id ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            {[
              { lbl: 'STATUS',           val: statusLabel, color: statusColor },
              { lbl: 'ATHLETE',          val: conn.provider_athlete_name || conn.strava_athlete_id, color: '#ff6600' },
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

          {isFailing && conn.last_error && (
            <div style={{
              ...S.mono, fontSize: '10px', color: '#e03030',
              background: '#1a0808', border: '1px solid #3a1010',
              borderRadius: '4px', padding: '6px 10px', marginBottom: '10px', lineHeight: 1.5,
            }}>
              ⚠ {conn.last_error}
            </div>
          )}

          <div style={{ ...S.mono, fontSize: '10px', color: '#666', marginBottom: '12px', lineHeight: 1.6 }}>
            Syncs last 30 days · runs, rides, swims · distance + HR in notes · auto-deduplicates
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: syncResult ? '12px' : '0', alignItems: 'center' }}>
            {isFailing && (
              <button
                style={{ ...S.btn, background: '#fc4c02', borderColor: '#fc4c02' }}
                onClick={() => { const res = initiateStravaOAuth(); if (res && res.ok === false) flash(`⚠ ${res.error}`, 6000) }}
                disabled={busy}
              >
                ↻ RECONNECT
              </button>
            )}
            <button style={S.btn} onClick={handleSync} disabled={busy}>
              {busy ? 'SYNCING...' : '↻ SYNC NOW'}
            </button>
            {!confirmDisc ? (
              <button
                style={{ ...S.btnSec, borderColor: '#e03030', color: '#e03030' }}
                onClick={() => setConfirmDisc(true)}
                disabled={busy}
              >
                DISCONNECT
              </button>
            ) : (
              <>
                <span style={{ ...S.mono, fontSize: '10px', color: '#e03030' }}>Disconnect Strava?</span>
                <button
                  style={{ ...S.btnSec, borderColor: '#e03030', color: '#e03030', padding: '6px 10px' }}
                  onClick={handleDisconnect}
                  disabled={busy}
                >
                  CONFIRM
                </button>
                <button
                  style={{ ...S.btnSec, padding: '6px 10px' }}
                  onClick={() => setConfirmDisc(false)}
                  disabled={busy}
                >
                  CANCEL
                </button>
              </>
            )}
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
            {lang === 'tr'
              ? <>Aktiviteleri otomatik içe aktarmak için Strava hesabını bağla. Koşu ve bisiklet aktiviteleri mesafe, KA verisi ve tahmini TSS ile senkronize olur.<br/>Sadece aktivite verini okur — adına asla paylaşım yapmaz.</>
              : <>Connect your Strava account to automatically import activities. Runs and rides sync with distance, HR data, and estimated TSS.<br/>Only reads your activity data — never posts on your behalf.</>}
          </div>
          <button style={{ ...S.btn, background: '#fc4c02', borderColor: '#fc4c02' }} onClick={() => {
            const res = initiateStravaOAuth()
            if (res && res.ok === false) flash(`⚠ ${res.error}`, 6000)
          }}>
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

      {/* Connection self-test — surfaces exactly which prerequisite is missing. */}
      {(() => {
        const isTR = lang === 'tr'
        const ST_LABEL = {
          clientId:    isTR ? 'Strava Client ID'   : 'Strava Client ID',
          redirectUri: isTR ? 'Yönlendirme URI'     : 'Redirect URI',
          auth:        isTR ? 'Giriş yapıldı'        : 'Signed in',
          token:       isTR ? 'Strava bağlı'         : 'Strava connected',
        }
        const ST_HINT = {
          clientId:    isTR ? 'VITE_STRAVA_CLIENT_ID derleme gizli anahtarını ayarla.' : 'Set the VITE_STRAVA_CLIENT_ID build secret.',
          redirectUri: isTR ? 'Strava uygulamanın "Authorization Callback Domain" değeriyle eşleşmeli.' : "Must match your Strava app's Authorization Callback Domain.",
          auth:        isTR ? 'Güvenli token değişimi için giriş yap.' : 'Sign in — required for the secure token exchange.',
          token:       isTR ? "Yukarıdan Strava'ya bağlan." : 'Connect Strava above.',
        }
        const ICON = { ok: ['✓', '#5bc25b'], fail: ['✗', '#e03030'], info: ['ℹ', '#0064ff'], pending: ['○', '#888'] }
        const { checks, allReady } = buildStravaSelfTest({ supabaseReady: isSupabaseReady(), userId, conn })
        return (
          <details style={{ marginTop: '14px' }}>
            <summary style={{ ...S.mono, fontSize: '10px', color: '#888', cursor: 'pointer', letterSpacing: '0.05em' }}>
              {allReady
                ? (isTR ? '▸ BAĞLANTI KENDİ-TESTİ — hazır' : '▸ CONNECTION SELF-TEST — ready')
                : (isTR ? '▸ BAĞLANTI KENDİ-TESTİ — eksik var' : '▸ CONNECTION SELF-TEST — needs setup')}
            </summary>
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {checks.map(c => {
                const [glyph, color] = ICON[c.status] || ICON.pending
                return (
                  <div key={c.key} style={{ ...S.mono, fontSize: '10px', lineHeight: 1.5 }}>
                    <span style={{ color, fontWeight: 700, marginRight: '6px' }}>{glyph}</span>
                    <span style={{ color: '#ccc' }}>{ST_LABEL[c.key]}:</span>{' '}
                    <span style={{ color: '#888', wordBreak: 'break-all' }}>{c.detail}</span>
                    {c.status !== 'ok' && (
                      <div style={{ color: c.status === 'fail' ? '#e03030' : '#888', marginLeft: '18px', marginTop: '2px' }}>
                        {ST_HINT[c.key]}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </details>
        )
      })()}
    </div>
  )
}
