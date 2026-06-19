// ─── PeakWeekFrequencyCard.jsx — Block density (near-peak week counter) ─────
// Surfaces analyzePeakWeekFrequency(): counts the # of weeks in the last 26
// ISO weeks (~6 months) where weekly TSS reached ≥90% of the athlete's
// lifetime peak weekly TSS.
//
// Different intent from WeeklyVolumeRecordCard (single-point comparison of
// the CURRENT week vs lifetime peak): this card measures DENSITY of
// near-peak weeks — Issurin 2010 + Bompa 2018 — a serious build phase shows
// multiple near-peak weeks clustered together.
//
// Bands: NO_BLOCK, SPARSE, BLOCK_DENSITY, PEAK_PHASE.
// Bilingual EN/TR via LangCtx.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzePeakWeekFrequency } from '../../lib/athlete/peakWeekFrequency.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  NO_BLOCK:      '#888888',
  SPARSE:        '#0064ff',
  BLOCK_DENSITY: '#5bc25b',
  PEAK_PHASE:    '#ff6600',
}

const BAND_LABEL_EN = {
  NO_BLOCK:      'NO BLOCK',
  SPARSE:        'SPARSE',
  BLOCK_DENSITY: 'BLOCK DENSITY',
  PEAK_PHASE:    'PEAK PHASE',
}
const BAND_LABEL_TR = {
  NO_BLOCK:      'BLOK YOK',
  SPARSE:        'SEYREK',
  BLOCK_DENSITY: 'BLOK YOĞUNLUĞU',
  PEAK_PHASE:    'ZİRVE FAZI',
}

const HINT_EN = {
  NO_BLOCK:
    'No near-peak weeks in the last 26. You are training well below your historical ceiling.',
  SPARSE:
    'A few near-peak weeks but no clustered block. Sustained training at peak level not yet present.',
  BLOCK_DENSITY:
    'Multiple near-peak weeks clustered — genuine build block in your training history.',
  PEAK_PHASE:
    'Sustained near-peak training. Monitor monotony and recovery to avoid overload.',
}
const HINT_TR = {
  NO_BLOCK:
    'Son 26 haftada zirve seviyesine yakın hafta yok. Tarihsel tavanının çok altında çalışıyorsun.',
  SPARSE:
    'Birkaç zirveye yakın hafta var ama kümelenmiş blok yok. Zirve seviyesinde sürekli antrenman henüz yok.',
  BLOCK_DENSITY:
    'Kümelenmiş çoklu zirveye yakın hafta — antrenman geçmişinde gerçek bir yapı bloğu.',
  PEAK_PHASE:
    'Sürekli zirveye yakın antrenman. Aşırı yüklenmeyi önlemek için monotonluk ve toparlanmayı izle.',
}

function todayIso() {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString().slice(0, 10)
}

function fmtTss(v) {
  if (!Number.isFinite(v)) return '0'
  if (Math.abs(v - Math.round(v)) < 0.05) return String(Math.round(v))
  return v.toFixed(1)
}

function PeakWeekFrequencyCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzePeakWeekFrequency({ log, today: todayIso() }),
    [log]
  )

  if (!result) return null

  const {
    band,
    weeks,
    lifetimePeakTss,
    lifetimePeakWeekStart,
    nearPeakWeekCount,
    lookbackWeeksAnalyzed,
    nearPeakWeekRate,
    nearPeakThreshold,
    citation,
  } = result

  const accent     = BAND_COLOR[band] || BAND_COLOR.NO_BLOCK
  const bandLabel  = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint       = isTR ? HINT_TR[band] : HINT_EN[band]

  const title      = isTR ? 'ZİRVE HAFTA SIKLIĞI' : 'PEAK-WEEK FREQUENCY'
  const ariaLabel  = isTR
    ? 'Son 6 ayda zirve seviyesine yakın hafta sıklığı'
    : 'Frequency of near-peak weeks in the last 6 months'

  const ofWeeksLabel = isTR
    ? `${lookbackWeeksAnalyzed} haftadan zirve seviyesinde`
    : `of ${lookbackWeeksAnalyzed} weeks at peak level`

  const peakRefLabel = isTR
    ? `Tüm zamanların zirvesi: ${fmtTss(lifetimePeakTss)} TSS · ${lifetimePeakWeekStart || '—'}`
    : `Lifetime peak: ${fmtTss(lifetimePeakTss)} TSS · ${lifetimePeakWeekStart || '—'}`

  const thresholdLabel = isTR
    ? `Zirveye yakın = ≥${fmtTss(nearPeakThreshold)} TSS`
    : `Near-peak = ≥${fmtTss(nearPeakThreshold)} TSS`

  // Mini-bar chart: scale all weeks to the lifetimePeakTss for consistent
  // height; near-peak weeks highlighted in `accent` (orange family),
  // others muted grey.
  const maxTss = Math.max(lifetimePeakTss, 1)
  const barW = 6
  const barGap = 2
  const chartH = 36
  const chartW = weeks.length * (barW + barGap) - barGap

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="peak-week-frequency"
      data-peak-week-frequency-card
      data-peak-band={band}
      data-near-peak-week-count={nearPeakWeekCount}
      data-lookback-weeks={lookbackWeeksAnalyzed}
      data-near-peak-week-rate={nearPeakWeekRate}
      data-lifetime-peak-tss={lifetimePeakTss}
      data-near-peak-threshold={nearPeakThreshold}
      style={{
        ...S.card,
        borderLeft: `4px solid ${accent}`,
        padding: '20px',
        fontFamily: MONO,
      }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* Big stat + band badge */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: '8px',
      }}>
        <div
          data-near-peak-count-value
          style={{
            fontFamily: MONO,
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1,
            color: accent,
          }}
        >
          {nearPeakWeekCount}
        </div>
        <div style={{
          fontFamily: MONO,
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '0.04em',
        }}>
          {ofWeeksLabel}
        </div>
        <div
          data-peak-band-label
          style={{
            display: 'inline-block',
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            background: accent,
            padding: '4px 10px',
            borderRadius: 3,
            letterSpacing: '0.08em',
            marginLeft: 'auto',
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* Lifetime peak ref */}
      <div
        data-peak-reference
        style={{
          fontFamily: MONO,
          fontSize: 11,
          color: 'var(--sub)',
          marginBottom: 2,
          letterSpacing: '0.02em',
        }}
      >
        {peakRefLabel}
      </div>

      {/* Near-peak threshold */}
      <div
        data-near-peak-threshold-label
        style={{
          fontFamily: MONO,
          fontSize: 11,
          color: 'var(--muted)',
          marginBottom: 10,
          letterSpacing: '0.02em',
        }}
      >
        {thresholdLabel}
      </div>

      {/* Mini bars: 26 weeks chronological */}
      <svg
        role="img"
        aria-label={isTR ? 'Haftalık TSS mini grafiği' : 'Weekly TSS mini chart'}
        data-weeks-chart
        width={chartW}
        height={chartH}
        style={{ display: 'block', marginBottom: 10, overflow: 'visible' }}
      >
        {weeks.map((w, i) => {
          const h = Math.max(1, (w.tss / maxTss) * chartH)
          const y = chartH - h
          const fill = w.isNearPeak ? accent : '#444'
          return (
            <rect
              key={w.weekStart}
              x={i * (barW + barGap)}
              y={y}
              width={barW}
              height={h}
              fill={fill}
              data-week-start={w.weekStart}
              data-week-tss={w.tss}
              data-week-is-near-peak={w.isNearPeak ? '1' : '0'}
            />
          )
        })}
      </svg>

      {/* Interpretation hint */}
      {hint ? (
        <div
          data-peak-band-hint
          style={{
            fontFamily: MONO,
            fontSize: 11,
            color: 'var(--text)',
            lineHeight: 1.55,
            paddingLeft: 8,
            borderLeft: `2px solid ${accent}`,
            marginBottom: 8,
          }}
        >
          {hint}
        </div>
      ) : null}

      {/* Citation */}
      <div style={{
        fontFamily: MONO,
        fontSize: 9,
        color: '#555',
        marginTop: 4,
        letterSpacing: '0.04em',
      }}>
        {citation}
      </div>
    </div>
  )
}

export default memo(PeakWeekFrequencyCard)
