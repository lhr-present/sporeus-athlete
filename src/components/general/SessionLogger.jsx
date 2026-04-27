// src/components/general/SessionLogger.jsx — set-by-set strength session logging
import { useState, useEffect } from 'react'
import { S } from '../../styles.js'
import { suggestNextLoad } from '../../lib/athlete/strengthTraining.js'

const card  = { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px', marginBottom: 12 }
const inp   = { ...S.mono, fontSize: 12, padding: '6px 10px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text)', width: '100%' }
const lbl   = { ...S.mono, fontSize: 10, color: '#888', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }

function emptyRow(exerciseId, prescription = null) {
  const defaultSets = prescription
    ? Array.from({ length: prescription.sets }, (_, i) => ({
        set_number: i + 1,
        reps:       '',
        load_kg:    '',
        rir:        String(prescription.rir ?? 2),
        is_warmup:  false,
      }))
    : [{ set_number: 1, reps: '', load_kg: '', rir: '', is_warmup: false }]
  return { exerciseId, prescription, sets: defaultSets }
}

/**
 * @param {Array<{exercise_id: string, sets: number, reps_low: number, reps_high: number, rir: number}>} preloadedExercises
 *   Pre-populated from the template day. When present, exercises are auto-added to rows.
 * @param {Object<string, Array>} history
 *   exerciseId → flat chronological work-set array for load suggestions.
 * @param {Object<string, number|null>} gapDays
 *   exerciseId → days since last session (for resume protocol).
 */
export default function SessionLogger({
  exercises    = [],
  preloadedExercises = [],
  history      = {},
  gapDays      = {},
  initialLabel = '',
  lang         = 'en',
  onSave,
}) {
  const t = (en, tr) => lang === 'tr' ? tr : en

  const [dayLabel, setDayLabel] = useState(initialLabel)
  const [notes, setNotes]       = useState('')
  const [rpe, setRpe]           = useState('')
  const [saved, setSaved]       = useState(false)

  // Build initial rows from preloaded exercises (template prescription)
  const [rows, setRows] = useState(() => {
    if (preloadedExercises.length > 0) {
      return preloadedExercises.map(pe => emptyRow(pe.exercise_id, pe))
    }
    return []
  })

  // Re-init when preloaded exercises change (e.g. different day opened)
  useEffect(() => {
    if (preloadedExercises.length > 0) {
      setRows(preloadedExercises.map(pe => emptyRow(pe.exercise_id, pe)))
      setDayLabel(initialLabel)
    }
  }, [preloadedExercises.map(e => e.exercise_id).join(','), initialLabel])

  function addExercise(exId) {
    if (!exId) return
    setRows(r => [...r, emptyRow(exId)])
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
      sets: [...row.sets, { set_number: row.sets.length + 1, reps: '', load_kg: '', rir: row.sets[0]?.rir ?? '', is_warmup: false }]
    }))
  }

  function removeExercise(rowIdx) {
    setRows(r => r.filter((_, ri) => ri !== rowIdx))
  }

  function handleSave() {
    const session = {
      day_label:        dayLabel,
      notes,
      rpe:              rpe ? parseInt(rpe) : null,
      duration_minutes: null,
      exercises: rows.map(row => ({
        exercise_id: row.exerciseId,
        sets: row.sets.map(s => ({
          set_number: s.set_number,
          reps:       parseInt(s.reps) || 0,
          load_kg:    s.load_kg ? parseFloat(s.load_kg) : null,
          rir:        s.rir !== '' ? parseInt(s.rir) : null,
          is_warmup:  s.is_warmup,
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
          <span style={lbl}>{t('Day / Split', 'Gün / Bölüm')}</span>
          <input style={inp} placeholder={t('Push, Upper A, Legs…', 'İtiş, Üst A, Bacak…')} value={dayLabel} onChange={e => setDayLabel(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <span style={lbl}>{t('Session RPE (1–10)', 'Seans RPE (1–10)')}</span>
          <input style={inp} type="number" min={1} max={10} placeholder="7" value={rpe} onChange={e => setRpe(e.target.value)} />
        </div>
      </div>

      {/* Manual exercise selector — always available to add extras */}
      <div style={{ marginBottom: 16 }}>
        <span style={lbl}>{t('Add Exercise', 'Egzersiz Ekle')}</span>
        <select style={{ ...inp, cursor: 'pointer' }} onChange={e => { addExercise(e.target.value); e.target.value = '' }} defaultValue="">
          <option value="" disabled>{t('Select exercise…', 'Egzersiz seç…')}</option>
          {exercises.map(ex => (
            <option key={ex.id} value={ex.id}>{lang === 'tr' ? ex.name_tr : ex.name_en}</option>
          ))}
        </select>
      </div>

      {/* Set rows */}
      {rows.map((row, rowIdx) => {
        const ex    = exercises.find(e => e.id === row.exerciseId)
        const hist  = (history[row.exerciseId] ?? []).filter(s => !s?.is_warmup)
        const gap   = gapDays[row.exerciseId] ?? null
        const sugg  = ex
          ? suggestNextLoad(hist, {
              reps_low:      row.prescription?.reps_low  ?? 8,
              reps_high:     row.prescription?.reps_high ?? 12,
              is_bodyweight: ex.equipment === 'bw',
            }, gap)
          : null
        const pres = row.prescription

        return (
          <div key={rowIdx} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <span style={{ ...S.mono, fontSize: 12, color: '#ff6600' }}>
                  {ex ? (lang === 'tr' ? ex.name_tr : ex.name_en) : row.exerciseId}
                </span>
                {pres && (
                  <div style={{ ...S.mono, fontSize: 10, color: '#888', marginTop: 2 }}>
                    {t('Prescribed:', 'Hedef:')} {pres.sets} × {pres.reps_low}–{pres.reps_high} {t('reps', 'tekrar')} · RIR {pres.rir ?? 2} · {pres.rest_seconds ?? 90}s {t('rest', 'dinlenme')}
                  </div>
                )}
              </div>
              <button onClick={() => removeExercise(rowIdx)} style={{ ...S.mono, fontSize: 10, border: 'none', background: 'transparent', color: '#e03030', cursor: 'pointer', marginLeft: 12 }}>✕</button>
            </div>

            {/* Suggestion line */}
            {sugg && sugg.reason !== 'no_history' && (
              <div style={{ marginBottom: 10, padding: '6px 10px', background: '#22aa4411', borderRadius: 3 }}>
                <div style={{ ...S.mono, fontSize: 10, color: '#22aa44' }}>
                  ↑ {t('Suggestion', 'Öneri')}: {sugg.load_kg ? `${sugg.load_kg} kg` : t('Bodyweight', 'Vücut ağırlığı')} × {sugg.reps_low}–{sugg.reps_high} {t('reps', 'tekrar')}
                  {sugg.reason === 'add_weight' && <span style={{ color: '#ff6600', marginLeft: 6 }}>↑ {t('overload', 'yüklenme')}</span>}
                  {sugg.reason === 'deload'     && <span style={{ color: '#e03030', marginLeft: 6 }}>{t('deload', 'hafifletme')}</span>}
                  {sugg.reason === 'gap_return' && <span style={{ color: '#888', marginLeft: 6 }}>{t('return', 'dönüş')}</span>}
                </div>
                {sugg.reorientation && (
                  <div style={{ ...S.mono, fontSize: 10, color: '#888', marginTop: 3 }}>
                    {t('Coming back — light first session, listen to your body.', 'Geri dönüş — ilk seans hafif olsun, vücudunu dinle.')}
                  </div>
                )}
              </div>
            )}

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 60px 32px', gap: 6, marginBottom: 4 }}>
              {['#', t('Reps','Tekrar'), t('kg','kg'), t('RIR','Yedek'), ''].map((h, i) => (
                <span key={i} style={{ ...lbl, marginBottom: 0 }}>{h}</span>
              ))}
            </div>

            {row.sets.map((s, si) => (
              <div key={si} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 60px 32px', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                <span style={{ ...S.mono, fontSize: 11, textAlign: 'center', color: s.is_warmup ? '#888' : 'var(--text)' }}>{s.set_number}{s.is_warmup ? 'W' : ''}</span>
                <input style={inp} type="number" min={1}
                  placeholder={pres ? `${pres.reps_low}–${pres.reps_high}` : '10'}
                  value={s.reps} onChange={e => updateSet(rowIdx, si, 'reps', e.target.value)} />
                <input style={inp} type="number" min={0} step="2.5"
                  placeholder={sugg?.load_kg ? String(sugg.load_kg) : '—'}
                  value={s.load_kg} onChange={e => updateSet(rowIdx, si, 'load_kg', e.target.value)} />
                <input style={inp} type="number" min={0} max={5}
                  placeholder={pres ? String(pres.rir ?? 2) : '2'}
                  value={s.rir} onChange={e => updateSet(rowIdx, si, 'rir', e.target.value)} />
                <button
                  style={{ ...S.mono, fontSize: 9, border: '1px solid var(--border)', background: s.is_warmup ? '#ff660022' : 'transparent', color: s.is_warmup ? '#ff6600' : '#555', borderRadius: 3, cursor: 'pointer', padding: '4px 2px' }}
                  title={t('Toggle warmup', 'Isınma olarak işaretle')}
                  onClick={() => updateSet(rowIdx, si, 'is_warmup', !s.is_warmup)}>W</button>
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
        <span style={lbl}>{t('Notes (optional)', 'Notlar (isteğe bağlı)')}</span>
        <textarea style={{ ...inp, minHeight: 48 }} value={notes} onChange={e => setNotes(e.target.value)} />
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
