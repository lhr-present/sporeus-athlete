// ─── QuickAddModal.jsx — One-click session logging from any tab ───────────────
// Opens via the `+` header button or FAB. Uses sport from profile for defaults.
// Valibot validates before submit; post-save confirmation guides next step.
import { useState, useEffect, useRef, useContext, useMemo } from 'react'
import * as v from 'valibot'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { LangCtx } from '../contexts/LangCtx.jsx'
import { useData } from '../contexts/DataContext.jsx'
import { S } from '../styles.js'
import { calcTSS } from '../lib/formulas.js'
import { SESSION_TYPES_BY_DISCIPLINE } from '../lib/constants.js'
import { addNotification } from '../lib/notificationCenter.js'
import { analyseSession } from '../lib/intelligence.js'
import { useWorkoutTemplates } from '../hooks/useWorkoutTemplates.js'
import { deriveAllMetrics } from '../lib/profileDerivedMetrics.js'
import { dailyPrescription } from '../lib/dailyPrescription.js'

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

// TSS estimate using profile-derived zones when available.
// Standard formula: t_hours × IF² × 100 (Coggan/TrainingPeaks).
// IF is the zone-midpoint intensity factor (NP/FTP proxy from HR zone).
// Falls back to generic RPE estimate when profile has no zone data.
const ZONE_IF_MIDPOINT = [0.50, 0.65, 0.83, 0.97, 1.10]  // HR zones 1-5
function estimateTSS(durationMin, rpe, metrics) {
  const zoneIdx = metrics?.hr?.rpeToZoneIdx?.[rpe - 1]
  if (zoneIdx != null) {
    const IF = ZONE_IF_MIDPOINT[Math.min(zoneIdx, 4)]
    return Math.round((durationMin / 60) * IF * IF * 100)
  }
  return calcTSS(durationMin, rpe)
}

// Returns a compact zone hint string for a given RPE (1-10), or null
function getZoneHint(rpe, metrics, _isTR) {
  if (!metrics) return null
  const zoneIdx = metrics.hr?.rpeToZoneIdx?.[rpe - 1] ?? null
  const hrZone = metrics.hr?.zones?.[zoneIdx]
  const rpeZoneNum = zoneIdx != null ? zoneIdx + 1 : null

  const parts = []
  if (rpeZoneNum) parts.push(`Z${rpeZoneNum}`)
  if (hrZone) parts.push(`${hrZone.min}–${hrZone.max} bpm`)

  // Pace hint: zones 1-5 → easy/aerobic/tempo/threshold/vo2max paces
  // metrics.running.paces values are already "M:SS" strings
  const paces = metrics.running?.paces
  if (paces && rpeZoneNum) {
    const paceMap = [paces.easy, paces.easy, paces.marathon, paces.threshold, paces.interval]
    const pace = paceMap[zoneIdx]
    if (pace) parts.push(`${pace}/km`)
  }
  // Power hint for cyclists (only when no running paces)
  const powerZones = metrics.power?.zones
  if (powerZones && rpeZoneNum && !paces) {
    const pz = powerZones[Math.min(zoneIdx, powerZones.length - 1)]
    if (pz) parts.push(`${pz.min}–${pz.max}W`)
  }

  if (parts.length === 0) return null
  return parts.join(' · ')
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
  const { log } = useData()

  const defaultType = SPORT_DEFAULT_TYPE[profile?.sport] || 'Easy Run'

  const [sessionDate, setSessionDate] = useState(today())
  const [type, setType]               = useState(defaultType)
  const [duration, setDuration]       = useState('45')
  const [rpe, setRpe]                 = useState(6)
  const [notes, setNotes]             = useState('')
  const [distanceKm, setDistanceKm]   = useState('')
  const [avgHr, setAvgHr]             = useState('')
  const [phase, setPhase]             = useState('form')   // 'form' | 'saved'
  const [errors, setErrors]           = useState({})
  const [sessionAnalysis, setSessionAnalysis] = useState(null)
  const { templates, saveTemplate }   = useWorkoutTemplates()
  const [savedEntry, setSavedEntry]   = useState(null)

  const metrics = useMemo(
    () => deriveAllMetrics(profile, log || [], []),
    [profile, log]
  )
  const [tplSaved, setTplSaved]       = useState(false)

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  useEffect(() => {
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

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
  const tss = dur > 0 ? estimateTSS(dur, rpe, metrics) : 0

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
      date:        sessionDate,
      type,
      duration:    dur,
      durationSec: dur * 60,
      rpe,
      tss,
      notes: notes.trim() || undefined,
      ...(distanceKm && parseFloat(distanceKm) > 0 ? { distanceKm: parseFloat(distanceKm) } : {}),
      ...(avgHr && parseInt(avgHr) >= 30 && parseInt(avgHr) <= 250 ? { avgHr: parseInt(avgHr) } : {}),
    }
    onAdd(entry)
    setSavedEntry(entry)
    addNotification('training', isTR ? 'Antrenman Kaydedildi' : 'Session Logged',
      `${type} · ${dur}min · ${tss} TSS`, { tab: 'log' })
    setSessionAnalysis(analyseSession(entry, (log || []).slice(-28)))
    setPhase('saved')
    setTimeout(onClose, 4000)
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
            <div style={{ fontSize: '9px', marginBottom: '4px', letterSpacing: '0.06em',
              color: isOnline ? '#5bc25b' : '#f5c542' }}>
              {isOnline
                ? (isTR ? '✓ Kaydedildi ve senkronize' : '✓ Saved & syncing')
                : (isTR ? '⚡ Çevrimdışı — yerel kayıt' : '⚡ Offline — saved locally')}
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: sessionAnalysis ? '8px' : '16px', lineHeight: 1.6 }}>
              {dur} min {type} · {isTR ? 'Antrenman Yükü' : 'Training Load'} {tss}
            </div>
            {savedEntry && savedEntry.date !== today() && (
              <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>
                {isTR ? `Tarih: ${savedEntry.date}` : `Date: ${savedEntry.date}`}
              </div>
            )}
            {sessionAnalysis && (
              <div style={{ fontSize: '10px', marginBottom: '12px', padding: '8px 10px', background: 'var(--surface)', borderRadius: '3px', textAlign: 'left', lineHeight: 1.8, fontFamily: "'IBM Plex Mono', monospace" }}>
                <div style={{ color: '#ccc' }}>{sessionAnalysis.comparison}</div>
                <div style={{ color: '#555', marginTop: '2px' }}>{isTR ? ({
                  'Allow 12h before next hard session': 'Sonraki zorlu seans için 12s bekle.',
                  'Allow 24h before next hard session': 'Sonraki zorlu seans için 24s bekle.',
                  'Allow 36h before next hard session': 'Sonraki zorlu seans için 36s bekle.',
                  'Allow 48h before next hard session': 'Sonraki zorlu seans için 48s bekle.',
                  'Allow 72h before next hard session': 'Sonraki zorlu seans için 72s bekle.',
                }[sessionAnalysis.recovery_time] || sessionAnalysis.recovery_time) : sessionAnalysis.recovery_time}</div>
              </div>
            )}
            {/* ── Zone mismatch flag ─────────────────────────────────── */}
            {savedEntry && (() => {
              const easyTypes = ['easy', 'recovery', 'aerobic']
              const hardTypes = ['threshold', 'interval', 'vo2max', 'sprint', 'race']
              const typeLower = (savedEntry.type || '').toLowerCase()
              const entryRpe  = savedEntry.rpe ?? 5
              const isEasy = easyTypes.some(t2 => typeLower.includes(t2))
              const isHard = hardTypes.some(t2 => typeLower.includes(t2))
              if (isEasy && entryRpe >= 8) {
                return (
                  <div style={{ fontSize: '10px', color: '#f5c542', padding: '6px 10px', background: '#1a1500', border: '1px solid #3a3000', borderRadius: '3px', marginBottom: '8px', textAlign: 'left', lineHeight: 1.5 }}>
                    {isTR
                      ? '⚠ Kolay günde yüksek efor — yarın bunu toparlanmaya say'
                      : '⚠ High effort on easy day — note this in your recovery tomorrow'}
                  </div>
                )
              }
              if (isHard && entryRpe <= 3) {
                return (
                  <div style={{ fontSize: '10px', color: '#f5c542', padding: '6px 10px', background: '#1a1500', border: '1px solid #3a3000', borderRadius: '3px', marginBottom: '8px', textAlign: 'left', lineHeight: 1.5 }}>
                    {isTR
                      ? '⚠ Zor günde düşük efor — yorgunluk birikip birikmediğini değerlendir'
                      : '⚠ Low effort on hard day — consider if fatigue is building'}
                  </div>
                )
              }
              return null
            })()}
            {/* ── Tomorrow nudge strip ───────────────────────────────── */}
            {savedEntry && (() => {
              try {
                const rx = dailyPrescription(profile, [...(log || []), savedEntry], null, null, null, null)
                const suggStr = rx?.tomorrow?.suggestion?.[isTR ? 'tr' : 'en']
                if (!suggStr) return null
                return (
                  <div style={{ color: '#888', fontSize: 11, marginTop: 8, borderTop: '1px solid #222', paddingTop: 6, textAlign: 'left' }}>
                    {isTR ? `Yarın → ${suggStr}` : `Tomorrow → ${suggStr}`}
                  </div>
                )
              } catch (_) {
                return null
              }
            })()}
            {isFirst && (
              <div style={{ fontSize: '10px', color: '#5bc25b', padding: '8px 12px', border: '1px solid #2a4a2a', borderRadius: '3px', marginBottom: '12px', lineHeight: 1.6 }}>
                {isTR ? '🏆 İlk adım tamamlandı. Bugün sekmesinde sonraki adımını gör.' : '🏆 First step done. Check the Today tab for your next step.'}
              </div>
            )}
            {savedEntry && !tplSaved && (
              <button type="button"
                onClick={() => { saveTemplate(savedEntry); setTplSaved(true) }}
                style={{ fontSize: '9px', color: '#555', background: 'none', border: '1px solid #333', borderRadius: '3px', padding: '3px 10px', cursor: 'pointer', fontFamily: MONO, marginBottom: '8px' }}
              >
                {isTR ? '+ Şablon olarak kaydet' : '+ Save as template'}
              </button>
            )}
            {tplSaved && <div style={{ fontSize: '9px', color: '#5bc25b', marginBottom: '8px' }}>✓ {isTR ? 'Şablon kaydedildi' : 'Template saved'}</div>}
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

            {/* ── Templates picker ───────────────────────────────────────── */}
            {templates.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.08em', marginBottom: '5px' }}>
                  {isTR ? 'ŞABLONDAN BAŞLAT' : 'START FROM TEMPLATE'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {templates.slice(0, 6).map(tpl => (
                    <button key={tpl.id} type="button"
                      onClick={() => { setType(tpl.type); setDuration(String(tpl.duration)); setRpe(tpl.rpe); setNotes(tpl.notes || '') }}
                      style={{ fontSize: '9px', padding: '3px 8px', background: '#1a1a1a', border: '1px solid #333', color: '#ccc', borderRadius: '3px', cursor: 'pointer', fontFamily: MONO }}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Date picker */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '5px' }}>
                  {isTR ? 'TARİH' : 'DATE'}
                </label>
                <input
                  type="date"
                  value={sessionDate}
                  max={today()}
                  onChange={e => setSessionDate(e.target.value)}
                  style={{ ...S.input, width: '100%', fontSize: 'max(16px, 14px)' }}
                />
              </div>

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
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  {[-15, -5, +5, +15].map(d => (
                    <button key={d} type="button"
                      onClick={() => setDuration(prev => String(Math.max(1, Math.min(600, (parseInt(prev) || 0) + d))))}
                      style={{ fontSize: '9px', padding: '3px 8px', background: '#1a1a1a', border: '1px solid #333', color: '#666', borderRadius: '3px', cursor: 'pointer', fontFamily: MONO }}
                    >{d > 0 ? '+' : ''}{d}</button>
                  ))}
                </div>
              </div>

              {/* Distance + Avg HR */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '5px' }}>
                    {isTR ? 'MESAFe (km)' : 'DISTANCE (km)'}
                    <span style={{ color: '#444', fontWeight: 400, marginLeft: '4px', textTransform: 'none', letterSpacing: 0 }}>
                      {isTR ? 'isteğe bağlı' : 'optional'}
                    </span>
                  </label>
                  <input type="number" inputMode="decimal" min={0} max={300} step={0.1}
                    value={distanceKm}
                    onChange={e => setDistanceKm(e.target.value)}
                    placeholder="0.0"
                    style={{ ...S.input, width: '100%', fontSize: 'max(16px, 14px)' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '5px' }}>
                    {isTR ? 'ORT. KALp (bpm)' : 'AVG HR (bpm)'}
                    <span style={{ color: '#444', fontWeight: 400, marginLeft: '4px', textTransform: 'none', letterSpacing: 0 }}>
                      {isTR ? 'isteğe bağlı' : 'optional'}
                    </span>
                  </label>
                  <input type="number" inputMode="numeric" min={30} max={250}
                    value={avgHr}
                    onChange={e => setAvgHr(e.target.value)}
                    placeholder="—"
                    style={{ ...S.input, width: '100%', fontSize: 'max(16px, 14px)' }}
                  />
                </div>
              </div>

              {/* RPE tap buttons */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '9px', color: '#888', letterSpacing: '0.08em', marginBottom: '5px' }}>
                  {t('quickAddRpe')} — <span style={{ color: '#ff6600', fontWeight: 700 }}>{rpe}</span>
                  <span style={{ color: '#555', fontWeight: 400, marginLeft: '6px', textTransform: 'none', letterSpacing: 0 }}>
                    ({effortLabel(rpe, lang)})
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRpe(n)}
                      style={{
                        width: '28px', height: '28px', fontSize: '11px', fontWeight: 700,
                        fontFamily: MONO, border: '1px solid',
                        borderColor: rpe === n ? '#ff6600' : '#333',
                        background: rpe === n ? '#ff6600' : '#1a1a1a',
                        color: rpe === n ? '#000' : '#888',
                        borderRadius: '3px', cursor: 'pointer', flexShrink: 0,
                      }}
                    >{n}</button>
                  ))}
                </div>
                {(() => {
                  const hint = getZoneHint(rpe, metrics, isTR)
                  return hint ? (
                    <div style={{
                      fontSize: '9px', color: '#ff6600', marginTop: '4px',
                      fontFamily: MONO, letterSpacing: '0.04em',
                    }}>
                      RPE {rpe} → {hint}
                    </div>
                  ) : null
                })()}
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

              {/* Offline badge */}
              {!isOnline && (
                <div style={{ fontSize: '8px', color: '#f5c542', textAlign: 'center', marginBottom: '8px', letterSpacing: '0.06em' }}>
                  ⚡ {isTR ? 'Çevrimdışı — kaydedilecek' : 'Offline — will save locally'}
                </div>
              )}

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
