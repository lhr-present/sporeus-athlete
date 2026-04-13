// ─── dataMigration.js — localStorage → Supabase migration ───────────────────
// Detects existing local data and batch-upserts it into Supabase.
// Safe to call multiple times; uses 'sporeus-migrated' flag to skip if done.

import { supabase } from './supabase.js'

const MIGRATED_KEY = 'sporeus-migrated'

function readLS(key, fallback = []) {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
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

  const total = log.length + recovery.length + injuries.length + testResults.length + raceResults.length

  if (total === 0 && !trainingAge) return null   // nothing to migrate

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
  const trainingAge = localStorage.getItem('sporeus-training-age')

  let step = 0
  const steps = [
    log.length > 0,
    recovery.length > 0,
    injuries.length > 0,
    testResults.length > 0,
    raceResults.length > 0,
    !!trainingAge,
  ].filter(Boolean).length || 1

  const errors = []

  // ── training_log ─────────────────────────────────────────────────────────
  if (log.length > 0) {
    const rows = log.filter(e => e && typeof e === 'object' && e.date).map(e => ({
      user_id:      userId,
      date:         e.date,
      type:         e.type || 'Training',
      duration_min: parseFloat(e.duration) || null,
      tss:          parseFloat(e.tss)      || null,
      rpe:          parseFloat(e.rpe)      || null,
      zones:        Array.isArray(e.zones) ? e.zones : null,
      notes:        e.notes || null,
      source:       'manual',
    }))
    // Batch in chunks of 100
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from('training_log').upsert(rows.slice(i, i + 100), { onConflict: 'user_id,date,source' })
      if (error) errors.push(`training_log: ${error.message}`)
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
      soreness:  parseInt(e.soreness)   || null,
      stress:    parseInt(e.stress)     || null,
      mood:      parseInt(e.mood)       || null,
      hrv:       parseFloat(e.hrv)      || null,
      notes:     e.notes || null,
    }))
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from('recovery').upsert(rows.slice(i, i + 100), { onConflict: 'user_id,date' })
      if (error) errors.push(`recovery: ${error.message}`)
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
    const { error } = await supabase.from('injuries').upsert(rows)
    if (error) errors.push(`injuries: ${error.message}`)
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
    const { error } = await supabase.from('test_results').upsert(rows)
    if (error) errors.push(`test_results: ${error.message}`)
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
      notes:       e.notes || null,
    }))
    const { error } = await supabase.from('race_results').upsert(rows)
    if (error) errors.push(`race_results: ${error.message}`)
    onProgress?.(++step, steps)
  }

  // ── profile fields ────────────────────────────────────────────────────────
  if (trainingAge) {
    const { error } = await supabase.from('profiles')
      .update({ training_age: trainingAge, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) errors.push(`profiles.training_age: ${error.message}`)
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
