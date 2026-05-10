// ─── reports.js — Client helpers for PDF report generation + retrieval ────────
import { supabase, isSupabaseReady } from './supabase.js'

/**
 * Invoke the generate-report edge function to produce a PDF on-demand.
 * @param {'weekly'|'monthly_squad'|'race_readiness'} kind
 * @param {object} params  Kind-specific params (e.g. { weekStart } for weekly,
 *                         { month, athleteIds } for monthly_squad,
 *                         { raceId } for race_readiness)
 * @returns {Promise<{ signedUrl: string, reportId: string, storagePath: string, expiresAt: string }>}
 */
export async function generateReport(kind, params = {}) {
  // v9.61.0 — Was: manually fetching session via getSession() to attach a
  // Bearer header. getSession() violates the implicit-flow + onAuthStateChange-
  // only auth contract (causes Web Locks contention on iOS/Safari). Use
  // functions.invoke() which auto-attaches the cached auth header — same
  // pattern as inviteUtils.js:115.
  if (!isSupabaseReady()) throw new Error('Supabase not configured')
  const { data, error } = await supabase.functions.invoke('generate-report', {
    body: { kind, params },
  })
  if (error) throw new Error(`generate-report failed: ${error.message || error}`)
  return data
}

/**
 * List generated reports for the authenticated user, optionally filtered by kind.
 * @param {string} userId  The authenticated user's UUID
 * @param {'weekly'|'monthly_squad'|'race_readiness'|null} [kind]
 * @param {number} [limit=20]
 * @returns {Promise<Array<{ id, kind, storage_path, params, created_at, expires_at }>>}
 */
export async function listReports(userId, kind = null, limit = 20) {
  if (!isSupabaseReady()) return []

  let query = supabase
    .from('generated_reports')
    .select('id, kind, storage_path, params, created_at, expires_at')
    .eq('user_id', userId)

  if (kind) query = query.eq('kind', kind)

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

/**
 * Get a short-lived signed URL for downloading a report PDF.
 * @param {string} storagePath  e.g. "{userId}/weekly/2026-04-14.pdf"
 * @param {number} [expiresIn=3600]  Seconds until URL expires (default 1h)
 * @returns {Promise<string>}  The signed URL
 */
export async function getSignedUrl(storagePath, expiresIn = 3600) {
  if (!isSupabaseReady()) throw new Error('Supabase not configured')

  const { data, error } = await supabase.storage
    .from('reports')
    .createSignedUrl(storagePath, expiresIn)

  if (error) throw error
  return data.signedUrl
}

/**
 * Delete a report row and its storage object.
 * Only works if the storage path belongs to the authenticated user.
 * @param {string} reportId   UUID from generated_reports.id
 * @param {string} storagePath
 */
export async function deleteReport(reportId, storagePath) {
  if (!isSupabaseReady()) throw new Error('Supabase not configured')

  const [{ error: storageErr }, { error: dbErr }] = await Promise.all([
    supabase.storage.from('reports').remove([storagePath]),
    supabase.from('generated_reports').delete().eq('id', reportId),
  ])

  if (storageErr) throw storageErr
  if (dbErr) throw dbErr
}
