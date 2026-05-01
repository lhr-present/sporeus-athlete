// ─── MorningCheckIn.jsx — G5 morning readiness check-in modal ─────────────────
// 30-second check-in: HRV (optional) + sleep, energy, soreness.
// Saves to the recovery store (which already has hrv field).
// Shows HRV trend after save using computeHRVTrend (Plews 2013) plus the
// composite E17 readiness score (computeReadinessScore) with bilingual drivers
// and a session recommendation.

import { useState, useContext, useEffect, useRef } from 'react'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { computeHRVTrend } from '../lib/hrv.js'
import { computeReadinessScore } from '../lib/recovery/readinessScore.js'
import { recommendSession } from '../lib/recovery/sessionRecommendation.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { announce } from '../lib/a11y/announcer.js'
import { S } from '../styles.js'

const MONO  = "'IBM Plex Mono', monospace"
const today = () => new Date().toISOString().slice(0, 10)

// Quick wellness fields for check-in (3 of the 5 — fastest to log)
const FIELDS = [
  { key: 'sleep',    label: { en: 'Sleep quality', tr: 'Uyku kalitesi' }   },
  { key: 'energy',   label: { en: 'Energy',         tr: 'Enerji'         }   },
  { key: 'soreness', label: { en: 'Soreness',        tr: 'Ağrı/Gerginlik' }  },
]

// Score → color band (matches TREND_COLORS palette).
function scoreColor(score) {
  if (score == null) return '#555'
  if (score >= 80) return '#5bc25b'   // push — green
  if (score >= 60) return '#9bd14b'   // planned — light green
  if (score >= 40) return '#f5c542'   // easy — yellow
  return '#e03030'                    // recovery — red
}

const RELIABILITY_LABEL = {
  full:    { en: 'data complete', tr: 'veri tam' },
  partial: { en: 'partial data',   tr: 'kısmi veri' },
  low:     { en: 'limited data',   tr: 'yetersiz veri' },
}

const SESSION_LABEL = {
  recovery: { en: 'RECOVERY', tr: 'TOPARLANMA' },
  easy:     { en: 'EASY',      tr: 'KOLAY' },
  planned:  { en: 'PLANNED',   tr: 'PLANLI' },
  push:     { en: 'PUSH',      tr: 'YÜKLEN' },
}

export default function MorningCheckIn({ onClose }) {
  const { lang } = useContext(LangCtx)
  const { recovery, setRecovery } = useData()
  const isTR = lang === 'tr'

  const [hrv,       setHRV]      = useState('')
  const [sleepHrs,  setSleepHrs] = useState(7)
  const [wellness,  setWellness] = useState({ sleep: 3, energy: 3, soreness: 3 })
  const [saved,     setSaved]    = useState(false)
  const [trend,     setTrend]    = useState(null)
  const [readiness, setReadiness] = useState(null)        // { score, drivers, reliability, components }
  const [recommendation, setRecommendation] = useState(null)  // { recommended, reason, ... }

  const panelRef   = useRef(null)
  const overlayRef = useRef(null)
  useFocusTrap(panelRef, { onEscape: onClose })

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Announce modal open to assistive technology (WCAG 4.1.3 Status Messages).
  useEffect(() => {
    announce(isTR ? 'Sabah kontrolü açıldı' : 'Morning check-in opened', 'polite')
    // Run only on mount — re-running on lang flip would re-announce mid-modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOverlayClick = e => { if (e.target === overlayRef.current) onClose() }

  function handleSave() {
    const date    = today()
    const hrvVal  = parseFloat(hrv) > 0 ? parseFloat(hrv) : null

    // ── E17 composite readiness ───────────────────────────────────────────
    // The check-in form has no separate mood slider; reuse `wellness.energy`
    // (1–5) as the mood proxy — Foster 1998 wellness items overlap heavily.
    const sorenessScale10 = (wellness.soreness - 1) * (9 / 4) + 1   // 1–5 → 1–10

    const baseRecovery = Array.isArray(recovery) ? recovery : []
    const allEntries   = baseRecovery.filter(e => e.date !== date)

    const hrvHistory = allEntries
      .filter(e => parseFloat(e.hrv) > 0)
      .map(e => ({ date: e.date, hrv: parseFloat(e.hrv) }))
    if (hrvVal != null) hrvHistory.push({ date, hrv: hrvVal })

    const sleepHistory = allEntries
      .filter(e => parseFloat(e.sleepHrs) > 0)
      .map(e => ({ date: e.date, sleepHrs: parseFloat(e.sleepHrs) }))
    sleepHistory.push({ date, sleepHrs: parseFloat(sleepHrs) })

    const result = computeReadinessScore({
      hrvHistory,
      sleepHistory,
      soreness: sorenessScale10,
      mood:     wellness.energy,    // energy slider doubles as mood proxy
      asOf:     date,
    })

    const score = result.score   // composite (0–100) or null

    const entry = {
      date,
      score,
      sleepHrs: String(sleepHrs),
      sleep:     wellness.sleep,
      energy:    wellness.energy,
      soreness:  wellness.soreness,
      stress:    3,
      mood:      3,
      hrv:       hrvVal,
      notes:     '',
    }

    setRecovery(prev => {
      const without = (Array.isArray(prev) ? prev : []).filter(e => e.date !== date)
      return [...without, entry]
    })

    // Compute HRV trend with the new data appended
    const withNew = [...baseRecovery.filter(e => e.date !== date), entry]
    setTrend(computeHRVTrend(withNew))
    setReadiness(result)
    setRecommendation(recommendSession(score, null))
    setSaved(true)
    announce(isTR ? 'Kontrol kaydedildi' : 'Check-in saved', 'polite')
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
          /* ── Saved — show readiness composite + drivers + HRV trend ─── */
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: '20px', marginBottom: '6px' }}>✓</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#ff6600', marginBottom: '12px' }}>
              {isTR ? 'Kaydedildi' : 'Logged'}
            </div>

            {/* Composite readiness score */}
            {readiness && (
              <div
                data-testid="readiness-card"
                style={{
                  border: `1px solid ${scoreColor(readiness.score)}`,
                  borderRadius: '3px', padding: '10px 12px', marginBottom: '8px',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '9px', color: '#888', letterSpacing: '0.08em' }}>
                    {isTR ? 'HAZIR OLMA' : 'READINESS'}
                  </span>
                  <span data-testid="reliability-badge" style={{ fontSize: '8px', color: '#888', letterSpacing: '0.06em' }}>
                    {RELIABILITY_LABEL[readiness.reliability]?.[lang] || RELIABILITY_LABEL[readiness.reliability]?.en}
                  </span>
                </div>
                {readiness.score == null ? (
                  <div data-testid="readiness-empty" style={{ fontSize: '11px', color: '#888' }}>
                    {isTR ? 'Yetersiz veri' : 'Insufficient data'}
                  </div>
                ) : (
                  <div data-testid="readiness-score" style={{
                    fontSize: '24px', fontWeight: 700, color: scoreColor(readiness.score),
                    lineHeight: 1, marginBottom: '8px',
                  }}>
                    {readiness.score}<span style={{ fontSize: '11px', color: '#666' }}>/100</span>
                  </div>
                )}

                {/* Top-2 drivers — bilingual reason text from the lib */}
                {readiness.drivers && readiness.drivers.length > 0 && readiness.score != null && (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0 0' }}>
                    {readiness.drivers.slice(0, 2).map((d, i) => (
                      <li
                        key={d.factor + i}
                        data-testid={`driver-${d.factor}`}
                        style={{
                          fontSize: '9px', color: '#aaa', lineHeight: 1.4,
                          marginTop: '3px', paddingLeft: '8px',
                          borderLeft: `2px solid ${d.delta < 0 ? '#e03030' : '#5bc25b'}`,
                        }}
                      >
                        {d.reason[lang] || d.reason.en}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Session recommendation */}
            {recommendation && (
              <div
                data-testid="session-recommendation"
                style={{
                  border: '1px solid #333', borderRadius: '3px',
                  padding: '8px 10px', marginBottom: '8px', textAlign: 'left',
                }}
              >
                <div style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em',
                  color: scoreColor(recommendation.score),
                  marginBottom: '3px',
                }}>
                  {isTR ? 'BUGÜN' : 'TODAY'} —{' '}
                  <span data-testid="rec-kind">
                    {SESSION_LABEL[recommendation.recommended]?.[lang]
                      || SESSION_LABEL[recommendation.recommended]?.en
                      || recommendation.recommended.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '9px', color: '#888', lineHeight: 1.4 }}>
                  {recommendation.reason[lang] || recommendation.reason.en}
                </div>
              </div>
            )}

            {/* HRV trend (legacy display retained) */}
            {trend && (
              <div style={{
                fontSize: '10px', padding: '8px 10px', borderRadius: '3px',
                border: `1px solid ${TREND_COLORS[trend.trend] || '#333'}`,
                textAlign: 'left', lineHeight: 1.5,
              }}>
                <div style={{ color: TREND_COLORS[trend.trend], fontWeight: 700, marginBottom: '3px', fontSize: '9px', letterSpacing: '0.06em' }}>
                  HRV — {trend.trend.replace('_', ' ').toUpperCase()}
                </div>
                <div style={{ color: '#888' }}>
                  {trend.interpretation[lang] || trend.interpretation.en}
                </div>
              </div>
            )}

            <button onClick={onClose} style={{ ...S.btnSec, marginTop: '12px', fontSize: '10px' }}>
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

            {/* Sleep hours slider */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '4px' }}>
                {isTR ? 'Uyku (s)' : 'Sleep (h)'}
                <span style={{ color: '#ff6600', fontWeight: 700, marginLeft: '6px' }}>
                  {sleepHrs}h
                </span>
              </label>
              <input
                type="range"
                min={4}
                max={10}
                step={0.5}
                value={sleepHrs}
                onChange={e => setSleepHrs(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#ff6600', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#444', marginTop: '1px' }}>
                <span>4h</span>
                <span>10h</span>
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
