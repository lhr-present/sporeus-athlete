// ─── RunningCadenceTrendCard.jsx — Daniels/Heiderscheit 28d cadence trend ────
//
// Surfaces `computeRunningCadenceTrend` (Daniels 2014; Heiderscheit 2011 MSSE;
// Schubert 2014). Renders the mean running cadence over the last 28 days, its
// band (OVERSTRIDING / LONG_STRIDE / TARGET / SHORT_STRIDE), a 4-week
// sparkline, and a brief recommendation when off-target.
//
// Sport-gate: the Dashboard has gates for cycling/swim/tri but not running, so
// the card gates itself: render NULL when the athlete is clearly not a runner
// (no `primarySport` containing "run" AND no running entries in the log).

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeRunningCadenceTrend } from '../../lib/athlete/runningCadence.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLORS = {
  TARGET:       '#5bc25b',  // green
  OVERSTRIDING: '#ff6600',  // orange
  LONG_STRIDE:  '#ff6600',
  SHORT_STRIDE: '#ff6600',
}

const BAND_LABELS = {
  TARGET:       { en: 'TARGET',        tr: 'HEDEF' },
  OVERSTRIDING: { en: 'OVERSTRIDING',  tr: 'UZUN ADIM' },
  LONG_STRIDE:  { en: 'LONG STRIDE',   tr: 'UZUNCA ADIM' },
  SHORT_STRIDE: { en: 'SHORT STRIDE',  tr: 'KISA ADIM' },
}

const RECOMMENDATION = {
  en: 'Try a metronome at 175–180 spm',
  tr: '175–180 spm metronom dene',
}

/** Tiny inline SVG sparkline for 4 weekly mean values. */
function Sparkline({ values, color }) {
  const numeric = values.map(v => (Number.isFinite(v) ? v : null))
  const present = numeric.filter(v => v !== null)
  if (present.length < 2) return null
  const min = Math.min(...present)
  const max = Math.max(...present)
  const range = max - min || 1
  const W = 80
  const H = 22
  const stepX = numeric.length > 1 ? W / (numeric.length - 1) : W

  const points = numeric
    .map((v, i) => v === null ? null : [i * stepX, H - ((v - min) / range) * H])
    .filter(Boolean)

  const pathD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')

  return (
    <svg
      role="img"
      aria-label="cadence sparkline"
      data-cadence-sparkline
      width={W}
      height={H}
      style={{ verticalAlign: 'middle' }}
    >
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.6" fill={color} />
      ))}
    </svg>
  )
}

function RunningCadenceTrendCard({ log = [], profile = {} }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  // Internal sport-gate — Dashboard has no `hasRunningData` useMemo, so the
  // card gates itself. Pattern intentionally permissive: any "run" in
  // primarySport or in any log entry's type/sport qualifies.
  const isRunner = useMemo(() => {
    const primary = String(profile?.primarySport || '').toLowerCase()
    if (primary.includes('run')) return true
    return Array.isArray(log) && log.some(e => (
      /run/i.test(e?.type || '') || /run/i.test(e?.sport || '')
    ))
  }, [log, profile])

  const data = useMemo(() => {
    if (!isRunner) return null
    return computeRunningCadenceTrend({ log })
  }, [isRunner, log])

  if (!isRunner) return null
  if (!data) return null

  const color = BAND_COLORS[data.band] || '#ff6600'
  const bandLabel = (BAND_LABELS[data.band] || BAND_LABELS.TARGET)[isTR ? 'tr' : 'en']
  const title = isTR ? 'KOŞU TEMPO · 28G' : 'RUN CADENCE · 28D'
  const ariaLabel = isTR ? 'Koşu adım frekansı 28 günlük trendi' : 'Running cadence 28-day trend'
  const showRec = data.band !== 'TARGET'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-running-cadence-trend-card
      data-cadence-band={data.band}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      {/* Title */}
      <div style={{
        fontSize: 12,
        letterSpacing: '0.06em',
        marginBottom: 10,
        color: '#ff6600',
        fontWeight: 700,
      }}>
        <span style={{ marginRight: 6 }}>◈</span>{title}
      </div>

      {/* Main row: avg cadence + band badge + sparkline */}
      <div style={{
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 10,
      }}>
        <div>
          <div
            data-cadence-avg
            style={{ fontSize: 28, fontWeight: 700, color: 'var(--text, #fff)', lineHeight: 1.1 }}
          >
            {data.avgCadence}
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>spm</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.05em', marginTop: 2 }}>
            {isTR ? `${data.n} koşu` : `${data.n} runs`}
          </div>
        </div>

        <div>
          <span
            data-cadence-band-label
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 3,
              background: color + '22',
              color,
              border: `1px solid ${color}44`,
              letterSpacing: '0.07em',
            }}
          >
            {bandLabel}
          </span>
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <Sparkline values={data.weeklyMeans} color={color} />
        </div>
      </div>

      {/* Recommendation when off-target */}
      {showRec ? (
        <div
          data-cadence-recommendation
          style={{
            fontSize: 10,
            color: 'var(--text, #ccc)',
            background: '#ff660014',
            border: '1px solid #ff660044',
            borderRadius: 3,
            padding: '6px 8px',
            marginBottom: 8,
            lineHeight: 1.5,
          }}
        >
          ↳ {isTR ? RECOMMENDATION.tr : RECOMMENDATION.en}
        </div>
      ) : null}

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
        letterSpacing: '0.03em',
      }}>
        ℹ {data.citation}
      </div>
    </div>
  )
}

export default memo(RunningCadenceTrendCard)
