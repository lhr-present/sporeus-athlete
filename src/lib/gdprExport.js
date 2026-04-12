// ─── gdprExport.js — GDPR data export + right-to-erasure ─────────────────────
// exportAthleteData(userId) — full structured JSON of all user data
// deleteAthleteData(userId) — soft-delete + gdpr_erasure_log entry

import { supabase, isSupabaseReady } from './supabase.js'

// Tables that store user data, keyed by user_id
const USER_TABLES = [
  'wellness_logs',
  'sessions',
  'profiles',
  'push_subscriptions',
  'ai_insights',
]

// ─── exportAthleteData ────────────────────────────────────────────────────────
// Returns { userId, exportedAt, tables: { tableName: rows[] } }
// Falls back to localStorage for offline/unauthenticated use.
export async function exportAthleteData(userId) {
  if (!userId) throw new Error('userId required')

  const tables = {}

  if (isSupabaseReady()) {
    for (const table of USER_TABLES) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('user_id', userId)
        tables[table] = error ? [] : (data || [])
      } catch {
        tables[table] = []
      }
    }
  }

  // Always include localStorage data (training log, profile)
  try {
    const lsLog     = JSON.parse(localStorage.getItem('sporeus_log') || '[]')
    const lsProfile = JSON.parse(localStorage.getItem('sporeus_profile') || '{}')
    const lsRecovery = JSON.parse(localStorage.getItem('sporeus-recovery') || '[]')
    tables._localStorage = { training_log: lsLog, profile: lsProfile, recovery: lsRecovery }
  } catch {
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
  const now = new Date().toISOString()

  for (const table of USER_TABLES) {
    try {
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: now })
        .eq('user_id', userId)
        .is('deleted_at', null)  // only touch rows not already deleted
      if (!error) tablesAffected.push(table)
    } catch {
      // Non-fatal — continue with remaining tables
    }
  }

  // Log erasure event
  try {
    await supabase.from('gdpr_erasure_log').insert({
      user_id:         userId,
      requested_at:    now,
      completed_at:    new Date().toISOString(),
      tables_affected: tablesAffected,
    })
  } catch {}

  return { tablesAffected, error: null }
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
