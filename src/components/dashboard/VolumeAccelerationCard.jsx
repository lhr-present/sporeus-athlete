// ─── VolumeAccelerationCard.jsx ──────────────────────────────────────────────
// Surfaces `analyzeVolumeAcceleration` (Vetter 2019; Bourdon 2017) — the
// SECOND DERIVATIVE of weekly TSS. Complementary to CtlRampRateCard and
// WeeklyVolumeRampCard which track first-derivative ramp; this card
// tracks whether the ramp itself is speeding up (compounding risk) or
// smoothing out (deload-like / approaching peak).
//
// Render rules:
//   - Returns null when the pure-fn returns null (insufficient series).
//   - Otherwise renders for all three bands.
//
// Bilingual EN/TR via LangCtx.
// Test anchors: data-volume-acceleration-card, data-acceleration-band,
//               data-current-acceleration, data-prior-acceleration,
//               data-week-bar + data-week-start/tss/delta per bar.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeVolumeAcceleration } from '../../lib/athlete/volumeAcceleration.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  COMPOUNDING_RAMP: '#ff4444',
  STEADY:           '#5bc25b',
  DECELERATING:     '#0064ff',
}

const BAND_LABEL_EN = {
  COMPOUNDING_RAMP: 'COMPOUNDING',
  STEADY:           'STEADY',
  DECELERATING:     'DECELERATING',
}
const BAND_LABEL_TR = {
  COMPOUNDING_RAMP: 'İVMELİ',
  STEADY:           'SABİT',
  DECELERATING:     'YAVAŞLIYOR',
}

const RECO_EN = {
  COMPOUNDING_RAMP: 'Ramp rate is itself accelerating — load is compounding. Step back to a flat or down week soon.',
  STEADY:           'Volume changes week-to-week are themselves stable — predictable progression.',
  DECELERATING:     'Ramp is smoothing out — entering peak/taper or natural plateau.',
}
const RECO_TR = {
  COMPOUNDING_RAMP: 'Ramp hızı ivmeleniyor — yük katlanıyor. Yakında düz veya azaltma haftası planla.',
  STEADY:           'Hafta-hafta hacim değişimleri stabil — öngörülebilir ilerleme.',
  DECELERATING:     'Ramp yumuşuyor — zirve/azaltma fazına giriyor ya da doğal plato.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function fmtSigned(v, digits = 0) {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(digits)}`
}

export default function VolumeAccelerationCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeVolumeAcceleration({ log, today: todayIso(), windowWeeks: 8 }),
    [log]
  )

  if (!result) return null

  const {
    band,
    currentAcceleration,
    priorAcceleration,
    weeks,
    weekDeltas,
    citation,
  } = result

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const reco      = isTR ? RECO_TR[band]      : RECO_EN[band]

  const title       = isTR ? 'HACİM İVMESİ · 8H'                          : 'VOLUME ACCELERATION · 8W'
  const ariaLabel   = isTR ? 'Haftalık TSS ivmesi (Vetter 2019; Bourdon 2017)'
                           : 'Weekly TSS acceleration (Vetter 2019; Bourdon 2017)'
  const accelLabel  = isTR ? 'TSS²/HAFTA'   : 'TSS²/WK'
  const priorLabel  = isTR ? 'önceki 3 hafta' : 'prior 3 weeks'
  const seriesLabel = isTR ? '8 HAFTALIK TSS' : '8-WEEK TSS'

  // Bar chart geometry.
  const svgW = 240
  const svgH = 60
  const barGap = 4
  const barW = Math.max(8, Math.floor((svgW - barGap * (weeks.length - 1)) / weeks.length))
  const maxTss = Math.max(1, ...weeks.map(w => w.tss))

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-volume-acceleration-card
      data-acceleration-band={band}
      data-current-acceleration={currentAcceleration}
      data-prior-acceleration={priorAcceleration}
      style={{
        background: 'var(--card-bg, #0f0f0f)',
        border: '1px solid var(--border, #222)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #ccc)',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 8, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
            color: 'var(--text, #ccc)',
          }}>
            {title}
          </div>
          <div style={{
            fontSize: 10, color: 'var(--muted, #888)', marginTop: 6,
          }}>
            {priorLabel}:{' '}
            <span style={{ color: 'var(--text, #ccc)' }}>
              {fmtSigned(priorAcceleration, 0)}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            data-acceleration-value
            style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}
          >
            {fmtSigned(currentAcceleration, 0)}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginTop: 4 }}>
            {accelLabel}
          </div>
          <div
            data-acceleration-band-label
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              color, marginTop: 4,
            }}
          >
            {bandLabel}
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 10, padding: '6px 8px',
        background: 'var(--surface, #111)', borderRadius: 4,
        fontSize: 10, color: 'var(--muted, #aaa)', lineHeight: 1.5,
      }}>
        ↗ {reco}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginBottom: 4 }}>
          {seriesLabel}
        </div>
        <svg
          width={svgW}
          height={svgH}
          role="img"
          aria-label={seriesLabel}
          data-week-bars
          style={{ display: 'block' }}
        >
          {weeks.map((wk, i) => {
            const x = i * (barW + barGap)
            const h = Math.max(1, Math.round((wk.tss / maxTss) * (svgH - 14)))
            const y = svgH - h
            // delta corresponds to weekDeltas[i-1] for i>=1
            const delta = i === 0 ? null : weekDeltas[i - 1]
            return (
              <g
                key={wk.weekStart}
                data-week-bar
                data-week-start={wk.weekStart}
                data-week-tss={wk.tss}
                data-week-delta={delta === null ? '' : delta}
              >
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  fill={color}
                  opacity={0.7}
                />
                {delta !== null && (
                  <circle
                    cx={x + barW / 2}
                    cy={Math.max(4, y - 4)}
                    r={2}
                    fill="var(--text, #ccc)"
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div style={{
        marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}
