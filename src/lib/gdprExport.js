// ─── gdprExport.js — GDPR data export + right-to-erasure ─────────────────────
// exportAthleteData(userId) — full structured JSON of all user data
// deleteAthleteData(userId) — soft-delete + gdpr_erasure_log entry

import { supabase, isSupabaseReady } from './supabase.js'
import { clearAllAppData } from './storage/local.js'
import { logAction } from './db/auditLog.js'
import { logger } from './logger.js'

// ─── Table registry ───────────────────────────────────────────────────────────
// Owner key columns verified against the live Supabase schema (information_schema)
// on 2026-06-23. Do NOT assume `user_id` — several tables key differently and a
// wrong key silently returns [] (export) or deletes nothing (delete):
//   • profiles      → PK is `id` (= auth uid), NOT `user_id`
//   • ai_insights   → `athlete_id`, NOT `user_id`
//   • ai_proxy_usage→ `athlete_id`
//   • coach_*/messages → two-party (coach_id + athlete_id)
//   • session_comments → `author_id`
//
// SINGLE_PARTY: rows that are unambiguously the user's OWN data — exported AND
// (unless exportOnly) hard-deleted on erasure. `exportOnly: true` marks records
// with a legal-retention / audit obligation (financial + compliance logs):
// included in the GDPR export, but NOT auto-deleted.
const SINGLE_PARTY = [
  { table: 'training_log',         key: 'user_id' },
  { table: 'recovery',             key: 'user_id' },
  { table: 'injuries',             key: 'user_id' },
  { table: 'test_results',         key: 'user_id' },
  { table: 'race_results',         key: 'user_id' },
  { table: 'push_subscriptions',   key: 'user_id' },
  { table: 'ai_insights',          key: 'athlete_id' },  // (was wrongly user_id → empty export)
  { table: 'ai_feedback',          key: 'user_id' },
  { table: 'ai_proxy_usage',       key: 'athlete_id' },
  { table: 'strava_tokens',        key: 'user_id' },
  { table: 'athlete_devices',      key: 'user_id' },     // Garmin/device tokens (token_enc)
  { table: 'training_plans',       key: 'user_id' },
  { table: 'onboarding_state',     key: 'user_id' },
  // Consent records: exported, but RETAINED on erasure (proof-of-consent obligation —
  // conservative default; flagged for founder to confirm intended retention).
  { table: 'consents',             key: 'user_id', exportOnly: true },
  { table: 'consent_purposes',     key: 'user_id', exportOnly: true },
  { table: 'attribution_events',   key: 'user_id' },
  { table: 'notification_log',     key: 'user_id' },
  { table: 'export_jobs',          key: 'user_id' },
  { table: 'activity_upload_jobs', key: 'user_id' },
  { table: 'insight_embeddings',   key: 'user_id' },
  { table: 'session_embeddings',   key: 'user_id' },
  { table: 'session_views',        key: 'user_id' },
  { table: 'message_reads',        key: 'user_id' },
  { table: 'generated_reports',    key: 'user_id' },
  { table: 'session_attendance',   key: 'athlete_id' },
  { table: 'session_comments',     key: 'author_id' },   // the user's OWN authored comments
  // profiles is the FK parent of most rows above — list it LAST so children are
  // erased first (avoids a RESTRICT failure regardless of the FK delete action).
  { table: 'profiles',             key: 'id' },          // PK = auth uid (was wrongly user_id)
  // exportOnly — legal/financial retention obligation: export yes, auto-delete no.
  { table: 'billing_events',       key: 'user_id',  exportOnly: true },
  { table: 'subscription_events',  key: 'user_id',  exportOnly: true },
  { table: 'audit_log',            key: 'user_id',  exportOnly: true },
  { table: 'data_rights_requests', key: 'user_id',  exportOnly: true },
  { table: 'deletion_requests',    key: 'user_id',  exportOnly: true },
]

// TWO_PARTY: rows where the user is one of two participants (coach OR athlete /
// author). Exported (the user is a data subject in them) but EXPORT-ONLY: never
// auto-deleted, because deleting a row erases the OTHER party's record too and
// the retention scope needs a product/legal decision (see RETURN notes).
const TWO_PARTY = [
  { table: 'coach_notes',  keys: ['coach_id', 'athlete_id'] },
  { table: 'coach_plans',  keys: ['coach_id', 'athlete_id'] },
  { table: 'messages',     keys: ['coach_id', 'athlete_id'] },
]

// Tables hard-deleted on erasure: single-party rows that are NOT exportOnly.
const DELETE_TABLES = SINGLE_PARTY.filter((t) => !t.exportOnly)

// ─── exportAthleteData ────────────────────────────────────────────────────────
// Returns { userId, exportedAt, tables: { tableName: rows[] } }
// Falls back to localStorage for offline/unauthenticated use.
export async function exportAthleteData(userId) {
  if (!userId) throw new Error('userId required')

  const tables = {}

  if (isSupabaseReady()) {
    // Single-party tables: one query, the table's verified owner key.
    for (const { table, key } of SINGLE_PARTY) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq(key, userId)
        tables[table] = error ? [] : (data || [])
      } catch (e) {
        logger.error('db:', e.message)
        tables[table] = []
      }
    }

    // Two-party tables: the user may be EITHER participant — query each key and
    // merge/dedupe by row id (a row can match on only one key, never both for a
    // single user, but dedupe defensively).
    for (const { table, keys } of TWO_PARTY) {
      const seen = new Map()
      for (const key of keys) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq(key, userId)
          if (!error) for (const row of (data || [])) {
            seen.set(row.id ?? `${key}:${seen.size}`, row)
          }
        } catch (e) {
          logger.error('db:', e.message)
        }
      }
      tables[table] = [...seen.values()]
    }
  }

  // Always include localStorage data (training log, profile)
  try {
    const lsLog     = JSON.parse(localStorage.getItem('sporeus_log') || '[]')
    const lsProfile = JSON.parse(localStorage.getItem('sporeus_profile') || '{}')
    const lsRecovery = JSON.parse(localStorage.getItem('sporeus-recovery') || '[]')
    tables._localStorage = { training_log: lsLog, profile: lsProfile, recovery: lsRecovery }
  } catch (e) {
    logger.warn('localStorage:', e.message)
    tables._localStorage = {}
  }

  return {
    userId,
    exportedAt: new Date().toISOString(),
    tables,
  }
}

// ─── deleteAthleteData ────────────────────────────────────────────────────────
// Soft-deletes all rows across USER_TABLES and logs the erasure event.
// Returns { tablesAffected: string[], error: null|Error }
export async function deleteAthleteData(userId) {
  if (!userId) throw new Error('userId required')
  if (!isSupabaseReady()) throw new Error('Supabase not configured')

  const tablesAffected = []

  // Conservative: hard-delete ONLY single-party, non-exportOnly tables, each by
  // its verified owner key. Two-party tables (coach_notes/coach_plans/messages)
  // and exportOnly legal/financial logs are intentionally excluded — see module
  // header + deleteAthleteData return contract.
  for (const { table, key } of DELETE_TABLES) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq(key, userId)
      if (!error) tablesAffected.push(table)
    } catch (e) {
      logger.error('db:', e.message)
    }
  }

  // Log erasure event
  try {
    await supabase.from('gdpr_erasure_log').insert({
      user_id:         userId,
      requested_at:    new Date().toISOString(),
      completed_at:    new Date().toISOString(),
      tables_affected: tablesAffected,
    })
  } catch (e) { logger.error('db:', e.message) }

  // Wipe all app localStorage keys (GDPR client-side erasure)
  clearAllAppData()

  // Audit log: erasure event
  await logAction('erase', 'multiple', userId, tablesAffected)

  return { tablesAffected, error: null }
}

// ─── purgeExpiredData ─────────────────────────────────────────────────────────
// Deletes training log and wellness entries older than retentionDays (default 3yr).
// Called monthly by nightly-batch pg_cron job on the 1st of each month.
// Returns { cutoff: string, results: { [table]: { deleted: number } | { error: string } } }
export async function purgeExpiredData(retentionDays = 1095) {
  if (!isSupabaseReady()) throw new Error('Supabase not configured')
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString().slice(0, 10)
  const purgeTables = ['training_log', 'recovery', 'injuries']
  const results = {}
  for (const table of purgeTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .delete()
        .lt('date', cutoff)
        .select('id')
      results[table] = error ? { error: error.message } : { deleted: (data || []).length }
    } catch (e) {
      results[table] = { error: e?.message ?? 'unknown' }
    }
  }
  // Audit log: purge event
  try {
    await logAction('purge', 'multiple', null, { cutoff, retentionDays })
  } catch (e) { logger.error('db:', e.message) }
  return { cutoff, results }
}

// ─── triggerDownload ──────────────────────────────────────────────────────────
// Utility: prompt browser to download a JSON file.
export function triggerDownload(data, filename = 'sporeus-my-data.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
