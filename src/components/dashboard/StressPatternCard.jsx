// ─── dashboard/StressPatternCard.jsx ─────────────────────────────────────────
// 28-day perceived-stress trend + its coupling with sleep duration.
// Combines GAS theory (Selye 1956) with RESTQ-Sport tracking (Kallus &
// Kellmann 2016) and Walker's stress↔sleep reciprocity model (2017).
//
// Layout (mono terminal aesthetic):
//   [title]
//   [trend badge]  [pattern chip]
//   [avg stress 1-5 gauge]  [delta]
//   [sleep correlation row]  [sample count]
//   [interpretation block — bilingual, color-tinted by pattern]
//   [citation footer]
import { memo, useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeStressPattern } from '../../lib/athlete/stressPattern.js'

const MONO = "'IBM Plex Mono', monospace"

const TREND_COLOR = {
  CALMING:  '#5bc25b',
  STEADY:   '#0064ff',
  MOUNTING: '#ff6600',
}

// Pattern colors *override* the trend color when applied to the
// pattern chip / interpretation block. STRESS_DRIVEN beats the orange
// MOUNTING badge because it represents the most urgent combined state.
const PATTERN_COLOR = {
  STRESS_DRIVEN: '#ff4444',
  DECOUPLED:     '#888888',
  PROTECTED:     '#5bc25b',
}

const TREND_LABEL = {
  en: { CALMING: 'CALMING', STEADY: 'STEADY', MOUNTING: 'MOUNTING' },
  tr: { CALMING: 'SAKİNLEŞİYOR', STEADY: 'STABİL', MOUNTING: 'ARTIYOR' },
}

const PATTERN_LABEL = {
  en: {
    STRESS_DRIVEN: 'STRESS-DRIVEN',
    DECOUPLED:     'DECOUPLED',
    PROTECTED:     'PROTECTED',
  },
  tr: {
    STRESS_DRIVEN: 'STRES SÜRÜLÜ',
    DECOUPLED:     'AYRIK',
    PROTECTED:     'KORUNUYOR',
  },
}

const INTERPRETATION = {
  STRESS_DRIVEN: {
    en: 'Stress is rising and sleep is taking the hit. Protect bedtime or reduce training intensity.',
    tr: 'Stres artıyor ve uyku darbeyi yiyor. Yatış saatini koru veya antrenman yoğunluğunu azalt.',
  },
  DECOUPLED: {
    en: 'Stress and sleep moving independently — neither is currently dominating recovery.',
    tr: 'Stres ve uyku bağımsız hareket ediyor — şu an hiçbiri toparlanmaya egemen değil.',
  },
  PROTECTED: {
    en: 'Sleep is holding up despite life-stress shifts — a robust recovery anchor.',
    tr: 'Yaşam stresi değişse de uyku korunuyor — sağlam bir toparlanma çapası.',
  },
}

function fmtDelta(d) {
  if (!Number.isFinite(d)) return '0.00'
  const sign = d > 0 ? '+' : d < 0 ? '-' : ''
  return `${sign}${Math.abs(d).toFixed(2)}`
}

function fmtCorr(r) {
  if (!Number.isFinite(r)) return '0.00'
  const sign = r >= 0 ? '+' : '-'
  return `${sign}${Math.abs(r).toFixed(2)}`
}

function StressPatternCard({ recovery }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const data = useMemo(
    () => analyzeStressPattern({ recovery, windowDays: 28 }),
    [recovery],
  )

  if (!data) return null

  const {
    stressTrend,
    pattern,
    avgStress,
    stressDelta,
    sleepCorrelation,
    sampleCount,
    citation,
  } = data

  const trendColor   = TREND_COLOR[stressTrend] || TREND_COLOR.STEADY
  const patternColor = PATTERN_COLOR[pattern]   || PATTERN_COLOR.DECOUPLED

  const title = isTR ? '◈ STRES × UYKU · 28G' : '◈ STRESS × SLEEP · 28D'
  const ariaLabel = isTR
    ? 'Algılanan stres × uyku örüntü kartı'
    : 'Perceived stress and sleep pattern card'

  const trendBadgeText = (TREND_LABEL[isTR ? 'tr' : 'en'][stressTrend]) || stressTrend
  const patternChipText = (PATTERN_LABEL[isTR ? 'tr' : 'en'][pattern]) || pattern

  const avgLabel   = isTR ? 'ort stres'    : 'avg stress'
  const deltaLabel = isTR ? 'değişim'      : 'delta'
  const corrLabel  = isTR ? 'uyku kor.'    : 'sleep corr.'
  const corrUnit   = isTR ? 'kor'          : 'corr'
  const nLabel     = isTR ? 'örnek'        : 'samples'
  const corrPairsLabel = isTR
    ? 'stres × uyku korelasyonu'
    : 'stress × sleep correlation'

  const interpretation = INTERPRETATION[pattern]
  const interpText = isTR ? interpretation.tr : interpretation.en

  // ── Gauge math ─────────────────────────────────────────────────────────────
  // avgStress sits on the 1–5 Likert scale. Show as a horizontal bar
  // anchored at 1 (left edge) → 5 (right edge).
  const gaugePct = Math.max(0, Math.min(100, ((avgStress - 1) / 4) * 100))

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      data-stress-pattern-card
      data-stress-trend={stressTrend}
      data-stress-pattern={pattern}
      data-avg-stress={avgStress}
      data-sleep-correlation={sleepCorrelation}
      data-sample-count={sampleCount}
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
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: '#ff6600',
        marginBottom: 10,
      }}>
        {title}
      </div>

      {/* Trend badge + pattern chip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        flexWrap: 'wrap',
      }}>
        <span
          data-trend-badge
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            background: `${trendColor}22`,
            color: trendColor,
            border: `1px solid ${trendColor}88`,
            borderRadius: 3,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
          }}
        >
          {trendBadgeText}
        </span>
        <span
          data-pattern-chip
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            background: `${patternColor}22`,
            color: patternColor,
            border: `1px solid ${patternColor}88`,
            borderRadius: 3,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
          }}
        >
          {patternChipText}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 10,
          color: 'var(--muted, #888)',
          letterSpacing: '0.04em',
        }}>
          n = {sampleCount} {nLabel}
        </span>
      </div>

      {/* Avg-stress 1-5 gauge + delta */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 4,
          fontSize: 11,
          color: 'var(--sub, #aaa)',
          flexWrap: 'wrap',
        }}>
          <span style={{ color: 'var(--muted, #888)', letterSpacing: '0.06em' }}>
            {avgLabel}:
          </span>
          <span style={{ fontWeight: 700, color: 'var(--text, #ccc)' }}>
            {avgStress.toFixed(2)}
          </span>
          <span style={{ color: 'var(--muted, #888)', fontSize: 10 }}>
            / 5
          </span>
          <span style={{
            marginLeft: 'auto',
            color: 'var(--muted, #888)',
            letterSpacing: '0.06em',
            fontSize: 11,
          }}>
            {deltaLabel}:{' '}
            <span style={{ fontWeight: 700, color: trendColor }}>
              {fmtDelta(stressDelta)}
            </span>
          </span>
        </div>
        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            height: 8,
            background: 'var(--surface, #181818)',
            border: '1px solid var(--border, #222)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${gaugePct}%`,
            background: trendColor,
            opacity: 0.85,
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9,
          color: 'var(--muted, #888)',
          letterSpacing: '0.04em',
          marginTop: 3,
        }}>
          <span>1</span><span>5</span>
        </div>
      </div>

      {/* Sleep correlation row */}
      <div
        data-correlation-row
        title={corrPairsLabel}
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 10,
          fontSize: 11,
          color: 'var(--sub, #aaa)',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: 'var(--muted, #888)', letterSpacing: '0.06em' }}>
          {corrLabel}:
        </span>
        <span style={{ fontWeight: 700, color: patternColor }}>
          {fmtCorr(sleepCorrelation)} {corrUnit}
        </span>
      </div>

      {/* Interpretation block */}
      <div
        data-interpretation
        style={{
          padding: 8,
          background: `${patternColor}14`,
          border: `1px solid ${patternColor}55`,
          borderRadius: 3,
          fontSize: 11,
          lineHeight: 1.5,
          color: 'var(--text, #ccc)',
          marginBottom: 8,
        }}
      >
        {interpText}
      </div>

      {/* Citation footer */}
      <div style={{
        fontSize: 9,
        color: 'var(--muted, #888)',
        fontStyle: 'italic',
        letterSpacing: '0.04em',
        opacity: 0.8,
        borderTop: '1px solid var(--border, #222)',
        paddingTop: 6,
      }}>
        ℹ {citation}
      </div>
    </div>
  )
}

export default memo(StressPatternCard)
