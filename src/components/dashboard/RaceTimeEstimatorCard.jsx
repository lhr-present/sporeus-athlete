// ─── RaceTimeEstimatorCard.jsx — Riegel race-time projections ────────────
//
// Surfaces `estimateRaceTimes` (src/lib/athlete/raceTimeEstimator.js) as
// a Dashboard card. Projects 5K / 10K / Half / Full marathon times from
// the athlete's best recent running effort using Riegel 1981's T2 = T1 *
// (D2/D1)^1.06.
//
// Reliability chips reflect extrapolation distance:
//   HIGH  — D2/D1 <= 2 (or calibrating run nearby)
//   MED   — 2 < D2/D1 <= 5
//   LOW   — D2/D1 > 5
//
// Renders null when no qualifying running session exists in the 90-day
// window (no reference effort to project from).
//
// Citation: Riegel R. (1981) Athletic Records and Human Endurance,
//   American Scientist 69:285; Daniels J. (2014) Daniels' Running
//   Formula equivalent-time tables.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { estimateRaceTimes } from '../../lib/athlete/raceTimeEstimator.js'

const MONO = "'IBM Plex Mono', monospace"

const RELIABILITY_COLOR = {
  HIGH:   '#5bc25b', // green
  MEDIUM: '#0064ff', // blue
  LOW:    '#777',    // muted
}
const RELIABILITY_LABEL = {
  HIGH:   { en: 'HIGH',   tr: 'YÜKSEK' },
  MEDIUM: { en: 'MEDIUM', tr: 'ORTA'   },
  LOW:    { en: 'LOW',    tr: 'DÜŞÜK'  },
}
const TARGET_LABEL = {
  '5K':   { en: '5 KM',          tr: '5 KM'              },
  '10K':  { en: '10 KM',         tr: '10 KM'             },
  HALF:   { en: 'HALF MARATHON', tr: 'YARI MARATON'      },
  FULL:   { en: 'MARATHON',      tr: 'MARATON'           },
}

/**
 * @description Pad an integer to 2 digits.
 */
function pad2(n) {
  return String(n).padStart(2, '0')
}

/**
 * @description Format minutes as H:MM:SS when >= 60min, else MM:SS.
 *   195       → '3:15:00'
 *   22.5      → '22:30'
 *   59.9833…  → '59:59'
 */
export function formatMinutes(min) {
  if (!Number.isFinite(min) || min < 0) return '—'
  const totalSec = Math.round(min * 60)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`
  return `${pad2(m)}:${pad2(s)}`
}

/**
 * @description Format pace minutes-per-km as MM:SS/km.
 */
function formatPace(minPerKm) {
  if (!Number.isFinite(minPerKm) || minPerKm <= 0) return '—'
  const totalSec = Math.round(minPerKm * 60)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${pad2(m)}:${pad2(s)}`
}

/**
 * @description Format reference distance — strip trailing .0 for whole
 *   km, otherwise show one decimal.
 */
function formatRefDist(km) {
  if (!Number.isFinite(km)) return '—'
  if (Math.abs(km - Math.round(km)) < 0.05) return String(Math.round(km))
  return km.toFixed(1)
}

function RaceTimeEstimatorCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(() => estimateRaceTimes({ log }), [log])
  if (!result) return null

  const ref = result.reference
  const refDistStr = formatRefDist(ref.distanceKm)
  const refTimeStr = formatMinutes(ref.timeMin)
  const refPaceStr = formatPace(ref.paceMinKm)

  const title    = isTR ? 'YARIŞ ZAMANI TAHMİNİ · 90G' : 'RACE TIME ESTIMATES · 90D'
  const ariaLabel = isTR ? 'Yarış zamanı tahmini' : 'Race time estimates'
  const refLabel  = isTR ? 'REFERANS' : 'REFERENCE'
  const paceLabel = isTR ? 'tempo' : 'pace'
  const accent    = '#ff6600'

  const hintEN = `Riegel extrapolation from your best recent ${refDistStr}km. Reliability decreases with extrapolation distance — long-distance projections assume your endurance scales as Riegel's exponent suggests.`
  const hintTR = `Son ${refDistStr}km'lik en iyi koşundan Riegel ekstrapolasyonu. Mesafe arttıkça güvenilirlik azalır — uzun mesafe tahminleri dayanıklılığının Riegel üssüne göre ölçeklendiğini varsayar.`

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-race-time-estimator-card
      data-reference-distance-km={String(ref.distanceKm)}
      data-reference-time-min={String(ref.timeMin)}
      data-reference-date={ref.date}
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
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 12,
          letterSpacing: '0.06em',
          fontWeight: 700,
          color: 'var(--text)',
        }}>
          <span style={{ color: accent, marginRight: 6 }}>◢</span>
          {title}
        </div>
      </div>

      {/* Reference effort */}
      <div
        data-reference-line
        style={{
          fontSize: 10,
          color: 'var(--muted, #888)',
          letterSpacing: '0.03em',
          marginBottom: 12,
          padding: 8,
          background: `${accent}10`,
          border: `1px solid ${accent}40`,
          borderRadius: 3,
        }}
      >
        <span style={{
          fontWeight: 700,
          color: accent,
          marginRight: 6,
          letterSpacing: '0.05em',
        }}>
          {refLabel}
        </span>
        <span style={{ color: 'var(--text)' }}>
          {refDistStr}km in {refTimeStr} · {paceLabel} {refPaceStr}/km · {ref.date}
        </span>
      </div>

      {/* Projection rows */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginBottom: 10,
      }}>
        {result.projections.map(p => {
          const color = RELIABILITY_COLOR[p.reliability] || '#777'
          const reliabilityLabel = isTR
            ? RELIABILITY_LABEL[p.reliability]?.tr
            : RELIABILITY_LABEL[p.reliability]?.en
          const targetLabel = isTR
            ? TARGET_LABEL[p.name]?.tr
            : TARGET_LABEL[p.name]?.en
          return (
            <div
              key={p.name}
              data-projection-row
              data-projection-name={p.name}
              data-projection-distance-km={String(p.distanceKm)}
              data-projection-minutes={String(p.projectedMinutes)}
              data-projection-reliability={p.reliability}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '6px 8px',
                background: 'var(--surface, #181818)',
                border: '1px solid var(--border, #222)',
                borderRadius: 3,
              }}
            >
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: 'var(--text)',
                minWidth: 110,
              }}>
                {targetLabel}
              </div>
              <div style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {formatMinutes(p.projectedMinutes)}
              </div>
              <div
                data-projection-reliability-chip
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  padding: '3px 6px',
                  background: `${color}22`,
                  color,
                  border: `1px solid ${color}`,
                  borderRadius: 2,
                  minWidth: 52,
                  textAlign: 'center',
                }}
              >
                {reliabilityLabel}
              </div>
            </div>
          )
        })}
      </div>

      {/* Interpretation hint */}
      <div style={{
        fontSize: 10,
        color: 'var(--text)',
        lineHeight: 1.5,
        padding: 8,
        background: `${accent}10`,
        border: `1px solid ${accent}40`,
        borderRadius: 3,
        marginBottom: 8,
      }}>
        {isTR ? hintTR : hintEN}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontStyle: 'italic',
      }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(RaceTimeEstimatorCard)
