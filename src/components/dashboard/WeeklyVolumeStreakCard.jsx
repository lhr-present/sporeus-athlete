// ─── WeeklyVolumeStreakCard.jsx — Above-own-mean weekly streak tracker ──────
// Surfaces analyzeWeeklyVolumeStreak(): the longest consecutive run of weeks,
// in the last 26 ISO weeks, where weekly TSS reached ≥ the athlete's OWN
// 26-week mean weekly TSS. The current partial week is excluded.
//
// Self-referenced "good week" — a week ≥ athlete's own baseline — surfaces
// PERIODS of sustained training intent (block construction). What counts as
// "a lot" depends on the athlete's normal, not an absolute threshold.
//
// Bands: NO_STREAK, BUILDING, STRONG_MOMENTUM, PEAK_BLOCK.
// Bilingual EN/TR via LangCtx.
// ─────────────────────────────────────────────────────────────────────────────
import { useContext, useMemo } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeWeeklyVolumeStreak } from '../../lib/athlete/weeklyVolumeStreak.js'

const MONO = "'IBM Plex Mono', monospace"

const BAND_COLOR = {
  NO_STREAK:       '#888888',
  BUILDING:        '#0064ff',
  STRONG_MOMENTUM: '#5bc25b',
  PEAK_BLOCK:      '#ff6600',
}

const BAND_LABEL_EN = {
  NO_STREAK:       'NO STREAK',
  BUILDING:        'BUILDING',
  STRONG_MOMENTUM: 'STRONG MOMENTUM',
  PEAK_BLOCK:      'PEAK BLOCK',
}
const BAND_LABEL_TR = {
  NO_STREAK:       'SERİ YOK',
  BUILDING:        'YAPILANIYOR',
  STRONG_MOMENTUM: 'GÜÇLÜ MOMENTUM',
  PEAK_BLOCK:      'ZİRVE BLOĞU',
}

const HINT_EN = {
  NO_STREAK:
    'No consecutive weeks above your own mean. Training has been intermittent rather than sustained.',
  BUILDING:
    'A short run of weeks above your own mean. Momentum is starting to form — keep stacking weeks.',
  STRONG_MOMENTUM:
    'Multiple consecutive weeks above your own mean. Genuine training momentum — a build block is in progress.',
  PEAK_BLOCK:
    'Sustained 6+ weeks above your own mean. A real peak block — monitor monotony and recovery to avoid overload.',
}
const HINT_TR = {
  NO_STREAK:
    'Kendi ortalamanın üzerinde ardışık hafta yok. Antrenman sürekli değil, kesik kesik.',
  BUILDING:
    'Kendi ortalamanın üzerinde kısa bir seri. Momentum oluşmaya başlıyor — haftaları üst üste koymaya devam et.',
  STRONG_MOMENTUM:
    'Kendi ortalamanın üzerinde birden çok ardışık hafta. Gerçek antrenman momentumu — yapı bloğu sürüyor.',
  PEAK_BLOCK:
    'Kendi ortalamanın üzerinde 6+ haftalık sürekli seri. Gerçek bir zirve bloğu — aşırı yüklenmeyi önlemek için monotonluk ve toparlanmayı izle.',
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

export default function WeeklyVolumeStreakCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(
    () => analyzeWeeklyVolumeStreak({ log, today: todayIso() }),
    [log]
  )

  if (!result) return null

  const {
    band,
    baselineTss,
    longestStreakWeeks,
    currentStreakWeeks,
    totalAtOrAboveWeeks,
    weeks,
    citation,
  } = result

  const accent    = BAND_COLOR[band] || BAND_COLOR.NO_STREAK
  const bandLabel = isTR ? BAND_LABEL_TR[band] : BAND_LABEL_EN[band]
  const hint      = isTR ? HINT_TR[band] : HINT_EN[band]

  const title     = isTR ? 'HACİM MOMENTUMU' : 'VOLUME MOMENTUM'
  const ariaLabel = isTR
    ? 'Son 26 haftada kendi ortalamanın üzerindeki ardışık hafta serisi'
    : 'Longest consecutive run of weeks at or above your own mean over the last 26 weeks'

  const weeksLabel = isTR
    ? 'hafta kendi ortalamanın üstünde'
    : 'weeks above own mean'

  const currentStreakLabel = isTR
    ? `Şu an: ${currentStreakWeeks} haftalık seri`
    : `Right now: ${currentStreakWeeks}-week streak`

  const baselineLabel = isTR
    ? `Baz çizgi: ${fmtTss(baselineTss)} TSS/hafta`
    : `Baseline: ${fmtTss(baselineTss)} TSS/wk`

  const totalLabel = isTR
    ? `Toplam baz üstü: ${totalAtOrAboveWeeks} / ${weeks.length} hafta`
    : `Total at-or-above: ${totalAtOrAboveWeeks} of ${weeks.length} weeks`

  // Mini-bar chart: 26 weekly bars, baseline horizontal line.
  const maxTss = Math.max(...weeks.map(w => w.tss), baselineTss, 1)
  const barW = 6
  const barGap = 2
  const chartH = 40
  const chartW = weeks.length * (barW + barGap) - barGap
  const baselineY = chartH - (baselineTss / maxTss) * chartH

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="weekly-volume-streak"
      data-weekly-volume-streak-card
      data-streak-band={band}
      data-longest-streak-weeks={longestStreakWeeks}
      data-current-streak-weeks={currentStreakWeeks}
      data-total-at-or-above-weeks={totalAtOrAboveWeeks}
      data-baseline-tss={baselineTss}
      data-lookback-weeks={weeks.length}
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
          data-longest-streak-value
          style={{
            fontFamily: MONO,
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1,
            color: accent,
          }}
        >
          {longestStreakWeeks}
        </div>
        <div style={{
          fontFamily: MONO,
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '0.04em',
        }}>
          {weeksLabel}
        </div>
        <div
          data-streak-band-label
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

      {/* Current streak */}
      <div
        data-current-streak-label
        style={{
          fontFamily: MONO,
          fontSize: 11,
          color: 'var(--sub)',
          marginBottom: 2,
          letterSpacing: '0.02em',
        }}
      >
        {currentStreakLabel}
      </div>

      {/* Baseline */}
      <div
        data-baseline-label
        style={{
          fontFamily: MONO,
          fontSize: 11,
          color: 'var(--muted)',
          marginBottom: 2,
          letterSpacing: '0.02em',
        }}
      >
        {baselineLabel}
      </div>

      {/* Total at-or-above count */}
      <div
        data-total-at-or-above-label
        style={{
          fontFamily: MONO,
          fontSize: 11,
          color: 'var(--muted)',
          marginBottom: 10,
          letterSpacing: '0.02em',
        }}
      >
        {totalLabel}
      </div>

      {/* Mini bars: 26 weeks chronological with horizontal baseline line */}
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
          const fill = w.aboveBaseline ? accent : '#444'
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
              data-week-above-baseline={w.aboveBaseline ? '1' : '0'}
            />
          )
        })}
        {/* Baseline horizontal line */}
        <line
          data-baseline-line
          x1={0}
          y1={baselineY}
          x2={chartW}
          y2={baselineY}
          stroke="#aaa"
          strokeDasharray="2 2"
          strokeWidth={1}
        />
      </svg>

      {/* Interpretation hint */}
      {hint ? (
        <div
          data-streak-band-hint
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
