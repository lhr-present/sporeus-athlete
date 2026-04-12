// cloudSync.js — Explicit Supabase push/pull helpers
// Distinct from DataContext.useSyncedTable (reactive bidirectional sync).
// Use these for on-demand, imperative sync operations (e.g. bulk export/import).

import { supabase } from './supabase.js'

// ─── pushTable ────────────────────────────────────────────────────────────────
// Upsert rows into a table. Conflict resolution is on the 'id' column.
// @returns {{ error: Error|null }}
export async function pushTable(table, rows) {
  if (!rows?.length) return { error: null }
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
  return { error }
}

// ─── pullTable ────────────────────────────────────────────────────────────────
// Fetch all rows for a user from a table.
// @returns {{ data: Array|null, error: Error|null }}
export async function pullTable(table, userId) {
  if (!userId) return { data: null, error: new Error('No user ID') }
  const { data, error } = await supabase.from(table).select('*').eq('user_id', userId)
  return { data, error }
}

// ─── deleteRow ────────────────────────────────────────────────────────────────
// Delete a single row by primary key.
// @returns {{ error: Error|null }}
export async function deleteRow(table, id) {
  if (!id) return { error: new Error('No row ID') }
  const { error } = await supabase.from(table).delete().eq('id', id)
  return { error }
}

// ─── syncLog ──────────────────────────────────────────────────────────────────
// Push local training log to Supabase, then pull the canonical server state.
// Each log entry is tagged with user_id before upsert.
// @returns {{ data: Array|null, error: Error|null }}
export async function syncLog(log, userId) {
  if (!userId) return { data: null, error: new Error('Not authenticated') }
  const rows = (log || []).map(e => ({ ...e, user_id: userId }))
  const { error: pushErr } = await pushTable('athlete_training_log', rows)
  if (pushErr) return { data: null, error: pushErr }
  return pullTable('athlete_training_log', userId)
}
