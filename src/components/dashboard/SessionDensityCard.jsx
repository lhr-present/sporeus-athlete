// ─── dashboard/SessionDensityCard.jsx — 28-day session density tracker ───────
// Surfaces analyzeSessionDensity() output: average sessions per active training
// day over the trailing 28 days, with a band badge (SINGLE/MIXED/DOUBLE) +
// double-day count + double-rate %.
//
// Citation: Bompa 2018; Mujika 2014.
// ─────────────────────────────────────────────────────────────────────────────
import { memo, useContext, useMemo  } from 'react'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import { analyzeSessionDensity } from '../../lib/athlete/sessionDensity.js'

const MONO = "'IBM Plex Mono', monospace"

// Band → accent color
const BAND_COLORS = {
  SINGLE_FOCUSED: '#0064ff',  // blue — single focused
  MIXED_DENSITY:  '#5bc25b',  // green — mixed
  DOUBLE_HEAVY:   '#ff6600',  // orange — double-heavy
}

// Band → short badge label
const BAND_LABELS = {
  SINGLE_FOCUSED: { en: 'SINGLE', tr: 'TEK' },
  MIXED_DENSITY:  { en: 'MIXED',  tr: 'KARIŞIK' },
  DOUBLE_HEAVY:   { en: 'DOUBLE', tr: 'ÇİFT' },
}

// Band → interpretation hint
const BAND_HINTS = {
  SINGLE_FOCUSED: {
    en: 'One session per training day — clean recovery between efforts.',
    tr: 'Antrenman günü başına tek seans — eforlar arasında temiz toparlanma.',
  },
  MIXED_DENSITY: {
    en: 'Occasional doubles — typical for triathletes or quality+endurance combo days.',
    tr: 'Ara sıra çift seans — triatletler veya kalite+dayanıklılık günleri için tipik.',
  },
  DOUBLE_HEAVY: {
    en: 'Frequent doubles — advanced training pattern. Recovery between AM and PM matters more here.',
    tr: 'Sık çift seans — ileri antrenman deseni. Sabah-akşam toparlanması burada daha önemli.',
  },
}

function SessionDensityCard({ log = [] }) {
  const { lang } = useContext(LangCtx) || { lang: 'en' }
  const isTR = lang === 'tr'

  const result = useMemo(() => analyzeSessionDensity({ log }), [log])

  // Render nothing on insufficient data — card stays invisible
  if (!result) return null

  const accent     = BAND_COLORS[result.band] || BAND_COLORS.SINGLE_FOCUSED
  const badgeLabel = BAND_LABELS[result.band][isTR ? 'tr' : 'en']
  const hintText   = BAND_HINTS[result.band][isTR ? 'tr' : 'en']

  const title = isTR ? 'SEANS YOĞUNLUĞU · 28G' : 'SESSION DENSITY · 28D'
  const aria  = isTR
    ? `Seans yoğunluğu — ${badgeLabel}`
    : `Session density — ${badgeLabel}`

  const densityStr     = result.density.toFixed(2)
  const sessionsLabel  = isTR ? 'seans' : `session${result.totalSessions === 1 ? '' : 's'}`
  const daysLabel      = isTR ? 'gün' : `day${result.activeDays === 1 ? '' : 's'}`
  const doubleDaysLbl  = isTR ? 'çift gün' : `double day${result.doubleDays === 1 ? '' : 's'}`
  const doubleRatePct  = Math.round(result.doubleRate * 100)

  return (
    <div
      role="region"
      aria-label={aria}
      data-session-density-card
      data-density-band={result.band}
      data-density={result.density.toFixed(4)}
      data-active-days={result.activeDays}
      data-double-days={result.doubleDays}
      data-double-rate={result.doubleRate.toFixed(4)}
      style={{
        background: 'var(--card-bg, #111)',
        border: '1px solid var(--border, #222)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
        fontFamily: MONO,
        color: 'var(--text, #e5e5e5)',
      }}
    >
      {/* ─── Title ─────────────────────────────────────────────────────── */}
      <div style={{
        fontSize: 12,
        letterSpacing: '0.06em',
        fontWeight: 700,
        marginBottom: 12,
        color: 'var(--text)',
      }}>
        <span style={{ color: accent, marginRight: 6 }}>◢</span>
        {title}
      </div>

      {/* ─── Density value + band badge ────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: 6,
      }}>
        <span style={{
          fontSize: 32,
          fontWeight: 700,
          color: accent,
          lineHeight: 1,
          fontFamily: MONO,
        }}>
          {densityStr}
        </span>
        <span
          aria-label={isTR ? `Bant: ${badgeLabel}` : `Band: ${badgeLabel}`}
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: accent,
            background: `${accent}22`,
            border: `1px solid ${accent}66`,
            borderRadius: 3,
            padding: '3px 6px',
            fontFamily: MONO,
          }}
        >
          {badgeLabel}
        </span>
      </div>

      {/* ─── Sessions / days breakdown ─────────────────────────────────── */}
      <div style={{
        fontSize: 11,
        color: 'var(--muted, #888)',
        marginBottom: 8,
        fontFamily: MONO,
      }}>
        {result.totalSessions} {sessionsLabel} · {result.activeDays} {daysLabel}
      </div>

      {/* ─── Double-day stats ──────────────────────────────────────────── */}
      <div style={{
        fontSize: 11,
        color: 'var(--text)',
        marginBottom: 10,
        fontFamily: MONO,
      }}>
        {result.doubleDays} {doubleDaysLbl} ({doubleRatePct}%)
      </div>

      {/* ─── Interpretation hint ───────────────────────────────────────── */}
      <div
        aria-live="polite"
        style={{
          fontSize: 11,
          color: 'var(--sub, var(--muted, #aaa))',
          lineHeight: 1.6,
          marginBottom: 10,
          fontFamily: MONO,
        }}
      >
        {hintText}
      </div>

      {/* ─── Citation footer ───────────────────────────────────────────── */}
      <div style={{
        fontSize: 9,
        color: '#555',
        fontFamily: MONO,
      }}>
        {result.citation}
      </div>
    </div>
  )
}

export default memo(SessionDensityCard)
