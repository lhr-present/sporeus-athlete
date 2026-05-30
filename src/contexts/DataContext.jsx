// ─── DataContext.jsx — Single data provider for all training tables ───────────
// Provides log, recovery, injuries, testResults, raceResults to entire app.
// Each [data, setter] pair has the same interface as useLocalStorage.
// In Supabase mode: hydrates from DB on login, syncs mutations in background.

import { createContext, useContext, useMemo } from 'react'
import {
  useRecovery,
  useInjuries,
  useTestResults,
  useRaceResults,
} from '../hooks/useSupabaseData.js'
import { useTrainingLogQuery } from '../hooks/useTrainingLogQuery.js'
import { useProfileQuery }     from '../hooks/useProfileQuery.js'

const DataContext = createContext(null)

export function DataProvider({ userId, children }) {
  const logResult                     = useTrainingLogQuery({ userId })
  const [log, setLog]                 = logResult
  const [recovery,    setRecovery]    = useRecovery(userId)
  const [injuries,    setInjuries]    = useInjuries(userId)
  const [testResults, setTestResults] = useTestResults(userId)
  const [raceResults, setRaceResults] = useRaceResults(userId)
  const [profile,     setProfile]     = useProfileQuery(userId)

  const { fetchNextPage, hasMore, isLoadingMore, refetch: refetchLog } = logResult

  // Memoize the provider value so useData() consumers don't re-render on every
  // render of the provider — only when one of the actual table values (or the
  // pagination controls) changes. Setters from useState/useCallback-backed
  // hooks are stable; we list them anyway for correctness.
  const value = useMemo(() => ({
    log,         setLog,
    // Pagination controls for TrainingLog (E4)
    fetchNextPage,
    hasMore,
    isLoadingMore,
    refetchLog,
    recovery,    setRecovery,
    injuries,    setInjuries,
    testResults, setTestResults,
    raceResults, setRaceResults,
    profile,     setProfile,
  }), [
    log, setLog,
    fetchNextPage, hasMore, isLoadingMore, refetchLog,
    recovery, setRecovery,
    injuries, setInjuries,
    testResults, setTestResults,
    raceResults, setRaceResults,
    profile, setProfile,
  ])

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
