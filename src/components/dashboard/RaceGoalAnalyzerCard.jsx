// src/components/dashboard/RaceGoalAnalyzerCard.jsx — E81
// Race goal input + full scientific parameter derivation.
// Enter current 10K time + goal 10K time → VDOT gap, training paces,
// predicted HR/LTHR, phase plan, VDOT checkpoints.
// All non-measured values labeled: PREDICTED / CALCULATED / DERIVED.
import { useState, useMemo } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { analyzeRaceGoal, parseMmSs } from '../../lib/athlete/raceGoalEngine.js'
import { S } from '../../styles.js'

const MONO = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREEN  = '#5bc25b'
const AMBER  = '#f5c542'
const RED    = '#e03030'
const DIM    = '#555'

const DIST_OPTIONS = [
  { label: '5K',            m: 5000  },
  { label: '10K',           m: 10000 },
  { label: 'Half Marathon', m: 21097 },
  { label: 'Marathon',      m: 42195 },
]

const FEASIBILITY_COLOR = { achievable: GREEN, ambitious: AMBER, stretch: ORANGE, extreme: RED }
const FEASIBILITY_EN    = { achievable: 'Achievable', ambitious: 'Ambitious', stretch: 'Stretch goal', extreme: 'Very long-term' }
const FEASIBILITY_TR    = { achievable: 'Ulaşılabilir', ambitious: 'Hırslı', stretch: 'Uzun vadeli', extreme: 'Çok uzun vadeli' }

const LABEL_COLORS = { MEASURED: GREEN, CALCULATED: AMBER, DERIVED: '#4a90d9', PREDICTED: ORANGE }

function LabelBadge({ label }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: '7px', letterSpacing: '0.06em',
      color: LABEL_COLORS[label] || DIM,
      border: `1px solid ${LABEL_COLORS[label] || DIM}44`,
      borderRadius: '2px', padding: '1px 4px', marginLeft: '5px',
    }}>
      {label}
    </span>
  )
}

function PaceRow({ zone, paceStr, isTR }) {
  const labels = {
    E: { en: 'Easy (aerobic)',      tr: 'Kolay (aerobik)',      color: GREEN  },
    M: { en: 'Marathon pace',       tr: 'Maraton temposu',      color: '#4a90d9' },
    T: { en: 'Threshold (LT2)',     tr: 'Eşik (LT2)',           color: AMBER  },
    I: { en: 'Interval (VO₂max)',   tr: 'Aralık (VO₂maks)',     color: ORANGE },
    R: { en: 'Repetition (speed)',  tr: 'Tekrar (hız)',         color: RED    },
  }
  const info = labels[zone] || { en: zone, tr: zone, color: DIM }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #111' }}>
      <span style={{ fontFamily: MONO, fontSize: '9px', color: info.color }}>
        {zone} — {isTR ? info.tr : info.en}
      </span>
      <span style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 700, color: '#ccc' }}>
        {paceStr || '—'}
      </span>
    </div>
  )
}

export default function RaceGoalAnalyzerCard({ profile, log, isTR }) {
  const [saved, setSaved] = useLocalStorage('sporeus-race-goal-v2', null)
  const [editing, setEditing] = useState(!saved)

  const [distM, setDistM]         = useState(saved?.distM || 10000)
  const [currentTime, setCurrentTime] = useState(saved?.currentTime || '')
  const [goalTime, setGoalTime]   = useState(saved?.goalTime || '')
  const [planStart, setPlanStart] = useState(saved?.planStart || '')
  const [error, setError]         = useState(null)

  const analysis = useMemo(() => {
    if (!saved) return null
    const cSec = parseMmSs(saved.currentTime)
    const gSec = parseMmSs(saved.goalTime)
    return analyzeRaceGoal(cSec, gSec, saved.distM || 10000, profile || {}, log || [])
  }, [saved, profile, log])

  function handleSave() {
    const cSec = parseMmSs(currentTime)
    const gSec = parseMmSs(goalTime)
    if (isNaN(cSec) || cSec <= 0) { setError(isTR ? 'Geçerli süre girin (örn. 50:00)' : 'Enter a valid current time (e.g. 50:00)'); return }
    if (isNaN(gSec) || gSec <= 0) { setError(isTR ? 'Hedef süre girin (örn. 40:00)' : 'Enter a valid goal time (e.g. 40:00)'); return }
    if (gSec >= cSec) { setError(isTR ? 'Hedef süre mevcut süreden hızlı olmalı' : 'Goal must be faster than current time'); return }
    setError(null)
    setSaved({ distM: parseInt(distM), currentTime, goalTime, planStart, savedAt: new Date().toISOString() })
    setEditing(false)
  }

  const lang = isTR ? 'tr' : 'en'

  return (
    <div style={{ ...S.card, fontFamily: MONO }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.1em' }}>
          ◈ {isTR ? 'YARIŞ HEDEFİ ANALİZİ' : 'RACE GOAL ANALYZER'}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            style={{ fontSize: '8px', color: DIM, background: 'none', border: '1px solid #2a2a2a', borderRadius: '2px', padding: '2px 7px', cursor: 'pointer', fontFamily: MONO }}
          >
            {isTR ? 'Düzenle' : 'Edit'}
          </button>
        )}
      </div>

      {/* ── Input form ────────────────────────────────────────────── */}
      {editing && (
        <div>
          {/* Distance */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '9px', color: '#888', letterSpacing: '0.06em', marginBottom: '4px' }}>
              {isTR ? 'MESAFe' : 'DISTANCE'}
            </div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {DIST_OPTIONS.map(d => (
                <button key={d.m} type="button"
                  onClick={() => setDistM(d.m)}
                  style={{
                    fontSize: '9px', padding: '3px 10px', fontFamily: MONO,
                    background: distM === d.m ? ORANGE : '#1a1a1a',
                    color: distM === d.m ? '#000' : '#888',
                    border: `1px solid ${distM === d.m ? ORANGE : '#333'}`,
                    borderRadius: '3px', cursor: 'pointer', fontWeight: distM === d.m ? 700 : 400,
                  }}
                >{d.label}</button>
              ))}
            </div>
          </div>

          {/* Current + Goal times */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: '#888', letterSpacing: '0.06em', marginBottom: '4px' }}>
                {isTR ? 'MEVCUT SÜRE' : 'CURRENT TIME'} <span style={{ color: '#444' }}>(mm:ss)</span>
              </div>
              <input
                type="text"
                value={currentTime}
                onChange={e => setCurrentTime(e.target.value)}
                placeholder="50:00"
                style={{ ...S.input, width: '100%', fontFamily: MONO, fontSize: 'max(16px, 12px)' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: ORANGE, letterSpacing: '0.06em', marginBottom: '4px' }}>
                {isTR ? 'HEDEF SÜRE' : 'GOAL TIME'} <span style={{ color: '#444' }}>(mm:ss)</span>
              </div>
              <input
                type="text"
                value={goalTime}
                onChange={e => setGoalTime(e.target.value)}
                placeholder="40:00"
                style={{ ...S.input, width: '100%', fontFamily: MONO, fontSize: 'max(16px, 12px)', borderColor: ORANGE + '66' }}
              />
            </div>
          </div>

          {/* Optional plan start */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '9px', color: '#555', letterSpacing: '0.06em', marginBottom: '4px' }}>
              {isTR ? 'PLAN BAŞLANGIÇ TARİHİ (isteğe bağlı)' : 'PLAN START DATE (optional)'}
            </div>
            <input
              type="date"
              value={planStart}
              onChange={e => setPlanStart(e.target.value)}
              style={{ ...S.input, width: '100%', fontFamily: MONO }}
            />
          </div>

          {error && <div style={{ fontSize: '9px', color: RED, marginBottom: '8px' }}>⚠ {error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {saved && (
              <button onClick={() => setEditing(false)} style={{ fontSize: '10px', color: DIM, background: 'none', border: '1px solid #2a2a2a', borderRadius: '3px', padding: '5px 12px', cursor: 'pointer', fontFamily: MONO, marginRight: '8px' }}>
                {isTR ? 'İptal' : 'Cancel'}
              </button>
            )}
            <button onClick={handleSave} style={{ ...S.btn, fontSize: '10px', padding: '5px 16px' }}>
              {isTR ? 'Analiz Et' : 'Analyze'}
            </button>
          </div>
        </div>
      )}

      {/* ── Analysis panel ──────────────────────────────────────── */}
      {!editing && analysis && (
        <div>
          {/* Time + VDOT header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: DIM, letterSpacing: '0.06em' }}>{isTR ? 'ŞU AN' : 'NOW'}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#ccc' }}>{analysis.currentTimeStr}</div>
              <div style={{ fontSize: '9px', color: DIM }}>VDOT {analysis.currentVdot}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', color: DIM }}>→</div>
              <div style={{ fontSize: '9px', color: FEASIBILITY_COLOR[analysis.feasibility] || AMBER, border: `1px solid ${FEASIBILITY_COLOR[analysis.feasibility] || AMBER}44`, borderRadius: '2px', padding: '2px 6px', letterSpacing: '0.05em' }}>
                {isTR ? FEASIBILITY_TR[analysis.feasibility] : FEASIBILITY_EN[analysis.feasibility]}
              </div>
              <div style={{ fontSize: '8px', color: DIM, marginTop: '2px' }}>
                +{analysis.vdotGap} VDOT · {analysis.weeksToGoal}w plan
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: ORANGE, letterSpacing: '0.06em' }}>{isTR ? 'HEDEF' : 'GOAL'}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: ORANGE }}>{analysis.goalTimeStr}</div>
              <div style={{ fontSize: '9px', color: DIM }}>VDOT {analysis.goalVdot}</div>
            </div>
          </div>

          {/* Current training paces */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.08em', marginBottom: '5px' }}>
              {isTR ? 'MEVCUT ANTRENMAN TEMPOLAR (Daniels)' : 'CURRENT TRAINING PACES (Daniels)'}
            </div>
            {analysis.currentPaces && Object.entries(analysis.currentPaces).map(([zone, pace]) => (
              <PaceRow key={zone} zone={zone} paceStr={pace} isTR={isTR} />
            ))}
          </div>

          {/* Goal paces (greyed target) */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '9px', color: '#2a2a2a', letterSpacing: '0.08em', marginBottom: '5px' }}>
              {isTR ? 'HEDEF ANTRENMAN TEMPOLAR' : 'GOAL TRAINING PACES'} <span style={{ color: '#1a1a1a' }}>({isTR ? 'ulaşılacak' : 'to reach'})</span>
            </div>
            {analysis.goalPaces && Object.entries(analysis.goalPaces).map(([zone, pace]) => (
              <div key={zone} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #0d0d0d' }}>
                <span style={{ fontFamily: MONO, fontSize: '9px', color: '#2a2a2a' }}>{zone}</span>
                <span style={{ fontFamily: MONO, fontSize: '10px', color: '#2a2a2a' }}>{pace}</span>
              </div>
            ))}
          </div>

          {/* Predicted parameters */}
          {Object.keys(analysis.predicted).length > 0 && (
            <div style={{ marginBottom: '12px', padding: '8px', background: '#0a0a0a', borderRadius: '3px' }}>
              <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.08em', marginBottom: '6px' }}>
                {isTR ? 'FİZYOLOJİK PARAMETRELer' : 'PHYSIOLOGICAL PARAMETERS'}
              </div>
              {analysis.predicted.maxHR && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#555' }}>Max HR</span>
                  <span style={{ fontSize: '10px', color: '#ccc', fontWeight: 700 }}>
                    {analysis.predicted.maxHR.value} bpm
                    <LabelBadge label={analysis.predicted.maxHR.label} />
                  </span>
                </div>
              )}
              {analysis.predicted.lthr && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#555' }}>LTHR</span>
                  <span style={{ fontSize: '10px', color: '#ccc', fontWeight: 700 }}>
                    {analysis.predicted.lthr.value} bpm
                    <LabelBadge label={analysis.predicted.lthr.label} />
                  </span>
                </div>
              )}
              {analysis.predicted.thresholdHRRange && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#555' }}>{isTR ? 'Eşik HR Zonu' : 'Threshold HR Zone'}</span>
                  <span style={{ fontSize: '10px', color: '#ccc', fontWeight: 700 }}>
                    {analysis.predicted.thresholdHRRange.low}–{analysis.predicted.thresholdHRRange.high} bpm
                    <LabelBadge label={analysis.predicted.thresholdHRRange.label} />
                  </span>
                </div>
              )}
              {analysis.predicted.thresholdPace && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#555' }}>{isTR ? 'Eşik Tempo' : 'Threshold Pace'}</span>
                  <span style={{ fontSize: '10px', color: AMBER, fontWeight: 700 }}>
                    {analysis.predicted.thresholdPace.value}
                    <LabelBadge label={analysis.predicted.thresholdPace.label} />
                  </span>
                </div>
              )}
              {/* Show methods in dim text */}
              <div style={{ marginTop: '5px', borderTop: '1px solid #111', paddingTop: '5px' }}>
                {Object.values(analysis.predicted).map((p, i) => (
                  <div key={i} style={{ fontSize: '8px', color: '#222', lineHeight: 1.6 }}>
                    {p.method}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekly TSS target */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '6px 8px', background: '#0a0a0a', borderRadius: '3px' }}>
            <div>
              <div style={{ fontSize: '9px', color: DIM }}>{isTR ? 'Güvenli Haftalık TSS Hedefi' : 'Safe Weekly TSS Target'}</div>
              <div style={{ fontSize: '8px', color: '#333', marginTop: '1px' }}>Gabbett 2016 · ACWR safe ramp (+5%)</div>
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: ORANGE }}>{analysis.safeWeeklyTSS}</div>
          </div>

          {/* Phase timeline */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.08em', marginBottom: '6px' }}>
              {isTR ? 'FAZ PLANI' : 'PHASE PLAN'}
            </div>
            {analysis.phases.map((phase, i) => (
              <div key={i} style={{ marginBottom: '6px', padding: '6px 8px', background: '#0a0a0a', borderRadius: '3px', borderLeft: `3px solid ${[GREEN, AMBER, ORANGE, RED][i] || DIM}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#ccc' }}>
                    {isTR ? phase.tr : phase.name}
                  </span>
                  <span style={{ fontSize: '9px', color: DIM }}>
                    {phase.weeks}w · {phase.tss} TSS/wk
                  </span>
                </div>
                <div style={{ fontSize: '8px', color: '#444', lineHeight: 1.5 }}>
                  {isTR ? phase.tr : phase.en}
                </div>
              </div>
            ))}
          </div>

          {/* VDOT checkpoints */}
          {analysis.checkpoints.length > 1 && (
            <div>
              <div style={{ fontSize: '9px', color: DIM, letterSpacing: '0.08em', marginBottom: '6px' }}>
                {isTR ? 'İLERLEME KONTROLLERİ' : 'PROGRESS CHECKPOINTS'}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {analysis.checkpoints.map((cp, i) => (
                  <div key={i} style={{ flex: '1 1 80px', padding: '5px 7px', background: '#0a0a0a', borderRadius: '3px', textAlign: 'center' }}>
                    <div style={{ fontSize: '8px', color: DIM }}>{cp.weeks}w</div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: AMBER }}>{cp.projectedTime}</div>
                    <div style={{ fontSize: '8px', color: '#444' }}>VDOT {cp.vdot}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Science footnote */}
          <div style={{ fontSize: '8px', color: '#222', marginTop: '10px', lineHeight: 1.6 }}>
            Daniels & Gilbert (1979) VDOT · Tanaka (2001) maxHR · Gabbett (2016) ACWR
          </div>
        </div>
      )}

      {/* No analysis yet */}
      {!editing && !analysis && (
        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '10px', color: '#444' }}>
          {isTR ? 'Hedef kaydedilemedi. Tekrar girin.' : 'Could not analyze goal. Try re-entering.'}
        </div>
      )}
    </div>
  )
}
