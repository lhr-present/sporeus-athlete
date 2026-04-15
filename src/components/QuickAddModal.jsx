// ─── QuickAddModal.jsx — One-click session logging from any tab ───────────────
// Opens via the `+` header button. Picks sport type, duration, RPE → computes
// TSS via calcTSS (RPE-based), adds to the training log, fires a notification.
import { useState, useEffect, useRef, useContext } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { S } from '../styles.js'
import { calcTSS } from '../lib/formulas.js'
import { SESSION_TYPES_BY_DISCIPLINE } from '../lib/constants.js'
import { addNotification } from '../lib/notificationCenter.js'

const MONO = "'IBM Plex Mono', monospace"
const today = () => new Date().toISOString().slice(0, 10)

const ALL_TYPES = Object.values(SESSION_TYPES_BY_DISCIPLINE).flat()

export default function QuickAddModal({ onAdd, onClose }) {
  const { t, lang } = useContext(LangCtx)

  const [type, setType]         = useState('Easy Run')
  const [duration, setDuration] = useState('')
  const [rpe, setRpe]           = useState(6)
  const [notes, setNotes]       = useState('')
  const [saved, setSaved]       = useState(false)

  const firstRef = useRef(null)
  useEffect(() => { firstRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Click-outside to close
  const overlayRef = useRef(null)
  const handleOverlayClick = e => { if (e.target === overlayRef.current) onClose() }

  const dur = parseInt(duration) || 0
  const tss = dur > 0 ? calcTSS(dur, rpe) : 0

  function handleSubmit(e) {
    e.preventDefault()
    if (!dur || dur < 1) return

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
    addNotification('training', lang === 'tr' ? 'Antrenman Kaydedildi' : 'Session Logged',
      `${type} · ${dur}min · ${tss} TSS`, { tab: 'log' })
    setSaved(true)
    setTimeout(onClose, 700)
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
      <div style={{
        background: 'var(--card-bg, #111)', border: '1px solid var(--border)',
        borderRadius: '4px', padding: '20px 24px', width: '100%', maxWidth: '380px',
        fontFamily: MONO, boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.1em' }}>
            ⚡ {t('quickAddTitle')}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: '16px', padding: '0 4px' }}>×</button>
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
              min={1}
              max={600}
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="60"
              style={{ ...S.input, width: '100%' }}
            />
          </div>

          {/* RPE slider */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '5px' }}>
              {t('quickAddRpe')} — <span style={{ color: '#ff6600', fontWeight: 700 }}>{rpe}</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={rpe}
              onChange={e => setRpe(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#ff6600', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#444', marginTop: '2px' }}>
              <span>1 Easy</span><span>5 Moderate</span><span>10 Max</span>
            </div>
          </div>

          {/* TSS preview */}
          {dur > 0 && (
            <div style={{ marginBottom: '14px', padding: '8px', background: 'var(--surface)', borderRadius: '3px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: '#888' }}>{t('quickAddEstTss')}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#ff6600' }}>{tss}</span>
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
              disabled={!dur || saved}
              style={{ ...S.btn, fontSize: '11px', padding: '7px 16px', opacity: (!dur || saved) ? 0.5 : 1 }}
            >
              {saved ? '✓' : t('quickAddSave')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
