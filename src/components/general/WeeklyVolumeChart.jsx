// src/components/general/WeeklyVolumeChart.jsx — per-muscle hard-set volume bars
import { volumeLandmarks, volumeStatus, weeklyHardSets } from '../../lib/athlete/strengthTraining.js'
import { S } from '../../styles.js'

const MUSCLES = ['chest','back','quads','hamstrings','glutes','delts','biceps','triceps','calves','core']
const MUSCLE_LABELS_EN = { chest:'Chest', back:'Back', quads:'Quads', hamstrings:'Hamstrings', glutes:'Glutes', delts:'Shoulders', biceps:'Biceps', triceps:'Triceps', calves:'Calves', core:'Core' }
const MUSCLE_LABELS_TR = { chest:'Göğüs', back:'Sırt', quads:'Ön Bacak', hamstrings:'Arka Bacak', glutes:'Kalça', delts:'Omuz', biceps:'Biseps', triceps:'Triseps', calves:'Baldır', core:'Karın' }

const STATUS_COLOR = { under: '#4488ff', optimal: '#22aa44', over: '#e03030' }

/**
 * @param {Array<{exercise_id: string, rir: number, reps: number, is_warmup: boolean}>} sets
 * @param {{ [exerciseId: string]: string[] }} muscleMap - exerciseId → [primary_muscle, ...secondary]
 */
export default function WeeklyVolumeChart({ sets = [], muscleMap = {}, lang = 'en' }) {
  const labels = lang === 'tr' ? MUSCLE_LABELS_TR : MUSCLE_LABELS_EN

  // Aggregate sets per muscle
  const setsPerMuscle = {}
  for (const muscle of MUSCLES) setsPerMuscle[muscle] = 0

  for (const s of sets) {
    if (s?.is_warmup) continue
    const muscles = muscleMap[s?.exercise_id] ?? []
    for (const m of muscles) {
      if (m in setsPerMuscle) {
        if (s.rir <= 3 && s.reps >= 5) setsPerMuscle[m]++
      }
    }
  }

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
      <div style={{ ...S.mono, fontSize: 11, color: '#ff6600', letterSpacing: '0.1em', marginBottom: 14 }}>
        {lang === 'tr' ? 'HAFTALIK HACİM (ETKİLİ SET)' : 'WEEKLY VOLUME (HARD SETS)'}
      </div>

      {MUSCLES.map(muscle => {
        const lm = volumeLandmarks(muscle)
        const count = setsPerMuscle[muscle] ?? 0
        const status = volumeStatus(count, muscle)
        const max = lm ? lm.mrv + 4 : 26
        const pct = Math.min((count / max) * 100, 100)
        const mavPct = lm ? (lm.mav / max) * 100 : 60
        const mevPct = lm ? (lm.mev / max) * 100 : 35

        return (
          <div key={muscle} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
              <span style={{ ...S.mono, fontSize: 10, color: 'var(--text)' }}>{labels[muscle]}</span>
              <span style={{ ...S.mono, fontSize: 10, color: STATUS_COLOR[status] ?? '#888' }}>{count} {lang === 'tr' ? 'set' : 'sets'}</span>
            </div>
            <div style={{ height: 6, background: 'var(--surface)', borderRadius: 2, position: 'relative', overflow: 'visible' }}>
              {/* MEV marker */}
              {lm && <div style={{ position: 'absolute', top: -2, left: `${mevPct}%`, width: 1, height: 10, background: '#44884488', borderRadius: 1 }} title={`MEV ${lm.mev}`} />}
              {/* MAV marker */}
              {lm && <div style={{ position: 'absolute', top: -2, left: `${mavPct}%`, width: 1, height: 10, background: '#88884488', borderRadius: 1 }} title={`MAV ${lm.mav}`} />}
              {/* Fill */}
              <div style={{ width: `${pct}%`, height: '100%', background: STATUS_COLOR[status] ?? '#888', borderRadius: 2, transition: 'width 0.4s' }} />
            </div>
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        {[['under', lang === 'tr' ? 'Yetersiz' : 'Under'], ['optimal', lang === 'tr' ? 'Optimal' : 'Optimal'], ['over', lang === 'tr' ? 'Fazla' : 'Over']].map(([s, lbl]) => (
          <span key={s} style={{ ...S.mono, fontSize: 9, color: STATUS_COLOR[s] }}>● {lbl}</span>
        ))}
        <span style={{ ...S.mono, fontSize: 9, color: '#44884488' }}>| MEV</span>
        <span style={{ ...S.mono, fontSize: 9, color: '#88884488' }}>| MAV</span>
      </div>
    </div>
  )
}
