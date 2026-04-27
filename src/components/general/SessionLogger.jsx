// src/components/general/SessionLogger.jsx — set-by-set strength session logging
import { useState } from 'react'
import { S } from '../../styles.js'
import { suggestNextLoad } from '../../lib/athlete/strengthTraining.js'

const card  = { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px', marginBottom: 12 }
const input = { ...S.mono, fontSize: 12, padding: '6px 10px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text)', width: '100%' }
const label = { ...S.mono, fontSize: 10, color: '#888', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }

function empty(exerciseId) {
  return { exerciseId, sets: [{ set_number: 1, reps: '', load_kg: '', rir: '', is_warmup: false }] }
}

export default function SessionLogger({ exercises = [], history = {}, lang = 'en', onSave }) {
  const [dayLabel, setDayLabel] = useState('')
  const [notes, setNotes]       = useState('')
  const [rpe, setRpe]           = useState('')
  const [rows, setRows]         = useState([])
  const [saved, setSaved]       = useState(false)

  const t = (en, tr) => lang === 'tr' ? tr : en

  function addExercise(exId) {
    if (!exId) return
    setRows(r => [...r, empty(exId)])
  }

  function updateSet(rowIdx, setIdx, field, value) {
    setRows(r => r.map((row, ri) => ri !== rowIdx ? row : {
      ...row,
      sets: row.sets.map((s, si) => si !== setIdx ? s : { ...s, [field]: value })
    }))
  }

  function addSet(rowIdx) {
    setRows(r => r.map((row, ri) => ri !== rowIdx ? row : {
      ...row,
      sets: [...row.sets, { set_number: row.sets.length + 1, reps: '', load_kg: '', rir: '', is_warmup: false }]
    }))
  }

  function removeExercise(rowIdx) {
    setRows(r => r.filter((_, ri) => ri !== rowIdx))
  }

  function handleSave() {
    const session = {
      day_label: dayLabel,
      notes,
      rpe: rpe ? parseInt(rpe) : null,
      duration_minutes: null,
      exercises: rows.map(row => ({
        exercise_id: row.exerciseId,
        sets: row.sets.map(s => ({
          set_number: s.set_number,
          reps: parseInt(s.reps) || 0,
          load_kg: s.load_kg ? parseFloat(s.load_kg) : null,
          rir: s.rir !== '' ? parseInt(s.rir) : null,
          is_warmup: s.is_warmup,
        }))
      }))
    }
    onSave?.(session)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ ...S.mono, fontSize: 12, color: '#ff6600', letterSpacing: '0.1em', marginBottom: 16 }}>
        {t('LOG SESSION', 'ANTRENMAN KAYDI')}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 2 }}>
          <span style={label}>{t('Day / Split', 'Gün / Bölüm')}</span>
          <input style={input} placeholder={t('Push, Upper A, Legs…', 'İtiş, Üst A, Bacak…')} value={dayLabel} onChange={e => setDayLabel(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={label}>{t('Session RPE (1–10)', 'Seans RPE (1–10)')}</span>
          <input style={input} type="number" min={1} max={10} placeholder="7" value={rpe} onChange={e => setRpe(e.target.value)} />
        </div>
      </div>

      {/* Exercise selector */}
      <div style={{ marginBottom: 16 }}>
        <span style={label}>{t('Add Exercise', 'Egzersiz Ekle')}</span>
        <select style={{ ...input, cursor: 'pointer' }} onChange={e => { addExercise(e.target.value); e.target.value = '' }} defaultValue="">
          <option value="" disabled>{t('Select exercise…', 'Egzersiz seç…')}</option>
          {exercises.map(ex => (
            <option key={ex.id} value={ex.id}>{lang === 'tr' ? ex.name_tr : ex.name_en}</option>
          ))}
        </select>
      </div>

      {/* Set rows */}
      {rows.map((row, rowIdx) => {
        const ex = exercises.find(e => e.id === row.exerciseId)
        const hist = history[row.exerciseId] ?? []
        const sugg = ex ? suggestNextLoad(hist, { reps_low: 8, reps_high: 12, is_bodyweight: ex.equipment === 'bw' }) : null

        return (
          <div key={rowIdx} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ ...S.mono, fontSize: 12, color: '#ff6600' }}>
                {ex ? (lang === 'tr' ? ex.name_tr : ex.name_en) : row.exerciseId}
              </span>
              <button onClick={() => removeExercise(rowIdx)} style={{ ...S.mono, fontSize: 10, border: 'none', background: 'transparent', color: '#e03030', cursor: 'pointer' }}>✕</button>
            </div>

            {sugg && sugg.reason !== 'no_history' && (
              <div style={{ ...S.mono, fontSize: 10, color: '#22aa44', marginBottom: 8 }}>
                ↑ {t('Suggestion', 'Öneri')}: {sugg.load_kg ? `${sugg.load_kg}kg` : t('BW', 'VK')} × {sugg.reps_low}–{sugg.reps_high} ({t(sugg.reason.replace('_', ' '), sugg.reason.replace('_', ' '))})
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr 36px', gap: 6, marginBottom: 6 }}>
              <span style={{ ...label, textAlign: 'center' }}>#</span>
              <span style={label}>{t('Reps', 'Tekrar')}</span>
              <span style={label}>{t('Load kg', 'Ağırlık kg')}</span>
              <span style={label}>{t('RIR', 'Yedek')}</span>
              <span />
            </div>

            {row.sets.map((s, si) => (
              <div key={si} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr 36px', gap: 6, marginBottom: 4 }}>
                <span style={{ ...S.mono, fontSize: 12, lineHeight: '30px', textAlign: 'center', color: s.is_warmup ? '#888' : 'var(--text)' }}>{s.set_number}</span>
                <input style={input} type="number" min={1} placeholder="10" value={s.reps} onChange={e => updateSet(rowIdx, si, 'reps', e.target.value)} />
                <input style={input} type="number" min={0} step="2.5" placeholder="80" value={s.load_kg} onChange={e => updateSet(rowIdx, si, 'load_kg', e.target.value)} />
                <input style={input} type="number" min={0} max={5} placeholder="2" value={s.rir} onChange={e => updateSet(rowIdx, si, 'rir', e.target.value)} />
                <button
                  style={{ ...S.mono, fontSize: 10, border: '1px solid var(--border)', background: s.is_warmup ? '#ff660022' : 'transparent', color: s.is_warmup ? '#ff6600' : '#555', borderRadius: 3, cursor: 'pointer' }}
                  title={t('Toggle warmup', 'Isınma olarak işaretle')}
                  onClick={() => updateSet(rowIdx, si, 'is_warmup', !s.is_warmup)}
                >W</button>
              </div>
            ))}

            <button style={{ ...S.mono, fontSize: 10, marginTop: 4, padding: '4px 10px', border: '1px dashed var(--border)', background: 'transparent', color: '#888', borderRadius: 3, cursor: 'pointer' }} onClick={() => addSet(rowIdx)}>
              + {t('Add Set', 'Set Ekle')}
            </button>
          </div>
        )
      })}

      {rows.length === 0 && (
        <div style={{ ...S.mono, fontSize: 11, color: '#555', textAlign: 'center', padding: '24px 0' }}>
          {t('Select exercises above to start logging.', 'Yukarıdan egzersiz seçerek kayda başla.')}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <span style={label}>{t('Notes (optional)', 'Notlar (isteğe bağlı)')}</span>
        <textarea style={{ ...input, minHeight: 48 }} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <button
        disabled={rows.length === 0}
        onClick={handleSave}
        style={{ ...S.mono, fontSize: 12, padding: '10px 24px', border: 'none', background: rows.length > 0 ? '#ff6600' : '#333', color: rows.length > 0 ? '#fff' : '#555', borderRadius: 3, cursor: rows.length > 0 ? 'pointer' : 'not-allowed', width: '100%' }}>
        {saved ? (lang === 'tr' ? '✓ KAYDEDİLDİ' : '✓ SAVED') : (lang === 'tr' ? 'ANTRENMANIM BİTTİ' : 'FINISH SESSION')}
      </button>
    </div>
  )
}
