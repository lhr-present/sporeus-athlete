// ─── reports.js — Client helpers for PDF report generation + retrieval ────────
import { supabase, isSupabaseReady } from './supabase.js'
import { safeFetch } from './fetch.js'
import { ENV } from './env.js'

const EDGE_URL = `${ENV.supabaseUrl}/functions/v1/generate-report`

/**
 * Invoke the generate-report edge function to produce a PDF on-demand.
 * @param {'weekly'|'monthly_squad'|'race_readiness'} kind
 * @param {object} params  Kind-specific params (e.g. { weekStart } for weekly,
 *                         { month, athleteIds } for monthly_squad,
 *                         { raceId } for race_readiness)
 * @returns {Promise<{ signedUrl: string, reportId: string, storagePath: string, expiresAt: string }>}
 */
export async function generateReport(kind, params = {}) {
  if (!isSupabaseReady()) throw new Error('Supabase not configured')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await safeFetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ kind, params }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error')
    throw new Error(`generate-report failed (${res.status}): ${text}`)
  }

  return res.json()
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
