// ─── db/teamAnnouncements.js — Coach broadcast announcements ─────────────────
// DB schema: team_announcements(id BIGSERIAL, coach_id UUID, message TEXT≤280,
//            created_at TIMESTAMPTZ, read_by UUID[])
// read_by[] approach: athlete UUIDs who dismissed the announcement are appended
// by the coach-side UPDATE. For athlete-side read tracking we use localStorage
// (athletes lack an UPDATE policy without a dedicated column-level override).

import { supabase, isSupabaseReady } from '../supabase.js'
import { logger } from '../logger.js'

const ready = () => isSupabaseReady() && !!supabase
const NOT_CONFIGURED = { data: null, error: new Error('Supabase not configured') }

const LOCAL_KEY = 'sporeus-announcements-read'

// ── Local read-tracking (no Supabase RLS needed) ──────────────────────────────
/** Return Set of announcement IDs this browser has dismissed. */
function loadLocalRead() {
  try { return new Set(JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')) } catch { return new Set() }
}
/** Mark an announcement ID as read locally. */
export function markLocalRead(id) {
  try {
    const s = loadLocalRead(); s.add(String(id))
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...s]))
  } catch (e) { logger.warn('localStorage:', e.message) }
}
/** Mark all given IDs as read locally. */
export function markAllLocalRead(ids) {
  try {
    const s = loadLocalRead(); ids.forEach(id => s.add(String(id)))
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...s]))
  } catch (e) { logger.warn('localStorage:', e.message) }
}
/** Return array of unread announcement objects (filtering by local dismissed set). */
export function filterUnread(announcements) {
  const read = loadLocalRead()
  return announcements.filter(a => !read.has(String(a.id)))
}

// ── Remote helpers ─────────────────────────────────────────────────────────────
/**
 * Fetch announcements for a given coach, newest first (max 30).
 * Athletes call this with their coach's UUID; coaches call with their own UUID.
 * @param {string} coachId
 * @returns {Promise<{data: Array|null, error: Error|null}>}
 */
export async function getAnnouncements(coachId) {
  if (!ready()) return NOT_CONFIGURED
  if (!coachId) return { data: [], error: null }
  return supabase
    .from('team_announcements')
    .select('id, message, created_at, coach_id')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })
    .limit(30)
}

/**
 * Post a new announcement as a coach.
 * @param {string} coachId
 * @param {string} message  — max 280 chars
 */
export async function postAnnouncement(coachId, message) {
  if (!ready()) return NOT_CONFIGURED
  return supabase
    .from('team_announcements')
    .insert({ coach_id: coachId, message: String(message).slice(0, 280) })
    .select('id, message, created_at, coach_id')
    .single()
}

/**
 * Delete an announcement (coach only, RLS enforces ownership).
 * @param {number|string} id
 */
export async function deleteAnnouncement(id) {
  if (!ready()) return NOT_CONFIGURED
  return supabase.from('team_announcements').delete().eq('id', id)
}
