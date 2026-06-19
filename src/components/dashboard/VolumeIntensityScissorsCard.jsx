// ─── VolumeIntensityScissorsCard.jsx ─────────────────────────────────────
// Surfaces `analyzeVolumeIntensityScissors` (Issurin 2010; Stöggl 2014) —
// detects block-periodization "scissors" pattern across the last 8 weeks:
// volume should DECREASE while average intensity INCREASES as a block
// transitions accumulation → transmutation → realization.
//
// Bands:
//   PROPER_SCISSORS — green   — proper block taper trajectory
//   INVERTED        — orange  — common but mis-periodized arrangement
//   BOTH_UP         — red     — overreaching trajectory
//   BOTH_DOWN       — muted   — detraining / off-season
//   NO_CHANGE       — blue    — flat block (maintenance)
//
// Bilingual EN/TR via LangCtx.
// Returns null when the pure-fn returns null.
//
// Test anchors:
//   data-card="volume-intensity-scissors",
//   data-scissors-band, data-volume-trend, data-intensity-trend.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeVolumeIntensityScissors } from '../../lib/athlete/volumeIntensityScissors.js'

const MONO = "'IBM Plex Mono', monospace"

const VOLUME_COLOR = '#0064ff' // blue
const INTENSITY_COLOR = '#ff6600' // orange

const BAND_COLOR = {
  PROPER_SCISSORS: '#5bc25b', // green — desired
  INVERTED:        '#ff6600', // orange — flag
  BOTH_UP:         '#ff3333', // red — overreaching
  BOTH_DOWN:       '#888888', // muted — detraining
  NO_CHANGE:       '#0064ff', // blue — flat
}

const BAND_LABEL_EN = {
  PROPER_SCISSORS: 'PROPER SCISSORS',
  INVERTED:        'INVERTED',
  BOTH_UP:         'BOTH UP',
  BOTH_DOWN:       'BOTH DOWN',
  NO_CHANGE:       'NO CHANGE',
}
const BAND_LABEL_TR = {
  PROPER_SCISSORS: 'UYGUN MAKAS',
  INVERTED:        'TERS',
  BOTH_UP:         'İKİSİ DE ARTIYOR',
  BOTH_DOWN:       'İKİSİ DE DÜŞÜYOR',
  NO_CHANGE:       'DEĞİŞİM YOK',
}

const HINT_EN = {
  PROPER_SCISSORS:
    'Volume falling and intensity climbing — textbook block-taper pattern as a race nears.',
  INVERTED:
    'Volume climbing while intensity drops — common but mis-periodized. Sharpen intensity into the race.',
  BOTH_UP:
    'Volume AND intensity both climbing — overreaching trajectory. Schedule a recovery week.',
  BOTH_DOWN:
    'Volume and intensity both falling — detraining or extended off-season block.',
  NO_CHANGE:
    'Flat 8-week block — maintenance phase, neither sharpening nor building. Reassess block intent.',
}
const HINT_TR = {
  PROPER_SCISSORS:
    'Hacim düşüyor, şiddet artıyor — yarış yaklaşırken klasik blok-tapering deseni.',
  INVERTED:
    'Hacim artıyor, şiddet düşüyor — yaygın ama hatalı periodizasyon. Yarışa şiddetli yaklaş.',
  BOTH_UP:
    'Hem hacim hem şiddet artıyor — aşırı yüklenme rotası. Toparlanma haftası planla.',
  BOTH_DOWN:
    'Hacim ve şiddet birlikte düşüyor — detraining ya da uzun sezon arası blok.',
  NO_CHANGE:
    '8 haftalık düz blok — bakım fazı, ne keskinleşme ne inşa. Blok niyetini gözden geçir.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function signedPct(pct) {
  const v = Number(pct)
  if (!Number.isFinite(v)) return '0%'
  const asPct = Math.round(v * 1000) / 10 // 1 decimal
  const fixed = asPct.toFixed(1)
  return v > 0 ? `+${fixed}%` : `${fixed}%`
}

// Render a thin polyline sparkline in `color` from `values`. SVG width
// derives from `width` prop; height from `height`. Zero-min/max safe.
function Sparkline({ values, color, ariaLabel, dataKey }) {
  const width = 120
  const height = 36
  const pad = 2
  const safeValues = Array.isArray(values) && values.length > 0 ? values : [0]
  const max = Math.max(1, ...safeValues)
  const min = Math.min(0, ...safeValues)
  const span = max - min || 1
  const step = safeValues.length > 1 ? (width - pad * 2) / (safeValues.length - 1) : 0
  const points = safeValues.map((v, i) => {
    const x = pad + i * step
    const y = pad + (height - pad * 2) * (1 - (v - min) / span)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={ariaLabel}
      role="img"
      data-spark={dataKey}
      style={{ display: 'block' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function VolumeIntensityScissorsCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(
    () => analyzeVolumeIntensityScissors({ log, today: todayIso() }),
    [log],
  )

  if (!analysis) return null

  const { band, weeks, volumeTrendPct, intensityTrendPct, citation } = analysis
  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR ? 'HACİM × ŞİDDET MAKAS · 8H' : 'VOLUME × INTENSITY SCISSORS · 8W'
  const ariaLabel = isTR
    ? 'Hacim × Şiddet Makas (Issurin 2010; Stöggl 2014)'
    : 'Volume × Intensity Scissors (Issurin 2010; Stöggl 2014)'
  const volumeLabel = isTR ? 'HACİM (dk)' : 'VOLUME (min)'
  const intensityLabel = isTR ? 'ŞİDDET (IF×60)' : 'INTENSITY (IF×60)'
  const trendLabel = isTR ? 'son yarı vs ilk yarı' : 'last half vs first half'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="volume-intensity-scissors"
      data-scissors-band={band}
      data-volume-trend={volumeTrendPct}
      data-intensity-trend={intensityTrendPct}
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
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 12, letterSpacing: '0.06em', fontWeight: 700 }}>
          <span style={{ color, marginRight: 6 }}>◢</span>
          {title}
        </div>
        <div
          data-scissors-band-chip
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.05em',
            padding: '3px 8px',
            background: `${color}22`,
            color,
            border: `1px solid ${color}`,
            borderRadius: 3,
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Two side-by-side sparklines */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 10,
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: '1 1 0', minWidth: 120 }}>
          <div style={{
            fontSize: 9,
            letterSpacing: '0.05em',
            color: VOLUME_COLOR,
            fontWeight: 700,
            marginBottom: 4,
          }}>
            {volumeLabel}
          </div>
          <Sparkline
            values={weeks.map(w => w.totalMinutes)}
            color={VOLUME_COLOR}
            ariaLabel={isTR ? 'Hacim grafiği' : 'Volume sparkline'}
            dataKey="volume"
          />
          <div
            data-volume-trend-label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: VOLUME_COLOR,
              marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {signedPct(volumeTrendPct)}
          </div>
        </div>

        <div style={{ flex: '1 1 0', minWidth: 120 }}>
          <div style={{
            fontSize: 9,
            letterSpacing: '0.05em',
            color: INTENSITY_COLOR,
            fontWeight: 700,
            marginBottom: 4,
          }}>
            {intensityLabel}
          </div>
          <Sparkline
            values={weeks.map(w => w.avgIntensity)}
            color={INTENSITY_COLOR}
            ariaLabel={isTR ? 'Şiddet grafiği' : 'Intensity sparkline'}
            dataKey="intensity"
          />
          <div
            data-intensity-trend-label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: INTENSITY_COLOR,
              marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {signedPct(intensityTrendPct)}
          </div>
        </div>
      </div>

      <div style={{
        fontSize: 9,
        color: 'var(--muted, #888)',
        letterSpacing: '0.04em',
        marginBottom: 8,
      }}>
        {trendLabel}
      </div>

      {/* Interpretation hint */}
      <div
        data-scissors-hint
        style={{
          fontSize: 10,
          color: 'var(--text)',
          lineHeight: 1.5,
          padding: 8,
          background: `${color}10`,
          border: `1px solid ${color}40`,
          borderRadius: 3,
          marginBottom: 8,
        }}
      >
        {hint}
      </div>

      {/* Citation footer */}
      <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic' }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(VolumeIntensityScissorsCard)
