// ─── QuickAddModal.jsx — One-click session logging from any tab ───────────────
// Opens via the `+` header button or FAB. Uses sport from profile for defaults.
// Valibot validates before submit; post-save confirmation guides next step.
import { useState, useEffect, useRef, useContext } from 'react'
import * as v from 'valibot'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { calcTSS } from '../lib/formulas.js'
import { SESSION_TYPES_BY_DISCIPLINE } from '../lib/constants.js'
import { addNotification } from '../lib/notificationCenter.js'

const MONO = "'IBM Plex Mono', monospace"
const today = () => new Date().toISOString().slice(0, 10)

// Sport → sensible default session type
const SPORT_DEFAULT_TYPE = {
  Running:   'Easy Run',
  Cycling:   'Easy Ride',
  Swimming:  'Easy Swim',
  Triathlon: 'Easy Run',
  Rowing:    'Easy Run',
  Other:     'Easy Run',
}

// Brief plain-language description of the effort level
function effortLabel(rpe, lang) {
  const levels = [
    { max: 3, en: 'Very easy — recovery pace',     tr: 'Çok kolay — toparlanma temposu' },
    { max: 5, en: 'Easy — aerobic base building',  tr: 'Kolay — aerobik taban çalışması' },
    { max: 7, en: 'Moderate — comfortably hard',   tr: 'Orta — rahatça zorlu' },
    { max: 9, en: 'Hard — threshold effort',       tr: 'Zor — eşik çalışması' },
    { max: 10, en: 'Maximal — race / all-out',     tr: 'Maksimal — yarış / tüm güç' },
  ]
  const hit = levels.find(l => rpe <= l.max) || levels[levels.length - 1]
  return lang === 'tr' ? hit.tr : hit.en
}

// Valibot schema — validates the form before submit
const SessionSchema = v.object({
  type:     v.pipe(v.string(), v.minLength(1)),
  duration: v.pipe(v.number(), v.minValue(1, 'Min 1 min'), v.maxValue(720, 'Max 720 min')),
  rpe:      v.pipe(v.number(), v.minValue(1), v.maxValue(10)),
  notes:    v.optional(v.pipe(v.string(), v.maxLength(500))),
})

export default function QuickAddModal({ onAdd, onClose, profile, isFirst }) {
  const { t, lang } = useContext(LangCtx)
  const isTR = lang === 'tr'

  const defaultType = SPORT_DEFAULT_TYPE[profile?.sport] || 'Easy Run'

  const [type, setType]         = useState(defaultType)
  const [duration, setDuration] = useState('45')
  const [rpe, setRpe]           = useState(6)
  const [notes, setNotes]       = useState('')
  const [phase, setPhase]       = useState('form')   // 'form' | 'saved'
  const [errors, setErrors]     = useState({})

  const firstRef = useRef(null)
  useEffect(() => { firstRef.current?.focus() }, [])

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const overlayRef = useRef(null)
  const panelRef   = useRef(null)
  useFocusTrap(panelRef, { onEscape: onClose })
  const handleOverlayClick = e => { if (e.target === overlayRef.current) onClose() }

  const dur = parseInt(duration) || 0
  const tss = dur > 0 ? calcTSS(dur, rpe) : 0

  function handleSubmit(e) {
    e.preventDefault()
    const result = v.safeParse(SessionSchema, { type, duration: dur, rpe, notes: notes.trim() || undefined })
    if (!result.success) {
      const errs = {}
      result.issues?.forEach(issue => {
        const key = issue.path?.[0]?.key
        if (key) errs[key] = issue.message
      })
      setErrors(errs)
      return
    }
    setErrors({})

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(10) } catch (_) {}
    }

    const entry = {
      date:        today(),
      type,
      duration:    dur,
      durationSec: dur * 60,
      rpe,
      tss,
      notes: notes.trim() || undefined,
    }
    onAdd(entry)
    addNotification('training', isTR ? 'Antrenman Kaydedildi' : 'Session Logged',
      `${type} · ${dur}min · ${tss} TSS`, { tab: 'log' })
    setPhase('saved')
    setTimeout(onClose, 2200)
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true"
        aria-label={isTR ? 'Antrenman ekle' : 'Log session'}
        style={{
          background: 'var(--card-bg, #111)', border: '1px solid var(--border)',
          borderRadius: '4px', padding: '20px 24px', width: '100%', maxWidth: '380px',
          fontFamily: MONO, boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* ── Saved confirmation ─────────────────────────────────────────── */}
        {phase === 'saved' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#ff6600', marginBottom: '6px' }}>
              {isTR ? 'Antrenman kaydedildi' : 'Session logged'}
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '16px', lineHeight: 1.6 }}>
              {dur} min {type} · {isTR ? 'Antrenman Yükü' : 'Training Load'} {tss}
            </div>
            {isFirst && (
              <div style={{ fontSize: '10px', color: '#5bc25b', padding: '8px 12px', border: '1px solid #2a4a2a', borderRadius: '3px', marginBottom: '12px', lineHeight: 1.6 }}>
                {isTR ? '🏆 İlk adım tamamlandı. Bugün sekmesinde sonraki adımını gör.' : '🏆 First step done. Check the Today tab for your next step.'}
              </div>
            )}
            <div style={{ fontSize: '9px', color: '#444' }}>
              {isTR ? 'Kapatılıyor...' : 'Closing…'}
            </div>
          </div>
        ) : (
          <>
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.1em' }}>
                ⚡ {t('quickAddTitle')}
              </div>
              <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: '16px', padding: '0 4px' }}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Session type */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '5px' }}>
                  {t('quickAddSport')}
                </label>
                <select
                  ref={firstRef}
                  value={type}
                  onChange={e => setType(e.target.value)}
                  style={{ ...S.input, width: '100%' }}
                >
                  {Object.entries(SESSION_TYPES_BY_DISCIPLINE).map(([group, types]) => (
                    <optgroup key={group} label={group}>
                      {types.map(t2 => <option key={t2} value={t2}>{t2}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Duration */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '5px' }}>
                  {t('quickAddDuration')}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={600}
                  value={duration}
                  onChange={e => { setDuration(e.target.value); setErrors(er => ({ ...er, duration: undefined })) }}
                  placeholder="45"
                  style={{ ...S.input, width: '100%', fontSize: 'max(16px, 14px)', borderColor: errors.duration ? '#e03030' : undefined }}
                />
                {errors.duration && <div style={{ fontSize: '9px', color: '#e03030', marginTop: '3px' }}>{errors.duration}</div>}
              </div>

              {/* RPE slider */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '5px' }}>
                  {t('quickAddRpe')} — <span style={{ color: '#ff6600', fontWeight: 700 }}>{rpe}</span>
                  <span style={{ color: '#555', fontWeight: 400, marginLeft: '6px', textTransform: 'none', letterSpacing: 0 }}>
                    ({effortLabel(rpe, lang)})
                  </span>
                </label>
                <input
                  type="range" min={1} max={10} step={1} value={rpe}
                  onChange={e => setRpe(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#ff6600', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#444', marginTop: '2px' }}>
                  <span>1 {isTR ? 'Kolay' : 'Easy'}</span>
                  <span>5 {isTR ? 'Orta' : 'Mod'}</span>
                  <span>10 {isTR ? 'Maks' : 'Max'}</span>
                </div>
              </div>

              {/* Training load preview — "Training Load" instead of "Est. TSS" */}
              {dur > 0 && (
                <div style={{ marginBottom: '14px', padding: '8px', background: 'var(--surface)', borderRadius: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '10px', color: '#888' }}>
                      {isTR ? 'Antrenman Yükü' : 'Training Load'}
                      <span style={{ fontSize: '9px', color: '#555', marginLeft: '4px' }}>(TSS)</span>
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#ff6600' }}>{tss}</span>
                  </div>
                  <div style={{ fontSize: '9px', color: '#555', marginTop: '3px', lineHeight: 1.4 }}>
                    {isTR
                      ? `${dur} dk × RPE ${rpe} → Foster 2001 sRPE yöntemi`
                      : `${dur} min × RPE ${rpe} → Foster 2001 sRPE method`}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '5px' }}>
                  {t('quickAddNotes')}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  maxLength={200}
                  style={{ ...S.input, width: '100%' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} style={{ ...S.btnSec, fontSize: '11px', padding: '7px 14px' }}>
                  {t('quickAddCancel')}
                </button>
                <button
                  type="submit"
                  disabled={!dur}
                  style={{ ...S.btn, fontSize: '11px', padding: '7px 16px', opacity: !dur ? 0.5 : 1 }}
                >
                  {t('quickAddSave')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
