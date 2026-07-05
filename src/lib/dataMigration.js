// ─── dataMigration.js — localStorage → Supabase migration ───────────────────
// Detects existing local data and batch-upserts it into Supabase.
// Safe to call multiple times; uses 'sporeus-migrated' flag to skip if done.

import { supabase } from './supabase.js'
import { logger } from './logger.js'
// v9.468 — reuse the canonical training_log mapper so migrated guest entries
// keep their metric/enrichment fields (distanceM/avgHR/avgCadence/np/
// decouplingPct/…). The old hand-built row silently dropped all of them.
// Cycle-free: nothing in useSupabaseData's import graph imports this file.
import { logEntryToRow } from '../hooks/useSupabaseData.js'

const MIGRATED_KEY = 'sporeus-migrated'

function readLS(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}

// Record a per-table migration error: log it (so Sentry gets per-table context
// as it happens) AND collect it for the single end-of-run throw the UI reads.
function recordErr(errors, label, error) {
  logger.warn(`[dataMigration] ${label}:`, error.message)
  errors.push(`${label}: ${error.message}`)
}

// ─── detectLocalData ─────────────────────────────────────────────────────────
// Returns counts of local data per table. Returns null if already migrated.
export function detectLocalData() {
  if (localStorage.getItem(MIGRATED_KEY) === '1') return null

  const log          = readLS('sporeus_log', [])
  const recovery     = readLS('sporeus-recovery', [])
  const injuries     = readLS('sporeus-injuries', [])
  const testResults  = readLS('sporeus-test-results', [])
  const raceResults  = readLS('sporeus-race-results', [])
  const trainingAge  = localStorage.getItem('sporeus-training-age')
  const profileData  = readLS('sporeus_profile', {})

  const total = log.length + recovery.length + injuries.length + testResults.length + raceResults.length

  if (total === 0 && !trainingAge && Object.keys(profileData).length === 0) return null   // nothing to migrate

  return {
    log:         log.length,
    recovery:    recovery.length,
    injuries:    injuries.length,
    testResults: testResults.length,
    raceResults: raceResults.length,
    trainingAge: trainingAge || null,
    total,
  }
}

// ─── migrateToSupabase ────────────────────────────────────────────────────────
// Reads all localStorage keys and upserts into Supabase.
// onProgress(step, total) — called after each batch.
export async function migrateToSupabase(userId, onProgress) {
  if (!supabase || !userId) throw new Error('Supabase not ready or no userId')

  const log         = readLS('sporeus_log', [])
  const recovery    = readLS('sporeus-recovery', [])
  const injuries    = readLS('sporeus-injuries', [])
  const testResults = readLS('sporeus-test-results', [])
  const raceResults = readLS('sporeus-race-results', [])

  let step = 0
  const profileData  = readLS('sporeus_profile', {})
  const hasProfile   = Object.keys(profileData).length > 0

  const steps = [
    log.length > 0,
    recovery.length > 0,
    injuries.length > 0,
    testResults.length > 0,
    raceResults.length > 0,
    hasProfile,
  ].filter(Boolean).length || 1

  const errors = []

  // ── training_log ─────────────────────────────────────────────────────────
  if (log.length > 0) {
    // v9.468 — canonical mapper (was a hand-built subset that dropped
    // distance/HR/cadence/np/decoupling/enrichment fields for migrating
    // guests). logEntryToRow hardcodes source:'manual', which is exactly what
    // the v9.360 idempotency cleanup below matches; uuid entry ids pass
    // through (server keeps the local id — strictly better for later edits),
    // legacy numeric ids are omitted so gen_random_uuid() fills them.
    const mapped = log.filter(e => e && typeof e === 'object' && e.date).map(e => ({
      ...logEntryToRow(e, userId),
      // Force 'manual' regardless of the entry's origin: the v9.360 retry-
      // cleanup guard deletes source='manual' rows before re-inserting — a
      // preserved 'fit'/'strava' source would escape it and double on Retry.
      source: 'manual',
    }))
    // v9.472 (audit MED-4) — PostgREST builds the INSERT column list from the
    // union of keys; logEntryToRow includes `id` only for uuid ids, so a batch
    // mixing uuid and non-uuid entry ids would send id=null for the latter →
    // 23502, whole batch fails, migration permanently stuck. Uniform keys:
    // drop `id` from every row unless ALL rows have one.
    const allHaveId = mapped.every(r => 'id' in r)
    const rows = allHaveId ? mapped : mapped.map(({ id: _id, ...rest }) => rest)
    // v9.340.0 — Use insert(), not upsert(onConflict:'user_id,date,source'):
    // no matching unique constraint exists (only PK(id) + (user_id,external_id)),
    // and a (user_id,date,source) constraint would collapse two-a-days. Migrated
    // rows have no id (gen_random_uuid default).
    //
    // v9.360.0 — Idempotency guard for RETRIES. Errors are collected and thrown
    // at the end; if any step fails after training_log inserted, MIGRATED_KEY is
    // never set and the user's Retry re-inserts the log → DOUBLED history (no
    // dedup constraint; fresh ids each time). Clear this migration's own row
    // class first. The account is fresh post-signup (MigrationModal blocks other
    // input), so source='manual' rows can only be from a prior aborted attempt.
    // If the cleanup fails, skip the insert this run (retry will redo both) so we
    // never insert on top of un-cleared rows.
    const { error: cleanupErr } = await supabase.from('training_log')
      .delete().match({ user_id: userId, source: 'manual' })
    if (cleanupErr) {
      recordErr(errors, 'training_log cleanup', cleanupErr)
    } else {
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from('training_log').insert(rows.slice(i, i + 100))
        if (error) recordErr(errors, `training_log batch ${i / 100}`, error)
      }
    }
    onProgress?.(++step, steps)
  }

  // ── recovery ─────────────────────────────────────────────────────────────
  if (recovery.length > 0) {
    const rows = recovery.map(e => ({
      user_id:   userId,
      date:      e.date,
      score:     parseFloat(e.score)    || null,
      sleep_hrs: parseFloat(e.sleepHrs) || null,
      sleep:     parseInt(e.sleep)      || null,
      soreness:  parseInt(e.soreness)   || null,
      energy:    parseInt(e.energy)     || null,
      stress:    parseInt(e.stress)     || null,
      mood:      parseInt(e.mood)       || null,
      hrv:       parseFloat(e.hrv)      || null,
      notes:     e.notes || null,
    }))
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from('recovery').upsert(rows.slice(i, i + 100), { onConflict: 'user_id,date' })
      if (error) recordErr(errors, `recovery batch ${i / 100}`, error)
    }
    onProgress?.(++step, steps)
  }

  // ── injuries ──────────────────────────────────────────────────────────────
  if (injuries.length > 0) {
    const rows = injuries.map(e => ({
      user_id: userId,
      zone:    e.zone || 'unknown',
      date:    e.date,
      level:   parseInt(e.level) || null,
      type:    e.type  || null,
      notes:   e.notes || null,
    }))
    // v9.434.0 — Idempotency guard for RETRIES (mirrors training_log :103). These
    // rows omit `id` and the upsert has no onConflict (PK is gen_random_uuid), so
    // it behaves as a plain INSERT — a partial-migration Retry would DOUBLE the
    // user's injury history. The account is fresh post-signup (MigrationModal
    // blocks other input), so clearing this user's own rows first is safe +
    // idempotent. If cleanup fails, skip the insert so we never insert on top of
    // un-cleared rows (the retry redoes both).
    const { error: cleanupErr } = await supabase.from('injuries').delete().match({ user_id: userId })
    if (cleanupErr) {
      recordErr(errors, 'injuries cleanup', cleanupErr)
    } else {
      const { error } = await supabase.from('injuries').upsert(rows)
      if (error) recordErr(errors, 'injuries', error)
    }
    onProgress?.(++step, steps)
  }

  // ── test_results ──────────────────────────────────────────────────────────
  if (testResults.length > 0) {
    const rows = testResults.map(e => ({
      user_id: userId,
      date:    e.date,
      test_id: e.testId || e.test_id || 'unknown',
      value:   String(e.value),
      unit:    e.unit || null,
    }))
    // v9.434.0 — Idempotency guard for RETRIES (see injuries above; no onConflict
    // + id-less rows = plain INSERT → doubled history on Retry).
    const { error: cleanupErr } = await supabase.from('test_results').delete().match({ user_id: userId })
    if (cleanupErr) {
      recordErr(errors, 'test_results cleanup', cleanupErr)
    } else {
      const { error } = await supabase.from('test_results').upsert(rows)
      if (error) recordErr(errors, 'test_results', error)
    }
    onProgress?.(++step, steps)
  }

  // ── race_results ──────────────────────────────────────────────────────────
  if (raceResults.length > 0) {
    const rows = raceResults.map(e => ({
      user_id:     userId,
      date:        e.date,
      distance_m:  parseFloat(e.distance) || null,
      predicted_s: parseInt(e.predicted)  || null,
      actual_s:    parseInt(e.actual)     || null,
      // v9.468 — was dropped on migration (raceEntryToRow persists it)
      conditions:  e.conditions || null,
      notes:       e.notes || null,
    }))
    // v9.434.0 — Idempotency guard for RETRIES (see injuries above; no onConflict
    // + id-less rows = plain INSERT → doubled history on Retry).
    const { error: cleanupErr } = await supabase.from('race_results').delete().match({ user_id: userId })
    if (cleanupErr) {
      recordErr(errors, 'race_results cleanup', cleanupErr)
    } else {
      const { error } = await supabase.from('race_results').upsert(rows)
      if (error) recordErr(errors, 'race_results', error)
    }
    onProgress?.(++step, steps)
  }

  // ── profile_data ──────────────────────────────────────────────────────────
  if (hasProfile) {
    const { error } = await supabase.from('profiles')
      .update({ profile_data: profileData, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) recordErr(errors, 'profiles.profile_data', error)
    onProgress?.(++step, steps)
  }

  if (errors.length > 0) throw new Error(errors.join('\n'))

  // Mark as migrated
  localStorage.setItem(MIGRATED_KEY, '1')
  return true
}

export function isMigrated() {
  return localStorage.getItem(MIGRATED_KEY) === '1'
}
