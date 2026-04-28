// src/components/general/SessionHistory.jsx — chronological session log with expandable detail
import { useState } from 'react'
import { S } from '../../styles.js'

const card = { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '12px 16px', marginBottom: 8, cursor: 'pointer' }
const lbl  = { ...S.mono, fontSize: 9, color: '#666', letterSpacing: '0.08em' }

export default function SessionHistory({ sessions = [], exercises = [], lang = 'en', onLogNew, onDelete }) {
  const [expanded, setExpanded]     = useState(null)
  const [confirmDel, setConfirmDel] = useState(null) // session id pending delete
  const t = (en, tr) => lang === 'tr' ? tr : en

  const today  = new Date().toISOString().slice(0, 10)
  const sorted = [...sessions].sort((a, b) =>
    (b.session_date ?? '').localeCompare(a.session_date ?? '')
  )

  const weekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d.toISOString().slice(0, 10)
  })()
  const weekSessions = sorted.filter(s => (s.session_date ?? '') >= weekStart)
  const weekSets     = weekSessions.flatMap(s => (s.exercises ?? []).flatMap(ex => (ex.sets ?? []).filter(set => !set.is_warmup)))
  const weekExIds    = new Set(weekSessions.flatMap(s => (s.exercises ?? []).map(ex => ex.exercise_id)))

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ ...S.mono, fontSize: 10, color: '#ff6600', letterSpacing: '0.1em' }}>
          {t('SESSION HISTORY', 'SEANS GEÇMİŞİ')}
          {sorted.length > 0 && <span style={{ color: '#555', marginLeft: 8 }}>({sorted.length})</span>}
        </div>
        <button
          onClick={onLogNew}
          style={{ ...S.mono, fontSize: 10, padding: '6px 14px', border: 'none', background: '#ff6600', color: '#fff', borderRadius: 3, cursor: 'pointer' }}>
          {t('LOG NEW →', 'KAYDET →')}
        </button>
      </div>

      {/* Weekly aggregate stats */}
      {sorted.length > 0 && (
        <div style={{ ...S.mono, fontSize: 9, color: '#888', letterSpacing: '0.07em', marginBottom: 14, padding: '6px 10px', background: 'var(--surface, #111)', borderRadius: 3, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ color: '#ff6600' }}>{t('THIS WEEK', 'BU HAFTA')}</span>
          <span style={{ color: weekSessions.length === 0 ? '#555' : 'inherit' }}>{weekSessions.length} {t('sessions', 'seans')}</span>
          {weekSets.length > 0 && <span>{weekSets.length} {t('work sets', 'çalışma seti')}</span>}
          {weekExIds.size > 0 && <span>{weekExIds.size} {t('exercises', 'egzersiz')}</span>}
        </div>
      )}

      {sorted.length === 0 && (
        <div style={{ ...S.mono, fontSize: 11, color: '#555', textAlign: 'center', padding: '32px 0' }}>
          {t('No sessions yet. Hit LOG NEW to start.', 'Henüz seans yok. Başlamak için KAYDET\'e bas.')}
        </div>
      )}

      {sorted.map((s, i) => {
        const sid      = s.id || String(i)
        const exList   = s.exercises ?? []
        const workSets = exList.flatMap(ex => (ex.sets ?? []).filter(set => !set.is_warmup))
        const isOpen   = expanded === i
        const isDel    = confirmDel === sid
        const isToday  = s.session_date === today

        return (
          <div key={sid} style={{ ...card, borderColor: isOpen ? '#ff660044' : 'var(--border)' }}
            onClick={e => { if (!e.target.closest('button')) setExpanded(isOpen ? null : i) }}>

            {/* Row header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ ...S.mono, fontSize: 12, color: 'var(--text)', marginBottom: 3 }}>
                  {s.session_date ?? '—'}
                  {isToday && <span style={{ color: '#22aa44', marginLeft: 8, fontSize: 9, border: '1px solid #22aa4444', borderRadius: 2, padding: '1px 5px' }}>{t('TODAY', 'BUGÜN')}</span>}
                  {s.day_label && <span style={{ color: '#888', marginLeft: 10 }}>{s.day_label}</span>}
                </div>
                <div style={{ ...lbl }}>
                  {exList.length} {t('exercises', 'egzersiz')}
                  {workSets.length > 0 && ` · ${workSets.length} ${t('work sets', 'çalışma seti')}`}
                  {s.duration_minutes != null && ` · ${s.duration_minutes} min`}
                  {s.rpe != null && ` · RPE ${s.rpe}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                {isDel ? (
                  <>
                    <button onClick={e => { e.stopPropagation(); onDelete?.(sid); setConfirmDel(null) }}
                      style={{ ...S.mono, fontSize: 9, padding: '2px 8px', border: '1px solid #e03030', background: 'transparent', color: '#e03030', borderRadius: 3, cursor: 'pointer' }}>
                      {t('confirm', 'sil?')}
                    </button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDel(null) }}
                      style={{ ...S.mono, fontSize: 9, padding: '2px 8px', border: '1px solid var(--border)', background: 'transparent', color: '#888', borderRadius: 3, cursor: 'pointer' }}>
                      {t('cancel', 'vazgeç')}
                    </button>
                  </>
                ) : (
                  <button onClick={e => { e.stopPropagation(); setConfirmDel(sid) }}
                    style={{ ...S.mono, fontSize: 10, border: 'none', background: 'transparent', color: '#555', cursor: 'pointer', padding: '0 2px' }}
                    title={t('Delete session', 'Seansı sil')}>✕</button>
                )}
                <span style={{ ...S.mono, fontSize: 10, color: '#555' }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {exList.map((ex, ei) => {
                  const def       = exercises.find(e => e.id === ex.exercise_id)
                  const name      = def ? (lang === 'tr' ? def.name_tr : def.name_en) : ex.exercise_id
                  const wSets     = (ex.sets ?? []).filter(set => !set.is_warmup)
                  const topSet    = wSets.reduce((best, s) => (s.load_kg ?? 0) > (best?.load_kg ?? 0) ? s : best, null)
                  const warmupCnt = (ex.sets ?? []).filter(set => set.is_warmup).length

                  return (
                    <div key={ei} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                      <span style={{ ...S.mono, fontSize: 11, color: 'var(--text)', flex: 1 }}>{name}</span>
                      <span style={{ ...S.mono, fontSize: 10, color: '#888', flexShrink: 0, marginLeft: 8 }}>
                        {wSets.length}×
                        {topSet?.load_kg != null
                          ? `${topSet.load_kg}kg × ${topSet.reps}`
                          : topSet?.reps != null
                            ? `${topSet.reps} ${t('reps', 'tekrar')}`
                            : t('BW', 'VK')}
                        {warmupCnt > 0 && <span style={{ color: '#555' }}> +{warmupCnt}W</span>}
                      </span>
                    </div>
                  )
                })}
                {exList.length === 0 && (
                  <div style={{ ...S.mono, fontSize: 10, color: '#555' }}>
                    {t('No exercises recorded.', 'Egzersiz kaydedilmedi.')}
                  </div>
                )}
                {s.notes && (
                  <div style={{ ...S.mono, fontSize: 10, color: '#888', marginTop: 8, fontStyle: 'italic' }}>
                    {s.notes}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
