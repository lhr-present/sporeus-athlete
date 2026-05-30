// ─── useSupabaseData.js — Dual-mode data hooks (Supabase / localStorage) ─────
// Each hook returns [data, setter] — identical interface to useLocalStorage.
// When Supabase + userId available: hydrates from Supabase on login, syncs
// mutations in the background. Falls back to localStorage silently.

import { useEffect, useCallback, useRef } from 'react'
import { logger } from '../lib/logger.js'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { useLocalStorage } from './useLocalStorage.js'
import { enqueuePendingLog, markSyncOffline } from '../lib/offlineQueue.js'

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

export function logRowToEntry(row) {
  return {
    id:       row.id,
    date:     row.date,
    type:     row.type     || '',
    duration: row.duration_min != null ? Number(row.duration_min) : 0,
    tss:      row.tss      != null ? Number(row.tss)  : 0,
    rpe:      row.rpe      != null ? Number(row.rpe)  : 5,
    zones:    Array.isArray(row.zones) ? row.zones : [],
    notes:    row.notes    || '',
    source:   row.source   || 'manual',
  }
}
export function logEntryToRow(entry, userId) {
  return {
    id:           entry.id,
    user_id:      userId,
    date:         entry.date,
    type:         entry.type  || 'Training',
    duration_min: Number(entry.duration) || null,
    tss:          Number(entry.tss)      || null,
    rpe:          Number(entry.rpe)      || null,
    zones:        Array.isArray(entry.zones) && entry.zones.some(z => z > 0) ? entry.zones : null,
    notes:        entry.notes || null,
    source:       'manual',
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
          return old && JSON.stringify(old) !== JSON.stringify(n)
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
            // Deletes can't be replayed by the upsert-based queue; just surface offline.
            ok = await tryWrite(`${table} delete`, supabase.from(table).delete().eq('id', e.id).eq('user_id', userId)) && ok
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

export function useTrainingLog(userId) {
  return useSyncedTable({ lsKey: 'sporeus_log', lsDefault: [], table: 'training_log', toEntry: logRowToEntry, toRow: logEntryToRow, userId })
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
          return old && JSON.stringify(old) !== JSON.stringify(n)
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
            ok = await tryWrite('recovery delete', supabase.from('recovery').delete().eq('user_id', userId).eq('date', e.date)) && ok
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
