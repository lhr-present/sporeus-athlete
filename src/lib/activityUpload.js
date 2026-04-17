// ─── activityUpload.js — Upload raw FIT/GPX files to Supabase Storage ────────
// After client-side parsing in fileImport.js, call uploadActivityFile() to
// archive the raw file and create an activity_upload_jobs audit row.
// Failures are non-fatal: the training log entry is saved regardless.

import { supabase, isSupabaseReady } from './supabase.js'
import { logger } from './logger.js'

const BUCKET = 'activity-uploads'

/**
 * Upload a raw activity file to Storage and insert an audit row.
 * @param {string} userId   — auth.uid()
 * @param {File}   file     — the raw FIT / GPX file object
 * @param {object} meta     — parsed metadata { date, durationMin, tss, distanceM, ... }
 * @param {string} [logEntryId] — training_log row id once saved (optional, can be set later)
 * @returns {Promise<{ path: string|null, error: string|null }>}
 */
export async function uploadActivityFile(userId, file, meta = {}, logEntryId = null) {
  if (!isSupabaseReady() || !userId || !file) {
    return { path: null, error: 'not-ready' }
  }

  const ext  = file.name.split('.').pop().toLowerCase()
  const ts   = Date.now()
  const path = `${userId}/${ts}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  // 1. Upload raw bytes
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (upErr) {
    logger.warn('activityUpload: storage upload failed:', upErr.message)
    return { path: null, error: upErr.message }
  }

  // 2. Audit row
  const { error: dbErr } = await supabase
    .from('activity_upload_jobs')
    .insert({
      user_id:      userId,
      file_path:    path,
      file_name:    file.name,
      file_type:    ['fit', 'gpx', 'csv'].includes(ext) ? ext : 'fit',
      file_size:    file.size,
      status:       'parsed',
      log_entry_id: logEntryId,
      parse_meta:   meta,
    })

  if (dbErr) {
    logger.warn('activityUpload: job row failed:', dbErr.message)
    // Storage upload succeeded — still return path, just note the DB issue
  }

  return { path, error: dbErr?.message || null }
}

/**
 * List recent uploads for the current user.
 * @param {number} limit — max rows (default 20)
 * @returns {Promise<{ data: Array, error: string|null }>}
 */
export async function listActivityUploads(limit = 20) {
  if (!isSupabaseReady()) return { data: [], error: 'not-ready' }

  const { data, error } = await supabase
    .from('activity_upload_jobs')
    .select('id, file_name, file_type, file_size, status, created_at, parse_meta')
    .order('created_at', { ascending: false })
    .limit(limit)

  return { data: data || [], error: error?.message || null }
}
