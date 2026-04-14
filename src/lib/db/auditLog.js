// ─── auditLog.js — GDPR audit log helpers ────────────────────────────────────
import { supabase } from '../supabase.js'

const NOT_CONFIGURED = { data: null, error: { message: 'Supabase not configured' } }

/**
 * Log a data action to the audit_log table.
 * Silent — never throws or rejects. Returns the insert result for testing.
 * @param {string} action — 'read'|'insert'|'update'|'delete'|'export'|'erase'
 * @param {string} tableName — which DB table was affected
 * @param {string|null} recordId — primary key of affected record (optional)
 * @param {string[]|null} changedFields — list of fields changed (optional)
 * @returns {Promise<{ data, error }>}
 */
export async function logAction(action, tableName, recordId = null, changedFields = null) {
  if (!supabase) return NOT_CONFIGURED
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return { data: null, error: { message: 'Not authenticated' } }

    const row = {
      user_id:        user.id,
      action,
      table_name:     tableName,
      record_id:      recordId ? String(recordId) : null,
      changed_fields: changedFields || null,
      user_agent:     typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 200) : null,
    }

    const result = await supabase.from('audit_log').insert(row).select()
    return result
  } catch (err) {
    // Silent — audit failure must never break the calling feature
    return { data: null, error: { message: err.message } }
  }
}

/**
 * Retrieve the calling user's recent audit log entries.
 * @param {string} userId — must match auth.uid() (RLS enforces this anyway)
 * @param {number} limit — max records to return (default 50)
 * @returns {Promise<{ data, error }>}
 */
export async function getMyAuditLog(userId, limit = 50) {
  if (!supabase) return NOT_CONFIGURED
  return supabase
    .from('audit_log')
    .select('id,action,table_name,record_id,changed_fields,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
}
