// ─── DataContext.jsx — Single data provider for all training tables ───────────
// Provides log, recovery, injuries, testResults, raceResults to entire app.
// Each [data, setter] pair has the same interface as useLocalStorage.
// In Supabase mode: hydrates from DB on login, syncs mutations in background.

import { createContext, useContext } from 'react'
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
  const [log,         setLog]         = useTrainingLogQuery(userId)
  const [recovery,    setRecovery]    = useRecovery(userId)
  const [injuries,    setInjuries]    = useInjuries(userId)
  const [testResults, setTestResults] = useTestResults(userId)
  const [raceResults, setRaceResults] = useRaceResults(userId)
  const [profile,     setProfile]     = useProfileQuery(userId)

  return (
    <DataContext.Provider value={{
      log,         setLog,
      recovery,    setRecovery,
      injuries,    setInjuries,
      testResults, setTestResults,
      raceResults, setRaceResults,
      profile,     setProfile,
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside DataProvider')
  return ctx
}
