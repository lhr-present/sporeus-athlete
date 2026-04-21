// ─── MorningCheckIn.jsx — G5 morning readiness check-in modal ─────────────────
// 30-second check-in: HRV (optional) + sleep, energy, soreness.
// Saves to the recovery store (which already has hrv field).
// Shows HRV trend after save using computeHRVTrend (Plews 2013).

import { useState, useContext, useEffect, useRef } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { computeHRVTrend } from '../lib/hrv.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { S } from '../styles.js'

const MONO  = "'IBM Plex Mono', monospace"
const today = () => new Date().toISOString().slice(0, 10)

// Quick wellness fields for check-in (3 of the 5 — fastest to log)
const FIELDS = [
  { key: 'sleep',    label: { en: 'Sleep quality', tr: 'Uyku kalitesi' }   },
  { key: 'energy',   label: { en: 'Energy',         tr: 'Enerji'         }   },
  { key: 'soreness', label: { en: 'Soreness',        tr: 'Ağrı/Gerginlik' }  },
]

export default function MorningCheckIn({ onClose }) {
  const { lang } = useContext(LangCtx)
  const { recovery, setRecovery } = useData()
  const isTR = lang === 'tr'

  const [hrv,      setHRV]      = useState('')
  const [wellness, setWellness] = useState({ sleep: 3, energy: 3, soreness: 3 })
  const [saved,    setSaved]    = useState(false)
  const [trend,    setTrend]    = useState(null)

  const panelRef   = useRef(null)
  const overlayRef = useRef(null)
  useFocusTrap(panelRef, { onEscape: onClose })

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleOverlayClick = e => { if (e.target === overlayRef.current) onClose() }

  function handleSave() {
    const date    = today()
    const hrvVal  = parseFloat(hrv) > 0 ? parseFloat(hrv) : null

    // Compute a simple overall score (0–100) from the 3 wellness fields
    const avgField = (wellness.sleep + wellness.energy + (6 - wellness.soreness)) / 3  // soreness inverted
    const score    = Math.round(avgField / 5 * 100)

    const entry = {
      date,
      score,
      sleepHrs: null,
      soreness:  wellness.soreness,
      stress:    3,
      mood:      wellness.energy,
      hrv:       hrvVal,
      notes:     '',
    }

    setRecovery(prev => {
      const without = prev.filter(e => e.date !== date)
      return [...without, entry]
    })

    // Compute HRV trend with the new data appended
    const withNew = [...recovery.filter(e => e.date !== date), entry]
    setTrend(computeHRVTrend(withNew))
    setSaved(true)
  }

  const TREND_COLORS = { stable: '#5bc25b', warning: '#f5c542', unstable: '#e03030', insufficient_data: '#555' }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={isTR ? 'Sabah hazırlık girişi' : 'Morning readiness check-in'}
        style={{
          background: 'var(--card-bg, #111)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          padding: '20px 24px',
          width: '100%',
          maxWidth: '360px',
          fontFamily: MONO,
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#ff6600', letterSpacing: '0.1em' }}>
            🌅 {isTR ? 'SABAH HAZIRLIĞİ' : 'MORNING READINESS'}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: '16px', padding: '0 4px' }}
          >
            ×
          </button>
        </div>

        {saved ? (
          /* ── Saved — show HRV trend ──────────────────────────────────── */
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>✓</div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#ff6600', marginBottom: '10px' }}>
              {isTR ? 'Kaydedildi' : 'Logged'}
            </div>
            {trend && (
              <div style={{
                fontSize: '10px', padding: '10px 12px', borderRadius: '3px',
                border: `1px solid ${TREND_COLORS[trend.trend] || '#333'}`,
                textAlign: 'left', lineHeight: 1.6,
              }}>
                <div style={{ color: TREND_COLORS[trend.trend], fontWeight: 700, marginBottom: '4px', fontSize: '9px', letterSpacing: '0.06em' }}>
                  HRV — {trend.trend.replace('_', ' ').toUpperCase()}
                </div>
                <div style={{ color: '#888' }}>
                  {trend.interpretation[lang] || trend.interpretation.en}
                </div>
              </div>
            )}
            <button onClick={onClose} style={{ ...S.btnSec, marginTop: '14px', fontSize: '10px' }}>
              {isTR ? 'Kapat' : 'Close'}
            </button>
          </div>
        ) : (
          /* ── Form ────────────────────────────────────────────────────── */
          <>
            {/* HRV input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '5px' }}>
                HRV (ms) — {isTR ? 'isteğe bağlı' : 'optional'}
              </label>
              <input
                type="number"
                inputMode="decimal"
                min={10}
                max={200}
                value={hrv}
                onChange={e => setHRV(e.target.value)}
                placeholder="e.g. 68"
                style={{ ...S.input, width: '100%', fontSize: 'max(16px,14px)' }}
              />
              <div style={{ fontSize: '9px', color: '#444', marginTop: '3px' }}>
                {isTR ? 'Uygulamanızın RMSSD değerini girin.' : 'Enter RMSSD from your HRV app.'}
              </div>
            </div>

            {/* Wellness sliders */}
            {FIELDS.map(f => (
              <div key={f.key} style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  {f.label[lang] || f.label.en}
                  <span style={{ color: '#ff6600', fontWeight: 700, marginLeft: '6px' }}>
                    {wellness[f.key]}/5
                  </span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={wellness[f.key]}
                  onChange={e => setWellness(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: '#ff6600', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#444', marginTop: '1px' }}>
                  <span>1 {isTR ? 'Kötü' : 'Poor'}</span>
                  <span>5 {isTR ? 'Mükemmel' : 'Great'}</span>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="button" onClick={onClose} style={{ ...S.btnSec, fontSize: '11px', padding: '7px 14px' }}>
                {isTR ? 'İptal' : 'Cancel'}
              </button>
              <button onClick={handleSave} style={{ ...S.btn, fontSize: '11px', padding: '7px 16px' }}>
                {isTR ? 'Kaydet' : 'Log'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
