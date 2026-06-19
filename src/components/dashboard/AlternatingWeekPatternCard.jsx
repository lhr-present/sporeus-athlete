// ─── dashboard/AlternatingWeekPatternCard.jsx ─────────────────────────────
// Surfaces `analyzeAlternatingWeekPattern` (src/lib/athlete/alternatingWeekPattern.js)
// as a Dashboard card: 8 vertical bars colored by role (HIGH / LOW /
// NEUTRAL), a horizontal mean-line marker, alternationScore as a percent,
// amplitudeRatio (e.g. "1.6×"), and HIGH/LOW counts.
//
// Render rule:
//   - Render NULL when the analyzer returns null.
//
// Cite: Issurin 2010; Mujika 2014.
// ─────────────────────────────────────────────────────────────────────────

import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { S } from '../../styles.js'
import { analyzeAlternatingWeekPattern } from '../../lib/athlete/alternatingWeekPattern.js'

const MONO = "'IBM Plex Mono', monospace"

const ROLE_COLOR = {
  HIGH:    '#ff6600',
  LOW:     '#5bc25b',
  NEUTRAL: '#888888',
}

const BAND_COLOR = {
  STRONG_ALTERNATION:   '#5bc25b',
  MODERATE_ALTERNATION: '#0064ff',
  NO_ALTERNATION:       '#888888',
  INSUFFICIENT_DATA:    '#555555',
}

const BAND_LABEL = {
  STRONG_ALTERNATION:   { en: 'STRONG ALTERNATION',   tr: 'GÜÇLÜ DÖNÜŞÜM' },
  MODERATE_ALTERNATION: { en: 'MODERATE ALTERNATION', tr: 'ORTA DÖNÜŞÜM' },
  NO_ALTERNATION:       { en: 'NO ALTERNATION',       tr: 'DÖNÜŞÜM YOK' },
  INSUFFICIENT_DATA:    { en: 'INSUFFICIENT DATA',    tr: 'YETERSİZ VERİ' },
}

const ROLE_LABEL = {
  HIGH:    { en: 'HIGH',    tr: 'YÜKSEK' },
  LOW:     { en: 'LOW',     tr: 'DÜŞÜK' },
  NEUTRAL: { en: 'NEUTRAL', tr: 'NÖTR' },
}

const BAND_HINT = {
  STRONG_ALTERNATION: {
    en: 'Clean high/low week rhythm detected. Issurin alternating-week pattern in action — suits masters and time-constrained athletes well.',
    tr: 'Net yüksek/düşük hafta ritmi tespit edildi. Issurin dönüşümlü hafta deseni uygulanıyor — masters ve zamanı kısıtlı sporcular için uygun.',
  },
  MODERATE_ALTERNATION: {
    en: 'Partial alternating rhythm. Some weeks oscillate cleanly; others drift toward neutral. Sharpen the contrast between work and recovery weeks.',
    tr: 'Kısmî dönüşüm ritmi. Bazı haftalar net dönüşüyor; diğerleri nötre kayıyor. Yüksek ve düşük haftalar arasındaki kontrastı netleştir.',
  },
  NO_ALTERNATION: {
    en: 'No clear high/low rhythm. Either consider stacking 3 build weeks + 1 deload, or sharpen the contrast to lock in an alternating pattern.',
    tr: 'Net bir yüksek/düşük ritmi yok. 3 yapım + 1 boşaltma haftası dene veya dönüşümlü deseni netleştirmek için kontrastı keskinleştir.',
  },
  INSUFFICIENT_DATA: {
    en: 'Need at least 6 weeks of training to detect a rhythm. Keep logging.',
    tr: 'Bir ritim tespit etmek için en az 6 hafta antrenman gerekiyor. Kaydetmeye devam et.',
  },
}

const MAX_BAR_HEIGHT = 60

function formatPct(x) {
  if (!Number.isFinite(x)) return '0%'
  return `${Math.round(x * 100)}%`
}

function formatAmpRatio(x) {
  if (!Number.isFinite(x) || x <= 0) return null
  return `${x.toFixed(2)}×`
}

/**
 * @description Surface `analyzeAlternatingWeekPattern` as a Dashboard card.
 *   Renders null when the analyzer returns null.
 *
 * @param {{ log: Array }} props
 */
function AlternatingWeekPatternCard({ log }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const analysis = useMemo(
    () => analyzeAlternatingWeekPattern({ log, today: new Date() }),
    [log]
  )

  if (!analysis) return null
  const {
    band,
    weeks,
    alternationScore,
    amplitudeRatio,
    highWeekCount,
    lowWeekCount,
    citation,
  } = analysis

  const title = isTR ? 'DÖNÜŞÜMLÜ HAFTA RİTMİ' : 'ALTERNATING WEEK RHYTHM'
  const ariaLabel = isTR
    ? 'Dönüşümlü hafta ritmi — yüksek/düşük hafta osilasyonu'
    : 'Alternating week rhythm — high/low week oscillation'

  const bandColor = BAND_COLOR[band] || '#888'
  const bandLabel = BAND_LABEL[band]?.[isTR ? 'tr' : 'en'] || band
  const hint = BAND_HINT[band]?.[isTR ? 'tr' : 'en'] || ''

  const hasWeeks = Array.isArray(weeks) && weeks.length > 0
  const maxTss = hasWeeks ? weeks.reduce((m, w) => (w.tss > m ? w.tss : m), 0) : 0
  const meanTss = hasWeeks
    ? weeks.reduce((s, w) => s + w.tss, 0) / weeks.length
    : 0

  // Chart geometry.
  const barW = 18
  const barGap = 6
  const chartW = hasWeeks ? weeks.length * (barW + barGap) - barGap : 0
  const chartH = MAX_BAR_HEIGHT
  const meanY = maxTss > 0 ? chartH - (meanTss / maxTss) * chartH : chartH

  const scoreLabel = isTR ? 'DÖNÜŞÜM SKORU' : 'ALTERNATION SCORE'
  const ampLabel = isTR ? 'GENLİK ORANI' : 'AMPLITUDE RATIO'
  const highLabel = isTR ? 'YÜKSEK' : 'HIGH'
  const lowLabel = isTR ? 'DÜŞÜK' : 'LOW'

  const ampStr = formatAmpRatio(amplitudeRatio)

  return (
    <div
      className="sp-card"
      role="region"
      aria-label={ariaLabel}
      data-card="alternating-week-pattern"
      data-band={band}
      data-alternation-score={String(alternationScore)}
      data-amplitude-ratio={String(amplitudeRatio)}
      data-high-week-count={String(highWeekCount)}
      data-low-week-count={String(lowWeekCount)}
      style={{
        ...S.card,
        borderLeft: `4px solid ${bandColor}`,
        padding: '20px',
        fontFamily: MONO,
      }}
    >
      <div style={S.cardTitle}>{title}</div>

      {/* ── Big stat: alternation score + band badge ─────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: '8px',
      }}>
        <div
          data-alternation-score-value=""
          style={{
            fontFamily: MONO,
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1,
            color: bandColor,
          }}
        >
          {formatPct(alternationScore)}
        </div>
        <div style={{
          fontFamily: MONO,
          fontSize: 10,
          color: 'var(--muted)',
          letterSpacing: '0.04em',
        }}>
          {scoreLabel}
        </div>
        <div
          data-alternating-band-badge=""
          style={{
            display: 'inline-block',
            fontFamily: MONO,
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
            background: bandColor,
            padding: '4px 10px',
            borderRadius: 3,
            letterSpacing: '0.08em',
            marginLeft: 'auto',
          }}
        >
          {bandLabel}
        </div>
      </div>

      {/* ── Summary chips: amplitude ratio + counts ──────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          marginBottom: '12px',
          flexWrap: 'wrap',
        }}
      >
        {ampStr && (
          <span
            style={{
              ...S.mono,
              fontSize: '10px',
              color: 'var(--muted)',
              letterSpacing: '0.04em',
            }}
          >
            {ampLabel}:{' '}
            <strong data-amplitude-ratio-str="" style={{ color: 'var(--text)' }}>
              {ampStr}
            </strong>
          </span>
        )}
        <span
          style={{
            ...S.mono,
            fontSize: '10px',
            color: 'var(--muted)',
            letterSpacing: '0.04em',
          }}
        >
          {highLabel}:{' '}
          <strong data-high-count="" style={{ color: ROLE_COLOR.HIGH }}>
            {highWeekCount}
          </strong>
          {' / '}
          {lowLabel}:{' '}
          <strong data-low-count="" style={{ color: ROLE_COLOR.LOW }}>
            {lowWeekCount}
          </strong>
        </span>
      </div>

      {/* ── 8 vertical bars + horizontal mean line ───────────────────── */}
      {hasWeeks && (
        <svg
          role="img"
          aria-label={isTR ? 'Haftalık TSS mini grafiği' : 'Weekly TSS mini chart'}
          data-alternating-bars=""
          width={chartW}
          height={chartH + 8}
          style={{ display: 'block', marginBottom: 12, overflow: 'visible' }}
        >
          {weeks.map((w, i) => {
            const h = maxTss > 0
              ? Math.max(2, (w.tss / maxTss) * chartH)
              : 2
            const y = chartH - h
            const fill = ROLE_COLOR[w.role] || ROLE_COLOR.NEUTRAL
            const roleLbl = ROLE_LABEL[w.role]?.[isTR ? 'tr' : 'en'] || w.role
            return (
              <rect
                key={w.weekStart}
                x={i * (barW + barGap)}
                y={y}
                width={barW}
                height={h}
                fill={fill}
                data-alternating-week=""
                data-week-start={w.weekStart}
                data-week-role={w.role}
                data-week-tss={String(w.tss)}
              >
                <title>{`${w.weekStart} · ${w.tss} TSS · ${roleLbl}`}</title>
              </rect>
            )
          })}
          {/* Horizontal mean line */}
          <line
            data-mean-line=""
            x1={0}
            y1={meanY}
            x2={chartW}
            y2={meanY}
            stroke="#aaa"
            strokeDasharray="2 2"
            strokeWidth={1}
          />
        </svg>
      )}

      {/* ── Legend ───────────────────────────────────────────────────── */}
      {hasWeeks && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '12px',
          }}
        >
          {['HIGH', 'LOW', 'NEUTRAL'].map((r) => (
            <span
              key={r}
              style={{
                ...S.mono,
                fontSize: '9px',
                color: 'var(--muted)',
                letterSpacing: '0.06em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  background: ROLE_COLOR[r],
                  borderRadius: '1px',
                  display: 'inline-block',
                }}
              />
              {ROLE_LABEL[r][isTR ? 'tr' : 'en']}
            </span>
          ))}
        </div>
      )}

      {/* ── Band-coloured interpretation strip ───────────────────────── */}
      <div
        data-alternating-band-hint=""
        style={{
          ...S.mono,
          fontSize: '11px',
          color: 'var(--text)',
          lineHeight: 1.55,
          paddingLeft: '8px',
          borderLeft: `2px solid ${bandColor}`,
          marginBottom: '8px',
        }}
      >
        {hint}
      </div>

      {/* ── Citation footer ──────────────────────────────────────────── */}
      <div
        data-alternating-citation=""
        style={{
          ...S.mono,
          fontSize: 9,
          color: '#555',
          marginTop: 4,
          letterSpacing: '0.04em',
        }}
      >
        {citation}
      </div>
    </div>
  )
}

export default memo(AlternatingWeekPatternCard)
