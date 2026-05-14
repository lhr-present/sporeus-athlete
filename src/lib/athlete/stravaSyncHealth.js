// src/lib/athlete/stravaSyncHealth.js
//
// v9.132.0 — Strava sync health classifier.
//
// StravaConnect (Profile → connections) shows per-user sync status,
// but the athlete only sees it if they navigate there. A broken sync
// can sit silent for days while the athlete trains, logs sessions
// elsewhere, and wonders why their imports stopped. CLAUDE.md
// "Known Limitations" calls this out: "if the edge function crashes,
// user must retry" — and currently they have to *know* to retry.
//
// This module classifies the strava_tokens row into a health state
// the daily view can act on:
//   - healthy: synced within last 2 days, sync_status='idle'/'syncing'
//   - stale:   no error but last_sync_at is >=2 days old
//   - failing: sync_status='error' OR last_error present within
//              the most recent updated_at window
//   - disconnected: no row exists (or no connection record passed in)
//
// Pure function — no I/O. The caller fetches via getStravaConnection
// and passes the row in.

const MS_PER_DAY = 86400000

/**
 * @description Days since the connection's `last_sync_at`. Returns
 *   Infinity when no last_sync_at value is present.
 */
function daysSinceSync(lastSyncAt, refMs) {
  if (!lastSyncAt) return Infinity
  const t = new Date(lastSyncAt).getTime()
  if (Number.isNaN(t)) return Infinity
  return Math.floor((refMs - t) / MS_PER_DAY)
}

/**
 * @description Stale threshold in days. Strava syncs are nominally
 *   daily; >=2 days is the earliest we can be reasonably sure a sync
 *   didn't fire vs. simply running this morning before today's ride.
 */
export const STRAVA_STALE_DAYS = 2

/**
 * @description Classify a Strava connection row.
 *
 * @param {Object|null} conn   - row from getStravaConnection or null
 * @param {string}      [now]  - 'YYYY-MM-DD' or ISO timestamp; defaults to now
 * @returns {{
 *   state:               'healthy' | 'stale' | 'failing' | 'disconnected',
 *   daysSinceLastSync:   number | null,
 *   lastError:           string | null,
 *   actionable:          boolean,
 *   summary:             { en: string, tr: string } | null,
 * }}
 */
export function classifyStravaSync(conn, now) {
  const refMs = now ? new Date(now).getTime() : Date.now()
  if (!conn) {
    return {
      state: 'disconnected',
      daysSinceLastSync: null,
      lastError: null,
      actionable: false,  // not "broken" — just absent; nothing to surface
      summary: null,
    }
  }

  const status = String(conn.sync_status || '').toLowerCase()
  const lastError = conn.last_error ? String(conn.last_error) : null
  const dSince = daysSinceSync(conn.last_sync_at, refMs)

  // Failing — explicit error state takes precedence over staleness
  if (status === 'error' || (lastError && status !== 'syncing')) {
    return {
      state: 'failing',
      daysSinceLastSync: Number.isFinite(dSince) ? dSince : null,
      lastError,
      actionable: true,
      summary: {
        en: `Strava sync is failing${lastError ? ` (${lastError.slice(0, 80)})` : ''}. Re-authenticate or trigger a manual sync from Profile.`,
        tr: `Strava senkronu hata veriyor${lastError ? ` (${lastError.slice(0, 80)})` : ''}. Profil'den yeniden bağlan veya manuel senkron çalıştır.`,
      },
    }
  }

  // Stale — no error, but last sync is old
  if (dSince >= STRAVA_STALE_DAYS) {
    return {
      state: 'stale',
      daysSinceLastSync: Number.isFinite(dSince) ? dSince : null,
      lastError: null,
      actionable: true,
      summary: {
        en: `Last Strava sync was ${dSince} ${dSince === 1 ? 'day' : 'days'} ago. Trigger a sync from Profile if you expect newer activities.`,
        tr: `Son Strava senkronu ${dSince} gün önce. Yeni aktivite bekliyorsan Profil'den senkron çalıştır.`,
      },
    }
  }

  // Healthy — recent sync, no error
  return {
    state: 'healthy',
    daysSinceLastSync: Number.isFinite(dSince) ? dSince : null,
    lastError: null,
    actionable: false,
    summary: null,
  }
}
