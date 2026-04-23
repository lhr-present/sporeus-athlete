// ─── db/coachSessions.js — Data access layer for coach sessions & RSVP ────────

import { supabase, isSupabaseReady } from '../supabase.js'

const ready = () => isSupabaseReady() && !!supabase
const NOT_CONFIGURED = { data: null, error: new Error('Supabase not configured') }

/**
 * Create a new coach-scheduled session.
 * @param {string} coachId
 * @param {{ title: string, session_date: string, session_time?: string, notes?: string, meeting_url?: string, org_id?: string }} sessionData
 */
export async function createSession(coachId, sessionData) {
  if (!ready()) return NOT_CONFIGURED
  return supabase
    .from('coach_sessions')
    .insert({
      coach_id:     coachId,
      title:        sessionData.title,
      session_date: sessionData.session_date,
      session_time: sessionData.session_time || null,
      notes:        sessionData.notes        || null,
      meeting_url:  sessionData.meeting_url  || null,
      org_id:       sessionData.org_id       || null,
    })
    .select()
    .single()
}

/**
 * Fetch upcoming sessions for a coach (next N days, ordered by date asc).
 * @param {string} coachId
 * @param {number} [days=14]
 */
export async function getUpcomingSessions(coachId, days = 14) {
  if (!ready()) return NOT_CONFIGURED
  const today   = new Date().toISOString().slice(0, 10)
  const ceiling = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
  return supabase
    .from('coach_sessions')
    .select('*')
    .eq('coach_id', coachId)
    .gte('session_date', today)
    .lte('session_date', ceiling)
    .order('session_date', { ascending: true })
}

/**
 * Fetch attendance rows for a session, joined with athlete display info.
 * Returns { data: Array<{ athlete_id, status, responded_at }> }
 * @param {string} sessionId
 */
export async function getSessionAttendance(sessionId) {
  if (!ready()) return NOT_CONFIGURED
  return supabase
    .from('session_attendance')
    .select('athlete_id, status, responded_at')
    .eq('session_id', sessionId)
}

/**
 * Aggregate attendance counts for a session.
 * @param {Array<{ status: string }>} rows — rows from getSessionAttendance
 * @returns {{ confirmed: number, declined: number, pending: number, total: number }}
 */
export function aggregateAttendance(rows) {
  const counts = { confirmed: 0, declined: 0, pending: 0 }
  for (const r of rows) {
    if (r.status in counts) counts[r.status]++
  }
  return { ...counts, total: rows.length }
}

/**
 * Upsert an athlete's RSVP for a session.
 * @param {string} sessionId
 * @param {string} athleteId
 * @param {'confirmed'|'declined'|'pending'} status
 */
export async function upsertAttendance(sessionId, athleteId, status) {
  if (!ready()) return NOT_CONFIGURED
  return supabase
    .from('session_attendance')
    .upsert(
      { session_id: sessionId, athlete_id: athleteId, status, responded_at: new Date().toISOString() },
      { onConflict: 'session_id,athlete_id' }
    )
    .select()
    .single()
}
