// src/components/general/GeneralDashboard.jsx — main surface for general-fitness track
import { useMemo } from 'react'
import { S } from '../../styles.js'
import { volumeLandmarks, volumeStatus, weeklyHardSets } from '../../lib/athlete/strengthTraining.js'
import WeeklyVolumeChart from './WeeklyVolumeChart.jsx'
import ProgressionChart from './ProgressionChart.jsx'

const MUSCLES = ['chest','back','quads','hamstrings','glutes','delts','biceps','triceps','calves','core']

function todayStr() { return new Date().toISOString().slice(0, 10) }
function weekStart() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}

export default function GeneralDashboard({ sessions = [], exercises = [], activeProgram = null, templateDays = [], lang = 'en', onLogSession }) {
  const t = (en, tr) => lang === 'tr' ? tr : en

  // Build muscleMap: exerciseId → [primary_muscle]
  const muscleMap = useMemo(() => {
    const m = {}
    for (const ex of exercises) m[ex.id] = [ex.primary_muscle, ...(ex.secondary_muscles ?? [])]
    return m
  }, [exercises])

  // Sessions this week
  const wk = weekStart()
  const thisWeekSessions = sessions.filter(s => s.session_date >= wk)

  // Flat set list this week
  const weekSets = useMemo(() => {
    return thisWeekSessions.flatMap(s =>
      (s.strength_sets ?? []).map(set => ({
        ...set,
        exercise_id: set.exercise_id,
        rir: set.rir ?? 3,
        reps: set.reps ?? 0,
        is_warmup: set.is_warmup ?? false,
      }))
    )
  }, [thisWeekSessions])

  // Streak
  const streak = useMemo(() => {
    let s = 0, d = new Date()
    const done = new Set(sessions.map(x => x.session_date))
    while (true) {
      const key = d.toISOString().slice(0, 10)
      if (!done.has(key)) break
      s++; d.setDate(d.getDate() - 1)
    }
    return s
  }, [sessions])

  // Last session
  const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null

  // Today's planned session
  const today = todayStr()
  const todayDow = new Date().getDay()
  const todayPlanned = templateDays.find((_, i) => {
    if (!activeProgram) return false
    const scheduledDow = (activeProgram.start_dow ?? 1) + i
    return scheduledDow % 7 === todayDow
  })

  // Per-muscle top-set progression for first 3 exercises with enough data
  const progressExercises = useMemo(() => {
    const exIds = [...new Set(sessions.flatMap(s => (s.strength_sets ?? []).map(x => x.exercise_id)))]
    return exIds.filter(id => {
      const pts = sessions.filter(s => s.strength_sets?.some(x => x.exercise_id === id))
      return pts.length >= 2
    }).slice(0, 3)
  }, [sessions])

  function getProgressData(exerciseId) {
    return sessions
      .filter(s => s.strength_sets?.some(x => x.exercise_id === exerciseId))
      .map(s => {
        const sets = s.strength_sets.filter(x => x.exercise_id === exerciseId && !x.is_warmup)
        const top = sets.reduce((best, x) => (!best || (x.load_kg ?? 0) > (best.load_kg ?? 0)) ? x : best, null)
        return { session_date: s.session_date, load_kg: top?.load_kg ?? 0, reps: top?.reps ?? 0 }
      })
  }

  return (
    <div style={{ maxWidth: 680 }}>
      {/* ── Stats strip ────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: t('Streak', 'Seri'), value: `${streak}d` },
          { label: t('This Week', 'Bu Hafta'), value: `${thisWeekSessions.length} ${t('sessions', 'antrenman')}` },
          { label: t('Total', 'Toplam'), value: `${sessions.length} ${t('sessions', 'seans')}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ ...S.mono, fontSize: 18, color: '#ff6600' }}>{value}</div>
            <div style={{ ...S.mono, fontSize: 9, color: '#888', letterSpacing: '0.08em' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Today's session CTA ────────────────────────────── */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ ...S.mono, fontSize: 11, color: '#ff6600', letterSpacing: '0.1em', marginBottom: 8 }}>
          {t("TODAY'S TRAINING", 'BUGÜNKÜ ANTRENMAN')}
        </div>
        {todayPlanned
          ? <div style={{ ...S.mono, fontSize: 12, color: 'var(--text)', marginBottom: 10 }}>
              {lang === 'tr' ? todayPlanned.day_label_tr : todayPlanned.day_label_en}
            </div>
          : <div style={{ ...S.mono, fontSize: 11, color: '#888', marginBottom: 10 }}>
              {activeProgram
                ? t('Rest day — recovery is part of training.', 'Dinlenme günü — toparlanma da antrenmanın parçası.')
                : t('No active program. Select one from Programs.', 'Aktif program yok. Programlar\'dan seç.')
              }
            </div>
        }
        <button
          onClick={onLogSession}
          style={{ ...S.mono, fontSize: 12, padding: '8px 20px', border: 'none', background: '#ff6600', color: '#fff', borderRadius: 3, cursor: 'pointer' }}>
          + {t('Log Session', 'Antrenman Kaydet')}
        </button>
      </div>

      {/* ── Last session ─────────────────────────────────────── */}
      {lastSession && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ ...S.mono, fontSize: 10, color: '#888', letterSpacing: '0.08em', marginBottom: 4 }}>{t('LAST SESSION', 'SON ANTRENMAN')}</div>
          <div style={{ ...S.mono, fontSize: 12, color: 'var(--text)' }}>
            {lastSession.session_date} · {lastSession.day_label || t('Session', 'Seans')}
            {lastSession.rpe ? ` · RPE ${lastSession.rpe}` : ''}
          </div>
        </div>
      )}

      {/* ── Weekly volume chart ───────────────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <WeeklyVolumeChart sets={weekSets} muscleMap={muscleMap} lang={lang} />
      </div>

      {/* ── Progression charts ────────────────────────────────── */}
      {progressExercises.length > 0 && (
        <div>
          <div style={{ ...S.mono, fontSize: 10, color: '#888', letterSpacing: '0.08em', marginBottom: 10 }}>
            {t('TOP SET PROGRESSION', 'ÜSTTEN SET İLERLEME')}
          </div>
          {progressExercises.map(exId => {
            const ex = exercises.find(e => e.id === exId)
            return (
              <div key={exId} style={{ marginBottom: 12 }}>
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
    </div>
  )
}
