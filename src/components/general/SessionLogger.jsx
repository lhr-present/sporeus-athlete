// src/components/general/SessionLogger.jsx — set-by-set strength session logging
import { useState, useEffect, useRef } from 'react'
import { S } from '../../styles.js'
import { suggestNextLoad, plateCalculator } from '../../lib/athlete/strengthTraining.js'

const card  = { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px', marginBottom: 12 }
const inp   = { ...S.mono, fontSize: 12, padding: '6px 10px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text)', width: '100%' }
const lbl   = { ...S.mono, fontSize: 10, color: '#888', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }

const DRAFT_KEY = 'sporeus-gf-draft'

function readDraft(dayKey) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (d?.dayKey !== dayKey) return null
    if (Date.now() - (d.at ?? 0) > 86400000) { localStorage.removeItem(DRAFT_KEY); return null }
    return d
  } catch { return null }
}

const PATTERN_ORDER = ['squat','hinge','push_h','push_v','pull_h','pull_v','iso','core']
const PATTERN_LABELS = {
  en: { squat:'Squat', hinge:'Hinge / Hip', push_h:'Push (Horiz)', push_v:'Push (Vert)', pull_h:'Pull (Horiz)', pull_v:'Pull (Vert)', iso:'Isolation', core:'Core' },
  tr: { squat:'Squat', hinge:'Menteşe / Kalça', push_h:'İtiş (Yatay)', push_v:'İtiş (Dikey)', pull_h:'Çekiş (Yatay)', pull_v:'Çekiş (Dikey)', iso:'İzolasyon', core:'Karın/Core' },
}

function emptyRow(exerciseId, prescription = null, suggestion = null, equipment = null) {
  const isBW         = equipment === 'bw'
  const suggestedLoad = (!isBW && suggestion?.load_kg) ? String(suggestion.load_kg) : ''
  const defaultSets = prescription
    ? Array.from({ length: prescription.sets }, (_, i) => ({
        set_number: i + 1,
        reps:       '',
        load_kg:    suggestedLoad,
        rir:        String(prescription.rir ?? 2),
        is_warmup:  false,
      }))
    : [{ set_number: 1, reps: '', load_kg: suggestedLoad, rir: '', is_warmup: false }]
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

  const dayKey  = preloadedExercises.map(e => e.exercise_id).join('|')
  const _draft  = useRef(preloadedExercises.length > 0 ? readDraft(dayKey) : null)

  const [dayLabel, setDayLabel] = useState(_draft.current?.dayLabel || initialLabel)
  const [notes, setNotes]       = useState(_draft.current?.notes   || '')
  const [rpe, setRpe]           = useState(_draft.current?.rpe     || '')
  const [saved, setSaved]       = useState(false)
  const [draftRestored, setDraftRestored] = useState(!!_draft.current?.rows?.length)
  const [cuesOpen, setCuesOpen] = useState({})
  const [doneSets, setDoneSets] = useState({}) // "rowIdx-setIdx": true
  const [restTimer, setRestTimer] = useState(null) // { rowIdx, seconds, total }

  useEffect(() => {
    if (!restTimer || restTimer.seconds <= 0) return
    const id = setTimeout(() =>
      setRestTimer(t => t ? { ...t, seconds: Math.max(0, t.seconds - 1) } : null)
    , 1000)
    return () => clearTimeout(id)
  }, [restTimer])

  function buildRow(pe) {
    const ex   = exercises.find(e => e.id === pe.exercise_id)
    const hist = (history[pe.exercise_id] ?? []).filter(s => !s?.is_warmup)
    const gap  = gapDays[pe.exercise_id] ?? null
    const sugg = ex
      ? suggestNextLoad(hist, { reps_low: pe.reps_low, reps_high: pe.reps_high, is_bodyweight: ex.equipment === 'bw' }, gap)
      : null
    return emptyRow(pe.exercise_id, pe, sugg, ex?.equipment)
  }

  // Build initial rows from preloaded exercises (template prescription)
  const [rows, setRows] = useState(() => {
    if (preloadedExercises.length === 0) return []
    if (_draft.current?.rows?.length > 0) return _draft.current.rows
    return preloadedExercises.map(buildRow)
  })

  // Re-init when preloaded exercises change (e.g. different day opened)
  useEffect(() => {
    if (preloadedExercises.length > 0) {
      const newDayKey = preloadedExercises.map(e => e.exercise_id).join('|')
      const draft     = readDraft(newDayKey)
      _draft.current  = draft
      setRows(draft?.rows?.length > 0 ? draft.rows : preloadedExercises.map(buildRow))
      setDayLabel(draft?.dayLabel || initialLabel)
      setNotes(draft?.notes || '')
      setRpe(draft?.rpe || '')
      setDraftRestored(!!draft?.rows?.length)
    }
  }, [preloadedExercises.map(e => e.exercise_id).join(','), initialLabel])

  // Auto-dismiss draft banner after 4s
  useEffect(() => {
    if (!draftRestored) return
    const id = setTimeout(() => setDraftRestored(false), 4000)
    return () => clearTimeout(id)
  }, [draftRestored])

  // Auto-save draft on every change (skip when already saved or no rows)
  useEffect(() => {
    if (rows.length === 0 || saved) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        dayKey,
        rows: rows.map(r => ({ exerciseId: r.exerciseId, prescription: r.prescription, sets: r.sets })),
        dayLabel, rpe, notes,
        at: Date.now(),
      }))
    } catch {}
  }, [rows, dayLabel, rpe, notes])

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
    const exerciseEntries = rows.map(row => ({
      exercise_id: row.exerciseId,
      sets: row.sets
        .filter(s => parseInt(s.reps) > 0)
        .map(s => ({
          set_number: s.set_number,
          reps:       parseInt(s.reps),
          load_kg:    s.load_kg ? parseFloat(s.load_kg) : null,
          rir:        s.rir !== '' ? parseInt(s.rir) : null,
          is_warmup:  s.is_warmup,
        }))
    })).filter(ex => ex.sets.length > 0)

    const session = {
      day_label:        dayLabel,
      notes,
      rpe:              rpe ? parseInt(rpe) : null,
      duration_minutes: null,
      exercises:        exerciseEntries,
    }
    localStorage.removeItem(DRAFT_KEY)
    onSave?.(session)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const hasFilledSets = rows.some(row => row.sets.some(s => parseInt(s.reps) > 0))

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
          <input style={inp} type="number" min={1} max={10} placeholder="7" inputMode="numeric" value={rpe} onChange={e => setRpe(e.target.value)} />
        </div>
      </div>

      {/* Manual exercise selector — always available to add extras */}
      <div style={{ marginBottom: 16 }}>
        <span style={lbl}>{t('Add Exercise', 'Egzersiz Ekle')}</span>
        <select style={{ ...inp, cursor: 'pointer' }} onChange={e => { addExercise(e.target.value); e.target.value = '' }} defaultValue="">
          <option value="" disabled>{t('Select exercise…', 'Egzersiz seç…')}</option>
          {PATTERN_ORDER.map(pat => {
            const group = exercises.filter(e => e.pattern === pat)
            if (group.length === 0) return null
            return (
              <optgroup key={pat} label={PATTERN_LABELS[lang === 'tr' ? 'tr' : 'en'][pat] ?? pat}>
                {group.map(ex => (
                  <option key={ex.id} value={ex.id}>{lang === 'tr' ? ex.name_tr : ex.name_en}</option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </div>

      {/* Draft restored banner */}
      {draftRestored && (
        <div style={{ ...S.mono, fontSize: 10, color: '#0064ff', padding: '6px 12px', background: '#0064ff11', border: '1px solid #0064ff33', borderRadius: 3, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>↩ {t('Draft restored — continue where you left off.', 'Taslak geri yüklendi — kaldığın yerden devam et.')}</span>
          <button onClick={() => setDraftRestored(false)} style={{ ...S.mono, fontSize: 9, border: 'none', background: 'transparent', color: '#0064ff', cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>
      )}

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
        const pres   = row.prescription
        const plates = sugg?.load_kg && ex?.equipment === 'bb'
          ? plateCalculator(sugg.load_kg)
          : null

        return (
          <div key={rowIdx} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ ...S.mono, fontSize: 12, color: '#ff6600' }}>
                    {ex ? (lang === 'tr' ? ex.name_tr : ex.name_en) : row.exerciseId}
                  </span>
                  {ex && (ex.cues_en || ex.cues_tr) && (
                    <button
                      onClick={() => setCuesOpen(o => ({ ...o, [rowIdx]: !o[rowIdx] }))}
                      style={{ ...S.mono, fontSize: 9, border: '1px solid var(--border)', background: 'transparent', color: '#888', borderRadius: 3, cursor: 'pointer', padding: '1px 6px', flexShrink: 0 }}>
                      {cuesOpen[rowIdx] ? t('▲ cues', '▲ ipucu') : t('▼ cues', '▼ ipucu')}
                    </button>
                  )}
                </div>
                {pres && (
                  <div style={{ ...S.mono, fontSize: 10, color: '#888', marginTop: 2 }}>
                    {t('Prescribed:', 'Hedef:')} {pres.sets} × {pres.reps_low}–{pres.reps_high} {t('reps', 'tekrar')} · RIR {pres.rir ?? 2} · {pres.rest_seconds ?? 90}s {t('rest', 'dinlenme')}
                  </div>
                )}
                {cuesOpen[rowIdx] && ex && (
                  <div style={{ ...S.mono, fontSize: 10, color: '#aaa', marginTop: 5, lineHeight: 1.6, fontStyle: 'italic' }}>
                    {lang === 'tr' ? (ex.cues_tr || ex.cues_en) : ex.cues_en}
                  </div>
                )}
              </div>
              <button onClick={() => removeExercise(rowIdx)} style={{ ...S.mono, fontSize: 10, border: 'none', background: 'transparent', color: '#e03030', cursor: 'pointer', marginLeft: 12, alignSelf: 'flex-start' }}>✕</button>
            </div>

            {/* First-session guidance — no history yet */}
            {sugg?.reason === 'no_history' && ex?.equipment !== 'bw' && (
              <div style={{ marginBottom: 10, padding: '6px 10px', background: '#0064ff11', borderRadius: 3 }}>
                <div style={{ ...S.mono, fontSize: 10, color: '#0064ff' }}>
                  {t('First session — start with a weight you can do 15+ reps comfortably. You\'ll calibrate over the next few sessions.',
                     'İlk seans — 15+ tekrar rahatça yapabileceğin bir ağırlıkla başla. Sonraki seanslarda ayarlarsın.')}
                </div>
              </div>
            )}

            {/* Suggestion line */}
            {sugg && sugg.reason !== 'no_history' && (
              <div style={{ marginBottom: 10, padding: '6px 10px', background: '#22aa4411', borderRadius: 3 }}>
                <div style={{ ...S.mono, fontSize: 10, color: '#22aa44' }}>
                  ↑ {t('Suggestion', 'Öneri')}: {sugg.load_kg ? `${sugg.load_kg} kg` : t('Bodyweight', 'Vücut ağırlığı')} × {sugg.reps_low}–{sugg.reps_high} {t('reps', 'tekrar')}
                  {sugg.reason === 'add_weight' && <span style={{ color: '#ff6600', marginLeft: 6 }}>↑ {t('overload', 'yüklenme')}</span>}
                  {sugg.reason === 'deload'     && <span style={{ color: '#e03030', marginLeft: 6 }}>{t('deload', 'hafifletme')}</span>}
                  {sugg.reason === 'gap_return' && <span style={{ color: '#888', marginLeft: 6 }}>{t('return', 'dönüş')}</span>}
                </div>
                {plates && !plates.barOnly && plates.plates.length > 0 && (
                  <div style={{ ...S.mono, fontSize: 9, color: '#888', marginTop: 3 }}>
                    {t('Plates per side', 'Her taraf')}: {plates.plates.map(p => `${p.kg}${p.count > 1 ? `×${p.count}` : ''}`).join(' + ')}
                  </div>
                )}
                {sugg.reorientation && (
                  <div style={{ ...S.mono, fontSize: 10, color: '#888', marginTop: 3 }}>
                    {t('Coming back — light first session, listen to your body.', 'Geri dönüş — ilk seans hafif olsun, vücudunu dinle.')}
                  </div>
                )}
              </div>
            )}

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 60px 32px 32px', gap: 6, marginBottom: rowIdx === 0 ? 2 : 4 }}>
              {['#', t('Reps','Tekrar'), t('kg','kg'), t('RIR','Yedek'), '', ''].map((h, i) => (
                <span key={i} style={{ ...lbl, marginBottom: 0 }}>{h}</span>
              ))}
            </div>
            {rowIdx === 0 && (
              <div style={{ ...S.mono, fontSize: 9, color: '#444', marginBottom: 6 }}>
                {t('RIR = reps left in tank · 2 = could do 2 more · 0 = max effort',
                   'RIR = tankta kalan tekrar · 2 = 2 tane daha yapabilirsin · 0 = maksimum')}
              </div>
            )}

            {row.sets.map((s, si) => {
              const doneKey = `${rowIdx}-${si}`
              const isDone  = !!doneSets[doneKey]
              return (
                <div key={si} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 60px 32px 32px', gap: 6, marginBottom: 4, alignItems: 'center', opacity: isDone ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                  <span style={{ ...S.mono, fontSize: 11, textAlign: 'center', color: isDone ? '#22aa44' : s.is_warmup ? '#888' : 'var(--text)' }}>
                    {isDone ? '✓' : `${s.set_number}${s.is_warmup ? 'W' : ''}`}
                  </span>
                  <input style={{ ...inp, background: isDone ? 'transparent' : undefined }} type="number" min={1} inputMode="numeric"
                    placeholder={pres ? `${pres.reps_low}–${pres.reps_high}` : '10'}
                    value={s.reps} onChange={e => updateSet(rowIdx, si, 'reps', e.target.value)} />
                  <input style={{ ...inp, background: isDone ? 'transparent' : undefined }} type="text" inputMode="decimal"
                    placeholder={sugg?.load_kg ? String(sugg.load_kg) : '—'}
                    value={s.load_kg} onChange={e => updateSet(rowIdx, si, 'load_kg', e.target.value)} />
                  <input style={{ ...inp, background: isDone ? 'transparent' : undefined }} type="number" min={0} max={5} inputMode="numeric"
                    placeholder={pres ? String(pres.rir ?? 2) : '2'}
                    value={s.rir} onChange={e => updateSet(rowIdx, si, 'rir', e.target.value)} />
                  <button
                    style={{ ...S.mono, fontSize: 9, border: '1px solid var(--border)', background: s.is_warmup ? '#ff660022' : 'transparent', color: s.is_warmup ? '#ff6600' : '#555', borderRadius: 3, cursor: 'pointer', padding: '4px 2px' }}
                    title={t('Toggle warmup', 'Isınma olarak işaretle')}
                    onClick={() => updateSet(rowIdx, si, 'is_warmup', !s.is_warmup)}>W</button>
                  <button
                    onClick={() => {
                      const wasAlreadyDone = doneSets[doneKey]
                      setDoneSets(d => ({ ...d, [doneKey]: !d[doneKey] }))
                      if (!wasAlreadyDone) {
                        const secs = pres?.rest_seconds ?? 90
                        setRestTimer({ rowIdx, seconds: secs, total: secs })
                      }
                    }}
                    style={{ ...S.mono, fontSize: 11, border: `1px solid ${isDone ? '#22aa44' : 'var(--border)'}`, background: isDone ? '#22aa4422' : 'transparent', color: isDone ? '#22aa44' : '#555', borderRadius: 3, cursor: 'pointer', padding: '4px 2px' }}
                    title={t('Mark set done', 'Seti tamamla')}>✓</button>
                </div>
              )
            })}

            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <button style={{ ...S.mono, fontSize: 10, padding: '4px 10px', border: '1px dashed var(--border)', background: 'transparent', color: '#888', borderRadius: 3, cursor: 'pointer' }} onClick={() => addSet(rowIdx)}>
                + {t('Add Set', 'Set Ekle')}
              </button>

              {/* Rest timer trigger */}
              {restTimer?.rowIdx !== rowIdx && (
                <button
                  onClick={() => { const secs = pres?.rest_seconds ?? 90; setRestTimer({ rowIdx, seconds: secs, total: secs }) }}
                  style={{ ...S.mono, fontSize: 10, padding: '4px 10px', border: '1px solid #0064ff44', background: 'transparent', color: '#0064ff', borderRadius: 3, cursor: 'pointer' }}>
                  REST {pres?.rest_seconds ?? 90}s
                </button>
              )}

              {/* Rest timer display */}
              {restTimer?.rowIdx === rowIdx && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(restTimer.seconds / restTimer.total) * 100}%`, background: restTimer.seconds > 0 ? '#0064ff' : '#22aa44', transition: 'width 0.9s linear, background 0.3s' }} />
                  </div>
                  <span style={{ ...S.mono, fontSize: 11, color: restTimer.seconds > 0 ? '#0064ff' : '#22aa44', minWidth: 40, textAlign: 'right' }}>
                    {restTimer.seconds > 0 ? `${restTimer.seconds}s` : t('Go!', 'Haydi!')}
                  </span>
                  <button onClick={() => setRestTimer(null)} style={{ ...S.mono, fontSize: 9, border: 'none', background: 'transparent', color: '#555', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                </div>
              )}
            </div>
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
        disabled={!hasFilledSets}
        onClick={handleSave}
        style={{ ...S.mono, fontSize: 12, padding: '10px 24px', border: 'none', background: hasFilledSets ? '#ff6600' : '#333', color: hasFilledSets ? '#fff' : '#555', borderRadius: 3, cursor: hasFilledSets ? 'pointer' : 'not-allowed', width: '100%' }}>
        {saved ? (lang === 'tr' ? '✓ KAYDEDİLDİ' : '✓ SAVED') : (lang === 'tr' ? 'ANTRENMANIM BİTTİ' : 'FINISH SESSION')}
      </button>
    </div>
  )
}
