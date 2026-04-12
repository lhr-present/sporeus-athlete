// src/components/CycleTracker.jsx — Female athlete menstrual cycle tracker
// localStorage-only (privacy). 4 phases. HRV overlay on 28-day chart.
import { useState, useMemo } from 'react'
import { S } from '../styles.js'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { currentCyclePhase, cycleDay, daysUntilPhase, PHASE_INFO } from '../lib/cycleUtils.js'
import { useData } from '../contexts/DataContext.jsx'

const MONO   = "'IBM Plex Mono', monospace"
const ORANGE = '#ff6600'
const GREY   = '#555'

export default function CycleTracker() {
  const [lang]    = useLocalStorage('sporeus-lang', 'en')
  const [cycle, setCycle] = useLocalStorage('sporeus_cycle', {})
  const [expanded, setExpanded]  = useState(false)
  const [editing,  setEditing]   = useState(false)
  const [draftStart, setDraftStart] = useState('')
  const [draftLen,   setDraftLen]   = useState('28')
  const { recovery } = useData()

  const today = new Date().toISOString().slice(0, 10)
  const cycleLength = Number(cycle.cycleLength) || 28
  const lastPeriod  = cycle.lastPeriodStart || null

  const phase   = lastPeriod ? currentCyclePhase(lastPeriod, cycleLength, today) : null
  const dayNum  = lastPeriod ? cycleDay(lastPeriod, cycleLength, today) : null
  const info    = phase ? PHASE_INFO[phase] : null
  const pLabel  = info ? (lang === 'tr' ? info.tr.label : info.en.label) : '—'
  const pTip    = info ? (lang === 'tr' ? info.tr.tip   : info.en.tip)   : ''
  const pColor  = info ? info.color : GREY

  const nextOvulation = lastPeriod ? daysUntilPhase(lastPeriod, cycleLength, 'ovulation', today) : null
  const nextPeriod    = lastPeriod ? daysUntilPhase(lastPeriod, cycleLength, 'menstruation', today) : null

  // HRV sparkline with phase background — last 28 days
  const hrvChart = useMemo(() => {
    if (!lastPeriod || !recovery?.length) return null
    const cutoff = (() => { const d = new Date(today); d.setDate(d.getDate() - 27); return d.toISOString().slice(0, 10) })()
    const pts = [...recovery]
      .filter(e => e.date >= cutoff && e.hrv)
      .sort((a, b) => a.date > b.date ? 1 : -1)
      .map(e => ({ date: e.date, hrv: parseFloat(e.hrv) }))
      .filter(e => !isNaN(e.hrv))
    if (pts.length < 2) return null
    return pts
  }, [recovery, lastPeriod, today])

  function save() {
    const len = Math.max(21, Math.min(45, Number(draftLen) || 28))
    if (!draftStart) return
    setCycle({ lastPeriodStart: draftStart, cycleLength: len })
    setEditing(false)
  }

  function openEdit() {
    setDraftStart(lastPeriod || today)
    setDraftLen(String(cycleLength))
    setEditing(true)
  }

  const lbl = {
    en: {
      title: 'CYCLE TRACKER',
      phase: 'CURRENT PHASE', day: 'CYCLE DAY',
      nextOv: 'days to ovulation', nextPd: 'days to next period',
      edit: 'UPDATE CYCLE', save: 'SAVE', cancel: 'CANCEL',
      lastPeriod: 'LAST PERIOD START', cycleLen: 'CYCLE LENGTH (days)',
      notSet: 'Not configured — tap to set your cycle.',
      hrv28: 'HRV — 28 DAYS (with phase overlay)',
    },
    tr: {
      title: 'DÖNGÜ TAKİBİ',
      phase: 'MEVCUT FAZ', day: 'DÖNGÜ GÜNÜ',
      nextOv: 'ovülasyona gün', nextPd: 'sonraki adetle gün',
      edit: 'DÖNGÜ GÜNCELLE', save: 'KAYDET', cancel: 'İPTAL',
      lastPeriod: 'SON ADET BAŞLANGICI', cycleLen: 'DÖNGÜ SÜRESİ (gün)',
      notSet: 'Ayarlanmamış — döngünüzü girin.',
      hrv28: 'KALPATİMİ DEĞİŞKENLİĞİ — 28 GÜN',
    },
  }
  const L = lbl[lang] || lbl.en

  // SVG HRV chart with phase colour bands
  function HRVPhaseChart({ pts }) {
    const W = 280, H = 60, pad = { t: 6, b: 16, l: 4, r: 4 }
    const iW = W - pad.l - pad.r
    const iH = H - pad.t - pad.b
    const vals = pts.map(p => p.hrv)
    const min = Math.min(...vals), max = Math.max(...vals)
    const range = max - min || 1
    const n = pts.length

    // Phase bands for each date in pts
    const bands = pts.map(p => {
      const ph = currentCyclePhase(lastPeriod, cycleLength, p.date)
      return ph ? PHASE_INFO[ph].color : '#1a1a1a'
    })

    const px = i => pad.l + (i / (n - 1)) * iW
    const py = v => pad.t + (1 - (v - min) / range) * iH

    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i)},${py(p.hrv)}`).join(' ')

    return (
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        {/* Phase colour bars behind chart */}
        {pts.map((_, i) => {
          if (i === n - 1) return null
          const x1 = px(i), x2 = px(i + 1)
          return (
            <rect key={i} x={x1} y={pad.t} width={x2 - x1} height={iH}
              fill={bands[i]} opacity={0.15} />
          )
        })}
        {/* HRV line */}
        <path d={pathD} fill="none" stroke={ORANGE} strokeWidth="1.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={px(i)} cy={py(p.hrv)} r={2} fill={ORANGE} />
        ))}
        {/* X-axis date labels (first + last) */}
        <text x={pad.l} y={H - 2} fontFamily={MONO} fontSize={7} fill={GREY}>{pts[0].date.slice(5)}</text>
        <text x={W - pad.r} y={H - 2} fontFamily={MONO} fontSize={7} fill={GREY} textAnchor="end">{pts[n - 1].date.slice(5)}</text>
      </svg>
    )
  }

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(x => !x)}
        style={{
          fontFamily: MONO, width: '100%', background: 'none', border: 'none',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', padding: 0, color: 'var(--text)',
          fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {L.title}
          {phase && (
            <span style={{ fontFamily: MONO, fontSize: 8, color: pColor, border: `1px solid ${pColor}55`, borderRadius: 2, padding: '1px 5px' }}>
              {pLabel.toUpperCase()} · D{dayNum}
            </span>
          )}
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: 16 }}>
          {!lastPeriod && !editing && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#555', marginBottom: 12 }}>
              {L.notSet}
            </div>
          )}

          {/* Current phase display */}
          {phase && !editing && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 10 }}>
                {/* Phase badge */}
                <div style={{
                  flex: '0 0 auto', padding: '10px 14px', borderRadius: 4,
                  background: `${pColor}11`, border: `1px solid ${pColor}44`,
                  minWidth: 100,
                }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: GREY, marginBottom: 3 }}>{L.phase}</div>
                  <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: pColor }}>{pLabel}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: GREY, marginTop: 2 }}>{L.day} {dayNum}</div>
                </div>

                {/* Next events */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                  {nextOvulation !== null && (
                    <div style={{ fontFamily: MONO, fontSize: 10, color: PHASE_INFO.ovulation.color }}>
                      ◉ {nextOvulation} {L.nextOv}
                    </div>
                  )}
                  {nextPeriod !== null && (
                    <div style={{ fontFamily: MONO, fontSize: 10, color: PHASE_INFO.menstruation.color }}>
                      ◉ {nextPeriod} {L.nextPd}
                    </div>
                  )}
                </div>
              </div>

              {/* Training tip */}
              <div style={{ fontFamily: MONO, fontSize: 9, color: '#888', lineHeight: 1.5, padding: '6px 10px', background: `${pColor}08`, borderRadius: 3, borderLeft: `2px solid ${pColor}55` }}>
                {pTip}
              </div>
            </div>
          )}

          {/* Phase legend */}
          {phase && !editing && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {Object.entries(PHASE_INFO).map(([key, meta]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
                  <span style={{ fontFamily: MONO, fontSize: 8, color: key === phase ? meta.color : GREY }}>
                    {lang === 'tr' ? meta.tr.label : meta.en.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* HRV + phase overlay chart */}
          {hrvChart && !editing && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: GREY, marginBottom: 6, letterSpacing: '0.08em' }}>
                {L.hrv28}
              </div>
              <HRVPhaseChart pts={hrvChart} />
            </div>
          )}

          {/* Edit form */}
          {editing ? (
            <div style={{ background: 'var(--surface)', border: '1px solid #2a2a2a', borderRadius: 4, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: GREY, marginBottom: 4 }}>{L.lastPeriod}</div>
                <input
                  type="date"
                  value={draftStart}
                  max={today}
                  onChange={e => setDraftStart(e.target.value)}
                  style={{ ...S.input, fontFamily: MONO, fontSize: 11 }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: GREY, marginBottom: 4 }}>{L.cycleLen}</div>
                <input
                  type="number" min="21" max="45" step="1"
                  value={draftLen}
                  onChange={e => setDraftLen(e.target.value)}
                  style={{ ...S.input, fontFamily: MONO, fontSize: 11, width: 80 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={save} style={{ ...S.btn, fontSize: 10, padding: '6px 14px' }}>{L.save}</button>
                <button onClick={() => setEditing(false)} style={{ ...S.btnSec, fontSize: 10, padding: '6px 14px' }}>{L.cancel}</button>
              </div>
            </div>
          ) : (
            <button
              onClick={openEdit}
              style={{
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                padding: '5px 12px', background: 'transparent',
                border: '1px solid #333', borderRadius: 2, color: GREY, cursor: 'pointer',
              }}
            >
              {L.edit}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
