// ─── DailyVolumeRangeCard.jsx ───────────────────────────────────────────
// Surfaces `analyzeDailyVolumeRange` (Foster 2001; Halson 2014) — a
// DAY-LEVEL variability metric. Distinct from the existing weekly-monotony
// / weekly-variance cards, which can't tell apart a flat-all-week pattern
// from a healthy hard-easy swing.
//
// Render rules:
//   - Returns null when the pure-fn returns null (no training in window,
//     or `today` unresolvable).
//   - Otherwise renders for all four bands.
//   - Bar chart: one vertical bar per day in the recent window, height
//     proportional to dayTss, colour banded by absolute TSS magnitude.
//
// Bilingual EN/TR via LangCtx.
// Test anchors:
//   data-card="daily-volume-range",
//   data-band, data-recent-min, data-recent-max, data-recent-mean,
//   data-recent-stddev, data-recent-range, data-trend-range-delta,
//   data-zero-day-count.

import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeDailyVolumeRange } from '../../lib/athlete/dailyVolumeRange.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  FLAT:           '#ff6600', // orange — monotony trap, low variability
  STEADY:         '#5bc25b', // green  — modest, healthy
  PULSED:         '#0064ff', // blue   — textbook hard-easy
  EXTREME_SWING:  '#e03030', // red    — unstable / cramming
}

const BAND_LABEL_EN = {
  FLAT:          'FLAT',
  STEADY:        'STEADY',
  PULSED:        'PULSED',
  EXTREME_SWING: 'EXTREME SWING',
}
const BAND_LABEL_TR = {
  FLAT:          'DÜZ',
  STEADY:        'DENGELI',
  PULSED:        'NABIZLI',
  EXTREME_SWING: 'AŞIRI SALINIM',
}

const HINT_EN = {
  FLAT:
    'Daily load barely varies — classic monotony trap. Add a clear hard day or a real rest day.',
  STEADY:
    'Modest day-to-day swing — fine for a base block, but watch for stagnation in tougher phases.',
  PULSED:
    'Healthy hard-easy oscillation. The daily pattern supports recovery between key sessions.',
  EXTREME_SWING:
    'Very high day-to-day variation — may indicate cramming or under-recovered hard days. Smooth the schedule.',
}
const HINT_TR = {
  FLAT:
    'Günlük yük neredeyse hiç değişmiyor — klasik monotonluk tuzağı. Net bir sert gün veya gerçek bir dinlenme günü ekle.',
  STEADY:
    'Mütevazı günden güne salınım — temel blok için uygun, ama daha sert evrelerde durağanlığa dikkat.',
  PULSED:
    'Sağlıklı sert-hafif salınımı. Günlük örüntü anahtar antrenmanlar arası toparlanmayı destekliyor.',
  EXTREME_SWING:
    'Çok yüksek günden güne değişim — sıkışmış program veya yeterince toparlanmamış sert günler olabilir. Programı düzleştir.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

// ─── bar chart ─────────────────────────────────────────────────────────
// One bar per day in the recent window. Bar height proportional to TSS,
// colour banded by absolute magnitude (low=blue, mid=green, high=orange).
function BarChart({ dailyTss }) {
  const w = 280
  const h = 56
  const padX = 4
  const padY = 4

  const tssValues = dailyTss.map(d => d.tss)
  const maxTss = Math.max(1, ...tssValues)

  const n = dailyTss.length
  const gap = 1
  const innerW = w - 2 * padX
  const barW = Math.max(1, (innerW - gap * (n - 1)) / Math.max(n, 1))

  function colorFor(tss) {
    if (tss <= 0) return '#333'
    if (tss < 60)  return '#0064ff' // low
    if (tss < 150) return '#5bc25b' // mid
    return '#ff6600'                // high
  }

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Daily TSS bar chart"
      data-chart="daily-volume-range"
      style={{ display: 'block', marginTop: 8 }}
    >
      {dailyTss.map((d, i) => {
        const x = padX + i * (barW + gap)
        const bh = d.tss > 0
          ? Math.max(1, ((d.tss / maxTss) * (h - 2 * padY)))
          : 1
        const y = h - padY - bh
        return (
          <rect
            key={d.date}
            x={x}
            y={y}
            width={barW}
            height={bh}
            fill={colorFor(d.tss)}
            data-bar
            data-bar-date={d.date}
            data-bar-tss={d.tss}
          />
        )
      })}
    </svg>
  )
}

export default function DailyVolumeRangeCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeDailyVolumeRange({
      log,
      today: todayIso(),
      windowDays: 28,
      comparisonWindowDays: 56,
    }),
    [log]
  )

  if (!result) return null

  const {
    band,
    recentMin,
    recentMax,
    recentMean,
    recentStdDev,
    recentRange,
    trendRangeDelta,
    zeroDayCount,
    dailyTss,
    citation,
  } = result

  const color = BAND_COLOR[band] || '#888'
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint = isTR ? HINT_TR[band] : HINT_EN[band]

  const title = isTR
    ? 'GÜNLÜK HACİM ARALIĞI · 28G'
    : 'DAILY VOLUME RANGE · 28D'
  const ariaLabel = isTR
    ? `Son 28 günde günlük TSS salınımı (${citation})`
    : `Daily TSS swing over the last 28 days (${citation})`

  const trendPct = (trendRangeDelta * 100).toFixed(1)
  const trendArrow = trendRangeDelta > 0.02
    ? '▲'
    : trendRangeDelta < -0.02
      ? '▼'
      : '·'
  const trendColor = trendRangeDelta > 0.02
    ? '#5bc25b'
    : trendRangeDelta < -0.02
      ? '#e03030'
      : 'var(--muted, #888)'
  const trendLabel = isTR
    ? `${trendArrow} %${trendPct} aralık trendi`
    : `${trendArrow} ${trendPct}% range trend`

  const restLabel = isTR
    ? `${zeroDayCount} dinlenme günü`
    : `${zeroDayCount} rest days`

  const minLabel    = isTR ? 'Min'        : 'Min'
  const maxLabel    = isTR ? 'Maks'       : 'Max'
  const meanLabel   = isTR ? 'Ort'        : 'Mean'
  const stdLabel    = isTR ? 'Std'        : 'Std'
  const rangeLabel  = isTR ? 'Aralık'     : 'Range'

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-card="daily-volume-range"
      data-band={band}
      data-recent-min={recentMin}
      data-recent-max={recentMax}
      data-recent-mean={recentMean}
      data-recent-stddev={recentStdDev}
      data-recent-range={recentRange}
      data-trend-range-delta={trendRangeDelta}
      data-zero-day-count={zeroDayCount}
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
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 8, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{
            fontSize: 11, letterSpacing: '0.06em', fontWeight: 700,
          }}>
            <span style={{ color: '#0064ff', marginRight: 6 }}>◢</span>
            {title}
          </div>
          <div style={{ marginTop: 10 }}>
            <div
              data-range-display
              style={{
                fontSize: 28, fontWeight: 700, color, lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {recentRange.toFixed(0)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 3 }}>
              {isTR
                ? `TSS salınım aralığı (maks − min)`
                : `TSS swing range (max − min)`}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            data-band-chip
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
              padding: '3px 8px', borderRadius: 3,
              background: `${color}22`, color, border: `1px solid ${color}`,
              display: 'inline-block',
            }}
          >
            {bandLabel}
          </div>
          <div
            data-trend-display
            style={{ fontSize: 11, color: trendColor, marginTop: 6, fontWeight: 700 }}
          >
            {trendLabel}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted, #888)', marginTop: 2 }}>
            {restLabel}
          </div>
        </div>
      </div>

      {/* Bar chart — 28 daily TSS bars */}
      <BarChart dailyTss={dailyTss} />

      {/* Stats grid */}
      <div
        data-stats-grid
        style={{
          marginTop: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 6,
          fontSize: 10,
          color: 'var(--muted, #888)',
        }}
      >
        <div data-stat="min">
          <div>{minLabel}</div>
          <div style={{ color: 'var(--text, #ccc)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {recentMin.toFixed(0)}
          </div>
        </div>
        <div data-stat="max">
          <div>{maxLabel}</div>
          <div style={{ color: 'var(--text, #ccc)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {recentMax.toFixed(0)}
          </div>
        </div>
        <div data-stat="mean">
          <div>{meanLabel}</div>
          <div style={{ color: 'var(--text, #ccc)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {recentMean.toFixed(0)}
          </div>
        </div>
        <div data-stat="stddev">
          <div>{stdLabel}</div>
          <div style={{ color: 'var(--text, #ccc)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {recentStdDev.toFixed(1)}
          </div>
        </div>
        <div data-stat="range">
          <div>{rangeLabel}</div>
          <div style={{ color: 'var(--text, #ccc)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {recentRange.toFixed(0)}
          </div>
        </div>
      </div>

      {/* Coaching hint band-coloured strip */}
      <div
        data-band-strip
        style={{
          marginTop: 10, padding: '6px 8px',
          background: `${color}14`,
          border: `1px solid ${color}55`,
          borderRadius: 3,
          fontSize: 10, color: 'var(--text, #ccc)', lineHeight: 1.5,
        }}
      >
        ↗ {hint}
      </div>

      {/* Citation footer */}
      <div style={{
        marginTop: 8, fontSize: 9, color: '#555', fontStyle: 'italic',
      }}>
        {citation}
      </div>
    </div>
  )
}
