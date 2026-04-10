// ─── useSupabaseData.js — Dual-mode data hooks (Supabase / localStorage) ─────
// Each hook returns [data, setter] — identical interface to useLocalStorage.
// When Supabase + userId available: hydrates from Supabase on login, syncs
// mutations in the background. Falls back to localStorage silently.

import { useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase.js'
import { useLocalStorage } from './useLocalStorage.js'

// ─── Field transformers ────────────────────────────────────────────────────────

function logRowToEntry(row) {
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
function logEntryToRow(entry, userId) {
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
    soreness:  row.soreness  != null ? Number(row.soreness) : 0,
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
    soreness:  Number(entry.soreness) || null,
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

// ─── Core sync factory ────────────────────────────────────────────────────────
// Shared logic for all 5 tables. Returns [data, setter] like useLocalStorage.

function useSyncedTable({ lsKey, lsDefault, table, toEntry, toRow, userId, orderCol = 'date' }) {
  const [data, setDataLS] = useLocalStorage(lsKey, lsDefault)
  const hydrating = useRef(false)
  const useSupabase = isSupabaseReady() && !!userId

  // Hydrate from Supabase once per login
  useEffect(() => {
    if (!useSupabase) return
    hydrating.current = true
    supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order(orderCol, { ascending: false })
      .then(({ data: rows, error }) => {
        if (!error && rows) setDataLS(rows.map(toEntry))
        hydrating.current = false
      })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const setData = useCallback((fnOrValue) => {
    setDataLS(prev => {
      const next = typeof fnOrValue === 'function' ? fnOrValue(prev) : fnOrValue

      if (useSupabase && !hydrating.current) {
        const added   = next.filter(n => !prev.find(o => o.id === n.id))
        const removed = prev.filter(o => !next.find(n => n.id === o.id))
        const changed = next.filter(n => {
          const old = prev.find(o => o.id === n.id)
          return old && JSON.stringify(old) !== JSON.stringify(n)
        })

        // Fire-and-forget background sync
        Promise.resolve().then(async () => {
          for (const e of added) {
            await supabase.from(table).upsert(toRow(e, userId))
          }
          for (const e of removed) {
            await supabase.from(table).delete().eq('id', e.id).eq('user_id', userId)
          }
          for (const e of changed) {
            await supabase.from(table).update(toRow(e, userId)).eq('id', e.id).eq('user_id', userId)
          }
        })
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
    hydrating.current = true
    supabase.from('recovery').select('*').eq('user_id', userId).order('date', { ascending: false })
      .then(({ data: rows, error }) => {
        if (!error && rows) setDataLS(rows.map(recRowToEntry))
        hydrating.current = false
      })
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const setData = useCallback((fnOrValue) => {
    setDataLS(prev => {
      const next = typeof fnOrValue === 'function' ? fnOrValue(prev) : fnOrValue
      if (useSupabase && !hydrating.current) {
        const added   = next.filter(n => !prev.find(o => o.date === n.date))
        const changed = next.filter(n => {
          const old = prev.find(o => o.date === n.date)
          return old && JSON.stringify(old) !== JSON.stringify(n)
        })
        Promise.resolve().then(async () => {
          for (const e of [...added, ...changed]) {
            await supabase.from('recovery').upsert(recEntryToRow(e, userId), { onConflict: 'user_id,date' })
          }
        })
      }
      return next
    })
  }, [useSupabase, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  return [data, setData]
}

export function useInjuries(userId) {
  return useSyncedTable({ lsKey: 'sporeus-injuries', lsDefault: [], table: 'injuries', toEntry: injRowToEntry, toRow: injEntryToRow, userId })
}

export function useTestResults(userId) {
  return useSyncedTable({ lsKey: 'sporeus-test-results', lsDefault: [], table: 'test_results', toEntry: testRowToEntry, toRow: testEntryToRow, userId })
}

export function useRaceResults(userId) {
  return useSyncedTable({ lsKey: 'sporeus-race-results', lsDefault: [], table: 'race_results', toEntry: raceRowToEntry, toRow: raceEntryToRow, userId })
}
