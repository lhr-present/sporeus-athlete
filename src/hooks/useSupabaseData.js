// ─── useSupabaseData.js — Dual-mode data hooks (Supabase / localStorage) ─────
// Each hook returns [data, setter] — identical interface to useLocalStorage.
// When Supabase + userId available: hydrates from Supabase on login, syncs
// mutations in the background. Falls back to localStorage silently.

import { useEffect, useCallback, useRef } from 'react'
import { logger } from '../lib/logger.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { useLocalStorage } from './useLocalStorage.js'
import { enqueuePendingLog, markSyncOffline } from '../lib/offlineQueue.js'
import { deepEqual } from '../lib/deepEqual.js'
import { isUuid } from '../lib/newId.js'
import { migrateLogIdsToUuid } from '../lib/validate.js'

// ─── Background-write helper ────────────────────────────────────────────────────
// Pre-v9.347 these hooks fire-and-forgot every upsert/update/delete: a failed
// write (RLS denial, transient 5xx, validation) threw, aborted the rest of the
// batch, and the rejection was swallowed — local and server diverged silently.
// tryWrite inspects {error} per write, never throws, and reports failure so the
// caller can keep draining the batch + flip the sync status to 'offline'.
export async function tryWrite(label, thenable, onFail) {
  try {
    const { error } = await thenable
    if (error) {
      logger.warn(`[sync] ${label} failed:`, error.message)
      try { await onFail?.(error) } catch (e) { logger.warn('[sync] onFail:', e.message) }
      return false
    }
    return true
  } catch (e) {
    logger.warn(`[sync] ${label} threw:`, e.message)
    try { await onFail?.(e) } catch (err) { logger.warn('[sync] onFail:', err.message) }
    return false
  }
}

// ─── Field transformers ────────────────────────────────────────────────────────
// Exported so TanStack Query hooks can reuse them without duplication.

// Activity distance in meters: prefer distanceM, else convert distanceKm (manual
// QuickAdd writes km). null when neither is a positive finite number.
function logDistanceM(entry) {
  const m = Number(entry.distanceM)
  if (Number.isFinite(m) && m > 0) return m
  const km = Number(entry.distanceKm)
  if (Number.isFinite(km) && km > 0) return Math.round(km * 1000)
  return null
}

// Positive integer or null — column shape for the v9.465 enrichment metrics.
function posInt(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

export function logRowToEntry(row) {
  return {
    id:       row.id,
    date:     row.date,
    type:     row.type     || '',
    duration: row.duration_min != null ? Number(row.duration_min) : 0,
    tss:      row.tss      != null ? Number(row.tss)  : 0,
    rpe:      row.rpe      != null ? Number(row.rpe)  : 5,
    zones:    Array.isArray(row.zones) ? row.zones : null,
    notes:    row.notes    || '',
    source:   row.source   || 'manual',
    // v9.397.0 — metric columns (distance/HR/cadence). Only surface when present so
    // the entry shape matches a localStorage-only entry; analytics guard for absence.
    ...(row.distance_m  != null ? { distanceM:  Number(row.distance_m) }  : {}),
    ...(row.avg_hr      != null ? { avgHR:      Number(row.avg_hr) }      : {}),
    ...(row.avg_cadence != null ? { avgCadence: Number(row.avg_cadence) } : {}),
    // v9.464.0 — decoupling_pct is written by the parse-activity edge fn (and by
    // client FIT imports via logEntryToRow) but was dropped here, so decouplingTrend
    // never fired cross-device. Negative values are legit (HR drift downward).
    ...(row.decoupling_pct != null ? { decouplingPct: Number(row.decoupling_pct) } : {}),
    // v9.465.0 — Strava enrichment columns (migration 20260637). Keys match the
    // card consumers: cyclingNpTrend reads np, triLoad reads avgPower,
    // altitudeStimulus reads elevationGainM, timeOfDayConsistency reads startTime.
    ...(row.np               != null ? { np:             Number(row.np) }               : {}),
    ...(row.avg_power        != null ? { avgPower:       Number(row.avg_power) }        : {}),
    ...(row.max_hr           != null ? { maxHR:          Number(row.max_hr) }           : {}),
    ...(row.elevation_gain_m != null ? { elevationGainM: Number(row.elevation_gain_m) } : {}),
    ...(row.kilojoules       != null ? { kilojoules:     Number(row.kilojoules) }       : {}),
    ...(row.suffer_score     != null ? { sufferScore:    Number(row.suffer_score) }     : {}),
    ...(row.start_time       != null ? { startTime:      String(row.start_time) }       : {}),
    ...(row.rpe_method       != null ? { rpeMethod:      String(row.rpe_method) }       : {}),
  }
}
export function logEntryToRow(entry, userId) {
  return {
    // Only send `id` when it's a valid uuid. A legacy numeric / non-uuid id
    // would make Postgres reject the insert (22P02) against the uuid column —
    // omitting it lets the `gen_random_uuid()` default fill a real uuid. (The
    // one-time migrateLogIdsToUuid pass converts local numeric ids so later
    // edits still match; this is the defensive belt-and-suspenders for any
    // that slip through.)
    ...(isUuid(entry.id) ? { id: entry.id } : {}),
    user_id:      userId,
    date:         entry.date,
    type:         entry.type  || 'Training',
    duration_min: Number(entry.duration) || null,
    tss:          Number(entry.tss)      || null,
    rpe:          Number(entry.rpe)      || null,
    zones:        Array.isArray(entry.zones) && entry.zones.some(z => z > 0) ? entry.zones : null,
    notes:        entry.notes || null,
    source:       'manual',
    // v9.397.0 — persist activity metrics (were dropped → lost cross-device).
    // distanceM wins; fall back to distanceKm (manual QuickAdd writes km).
    distance_m:   logDistanceM(entry),
    avg_hr:       Number.isFinite(Number(entry.avgHR)) && Number(entry.avgHR) > 0 ? Math.round(Number(entry.avgHR)) : null,
    avg_cadence:  Number.isFinite(Number(entry.avgCadence)) && Number(entry.avgCadence) > 0 ? Math.round(Number(entry.avgCadence)) : null,
    // v9.464.0 — persist Friel decoupling from client FIT imports (was dropped →
    // lost cross-device). 0 and negatives are valid; only non-finite becomes null.
    decoupling_pct: Number.isFinite(Number(entry.decouplingPct)) ? Number(entry.decouplingPct) : null,
    // v9.465.0 — round-trip the enrichment columns so an edited Strava/FIT entry
    // doesn't wipe them on the diff-by-id sync upsert.
    np:               posInt(entry.np ?? entry.normalizedPower),
    avg_power:        posInt(entry.avgPower),
    max_hr:           posInt(entry.maxHR),
    elevation_gain_m: posInt(entry.elevationGainM),
    kilojoules:       posInt(entry.kilojoules),
    suffer_score:     posInt(entry.sufferScore),
    start_time:       typeof entry.startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.startTime) ? entry.startTime : null,
    rpe_method:       typeof entry.rpeMethod === 'string' && entry.rpeMethod ? entry.rpeMethod.slice(0, 20) : null,
  }
}

function recRowToEntry(row) {
  return {
    date:      row.date,
    score:     row.score     != null ? Number(row.score)    : 0,
    sleepHrs:  row.sleep_hrs != null ? Number(row.sleep_hrs): 0,
    sleep:     row.sleep     != null ? Number(row.sleep)    : 0,
    soreness:  row.soreness  != null ? Number(row.soreness) : 0,
    energy:    row.energy    != null ? Number(row.energy)   : 0,
    stress:    row.stress    != null ? Number(row.stress)   : 0,
    mood:      row.mood      != null ? Number(row.mood)     : 0,
    hrv:       row.hrv       != null ? Number(row.hrv)      : null,
    notes:     row.notes     || '',
  }
}
function recEntryToRow(entry, userId) {
  return {
    user_id:   userId,
    date:      entry.date,
    score:     Number(entry.score)    || null,
    sleep_hrs: Number(entry.sleepHrs) || null,
    sleep:     Number(entry.sleep)    || null,
    soreness:  Number(entry.soreness) || null,
    energy:    Number(entry.energy)   || null,
    stress:    Number(entry.stress)   || null,
    mood:      Number(entry.mood)     || null,
    hrv:       entry.hrv ? Number(entry.hrv) : null,
    notes:     entry.notes || null,
  }
}

function injRowToEntry(row) {
  return {
    id:    row.id,
    zone:  row.zone,
    date:  row.date,
    level: row.level != null ? Number(row.level) : 1,
    type:  row.type  || '',
    notes: row.notes || '',
  }
}
function injEntryToRow(entry, userId) {
  return {
    id:      entry.id,
    user_id: userId,
    zone:    entry.zone || 'unknown',
    date:    entry.date,
    level:   Number(entry.level) || null,
    type:    entry.type  || null,
    notes:   entry.notes || null,
  }
}

function testRowToEntry(row) {
  return {
    id:     row.id,
    date:   row.date,
    testId: row.test_id,
    value:  row.value,
    unit:   row.unit || '',
  }
}
function testEntryToRow(entry, userId) {
  return {
    id:      entry.id,
    user_id: userId,
    date:    entry.date,
    test_id: entry.testId || entry.test_id || 'unknown',
    value:   String(entry.value),
    unit:    entry.unit || null,
  }
}

function raceRowToEntry(row) {
  return {
    id:        row.id,
    date:      row.date,
    distance:  row.distance_m  != null ? Number(row.distance_m)  : 0,
    predicted: row.predicted_s != null ? Number(row.predicted_s) : 0,
    actual:    row.actual_s    != null ? Number(row.actual_s)     : 0,
    conditions: row.conditions || '',
    notes:     row.notes || '',
  }
}
function raceEntryToRow(entry, userId) {
  return {
    id:          entry.id,
    user_id:     userId,
    date:        entry.date,
    distance_m:  Number(entry.distance)  || null,
    predicted_s: Number(entry.predicted) || null,
    actual_s:    Number(entry.actual)    || null,
    conditions:  entry.conditions || null,
    notes:       entry.notes      || null,
  }
}

// ─── Hydration bounds ───────────────────────────────────────────────────────────
// History tables (recovery/injuries/test/race) used to hydrate with .select('*')
// and NO row cap → entire account history fetched on every login. Cap the read to
// the last ~year and a hard row ceiling so a long-lived account stays cheap to load.
// (training_log is paginated separately in useTrainingLogQuery — not affected.)
const HYDRATE_DAYS  = 365
const HYDRATE_LIMIT = 1000

function hydrateCutoff(days = HYDRATE_DAYS) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ─── Core sync factory ────────────────────────────────────────────────────────
// Shared logic for all 5 tables. Returns [data, setter] like useLocalStorage.

function useSyncedTable({ lsKey, lsDefault, table, toEntry, toRow, userId, orderCol = 'date', columns = '*' }) {
  const [data, setDataLS] = useLocalStorage(lsKey, lsDefault)
  const hydrating = useRef(false)
  const useSupabase = isSupabaseReady() && !!userId

  // Hydrate from Supabase once per login
  useEffect(() => {
    if (!useSupabase) return
    let cancelled = false
    hydrating.current = true
    supabase
      .from(table)
      .select(columns)
      .eq('user_id', userId)
      .gte(orderCol, hydrateCutoff())
      .order(orderCol, { ascending: false })
      .limit(HYDRATE_LIMIT)
      .then(({ data: rows, error }) => {
        if (cancelled) return
        if (!error && rows) {
          setDataLS(rows.map(toEntry))
          try { localStorage.removeItem('sporeus-offline-mode') } catch (e) { logger.warn('localStorage:', e.message) }
        }
        hydrating.current = false
      })
      .catch(() => {
        if (cancelled) return
        try { localStorage.setItem('sporeus-offline-mode', '1') } catch (e) { logger.warn('localStorage:', e.message) }
        hydrating.current = false
      })
    return () => { cancelled = true }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const setData = useCallback((fnOrValue) => {
    setDataLS(prev => {
      const next = typeof fnOrValue === 'function' ? fnOrValue(prev) : fnOrValue

      if (useSupabase && !hydrating.current) {
        // Index by id once (O(n)) instead of .find() per element (O(n²)).
        const prevById = new Map(prev.map(o => [o.id, o]))
        const nextById = new Map(next.map(n => [n.id, n]))
        const added   = next.filter(n => !prevById.has(n.id))
        const removed = prev.filter(o => !nextById.has(o.id))
        const changed = next.filter(n => {
          const old = prevById.get(n.id)
          return old && !deepEqual(old, n)
        })

        // Background sync — resilient: per-write error checks, never aborts the
        // batch on one failure, enqueues failed upserts for retry (v9.347.0).
        Promise.resolve().then(async () => {
          let ok = true
          for (const e of added) {
            const row = toRow(e, userId)
            ok = await tryWrite(`${table} insert`, supabase.from(table).upsert(row),
              () => enqueuePendingLog({ ...row, _table: table })) && ok
          }
          for (const e of changed) {
            const row = toRow(e, userId)
            ok = await tryWrite(`${table} update`, supabase.from(table).update(row).eq('id', e.id).eq('user_id', userId),
              () => enqueuePendingLog({ ...row, _table: table })) && ok
          }
          for (const e of removed) {
            // v9.361.0 — queue a delete tombstone on failure so an offline
            // delete reaches the server on reconnect (else the row resurrects).
            ok = await tryWrite(`${table} delete`, supabase.from(table).delete().eq('id', e.id).eq('user_id', userId),
              () => enqueuePendingLog({ _op: 'delete', _table: table, _key: { id: e.id, user_id: userId } })) && ok
          }
          if (!ok) markSyncOffline()
        }).catch(err => logger.warn(`[sync] ${table} batch:`, err?.message))
      }

      return next
    })
  }, [useSupabase, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  return [data, setData]
}

// ─── Public hooks ─────────────────────────────────────────────────────────────

// One-time local migration flag — see migrateLogIdsToUuid below.
const ID_MIGRATION_FLAG = 'sporeus-id-uuid-migrated'

export function useTrainingLog(userId) {
  const [log, setLog] = useSyncedTable({ lsKey: 'sporeus_log', lsDefault: [], table: 'training_log', toEntry: logRowToEntry, toRow: logEntryToRow, userId })

  // One-time: upgrade any legacy NUMERIC entry id to a uuid so it matches the
  // server's uuid column and the diff-by-id sync can persist it (training_log
  // had 0 rows because numeric ids were rejected with 22P02). This only matters
  // for LOCAL-ONLY / guest entries: for a synced account, hydration replaces
  // local rows with uuid-keyed server rows before the next mutation, so the
  // migration is a harmless no-op there. Guarded by a flag so it runs once.
  // Runs through setLog (not setDataLS) — but setLog's diff treats the rewritten
  // entries as "added" (new id) + "removed" (old id); the removed delete targets
  // the old numeric id which never existed server-side (no-op), and the added
  // upsert now carries a uuid → first real write of these entries. That is the
  // intended outcome (they finally reach the server).
  useEffect(() => {
    let migrated
    try { migrated = localStorage.getItem(ID_MIGRATION_FLAG) } catch { migrated = '1' }
    if (migrated) return
    setLog(prev => {
      if (!Array.isArray(prev) || prev.length === 0) {
        try { localStorage.setItem(ID_MIGRATION_FLAG, '1') } catch { /* noop */ }
        return prev
      }
      const needs = prev.some(e => e && typeof e === 'object' && !(typeof e.id === 'string' && e.id))
      if (!needs) {
        try { localStorage.setItem(ID_MIGRATION_FLAG, '1') } catch { /* noop */ }
        return prev
      }
      const { log: next, remap } = migrateLogIdsToUuid(prev)
      // Rekey per-entry power blobs (sporeus-power-<id>) to the new uuids.
      for (const [oldId, freshId] of Object.entries(remap)) {
        try {
          const blob = localStorage.getItem('sporeus-power-' + oldId)
          if (blob != null) {
            localStorage.setItem('sporeus-power-' + freshId, blob)
            localStorage.removeItem('sporeus-power-' + oldId)
          }
        } catch { /* noop */ }
      }
      try { localStorage.setItem(ID_MIGRATION_FLAG, '1') } catch { /* noop */ }
      return next
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return [log, setLog]
}

export function useRecovery(userId) {
  // Recovery has no `id` in localStorage entries — upsert on (user_id, date)
  const [data, setDataLS] = useLocalStorage('sporeus-recovery', [])
  const hydrating = useRef(false)
  const useSupabase = isSupabaseReady() && !!userId

  useEffect(() => {
    if (!useSupabase) return
    let cancelled = false
    hydrating.current = true
    supabase.from('recovery')
      .select('date,score,sleep_hrs,sleep,soreness,energy,stress,mood,hrv,notes')
      .eq('user_id', userId)
      .gte('date', hydrateCutoff())
      .order('date', { ascending: false })
      .limit(HYDRATE_LIMIT)
      .then(({ data: rows, error }) => {
        if (cancelled) return
        if (!error && rows) setDataLS(rows.map(recRowToEntry))
        hydrating.current = false
      })
    return () => { cancelled = true }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const setData = useCallback((fnOrValue) => {
    setDataLS(prev => {
      const next = typeof fnOrValue === 'function' ? fnOrValue(prev) : fnOrValue
      if (useSupabase && !hydrating.current) {
        // Index by date once (O(n)) instead of .find() per element (O(n²)).
        const prevByDate = new Map(prev.map(o => [o.date, o]))
        const nextByDate = new Map(next.map(n => [n.date, n]))
        const added   = next.filter(n => !prevByDate.has(n.date))
        const removed = prev.filter(o => !nextByDate.has(o.date))
        const changed = next.filter(n => {
          const old = prevByDate.get(n.date)
          return old && !deepEqual(old, n)
        })
        Promise.resolve().then(async () => {
          let ok = true
          for (const e of [...added, ...changed]) {
            const row = recEntryToRow(e, userId)
            ok = await tryWrite('recovery upsert', supabase.from('recovery').upsert(row, { onConflict: 'user_id,date' }),
              () => enqueuePendingLog({ ...row, _table: 'recovery' })) && ok
          }
          // Recovery rows have no `id`; the dedup key is (user_id, date), so
          // a delete must target the date — otherwise a removed wellness day
          // is never deleted server-side and re-hydrates on next load.
          for (const e of removed) {
            ok = await tryWrite('recovery delete', supabase.from('recovery').delete().eq('user_id', userId).eq('date', e.date),
              () => enqueuePendingLog({ _op: 'delete', _table: 'recovery', _key: { user_id: userId, date: e.date } })) && ok
          }
          if (!ok) markSyncOffline()
        }).catch(err => logger.warn('[sync] recovery batch:', err?.message))
      }
      return next
    })
  }, [useSupabase, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  return [data, setData]
}

export function useInjuries(userId) {
  return useSyncedTable({ lsKey: 'sporeus-injuries', lsDefault: [], table: 'injuries', toEntry: injRowToEntry, toRow: injEntryToRow, userId, columns: 'id,zone,date,level,type,notes' })
}

export function useTestResults(userId) {
  return useSyncedTable({ lsKey: 'sporeus-test-results', lsDefault: [], table: 'test_results', toEntry: testRowToEntry, toRow: testEntryToRow, userId, columns: 'id,date,test_id,value,unit' })
}

export function useRaceResults(userId) {
  return useSyncedTable({ lsKey: 'sporeus-race-results', lsDefault: [], table: 'race_results', toEntry: raceRowToEntry, toRow: raceEntryToRow, userId, columns: 'id,date,distance_m,predicted_s,actual_s,conditions,notes' })
}
