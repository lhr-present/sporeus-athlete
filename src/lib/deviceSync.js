// ─── deviceSync.js — Open Wearables device management client (v5.12.0) ───────
// Wraps Supabase calls for the athlete_devices table and the device-sync edge fn.
// NEVER returns the token column — tokens are encrypted server-side.

import { supabase } from './supabase.js'

// ─── Schema mapper (exported for tests) ────────────────────────────────────────

export function mapOWActivity(owActivity) {
  const typeMap = {
    running: 'run', trail_running: 'run',
    cycling: 'bike', virtual_cycling: 'bike',
    swimming: 'swim', open_water_swimming: 'swim',
    walking: 'walk', hiking: 'walk',
    strength_training: 'strength', weight_training: 'strength',
    yoga: 'other', workout: 'other',
  }
  const type     = typeMap[(owActivity.type || '').toLowerCase()] ?? 'other'
  const date     = (owActivity.start_time || '').slice(0, 10) || null
  const duration = Math.round((owActivity.duration_seconds ?? 0) / 60)
  return { type, date, duration_min: duration, source: 'open-wearables' }
}

// ─── Device CRUD ────────────────────────────────────────────────────────────────

export async function getDevices(userId) {
  if (!supabase || !userId) return { devices: [], error: null }
  const { data, error } = await supabase
    .from('athlete_devices')
    .select('id, provider, label, base_url, last_sync_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return { devices: data ?? [], error }
}

export async function addDevice({ userId, provider, label, baseUrl, token }) {
  if (!supabase || !userId) return { error: new Error('Not authenticated') }

  // Validate URL
  try {
    const u = new URL(baseUrl)
    if (!['https:', 'http:'].includes(u.protocol)) throw new Error('Invalid protocol')
  } catch {
    return { error: new Error('base_url must be a valid HTTPS URL') }
  }

  const row = {
    user_id:  userId,
    provider: provider || 'other',
    label:    label    || '',
    base_url: baseUrl,
  }

  const { data, error } = await supabase.from('athlete_devices').insert(row).select('id').single()
  if (error) return { error }

  // If token provided, encrypt it via server-side rpc and update
  if (token && data?.id) {
    const { data: encToken, error: encErr } = await supabase.rpc('encrypt_device_token', { plain: token })
    if (!encErr && encToken) {
      await supabase.from('athlete_devices').update({ token_enc: encToken }).eq('id', data.id)
    }
  }

  return { id: data?.id, error: null }
}

export async function removeDevice(deviceId) {
  if (!supabase || !deviceId) return { error: new Error('Missing deviceId') }
  const { error } = await supabase.from('athlete_devices').delete().eq('id', deviceId)
  return { error }
}

// ─── Sync trigger ───────────────────────────────────────────────────────────────

export async function triggerSync() {
  if (!supabase) return { results: [], error: new Error('Supabase not configured') }
  try {
    const { data, error } = await supabase.functions.invoke('device-sync', {
      body: {},
    })
    if (error) return { results: [], error }
    return { results: data?.results ?? [], synced: data?.synced ?? 0, error: null }
  } catch (err) {
    return { results: [], error: err instanceof Error ? err : new Error(String(err)) }
  }
}
