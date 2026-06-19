// ─── WeeklyVolumeRampCard.jsx ────────────────────────────────────────────────
// Surfaces `computeWeeklyVolumeRamp` (Gabbett 2016 + Foster 2001 +
// Bertelsen 2017) — the week-over-week duration-volume ramp,
// complementary to CtlRampRateCard (which tracks TSS/CTL ramp).
//
// Volume ramp is the raw "how many more minutes this week than last"
// signal — the quantity Foster's 10% rule was originally written about.
// In runners specifically (Bertelsen 2017) injury risk scales more
// tightly with volume ramps than with intensity-weighted load.
//
// Render rules:
//   - Returns null when the pure-fn returns null (log too short, etc.).
//   - Otherwise renders for ALL five bands. The DECLINING band is
//     useful for taper detection mid-block.
//
// Bilingual EN/TR via LangCtx.
// Test anchors: data-weekly-volume-ramp-card, data-ramp-band.

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { computeWeeklyVolumeRamp } from '../../lib/athlete/weeklyVolumeRamp.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  DECLINING:  '#888888', // muted  — taper / detraining
  GENTLE:     '#0064ff', // blue   — base period
  PRODUCTIVE: '#5bc25b', // green  — build period
  AGGRESSIVE: '#ff6600', // orange — caution
  OVERSHOOT:  '#e03030', // red    — high injury risk
}

const BAND_LABEL_EN = {
  DECLINING:  'DECLINING',
  GENTLE:     'GENTLE',
  PRODUCTIVE: 'PRODUCTIVE',
  AGGRESSIVE: 'AGGRESSIVE',
  OVERSHOOT:  'OVERSHOOT',
}
const BAND_LABEL_TR = {
  DECLINING:  'AZALAN',
  GENTLE:     'YUMUŞAK',
  PRODUCTIVE: 'VERİMLİ',
  AGGRESSIVE: 'AGRESİF',
  OVERSHOOT:  'AŞIRI YÜKLEME',
}

const RECO_EN = {
  DECLINING:  'Volume is dropping. If this is a planned taper — good. Otherwise, schedule a rebuild week.',
  GENTLE:     'Gentle ramp (0–5%). Safe base-period progression.',
  PRODUCTIVE: 'Productive ramp (5–10%). Inside the Foster 10% rule — keep going.',
  AGGRESSIVE: 'Aggressive ramp (10–15%). Cap next week’s minutes at the previous week to consolidate.',
  OVERSHOOT:  'Above 15%/week. Bertelsen 2017 flags this as elevated running-injury risk. Insert a down week.',
}
const RECO_TR = {
  DECLINING:  'Hacim düşüyor. Planlı bir taper ise iyi — değilse, bir toparlanma haftası planla.',
  GENTLE:     'Yumuşak artış (%0–5). Güvenli temel dönem ilerlemesi.',
  PRODUCTIVE: 'Verimli artış (%5–10). Foster %10 kuralı içinde — devam.',
  AGGRESSIVE: 'Agresif artış (%10–15). Önümüzdeki hafta dakikaları geçen hafta seviyesinde tut.',
  OVERSHOOT:  '%15/hafta üzerinde. Bertelsen 2017 koşu sakatlığı riski yüksek diyor. Bir azaltma haftası ekle.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function WeeklyVolumeRampCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => computeWeeklyVolumeRamp({ log, today: todayIso(), weeks: 4 }),
    [log]
  )

  if (!result) return null

  const { rampPct, weeklyDeltasPct, band, citation } = result
  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const reco = isTR ? RECO_TR[band] : RECO_EN[band]

  const title      = isTR ? 'HACİM ARTIŞI · 4H' : 'VOLUME RAMP · 4W'
  const ariaLabel  = isTR
    ? 'Haftalık hacim artışı (Foster 2001; Bertelsen 2017)'
    : 'Weekly volume ramp (Foster 2001; Bertelsen 2017)'
  const rampLabel  = isTR ? '%/HAFTA' : '%/WEEK'
  const sparkLabel = isTR ? '4 HAFTALIK % ARTIŞ' : '4-WEEK % DELTAS'

  // Sparkline of weeklyDeltasPct (oldest → newest), centered on 0.
  const svgW = 200
  const svgH = 36
  const maxAbs = Math.max(1, ...weeklyDeltasPct.map(d => Math.abs(d)))
  const mid = svgH / 2
  const pts = weeklyDeltasPct.map((d, i) => {
    const x = weeklyDeltasPct.length > 1
      ? Math.round((i * (svgW - 2)) / (weeklyDeltasPct.length - 1)) + 1
      : Math.round(svgW / 2)
    const y = Math.round(mid - (d / maxAbs) * (mid - 2))
    return `${x},${y}`
  }).join(' ')

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-weekly-volume-ramp-card
      data-ramp-band={band}
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
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            data-ramp-pct-value
            style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}
          >
            {rampPct >= 0 ? '+' : ''}{rampPct.toFixed(1)}%
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted, #888)', marginTop: 4 }}>
            {rampLabel}
          </div>
          <div
            data-ramp-band-label
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
          {sparkLabel}
        </div>
        <svg
          width={svgW}
          height={svgH}
          role="img"
          aria-label={sparkLabel}
          data-ramp-sparkline
          style={{ display: 'block' }}
        >
          <line
            x1="0" y1={mid} x2={svgW} y2={mid}
            stroke="var(--border, #333)" strokeWidth="1" strokeDasharray="2 2"
          />
          <polyline
            points={pts}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {weeklyDeltasPct.map((d, i) => {
            const x = weeklyDeltasPct.length > 1
              ? Math.round((i * (svgW - 2)) / (weeklyDeltasPct.length - 1)) + 1
              : Math.round(svgW / 2)
            const y = Math.round(mid - (d / maxAbs) * (mid - 2))
            return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />
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

export default memo(WeeklyVolumeRampCard)
