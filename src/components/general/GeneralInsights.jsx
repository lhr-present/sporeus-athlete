// src/components/general/GeneralInsights.jsx — analytics on demand, never pushed
import { useMemo } from 'react'
import { S } from '../../styles.js'
import WeeklyVolumeChart from './WeeklyVolumeChart.jsx'
import ProgressionChart from './ProgressionChart.jsx'

export default function GeneralInsights({ sessions = [], exercises = [], lang = 'en' }) {
  const t = (en, tr) => lang === 'tr' ? tr : en

  const muscleMap = useMemo(() => {
    const m = {}
    for (const ex of exercises) m[ex.id] = [ex.primary_muscle, ...(ex.secondary_muscles ?? [])]
    return m
  }, [exercises])

  const weekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d.toISOString().slice(0, 10)
  })()

  // Sessions are saved as { exercises: [{ exercise_id, sets: [{reps, load_kg, rir, is_warmup}] }] }
  // Flatten to a per-set list enriched with exercise_id for volume/progression logic.
  const weekSets = useMemo(() =>
    sessions
      .filter(s => s.session_date >= weekStart)
      .flatMap(s => (s.exercises ?? []).flatMap(ex =>
        (ex.sets ?? []).map(set => ({
          ...set,
          exercise_id: ex.exercise_id,
          rir:  set.rir  ?? 3,
          reps: set.reps ?? 0,
        }))
      )),
    [sessions, weekStart]
  )

  const progressExercises = useMemo(() => {
    const ids = [...new Set(sessions.flatMap(s => (s.exercises ?? []).map(ex => ex.exercise_id)))]
    return ids
      .filter(id => sessions.filter(s => s.exercises?.some(ex => ex.exercise_id === id)).length >= 2)
      .slice(0, 4)
  }, [sessions])

  function getProgressData(exerciseId) {
    return sessions
      .filter(s => s.exercises?.some(ex => ex.exercise_id === exerciseId))
      .map(s => {
        const exData = s.exercises.find(ex => ex.exercise_id === exerciseId)
        const sets   = (exData?.sets ?? []).filter(x => !x.is_warmup)
        const top    = sets.reduce((best, x) => (!best || (x.load_kg ?? 0) > (best.load_kg ?? 0)) ? x : best, null)
        return { session_date: s.session_date, load_kg: top?.load_kg ?? 0, reps: top?.reps ?? 0 }
      })
  }

  if (sessions.length === 0) {
    return (
      <div style={{ ...S.mono, fontSize: 11, color: '#555', padding: '24px 0', textAlign: 'center' }}>
        {t('Log sessions to see analytics.', 'Analitik için seans kaydet.')}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <WeeklyVolumeChart sets={weekSets} muscleMap={muscleMap} lang={lang} />
      </div>

      {progressExercises.length > 0 && (
        <div>
          <div style={{ ...S.mono, fontSize: 10, color: '#888', letterSpacing: '0.08em', marginBottom: 10 }}>
            {t('TOP SET PROGRESSION', 'ÜSTTEN SET İLERLEME')}
          </div>
          {progressExercises.map(exId => {
            const ex = exercises.find(e => e.id === exId)
            return (
              <div key={exId} style={{ marginBottom: 14 }}>
                <ProgressionChart
                  data={getProgressData(exId)}
                  exerciseName={ex ? (lang === 'tr' ? ex.name_tr : ex.name_en) : exId}
                  lang={lang}
                />
              </div>
            )
          })}
        </div>
      )}

      {progressExercises.length === 0 && (
        <div style={{ ...S.mono, fontSize: 10, color: '#555' }}>
          {t('Need 2+ sessions per exercise to show progression.', 'İlerleme grafiği için her egzersizde 2+ seans gerekli.')}
        </div>
      )}
    </div>
  )
}
